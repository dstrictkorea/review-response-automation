import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import { scanText } from '@/services/filterService'


const SYSTEM_PROMPT = `You are ARTE Museum's internal review response assistant.
Your job is to help staff draft professional, brand-appropriate responses to guest reviews.

CRITICAL CONTEXT — READ THIS FIRST:
These replies are PUBLIC and posted on Google, Naver, and other platforms.
They are read by THOUSANDS of future visitors who are deciding whether to visit.
You are writing to TWO audiences at once:
  1. The reviewer — acknowledge their experience directly
  2. Future visitors — reassure them, show the museum is professional and caring

WRITING PRINCIPLES FOR PUBLIC REPLIES:
- For complaints: briefly acknowledge the specific issue, then add ONE sentence showing what action is being taken or planned (e.g., "We are reviewing our queue management to improve wait times"). Do NOT over-promise.
- For mixed reviews: thank them genuinely, address the concern, and highlight what makes ARTE special for future visitors.
- For positive reviews: be specific about what makes the experience unique (light art, immersive digital installations, multi-sensory exhibits). Avoid generic phrases.
- Write with the tone of a professional, caring museum management team — not a call-centre script.
- Avoid sounding defensive. If something went wrong, own it briefly and move forward.

ABOUT ARTE MUSEUM:
ARTE Museum is an immersive digital art museum featuring light installations and multi-sensory experiences across multiple locations in South Korea and internationally. It is a premium cultural destination especially popular for families, couples, and content creation.

ABSOLUTE SAFETY RULES — NEVER VIOLATE:
1. Never promise refunds or monetary compensation.
2. Never admit legal liability or responsibility for injuries/accidents.
3. Never mention CCTV review or investigation.
4. Never promise staff punishment or disciplinary action.
5. Never reveal internal operational details.
6. Always respond in the same language as the review.
7. Maintain a warm, professional, non-defensive tone.
8. If the review contains typos, abbreviations, or non-standard spelling, interpret the most likely intended meaning and respond accordingly. Do not point out the typos in your reply.
9. Never start every reply the same way — vary the opening phrase to avoid repetition.

OUTPUT FORMAT: You must respond with valid JSON only. No markdown, no explanation outside the JSON.

JSON schema:
{
  "detected_language": "ko" | "en" | "zh" | "ja" | ...,
  "sentiment": "positive" | "neutral" | "mixed" | "negative",
  "risk_level": "low" | "medium" | "high" | "critical",
  "categories": string[],
  "risk_reasons": string[],
  "internal_note_ko": string,
  "forbidden_check": {
    "refund_promise": boolean,
    "legal_admission": boolean,
    "cctv_mention": boolean,
    "staff_discipline": boolean
  },
  "draft_short": string,
  "draft_standard": string,
  "draft_careful": string
}

Draft length guide:
- draft_short: 1-2 sentences, warm acknowledgment — for quick positive replies
- draft_standard: 2-4 sentences, balanced — addresses reviewer AND reassures future visitors
- draft_careful: 4-6 sentences, empathetic and thorough — for medium/high-risk reviews; includes one concrete improvement note

Risk level guide:
- low: Positive or neutral reviews, no sensitive content
- medium: Minor complaints, requests for improvement
- high: Refund requests, safety concerns, staff complaints, 1-2 star reviews with strong language
- critical: Injury/accident reports, legal threats, discrimination allegations, media threats, personal data mentions`

export async function POST(request: NextRequest) {
  // Resolve which AI provider to use — priority: Groq → Gemini → OpenAI
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const activeKey = groqKey ?? geminiKey ?? openaiKey
  if (!activeKey) {
    return NextResponse.json(
      { error: 'AI API 키가 설정되지 않았습니다. Vercel 환경변수에 GROQ_API_KEY를 추가해주세요.' },
      { status: 500 }
    )
  }
  const baseURL = groqKey
    ? 'https://api.groq.com/openai/v1'
    : geminiKey
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
      : undefined
  const model = groqKey
    ? (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile')
    : geminiKey
      ? (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite')
      : (process.env.OPENAI_MODEL ?? 'gpt-4o')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let review_id: string
  let draft_type: 'standard' | 'short' | 'careful' = 'standard'
  try {
    const body = await request.json()
    review_id = body.review_id
    if (body.draft_type === 'short' || body.draft_type === 'careful') draft_type = body.draft_type
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  if (!review_id) {
    return NextResponse.json({ error: 'review_id가 필요합니다.' }, { status: 400 })
  }

  const [{ data: review }, { data: riskKeywordsRow }, { data: templatesRow }] =
    await Promise.all([
      supabase.from('reviews').select('*').eq('id', review_id).single(),
      supabase.from('app_settings').select('value').eq('key', 'risk_keywords').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'reply_templates').maybeSingle(),
    ])

  if (!review) {
    return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
  }

  const riskKeywords: RiskKeyword[] = (riskKeywordsRow?.value as RiskKeyword[]) ?? []
  const replyTemplates: ReplyTemplate[] = (templatesRow?.value as ReplyTemplate[]) ?? []

  // ── 1차 키워드 필터 ────────────────────────────────────────────────────────
  const activeKeywords = riskKeywords.filter((k) => k.is_active)
  const filterResult = scanText(review.review_text ?? '', activeKeywords)

  const preFilterNote = filterResult.triggered
    ? `\nPRE-FILTER ALERT — Keyword filter already detected risk expressions:\n` +
      filterResult.matches
        .map((m) => `  - keyword="${m.keyword}" riskLevel=${m.riskLevel} context="${m.context}"`)
        .join('\n') +
      `\nMinimum risk_level required: ${filterResult.maxRiskLevel}. Your isolation_reason MUST reference these.\n`
    : ''

  const branchData = await supabase
    .from('branches')
    .select('*')
    .eq('code', review.branch_code)
    .maybeSingle()

  const branchInfo = branchData.data

  const branchDisplayName = branchInfo
    ? `${branchInfo.name_ko}${branchInfo.name_en ? ' / ' + branchInfo.name_en : ''}`
    : review.branch_code

  const userMessage = `Branch: ${review.branch_code} (${branchDisplayName})
Channel: ${review.channel_code}
Rating: ${review.rating ?? 'Not provided'}/5
Review date: ${review.review_created_at ?? 'Unknown'}
Reviewer: ${review.reviewer_name ?? 'Anonymous'}
${preFilterNote}
Review text:
${review.review_text}

CONTEXT FOR YOUR REPLY:
- This reply will be posted PUBLICLY on ${review.channel_code}. Future visitors will read it.
- Branch location: ${branchDisplayName}
- If the reviewer mentions a specific problem (queues, crowds, broken equipment, rude staff, unclear directions), acknowledge it and add one sentence showing the team is addressing or reviewing it.
- If the review is positive, include one specific detail about ARTE's experience that would be useful for a future visitor who hasn't been yet.
- Do NOT start with "안녕하세요" or "Dear [name]" — vary the opening.

Active risk keywords to check: ${riskKeywords.filter((k) => k.is_active).map((k) => `"${k.keyword}" (${k.language}, ${k.risk_level})`).join(', ') || 'None configured'}

Available reply templates for reference:
${replyTemplates.slice(0, 5).map((t) => `[${t.category}/${t.language}] ${t.name}: ${t.content.slice(0, 100)}...`).join('\n') || 'None configured'}

Generate three reply drafts. Remember: write for both the reviewer AND future visitors searching for information about this venue.
Respond with JSON only.`

  let aiResult: {
    detected_language: string
    sentiment: string
    risk_level: string
    categories: string[]
    risk_reasons: string[]
    internal_note_ko: string
    forbidden_check: {
      refund_promise: boolean
      legal_admission: boolean
      cctv_mention: boolean
      staff_discipline: boolean
    }
    draft_short: string
    draft_standard: string
    draft_careful: string
  }

  try {
    const openai = new OpenAI({ apiKey: activeKey, baseURL })
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })
    const text = completion.choices[0].message.content ?? ''

    const jsonMatch = (text ?? '').match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found in response')
    aiResult = JSON.parse(jsonMatch[0])
  } catch (err: any) {
    console.error('AI generation error:', err)
    const msg = err?.message ?? String(err)
    return NextResponse.json({ error: `AI 초안 생성 실패: ${msg}` }, { status: 500 })
  }

  // ── 위험도 병합 (필터 floor + AI + 평점) ────────────────────────────────────
  const RISK_RANK_MAP: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
  const RANK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
  const ratingRisk = review.rating != null && review.rating <= 2 ? 'high' : null
  const filterRisk = filterResult.triggered ? filterResult.maxRiskLevel : null
  const maxRank = Math.max(
    RISK_RANK_MAP[aiResult.risk_level] ?? 0,
    RISK_RANK_MAP[ratingRisk ?? 'low'] ?? 0,
    RISK_RANK_MAP[filterRisk ?? 'low'] ?? 0,
  )
  const finalRiskLevel = RANK_LEVELS[maxRank] ?? 'low'

  // ── 격리 필요 여부 (pending_approval vs ai_done) ──────────────────────────
  const hasForbiddenFlag = Object.values(aiResult.forbidden_check ?? {}).some((v) => v === true)
  const needsReview =
    filterResult.triggered ||
    hasForbiddenFlag ||
    (review.rating != null && review.rating <= 3) ||
    ['medium', 'high', 'critical'].includes(finalRiskLevel)
  const finalStatus = needsReview ? 'pending_approval' : 'ai_done'

  const { data: existingDraft } = await supabase
    .from('reply_drafts')
    .select('id')
    .eq('review_id', review_id)
    .maybeSingle()

  const selectedReply =
    draft_type === 'short' ? aiResult.draft_short
    : draft_type === 'careful' ? aiResult.draft_careful
    : aiResult.draft_standard

  const draftPayload = {
    review_id,
    draft_short: aiResult.draft_short,
    draft_standard: aiResult.draft_standard,
    draft_careful: aiResult.draft_careful,
    selected_draft_type: draft_type,
    selected_reply: selectedReply,
    forbidden_check: aiResult.forbidden_check,
    prompt_version: 'v1.0',
    model_name: model,
    updated_at: new Date().toISOString(),
  }

  let draft
  if (existingDraft) {
    const { data } = await supabase
      .from('reply_drafts')
      .update(draftPayload)
      .eq('id', existingDraft.id)
      .select()
      .single()
    draft = data
  } else {
    const { data } = await supabase
      .from('reply_drafts')
      .insert(draftPayload)
      .select()
      .single()
    draft = data
  }

  const combinedRiskReasons = [
    ...filterResult.matchedKeywords.map((k) => `[1차필터] ${k}`),
    ...(aiResult.risk_reasons ?? []),
  ]
  const combinedNote = [
    filterResult.triggered ? filterResult.isolationSummary : null,
    aiResult.internal_note_ko || null,
  ].filter(Boolean).join('\n')

  await supabase.from('reviews').update({
    status: finalStatus,
    risk_level: finalRiskLevel,
    sentiment: aiResult.sentiment,
    categories: aiResult.categories,
    risk_reasons: combinedRiskReasons,
    review_language: aiResult.detected_language,
    internal_note_ko: combinedNote || aiResult.internal_note_ko,
    updated_at: new Date().toISOString(),
  }).eq('id', review_id)

  await supabase.from('activity_logs').insert({
    review_id,
    actor_name: user.email,
    action: needsReview ? 'review_isolated' : 'ai_draft_generated',
    detail: {
      model,
      risk_level:       finalRiskLevel,
      status:           finalStatus,
      sentiment:        aiResult.sentiment,
      filter_triggered: filterResult.triggered,
      filter_keywords:  filterResult.matchedKeywords,
    },
  })

  return NextResponse.json({
    draft,
    risk_level: finalRiskLevel,
    sentiment: aiResult.sentiment,
    categories: aiResult.categories,
  })
}

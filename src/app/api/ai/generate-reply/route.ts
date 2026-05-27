import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'

const SYSTEM_PROMPT = `You are ARTE Museum's internal review response assistant.
Your job is to help staff draft professional, brand-appropriate responses to guest reviews.

ABSOLUTE SAFETY RULES — NEVER VIOLATE:
1. Never promise refunds or monetary compensation.
2. Never admit legal liability or responsibility for injuries/accidents.
3. Never mention CCTV review or investigation.
4. Never promise staff punishment or disciplinary action.
5. Never reveal internal operational details.
6. Always respond in the same language as the review.
7. Maintain a warm, professional, non-defensive tone.

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

Risk level guide:
- low: Positive or neutral reviews, no sensitive content
- medium: Minor complaints, requests for improvement
- high: Refund requests, safety concerns, staff complaints, 1-2 star reviews with strong language
- critical: Injury/accident reports, legal threats, discrimination allegations, media threats, personal data mentions`

export async function POST(request: NextRequest) {
  // Build the AI client inside the handler so env vars are always fresh
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const activeKey = geminiKey ?? openaiKey
  if (!activeKey) {
    return NextResponse.json(
      { error: 'AI API 키가 설정되지 않았습니다. Vercel 환경변수에 GEMINI_API_KEY를 추가해주세요.' },
      { status: 500 }
    )
  }
  const openai = new OpenAI({
    apiKey: activeKey,
    baseURL: geminiKey
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
      : undefined,
  })
  const model = geminiKey
    ? (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash')
    : (process.env.OPENAI_MODEL ?? 'gpt-4o')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let review_id: string
  try {
    const body = await request.json()
    review_id = body.review_id
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

  const branchData = await supabase
    .from('branches')
    .select('*')
    .eq('code', review.branch_code)
    .maybeSingle()

  const branchInfo = branchData.data

  const userMessage = `Branch: ${review.branch_code}${branchInfo ? ` (${branchInfo.name_ko}${branchInfo.name_en ? ' / ' + branchInfo.name_en : ''})` : ''}
Channel: ${review.channel_code}
Rating: ${review.rating ?? 'Not provided'}/5
Review date: ${review.review_created_at ?? 'Unknown'}
Reviewer: ${review.reviewer_name ?? 'Anonymous'}

Review text:
${review.review_text}

Active risk keywords to check: ${riskKeywords.filter((k) => k.is_active).map((k) => `"${k.keyword}" (${k.language}, ${k.risk_level})`).join(', ') || 'None configured'}

Available reply templates for reference:
${replyTemplates.slice(0, 5).map((t) => `[${t.category}/${t.language}] ${t.name}: ${t.content.slice(0, 100)}...`).join('\n') || 'None configured'}

Generate three reply drafts:
- draft_short: 1-2 sentences, warm acknowledgment
- draft_standard: 2-4 sentences, balanced and professional
- draft_careful: 4-6 sentences, empathetic and thorough, but still no promises

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
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found in response')
    aiResult = JSON.parse(jsonMatch[0])
  } catch (err: any) {
    console.error('AI generation error:', err)
    const msg = err?.message ?? String(err)
    return NextResponse.json({ error: `AI 초안 생성 실패: ${msg}` }, { status: 500 })
  }

  // Hardcoded safety override: critical/high risk reviews always stay at that level
  const ratingRisk =
    review.rating != null && review.rating <= 2 ? 'high' : null
  const finalRiskLevel =
    aiResult.risk_level === 'critical' || ratingRisk === 'high'
      ? aiResult.risk_level === 'critical' ? 'critical' : 'high'
      : aiResult.risk_level

  const { data: existingDraft } = await supabase
    .from('reply_drafts')
    .select('id')
    .eq('review_id', review_id)
    .maybeSingle()

  const draftPayload = {
    review_id,
    draft_short: aiResult.draft_short,
    draft_standard: aiResult.draft_standard,
    draft_careful: aiResult.draft_careful,
    selected_draft_type: 'standard',
    selected_reply: aiResult.draft_standard,
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

  await supabase.from('reviews').update({
    status: 'ai_done',
    risk_level: finalRiskLevel,
    sentiment: aiResult.sentiment,
    categories: aiResult.categories,
    risk_reasons: aiResult.risk_reasons,
    review_language: aiResult.detected_language,
    internal_note_ko: aiResult.internal_note_ko,
    updated_at: new Date().toISOString(),
  }).eq('id', review_id)

  await supabase.from('activity_logs').insert({
    review_id,
    actor_name: user.email,
    action: 'ai_draft_generated',
    detail: {
      model,
      risk_level: finalRiskLevel,
      sentiment: aiResult.sentiment,
    },
  })

  return NextResponse.json({
    draft,
    risk_level: finalRiskLevel,
    sentiment: aiResult.sentiment,
    categories: aiResult.categories,
  })
}

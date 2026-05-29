import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import { scanText } from '@/services/filterService'
import {
  getCulturalProfile,
  buildSystemPrompt,
  buildUserMessage,
} from '@/services/aiService'

// ── Provider URL map ──────────────────────────────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

const RISK_RANK_MAP: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_LEVELS = ['low', 'medium', 'high', 'critical'] as const

function floorRisk(...levels: Array<string | null | undefined>): string {
  const max = Math.max(...levels.map((l) => RISK_RANK_MAP[l ?? 'low'] ?? 0))
  return RANK_LEVELS[max] ?? 'low'
}

// ── LLM 응답 타입 ─────────────────────────────────────────────────────────────
interface AIResult {
  detected_language: string
  sentiment: string
  risk_level: string
  categories: string[]
  risk_reasons: string[]
  core_complaint: string
  isolation_reason: string
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

export async function POST(request: NextRequest) {
  // ── AI 프로바이더 선택 ────────────────────────────────────────────────────
  const groqKey   = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const activeKey = groqKey ?? geminiKey ?? openaiKey

  if (!activeKey) {
    return NextResponse.json(
      { error: 'AI API 키가 설정되지 않았습니다. Vercel 환경변수에 GROQ_API_KEY를 추가해주세요.' },
      { status: 500 },
    )
  }

  const baseURL = groqKey   ? PROVIDER_BASE_URLS.groq
                : geminiKey ? PROVIDER_BASE_URLS.gemini
                : undefined

  const model = groqKey   ? (process.env.GROQ_MODEL   ?? 'llama-3.3-70b-versatile')
              : geminiKey ? (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite')
              :             (process.env.OPENAI_MODEL ?? 'gpt-4o')

  // ── 인증 ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  // ── 요청 파싱 ─────────────────────────────────────────────────────────────
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

  // ── 병렬 조회 ──────────────────────────────────────────────────────────────
  const [{ data: review }, { data: riskKeywordsRow }, { data: templatesRow }] =
    await Promise.all([
      supabase.from('reviews').select('*').eq('id', review_id).single(),
      supabase.from('app_settings').select('value').eq('key', 'risk_keywords').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'reply_templates').maybeSingle(),
    ])

  if (!review) {
    return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
  }

  const riskKeywords: RiskKeyword[]   = (riskKeywordsRow?.value as RiskKeyword[])   ?? []
  const replyTemplates: ReplyTemplate[] = (templatesRow?.value  as ReplyTemplate[]) ?? []

  // ── 1차 글로벌 키워드 필터 ──────────────────────────────────────────────────
  const activeKeywords = riskKeywords.filter((k) => k.is_active)
  const filterResult   = scanText(review.review_text ?? '', activeKeywords)

  const preFilterNote = filterResult.triggered
    ? `\nPRE-FILTER ALERT — 글로벌 위험 키워드 필터가 다음 표현을 탐지했습니다:\n` +
      filterResult.matches
        .map((m) =>
          `  - keyword="${m.keyword}" riskLevel=${m.riskLevel} lang=${m.lang} context="${m.context}"`,
        )
        .join('\n') +
      `\nMinimum risk_level required: ${filterResult.maxRiskLevel}. ` +
      `Your isolation_reason MUST explicitly reference EACH detected expression.\n`
    : ''

  // ── 지점 표시 이름 + 재방문 고객 감지 (병렬) ──────────────────────────────
  const reviewerName = review.reviewer_name?.trim()
  const [branchData, repeatResult] = await Promise.all([
    supabase
      .from('branches')
      .select('name_ko, name_en, country_code')   // PHASE 4: country_code for dynamic profile
      .eq('code', review.branch_code)
      .maybeSingle(),
    reviewerName
      ? supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('branch_code', review.branch_code)
          .eq('reviewer_name', reviewerName)
          .neq('id', review_id)
      : Promise.resolve({ count: 0 }),
  ])

  const branchDisplayName = branchData.data
    ? `${branchData.data.name_ko}${branchData.data.name_en ? ' / ' + branchData.data.name_en : ''}`
    : review.branch_code
  const reviewerPreviousCount = repeatResult.count ?? 0

  // ── 문화 프로파일 + 프롬프트 구성 (aiService SSOT) ──────────────────────────
  const reviewLang       = review.review_language ?? 'ko'
  const culturalProfile  = getCulturalProfile(
    review.branch_code,
    reviewLang,
    branchData.data?.country_code ?? null,   // PHASE 4: DB value takes priority
  )
  const matchedTemplates = replyTemplates.filter((t) => t.language === reviewLang)

  const systemPrompt = buildSystemPrompt(culturalProfile, matchedTemplates)
  const userMessage  = buildUserMessage({
    branchCode:             review.branch_code,
    branchDisplayName,
    channelCode:            review.channel_code,
    channelName:            review.channel_code,
    rating:                 review.rating,
    reviewerName:           review.reviewer_name,
    reviewText:             review.review_text ?? '',
    preFilterNote,
    activeKeywords,
    reviewerPreviousCount,
  })

  // ── LLM 호출 ───────────────────────────────────────────────────────────────
  let aiResult: AIResult
  try {
    const openai = new OpenAI({ apiKey: activeKey, baseURL })
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    })
    const text = completion.choices[0].message.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found in response')
    aiResult = JSON.parse(jsonMatch[0]) as AIResult
  } catch (err: unknown) {
    console.error('AI generation error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI 초안 생성 실패: ${msg}` }, { status: 500 })
  }

  // ── 위험도 병합 (필터 floor + AI) — 평점 floor 폐기 (PHASE 1) ───────────────
  const finalRiskLevel = floorRisk(
    aiResult.risk_level,
    filterResult.triggered ? filterResult.maxRiskLevel : null,
  )

  // ── 격리 필요 여부 — 평점 기반 격리 제거, 문맥·키워드 기반만 유지 ───────────
  const hasForbiddenFlag = Object.values(aiResult.forbidden_check ?? {}).some((v) => v === true)
  const needsReview =
    filterResult.triggered ||
    hasForbiddenFlag ||
    ['medium', 'high', 'critical'].includes(finalRiskLevel)
  const finalStatus = needsReview ? 'pending_approval' : 'ai_done'

  // ── 격리 사유 + 핵심 불만 통합 ──────────────────────────────────────────────
  const combinedNote = [
    filterResult.triggered   ? filterResult.isolationSummary : null,
    aiResult.isolation_reason || null,
    aiResult.internal_note_ko || null,
    aiResult.core_complaint   ? `핵심 불만: ${aiResult.core_complaint}` : null,
  ].filter(Boolean).join('\n')

  const combinedRiskReasons = [
    ...filterResult.matchedKeywords.map((k) => `[1차필터] ${k}`),
    ...(aiResult.risk_reasons ?? []),
  ]

  // ── reply_drafts upsert ─────────────────────────────────────────────────────
  const { data: existingDraft } = await supabase
    .from('reply_drafts')
    .select('id')
    .eq('review_id', review_id)
    .maybeSingle()

  const selectedReply =
    draft_type === 'short'   ? aiResult.draft_short
    : draft_type === 'careful' ? aiResult.draft_careful
    :                            aiResult.draft_standard

  const draftPayload = {
    review_id,
    draft_short:          aiResult.draft_short,
    draft_standard:       aiResult.draft_standard,
    draft_careful:        aiResult.draft_careful,
    selected_draft_type:  draft_type,
    selected_reply:       selectedReply,
    forbidden_check:      aiResult.forbidden_check,
    prompt_version:       'gr-v3',
    model_name:           model,
    // ── 텔레메트리 (Wave 11) — 수동 생성은 항상 LLM 경로 ────────────────────
    pipeline_engine:      'llm',
    intent_code:          aiResult.categories?.[0] ?? null,
    intent_confidence:    null,
    updated_at:           new Date().toISOString(),
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

  // ── 리뷰 상태 업데이트 ──────────────────────────────────────────────────────
  await supabase
    .from('reviews')
    .update({
      status:           finalStatus,
      risk_level:       finalRiskLevel,
      sentiment:        aiResult.sentiment,
      categories:       aiResult.categories,
      risk_reasons:     combinedRiskReasons,
      review_language:  aiResult.detected_language,
      internal_note_ko: combinedNote || null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', review_id)

  // ── 활동 로그 ──────────────────────────────────────────────────────────────
  await supabase.from('activity_logs').insert({
    review_id,
    actor_name: user.email,
    action:     needsReview ? 'review_isolated' : 'ai_draft_generated',
    detail: {
      model,
      prompt_version:   'gr-v3',
      risk_level:       finalRiskLevel,
      status:           finalStatus,
      sentiment:        aiResult.sentiment,
      cultural_profile: culturalProfile.countryCode,
      filter_triggered: filterResult.triggered,
      filter_keywords:  filterResult.matchedKeywords,
      filter_langs:     filterResult.detectedLangs,
      has_forbidden:    hasForbiddenFlag,
      core_complaint:   aiResult.core_complaint || null,
    },
  })

  return NextResponse.json({
    draft,
    risk_level: finalRiskLevel,
    sentiment:  aiResult.sentiment,
    categories: aiResult.categories,
  })
}

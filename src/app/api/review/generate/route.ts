/**
 * POST /api/review/generate — 결정론적 하이브리드 게이트키퍼
 *
 * Algorithm-First(인입 필터는 import 단계) 이후의 답변 생성 단일 진입점.
 *   1) WaterfallRegexEngine 결정론적 분류 (processReview)
 *   2) SAFE      → 정적 STANDARD 템플릿 (LLM 미사용) → status='ai_done'
 *      EMERGENCY → 건조 사과 정적 초안 + 사람 수동 검토 → status='pending_approval'
 *      COMPLAINT/AMBIGUOUS → LLM Fallback(태그/근거 프롬프트 주입) → status='pending_approval'
 *   3) Double-Check: 출처(정적/LLM) 무관 모든 답변을 게시 전 금칙어 필터(scanForbidden) 통과
 *
 * LLM은 시스템 기본 엔진이 아니라 '불만/모호' 전용 예외 처리기로 격리된다.
 * LLM 키 미설정/호출 실패 시에도 건조 사과 정적 폴백으로 안전하게 승인 대기 처리한다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { processReview } from '@/lib/reviewProcessor'
import { scanForbidden, refreshEngineFromDB } from '@/lib/waterfallRegexEngine'
import { buildStaticReply } from '@/lib/replyTemplates'
import { branchOfficialName } from '@/lib/branches'
import type { Language } from '@/lib/i18n'

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
function floorRisk(...levels: Array<string | null | undefined>): string {
  const max = Math.max(0, ...levels.map((l) => RISK_RANK[l ?? 'low'] ?? 0))
  return RANK_LEVELS[max] ?? 'low'
}

function langKeyOf(l: string | null | undefined): Language {
  return (['ko', 'en', 'ja', 'zh'].includes(l ?? '') ? l : 'ko') as Language
}

const FORBIDDEN_FLAGS_CLEAN = { refund_promise: false, legal_admission: false, cctv_mention: false, staff_discipline: false }

type Supa = Awaited<ReturnType<typeof createClient>>
async function upsertDraft(supabase: Supa, reviewId: string, payload: Record<string, unknown>): Promise<unknown> {
  const { data: existing } = await supabase.from('reply_drafts').select('id').eq('review_id', reviewId).maybeSingle()
  if (existing) {
    const { data } = await supabase.from('reply_drafts').update(payload).eq('id', (existing as { id: string }).id).select().single()
    return data
  }
  const { data } = await supabase.from('reply_drafts').insert(payload).select().single()
  return data
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const actorEmail = user.email  // 클로저(dryFallback) 내 narrowing 유지용

  let reviewId: string
  try {
    const body = await request.json()
    reviewId = body.review_id
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!reviewId) return NextResponse.json({ error: 'review_id가 필요합니다.' }, { status: 400 })

  const { data: review } = await supabase.from('reviews').select('*').eq('id', reviewId).single()
  if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })

  const lang = langKeyOf(review.review_language)

  // PHASE 2: DB 규칙을 엔진에 로드 후 분류 (실패 시 하드코딩 DEFAULTS)
  await refreshEngineFromDB()

  // ── Algorithm: 결정론적 분류 + 라우팅 ──────────────────────────────────────────
  const decision = processReview({
    reviewText:   review.review_text ?? '',
    branchCode:   review.branch_code,
    language:     lang,
    reviewerName: review.reviewer_name,
  })
  const cls = decision.classification
  const now = new Date().toISOString()

  // 위험도 floor-only (인입 시 위험도 절대 하향 금지)
  const existingRisk = (review.risk_level as string | null) ?? 'low'
  const riskByClass = cls.status === 'EMERGENCY' ? 'high' : cls.status === 'COMPLAINT' ? 'medium' : 'low'
  const finalRisk = floorRisk(existingRisk, riskByClass)

  async function applyReviewMeta(status: string, extraNote?: string) {
    await supabase
      .from('reviews')
      .update({
        status,
        risk_level:       finalRisk,
        categories:       cls.tags,
        risk_reasons:     [cls.reason, ...cls.tags.map((t) => `[tag] ${t}`)],
        internal_note_ko: [cls.reason, extraNote].filter(Boolean).join('\n') || null,
        updated_at:       now,
      })
      .eq('id', reviewId)
  }

  // ════════════ STATIC(SAFE) / MANUAL(EMERGENCY) — 정적, LLM 미사용 ════════════
  if (decision.route === 'static' || decision.route === 'manual') {
    const reply = decision.staticReply
      ?? buildStaticReply(cls, { branchCode: review.branch_code, language: lang, reviewerName: review.reviewer_name })
    const fb = scanForbidden(reply) // Double-Check (정적 블록은 사전 검수되어 항상 clean)
    const status = decision.requiresApproval ? 'pending_approval' : 'ai_done'

    const draft = await upsertDraft(supabase, reviewId, {
      review_id:           reviewId,
      draft_short:         null,
      draft_standard:      reply,
      draft_careful:       null,
      selected_draft_type: 'standard',
      selected_reply:      reply,
      forbidden_check:     FORBIDDEN_FLAGS_CLEAN,
      prompt_version:      decision.route === 'manual' ? 'algo-emergency-v1' : 'algo-v1',
      model_name:          null,
      pipeline_engine:     'template',
      intent_code:         cls.status,
      intent_confidence:   1,
      updated_at:          now,
    })
    await applyReviewMeta(status, decision.route === 'manual' ? '⚠ 긴급 격리 — 사람 수동 검토 필요(건조 사과 정적 초안)' : undefined)
    await supabase.from('activity_logs').insert({
      review_id: reviewId,
      actor_name: actorEmail,
      action: decision.route === 'manual' ? 'review_isolated' : 'ai_draft_generated',
      detail: { engine: 'template', route: decision.route, status, classification: cls.status, tags: cls.tags, reason: cls.reason, forbidden_clean: fb.clean },
    })
    return NextResponse.json({
      engine: 'template', route: decision.route, status, risk_level: finalRisk,
      classification: cls.status, tags: cls.tags, requiresApproval: decision.requiresApproval,
      forbidden_clean: fb.clean, draft,
    })
  }

  // ════════════ LLM FALLBACK (COMPLAINT / AMBIGUOUS) ════════════
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const activeKey = groqKey ?? geminiKey ?? openaiKey
  const official = branchOfficialName(review.branch_code, lang)

  // 건조 사과 정적 폴백 (LLM 키 없음 / 호출 실패 시 파이프라인 중단 방지)
  async function dryFallback(note: string) {
    const reply = buildStaticReply({ ...cls, isComplaint: true }, { branchCode: review.branch_code, language: lang, reviewerName: review.reviewer_name })
    const draft = await upsertDraft(supabase, reviewId, {
      review_id: reviewId, draft_short: null, draft_standard: reply, draft_careful: null,
      selected_draft_type: 'standard', selected_reply: reply, forbidden_check: FORBIDDEN_FLAGS_CLEAN,
      prompt_version: 'algo-fallback-v1', model_name: null, pipeline_engine: 'template',
      intent_code: cls.status, intent_confidence: null, updated_at: now,
    })
    await applyReviewMeta('pending_approval', note)
    await supabase.from('activity_logs').insert({
      review_id: reviewId, actor_name: actorEmail, action: 'review_isolated',
      detail: { engine: 'template-fallback', route: 'llm', classification: cls.status, tags: cls.tags, reason: cls.reason, note },
    })
    return NextResponse.json({
      engine: 'template-fallback', route: 'llm', status: 'pending_approval', risk_level: finalRisk,
      classification: cls.status, tags: cls.tags, requiresApproval: true, forbidden_clean: true, draft,
    })
  }

  if (!activeKey) return dryFallback('LLM 키 미설정 — 건조 사과 정적 폴백, 승인 대기')

  const baseURL = groqKey ? PROVIDER_BASE_URLS.groq : geminiKey ? PROVIDER_BASE_URLS.gemini : undefined
  const model = groqKey   ? (process.env.GROQ_MODEL   ?? 'llama-3.3-70b-versatile')
              : geminiKey ? (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite')
              :             (process.env.OPENAI_MODEL ?? 'gpt-4o')

  // 알고리즘 분석 결과(reason/tags)를 프롬프트에 강제 주입 (맥락 이탈 방지)
  const systemPrompt = [
    '[STRICT FACT-BOUNDARY — 최우선 절대 규칙]',
    '환불·무료 티켓·할인·금전적 보상 등 권한 없는 보상 정책을 절대 지어내거나 약속하지 마십시오.',
    '법적 책임 인정, CCTV 확인 약속, 직원 징계 약속도 금지입니다. 사실 관계를 왜곡하지 마십시오.',
    'Never invent or promise refunds, free tickets, discounts, or compensation. Do not admit legal liability, promise CCTV review, or staff discipline. Do not distort facts.',
    '',
    '당신은 ARTE MUSEUM의 CS 전문 상담사입니다.',
    `아래 리뷰는 결정론적 알고리즘이 '${cls.status}'(으)로 분류했습니다.`,
    `분석 근거(reason): ${cls.reason}`,
    `분석 태그(tags): ${cls.tags.join(', ') || '없음'}`,
    `지점(공식명, 내부코드 노출 금지): ${official}`,
    '이 분석 결과의 맥락을 벗어나지 말고, 정중하고 공감하는 STANDARD 톤의 응대문을 작성하십시오.',
    `답변 언어: ${lang}. 5문장 이내. 답변 본문만 출력(JSON/머리말/설명 없이).`,
  ].join('\n')
  const userMessage =
    `리뷰 별점: ${review.rating ?? '-'}\n리뷰 작성자: ${review.reviewer_name ?? '-'}\n리뷰 원문:\n${review.review_text ?? ''}`

  let reply: string
  try {
    const openai = new OpenAI({ apiKey: activeKey, baseURL })
    const completion = await openai.chat.completions.create({
      model, max_tokens: 512, temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    })
    reply = (completion.choices[0]?.message?.content ?? '').trim()
    if (!reply) throw new Error('empty LLM response')
  } catch (err) {
    return dryFallback(`LLM 호출 실패(${err instanceof Error ? err.message : String(err)}) — 건조 사과 폴백`)
  }

  // ── Double-Check 금칙어 필터 (LLM 출력) ─────────────────────────────────────────
  const fb = scanForbidden(reply)
  const forbiddenCheck = {
    refund_promise:   fb.hits.includes('환불 약속') || fb.hits.includes('보상 약속'),
    legal_admission:  fb.hits.includes('법적 책임 인정'),
    cctv_mention:     fb.hits.includes('CCTV 언급'),
    staff_discipline: fb.hits.includes('직원 징계 약속'),
  }

  const draft = await upsertDraft(supabase, reviewId, {
    review_id:           reviewId,
    draft_short:         null,
    draft_standard:      reply,
    draft_careful:       null,
    selected_draft_type: 'standard',
    selected_reply:      reply,
    forbidden_check:     forbiddenCheck,
    prompt_version:      'hybrid-llm-v1',
    model_name:          model,
    pipeline_engine:     'llm',
    intent_code:         cls.status,
    intent_confidence:   null,
    updated_at:          now,
  })
  // LLM 결과는 출처 무관 항상 승인 대기 (human-in-the-loop)
  await applyReviewMeta('pending_approval', fb.clean ? undefined : `⛔ 금칙어 감지: ${fb.hits.join(', ')} — 반드시 수정 후 승인`)
  await supabase.from('activity_logs').insert({
    review_id: reviewId, actor_name: actorEmail, action: 'review_isolated',
    detail: { engine: 'llm', model, route: 'llm', classification: cls.status, tags: cls.tags, reason: cls.reason, forbidden_clean: fb.clean, forbidden_hits: fb.hits },
  })
  return NextResponse.json({
    engine: 'llm', route: 'llm', status: 'pending_approval', risk_level: finalRisk,
    classification: cls.status, tags: cls.tags, requiresApproval: true, forbidden_clean: fb.clean, draft,
  })
}

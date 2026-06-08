/**
 * processReviewById.ts — Admin-context 단일 리뷰 처리
 *
 * bulk-process / re-process / cron/sync-all 에서 공통 사용.
 * /api/review/generate 와 동일한 결정론적 게이트키퍼 로직을,
 * user 세션 없이 admin 클라이언트로 실행한다.
 *
 *   await processReviewById(reviewId, actorName, admin)
 *
 * 라우팅:
 *   SAFE/COMPLIMENT → 정적 STANDARD 템플릿 → ai_done     (승인 불필요)
 *   EMERGENCY       → 건조 사과 초안        → pending_approval (사람 검토)
 *   COMPLAINT/AMBIGUOUS → LLM Fallback     → pending_approval
 *   LLM 실패 / 키 없음 → 건조 사과 폴백    → pending_approval
 *
 * 안전 규칙 (불변):
 *   - 환불·보상 약속 금지
 *   - 법적 책임 인정 금지
 *   - CCTV 확인 약속 금지
 *   - 직원 징계 약속 금지
 */

import OpenAI from 'openai'
import { processReview } from '@/lib/reviewProcessor'
import { scanForbidden, refreshEngineFromDB } from '@/lib/waterfallRegexEngine'
import { buildStaticReply } from '@/lib/replyTemplates'
import { branchOfficialName } from '@/lib/branches'
import type { Language } from '@/lib/i18n'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Provider URL map ─────────────────────────────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

// ── Risk floor ────────────────────────────────────────────────────────────────
const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_LEVELS = ['low', 'medium', 'high', 'critical'] as const

function floorRisk(...levels: Array<string | null | undefined>): string {
  const max = Math.max(0, ...levels.map((l) => RISK_RANK[l ?? 'low'] ?? 0))
  return RANK_LEVELS[max] ?? 'low'
}

function langKeyOf(l: string | null | undefined): Language {
  return (['ko', 'en', 'ja', 'zh'].includes(l ?? '') ? l : 'ko') as Language
}

const FORBIDDEN_FLAGS_CLEAN = {
  refund_promise: false, legal_admission: false, cctv_mention: false, staff_discipline: false,
}

type AdminClient = ReturnType<typeof createAdminClient>

async function upsertDraft(
  admin: AdminClient,
  reviewId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: existing } = await admin
    .from('reply_drafts')
    .select('id')
    .eq('review_id', reviewId)
    .maybeSingle()
  if (existing) {
    await admin.from('reply_drafts').update(payload).eq('id', (existing as { id: string }).id)
  } else {
    await admin.from('reply_drafts').insert(payload)
  }
}

/**
 * 단일 리뷰를 결정론적 게이트키퍼(reviewProcessor)로 처리한다.
 *
 * @param reviewId  처리할 리뷰 UUID
 * @param actorName 활동 로그 actor (예: 'system:bulk-process', user email)
 * @param admin     호출 측에서 주입하는 admin Supabase 클라이언트
 */
export async function processReviewById(
  reviewId: string,
  actorName: string,
  admin: AdminClient,
): Promise<void> {
  // ── 1. 리뷰 조회 ─────────────────────────────────────────────────────────
  const { data: review, error: fetchErr } = await admin
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .single()

  if (fetchErr || !review) {
    throw new Error(`[processReviewById] Review not found: ${reviewId}`)
  }

  const lang = langKeyOf(review.review_language)
  const now  = new Date().toISOString()

  // ── 2. DB 규칙 로드 (TTL 60s — 캐시 유효 시 no-op) ───────────────────────
  await refreshEngineFromDB()

  // ── 3. 결정론적 분류 + 라우팅 ──────────────────────────────────────────────
  const decision = processReview({
    reviewText:   review.review_text ?? '',
    branchCode:   review.branch_code,
    language:     lang,
    reviewerName: review.reviewer_name,
    rating:       review.rating,
  })
  const cls = decision.classification

  // ── 4. 위험도 floor (인입 위험도 절대 하향 금지) ──────────────────────────
  const existingRisk = (review.risk_level as string | null) ?? 'low'
  const riskByClass  = cls.status === 'EMERGENCY' ? 'high'
                     : cls.status === 'COMPLAINT'  ? 'medium'
                     : 'low'
  const finalRisk = floorRisk(existingRisk, riskByClass)

  async function applyReviewMeta(status: string, extraNote?: string): Promise<void> {
    await admin.from('reviews').update({
      status,
      risk_level:       finalRisk,
      categories:       cls.tags,
      risk_reasons:     [cls.reason, ...cls.tags.map((t) => `[tag] ${t}`)],
      internal_note_ko: [cls.reason, extraNote].filter(Boolean).join('\n') || null,
      updated_at:       now,
    }).eq('id', reviewId)
  }

  // ════════════ STATIC (SAFE / COMPLIMENT) / MANUAL (EMERGENCY) ════════════
  if (decision.route === 'static' || decision.route === 'manual') {
    const reply  = decision.staticReply
      ?? buildStaticReply(cls, { branchCode: review.branch_code, language: lang, reviewerName: review.reviewer_name, reviewId: reviewId, rating: review.rating })
    const fb     = scanForbidden(reply)
    const status = decision.requiresApproval ? 'pending_approval' : 'ai_done'

    await upsertDraft(admin, reviewId, {
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
    await applyReviewMeta(
      status,
      decision.route === 'manual' ? '⚠ 긴급 격리 — 사람 수동 검토 필요(건조 사과 정적 초안)' : undefined,
    )
    await admin.from('activity_logs').insert({
      review_id:  reviewId,
      actor_name: actorName,
      action:     decision.route === 'manual' ? 'review_isolated' : 'ai_draft_generated',
      detail: {
        engine:         'template',
        route:          decision.route,
        status,
        classification: cls.status,
        tags:           cls.tags,
        reason:         cls.reason,
        forbidden_clean: fb.clean,
      },
    })
    return
  }

  // ════════════ LLM FALLBACK (COMPLAINT / AMBIGUOUS) ════════════
  const groqKey   = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const activeKey = groqKey ?? geminiKey ?? openaiKey
  const official  = branchOfficialName(review.branch_code, lang)

  async function dryFallback(note: string): Promise<void> {
    const reply = buildStaticReply(
      { ...cls, isComplaint: true },
      { branchCode: review.branch_code, language: lang, reviewerName: review.reviewer_name, reviewId: reviewId, rating: review.rating },
    )
    await upsertDraft(admin, reviewId, {
      review_id: reviewId, draft_short: null, draft_standard: reply, draft_careful: null,
      selected_draft_type: 'standard', selected_reply: reply, forbidden_check: FORBIDDEN_FLAGS_CLEAN,
      prompt_version: 'algo-fallback-v1', model_name: null, pipeline_engine: 'template',
      intent_code: cls.status, intent_confidence: null, updated_at: now,
    })
    await applyReviewMeta('pending_approval', note)
    await admin.from('activity_logs').insert({
      review_id:  reviewId,
      actor_name: actorName,
      action:     'review_isolated',
      detail: { engine: 'template-fallback', route: 'llm', classification: cls.status, tags: cls.tags, reason: cls.reason, note },
    })
  }

  if (!activeKey) {
    await dryFallback('LLM 키 미설정 — 건조 사과 정적 폴백, 승인 대기')
    return
  }

  const baseURL = groqKey   ? PROVIDER_BASE_URLS.groq
                : geminiKey ? PROVIDER_BASE_URLS.gemini
                : undefined
  const model   = groqKey   ? (process.env.GROQ_MODEL   ?? 'llama-3.3-70b-versatile')
                : geminiKey ? (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite')
                :             (process.env.OPENAI_MODEL ?? 'gpt-4o')

  // 알고리즘 분석 결과를 프롬프트에 강제 주입 (맥락 이탈 방지, 안전 규칙 재선언)
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

  let llmReply: string
  try {
    const openai = new OpenAI({ apiKey: activeKey, baseURL })
    const completion = await openai.chat.completions.create({
      model, max_tokens: 512, temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    })
    llmReply = (completion.choices[0]?.message?.content ?? '').trim()
    if (!llmReply) throw new Error('empty LLM response')
  } catch (err) {
    await dryFallback(`LLM 호출 실패(${err instanceof Error ? err.message : String(err)}) — 건조 사과 폴백`)
    return
  }

  // ── Double-Check 금칙어 필터 (LLM 출력) ─────────────────────────────────
  const fb = scanForbidden(llmReply)
  const forbiddenCheck = {
    refund_promise:   fb.hits.includes('환불 약속') || fb.hits.includes('보상 약속'),
    legal_admission:  fb.hits.includes('법적 책임 인정'),
    cctv_mention:     fb.hits.includes('CCTV 언급'),
    staff_discipline: fb.hits.includes('직원 징계 약속'),
  }

  await upsertDraft(admin, reviewId, {
    review_id:           reviewId,
    draft_short:         null,
    draft_standard:      llmReply,
    draft_careful:       null,
    selected_draft_type: 'standard',
    selected_reply:      llmReply,
    forbidden_check:     forbiddenCheck,
    prompt_version:      'hybrid-llm-v1',
    model_name:          model,
    pipeline_engine:     'llm',
    intent_code:         cls.status,
    intent_confidence:   null,
    updated_at:          now,
  })
  await applyReviewMeta(
    'pending_approval',
    fb.clean ? undefined : `⛔ 금칙어 감지: ${fb.hits.join(', ')} — 반드시 수정 후 승인`,
  )
  await admin.from('activity_logs').insert({
    review_id:  reviewId,
    actor_name: actorName,
    action:     'review_isolated',
    detail: {
      engine:          'llm',
      model,
      route:           'llm',
      classification:  cls.status,
      tags:            cls.tags,
      reason:          cls.reason,
      forbidden_clean: fb.clean,
      forbidden_hits:  fb.hits,
    },
  })
}

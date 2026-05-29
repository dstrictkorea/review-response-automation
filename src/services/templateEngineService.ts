/**
 * templateEngineService.ts — Algorithm-First, LLM-Fallback 엔진
 *
 * Wave 10: 전체 리뷰의 90%를 LLM 없이 처리하는 인텐트-기반 템플릿 엔진.
 *
 * 파이프라인:
 *   Step A: detect_review_intent RPC (pg_trgm word_similarity)
 *   Step B: 신뢰도 ≥ 0.50 + 단일 인텐트 + 비-critical → 템플릿 즉시 조합
 *   Step C: 조건 미충족 → shouldUseLlm=true → IntelligentOrchestrator LLM 경로
 *
 * LLM Fallback 조건:
 *   - 최고 인텐트 신뢰도 < CONFIDENCE_THRESHOLD (복합/모호한 리뷰)
 *   - 2번째 인텐트가 1번째와 MULTI_INTENT_GAP 이내 (복수 불만 섞인 리뷰)
 *   - 인텐트의 risk_level이 'high'/'critical' 또는 requires_llm=true
 *   - DB에 해당 언어 템플릿 없음
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ── 상수 ────────────────────────────────────────────────────────────────────────
/** pg_trgm word_similarity 최소 신뢰도 */
const CONFIDENCE_THRESHOLD = 0.50

/** 1위-2위 인텐트 신뢰도 차이가 이 이하면 복수 인텐트로 판단 → LLM */
const MULTI_INTENT_GAP = 0.12

/** 자동 처리 가능한 위험 레벨 */
const ALGORITHM_SAFE_RISK_LEVELS = new Set(['low'])

// ── 인텐트 검출 결과 ─────────────────────────────────────────────────────────────
export interface IntentDetectionRow {
  intent_code:  string
  confidence:   number
  risk_level:   string
  requires_llm: boolean
}

// ── 템플릿 해결 결과 ─────────────────────────────────────────────────────────────
export type TemplateResolutionReason =
  | 'algorithm_ok'      // 템플릿 조합 성공 → LLM 생략
  | 'confidence_low'    // 신뢰도 부족 → LLM
  | 'multi_intent'      // 복수 인텐트 경합 → LLM
  | 'critical_risk'     // 고위험/requires_llm → LLM
  | 'no_variant'        // DB에 템플릿 미존재 → LLM
  | 'rpc_error'         // pg_trgm 쿼리 실패 → LLM

export interface TemplateResolutionResult {
  shouldUseLlm:  boolean
  reason:        TemplateResolutionReason
  topIntent:     string | null
  confidence:    number
  riskLevel:     string
  /** algorithm_ok 일 때만 채워짐 */
  draft_short:   string
  draft_standard: string
  draft_careful:  string
}

const EMPTY_RESULT = (
  reason: TemplateResolutionReason,
  topIntent: string | null = null,
  confidence = 0,
  riskLevel = 'low',
): TemplateResolutionResult => ({
  shouldUseLlm: true,
  reason,
  topIntent,
  confidence,
  riskLevel,
  draft_short:    '',
  draft_standard: '',
  draft_careful:  '',
})

// ── 메인 함수 ────────────────────────────────────────────────────────────────────

/**
 * Step A + B: 인텐트 검출 → 신뢰도 평가 → 템플릿 조합
 *
 * @returns shouldUseLlm=false → 템플릿 draft 포함
 *          shouldUseLlm=true  → LLM 경로로 위임
 */
export async function resolveTemplateForReview(params: {
  reviewText:        string
  reviewLang:        string
  reviewerName:      string | null
  branchDisplayName: string
  admin:             ReturnType<typeof createAdminClient>
}): Promise<TemplateResolutionResult> {
  const { reviewText, reviewLang, reviewerName, branchDisplayName, admin } = params

  if (!reviewText.trim()) return EMPTY_RESULT('confidence_low')

  // ── Step A: pg_trgm 인텐트 검출 ────────────────────────────────────────────
  const { data: intents, error } = await admin.rpc('detect_review_intent', {
    p_text:  reviewText,
    p_lang:  reviewLang,
    p_top_n: 3,
  }) as { data: IntentDetectionRow[] | null; error: unknown }

  if (error || !intents) return EMPTY_RESULT('rpc_error')
  if (intents.length === 0) return EMPTY_RESULT('confidence_low')

  const top = intents[0]

  // ── Step B1: 신뢰도 미달 ────────────────────────────────────────────────────
  if (top.confidence < CONFIDENCE_THRESHOLD) {
    return EMPTY_RESULT('confidence_low', top.intent_code, top.confidence, top.risk_level)
  }

  // ── Step B2: 고위험 / LLM 강제 인텐트 ──────────────────────────────────────
  if (top.requires_llm || !ALGORITHM_SAFE_RISK_LEVELS.has(top.risk_level)) {
    return EMPTY_RESULT('critical_risk', top.intent_code, top.confidence, top.risk_level)
  }

  // ── Step B3: 복수 인텐트 경합 (예: "직원도 불친절하고 화장실도 더러워요") ──
  if (
    intents.length >= 2 &&
    (top.confidence - intents[1].confidence) < MULTI_INTENT_GAP
  ) {
    return EMPTY_RESULT('multi_intent', top.intent_code, top.confidence, top.risk_level)
  }

  // ── Step B4: 템플릿 조회 (랜덤 변형 선택) ──────────────────────────────────
  const targetLang = mapToTemplateLang(reviewLang)
  const variantNum  = Math.floor(Math.random() * 5) + 1

  // 우선: 랜덤 변형
  let { data: variant } = await admin
    .from('reply_template_variants')
    .select('draft_short, draft_standard, draft_careful')
    .eq('intent_code', top.intent_code)
    .eq('language',    targetLang)
    .eq('variant_num', variantNum)
    .eq('is_active',   true)
    .maybeSingle()

  // 폴백: 아무 변형이나 1개
  if (!variant) {
    const { data: fallback } = await admin
      .from('reply_template_variants')
      .select('draft_short, draft_standard, draft_careful')
      .eq('intent_code', top.intent_code)
      .eq('language',    targetLang)
      .eq('is_active',   true)
      .order('variant_num')
      .limit(1)
      .maybeSingle()
    variant = fallback
  }

  if (!variant) {
    return EMPTY_RESULT('no_variant', top.intent_code, top.confidence, top.risk_level)
  }

  // ── 동적 변수 주입 ──────────────────────────────────────────────────────────
  const inject = (text: string): string =>
    text
      .replace(/\{\{reviewer_name\}\}/g, reviewerName ?? (targetLang === 'ko' ? '고객님' : 'our valued guest'))
      .replace(/\{\{branch_name\}\}/g,   branchDisplayName)

  return {
    shouldUseLlm:   false,
    reason:         'algorithm_ok',
    topIntent:      top.intent_code,
    confidence:     top.confidence,
    riskLevel:      top.risk_level,
    draft_short:    inject(variant.draft_short),
    draft_standard: inject(variant.draft_standard),
    draft_careful:  inject(variant.draft_careful),
  }
}

/**
 * 리뷰 언어 → 템플릿 언어 매핑.
 * DB에 없는 언어(ar, ja, zh 미등록)는 en 으로 폴백.
 */
function mapToTemplateLang(reviewLang: string): string {
  const supported = new Set(['ko', 'en', 'ja', 'zh', 'ar'])
  return supported.has(reviewLang) ? reviewLang : 'en'
}

// ── 인텐트 감정 매핑 (Orchestrator에서 sentiment 필드 채울 때 사용) ─────────────
export const INTENT_SENTIMENT: Record<string, 'positive' | 'neutral' | 'mixed' | 'negative'> = {
  positive_overall:  'positive',
  immersive_exp:     'positive',
  photo_zone:        'positive',
  lighting_display:  'positive',
  staff_praise:      'positive',
  child_friendly:    'positive',
  repeat_visit:      'positive',
  food_cafe:         'neutral',
  souvenir_merch:    'positive',
  crowd_complaint:   'negative',
  wait_time:         'negative',
  cleanliness:       'negative',
  ticket_price:      'mixed',
  ticket_booking:    'negative',
  staff_complaint:   'negative',
  parking:           'negative',
  accessibility:     'neutral',
  location_access:   'negative',
  safety_concern:    'negative',
  refund_complaint:  'negative',
}

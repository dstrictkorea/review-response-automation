/**
 * reviewProcessor.ts — 결정론적 게이트키퍼 v2 (Smart Risk-Based Routing)
 *
 * Algorithm-First 분류 결과를 3-Tier 리스크 평가와 결합한 스마트 라우팅:
 *   EMERGENCY            → 'manual'  즉시 격리 (건조 사과 초안, 승인 대기)
 *   SAFE                 → 'static'  정적 감사 응답 (LLM 미사용, 승인 불필요)
 *   COMPLIMENT           → 'static'  정적 감사 응답
 *   COMPLAINT(Tier 1)    → 'static'  5-Slot 사과문 조립 후 AI_DONE (승인 불필요) ← 변경
 *   COMPLAINT(Tier 2/3)  → 'manual'  Critical/Unknown toxic → PENDING_APPROVAL
 *   AMBIGUOUS(Tier 2/3)  → 'manual'  리스크 격리
 *   AMBIGUOUS(Tier 1, ★3+/신호)  → 'static'  좋은 점·아쉬운 점 함께 인정하는 균형 답변 자동완료
 *   AMBIGUOUS(Tier 1, ★1-2/무신호) → 'manual'  안전 격리(사람 승인) — 단, 균형 초안 함께 제공
 *     ※ 빈 답변/LLM 의존 제거: 모든 리뷰가 결정론적 정적 초안을 갖는다 (커버리지 100%).
 *
 * 다중 불만 태그 → 우선순위 가중치로 primaryIntent 하나 추출:
 *   STAFF > SYSTEM > ROOM_SPECIFIC > INTERACTIVE > VALUE > CROWD > LAYOUT > DISPLAY > DURATION > REVISIT
 *
 * 순수 함수 — DB/LLM 부작용 없음. 라우트 핸들러가 결정을 받아 실제 I/O를 수행한다.
 */

import type { ReplyLanguage as Language } from '@/lib/replyLanguage'
import { analyzeReview, type WaterfallResult } from '@/lib/waterfallRegexEngine'
import { buildStaticReply } from '@/lib/replyTemplates'
import { sanitizeAndScoreRisk } from '@/lib/synonymEngine'

export type ProcessRoute = 'static' | 'llm' | 'manual'

export interface ProcessDecision {
  classification: WaterfallResult
  route: ProcessRoute
  /** route='static'|'manual' 일 때 즉시 사용 가능한 정적 STANDARD 답변. route='llm' 이면 null. */
  staticReply: string | null
  /** 게시 전 사람 승인 필요 여부 */
  requiresApproval: boolean
  /** 복합 불만 태그 우선순위 기반 핵심 인텐트 (COMPLAINT/AMBIGUOUS 전용, 그 외 null) */
  primaryIntent?: string | null
  /** 독성 순화 티어 (1=clean/sanitizable, 2=critical, 3=unknown toxic; EMERGENCY/SAFE/COMPLIMENT는 null) */
  riskTier?: 1 | 2 | 3 | null
  /** Tier 1 순화 완료 텍스트, Tier 3 fallback 텍스트, 그 외 null */
  sanitizedText?: string | null
}

// ── 다중 불만 인텐트 우선순위 (내림차순) ───────────────────────────────────────────
// EMERGENCY는 Layer 0에서 처리되므로 운영 레이어 내 우선순위만 정의
const INTENT_PRIORITY: ReadonlyArray<string> = [
  'STAFF_COMPLAINT',          // 1위: 직원 서비스 실패 (가장 즉각적인 대인 리스크)
  'SYSTEM_COMPLAINT',         // 2위: 기술/키오스크 장애 (운영 시스템)
  'ACCESSIBILITY_COMPLAINT',  // 2.5위: 접근성(휠체어/유모차/고령자) — 민감·포용성
  'LANGUAGE_SERVICE_COMPLAINT', // 2.6위: 외국어/다국어 서비스 (국제 관람객)
  'ROOM_SPECIFIC_COMPLAINT',  // 3위: 특정 구역 품질 이슈
  'INTERACTIVE_COMPLAINT',    // 4위: 인터랙션 콘텐츠 부족
  'VALUE_COMPLAINT',          // 5위: 가격 대비 가치
  'CROWD_COMPLAINT',          // 6위: 혼잡/인파
  'LAYOUT_COMPLAINT',         // 7위: 동선 불편
  'DISPLAY_ISSUE',            // 8위: AV 장비 결함
  'DURATION_COMPLAINT',       // 9위: 관람 시간 부족
  'REVISIT_COMPLAINT',        // 10위: 재방문 실망
  '운영불만',                   // 11위: 일반 운영 불만
  '저평점_부정신호',             // 12위: 폴백
]

/**
 * extractPrimaryIntent — 복합 불만 태그에서 우선순위 최상위 인텐트 1개 추출.
 * 태그가 없으면 null 반환.
 */
function extractPrimaryIntent(tags: string[]): string | null {
  for (const intent of INTENT_PRIORITY) {
    if (tags.includes(intent)) return intent
  }
  return tags.find(t => t.length > 0) ?? null
}

export function processReview(input: {
  reviewText: string
  branchCode: string
  language: Language
  reviewerName?: string | null
  rating?: number | null
  reviewId?: string | null
}): ProcessDecision {
  const classification = analyzeReview(input.reviewText ?? '', input.rating, input.branchCode)
  const ctx = {
    branchCode: input.branchCode,
    language: input.language,
    reviewerName: input.reviewerName,
    reviewId: input.reviewId,
    rating: input.rating,
    reviewTextLength: (input.reviewText ?? '').length,
  }

  if (classification.status === 'EMERGENCY') {
    return {
      classification,
      route: 'manual',
      staticReply: buildStaticReply(classification, ctx),
      requiresApproval: true,
    }
  }

  if (classification.status === 'SAFE') {
    return {
      classification,
      route: 'static',
      staticReply: buildStaticReply(classification, ctx),
      requiresApproval: false,
    }
  }

  // COMPLIMENT(고평점 건설적 피드백) → 정적 감사 응대. Kill-switch 회피 위해 불만/긴급 플래그 끈 사본으로 조립.
  if (classification.status === 'COMPLIMENT') {
    return {
      classification,
      route: 'static',
      staticReply: buildStaticReply({ ...classification, isComplaint: false, isEmergency: false }, ctx),
      requiresApproval: false,
    }
  }

  // ── COMPLAINT / AMBIGUOUS → 3-Tier 스마트 게이트키퍼 ──────────────────────────
  // 1. 리스크 평가 + 독성 순화
  // 2. primaryIntent 추출 (다중 태그 우선순위 가중치)
  // 3. Tier 기반 라우팅 결정
  const riskAssessment = sanitizeAndScoreRisk(input.reviewText ?? '')
  const primaryIntent = extractPrimaryIntent(classification.tags)

  // Tier 2 (Critical) 또는 Tier 3 (Unknown Toxic) → PENDING_APPROVAL 강제 격리
  if (riskAssessment.tier >= 2) {
    return {
      classification,
      route: 'manual',
      staticReply: buildStaticReply(classification, ctx),  // 건조 사과문 초안 제공
      requiresApproval: true,
      primaryIntent,
      riskTier: riskAssessment.tier as 2 | 3,
      sanitizedText: riskAssessment.sanitizedText,
    }
  }

  // COMPLAINT + Tier 1 → 5-Slot 사과문 정적 조립 후 AI_DONE (승인 불필요)
  // primaryIntent가 최상위인 태그를 tags 배열 맨 앞으로 정렬 → slotC_pivot 우선순위 보장
  if (classification.status === 'COMPLAINT') {
    const orderedTags = primaryIntent
      ? [primaryIntent, ...classification.tags.filter(t => t !== primaryIntent)]
      : classification.tags
    const priorityClassification = { ...classification, tags: orderedTags }
    return {
      classification,
      route: 'static',
      staticReply: buildStaticReply(priorityClassification, ctx),
      requiresApproval: false,
      primaryIntent,
      riskTier: 1,
      sanitizedText: riskAssessment.sanitizedText,
    }
  }

  // AMBIGUOUS + Tier 1 → 균형 정적 초안 제공 (LLM 의존 제거로 '빈 답변/미회신' 방지).
  //   사용자 정책(긴급/독성 외 전부 자동완료): ★1-2 양가(별점-본문 불일치·경미 혼합)도 균형 답변으로
  //   자동완료한다. 긴급(EMERGENCY)·독성(Tier2/3)은 위에서 이미 사람 격리됨.
  //   예외(사람 응대 유지): (1) 서비스 질문(주차/예약/유모차 등 — 균형 답변은 '답'이 아님),
  //   (2) 평점·내용 신호가 모두 없는 순수 모호건("이게 예술인가요?" 류) → 균형 답변이 어색.
  const ambiguousDraft = buildStaticReply(classification, ctx)
  const isServiceQuestion = classification.tags.includes('질문')
  const hasContentSignal = classification.tags.length > 0
  const autoBalance = (input.rating != null || hasContentSignal) && !isServiceQuestion
  return {
    classification,
    route: autoBalance ? 'static' : 'manual',
    staticReply: ambiguousDraft,
    requiresApproval: !autoBalance,
    primaryIntent,
    riskTier: 1,
    sanitizedText: riskAssessment.sanitizedText,
  }
}

export type { WaterfallResult }

/**
 * reviewProcessor.ts — 결정론적 게이트키퍼 (Algorithm-First / Algorithm-Second / LLM-Fallback)
 *
 *   const result = analyzeReview(text)         // Algorithm-First: 결정론적 분류
 *   EMERGENCY            → 'manual'  사람 수동 검토 격리 (건조 사과 정적 초안, 승인 대기)
 *   SAFE                 → 'static'  Algorithm-Second: 정적 템플릿 자동 응답 (LLM 미사용, 승인 불필요)
 *   COMPLAINT/AMBIGUOUS  → 'llm'     예외 LLM Fallback (알고리즘 태그/근거 주입, 승인 대기)
 *
 * 순수 함수 — DB/LLM 부작용 없음. 라우트 핸들러가 결정을 받아 실제 I/O를 수행한다.
 */

import type { Language } from '@/lib/i18n'
import { analyzeReview, type WaterfallResult } from '@/lib/waterfallRegexEngine'
import { buildStaticReply } from '@/lib/replyTemplates'

export type ProcessRoute = 'static' | 'llm' | 'manual'

export interface ProcessDecision {
  classification: WaterfallResult
  route: ProcessRoute
  /** route='static'|'manual' 일 때 즉시 사용 가능한 정적 STANDARD 답변. route='llm' 이면 null. */
  staticReply: string | null
  /** 게시 전 사람 승인 필요 여부 (EMERGENCY/COMPLAINT/AMBIGUOUS = true) */
  requiresApproval: boolean
}

export function processReview(input: {
  reviewText: string
  branchCode: string
  language: Language
  reviewerName?: string | null
  rating?: number | null
  reviewId?: string | null
}): ProcessDecision {
  const classification = analyzeReview(input.reviewText ?? '', input.rating)
  const ctx = {
    branchCode: input.branchCode,
    language: input.language,
    reviewerName: input.reviewerName,
    reviewId: input.reviewId,
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

  // COMPLAINT | AMBIGUOUS → LLM Fallback
  return {
    classification,
    route: 'llm',
    staticReply: null,
    requiresApproval: true,
  }
}

export type { WaterfallResult }

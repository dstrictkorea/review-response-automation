/**
 * replyTemplates.ts — 슬롯 기반 STANDARD 답변 조립 + Kill-Switch
 *
 * 슬롯 구조:
 *   SAFE / COMPLIMENT:  [Slot A: 인사] + [Slot B: 작품감상 or 일반감사] + [Slot C: 맺음말]
 *   COMPLAINT / EMERGENCY: [Slot A: 사과] + [Slot B?: 태그별 개선 약속] + [피크타임 힌트?]
 *
 * 변형 선택: reviewId → djb2 해시 → idx % numVariants (결정론적, Math.random 없음).
 * reviewId 미제공 시 idx=0 → 기존 "기본" 변형으로 fallback (하위 호환).
 *
 * Kill-Switch(PHASE 4): isEmergency || isComplaint 이면 ETERNAL NATURE 찬양 차단.
 */

import type { Language } from '@/lib/i18n'
import { branchOfficialName, branchSignatureWork } from '@/lib/branches'
import {
  greetingBlock,
  thanksBlock,
  eternalNatureBlock,
  closingBlock,
  dryApologyBlock,
  slotBComplaintPivot,
  peakHoursHint,
} from '@/lib/staticTemplates'
import { scanForbidden, type WaterfallResult } from '@/lib/waterfallRegexEngine'

export interface StaticReplyContext {
  branchCode: string
  language: Language
  reviewerName?: string | null
  /** 결정론적 변형 선택용 리뷰 ID. 미제공 시 idx=0(기본 변형). */
  reviewId?: string | null
}

// ── djb2 hash: reviewId → 결정론적 양의 정수 ────────────────────────────────────
function idHash(reviewId: string | null | undefined): number {
  if (!reviewId) return 0
  let h = 5381
  for (let i = 0; i < reviewId.length; i++) {
    h = ((h * 33) ^ reviewId.charCodeAt(i)) | 0  // 32-bit signed
  }
  return Math.abs(h)
}

/**
 * buildStaticReply — 슬롯 기반 STANDARD 답변 조립 (LLM 미사용).
 *
 * Kill-Switch(PHASE 4): isEmergency || isComplaint 이면 '작품/예쁘다/art' 키워드가
 * 있더라도 ETERNAL NATURE 찬양 블록을 원천 차단한다.
 */
export function buildStaticReply(result: WaterfallResult, ctx: StaticReplyContext): string {
  const lang    = ctx.language
  const official = branchOfficialName(ctx.branchCode, lang)
  const name    = (ctx.reviewerName ?? '').trim()
  const varIdx  = idHash(ctx.reviewId)

  // ── COMPLAINT / EMERGENCY: Slot A(사과) + Slot B?(태그 피벗) + 피크타임 힌트? ──
  if (result.isEmergency || result.isComplaint) {
    const slotA = dryApologyBlock(lang, name, official, varIdx)
    const slotB = slotBComplaintPivot(lang, result.tags, varIdx)
    const parts: string[] = [slotA]
    if (slotB) parts.push(slotB)
    // CROWD_COMPLAINT + 피크타임 언급 → 평일 방문 권유 삽입 (Kill-switch 제외: 방문권유 O)
    if (result.hasPeakHours && result.tags.includes('CROWD_COMPLAINT')) {
      parts.push(peakHoursHint(lang))
    }
    return parts.join('\n\n')
  }

  // ── SAFE / COMPLIMENT: Slot A(인사) + Slot B(작품/감사) + Slot C(맺음말) ────────
  const slotA = greetingBlock(lang, name, official, varIdx)
  const slotB = result.isArtworkFocused
    ? eternalNatureBlock(lang, branchSignatureWork(ctx.branchCode, lang), varIdx)
    : thanksBlock(lang, varIdx)
  const slotC = closingBlock(lang, official, varIdx)
  const parts: string[] = [slotA, slotB, slotC]
  // 피크타임 언급 시 맺음말 뒤에 권유 힌트 추가 (긍정 리뷰에서 혼잡 시간 언급한 경우)
  if (result.hasPeakHours) parts.push(peakHoursHint(lang))
  return parts.join('\n\n')
}

/** 정적 답변 안전성 보증 — 금칙어 미포함 확인(개발/런타임 가드). */
export function isStaticReplySafe(text: string): boolean {
  return scanForbidden(text).clean
}

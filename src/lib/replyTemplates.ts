/**
 * replyTemplates.ts — 5-슬롯 다차원 조합 답변 조립 엔진 + Kill-Switch
 *
 * 슬롯 구조:
 *   SAFE / COMPLIMENT:  [A: 인사] + [B: 감정응답] + [C: 작품/일반] + [D?: 피크힌트] + [E: 클로징]
 *   COMPLAINT / EMERGENCY: [A: 사과] + [B: 수용확인] + [C?: 태그액션] + [D?: 피크힌트] + [E: 미니클로징]
 *
 * 변형 선택: reviewId → 슬롯별 독립 소수 해시 → idxA/idxB/idxC/idxD/idxE
 *   idxA = slotHash(id,  2) % 4
 *   idxB = slotHash(id,  3) % 4
 *   idxC = slotHash(id,  5) % 4
 *   idxD = slotHash(id,  7) % 3  (Slot D는 3-variant)
 *   idxE = slotHash(id, 11) % 4
 * 256 기본 조합 (4×4×4×4 슬롯) × 10 태그 = 다차원 다양성 보장.
 * reviewId 미제공 시 모든 idx=0 → 기본 변형 폴백 (하위 호환).
 *
 * 토큰 치환: buildStaticReply 마지막 단계에서 applyBranchTokens()가
 * {branch_name}, {landmark}, {highlight_room}, {facility}를 일괄 치환한다.
 *
 * Kill-Switch(불변): isEmergency || isComplaint → ETERNAL NATURE 찬양 차단.
 */

import type { Language } from '@/lib/i18n'
import { branchSignatureWork } from '@/lib/branches'
import { getBranchTokens, applyBranchTokens } from '@/lib/branchMetadata'
import {
  slotA_greeting,
  slotA_apology,
  slotB_appreciation,
  slotB_acknowledgment,
  slotC_artwork,
  slotC_general,
  slotC_pivot,
  slotD_peak_hours,
  slotE_positive,
  slotE_negative,
} from '@/lib/staticTemplates'
import { scanForbidden, type WaterfallResult } from '@/lib/waterfallRegexEngine'

export interface StaticReplyContext {
  branchCode: string
  language: Language
  reviewerName?: string | null
  /** 결정론적 변형 선택용 리뷰 ID. 미제공 시 idx=0(기본 변형). */
  reviewId?: string | null
  /** 별점 — 향후 Slot B 감정 조절에 활용 가능 (현재는 참조만). */
  rating?: number | null
}

// ── 소수 기반 독립 해시: 슬롯마다 다른 prime으로 초기화 → idx 분포 독립 보장 ──────────
function slotHash(reviewId: string | null | undefined, prime: number): number {
  if (!reviewId) return 0
  let h = prime
  for (let i = 0; i < reviewId.length; i++) {
    h = ((h * 33) ^ reviewId.charCodeAt(i)) | 0  // 32-bit signed
  }
  return Math.abs(h)
}

interface SlotIndices {
  idxA: number   // prime 2
  idxB: number   // prime 3
  idxC: number   // prime 5
  idxD: number   // prime 7 (Slot D: 3 variants)
  idxE: number   // prime 11
}

function buildSlotIndices(reviewId: string | null | undefined): SlotIndices {
  return {
    idxA: slotHash(reviewId,  2) % 4,
    idxB: slotHash(reviewId,  3) % 4,
    idxC: slotHash(reviewId,  5) % 4,
    idxD: slotHash(reviewId,  7) % 3,
    idxE: slotHash(reviewId, 11) % 4,
  }
}

/**
 * buildStaticReply — 5-슬롯 STANDARD 답변 조립 (LLM 미사용).
 *
 * Kill-Switch(불변): isEmergency || isComplaint → Slot C에서 ETERNAL NATURE 찬양 차단.
 * 토큰 치환: 슬롯 조립 후 applyBranchTokens()가 {branch_name}/{landmark}/{highlight_room}/{facility}를 교체.
 */
export function buildStaticReply(result: WaterfallResult, ctx: StaticReplyContext): string {
  const lang   = ctx.language
  const name   = (ctx.reviewerName ?? '').trim()
  const tokens = getBranchTokens(ctx.branchCode)
  const sig    = branchSignatureWork(ctx.branchCode, lang)
  const { idxA, idxB, idxC, idxD, idxE } = buildSlotIndices(ctx.reviewId)

  let rawReply: string

  if (result.isEmergency || result.isComplaint) {
    // ── COMPLAINT / EMERGENCY: A + B + C? + D? + E ──────────────────────────
    // Kill-Switch: ETERNAL NATURE 찬양 블록 원천 차단
    const a = slotA_apology(lang, name, idxA)
    const b = slotB_acknowledgment(lang, idxB)
    const c = slotC_pivot(lang, result.tags, idxC)  // '' = 매칭 태그 없음
    // CROWD_COMPLAINT + 피크타임 언급 → 평일 방문 권유
    const d = (result.hasPeakHours && result.tags.includes('CROWD_COMPLAINT'))
              ? slotD_peak_hours(lang, idxD)
              : null
    const e = slotE_negative(lang, idxE)
    const parts: string[] = [a, b, ...(c ? [c] : []), ...(d ? [d] : []), e]
    rawReply = parts.join('\n\n')
  } else {
    // ── SAFE / COMPLIMENT: A + B + C + D? + E ───────────────────────────────
    const a = slotA_greeting(lang, name, idxA)
    const b = slotB_appreciation(lang, idxB)
    // 작품 중심 → ETERNAL NATURE 블록 / 일반 → 대표 공간 언급
    const c = result.isArtworkFocused
              ? slotC_artwork(lang, sig, idxC)
              : slotC_general(lang, idxC)
    // 긍정 리뷰에서 피크타임 언급 시 방문 권유 힌트 추가
    const d = result.hasPeakHours ? slotD_peak_hours(lang, idxD) : null
    const e = slotE_positive(lang, idxE)
    const parts: string[] = [a, b, c, ...(d ? [d] : []), e]
    rawReply = parts.join('\n\n')
  }

  // ── 토큰 치환 파이프라인 ───────────────────────────────────────────────────────
  // {branch_name}, {landmark}, {highlight_room}, {facility} → 실제 지점 메타데이터 값
  return applyBranchTokens(rawReply, tokens)
}

/** 정적 답변 안전성 보증 — 금칙어 미포함 확인(개발/런타임 가드). */
export function isStaticReplySafe(text: string): boolean {
  return scanForbidden(text).clean
}

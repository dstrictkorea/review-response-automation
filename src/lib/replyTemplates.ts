/**
 * replyTemplates.ts — 5-슬롯 다차원 조합 답변 조립 엔진 + Kill-Switch
 *
 * 슬롯 구조:
 *   SAFE / COMPLIMENT:  [A: 인사] + [B: 감정응답] + [C?: 작품/일반] + [D?: 피크힌트] + [E: 클로징]
 *   COMPLAINT / EMERGENCY: [A: 사과] + [B: 수용확인] + [C?: 태그액션] + [D?: 피크힌트] + [E: 미니클로징]
 *
 * 변형 선택: reviewId → 슬롯별 독립 소수 해시 → idxA/idxB/idxC/idxD/idxE
 *   idxA = slotHash(id,  2) % 8   ← KO 8-variant 확장 (en/ja/zh는 arr.length%로 자동 순환)
 *   idxB = slotHash(id,  3) % 8
 *   idxC = slotHash(id,  5) % 4   ← Slot C 태그 기반 (4 변형 유지)
 *   idxD = slotHash(id,  7) % 3   ← Slot D 피크힌트 (3 변형 유지)
 *   idxE = slotHash(id, 11) % 8
 * 8×8×4×4 KO 기본 조합 = 1,024 조합 × 10 태그 = 다차원 다양성 보장.
 * reviewId 미제공 시 모든 idx=0 → 기본 변형 폴백 (하위 호환).
 *
 * SHORT 모드: isArtworkFocused=false, hasPeakHours=false, contextMirror=null 이면
 *   Slot C 생략 → A + B + E (3슬롯) → 답변 TMI 방지.
 *
 * contextMirror: WaterfallResult에서 추출한 감성 키워드(힐링/데이트 등)를
 *   slotB/slotE에 전달 → 리뷰 내용을 반영하는 맞춤형 답변 생성 (AI같은 답변 구현).
 *
 * 토큰 치환: buildStaticReply 마지막 단계에서 applyBranchTokens()가
 * {branch_name}, {landmark}, {highlight_room}, {facility}를 일괄 치환한다.
 *
 * Kill-Switch(불변): isEmergency || isComplaint → ETERNAL NATURE 찬양 차단.
 */

// Reply-engine language set — broader than UI Language ('ko'|'en'|'ja'|'zh')
import type { ReplyLanguage as Language } from '@/lib/replyLanguage'
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
  slotEmpathy,
  slotReassurance,
  slotHybridAck,
} from '@/lib/staticTemplates'
import { selectFragments, type FragmentSignal } from '@/lib/fragmentPool'
import { scanForbidden, type WaterfallResult } from '@/lib/waterfallRegexEngine'

export interface StaticReplyContext {
  branchCode: string
  language: Language
  reviewerName?: string | null
  /** 결정론적 변형 선택용 리뷰 ID. 미제공 시 idx=0(기본 변형). */
  reviewId?: string | null
  /** 별점 — 향후 Slot B 감정 조절에 활용 가능 (현재는 참조만). */
  rating?: number | null
  /** 원본 리뷰 텍스트 길이 — SHORT 모드 판단에 사용 (≤40자 단문이면 COMPLIMENT도 SHORT 적용). */
  reviewTextLength?: number | null
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
  idxS: number   // prime 13 (Sensory)
  idxM: number   // prime 17 (coMpanion)
  idxR: number   // prime 19 (Repeat visitor)
  idxP: number   // prime 23 (emPathy)
  idxQ: number   // prime 29 (reassurance Q)
}

function buildSlotIndices(reviewId: string | null | undefined): SlotIndices {
  return {
    idxA: slotHash(reviewId,  2) % 8,  // KO 8-variant, EN/JA/ZH 자동 % arr.length
    idxB: slotHash(reviewId,  3) % 8,
    idxC: slotHash(reviewId,  5) % 4,  // 태그 기반 pivot 4-variant 유지
    idxD: slotHash(reviewId,  7) % 3,  // 피크힌트 3-variant 유지
    idxE: slotHash(reviewId, 11) % 8,
    idxS: slotHash(reviewId, 13) % 2,  // 신규 상황 슬롯: 2 variants/lang
    idxM: slotHash(reviewId, 17) % 2,
    idxR: slotHash(reviewId, 19) % 2,
    idxP: slotHash(reviewId, 23) % 2,
    idxQ: slotHash(reviewId, 29) % 2,
  }
}

/**
 * buildStaticReply — 다중 슬롯 STANDARD 답변 조립 (LLM 미사용, governed palette).
 *
 * 고정 슬롯: A(인사/사과) + B(감정/수용) + E(클로징). 그 사이를 '상황 본문 슬롯'으로 채운다.
 * 본문 팔레트(조건부):
 *   COMPLIMENT/SAFE  : Sensory(빛/물/향/소리) · Companion(가족/데이트/친구) · RepeatVisitor ·
 *                      Artwork/General · Peak
 *   COMPLAINT        : Empathy · Tag-Pivot · Peak · Reassurance
 * Governor: 리뷰 길이에 비례한 bodyBudget(1~3)으로 가장 상황적인 슬롯만 선택 → TMI 방지.
 *   더 풍부한 리뷰 = 더 많은 상황 슬롯, 단문 = 최소 슬롯. (슬롯이 많아도 답변이 길어지지 않음)
 *
 * Kill-Switch(불변): isEmergency || isComplaint → ETERNAL NATURE 찬양/상황 호평 슬롯 원천 차단.
 * 중복 echo 차단: companionContext === contextMirror 이면 Companion 슬롯 생략(B/E가 이미 반영).
 * 토큰 치환: 조립 후 applyBranchTokens()가 {branch_name}/{landmark}/{highlight_room}/{facility} 교체.
 */
export function buildStaticReply(result: WaterfallResult, ctx: StaticReplyContext): string {
  const lang   = ctx.language
  const name   = (ctx.reviewerName ?? '').trim()
  const tokens = getBranchTokens(ctx.branchCode, lang)
  const sig    = branchSignatureWork(ctx.branchCode, lang)
  const ix     = buildSlotIndices(ctx.reviewId)
  const len    = ctx.reviewTextLength ?? 999

  let rawReply: string

  const mirror = result.contextMirror ?? null

  if (result.isEmergency || result.isComplaint) {
    // ── COMPLAINT / EMERGENCY ───────────────────────────────────────────────
    // Kill-Switch: ETERNAL NATURE 찬양 블록 원천 차단. 긴급은 건조 유지(공감/안심 슬롯 X).
    const a = slotA_apology(lang, name, ix.idxA)
    const b = slotB_acknowledgment(lang, ix.idxB)
    const e = slotE_negative(lang, ix.idxE)

    const piv  = slotC_pivot(lang, result.tags, ix.idxC)          // '' = 매칭 태그 없음
    const peak = (result.hasPeakHours && result.tags.includes('CROWD_COMPLAINT'))
                 ? slotD_peak_hours(lang, ix.idxD) : ''
    const emp  = result.isEmergency ? '' : slotEmpathy(lang, ix.idxP)
    const rea  = result.isEmergency ? '' : slotReassurance(lang, ix.idxQ)
    const hyb  = result.isHybrid ? slotHybridAck(lang, ix.idxS) : ''  // 복합 의도 긍정 인정

    if (result.isHybrid) {
      // ── Hybrid Assembly (복합 의도): 사과(A) → 좋은 점 인정(hybAck) → 개선 약속(pivot) → 클로징(E).
      //   수용확인(B)·공감(empathy)은 hybAck과 중복/과중이므로 생략 → 간결한 4블록 균형.
      const hybBody: string[] = [hyb, ...(piv ? [piv] : [])]
      rawReply = [a, ...hybBody, e].join('\n\n')
    } else {
      let body: string[]
      if (result.isEmergency) {
        body = [piv].filter(Boolean)          // 긴급: 건조하게 핵심 피벗만
      } else {
        // pivot(핵심 개선 약속)은 태그 있으면 항상 포함. empathy/reassurance/peak는 '재량 슬롯'으로
        // 리뷰 길이에 비례한 예산 내에서만 — 초단문 불만에 공감/안심 덧붙여 TMI 되는 것 방지.
        const discBudget = len <= 40 ? 0 : len <= 90 ? 1 : 2
        const keep = new Set([emp, rea, peak].filter(Boolean).slice(0, discBudget))
        // 서사 순서: empathy → pivot → peak → reassurance
        body = [emp, piv, peak, rea].filter((s) => s && (s === piv || keep.has(s)))
      }
      rawReply = [a, b, ...body, e].join('\n\n')
    }
  } else {
    // ── SAFE / COMPLIMENT ───────────────────────────────────────────────────
    const a = slotA_greeting(lang, name, ix.idxA)
    const b = slotB_appreciation(lang, ix.idxB, mirror)  // contextMirror 맞춤 감사
    const e = slotE_positive(lang, ix.idxE, mirror)      // contextMirror 맞춤 클로징

    // ── Matrix Fragment Pool: 다차원 신호 수집 → 가중치 거버너 top-N pruning ─────
    //   persona/sensory/spatial/temporal 신호를 가중치와 함께 수집. companion이 contextMirror와
    //   같으면(B/E가 이미 echo) persona 생략; spatial '포토스팟'이 mirror '사진/분위기'와 겹치면 생략.
    const signals: FragmentSignal[] = []
    if (result.sensoryFocus) signals.push({ dim: 'sensory', tag: result.sensoryFocus, weight: 10 })
    if (result.companionContext && result.companionContext !== mirror) signals.push({ dim: 'persona', tag: result.companionContext, weight: 9 })
    if (result.isRepeatVisitor) signals.push({ dim: 'persona', tag: '단골', weight: 8 })
    if (result.spatialContext && !(result.spatialContext === '포토스팟' && (mirror === '사진' || mirror === '분위기'))) {
      signals.push({ dim: 'spatial', tag: result.spatialContext, weight: 6 })
    }
    if (result.temporalContext) signals.push({ dim: 'temporal', tag: result.temporalContext, weight: 5 })

    // SHORT 모드: SAFE(저·무평점) 또는 단문 COMPLIMENT(≤40자)이면서 어떤 상황 신호도 없을 때
    //   → A + B + E (3슬롯). 단문에 자랑 블록 붙이는 TMI 방지.
    const isVeryShort = len <= 40
    const hasSignal   = result.isArtworkFocused || result.hasPeakHours || !!mirror || signals.length > 0
    const useShortMode = (result.status === 'SAFE' || (result.status === 'COMPLIMENT' && isVeryShort)) && !hasSignal

    let body: string[]
    if (useShortMode) {
      body = []
    } else {
      // 길이 비례 예산 — 풍부한 리뷰일수록 더 많은 조각 (슬롯 수가 아니라 적합도 상위만 선택)
      const budget = len <= 40 ? 1 : len <= 130 ? 2 : 3
      const fragIdx = { persona: ix.idxM, sensory: ix.idxS, spatial: ix.idxQ, temporal: ix.idxP }
      const frags = selectFragments(signals, lang, budget, fragIdx)
      if (frags.length === 0) {
        // Fragment 신호 없음 → 원래 동작(작품/일반 + 피크)
        const c = result.isArtworkFocused ? slotC_artwork(lang, sig, ix.idxC) : slotC_general(lang, ix.idxC)
        const d = result.hasPeakHours ? slotD_peak_hours(lang, ix.idxD) : ''
        body = [c, ...(d ? [d] : [])].slice(0, budget)
      } else {
        body = frags
        // 작품 중심 리뷰는 시그니처 작품 라인, 피크 언급 시 힌트를 예산 남는 만큼 보강
        if (result.isArtworkFocused && body.length < budget) body.push(slotC_artwork(lang, sig, ix.idxC))
        if (result.hasPeakHours && body.length < budget) body.push(slotD_peak_hours(lang, ix.idxD))
      }
    }
    rawReply = [a, b, ...body, e].join('\n\n')
  }

  // ── 토큰 치환 파이프라인 ───────────────────────────────────────────────────────
  // {branch_name}, {landmark}, {highlight_room}, {facility} → 실제 지점 메타데이터 값
  return applyBranchTokens(rawReply, tokens, lang)
}

/** 정적 답변 안전성 보증 — 금칙어 미포함 확인(개발/런타임 가드). */
export function isStaticReplySafe(text: string): boolean {
  return scanForbidden(text).clean
}

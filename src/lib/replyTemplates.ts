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
  slotC_pivot,
  slotD_peak_hours,
  slotE_positive,
  slotE_negative,
  slotEmpathy,
  slotReassurance,
  slotHybridAck,
  slotAmbiguousAck,
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
  // FNV-1a digest of the id, then mix the slot-prime in a finalization avalanche.
  // (Seeding with the prime up front washes out over long UUIDs → correlated indices
  //  → far fewer effective combos than the pool sizes imply. Fold prime at the end instead.)
  let h = 2166136261
  for (let i = 0; i < reviewId.length; i++) {
    h = Math.imul(h ^ reviewId.charCodeAt(i), 16777619)
  }
  h ^= Math.imul(prime, 0x9e3779b9)         // per-slot salt
  h = Math.imul(h ^ (h >>> 15), 2246822519) // avalanche
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return Math.abs(h | 0)
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
    } else if (result.isEmergency) {
      // 긴급: 건조하게 사과(A) + 핵심 피벗 + 클로징
      rawReply = [a, ...(piv ? [piv] : []), e].join('\n\n')
    } else {
      // 일반 불만: 사과(A) → [공감] → 개선 약속(pivot) → 클로징(E). 수용확인(B)은 A·pivot과
      //   중복이라 생략. 길이 스케일: 아주 짧은 단문 불만(≤45자, 예: "별로")은 장황 방지 위해
      //   공감 생략(A+pivot+E), 일반 불만은 공감 1개, 상세 리뷰(>160)는 2개까지.
      const discPool = [emp, rea, peak].filter(Boolean)  // 재량 라인 (서사 우선순위)
      const assemble = (n: number): string => {
        const keep = new Set(discPool.slice(0, n))
        // 서사 순서: empathy → pivot → peak → reassurance
        const body = [emp, piv, peak, rea].filter((s) => s && (s === piv || keep.has(s)))
        // pivot도 empathy/reassurance도 없으면(태그·예산 0) 수용확인 B로 최소 성의 표시
        return body.length ? [a, ...body, e].join('\n\n') : [a, b, e].join('\n\n')
      }
      // 불만은 사과(A)+[공감]+개선약속(pivot)+클로징(E) 4블록이면 CS상 충분.
      //   공감+안심을 모두 넣으면 중복·장황 → 재량 라인은 최대 1개(공감). 단문(≤45자)은 0개.
      //   (길이 바닥은 아래 floor 가드가 보장; CJK 고밀도 단문만 예외적으로 1~2개로 증액)
      let disc = len <= 45 ? 0 : 1
      rawReply = assemble(disc)
      // 길이 밴드 [85, 320] 자동 적응 (언어 밀도 차이 흡수):
      //   • 너무 길면(영어 등 다어절 언어) 재량 공감 라인을 줄여 사과+개선약속+클로징 핵심만 → 간결
      //   • 너무 짧으면(CJK 등 고밀도 단문) 재량 라인을 늘려 CS상 '충분한 답변' 보장(TOO_SHORT 방지)
      while (rawReply.length > 320 && disc > 0) {
        disc -= 1
        rawReply = assemble(disc)
      }
      while (rawReply.length < 85 && disc < discPool.length) {
        disc += 1
        rawReply = assemble(disc)
      }
    }
  } else if (result.status === 'AMBIGUOUS') {
    // ── AMBIGUOUS (혼합 감정) ─────────────────────────────────────────────────
    //   좋은 점·아쉬운 점이 섞인 리뷰 → 어느 한쪽으로 단정하지 않는 균형 답변.
    //   인사(A) + 양가 인정/개선 의지(ambiguousAck) + 희망 클로징(E). 작품/공간 자랑(TMI)·
    //   과한 사과·보상/법적 약속은 배제. 중립 유지를 위해 mirror는 적용하지 않는다.
    //   ★1-2 양가는 reviewProcessor가 사람 승인(requiresApproval)으로 격리하되 이 초안을 제공.
    const a = slotA_greeting(lang, name, ix.idxA)
    const ack = slotAmbiguousAck(lang, ix.idxB)
    const e = slotE_positive(lang, ix.idxE, null)
    // 저평점(★1-2)·부정 신호가 뚜렷하면 일반 개선 약속(pivot) 한 줄을 더해 성의를 보강.
    const lowSignal = (ctx.rating != null && ctx.rating <= 2) || result.tags.includes('저평점_부정신호')
    const piv = lowSignal ? slotC_pivot(lang, ['저평점_부정신호'], ix.idxC) : ''
    rawReply = [a, ack, ...(piv ? [piv] : []), e].filter(Boolean).join('\n\n')
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

    // ULTRA-SHORT: "굿"/"최고"/"Awesome"처럼 극단적 단답(≤10자) + 무신호 → 인사+감사 2조각만
    //   즉시 자동완료. 5-슬롯을 무리하게 채우지 않는다.
    const isUltraShort = useShortMode && len <= 10

    // frags(일반 감각/페르소나/공간 조각)는 길이 초과 시 가지치기 대상,
    //   artworkLine(작품 직접 언급 → 요청된 맥락)은 보존 대상으로 분리한다.
    let frags: string[] = []
    let artworkLine: string | null = null
    if (!useShortMode) {
      // 길이 비례 예산 — 풍부한 리뷰일수록 더 많은 조각 (슬롯 수가 아니라 적합도 상위만 선택)
      //   mirror가 있으면 B·E가 이미 맥락(생일/가족/데이트 등)을 echo하므로 조각 1개 감산(장황·중복 방지).
      const baseBudget = len <= 40 ? 1 : len <= 130 ? 2 : 3
      // mirror가 B·E에서 맥락을 echo하면 조각 1개 감산(장황 방지). 단, mirror와 '다른' 동반자
      //   맥락(데이트/가족 등)이 따로 있으면 그 echo 자리를 남겨야 하므로 감산하지 않는다.
      const distinctCompanion = !!result.companionContext && result.companionContext !== mirror
      const budget = (mirror && !distinctCompanion) ? Math.max(1, baseBudget - 1) : baseBudget
      const fragIdx = { persona: ix.idxM, sensory: ix.idxS, spatial: ix.idxQ, temporal: ix.idxP }
      frags = selectFragments(signals, lang, budget, fragIdx)
      // 작품/전시를 직접 언급한 리뷰(isArtworkFocused)에만 시그니처 작품 한 줄. 신호 없는 단순 칭찬엔
      //   묻지 않은 공간/작품 설명을 붙이지 않는다(짧고 담백; 사용자 피드백). 피크 힌트는 칭찬에 미부착(TMI).
      if (result.isArtworkFocused && frags.length < budget) artworkLine = slotC_artwork(lang, sig, ix.idxC)
    }
    if (isUltraShort) {
      rawReply = [a, b].join('\n\n')
    } else {
      // 본문 = 동반자/감각 조각(개인화·고가치) → 작품 시그니처(범용·말미). 길이 상한 360자 초과 시
      //   말미부터 pop → 데이트/가족 echo와 작품 echo가 함께 넘치면 작품을 먼저 덜어 개인화를 보존.
      //   (작품만 있는 칭찬은 a+b+작품+e ≈ 340자로 상한 내 → 작품 echo 유지. selectFragments가
      //    frags를 적합도 top-N 순으로 정렬하므로 약한 신호가 그다음으로 빠진다.)
      const body = [...frags, ...(artworkLine ? [artworkLine] : [])]
      const build = () => [a, b, ...body, e].join('\n\n')
      let assembled = build()
      while (assembled.length > 360 && body.length > 0) {
        body.pop()
        assembled = build()
      }
      rawReply = assembled
    }
  }

  // ── 토큰 치환 파이프라인 ───────────────────────────────────────────────────────
  // {branch_name}, {landmark}, {highlight_room}, {facility} → 실제 지점 메타데이터 값
  return applyBranchTokens(rawReply, tokens, lang)
}

/** 정적 답변 안전성 보증 — 금칙어 미포함 확인(개발/런타임 가드). */
export function isStaticReplySafe(text: string): boolean {
  return scanForbidden(text).clean
}

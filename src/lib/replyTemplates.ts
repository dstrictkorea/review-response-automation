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
import { getBranchTokens, applyBranchTokens } from '@/lib/branchMetadata'
import {
  slotA_greeting,
  slotA_apology,
  slotB_appreciation,
  slotB_acknowledgment,
  slotC_pivot,
  slotD_peak_hours,
  slotE_positive,
  slotE_negative,
  slotEmpathy,
  slotReassurance,
  slotHybridAck,
  slotAmbiguousAck,
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
    // ── AMBIGUOUS (혼합 감정) — 균형·중립 회신 ─────────────────────────────────
    //   좋은 점·아쉬운 점이 섞인 리뷰 → 어느 한쪽으로 단정하지 않는 균형 답변.
    //   인사(A, 중립 변형) + 양가 인정/개선 의지(ambiguousAck) + 희망 클로징(E).
    //   • "What a lovely review" 같은 과한 긍정 인사(idx 4~7)는 ★1-2 혼합 리뷰에 부적절 →
    //     중립 변형(idx%4)만 사용.
    //   • ambiguousAck가 이미 '좋았던 점 + 개선 의지' 양쪽을 담으므로 별도 개선 pivot은 더하지
    //     않는다 → "fell short" 중복·과한 사과 방지(사용자 지적: William Clark 사례).
    //   • 작품/공간 자랑(TMI)·보상/법적 약속 배제. 중립 유지를 위해 mirror 미적용.
    //   ★1-2 양가는 reviewProcessor가 사람 승인(requiresApproval)으로 격리하되 이 초안을 제공.
    const a = slotA_greeting(lang, name, ix.idxA % 4)
    const ack = slotAmbiguousAck(lang, ix.idxB)
    const e = slotE_positive(lang, ix.idxE, null)
    rawReply = [a, ack, e].join('\n\n')
  } else {
    // ── SAFE / COMPLIMENT — 심플 회신 ─────────────────────────────────────────
    //   인사(A) + 감사(B, mirror) + 따뜻한 클로징(E, mirror), 3블록 고정.
    //   작품 자랑(slotC_artwork)·감각/공간/페르소나 조각은 일절 붙이지 않는다:
    //     · 모든 지점의 메인 작품은 Garden이지만 지점마다 컨셉이 달라 특정 작품 자랑은 안전하지 않고,
    //     · 칭찬은 짧고 담백해야 한다(사용자 지침).
    //   다양성은 A×B×E 풀 + contextMirror 개인화로 확보(중복 최소화). 'discover'류 홍보 문구 제거.
    const a = slotA_greeting(lang, name, ix.idxA)
    const b = slotB_appreciation(lang, ix.idxB, mirror)  // contextMirror 맞춤 감사 (힐링/가족/데이트 등)
    const e = slotE_positive(lang, ix.idxE, mirror)      // contextMirror 맞춤 클로징
    // 칭찬은 인사(A)+감사(B) 2조각이 기본(사용자 지침: 심플). 단, mirror(힐링/가족/데이트 등)가
    //   있으면 맞춤 클로징(E)을 더해 echo 강화. 변형은 작성자명 + A×B(×mirror E)로 확보.
    rawReply = mirror ? [a, b, e].join('\n\n') : [a, b].join('\n\n')
  }

  // ── 토큰 치환 파이프라인 ───────────────────────────────────────────────────────
  // {branch_name}, {landmark}, {highlight_room}, {facility} → 실제 지점 메타데이터 값
  return applyBranchTokens(rawReply, tokens, lang)
}

/** 정적 답변 안전성 보증 — 금칙어 미포함 확인(개발/런타임 가드). */
export function isStaticReplySafe(text: string): boolean {
  return scanForbidden(text).clean
}

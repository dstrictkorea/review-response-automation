/**
 * promotedPatterns.ts — Auto-Promotion ADDITIVE 레지스트리 (Human-in-the-loop 병합 대상)
 *
 * `scripts/data-discovery-engine.ts`가 미인식 리뷰(LLM-fallback)에서 빈출 N-gram 트렌드를
 * 발견하면 `proposed_fragments.json`으로 '제안'만 한다. 관리자가 `accept` 명령을 내릴 때만
 * 이 파일에 ADDITIVE로 병합되어 엔진에 반영된다(즉시 코드 덮어쓰기 금지).
 *
 * ─ 안전 불변(절대) ───────────────────────────────────────────────────────────────
 *  1. EMERGENCY 레이어는 승격 대상이 **절대 아님** (코드 하드코딩 유지, DECISIONS #11).
 *     부상/법적/환불요구/직원징계 등은 자동 승격 금지 — 사람이 코드에 직접 추가.
 *  2. POSITIVE 승격은 안전(긍정 인식 보강만). COMPLAINT 태그 승격은 라우팅(격리/정적 사과)에만 영향.
 *  3. 모든 승격(accept) 직후 `regression-guard`(validate-waterfall 813 + loop) 통과 필수.
 *     기존 사캐즘/심각 불만 격리 가드를 우회·훼손하면 accept를 롤백한다.
 *  4. 본 레지스트리는 ADDITIVE only — 기존 규칙을 약화/대체하지 않는다.
 *
 * 시작값은 비어 있음(베이스라인 무변경). accept된 항목만 누적된다.
 */

import type { ReplyLanguage } from '@/lib/replyLanguage'

export interface PromotedComplaint {
  /** 태그명 (예: 'FACILITY_AC_COMPLAINT') — slotC_pivot 폴백 키 */
  tag: string
  /** Layer 1 추가 정규식 소스 (i 플래그로 컴파일). EMERGENCY와 무관한 운영/시설 불만만. */
  pattern: string
  /** 발견 근거 메모 (빈도/언어/출처) */
  note: string
  /** 토픽별 개선 인정 조각 (9개 언어). slotC_pivot이 SLOT_C_PIVOTS 미스 시 폴백 소비. */
  fragment?: Partial<Record<ReplyLanguage, string[]>>
}

export interface PromotedFragment {
  /** Fragment Pool 차원 (현재 spatial/temporal/persona 확장 또는 complaint 인정 조각) */
  dim: 'persona' | 'sensory' | 'spatial' | 'temporal'
  tag: string
  weight: number
  lines: Partial<Record<ReplyLanguage, string[]>>
}

/** 승격된 긍정어(정규식 alt). 긍정 인식 보강 전용 — 안전. */
export const PROMOTED_POSITIVE: string[] = []

/** 승격된 운영/시설 불만 패턴 (Layer 1 additive). EMERGENCY 절대 불가. */
export const PROMOTED_COMPLAINT: PromotedComplaint[] = [
  { tag: 'FACILITY_AC_COMPLAINT', pattern: "에어컨|냉방|실내[^.!?\\n]{0,6}추웠|\\bair\\s*con(?:ditioning)?\\b|\\baircon\\b|freezing\\s*inside|冷气|空调|エアコン|aire\\s*acondicionado|кондиционер", note: "freq=6, auto-promoted (Wave 22 discovery)", fragment: {
    ko: ['실내 온도가 쾌적하지 못해 불편을 드린 점 사과드립니다. 냉방 환경을 세심히 살피겠습니다.'],
    en: ['We are sorry the indoor temperature was uncomfortable. We will monitor our climate control more closely.'],
    ja: ['館内の温度でご不便をおかけし申し訳ございません。空調環境をより丁寧に管理してまいります。'],
    zh: ['对于室内温度造成的不适，我们深表歉意。我们将更细致地调节空调环境。'],
    es: ['Lamentamos que la temperatura interior fuera incómoda. Vigilaremos mejor la climatización.'],
    ru: ['Сожалеем, что температура в помещении была некомфортной. Будем внимательнее следить за климатом.'],
    ar: ['نأسف لأن درجة الحرارة في الداخل كانت غير مريحة. سنراقب أنظمة التكييف بعناية أكبر.'],
    hi: ['अंदर का तापमान असुविधाजनक रहा, इसके लिए हम क्षमा चाहते हैं। हम वातावरण नियंत्रण पर अधिक ध्यान देंगे।'],
    tl: ['Humihingi kami ng paumanhin na hindi komportable ang temperatura sa loob. Babantayan namin nang mas mabuti ang aircon.'],
  } },
]

/** 승격된 Fragment 조각 (선택) — fragmentPool이 additive 소비. */
export const PROMOTED_FRAGMENTS: PromotedFragment[] = []

// ── 컴파일 헬퍼 (엔진이 소비) ──────────────────────────────────────────────────────
/** PROMOTED_POSITIVE → 단일 RegExp (없으면 null). */
export function promotedPositiveRegex(): RegExp | null {
  if (!PROMOTED_POSITIVE.length) return null
  try { return new RegExp(PROMOTED_POSITIVE.join('|'), 'i') } catch { return null }
}
/** PROMOTED_COMPLAINT → [{tag, RegExp}] (컴파일 실패분 제외). */
export function promotedComplaintRules(): Array<{ tag: string; re: RegExp }> {
  const out: Array<{ tag: string; re: RegExp }> = []
  for (const c of PROMOTED_COMPLAINT) {
    try { out.push({ tag: c.tag, re: new RegExp(c.pattern, 'i') }) } catch { /* skip invalid */ }
  }
  return out
}

/** 승격 불만 태그의 개선 인정 조각 (slotC_pivot 폴백). 미커버 언어 → '' (governor 스킵). */
export function promotedComplaintLine(tag: string, lang: ReplyLanguage, idx = 0): string {
  const arr = PROMOTED_COMPLAINT.find(c => c.tag === tag)?.fragment?.[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

/**
 * synonymEngine.ts — 유의어 사전(Synonym Dictionary) + N-gram 동적 패턴 생성기
 *
 * 목적: 하드코딩 단어 목록 대신, 언어별 유의어 그룹을 정의하고
 * 이를 N-gram 형태의 동적 정규식으로 변환하여 WaterfallRegexEngine에 공급한다.
 * "단어가 떨어져 있어도 문맥을 잡는" 근접 N-gram 패턴 지원.
 *
 * Zero-Cost NLP 모사 엔진의 핵심 — LLM API 비용 없이 의미 기반 분류 달성.
 *
 * 주요 export:
 *   FILLER_PATTERN         — 저평점 리뷰의 꼬리 필러 문장 탐지 (NOISE_POSITIVE 확장판)
 *   LOW_RATING_NEGATIVE_BODY — 1-2★ 부정 본문 신호 탐지 (SAFE 오분류 방지)
 *   extractContextMirror   — 답변 맞춤 핵심 감성 키워드 추출 (슬롯 B/E context mirror용)
 *   buildNgramPattern      — 유의어 목록 → 동적 N-gram RegExp 컴파일러
 */

// ── 내부 유틸리티 ─────────────────────────────────────────────────────────────────

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 구문 내 공백을 `[^.!?\n]{0,gap}` 으로 확장하여 근접 N-gram 패턴 생성.
 * 예: '기대한 만큼은' → '기대한[^.!?\\n]{0,8}만큼은'
 * 단일 단어는 그대로 escapeReg 처리.
 */
function toNgramPattern(phrase: string, gap = 8): string {
  const parts = phrase.trim().split(/\s+/)
  if (parts.length <= 1) return escapeReg(phrase)
  return parts.map(escapeReg).join(`[^.!?\\n]{0,${gap}}`)
}

/**
 * 한국어/영어 유의어 목록에서 단일 RegExp를 동적으로 컴파일한다.
 * @param koTerms  한국어 유의어 목록
 * @param enTerms  영어 유의어 목록 (생략 가능)
 * @param gap      N-gram 최대 문자 간격 (단어 사이 허용 거리)
 * @param flags    정규식 플래그 (기본 'i')
 */
export function buildNgramPattern(
  koTerms: string[],
  enTerms: string[] = [],
  gap = 8,
  flags = 'i',
): RegExp {
  const patterns = [
    ...koTerms.map(p => toNgramPattern(p, gap)),
    ...enTerms.map(p => toNgramPattern(p, gap)),
  ]
  try {
    return new RegExp(patterns.join('|'), flags)
  } catch {
    return /(?!)/  // 컴파일 실패 시 절대 매칭 안 되는 패턴 반환
  }
}

// ════════════════════════════════════════════════════════════════════════════════
//  저평점 필러 문장 패턴 (Filler Noise — NOISE_POSITIVE 고도화 버전)
//
//  배경: 테스트 데이터/실제 리뷰 모두에서 아이러니하게 붙는 추천/긍정 꼬리 문장들.
//  예: "기대한 만큼은 아니었습니다. 커플 데이트로 추천합니다." [1★]
//      → '추천' 키워드가 DEFAULT_POSITIVE 매칭 → SAFE 오분류
//
//  이 패턴으로 저평점(rating ≤ 2) 리뷰에서 해당 문장을 제거하거나 무시한다.
// ════════════════════════════════════════════════════════════════════════════════
export const FILLER_PATTERN: RegExp = buildNgramPattern(
  [
    '커플 데이트로 추천',
    '커플이랑 오기 좋',
    '커플 방문 추천',
    '가족끼리 와도 괜찮',
    '가족과 함께 와도 괜찮',
    '가족이랑 오기 좋',
    '가족 방문 추천',
    '데이트 장소로 추천',
    '데이트 코스로 추천',
    '연인과 함께 오기 좋',
    '사진 찍기에도 좋아',
    '다음에 또 올 의향',
    '평일에 가면 더 좋을',
    '평일에 오면 더 좋을',
    '한 번쯤 가볼 만',
    '혼자 방문해도 좋',
    '친구랑 와도 좋을',
  ],
  ['worth checking out', 'good location'],
  4,  // 단어 사이 최대 4자 (조사 등 자연 거리)
)

// ════════════════════════════════════════════════════════════════════════════════
//  저평점 본문 부정 신호 패턴 (Low-Rating Negative Body)
//
//  목적: 1-2★ 리뷰에서 FILLER_PATTERN 제거 후에도 부정 맥락이 있을 경우
//  SAFE 오분류를 방지하고 COMPLAINT/AMBIGUOUS로 강제 격상한다.
//
//  CSV 분석 기반 패턴:
//   - "기대한 만큼은 아니었습니다" [1★] → DEFAULT_COMPLAINT 미매칭 → SAFE 오분류
//   - "입장 대기가 길어서 조금 지쳤네요" [2★] → DEFAULT_CROWD 미매칭 → SAFE 오분류
//   - "가격 대비 만족도는 좀 아쉬웠어요" [2★] → DEFAULT_VALUE 미매칭 → SAFE 오분류
// ════════════════════════════════════════════════════════════════════════════════
export const LOW_RATING_NEGATIVE_BODY: RegExp = buildNgramPattern(
  [
    '기대한 만큼은 아니었',
    '기대했던 것보다',
    '기대보다 평범',
    '기대 이하',
    '기대에 못 미치',
    '기대보다 별로',
    '기대에 비해 아쉬',
    '아쉬웠',
    '아쉬운 면',
    '아쉬운 부분',
    '아쉬운 점이',
    '별로였',
    '별로인 것',
    '별로인것',
    '실망스러웠',
    '조금 실망',
    '좀 실망',
    '많이 실망',
    '만족스럽지 않았',
    '만족하지 못했',
    '기대에 못 미쳤',
    '가격 대비 아쉬웠',
    '가격 대비 조금',
    '가성비 아쉬웠',
    '입장 대기 지쳤',
    '줄이 너무 길었',
    '오래 기다렸',
    '대기가 길어서 지쳤',
    '너무 지쳤',
    '최악이었',
    '완전 최악',
    '진짜 최악',
    '기분을 다 망쳤',
    '기분이 망가졌',
    '화장실 더럽',
    '표지판 없',
    '안내 없',
  ],
  [
    'below expectations',
    'not what I expected',
    'expected better',
    'bit disappointing',
    'somewhat disappointing',
    'not worth the',
    'waited too long',
    'long wait',
    'long queue',
    'not satisfied',
    'ruined by',
    'completely ruined',
    'terrible experience',
    'awful experience',
    'unbearably hot',
    'no air conditioning',
    'stuffy',
    'absolutely not worth',
    'complete waste of',
    'complete organizational failure',
    'organizational failure',
    'complete failure',
    'complete disaster',
    'would not recommend',
    'do not recommend',
    'safety issue',
    'safety concern',
  ],
  8,
)

// ════════════════════════════════════════════════════════════════════════════════
//  맥락 거울 추출 (Context Mirror Extractor)
//
//  리뷰 텍스트에서 핵심 감성 키워드를 추출한다.
//  추출된 키워드는 staticTemplates.ts의 slotB_appreciation/slotE_positive에서
//  답변을 리뷰 내용에 맞춤 구성하는 데 사용된다 (→ "AI같지 않게" 답변 구현의 핵심).
//
//  우선순위: 힐링 > 몰입 > 데이트 > 가족 > 친구 > 사진 > 감동 > 분위기
//  → 가장 강한 감성 신호를 하나만 반환.
// ════════════════════════════════════════════════════════════════════════════════
export function extractContextMirror(text: string): string | null {
  const t = text ?? ''

  // 힐링/치유 관련 — 가장 구체적이고 명확한 감성
  // 힐링 단독으로도 매칭 (단, 바로 뒤에 부정 표현이 오는 경우 제외)
  // "힐링 그 자체", "힐링됐어", "힐링이 됐어", "힐링 제대로" 모두 매칭
  if (/힐링(?!\s*(?:이\s*)?(?:안|못|부족|없|별로|실망|사라))/.test(t)) return '힐링'
  if (/\bhealing\b|\brejuvenating\b|\btherapeutic\b/.test(t)) return '힐링'

  // 몰입감 관련
  if (/몰입(?:감|이\s*최고|되는|형|돼|됩니다)/.test(t)) return '몰입'
  if (/\bimmersive?\b|\bwas\s+(?:so\s+)?immersed?\b/.test(t)) return '몰입'

  // 데이트 관련 — 커플/연인 맥락
  if (/데이트|연인과/.test(t)) return '데이트'
  if (/\bdate\s*(?:night|spot|place)\b|\bromantic\b/.test(t)) return '데이트'

  // 가족 관련 — 아이/부모/가족 맥락
  if (/(?:아이|아들|딸|아기|어린이)(?:랑|이랑|과\s*함께|들과|와\s*함께)/.test(t)) return '가족'
  if (/가족(?:이랑|과\s*함께|끼리|들과|과\s*방문)/.test(t)) return '가족'

  // 친구 관련
  if (/친구(?:랑|이랑|들과|와\s*함께)/.test(t)) return '친구'

  // 사진/인생샷 관련
  if (/인생\s*샷|포토\s*스팟|사진\s*찍기/.test(t)) return '사진'
  if (/\bphoto\b|\binstagram\b|\bphotos?\s+(?:were|are|came)\b/.test(t)) return '사진'

  // 감동/눈물 관련
  if (/감동|감격|뭉클|눈물/.test(t)) return '감동'

  // 분위기 관련 — 강한 긍정 형용사와 함께할 때만 추출
  if (/분위기가?\s*(?:너무|정말|진짜|되게|완전)\s*(?:좋|예쁘|멋|훌륭|환상)/.test(t)) return '분위기'

  return null
}

// ════════════════════════════════════════════════════════════════════════════════
//  3-Tier Risk Dictionary & Sanitization Layer
//
//  목적: COMPLAINT/AMBIGUOUS 라우팅 전 독성 순화 및 리스크 등급 판별.
//    Tier 1 (Sanitizable → AI_DONE 허용): 비속어/슬랭 → 비즈니스 언어 치환
//    Tier 2 (Critical → PENDING_APPROVAL 강제): 법무/운영 Critical 리스크
//    Tier 3 (Unknown Toxicity → PENDING_APPROVAL + fallback): 미지 극단 표현
//
//  처리 순서: Tier 2 감지 → Tier 1 치환 → Tier 3 감지 → clean(Tier 1 반환)
// ════════════════════════════════════════════════════════════════════════════════

export interface RiskAssessment {
  /** 1=순화가능(AI_DONE), 2=Critical(격리), 3=Unknown Toxic(격리+fallback) */
  tier: 1 | 2 | 3
  /** 순화/치환 텍스트 (Tier 1=치환완료, Tier 2=원문유지, Tier 3=fallback 덮어쓰기) */
  sanitizedText: string
  /** 탐지된 리스크 플래그 레이블 목록 */
  flags: string[]
  /** 치환 이력 [{original, replacement}] */
  replacements: Array<{ original: string; replacement: string }>
}

// ── Tier 1: 비속어/슬랭 → 비즈니스 언어 치환 목록 ──────────────────────────────
// 형식: [RegExp(flags='i'), replacementText, flagLabel]
// 처리: test(i) → replace(gi) 순으로 사용
const TIER1_SANITIZE: Array<[RegExp, string, string]> = [
  // 가격 비속어: 창렬, 돈ㅈㄴ아깝, 개비싸, 도둑같은가격
  [/창렬|돈\s*ㅈㄴ\s*아깝|돈\s*존나\s*아깝|개\s*비싸|가성비\s*개\s*똥|도둑\s*같은\s*가격/i, '티켓 가격', 'PRICE_SLANG'],
  // 인파/혼잡 비속어: 시장통, 돗대기, 개많음, 사람개많
  [/시장통|돗대기\s*시장|도떼기|개\s*많음|사람\s*개\s*많|북새통|사람이?\s*존나\s*많|사람\s*ㅈㄴ\s*많/i, '혼잡한 관람 환경', 'CROWD_SLANG'],
  // 직원 비속어: 싸가지없음, 직원최악, 직원개같
  [/싸가지\s*없|싸가지없음|직원\s*최악|직원\s*개\s*같|직원\s*꼰대|직원\s*무례하|직원\s*개판/i, '직원 서비스', 'STAFF_SLANG'],
  // 일반 불만 비속어: 열받음, 개짜증, 빡침
  [/개\s*열받|열받음|개\s*짜증|존\s*나\s*짜증|완전\s*빡침|빡쳤|환장\s*하|개\s*빡침/i, '관람 불편', 'FRUSTRATION_SLANG'],
  // 가치 비하 비속어: 바가지, 돈낭비, 완전쓰레기
  [/바가지|돈\s*낭비|완전\s*쓰레기|전시\s*개\s*별로|개\s*실망|개\s*쓰레기\s*같|ㅈ같은\s*전시/i, '관람 만족도', 'VALUE_SLANG'],
]

// ── Tier 2: Critical 리스크 — waterfallRegexEngine DEFAULT_EMERGENCY 보완망 ─────
// 특정 직원 지목, 법적 위협 표현, 아동 부상 근접 패턴 등 추가 포착
const TIER2_CRITICAL: RegExp =
  /(?:특정\s*직원|담당\s*직원|직원\s*(?:실명|성함|이름))|직원\s*(?:해고하|신고하|고발)\s*(?:겠|해야|할|했)|소비자\s*고발|집단\s*소송|언론\s*제보|인스타\s*(?:박살|올릴|퍼뜨릴)|sns\s*(?:올릴|퍼뜨릴|폭파)|온라인\s*(?:신고|도배|뭉개)|(?:아이|아들|딸|애)[^.!?\n]{0,15}(?:다쳤|다칩|넘어졌|부딪|피가\s*났)|환불\s*(?:요구|거부|안\s*해|해\s*달라|못\s*받)|법적\s*(?:조치|대응|책임)/i

// ── Tier 3: 딕셔너리 미등록 극단 욕설 / 특수기호 혼합 비속어 ─────────────────────
// 자음 조합 욕설(ㅅㅂ, ㄲㅈ, ㅁㅊ) + 특수기호 대체 욕설
// ※ Tier 1 처리 후 남은 텍스트에서 탐지 (Tier 1이 먼저 클린하므로 Tier 1 외 패턴만 도달)
const TIER3_UNKNOWN_TOXIC: RegExp =
  /ㅅ\s*ㅂ|ㄲ\s*ㅈ|ㅁ\s*ㅊ|씨\s*[발팔x@*#%^]|ㅂ\s*시\s*발|ㄳ\s*ㅎ|ㅆ\s*ㅂ|ㅈ\s*같(?:\s*은)?\s*(?:곳|데|전시|뮤지엄)|개\s*새\s*끼|완전\s*개\s*[ㅅ시s]/i

/** Tier 3 강제 치환 텍스트 — 원문 폐기 후 이 안전 표현으로 덮어씀 */
export const TIER3_FALLBACK_TEXT = '말씀해주신 관람 불편 사항'

/**
 * sanitizeAndScoreRisk — 3-Tier 리스크 평가 및 독성 순화 (순수 함수)
 *
 * 처리 파이프라인:
 *   1. Tier 2 Critical 탐지 → 즉시 tier=2 반환 (원문 유지)
 *   2. Tier 1 비속어 치환 → 순화 완료 시 tier=1 반환
 *   3. Tier 3 미지 욕설 탐지 → fallback 덮어쓰기, tier=3 반환
 *   4. Clean → tier=1 반환 (변경 없음)
 */
export function sanitizeAndScoreRisk(text: string): RiskAssessment {
  const t = (text ?? '').trim()
  const flags: string[] = []
  const replacements: Array<{ original: string; replacement: string }> = []

  // ── Step 1: Tier 2 Critical 탐지 (최우선 — 발견 즉시 반환) ─────────────────────
  if (new RegExp(TIER2_CRITICAL.source, TIER2_CRITICAL.flags).test(t)) {
    flags.push('CRITICAL_RISK')
    return { tier: 2, sanitizedText: t, flags, replacements }
  }

  // ── Step 2: Tier 1 순화 처리 ─────────────────────────────────────────────────
  let sanitized = t
  let hasTier1 = false
  for (const [pattern, replacement, flagLabel] of TIER1_SANITIZE) {
    // test에 i 플래그만 사용 (stateless), replace에 gi 추가 (전체 치환)
    if (new RegExp(pattern.source, 'i').test(sanitized)) {
      hasTier1 = true
      flags.push(flagLabel)
      sanitized = sanitized.replace(new RegExp(pattern.source, 'gi'), (matched) => {
        replacements.push({ original: matched, replacement })
        return replacement
      })
    }
  }
  if (hasTier1) {
    return { tier: 1, sanitizedText: sanitized, flags, replacements }
  }

  // ── Step 3: Tier 3 Unknown Toxic 탐지 ─────────────────────────────────────────
  if (new RegExp(TIER3_UNKNOWN_TOXIC.source, TIER3_UNKNOWN_TOXIC.flags).test(t)) {
    flags.push('UNKNOWN_TOXIC')
    replacements.push({ original: t, replacement: TIER3_FALLBACK_TEXT })
    return { tier: 3, sanitizedText: TIER3_FALLBACK_TEXT, flags, replacements }
  }

  // ── Clean: 독성 없음 → tier=1 (AI_DONE 허용 기본값) ─────────────────────────
  return { tier: 1, sanitizedText: t, flags: [], replacements: [] }
}

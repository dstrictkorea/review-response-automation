/**
 * waterfallRegexEngine.ts — 다국어(KO/EN) 결정론적 폭포수 분류 엔진
 *
 * LLM의 비결정적 환각/톤 파편화를 원천 차단하기 위해, 리뷰 텍스트를 100% 규칙 기반으로
 * 분류한다. 상위 Layer 충족 시 즉시 반환(Early Return). 대소문자 무시(/i), 공백 정규화 후 평가.
 *
 * 분류 순서(폭포수):
 *   Layer 0  긴급 안전/CS/법적 리스크 (Emergency Kill-switch)   → status='EMERGENCY'
 *   Layer 1  운영/서비스 불만 (Operational Pain Points)         → isComplaint
 *   Layer 2  재방문/이탈 판별 (Retention & Churn Matrix)         → isRepeatVisitor / isChurnRisk
 *   Layer 3  이중부정/도치 예외 (Sarcasm / Double-Negative)      → 불만 오인 복구
 *   최종     SAFE(긍정·정적템플릿) / COMPLAINT(LLM) / AMBIGUOUS(LLM) 판정
 *
 * 안전 우선: Layer 0 은 본 엔진의 정규식 OR filterService.scanText(키워드 SSOT, DECISIONS #8)의
 * high/critical 매칭을 합집합으로 사용한다 → 기존 안전망보다 절대 약해지지 않는다(floor-only).
 */

import { scanText } from '@/services/filterService'

// ── 톤 단일화 (SHORT/CAUTIOUS 폐기 → STANDARD 단일 리터럴) ─────────────────────────
export type ReplyTone = 'STANDARD'

export type ReviewClass = 'SAFE' | 'COMPLAINT' | 'EMERGENCY' | 'AMBIGUOUS'

export interface WaterfallResult {
  /** 결정론적 분류 결과 */
  status: ReviewClass
  /** 이 리뷰가 LLM Fallback을 필요로 하는가 (COMPLAINT/AMBIGUOUS = true) */
  requiresLLM: boolean
  /** 알고리즘 분류 근거 (LLM 프롬프트 주입 + 감사 로그용) */
  reason: string
  /** 분류 태그 (reviews.categories 에 저장) */
  tags: string[]
  /** 답변 톤 — 항상 STANDARD */
  tone: ReplyTone
  // ── 정밀 분류 플래그 ──────────────────────────────────────────────────────────
  isEmergency: boolean       // 안전/법적 이슈
  isComplaint: boolean       // 운영/서비스 불만
  isArtworkFocused: boolean  // 순수 작품 감상(긍정)
  isRepeatVisitor: boolean   // 과거 방문 입증
  isChurnRisk: boolean       // 미래 이탈 위험
}

// ════════════════════════════════════════════════════════════════════════════════
//  Layer 정규식 (KO/EN 동시 · 대소문자 무시 · 곡선따옴표 허용)
// ════════════════════════════════════════════════════════════════════════════════

// Layer 0 — 긴급 안전/CS/미국식 법적 리스크 (Kill-switch)
const EMERGENCY_RE =
  /(다쳤|넘어졌|피가|병원|119|어지러|멀미|구토|발작|분실물|경찰|고소|소비자원|보상|환불)|(hurt|injur|fell|trip|bleed|hospital|911|paramedic|dizzy|nausea|vomit|puke|seizure|epilepsy|lost|missing|stolen|police|cop|sue|lawyer|attorney|lawsuit|refund|compensat|chargeback)/i

// Layer 1 — 운영 불만 / 미국식 서비스 컴플레인
const COMPLAINT_RE =
  /(불친절|짜증|최악|실망|돈\s*아깝|바가지|시장통|도떼기|더럽|냄새|의자\s*없|주차\s*불편|대기\s*너무)|(rude|attitude|unprofessional|worst|disappoint|rip\s*off|waste\s*of|overprice|scam|packed|crowded|zoo|messy|dirty|filthy|smell|stink|no\s*seat|nowhere\s*to\s*sit|parking|long\s*(line|wait|queue)|not\s*worth|overrated)/i

// Layer 2-A — 미래 거부(이탈 리스크)
const CHURN_RE =
  /(다시는|두번\s*다시는)\s*(안\s*올|안\s*갈)|(never\s*again|never\s*com|won[''’]?t\s*be\s*back|won[''’]?t\s*return|wouldn[''’]?t\s*recommend|not\s*recommend|do\s*not\s*go|skip\s*this|regret)/i

// Layer 2-B — 과거 방문 입증(충성 고객)
const REPEAT_RE =
  /(두\s*번째|2번째|3번째|다회차)\s*(방문|관람|왔)|(지난번|과거)\s*에\s*(이어|오고|좋아서)\s*(또|다시)|(갈|올|방문할)\s*때마다|(재방문\s*인데|다시\s*방문했)|(second\s*time|2nd\s*time|third\s*time|3rd\s*time|multiple\s*times|back\s*again|returned|every\s*time\s*(i|we)\s*(go|come|visit)|always|came\s*back|visit\s*again)/i

// Layer 2-C — 단순 미래 희망 (재방문 입증 아님)
const FUTURE_HOPE_RE =
  /(나중에|다음에|기회\s*되면)\s*(꼭|무조건)?\s*(재방문|또\s*방문|다시\s*올)|(will\s*be\s*back|can[''’]?t\s*wait\s*to\s*return|next\s*time|definitely\s*return|will\s*(visit|come)\s*again|would\s*go\s*back)/i

// Layer 3 — 이중부정/도치 (불만 오인 복구 → 긍정)
// 주의: 'worth it'(긍정)은 POSITIVE_RE가 처리한다. 여기에 'worth it'을 두면 'not worth it'(부정)을
// 이중부정으로 오인 복구하므로 제외한다. 'not worth'는 COMPLAINT_RE에서 불만으로 잡는다.
const SARCASM_RE =
  /(안\s*아깝|나쁘지\s*않|나쁘지않)|(not\s*(too\s*)?bad|not\s*a\s*waste|didn[''’]?t\s*disappoint)/i

// 긍정 감성 / 질문 / 작품 키워드 (SAFE vs AMBIGUOUS 판정용)
const POSITIVE_RE =
  /(좋|최고|감동|멋지|멋있|예쁘|이쁘|훌륭|환상|만족|행복|즐거|추천|볼\s*만|아름답|인생\s*샷)|(beautiful|amazing|great|love|wonderful|perfect|gorgeous|stunning|incredible|awesome|fantastic|enjoyed|recommend|worth\s*it)/i

const QUESTION_RE =
  /[?？]|(인가요|나요|까요|을까|ㄴ가요|어때|되나요|있나요|하나요|일까)/i

const ARTWORK_RE =
  /(작품|전시|몰입|미디어\s*아트|미디어아트|예술|아트)|(immersive|\bart(?:s|work)?\b|exhibition|installation|media\s*art)/i

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))]
}

/**
 * analyzeReview — 폭포수 분류 (순수 함수, 부작용 없음).
 * @param rawText 리뷰 원문
 */
export function analyzeReview(rawText: string): WaterfallResult {
  const text = (rawText ?? '').replace(/\s+/g, ' ').trim()

  // ── Layer 0: Emergency (엔진 정규식 OR filterService high/critical 합집합) ──────
  const filter = scanText(rawText ?? '')
  const filterCritical =
    filter.triggered && (filter.maxRiskLevel === 'high' || filter.maxRiskLevel === 'critical')

  if (EMERGENCY_RE.test(text) || filterCritical) {
    return {
      status: 'EMERGENCY',
      requiresLLM: false, // 긴급 건은 LLM이 아니라 사람 수동 검토로 격리
      reason:
        '긴급 안전/CS/법적 리스크 감지 — 즉시 격리' +
        (filter.triggered ? ` (필터: ${filter.matchedKeywords.join(', ')})` : ''),
      tags: dedupe(['CS 격리', '안전/이슈', ...filter.matchedKeywords]),
      tone: 'STANDARD',
      isEmergency: true,
      isComplaint: false,
      isArtworkFocused: false,
      isRepeatVisitor: false,
      isChurnRisk: false,
    }
  }

  const tags: string[] = []
  let isComplaint = false
  let isArtworkFocused = false
  let isRepeatVisitor = false
  let isChurnRisk = false

  // ── Layer 1: 운영 불만 ──────────────────────────────────────────────────────────
  if (COMPLAINT_RE.test(text)) {
    isComplaint = true
    isArtworkFocused = false
    tags.push('운영불만')
  }

  // ── Layer 2: 재방문 / 이탈 (2-A → 2-B → 2-C 우선순위) ───────────────────────────
  if (CHURN_RE.test(text)) {
    isRepeatVisitor = false
    isChurnRisk = true
    tags.push('이탈위험')
  } else if (REPEAT_RE.test(text)) {
    isRepeatVisitor = true
    tags.push('repeat visitor')
  } else if (FUTURE_HOPE_RE.test(text)) {
    isRepeatVisitor = false
  }

  // ── Layer 3: 이중부정/도치 복구 (불만 오인 → 긍정) ──────────────────────────────
  let sarcasmPositive = false
  if (SARCASM_RE.test(text)) {
    isComplaint = false
    sarcasmPositive = true
    tags.push('이중부정(긍정)')
  }

  // ── 감성 신호 ──────────────────────────────────────────────────────────────────
  const hasPositive = sarcasmPositive || POSITIVE_RE.test(text)
  const isQuestion = QUESTION_RE.test(text)
  if (!isComplaint && hasPositive && ARTWORK_RE.test(text)) {
    isArtworkFocused = true
    tags.push('작품감상')
  }

  // ── 최종 판정 ──────────────────────────────────────────────────────────────────
  let status: ReviewClass
  let requiresLLM: boolean
  let reason: string

  if (isComplaint) {
    status = 'COMPLAINT'
    requiresLLM = true
    reason = '운영/서비스 불만 감지 → LLM 공감 사과문(STANDARD)'
  } else if (hasPositive && !isQuestion) {
    status = 'SAFE'
    requiresLLM = false
    reason = isArtworkFocused
      ? '작품 중심 긍정 리뷰 → 정적 템플릿(ETERNAL NATURE)'
      : '일반 긍정 리뷰 → 정적 감사 템플릿'
  } else {
    status = 'AMBIGUOUS'
    requiresLLM = true
    reason = '알고리즘 확신 불가(중립/질문/모호) → LLM 위임'
  }

  return {
    status,
    requiresLLM,
    reason,
    tags: dedupe(tags),
    tone: 'STANDARD',
    isEmergency: false,
    isComplaint,
    isArtworkFocused,
    isRepeatVisitor,
    isChurnRisk,
  }
}

/**
 * scanForbidden — Double-Check 금칙어 필터 (게시 전 최종 방어선).
 * 정적/LLM 출처 무관하게 모든 답변이 통과해야 한다. 약속성 보상/법적책임/CCTV/직원징계 탐지.
 * @returns clean=false 이면 금칙 표현 존재 → 승인 대기로 강등해야 함.
 */
export function scanForbidden(text: string): { clean: boolean; hits: string[] } {
  const t = (text ?? '').toLowerCase()
  const RULES: Array<{ re: RegExp; label: string }> = [
    { re: /환불(해|을|해\s*드리|\s*가능)|전액\s*환불|돈\s*돌려|refund(ed|ing)?\b|charge\s*back/i, label: '환불 약속' },
    { re: /보상(해|을|금|\s*가능)|배상(해|금)|무료\s*티켓|무료\s*입장|free\s*ticket|compensat(e|ion)|voucher/i, label: '보상 약속' },
    { re: /법적\s*책임|저희\s*과실|저희\s*잘못입니다|legal(ly)?\s*(liable|responsible)|our\s*(fault|liability)/i, label: '법적 책임 인정' },
    { re: /cctv|시시티비|감시\s*카메라|surveillance\s*footage|security\s*footage/i, label: 'CCTV 언급' },
    { re: /직원(을|를)?\s*(해고|징계|처벌)|fire\s+the\s+(staff|employee)|disciplin(e|ary)/i, label: '직원 징계 약속' },
  ]
  const hits: string[] = []
  for (const r of RULES) if (r.re.test(t)) hits.push(r.label)
  return { clean: hits.length === 0, hits: dedupe(hits) }
}

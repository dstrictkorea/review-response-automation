/**
 * validate-waterfall.ts — PHASE 5 결정론적 엔진 자체 검증 (TDD)
 *
 * 실행: npx tsx scripts/validate-waterfall.ts
 * 모든 케이스 통과 시 exit 0, 하나라도 실패 시 exit 1.
 */

import { processReview } from '@/lib/reviewProcessor'
import { analyzeReview, scanForbidden, applyRulesBundle, isUsingDefaults } from '@/lib/waterfallRegexEngine'
import type { AutomationRule } from '@/lib/rulesCache'
import { buildStaticReply } from '@/lib/replyTemplates'
import { detectReviewLanguage, starRatingToNumber } from '@/lib/google/syncReviews'

let failures = 0
function check(name: string, cond: boolean, extra = '') {
  const tag = cond ? 'PASS' : 'FAIL'
  if (!cond) failures++
  console.log(`[${tag}] ${name}${extra ? `  — ${extra}` : ''}`)
}

const ctxEN = { branchCode: 'AMLV', language: 'en' as const, reviewerName: 'John' }
const ctxKO = { branchCode: 'AMGN', language: 'ko' as const, reviewerName: '민수' }

// ── Case 1: 작품 칭찬 + 직원 불만 + 이탈 → COMPLAINT, 작품찬양 차단 ──────────────
// [v2 스마트 게이트키퍼]: COMPLAINT + Tier 1 (영어 "rude" 는 TIER1_SANITIZE 범위 밖 → clean)
// → 5-Slot 사과문 정적 조립 후 AI_DONE (route='static', requiresApproval=false)
{
  const text = 'The art is beautiful but the staff was rude. Never coming back.'
  const d = processReview({ reviewText: text, ...ctxEN })
  check('C1 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  check('C1 route=static (smart gatekeeper Tier 1)', d.route === 'static', d.route)
  check('C1 isComplaint=true', d.classification.isComplaint === true)
  check('C1 isArtworkFocused=false (kill-switch)', d.classification.isArtworkFocused === false)
  check('C1 isChurnRisk=true', d.classification.isChurnRisk === true)
  check('C1 requiresApproval=false (AI_DONE)', d.requiresApproval === false)
  // kill-switch: 정적 답변도 ETERNAL 찬양 미포함
  const forced = buildStaticReply(d.classification, ctxEN)
  check('C1 kill-switch: no ETERNAL praise', !/ETERNAL/i.test(forced))
}

// ── Case 2: 안전사고 + 법적 → EMERGENCY → manual ────────────────────────────────
{
  const text = '어두워서 아이가 넘어졌어요. Sue you.'
  const d = processReview({ reviewText: text, ...ctxKO })
  check('C2 status=EMERGENCY', d.classification.status === 'EMERGENCY', d.classification.status)
  check('C2 route=manual', d.route === 'manual', d.route)
  check('C2 requiresApproval=true', d.requiresApproval === true)
  check('C2 dry apology (no ETERNAL)', d.staticReply != null && !/ETERNAL/i.test(d.staticReply))
}

// ── Case 3: 재방문(3rd) + 운영불만(zoo) → COMPLAINT + repeat visitor ──────────────
{
  const text = 'This is our 3rd time here, still feels like a zoo.'
  const d = processReview({ reviewText: text, ...ctxEN })
  check('C3 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  check('C3 isRepeatVisitor=true', d.classification.isRepeatVisitor === true)
  check('C3 tags has 운영불만', d.classification.tags.includes('운영불만'))
  check('C3 tags has repeat visitor', d.classification.tags.includes('repeat visitor'))
}

// ── Case 4: 이중부정 → 긍정 복구 → SAFE → static ────────────────────────────────
{
  const text = 'Definitely not a waste of money.'
  const d = processReview({ reviewText: text, ...ctxEN })
  check('C4 status=SAFE', d.classification.status === 'SAFE', d.classification.status)
  check('C4 route=static', d.route === 'static', d.route)
  check('C4 isComplaint=false (recovered)', d.classification.isComplaint === false)
}

// ── Case 5: 단순 긍정 → SAFE → static ────────────────────────────────────────────
{
  const d = processReview({ reviewText: '좋아요', ...ctxKO })
  check('C5 status=SAFE', d.classification.status === 'SAFE', d.classification.status)
  check('C5 route=static', d.route === 'static', d.route)
  check('C5 static reply non-empty', !!d.staticReply && d.staticReply.length > 0)
}

// ── Case 6: 단순 안전사고 → EMERGENCY → manual ──────────────────────────────────
{
  const d = processReview({ reviewText: '넘어졌어요', ...ctxKO })
  check('C6 status=EMERGENCY', d.classification.status === 'EMERGENCY', d.classification.status)
  check('C6 route=manual', d.route === 'manual', d.route)
}

// ── Case 7: 운영 불만 → COMPLAINT → static (스마트 게이트키퍼 Tier 1) ────────────
// "불친절" 은 TIER1_SANITIZE 범위 밖(정제된 한국어) → tier=1 clean → AI_DONE
{
  const d = processReview({ reviewText: '직원 불친절해요', ...ctxKO })
  check('C7 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  check('C7 route=static (smart gatekeeper Tier 1)', d.route === 'static', d.route)
  check('C7 requiresLLM=true (classification 필드 유지)', d.classification.requiresLLM === true)
  check('C7 requiresApproval=false (AI_DONE)', d.requiresApproval === false)
}

// ── Case 8: 모호한 질문 → AMBIGUOUS → 사람 승인 격리(+초안 제공) ───────────────────
//   평점도 내용 신호도 없는 단순 질문은 균형 답변이 어색하므로 manual(requiresApproval)로 격리하되
//   빈 화면 대신 편집 가능한 초안을 제공한다. (구: llm 위임 → 결정론적 초안 제공으로 변경)
{
  const d = processReview({ reviewText: '이게 예술인가요?', ...ctxKO })
  check('C8 status=AMBIGUOUS', d.classification.status === 'AMBIGUOUS', d.classification.status)
  check('C8 route=manual (격리)', d.route === 'manual', d.route)
  check('C8 requiresApproval', d.requiresApproval === true, String(d.requiresApproval))
  check('C8 초안 제공(빈 답변 아님)', !!d.staticReply && d.staticReply.length > 20, `len=${d.staticReply?.length ?? 0}`)
}

// ── Case 9: 작품 중심 긍정 → SAFE + 작품 자랑 미포함(no-artwork 정책) + 한국어 조사 ────
//   정책 변경: 지점마다 Garden 컨셉이 달라 특정 작품(ETERNAL NATURE/WATERFALL/STAR) 자랑은
//   안전하지 않음 → 칭찬 답변에서 작품명 언급을 일절 하지 않는다(사용자 지침). 분류는 그대로.
{
  const text = '작품이 너무 아름답고 몰입감이 최고였어요'
  const d = processReview({ reviewText: text, ...ctxKO })
  check('C9 status=SAFE', d.classification.status === 'SAFE', d.classification.status)
  check('C9 isArtworkFocused=true', d.classification.isArtworkFocused === true)
  check('C9 작품 자랑 미포함 (no ETERNAL/WATERFALL/STAR)', !!d.staticReply && !/ETERNAL NATURE|WATERFALL|STAR\b/.test(d.staticReply), d.staticReply?.slice(0, 120))
  // 신규 branchMetadata 시스템: AMGN branch_name = 'ARTE MUSEUM GANGNEUNG'
  check('C9 official name (no internal code)', !!d.staticReply && d.staticReply.includes('ARTE MUSEUM GANGNEUNG') && !d.staticReply.includes('AMGN'))
}

// ── Double-Check 금칙어 필터 ────────────────────────────────────────────────────
{
  check('FORBIDDEN: clean static reply passes', scanForbidden(processReview({ reviewText: '좋아요', ...ctxKO }).staticReply ?? '').clean === true)
  check('FORBIDDEN: detects refund promise', scanForbidden('전액 환불해 드리겠습니다').clean === false)
  check('FORBIDDEN: detects free ticket', scanForbidden('We will give you a free ticket and full refund.').clean === false)
  check('FORBIDDEN: all generated SAFE replies are clean', (() => {
    for (const lang of ['ko', 'en', 'ja', 'zh'] as const) {
      const r = buildStaticReply(analyzeReview('작품이 정말 아름다웠어요 좋아요'), { branchCode: 'AMDB', language: lang })
      if (!scanForbidden(r).clean) return false
    }
    return true
  })())
}

// ── Case 10: 'not worth it' 부정 처리 (이전 버그: 'worth it' 긍정 오인 복구) ──────
{
  const neg = processReview({ reviewText: 'Honestly not worth it.', ...ctxEN })
  check('C10 "not worth it" → COMPLAINT', neg.classification.status === 'COMPLAINT', neg.classification.status)
  const pos = processReview({ reviewText: 'Totally worth it!', ...ctxEN })
  check('C10 "worth it" → SAFE (회귀 방지)', pos.classification.status === 'SAFE', pos.classification.status)
}

// ── PHASE 3 (AMLV): 지리 오진단·복합 희석·Rating Override·하드웨어 결함 엣지 케이스 ──────
function pr(text: string, rating: number, lang: 'ko' | 'en') {
  return processReview({ reviewText: text, branchCode: 'AMLV', language: lang, reviewerName: null, rating }).classification
}
{
  // Case 1 — 영어 지리 오류 예외 (Strip ≠ trip): EMERGENCY 금지, SAFE/COMPLIMENT
  const c1 = pr('Perfect place to escape the heat and crowds on the Strip. Definitely worth checking out.', 5, 'en')
  check('P3-1 Strip NOT EMERGENCY', c1.status !== 'EMERGENCY', c1.status)
  check('P3-1 status SAFE|COMPLIMENT', c1.status === 'SAFE' || c1.status === 'COMPLIMENT', c1.status)
  // Case 2 — 한국어 이중부정(돈 아깝지 않음) + 고평점 → COMPLIMENT
  check('P3-2 COMPLIMENT', pr('입장료가 전혀 돈 아깝지 않음. 대만족.', 4, 'ko').status === 'COMPLIMENT')
  // Case 3 — 영어 관용구(Not bad) + 고평점 → COMPLIMENT
  check('P3-3 COMPLIMENT', pr('Not bad, highly immersive and cinematic rooms.', 4, 'en').status === 'COMPLIMENT')
  // Case 4 — 고평점 혼합문(사람 많음) → Rating Override → COMPLIMENT
  check('P3-4 COMPLIMENT (rating override)', pr('미쳤다 너무 예쁨. 약간 사람이 많긴 한데 공간 디자인 최고임.', 5, 'ko').status === 'COMPLIMENT')
  // Case 5 — 복합형 컴플레인 사수(저평점): LAYOUT_COMPLAINT 태그 + COMPLAINT
  const c5 = pr('동선이 조금 복잡해서 불편했어요. 커플 데이트로 추천합니다.', 2, 'ko')
  check('P3-5 LAYOUT_COMPLAINT tag', c5.tags.includes('LAYOUT_COMPLAINT'), c5.tags.join(','))
  check('P3-5 status COMPLAINT', c5.status === 'COMPLAINT', c5.status)
  // Case 6 — 하드웨어 장애 탐지: DISPLAY_ISSUE 태그
  const c6 = pr('Some projectors seemed blurry or out of sync.', 1, 'en')
  check('P3-6 DISPLAY_ISSUE tag', c6.tags.includes('DISPLAY_ISSUE'), c6.tags.join(','))
}

// ── SLOT ENGINE TDD: 슬롯 기반 조립 + AMLV 룰셋 보강 검증 ─────────────────────────
// Case S1: ★3 긍정+경미 불만(상호작용 부족) → 균형 답변(AMBIGUOUS), 과잉 사과 금지
//   "relaxing but not very interactive"는 호평(relaxing)+경미 피드백 → 그루블링 사과 대신 균형 인정.
//   (직원불만/이탈징후 같은 '심각' 불만은 여전히 COMPLAINT — S2 등에서 검증.)
{
  const text = 'The music and visuals were relaxing but not very interactive.'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'en', reviewerName: 'Jane', rating: 3 })
  check('S1 INTERACTIVE_COMPLAINT tag (감지 유지)', d.classification.tags.includes('INTERACTIVE_COMPLAINT'), d.classification.tags.join(','))
  check('S1 status=AMBIGUOUS (균형)', d.classification.status === 'AMBIGUOUS', d.classification.status)
  check('S1 isComplaint=false (사과 경로 아님)', d.classification.isComplaint === false)
  const reply = buildStaticReply(d.classification, { branchCode: 'AMLV', language: 'en', reviewerName: 'Jane', reviewId: 'test-s1' })
  check('S1 과잉 사과 없음 (no apolog/sorry)', !/apolog|sorry|sincerely/i.test(reply), reply.slice(0, 90))
}

// Case S2: VALUE_COMPLAINT (Rating 2) → 태그 감지 + COMPLAINT 경로
{
  const text = 'Expected more for the ticket price.'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'en', reviewerName: null, rating: 2 })
  check('S2 VALUE_COMPLAINT tag', d.classification.tags.includes('VALUE_COMPLAINT'), d.classification.tags.join(','))
  check('S2 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  const reply = buildStaticReply(d.classification, { branchCode: 'AMLV', language: 'en', reviewId: 'test-s2' })
  check('S2 Slot B: price/content keyword', /price|value|ticket|content/i.test(reply), reply.slice(0, 80))
}

// Case S3: CROWD_COMPLAINT + Rating-1/2 노이즈 필터 (긍정 접미 무시)
{
  const text = 'The exhibit was overcrowded and difficult to enjoy. Definitely worth checking out.'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'en', reviewerName: null, rating: 1 })
  check('S3 CROWD_COMPLAINT tag', d.classification.tags.includes('CROWD_COMPLAINT'), d.classification.tags.join(','))
  check('S3 status=COMPLAINT (positive suffix ignored)', d.classification.status === 'COMPLAINT', d.classification.status)
  check('S3 isComplaint=true', d.classification.isComplaint === true)
  // Rating-1/2 노이즈 필터 명시 검증: 동일 텍스트 rating 4 → COMPLIMENT, rating 1 → AMBIGUOUS (complaint 없을 때)
  const noiseOnly = 'Definitely worth checking out.'
  const hiRating = processReview({ reviewText: noiseOnly, branchCode: 'AMLV', language: 'en', rating: 4 })
  check('S3b noise pattern @ rating-4 → COMPLIMENT', hiRating.classification.status === 'COMPLIMENT', hiRating.classification.status)
  const loRating = processReview({ reviewText: noiseOnly, branchCode: 'AMLV', language: 'en', rating: 1 })
  check('S3b noise filter @ rating-1 → AMBIGUOUS', loRating.classification.status === 'AMBIGUOUS', loRating.classification.status)
}

// ── PHASE 2: 동적 컴파일 경로 검증 (인메모리 번들 — env/DB 불필요, 결정론적) ──────
// DB에서 받은 것과 동일한 형태의 규칙으로 applyRulesBundle → analyzeReview가 DB 규칙으로 동작하는지.
{
  const seeded: AutomationRule[] = [
    { id: 'e',  category: 'EMERGENCY',  language: 'ko',  keywords: ['넘어졌'],               regex_pattern: null, is_active: true, priority: 0 },
    { id: 'c1', category: 'COMPLAINT',  language: 'en',  keywords: ['rude', 'zoo', 'not worth'], regex_pattern: null, is_active: true, priority: 100 },
    { id: 'c2', category: 'COMPLAINT',  language: 'ko',  keywords: ['불친절', '최악'],          regex_pattern: null, is_active: true, priority: 100 },
    { id: 's',  category: 'SARCASM',    language: 'any', keywords: [], regex_pattern: '(나쁘지\\s*않)|(not\\s*a\\s*waste|not\\s*too\\s*bad)', is_active: true, priority: 90 },
    { id: 'p1', category: 'POSITIVE',   language: 'ko',  keywords: ['좋', '최고', '아름답'],    regex_pattern: null, is_active: true, priority: 100 },
    { id: 'p2', category: 'POSITIVE',   language: 'en',  keywords: ['beautiful', 'worth it'],   regex_pattern: null, is_active: true, priority: 100 },
    { id: 'q',  category: 'QUESTION',   language: 'any', keywords: [], regex_pattern: '[?？]|인가요', is_active: true, priority: 100 },
    { id: 'a',  category: 'ARTWORK',    language: 'any', keywords: [], regex_pattern: '작품|예술|\\bart\\b', is_active: true, priority: 100 },
    { id: 'r',  category: 'REPEAT',     language: 'any', keywords: [], regex_pattern: '3rd\\s*time|두\\s*번째', is_active: true, priority: 100 },
    { id: 'ch', category: 'CHURN',      language: 'any', keywords: [], regex_pattern: 'never\\s*com|다시는\\s*안', is_active: true, priority: 100 },
  ]
  applyRulesBundle({ rules: seeded, templates: [], loadedAt: 1, version: 1 })
  check('DB-compile applied (not DEFAULTS)', isUsingDefaults() === false)
  check('compile COMPLAINT (rude)',       processReview({ reviewText: 'the staff was rude', ...ctxEN }).classification.status === 'COMPLAINT')
  check('compile EMERGENCY additive (넘어졌)', processReview({ reviewText: '아이가 넘어졌어요', ...ctxKO }).classification.status === 'EMERGENCY')
  check('compile EMERGENCY IMMUTABLE (sue via hardcoded base, not in DB)', processReview({ reviewText: 'I will sue you', ...ctxEN }).classification.status === 'EMERGENCY')
  check('compile SAFE (좋아요)',          processReview({ reviewText: '좋아요', ...ctxKO }).classification.status === 'SAFE')
  check('compile AMBIGUOUS (예술인가요?)', processReview({ reviewText: '이게 예술인가요?', ...ctxKO }).classification.status === 'AMBIGUOUS')
  check('compile not-worth-it COMPLAINT', processReview({ reviewText: 'Honestly not worth it.', ...ctxEN }).classification.status === 'COMPLAINT')
  applyRulesBundle(null) // DEFAULTS 복귀
  check('reset to DEFAULTS', isUsingDefaults() === true)
}

// ── S4: AMNY Branch Token 치환 + no-artwork 정책 검증 ───────────────────────────
// buildStaticReply가 {branch_name}→"ARTE MUSEUM NEW YORK"로 치환하고, 미치환 토큰 `{...}` 잔존이
// 없으며, 칭찬 답변에 특정 작품 자랑(ETERNAL/WATERFALL/STAR)이 들어가지 않음을 확인(no-artwork 정책).
{
  // 작품 언급 칭찬이라도 작품명을 자랑하지 않는다(지점별 Garden 컨셉 상이 → 안전).
  const artCls = { ...analyzeReview('The whole exhibition was absolutely breathtaking and I loved every installation here!', 5), isComplaint: false, isEmergency: false }
  const replyEN = buildStaticReply(
    artCls,
    { branchCode: 'AMNY', language: 'en', reviewerName: null, reviewId: 'amny-test-001' }
  )
  check('S4 AMNY branch_name in EN reply', replyEN.includes('ARTE MUSEUM NEW YORK'), replyEN.slice(0, 120))
  check('S4 칭찬에 작품 자랑 미포함 (no ETERNAL/WATERFALL/STAR)', !/ETERNAL NATURE|WATERFALL|STAR\b/i.test(replyEN), replyEN.slice(0, 120))
  check('S4 no unresolved {placeholder} in EN reply', !/\{[a-z_]+\}/.test(replyEN), 'unresolved token found in reply')

  const cmpCls = analyzeReview('The staff was rude and ignored us. Very disappointed.', 2)
  const replyKO = buildStaticReply(
    cmpCls,
    { branchCode: 'AMNY', language: 'ko', reviewerName: null, reviewId: 'amny-test-002' }
  )
  check('S4 AMNY branch_name in KO complaint reply', replyKO.includes('ARTE MUSEUM NEW YORK'), replyKO.slice(0, 120))
  check('S4 no unresolved {placeholder} in KO reply', !/\{[a-z_]+\}/.test(replyKO), 'unresolved token found in reply')
}

// ── S5: ROOM_SPECIFIC_COMPLAINT 태그 감지 + Slot C highlight_room 바인딩 ─────────
{
  const textKO = '특정 구역이 너무 좁아서 불편했어요.'
  const dKO = analyzeReview(textKO)
  check('S5 KO ROOM_SPECIFIC_COMPLAINT tag', dKO.tags.includes('ROOM_SPECIFIC_COMPLAINT'), dKO.tags.join(','))
  check('S5 KO isComplaint=true', dKO.isComplaint === true)

  const textEN = 'This room was terrible and really cramped.'
  const dEN = analyzeReview(textEN)
  check('S5 EN ROOM_SPECIFIC_COMPLAINT tag', dEN.tags.includes('ROOM_SPECIFIC_COMPLAINT'), dEN.tags.join(','))

  const reply = buildStaticReply(dEN, { branchCode: 'AMNY', language: 'en', reviewId: 'test-s5' })
  check('S5 Slot C: area/space/gallery keyword', /area|space|gallery|WAVE|room|zone/i.test(reply), reply.slice(0, 120))
  check('S5 no unresolved {placeholder}', !/\{[a-z_]+\}/.test(reply), 'unresolved token in reply')
}

// ── S6: SYSTEM_COMPLAINT 태그 감지 + Slot C 기술 조치 약속 ────────────────────────
{
  const textEN = 'The kiosk froze and crashed twice. Totally unusable.'
  const dEN = analyzeReview(textEN)
  check('S6 EN SYSTEM_COMPLAINT tag', dEN.tags.includes('SYSTEM_COMPLAINT'), dEN.tags.join(','))
  check('S6 EN isComplaint=true', dEN.isComplaint === true)

  const textKO = '키오스크 오류가 계속 발생해서 입장이 지연됐어요.'
  const dKO = analyzeReview(textKO)
  check('S6 KO SYSTEM_COMPLAINT tag', dKO.tags.includes('SYSTEM_COMPLAINT'), dKO.tags.join(','))

  const reply = buildStaticReply(dEN, { branchCode: 'AMLV', language: 'en', reviewId: 'test-s6' })
  check('S6 Slot C: kiosk/system/technical keyword', /kiosk|system|technical|booking|app/i.test(reply), reply.slice(0, 120))
}

// ── S7: REVISIT_COMPLAINT 태그 감지 + Slot C 시즌 콘텐츠 리프레시 안내 ─────────────
{
  const textEN = 'I visited before and used to be amazing, disappointed this time.'
  const dEN = analyzeReview(textEN)
  check('S7 EN REVISIT_COMPLAINT tag', dEN.tags.includes('REVISIT_COMPLAINT'), dEN.tags.join(','))
  check('S7 EN isComplaint=true', dEN.isComplaint === true)

  const textKO = '예전에는 훨씬 좋았는데 이번엔 많이 아쉬웠어요.'
  const dKO = analyzeReview(textKO)
  check('S7 KO REVISIT_COMPLAINT tag', dKO.tags.includes('REVISIT_COMPLAINT'), dKO.tags.join(','))

  const reply = buildStaticReply(dEN, { branchCode: 'AMDB', language: 'en', reviewId: 'test-s7' })
  check('S7 Slot C: seasonal/content/new keyword', /season|content|new|return|visit/i.test(reply), reply.slice(0, 120))
}

// ── S8: STAFF_COMPLAINT 태그 감지 + Slot C 직원 교육 개선 약속 ────────────────────
{
  const textEN = 'The staff had a very rude attitude and ignored our questions entirely.'
  const dEN = analyzeReview(textEN)
  check('S8 EN STAFF_COMPLAINT tag', dEN.tags.includes('STAFF_COMPLAINT'), dEN.tags.join(','))
  check('S8 EN isComplaint=true', dEN.isComplaint === true)
  const replyEN = buildStaticReply(dEN, { branchCode: 'AMNY', language: 'en', reviewId: 'test-s8-en' })
  check('S8 EN Slot C: staff/training/service keyword', /staff|training|CS|service|manager/i.test(replyEN), replyEN.slice(0, 120))

  const textKO = '직원 태도가 너무 불친절하고 인사도 안 해서 기분이 나빴어요.'
  const dKO = analyzeReview(textKO)
  check('S8 KO STAFF_COMPLAINT tag', dKO.tags.includes('STAFF_COMPLAINT'), dKO.tags.join(','))
  const replyKO = buildStaticReply(dKO, { branchCode: 'AMNY', language: 'ko', reviewId: 'test-s8-ko' })
  check('S8 KO Slot C: 직원/교육/CS keyword', /직원|교육|CS|서비스|매니저/.test(replyKO), replyKO.slice(0, 120))
  check('S8 KO no unresolved {placeholder}', !/\{[a-z_]+\}/.test(replyKO), 'unresolved token in KO reply')
}

// ── S8b: ACCESSIBILITY_COMPLAINT (Wave 23) — 휠체어/유모차/경사로 접근성 + 긍정 오탐 방지 ──
{
  const dKO = analyzeReview('휠체어를 탄 어머니와 갔는데 경사로가 없어서 너무 불편했어요.')
  check('S8b KO ACCESSIBILITY tag', dKO.tags.includes('ACCESSIBILITY_COMPLAINT'), dKO.tags.join(','))
  check('S8b KO isComplaint=true', dKO.isComplaint === true)
  const replyKO = buildStaticReply(dKO, { branchCode: 'AMNY', language: 'ko', reviewId: 'test-s8b-ko' })
  check('S8b KO Slot C: 접근성/경사로/엘리베이터 keyword', /접근성|경사로|엘리베이터|동선|편의/.test(replyKO), replyKO.slice(0, 120))
  const dEN = analyzeReview('Brought my dad in a wheelchair — there was no ramp and it was very difficult.')
  check('S8b EN ACCESSIBILITY tag', dEN.tags.includes('ACCESSIBILITY_COMPLAINT'), dEN.tags.join(','))
  // 긍정 오탐 방지: "휠체어 접근성이 좋았다"는 불만 아님
  const dPos = analyzeReview('휠체어 접근성이 정말 좋아서 어머니도 편하게 관람했어요!', 5)
  check('S8b 긍정 오탐 없음(접근성 칭찬)', !dPos.tags.includes('ACCESSIBILITY_COMPLAINT'), dPos.tags.join(','))
}

// ── S8c: LANGUAGE_SERVICE_COMPLAINT (Wave 23) — 외국어 안내 부재 + 긍정 오탐 방지 ──
{
  const dZH = analyzeReview('没有中文讲解，工作人员也不会说中文。')
  check('S8c ZH LANGUAGE_SERVICE tag', dZH.tags.includes('LANGUAGE_SERVICE_COMPLAINT'), dZH.tags.join(','))
  const dJA = analyzeReview('英語の案内が全くなくて困りました。')
  check('S8c JA LANGUAGE_SERVICE tag', dJA.tags.includes('LANGUAGE_SERVICE_COMPLAINT'), dJA.tags.join(','))
  const replyZH = buildStaticReply(dZH, { branchCode: 'AMNY', language: 'zh', reviewId: 'test-s8c-zh' })
  check('S8c ZH Slot C: 多语种/外语/讲解 keyword', /多语种|外语|讲解|字幕|指引/.test(replyZH), replyZH.slice(0, 120))
  // 긍정 오탐 방지: "영어 안내가 잘 돼 있었다"는 불만 아님
  const dPos = analyzeReview('영어 안내가 잘 되어 있어서 외국인 친구도 편했어요.', 5)
  check('S8c 긍정 오탐 없음(언어안내 칭찬)', !dPos.tags.includes('LANGUAGE_SERVICE_COMPLAINT'), dPos.tags.join(','))
}

// ════════════════════════════════════════════════════════════════════════════════
//  CSV 엣지케이스 TDD — 실제 arte_reviews_2026-06-09.csv 분석 기반 신규 케이스
// ════════════════════════════════════════════════════════════════════════════════

// ── S9: 1★ + 필러 추천 꼬리 → SAFE 오분류 방지 (Rating Override + FILLER_PATTERN) ──
// CSV row 8 재현: rating=1, "기대한 만큼은 아니었습니다. 커플 데이트로 추천합니다."
{
  const text = '기대한 만큼은 아니었습니다. 커플 데이트로 추천합니다.'
  const d = analyzeReview(text, 1)
  check('S9 1★+필러추천 → NOT SAFE', d.status !== 'SAFE', d.status)
  check('S9 1★+필러추천 → COMPLAINT or AMBIGUOUS', d.status === 'COMPLAINT' || d.status === 'AMBIGUOUS', d.status)
  check('S9 1★+필러추천 → isComplaint or requiresLLM', d.isComplaint || d.requiresLLM, `isComplaint=${d.isComplaint}, requiresLLM=${d.requiresLLM}`)
  check('S9 저평점_부정신호 tag 존재', d.tags.includes('저평점_부정신호'), d.tags.join(','))
}

// ── S10: 2★ + 줄/대기 불만 → COMPLAINT (DEFAULT_CROWD 한국어 확장) ──────────────
// CSV row 4 재현: rating=2, "입장 대기가 길어서 조금 지쳤네요. 커플 데이트로 추천합니다."
{
  const text = '입장 대기가 길어서 조금 지쳤네요. 커플 데이트로 추천합니다.'
  const d = analyzeReview(text, 2)
  check('S10 2★+대기불만 → COMPLAINT', d.status === 'COMPLAINT', d.status)
  check('S10 CROWD_COMPLAINT tag', d.tags.includes('CROWD_COMPLAINT'), d.tags.join(','))
  check('S10 isComplaint=true', d.isComplaint === true)
}

// ── S11: 2★ + 가격 아쉬움 + 긍정("사진 좋아요") = 혼합 → 균형(AMBIGUOUS), 과한 사과 금지 ──
// 톤 정책: ★2라도 좋은 점을 함께 말한 혼합 리뷰엔 4블록 그루블링 사과 대신 가벼운 균형 답변.
// VALUE_COMPLAINT 태그는 그대로 감지하되, 라우팅은 균형으로(과잉 사과 방지). 순수 부정 ★2는 COMPLAINT 유지.
{
  const text = '가격 대비 만족도는 좀 아쉬웠어요. 사진 찍기에도 좋아요.'
  const d = analyzeReview(text, 2)
  check('S11 VALUE_COMPLAINT tag (감지 유지)', d.tags.includes('VALUE_COMPLAINT'), d.tags.join(','))
  check('S11 혼합 ★2 → AMBIGUOUS(균형)', d.status === 'AMBIGUOUS', d.status)
  check('S11 isComplaint=false (사과 경로 아님)', d.isComplaint === false)
  // 순수 부정 ★2(긍정 없음)는 여전히 COMPLAINT
  const pure = analyzeReview('가격 대비 너무 별로였어요. 다신 안 가요.', 2)
  check('S11 순수부정 ★2 → COMPLAINT', pure.status === 'COMPLAINT', pure.status)
}

// ── S12: 한국어 hasPeakHours 탐지 ──────────────────────────────────────────────
{
  const textKO1 = '평일에 가면 더 좋을 것 같네요. 주말은 사람이 너무 많았어요.'
  const d1 = analyzeReview(textKO1)
  check('S12-a KO 평일/주말언급 → hasPeakHours=true', d1.hasPeakHours === true, `hasPeakHours=${d1.hasPeakHours}`)

  const textKO2 = '주말에는 사람이 많아서 혼잡했어요. 다음엔 평일에 방문하면 좋을 것 같아요.'
  const d2 = analyzeReview(textKO2)
  check('S12-b KO 혼잡+평일언급 → hasPeakHours=true', d2.hasPeakHours === true, `hasPeakHours=${d2.hasPeakHours}`)
  check('S12-b KO CROWD_COMPLAINT tag', d2.tags.includes('CROWD_COMPLAINT'), d2.tags.join(','))
}

// ── S13: 5★ + 힐링 → COMPLIMENT + contextMirror='힐링' ─────────────────────────
{
  const text = '분위기가 너무 좋아서 힐링 제대로 했습니다. 완전 추천해요!'
  const d = analyzeReview(text, 5)
  check('S13 5★+힐링 → COMPLIMENT', d.status === 'COMPLIMENT', d.status)
  check('S13 contextMirror=힐링', d.contextMirror === '힐링', `contextMirror=${d.contextMirror}`)
  // 슬롯 B/E에서 맥락 거울 반영 확인
  const reply = buildStaticReply(d, { branchCode: 'AMLV', language: 'ko', reviewId: 'test-s13' })
  check('S13 reply: 힐링 언급', /힐링/.test(reply), reply.slice(0, 200))
  check('S13 no unresolved {placeholder}', !/\{[a-z_]+\}/.test(reply), 'unresolved token')
}

// ── S14: 4★ + 데이트 맥락 → contextMirror='데이트' + 답변에 데이트 반영 ──────────
{
  const text = '남자친구랑 데이트로 왔는데 정말 좋았어요!'
  const d = analyzeReview(text, 4)
  check('S14 4★+데이트 → COMPLIMENT', d.status === 'COMPLIMENT', d.status)
  check('S14 contextMirror=데이트', d.contextMirror === '데이트', `contextMirror=${d.contextMirror}`)
  const reply = buildStaticReply(d, { branchCode: 'AMLV', language: 'ko', reviewId: 'test-s14' })
  check('S14 reply: 데이트 언급', /데이트/.test(reply), reply.slice(0, 200))
}

// ── S15: 3★ + "괜찮았어요" → SAFE (DEFAULT_POSITIVE에 괜찮 추가 확인) ────────────
{
  const text = '전체적으로 괜찮았어요.'
  const d = analyzeReview(text, 3)
  check('S15 3★+괜찮 → SAFE (not AMBIGUOUS)', d.status === 'SAFE', d.status)
}

// ── S16: SHORT 모드 검증 — 단순 SAFE 긍정 리뷰 → 3슬롯(A+B+E), Slot C 생략 ─────
// 평점 없음 = SAFE(not COMPLIMENT) → SHORT 모드 활성화
{
  const text = '좋았어요!'
  const d = analyzeReview(text)  // 평점 없음 → SAFE (SHORT 모드 대상)
  check('S16 단순긍정(무평점) → SAFE', d.status === 'SAFE', d.status)
  check('S16 isArtworkFocused=false', d.isArtworkFocused === false)
  check('S16 hasPeakHours=false', d.hasPeakHours === false)
  check('S16 contextMirror=null (단순긍정)', d.contextMirror == null, `mirror=${d.contextMirror}`)
  // SHORT 모드(SAFE + 작품미언급 + 피크미언급 + 거울없음): Slot C 없음 → highlight_room 미포함
  const reply = buildStaticReply(d, { branchCode: 'AMLV', language: 'ko', reviewId: 'test-s16' })
  check('S16 SHORT모드: highlight_room 미포함', !/{highlight_room}/.test(reply), reply.slice(0, 200))
  check('S16 no unresolved {placeholder}', !/\{[a-z_]+\}/.test(reply), 'unresolved token')
}

// ════════════════════════════════════════════════════════════════════════════════
//  RISK ROUTING TDD — 3-Tier 리스크 사전 + 스마트 게이트키퍼 통합 검증
// ════════════════════════════════════════════════════════════════════════════════

import { sanitizeAndScoreRisk } from '@/lib/synonymEngine'

// ── S17: Case A — 복합 불만 + Tier 1 순화 → STAFF_COMPLAINT 메인 + AI_DONE ────
// "돈 ㅈㄴ 아깝네 사람 개많고 직원 싸가지없음" (1점)
// 기대: STAFF_COMPLAINT(최고우선) 메인, 직원서비스로 순화, route=static, requiresApproval=false
{
  const text = '돈 ㅈㄴ 아깝네 사람 개많고 직원 싸가지없음'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'ko', rating: 1 })
  check('S17 복합불만 STAFF_COMPLAINT tag', d.classification.tags.includes('STAFF_COMPLAINT'), d.classification.tags.join(','))
  check('S17 복합불만 CROWD_COMPLAINT tag', d.classification.tags.includes('CROWD_COMPLAINT'), d.classification.tags.join(','))
  check('S17 primaryIntent=STAFF_COMPLAINT (우선순위 1위)', d.primaryIntent === 'STAFF_COMPLAINT', `primaryIntent=${d.primaryIntent}`)
  check('S17 Tier1 순화: 직원 서비스 포함', (d.sanitizedText ?? '').includes('직원 서비스'), `sanitized="${d.sanitizedText}"`)
  check('S17 Tier1 순화: 혼잡한 관람 환경 포함', (d.sanitizedText ?? '').includes('혼잡한 관람 환경'), `sanitized="${d.sanitizedText}"`)
  check('S17 route=static (AI_DONE)', d.route === 'static', `route=${d.route}`)
  check('S17 requiresApproval=false (AI_DONE)', d.requiresApproval === false)
  check('S17 riskTier=1', d.riskTier === 1, `riskTier=${d.riskTier}`)
  // sanitizeAndScoreRisk 단독 검증
  const risk = sanitizeAndScoreRisk(text)
  check('S17 sanitizer tier=1', risk.tier === 1, `tier=${risk.tier}`)
  check('S17 sanitizer STAFF_SLANG flag', risk.flags.includes('STAFF_SLANG'), risk.flags.join(','))
  check('S17 sanitizer CROWD_SLANG flag', risk.flags.includes('CROWD_SLANG'), risk.flags.join(','))
}

// ── S18: Case B — 부상 + 환불 → EMERGENCY → PENDING_APPROVAL ─────────────────
// "애가 뛰다가 다쳤는데 환불도 안해주고 최악" (1점)
// 기대: waterfallEngine이 EMERGENCY(다쳤+환불) 탐지 → route=manual, requiresApproval=true
{
  const text = '애가 뛰다가 다쳤는데 환불도 안해주고 최악'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'ko', rating: 1 })
  check('S18 부상+환불 → EMERGENCY (waterfallEngine Layer 0)', d.classification.status === 'EMERGENCY', d.classification.status)
  check('S18 route=manual (PENDING_APPROVAL)', d.route === 'manual', `route=${d.route}`)
  check('S18 requiresApproval=true (high risk)', d.requiresApproval === true)
  check('S18 staticReply exists (건조 사과 초안)', d.staticReply != null && d.staticReply.length > 0)
  check('S18 staticReply no ETERNAL praise', !/ETERNAL/i.test(d.staticReply ?? ''))
  // Tier 2 sanitizer 백업 검증 — waterfallEngine이 놓치더라도 sanitizer가 포착
  const risk = sanitizeAndScoreRisk(text)
  check('S18 sanitizer tier=2 (CRITICAL_RISK 백업)', risk.tier === 2, `tier=${risk.tier}`)
  check('S18 sanitizer CRITICAL_RISK flag', risk.flags.includes('CRITICAL_RISK'), risk.flags.join(','))
}

// ── S19: Case C — Tier 3 미지 욕설 → PENDING_APPROVAL + fallback 치환 ─────────
// 딕셔너리 미등록 특수기호 혼합 욕설 → Tier 3 탐지 → fallback 덮어쓰기
{
  const text = 'ㅅㅂ ㄲㅈ 이딴 전시가 뭐야 다신안온다'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'ko', rating: 1 })
  check('S19 Tier3 riskTier=3', d.riskTier === 3, `riskTier=${d.riskTier}`)
  check('S19 Tier3 sanitizedText=fallback 텍스트', (d.sanitizedText ?? '') === '말씀해주신 관람 불편 사항', `sanitized="${d.sanitizedText}"`)
  check('S19 Tier3 route=manual (PENDING_APPROVAL)', d.route === 'manual', `route=${d.route}`)
  check('S19 Tier3 requiresApproval=true', d.requiresApproval === true)
  // sanitizeAndScoreRisk 단독 검증
  const risk = sanitizeAndScoreRisk(text)
  check('S19 sanitizer tier=3', risk.tier === 3, `tier=${risk.tier}`)
  check('S19 sanitizer UNKNOWN_TOXIC flag', risk.flags.includes('UNKNOWN_TOXIC'), risk.flags.join(','))
  check('S19 sanitizer fallback replacement', risk.replacements.length > 0 && risk.replacements[0].replacement === '말씀해주신 관람 불편 사항')
}

// ── S20: 실제 수집 파이프라인 입력단 — 9개 언어 감지 + rating 정규화 ─────────────
// 외부(Google 등) Raw 데이터가 syncReviews 헬퍼를 거쳐 올바른 언어/별점으로 적재되는지 검증.
{
  const langCases: Array<[string, string]> = [
    ['빛이 가득한 공간 최고였어요', 'ko'],
    ['素晴らしい光の演出でした', 'ja'],
    ['灯光效果非常美丽', 'zh'],
    ['Световые инсталляции потрясающие', 'ru'],
    ['الإضاءة كانت ساحرة', 'ar'],
    ['रोशनी बहुत सुंदर थी', 'hi'],
    ['Las luces son increíbles, gracias', 'es'],
    ['Napakaganda ng ilaw, salamat talaga', 'tl'],
    ['The light installations were stunning', 'en'],
  ]
  for (const [txt, exp] of langCases) {
    check(`S20 detectLang ${exp}`, detectReviewLanguage(txt) === exp, `got=${detectReviewLanguage(txt)}`)
  }
  check('S20 detectLang empty→null', detectReviewLanguage('') === null)
  check('S20 detectLang null→null', detectReviewLanguage(null) === null)
  // rating 정규화: 누락/문자열/범위초과 방어
  check('S20 rating FIVE→5', starRatingToNumber('FIVE') === 5)
  check('S20 rating missing→null', starRatingToNumber(undefined) === null)
  check('S20 rating junk→null', starRatingToNumber('STAR_RATING_UNSPECIFIED') === null)
}

// ── S21: Auto-Promotion — 승격된 신규 토픽(FACILITY_AC) 인식 + 9개 언어 인정 조각 ─────
// 데이터 발견 엔진이 사람 승인으로 promotedPatterns에 병합한 패턴이 엔진에 반영되는지 검증.
{
  const dKO = processReview({ reviewText: '에어컨이 너무 세서 실내가 추웠어요. 온도 조절이 필요합니다.', branchCode: 'AMLV', language: 'ko', rating: 2 })
  check('S21 promoted FACILITY_AC tag', dKO.classification.tags.includes('FACILITY_AC_COMPLAINT'), dKO.classification.tags.join(','))
  check('S21 promoted → COMPLAINT 정적 자동완료', dKO.route === 'static' && !dKO.requiresApproval, `route=${dKO.route} approval=${dKO.requiresApproval}`)
  check('S21 promoted KO 냉방 조각 반영', /냉방|온도/.test(dKO.staticReply ?? ''), (dKO.staticReply ?? '').slice(0, 50))
  const dEN = processReview({ reviewText: 'It was freezing inside, the air conditioning was way too strong.', branchCode: 'AMNY', language: 'en', rating: 2 })
  check('S21 promoted EN climate 조각 반영', /climate|temperature/i.test(dEN.staticReply ?? ''), (dEN.staticReply ?? '').slice(0, 50))
  // 안전: 승격 패턴이 EMERGENCY를 우회하지 않음 (환불요구 → 여전히 EMERGENCY 격리)
  const dEmg = processReview({ reviewText: '에어컨도 고장났고 환불 요구합니다. 변호사와 상담하겠습니다.', branchCode: 'AMLV', language: 'ko', rating: 1 })
  check('S21 승격이 EMERGENCY 우회 안 함', dEmg.classification.status === 'EMERGENCY' && dEmg.requiresApproval, `status=${dEmg.classification.status}`)
}

console.log(`\n${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)

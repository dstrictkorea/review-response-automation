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

let failures = 0
function check(name: string, cond: boolean, extra = '') {
  const tag = cond ? 'PASS' : 'FAIL'
  if (!cond) failures++
  console.log(`[${tag}] ${name}${extra ? `  — ${extra}` : ''}`)
}

const ctxEN = { branchCode: 'AMLV', language: 'en' as const, reviewerName: 'John' }
const ctxKO = { branchCode: 'AMGN', language: 'ko' as const, reviewerName: '민수' }

// ── Case 1: 작품 칭찬 + 직원 불만 + 이탈 → COMPLAINT, 작품찬양 차단 ──────────────
{
  const text = 'The art is beautiful but the staff was rude. Never coming back.'
  const d = processReview({ reviewText: text, ...ctxEN })
  check('C1 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  check('C1 route=llm', d.route === 'llm', d.route)
  check('C1 isComplaint=true', d.classification.isComplaint === true)
  check('C1 isArtworkFocused=false (kill-switch)', d.classification.isArtworkFocused === false)
  check('C1 isChurnRisk=true', d.classification.isChurnRisk === true)
  // kill-switch: 강제로 정적 답변을 만들어도 ETERNAL 찬양 미포함
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

// ── Case 7: 운영 불만 → COMPLAINT → llm ─────────────────────────────────────────
{
  const d = processReview({ reviewText: '직원 불친절해요', ...ctxKO })
  check('C7 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  check('C7 route=llm', d.route === 'llm', d.route)
  check('C7 requiresLLM=true', d.classification.requiresLLM === true)
}

// ── Case 8: 모호한 질문 → AMBIGUOUS → llm ───────────────────────────────────────
{
  const d = processReview({ reviewText: '이게 예술인가요?', ...ctxKO })
  check('C8 status=AMBIGUOUS', d.classification.status === 'AMBIGUOUS', d.classification.status)
  check('C8 route=llm', d.route === 'llm', d.route)
}

// ── Case 9: 작품 중심 긍정 → SAFE + ETERNAL NATURE 조립 + 한국어 조사 ────────────
{
  const text = '작품이 너무 아름답고 몰입감이 최고였어요'
  const d = processReview({ reviewText: text, ...ctxKO })
  check('C9 status=SAFE', d.classification.status === 'SAFE', d.classification.status)
  check('C9 isArtworkFocused=true', d.classification.isArtworkFocused === true)
  check('C9 static reply includes ETERNAL NATURE', !!d.staticReply && /ETERNAL NATURE/.test(d.staticReply))
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
// Case S1: INTERACTIVE_COMPLAINT (Rating 3) → 태그 감지 + Slot B 피벗 포함
{
  const text = 'The music and visuals were relaxing but not very interactive.'
  const d = processReview({ reviewText: text, branchCode: 'AMLV', language: 'en', reviewerName: 'Jane', rating: 3 })
  check('S1 INTERACTIVE_COMPLAINT tag', d.classification.tags.includes('INTERACTIVE_COMPLAINT'), d.classification.tags.join(','))
  check('S1 status=COMPLAINT', d.classification.status === 'COMPLAINT', d.classification.status)
  check('S1 isComplaint=true', d.classification.isComplaint === true)
  const reply = buildStaticReply(d.classification, { branchCode: 'AMLV', language: 'en', reviewerName: 'Jane', reviewId: 'test-s1' })
  check('S1 Slot B: interactive/sensor keyword', /interact|sensor/i.test(reply), reply.slice(0, 80))
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

// ── S4: AMNY Branch Token 치환 검증 ─────────────────────────────────────────────
// buildStaticReply가 {branch_name}→"ARTE MUSEUM NEW YORK", {highlight_room}→"WAVE / WHALE"로
// 치환하는지 확인. 미치환 토큰 `{...}` 잔존 금지.
{
  // "exhibition" triggers isArtworkFocused → slotC_artwork (STAR, not highlight_room).
  // Use artwork-free text so slotC_general (with {highlight_room}) is selected.
  const safeCls = { ...analyzeReview('Beautiful place! The whole experience was stunning and I loved every moment.', 5), isComplaint: false, isEmergency: false }
  const replyEN = buildStaticReply(
    safeCls,
    { branchCode: 'AMNY', language: 'en', reviewerName: null, reviewId: 'amny-test-001' }
  )
  check('S4 AMNY branch_name in EN reply', replyEN.includes('ARTE MUSEUM NEW YORK'), replyEN.slice(0, 120))
  check('S4 AMNY {highlight_room}→WAVE/WHALE in EN reply', /WAVE\s*\/\s*WHALE|WAVE/i.test(replyEN), replyEN.slice(0, 120))
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

console.log(`\n${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)

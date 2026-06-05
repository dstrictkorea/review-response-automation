/**
 * validate-waterfall.ts — PHASE 5 결정론적 엔진 자체 검증 (TDD)
 *
 * 실행: npx tsx scripts/validate-waterfall.ts
 * 모든 케이스 통과 시 exit 0, 하나라도 실패 시 exit 1.
 */

import { processReview } from '@/lib/reviewProcessor'
import { analyzeReview, scanForbidden } from '@/lib/waterfallRegexEngine'
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
  check('C9 official name (no internal code)', !!d.staticReply && d.staticReply.includes('ARTE MUSEUM 강릉') && !d.staticReply.includes('AMGN'))
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

console.log(`\n${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)

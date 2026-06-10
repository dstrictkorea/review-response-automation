/**
 * analyze-reply-quality.ts
 * CSV 리뷰 전체를 processReview()에 통과시켜 생성된 답변 품질을 분석한다.
 * 실행: npx tsx scripts/analyze-reply-quality.ts
 */
import path from 'path'
import { processReview } from '../src/lib/reviewProcessor'

// ── CSV 데이터 (정적 임베드) ────────────────────────────────────────────────
const RAW_REVIEWS = [
  { rating: 5, review_text: '작품들은 정말 황홀하고 향기도 좋았습니다. 다만 사람이 너무 많아서 오롯이 감상하기보다는 사진 찍기 바빴던 점이 조금 아쉽네요.', reviewer_name: '이지훈', location: 'AMLV', lang: 'ko', date: '2026-05-01' },
  { rating: 4, review_text: 'The Waterfall zone is absolutely mesmerizing. It gets a bit cold inside because of the AC, but the art is worth it.', reviewer_name: 'Sarah Jenkins', location: 'AMDB', lang: 'en', date: '2026-05-01' },
  { rating: 3, review_text: '뉴욕 한복판에서 즐기는 미디어 아트는 신선했어요. 하지만 티켓 가격 대비 관람 시간이 40분 남짓으로 너무 짧습니다.', reviewer_name: '박민영', location: 'AMNY', lang: 'ko', date: '2026-05-02' },
  { rating: 1, review_text: '전시 자체의 퀄리티는 나쁘지 않으나 현장 대기 시스템이 최악입니다. 1시간 넘게 밖에서 떨다가 들어가서 기분을 다 망쳤어요.', reviewer_name: 'Mike Rossi', location: 'AMNY', lang: 'en', date: '2026-05-02' },
  { rating: 5, review_text: '라스베가스의 더위를 피하기 완벽한 오아시스 같은 곳. 기념품샵 디퓨저가 너무 비싸긴 했지만 전시는 100점입니다.', reviewer_name: '김태윤', location: 'AMLV', lang: 'ko', date: '2026-05-03' },
  { rating: 2, review_text: 'The Garden exhibit is undeniably pretty, but the crowd management is non-existent. People were pushing my kids just to take selfies.', reviewer_name: 'Jessica Alba', location: 'AMDB', lang: 'en', date: '2026-05-03' },
  { rating: 4, review_text: '두바이에서 실내 데이트 코스로 강추합니다. 파도 치는 방이 가장 인상 깊었어요. 출구 쪽 동선이 약간 헷갈리게 되어있긴 합니다.', reviewer_name: '최성우', location: 'AMDB', lang: 'ko', date: '2026-05-04' },
  { rating: 5, review_text: 'I loved the Tea Bar experience at the end. The blooming flowers on the teacup were magical, even though the tea itself tasted just okay.', reviewer_name: 'Emma Watson', location: 'AMLV', lang: 'en', date: '2026-05-04' },
  { rating: 3, review_text: '공간마다 향이 바뀌는 디테일은 정말 좋습니다. 그런데 화장실 위생 상태가 전시 수준을 못 따라가는 느낌이네요.', reviewer_name: '정수진', location: 'AMNY', lang: 'ko', date: '2026-05-05' },
  { rating: 1, review_text: 'The visuals are stunning, but I paid $50 just to be rushed through crowded rooms. Not worth the money for a 30-minute walk.', reviewer_name: 'David Chen', location: 'AMLV', lang: 'en', date: '2026-05-05' },
  { rating: 2, review_text: '영상은 화려하지만 눈이 너무 부시고 어지러웠습니다. 사진 찍기에는 좋겠지만 예술적인 감동을 느끼기엔 너무 상업적인 느낌이에요.', reviewer_name: '한지훈', location: 'AMLV', lang: 'ko', date: '2026-05-07' },
  { rating: 1, review_text: '두바이점 예약 확인 줄과 현장 구매 줄이 뒤섞여 난장판이었습니다. 전시는 멋지지만 직원들의 불친절함에 다시 가고 싶지 않네요.', reviewer_name: '윤동주', location: 'AMDB', lang: 'ko', date: '2026-05-09' },
  { rating: 1, review_text: 'The online ticketing system charged me twice and no one at the front desk knew how to fix it. The beautiful art doesn\'t excuse bad service.', reviewer_name: 'Ethan Harris', location: 'AMDB', lang: 'en', date: '2026-05-15' },
  { rating: 1, review_text: '뉴욕점 위치가 최악입니다. 구글맵이 제대로 못 잡아서 한참 헤맸네요. 영상미는 훌륭하나 길 찾다 진이 다 빠졌습니다.', reviewer_name: '이도현', location: 'AMNY', lang: 'ko', date: '2026-05-12' },
  { rating: 3, review_text: 'The digital art is visually appealing, but some interactive elements in the drawing room were broken during our visit.', reviewer_name: 'Oliver Smith', location: 'AMLV', lang: 'en', date: '2026-05-08' },
  { rating: 2, review_text: '전시는 예쁜데 관람객 통제가 전혀 안 됩니다. 플래시 터트리지 말라는데 다들 터트려서 눈이 아파 제대로 볼 수 없었어요.', reviewer_name: '조아라', location: 'AMNY', lang: 'ko', date: '2026-05-17' },
  { rating: 1, review_text: '에어컨이 고장난 건지 내부가 너무 더워서 땀 뻘뻘 흘리며 봤습니다. 아름다운 영상도 쾌적하지 않으면 짜증만 날 뿐입니다.', reviewer_name: '박서준', location: 'AMDB', lang: 'ko', date: '2026-05-19' },
  { rating: 1, review_text: 'Staff at the Vegas location were incredibly rude when we asked for directions. The art is pretty but customer service is completely lacking.', reviewer_name: 'Eleanor Reed', location: 'AMLV', lang: 'en', date: '2026-05-11' },
  { rating: 2, review_text: '작품 퀄리티는 인정하지만, 사람들이 통로에 서서 틱톡 춤을 추고 있어서 지나갈 수가 없었습니다. 직원이 제지 좀 했으면 좋겠어요.', reviewer_name: '이선균', location: 'AMDB', lang: 'ko', date: '2026-05-27' },
  { rating: 1, review_text: '직원들이 너무 불친절합니다. 길을 물어봐도 귀찮은 내색이 역력하네요. 전시가 아무리 훌륭해도 서비스가 최악이라 1점 줍니다.', reviewer_name: '강동원', location: 'AMLV', lang: 'ko', date: '2026-05-29' },
  { rating: 1, review_text: 'Tea Bar staff in Dubai were incredibly slow and rude. The exhibition was fine, but the ending experience left a really bad taste.', reviewer_name: 'Jackson Cooper', location: 'AMDB', lang: 'en', date: '2026-05-18' },
  { rating: 1, review_text: '티바(Tea Bar) 테이블이 안 닦여 있어서 끈적거렸음. 직원은 부르기 전까지 오지도 않음. 위생 관리가 전혀 안 되는 듯.', reviewer_name: '강하늘', location: 'AMDB', lang: 'ko', date: '2026-05-29' },
  { rating: 1, review_text: '뉴욕점 스태프 불친절의 끝판왕. 질문해도 대답도 안 하고 폰만 봄. 아무리 전시가 좋아도 기본 예의가 안 된 곳은 가기 싫음.', reviewer_name: '이선빈', location: 'AMNY', lang: 'ko', date: '2026-05-05' },
  { rating: 1, review_text: '예약 사이트 오류로 현장에서 표를 다시 샀습니다. 환불 처리도 한참 걸리고요. 작품이 좋으면 뭐합니까 기본 시스템이 엉망인데.', reviewer_name: '김남주', location: 'AMDB', lang: 'ko', date: '2026-05-05' },
  { rating: 2, review_text: '뉴욕점 환불 정책 너무 빡빡함. 10분 늦었다고 입장 안 시켜줘서 실랑이 끝에 들어감. 서비스 마인드가 아예 없습니다.', reviewer_name: '설윤', location: 'AMNY', lang: 'ko', date: '2026-05-10' },
  { rating: 1, review_text: 'No air conditioning in half the rooms. It was unbearably hot and stuffy. A beautiful art exhibit ruined by poor facilities.', reviewer_name: 'David Butler', location: 'AMNY', lang: 'en', date: '2026-05-15' },
  { rating: 5, review_text: '진짜 숲 속에 들어온 것 같은 후각적 경험이 대박입니다. 뉴욕 여행 중 가장 힐링되는 시간이었어요. 에어컨이 좀 쎈 편이니 겉옷 챙기세요.', reviewer_name: '강유리', location: 'AMNY', lang: 'ko', date: '2026-05-08' },
  { rating: 5, review_text: 'A must-see in Vegas! The ocean room is so realistic I could almost feel the breeze. The staff were very helpful with taking photos.', reviewer_name: 'Zoey Edwards', location: 'AMLV', lang: 'en', date: '2026-05-05' },
  { rating: 4, review_text: '두바이에서 실내 데이트 코스로 강추합니다. 파도 치는 방이 가장 인상 깊었어요. 출구 쪽 동선이 약간 헷갈리게 되어있긴 합니다.', reviewer_name: '최성우2', location: 'AMDB', lang: 'ko', date: '2026-05-15' },
  { rating: 3, review_text: 'The concept is cool, but $50 for something that takes 35 minutes to walk through is a bit steep. Nice photos, but low value.', reviewer_name: 'Layla Howard', location: 'AMDB', lang: 'en', date: '2026-05-21' },
  { rating: 2, review_text: '영상이 너무 빠르게 전환돼서 멀미가 났습니다. 노약자나 멀미 심한 분들은 주의가 필요해요. 의자도 없어서 쉴 곳도 없음.', reviewer_name: '유아인', location: 'AMLV', lang: 'ko', date: '2026-05-03' },
  { rating: 1, review_text: '인터랙티브 기기 절반이 먹통. 돈 내고 반쪽짜리 전시 본 기분입니다. 관리도 안 하면서 티켓값만 비싸게 받네요. 최악.', reviewer_name: '장기용', location: 'AMLV', lang: 'ko', date: '2026-05-22' },
  { rating: 1, review_text: '뉴욕점 예약 시간 맞춰 갔는데 1시간 대기함. 예약 시스템 왜 만듦? 밖에서 기다리느라 이미 지쳐서 전시가 눈에 안 들어옴.', reviewer_name: '리사', location: 'AMNY', lang: 'ko', date: '2026-05-26' },
  { rating: 1, review_text: 'The staff at the Vegas Tea Bar were so incredibly rude. Threw our cups on the table. Ruined an otherwise beautiful exhibit.', reviewer_name: 'Aaliyah Freeman', location: 'AMLV', lang: 'en', date: '2026-05-15' },
  { rating: 1, review_text: 'Dubai location ticketing system crashed. We stood in the heat for 40 minutes. They refused refunds. Absolute logistical nightmare.', reviewer_name: 'Arthur Hicks', location: 'AMDB', lang: 'en', date: '2026-05-22' },
  { rating: 1, review_text: '라스베가스점 화장실 너무 더러움. 청소 안 하나요? 아무리 예쁜 예술이라도 위생이 엉망이면 다 싫어집니다. 비위 상함.', reviewer_name: '쇼타로', location: 'AMLV', lang: 'ko', date: '2026-05-26' },
  { rating: 1, review_text: 'We were rushed through the entire exhibit. The staff literally told us to keep moving. Horrible way to experience "art".', reviewer_name: 'Eva Griffin', location: 'AMLV', lang: 'en', date: '2026-05-22' },
  { rating: 1, review_text: '두바이점 주차장에서 전시장까지 길 찾다 30분 날림. 표지판 제로. 땀범벅 돼서 들어갔더니 기분 다 망쳐서 바로 나옴.', reviewer_name: '수빈', location: 'AMDB', lang: 'ko', date: '2026-05-02' },
  { rating: 1, review_text: 'Rude staff, broken ticketing scanners, and crowded rooms. Dubai location is a logistical failure despite the pretty lights.', reviewer_name: 'Waylon Dunn', location: 'AMDB', lang: 'en', date: '2026-05-12' },
] as const

interface AnalysisResult {
  idx: number
  rating: number
  location: string
  lang: string
  reviewerName: string
  reviewSnippet: string
  status: string
  route: string
  requiresApproval: boolean
  riskTier: number | null | undefined
  tags: string[]
  primaryIntent: string | null | undefined
  reply: string
  replyLen: number
  issues: string[]
}

const results: AnalysisResult[] = []

for (let i = 0; i < RAW_REVIEWS.length; i++) {
  const r = RAW_REVIEWS[i]
  const decision = processReview({
    reviewText: r.review_text,
    branchCode: r.location,
    language: r.lang as 'ko' | 'en',
    reviewerName: r.reviewer_name,
    rating: r.rating,
    reviewId: null,
  })

  const reply = decision.staticReply ?? '(null — LLM route)'
  const issues: string[] = []

  // ── 이슈 탐지 규칙 ──────────────────────────────────────────────
  if (reply.length > 0 && reply.length < 30) issues.push('TOO_SHORT')
  if (reply.length > 600) issues.push('TOO_LONG')

  // 반복 문구 탐지
  const sentences = reply.split(/[.!?。]\s*/).filter(s => s.trim().length > 5)
  const seen = new Set<string>()
  for (const s of sentences) {
    const key = s.trim().slice(0, 20)
    if (seen.has(key)) { issues.push('DUPLICATE_SENTENCE'); break }
    seen.add(key)
  }

  // AI 냄새 표현 (한국어)
  const aiSmellKo = ['진심으로 감사드립니다', '소중한 의견을 주셔서', '많은 관심과 사랑에 감사', '항상 최선을 다하겠습니다', '더욱 발전하는', '노력하겠습니다', '앞으로도 변함없이']
  const aiSmellEn = ['We sincerely appreciate your feedback', 'We are committed to continuous improvement', 'We hope to welcome you back', 'Thank you for taking the time', 'Your satisfaction is our top priority']
  const totalAiSmell = [...aiSmellKo, ...aiSmellEn].filter(p => reply.includes(p)).length
  if (totalAiSmell >= 3) issues.push('AI_SMELL_HIGH')
  else if (totalAiSmell >= 2) issues.push('AI_SMELL_MED')

  // 금칙어 잔존 확인
  if (/환불|배상|보상|cctv|CCTV|책임|징계/i.test(reply)) issues.push('FORBIDDEN_WORD')

  // 불만 맥락인데 사과 없음
  if (['COMPLAINT', 'EMERGENCY'].includes(decision.classification.status)) {
    const hasApology = /죄송|사과|불편|유감|sorry|apologize|regret/i.test(reply)
    if (!hasApology) issues.push('NO_APOLOGY_ON_COMPLAINT')
  }

  // route=manual인데 staticReply가 너무 짧거나 부적절
  if (decision.route === 'manual' && reply.length < 50 && reply !== '(null — LLM route)') {
    issues.push('MANUAL_REPLY_TOO_SHORT')
  }

  // SAFE인데 reply에 불만 응대 문구가 섞인 경우
  if (decision.classification.status === 'SAFE' && /불편|죄송|아쉬움/i.test(reply)) {
    issues.push('SAFE_REPLY_HAS_COMPLAINT_TONE')
  }

  // 위치별 맥락 누락: 지점명이 있어야 할 맥락
  const branchNames: Record<string, string[]> = {
    AMLV: ['라스베가스', 'Las Vegas', 'Vegas'],
    AMDB: ['두바이', 'Dubai'],
    AMNY: ['뉴욕', 'New York', 'NY'],
  }
  const expectedNames = branchNames[r.location] ?? []
  const hasBranchRef = expectedNames.some(n => reply.includes(n))
  // 지점명 언급은 선택적이므로 INFO 수준
  const branchMissing = !hasBranchRef

  results.push({
    idx: i + 1,
    rating: r.rating,
    location: r.location,
    lang: r.lang,
    reviewerName: r.reviewer_name,
    reviewSnippet: r.review_text.slice(0, 60) + (r.review_text.length > 60 ? '…' : ''),
    status: decision.classification.status,
    route: decision.route,
    requiresApproval: decision.requiresApproval,
    riskTier: decision.riskTier,
    tags: decision.classification.tags,
    primaryIntent: decision.primaryIntent,
    reply,
    replyLen: reply.length,
    issues,
  })
}

// ── 출력 ────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(100))
console.log('ARTE MUSEUM — Reply Quality Analysis Report')
console.log('═'.repeat(100))

// 1. 통계 요약
const byStatus: Record<string, number> = {}
const byRoute: Record<string, number> = {}
const issueCount: Record<string, number> = {}
let issueRows = 0

for (const r of results) {
  byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  byRoute[r.route] = (byRoute[r.route] ?? 0) + 1
  if (r.issues.length > 0) issueRows++
  for (const iss of r.issues) issueCount[iss] = (issueCount[iss] ?? 0) + 1
}

console.log('\n[ 분류 현황 ]')
for (const [k, v] of Object.entries(byStatus)) console.log(`  ${k.padEnd(20)} ${v}건`)

console.log('\n[ 라우팅 현황 ]')
for (const [k, v] of Object.entries(byRoute)) console.log(`  ${k.padEnd(20)} ${v}건`)

console.log('\n[ 이슈 현황 ]')
for (const [k, v] of Object.entries(issueCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(30)} ${v}건`)
}
console.log(`  이슈 있는 리뷰: ${issueRows}/${results.length}건`)

// 2. 개별 답변 상세
console.log('\n' + '─'.repeat(100))
console.log('[ 개별 답변 상세 ]')
console.log('─'.repeat(100))

for (const r of results) {
  const issStr = r.issues.length ? ` ⚠ ${r.issues.join(', ')}` : ' ✓'
  console.log(`\n[#${r.idx}] ★${r.rating} ${r.location}/${r.lang} | ${r.reviewerName}`)
  console.log(`  분류: ${r.status} | 라우트: ${r.route} | 승인필요: ${r.requiresApproval} | RiskTier: ${r.riskTier ?? '-'} | 태그: [${r.tags.join(', ')}]`)
  console.log(`  핵심인텐트: ${r.primaryIntent ?? '-'}`)
  console.log(`  리뷰: ${r.reviewSnippet}`)
  console.log(`  답변(${r.replyLen}자):${issStr}`)
  // 답변을 80자씩 줄바꿈
  const replyLines = r.reply.match(/.{1,90}/g) ?? [r.reply]
  for (const line of replyLines) console.log(`    ${line}`)
}

console.log('\n' + '═'.repeat(100))
console.log('Analysis complete.')
console.log('═'.repeat(100))

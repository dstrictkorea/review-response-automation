/**
 * data-discovery-engine.ts — Shadow Data Mining → Auto-Promotion 제안 (Human-in-the-loop)
 *
 * 알고리즘이 자동 처리하지 못해 LLM/사람으로 넘어간 리뷰(Miss)에서 빈출 패턴을 역추출하고,
 * 임계치를 넘는 '새로운 트렌드'에 대해 [신규 정규식] + [9개 언어 Fragment 초안]을 제안한다.
 * 제안은 proposed_fragments.json으로만 출력(코드 즉시 변경 금지). 관리자가 accept할 때만
 * src/lib/promotedPatterns.ts에 ADDITIVE 병합된다.
 *
 *   사용법:
 *     npx tsx scripts/data-discovery-engine.ts                 # discover (내장 shadow 코퍼스)
 *     npx tsx scripts/data-discovery-engine.ts --csv reviews.csv
 *     npx tsx scripts/data-discovery-engine.ts --threshold 50  # 프로덕션 임계치
 *     npx tsx scripts/data-discovery-engine.ts accept FACILITY_AC_COMPLAINT  # 사람 승인 병합
 *
 *   ⚠ 안전: EMERGENCY(부상/법적/환불요구/직원징계)는 절대 자동 승격 불가 — BLOCKLIST로 차단.
 *           accept 직후 반드시 `npx tsx scripts/regression-guard.ts` 통과 확인.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { processReview } from '../src/lib/reviewProcessor'
import { toReplyLanguage, type ReplyLanguage } from '../src/lib/replyLanguage'

const PROPOSAL_FILE = path.join(process.cwd(), 'proposed_fragments.json')
const PROMOTED_FILE = path.join(process.cwd(), 'src', 'lib', 'promotedPatterns.ts')

// ── 내장 shadow 코퍼스 — 누적 리뷰 CSV의 stand-in (시설/운영 미인식 토픽 클러스터) ──
interface ShadowReview { text: string; rating: number; lang: string; branch?: string }
const SHADOW_CORPUS: ShadowReview[] = [
  // 에어컨/온도 (현재 전용 태그 없음)
  { text: '에어컨이 너무 세서 추웠어요. 겉옷 꼭 챙기세요.', rating: 3, lang: 'ko' },
  { text: '실내가 너무 추웠습니다. 에어컨 온도 조절이 필요해요.', rating: 3, lang: 'ko' },
  { text: 'It was freezing inside, the air conditioning was way too strong.', rating: 3, lang: 'en' },
  { text: 'The aircon was so cold I had to leave early.', rating: 2, lang: 'en' },
  { text: '冷气太强了，里面很冷。', rating: 3, lang: 'zh' },
  { text: 'エアコンが強すぎて寒かったです。', rating: 3, lang: 'ja' },
  { text: 'Hacía mucho frío dentro, el aire acondicionado era excesivo.', rating: 3, lang: 'es' },
  // 오디오 가이드
  { text: '오디오 가이드가 부실해서 설명이 부족했어요.', rating: 3, lang: 'ko' },
  { text: 'The audio guide was hard to hear and not very informative.', rating: 3, lang: 'en' },
  { text: 'The audio guide kept cutting out, frustrating.', rating: 2, lang: 'en' },
  { text: '语音导览不太清楚，信息也少。', rating: 3, lang: 'zh' },
  // 락커/보관
  { text: '짐 맡길 락커가 너무 부족했어요. 가방 들고 다니기 불편.', rating: 3, lang: 'ko' },
  { text: 'There were barely any lockers for our bags, inconvenient.', rating: 3, lang: 'en' },
  { text: 'No lockers available, had to carry everything around.', rating: 2, lang: 'en' },
  // 좌석/휴식
  { text: '앉아서 쉴 의자가 없어서 다리가 아팠어요.', rating: 3, lang: 'ko' },
  { text: 'Nowhere to sit and rest, my legs were tired.', rating: 3, lang: 'en' },
  { text: 'No seating anywhere, exhausting for older visitors.', rating: 2, lang: 'en' },
  // 향수/기념품 가격 (gift shop)
  { text: '기념품샵 디퓨저랑 향수가 너무 비싸요.', rating: 3, lang: 'ko' },
  { text: 'The gift shop perfume and diffusers were overpriced.', rating: 3, lang: 'en' },
  // 진짜 모호 ★3 (토픽 없음 — 제안 대상 아님)
  { text: '그냥 그랬어요. 나쁘지도 좋지도 않은 정도.', rating: 3, lang: 'ko' },
  { text: 'It was okay, nothing special honestly.', rating: 3, lang: 'en' },
  { text: '普通でした。可もなく不可もなく。', rating: 3, lang: 'ja' },
  // 엔진이 이미 처리하는 것(필터링 확인용 — 자동완료될 것)
  { text: '작품이 너무 아름답고 빛이 환상적이었어요!', rating: 5, lang: 'ko' },
  { text: 'Absolutely stunning light installations, loved it!', rating: 5, lang: 'en' },
]

// ── 토픽 라이브러리 — 인식 토픽 → 다국어 키워드 + 제안 정규식 + 9개 언어 인정 조각 초안 ──
//   (EMERGENCY 토픽은 포함하지 않음 — 운영/시설 불만만.)
interface Topic {
  key: string                          // 제안 태그명
  kind: 'complaint' | 'positive'
  match: RegExp                        // shadow 리뷰에서 이 토픽 탐지(다국어)
  regex: string                        // 제안할 Layer1 정규식 소스
  fragment: Partial<Record<ReplyLanguage, string[]>>  // 9개 언어 인정/개선 조각 초안
}
const TOPIC_LIBRARY: Topic[] = [
  {
    key: 'FACILITY_AC_COMPLAINT', kind: 'complaint',
    match: /에어컨|냉방|실내가?\s*추웠|air\s*con|aircon|air\s*conditioning|freezing\s*inside|冷气|空调|エアコン|aire\s*acondicionado|кондиционер/i,
    regex: '에어컨|냉방|실내[^.!?\\n]{0,6}추웠|\\bair\\s*con(?:ditioning)?\\b|\\baircon\\b|freezing\\s*inside|冷气|空调|エアコン|aire\\s*acondicionado|кондиционер',
    fragment: {
      ko: ['실내 온도가 쾌적하지 못해 불편을 드린 점 사과드립니다. 냉방 환경을 세심히 살피겠습니다.'],
      en: ['We are sorry the indoor temperature was uncomfortable. We will monitor our climate control more closely.'],
      ja: ['館内の温度でご不便をおかけし申し訳ございません。空調環境をより丁寧に管理してまいります。'],
      zh: ['对于室内温度造成的不适，我们深表歉意。我们将更细致地调节空调环境。'],
      es: ['Lamentamos que la temperatura interior fuera incómoda. Vigilaremos mejor la climatización.'],
      ru: ['Сожалеем, что температура в помещении была некомфортной. Будем внимательнее следить за климатом.'],
      ar: ['نأسف لأن درجة الحرارة في الداخل كانت غير مريحة. سنراقب أنظمة التكييف بعناية أكبر.'],
      hi: ['अंदर का तापमान असुविधाजनक रहा, इसके लिए हम क्षमा चाहते हैं। हम वातावरण नियंत्रण पर अधिक ध्यान देंगे।'],
      tl: ['Humihingi kami ng paumanhin na hindi komportable ang temperatura sa loob. Babantayan namin nang mas mabuti ang aircon.'],
    },
  },
  {
    key: 'AUDIO_GUIDE_COMPLAINT', kind: 'complaint',
    match: /오디오\s*가이드|음성\s*안내|audio\s*guide|语音导览|音声ガイド|audiogu[ií]a/i,
    regex: '오디오\\s*가이드|음성\\s*안내|\\baudio\\s*guide\\b|语音导览|音声ガイド|audiogu[ií]a',
    fragment: {
      ko: ['오디오 가이드 이용에 불편을 드려 죄송합니다. 음성 안내 품질과 정보를 보완하겠습니다.'],
      en: ['We apologize for the audio guide experience. We will improve its clarity and content.'],
      ja: ['音声ガイドでご不便をおかけし申し訳ございません。音質と内容を改善してまいります。'],
      zh: ['对于语音导览的不便，我们深表歉意。我们将改善其清晰度和内容。'],
      es: ['Lamentamos la experiencia con la audioguía. Mejoraremos su claridad y contenido.'],
      ru: ['Приносим извинения за работу аудиогида. Мы улучшим его качество и содержание.'],
      ar: ['نعتذر عن تجربة الدليل الصوتي. سنحسّن وضوحه ومحتواه.'],
      hi: ['ऑडियो गाइड के अनुभव के लिए हम क्षमा चाहते हैं। हम इसकी स्पष्टता और सामग्री बेहतर करेंगे।'],
      tl: ['Humihingi kami ng paumanhin sa karanasan sa audio guide. Pagbubutihin namin ang linaw at nilalaman nito.'],
    },
  },
  {
    key: 'LOCKER_COMPLAINT', kind: 'complaint',
    match: /락커|사물함|물품\s*보관|\blocker/i,
    regex: '락커|사물함|물품\\s*보관|\\blockers?\\b',
    fragment: {
      ko: ['보관함이 부족해 불편을 드린 점 사과드립니다. 물품 보관 시설 확충을 검토하겠습니다.'],
      en: ['We are sorry the lockers were insufficient. We will review expanding our storage facilities.'],
      ja: ['ロッカーが不足しご不便をおかけしました。手荷物保管設備の拡充を検討いたします。'],
      zh: ['储物柜不足给您带来不便，我们深表歉意。我们将考虑增设寄存设施。'],
      es: ['Lamentamos que las taquillas fueran insuficientes. Estudiaremos ampliar el guardarropa.'],
      ru: ['Сожалеем, что шкафчиков не хватало. Рассмотрим расширение камер хранения.'],
      ar: ['نأسف لعدم كفاية الخزائن. سندرس توسيع مرافق حفظ الأمتعة.'],
      hi: ['लॉकर की कमी से असुविधा हुई, क्षमा चाहते हैं। हम भंडारण सुविधाएं बढ़ाने पर विचार करेंगे।'],
      tl: ['Humihingi kami ng paumanhin na kulang ang locker. Susuriin namin ang pagpapalawak ng imbakan.'],
    },
  },
  {
    key: 'SEATING_COMPLAINT', kind: 'complaint',
    match: /앉을\s*(?:곳|의자)|의자가?\s*없|쉴\s*곳|nowhere\s*to\s*sit|no\s*seating|no\s*place\s*to\s*sit/i,
    regex: '앉을\\s*(?:곳|의자)|의자가?\\s*없|쉴\\s*곳이?\\s*없|nowhere\\s*to\\s*sit|no\\s*seating|no\\s*place\\s*to\\s*(?:sit|rest)',
    fragment: {
      ko: ['앉아서 쉴 공간이 부족해 불편을 드려 죄송합니다. 휴게 좌석 보강을 검토하겠습니다.'],
      en: ['We are sorry there was nowhere to sit and rest. We will look into adding more seating.'],
      ja: ['休憩できる座席が少なくご不便をおかけしました。座席の増設を検討いたします。'],
      zh: ['缺少休息的座位给您带来不便，我们深表歉意。我们将考虑增设座椅。'],
      es: ['Lamentamos que faltaran asientos para descansar. Estudiaremos añadir más asientos.'],
      ru: ['Сожалеем, что негде было присесть и отдохнуть. Рассмотрим установку дополнительных мест.'],
      ar: ['نأسف لقلة أماكن الجلوس والراحة. سندرس إضافة المزيد من المقاعد.'],
      hi: ['बैठकर आराम करने की जगह कम थी, क्षमा चाहते हैं। हम और बैठने की व्यवस्था पर विचार करेंगे।'],
      tl: ['Humihingi kami ng paumanhin na walang maupuan para magpahinga. Titingnan namin ang pagdagdag ng upuan.'],
    },
  },
]

// ── EMERGENCY 토픽 차단 목록 — 절대 자동 승격 불가 (사람이 코드에 직접 추가) ──────────
const EMERGENCY_BLOCKLIST = /환불|보상|refund|compensat|lawsuit|sue|injur|다쳤|부상|소송|고소|변호사|police|경찰|차별|discriminat/i

// ── 토크나이저 + 스톱워드 (raw N-gram 탐색용) ──────────────────────────────────────
const STOP = new Set(['the','a','an','was','were','is','are','it','this','that','and','but','to','of','for','in','on','at','so','very','too','my','we','our','i','you','they','with','had','have','not','no','just','really','there','here','as','be','其','了','的','是','很','也','都','和','에','이','가','을','를','은','는','도','너무','정말','진짜','좀','그','저','수','것','거','데','요','어요','습니다','했어요'])
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,.!?;:"'()[\]~…。、！？，]+/).filter(t => t.length >= 2 && !STOP.has(t))
}

// ── 1) Shadow Data 로드 (CSV 또는 내장 코퍼스) ───────────────────────────────────
function loadShadow(csvPath: string | null): ShadowReview[] {
  if (!csvPath) return SHADOW_CORPUS
  const raw = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean)
  const header = raw[0].split(',').map(h => h.trim().toLowerCase())
  const ti = header.indexOf('review_text'), ri = header.indexOf('rating'), li = header.indexOf('review_language')
  return raw.slice(1).map(line => {
    const c = line.split(',')
    return { text: (c[ti] ?? '').trim(), rating: parseInt(c[ri] ?? '0', 10) || 0, lang: (c[li] ?? 'ko').trim() }
  }).filter(r => r.text)
}

// ── 2) Miss 추출 — processReview 통과 후 LLM-fallback(또는 manual 비-긴급) 수집 ──────
interface MissRow { text: string; lang: string; rating: number }
function extractMisses(reviews: ShadowReview[]): { misses: MissRow[]; total: number; autoDone: number } {
  const misses: MissRow[] = []
  let autoDone = 0
  for (const r of reviews) {
    const d = processReview({ reviewText: r.text, branchCode: r.branch || 'AMLV', language: toReplyLanguage(r.lang), rating: r.rating, reviewId: 'disc' })
    const isAuto = d.route === 'static' && !d.requiresApproval
    if (isAuto) { autoDone++; continue }
    if (d.route === 'llm' || (d.route === 'manual' && !d.classification.isEmergency)) {
      misses.push({ text: r.text, lang: r.lang, rating: r.rating })
    }
  }
  return { misses, total: reviews.length, autoDone }
}

// ── 3) 역추출 — raw N-gram 빈도 + 토픽 앵커 카운트 ───────────────────────────────
function mine(misses: MissRow[]) {
  const ngram = new Map<string, number>()
  for (const m of misses) {
    const toks = tokenize(m.text)
    for (const t of toks) ngram.set(t, (ngram.get(t) ?? 0) + 1)
    for (let i = 0; i < toks.length - 1; i++) {
      const bg = `${toks[i]} ${toks[i + 1]}`
      ngram.set(bg, (ngram.get(bg) ?? 0) + 1)
    }
  }
  const topNgrams = [...ngram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  // 토픽 앵커: 각 토픽이 몇 건의 miss에서 등장하는가
  const topicHits = TOPIC_LIBRARY.map(t => ({ topic: t, freq: misses.filter(m => t.match.test(m.text)).length }))
    .filter(t => t.freq > 0).sort((a, b) => b.freq - a.freq)
  return { topNgrams, topicHits }
}

// ── 4) 제안 생성 (임계치 초과 토픽만) ────────────────────────────────────────────
interface Proposal {
  tag: string; kind: string; freq: number; threshold: number
  suggestedRegex: string; suggestedFragment: Partial<Record<ReplyLanguage, string[]>>
  emergencyBlocked: boolean; needsHumanReview: true
}
function buildProposals(topicHits: Array<{ topic: Topic; freq: number }>, threshold: number): Proposal[] {
  return topicHits.filter(t => t.freq >= threshold).map(({ topic, freq }) => ({
    tag: topic.key, kind: topic.kind, freq, threshold,
    suggestedRegex: topic.regex, suggestedFragment: topic.fragment,
    emergencyBlocked: EMERGENCY_BLOCKLIST.test(topic.regex),
    needsHumanReview: true,
  }))
}

// ── 5) accept — 사람 승인 항목을 promotedPatterns.ts에 ADDITIVE 병합 ─────────────────
function acceptProposals(tags: string[]): void {
  if (!fs.existsSync(PROPOSAL_FILE)) { console.error('proposed_fragments.json 없음 — 먼저 discover 실행.'); process.exit(1) }
  const proposals: Proposal[] = JSON.parse(fs.readFileSync(PROPOSAL_FILE, 'utf8')).proposals
  const chosen = proposals.filter(p => tags.includes(p.tag))
  if (!chosen.length) { console.error('일치하는 제안 없음. 사용 가능:', proposals.map(p => p.tag).join(', ')); process.exit(1) }
  for (const p of chosen) {
    if (p.emergencyBlocked) { console.error(`⛔ ${p.tag}: EMERGENCY 관련 — 자동 승격 차단. 사람이 코드에 직접 추가.`); continue }
  }
  let src = fs.readFileSync(PROMOTED_FILE, 'utf8')
  for (const p of chosen) {
    if (p.emergencyBlocked) continue
    if (src.includes(`tag: '${p.tag}'`)) { console.log(`· ${p.tag} 이미 병합됨 — skip`); continue }
    const entry = `  { tag: '${p.tag}', pattern: ${JSON.stringify(p.suggestedRegex)}, note: ${JSON.stringify(`freq=${p.freq}, auto-promoted (Wave 22 discovery)`)}, fragment: ${JSON.stringify(p.suggestedFragment)} },\n`
    src = src.replace('export const PROMOTED_COMPLAINT: PromotedComplaint[] = []',
                      `export const PROMOTED_COMPLAINT: PromotedComplaint[] = [\n${entry}]`)
      .replace(/export const PROMOTED_COMPLAINT: PromotedComplaint\[\] = \[\n((?:.*\n)*?)\]\n(\nexport const PROMOTED_FRAGMENTS)/,
               (_m, body, tail) => `export const PROMOTED_COMPLAINT: PromotedComplaint[] = [\n${body}${entry}]\n${tail}`)
    console.log(`✅ ${p.tag} 병합 → ${PROMOTED_FILE}`)
  }
  fs.writeFileSync(PROMOTED_FILE, src, 'utf8')
  console.log('\n⚠ 병합 직후 반드시 실행: npx tsx scripts/regression-guard.ts  (FAIL이면 롤백)')
}

// ── main ─────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args[0] === 'accept') {
  acceptProposals(args.slice(1))
  process.exit(0)
}
const csvPath = args.includes('--csv') ? args[args.indexOf('--csv') + 1] : null
const threshold = args.includes('--threshold') ? parseInt(args[args.indexOf('--threshold') + 1], 10) : 3

const reviews = loadShadow(csvPath)
const { misses, total, autoDone } = extractMisses(reviews)
const { topNgrams, topicHits } = mine(misses)
const proposals = buildProposals(topicHits, threshold)

console.log('═══════ Shadow Data Mining ═══════')
console.log(`  소스: ${csvPath ?? '내장 shadow 코퍼스'} | 총 ${total}건`)
console.log(`  자동완료(auto-done): ${autoDone}건 | Miss(LLM/사람): ${misses.length}건 (${((misses.length / total) * 100).toFixed(1)}%)`)
console.log('\n  [ 미인식 빈출 N-gram (top) ]')
for (const [w, n] of topNgrams) console.log(`    ${String(n).padStart(2)}× ${w}`)
console.log('\n  [ 토픽 앵커 빈도 ]')
for (const { topic, freq } of topicHits) console.log(`    ${String(freq).padStart(2)}× ${topic.key}${EMERGENCY_BLOCKLIST.test(topic.regex) ? ' ⛔(EMERGENCY-blocked)' : ''}`)

console.log(`\n═══════ Auto-Promotion 제안 (임계치 ≥${threshold}) ═══════`)
if (!proposals.length) {
  console.log('  임계치 초과 트렌드 없음.')
} else {
  for (const p of proposals) {
    console.log(`  🧬 ${p.tag}  (freq=${p.freq}, kind=${p.kind})${p.emergencyBlocked ? '  ⛔ EMERGENCY-blocked (자동 승격 불가)' : ''}`)
    console.log(`     regex: ${p.suggestedRegex.slice(0, 70)}…`)
    console.log(`     fragment(ko): ${(p.suggestedFragment.ko ?? [''])[0].slice(0, 50)}…  [+8 langs]`)
  }
  fs.writeFileSync(PROPOSAL_FILE, JSON.stringify({ generatedFrom: csvPath ?? 'builtin-shadow', threshold, misses: misses.length, proposals }, null, 2), 'utf8')
  console.log(`\n  → 제안 ${proposals.length}건 저장: ${PROPOSAL_FILE}`)
  console.log('  → 사람 승인 병합: npx tsx scripts/data-discovery-engine.ts accept <TAG>')
  console.log('  → EMERGENCY 관련 토픽은 자동 승격 차단(BLOCKLIST). 사람이 코드에 직접 추가.')
}

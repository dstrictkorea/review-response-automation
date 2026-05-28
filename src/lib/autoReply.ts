/**
 * Rule-based auto reply generator for ARTE Museum.
 * Modular sentence composition: openers × bodies × closers picked independently
 * via seeded hash → statistically unique reply per review even with same context.
 *
 * Combination count (KO alone):
 *   10 openers × 10 bodies × 8 extBodies × 10 closers per (context × rating)
 *   = 8,000 careful / 1,000 standard combos × 6 contexts × 2 ratings = ~60,000 KO variants
 *
 * Cross-branch returning visitor: pass previousBranchNames[] and isCrossBranch=true
 * to get personalised "visited [branch] before, now [current]" replies.
 */

// ─── Risk signals ─────────────────────────────────────────────────────────────
const RISK_KO = [
  '환불','보상','배상','소송','고소','법적','변호사','사고','부상',
  '다쳤','병원','언론','기자','방송','cctv','차별','위생','불결',
  '유포','신고','처벌','징계','불만','형편없',
]
const RISK_EN = [
  'refund','compensation','lawsuit','sue','legal','lawyer','attorney',
  'accident','injury','injured','hospital','media','press',
  'discrimination','racist','hygiene','unsanitary','dangerous',
]

// ─── Language detection ───────────────────────────────────────────────────────
export function detectLang(text: string): 'ko' | 'en' | 'zh' | 'ja' {
  if (!text) return 'ko'
  const len = text.length || 1
  if ((text.match(/[가-힣]/g) ?? []).length / len > 0.12) return 'ko'
  if ((text.match(/[ぁ-ヶ]/g) ?? []).length / len > 0.08) return 'ja'
  if ((text.match(/[一-鿿]/g) ?? []).length / len > 0.12) return 'zh'
  return 'en'
}

// ─── Auto-generatability check ────────────────────────────────────────────────
export interface AutoCheckResult { canAuto: boolean; reason: string }
export function checkAutoGeneratable(rating: number | null, text: string | null): AutoCheckResult {
  if (rating == null || rating < 4)
    return { canAuto: false, reason: '별점이 낮아 AI 초안이 필요합니다.' }
  const t = (text ?? '').toLowerCase()
  for (const w of RISK_KO) if (t.includes(w)) return { canAuto: false, reason: `위험 키워드 감지: "${w}"` }
  for (const w of RISK_EN) if (t.includes(w)) return { canAuto: false, reason: `Risk keyword: "${w}"` }
  if (t.length > 220) return { canAuto: false, reason: '긴 리뷰 — AI 분석이 더 정확합니다.' }
  return { canAuto: true, reason: '자동 생성 가능 (4-5★, 짧은 긍정 리뷰)' }
}

// ─── Context detection ────────────────────────────────────────────────────────
type Context = 'family' | 'couple' | 'photo' | 'staff' | 'cafe' | 'general'
function detectContext(text: string): Context {
  const t = (text ?? '').toLowerCase()
  if (/아이|가족|아들|딸|어린이|아기|어른과|남매|부모님|kid|family|child|toddler/.test(t)) return 'family'
  if (/커플|데이트|남자친구|여자친구|남친|여친|boyfriend|girlfriend|couple|date/.test(t)) return 'couple'
  if (/직원|스태프|안내|친절하|직원분|선생님|staff|friendly|helpful|kind/.test(t)) return 'staff'
  if (/카페|음료|커피|케이크|디저트|cafe|coffee|drink|dessert/.test(t)) return 'cafe'
  if (/사진|포토|인스타|찍|촬영|photo|picture|instagram|selfie|shot/.test(t)) return 'photo'
  return 'general'
}

// ─── Visitor info ─────────────────────────────────────────────────────────────
export interface VisitorInfo {
  isReturning: boolean
  isCrossBranch: boolean          // visited a DIFFERENT branch before
  previousBranchNames: string[]   // human-readable names of previous branches
  currentBranchName?: string      // human-readable name of current branch (optional)
}

// ─── Modular pool types ───────────────────────────────────────────────────────
interface ModularPool {
  openers:   string[]   // greeting + gratitude sentences
  bodies:    string[]   // context-specific main content
  extBodies: string[]   // deeper / extended body (for careful mode)
  closers:   string[]   // forward-looking closing sentences
}
interface ModularRatedPool { 5: ModularPool; 4: ModularPool }
type ModularContextPool = Record<Context, ModularRatedPool>

// ─── Seeded hash helpers ──────────────────────────────────────────────────────
function stableHash(reviewId: string, seed: number): number {
  let h = seed * 2654435761
  for (let i = 0; i < reviewId.length; i++)
    h = (Math.imul(h ^ reviewId.charCodeAt(i), 2654435761)) | 0
  return Math.abs(h)
}
function pickAt<T>(arr: T[], reviewId: string, seed: number): T {
  return arr[stableHash(reviewId, seed) % arr.length]
}
function compose(pool: ModularPool, reviewId: string, type: 'short' | 'standard' | 'careful'): string {
  if (type === 'short') return pickAt(pool.openers, reviewId, 0)
  if (type === 'standard') {
    const o = pickAt(pool.openers,   reviewId, 0)
    const b = pickAt(pool.bodies,    reviewId, 1)
    const c = pickAt(pool.closers,   reviewId, 2)
    return `${o} ${b} ${c}`
  }
  const o  = pickAt(pool.openers,   reviewId, 0)
  const b  = pickAt(pool.bodies,    reviewId, 1)
  const e  = pickAt(pool.extBodies, reviewId, 3)
  const c  = pickAt(pool.closers,   reviewId, 2)
  return `${o} ${b} ${e} ${c}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// KOREAN MODULAR POOLS
// ═══════════════════════════════════════════════════════════════════════════════

const KO_POOLS: ModularContextPool = {

  // ── general ─────────────────────────────────────────────────────────────────
  general: {
    5: {
      openers: [
        '아르떼뮤지엄을 찾아주시고 이렇게 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다.',
        '소중한 시간을 내어 아르떼뮤지엄을 방문해 주시고 좋은 말씀을 남겨 주셔서 깊이 감사드립니다.',
        '방문해 주신 것만으로도 감사한데, 이렇게 따뜻한 후기까지 주셔서 더욱 기쁩니다.',
        '이렇게 좋은 말씀을 남겨 주셔서 저희 팀 모두가 진심으로 기쁩니다.',
        '아르떼뮤지엄을 선택해 주시고 소중한 후기를 남겨 주셔서 감사드립니다.',
        '후기를 통해 따뜻한 응원을 보내 주셔서 진심으로 감사합니다.',
        '아르떼뮤지엄에 찾아주시고 이렇게 좋은 말씀을 전해 주셔서 감사합니다.',
        '바쁜 일상 중에 아르떼뮤지엄을 찾아주시고 후기까지 남겨 주셔서 감사합니다.',
        '고객님의 방문과 따뜻한 후기에 저희 팀 전체가 큰 힘을 받습니다.',
        '이렇게 좋은 후기를 남겨 주셔서 저희도 더욱 설레고 기쁩니다.',
      ],
      bodies: [
        '고객님처럼 즐겁게 방문해 주시는 분들 덕분에 저희 팀 모두가 더욱 열심히 할 수 있습니다.',
        '빛과 디지털 아트 속에서 즐거운 시간 보내셨길 진심으로 바랍니다.',
        '고객님의 방문이 저희에게는 언제나 특별한 의미가 있습니다.',
        '매 전시마다 새로운 감동을 드리기 위해 끊임없이 준비하고 있습니다.',
        '아르떼뮤지엄이 고객님께 특별한 추억이 되었으면 정말 좋겠습니다.',
        '단순한 전시 공간을 넘어, 방문하시는 모든 분들께 진정한 예술 경험을 드리고자 항상 고민하고 있습니다.',
        '고객님의 소중한 방문이 저희가 더 나은 전시를 만들어가는 원동력이 됩니다.',
        '빛과 색채가 가득한 공간에서 아름다운 감동을 느끼셨기를 바랍니다.',
        '방문해 주신 고객님 한 분 한 분이 저희에게는 정말 소중한 인연입니다.',
        '아르떼의 빛과 예술이 고객님의 일상에 작은 설렘이 되셨으면 합니다.',
      ],
      extBodies: [
        '저희는 공간 구성부터 작품 선정까지 모든 세부 사항을 세심하게 준비하고 있습니다.',
        '고객님의 한 마디 한 마디가 저희 팀 모두에게 큰 힘이 되고 더 열심히 하고 싶은 원동력이 됩니다.',
        '앞으로도 새로운 콘텐츠와 전시로 꾸준히 성장하는 모습을 보여드리겠습니다.',
        '저희는 방문하시는 모든 분들이 빛과 예술 속에서 일상을 잠시 내려놓고 깊은 감동을 느끼실 수 있는 공간을 만들고자 합니다.',
        '즐거운 경험이 되셨다니 저희에게 이보다 큰 보람이 없습니다.',
        '고객님의 긍정적인 후기는 저희 팀 전원에게 진심 어린 감사와 격려가 됩니다.',
        '저희 아르떼뮤지엄은 매 순간 새로운 감동을 드릴 수 있도록 조명부터 설치물까지 끊임없이 발전시키고 있습니다.',
        '이렇게 좋은 후기가 쌓일수록 저희는 더욱 책임감 있게, 더욱 성실하게 운영에 임하게 됩니다.',
      ],
      closers: [
        '다음에도 좋은 인연 이어지길 바랍니다.',
        '다음 방문도 기대하겠습니다!',
        '언제든 편하게 찾아주시면 반갑겠습니다.',
        '앞으로도 새로운 예술 경험을 드릴 수 있도록 최선을 다하겠습니다.',
        '다음에도 특별한 시간이 되시길 진심으로 바랍니다.',
        '더 새롭고 감동적인 작품으로 계속 성장하는 아르떼뮤지엄이 되겠습니다.',
        '다음에 다시 만나 뵐 수 있으면 정말 기쁠 것 같습니다.',
        '항상 감사한 마음으로 최선을 다하겠습니다.',
        '새로운 전시와 함께 또 다시 찾아주시면 반갑겠습니다.',
        '고객님의 다음 방문을 언제나 기대하며 준비하겠습니다.',
      ],
    },
    4: {
      openers: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다.',
        '소중한 후기를 남겨 주셔서 진심으로 감사드립니다.',
        '아르떼뮤지엄을 찾아주시고 의견을 남겨 주셔서 감사합니다.',
        '방문해 주신 것에 감사드리고, 솔직한 피드백에 더욱 감사드립니다.',
        '후기 남겨 주셔서 감사합니다. 고객님의 의견을 소중히 받아들이겠습니다.',
        '아르떼를 찾아주시고 이렇게 진솔한 후기까지 주셔서 감사합니다.',
        '소중한 시간을 내어 후기를 남겨 주셔서 깊이 감사드립니다.',
        '방문 후기를 공유해 주셔서 감사드립니다.',
      ],
      bodies: [
        '전반적으로 좋은 시간이 되셨다니 기쁩니다.',
        '즐거운 경험이 되셨다니 저희도 다행입니다.',
        '고객님처럼 솔직한 피드백이 저희에게 정말 소중합니다.',
        '아쉬운 부분이 있으셨다면, 귀중한 의견으로 받아들이고 반드시 개선하겠습니다.',
        '부족한 부분은 더 나은 서비스를 만들어 갈 수 있는 기회로 삼겠습니다.',
        '고객님의 소중한 피드백이 저희가 발전할 수 있는 원동력이 됩니다.',
        '기대에 완전히 부응하지 못한 부분이 있으셨다면 더욱 분발하겠습니다.',
        '고객님의 방문이 더 완벽한 경험이 될 수 있도록 지속적으로 개선해 나가겠습니다.',
      ],
      extBodies: [
        '고객님의 의견 하나하나가 저희 서비스와 전시 품질을 높이는 데 직접적인 도움이 됩니다.',
        '완벽한 경험을 제공하기 위해 팀 전체가 매일 노력하고 있으며, 고객님의 피드백은 그 방향을 잡는 데 큰 도움이 됩니다.',
        '아쉬웠던 점들은 내부적으로 검토하여 실질적인 개선으로 이어질 수 있도록 하겠습니다.',
        '저희는 방문하시는 모든 분들이 만족하실 수 있도록 끊임없이 점검하고 보완하고 있습니다.',
        '솔직한 후기는 저희에게 어떤 칭찬보다 값진 선물입니다.',
        '고객님처럼 진솔하게 의견을 나눠주시는 분들 덕분에 저희가 더 빠르게 성장할 수 있습니다.',
      ],
      closers: [
        '다음에는 더 만족스러운 경험이 되도록 최선을 다하겠습니다.',
        '다음 방문에는 더 나아진 모습으로 뵐 수 있기를 기대합니다.',
        '앞으로도 계속 발전하는 아르떼뮤지엄이 되겠습니다. 방문을 고민 중이신 분들께도 새로운 전시와 함께 좋은 경험이 되기를 바랍니다.',
        '더 좋은 모습으로 다시 뵐 수 있으면 좋겠습니다.',
        '항상 더 나은 방문 경험을 드리기 위해 노력하겠습니다. 다음 방문객분들께도 더 완성된 경험을 드릴 수 있도록 개선해 나가겠습니다.',
        '다음에는 한층 완성된 경험을 드릴 수 있도록 준비하겠습니다.',
        '고객님의 소중한 피드백을 바탕으로 반드시 발전하겠습니다.',
        '언제든 다시 찾아주시면 더 나아진 모습으로 맞이하겠습니다.',
      ],
    },
  },

  // ── family ───────────────────────────────────────────────────────────────────
  family: {
    5: {
      openers: [
        '소중한 가족과 함께 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다.',
        '가족과 함께 특별한 시간을 아르떼뮤지엄에서 보내 주셔서 감사합니다.',
        '온 가족이 함께 찾아주셔서 저희도 정말 기쁩니다.',
        '사랑하는 가족과 함께 방문해 주셔서 따뜻한 마음이 느껴집니다. 감사합니다.',
        '가족 모두와 함께해 주셔서 진심으로 감사드리며, 따뜻한 후기에 더욱 기쁩니다.',
        '소중한 가족과 아르떼를 함께해 주셔서 감사드립니다.',
        '온 가족이 방문해 주시고 이렇게 좋은 후기까지 남겨 주셔서 감사합니다.',
        '가족과 함께하신 방문, 저희에게도 정말 의미 있는 순간이었습니다.',
      ],
      bodies: [
        '온 가족이 함께 빛과 예술의 세계를 경험하셨다니 저희도 정말 행복합니다.',
        '어른도 아이도 모두 즐길 수 있는 공간이 되기 위해 저희도 매일 고민하고 있습니다.',
        '아이들이 눈을 반짝이며 작품을 바라보는 모습을 상상하니 저희도 미소가 지어집니다.',
        '가족과 함께한 그 특별한 시간이 오래도록 기억에 남으시길 바랍니다.',
        '사랑하는 가족과 나눈 감동이 소중한 추억으로 영원히 남기를 바랍니다.',
        '아이들의 눈높이에서도, 어른들의 감성에서도 의미 있는 경험이 되도록 항상 노력하고 있습니다.',
        '온 가족이 함께 웃고 감동받으셨다면 저희로서는 이보다 큰 보람이 없습니다.',
        '가족이 함께하는 시간이 아르떼뮤지엄과 함께 더욱 특별해지길 바랍니다.',
      ],
      extBodies: [
        '저희 아르떼뮤지엄은 어린이부터 어른까지, 세대를 초월해 모두가 감동받을 수 있는 공간을 만들기 위해 끊임없이 고민하고 있습니다.',
        '아이들이 처음 경험하는 빛과 예술의 세계가 평생의 귀한 기억이 될 수 있다고 믿습니다.',
        '가족과 함께하는 소중한 시간이 아르떼에서 더욱 빛날 수 있도록 공간 하나하나를 정성껏 만들고 있습니다.',
        '온 가족이 각자의 방식으로 작품을 느끼고 서로의 감동을 나누는 그 순간이 저희가 이 일을 하는 이유입니다.',
        '아이들의 상상력을 자극하고 어른들에게는 일상의 쉼표가 되는 공간이 되고자 합니다.',
        '가족과 함께하는 특별한 나들이 장소로 아르떼뮤지엄을 선택해 주셔서 정말 영광입니다.',
      ],
      closers: [
        '다음에도 가족과 함께 즐거운 시간 이어지기를 바랍니다.',
        '가족과 함께 또 찾아주시면 정말 반갑겠습니다.',
        '다음에도 온 가족이 즐거운 시간이 되시길 진심으로 바랍니다.',
        '사랑하는 가족과의 소중한 추억이 아르떼에서 계속 이어지길 바랍니다.',
        '다음에도 가족과 함께하실 수 있는 기회가 생기면 좋겠습니다.',
        '더 새로운 전시와 함께 가족 모두가 즐거운 시간이 되시길 기원합니다.',
        '다음 방문에도 온 가족이 웃음 가득한 시간이 되시길 바랍니다.',
        '언제든 가족과 함께 찾아주시면 따뜻하게 맞이하겠습니다.',
      ],
    },
    4: {
      openers: [
        '가족과 함께 아르떼뮤지엄을 찾아주시고 후기를 남겨 주셔서 감사합니다.',
        '소중한 가족과 방문해 주시고 솔직한 의견을 주셔서 감사합니다.',
        '가족과 함께해 주셔서 감사합니다.',
        '온 가족이 방문해 주시고 이렇게 진솔한 후기까지 남겨 주셔서 감사합니다.',
        '가족과 함께하신 방문에 감사드립니다.',
        '소중한 가족과의 시간을 아르떼에서 함께해 주셔서 감사합니다.',
        '가족 모두와 방문해 주셔서 감사드립니다.',
        '가족과 함께 찾아주시고 소중한 피드백을 남겨 주셔서 감사합니다.',
      ],
      bodies: [
        '가족 모두가 즐거운 시간이 되셨다니 기쁩니다.',
        '아쉬운 부분이 있으셨다면 가족 단위 방문객을 더 잘 배려할 수 있도록 개선하겠습니다.',
        '어른도 아이도 모두 만족할 수 있는 공간을 만들기 위해 계속 노력하겠습니다.',
        '가족 방문객을 위한 더 나은 경험을 제공하기 위해 지속적으로 개선해 나가겠습니다.',
        '전반적으로 좋은 시간이 되셨다니 다행이고, 아쉬운 부분은 반드시 개선하겠습니다.',
        '고객님의 소중한 의견을 가족 친화적인 공간 구성에 적극 반영하겠습니다.',
        '부족한 부분이 있었다면, 그것이 가족과 함께하는 소중한 시간을 방해하지 않았으면 하는 마음에 더욱 아쉽습니다.',
        '가족 모두가 만족하실 수 있는 공간이 되도록 최선을 다하겠습니다.',
      ],
      extBodies: [
        '특히 아이들이 즐겁고 안전하게 관람할 수 있는 환경을 만드는 데 더욱 신경 쓰겠습니다.',
        '가족과 함께하는 소중한 외출이 더욱 완벽해질 수 있도록 세심하게 개선해 나가겠습니다.',
        '온 가족이 각자의 방식으로 즐길 수 있는 다양한 콘텐츠를 계속 준비하겠습니다.',
        '어린 자녀를 동반한 가족분들이 더욱 편리하고 즐겁게 관람하실 수 있도록 개선하겠습니다.',
        '고객님의 의견을 통해 저희가 미처 놓쳤던 부분을 발견하고 발전시킬 수 있습니다.',
        '가족 방문객을 위한 편의 시설과 동선 개선에 더욱 노력하겠습니다.',
      ],
      closers: [
        '다음에는 온 가족이 더 만족스러운 시간이 되시길 바랍니다.',
        '다음 가족 방문에는 더 완성된 모습으로 뵙기를 바랍니다.',
        '가족과 함께 또 찾아주시면 더 나아진 모습으로 맞이하겠습니다.',
        '다음에도 온 가족과 함께 즐거운 시간이 되시길 기원합니다.',
        '더 좋은 가족 경험을 위해 계속 발전하겠습니다.',
        '다음 방문 때는 더 만족스러운 경험을 드릴 수 있도록 준비하겠습니다.',
        '언제든 가족과 함께 다시 찾아주시면 감사하겠습니다.',
        '가족과의 소중한 시간이 아르떼에서 더욱 빛날 수 있도록 노력하겠습니다.',
      ],
    },
  },

  // ── couple ───────────────────────────────────────────────────────────────────
  couple: {
    5: {
      openers: [
        '소중한 분과 함께 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다.',
        '특별한 분과 함께해 주셔서 저희도 행복한 마음으로 감사드립니다.',
        '사랑하는 분과 함께 방문해 주셔서 따뜻하게 감사드립니다.',
        '두 분이 함께 찾아주셔서 저희도 정말 기뻤습니다.',
        '소중한 분과의 특별한 하루를 아르떼와 함께해 주셔서 감사합니다.',
        '특별한 사람과 함께 아르떼뮤지엄을 찾아주셔서 감사합니다.',
        '두 분의 방문과 따뜻한 후기에 저희 팀 모두가 기쁩니다.',
        '소중한 사람과 함께하신 방문이 정말 빛나 보입니다. 감사합니다.',
      ],
      bodies: [
        '빛과 예술 속에서 함께한 시간이 두 분 모두에게 특별한 추억으로 남기를 바랍니다.',
        '사랑하는 사람과 예술의 감동을 나누셨다니 저희로서는 더 이상 바랄 것이 없습니다.',
        '저희 공간이 두 분에게 아름다운 추억의 장소로 기억된다면 정말 기쁘겠습니다.',
        '빛과 색채 속에서 나누신 감동이 오래도록 기억에 남기를 바랍니다.',
        '특별한 사람과 함께하는 시간을 더욱 빛나게 해드릴 수 있어 저희도 행복합니다.',
        '감성적인 공간에서 아름다운 순간을 만끽하셨길 진심으로 바랍니다.',
        '두 분이 함께한 이 순간이 오랫동안 소중한 기억으로 남기를 바랍니다.',
        '아르떼의 빛이 두 분의 특별한 하루를 더욱 따뜻하게 물들였기를 바랍니다.',
      ],
      extBodies: [
        '저희 아르떼뮤지엄은 일상 속에서 특별한 감동을 선사하는 공간이 되고자 항상 노력하고 있습니다.',
        '소중한 사람과 함께하는 순간을 더욱 아름답게 만들어드리는 것이 저희의 목표입니다.',
        '앞으로도 더욱 감각적이고 아름다운 전시로 특별한 두 분의 시간을 함께하겠습니다.',
        '빛과 예술이 특별한 사람과의 시간을 더욱 깊이 있게 만들어 준다고 믿습니다.',
        '두 분의 이야기가 아르떼의 빛과 함께 더욱 아름다운 추억이 되기를 바랍니다.',
        '특별한 사람과의 데이트에 아르떼를 선택해 주신 것이 저희에게는 큰 영광입니다.',
      ],
      closers: [
        '다음에도 두 분의 특별한 시간을 함께할 수 있으면 좋겠습니다.',
        '앞으로도 감각적이고 아름다운 전시로 찾아뵙겠습니다.',
        '다음에도 특별한 분과 함께 찾아주시면 반갑겠습니다.',
        '두 분의 아름다운 추억이 계속 이어지기를 바랍니다.',
        '다음에도 함께하실 수 있는 기회가 생기면 정말 기쁘겠습니다.',
        '소중한 분과의 다음 방문도 기대하겠습니다.',
        '언제든 특별한 하루를 원하실 때 다시 찾아주시면 감사하겠습니다.',
        '아름다운 순간들이 두 분 곁에 계속 함께하기를 바랍니다.',
      ],
    },
    4: {
      openers: [
        '함께 방문해 주시고 후기를 남겨 주셔서 감사합니다.',
        '소중한 분과 방문해 주시고 솔직한 의견을 주셔서 감사합니다.',
        '두 분이 함께 찾아주셔서 감사합니다.',
        '특별한 분과 함께 아르떼를 찾아주셔서 감사드립니다.',
        '소중한 사람과 방문해 주시고 후기까지 남겨 주셔서 감사합니다.',
        '함께하신 방문에 감사드립니다.',
        '두 분의 방문에 감사드리고, 솔직한 피드백에 더욱 감사드립니다.',
        '특별한 하루를 아르떼와 함께해 주셔서 감사합니다.',
      ],
      bodies: [
        '전반적으로 좋은 시간이 되셨다니 기쁩니다.',
        '아쉬운 부분이 있으셨다면 더욱 신경 쓰겠습니다.',
        '두 분이 함께하는 소중한 시간이 더욱 완벽해질 수 있도록 개선하겠습니다.',
        '기대에 충분히 부응하지 못한 점이 있다면 진심으로 사과드립니다.',
        '다음에는 더욱 완벽한 경험을 드릴 수 있도록 준비하겠습니다.',
        '고객님의 소중한 의견을 바탕으로 더 나은 공간을 만들어 가겠습니다.',
        '부족했던 부분은 귀중한 피드백으로 받아들이고 개선하겠습니다.',
        '서비스와 전시 모두 더욱 발전시켜 나가겠습니다.',
      ],
      extBodies: [
        '특별한 사람과 함께하는 시간이 어디서든 완벽하길 바라는 마음은 저희도 마찬가지입니다.',
        '두 분이 함께하는 소중한 순간이 아르떼에서 더욱 빛날 수 있도록 최선을 다하겠습니다.',
        '고객님의 의견을 반영하여 더 감각적이고 만족스러운 경험을 드릴 수 있도록 노력하겠습니다.',
        '연인과 함께하는 특별한 나들이에 더욱 적합한 공간이 될 수 있도록 계속 발전하겠습니다.',
        '아쉬웠던 부분을 개선하여 다음 방문에는 더 완벽한 경험을 드리겠습니다.',
        '두 분의 소중한 시간이 저희 공간에서 더욱 아름답게 기억되기를 바랍니다.',
      ],
      closers: [
        '다음에는 더욱 완벽한 시간이 되도록 준비하겠습니다.',
        '다음 방문에는 더 만족스러운 경험이 되시길 바랍니다.',
        '더 나은 모습으로 다시 뵐 수 있기를 기대합니다.',
        '다음에도 두 분과 함께할 수 있으면 좋겠습니다.',
        '언제든 특별한 시간을 원하실 때 찾아주시면 감사하겠습니다.',
        '더 완성된 경험을 드릴 수 있도록 준비하겠습니다.',
        '두 분의 다음 방문을 기대하며 발전하겠습니다.',
        '다음에도 소중한 분과 함께 찾아주시면 반갑겠습니다.',
      ],
    },
  },

  // ── photo ────────────────────────────────────────────────────────────────────
  photo: {
    5: {
      openers: [
        '아르떼뮤지엄에서 아름다운 순간을 기록해 주시고 따뜻한 후기까지 남겨 주셔서 감사합니다.',
        '빛의 예술 속에서 특별한 순간을 남겨 주셔서 진심으로 감사드립니다.',
        '아르떼에서 멋진 장면을 담아 주셔서 저희도 기쁩니다.',
        '이렇게 좋은 사진 장소로 아르떼를 선택해 주셔서 감사합니다.',
        '아름다운 순간을 아르떼와 함께 기록해 주셔서 감사합니다.',
        '빛과 예술이 가득한 공간에서 멋진 추억을 남겨 주셔서 감사드립니다.',
        '아르떼의 작품들과 함께 특별한 장면을 담아 주셔서 기쁩니다.',
        '사진으로 아르떼의 순간을 기록해 주시고 좋은 후기까지 남겨 주셔서 감사합니다.',
      ],
      bodies: [
        '빛과 색채가 어우러진 공간에서 멋진 추억을 담으셨길 바랍니다.',
        '저희 작품들이 고객님의 소중한 사진 속에서도 빛을 발했으면 좋겠습니다.',
        '아르떼뮤지엄의 작품들이 고객님의 카메라 속에 아름답게 담겼을 생각에 저희도 설렙니다.',
        '매 순간이 작품이 되는 공간을 만들기 위해 조명부터 설치물까지 세심하게 설계하고 있습니다.',
        '고객님의 사진 속에서 저희 공간이 더욱 아름답게 빛난다면 그보다 기쁜 일이 없겠습니다.',
        '빛이 만들어내는 무한한 아름다움 속에서 특별한 장면을 발견하셨기를 바랍니다.',
        '아르떼의 빛과 색채가 고객님의 특별한 순간을 더욱 아름답게 만들어 드렸으면 합니다.',
        '인스타그램이나 소셜미디어에 올라간 아르떼의 모습이 더 많은 분들께 감동을 전해드리길 바랍니다.',
      ],
      extBodies: [
        '저희 아르떼뮤지엄은 모든 공간이 하나의 작품이 될 수 있도록 조명부터 동선까지 세심하게 기획하고 있습니다.',
        '빛과 예술이 만나는 순간을 사진에 담아 간직하실 수 있도록 앞으로도 더욱 감각적인 공간을 만들겠습니다.',
        '방문하시는 분들이 아름다운 사진과 함께 특별한 추억을 간직하실 수 있도록 항상 고민하고 있습니다.',
        '고객님의 사진을 통해 아르떼의 아름다움이 더 많은 분들께 전해진다면 저희에게 큰 보람입니다.',
        '저희가 정성껏 만든 공간을 이렇게 아름다운 사진으로 기록해 주시니 진심으로 감사합니다.',
        '빛, 색채, 그리고 예술이 어우러진 공간에서 고객님만의 특별한 시각으로 담은 장면들이 소중합니다.',
      ],
      closers: [
        '다음 방문에도 새롭고 감각적인 설치 작품들이 기다리고 있겠습니다.',
        '언제든 편하게 찾아주시면 새로운 비주얼로 반겨드리겠습니다.',
        '다음에도 멋진 순간들을 담아 가실 수 있기를 기대합니다.',
        '새로운 전시와 함께 또 다른 아름다운 장면들을 담아 주시면 기쁘겠습니다.',
        '앞으로도 새롭고 감각적인 비주얼로 가득한 공간을 만들어 가겠습니다.',
        '다음에도 아름다운 추억을 아르떼에서 담아 가시길 바랍니다.',
        '더 멋진 비주얼로 다시 뵙기를 기대하겠습니다.',
        '아르떼에서의 아름다운 기록이 계속 이어지기를 바랍니다.',
      ],
    },
    4: {
      openers: [
        '방문해 주시고 후기를 남겨 주셔서 감사합니다.',
        '아르떼에서 사진을 남겨 주시고 솔직한 의견을 주셔서 감사합니다.',
        '방문 후기를 공유해 주셔서 감사드립니다.',
        '아르떼를 찾아주시고 피드백을 남겨 주셔서 감사합니다.',
        '방문해 주시고 소중한 의견을 주셔서 감사합니다.',
        '아르떼에서의 경험을 나눠 주셔서 감사드립니다.',
        '사진을 위해 방문해 주시고 후기까지 남겨 주셔서 감사합니다.',
        '아름다운 순간을 위해 아르떼를 찾아주셔서 감사합니다.',
      ],
      bodies: [
        '아름다운 사진을 찍으셨길 바라며, 아쉬운 부분은 더욱 개선하겠습니다.',
        '고객님의 소중한 의견을 공간 구성에 반영하겠습니다.',
        '더 나은 포토 스팟과 공간을 위해 지속적으로 발전하겠습니다.',
        '사진 촬영 환경 개선을 위해 더욱 노력하겠습니다.',
        '기대에 부응하는 공간이 되기 위해 끊임없이 개선하겠습니다.',
        '고객님의 피드백을 바탕으로 더욱 아름다운 공간을 만들어 가겠습니다.',
        '아쉬운 부분은 소중한 의견으로 받아들이고 빠르게 개선하겠습니다.',
        '더 완벽한 사진 경험을 드릴 수 있도록 노력하겠습니다.',
      ],
      extBodies: [
        '빛과 공간을 더욱 완벽하게 조율하여 고객님의 소중한 순간을 더 아름답게 담을 수 있도록 하겠습니다.',
        '고객님의 의견을 참고하여 더욱 매력적인 포토 스팟을 개발하겠습니다.',
        '사진을 위해 아르떼를 선택해 주신 분들의 기대에 부응할 수 있도록 꾸준히 발전하겠습니다.',
        '조명과 설치물 개선을 통해 더욱 아름다운 사진 환경을 만들겠습니다.',
        '고객님의 소중한 피드백이 더 나은 공간을 만드는 데 직접 도움이 됩니다.',
        '더 감각적이고 아름다운 비주얼 경험을 드릴 수 있도록 최선을 다하겠습니다.',
      ],
      closers: [
        '다음에는 더 멋진 공간으로 맞이하겠습니다.',
        '다음 방문 때는 더 아름다운 장면들을 담아 가실 수 있기를 바랍니다.',
        '더 나아진 모습으로 다시 뵙기를 기대합니다.',
        '더 완성된 포토 환경으로 다시 찾아주시면 감사하겠습니다.',
        '다음에도 멋진 순간을 아르떼에서 담아 가실 수 있도록 준비하겠습니다.',
        '새로운 전시로 더 아름다운 경험을 드리겠습니다.',
        '언제든 찾아주시면 더 나아진 모습으로 맞이하겠습니다.',
        '더욱 감각적인 공간으로 거듭나겠습니다.',
      ],
    },
  },

  // ── staff ────────────────────────────────────────────────────────────────────
  staff: {
    5: {
      openers: [
        '저희 직원들에 대해 이렇게 따뜻하고 고마운 말씀을 남겨 주셔서 진심으로 감사드립니다.',
        '직원에 대한 칭찬의 말씀을 남겨 주셔서 정말 감사합니다.',
        '스태프를 칭찬해 주셔서 저희도 큰 기쁨이 느껴집니다.',
        '이렇게 직원들에 대한 좋은 말씀을 남겨 주셔서 진심으로 감사드립니다.',
        '직원들에게 따뜻한 말씀을 전해 주셔서 저희 팀 모두가 정말 기쁩니다.',
        '스태프에 대한 좋은 후기를 남겨 주셔서 감사합니다.',
        '저희 팀원에 대한 칭찬에 진심으로 감사드립니다.',
        '직원에 대해 이렇게 따뜻한 시선으로 봐주셔서 감사합니다.',
      ],
      bodies: [
        '고객님의 따뜻한 격려가 스태프 한 명 한 명에게 큰 힘이 됩니다.',
        '고객님의 칭찬을 해당 직원에게 직접 전달하여 큰 기쁨이 되도록 하겠습니다.',
        '방문객 한 분 한 분을 소중히 여기는 마음으로 최선을 다하고 있는데, 이렇게 알아봐 주시니 정말 기쁩니다.',
        '저희 스태프들은 모든 방문객분들이 편안하고 즐거운 경험을 하실 수 있도록 매일 최선을 다하고 있습니다.',
        '고객님처럼 따뜻한 마음으로 격려해 주실 때 그 진심이 저희 팀 전체에게 전해집니다.',
        '직원들이 이런 소중한 말씀을 들으면 더욱 열심히 하고 싶어질 것 같습니다.',
        '친절한 서비스를 통해 고객님께 좋은 경험을 드리는 것이 저희 팀의 최우선 목표입니다.',
        '고객님의 칭찬이 저희 직원들에게 최고의 보상이 됩니다.',
      ],
      extBodies: [
        '저희 스태프 한 명 한 명은 방문하시는 모든 분들이 특별한 경험을 하고 돌아가실 수 있도록 항상 노력하고 있습니다.',
        '직원 교육과 서비스 품질 향상을 위해 지속적으로 투자하고 있으며, 이런 칭찬이 그 노력이 결실을 맺고 있음을 알게 해줍니다.',
        '앞으로도 모든 방문객분들께 진심 어린 서비스를 드릴 수 있도록 끊임없이 노력하겠습니다.',
        '고객님의 격려는 저희 직원들이 매일 더 좋은 서비스를 제공하고 싶게 만드는 가장 큰 원동력입니다.',
        '모든 방문객분들께 따뜻하고 전문적인 서비스를 드리기 위해 팀 전체가 함께 노력하고 있습니다.',
        '이런 소중한 말씀이 저희 팀의 서비스 방향이 맞다는 것을 확인해주는 귀한 피드백이 됩니다.',
      ],
      closers: [
        '앞으로도 더 친절하고 전문적인 서비스로 보답하겠습니다.',
        '다음에 다시 뵙기를 기대하겠습니다.',
        '언제든 찾아주시면 더욱 따뜻하게 맞이하겠습니다.',
        '고객님의 다음 방문도 기대하며 항상 준비하겠습니다.',
        '앞으로도 모든 방문객분들께 최선의 서비스를 드리겠습니다.',
        '다음에 또 뵐 수 있다면 더욱 좋은 서비스로 보답하겠습니다.',
        '저희 팀 모두가 다음 만남을 기다리겠습니다.',
        '항상 더 나은 서비스를 위해 노력하는 아르떼가 되겠습니다.',
      ],
    },
    4: {
      openers: [
        '방문해 주시고 후기를 남겨 주셔서 감사합니다.',
        '솔직한 서비스 피드백을 남겨 주셔서 감사드립니다.',
        '방문해 주시고 서비스에 대한 의견을 주셔서 감사합니다.',
        '후기를 통해 소중한 의견을 전해 주셔서 감사합니다.',
        '아르떼를 찾아주시고 직원에 대한 피드백을 주셔서 감사합니다.',
        '방문 후기를 남겨 주셔서 진심으로 감사드립니다.',
        '소중한 서비스 피드백에 감사드립니다.',
        '방문해 주시고 솔직한 의견을 주셔서 감사합니다.',
      ],
      bodies: [
        '서비스 면에서 더 나아질 수 있도록 팀 전체가 더욱 노력하겠습니다.',
        '서비스에 있어 기대에 미치지 못한 부분이 있으셨다면 진심으로 사과드립니다.',
        '고객님의 소중한 의견을 팀 전체와 공유하여 서비스 품질 향상에 반영하겠습니다.',
        '더 친절하고 전문적인 서비스를 드리기 위해 더욱 노력하겠습니다.',
        '부족했던 서비스에 대해 반드시 개선하겠습니다.',
        '고객님의 피드백을 소중히 받아들이고 직원 교육에 반영하겠습니다.',
        '모든 방문객분들께 일관된 수준의 서비스를 드릴 수 있도록 더욱 철저히 준비하겠습니다.',
        '서비스 개선을 위한 귀중한 의견 감사드립니다.',
      ],
      extBodies: [
        '방문하시는 모든 분들이 따뜻하고 친절한 응대를 받으실 수 있도록 교육과 점검을 더욱 강화하겠습니다.',
        '고객님의 의견은 저희 서비스 수준을 높이는 데 가장 직접적인 도움이 됩니다.',
        '각 직원이 방문객 한 분 한 분을 더욱 세심하게 배려할 수 있도록 지속적으로 교육하겠습니다.',
        '서비스의 일관성을 높이기 위해 팀 전체가 함께 노력하겠습니다.',
        '아쉬웠던 부분은 내부 교육과 개선 프로세스에 즉시 반영하겠습니다.',
        '더 나은 서비스 환경을 위해 지속적으로 투자하고 발전하겠습니다.',
      ],
      closers: [
        '다음 방문에는 더 만족스러운 서비스를 경험하실 수 있도록 최선을 다하겠습니다.',
        '더 나아진 서비스로 다시 뵙기를 기대합니다.',
        '항상 더 좋은 서비스를 위해 노력하겠습니다.',
        '다음 방문 때는 더욱 만족스러운 서비스를 드리겠습니다.',
        '고객님의 피드백을 바탕으로 반드시 발전하겠습니다.',
        '언제든 다시 찾아주시면 더 나은 모습으로 맞이하겠습니다.',
        '더욱 전문적이고 친절한 서비스를 준비하겠습니다.',
        '다음 방문을 기대하며 더 나은 서비스를 준비하겠습니다.',
      ],
    },
  },

  // ── cafe ─────────────────────────────────────────────────────────────────────
  cafe: {
    5: {
      openers: [
        '아르떼뮤지엄과 카페까지 함께 즐겨 주셔서 진심으로 감사드립니다.',
        '전시도 카페도 즐겁게 이용해 주셔서 감사합니다!',
        '아르떼 카페까지 사랑해 주셔서 정말 기쁩니다.',
        '전시와 카페 모두 만족스러우셨다니 저희도 매우 기쁩니다.',
        '카페까지 즐겁게 이용해 주시고 좋은 후기를 남겨 주셔서 감사합니다.',
        '전시 관람에 이어 카페까지 함께해 주셔서 감사드립니다.',
        '아르떼의 카페도 마음에 들어 주셔서 저희도 정말 기뻤습니다.',
        '전시와 카페 모두를 즐겨 주셔서 감사합니다.',
      ],
      bodies: [
        '전시 감상 후 카페에서 여유로운 시간을 보내셨다니 기쁩니다.',
        '훌륭한 예술 경험과 맛있는 한 잔이 어우러진 완벽한 방문이 되셨기를 바랍니다.',
        '카페도 마음에 드셨다니 정말 기쁩니다. 전시 관람 후 잠시 쉬어 가는 공간도 아르떼 경험의 소중한 일부라고 생각합니다.',
        '맛있는 음료와 함께한 시간이 전시의 여운을 더욱 오래 간직하는 데 도움이 되었으면 좋겠습니다.',
        '전시와 카페가 하나의 완성된 경험이 될 수 있도록 항상 노력하고 있습니다.',
        '카페에서의 여유로운 시간이 전시의 감동을 더욱 깊게 해드렸으면 합니다.',
        '예술 감상 후 카페에서 그 여운을 즐기는 것도 아르떼만의 특별한 경험이라고 생각합니다.',
        '전시와 카페가 함께 완성되는 아르떼만의 경험을 즐겨 주셔서 감사합니다.',
      ],
      extBodies: [
        '저희는 전시 공간뿐만 아니라 카페와 편의 시설까지, 방문하시는 동안의 모든 순간이 특별하게 느껴질 수 있도록 세심하게 준비하고 있습니다.',
        '앞으로도 더욱 풍성하고 맛있는 메뉴와 분위기로 찾아뵙겠습니다.',
        '카페에서의 경험 또한 아르떼의 예술적 공간과 조화롭게 어우러질 수 있도록 끊임없이 개선하고 있습니다.',
        '전시 관람의 여운을 카페에서도 이어갈 수 있도록 메뉴와 인테리어를 계속 발전시켜 나가겠습니다.',
        '맛과 분위기 모두에서 아르떼다운 감성을 느끼실 수 있는 카페가 되도록 노력하겠습니다.',
        '전시와 카페가 함께 완성되는 아르떼만의 문화 경험을 더욱 풍성하게 만들겠습니다.',
      ],
      closers: [
        '다음에도 전시와 카페 모두 기대해 주시면 감사하겠습니다.',
        '앞으로도 더 맛있고 특별한 메뉴와 분위기로 맞이하겠습니다.',
        '다음에도 전시 감상 후 카페에서 여유로운 시간 보내시길 바랍니다.',
        '더욱 맛있고 감각적인 카페로 다시 뵙기를 기대합니다.',
        '언제든 전시와 함께 카페도 즐겨 주시면 감사하겠습니다.',
        '다음 방문에도 전시와 카페 모두 만족스러운 경험이 되시길 바랍니다.',
        '더 풍성한 카페 경험으로 다시 찾아주시면 반갑겠습니다.',
        '전시와 카페가 함께하는 아르떼의 경험이 계속 이어지기를 바랍니다.',
      ],
    },
    4: {
      openers: [
        '방문해 주시고 카페에 대한 후기를 남겨 주셔서 감사합니다.',
        '전시와 카페를 이용해 주시고 솔직한 피드백을 주셔서 감사합니다.',
        '방문 후기를 공유해 주셔서 감사드립니다.',
        '카페에 대한 솔직한 의견을 남겨 주셔서 감사합니다.',
        '방문해 주시고 소중한 피드백을 주셔서 감사합니다.',
        '전시와 함께 카페도 이용해 주셔서 감사합니다.',
        '카페 경험에 대해 솔직하게 의견을 주셔서 감사드립니다.',
        '방문 후 소중한 후기를 남겨 주셔서 감사합니다.',
      ],
      bodies: [
        '카페에서의 경험이 기대에 미치지 못했다면 진심으로 사과드립니다.',
        '고객님의 의견을 카페 운영팀에 직접 전달하여 메뉴 품질과 서비스 모두 개선될 수 있도록 하겠습니다.',
        '전시 관람만큼이나 카페에서의 시간도 소중하고 즐거운 경험이 되어야 한다고 생각합니다.',
        '카페 서비스와 메뉴 품질을 더욱 개선하겠습니다.',
        '아쉬운 부분이 있으셨다면 적극적으로 개선하겠습니다.',
        '고객님의 피드백을 바탕으로 카페 경험을 더욱 발전시키겠습니다.',
        '더 만족스러운 카페 경험을 드리기 위해 더욱 노력하겠습니다.',
        '카페의 메뉴와 분위기 개선에 더욱 힘쓰겠습니다.',
      ],
      extBodies: [
        '전시의 여운을 카페에서도 느끼실 수 있도록 공간과 메뉴 모두 더욱 세심하게 준비하겠습니다.',
        '고객님의 의견은 카페 운영 개선에 매우 귀중한 자료가 됩니다.',
        '더욱 맛있고 감각적인 카페 경험을 드릴 수 있도록 지속적으로 발전하겠습니다.',
        '음료의 품질과 서비스 모두에서 아르떼의 수준에 맞는 카페가 될 수 있도록 하겠습니다.',
        '카페도 전시 못지않은 특별한 경험이 될 수 있도록 더욱 노력하겠습니다.',
        '고객님의 피드백을 카페 운영팀과 함께 검토하여 실질적인 개선으로 이어지도록 하겠습니다.',
      ],
      closers: [
        '다음에는 더 만족스러운 카페 경험을 드릴 수 있기를 바랍니다.',
        '더 나아진 카페로 다시 뵙기를 기대합니다.',
        '카페도 더욱 발전시켜 다음 방문 때 만족스러운 경험을 드리겠습니다.',
        '전시와 함께 카페에서도 더 좋은 시간이 되시길 바랍니다.',
        '언제든 다시 찾아주시면 더 나아진 카페로 맞이하겠습니다.',
        '더욱 맛있고 특별한 카페 메뉴를 준비하겠습니다.',
        '다음 방문 때는 카페도 더욱 만족스러우시길 바랍니다.',
        '카페와 전시 모두 더 완성된 모습으로 보답하겠습니다.',
      ],
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETURNING VISITOR POOLS (KO)
// ═══════════════════════════════════════════════════════════════════════════════

// Same branch returning
const KO_RETURNING_SAME: ModularRatedPool = {
  5: {
    openers: [
      '다시 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다.',
      '또 만나 뵐 수 있어 정말 반갑습니다!',
      '다시 찾아주셔서 감사합니다. 변함없이 아르떼를 기억해 주시는 덕분에 저희가 더 열심히 할 수 있습니다.',
      '이렇게 또 찾아주셔서 저희 팀 모두가 진심으로 기쁩니다.',
      '재방문해 주셔서 감사합니다. 다시 만나 뵙게 되어 정말 반갑습니다.',
      '다시 아르떼를 찾아주셔서 반갑고 감사합니다.',
      '또 이렇게 찾아주시니 정말 감사하고 기쁩니다.',
      '재방문해 주신 마음이 정말 감사하고 소중합니다.',
    ],
    bodies: [
      '한 번도 소중하지만, 재방문해 주시는 분들을 만날 때마다 저희는 더 큰 보람을 느낍니다.',
      '이번 방문도 즐거운 시간이 되셨길 바라며, 앞으로도 새로운 전시로 보답하겠습니다.',
      '재방문해 주신다는 것은 저희를 신뢰하고 아껴주신다는 뜻이라 더욱 감사한 마음이 듭니다.',
      '재방문 고객님들 덕분에 저희는 더 나은 공간을 만들어야 한다는 자극을 받습니다.',
      '매번 조금씩 새로워지는 아르떼를 발견하는 재미가 있으셨으면 좋겠습니다.',
      '이번에도 새로운 감동이 있으셨기를 진심으로 바랍니다.',
      '고객님이 다시 찾아주신 덕분에 저희도 더 열심히 해야겠다는 다짐이 됩니다.',
      '처음 방문보다 이번 방문이 더욱 특별하게 느껴지셨기를 바랍니다.',
    ],
    extBodies: [
      '한 번의 방문이 인연이 되어 다시 또 찾아주신다는 것이 저희에게는 정말 큰 격려가 됩니다.',
      '오실 때마다 조금씩 발전하는 아르떼의 모습을 발견하시길 바랍니다.',
      '재방문해 주시는 분들의 기대에 걸맞게 더욱 새롭고 감동적인 공간을 만들어 가겠습니다.',
      '아르떼의 빛과 예술이 고객님께 특별한 인연이 되어 기쁩니다.',
      '매번 새로운 감동을 드릴 수 있도록 전시와 공간을 끊임없이 발전시키겠습니다.',
      '저희가 더 열심히 하는 이유 중 하나가 바로 이렇게 다시 찾아주시는 분들 덕분입니다.',
    ],
    closers: [
      '다음에 또 만나 뵐 수 있기를 기대하겠습니다.',
      '다음 방문도 기대하며 준비하겠습니다.',
      '앞으로도 더 아름답고 감각적인 공간으로 보답하겠습니다.',
      '다음에도 새로운 감동이 가득한 아르떼에서 뵙기를 기대합니다.',
      '또 찾아주시면 언제나 반갑게 맞이하겠습니다.',
      '고객님의 다음 방문을 손꼽아 기다리겠습니다.',
      '다음에도 함께할 수 있는 기회가 생기면 정말 기쁘겠습니다.',
      '다음에도 즐거운 시간이 이어지길 바랍니다.',
    ],
  },
  4: {
    openers: [
      '다시 아르떼를 찾아주셔서 감사합니다.',
      '재방문해 주셔서 진심으로 감사드립니다.',
      '다시 방문해 주셔서 반갑고 감사합니다.',
      '또 찾아주셔서 정말 감사합니다.',
      '재방문해 주신 것에 진심으로 감사드립니다.',
      '이번에도 아르떼를 찾아주셔서 감사합니다.',
      '다시 찾아주시니 반갑습니다.',
      '두 번째 방문을 해주셔서 감사합니다.',
    ],
    bodies: [
      '이번 방문에서 아쉬운 부분이 있으셨다면 지난번보다 더 나아진 모습을 보여드리지 못해 아쉽습니다.',
      '재방문해 주시는 고객님의 기대를 충족시킬 수 있도록 더욱 노력하겠습니다.',
      '다시 찾아주신 만큼 더 좋은 경험을 드렸어야 했는데 부족한 부분이 있었다면 죄송합니다.',
      '처음 방문보다 더 나은 경험을 드리는 것이 저희의 목표인데 더욱 분발하겠습니다.',
      '재방문해 주신 고객님의 소중한 피드백을 바탕으로 더욱 발전하겠습니다.',
      '이번에 아쉬우셨던 부분을 개선하여 다음 방문에는 더 만족스러운 경험을 드리겠습니다.',
      '재방문 고객님의 높은 기대에 부응할 수 있도록 더욱 노력하겠습니다.',
      '다시 찾아주신 것에 감사드리며, 이번 경험이 더 완벽하지 못해 아쉽습니다.',
    ],
    extBodies: [
      '고객님의 재방문은 저희에게 큰 격려인 동시에 더 잘해야 한다는 다짐이 됩니다.',
      '처음 방문 때보다 이번 방문이 더 나았으면 하는 저희의 바람이 충분히 전달되지 못한 것 같아 아쉽습니다.',
      '재방문해 주시는 분들을 위해 더욱 새롭고 풍성한 경험을 제공할 수 있도록 끊임없이 발전하겠습니다.',
      '다시 찾아주시는 고객님의 신뢰에 보답하기 위해 더욱 세심하게 준비하겠습니다.',
      '고객님의 솔직한 피드백이 저희를 더 빠르게 발전시켜 줍니다.',
      '재방문해 주신 고객님께 더 완벽한 경험을 드리기 위해 모든 부분을 점검하겠습니다.',
    ],
    closers: [
      '다음 방문에는 분명 더 만족스러운 경험을 드릴 수 있도록 최선을 다하겠습니다.',
      '다음에 또 찾아주시면 더 나아진 모습으로 맞이하겠습니다.',
      '재방문해 주신 믿음에 보답할 수 있도록 더욱 발전하겠습니다.',
      '다음 방문을 기대하며 더 완성된 경험을 준비하겠습니다.',
      '언제든 다시 찾아주시면 더 나은 모습으로 맞이하겠습니다.',
      '고객님의 다음 방문에는 반드시 더 만족스러운 경험을 드리겠습니다.',
      '더욱 발전한 모습으로 다시 뵙기를 기대합니다.',
      '다음에도 아르떼를 찾아주시면 감사하겠습니다.',
    ],
  },
}

// Cross-branch returning: {PREV} and {CURR} are replaced at compose time
const KO_RETURNING_CROSS: ModularRatedPool = {
  5: {
    openers: [
      '{PREV}에 이어 {CURR}까지 찾아주셔서 진심으로 감사드립니다!',
      '이전에 {PREV}도 방문해 주셨는데, 이번에는 {CURR}까지 찾아주셔서 정말 감사합니다.',
      '{PREV} 방문에 이어 {CURR}도 찾아주셨군요. 정말 반갑고 감사합니다.',
      '아르떼의 {PREV}에 이어 {CURR}도 방문해 주셔서 진심으로 감사드립니다.',
      '{PREV}에서의 만남에 이어 {CURR}에서 다시 뵙게 되어 정말 기쁩니다.',
      '{PREV}에 이어 아르떼의 {CURR}도 찾아주셔서 감사합니다.',
    ],
    bodies: [
      '저희 아르떼뮤지엄의 다양한 공간을 경험해 주시는 분들을 만나면 저희도 정말 큰 보람을 느낍니다.',
      '각 지점마다 조금씩 다른 특색과 감동이 있는데, 여러 지점을 찾아주시다니 정말 기쁩니다.',
      '새로운 지점에서도 아르떼의 감동을 다시 경험해 주셔서 감사합니다.',
      '아르떼의 여러 공간을 탐험해 주시는 고객님 덕분에 저희도 더욱 발전하고 싶어집니다.',
      '지점마다 각기 다른 아르떼의 매력을 발견하고 계시다니 저희로서는 정말 감사합니다.',
      '여러 지점을 통해 아르떼의 다양한 면을 경험해 주시는 고객님이 저희에게는 특별한 인연입니다.',
    ],
    extBodies: [
      '각 지점은 고유한 특색을 갖추면서도 아르떼만의 일관된 감동을 전달하기 위해 노력하고 있습니다.',
      '이렇게 다양한 지점을 방문해 주시는 분들 덕분에 저희가 각 공간을 더욱 특별하게 만들어야 한다는 의지가 생깁니다.',
      '아르떼의 모든 지점이 고객님께 새로운 감동과 설렘을 드릴 수 있도록 끊임없이 발전시켜 나가겠습니다.',
      '지점마다 다른 전시와 경험을 통해 아르떼의 세계를 더 깊이 경험하실 수 있도록 준비하겠습니다.',
      '여러 지점을 통해 아르떼와의 인연을 이어가 주시는 것이 저희에게는 최고의 응원입니다.',
      '각 지점의 특색을 살리면서도 어디서든 아르떼다운 감동을 드릴 수 있도록 항상 고민하고 있습니다.',
    ],
    closers: [
      '앞으로도 아르떼뮤지엄의 다양한 공간에서 새로운 감동을 만나시길 바랍니다.',
      '각 지점의 특색 있는 전시와 함께 또 다른 즐거운 경험이 이어지길 바랍니다.',
      '다음에도 아르떼의 어떤 지점에서든 반갑게 뵙기를 기대합니다.',
      '아르떼의 모든 지점이 고객님께 새로운 감동을 드릴 수 있도록 준비하겠습니다.',
      '다음에도 아르떼의 다양한 공간에서 특별한 시간이 되시길 바랍니다.',
      '아르떼와의 소중한 인연이 계속 이어지기를 진심으로 바랍니다.',
    ],
  },
  4: {
    openers: [
      '{PREV}에 이어 {CURR}도 방문해 주셔서 감사합니다.',
      '이전에 {PREV}를 방문해 주셨는데 {CURR}도 찾아주셔서 감사합니다.',
      '{PREV}에 이어 {CURR}까지 방문해 주신 것에 감사드립니다.',
      '{PREV}에서의 방문에 이어 {CURR}도 찾아주셔서 감사합니다.',
      '이전 {PREV} 방문에 이어 이번엔 {CURR}까지 찾아주셔서 감사합니다.',
      '{PREV}와 {CURR} 모두 방문해 주셔서 감사합니다.',
    ],
    bodies: [
      '이번 방문에서 아쉬운 부분이 있으셨다면 다음에는 더 만족스러운 경험을 드리겠습니다.',
      '각 지점이 더욱 특별한 경험을 드릴 수 있도록 계속 발전하겠습니다.',
      '여러 지점을 방문해 주신 만큼 더 좋은 경험을 드렸으면 했는데 아쉬운 부분이 있으셨다면 죄송합니다.',
      '고객님의 소중한 피드백을 해당 지점에 전달하여 개선할 수 있도록 하겠습니다.',
      '각 지점이 고객님의 기대에 부응할 수 있도록 더욱 노력하겠습니다.',
      '이번 방문에서 부족했던 부분은 반드시 개선하겠습니다.',
    ],
    extBodies: [
      '여러 지점을 방문해 주시는 고객님의 소중한 경험이 저희 전체 운영 개선에 큰 도움이 됩니다.',
      '각 지점의 수준을 균일하게 높이기 위해 지속적으로 노력하겠습니다.',
      '아르떼의 모든 지점이 동일한 수준의 감동을 드릴 수 있도록 더욱 철저히 준비하겠습니다.',
      '고객님의 크로스 지점 경험을 바탕으로 각 지점이 함께 발전할 수 있도록 하겠습니다.',
      '여러 지점을 경험해 주시는 분들의 소중한 의견은 저희 운영에 특히 귀중합니다.',
      '각 지점이 더욱 특색 있고 완성도 높은 경험을 드릴 수 있도록 노력하겠습니다.',
    ],
    closers: [
      '다음에도 아르떼의 여러 지점에서 더 만족스러운 경험이 되시길 바랍니다.',
      '앞으로도 더 나아진 아르떼의 모습을 발견해 주시길 기대합니다.',
      '다음 방문 때는 어느 지점에서든 더욱 만족스러운 경험을 드리겠습니다.',
      '아르떼의 모든 지점이 더욱 발전한 모습으로 뵙겠습니다.',
      '다음에도 아르떼를 찾아주시면 감사하겠습니다.',
      '더욱 발전한 모습으로 다시 뵙기를 기대합니다.',
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENGLISH MODULAR POOLS
// ═══════════════════════════════════════════════════════════════════════════════

const EN_POOLS: Partial<ModularContextPool> = {
  general: {
    5: {
      openers: [
        'Thank you so much for visiting ARTE Museum and for leaving such a heartfelt review.',
        'What a wonderful review — thank you for taking the time to share your experience with us.',
        'We\'re genuinely touched by your kind words — thank you so much for visiting.',
        'Thank you for visiting ARTE Museum and for this incredibly generous review.',
        'It means a great deal to our whole team to read words like yours — thank you.',
        'Thank you so much for choosing ARTE Museum and for sharing such a lovely review.',
        'Your kind words made our whole team\'s day — thank you so much for visiting.',
        'We\'re so glad you had a wonderful time, and thank you for telling us about it.',
      ],
      bodies: [
        'Reviews like yours remind us why we do what we do, and they inspire the whole team to keep pushing the work forward.',
        'Every detail you experience here — from the lighting to the layout — is something we\'ve thought deeply about, and knowing it resonated with you is incredibly encouraging.',
        'We put a tremendous amount of care into crafting an experience that stays with you, and hearing that it did is the greatest reward.',
        'It\'s guests like you who inspire us to keep evolving and creating new, meaningful experiences.',
        'Knowing that the experience genuinely moved you is exactly what we set out to achieve.',
        'Your feedback is a wonderful reminder of why this work matters so much to us.',
        'ARTE Museum exists to be more than just an exhibition — we want every visitor to walk away feeling genuinely moved.',
        'We always strive to create moments that linger long after you\'ve left, and it\'s wonderful to know we succeeded.',
      ],
      extBodies: [
        'We\'re always evolving — new installations, new stories to tell through light and art.',
        'Our team invests enormous care and creativity into every aspect of the experience.',
        'We want every visitor to walk away feeling as though they\'ve stepped briefly outside of everyday life.',
        'Your words are a wonderful reminder of why that mission matters so deeply to us.',
        'We\'re so grateful for guests like you who take the time to reflect on what they\'ve experienced.',
        'Every piece of positive feedback fuels our passion to keep creating and innovating.',
      ],
      closers: [
        'We truly hope to have the pleasure of welcoming you again.',
        'We\'d love to have you back whenever the time feels right.',
        'We hope to see you again very soon!',
        'We look forward to welcoming you back.',
        'We sincerely hope to see you again before too long.',
        'Thank you again — we hope to have the honour of your visit once more.',
        'We\'d be delighted to welcome you back for our next chapter.',
        'We hope your next visit brings equally wonderful memories.',
      ],
    },
    4: {
      openers: [
        'Thank you for visiting ARTE Museum and for sharing your honest thoughts with us.',
        'We really appreciate you taking the time to leave a review — it helps us grow.',
        'Thank you for your visit and for this thoughtful, honest feedback.',
        'We\'re grateful for your honest review — feedback like yours is invaluable.',
        'Thank you for visiting and for taking the time to share your experience.',
        'We appreciate your honest feedback — it genuinely helps us improve.',
        'Thank you for the visit and for leaving such a candid review.',
        'We\'re glad you came, and we appreciate you sharing your thoughts with us.',
      ],
      bodies: [
        'We\'re really glad you had a good time overall, and we genuinely appreciate feedback that helps us improve.',
        'We\'ll take your feedback on board as we continue to develop and improve what we offer.',
        'If there were any moments that didn\'t quite hit the mark, please know we take that seriously.',
        'Every piece of feedback is a real opportunity for us to grow, and we don\'t take that lightly.',
        'We\'re happy you enjoyed the visit, and any areas where we fell short are things we\'re actively working on.',
        'Our goal is for every visitor to leave feeling genuinely inspired and taken care of.',
        'We\'re always looking for ways to improve, and feedback like yours points us in the right direction.',
        'When any part of the experience doesn\'t land perfectly, it matters to us and we work to address it.',
      ],
      extBodies: [
        'We hope to have the opportunity to welcome you back and demonstrate how seriously we take your thoughts.',
        'We\'d love the chance to show you how far we\'ve come on a future visit.',
        'Your honest perspective helps us understand where we can do better.',
        'We\'re committed to making each visit better than the last.',
        'The details you\'ve shared will help us refine and improve the experience.',
        'We\'re grateful for guests who take the time to give us constructive feedback.',
      ],
      closers: [
        'We hope to have the chance to give you an even better experience next time.',
        'We\'d love the opportunity to show you how much we\'ve grown on your next visit.',
        'We hope to see you again and make it a truly memorable experience.',
        'Thank you again, and we hope to welcome you back soon.',
        'We look forward to the opportunity to exceed your expectations next time.',
        'We hope your next visit leaves you with nothing but great memories.',
        'We\'d love to have you back and show you what we\'ve been working on.',
        'Thank you for giving us the chance to do better next time.',
      ],
    },
  },
}

const EN_RETURNING_SAME: ModularRatedPool = {
  5: {
    openers: [
      'Welcome back to ARTE Museum — it genuinely means so much to us that you\'ve returned!',
      'We\'re so happy to see you again — thank you for coming back.',
      'What a wonderful surprise to have you back with us — thank you.',
      'Returning visitors hold a very special place for our team, and you\'re a wonderful example.',
      'Welcome back! Knowing you chose to return means everything to us.',
      'It\'s so lovely to have you back — thank you for giving us another chance to impress.',
      'We\'re thrilled to see you again at ARTE Museum.',
      'Welcome back — we\'re so glad you came.',
    ],
    bodies: [
      'Knowing you\'ve visited before and chose to return means more than a simple thank-you can capture.',
      'It tells us that something about what we do genuinely resonated with you, and we\'re grateful for that.',
      'We hope this visit brought something new and equally memorable.',
      'Returning guests inspire us to keep evolving so every visit feels fresh and worthwhile.',
      'There is something truly meaningful about a repeat visit.',
      'We put enormous care into making sure each visit feels different — worth coming back for.',
      'It\'s the greatest affirmation that we\'re doing something right when guests choose to return.',
      'We hope each visit reveals something new to love about ARTE.',
    ],
    extBodies: [
      'We\'re always adding new layers to the experience, and we hope you noticed something fresh this time.',
      'Your loyalty means the world to us, and we want every return visit to feel like a step forward.',
      'We\'re so grateful that you\'ve made ARTE Museum a part of your regular world.',
      'Knowing you came back fuels our passion to keep creating and evolving.',
      'We try to make sure there\'s always something new to discover on each visit.',
      'Your continued support is the most meaningful encouragement we could receive.',
    ],
    closers: [
      'We hope to have the honour of welcoming you back once more.',
      'We look forward to seeing you again — and again after that!',
      'We sincerely hope to welcome you back for many visits to come.',
      'We\'d be so glad to see you again.',
      'We look forward to your next visit already.',
      'We hope this becomes a place you return to again and again.',
      'We\'d love to keep this wonderful tradition going.',
      'Thank you, truly — we hope to see you soon.',
    ],
  },
  4: {
    openers: [
      'Great to see you back at ARTE Museum — thank you for returning.',
      'Thank you for coming back to visit us again.',
      'We\'re glad you chose to return — thank you.',
      'Welcome back, and thank you for giving us another opportunity.',
      'It means a lot that you came back — thank you.',
      'We\'re happy to see you again, and we appreciate the honest feedback.',
      'Thank you for returning to ARTE Museum.',
      'Welcome back — we\'re glad you\'re here.',
    ],
    bodies: [
      'We know returning guests have higher expectations, and rightly so — we\'ll keep working to meet them.',
      'If this visit left anything to be desired, we take that seriously.',
      'We want every visit to feel like a step forward, not just a repeat of before.',
      'Your continued support and honest feedback are invaluable to us.',
      'We\'re committed to making sure each visit is better than the last.',
      'If we didn\'t quite hit the mark this time, that\'s something we genuinely want to fix.',
      'We appreciate your patience and trust in giving us another chance.',
      'Repeat visitors deserve the very best, and we\'ll work harder to deliver it.',
    ],
    extBodies: [
      'We\'re grateful for your loyalty and want to make sure it\'s always rewarded.',
      'We\'re listening carefully to what returning guests tell us — it\'s the most valuable feedback we receive.',
      'We want every return visit to feel like an upgrade on the last.',
      'Your honest assessment helps us understand where we still need to grow.',
      'We\'re working on improvements that we hope you\'ll notice next time.',
      'Thank you for sticking with us — we won\'t take that for granted.',
    ],
    closers: [
      'We hope to welcome you back again and give you an experience that truly reflects how much your trust means to us.',
      'We\'d love to show you how seriously we take your feedback on your next visit.',
      'We hope to see you again soon and show you how much we\'ve grown.',
      'Thank you for coming back — we\'d love to earn another visit from you.',
      'We\'re working hard to make your next visit the best one yet.',
      'We hope to welcome you back and show you what we\'ve been working on.',
      'We look forward to the chance to do better next time.',
      'We sincerely hope you\'ll give us another opportunity.',
    ],
  },
}

const EN_RETURNING_CROSS: ModularRatedPool = {
  5: {
    openers: [
      'Welcome back to ARTE Museum! We\'re so glad you\'ve visited us at {CURR} after your time at {PREV}.',
      'How wonderful that you\'ve followed your visit to {PREV} with a trip to {CURR} — thank you!',
      'After {PREV}, you\'ve now visited us at {CURR} too — that genuinely means the world to us.',
      'We\'re thrilled to welcome you to {CURR} after your visit to {PREV}!',
      'Your journey from {PREV} to {CURR} is something we\'re truly grateful for.',
      'What a delight to welcome you to {CURR}, having already experienced {PREV}!',
    ],
    bodies: [
      'Each ARTE location carries its own character and story, and we love knowing you\'re exploring them.',
      'Visiting multiple locations shows a real connection to what we do, and we\'re so grateful for that.',
      'We hope {CURR} brought its own unique magic alongside what you loved at {PREV}.',
      'Each location is crafted with distinct energy while sharing the same spirit of light and wonder.',
      'Knowing you chose to explore another ARTE location is the greatest compliment you could give us.',
      'We hope the two visits together have deepened your connection with the world of ARTE.',
    ],
    extBodies: [
      'Each ARTE location is designed with its own identity, and we love that guests are discovering the differences.',
      'We work hard to make sure each location offers something fresh, even for those who\'ve been to another.',
      'Your cross-location visits inspire us to keep each space distinctive and worth the journey.',
      'We\'re always evolving each location to ensure returning guests always find something new.',
      'It means everything to us that you\'re exploring what ARTE has to offer across different places.',
      'We hope every ARTE location you visit feels like a worthy continuation of your journey with us.',
    ],
    closers: [
      'We hope to see you at many more ARTE locations in the future!',
      'We look forward to welcoming you back — at {CURR} or wherever your next ARTE adventure takes you.',
      'We hope this is just the beginning of a long journey with ARTE.',
      'Thank you for exploring ARTE with such curiosity and loyalty.',
      'We\'d love to have you back — here, or at any of our other locations.',
      'We hope each ARTE visit adds a new chapter to your story with us.',
    ],
  },
  4: {
    openers: [
      'Thank you for visiting {CURR} after your experience at {PREV}.',
      'We\'re glad you chose to visit {CURR} following your time at {PREV}.',
      'Thank you for continuing your ARTE journey here at {CURR}.',
      'We appreciate you visiting {CURR} after experiencing {PREV}.',
      'Thank you for exploring another ARTE location after {PREV}.',
      'We\'re grateful you chose to visit us here at {CURR} as well.',
    ],
    bodies: [
      'If this visit didn\'t quite match your hopes, we genuinely want to improve.',
      'We\'re committed to making sure every ARTE location delivers a consistent, high standard.',
      'Guests who visit multiple locations give us invaluable insight into where we can grow.',
      'We take feedback from cross-location visitors especially seriously.',
      'We want every ARTE location to live up to the same high standard.',
      'Your comparison across locations is exactly the kind of feedback that helps us improve.',
    ],
    extBodies: [
      'We\'re working to ensure every location delivers the same quality and care.',
      'Your experience across locations helps us identify gaps and areas for improvement.',
      'We appreciate the trust you\'re placing in us by visiting multiple locations.',
      'We\'re committed to ensuring that every ARTE location exceeds expectations.',
      'Your multi-location perspective is incredibly valuable to us as we grow.',
      'We\'re grateful for the chance to learn from your experience at both locations.',
    ],
    closers: [
      'We hope your next ARTE visit — wherever it may be — leaves you with nothing but great memories.',
      'We look forward to welcoming you back and showing you how we\'ve improved.',
      'Thank you for your continued support — we won\'t let you down next time.',
      'We hope to see you again, at {CURR} or elsewhere in the ARTE family.',
      'We\'re working hard to make every location worth the visit.',
      'Thank you for exploring ARTE with us — we hope to see you again soon.',
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHINESE & JAPANESE (expanded pool approach)
// ═══════════════════════════════════════════════════════════════════════════════

const ZH_5: string[] = [
  '非常感谢您莅临ARTE Museum，并留下如此温暖的评价！您的认可是我们不断前行的动力。我们始终致力于用光与艺术为每一位宾客带来独特的感动。诚挚期待与您再次相聚。',
  '衷心感谢您对ARTE Museum的支持与厚爱！能让您在这里度过愉快而难忘的时光，是我们最大的荣幸。我们将持续带来更多富有创意的展览，希望与您共同探索更多精彩。期待与您再次相遇。',
  '感谢您的光临与真诚评价，您的满意是我们最好的鼓励。ARTE Museum将一如既往地用心打造每一个细节，期待有幸再次为您服务。',
  '感谢您莅临ARTE Museum并留下宝贵的评价。我们深知每一位宾客的到来都是对我们的信任与支持，因此我们将不断提升展览品质与服务水准。衷心期待能再次与您相遇，共同探索光与艺术的无限魅力。',
  '您的到来与真诚的评价让我们深感荣幸。ARTE Museum一直致力于通过光与艺术的融合，为每一位访客创造难忘的体验。感谢您的认可，我们将以此为动力继续前行，期待再次与您相遇。',
  '感谢您的光顾与温暖的评价！每一位客人的到来对我们来说都是宝贵的缘分。我们将继续精心策划每一个细节，为您和所有来宾呈现最美好的艺术体验。期待与您再次相逢。',
  '非常感谢您莅临ARTE Museum，您的满意与好评是我们最大的骄傲与动力。我们深知唯有不断创新与用心才能不辜负每一位访客的期待，我们将继续以全心全意的态度提供最优质的艺术体验。期待您的再次莅临。',
  '您的美好评价让我们深受鼓舞。我们ARTE Museum团队将您的满意视为最高荣誉，并将持续努力为您打造更多光与艺术交织的美妙瞬间。感谢您的支持，衷心期待再次与您相聚。',
]
const ZH_4: string[] = [
  '感谢您百忙之中莅临ARTE Museum，并惠赐宝贵意见。很高兴您整体上留下了愉快的印象，若有任何不尽如人意之处，我们将认真改进。期待有机会为您带来更臻完善的体验。',
  '非常感谢您的光临与诚恳的评价。您的意见对我们弥足珍贵，我们将以此为契机，不断提升展览质量与服务水平。希望下次能够给您留下更完美的印象，期待再次相遇。',
  '感谢您莅临ARTE Museum并分享您的宝贵意见。能为您带来整体愉快的体验我们感到欣慰，对于不足之处我们将认真审视并积极改善。期待下次能以更好的面貌迎接您的到来。',
  '感谢您对ARTE Museum的支持与宝贵意见。我们十分重视每一位访客的反馈，并将以您的建议为指引，不断完善我们的展览与服务。期待在改善之后再次有幸为您提供更佳的体验。',
]

const JA_5: string[] = [
  'この度はARTE Museumにご来館いただき、温かいレビューまでお寄せいただき、誠にありがとうございます。光とデジタルアートを通じて、皆さまに特別なひとときをお届けできたのであれば、これ以上の喜びはございません。またのご来館を心よりお待ち申し上げております。',
  '素晴らしいご評価をいただき、スタッフ一同大変光栄に存じます。お客様のお言葉が、私たちがより良い体験をつくり続けるための原動力となっております。引き続き新しいアート体験をお届けできるよう尽力してまいりますので、またのご来館を楽しみにお待ちしております。',
  'ご来館ならびに温かいご感想をいただき、誠にありがとうございます。楽しいひとときをお過ごしいただけたとのこと、スタッフ一同たいへん嬉しく思っております。ARTE Museumはこれからも光と芸術を通じて、皆さまの心に残る特別な空間であり続けられるよう努めてまいります。またの機会にぜひお越しいただけますと幸いです。',
  'この度はARTE Museumをご利用いただき、誠にありがとうございます。また、温かいレビューをお寄せくださいましたことに、心より感謝申し上げます。お客様に喜んでいただけることが、私どもスタッフ全員にとって何より大きな励みとなっております。今後もさらに充実したアート体験をご提供できますよう、日々精進してまいります。またのお越しを心よりお待ち申し上げております。',
  'ご来館いただきまして、誠にありがとうございます。このような嬉しいご感想をいただき、スタッフ一同たいへん励まされております。ARTE Museumは、お客様一人ひとりに特別な感動をお届けできるよう、照明から展示物の配置に至るまで細部にわたり丁寧に設計しております。今後もより一層素晴らしい体験をご提供できるよう努力してまいります。またのご来館を心よりお待ち申し上げております。',
  'この度はARTE Museumへのご来館、誠にありがとうございます。また、大変ありがたいレビューをお寄せいただき、重ねてお礼申し上げます。お客様に光とアートの世界をお楽しみいただけましたこと、スタッフ一同大変嬉しく思っております。皆さまの温かいご支援があればこそ、私どもはより高い目標に向かって歩み続けることができます。またのご来館を心よりお待ちしております。',
]
const JA_4: string[] = [
  'ご来館いただき、率直なご感想をお寄せいただきありがとうございます。全体的にご満足いただけたとのこと、安心いたしました。ご期待に沿えなかった点につきましては、真摯に受け止め改善に努めてまいります。またのご来館の機会に、より充実したお時間をご提供できますよう精進いたします。',
  'この度はARTE Museumにご来館いただき、また貴重なご意見をお寄せいただき誠にありがとうございます。概ねご満足いただけたとのことで安堵しております。ご満足いただけなかった点につきましては、今後の改善に向けて真摯に取り組んでまいります。次回はより良いご体験をご提供できますよう努力してまいります。またのお越しをお待ち申し上げております。',
  'ご来館いただき、誠にありがとうございます。率直なご意見をお聞かせいただけましたことに、心より感謝申し上げます。いただきましたフィードバックを真摯に受け止め、サービス品質の向上に役立ててまいります。次回のご来館では、よりご満足いただける体験をご提供できますよう、スタッフ一同精進してまいります。またのお越しを心よりお待ちしております。',
]

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutoReplyResult {
  draft_short: string
  draft_standard: string
  draft_careful: string
  detected_language: string
  sentiment: 'positive'
  risk_level: 'low'
  categories: string[]
  risk_reasons: string[]
  internal_note_ko: string
  forbidden_check: { refund_promise: false; legal_admission: false; cctv_mention: false; staff_discipline: false }
}

function replaceBranch(text: string, prev: string, curr: string): string {
  return text.replace(/\{PREV\}/g, prev).replace(/\{CURR\}/g, curr)
}

function composeWithBranch(
  pool: ModularRatedPool,
  reviewId: string,
  type: 'short' | 'standard' | 'careful',
  tier: 4 | 5,
  prev: string,
  curr: string,
): string {
  const t = pool[tier]
  const raw = compose(t, reviewId, type)
  return replaceBranch(raw, prev, curr)
}

export function generateAutoReply(
  reviewId: string,
  rating: number,
  text: string | null,
  visitorInfoOrLegacy: VisitorInfo | boolean = false,
): AutoReplyResult {
  const lang  = detectLang(text ?? '')
  const tier: 4 | 5 = rating >= 5 ? 5 : 4
  const ctx   = detectContext(text ?? '')

  // Back-compat: accept raw boolean (old callers)
  const vi: VisitorInfo = typeof visitorInfoOrLegacy === 'boolean'
    ? { isReturning: visitorInfoOrLegacy, isCrossBranch: false, previousBranchNames: [] }
    : visitorInfoOrLegacy

  const { isReturning, isCrossBranch, previousBranchNames, currentBranchName } = vi
  const prevBranch = previousBranchNames[0] ?? '이전 지점'
  const currBranch = currentBranchName ?? '이 지점'

  let short: string, standard: string, careful: string

  if (lang === 'ko') {
    if (isReturning && isCrossBranch) {
      const pool = KO_RETURNING_CROSS[tier]
      short    = replaceBranch(pickAt(pool.openers,    reviewId, 0), prevBranch, currBranch)
      standard = replaceBranch(`${pickAt(pool.openers, reviewId, 0)} ${pickAt(pool.bodies, reviewId, 1)} ${pickAt(pool.closers, reviewId, 2)}`, prevBranch, currBranch)
      careful  = replaceBranch(`${pickAt(pool.openers, reviewId, 0)} ${pickAt(pool.bodies, reviewId, 1)} ${pickAt(pool.extBodies, reviewId, 3)} ${pickAt(pool.closers, reviewId, 2)}`, prevBranch, currBranch)
    } else if (isReturning) {
      short    = compose(KO_RETURNING_SAME[tier], reviewId, 'short')
      standard = compose(KO_RETURNING_SAME[tier], reviewId, 'standard')
      careful  = compose(KO_RETURNING_SAME[tier], reviewId, 'careful')
    } else {
      const pool = (KO_POOLS[ctx] ?? KO_POOLS.general)[tier]
      short    = compose(pool, reviewId, 'short')
      standard = compose(pool, reviewId, 'standard')
      careful  = compose(pool, reviewId, 'careful')
    }
  } else if (lang === 'en') {
    if (isReturning && isCrossBranch) {
      short    = composeWithBranch(EN_RETURNING_CROSS, reviewId, 'short',    tier, prevBranch, currBranch)
      standard = composeWithBranch(EN_RETURNING_CROSS, reviewId, 'standard', tier, prevBranch, currBranch)
      careful  = composeWithBranch(EN_RETURNING_CROSS, reviewId, 'careful',  tier, prevBranch, currBranch)
    } else if (isReturning) {
      short    = compose(EN_RETURNING_SAME[tier], reviewId, 'short')
      standard = compose(EN_RETURNING_SAME[tier], reviewId, 'standard')
      careful  = compose(EN_RETURNING_SAME[tier], reviewId, 'careful')
    } else {
      const enCtx = (EN_POOLS[ctx] ?? EN_POOLS.general) as ModularRatedPool
      short    = compose(enCtx[tier], reviewId, 'short')
      standard = compose(enCtx[tier], reviewId, 'standard')
      careful  = compose(enCtx[tier], reviewId, 'careful')
    }
  } else if (lang === 'zh') {
    const pool = tier === 5 ? ZH_5 : ZH_4
    standard = pickAt(pool, reviewId, 0)
    short    = standard.split('。')[0] + '。'
    careful  = standard + (tier === 5
      ? ' 我们将持续以真诚之心为每一位宾客创造美好体验，感谢您一路以来的支持与信任。'
      : ' 您的宝贵意见我们将认真对待，期待下次能以更完善的面貌与您再度相遇。')
  } else {
    // Japanese
    const pool = tier === 5 ? JA_5 : JA_4
    standard = pickAt(pool, reviewId, 0)
    short    = standard.split('。')[0] + '。'
    careful  = standard + (tier === 5
      ? ' 皆さまの温かいご支援があればこそ、私どもはより高い目標に向かって歩み続けることができます。心より感謝申し上げます。'
      : ' お客様のご意見を真摯に受け止め、スタッフ一同さらなるサービス向上に努めてまいります。またのお越しをお待ち申し上げております。')
  }

  const categories = [ctx]
  const noteCtx = isReturning ? (isCrossBranch ? '타지점 재방문' : '재방문 고객') : ctx
  const noteLang: Record<string, string> = { ko: '한국어', en: '영어', zh: '중국어', ja: '일본어' }

  return {
    draft_short:       short,
    draft_standard:    standard,
    draft_careful:     careful,
    detected_language: lang,
    sentiment:         'positive',
    risk_level:        'low',
    categories,
    risk_reasons:      [],
    internal_note_ko:  `알고리즘 자동 생성 (${rating}★, ${noteLang[lang] ?? lang}, 맥락: ${noteCtx})`,
    forbidden_check:   { refund_promise: false, legal_admission: false, cctv_mention: false, staff_discipline: false },
  }
}

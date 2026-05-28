/**
 * Rule-based auto reply generator for ARTE Museum.
 * Detects review context (family, couple, photo, staff, café, etc.)
 * and selects from high-quality, context-matched template pools.
 * Zero AI tokens consumed.
 *
 * Language policy:
 *  KO — warm but never commanding; no "또 오세요 / 꼭 오세요"
 *  EN — native English customer-service register, not translated Korean
 *  ZH — authentic Chinese hospitality phrasing (繁/简)
 *  JA — proper Japanese keigo, not direct translation
 */

// ─── Risk signals ─────────────────────────────────────────────────────────────
const RISK_KO = [
  '환불', '보상', '배상', '소송', '고소', '법적', '변호사', '사고', '부상',
  '다쳤', '병원', '언론', '기자', '방송', 'cctv', '차별', '위생', '불결',
  '유포', '신고', '처벌', '징계', '불만', '형편없',
]
const RISK_EN = [
  'refund', 'compensation', 'lawsuit', 'sue', 'legal', 'lawyer', 'attorney',
  'accident', 'injury', 'injured', 'hospital', 'media', 'press',
  'discrimination', 'racist', 'hygiene', 'unsanitary', 'dangerous',
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

  if (t.length > 220)
    return { canAuto: false, reason: '긴 리뷰 — AI 분석이 더 정확합니다.' }

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

// ─── Template pools ───────────────────────────────────────────────────────────
type DraftPool = { short: string[]; standard: string[]; careful: string[] }
type RatedPool = { 5: DraftPool; 4: DraftPool }
type Pool = Record<Context, RatedPool>

// ── Korean ────────────────────────────────────────────────────────────────────
// 재방문 유도 원칙: 명령형("오세요") 금지 → 희망/기대 표현으로 부드럽게
const KO: Pool = {
  general: {
    5: {
      short: [
        '아르떼뮤지엄을 찾아주셔서 감사합니다! 다음에도 좋은 시간이 되시길 바랍니다 :)',
        '따뜻한 후기 남겨 주셔서 저희도 정말 기쁩니다. 다음에도 좋은 인연으로 이어지면 좋겠습니다.',
        '이렇게 좋은 말씀 주셔서 감사합니다. 다음 방문도 기대하겠습니다!',
        '소중한 후기 감사드립니다. 다음에도 함께할 수 있다면 정말 기쁠 것 같습니다.',
      ],
      standard: [
        '아르떼뮤지엄을 찾아주시고 이렇게 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다. 고객님의 방문이 저희에게는 언제나 특별한 의미가 있습니다. 더 새롭고 감동적인 작품으로 계속 성장하는 아르떼뮤지엄이 되겠습니다. 다음에도 특별한 시간이 되시길 바랍니다!',
        '소중한 후기를 남겨 주셔서 진심으로 감사드립니다. 고객님처럼 즐겁게 방문해 주시는 분들 덕분에 저희 팀 모두가 더욱 열심히 할 수 있습니다. 항상 새로운 예술 경험을 드릴 수 있도록 최선을 다하겠습니다. 다음에 다시 만나 뵐 수 있으면 좋겠습니다.',
        '방문해 주신 것만으로도 감사한데, 이렇게 좋은 후기까지 남겨 주셔서 더욱 감사합니다. 빛과 디지털 아트 속에서 즐거운 시간 보내셨길 바랍니다. 저희는 매 전시마다 새로운 감동을 드리기 위해 끊임없이 준비하고 있습니다. 언제든 편하게 찾아주시면 반갑겠습니다.',
        '이렇게 좋은 말씀을 남겨 주셔서 감사합니다. 아르떼뮤지엄이 고객님께 특별한 추억이 되었으면 합니다. 앞으로도 더욱 풍성하고 감각적인 전시로 보답하겠습니다. 다음에도 좋은 인연 이어지길 바랍니다.',
      ],
      careful: [
        '아르떼뮤지엄을 찾아주시고 이렇게 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다. 고객님의 한 마디 한 마디가 저희 팀 모두에게 큰 힘이 되고, 더 열심히 하고 싶은 원동력이 됩니다. 저희 아르떼뮤지엄은 단순한 전시 공간을 넘어, 방문하시는 모든 분들이 빛과 예술 속에서 일상을 잠시 내려놓고 깊은 감동을 느끼실 수 있는 공간이 되고자 합니다. 앞으로도 새로운 콘텐츠와 전시로 꾸준히 성장하는 모습 보여드리겠습니다. 고객님처럼 아껴 주시는 분들 덕분에 저희가 이 자리에 있을 수 있습니다. 다음에도 함께할 수 있는 기회가 생기면 정말 기쁠 것 같습니다.',
        '소중한 시간 내어 아르떼뮤지엄을 방문해 주시고, 따뜻한 후기까지 남겨 주셔서 깊이 감사드립니다. 즐거운 경험이 되셨다니 저희에게 이보다 큰 보람은 없습니다. 저희는 방문객 한 분 한 분이 특별한 감동을 안고 돌아가실 수 있도록, 공간 구성부터 작품 선정까지 세심하게 준비하고 있습니다. 고객님의 긍정적인 후기는 저희 팀 전원에게 진심 어린 감사와 격려가 됩니다. 앞으로도 더 아름답고 인상적인 전시로 꾸준히 성장하겠습니다. 다음에 다시 뵐 수 있는 날을 기대하겠습니다.',
      ],
    },
    4: {
      short: [
        '후기 감사합니다! 더 나은 모습으로 다시 뵐 수 있으면 좋겠습니다.',
        '방문해 주셔서 감사합니다. 다음에는 더 만족스러운 경험이 되도록 노력하겠습니다.',
        '소중한 후기 감사드립니다. 항상 발전하는 아르떼가 되겠습니다.',
      ],
      standard: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다. 즐거운 시간이 되셨다니 다행이고, 아쉬운 점이 있으셨다면 앞으로 더욱 개선하겠습니다. 고객님의 소중한 피드백이 저희가 발전할 수 있는 원동력이 됩니다. 다음에는 더욱 완성된 모습으로 뵙기를 바랍니다.',
        '소중한 후기 감사드립니다. 전반적으로 좋은 경험을 하셨다니 기쁩니다. 부족한 부분이 있었다면 더 나은 서비스를 만들어 갈 수 있는 소중한 기회로 삼겠습니다. 다음 방문에는 더욱 만족스러운 경험이 되도록 최선을 다하겠습니다.',
        '후기 남겨 주셔서 감사합니다. 대체로 좋은 시간을 보내셨다니 저희도 기쁩니다. 아쉬운 부분은 귀중한 의견으로 받아들이고 지속적으로 개선해 나가겠습니다. 언제든 찾아주시면 더 나아진 모습으로 맞이하겠습니다.',
      ],
      careful: [
        '방문해 주시고 솔직하고 소중한 후기를 남겨 주셔서 진심으로 감사드립니다. 좋은 시간을 보내셨다니 정말 다행이고 기쁩니다. 완벽하게 만족스러운 경험이 되지 못한 부분이 있으셨다면, 저희가 부족했던 것이고 앞으로 반드시 개선해 나가겠습니다. 고객님의 한 마디가 저희 서비스와 전시 품질을 높이는 데 직접적인 도움이 됩니다. 더 좋은 모습, 더 감동적인 전시로 보답하기 위해 꾸준히 노력하겠습니다. 다음에는 더욱 만족스러운 방문이 되시길 진심으로 바랍니다.',
      ],
    },
  },

  family: {
    5: {
      short: [
        '소중한 가족과 함께 찾아주셔서 감사합니다! 다음에도 행복한 시간이 이어지길 바랍니다.',
        '가족과 함께하신 방문, 저희에게도 정말 기쁜 순간이었습니다. 좋은 추억이 오래 남으시길 바랍니다!',
      ],
      standard: [
        '소중한 가족과 함께 아르떼뮤지엄을 찾아주셔서 감사합니다. 온 가족이 함께 빛과 예술의 세계를 경험하셨다니 저희도 정말 행복합니다. 아이들이 눈을 반짝이며 작품을 바라보는 모습을 상상하니 저희도 미소가 지어집니다. 가족과 함께한 그 특별한 시간이 오래도록 기억에 남으시길 바랍니다.',
        '가족과 함께 특별한 하루를 아르떼뮤지엄에서 보내 주셔서 감사합니다. 사랑하는 가족과 나눈 감동이 소중한 추억으로 오래 남길 바랍니다. 어른도 아이도 모두 즐길 수 있는 공간이 되기 위해 저희도 매일 고민하고 있습니다. 다음에도 함께하실 수 있는 기회가 생기면 좋겠습니다.',
      ],
      careful: [
        '소중한 가족과 함께 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다. 온 가족이 빛과 예술 속에서 함께 웃고 감동받으셨다면, 저희로서는 이보다 큰 보람이 없습니다. 아이들의 눈높이에서도, 어른들의 감성에서도 모두 의미 있는 경험이 될 수 있는 공간을 만들기 위해 항상 고민하고 있습니다. 가족이 함께하는 시간이 아르떼뮤지엄과 함께 더욱 특별해지길 바랍니다. 고객님의 따뜻한 후기 덕분에 저희 팀 전체가 더 열심히 할 수 있습니다. 다음에도 가족과 함께 즐거운 시간 이어지기를 바랍니다.',
      ],
    },
    4: {
      short: [
        '가족과 함께 방문해 주셔서 감사합니다. 다음에는 더 좋은 경험 드릴 수 있도록 노력하겠습니다.',
      ],
      standard: [
        '가족과 함께 아르떼뮤지엄을 방문해 주셔서 감사합니다. 좋은 시간이 되셨다니 기쁘고, 아쉬운 부분이 있었다면 반드시 개선하겠습니다. 가족 모두가 만족할 수 있는 공간이 되도록 계속 노력하겠습니다. 다음에는 더 완성된 모습으로 뵐 수 있으면 좋겠습니다.',
      ],
      careful: [
        '소중한 가족과 함께 방문해 주시고 후기 남겨 주셔서 감사합니다. 전반적으로 즐거운 시간이 되셨다니 다행이고, 기대에 미치지 못한 부분이 있으셨다면 더욱 분발하겠습니다. 어른도 아이도 모두 만족할 수 있는 공간을 만들기 위해 콘텐츠와 서비스 모두 계속 발전시켜 나가겠습니다. 가족과 함께하는 소중한 시간이 아르떼에서 더욱 빛날 수 있도록 최선을 다하겠습니다. 다음에는 더욱 만족스러운 방문이 되실 수 있기를 진심으로 바랍니다.',
      ],
    },
  },

  couple: {
    5: {
      short: [
        '소중한 분과 함께 찾아주셔서 감사합니다! 두 분의 특별한 시간이 오래 기억되길 바랍니다 :)',
        '특별한 분과 함께하신 방문, 저희도 행복한 마음으로 감사드립니다. 아름다운 추억이 되셨으면 합니다.',
      ],
      standard: [
        '소중한 분과 함께 아르떼뮤지엄을 찾아주셔서 감사합니다. 빛과 예술 속에서 함께한 시간이 두 분 모두에게 특별한 추억으로 남기를 바랍니다. 감성적인 공간에서 아름다운 순간을 만끽하셨길 바라며, 다음에도 좋은 시간이 이어지길 기대합니다.',
        '아르떼뮤지엄에서 특별한 시간을 보내 주셔서 감사합니다. 사랑하는 사람과 함께 예술의 감동을 나누셨다니, 저희로서는 더 이상 바랄 것이 없습니다. 저희 공간이 두 분에게 아름다운 추억의 장소로 기억된다면 정말 기쁘겠습니다.',
      ],
      careful: [
        '소중한 분과 함께 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다. 빛과 색채가 가득한 공간에서 함께한 시간이 두 분 모두에게 아름다운 기억으로 오래 남기를 바랍니다. 저희 아르떼뮤지엄은 일상 속에서 특별한 감동을 선사하는 공간이 되고자 항상 노력하고 있습니다. 소중한 사람과 함께하는 시간을 더욱 빛나게 해드릴 수 있어 저희도 행복합니다. 앞으로도 더욱 감각적이고 아름다운 전시로 찾아뵙겠습니다. 다음에도 특별한 두 분의 시간을 함께할 수 있으면 좋겠습니다.',
      ],
    },
    4: {
      short: [
        '함께 방문해 주셔서 감사합니다. 다음에는 더 완벽한 시간이 되도록 준비하겠습니다.',
      ],
      standard: [
        '소중한 분과 함께 방문해 주셔서 감사합니다. 좋은 시간이 되셨다니 기쁩니다. 아쉬운 부분이 있으셨다면 더욱 신경 쓰겠습니다. 다음에는 더욱 완벽한 경험을 드릴 수 있도록 준비하겠습니다.',
      ],
      careful: [
        '소중한 분과 함께 아르떼뮤지엄을 방문해 주셔서 감사합니다. 전반적으로 좋은 시간이 되셨다니 다행이고, 기대에 충분히 부응하지 못한 점이 있다면 진심으로 사과드립니다. 두 분이 함께하는 소중한 시간이 저희 공간에서 더욱 빛날 수 있도록 서비스와 전시 모두 더욱 세심하게 준비하겠습니다. 다음 방문에는 훨씬 만족스러운 경험이 되시길 바랍니다.',
      ],
    },
  },

  photo: {
    5: {
      short: [
        '아르떼에서 아름다운 순간 담아주셔서 감사합니다! 다음에도 멋진 장면이 가득하길 바랍니다.',
        '빛 속의 특별한 순간을 남겨주셔서 감사합니다. 소중한 기억이 되셨으면 합니다.',
      ],
      standard: [
        '아르떼뮤지엄에서 아름다운 순간을 남겨 주셔서 감사합니다! 빛과 색채가 어우러진 공간에서 멋진 추억을 담으셨길 바랍니다. 저희 작품들이 고객님의 소중한 사진 속에서도 빛을 발했으면 좋겠습니다. 다음 방문에도 새롭고 감각적인 설치 작품들이 기다리고 있겠습니다.',
        '빛의 예술 속에서 특별한 순간을 기록해 주셔서 감사합니다. 아르떼뮤지엄의 작품들이 고객님의 카메라 속에 아름답게 담겼을 생각에 저희도 설렙니다. 언제든 편하게 찾아주시면, 새로운 비주얼로 반겨드리겠습니다.',
      ],
      careful: [
        '아르떼뮤지엄에서 아름다운 순간을 기록해 주시고 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다. 빛과 색채, 그리고 예술이 어우러진 공간에서 고객님만의 특별한 장면을 담으셨길 바랍니다. 저희 아르떼뮤지엄은 매 순간이 작품이 되는 공간을 만들기 위해 조명부터 설치물까지 세심하게 설계하고 있습니다. 고객님의 사진 속에서 저희 공간이 더욱 아름답게 빛난다면, 그보다 기쁜 일이 없겠습니다. 앞으로도 새롭고 감각적인 비주얼로 가득한 공간을 만들어 가겠습니다. 다음에도 멋진 순간들이 함께하시길 바랍니다.',
      ],
    },
    4: {
      short: [
        '방문해 주셔서 감사합니다. 다음에는 더 멋진 공간으로 맞이하겠습니다.',
      ],
      standard: [
        '방문해 주시고 후기 남겨 주셔서 감사합니다. 아름다운 사진을 찍으셨길 바라며, 아쉬운 부분이 있으셨다면 더욱 개선하겠습니다. 고객님의 소중한 의견을 공간 구성에 반영하겠습니다. 다음에는 더욱 만족스러운 방문이 되시길 바랍니다.',
      ],
      careful: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다. 전반적으로 좋은 경험이 되셨다니 기쁩니다. 아쉬운 부분이 있으셨다면 더 좋은 공간과 경험을 만들 수 있는 소중한 피드백으로 삼겠습니다. 빛과 예술이 가득한 공간에서 고객님의 특별한 순간이 더욱 아름답게 담길 수 있도록 꾸준히 발전하겠습니다. 다음에는 더욱 만족스러운 방문이 되시길 진심으로 바랍니다.',
      ],
    },
  },

  staff: {
    5: {
      short: [
        '직원들에 대한 따뜻한 말씀 감사합니다! 팀 전체가 큰 힘을 받을 것 같습니다.',
        '스태프 칭찬 감사합니다. 저희에게 정말 큰 격려가 됩니다 :)',
      ],
      standard: [
        '저희 직원들에 대해 이렇게 좋은 말씀을 남겨 주셔서 정말 감사합니다. 고객님의 따뜻한 격려가 스태프 한 명 한 명에게 큰 힘이 됩니다. 앞으로도 모든 방문객분들께 따뜻하고 세심한 서비스를 드릴 수 있도록 더욱 노력하겠습니다. 다음에 다시 뵐 수 있으면 좋겠습니다.',
        '직원에 대한 칭찬의 말씀 진심으로 감사드립니다. 방문객 한 분 한 분을 소중히 여기는 마음으로 최선을 다하고 있는데, 이렇게 알아봐 주시니 정말 기쁩니다. 앞으로도 더 친절하고 전문적인 서비스로 보답하겠습니다.',
      ],
      careful: [
        '저희 직원들에 대해 이렇게 따뜻하고 고마운 말씀을 남겨 주셔서 진심으로 감사드립니다. 고객님의 칭찬을 해당 직원에게 직접 전달하여 큰 기쁨이 되도록 하겠습니다. 저희 스태프들은 방문하시는 모든 분들이 편안하고 즐거운 경험을 하실 수 있도록 매일 최선을 다하고 있습니다. 고객님처럼 따뜻한 마음으로 격려해 주실 때, 그 진심이 저희 팀 전체에게 전해져 더욱 열심히 일하고 싶어집니다. 앞으로도 모든 방문객분들께 진심 어린 서비스를 드릴 수 있도록 끊임없이 노력하겠습니다. 다음에 다시 뵙기를 기대하겠습니다.',
      ],
    },
    4: {
      short: [
        '방문해 주셔서 감사합니다. 더 좋은 서비스로 보답하겠습니다.',
      ],
      standard: [
        '방문해 주시고 후기 남겨 주셔서 감사합니다. 서비스 면에서 더 나아질 수 있도록 팀 전체가 더욱 노력하겠습니다. 고객님의 소중한 피드백이 저희 서비스 품질을 높이는 데 큰 도움이 됩니다. 다음에는 더욱 만족스러운 경험이 되시길 바랍니다.',
      ],
      careful: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다. 서비스에 있어 기대에 미치지 못한 부분이 있으셨다면 진심으로 사과드립니다. 고객님의 소중한 의견을 팀 전체와 공유하여 서비스 품질 향상에 직접 반영하겠습니다. 방문하시는 모든 분들이 따뜻하고 친절한 응대를 받으실 수 있도록 교육과 점검을 더욱 강화하겠습니다. 다음 방문에는 훨씬 만족스러운 서비스를 경험하실 수 있도록 최선을 다하겠습니다.',
      ],
    },
  },

  cafe: {
    5: {
      short: [
        '전시도 카페도 즐겁게 이용해 주셔서 감사합니다! 다음에도 좋은 시간이 되시길 바랍니다.',
        '아르떼 카페까지 사랑해 주셔서 감사합니다. 덕분에 저희도 기쁩니다!',
      ],
      standard: [
        '아르떼뮤지엄과 카페 모두 즐겁게 이용해 주셔서 감사합니다! 전시 감상 후 카페에서 여유로운 시간을 보내셨다니 기쁩니다. 훌륭한 예술 경험과 맛있는 한 잔이 어우러진 완벽한 방문이 되셨기를 바랍니다. 다음에도 좋은 시간이 이어지길 기대하겠습니다.',
        '카페도 마음에 드셨다니 정말 기쁩니다. 전시 관람 후 잠시 쉬어 가는 공간도 아르떼 경험의 소중한 일부라고 생각합니다. 앞으로도 더 맛있고 특별한 메뉴와 분위기로 맞이하겠습니다.',
      ],
      careful: [
        '아르떼뮤지엄과 카페까지 함께 즐겨 주셔서 진심으로 감사드립니다. 전시 감상 후 카페에서 여유로운 시간을 보내셨다니 저희도 정말 기쁩니다. 저희는 전시 공간뿐만 아니라 카페와 편의 시설까지, 방문하시는 동안의 모든 순간이 특별하게 느껴질 수 있도록 세심하게 준비하고 있습니다. 맛있는 음료와 함께한 시간이 전시의 여운을 더욱 오래 간직하는 데 도움이 되었으면 좋겠습니다. 앞으로도 더욱 풍성하고 맛있는 메뉴와 분위기로 찾아뵙겠습니다. 다음에도 전시와 카페 모두 기대해 주시면 감사하겠습니다.',
      ],
    },
    4: {
      short: [
        '방문해 주셔서 감사합니다. 카페도 더 나은 모습으로 맞이하겠습니다.',
      ],
      standard: [
        '방문해 주시고 후기 남겨 주셔서 감사합니다. 카페에서의 경험이 더 만족스럽지 못했다면 죄송하고, 앞으로 더욱 신경 쓰겠습니다. 전시와 카페 모두 더 좋은 경험을 드릴 수 있도록 최선을 다하겠습니다.',
      ],
      careful: [
        '방문해 주시고 카페에 대한 솔직한 후기를 남겨 주셔서 감사합니다. 기대에 미치지 못한 부분이 있으셨다면 진심으로 사과드립니다. 고객님의 의견을 카페 운영팀에 직접 전달하여 메뉴 품질과 서비스 모두 개선될 수 있도록 하겠습니다. 전시 관람만큼이나 카페에서의 시간도 소중하고 즐거운 경험이 되어야 한다고 생각합니다. 다음에는 더욱 만족스러운 카페 경험을 드릴 수 있기를 바랍니다.',
      ],
    },
  },
}

// ── English ───────────────────────────────────────────────────────────────────
// Tone: genuine, warm, professional — the way a real English-speaking front-desk
// team lead would respond, not a translated Korean reply.
const EN: Partial<Pool> = {
  general: {
    5: {
      short: [
        'Thank you so much for visiting ARTE Museum — your kind words made our day! We hope to see you again.',
        'What a lovely review — thank you! It means a great deal to our whole team.',
        'We\'re so glad you had a wonderful time. Feedback like yours is what keeps us going!',
      ],
      standard: [
        'Thank you so much for visiting ARTE Museum and for sharing such a heartfelt review. It genuinely means a lot to every member of our team. We put a tremendous amount of care into crafting an experience that stays with you, and hearing that it did exactly that is the greatest reward. We truly hope to have the pleasure of welcoming you again.',
        'We\'re really glad you had a great experience at ARTE Museum! Reviews like yours remind us why we do what we do, and they inspire the whole team to keep pushing the work forward. We\'re always evolving — new installations, new stories to tell through light and art. We\'d love to have you back whenever the time feels right.',
        'Thank you for taking the time to leave such a thoughtful review — it means more than you know. Every detail you experience here, from the lighting to the layout, is something we\'ve thought deeply about, and knowing it resonated with you is incredibly encouraging. We hope to see you again soon!',
      ],
      careful: [
        'Thank you so much for visiting ARTE Museum and for leaving such a generous review — it genuinely means the world to us. Our team invests an enormous amount of care and creativity into every aspect of the experience, and knowing that you felt that is deeply rewarding. ARTE Museum exists to be more than just an exhibition; we want every visitor to walk away feeling genuinely moved, as though they\'ve stepped briefly outside of everyday life. Your words are a wonderful reminder of why that mission matters. We\'re so grateful for guests like you who take the time to reflect on what they\'ve experienced. We sincerely hope to welcome you back again.',
      ],
    },
    4: {
      short: [
        'Thank you for visiting and for your honest feedback — we really appreciate it!',
        'Thanks for sharing your experience. We\'ll keep working to make things even better.',
      ],
      standard: [
        'Thank you for visiting ARTE Museum and for sharing your honest thoughts with us. We\'re really glad you had a good time overall, and we genuinely appreciate feedback that helps us improve. If there were any moments that didn\'t quite hit the mark, please know we take that seriously and are always working on it. We hope to have the chance to give you an even better experience on a future visit.',
        'We appreciate you taking the time to leave a review — it really helps us grow. We\'re happy you enjoyed the visit overall, and we\'ll take your feedback on board as we continue to develop and improve what we offer. We\'d love the opportunity to show you how far we\'ve come next time.',
      ],
      careful: [
        'Thank you for visiting ARTE Museum and for taking the time to share such honest and thoughtful feedback. We\'re glad the overall experience was positive, and if any part of your visit fell a little short of what you hoped for, we sincerely appreciate you telling us. Every piece of feedback is a real opportunity for us to grow, and we don\'t take that lightly. Our goal is for every single visitor to leave feeling genuinely inspired and taken care of — and when that doesn\'t happen perfectly, it matters to us. We hope to have the opportunity to welcome you back and demonstrate how seriously we take your thoughts.',
      ],
    },
  },
  family: {
    5: {
      short: [
        'Thank you for spending the day with us as a family — it was wonderful to have you here!',
        'So happy your family had a great time at ARTE! Those shared memories are exactly what we\'re here for.',
      ],
      standard: [
        'Thank you so much for bringing your family to ARTE Museum! Knowing that visitors of all ages — from the littlest ones to the grown-ups — can all find something to wonder at together is exactly what we set out to create. We hope the experience sparked curiosity and joy across the board. It would be a pleasure to have your family with us again.',
        'How wonderful that you could enjoy ARTE Museum together! Creating a space where families share genuine, memorable moments across generations is something we care deeply about. We hope the little ones (and the not-so-little ones!) walked away with wide eyes and full hearts. We\'d truly love to have your family back with us.',
      ],
      careful: [
        'Thank you so much for bringing your family to ARTE Museum and for sharing this lovely review! There is really nothing more meaningful for our team than seeing families experience the world of light and art together — the way children engage with the installations, the way parents and kids find unexpected things to point out to each other, it\'s something we treasure. We design every exhibit with all generations in mind, and hearing that it worked for your family is incredibly heartening. We hope the memories you made here are ones you\'ll talk about for a long time. Thank you for choosing to spend your time with us — it means a great deal. We hope to see your family again.',
      ],
    },
    4: {
      short: [
        'Thank you for the family visit! We\'ll keep working to make the next one even better.',
      ],
      standard: [
        'Thank you for visiting ARTE Museum with your family and for your thoughtful feedback. We\'re glad you had a good time together, and any areas we fell short in are things we\'re actively working to improve. We\'d love the chance to welcome your family back and deliver something truly memorable next time.',
      ],
      careful: [
        'Thank you for bringing your family to ARTE Museum and for taking the time to share your honest feedback. We\'re really pleased you had an enjoyable experience overall, and if any part of the visit didn\'t fully meet your expectations, we take that seriously. Building a space that works beautifully for every member of the family — from very young children to adults — is something we\'re constantly refining, and your insights are genuinely valuable in that process. We hope to have the opportunity to welcome your family back and show you just how much we\'ve grown.',
      ],
    },
  },
}

// ── Chinese (Simplified) ──────────────────────────────────────────────────────
// Authentic Chinese customer-service register.
// 재방문: 诚邀 / 期待与您再次相遇 (warm invitation, not a command)
const ZH_STANDARD_5 = [
  '非常感谢您莅临ARTE Museum，并留下如此温暖的评价！您的认可是我们不断前行的动力。我们始终致力于用光与艺术为每一位宾客带来独特的感动。如有机会，诚挚期待与您再次相聚。',
  '衷心感谢您对ARTE Museum的支持与厚爱！能让您在这里度过愉快而难忘的时光，是我们最大的荣幸。我们将持续带来更多富有创意的展览，希望与您共同探索更多精彩。期待与您再次相遇。',
  '感谢您的光临与真诚评价，您的满意是我们最好的鼓励。ARTE Museum将一如既往地用心打造每一个细节，期待有幸再次为您服务。',
]
const ZH_STANDARD_4 = [
  '感谢您百忙之中莅临ARTE Museum，并惠赐宝贵意见。很高兴您整体上留下了愉快的印象，若有任何不尽如人意之处，我们将认真改进。期待有机会为您带来更臻完善的体验。',
  '非常感谢您的光临与诚恳的评价。您的意见对我们弥足珍贵，我们将以此为契机，不断提升展览质量与服务水平。希望下次能够给您留下更完美的印象，期待再次相遇。',
]

// ── Japanese ──────────────────────────────────────────────────────────────────
// Proper keigo. 再来館表現: またのご来館を心よりお待ち申し上げております (polite request,
// not a command — "we await your return" rather than "come back again")
const JA_STANDARD_5 = [
  'この度はARTE Museumにご来館いただき、温かいレビューまでお寄せいただき、誠にありがとうございます。光とデジタルアートを通じて、皆さまに特別なひとときをお届けできたのであれば、これ以上の喜びはございません。またのご来館を心よりお待ち申し上げております。',
  '素晴らしいご評価をいただき、スタッフ一同大変光栄に存じます。お客様のお言葉が、私たちがより良い体験をつくり続けるための原動力となっております。引き続き新しいアート体験をお届けできるよう尽力してまいりますので、またのご来館を楽しみにお待ちしております。',
  'ご来館ならびに温かいご感想をいただき、誠にありがとうございます。楽しいひとときをお過ごしいただけたとのこと、スタッフ一同たいへん嬉しく思っております。ARTE Museumはこれからも光と芸術を通じて、皆さまの心に残る特別な空間であり続けられるよう努めてまいります。またの機会にぜひお越しいただけますと幸いです。',
]
const JA_STANDARD_4 = [
  'ご来館いただき、率直なご感想をお寄せいただきありがとうございます。全体的にご満足いただけたとのこと、安心いたしました。ご期待に沿えなかった点につきましては、真摯に受け止め改善に努めてまいります。またのご来館の機会に、より充実したお時間をご提供できますよう精進いたします。',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stableIdx(reviewId: string, count: number): number {
  let h = 0
  for (let i = 0; i < reviewId.length; i++) h = Math.imul(31, h) + reviewId.charCodeAt(i) | 0
  return Math.abs(h) % count
}

function pick<T>(arr: T[], reviewId: string): T {
  return arr[stableIdx(reviewId, arr.length)]
}

// ─── Main export ──────────────────────────────────────────────────────────────
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

export function generateAutoReply(reviewId: string, rating: number, text: string | null): AutoReplyResult {
  const lang = detectLang(text ?? '')
  const tier = rating >= 5 ? 5 : (4 as 4 | 5)
  const ctx = detectContext(text ?? '')

  let short: string, standard: string, careful: string

  if (lang === 'ko') {
    const pool = (KO[ctx] ?? KO.general)[tier]
    short = pick(pool.short, reviewId)
    standard = pick(pool.standard, reviewId)
    careful = pick(pool.careful.length > 0 ? pool.careful : pool.standard, reviewId)
  } else if (lang === 'zh') {
    standard = pick(tier === 5 ? ZH_STANDARD_5 : ZH_STANDARD_4, reviewId)
    short = standard.split('。')[0] + '。'
    careful = standard + (tier === 5
      ? ' 我们将持续以真诚之心为每一位宾客创造美好体验，感谢您一路以来的支持与信任。'
      : ' 您的宝贵意见我们将认真对待，期待下次能以更完善的面貌与您再度相遇。')
  } else if (lang === 'ja') {
    standard = pick(tier === 5 ? JA_STANDARD_5 : JA_STANDARD_4, reviewId)
    short = standard.split('。')[0] + '。'
    careful = standard + (tier === 5
      ? ' 皆さまの温かいご支援があればこそ、私どもはより高い目標に向かって歩み続けることができます。心より感謝申し上げます。'
      : ' お客様のご意見を真摯に受け止め、スタッフ一同さらなるサービス向上に努めてまいります。またのお越しをお待ち申し上げております。')
  } else {
    // English
    const enPool = ((EN[ctx] ?? EN.general) as RatedPool)[tier]
    short = pick(enPool.short, reviewId)
    standard = pick(enPool.standard, reviewId)
    careful = pick(enPool.careful.length > 0 ? enPool.careful : enPool.standard, reviewId)
  }

  const categories = ctx === 'general' ? ['general'] : [ctx]

  return {
    draft_short: short,
    draft_standard: standard,
    draft_careful: careful,
    detected_language: lang,
    sentiment: 'positive',
    risk_level: 'low',
    categories,
    risk_reasons: [],
    internal_note_ko: `알고리즘 자동 생성 (${rating}★, 언어: ${lang}, 맥락: ${ctx})`,
    forbidden_check: { refund_promise: false, legal_admission: false, cctv_mention: false, staff_discipline: false },
  }
}

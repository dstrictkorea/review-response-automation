/**
 * Rule-based auto reply generator for ARTE Museum.
 * Detects review context (family, couple, photo, staff, café, etc.)
 * and selects from high-quality, context-matched template pools.
 * Zero AI tokens consumed.
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
// Each context has { short, standard, careful } arrays.
// short: 1–2 sentences  |  standard: 3–4  |  careful: 5–6
type DraftPool = { short: string[]; standard: string[]; careful: string[] }
type RatedPool = { 5: DraftPool; 4: DraftPool }
type Pool = Record<Context, RatedPool>

const KO: Pool = {
  general: {
    5: {
      short: [
        '아르떼뮤지엄을 찾아주셔서 감사합니다! 또 만나요 :)',
        '따뜻한 후기 정말 감사합니다! 다음 방문도 기다릴게요.',
        '이렇게 좋은 후기 남겨 주셔서 저희도 너무 기쁩니다! 다시 오세요.',
        '소중한 후기 감사드립니다. 언제든 다시 찾아주세요!',
      ],
      standard: [
        '아르떼뮤지엄을 찾아주시고 이렇게 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다. 고객님의 방문이 저희에게는 언제나 특별한 의미입니다. 더 새롭고 감동적인 작품으로 계속 성장하는 아르떼뮤지엄이 되겠습니다. 다음 전시에서 또 만나요!',
        '소중한 후기를 남겨 주셔서 진심으로 감사드립니다! 고객님처럼 즐겁게 방문해 주시는 분들 덕분에 저희 팀 모두가 더욱 열심히 할 수 있습니다. 항상 새로운 예술 경험을 드릴 수 있도록 최선을 다하겠습니다. 언제든지 다시 오세요, 반갑게 맞이하겠습니다!',
        '방문해 주신 것만으로도 감사한데, 이렇게 좋은 후기까지 남겨 주셔서 감사합니다. 빛과 디지털 아트 속에서 즐거운 시간 보내셨길 바랍니다. 저희는 매 전시마다 새로운 감동을 드리기 위해 끊임없이 준비하고 있습니다. 다음에도 특별한 경험 선물해 드릴게요!',
        '이렇게 좋은 말씀을 남겨 주셔서 감사합니다. 아르떼뮤지엄이 고객님께 특별한 추억이 되었으면 합니다. 앞으로도 더욱 풍성하고 감각적인 전시로 보답하겠습니다. 꼭 다시 찾아 주세요!',
      ],
      careful: [
        '아르떼뮤지엄을 찾아주시고 이렇게 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다. 고객님의 한 마디 한 마디가 저희 팀 모두에게 큰 힘이 되고, 더 열심히 하고 싶은 원동력이 됩니다. 저희 아르떼뮤지엄은 단순한 전시 공간을 넘어, 방문하시는 모든 분들이 빛과 예술 속에서 일상을 잠시 내려놓고 깊은 감동을 느끼실 수 있는 공간이 되고자 합니다. 앞으로도 새로운 콘텐츠와 전시로 꾸준히 성장하는 모습 보여드리겠습니다. 고객님처럼 아껴 주시는 분들 덕분에 저희가 이 자리에 있을 수 있습니다. 언제든지 다시 찾아주시면 항상 반갑게 맞이하겠습니다!',
        '소중한 시간 내어 아르떼뮤지엄을 방문해 주시고, 따뜻한 후기까지 남겨 주셔서 깊이 감사드립니다. 즐거운 경험이 되셨다니 저희에게 이보다 큰 보람은 없습니다. 저희는 방문객 한 분 한 분이 특별한 감동을 안고 돌아가실 수 있도록, 공간 구성부터 작품 선정까지 세심하게 준비하고 있습니다. 고객님의 긍정적인 후기는 저희 팀 전원에게 진심 어린 감사와 격려가 됩니다. 앞으로도 더 아름답고 인상적인 전시로 꾸준히 성장하겠습니다. 다음에도 편안하고 즐거운 방문 되시길 바라며, 다시 뵙기를 기대하겠습니다!',
      ],
    },
    4: {
      short: [
        '후기 감사합니다! 더 나은 모습으로 다시 뵙겠습니다.',
        '방문해 주셔서 감사합니다. 다음엔 더 만족스럽도록 노력할게요!',
        '소중한 후기 감사드립니다. 항상 더 좋아지는 아르떼가 되겠습니다.',
      ],
      standard: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다. 즐거운 시간이 되셨다니 다행이고, 아쉬운 점이 있으셨다면 앞으로 더욱 개선하겠습니다. 고객님의 소중한 피드백이 저희가 발전할 수 있는 원동력이 됩니다. 더 완성된 모습으로 다시 뵙겠습니다!',
        '소중한 후기 감사드립니다. 전반적으로 좋은 경험을 하셨다니 기쁩니다. 부족한 부분이 있었다면, 저희에게 더 나은 서비스를 만들어 갈 수 있는 소중한 기회로 삼겠습니다. 다음 방문에는 더욱 만족스러운 경험이 되도록 최선을 다하겠습니다!',
        '후기 남겨 주셔서 감사합니다! 대체로 좋은 시간을 보내셨다니 저희도 기쁩니다. 아쉬운 부분은 귀중한 의견으로 받아들이고 지속적으로 개선해 나가겠습니다. 다음 방문에는 더욱 만족스러운 경험이 되시도록 노력하겠습니다!',
      ],
      careful: [
        '방문해 주시고 솔직하고 소중한 후기를 남겨 주셔서 진심으로 감사드립니다. 좋은 시간을 보내셨다니 정말 다행이고 기쁩니다. 완벽하게 만족스러운 경험이 되지 못한 부분이 있으셨다면, 저희가 부족했던 것이고 앞으로 반드시 개선해 나가겠습니다. 고객님의 한 마디가 저희 서비스와 전시 품질을 높이는 데 직접적인 도움이 됩니다. 더 좋은 모습, 더 감동적인 전시로 보답하기 위해 꾸준히 노력하겠습니다. 다음에는 더욱 만족스러운 방문이 되시길 바라며, 다시 찾아주시길 진심으로 기대하겠습니다!',
      ],
    },
  },

  family: {
    5: {
      short: [
        '소중한 가족과 함께 찾아주셔서 감사합니다! 다음에도 행복한 추억 만들러 오세요.',
        '가족과 함께하신 방문, 저희에게도 정말 기쁜 순간이었습니다!',
      ],
      standard: [
        '소중한 가족과 함께 아르떼뮤지엄을 찾아주셔서 감사합니다! 온 가족이 함께 빛과 예술의 세계를 경험하셨다니 저희도 정말 행복합니다. 아이들이 눈을 반짝이며 작품을 바라보는 모습을 상상하니 저희도 미소가 지어집니다. 다음에도 소중한 가족과 함께 또 방문해 주세요, 언제든 환영합니다!',
        '가족과 함께 특별한 하루를 아르떼뮤지엄에서 보내 주셔서 감사합니다. 사랑하는 가족과 함께한 그 시간이 오래도록 기억에 남는 추억이 되었으면 좋겠습니다. 어른도 아이도 모두 즐길 수 있는 공간이 되기 위해 저희도 매일 노력하고 있습니다. 다음에도 아르떼에서 행복한 시간 보내시길 바랍니다!',
      ],
      careful: [
        '소중한 가족과 함께 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다. 온 가족이 빛과 예술 속에서 함께 웃고 감동받으셨다면, 저희로서는 이보다 큰 보람이 없습니다. 아이들의 눈높이에서도, 어른들의 감성에서도 모두 의미 있는 경험이 될 수 있는 공간을 만들기 위해 항상 고민하고 있습니다. 가족이 함께하는 시간이 아르떼뮤지엄과 함께 더욱 특별해지길 바랍니다. 고객님의 따뜻한 후기 덕분에 저희 팀 전체가 더 열심히 할 수 있습니다. 다음에도 사랑하는 가족과 함께 꼭 다시 찾아주세요!',
      ],
    },
    4: {
      short: [
        '가족과 함께 방문해 주셔서 감사합니다. 다음엔 더 좋은 경험 드릴게요!',
      ],
      standard: [
        '가족과 함께 아르떼뮤지엄을 방문해 주셔서 감사합니다. 좋은 시간이 되셨다니 기쁘고, 아쉬운 부분이 있었다면 반드시 개선하겠습니다. 가족 모두가 만족할 수 있는 공간이 되도록 계속 노력하겠습니다. 다음 방문에는 더 완성된 모습으로 뵙겠습니다!',
      ],
      careful: [
        '소중한 가족과 함께 방문해 주시고 후기 남겨 주셔서 감사합니다. 전반적으로 즐거운 시간이 되셨다니 다행이고, 기대에 미치지 못한 부분이 있으셨다면 더욱 분발하겠습니다. 어른도 아이도 모두 만족할 수 있는 공간을 만들기 위해 콘텐츠와 서비스 모두 계속 발전시켜 나가겠습니다. 가족과 함께하는 소중한 시간이 아르떼에서 더욱 빛날 수 있도록 최선을 다하겠습니다. 다음에는 더욱 만족스러운 방문이 되실 수 있도록 저희도 열심히 준비하겠습니다. 다시 찾아주시길 기대하겠습니다!',
      ],
    },
  },

  couple: {
    5: {
      short: [
        '소중한 분과 함께 찾아주셔서 감사합니다! 다음 데이트도 아르떼에서 어떨까요? :)',
        '특별한 분과 함께하신 방문, 저희도 설레는 마음으로 감사드립니다!',
      ],
      standard: [
        '소중한 분과 함께 아르떼뮤지엄을 찾아주셔서 감사합니다! 빛과 예술 속에서 함께한 시간이 두 분 모두에게 특별한 추억이 되었으면 좋겠습니다. 감성적이고 로맨틱한 공간에서 아름다운 순간을 만끽하셨길 바랍니다. 다음에도 아르떼에서 특별한 데이트 즐기세요!',
        '아르떼뮤지엄에서 특별한 시간을 보내 주셔서 감사합니다. 사랑하는 사람과 함께 예술의 감동을 나누셨다니, 저희로서는 더 이상 바랄 것이 없습니다. 저희 공간이 두 분에게 아름다운 추억의 장소로 기억된다면 정말 기쁘겠습니다. 다음 방문도 아르떼에서 기다리겠습니다!',
      ],
      careful: [
        '소중한 분과 함께 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다. 빛과 색채가 가득한 공간에서 함께한 시간이 두 분 모두에게 아름다운 기억으로 오래 남기를 바랍니다. 저희 아르떼뮤지엄은 일상 속에서 특별한 감동을 선사하는 공간이 되고자 항상 노력하고 있습니다. 소중한 사람과 함께하는 시간을 더욱 빛나게 해드릴 수 있어 저희도 행복합니다. 앞으로도 더욱 감각적이고 아름다운 전시로 찾아뵙겠습니다. 다음에도 특별한 두 분의 시간을 함께해 드릴 수 있으면 좋겠습니다!',
      ],
    },
    4: {
      short: [
        '함께 방문해 주셔서 감사합니다. 다음엔 더 완벽한 데이트 코스 만들어 드릴게요!',
      ],
      standard: [
        '소중한 분과 함께 방문해 주셔서 감사합니다. 좋은 시간이 되셨다니 기쁩니다. 아쉬운 부분이 있으셨다면 더욱 신경 쓰겠습니다. 다음에는 더욱 완벽한 경험을 드릴 수 있도록 준비하겠습니다!',
      ],
      careful: [
        '소중한 분과 함께 아르떼뮤지엄을 방문해 주셔서 감사합니다. 전반적으로 좋은 시간이 되셨다니 다행이고, 기대에 충분히 부응하지 못한 점이 있다면 진심으로 사과드립니다. 두 분이 함께하는 소중한 시간이 저희 공간에서 더욱 빛날 수 있도록 서비스와 전시 모두 더욱 세심하게 준비하겠습니다. 다음 방문에는 훨씬 만족스러운 경험이 되시길 바랍니다. 꼭 다시 찾아주세요!',
      ],
    },
  },

  photo: {
    5: {
      short: [
        '아르떼에서 아름다운 순간 담아주셔서 감사합니다! 다음에도 멋진 장면 선물해 드릴게요.',
        '빛 속의 특별한 순간을 남겨주셔서 감사합니다! 또 오세요 :)',
      ],
      standard: [
        '아르떼뮤지엄에서 아름다운 순간을 남겨 주셔서 감사합니다! 빛과 색채가 어우러진 공간에서 멋진 추억을 담으셨길 바랍니다. 저희 작품들이 고객님의 소중한 사진 속에서도 빛을 발했으면 좋겠습니다. 다음 방문에도 새롭고 감각적인 설치 작품들이 기다리고 있을게요!',
        '빛의 예술 속에서 특별한 순간을 기록해 주셔서 감사합니다. 아르떼뮤지엄의 작품들이 고객님의 카메라 속에 아름답게 담겼을 생각에 저희도 설레네요. 공간의 아름다움을 느껴 주신 고객님처럼, 저희도 언제나 최고의 시각적 경험을 선사하기 위해 노력하겠습니다. 또 놀러 오세요!',
      ],
      careful: [
        '아르떼뮤지엄에서 아름다운 순간을 기록해 주시고 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다. 빛과 색채, 그리고 예술이 어우러진 공간에서 고객님만의 특별한 장면을 담으셨길 바랍니다. 저희 아르떼뮤지엄은 매 순간이 작품이 되는 공간을 만들기 위해 조명부터 설치물까지 세심하게 설계하고 있습니다. 고객님의 사진 속에서 저희 공간이 더욱 아름답게 빛난다면, 그보다 기쁜 일이 없겠습니다. 앞으로도 새롭고 감각적인 비주얼로 가득한 공간을 만들어 가겠습니다. 다음에도 멋진 순간들을 함께 만들어요!',
      ],
    },
    4: {
      short: [
        '방문해 주셔서 감사합니다. 다음엔 더 예쁜 공간으로 맞이할게요!',
      ],
      standard: [
        '방문해 주시고 후기 남겨 주셔서 감사합니다. 아름다운 사진을 찍으셨길 바라며, 아쉬운 부분이 있으셨다면 더욱 개선하겠습니다. 고객님의 소중한 의견을 공간 구성에 반영하겠습니다. 다음에는 더욱 만족스러운 방문이 되시길 바랍니다!',
      ],
      careful: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다. 전반적으로 좋은 경험이 되셨다니 기쁩니다. 아쉬운 부분이 있으셨다면, 저희가 더 좋은 공간과 경험을 만들 수 있는 소중한 피드백으로 삼겠습니다. 빛과 예술이 가득한 공간에서 고객님의 특별한 순간이 더욱 아름답게 담길 수 있도록 꾸준히 발전하겠습니다. 다음에는 더욱 만족스러운 방문이 되시길 바랍니다!',
      ],
    },
  },

  staff: {
    5: {
      short: [
        '직원들에 대한 따뜻한 말씀 감사합니다! 더 열심히 하겠습니다.',
        '스태프 칭찬 감사합니다! 팀 전체가 큰 힘을 받을 것 같습니다 :)',
      ],
      standard: [
        '저희 직원들에 대해 이렇게 좋은 말씀을 남겨 주셔서 정말 감사합니다. 고객님의 따뜻한 격려가 스태프 한 명 한 명에게 큰 힘이 됩니다. 앞으로도 모든 방문객분들께 따뜻하고 세심한 서비스를 드릴 수 있도록 더욱 노력하겠습니다. 다시 방문해 주시면 항상 반갑게 맞이하겠습니다!',
        '직원에 대한 칭찬의 말씀 진심으로 감사드립니다. 방문객 한 분 한 분을 소중히 여기는 마음으로 최선을 다하고 있는데, 이렇게 알아봐 주시니 정말 기쁩니다. 앞으로도 더 친절하고 전문적인 서비스로 보답하겠습니다. 꼭 다시 찾아주세요!',
      ],
      careful: [
        '저희 직원들에 대해 이렇게 따뜻하고 고마운 말씀을 남겨 주셔서 진심으로 감사드립니다. 고객님의 칭찬을 해당 직원에게 직접 전달하여 큰 기쁨이 되도록 하겠습니다. 저희 스태프들은 방문하시는 모든 분들이 편안하고 즐거운 경험을 하실 수 있도록 매일 최선을 다하고 있습니다. 고객님처럼 따뜻한 마음으로 격려해 주실 때, 그 진심이 저희 팀 전체에게 전해져 더욱 열심히 일하고 싶어집니다. 앞으로도 모든 방문객분들께 진심 어린 서비스를 드릴 수 있도록 끊임없이 노력하겠습니다. 다시 찾아주시는 날을 기대하겠습니다!',
      ],
    },
    4: {
      short: [
        '방문해 주셔서 감사합니다. 더 좋은 서비스로 다시 뵙겠습니다!',
      ],
      standard: [
        '방문해 주시고 후기 남겨 주셔서 감사합니다. 서비스 면에서 더 나아질 수 있도록 팀 전체가 더욱 노력하겠습니다. 고객님의 소중한 피드백이 저희 서비스 품질을 높이는 데 큰 도움이 됩니다. 다음에는 더욱 만족스러운 경험이 되시길 바랍니다!',
      ],
      careful: [
        '방문해 주시고 솔직한 후기를 남겨 주셔서 감사합니다. 서비스에 있어 기대에 미치지 못한 부분이 있으셨다면 진심으로 사과드립니다. 고객님의 소중한 의견을 팀 전체와 공유하여 서비스 품질 향상에 직접 반영하겠습니다. 방문하시는 모든 분들이 따뜻하고 친절한 응대를 받으실 수 있도록 교육과 점검을 더욱 강화하겠습니다. 다음 방문에는 훨씬 만족스러운 서비스를 경험하실 수 있도록 최선을 다하겠습니다. 다시 찾아주시길 진심으로 기대합니다!',
      ],
    },
  },

  cafe: {
    5: {
      short: [
        '전시도 카페도 즐겁게 이용해 주셔서 감사합니다! 또 오세요 :)',
        '아르떼 카페까지 사랑해 주셔서 감사합니다!',
      ],
      standard: [
        '아르떼뮤지엄과 카페 모두 즐겁게 이용해 주셔서 감사합니다! 전시 감상 후 카페에서 여유로운 시간을 보내셨다니 기쁩니다. 훌륭한 예술 경험과 맛있는 한 잔이 어우러진 완벽한 방문이 되셨기를 바랍니다. 다음에도 전시와 함께 카페에서 특별한 시간 보내시길 기대하겠습니다!',
        '카페도 마음에 드셨다니 정말 기쁩니다! 전시 관람 후 잠시 쉬어 가는 공간도 아르떼 경험의 소중한 일부라고 생각합니다. 앞으로도 더 맛있고 특별한 메뉴와 분위기로 맞이하겠습니다. 다음에도 꼭 들러 주세요!',
      ],
      careful: [
        '아르떼뮤지엄과 카페까지 함께 즐겨 주셔서 진심으로 감사드립니다. 전시 감상 후 카페에서 여유로운 시간을 보내셨다니 저희도 정말 기쁩니다. 저희는 전시 공간뿐만 아니라 카페와 편의 시설까지, 방문하시는 동안의 모든 순간이 특별하게 느껴질 수 있도록 세심하게 준비하고 있습니다. 맛있는 음료와 함께한 시간이 전시의 여운을 더욱 오래 간직하는 데 도움이 되었으면 좋겠습니다. 앞으로도 더욱 풍성하고 맛있는 메뉴와 분위기로 찾아뵙겠습니다. 다음에도 전시와 카페 모두 기대해 주세요!',
      ],
    },
    4: {
      short: [
        '방문해 주셔서 감사합니다. 카페도 더 나은 모습으로 뵙겠습니다!',
      ],
      standard: [
        '방문해 주시고 후기 남겨 주셔서 감사합니다. 카페에서의 경험이 더 만족스럽지 못했다면 죄송하고, 앞으로 더욱 신경 쓰겠습니다. 전시와 카페 모두 더 좋은 경험을 드릴 수 있도록 최선을 다하겠습니다. 다시 찾아주시길 기대합니다!',
      ],
      careful: [
        '방문해 주시고 카페에 대한 솔직한 후기를 남겨 주셔서 감사합니다. 기대에 미치지 못한 부분이 있으셨다면 진심으로 사과드립니다. 고객님의 의견을 카페 운영팀에 직접 전달하여 메뉴 품질과 서비스 모두 개선될 수 있도록 하겠습니다. 전시 관람만큼이나 카페에서의 시간도 소중하고 즐거운 경험이 되어야 한다고 생각합니다. 앞으로는 더욱 만족스러운 카페 경험을 드릴 수 있도록 노력하겠습니다. 다음에 다시 찾아주시면 꼭 더 좋은 모습 보여드리겠습니다!',
      ],
    },
  },
}

// ─── English templates ────────────────────────────────────────────────────────
const EN: Partial<Pool> = {
  general: {
    5: {
      short: [
        'Thank you so much for visiting ARTE Museum! Hope to see you again soon :)',
        'Your kind words mean the world to us — thank you and see you next time!',
        'We\'re so happy you had a wonderful experience! Come back anytime.',
      ],
      standard: [
        'Thank you so much for visiting ARTE Museum and leaving such a heartfelt review! It truly means a great deal to every member of our team. We\'re dedicated to creating an unforgettable experience through light and digital art, and hearing that you enjoyed your visit makes all the effort worthwhile. We hope to see you again very soon!',
        'We\'re so glad you had a wonderful time at ARTE Museum! Your positive energy and kind words are exactly what motivate us to keep pushing the boundaries of what we create. We\'ll continue bringing you new, breathtaking exhibitions that inspire and move you. See you at the next one!',
        'Thank you for taking the time to share your experience! Knowing that you left with beautiful memories is the greatest reward for our team. We\'re always working to offer something new and spectacular, and we can\'t wait to welcome you back for your next visit.',
      ],
      careful: [
        'Thank you so much for visiting ARTE Museum and for taking the time to leave such a wonderful review — it genuinely means the world to us. Our team puts tremendous care into every detail, from the lighting design to the art installations, and knowing that it resonated with you is incredibly rewarding. ARTE Museum is more than just an exhibition space; we strive to create an immersive world where art, light, and emotion come together in a way that stays with you long after you leave. Your kind words inspire us to keep raising the bar with every new exhibit we produce. We are so grateful to have guests like you who truly appreciate what we\'re trying to create. Please come back soon — we\'d love to share our next chapter with you!',
      ],
    },
    4: {
      short: [
        'Thank you for visiting! We\'ll keep working to make your next experience even better.',
        'We appreciate your honest feedback and look forward to seeing you again!',
      ],
      standard: [
        'Thank you for visiting ARTE Museum and for sharing your honest thoughts! We\'re glad you had a good time overall, and we truly appreciate any feedback that helps us grow. If there were any moments that didn\'t quite meet your expectations, please know we\'re always working hard to improve. We hope to welcome you back and give you an even better experience next time!',
        'We appreciate you taking the time to write a review! Hearing what worked and what could be better helps us create a more meaningful experience for every visitor. We\'ll continue to improve, and we hope your next visit will exceed your expectations. Looking forward to seeing you again!',
      ],
      careful: [
        'Thank you for visiting ARTE Museum and leaving your honest and thoughtful feedback — we truly appreciate it. We\'re happy that you had an overall positive experience, and we take every piece of feedback seriously as an opportunity to grow. If any aspect of your visit fell short of expectations, we sincerely apologize and want you to know we are committed to making improvements across the board. Our goal is for every single visitor to leave feeling genuinely moved and satisfied. Your insights are incredibly valuable in helping us achieve that. We hope to see you again soon and make your next visit truly exceptional!',
      ],
    },
  },
  family: {
    5: {
      short: [
        'Thank you for bringing your family to ARTE Museum! We hope to see you all again soon!',
        'So happy your family had a great time! Come back and make more memories with us :)',
      ],
      standard: [
        'Thank you so much for visiting ARTE Museum with your family! There\'s nothing more rewarding for us than knowing that guests of all ages — from the youngest to the oldest — can share a moment of wonder together. We hope the experience sparked joy and curiosity in everyone. Please come back and bring the whole family again!',
        'How wonderful that you could enjoy ARTE Museum together as a family! Creating a space where meaningful, shared experiences happen across generations is what drives us every day. We hope your little ones (and not-so-little ones!) left with big smiles and even bigger imaginations. We\'d love to welcome your family back again!',
      ],
      careful: [
        'Thank you so much for bringing your family to ARTE Museum and for sharing this kind review! There is truly nothing more special for our team than seeing families experience the magic of immersive art together — the way children\'s eyes light up around the installations is something we treasure deeply. We design our exhibitions to be meaningful for every age, and hearing that your family enjoyed the visit reassures us that we\'re on the right path. We hope the memories you created here are ones you\'ll look back on fondly for years to come. Thank you for choosing ARTE Museum as your destination — it genuinely means so much to all of us. We look forward to welcoming your wonderful family back soon!',
      ],
    },
    4: {
      short: [
        'Thank you for the family visit! We\'ll work to make your next experience even better.',
      ],
      standard: [
        'Thank you for visiting ARTE Museum with your family and for your honest feedback! We\'re glad you had a good time together, and we\'ll use your thoughts to keep improving. Every family deserves a truly memorable visit, and we\'re committed to making that happen. Hope to see your whole family again!',
      ],
      careful: [
        'Thank you for bringing your family to ARTE Museum and for taking the time to share your feedback. We\'re glad you had an enjoyable experience overall, and if there were any moments that didn\'t fully meet your expectations, we sincerely apologize. Creating a space that genuinely delights every member of the family — from young children to adults — is something we care deeply about, and we\'re always working to improve. Your honest feedback is invaluable and will directly inform how we continue to develop our offerings. We hope to have the opportunity to welcome your family back and exceed your expectations on every front!',
      ],
    },
  },
}

// ─── Chinese & Japanese (compact) ─────────────────────────────────────────────
const ZH_STANDARD_5 = [
  '非常感谢您来访ARTE Museum并留下这么温暖的评价！您的肯定是我们不断前进的动力。我们会继续用光与艺术为每一位访客创造独特的感动体验。期待再次与您相见！',
  '感谢您的到来和宝贵的评价！能够让您在ARTE Museum度过美好的时光，是我们最大的荣幸。我们会持续引入更具创意的展览，带给您更多惊喜。欢迎再次光临！',
  '衷心感谢您的支持与鼓励！您的笑容和满意是我们最好的回报。我们将继续努力，为每位访客打造难忘的光影艺术体验。期待与您的再次相遇！',
]
const ZH_STANDARD_4 = [
  '感谢您的来访和宝贵反馈！很高兴您整体上有愉快的体验。我们会认真参考您的意见，不断改进我们的展览和服务。期待在下次访问中给您带来更好的体验！',
  '非常感谢您的诚实评价！您的意见对我们非常重要，我们将以此为契机持续改善。希望下次能够给您留下更完美的印象。欢迎再次光临！',
]
const JA_STANDARD_5 = [
  'ARTE Museumにご来館いただき、このような温かいレビューをいただき誠にありがとうございます。光とデジタルアートを通じて、皆さまに特別な感動をお届けできたなら、これ以上の喜びはありません。またのお越しを心よりお待ちしております！',
  '素晴らしいレビューをありがとうございます。お客様の笑顔と満足が、私たちスタッフ全員の原動力です。より多くの感動と新しいアート体験をお届けできるよう、これからも努力してまいります。ぜひまたお越しください！',
  'ご来館いただき、誠にありがとうございます。楽しいひとときをお過ごしいただけたとのこと、スタッフ一同大変嬉しく思っております。ARTE Museumはこれからも光と芸術の力で、皆さまに特別な体験をお届けできるよう尽力してまいります。またのご来館を心からお待ちしております！',
]
const JA_STANDARD_4 = [
  'ご来館いただき、率直なご感想をいただきありがとうございます。全体的にご満足いただけたとのこと安心いたしました。ご期待に沿えなかった点がございましたら、真摯に受け止め改善してまいります。次回はより満足していただけるよう努力いたします。またのお越しをお待ちしております。',
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
    careful = standard + (tier === 5 ? ' 我们将一如既往地为每一位访客提供最好的艺术体验，感谢您的支持！' : ' 您的宝贵意见我们会认真改进，期待下次为您提供更完美的体验。')
  } else if (lang === 'ja') {
    standard = pick(tier === 5 ? JA_STANDARD_5 : JA_STANDARD_4, reviewId)
    short = standard.split('。')[0] + '。'
    careful = standard + (tier === 5 ? ' 皆さまのご支援があってこそ、私たちはより良い体験をお届けし続けることができます。心より感謝申し上げます。' : ' 今後もより多くの方に満足していただけるよう、スタッフ一同精進してまいります。')
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

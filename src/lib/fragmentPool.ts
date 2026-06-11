/**
 * fragmentPool.ts — Matrix-Based Fragment Pool (동적 마이크로 조각 조립 엔진)
 *
 * 고정형 슬롯을 선형으로 이어 붙이는 방식 대신, 4개 차원의 마이크로 문구 조각 풀에서
 * N-gram/정규식이 추출한 다중 신호를 가중치 거버너(Governor)로 평가해 가장 적합한
 * 상위 2~3개만 선택(Pruning)·조립한다. 수십 개 조각으로 수천 개 자연스러운 조합 생성.
 *
 *   차원(dimension):
 *     persona  — 가족/데이트/친구/단골 (동반자·관계)   [기존 slotCompanion/slotRepeatVisitor 재사용]
 *     sensory  — 빛/물/향/소리 (라이트·미디어 아트 감각) [기존 slotSensory 재사용]
 *     spatial  — 포토스팟/넓은공간 (공간감)             [본 모듈 신규]
 *     temporal — 아침/저녁/주말 (방문 시간대)           [본 모듈 신규]
 *
 *   거버너(selectFragments): 신호별 가중치 내림차순 정렬 → 상위 budget개 선택 →
 *     서사 순서(persona→sensory→spatial→temporal→단골)로 재배열 → 조립.
 *     budget은 리뷰 길이에 비례(1~3) → 슬롯을 늘려도 답변이 길어지지 않음.
 *
 * ⚠ 보안/운영: 본 풀은 코드 베이스 내부에서만 관리한다. 프런트엔드 UI/DB에 노출하지 않는다.
 * ⚠ 안전: COMPLIMENT/SAFE 경로 전용. 미커버 언어 조각은 ''(governor가 스킵) → WRONG_SCRIPT 방어.
 */

import type { ReplyLanguage as Language } from '@/lib/replyLanguage'
import { slotSensory, slotCompanion, slotRepeatVisitor } from '@/lib/staticTemplates'

export type FragmentDimension = 'persona' | 'sensory' | 'spatial' | 'temporal'

export interface FragmentSignal {
  dim: FragmentDimension
  tag: string
  /** 문맥 적합도 가중치 — 높을수록 우선 선택 (sensory/persona가 가장 구체적). */
  weight: number
}

/** 차원별 변형 인덱스 (reviewId 해시 기반 — 동일 조각도 여러 변형으로 순환). */
export interface FragmentIndices {
  persona: number
  sensory: number
  spatial: number
  temporal: number
}

// ── temporal 차원 조각 풀 (방문 시간대) — 9개 언어 × 2 variants ────────────────────
const TEMPORAL_LINES: Record<string, Partial<Record<Language, string[]>>> = {
  '주말': {
    ko: ['주말의 활기 속에서도 즐거운 시간 보내셨다니 기쁩니다.', '붐비는 주말에도 좋은 추억 남기셨길 바랍니다.'],
    en: ['We are glad you enjoyed your visit even amid the lively weekend atmosphere.', 'We hope you made lovely memories despite the weekend buzz.'],
    ja: ['賑わう週末にもかかわらず、楽しいひとときをお過ごしいただけて何よりです。', '混み合う週末でも素敵な思い出を残していただけましたら幸いです。'],
    zh: ['在热闹的周末，您依然度过了愉快的时光，我们倍感欣喜。', '希望您在周末的人潮中也留下了美好回忆。'],
    es: ['Nos alegra que disfrutara de su visita incluso en el ambiente animado del fin de semana.', 'Esperamos que creara bonitos recuerdos a pesar del bullicio del fin de semana.'],
    ru: ['Мы рады, что вы получили удовольствие даже в оживлённой атмосфере выходных.', 'Надеемся, что вы оставили приятные воспоминания, несмотря на выходную суету.'],
    ar: ['يسعدنا أنكم استمتعتم بزيارتكم رغم أجواء عطلة نهاية الأسبوع المفعمة بالحيوية.', 'نأمل أنكم صنعتم ذكريات جميلة رغم ازدحام نهاية الأسبوع.'],
    hi: ['सप्ताहांत की चहल-पहल के बीच भी आपने आनंद लिया, यह जानकर खुशी हुई।', 'आशा है सप्ताहांत की भीड़ के बावजूद आपने सुंदर यादें बनाईं।'],
    tl: ['Natutuwa kami na nag-enjoy kayo kahit sa abalang atmospera ng katapusan ng linggo.', 'Sana nakalikha kayo ng magagandang alaala sa kabila ng pagsisikip tuwing weekend.'],
  },
  '저녁': {
    ko: ['저녁의 분위기 속에서 특별한 시간을 보내셨길 바랍니다.', '하루를 마무리하는 저녁, 저희 공간이 함께해 기쁩니다.'],
    en: ['We hope the evening ambience made your time with us extra special.', 'We are glad our space could be part of your evening.'],
    ja: ['夜の雰囲気の中で特別なひとときをお過ごしいただけましたら幸いです。', '一日の締めくくりの夜に、私どもの空間がご一緒できて嬉しく思います。'],
    zh: ['希望夜晚的氛围让您的时光格外特别。', '在结束一天的夜晚，很高兴我们的空间能伴您左右。'],
    es: ['Esperamos que el ambiente nocturno hiciera su visita aún más especial.', 'Nos alegra que nuestro espacio formara parte de su velada.'],
    ru: ['Надеемся, что вечерняя атмосфера сделала ваше время у нас особенным.', 'Мы рады, что наше пространство стало частью вашего вечера.'],
    ar: ['نأمل أن أجواء المساء جعلت وقتكم معنا أكثر تميزاً.', 'يسعدنا أن فضاءنا كان جزءاً من أمسيتكم.'],
    hi: ['आशा है शाम के माहौल ने आपके समय को और भी खास बना दिया।', 'हमें खुशी है कि हमारा स्थान आपकी शाम का हिस्सा बना।'],
    tl: ['Sana ginawang mas espesyal ng atmospera ng gabi ang inyong oras sa amin.', 'Natutuwa kami na naging bahagi ang aming espasyo ng inyong gabi.'],
  },
  '아침': {
    ko: ['이른 시간의 여유로운 분위기를 만끽하셨길 바랍니다.', '아침의 고요함 속에서 작품을 즐기셨다니 기쁩니다.'],
    en: ['We hope you savored the relaxed atmosphere of the early hours.', 'We are glad you enjoyed the artworks in the morning calm.'],
    ja: ['朝の時間帯のゆったりとした雰囲気を満喫していただけましたら幸いです。', '静かな朝のひとときに作品をお楽しみいただけて嬉しく思います。'],
    zh: ['希望您尽享清晨时分悠闲的氛围。', '您在清晨的宁静中欣赏作品，我们倍感欣喜。'],
    es: ['Esperamos que disfrutara del ambiente relajado de las primeras horas.', 'Nos alegra que disfrutara de las obras en la calma de la mañana.'],
    ru: ['Надеемся, что вы насладились спокойной атмосферой ранних часов.', 'Мы рады, что вы любовались произведениями в утренней тишине.'],
    ar: ['نأمل أنكم استمتعتم بالأجواء الهادئة في ساعات الصباح الأولى.', 'يسعدنا أنكم استمتعتم بالأعمال الفنية في هدوء الصباح.'],
    hi: ['आशा है आपने सुबह के शुरुआती घंटों के शांत माहौल का आनंद लिया।', 'हमें खुशी है कि आपने सुबह की शांति में कलाकृतियों का आनंद लिया।'],
    tl: ['Sana natamasa ninyo ang relaks na atmospera ng maagang oras.', 'Natutuwa kami na natamasa ninyo ang mga likhang-sining sa katahimikan ng umaga.'],
  },
}

// ── spatial 차원 조각 풀 (공간감) — 9개 언어 × 2 variants ──────────────────────────
const SPATIAL_LINES: Record<string, Partial<Record<Language, string[]>>> = {
  '포토스팟': {
    ko: ['멋진 사진 많이 담아 가셨길 바랍니다. 곳곳이 인생샷 명소랍니다.', '카메라에 담긴 순간들이 오래도록 좋은 기억이 되길 바랍니다.'],
    en: ['We hope you captured plenty of beautiful shots — every corner is a photo spot.', 'May the moments you photographed stay as wonderful memories.'],
    ja: ['素敵な写真をたくさん撮っていただけましたら幸いです。どこも映えるスポットです。', 'カメラに収めた瞬間が長く良い思い出となりますように。'],
    zh: ['希望您拍下了许多美照——这里处处都是打卡圣地。', '愿您镜头中的瞬间成为长久的美好回忆。'],
    es: ['Esperamos que capturara muchas fotos preciosas — cada rincón es ideal para fotografiar.', 'Que los momentos que fotografió queden como bellos recuerdos.'],
    ru: ['Надеемся, вы сделали много красивых снимков — здесь каждый уголок фотогеничен.', 'Пусть запечатлённые мгновения останутся прекрасными воспоминаниями.'],
    ar: ['نأمل أنكم التقطتم الكثير من الصور الجميلة — كل ركن هنا يستحق التصوير.', 'لتبقَ اللحظات التي صوّرتموها ذكريات جميلة طويلاً.'],
    hi: ['आशा है आपने ढेर सारी खूबसूरत तस्वीरें लीं — यहाँ हर कोना फोटो स्पॉट है।', 'आपके कैमरे में कैद पल लंबे समय तक सुंदर यादें बने रहें।'],
    tl: ['Sana marami kayong nakuhang magagandang litrato — bawat sulok ay photo spot.', "Nawa'y manatiling magagandang alaala ang mga sandaling inyong nakuhanan."],
  },
  '넓은공간': {
    ko: ['탁 트인 공간에서 여유롭게 관람하셨다니 기쁩니다.', '넓은 공간이 주는 개방감을 느끼셨길 바랍니다.'],
    en: ['We are glad you could take in the exhibition with room to breathe.', 'We hope you felt the openness of our spacious halls.'],
    ja: ['広々とした空間でゆったりとご観覧いただけて嬉しく思います。', '開放感あふれる空間を感じていただけましたら幸いです。'],
    zh: ['您在开阔的空间中悠然观展，我们倍感欣喜。', '希望您感受到了宽敞空间带来的开放感。'],
    es: ['Nos alegra que pudiera disfrutar la exposición con espacio para respirar.', 'Esperamos que sintiera la amplitud de nuestras salas espaciosas.'],
    ru: ['Мы рады, что вы смогли осмотреть выставку с простором вокруг.', 'Надеемся, вы ощутили простор наших открытых залов.'],
    ar: ['يسعدنا أنكم تمكنتم من مشاهدة المعرض في رحابة من المكان.', 'نأمل أنكم شعرتم باتساع قاعاتنا الفسيحة.'],
    hi: ['हमें खुशी है कि आपने खुली जगह में आराम से प्रदर्शनी देखी।', 'आशा है आपने हमारे विशाल हॉल के खुलेपन को महसूस किया।'],
    tl: ['Natutuwa kami na napanood ninyo ang eksibisyon nang may luwag.', 'Sana naramdaman ninyo ang lawak ng aming maaliwalas na mga bulwagan.'],
  },
}

function poolLine(pool: Record<string, Partial<Record<Language, string[]>>>, tag: string, lang: Language, idx: number): string {
  const arr = pool[tag]?.[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ── 서사 조립 순서 (낮을수록 본문 앞쪽) ────────────────────────────────────────────
const DIM_ORDER: Record<string, number> = {
  'persona:가족': 0, 'persona:데이트': 0, 'persona:친구': 0,
  'sensory:빛': 1, 'sensory:물': 1, 'sensory:향': 1, 'sensory:소리': 1,
  'spatial:넓은공간': 2, 'spatial:포토스팟': 2,
  'temporal:아침': 3, 'temporal:저녁': 3, 'temporal:주말': 3,
  'persona:단골': 4,  // 재방문 인정은 본문 후반
}

function resolveLine(sig: FragmentSignal, lang: Language, idx: FragmentIndices): string {
  switch (sig.dim) {
    case 'sensory':  return slotSensory(lang, sig.tag, idx.sensory)
    case 'persona':  return sig.tag === '단골' ? slotRepeatVisitor(lang, idx.persona) : slotCompanion(lang, sig.tag, idx.persona)
    case 'spatial':  return poolLine(SPATIAL_LINES, sig.tag, lang, idx.spatial)
    case 'temporal': return poolLine(TEMPORAL_LINES, sig.tag, lang, idx.temporal)
  }
}

/**
 * selectFragments — 가중치 거버너 + top-N pruning.
 * @param signals 추출된 다차원 신호 (가중치 포함)
 * @param lang    답변 언어
 * @param budget  최대 조각 수 (리뷰 길이 비례, 1~3)
 * @param idx     차원별 변형 인덱스
 * @returns 서사 순서로 정렬된 현지화 마이크로 조각 배열 (≤ budget개)
 */
export function selectFragments(signals: FragmentSignal[], lang: Language, budget: number, idx: FragmentIndices): string[] {
  if (budget <= 0) return []
  const resolved = signals
    .map((s) => ({ ...s, line: resolveLine(s, lang, idx), order: DIM_ORDER[`${s.dim}:${s.tag}`] ?? 9 }))
    .filter((r) => r.line)                               // 미커버 언어('') 스킵
  const top = [...resolved].sort((a, b) => b.weight - a.weight).slice(0, budget)  // 가중치 top-N
  return top.sort((a, b) => a.order - b.order).map((r) => r.line)                 // 서사 순서 재배열
}

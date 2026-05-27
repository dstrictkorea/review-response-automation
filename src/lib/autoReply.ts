/**
 * Rule-based auto reply generator.
 * Used for simple 4-5 star reviews with no risk signals.
 * Zero AI tokens consumed.
 */

// ─── Hard-coded risk signals ──────────────────────────────────────────────────
const RISK_KEYWORDS_KO = [
  '환불', '보상', '배상', '소송', '고소', '법적', '변호사', '사고', '부상',
  '다쳤', '병원', '언론', '기자', '방송', 'cctv', '차별', '위생', '불결',
  '유포', '신고', '처벌', '징계',
]
const RISK_KEYWORDS_EN = [
  'refund', 'compensation', 'lawsuit', 'sue', 'legal', 'lawyer', 'attorney',
  'accident', 'injury', 'injured', 'hospital', 'media', 'press', 'news',
  'discrimination', 'racist', 'hygiene', 'unsanitary', 'dangerous',
]

// ─── Language detection ───────────────────────────────────────────────────────
export function detectLang(text: string): 'ko' | 'en' | 'zh' | 'ja' {
  if (!text) return 'ko'
  const ko = (text.match(/[가-힣]/g) ?? []).length
  const ja = (text.match(/[぀-ヿ]/g) ?? []).length
  const zh = (text.match(/[一-鿿]/g) ?? []).length
  const total = text.length
  if (ko / total > 0.15) return 'ko'
  if (ja / total > 0.1) return 'ja'
  if (zh / total > 0.15) return 'zh'
  return 'en'
}

// ─── Auto-generatability check ────────────────────────────────────────────────
export interface AutoCheckResult {
  canAuto: boolean
  reason: string
}

export function checkAutoGeneratable(
  rating: number | null,
  text: string | null,
): AutoCheckResult {
  // Must be 4 or 5 stars
  if (rating == null || rating < 4) {
    return { canAuto: false, reason: '별점이 낮아 AI 초안이 필요합니다.' }
  }

  const t = (text ?? '').toLowerCase()

  // Risk keyword guard
  for (const w of RISK_KEYWORDS_KO) {
    if (t.includes(w)) return { canAuto: false, reason: `위험 키워드 감지: "${w}"` }
  }
  for (const w of RISK_KEYWORDS_EN) {
    if (t.includes(w)) return { canAuto: false, reason: `Risk keyword detected: "${w}"` }
  }

  // Long reviews with complex sentences → send to AI
  if (t.length > 200) {
    return { canAuto: false, reason: '긴 리뷰 — AI 분석이 더 정확합니다.' }
  }

  return { canAuto: true, reason: '짧고 긍정적인 리뷰 — 알고리즘으로 즉시 생성 가능' }
}

// ─── Template bank ────────────────────────────────────────────────────────────
// Indexed by [lang][rating 4|5][variant 0-2]
const TEMPLATES: Record<string, Record<4 | 5, string[]>> = {
  ko: {
    5: [
      '안녕하세요! 아르떼뮤지엄을 찾아주셔서 진심으로 감사드립니다. 즐거운 시간을 보내셨다니 저희도 정말 기쁩니다. 다음에도 좋은 추억 만들러 오세요!',
      '따뜻한 후기를 남겨 주셔서 감사합니다. 저희 팀 모두에게 큰 힘이 됩니다. 다음 방문도 기대하겠습니다!',
      '소중한 방문과 후기에 진심으로 감사드립니다. 언제나 즐겁고 특별한 경험을 드릴 수 있도록 최선을 다하겠습니다.',
    ],
    4: [
      '방문해 주셔서 감사합니다! 좋은 시간을 보내셨다니 기쁩니다. 더 나은 경험을 드릴 수 있도록 계속 노력하겠습니다.',
      '소중한 후기 감사드립니다. 아쉬운 점이 있으셨다면 앞으로 더욱 개선하겠습니다. 다음 방문을 기대하겠습니다.',
      '리뷰를 남겨주셔서 감사합니다. 더 좋은 모습으로 보답할 수 있도록 꾸준히 발전해 나가겠습니다.',
    ],
  },
  en: {
    5: [
      'Thank you so much for visiting ARTE Museum and leaving such a wonderful review! We\'re thrilled you had a great experience. Hope to see you again soon!',
      'We truly appreciate your kind words! It means a great deal to our whole team. We look forward to welcoming you back!',
      'Thank you for your lovely review! We\'re so glad you enjoyed your visit. See you next time!',
    ],
    4: [
      'Thank you for visiting ARTE Museum and for your feedback! We\'re happy you had a good experience and we\'ll keep working to make it even better.',
      'We appreciate you taking the time to share your thoughts! Your feedback helps us improve. We hope to see you again soon.',
      'Thank you for your kind review! We always strive to provide the best experience possible and look forward to your next visit.',
    ],
  },
  zh: {
    5: [
      '非常感谢您来访ARTE Museum并留下这么好的评价！很高兴您度过了愉快的时光，期待您再次光临！',
      '感谢您的宝贵评价！您的鼓励是我们进步的动力。期待下次与您再会！',
      '非常感谢您的支持！希望我们的展览给您留下了美好的回忆，欢迎再次来访！',
    ],
    4: [
      '感谢您的来访和评价！很高兴您喜欢我们的展览，我们会继续努力提供更好的体验！',
      '非常感谢您的反馈！我们会认真参考您的意见，不断改进服务。期待您再次光临！',
      '感谢您的宝贵意见！我们将努力为每位游客提供更好的体验。欢迎再次来访！',
    ],
  },
  ja: {
    5: [
      'ARTE Museumにご来館いただき、またこのような素晴らしいレビューをいただき、誠にありがとうございます！またのお越しをお待ちしております！',
      '温かいご感想をいただき、スタッフ一同大変励みになっております。またぜひご来館ください！',
      'ご来館ありがとうございます！楽しい時間を過ごしていただけたとのこと、とても嬉しく思います。またのご来館をお待ちしております！',
    ],
    4: [
      'ご来館いただき、フィードバックをありがとうございます！より良い体験を提供できるよう、引き続き努めてまいります。またのお越しをお待ちしております。',
      '貴重なご意見をいただき、ありがとうございます。ご指摘を参考にさらに改善してまいります。またぜひご来館ください。',
      'レビューをありがとうございます！皆さまに満足していただけるよう、サービス向上に取り組んでまいります。',
    ],
  },
}

// ─── Main generator ───────────────────────────────────────────────────────────
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
  forbidden_check: {
    refund_promise: false
    legal_admission: false
    cctv_mention: false
    staff_discipline: false
  }
}

/** Stable variant selection: same review always gets same template */
function pickVariant(reviewId: string, count: number): number {
  let h = 0
  for (let i = 0; i < reviewId.length; i++) {
    h = Math.imul(31, h) + reviewId.charCodeAt(i) | 0
  }
  return Math.abs(h) % count
}

export function generateAutoReply(
  reviewId: string,
  rating: number,
  text: string | null,
): AutoReplyResult {
  const lang = detectLang(text ?? '')
  const bucket = (TEMPLATES[lang] ?? TEMPLATES['ko']) as Record<4 | 5, string[]>
  const tier = rating >= 5 ? 5 : 4
  const variants = bucket[tier]
  const idx = pickVariant(reviewId, variants.length)
  const standard = variants[idx]

  // Short = first sentence only
  const short = standard.split(/[.!。！]/)[0].trim() + (rating >= 5 ? '!' : '.')

  // Careful = standard + a warm closing note
  const closings: Record<string, string> = {
    ko: ' 앞으로도 항상 최선을 다하는 아르떼뮤지엄이 되겠습니다.',
    en: ' We are committed to continuously improving your experience at ARTE Museum.',
    zh: ' 我们将一如既往地为您提供最好的体验。',
    ja: ' 今後もより良い体験をご提供できるよう努めてまいります。',
  }
  const careful = standard + (closings[lang] ?? closings['ko'])

  return {
    draft_short: short,
    draft_standard: standard,
    draft_careful: careful,
    detected_language: lang,
    sentiment: 'positive',
    risk_level: 'low',
    categories: ['general'],
    risk_reasons: [],
    internal_note_ko: `알고리즘 자동 생성 (${rating}★, 언어: ${lang})`,
    forbidden_check: {
      refund_promise: false,
      legal_admission: false,
      cctv_mention: false,
      staff_discipline: false,
    },
  }
}

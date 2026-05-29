/**
 * aiService.ts — 글로벌 다차원 AI 프롬프트 엔진
 *
 * 설정 테이블의 reply_templates를 Base 레이아웃으로 가져와
 * 국가별 문화 톤앤무드 + 시스템 동적 변수 주입 파이프라인을 제공합니다.
 *
 * 시스템 변수:
 *   {{branch_name}}        지점 공식 명칭
 *   {{channel_name}}       리뷰 유입 플랫폼
 *   {{detected_language}}  고객 리뷰 원어
 *   {{core_complaint}}     AI 추출 핵심 불만
 *   {{cultural_tone}}      국가별 정서 톤앤무드 지침 (AI에게만 노출, 답변에 미포함)
 *   {{reviewer_name}}      리뷰어 이름
 *   {{rating}}             별점
 *
 * 사용처:
 *   - IntelligentOrchestrator  (배치/자동 처리)
 *   - /api/ai/generate-reply   (수동 단건 생성)
 */

import type { RiskKeyword, ReplyTemplate } from '@/types/database'

// ── 국가별 문화 톤앤무드 프로파일 ─────────────────────────────────────────────

export interface CulturalProfile {
  countryCode: string
  regionLabel: string
  toneGuide: string
  defaultLanguage: string
}

/** ISO 국가 코드 → 문화 응대 프로파일 */
const COUNTRY_PROFILES: Record<string, CulturalProfile> = {
  KR: {
    countryCode: 'KR',
    regionLabel: '대한민국',
    defaultLanguage: 'ko',
    toneGuide:
      // ── 언어 순도 절대 규칙 ──────────────────────────────────────────────
      '[절대 금지 — 언어 순도] 한국어 답변에 한자(们·请·您·谢·館·様 등), 일본어 가나, ' +
      '기타 외국 문자를 단 한 글자도 섞지 마십시오. ' +
      '방문객们, 고객들们, 관객样 같은 혼용 표현은 브랜드를 심각하게 훼손합니다. ' +
      '호칭 규칙: 단수 → "고객님", 복수 → "관람객 분들" 또는 "내원해 주신 고객님들". ' +
      // ── 톤앤무드 ─────────────────────────────────────────────────────────
      '정중하고 따뜻한 한국식 고객 응대 톤. 존칭어(합쇼체) 사용 필수. ' +
      '"~해 드리겠습니다", "~주셨으면 합니다", "~드릴 수 있도록 노력하겠습니다" 형식 선호. ' +
      '과도한 사과(죄송합니다 반복)보다 개선 의지·감사·재방문 초대를 강조. ' +
      '시작: "소중한 방문과 귀중한 의견 감사드립니다" 또는 "ARTE Museum을 찾아주셔서 감사합니다". ' +
      // ── 포용적 개선 의지 (CS 헌법 — 불편/개선 의견 시 필수) ──────────────
      '[불편·개선 언급 시 필수 표현]: "고객님의 소중한 의견을 귀담아듣겠습니다. ' +
      '말씀해 주신 [불편 사항]에 대해 적극적으로 개선해 나가겠습니다." ' +
      '— 이 뉘앙스를 변명 없이, 수용적이고 발전적으로 자연스럽게 녹여낼 것.',
  },
  US: {
    countryCode: 'US',
    regionLabel: 'United States',
    defaultLanguage: 'en',
    toneGuide:
      // ── Legal-defensive premium tone ─────────────────────────────────────
      'LEGAL SAFETY FIRST: Never say "sorry for the inconvenience" — it implies fault. ' +
      'Use solution-forward language: "We appreciate you bringing this to our attention." ' +
      // ── Tone ─────────────────────────────────────────────────────────────
      'Professional, warm, world-class. Address: "you" (singular) / "our valued guests" (plural). ' +
      'Empathy without concession: acknowledge feelings, not fault. ' +
      // ── Inclusive improvement commitment (CS Constitution) ───────────────
      '[For ANY complaint/suggestion — mandatory]: "We truly appreciate your feedback on [X]. ' +
      'Your input helps us grow, and we are actively working to improve this aspect of the experience." ' +
      '— Be specific to the reviewer\'s concern; avoid boilerplate. ' +
      'Close with: "We look forward to welcoming you back to ARTE Museum."',
  },
  AE: {
    countryCode: 'AE',
    regionLabel: 'UAE / Dubai',
    defaultLanguage: 'en',
    toneGuide:
      // ── Gulf hospitality — formal English, multicultural awareness ────────
      'Reflect the highest standards of Gulf hospitality. ' +
      'Tone: formal, gracious, inclusive of the diverse nationalities visiting. ' +
      'Address: "our esteemed guest" / "valued visitor". ' +
      'Opening: "We are deeply grateful for your visit and for sharing your experience." ' +
      'Never admit liability. Acknowledge with dignity and grace. ' +
      // ── Inclusive improvement commitment (CS Constitution) ───────────────
      '[For ANY complaint/suggestion — mandatory]: "We are deeply grateful for your candid ' +
      'feedback regarding [X]. We take such insights seriously and are committed to enhancing ' +
      'every facet of the ARTE Museum experience for all our esteemed guests." ' +
      'Close: "It would be our honour to welcome you back to ARTE Museum Dubai."',
  },
  JP: {
    countryCode: 'JP',
    regionLabel: '日本',
    defaultLanguage: 'ja',
    toneGuide:
      // ── 最上位敬語体系 ───────────────────────────────────────────────────
      '【最重要】最高水準の敬語（尊敬語・謙譲語・丁寧語）を完全に組み合わせること。' +
      '호칭: お客様（個人）、ご来場のお客様（複数）。絶対に「ゲスト」のみで終わらせない。' +
      '行動表現: 「〜させていただきます」「〜いたします」「〜申し上げます」を使い分ける。' +
      '感謝: 「ご来館いただき、誠にありがとうございます」' +
      // ── 포용적 개선 의지 (CS 헌법) ──────────────────────────────────────
      '[改善意見・ご不満がある場合 — 必須]: ' +
      '「〇〇についての貴重なご意見をいただき、誠にありがとうございます。 ' +
      'いただいたご意見を真摯に受け止め、より良いご体験をご提供できますよう ' +
      '改善に向けて尽力してまいります。」— 具体的な不満内容に言及し、誠意を伝えること。' +
      // ── 법적 안전 ────────────────────────────────────────────────────────
      '法的責任の認定・補償約束・CCTV言及は絶対に禁止。' +
      '結び: 「またのご来館を、心よりお待ち申し上げております。」',
  },
  CN: {
    countryCode: 'CN',
    regionLabel: '中国',
    defaultLanguage: 'zh',
    toneGuide:
      // ── 正式商务中文 ─────────────────────────────────────────────────────
      '使用标准书面中文（普通话），体现高端文化艺术机构的品位与专业素养。' +
      '称谓: "尊贵的顾客"（个人）或"各位贵宾"（复数）。' +
      '开头: "感谢您莅临ARTE Museum，您的到来是我们最大的荣幸。"' +
      // ── 포용적 개선 의지 (CS 헌법) ──────────────────────────────────────
      '[存在不便或改善建议时 — 必须包含]: ' +
      '"非常感谢您提出的宝贵意见。关于您提到的[不便之处]，我们将认真倾听并积极改进，' +
      '致力于为每位贵宾提供更优质的艺术体验。" ' +
      '— 需针对具体问题作出回应，避免套话。' +
      // ── 법적 안전 ────────────────────────────────────────────────────────
      '严禁承认任何法律责任、做出赔偿承诺、或提及内部监控/调查。' +
      '结语: "期待您再次莅临，共同感受艺术的无限魅力。"',
  },
  AR: {
    countryCode: 'AR',
    regionLabel: 'الشرق الأوسط',
    defaultLanguage: 'ar',
    toneGuide:
      // ── رسمي — ضيافة خليجية ──────────────────────────────────────────────
      'استخدم اللغة العربية الفصحى الرسمية التي تعكس قيم الضيافة العربية الأصيلة. ' +
      'المخاطبة: "أيها الضيف الكريم" (فرد) أو "أعزاءنا الزوار" (جمع). ' +
      'الافتتاح: "يسعدنا أن يكون لنا شرف استقبالكم في ARTE Museum." ' +
      // ── 포용적 개선 의지 (CS 헌법) ──────────────────────────────────────
      '[عند وجود شكوى أو اقتراح — إلزامي]: ' +
      '"نشكركم جزيل الشكر على هذه الملاحظات القيّمة. ' +
      'إننا نأخذ ما تفضلتم بذكره بشأن [المشكلة] بكل جدية، ' +
      'ونعمل جاهدين على التحسين المستمر لنقدم لكم تجربة أرقى وأجمل." ' +
      '— كن محدداً في الإشارة إلى المشكلة؛ تجنب الردود النمطية. ' +
      // ── السلامة القانونية ──────────────────────────────────────────────
      'يُحظر تماماً الإقرار بأي مسؤولية قانونية أو تقديم وعود بالتعويض. ' +
      'الختام: "نتطلع بكل شوق إلى استقبالكم مجدداً."',
  },
}

/** 기본 언어 코드 → 국가 코드 fallback */
const LANG_TO_COUNTRY: Record<string, string> = {
  ko: 'KR',
  en: 'US',
  ja: 'JP',
  zh: 'CN',
  ar: 'AR',
}

/** 알려진 지점 코드 → 국가 코드 (DB에 추가된 지점은 default_language로 fallback) */
const BRANCH_TO_COUNTRY: Record<string, string> = {
  AMNY: 'US',
  AMLV: 'US',
  AMDB: 'AE',
  AMDU: 'AE',
  AMSH: 'CN',
  AMGZ: 'CN',
  AMCN: 'CN',
  AMTK: 'JP',
  AMSK: 'JP',
  AMOK: 'JP',
  AMBS: 'KR',
  AMJE: 'KR',
  AMGW: 'KR',
  AMGO: 'KR',
  AMYJ: 'KR',
  AMJJ: 'KR',
  AMSE: 'KR',
}

/**
 * 지점 코드 + 기본 언어로 문화 프로파일을 결정합니다.
 *
 * 우선순위:
 *   1. DB branches.country_code (countryCodeFromDb) — migration 004 이후 기본값
 *   2. BRANCH_TO_COUNTRY 하드코딩 맵 (DB 값 없을 때 fallback)
 *   3. 기본 언어 코드 fallback
 *   4. US default
 *
 * @param branchCode       지점 코드 (AMNY, AMBS …)
 * @param defaultLanguage  리뷰 언어 (ko, en, ja, zh, ar)
 * @param countryCodeFromDb  DB branches.country_code (있으면 하드코딩 맵보다 우선)
 */
export function getCulturalProfile(
  branchCode: string,
  defaultLanguage: string,
  countryCodeFromDb?: string | null,
): CulturalProfile {
  // 1. DB 값 최우선 (PHASE 4 — branches.country_code 동적 참조)
  if (countryCodeFromDb && COUNTRY_PROFILES[countryCodeFromDb]) {
    return COUNTRY_PROFILES[countryCodeFromDb]
  }
  // 2. 하드코딩 맵 fallback (DB country_code 미설정 지점 대비)
  const byBranch = BRANCH_TO_COUNTRY[branchCode.toUpperCase()]
  if (byBranch && COUNTRY_PROFILES[byBranch]) return COUNTRY_PROFILES[byBranch]
  // 3. 언어 코드 fallback
  const byLang = LANG_TO_COUNTRY[defaultLanguage]
  if (byLang && COUNTRY_PROFILES[byLang]) return COUNTRY_PROFILES[byLang]
  // 4. 기본값
  return COUNTRY_PROFILES.US
}

// ── 시스템 동적 변수 정의 (설정 UI에서 가이드 칩으로 노출) ─────────────────────

export const SYSTEM_VARIABLES = [
  {
    key: '{{branch_name}}' as const,
    label: '지점 공식 명칭',
    description: '해당 전시장의 글로벌 공식 명칭 (예: ARTE Museum New York)',
  },
  {
    key: '{{channel_name}}' as const,
    label: '리뷰 채널',
    description: '리뷰가 유입된 플랫폼 (예: Google, TripAdvisor, Klook)',
  },
  {
    key: '{{detected_language}}' as const,
    label: '고객 원어',
    description: '인입된 고객 리뷰의 원어 (예: 한국어, English, 日本語)',
  },
  {
    key: '{{core_complaint}}' as const,
    label: '핵심 불만',
    description: 'AI가 리뷰 본문에서 추출한 핵심 불만 사항',
  },
  {
    key: '{{cultural_tone}}' as const,
    label: '국가별 톤앤무드',
    description: '지점 소재 국가의 문화적 정서에 맞춘 응대 지침 (AI 프롬프트 전용)',
  },
  {
    key: '{{reviewer_name}}' as const,
    label: '리뷰어 이름',
    description: '리뷰 작성자 이름 (없으면 "고객님"으로 대체)',
  },
  {
    key: '{{rating}}' as const,
    label: '별점',
    description: '리뷰 별점 (1–5)',
  },
] as const

export type SystemVariableKey = (typeof SYSTEM_VARIABLES)[number]['key']

// ── 템플릿 변수 치환 ────────────────────────────────────────────────────────────

export interface TemplateVars {
  branch_name: string
  channel_name: string
  detected_language: string
  core_complaint: string
  cultural_tone: string
  reviewer_name: string
  rating: string
}

/**
 * 템플릿 content 내의 {{variable}} 마커를 실제 값으로 치환합니다.
 * DB에 저장된 템플릿에서 AI 프롬프트 컨텍스트로 주입되는 경로에서만 호출됩니다.
 */
export function resolveTemplateVars(
  content: string,
  vars: TemplateVars,
): string {
  return content
    .replace(/\{\{branch_name\}\}/g, vars.branch_name)
    .replace(/\{\{channel_name\}\}/g, vars.channel_name)
    .replace(/\{\{detected_language\}\}/g, vars.detected_language)
    .replace(/\{\{core_complaint\}\}/g, vars.core_complaint || '(AI가 추출)')
    .replace(/\{\{cultural_tone\}\}/g, vars.cultural_tone)
    .replace(/\{\{reviewer_name\}\}/g, vars.reviewer_name)
    .replace(/\{\{rating\}\}/g, vars.rating)
}

// ── 시스템 프롬프트 빌더 ────────────────────────────────────────────────────────

/**
 * buildSystemPrompt — 단일 진실 공급원(SSOT) 시스템 프롬프트 생성기
 *
 * IntelligentOrchestrator와 /api/ai/generate-reply 모두 이 함수를 사용합니다.
 * 문화 프로파일과 언어 매칭된 템플릿을 주입하여 글로벌 맞춤 응대를 구현합니다.
 */
export function buildSystemPrompt(
  culturalProfile: CulturalProfile,
  matchedTemplates: ReplyTemplate[],
): string {
  const templateSection =
    matchedTemplates.length > 0
      ? matchedTemplates
          .slice(0, 5)
          .map((t) => {
            const resolved = t.content
              .replace(/\{\{branch_name\}\}/g, '<branch_name>')
              .replace(/\{\{channel_name\}\}/g, '<channel_name>')
              .replace(/\{\{core_complaint\}\}/g, '<core_complaint>')
              .replace(/\{\{reviewer_name\}\}/g, '<reviewer_name>')
              .replace(/\{\{rating\}\}/g, '<rating>')
            return `  [${t.category}/${t.language}] ${t.name}:\n  "${resolved.slice(0, 180)}${resolved.length > 180 ? '…"' : '"'}`
          })
          .join('\n\n')
      : '  (이 언어에 대한 등록된 템플릿 없음 — 자유 형식으로 작성)'

  return `You are the Global Reputation Manager for ARTE Museum.
Analyze the review and generate exactly 3 reply drafts as a valid JSON object.

CULTURAL TONE PROFILE — ${culturalProfile.regionLabel} [${culturalProfile.countryCode}]:
${culturalProfile.toneGuide}

DUAL AUDIENCE — every reply is PUBLIC:
  1. The reviewer — acknowledge their specific experience directly.
  2. Future visitors — show ARTE is professional, caring, and world-class.

ABSOLUTE SAFETY RULES — NEVER VIOLATE UNDER ANY CIRCUMSTANCES:
1. Never promise refunds or monetary compensation.
2. Never admit legal liability or responsibility for injuries/accidents.
3. Never mention CCTV review or investigation.
4. Never promise staff punishment or disciplinary action.
5. Always reply in the SAME language as the review — PURE script only.
6. Vary the opening phrase — never start every reply identically.
7. Never reveal internal operational details.

GLOBAL CS CONSTITUTION — MANDATORY WHEN REVIEWER MENTIONS COMPLAINTS OR SUGGESTIONS:
1. NEVER make excuses or argue. Acknowledge first, improve second.
2. ALWAYS express genuine appreciation: "Thank you for this valuable feedback."
3. ALWAYS include a concrete, specific improvement commitment — reference the exact issue mentioned.
   BAD: "We will work hard to improve." (generic)
   GOOD: "We have noted your feedback about the long queue at the entrance and are reviewing our
         visitor flow management." (specific)
4. Applies to ALL star ratings — a 5★ review with a minor parking suggestion still deserves this.
5. This commitment must feel sincere, not boilerplate. Match the cultural tone profile above.

CRITICAL LANGUAGE PURITY — ZERO TOLERANCE:
- Korean reply (ko): Use ONLY 한글 (Hangul). ABSOLUTELY FORBIDDEN: mixing Chinese characters
  (们·请·您·谢·様·等·館·館), Japanese kana, or any non-Korean script. Even ONE foreign character
  (e.g. "방문객们") invalidates the entire reply and damages brand trust irreparably.
  Correct address: "고객님" (singular), "관람객 분들" / "내원해 주신 고객님들" (plural).
- Japanese reply (ja): Use ONLY Japanese (Hiragana/Katakana/Kanji). Do NOT mix Korean Hangul.
- Chinese reply (zh): Use ONLY Simplified Chinese. Do NOT mix Korean or Japanese characters.
- Arabic reply (ar): Use ONLY Arabic script. Do NOT mix Latin characters unnecessarily.

RISK CLASSIFICATION GUIDE — star rating NEVER determines risk; ONLY text context matters:
- low:      Positive or neutral. Minor convenience feedback (queue, parking, signage).
            Even 1★ "너무 좋아요!" = LOW. Even 5★ "parking was tight" = LOW.
            → Auto-ready for marketing staff approval. CS Constitution still applies.
- medium:   Genuine complaints needing careful handling: staff attitude, repeated inconvenience,
            service quality issues, misleading information. Requires thoughtful draft_careful.
            Even a 5★ review saying "staff was rude" = MEDIUM.
- high:     Refund/compensation demands, safety concerns, strong staff misconduct allegations,
            threat to not return and warn others publicly.
- critical: Injury/accident reports, legal threats, discrimination, media exposure threats,
            police involvement, discrimination claims.

CORE COMPLAINT EXTRACTION:
For the "core_complaint" field, extract the single most specific complaint or concern
from the review (e.g., "화장실 청결도 불량", "입장 대기 시간 과다", "staff rudeness at entrance").
If no complaint, return an empty string.

SYSTEM VARIABLES IN TEMPLATES:
When you generate draft replies, the following variables should be resolved:
  {{branch_name}}   → use the actual branch name from context
  {{channel_name}}  → use the actual channel name from context
  {{reviewer_name}} → use reviewer name, fallback to "고객님" / "our valued guest"
  {{rating}}        → use the actual star rating from context
  {{core_complaint}} → use the complaint you extracted above

PRE-FILTER ALERT HANDLING:
If a PRE-FILTER ALERT section appears in the user message:
- Your risk_level must be AT LEAST the pre-filter level stated.
- Your isolation_reason must explicitly reference ALL detected expressions.

LANGUAGE-MATCHED REPLY STYLE REFERENCE (use as style guidance):
${templateSection}

OUTPUT FORMAT: Valid JSON only — no markdown wrapper, no prose outside JSON.
{
  "detected_language": "ko" | "en" | "zh" | "ja" | "ar" | "...",
  "sentiment": "positive" | "neutral" | "mixed" | "negative",
  "risk_level": "low" | "medium" | "high" | "critical",
  "categories": ["string"],
  "risk_reasons": ["string"],
  "core_complaint": "핵심 불만 한 줄 요약 (없으면 빈 문자열)",
  "isolation_reason": "격리 사유 한국어 서술. 격리 불필요 시 빈 문자열.",
  "internal_note_ko": "담당자에게 전달할 내부 메모 (한국어)",
  "forbidden_check": {
    "refund_promise": false,
    "legal_admission": false,
    "cctv_mention": false,
    "staff_discipline": false
  },
  "draft_short": "1-2 sentence warm acknowledgment",
  "draft_standard": "2-4 sentences — addresses reviewer AND reassures future visitors",
  "draft_careful": "4-6 sentences — empathetic, thorough, one concrete improvement note"
}`
}

// ── 유저 메시지 빌더 ────────────────────────────────────────────────────────────

export interface ReviewContext {
  branchCode: string
  branchDisplayName: string
  channelCode: string
  channelName: string
  rating: number | null
  reviewerName: string | null
  reviewText: string
  preFilterNote: string
  activeKeywords: RiskKeyword[]
  /**
   * 재방문 고객 감지 — 동일 지점에 이전 리뷰가 있는 경우 > 0
   * buildUserMessage()가 AI에게 재방문 컨텍스트를 주입하는 데 사용됨
   */
  reviewerPreviousCount?: number
}

/**
 * buildUserMessage — 리뷰 컨텍스트를 AI 유저 메시지로 변환합니다.
 * IntelligentOrchestrator와 /api/ai/generate-reply 모두 사용합니다.
 */
export function buildUserMessage(ctx: ReviewContext): string {
  const ratingLine = ctx.rating != null ? `${ctx.rating}/5` : 'N/A'
  const reviewerLine = ctx.reviewerName ?? 'Anonymous'

  const keywordContext =
    ctx.activeKeywords.length > 0
      ? ctx.activeKeywords
          .map((k) => `  - "${k.keyword}" (${k.language}, risk: ${k.risk_level})`)
          .join('\n')
      : '  (none configured)'

  // 재방문 고객 컨텍스트 노트
  const repeatVisitorNote =
    ctx.reviewerPreviousCount && ctx.reviewerPreviousCount > 0
      ? `REPEAT VISITOR CONTEXT: This reviewer has submitted ${ctx.reviewerPreviousCount} previous review(s) at this branch. ` +
        `Naturally acknowledge their loyalty in your reply — e.g. "재방문해 주셔서 깊이 감사드립니다" (KO), ` +
        `"We're delighted to welcome you back" (EN), "またのご来館ありがとうございます" (JA), "感谢您的再次光临" (ZH).\n`
      : ''

  return (
    `Branch: ${ctx.branchCode} — ${ctx.branchDisplayName}\n` +
    `Channel: ${ctx.channelCode} (${ctx.channelName})\n` +
    `Rating: ${ratingLine}\n` +
    `Reviewer: ${reviewerLine}\n` +
    `${repeatVisitorNote}` +
    `${ctx.preFilterNote ? ctx.preFilterNote + '\n' : ''}` +
    `Review text:\n${ctx.reviewText}\n\n` +
    `CONTEXT FOR YOUR REPLY:\n` +
    `- This reply will be posted PUBLICLY on ${ctx.channelCode}.\n` +
    `- Future visitors will read it when deciding whether to visit.\n` +
    `- Branch full name: ${ctx.branchDisplayName}\n` +
    `- Channel display name: ${ctx.channelName}\n\n` +
    `ACTIVE RISK KEYWORDS (from settings):\n${keywordContext}\n\n` +
    `Generate three reply drafts and classify the review. Return JSON only.`
  )
}

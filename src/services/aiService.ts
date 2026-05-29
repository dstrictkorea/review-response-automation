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
      '정중하고 따뜻한 한국식 고객 응대 톤. 존칭어 사용 필수. ' +
      '"~해 드리겠습니다", "~드렸으면 합니다" 형식 선호. ' +
      '과도한 사과보다 개선 의지·감사·방문 초대를 강조. ' +
      '"안녕하세요"로 시작하거나 "소중한 방문 감사드립니다"로 열어도 좋음.',
  },
  US: {
    countryCode: 'US',
    regionLabel: 'United States',
    defaultLanguage: 'en',
    toneGuide:
      'Professional, warm, and legally prudent. ' +
      'Never admit fault or legal liability — use solution-oriented phrasing instead. ' +
      '"We take all feedback seriously and are committed to continuous improvement." ' +
      'Avoid over-apologizing; express empathy without concession. ' +
      'Close warmly: "We look forward to welcoming you back."',
  },
  AE: {
    countryCode: 'AE',
    regionLabel: 'UAE / Dubai',
    defaultLanguage: 'en',
    toneGuide:
      'Formal and respectful tone reflecting Gulf hospitality standards. ' +
      'Use inclusive, welcoming language acknowledging the cultural diversity of guests. ' +
      '"We deeply value the trust you have placed in us." ' +
      'Never admit liability. Acknowledge the guest\'s experience with grace. ' +
      'Close with a warm, sincere invitation to return.',
  },
  JP: {
    countryCode: 'JP',
    regionLabel: '日本',
    defaultLanguage: 'ja',
    toneGuide:
      '極めて丁寧な敬語（尊敬語・謙譲語）を使用すること。' +
      '謝罪は誠実に行うが、法的責任の認定や補償の約束は絶対に避ける。' +
      'お客様への深い感謝と、改善への真摯な取り組みを伝える。' +
      '「〜させていただきます」「〜いたします」形式を多用。' +
      '結びは「またのご来館を心よりお待ち申し上げております」形式で締める。',
  },
  CN: {
    countryCode: 'CN',
    regionLabel: '中国',
    defaultLanguage: 'zh',
    toneGuide:
      '使用正式、礼貌的中文表达，体现文化艺术机构的品位与专业。' +
      '避免承认任何法律责任或做出赔偿承诺。' +
      '强调博物馆对服务质量的持续改进和对客户反馈的高度重视。' +
      '语气诚恳、专业，传递真诚关怀。结尾以"期待您的再次光临"收尾。',
  },
  AR: {
    countryCode: 'AR',
    regionLabel: 'الشرق الأوسط',
    defaultLanguage: 'ar',
    toneGuide:
      'استخدم لغة رسمية ومحترمة تعكس قيم الضيافة العربية الأصيلة. ' +
      'لا تُقرّ بأي مسؤولية قانونية أو تتعهد بالتعويض. ' +
      'أبرز التزام المتحف بتحسين الخدمة وتقدير ملاحظات الزوار. ' +
      'اختتم بدعوة دافئة وصادقة للعودة.',
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
 * 우선순위: 지점 코드 직접 매핑 → 기본 언어 fallback → US default
 */
export function getCulturalProfile(
  branchCode: string,
  defaultLanguage: string,
): CulturalProfile {
  const byBranch = BRANCH_TO_COUNTRY[branchCode.toUpperCase()]
  if (byBranch && COUNTRY_PROFILES[byBranch]) return COUNTRY_PROFILES[byBranch]
  const byLang = LANG_TO_COUNTRY[defaultLanguage]
  if (byLang && COUNTRY_PROFILES[byLang]) return COUNTRY_PROFILES[byLang]
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
5. Always reply in the SAME language as the review.
6. Vary the opening phrase — never start every reply identically.
7. Never reveal internal operational details.

RISK CLASSIFICATION GUIDE:
- low: Positive/neutral, no sensitive content
- medium: Minor complaints, improvement requests
- high: Refund requests, safety concerns, staff complaints, 1–2★ with strong language
- critical: Injury/accident reports, legal threats, discrimination, media threats, police reports

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

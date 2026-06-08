/**
 * intents.ts — 인텐트 표시 메타데이터 (순수 데이터, 서버/클라이언트 공용)
 *
 * createAdminClient 의존성이 없는 순수 데이터 모듈 — 클라이언트 번들 안전.
 * UI 배지 렌더링용 라벨/색상을 관리합니다.
 */

import type { Language } from '@/lib/i18n'

export type PipelineEngine = 'template' | 'llm'

/** 인텐트 코드 → 4개 국어 라벨 */
export const INTENT_LABELS: Record<string, Record<Language, string>> = {
  positive_overall: { ko: '긍정 전반', en: 'Positive',        ja: '高評価',     zh: '整体好评' },
  immersive_exp:    { ko: '몰입 경험', en: 'Immersive',       ja: '没入体験',   zh: '沉浸体验' },
  photo_zone:       { ko: '포토존',    en: 'Photo Spot',      ja: 'フォト',     zh: '拍照打卡' },
  lighting_display: { ko: '조명/전시', en: 'Lighting',        ja: '照明展示',   zh: '灯光展示' },
  staff_praise:     { ko: '직원 칭찬', en: 'Staff Praise',    ja: 'スタッフ好評', zh: '员工好评' },
  child_friendly:   { ko: '가족/아이', en: 'Family',          ja: '家族向け',   zh: '亲子友好' },
  repeat_visit:     { ko: '재방문',    en: 'Repeat Visit',    ja: '再訪',       zh: '再次光临' },
  crowd_complaint:  { ko: '혼잡',      en: 'Crowding',        ja: '混雑',       zh: '拥挤' },
  wait_time:        { ko: '대기시간',  en: 'Wait Time',       ja: '待ち時間',   zh: '排队等候' },
  cleanliness:      { ko: '청결',      en: 'Cleanliness',     ja: '清潔さ',     zh: '清洁' },
  ticket_price:     { ko: '가격',      en: 'Pricing',         ja: '料金',       zh: '票价' },
  ticket_booking:   { ko: '예매',      en: 'Booking',         ja: '予約',       zh: '订票' },
  staff_complaint:  { ko: '직원 불만', en: 'Staff Issue',     ja: 'スタッフ不満', zh: '员工投诉' },
  parking:          { ko: '주차',      en: 'Parking',         ja: '駐車場',     zh: '停车' },
  food_cafe:        { ko: '카페',      en: 'Cafe',            ja: 'カフェ',     zh: '餐饮' },
  souvenir_merch:   { ko: '굿즈',      en: 'Merch',           ja: 'グッズ',     zh: '周边' },
  accessibility:    { ko: '접근성',    en: 'Accessibility',   ja: 'バリアフリー', zh: '无障碍' },
  location_access:  { ko: '위치/교통', en: 'Location',        ja: '立地',       zh: '位置交通' },
  safety_concern:   { ko: '안전 우려', en: 'Safety',          ja: '安全',       zh: '安全' },
  refund_complaint: { ko: '환불 요구', en: 'Refund',          ja: '返金',       zh: '退款' },
}

/** 인텐트 톤 → Tailwind 배지 클래스 (긍정/중립/부정/위험 4계열) */
const POSITIVE = 'bg-emerald-50 text-emerald-700 border-emerald-200'
const NEUTRAL  = 'bg-slate-50 text-slate-600 border-slate-200'
const NEGATIVE = 'bg-amber-50 text-amber-700 border-amber-200'
const DANGER   = 'bg-rose-50 text-rose-700 border-rose-200'

export const INTENT_BADGE_CLASS: Record<string, string> = {
  positive_overall: POSITIVE, immersive_exp: POSITIVE, photo_zone: POSITIVE,
  lighting_display: POSITIVE, staff_praise: POSITIVE, child_friendly: POSITIVE,
  repeat_visit: POSITIVE, souvenir_merch: POSITIVE,
  food_cafe: NEUTRAL, accessibility: NEUTRAL,
  crowd_complaint: NEGATIVE, wait_time: NEGATIVE, cleanliness: NEGATIVE,
  ticket_price: NEGATIVE, ticket_booking: NEGATIVE, parking: NEGATIVE,
  location_access: NEGATIVE, staff_complaint: NEGATIVE,
  safety_concern: DANGER, refund_complaint: DANGER,
}

export function intentLabel(code: string | null | undefined, lang: Language): string | null {
  if (!code) return null
  return INTENT_LABELS[code]?.[lang] ?? code
}

export function intentBadgeClass(code: string | null | undefined): string {
  if (!code) return NEUTRAL
  return INTENT_BADGE_CLASS[code] ?? NEUTRAL
}

/**
 * 파이프라인 엔진 추론.
 * 명시 컬럼(pipeline_engine)이 있으면 우선, 없으면 model/prompt 버전으로 역추론.
 * (마이그레이션 006 이전 생성된 레거시 draft 호환)
 */
export function inferPipelineEngine(params: {
  pipelineEngine?: string | null
  modelName?: string | null
  promptVersion?: string | null
}): PipelineEngine | null {
  if (params.pipelineEngine === 'template' || params.pipelineEngine === 'llm') {
    return params.pipelineEngine
  }
  if (params.modelName === 'template-engine-v1' || params.promptVersion === 'algo-v1') {
    return 'template'
  }
  if (params.modelName || params.promptVersion) return 'llm'
  return null
}

/**
 * replyLanguage.ts — 답변 엔진 언어 타입 (UI Language보다 넓은 9개 핵심 언어)
 *
 * UI Language('ko'|'en'|'ja'|'zh')는 화면 라벨용이고,
 * ReplyLanguage는 답변 생성 엔진(슬롯 템플릿)이 네이티브로 지원하는 언어 집합이다.
 * 단일 출처(single source of truth) — 파일별 로컬 타입 섀도잉 금지.
 */

export type ReplyLanguage = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'ru' | 'ar' | 'hi' | 'tl'

export const REPLY_LANGUAGES: readonly ReplyLanguage[] = [
  'ko', 'en', 'ja', 'zh', 'es', 'ru', 'ar', 'hi', 'tl',
] as const

/** DB review_language 문자열 → ReplyLanguage. 미지원 언어는 'ko' 폴백(기존 langKeyOf 동작 유지). */
export function toReplyLanguage(l: string | null | undefined): ReplyLanguage {
  return (REPLY_LANGUAGES as readonly string[]).includes(l ?? '') ? (l as ReplyLanguage) : 'ko'
}

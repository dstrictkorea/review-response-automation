/**
 * branchMetadata.ts — 글로벌 지점 컨텍스트 팩토리 (Branch Context Factory)
 *
 * 특정 지점에 종속된 하드코딩 문자열 제거 → 플레이스홀더 토큰(`{branch_name}`,
 * `{landmark}`, `{highlight_room}`, `{facility}`)으로 추상화.
 * buildStaticReply 단계에서 `applyBranchTokens()`가 일괄 치환한다.
 *
 * 신규 지점 추가 시 이 파일에만 메타데이터를 등록하면 됨 — 엔진/템플릿 코드 무수정.
 *
 * 순수 데이터 모듈 — DB·서버 의존성 없음. 클라이언트 번들 안전.
 */

import type { ReplyLanguage } from '@/lib/replyLanguage'

export interface BranchTokens {
  /** 공식 전시관명 (템플릿 표출용, 예: "ARTE MUSEUM LAS VEGAS") */
  branch_name: string
  /** 지역 랜드마크 (지리적 맥락, 예: "the Strip") */
  landmark: string
  /** 대표 전시 공간/작품 (예: "GARDEN / LIGHT OF MASTERPIECE") */
  highlight_room: string
  /** 현장 부대시설 (예: "TEA BAR") */
  facility: string
}

/** 지점 코드 → 토큰 맵 */
export const BRANCH_METADATA: Record<string, BranchTokens> = {
  // ── 글로벌 지점 ──────────────────────────────────────────────────────────────
  AMLV: {
    branch_name:    'ARTE MUSEUM LAS VEGAS',
    landmark:       'the Strip',
    highlight_room: 'GARDEN / LIGHT OF MASTERPIECE',
    facility:       'TEA BAR',
  },
  AMNY: {
    branch_name:    'ARTE MUSEUM NEW YORK',
    landmark:       'Times Square',
    highlight_room: 'WAVE / WHALE',
    facility:       'BOUTIQUE',
  },
  AMDB: {
    branch_name:    'ARTE MUSEUM DUBAI',
    landmark:       'Downtown Dubai',
    highlight_room: 'FOREST',
    facility:       'CAFE',
  },
  AMLA: {
    branch_name:    'ARTE MUSEUM LOS ANGELES',
    landmark:       'Hollywood',
    highlight_room: 'BEACH',
    facility:       'CAFE',
  },
  AMNG: {
    branch_name:    'ARTE MUSEUM NAGOYA',
    landmark:       'Nagoya',
    highlight_room: 'MOONLIGHT',
    facility:       'CAFE',
  },
  AMKH: {
    branch_name:    'ARTE MUSEUM KAOHSIUNG',
    landmark:       'Kaohsiung',
    highlight_room: 'GARDEN',
    facility:       'CAFE',
  },
  AMTK: {
    branch_name:    'ARTE MUSEUM TOKYO',
    landmark:       'Shibuya',
    highlight_room: 'FLOWER',
    facility:       'CAFE',
  },
  AMSG: {
    branch_name:    'ARTE MUSEUM SINGAPORE',
    landmark:       'Marina Bay',
    highlight_room: 'GARDEN',
    facility:       'CAFE',
  },
  AMSE: {
    branch_name:    'ARTE MUSEUM SEOUL',
    landmark:       '강남',
    highlight_room: 'COSMOS',
    facility:       'CAFE',
  },
  AMHE: {
    branch_name:    'ARTE MUSEUM HELSINKI',
    landmark:       'City Centre',
    highlight_room: 'AURORA',
    facility:       'CAFE',
  },
  AMPA: {
    branch_name:    'ARTE MUSEUM PARIS',
    landmark:       'Le Marais',
    highlight_room: 'GARDEN',
    facility:       'CAFE',
  },
  AMRO: {
    branch_name:    'ARTE MUSEUM ROME',
    landmark:       'EUR',
    highlight_room: 'FOREST',
    facility:       'CAFE',
  },
  // ── 국내 지점 (모든 branch_name 영문 종성 보장 — 한국어 조사 '를/가/는' 하드코딩 전제) ──
  AMGN: {
    branch_name:    'ARTE MUSEUM GANGNEUNG',
    landmark:       '강릉',
    highlight_room: 'WAVE',
    facility:       'CAFE',
  },
  AMYS: {
    branch_name:    'ARTE MUSEUM YEOSU',
    landmark:       '여수',
    highlight_room: 'FLOWER',
    facility:       'CAFE',
  },
  AMBS: {
    branch_name:    'ARTE MUSEUM BUSAN',
    landmark:       '부산',
    highlight_room: 'BEACH',
    facility:       'CAFE',
  },
  AMJJ: {
    branch_name:    'ARTE MUSEUM JEJU',
    landmark:       '제주',
    highlight_room: 'GARDEN',
    facility:       'CAFE',
  },
  AKJJ: {
    branch_name:    'ARTE MUSEUM JEJU KIDS',
    landmark:       '제주',
    highlight_room: 'FOREST',
    facility:       'CAFE',
  },
}

// ── 기본값 (미등록 지점 코드) — 답변 언어별 현지화 ─────────────────────────────
// 영어 generic("our location")이 비영어 답변에 섞이는 Konglish 현상 방지.
// highlight_room은 브랜드 고유명사 'ETERNAL NATURE'로 통일 (전 언어 안전).
const DEFAULT_TOKENS: Record<ReplyLanguage, BranchTokens> = {
  en: { branch_name: 'ARTE MUSEUM', landmark: 'the heart of the city',    highlight_room: 'ETERNAL NATURE', facility: 'our café' },
  ko: { branch_name: 'ARTE MUSEUM', landmark: '도심 속',                   highlight_room: 'ETERNAL NATURE', facility: '카페' },
  ja: { branch_name: 'ARTE MUSEUM', landmark: '都心',                      highlight_room: 'ETERNAL NATURE', facility: 'カフェ' },
  zh: { branch_name: 'ARTE MUSEUM', landmark: '市中心',                    highlight_room: 'ETERNAL NATURE', facility: '咖啡厅' },
  es: { branch_name: 'ARTE MUSEUM', landmark: 'el centro de la ciudad',   highlight_room: 'ETERNAL NATURE', facility: 'la cafetería' },
  ru: { branch_name: 'ARTE MUSEUM', landmark: 'центре города',            highlight_room: 'ETERNAL NATURE', facility: 'кафе' },
  ar: { branch_name: 'ARTE MUSEUM', landmark: 'قلب المدينة',              highlight_room: 'ETERNAL NATURE', facility: 'المقهى' },
  hi: { branch_name: 'ARTE MUSEUM', landmark: 'शहर के केंद्र में',           highlight_room: 'ETERNAL NATURE', facility: 'कैफे' },
  tl: { branch_name: 'ARTE MUSEUM', landmark: 'gitna ng lungsod',         highlight_room: 'ETERNAL NATURE', facility: 'café' },
}

/** 지점 코드 → 토큰 맵 반환 (미등록 코드 → 답변 언어별 DEFAULT 안전 폴백) */
export function getBranchTokens(branchCode: string, lang: ReplyLanguage = 'en'): BranchTokens {
  return BRANCH_METADATA[branchCode?.toUpperCase()] ?? DEFAULT_TOKENS[lang] ?? DEFAULT_TOKENS.en
}

// ── 한국어 조사 보정 (토큰 치환 후처리) ─────────────────────────────────────────
// 템플릿 변형은 "{branch_name}를"처럼 조사를 고정해 두는데, 치환된 실제 값의
// 받침 유무에 따라 을/를·이/가·은/는·과/와를 재계산한다.
// 예) "ARTE MUSEUM SINGAPORE이" → "ARTE MUSEUM SINGAPORE가", "GANGNEUNG를" → "GANGNEUNG을"
// 한국어 음독이 불규칙한 영단어 받침 예외 (마지막 단어 기준)
// WHALE → 웨일(ㄹ 받침). T/D/P/B 종성은 트/드/프/브로 모음화되므로 기본 규칙에서 제외.
const JONG_EXCEPTIONS: Record<string, boolean> = {
  WHALE: true,   // 웨일
}

function endsWithJong(word: string): boolean {
  const trimmed = word.trim()
  const lastWord = (trimmed.split(/[\s/]+/).pop() ?? '').toUpperCase()
  if (lastWord in JONG_EXCEPTIONS) return JONG_EXCEPTIONS[lastWord]
  const ch = trimmed.slice(-1)
  if (/[가-힣]/.test(ch)) return (ch.charCodeAt(0) - 0xac00) % 28 > 0
  // 영문 끝글자 근사: 한국어 발음 시 받침으로 읽히는 자음만 (M뮤지엄/N가든/L서울/K욕/G릉)
  // T/D/P/B는 트·드·프·브(모음 종결)로 읽히므로 제외 (FOREST→포레스트→를)
  if (/[A-Za-z]/.test(ch)) return /[mnlkg]/i.test(ch)
  if (/[0-9]/.test(ch)) return /[013678]/.test(ch)  // 영일삼육칠팔 받침
  return false
}

const JOSA_PAIRS: ReadonlyArray<readonly [string, string]> = [['을', '를'], ['이', '가'], ['은', '는'], ['과', '와']]

function fixKoreanJosa(text: string, value: string): string {
  if (!value) return text
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const jong = endsWithJong(value)
  let out = text
  for (const [withJong, withoutJong] of JOSA_PAIRS) {
    out = out.replace(
      new RegExp(`(${esc})[${withJong}${withoutJong}](?=[\\s,.!?…)'"」』~]|$)`, 'g'),
      `$1${jong ? withJong : withoutJong}`,
    )
  }
  return out
}

/**
 * 플레이스홀더 토큰 일괄 치환.
 * 모든 `{branch_name}`, `{landmark}`, `{highlight_room}`, `{facility}` 를 실제 값으로 교체.
 * buildStaticReply가 슬롯 조립 후 최종 단계에서 호출한다.
 * lang='ko'이면 치환 값의 받침에 맞춰 조사(을/를·이/가·은/는·과/와)를 보정한다.
 */
export function applyBranchTokens(template: string, tokens: BranchTokens, lang: ReplyLanguage = 'en'): string {
  let out = template
    .replace(/\{branch_name\}/g,    tokens.branch_name)
    .replace(/\{landmark\}/g,       tokens.landmark)
    .replace(/\{highlight_room\}/g, tokens.highlight_room)
    .replace(/\{facility\}/g,       tokens.facility)
  if (lang === 'ko') {
    for (const v of [tokens.branch_name, tokens.landmark, tokens.highlight_room, tokens.facility]) {
      out = fixKoreanJosa(out, v)
    }
  }
  return out
}

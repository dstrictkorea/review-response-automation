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
  // ── 기본값 (알 수 없는 코드) ───────────────────────────────────────────────
  DEFAULT: {
    branch_name:    'ARTE MUSEUM',
    landmark:       'our location',
    highlight_room: 'our signature installation',
    facility:       'our café',
  },
}

/** 지점 코드 → 토큰 맵 반환 (미등록 코드 → DEFAULT 안전 폴백) */
export function getBranchTokens(branchCode: string): BranchTokens {
  return BRANCH_METADATA[branchCode?.toUpperCase()] ?? BRANCH_METADATA['DEFAULT']!
}

/**
 * 플레이스홀더 토큰 일괄 치환.
 * 모든 `{branch_name}`, `{landmark}`, `{highlight_room}`, `{facility}` 를 실제 값으로 교체.
 * buildStaticReply가 슬롯 조립 후 최종 단계에서 호출한다.
 */
export function applyBranchTokens(template: string, tokens: BranchTokens): string {
  return template
    .replace(/\{branch_name\}/g,    tokens.branch_name)
    .replace(/\{landmark\}/g,       tokens.landmark)
    .replace(/\{highlight_room\}/g, tokens.highlight_room)
    .replace(/\{facility\}/g,       tokens.facility)
}

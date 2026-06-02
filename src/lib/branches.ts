/**
 * branches.ts — 지점 코드 SSOT (국내/글로벌 그룹 분류 · 순수 데이터)
 *
 * 지점 코드를 최우선 마스터 키로 사용합니다.
 * UI 그룹화(필터 드롭다운 optgroup, 배지)는 이 모듈의 분류기를 통해 결정됩니다.
 * 문화 프로파일/국가 결정은 별도로 aiService.getCulturalProfile(DB country_code 우선)이 담당.
 *
 * 분류 우선순위:
 *   1. 공식 코드 집합 (DOMESTIC_CODES / GLOBAL_CODES) — 마스터 키
 *   2. DB country_code (KR → domestic, 그 외 → global) — fallback
 *   3. 'global' 기본값
 */

import type { Language } from '@/lib/i18n'

export type BranchGroup = 'domestic' | 'global'

/** 국내 지점 (오피셜) */
export const DOMESTIC_CODES = new Set<string>([
  'AMGN', // 강릉
  'AMYS', // 여수
  'AMBS', // 부산
  'AMJJ', // 제주
  'AKJJ', // 제주 키즈
  // 레거시/추가 국내 코드 (DB 잔존분 호환)
  'AMJE', 'AMGW', 'AMGO', 'AMYJ', 'AMSE',
])

/** 글로벌 지점 (오피셜) */
export const GLOBAL_CODES = new Set<string>([
  'AMNY', // 뉴욕
  'AMLV', // 라스베가스
  'AMDB', // 두바이
  'AMNG', // 나고야
  'AMLA', // 로스앤젤레스
  'AMKH', // 가오슝
  // 레거시/추가 글로벌 코드 (DB 잔존분 호환)
  'AMDU', 'AMSH', 'AMGZ', 'AMCN', 'AMTK', 'AMSK', 'AMOK',
])

/** 공식 지점 코드 → 4개국어 도시명 */
export const BRANCH_CITY: Record<string, Record<Language, string>> = {
  // 국내
  AMGN: { ko: '강릉',   en: 'Gangneung',   ja: '江陵',       zh: '江陵' },
  AMYS: { ko: '여수',   en: 'Yeosu',       ja: '麗水',       zh: '丽水' },
  AMBS: { ko: '부산',   en: 'Busan',       ja: '釜山',       zh: '釜山' },
  AMJJ: { ko: '제주',   en: 'Jeju',        ja: '済州',       zh: '济州' },
  AKJJ: { ko: '제주 키즈', en: 'Jeju Kids', ja: '済州キッズ', zh: '济州儿童' },
  // 글로벌
  AMNY: { ko: '뉴욕',         en: 'New York',     ja: 'ニューヨーク', zh: '纽约' },
  AMLV: { ko: '라스베가스',   en: 'Las Vegas',    ja: 'ラスベガス',   zh: '拉斯维加斯' },
  AMDB: { ko: '두바이',       en: 'Dubai',        ja: 'ドバイ',       zh: '迪拜' },
  AMNG: { ko: '나고야',       en: 'Nagoya',       ja: '名古屋',       zh: '名古屋' },
  AMLA: { ko: '로스앤젤레스', en: 'Los Angeles',  ja: 'ロサンゼルス', zh: '洛杉矶' },
  AMKH: { ko: '가오슝',       en: 'Kaohsiung',    ja: '高雄',         zh: '高雄' },
}

/**
 * 지점 코드 → 그룹 분류.
 * @param code        지점 코드
 * @param countryCode DB branches.country_code (옵션, fallback용)
 */
export function classifyBranch(code: string, countryCode?: string | null): BranchGroup {
  const up = code.toUpperCase()
  if (DOMESTIC_CODES.has(up)) return 'domestic'
  if (GLOBAL_CODES.has(up)) return 'global'
  if (countryCode) return countryCode.toUpperCase() === 'KR' ? 'domestic' : 'global'
  return 'global'
}

/** 공식 도시명 (없으면 null) */
export function branchCity(code: string, lang: Language): string | null {
  return BRANCH_CITY[code.toUpperCase()]?.[lang] ?? null
}

// ── 지점 자동 감지 (CSV 컬럼 / 파일명) ───────────────────────────────────────────

/** 공백·언더스코어·하이픈 제거 + 소문자 정규화 */
function normForMatch(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.]+/g, '')
}

/** 코드별 매칭 별칭(정규화) — 도시명(4개국어) + 코드 + 수동 변형 */
function buildDetectAliases(): Array<{ alias: string; code: string }> {
  const out: Array<{ alias: string; code: string }> = []
  const push = (alias: string, code: string) => {
    const a = normForMatch(alias)
    if (a.length >= 2) out.push({ alias: a, code })
  }
  for (const [code, names] of Object.entries(BRANCH_CITY)) {
    push(code, code)
    for (const v of Object.values(names)) push(v, code)
  }
  // 수동 변형/약칭
  const EXTRA: Array<[string, string]> = [
    ['vegas', 'AMLV'], ['라스베이거스', 'AMLV'], ['lasvegas', 'AMLV'],
    ['newyork', 'AMNY'], ['nyc', 'AMNY'],
    ['losangeles', 'AMLA'], ['los angeles', 'AMLA'],
    ['kaohsiung', 'AMKH'], ['高雄', 'AMKH'],
    ['jejukids', 'AKJJ'], ['제주키즈', 'AKJJ'], ['jejukid', 'AKJJ'],
  ]
  for (const [a, c] of EXTRA) push(a, c)
  // 긴 별칭 우선 (예: jejukids > jeju) — 부분 문자열 오매칭 방지
  return out.sort((x, y) => y.alias.length - x.alias.length)
}

const DETECT_ALIASES = buildDetectAliases()

/**
 * 문자열(파일명·CSV 셀 등)에서 지점 코드를 자동 감지한다.
 * 코드(AMLV) 또는 도시명(las vegas / 라스베가스 / 名古屋 …)을 인식.
 * @param text  파일명 또는 셀 값
 * @param allowedCodes  존재하는 지점 코드로 결과를 제한 (옵션). 매칭이 이 집합에 없으면 무시.
 * @returns 감지된 지점 코드 (대문자) 또는 null
 */
export function detectBranchCode(text: string | null | undefined, allowedCodes?: Set<string>): string | null {
  if (!text) return null
  const n = normForMatch(text)
  if (!n) return null
  for (const { alias, code } of DETECT_ALIASES) {
    if (n.includes(alias)) {
      if (allowedCodes && !allowedCodes.has(code)) continue
      return code
    }
  }
  return null
}

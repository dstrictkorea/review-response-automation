/**
 * filterService.ts — 1차 키워드/문장 필터링 엔진
 *
 * 평점·AI 판단과 무관하게 리뷰 텍스트를 즉시 스캔합니다.
 * 하드코딩된 핵심 리스크 표현 (항상 활성) + DB 설정 키워드를 병합합니다.
 *
 * 호출 경로:
 *   - IntelligentOrchestrator  → scanText(text, activeKeywords)  [이미 DB 로드됨]
 *   - generate-reply route     → scanText(text, dbKeywords)
 *   - register/actions.ts      → scanTextFromDB(text)            [DB 직접 조회]
 */

import type { RiskKeyword, RiskLevel } from '@/types/database'

// ── 하드코딩된 핵심 리스크 패턴 (설정 삭제해도 항상 활성) ───────────────────

type HardcodedRule = {
  pattern: RegExp
  keyword: string
  riskLevel: 'high' | 'critical'
}

const HARDCODED_RULES: HardcodedRule[] = [
  // ── 법적 위협 ──────────────────────────────────────────────────────────────
  {
    pattern: /소송|소장|고소|고발|법원|변호사|법적\s*(조치|처벌)/u,
    keyword: '법적위협(소송/고소)',
    riskLevel: 'critical',
  },
  {
    pattern: /lawsuit|sue\s+(?:you|us)|attorney|legal\s+action|going\s+to\s+court/i,
    keyword: 'legal_threat',
    riskLevel: 'critical',
  },
  // ── 언론·미디어 위협 ────────────────────────────────────────────────────────
  {
    pattern: /언론에|기자에게|뉴스에\s*제보|방송에\s*제보|유튜브에\s*올리|틱톡에\s*올리|sns에\s*올리|기사화/u,
    keyword: '언론/미디어위협',
    riskLevel: 'high',
  },
  {
    pattern: /tell\s+(?:the\s+)?media|news\s+outlet|post\s+(?:this\s+)?(?:on|to)\s+(?:youtube|tiktok|social)|go\s+viral/i,
    keyword: 'media_threat',
    riskLevel: 'high',
  },
  // ── 부상·사고 ───────────────────────────────────────────────────────────────
  {
    pattern: /부상|다쳤|다쳐서|다칠\s*뻔|골절|출혈|피\s*났|응급실|구급차|병원에\s*실려/u,
    keyword: '부상/사고',
    riskLevel: 'critical',
  },
  {
    pattern: /injur(?:ed|y)|hurt\s+myself|accident\s+(?:happened|occurred)|broke\s+(?:my\s+)?(?:arm|leg|bone|wrist)|bleeding|hospital|ambulance|emergency\s+room/i,
    keyword: 'injury_accident',
    riskLevel: 'critical',
  },
  // ── 환불·보상 요구 ──────────────────────────────────────────────────────────
  {
    pattern: /환불|환급|보상|배상|변상|돌려\s*줘|돌려\s*달라|돈\s*돌려|물어\s*내|물어\s*줘|물어\s*달라/u,
    keyword: '환불/보상요구',
    riskLevel: 'high',
  },
  {
    pattern: /(?:full\s+)?refund|compensation|reimburse|(?:my\s+)?money\s+back|pay\s+(?:me\s+)?back|pay\s+for\s+(?:this|it)/i,
    keyword: 'refund_demand',
    riskLevel: 'high',
  },
  // ── CCTV·개인정보 요구 ─────────────────────────────────────────────────────
  {
    pattern: /cctv\s*(?:영상|확인|달라|보내|제공)|개인정보\s*달라|촬영본|녹화본/ui,
    keyword: 'CCTV/개인정보요구',
    riskLevel: 'high',
  },
  {
    pattern: /cctv\s*footage|surveillance\s*video|camera\s*recording\s*(?:please|needed)/i,
    keyword: 'cctv_footage',
    riskLevel: 'high',
  },
  // ── 직원 징계 요구 ──────────────────────────────────────────────────────────
  {
    pattern: /직원\s*(징계|해고|잘라|처벌)|담당자\s*(징계|처벌|해고)/u,
    keyword: '직원징계요구',
    riskLevel: 'high',
  },
  {
    pattern: /fire\s+(?:the|your|that)\s+(?:staff|employee|worker)|have\s+(?:them|him|her)\s+fired|disciplin/i,
    keyword: 'staff_discipline_demand',
    riskLevel: 'high',
  },
  // ── 경찰·신고 위협 ──────────────────────────────────────────────────────────
  {
    pattern: /경찰\s*(?:부를|신고|에\s*신고)|신고\s*(?:할|하겠|합니다)|경고장|내용증명/u,
    keyword: '경찰/신고위협',
    riskLevel: 'critical',
  },
  {
    pattern: /call\s+(?:the\s+)?police|file\s+a\s+(?:complaint|report|lawsuit)|report\s+(?:you|this)\s+to\s+(?:authorities|police)/i,
    keyword: 'police_report',
    riskLevel: 'critical',
  },
  // ── 차별·혐오 ───────────────────────────────────────────────────────────────
  {
    pattern: /차별\s*(당|해|받|하는|이다)|인종\s*차별|성차별|혐오\s*(발언|표현)/u,
    keyword: '차별/혐오표현',
    riskLevel: 'critical',
  },
  {
    pattern: /discriminat(?:ed|ion|ory)|racist|racism|sexist|sexism|hate\s+(?:speech|crime)/i,
    keyword: 'discrimination',
    riskLevel: 'critical',
  },
]

// ── 공개 타입 ──────────────────────────────────────────────────────────────

export interface KeywordMatch {
  keyword: string
  riskLevel: 'medium' | 'high' | 'critical'
  source: 'hardcoded' | 'db'
  context: string // 전후 30자 스니펫
}

export interface FilterResult {
  triggered: boolean
  maxRiskLevel: RiskLevel
  matches: KeywordMatch[]
  matchedKeywords: string[] // 단순 목록 (activity_log / risk_reasons 용)
  isolationSummary: string  // 담당자에게 보여줄 한국어 요약 (internal_note_ko 저장)
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

const LEVEL_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_TO_LEVEL = ['low', 'medium', 'high', 'critical'] as const

function maxRiskLevel(levels: string[]): RiskLevel {
  const max = Math.max(...levels.map(l => LEVEL_RANK[l] ?? 0))
  return RANK_TO_LEVEL[max] as RiskLevel
}

function snippetAround(text: string, index: number, length: number, radius = 30): string {
  const start = Math.max(0, index - radius)
  const end   = Math.min(text.length, index + length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function buildResult(matches: KeywordMatch[]): FilterResult {
  if (matches.length === 0) {
    return {
      triggered: false,
      maxRiskLevel: 'low',
      matches: [],
      matchedKeywords: [],
      isolationSummary: '',
    }
  }

  const maxLevel = maxRiskLevel(matches.map(m => m.riskLevel))
  const matchedKeywords = [...new Set(matches.map(m => m.keyword))]

  const levelLabel =
    maxLevel === 'critical' ? '🔴 위험(critical)' :
    maxLevel === 'high'     ? '🟠 높음(high)' :
                              '🟡 보통(medium)'

  const isolationSummary =
    `[자동 격리] 위험 표현 ${matches.length}건 감지. ` +
    `적발 키워드: ${matchedKeywords.join(' / ')}. ` +
    `최고 위험도: ${levelLabel}. ` +
    `담당자가 직접 확인 후 처리하세요.`

  return { triggered: true, maxRiskLevel: maxLevel, matches, matchedKeywords, isolationSummary }
}

// ── 공개 API ──────────────────────────────────────────────────────────────

/**
 * 동기 스캔 — 이미 DB 키워드를 로드한 컨텍스트에서 사용 (IntelligentOrchestrator 등)
 * 하드코딩 규칙 + 전달받은 DB 키워드를 모두 적용합니다.
 */
export function scanText(text: string, dbKeywords: RiskKeyword[] = []): FilterResult {
  if (!text?.trim()) {
    return { triggered: false, maxRiskLevel: 'low', matches: [], matchedKeywords: [], isolationSummary: '' }
  }

  const matches: KeywordMatch[] = []

  // 1. 하드코딩 패턴
  for (const rule of HARDCODED_RULES) {
    const m = rule.pattern.exec(text)
    if (m) {
      matches.push({
        keyword:   rule.keyword,
        riskLevel: rule.riskLevel,
        source:    'hardcoded',
        context:   snippetAround(text, m.index, m[0].length),
      })
    }
  }

  // 2. DB 키워드 (대소문자 무시 포함 검사)
  const lowerText = text.toLowerCase()
  for (const kw of dbKeywords) {
    if (!kw.is_active) continue
    if (kw.risk_level === 'low') continue // low 키워드는 격리 불필요
    const needle = kw.keyword.toLowerCase()
    const idx = lowerText.indexOf(needle)
    if (idx !== -1) {
      matches.push({
        keyword:   kw.keyword,
        riskLevel: kw.risk_level as 'medium' | 'high' | 'critical',
        source:    'db',
        context:   snippetAround(text, idx, kw.keyword.length),
      })
    }
  }

  return buildResult(matches)
}

/**
 * 비동기 스캔 — DB에서 키워드를 직접 로드 후 스캔 (서버 전용)
 * DB 키워드가 미리 로드되지 않은 컨텍스트(register/actions.ts 등)에서 사용.
 */
export async function scanTextFromDB(text: string): Promise<FilterResult> {
  let dbKeywords: RiskKeyword[] = []
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'risk_keywords')
      .maybeSingle()
    if (data?.value) dbKeywords = data.value as RiskKeyword[]
  } catch {
    // DB 조회 실패 시 하드코딩 규칙만 적용
  }
  return scanText(text, dbKeywords)
}

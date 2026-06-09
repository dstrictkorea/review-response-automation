/**
 * filterService.ts — 글로벌 다국어 1차 키워드/문장 필터링 엔진
 *
 * 평점·AI 판단과 무관하게 리뷰 텍스트를 즉시 스캔합니다.
 * 하드코딩된 글로벌 핵심 리스크 표현 (항상 활성) + DB 설정 키워드를 병합합니다.
 *
 * 지원 언어:
 *   - 한국어 (ko)
 *   - 영어   (en)
 *   - 일본어 (ja)
 *   - 중국어 (zh)
 *   - 아랍어 (ar)
 *
 * 호출 경로:
 *   - IntelligentOrchestrator  → scanText(text, activeKeywords)  [이미 DB 로드됨]
 *   - generate-reply route     → scanText(text, dbKeywords)
 *   - register/actions.ts      → scanTextFromDB(text)            [DB 직접 조회]
 */

import type { RiskKeyword, RiskLevel } from '@/types/database'

// ── 하드코딩된 글로벌 핵심 리스크 패턴 (설정 삭제해도 항상 활성) ─────────────────

type HardcodedRule = {
  pattern: RegExp
  keyword: string
  riskLevel: 'high' | 'critical'
  lang: string
}

const HARDCODED_RULES: HardcodedRule[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // ── 한국어 (ko) ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  {
    pattern: /소송|소장|고소|고발|법원|변호사|법적\s*(조치|처벌|대응)/u,
    keyword: '[KO] 법적위협(소송/고소)',
    riskLevel: 'critical',
    lang: 'ko',
  },
  {
    pattern: /언론에|기자에게|뉴스에\s*제보|방송에\s*제보|유튜브에\s*올리|틱톡에\s*올리|sns에\s*올리|기사화/u,
    keyword: '[KO] 언론/미디어위협',
    riskLevel: 'high',
    lang: 'ko',
  },
  {
    pattern: /부상|다쳤|다쳐서|다칠\s*뻔|골절|출혈|피\s*났|응급실|구급차|병원에\s*실려/u,
    keyword: '[KO] 부상/사고',
    riskLevel: 'critical',
    lang: 'ko',
  },
  {
    pattern: /환불|환급|보상|배상|변상|돌려\s*줘|돌려\s*달라|돈\s*돌려|물어\s*내|물어\s*줘|물어\s*달라/u,
    keyword: '[KO] 환불/보상요구',
    riskLevel: 'high',
    lang: 'ko',
  },
  {
    pattern: /cctv\s*(?:영상|확인|달라|보내|제공)|개인정보\s*달라|촬영본|녹화본/ui,
    keyword: '[KO] CCTV/개인정보요구',
    riskLevel: 'high',
    lang: 'ko',
  },
  {
    pattern: /직원\s*(징계|해고|잘라|처벌)|담당자\s*(징계|처벌|해고)/u,
    keyword: '[KO] 직원징계요구',
    riskLevel: 'high',
    lang: 'ko',
  },
  {
    pattern: /경찰\s*(?:부를|신고|에\s*신고)|신고\s*(?:할|하겠|합니다)|경고장|내용증명/u,
    keyword: '[KO] 경찰/신고위협',
    riskLevel: 'critical',
    lang: 'ko',
  },
  {
    pattern: /차별\s*(당|해|받|하는|이다)|인종\s*차별|성차별|혐오\s*(발언|표현)/u,
    keyword: '[KO] 차별/혐오표현',
    riskLevel: 'critical',
    lang: 'ko',
  },
  {
    pattern: /미끄러|넘어졌|넘어짐|낙상|추락/u,
    keyword: '[KO] 낙상/미끄러짐',
    riskLevel: 'critical',
    lang: 'ko',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ── 영어 (en) ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  {
    pattern: /lawsuit|sue\s+(?:you|us|the\s+museum)|attorney|legal\s+action|going\s+to\s+court|my\s+lawyer/i,
    keyword: '[EN] legal_threat',
    riskLevel: 'critical',
    lang: 'en',
  },
  {
    pattern: /tell\s+(?:the\s+)?media|news\s+outlet|post\s+(?:this\s+)?(?:on|to)\s+(?:youtube|tiktok|social|instagram|twitter|x\.com)|go\s+viral|contact\s+(?:a\s+)?reporter/i,
    keyword: '[EN] media_threat',
    riskLevel: 'high',
    lang: 'en',
  },
  {
    pattern: /injur(?:ed|y)|hurt\s+myself|hurt\s+(?:my\s+)?(?:child|kid|son|daughter)|accident\s+(?:happened|occurred)|broke\s+(?:my\s+)?(?:arm|leg|bone|wrist|ankle)|bleeding\b(?!\s*[-\s]?edge\b|\s*heart\b)|\bhospital\b(?!\s*(?:nurse|worker|staff|doctor|physician|administrator|employee)\b)|ambulance|emergency\s+room|\bER\b/i,
    keyword: '[EN] injury_accident',
    riskLevel: 'critical',
    lang: 'en',
  },
  {
    pattern: /slipp(?:ed|ing)\s+(?:and\s+)?(?:fell?|fallen)|fell\s+(?:down|over)|trip(?:ped)?\s+(?:and\s+)?(?:fell?|fallen)|fall\s+(?:down|over)/i,
    keyword: '[EN] slip_fall',
    riskLevel: 'critical',
    lang: 'en',
  },
  {
    pattern: /(?:full\s+)?refund|compensation|reimburse(?:ment)?|(?:my\s+)?money\s+back|pay\s+(?:me\s+)?back|pay\s+for\s+(?:this|it|the\s+damage)/i,
    keyword: '[EN] refund_demand',
    riskLevel: 'high',
    lang: 'en',
  },
  {
    pattern: /cctv\s*footage|surveillance\s*video|camera\s*recording|security\s*footage/i,
    keyword: '[EN] cctv_footage',
    riskLevel: 'high',
    lang: 'en',
  },
  {
    pattern: /fire\s+(?:the|your|that)\s+(?:staff|employee|worker|manager)|have\s+(?:them|him|her)\s+fired|disciplin(?:ed|ary\s+action)/i,
    keyword: '[EN] staff_discipline_demand',
    riskLevel: 'high',
    lang: 'en',
  },
  {
    pattern: /call\s+(?:the\s+)?police|file\s+a\s+(?:complaint|report|lawsuit)|report\s+(?:you|this|the\s+museum)\s+to\s+(?:authorities|police|the\s+authorities)/i,
    keyword: '[EN] police_report',
    riskLevel: 'critical',
    lang: 'en',
  },
  {
    pattern: /discriminat(?:ed|ion|ory|ing)|racist|racism|sexist|sexism|hate\s+(?:speech|crime)|racial\s+(?:bias|profiling)/i,
    keyword: '[EN] discrimination',
    riskLevel: 'critical',
    lang: 'en',
  },
  {
    pattern: /insurance\s+claim|liability\s+claim|personal\s+injury\s+claim/i,
    keyword: '[EN] insurance_liability',
    riskLevel: 'critical',
    lang: 'en',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ── 일본어 (ja) ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  {
    pattern: /訴訟|訴える|弁護士|法的\s*(?:措置|手段|対応)|裁判所/u,
    keyword: '[JA] 法的脅威',
    riskLevel: 'critical',
    lang: 'ja',
  },
  {
    pattern: /怪我(?:をし|した|しそう)|負傷|骨折|出血|救急車|病院に\s*運ば|応急処置/u,
    keyword: '[JA] 負傷・事故',
    riskLevel: 'critical',
    lang: 'ja',
  },
  {
    pattern: /転倒(?:し|した|しそう)|滑っ(?:て|た|てしまっ)|転ん(?:で|だ)|落下/u,
    keyword: '[JA] 転倒・滑落',
    riskLevel: 'critical',
    lang: 'ja',
  },
  {
    pattern: /返金|払い戻し|補償|賠償|弁償/u,
    keyword: '[JA] 返金・賠償要求',
    riskLevel: 'high',
    lang: 'ja',
  },
  {
    pattern: /警察\s*(?:に\s*連絡|を\s*呼|に\s*通報)|通報\s*(?:する|します)|被害届/u,
    keyword: '[JA] 警察・通報',
    riskLevel: 'critical',
    lang: 'ja',
  },
  {
    pattern: /差別\s*(?:され|した|的)|人種差別|ハラスメント|ヘイト/u,
    keyword: '[JA] 差別・ハラスメント',
    riskLevel: 'critical',
    lang: 'ja',
  },
  {
    pattern: /メディア\s*(?:に\s*連絡|に\s*投稿)|SNSに\s*(?:投稿|上げ)|炎上|ニュース\s*に\s*報告/u,
    keyword: '[JA] メディア・炎上脅威',
    riskLevel: 'high',
    lang: 'ja',
  },
  {
    pattern: /スタッフ\s*(?:を\s*解雇|を\s*クビ|の\s*処罰)|担当者\s*(?:を\s*処分|の\s*処分)/u,
    keyword: '[JA] スタッフ処罰要求',
    riskLevel: 'high',
    lang: 'ja',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ── 중국어 (zh) ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  {
    pattern: /起诉|诉讼|律师|法律\s*(?:行动|措施|责任)|法院/u,
    keyword: '[ZH] 法律威胁',
    riskLevel: 'critical',
    lang: 'zh',
  },
  {
    pattern: /受伤(?:了|的)?|骨折|出血|救护车|医院(?:急诊)?|摔(?:倒|伤)|跌(?:倒|伤)|滑倒/u,
    keyword: '[ZH] 受伤/事故',
    riskLevel: 'critical',
    lang: 'zh',
  },
  {
    pattern: /退款|退钱|赔偿|补偿|赔钱|返还/u,
    keyword: '[ZH] 退款/赔偿要求',
    riskLevel: 'high',
    lang: 'zh',
  },
  {
    pattern: /报警|叫警察|警察局|投诉到\s*(?:有关部门|消费者协会|市场监管)/u,
    keyword: '[ZH] 报警/投诉威胁',
    riskLevel: 'critical',
    lang: 'zh',
  },
  {
    pattern: /歧视|种族歧视|性别歧视|骚扰|仇恨言论/u,
    keyword: '[ZH] 歧视/骚扰',
    riskLevel: 'critical',
    lang: 'zh',
  },
  {
    pattern: /媒体曝光|联系媒体|上新闻|发微博|发小红书|发抖音|曝光(?:你们)?|举报/u,
    keyword: '[ZH] 媒体/舆论威胁',
    riskLevel: 'high',
    lang: 'zh',
  },
  {
    pattern: /开除\s*(?:工作人员|员工)|处罚\s*(?:工作人员|员工)|炒鱿鱼/u,
    keyword: '[ZH] 员工处罚要求',
    riskLevel: 'high',
    lang: 'zh',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ── 아랍어 (ar) ────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  {
    pattern: /تعويض|تعويضات|استرداد|رد المبلغ|استرجاع المال/u,
    keyword: '[AR] طلب تعويض/استرداد',
    riskLevel: 'high',
    lang: 'ar',
  },
  {
    pattern: /إصابة|تعرض للأذى|كسر|نزيف|إسعاف|مستشفى|طوارئ/u,
    keyword: '[AR] إصابة/حادث',
    riskLevel: 'critical',
    lang: 'ar',
  },
  {
    pattern: /انزلق|سقط|تعثر|سقوط|انزلاق/u,
    keyword: '[AR] انزلاق/سقوط',
    riskLevel: 'critical',
    lang: 'ar',
  },
  {
    pattern: /محامي|محكمة|دعوى قضائية|إجراءات قانونية|مقاضاة/u,
    keyword: '[AR] تهديد قانوني',
    riskLevel: 'critical',
    lang: 'ar',
  },
  {
    pattern: /شرطة|الشرطة|بلاغ|تقديم شكوى|السلطات/u,
    keyword: '[AR] الشرطة/البلاغ',
    riskLevel: 'critical',
    lang: 'ar',
  },
  {
    pattern: /تمييز|عنصرية|تحرش|كراهية/u,
    keyword: '[AR] تمييز/تحرش',
    riskLevel: 'critical',
    lang: 'ar',
  },
  {
    pattern: /وسائل الإعلام|نشر على\s*(?:وسائل التواصل|انستغرام|تيك توك)|تسريب/u,
    keyword: '[AR] تهديد إعلامي',
    riskLevel: 'high',
    lang: 'ar',
  },
]

// ── 공개 타입 ──────────────────────────────────────────────────────────────────

export interface KeywordMatch {
  keyword: string
  riskLevel: 'medium' | 'high' | 'critical'
  source: 'hardcoded' | 'db'
  lang: string
  context: string  // 전후 30자 스니펫
}

export interface FilterResult {
  triggered: boolean
  maxRiskLevel: RiskLevel
  matches: KeywordMatch[]
  matchedKeywords: string[]      // 단순 키워드 목록 (activity_log / risk_reasons 용)
  isolationSummary: string       // 담당자 노출 한국어 요약 (internal_note_ko 저장)
  detectedLangs: string[]        // 감지된 언어 목록
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

const LEVEL_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_TO_LEVEL = ['low', 'medium', 'high', 'critical'] as const

function resolveMaxRisk(levels: string[]): RiskLevel {
  const max = levels.reduce(
    (acc, l) => Math.max(acc, LEVEL_RANK[l] ?? 0),
    0,
  )
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
      detectedLangs: [],
    }
  }

  const maxLevel         = resolveMaxRisk(matches.map((m) => m.riskLevel))
  const matchedKeywords  = [...new Set(matches.map((m) => m.keyword))]
  const detectedLangs    = [...new Set(matches.map((m) => m.lang))]

  const levelLabel =
    maxLevel === 'critical' ? '🔴 위험(critical)' :
    maxLevel === 'high'     ? '🟠 높음(high)'     :
                              '🟡 보통(medium)'

  const isolationSummary =
    `[SYSTEM_FILTER 자동 격리] 글로벌 위험 표현 ${matches.length}건 감지. ` +
    `적발 키워드: ${matchedKeywords.join(' / ')}. ` +
    `감지 언어: ${detectedLangs.join(', ')}. ` +
    `최고 위험도: ${levelLabel}. ` +
    `담당자가 직접 확인 후 처리하세요.`

  return {
    triggered: true,
    maxRiskLevel: maxLevel,
    matches,
    matchedKeywords,
    isolationSummary,
    detectedLangs,
  }
}

// ── 공개 API ────────────────────────────────────────────────────────────────

/**
 * scanText — 동기 스캔
 *
 * 이미 DB 키워드를 로드한 컨텍스트에서 사용합니다 (IntelligentOrchestrator 등).
 * 하드코딩된 글로벌 규칙 + 전달받은 DB 키워드를 병합 스캔합니다.
 * 평점·AI 판단과 무관하게, 1건이라도 매칭되면 즉시 격리 플래그를 세웁니다.
 */
export function scanText(text: string, dbKeywords: RiskKeyword[] = []): FilterResult {
  if (!text?.trim()) {
    return {
      triggered: false,
      maxRiskLevel: 'low',
      matches: [],
      matchedKeywords: [],
      isolationSummary: '',
      detectedLangs: [],
    }
  }

  const matches: KeywordMatch[] = []

  // 1. 하드코딩 글로벌 패턴 (KO/EN/JA/ZH/AR)
  for (const rule of HARDCODED_RULES) {
    const m = rule.pattern.exec(text)
    if (m) {
      matches.push({
        keyword:   rule.keyword,
        riskLevel: rule.riskLevel,
        source:    'hardcoded',
        lang:      rule.lang,
        context:   snippetAround(text, m.index, m[0].length),
      })
    }
  }

  // 2. DB 설정 키워드 (대소문자·유니코드 무시)
  const lowerText = text.toLowerCase()
  for (const kw of dbKeywords) {
    if (!kw.is_active) continue
    if (kw.risk_level === 'low') continue   // low 키워드는 격리 불필요
    const needle = kw.keyword.toLowerCase()
    const idx = lowerText.indexOf(needle)
    if (idx !== -1) {
      matches.push({
        keyword:   kw.keyword,
        riskLevel: kw.risk_level as 'medium' | 'high' | 'critical',
        source:    'db',
        lang:      kw.language ?? 'any',
        context:   snippetAround(text, idx, kw.keyword.length),
      })
    }
  }

  return buildResult(matches)
}

/**
 * scanTextFromDB — 비동기 스캔 (서버 전용)
 *
 * DB에서 키워드를 직접 로드 후 스캔합니다.
 * DB 키워드가 미리 로드되지 않은 컨텍스트(register/actions.ts 등)에서 사용합니다.
 * DB 조회 실패 시 하드코딩 규칙만 적용하여 중단 없이 계속합니다.
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
    // DB 조회 실패 — 하드코딩 규칙만 적용, 등록 흐름 중단 없음
  }
  return scanText(text, dbKeywords)
}

/**
 * synonymEngine.ts — 유의어 사전(Synonym Dictionary) + N-gram 동적 패턴 생성기
 *
 * 목적: 하드코딩 단어 목록 대신, 언어별 유의어 그룹을 정의하고
 * 이를 N-gram 형태의 동적 정규식으로 변환하여 WaterfallRegexEngine에 공급한다.
 * "단어가 떨어져 있어도 문맥을 잡는" 근접 N-gram 패턴 지원.
 *
 * Zero-Cost NLP 모사 엔진의 핵심 — LLM API 비용 없이 의미 기반 분류 달성.
 *
 * 주요 export:
 *   FILLER_PATTERN         — 저평점 리뷰의 꼬리 필러 문장 탐지 (NOISE_POSITIVE 확장판)
 *   LOW_RATING_NEGATIVE_BODY — 1-2★ 부정 본문 신호 탐지 (SAFE 오분류 방지)
 *   extractContextMirror   — 답변 맞춤 핵심 감성 키워드 추출 (슬롯 B/E context mirror용)
 *   buildNgramPattern      — 유의어 목록 → 동적 N-gram RegExp 컴파일러
 */

// ── 내부 유틸리티 ─────────────────────────────────────────────────────────────────

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 구문 내 공백을 `[^.!?\n]{0,gap}` 으로 확장하여 근접 N-gram 패턴 생성.
 * 예: '기대한 만큼은' → '기대한[^.!?\\n]{0,8}만큼은'
 * 단일 단어는 그대로 escapeReg 처리.
 */
function toNgramPattern(phrase: string, gap = 8): string {
  const parts = phrase.trim().split(/\s+/)
  if (parts.length <= 1) return escapeReg(phrase)
  return parts.map(escapeReg).join(`[^.!?\\n]{0,${gap}}`)
}

/**
 * 한국어/영어 유의어 목록에서 단일 RegExp를 동적으로 컴파일한다.
 * @param koTerms  한국어 유의어 목록
 * @param enTerms  영어 유의어 목록 (생략 가능)
 * @param gap      N-gram 최대 문자 간격 (단어 사이 허용 거리)
 * @param flags    정규식 플래그 (기본 'i')
 */
export function buildNgramPattern(
  koTerms: string[],
  enTerms: string[] = [],
  gap = 8,
  flags = 'i',
): RegExp {
  const patterns = [
    ...koTerms.map(p => toNgramPattern(p, gap)),
    ...enTerms.map(p => toNgramPattern(p, gap)),
  ]
  try {
    return new RegExp(patterns.join('|'), flags)
  } catch {
    return /(?!)/  // 컴파일 실패 시 절대 매칭 안 되는 패턴 반환
  }
}

// ════════════════════════════════════════════════════════════════════════════════
//  저평점 필러 문장 패턴 (Filler Noise — NOISE_POSITIVE 고도화 버전)
//
//  배경: 테스트 데이터/실제 리뷰 모두에서 아이러니하게 붙는 추천/긍정 꼬리 문장들.
//  예: "기대한 만큼은 아니었습니다. 커플 데이트로 추천합니다." [1★]
//      → '추천' 키워드가 DEFAULT_POSITIVE 매칭 → SAFE 오분류
//
//  이 패턴으로 저평점(rating ≤ 2) 리뷰에서 해당 문장을 제거하거나 무시한다.
// ════════════════════════════════════════════════════════════════════════════════
export const FILLER_PATTERN: RegExp = buildNgramPattern(
  [
    '커플 데이트로 추천',
    '커플이랑 오기 좋',
    '커플 방문 추천',
    '가족끼리 와도 괜찮',
    '가족과 함께 와도 괜찮',
    '가족이랑 오기 좋',
    '가족 방문 추천',
    '데이트 장소로 추천',
    '데이트 코스로 추천',
    '연인과 함께 오기 좋',
    '사진 찍기에도 좋아',
    '다음에 또 올 의향',
    '평일에 가면 더 좋을',
    '평일에 오면 더 좋을',
    '한 번쯤 가볼 만',
    '혼자 방문해도 좋',
    '친구랑 와도 좋을',
  ],
  ['worth checking out', 'good location'],
  4,  // 단어 사이 최대 4자 (조사 등 자연 거리)
)

// ════════════════════════════════════════════════════════════════════════════════
//  저평점 본문 부정 신호 패턴 (Low-Rating Negative Body)
//
//  목적: 1-2★ 리뷰에서 FILLER_PATTERN 제거 후에도 부정 맥락이 있을 경우
//  SAFE 오분류를 방지하고 COMPLAINT/AMBIGUOUS로 강제 격상한다.
//
//  CSV 분석 기반 패턴:
//   - "기대한 만큼은 아니었습니다" [1★] → DEFAULT_COMPLAINT 미매칭 → SAFE 오분류
//   - "입장 대기가 길어서 조금 지쳤네요" [2★] → DEFAULT_CROWD 미매칭 → SAFE 오분류
//   - "가격 대비 만족도는 좀 아쉬웠어요" [2★] → DEFAULT_VALUE 미매칭 → SAFE 오분류
// ════════════════════════════════════════════════════════════════════════════════
export const LOW_RATING_NEGATIVE_BODY: RegExp = buildNgramPattern(
  [
    '기대한 만큼은 아니었',
    '기대했던 것보다',
    '기대보다 평범',
    '기대 이하',
    '기대에 못 미치',
    '기대보다 별로',
    '기대에 비해 아쉬',
    '아쉬웠',
    '아쉬운 면',
    '아쉬운 부분',
    '아쉬운 점이',
    '별로였',
    '별로인 것',
    '별로인것',
    '실망스러웠',
    '조금 실망',
    '좀 실망',
    '많이 실망',
    '만족스럽지 않았',
    '만족하지 못했',
    '기대에 못 미쳤',
    '가격 대비 아쉬웠',
    '가격 대비 조금',
    '가성비 아쉬웠',
    '입장 대기 지쳤',
    '줄이 너무 길었',
    '오래 기다렸',
    '대기가 길어서 지쳤',
    '너무 지쳤',
    '최악이었',
    '완전 최악',
    '진짜 최악',
    '기분을 다 망쳤',
    '기분이 망가졌',
    '화장실 더럽',
    '표지판 없',
    '안내 없',
    '두통이',
    '두통이 생겼',
    '두통이 왔',
    '머리가 아프',
    '빛에 민감',
    '광과민',
    '냉담하게 대했',
    '차별을 느꼈',
    '차별을 받았',
    '차별 당했',
    '의자 못 찾',
    '앉을 곳이 없',
    '앉을 곳을 못 찾',
    '앉을 공간이 없',
    '쉴 공간이 없',
    '쉴 곳이 없',
    '중간에 포기',
    '기저귀 갈 공간',
    '수유 공간이 없',
    '준비가 안 됐',
    '준비가 안 돼',
    '아무것도 준비',
    '예약했는데 없었',
    '예약이 안 됐',
  ],
  [
    'below expectations',
    'not what I expected',
    'expected better',
    'bit disappointing',
    'somewhat disappointing',
    'not worth the',
    'waited too long',
    'long wait',
    'long queue',
    'not satisfied',
    'ruined by',
    'completely ruined',
    'terrible experience',
    'awful experience',
    'unbearably hot',
    'no air conditioning',
    'stuffy',
    'absolutely not worth',
    'complete waste of',
    'complete organizational failure',
    'organizational failure',
    'complete failure',
    'complete disaster',
    'would not recommend',
    'do not recommend',
    'safety issue',
    'safety concern',
  ],
  8,
)

// ════════════════════════════════════════════════════════════════════════════════
//  맥락 거울 추출 (Context Mirror Extractor)
//
//  리뷰 텍스트에서 핵심 감성 키워드를 추출한다.
//  추출된 키워드는 staticTemplates.ts의 slotB_appreciation/slotE_positive에서
//  답변을 리뷰 내용에 맞춤 구성하는 데 사용된다 (→ "AI같지 않게" 답변 구현의 핵심).
//
//  우선순위: 힐링 > 몰입 > 생일/기념일 > 데이트 > 가족 > 친구 > 사진 > 감동 > 분위기
//  → 가장 강한 감성 신호를 하나만 반환.
//  생일/기념일은 데이트보다 우선: 더 구체적인 특별한 날 맥락.
// ════════════════════════════════════════════════════════════════════════════════
export function extractContextMirror(text: string): string | null {
  const t = text ?? ''

  // 힐링/치유 관련 — 가장 구체적이고 명확한 감성
  // 힐링 단독으로도 매칭 (단, 바로 뒤에 부정 표현이 오는 경우 제외)
  // "힐링 그 자체", "힐링됐어", "힐링이 됐어", "힐링 제대로" 모두 매칭
  if (/힐링(?!\s*(?:이\s*)?(?:안|못|부족|없|별로|실망|사라))/.test(t)) return '힐링'
  if (/\bhealing\b|\brejuvenating\b|\btherapeutic\b/.test(t)) return '힐링'

  // 몰입감 관련
  if (/몰입(?:감|이\s*최고|되는|형|돼|됩니다)/.test(t)) return '몰입'
  if (/\bimmersive?\b|\bwas\s+(?:so\s+)?immersed?\b/.test(t)) return '몰입'

  // 생일/기념일 관련 — 특별한 날 방문 맥락 (가장 구체적 → 우선 검사)
  if (/생일|기념일|생일\s*파티/.test(t)) return '생일'
  if (/\bbirthday\b|\banniversar\w*\b/.test(t)) return '생일'
  if (/誕生日|記念日|誕生|お祝い/.test(t)) return '생일'
  if (/生日|纪念日|庆祝/.test(t)) return '생일'
  if (/जन्मदिन|सालगिरह|वर्षगांठ/.test(t)) return '생일'
  if (/عيد\s*ميلاد|يوم\s*الميلاد|ذكرى\s*سنوية/.test(t)) return '생일'
  if (/\bkumpleanos\b|\bcumpleaños\b|\baniversario\b/.test(t)) return '생일'
  if (/\bkaarawan\b|\banibersaryo\b/.test(t)) return '생일'
  if (/день\s*рождения|годовщин\S*/.test(t)) return '생일'

  // 데이트 관련 — 커플/연인 맥락
  if (/데이트|연인과|파트너와/.test(t)) return '데이트'
  if (/\bdate\s*(?:night|spot|place)\b|\bromantic\b/.test(t)) return '데이트'
  if (/パートナー|彼氏|彼女|カップル|デート|恋人/.test(t)) return '데이트'
  if (/伴侣|男朋友|女朋友|约会|情侣/.test(t)) return '데이트'
  if (/पार्टनर|प्रेमी|प्रेमिका/.test(t)) return '데이트'
  if (/романтич\S*|с\s*(?:партнёром|любимым|любимой)/.test(t)) return '데이트'

  // 가족 관련 — 아이/부모/가족 맥락 (다국어)
  if (/(?:아이|아들|딸|아기|어린이)(?:랑|이랑|과\s*함께|들과|와\s*함께)/.test(t)) return '가족'
  if (/가족(?:이랑|과\s*함께|끼리|들과|과\s*방문)/.test(t)) return '가족'
  if (/\b(?:kids?|children|child|son|daughter|toddler|baby|grandkids?)\b/.test(t)) return '가족'
  if (/\bmy\s+(?:son|daughter|child|kids?|family)\b/.test(t)) return '가족'
  if (/子供|家族|お子|娘|息子|お子様|お子さん/.test(t)) return '가족'
  if (/孩子|家人|家庭|儿子|女儿|宝宝|小朋友/.test(t)) return '가족'
  if (/परिवार|बच्च\S*/.test(t)) return '가족'
  if (/\bpamilya\b|\bmga\s+bata\b|\bbata\b/.test(t)) return '가족'
  if (/\bfamilia\b|\bniños\b|\bhijos?\b/.test(t)) return '가족'
  if (/семь[яей]|детей|ребёнок|дочь|сын|дети/.test(t)) return '가족'

  // 친구 관련
  if (/친구(?:랑|이랑|들과|와\s*함께)/.test(t)) return '친구'
  if (/\bfriend(?:s)?\b/.test(t)) return '친구'
  if (/友達|友人|仲間/.test(t)) return '친구'
  if (/朋友|好友/.test(t)) return '친구'
  if (/दोस्त|मित्र/.test(t)) return '친구'
  if (/с\s*друзьями|друг|подруга/.test(t)) return '친구'

  // 사진/인생샷 관련
  if (/인생\s*샷|포토\s*스팟|사진\s*찍기/.test(t)) return '사진'
  if (/\bphoto\b|\binstagram\b|\bphotos?\s+(?:were|are|came)\b/.test(t)) return '사진'

  // 감동/눈물 관련
  if (/감동|감격|뭉클|눈물/.test(t)) return '감동'

  // 분위기 관련 — 강한 긍정 형용사와 함께할 때만 추출
  if (/분위기가?\s*(?:너무|정말|진짜|되게|완전)\s*(?:좋|예쁘|멋|훌륭|환상)/.test(t)) return '분위기'

  return null
}

// ════════════════════════════════════════════════════════════════════════════════
//  extractSensoryFocus — 감각 경험 추출 (빛/물/향/소리)
//
//  ARTE MUSEUM은 라이트·미디어 아트관 → 리뷰가 빛/파도/향/음악 등 특정 감각을 자주 언급.
//  답변이 그 감각을 구체적으로 반향하면 "상황에 맞는" 비-제네릭 응답이 된다 (slotSensory용).
//  ⚠ \b(워드바운더리)는 ASCII 전용 — CJK/데바나가리/아랍/키릴은 평문 교차만 사용.
//  COMPLIMENT/SAFE 경로에서만 사용 → 맥락은 이미 긍정.
// ════════════════════════════════════════════════════════════════════════════════
export function extractSensoryFocus(text: string): string | null {
  const t = text ?? ''
  // 빛/조명 — 다양한 조사 커버 ("빛으로 가득한", "빛을", "빛이" 등). 빛=light로 모호성 낮음.
  if (/빛(?:으로|을|이|의|에|과|도|만|들|\s)|불빛|조명|라이트\s*(?:쇼|아트)/.test(t)) return '빛'
  if (/\blight(?:s|ing)?\b|\bluminous\b|\bglow(?:ing)?\b/i.test(t)) return '빛'
  if (/光の|光が|照明|ライト/.test(t)) return '빛'
  if (/灯光|光影|光线/.test(t)) return '빛'
  if (/रोशनी|प्रकाश/.test(t)) return '빛'
  if (/إضاءة|أضواء|الضوء/.test(t)) return '빛'
  if (/\bluces?\b|\biluminaci\w*/i.test(t)) return '빛'
  if (/свет|подсветк\w*/i.test(t)) return '빛'
  if (/\bilaw\b|\bliwanag\b/i.test(t)) return '빛'
  // 물/파도/폭포
  if (/물결|파도|폭포|워터/.test(t)) return '물'
  if (/\bwater(?:fall)?\b|\bwaves?\b|\bocean\b/i.test(t)) return '물'
  if (/滝|波|海の/.test(t)) return '물'
  if (/瀑布|海浪|波浪/.test(t)) return '물'
  if (/लहर|झरना|पानी/.test(t)) return '물'
  if (/شلال|أمواج|الماء|موج/.test(t)) return '물'
  if (/\bcascada\b|\bolas?\b|\boc[eé]ano\b/i.test(t)) return '물'
  if (/волн\w*|водопад/i.test(t)) return '물'
  if (/\balon\b|\btalon\s*ng\s*tubig/i.test(t)) return '물'
  // 향/향기 — '취향/방향/영향' 등 오탐 방지: 향기/향긋/아로마는 무조건, 향이/향은 긍정 후행어 동반 시만
  if (/향기|향긋|아로마|냄새가?\s*(?:좋|은은|향긋)|향이\s*(?:좋|은은|진하|가득|나|퍼|감돌)/.test(t)) return '향'
  if (/\bscent(?:ed)?\b|\bfragrance\b|\baroma\b|\bsmell(?:ed|s)?\b/i.test(t)) return '향'
  if (/香り|香りが|匂い/.test(t)) return '향'
  if (/香味|香气|气味/.test(t)) return '향'
  if (/खुशबू|सुगंध|महक/.test(t)) return '향'
  if (/رائحة|عطر|عبير/.test(t)) return '향'
  if (/\baroma\b|\bfragancia\b|\baromático/i.test(t)) return '향'
  if (/аромат|благоухан/i.test(t)) return '향'
  if (/\bbango\b|\bhalimuyak\b/i.test(t)) return '향'
  // 소리/음악
  if (/음악|선율|사운드|소리가|소리에/.test(t)) return '소리'
  if (/\bmusic\b|\bsoundscape\b|\bmelod\w*\b/i.test(t)) return '소리'
  if (/音楽|サウンド|旋律/.test(t)) return '소리'
  if (/音乐|声音|旋律/.test(t)) return '소리'
  if (/संगीत|धुन|ध्वनि/.test(t)) return '소리'
  if (/موسيقى|الصوت|أنغام/.test(t)) return '소리'
  if (/\bmúsica\b|\bsonido\b|\bmelod[ií]a\b/i.test(t)) return '소리'
  if (/музык\w*|мелоди/i.test(t)) return '소리'
  if (/\bmusika\b|\btunog\b/i.test(t)) return '소리'
  return null
}

// ════════════════════════════════════════════════════════════════════════════════
//  extractCompanion — 동반자 맥락 추출 (가족/데이트/친구) — contextMirror와 독립
//
//  contextMirror는 우선순위로 1개만 반환(예: '힐링'). 동반자 정보가 묻히는 것을 보완.
//  → 답변이 감성(B/E)과 동반자(전용 슬롯)를 둘 다 반영 가능 (governor가 중복 echo 차단).
// ════════════════════════════════════════════════════════════════════════════════
export function extractCompanion(text: string): string | null {
  const t = text ?? ''
  // 데이트/커플
  if (/데이트|연인과|파트너와|커플/.test(t)) return '데이트'
  if (/\bdate\s*(?:night|spot|place)?\b|\bromantic\b|\bpartner\b|\bboyfriend\b|\bgirlfriend\b/i.test(t)) return '데이트'
  if (/パートナー|彼氏|彼女|カップル|デート|恋人/.test(t)) return '데이트'
  if (/伴侣|男朋友|女朋友|约会|情侣/.test(t)) return '데이트'
  if (/पार्टनर|प्रेमी|प्रेमिका/.test(t)) return '데이트'
  if (/романтич\w*|с\s*(?:партнёром|любимым|любимой)/i.test(t)) return '데이트'
  if (/\bpareja\b|\brom[aá]ntic\w*/i.test(t)) return '데이트'
  // 가족
  if (/(?:아이|아들|딸|아기|어린이)(?:랑|이랑|과\s*함께|들과|와\s*함께)/.test(t)) return '가족'
  if (/가족(?:이랑|과\s*함께|끼리|들과|과\s*방문|여행)/.test(t)) return '가족'
  if (/\b(?:kids?|children|child|son|daughter|toddler|family)\b/i.test(t)) return '가족'
  if (/子供|家族|お子|娘|息子/.test(t)) return '가족'
  if (/孩子|家人|家庭|儿子|女儿|小朋友/.test(t)) return '가족'
  if (/परिवार|बच्च\S*/.test(t)) return '가족'
  if (/\bpamilya\b|\bmga\s+bata\b/i.test(t)) return '가족'
  if (/\bfamilia\b|\bniños\b|\bhijos?\b/i.test(t)) return '가족'
  if (/семь[яёи]\w*|детьми|ребёнком/i.test(t)) return '가족'
  // 친구
  if (/친구(?:랑|이랑|들과|와\s*함께)/.test(t)) return '친구'
  if (/\bfriends?\b/i.test(t)) return '친구'
  if (/友達|友人|仲間/.test(t)) return '친구'
  if (/朋友|好友/.test(t)) return '친구'
  if (/दोस्त|मित्र/.test(t)) return '친구'
  if (/с\s*друзьями|друзь\w*/i.test(t)) return '친구'
  if (/\bamigos?\b|\bkaibigan\b/i.test(t)) return '친구'
  return null
}

// ════════════════════════════════════════════════════════════════════════════════
//  Fuzzy 매칭 — 경량 레벤슈타인(거리 ≤1)으로 긍정어 오탈자 흡수 (Typo Tolerance)
//
//  목적: "awsome/amazng/beatiful" 같은 흔한 오탈자를 긍정으로 인식해 자동 처리 커버리지 확대.
//  안전 원칙: (1) 긍정 신호만 추가 — 불만/긴급 탐지엔 절대 사용 안 함(정확 매칭 유지).
//            (2) 부정어(not/안/못 등) 직후 토큰은 제외. (3) 오탐 적은 '구별성 높은' 긴 단어만.
// ════════════════════════════════════════════════════════════════════════════════

/** 경계값 레벤슈타인 — max 초과 시 조기 종료(max+1 반환). 짧은 토큰 대상이라 경량. */
export function levenshtein(a: string, b: string, max = 1): number {
  const al = a.length, bl = b.length
  if (Math.abs(al - bl) > max) return max + 1
  let prev = Array.from({ length: bl + 1 }, (_, i) => i)
  for (let i = 1; i <= al; i++) {
    const cur: number[] = [i]
    let best = i
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      cur[j] = v
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[bl]
}

// 구별성 높은 긍정어(≥6자) — 오탈자 1글자 이웃에 흔한 부정어가 거의 없어 fuzzy 안전.
// (짧고 모호한 great/nice/cool 등은 제외 — 정확 정규식이 이미 처리, fuzzy 시 오탐 위험.)
const FUZZY_POSITIVE_WORDS = [
  'awesome', 'amazing', 'beautiful', 'wonderful', 'gorgeous', 'stunning', 'fantastic',
  'incredible', 'excellent', 'magical', 'breathtaking', 'mesmerizing', 'spectacular',
  'enjoyed', 'relaxing', 'immersive', 'delightful', 'phenomenal',
  'increíble', 'hermoso', 'maravilloso', 'precioso', 'espectacular',
  'napakaganda', 'maganda',
]
const FUZZY_NEGATOR = /^(?:not|no|never|wasn'?t|isn'?t|aren'?t|don'?t|didn'?t|hardly|barely|안|못|不|没|不太|ない|なかった)$/i

/**
 * fuzzyPositive — 토큰별 레벤슈타인≤1로 긍정 오탈자 탐지. 부정어 직후 토큰은 제외.
 * 긍정 분류 보강 전용(불만/긴급 미사용). 라틴/한글 토큰 위주(공백 분절).
 */
export function fuzzyPositive(text: string): boolean {
  const tokens = (text ?? '').split(/[\s,.!?;:"'()[\]~…]+/).filter(Boolean)
  for (let k = 0; k < tokens.length; k++) {
    const low = tokens[k].toLowerCase()
    if (low.length < 5 || low.length > 14) continue
    for (const w of FUZZY_POSITIVE_WORDS) {
      if (Math.abs(low.length - w.length) > 1) continue
      if (levenshtein(low, w, 1) <= 1) {
        if (FUZZY_NEGATOR.test((tokens[k - 1] ?? '').toLowerCase())) break  // 부정어 직후 → 제외
        return true
      }
    }
  }
  return false
}

// ════════════════════════════════════════════════════════════════════════════════
//  extractTemporal — 방문 시간대 추출 (아침/저녁/주말) — Fragment Pool 'temporal' 차원
//  명시적 시간 언급이 있을 때만. \b는 라틴(EN/ES/TL)에만, CJK/키릴/아랍/데바나가리는 평문.
// ════════════════════════════════════════════════════════════════════════════════
export function extractTemporal(text: string): string | null {
  const t = text ?? ''
  // 주말 (weekend) — 가장 구체적
  if (/주말|토요일|일요일/.test(t)) return '주말'
  if (/\bweekend\b|\bon\s+(?:satur|sun)day\b/i.test(t)) return '주말'
  if (/週末|土曜|日曜/.test(t)) return '주말'
  if (/周末|周六|周日|星期六|星期日/.test(t)) return '주말'
  if (/\bfin\s+de\s+semana\b|\bs[aá]bado\b|\bdomingo\b/i.test(t)) return '주말'
  if (/выходн\w*|суббот\w*|воскресень\w*/i.test(t)) return '주말'
  if (/عطلة\s*(?:نهاية\s*)?الأسبوع/.test(t)) return '주말'
  if (/सप्ताहांत|वीकेंड/.test(t)) return '주말'
  if (/\bkatapusan\s+ng\s+linggo\b/i.test(t)) return '주말'
  // 저녁/밤 (evening/night)
  if (/저녁|밤에|야간|밤\s*늦/.test(t)) return '저녁'
  if (/\bevening\b|\bat\s+night\b|\bnight[\s-]?time\b/i.test(t)) return '저녁'
  if (/夜に|夕方|ナイト/.test(t)) return '저녁'
  if (/晚上|夜晚|傍晚/.test(t)) return '저녁'
  if (/\bnoche\b|\bpor\s+la\s+tarde\b/i.test(t)) return '저녁'
  if (/вечер\w*|ночью/i.test(t)) return '저녁'
  if (/مساء|في\s*الليل/.test(t)) return '저녁'
  if (/शाम|रात\s*को/.test(t)) return '저녁'
  if (/\bgabi\b/i.test(t)) return '저녁'
  // 아침/오전 (morning)
  if (/아침|오전|이른\s*시간/.test(t)) return '아침'
  if (/\bmorning\b|\bearly\s+(?:visit|hours?)\b/i.test(t)) return '아침'
  if (/朝に|午前中?/.test(t)) return '아침'
  if (/早上|上午|清晨/.test(t)) return '아침'
  if (/\bpor\s+la\s+mañana\b|\btemprano\b/i.test(t)) return '아침'
  if (/утром|с\s*утра/i.test(t)) return '아침'
  if (/في\s*الصباح|صباحاً/.test(t)) return '아침'
  if (/सुबह/.test(t)) return '아침'
  if (/\bumaga\b/i.test(t)) return '아침'
  return null
}

// ════════════════════════════════════════════════════════════════════════════════
//  extractSpatial — 공간감(긍정) 추출 (포토스팟/넓은공간) — Fragment Pool 'spatial' 차원
//  ※ 포토스팟은 contextMirror '사진'과 중복될 수 있어 governor에서 dedupe.
// ════════════════════════════════════════════════════════════════════════════════
export function extractSpatial(text: string): string | null {
  const t = text ?? ''
  // 포토스팟 (photo spot)
  if (/포토\s*스팟|포토\s*존|사진\s*찍기\s*(?:좋|딱)/.test(t)) return '포토스팟'
  if (/\bphoto\s*(?:spot|zone|op)\b|\binstagram\w*\b|\bpicture[\s-]?perfect\b|\binstagramm?able\b/i.test(t)) return '포토스팟'
  if (/フォトスポット|インスタ映え/.test(t)) return '포토스팟'
  if (/拍照\s*(?:圣地|打卡)|打卡|出片/.test(t)) return '포토스팟'
  // 넓은 공간 (spacious/open)
  if (/넓은\s*(?:공간|전시|홀)|탁\s*트인|개방감/.test(t)) return '넓은공간'
  if (/\bspacious\b|\bopen\s+space\b|\bexpansive\b/i.test(t)) return '넓은공간'
  if (/広々|開放的/.test(t)) return '넓은공간'
  if (/宽敞|开阔/.test(t)) return '넓은공간'
  if (/\bespacios[oa]\b|\bamplio\b/i.test(t)) return '넓은공간'
  if (/просторн\w*/i.test(t)) return '넓은공간'
  return null
}

// ════════════════════════════════════════════════════════════════════════════════
//  3-Tier Risk Dictionary & Sanitization Layer
//
//  목적: COMPLAINT/AMBIGUOUS 라우팅 전 독성 순화 및 리스크 등급 판별.
//    Tier 1 (Sanitizable → AI_DONE 허용): 비속어/슬랭 → 비즈니스 언어 치환
//    Tier 2 (Critical → PENDING_APPROVAL 강제): 법무/운영 Critical 리스크
//    Tier 3 (Unknown Toxicity → PENDING_APPROVAL + fallback): 미지 극단 표현
//
//  처리 순서: Tier 2 감지 → Tier 1 치환 → Tier 3 감지 → clean(Tier 1 반환)
// ════════════════════════════════════════════════════════════════════════════════

export interface RiskAssessment {
  /** 1=순화가능(AI_DONE), 2=Critical(격리), 3=Unknown Toxic(격리+fallback) */
  tier: 1 | 2 | 3
  /** 순화/치환 텍스트 (Tier 1=치환완료, Tier 2=원문유지, Tier 3=fallback 덮어쓰기) */
  sanitizedText: string
  /** 탐지된 리스크 플래그 레이블 목록 */
  flags: string[]
  /** 치환 이력 [{original, replacement}] */
  replacements: Array<{ original: string; replacement: string }>
}

// ── Tier 1: 비속어/슬랭 → 비즈니스 언어 치환 목록 ──────────────────────────────
// 형식: [RegExp(flags='i'), replacementText, flagLabel]
// 처리: test(i) → replace(gi) 순으로 사용
const TIER1_SANITIZE: Array<[RegExp, string, string]> = [
  // 가격 비속어: 창렬, 돈ㅈㄴ아깝, 개비싸, 도둑같은가격
  [/창렬|돈\s*ㅈㄴ\s*아깝|돈\s*존나\s*아깝|개\s*비싸|가성비\s*개\s*똥|도둑\s*같은\s*가격/i, '티켓 가격', 'PRICE_SLANG'],
  // 인파/혼잡 비속어: 시장통, 돗대기, 개많음, 사람개많
  [/시장통|돗대기\s*시장|도떼기|개\s*많음|사람\s*개\s*많|북새통|사람이?\s*존나\s*많|사람\s*ㅈㄴ\s*많/i, '혼잡한 관람 환경', 'CROWD_SLANG'],
  // 직원 비속어: 싸가지없음, 직원최악, 직원개같
  [/싸가지\s*없|싸가지없음|직원\s*최악|직원\s*개\s*같|직원\s*꼰대|직원\s*무례하|직원\s*개판/i, '직원 서비스', 'STAFF_SLANG'],
  // 일반 불만 비속어: 열받음, 개짜증, 빡침
  [/개\s*열받|열받음|개\s*짜증|존\s*나\s*짜증|완전\s*빡침|빡쳤|환장\s*하|개\s*빡침/i, '관람 불편', 'FRUSTRATION_SLANG'],
  // 가치 비하 비속어: 바가지, 돈낭비, 완전쓰레기
  [/바가지|돈\s*낭비|완전\s*쓰레기|전시\s*개\s*별로|개\s*실망|개\s*쓰레기\s*같|ㅈ같은\s*전시/i, '관람 만족도', 'VALUE_SLANG'],

  // ── EN (영어) 비속어/슬랭 → 비즈니스 언어 ──────────────────────────────────────
  // 가격: fucking expensive, rip-off, overpriced as hell
  [/\b(?:fuck\w*|damn|insanely|ridiculously|stupidly)\s+(?:expensive|pricey|overpriced)\b|\brip[\s-]?off\b|\boverpriced\s+as\s+(?:hell|fuck)\b/i, 'the ticket price', 'PRICE_SLANG_EN'],
  // 직원: shitty/crappy staff, staff suck, rude as hell
  [/\b(?:shitty|crappy|damn|fuck\w*)\s+staff\b|\bstaff\s+(?:suck\w*|were\s+ass\w*)\b|\brude\s+as\s+(?:hell|fuck)\b/i, 'the staff service', 'STAFF_SLANG_EN'],
  // 혼잡: packed like sardines, way too crowded, crammed
  [/\bpacked\s+like\s+sardines\b|\bway\s+too\s+(?:crowded|packed)\b|\bcrammed\s+(?:in|like)\b/i, 'the crowded environment', 'CROWD_SLANG_EN'],
  // 가치/전반: total garbage, this place sucks, waste of money, shit show
  [/\b(?:total|complete|absolute)\s+(?:garbage|trash|crap|rubbish)\b|\bthis\s+place\s+suck\w*\b|\bwaste\s+of\s+(?:money|time)\b|\bshit[\s-]?show\b|\bf(?:ucking|reaking)\s+(?:terrible|awful|horrible)\b/i, 'the overall experience', 'VALUE_SLANG_EN'],

  // ── JA (일본어) 비속어/맹비난 → 비즈니스 언어 ──────────────────────────────────
  // 가격: 高すぎ, ぼったくり, 金返せレベル
  [/高すぎ(?:る|だ|ます)?|ぼったくり|ぼられた|金\s*返せ\s*レベル/i, 'チケット価格', 'PRICE_SLANG_JA'],
  // 직원/전반: 最悪, 態度悪すぎ, ゴミ, クソ
  [/(?:スタッフ|店員|従業員)?\s*(?:最悪|態度\s*(?:が)?\s*悪すぎ)|ゴミ\s*(?:みたい|同然|レベル)|クソ(?:みたいな|な)?\s*(?:展示|対応|施設)?/i, '館内サービス', 'TONE_SLANG_JA'],
  // 혼잡: 混みすぎ, 人多すぎ
  [/混みすぎ|人\s*多すぎ|ぎゅうぎゅう|芋洗い/i, '混雑した観覧環境', 'CROWD_SLANG_JA'],

  // ── ZH (중국어) 비속어/맹비난 → 비즈니스 언어 ──────────────────────────────────
  // 가격: 太贵了, 坑钱, 宰客
  [/太贵了|坑钱|宰客|不值这个价|贵得离谱/i, '门票价格', 'PRICE_SLANG_ZH'],
  // 가치/전반: 垃圾, 烂透了, 糟透了, 浪费钱
  [/垃圾(?:展览|场馆|透了)?|烂透了|糟透了|浪费(?:钱|时间)|差劲透顶/i, '整体体验', 'VALUE_SLANG_ZH'],
  // 직원: 服务态度差, 员工很烂, 态度恶劣
  [/服务态度(?:差|恶劣|极差)|员工(?:很烂|态度差|素质低)|态度(?:恶劣|极差)/i, '员工服务', 'STAFF_SLANG_ZH'],
  // 혼잡: 人太多, 挤死了, 人山人海
  [/人太多|挤死了|人山人海|挤得要命/i, '拥挤的观展环境', 'CROWD_SLANG_ZH'],
]

// ── Tier 2: Critical 리스크 — waterfallRegexEngine DEFAULT_EMERGENCY 보완망 ─────
// 특정 직원 지목, 법적 위협, 아동 부상, 환불요구, 언론/경찰 위협 (9개 언어).
// ⚠ \b(워드바운더리)는 EN(라틴)에만; CJK/키릴/아랍/데바나가리는 평문 교차만.
// ⚠ 환불은 '요구/거부' 맥락만(단순 언급/보고화법 제외) — 오격리 방지.
const TIER2_CRITICAL: RegExp =
  new RegExp([
    // KO
    '(?:특정\\s*직원|담당\\s*직원|직원\\s*(?:실명|성함|이름))',
    '직원\\s*(?:해고하|신고하|고발)\\s*(?:겠|해야|할|했)',
    '소비자\\s*고발|집단\\s*소송|언론\\s*제보',
    '인스타\\s*(?:박살|올릴|퍼뜨릴)|sns\\s*(?:올릴|퍼뜨릴|폭파)|온라인\\s*(?:신고|도배|뭉개)',
    '(?:아이|아들|딸|애)[^.!?\\n]{0,15}(?:다쳤|다칩|넘어졌|부딪|피가\\s*났)',
    '환불\\s*(?:요구|거부|안\\s*해|해\\s*달라|못\\s*받)|법적\\s*(?:조치|대응|책임)',
    // EN — lawsuit/refund-demand/injury/police/media
    '\\b(?:lawsuit|sue\\s+(?:you|them|the\\s+museum|this)|my\\s+lawyer|legal\\s+action|take\\s+(?:you\\s+)?to\\s+court)\\b',
    '\\b(?:demand|want|need|give\\s+me)\\s+(?:a\\s+|my\\s+|full\\s+)*(?:refund|money\\s+back)\\b',
    '\\b(?:call|called|calling|contact\\w*)\\s+(?:the\\s+)?(?:police|cops|media|press|news|health\\s+department|authorities)\\b',
    '\\b(?:my\\s+)?(?:child|kid|son|daughter|baby|toddler)\\s+(?:got\\s+|was\\s+)?(?:hurt|injured|bleeding|fell)\\b',
    // JA — 訴訟/弁護士/返金要求/怪我/警察/メディア
    '訴訟|弁護士|法的措置|裁判',
    '返金\\s*(?:しろ|してください|を要求|を求め|されない|拒否)',
    '警察\\s*(?:を呼|に通報|沙汰)|消費者(?:センター|庁)',
    '(?:子供|子ども|息子|娘|赤ちゃん)[^。!?\\n]{0,15}(?:怪我|けが|転倒|ぶつか|血が)',
    'メディア\\s*(?:に|へ)\\s*(?:通報|連絡|暴露|リーク)',
    // ZH — 起诉/律师/退款要求/受伤/报警/媒体
    '起诉|律师|法律\\s*(?:行动|责任)|打官司',
    '(?:要求|给我|必须)\\s*退款|退款\\s*(?:要求|给我|不可|拒绝)',
    '报警|消费者协会|向\\s*媒体\\s*曝光|媒体\\s*曝光',
    '(?:孩子|小孩|儿子|女儿|宝宝)[^。!?\\n]{0,15}(?:受伤|摔倒|撞到|流血|擦伤)',
  ].join('|'), 'i')

// ── Tier 3: 딕셔너리 미등록 극단 욕설 / 특수기호 혼합 비속어 ─────────────────────
// 자음 조합 욕설(ㅅㅂ, ㄲㅈ, ㅁㅊ) + 특수기호 대체 욕설
// ※ Tier 1 처리 후 남은 텍스트에서 탐지 (Tier 1이 먼저 클린하므로 Tier 1 외 패턴만 도달)
const TIER3_UNKNOWN_TOXIC: RegExp =
  /ㅅ\s*ㅂ|ㄲ\s*ㅈ|ㅁ\s*ㅊ|씨\s*[발팔x@*#%^]|ㅂ\s*시\s*발|ㄳ\s*ㅎ|ㅆ\s*ㅂ|ㅈ\s*같(?:\s*은)?\s*(?:곳|데|전시|뮤지엄)|개\s*새\s*끼|완전\s*개\s*[ㅅ시s]/i

/** Tier 3 강제 치환 텍스트 — 원문 폐기 후 이 안전 표현으로 덮어씀 */
export const TIER3_FALLBACK_TEXT = '말씀해주신 관람 불편 사항'

/**
 * sanitizeAndScoreRisk — 3-Tier 리스크 평가 및 독성 순화 (순수 함수)
 *
 * 처리 파이프라인:
 *   1. Tier 2 Critical 탐지 → 즉시 tier=2 반환 (원문 유지)
 *   2. Tier 1 비속어 치환 → 순화 완료 시 tier=1 반환
 *   3. Tier 3 미지 욕설 탐지 → fallback 덮어쓰기, tier=3 반환
 *   4. Clean → tier=1 반환 (변경 없음)
 */
export function sanitizeAndScoreRisk(text: string): RiskAssessment {
  const t = (text ?? '').trim()
  const flags: string[] = []
  const replacements: Array<{ original: string; replacement: string }> = []

  // ── Step 1: Tier 2 Critical 탐지 (최우선 — 발견 즉시 반환) ─────────────────────
  if (new RegExp(TIER2_CRITICAL.source, TIER2_CRITICAL.flags).test(t)) {
    flags.push('CRITICAL_RISK')
    return { tier: 2, sanitizedText: t, flags, replacements }
  }

  // ── Step 2: Tier 1 순화 처리 ─────────────────────────────────────────────────
  let sanitized = t
  let hasTier1 = false
  for (const [pattern, replacement, flagLabel] of TIER1_SANITIZE) {
    // test에 i 플래그만 사용 (stateless), replace에 gi 추가 (전체 치환)
    if (new RegExp(pattern.source, 'i').test(sanitized)) {
      hasTier1 = true
      flags.push(flagLabel)
      sanitized = sanitized.replace(new RegExp(pattern.source, 'gi'), (matched) => {
        replacements.push({ original: matched, replacement })
        return replacement
      })
    }
  }
  if (hasTier1) {
    return { tier: 1, sanitizedText: sanitized, flags, replacements }
  }

  // ── Step 3: Tier 3 Unknown Toxic 탐지 ─────────────────────────────────────────
  if (new RegExp(TIER3_UNKNOWN_TOXIC.source, TIER3_UNKNOWN_TOXIC.flags).test(t)) {
    flags.push('UNKNOWN_TOXIC')
    replacements.push({ original: t, replacement: TIER3_FALLBACK_TEXT })
    return { tier: 3, sanitizedText: TIER3_FALLBACK_TEXT, flags, replacements }
  }

  // ── Clean: 독성 없음 → tier=1 (AI_DONE 허용 기본값) ─────────────────────────
  return { tier: 1, sanitizedText: t, flags: [], replacements: [] }
}

/**
 * waterfallRegexEngine.ts — 다국어(KO/EN) 결정론적 폭포수 분류 엔진
 *
 * LLM의 비결정적 환각/톤 파편화를 원천 차단하기 위해, 리뷰 텍스트를 100% 규칙 기반으로
 * 분류한다. 상위 Layer 충족 시 즉시 반환(Early Return). 대소문자 무시(/i), 공백 정규화 후 평가.
 *
 * 분류 순서(폭포수):
 *   Layer 0  긴급 안전/CS/법적 리스크 (Emergency Kill-switch)   → status='EMERGENCY'
 *   Layer 1  운영/서비스 불만 (Operational Pain Points)         → isComplaint
 *   Layer 2  재방문/이탈 판별 (Retention & Churn Matrix)         → isRepeatVisitor / isChurnRisk
 *   Layer 3  이중부정/도치 예외 (Sarcasm / Double-Negative)      → 불만 오인 복구
 *   최종     SAFE(긍정·정적템플릿) / COMPLAINT(LLM) / AMBIGUOUS(LLM) 판정
 *
 * 안전 우선: Layer 0 은 본 엔진의 정규식 OR filterService.scanText(키워드 SSOT, DECISIONS #8)의
 * high/critical 매칭을 합집합으로 사용한다 → 기존 안전망보다 절대 약해지지 않는다(floor-only).
 */

import { scanText } from '@/services/filterService'
// 타입만 정적 import(런타임 erase) — 실제 DB 로더는 refreshEngineFromDB에서 동적 import (서버 전용 admin client 격리)
import type { AutomationRule, RulesBundle } from '@/lib/rulesCache'
// 순수 데이터 모듈 — 클라이언트 번들 안전
import { getBranchTokens } from '@/lib/branchMetadata'
// Zero-Cost NLP 모사: 유의어 사전 + 필러 패턴 + 맥락 거울 추출
import { FILLER_PATTERN, LOW_RATING_NEGATIVE_BODY, extractContextMirror } from '@/lib/synonymEngine'

// ── 톤 단일화 (SHORT/CAUTIOUS 폐기 → STANDARD 단일 리터럴) ─────────────────────────
export type ReplyTone = 'STANDARD'

export type ReviewClass = 'SAFE' | 'COMPLAINT' | 'EMERGENCY' | 'AMBIGUOUS' | 'COMPLIMENT'

export interface WaterfallResult {
  /** 결정론적 분류 결과 */
  status: ReviewClass
  /** 이 리뷰가 LLM Fallback을 필요로 하는가 (COMPLAINT/AMBIGUOUS = true) */
  requiresLLM: boolean
  /** 알고리즘 분류 근거 (LLM 프롬프트 주입 + 감사 로그용) */
  reason: string
  /** 분류 태그 (reviews.categories 에 저장) */
  tags: string[]
  /** 답변 톤 — 항상 STANDARD */
  tone: ReplyTone
  // ── 정밀 분류 플래그 ──────────────────────────────────────────────────────────
  isEmergency: boolean       // 안전/법적 이슈
  isComplaint: boolean       // 운영/서비스 불만
  isArtworkFocused: boolean  // 순수 작품 감상(긍정)
  isRepeatVisitor: boolean   // 과거 방문 입증
  isChurnRisk: boolean       // 미래 이탈 위험
  hasPeakHours: boolean      // 피크/혼잡 시간대 언급 여부 (Slot C 대체 클로징 트리거)
  /** 맥락 거울 — 리뷰 핵심 감성 키워드(힐링/데이트/가족/사진 등). 답변 슬롯 B/E 맞춤 구성용. */
  contextMirror?: string | null
}

// ════════════════════════════════════════════════════════════════════════════════
//  하드코딩 DEFAULT 규칙 (불변 폴백) — DB 미로드/로드 실패 시 항상 이 베이스라인으로 동작
//  ※ DEFAULT_EMERGENCY 는 안전 불변. DB EMERGENCY 행은 compileEmergency 에서 '추가'만 됨(약화 불가).
// ════════════════════════════════════════════════════════════════════════════════

// ★ AMLV 'Strip' 오진단 수정: 비앵커 'trip'이 "Strip"(S+trip)을 매칭하던 결함 → \btrip.
//   'sue'(issue/tissue), 'fell'(fellow) 등 짧은 영문도 \b 경계로 묶어 부분일치 오탐 제거.
//   한국어 그룹은 부분일치 문제 없음. 'cop'(copy)은 노이즈로 제거.
// ★ "field trip"(긍정 명사) 오탐 수정: trip→tripped/tripping만 (동사형 낙상 한정).
//   "trip" 명사(field trip, business trip) 및 "trips" 오트리거 제거.
const DEFAULT_EMERGENCY =
  /(다쳤|넘어졌|피가|병원|119|어지러|멀미|구토|발작|분실물|경찰|고소|소비자원|보상|환불|해고해|처벌받아야|징계[^.!?\n]{0,5}내려|천식\s*발작|기도\s*막힘|호흡\s*곤란)|\b(?:hurt|injur\w*|paramedic|nausea|vomit\w*|puke|seizure|epilepsy|stolen|police|lawyer|attorney|lawsuit|refund\w*|compensat\w*|chargeback|asthma\s*attack|inhaler\s*urgently)\b|\bfell\b[^.!?\n]{0,25}(?:hit|hurt|injur\w*|floor|ground|stairs?|step\b|over\b|hard\b|down\b|on\s+(?:the\s+)?(?:floor|ground|steps?|stairs?))|\bbleed\w*\b(?!\s*[-\s]?edge\b|\s*heart\b)|\bhospital\b(?!\s*(?:nurse|worker|staff|doctor|physician|administrator|employee))|\bsue[d]?\b(?![^.!?\n]{0,30}for\s+(?:being|making|having|creating|how)\s*[^.!?\n]{0,20}(?:beautiful|amazing|gorgeous|incredible|stunning|wonderful|perfect|lovely|breathtaking|fantastic))|\bdizzy\b(?!\s+with\s+(?:delight|excitement|joy|wonder|awe|amazement))|\bdisput\w+[^.!?\n]{0,20}charge\b|\bcredit\s*card[^.!?\n]{0,15}disput\w*\b|\b911\b|\btrip(?:ped|ping)\b|\b(?:lost|missing)\b(?!\s+(?:one|a|two|three|\d+)\s*stars?|\s+(?:my|our|their|his|her)\s+(?:mother|father|mom|dad|mum|mam|parents?|husband|wife|partner|sibling|brother|sister|son|daughter|loved\s+one|grandm\w*|grandf\w*|spouse|fianc\w+)|\s+(?:a|an|the|your|our)\s+(?:major|big|huge|great|golden|important|key|potential|promotional|business|marketing|revenue|sale\w*|opportunity|chance|customer|client|deal|contract|subscriber|follower|fan))|\b(?:fire|fires)\s+(?:that|this|the)\s*(?:staff|employee|worker|guard|person)\b|staff\b[^.!?\n]{0,20}\bshould\s+be\s+fired\b/i

// 'bad'는 부정이지만 "not bad"(긍정 관용구)는 제외 (?<!not\s).
const DEFAULT_COMPLAINT =
  /(불친절|짜증|최악|실망|돈[^.!?\n]{0,4}아깝|바가지|시장통|도떼기|더럽|냄새|의자\s*없|주차\s*불편|대기\s*너무|위생[^.!?\n]{0,15}(?:불량|문제|엉망|불결|못\s*따라|수준\s*못|아쉬|나쁘|불만)|화장실[^.!?\n]{0,15}(?:더럽|냄새|지저분|청소|불결|위생)|끈적|환기[^.!?\n]{0,8}(?:안|불량)|에어컨\s*(?:고장|꺼|없)|휠체어[^.!?\n]{0,20}(?:못|안\s*됨|없|불가|어렵|힘들)|장애인\s*(?:편의|접근|시설|화장실)[^.!?\n]{0,10}(?:없|불가|부족|안\s*됨)|자막[^.!?\n]{0,4}없|경사로[^.!?\n]{0,4}없|수어\s*(?:안내|통역)[^.!?\n]{0,4}없|장벽|청각\s*장애[^.!?\n]{0,10}(?:배려|안내|불편)|폐소공포증|어둡고[^.!?\n]{0,8}(?:좁아서|답답)|답답한\s*느낌|시각장애[^.!?\n]{0,10}(?:안내|배려|서비스)[^.!?\n]{0,6}(?:없|부족|안\s*됨|운영\s*안)|점자\s*(?:안내판|블록)\s*없|음성\s*안내\s*없)|(rude|attitude|unprofessional|worst|disappoint|rip\s*off|waste\s*of|overprice|scam|packed|crowded|zoo|messy|dirty|filthy|smell|stink|no\s*seat|nowhere\s*to\s*sit|parking|long\s*(line|wait|queue)|not\s*worth|overrated|no\s*air\s*(?:con|conditioning)|unbearably\s*hot|sweltering|ac\s*(?:broken|off|wasn[''']?t\s*working)|stuffy|poor\s*ventilation|ruined\s*by|restroom[^.!?\n]{0,8}(?:dirty|disgusting|filthy|unclean)|safety\s*(?:issue|concern|hazard|risk|failure)|allergen|organizational\s*failure|complete\s*(?:failure|disaster)|double[- ]?book\w*|overbooking|wheelchair[^.!?\n]{0,20}(?:inaccessible|no\s*(?:access|ramp)|couldn|not\s*(?:accessible|allowed))|not\s*wheelchair\s*accessible|no\s*(?:wheelchair|disabled|handicap)\s*access|accessibility[^.!?\n]{0,20}(?:issue|problem|concern|barrier|fail)|hearing\s*(?:loop|impair\w*|aid)[^.!?\n]{0,10}(?:no|not|missing|lacking)|no\s*(?:captions?|subtitles?)|deaf[^.!?\n]{0,20}(?:no|not|couldn|ignored|unhelpful)|\bcolorblind\b|panic\s*(?:attack|disorder)|no\s*(?:content|trigger)\s*warning|no\s*warning\s*(?:beforehand|given|provided|about\s*the)|sensory\s*(?:overwhelm|overload|distress|break\s*area|guide)|no\s*(?:quiet|sensory)\s*(?:room|area|space)|asthma[^.!?\n]{0,20}(?:attack|triggered|inhaler|airways)|stickig|schwül|Klimaanlage[^.!?\n]{0,15}(?:kaputt|ausgefallen|defekt)|keine\s*Klimaanlage|Warteschlange[^.!?\n]{0,20}(?:lang|Stunde|ewig|unerträglich|endlos)|personnel[^.!?\n]{0,20}(?:agressif|impoli|grossier|irrespectueux|désagréable)|crié\s*(?:dessus|sur\s*nous|contre)|humiliant\w*|grossièrement|malpoli\w*|court\s+pour\s+le\s+prix|peu\s+pour\s+ce\s+que\s+ça\s+coûte|trop\s+cher[^.!?\n]{0,20}(?:pour|par\s+rapport)|不親切[^.!?\n]{0,15}(?:スタッフ|店員|従業員|職員)|(?:スタッフ|店員|従業員|職員)[^.!?\n]{0,15}不親切|怒鳴られ\w*|がっかり[^.!?\n]{0,8}(?:でした|です|しまい)|値段のわりに[^.!?\n]{0,15}(?:少|物足|短|もの足)|ازدحام|مزدحم\w*|الأسعار\s*مرتفع\w*|thất\s*vọng|giá\s*(?:vé\s*)?(?:quá\s*)?đắt|không\s*đáng\s*(?:giá|tiền)|für\s+(?:den\s+)?Preis[^.!?\n]{0,20}(?:zu\s+wenig|nicht\s+genug|enttäuschend)|두통[^.!?\n]{0,5}(?:생겼|왔|있어|심해)|غير\s*مهذب\w*|خدمة[^.!?\n]{0,10}سيئ\w*|تكيف[^.!?\n]{0,10}(?:لم|لا\s*يعمل)|حار[^.!?\n]{0,5}(?:جداً|جدا)|非常失望|很失望|太失望|体验[^.!?\n]{0,5}失望|decepcionante|decepcionado\w*|muy\s*(?:mal\w*|decepcionant\w*))|(?<!not\s)\bbad\b/i

const DEFAULT_CHURN =
  /(다시는|두번\s*다시는)\s*(안\s*올|안\s*갈)|(never\s*again|never\s*com|won[''’]?t\s*be\s*back|won[''’]?t\s*return|wouldn[''’]?t\s*recommend|not\s*recommend|do\s*not\s*go|skip\s*this|regret)/i

const DEFAULT_REPEAT =
  /(두\s*번째|2번째|3번째|다회차)\s*(방문|관람|왔)|(지난번|과거)\s*에\s*(이어|오고|좋아서)\s*(또|다시)|(갈|올|방문할)\s*때마다|(재방문\s*인데|다시\s*방문했)|(second\s*time|2nd\s*time|third\s*time|3rd\s*time|multiple\s*times|back\s*again|returned|every\s*time\s*(i|we)\s*(go|come|visit)|always|came\s*back|visit\s*again)/i

const DEFAULT_FUTURE_HOPE =
  /(나중에|다음에|기회\s*되면)\s*(꼭|무조건)?\s*(재방문|또\s*방문|다시\s*올)|(will\s*be\s*back|can[''’]?t\s*wait\s*to\s*return|next\s*time|definitely\s*return|will\s*(visit|come)\s*again|would\s*go\s*back)/i

// 주의: 'worth it'(긍정)은 DEFAULT_POSITIVE가 처리. 'not worth it'(부정) 오인복구 방지 위해 여기서 제외.
const DEFAULT_SARCASM =
  /(안\s*아깝|아깝지\s*않|나쁘지\s*않|나쁘지않)|(not\s*(too\s*)?bad|not\s*a\s*waste|didn[''’]?t\s*disappoint)/i

const DEFAULT_POSITIVE =
  /(완벽|오아시스|대박|100점|200점|좋|최고|감동|멋지|멋있|예쁘|이쁘|훌륭|환상|만족|행복|즐거|추천|볼\s*만|아름답|인생\s*샷|괜찮|힐링|몰입|감격|기대\s*이상|기대\s*그\s*이상|재밌|재미있|신기|신선|특별|설레)|(beautiful|amazing|love|wonderful|perfect|gorgeous|stunning|incredible|awesome|fantastic|enjoyed|worth\s*(?:it|checking\s*out)|good\s*location|healing|immersive|relaxing|must[- ]?see|must[- ]?visit|pretty|charming|lovely|breathtaking|mesmerizing|outstanding|exceptional|superb|delightful)|\b(?<!not\s)(?<!wouldn[''']?t\s)great\b|\b(?<!not\s)(?<!wouldn[''']?t\s)recommend\b/i

const DEFAULT_QUESTION =
  /[?？]|(인가요|나요|까요|을까|ㄴ가요|어때|되나요|있나요|하나요|일까)/i

const DEFAULT_ARTWORK =
  /(작품|전시|몰입|미디어\s*아트|미디어아트|예술|아트)|(immersive|\bart(?:s|work)?\b|exhibition|installation|media\s*art)/i

// ── 현장 운영 중심 컴플레인 (복합 리뷰 의미 희석 방지: 1개라도 매칭 시 COMPLAINT 확정) ──
// (?<!안\s) — "동선이 안 복잡"(부정) 등 회피. [^.!?\n]{0,N} — 문장 범위 내 근접 매칭.
const DEFAULT_LAYOUT =
  /(?<!안\s)동선[^.!?\n]{0,12}(복잡|불편|엉망|얽|헷갈)|표지판[^.!?\n]{0,8}(?:없|부족|안\s*보|미흡|제로)|안내[^.!?\n]{0,8}(?:없음|부족|미흡|미비)|길\s*(?:찾기|찾다)[^.!?\n]{0,10}(?:힘들|어렵|헷갈|못|30분|한참)|입구[^.!?\n]{0,10}(?:못\s*찾|안\s*보|헷갈)|指示牌|找不到(?:出口|入口|路)|找了很久|看不到出口|迷路了|hard\s*to\s*navigate|confusing\s*(layout|flow|path)|maze[-\s]?like|no\s*(?:signs?|signage)\b|signs?\s*(?:are\s*)?(?:missing|unclear|non[- ]?existent|nowhere)|couldn[''']?t\s*find\s*(?:the\s+)?(?:entrance|exit|way)/i
const DEFAULT_DISPLAY =
  /(?<!안\s)(영상[^.!?\n]{0,8}(흐릿|흐림|깨)|화질[^.!?\n]{0,8}(흐릿|번져|번짐|별로|구림|나쁨|저하|문제|안\s*좋)|프로젝터[^.!?\n]{0,10}(흐릿|이상|문제|안\s*됨)|디스플레이[^.!?\n]{0,6}(고장|문제)|공사\s*(?:소음|중)[^.!?\n]{0,12}(?:시끄|소음|방해|시끄러)|(?:공사|리모델링)\s*(?:때문|소리)[^.!?\n]{0,10}(?:시끄|소음|방해|집중)|工事[^.!?\n]{0,8}(?:騒音|うるさ|ひどく)|騒音[^.!?\n]{0,8}(?:工事|ひどく|壊れ|邪魔))|blurry|out\s*of\s*sync|low\s*resolution|projector[^.!?\n]{0,14}(blurry|broken|off|sync|issue)|construction\s*(?:noise|sounds?|work)|scaffolding|under\s*(?:renovation|construction)\b/i
const DEFAULT_DURATION =
  /(?<!안\s)(규모[^.!?\n]{0,6}작|금방\s*끝|너무\s*짧|관람\s*시간[^.!?\n]{0,8}짧)|shorter\s*than\s*advertised|too\s*short/i
const DEFAULT_CROWD =
  /(?<!안\s)(사람[^.!?\n]{0,4}(너무\s*)?많|제대로\s*감상[^.!?\n]{0,8}힘들|북적|혼잡|입장\s*대기[^.!?\n]{0,10}(?:길|오래|너무|줄|지쳤|힘들|불편)|대기\s*(?:시간이|가)\s*(?:길었|오래|너무|길어|좀)|줄이?\s*(?:너무\s*)?길(?:어서|었)|오래\s*기다(?:렸|려야)|통로[^.!?\n]{0,12}(?:막|서서|지나갈\s*수\s*없)|틱톡\s*(?:춤|촬영|찍)|관람객\s*통제[^.!?\n]{0,8}(?:안\s*됨|전혀|없음|불가|안\s*되)|플래시[^.!?\n]{0,10}(?:터(?:트|뜨)|남발|막지|통제))|overcrowded|too\s*crowded|packed\s*with\s*people|crowd\s*(?:management|control)\s*(?:(?:is|was|totally|completely|absolutely)\s*)?(?:non[- ]?existent|terrible|absent|lacking|poor|nowhere|awful)|people\s*(?:were\s*)?(?:push|pushing|bumping|shoving)|no\s*crowd\s*control/i

// AMLV 보강: 인터랙티브 부족 (센서/체험 불만) + 가격 불만
const DEFAULT_INTERACTIVE =
  /\bnot\s+(?:very\s+)?interactive\b|\bexpected\s+more\s+interaction\b|\black\s+of\s+interaction\b/i

const DEFAULT_VALUE =
  /\b(?:ticket\s+)?price\b|\bexpected\s+more\s+for\s+the\s+money\b|\btoo\s+expensive\b|\bnot\s+worth\s+(?:the\s+)?(?:money|price)\b|가격\s*대비[^.!?\n]{0,15}(?:아쉬|별로|좀|부족|실망|않)|가성비[^.!?\n]{0,10}(?:아쉬|별로|좀|부족|나쁨|떨어|않)|가격에\s*비해\s*(?:좀|많이|너무)?\s*(?:아쉬|별로|실망)|(?:입장료|티켓값|요금)[^.!?\n]{0,8}(?:비싸|아깝|부담|높)/i

// Rating 1-2 노이즈 필터: 저평점 리뷰에서 아이러니하게 붙는 필러 추천 문장 → 무시
// synonymEngine.FILLER_PATTERN으로 고도화 (기존 영문 2패턴 → 한/영 N-gram 17패턴으로 확장)
// 정상 맥락(고평점)에선 긍정 신호로 처리되지만, rating ≤ 2인 경우 텍스트에서 먼저 제거.
const NOISE_POSITIVE = FILLER_PATTERN

// ── PHASE 3: 4 Niche Complaint Tags ──────────────────────────────────────────────

// ROOM_SPECIFIC_COMPLAINT: 특정 전시 구역/방 불만 (슬롯 C → highlight_room 언급 + 개선 약속)
const DEFAULT_ROOM_SPECIFIC =
  /(?<!안\s*)(특정\s*(?:공간|구역|방|존)[^.!?\n]{0,10}(?:불만|별로|좁|어둡|비좁|답답|불편))|(?:this\s+(?:room|area|space|section|zone)|(?:the\s+)?(?:first|second|last)\s+(?:room|section))[^.!?\n]{0,20}(?:was\s+(?:bad|terrible|disappointing|boring|small|dark|cramped)|felt\s+(?:cramped|empty|rushed))/i

// SYSTEM_COMPLAINT: 키오스크·앱·예약·입장 시스템 오류 (슬롯 C → 기술팀 즉시 조치 약속)
const DEFAULT_SYSTEM_COMPLAINT =
  /(?<!안\s*)(키오스크[^.!?\n]{0,10}(?:오류|고장|안\s*됨|에러|먹통))|(?:예약|입장)\s*시스템[^.!?\n]{0,10}(?:오류|문제|실패|먹통)|(?:티바|티바\s*테이블)[^.!?\n]{0,15}(?:더럽|안\s*닦|끈적|위생|냄새|불결)|kiosk[^.!?\n]{0,20}(?:broken|error|didn[''']?t\s*work|froze|crashed|failed)|(?:booking|ticket)[^.!?\n]{0,20}(?:system[^.!?\n]{0,10}failed|didn[''']?t\s*work)|app\s*(?:crashed|froze|didn[''']?t\s*work)|gift\s*(?:card|voucher)[^.!?\n]{0,20}(?:didn[''']?t\s*work|couldn[''']?t|could\s*not|failed|rejected|invalid|error|broken|not\s*accepted)|(?:couldn[''']?t|could\s*not)\s*redeem|paid\s*out\s*of\s*pocket|paying\s*out\s*of\s*pocket|voucher\s*(?:rejected|invalid|not\s*accepted)|qr[^.!?\n]{0,15}(?:didn[''']?t\s*work|couldn[''']?t|could\s*not|failed|error|broken)|(?:tea\s*bar\s*(?:table|counter|surface)?)[^.!?\n]{0,15}(?:dirty|sticky|unclean|hygiene|grimy)/i

// REVISIT_COMPLAINT: 재방문 실망 패턴 (단순 재방문 언급과 달리 부정 비교 맥락 포함)
const DEFAULT_REVISIT_COMPLAINT =
  /\b(?:second\s+visit|visited\s+before|used\s+to\s+be|disappointed\s+this\s+time)\b|(?<!안\s*)(재방문|두\s*번째|예전에는|과거에)/i

// STAFF_COMPLAINT: 직원 태도/응대 불만 (위험도 medium 격상 — processReviewById의 COMPLAINT → medium이 자동 처리)
// 싸가지없음/직원최악 등 슬랭 포함: Tier 1 sanitizer와 협력 — 탐지는 여기서, 순화는 sanitizeAndScoreRisk
const DEFAULT_STAFF_COMPLAINT =
  /(?:직원[^.!?\n]{0,10}(?:태도|무시|불친절|응대[^.!?\n]{0,6}(?:나쁨|별로|불만)|인사\s*도\s*안|짜증|싸가지|ㅂ[ㅅ이]\s*짓|개\s*같|폰\s*만\s*봄|핸드폰[^.!?\n]{0,6}봄))|(?:직원|스태프)\s*(?:최악|꼰대|개판)|직원[^.!?\n]{0,15}(?:질문|대답|말)[^.!?\n]{0,8}(?:안\s*하|무시|없이|모르쇠|제대로\s*안|제대로\s*못)|직원[^.!?\n]{0,50}도와주지|도와주지[^.!?\n]{0,3}(?:않았|않아|안\s*했)|안내[^.!?\n]{0,10}제대로\s*(?:안|못)|모르겠다고\s*(?:했|하더|하면서)|(?:직원|스태프)[^.!?\n]{0,20}(?:아무도\s*제지|제지를?\s*(?:안\s*했|안\s*하)|제지하지\s*않았)|(?:staff|employee|worker|guard|host|cashier|server)[^.!?\n]{0,30}(?:rude|unfriendly|ignored?|dismissive|unhelpful|impolite|condescending|unprepared|untrained|had\s+(?:an?\s+)?attitude|(?:told|asked|made)\s+(?:us|me)\s+(?:to\s+)?(?:move|keep\s+moving|leave|hurry|rush)|rushed?\s+(?:us|me)|threw?\s+(?:our|my|the)\s+(?:cups?|drinks?|items?|things?)|could\s+not\s+(?:tell|answer|help|inform)|did\s+nothing\s+to\s+(?:help|manage|control|stop|address)|stood\s+(?:by|around)\s+and\s+(?:watched|did\s+nothing))|(?:tea\s*bar)[^.!?\n]{0,20}(?:rude|불친절|무례|unfriendly)|スタッフ[^.!?\n]{0,20}(?:対応できない|対応してもらえなかった|知らないと言われた|わかりませんと言われた)/i

// ════════════════════════════════════════════════════════════════════════════════
//  DynamicEngine: DB 규칙을 인메모리 컴파일하여 적용 (PHASE 2)
// ════════════════════════════════════════════════════════════════════════════════

interface Compiled {
  emergency: RegExp; complaint: RegExp; churn: RegExp; repeat: RegExp
  futureHope: RegExp; sarcasm: RegExp; positive: RegExp; question: RegExp; artwork: RegExp
  layout: RegExp; display: RegExp; duration: RegExp; crowd: RegExp
  interactive: RegExp; value: RegExp    // AMLV 보강
  // PHASE 3: niche complaint tags
  roomSpecific: RegExp; systemComplaint: RegExp; revisitComplaint: RegExp; staffComplaint: RegExp
}

const DEFAULTS: Compiled = {
  emergency:  DEFAULT_EMERGENCY,  complaint: DEFAULT_COMPLAINT, churn: DEFAULT_CHURN,
  repeat:     DEFAULT_REPEAT,     futureHope: DEFAULT_FUTURE_HOPE, sarcasm: DEFAULT_SARCASM,
  positive:   DEFAULT_POSITIVE,   question: DEFAULT_QUESTION, artwork: DEFAULT_ARTWORK,
  layout:     DEFAULT_LAYOUT,     display: DEFAULT_DISPLAY, duration: DEFAULT_DURATION, crowd: DEFAULT_CROWD,
  interactive: DEFAULT_INTERACTIVE, value: DEFAULT_VALUE,
  roomSpecific: DEFAULT_ROOM_SPECIFIC, systemComplaint: DEFAULT_SYSTEM_COMPLAINT,
  revisitComplaint: DEFAULT_REVISIT_COMPLAINT, staffComplaint: DEFAULT_STAFF_COMPLAINT,
}

let COMPILED: Compiled = { ...DEFAULTS }
let appliedLoadedAt = -1  // 적용된 번들의 loadedAt. -1 = 하드코딩 DEFAULTS(=DB 미반영)

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
// 키워드 → 패턴: 특수문자 이스케이프 후 내부 공백을 \s* 로 (예: '돈 아깝' → '돈\s*아깝')
function keywordToPattern(kw: string): string {
  return escapeReg((kw ?? '').trim()).replace(/\s+/g, '\\s*')
}
function rulePatterns(rules: AutomationRule[]): string[] {
  const parts: string[] = []
  for (const r of rules) {
    if (r.regex_pattern && r.regex_pattern.trim()) parts.push(`(?:${r.regex_pattern})`)
    else if (r.keywords?.length) {
      const kp = r.keywords.map(keywordToPattern).filter(Boolean).join('|')
      if (kp) parts.push(kp)
    }
  }
  return parts.filter(Boolean)
}
function compileCategory(rules: AutomationRule[], fallback: RegExp): RegExp {
  const combined = rulePatterns(rules).join('|')
  if (!combined) return fallback
  try { return new RegExp(combined, 'i') } catch { return fallback }
}
// EMERGENCY: 하드코딩 베이스를 '항상' 포함(불변) + DB는 additive only
function compileEmergency(dbRules: AutomationRule[]): RegExp {
  const parts = [DEFAULT_EMERGENCY.source, ...rulePatterns(dbRules)]
  try { return new RegExp(parts.join('|'), 'i') } catch { return DEFAULT_EMERGENCY }
}

/** DB 규칙 번들을 인메모리 컴파일하여 적용. 같은 로드(loadedAt)면 no-op. EMERGENCY는 불변 베이스 포함. */
export function applyRulesBundle(bundle: RulesBundle | null): void {
  if (!bundle) { COMPILED = { ...DEFAULTS }; appliedLoadedAt = -1; return }
  if (bundle.loadedAt === appliedLoadedAt) return
  const active = bundle.rules.filter((r) => r.is_active)
  const byCat = (cat: string) => active.filter((r) => (r.category ?? '').toUpperCase() === cat)
  COMPILED = {
    emergency:  compileEmergency(byCat('EMERGENCY')),
    complaint:  compileCategory(byCat('COMPLAINT'),   DEFAULT_COMPLAINT),
    churn:      compileCategory(byCat('CHURN'),       DEFAULT_CHURN),
    repeat:     compileCategory(byCat('REPEAT'),      DEFAULT_REPEAT),
    futureHope: compileCategory(byCat('FUTURE_HOPE'), DEFAULT_FUTURE_HOPE),
    sarcasm:    compileCategory(byCat('SARCASM'),     DEFAULT_SARCASM),
    positive:   compileCategory(byCat('POSITIVE'),    DEFAULT_POSITIVE),
    question:   compileCategory(byCat('QUESTION'),    DEFAULT_QUESTION),
    artwork:    compileCategory(byCat('ARTWORK'),     DEFAULT_ARTWORK),
    layout:          compileCategory(byCat('LAYOUT_COMPLAINT'),       DEFAULT_LAYOUT),
    display:         compileCategory(byCat('DISPLAY_ISSUE'),           DEFAULT_DISPLAY),
    duration:        compileCategory(byCat('DURATION_COMPLAINT'),      DEFAULT_DURATION),
    crowd:           compileCategory(byCat('CROWD_COMPLAINT'),         DEFAULT_CROWD),
    interactive:     compileCategory(byCat('INTERACTIVE_COMPLAINT'),   DEFAULT_INTERACTIVE),
    value:           compileCategory(byCat('VALUE_COMPLAINT'),         DEFAULT_VALUE),
    roomSpecific:    compileCategory(byCat('ROOM_SPECIFIC_COMPLAINT'), DEFAULT_ROOM_SPECIFIC),
    systemComplaint: compileCategory(byCat('SYSTEM_COMPLAINT'),        DEFAULT_SYSTEM_COMPLAINT),
    revisitComplaint:compileCategory(byCat('REVISIT_COMPLAINT'),       DEFAULT_REVISIT_COMPLAINT),
    staffComplaint:  compileCategory(byCat('STAFF_COMPLAINT'),         DEFAULT_STAFF_COMPLAINT),
  }
  appliedLoadedAt = bundle.loadedAt
}

/** DB 규칙을 로드하여 엔진에 반영 (분류 직전 서버에서 호출). 실패 시 하드코딩 DEFAULTS 유지(안전). */
export async function refreshEngineFromDB(force = false): Promise<void> {
  try {
    const { ensureRulesLoaded } = await import('@/lib/rulesCache')
    applyRulesBundle(await ensureRulesLoaded(force))
  } catch {
    /* DB 접근 불가 → DEFAULTS 유지 */
  }
}

/** 현재 엔진이 하드코딩 DEFAULTS로 동작 중인지(=DB 미반영) — 디버그/시뮬레이션용 */
export function isUsingDefaults(): boolean {
  return appliedLoadedAt === -1
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))]
}

/**
 * analyzeReview — 폭포수 분류 (순수 함수, 부작용 없음).
 * @param rawText    리뷰 원문
 * @param rating     별점(옵션). 4·5점이면 EMERGENCY가 아닌 한 COMPLAINT를 COMPLIMENT로 완화.
 * @param branchCode 지점 코드(옵션). 랜드마크 오탐(FP) 방지 가드에 사용.
 */
export function analyzeReview(
  rawText: string,
  rating?: number | null,
  branchCode?: string | null,
): WaterfallResult {
  const text = (rawText ?? '').replace(/\s+/g, ' ').trim()
  const C = COMPILED  // 현재 적용된 컴파일 규칙 스냅샷(분석 도중 교체 방지)

  // ── Layer 0: Emergency (엔진 정규식 OR filterService high/critical 합집합) ──────
  const filter = scanText(rawText ?? '')
  const filterCritical =
    filter.triggered && (filter.maxRiskLevel === 'high' || filter.maxRiskLevel === 'critical')

  if (C.emergency.test(text) || filterCritical) {
    // ── 랜드마크 FP 가드: 지점 랜드마크 이름이 EMERGENCY 패턴을 오트리거하는 경우 하향 허용 ──
    // 예) 미래 지점 'ARTE MUSEUM HURT RIVER' → "HURT"가 DEFAULT_EMERGENCY \bhurt\b에 매칭
    //     → 랜드마크 제거 후 재검사에서 매칭 사라지면 FP로 판단, 일반 분류로 낙하.
    // filterCritical(키워드 DB) 기반 매칭은 제외(안전 우선).
    let landmarkFP = false
    if (branchCode && !filterCritical) {
      const meta = getBranchTokens(branchCode)
      const lm = (meta.landmark ?? '').trim()
      if (lm && lm !== 'our location') {
        const escapedLm = lm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const textWithoutLm = text.replace(new RegExp(escapedLm, 'ig'), ' ')
        if (!C.emergency.test(textWithoutLm)) {
          landmarkFP = true  // 랜드마크 없이는 EMERGENCY 매칭 안 됨 → 오탐
        }
      }
    }

    if (!landmarkFP) {
      // ── EMERGENCY 세부 유형 자동 태깅 (법적·보상·처벌 — 슬롯 C 특화 답변 선택에 활용) ──
      const emergencySubtags: string[] = []
      if (/소송|고소|변호사|법적\s*(?:조치|책임|분쟁)|법원|손해\s*배상|\b(?:sued|lawsuit|lawyer|attorney|legal\s*action|press\s*charges?)\b|\bsue\b(?![^.!?\n]{0,30}for\s+(?:being|making|having|creating|how)\s*[^.!?\n]{0,20}(?:beautiful|amazing|gorgeous|incredible|stunning|wonderful|perfect|lovely|breathtaking|fantastic))/i.test(text)) {
        emergencySubtags.push('LEGAL_THREAT')
      }
      if (/환불|배상|피해\s*보상|\b(?:refund\w*|compensat\w*|reimburse\w*|chargeback|money\s*back)\b|\bdisput\w+[^.!?\n]{0,20}charge\b|\bcredit\s*card[^.!?\n]{0,15}disput\w*\b/i.test(text)) {
        emergencySubtags.push('COMPENSATION_DEMAND')
      }
      if (/직원[^.!?\n]{0,20}(?:해고|처벌|징계|자르|짜르|처리)|(?:해고해|처벌받아야|징계\s*내려)|\b(?:fire|fires|fired)\s+(?:that|this|the)\s*(?:staff|employee|worker|guard|person)\b|staff\b[^.!?\n]{0,20}\bshould\s+be\s+fired\b|\b(?:punish|dismiss|disciplin)\w*[^.!?\n]{0,20}(?:staff|employee|worker|guard)\b/i.test(text)) {
        emergencySubtags.push('PUNISHMENT_DEMAND')
      }
      return {
        status: 'EMERGENCY',
        requiresLLM: false, // 긴급 건은 LLM이 아니라 사람 수동 검토로 격리
        reason:
          '긴급 안전/CS/법적 리스크 감지 — 즉시 격리' +
          (filter.triggered ? ` (필터: ${filter.matchedKeywords.join(', ')})` : ''),
        tags: dedupe(['CS 격리', '안전/이슈', ...filter.matchedKeywords, ...emergencySubtags]),
        tone: 'STANDARD',
        isEmergency: true,
        isComplaint: false,
        isArtworkFocused: false,
        isRepeatVisitor: false,
        isChurnRisk: false,
        hasPeakHours: false,
        contextMirror: null,
      }
    }
    // landmarkFP=true → fall through to normal classification
  }

  const tags: string[] = []
  let isComplaint = false
  let isArtworkFocused = false
  let isRepeatVisitor = false
  let isChurnRisk = false

  // ── Layer 1: 운영 불만 (일반 + 현장 운영 세부) — 1개라도 매칭 시 COMPLAINT 확정(복합 희석 방지) ──
  if (C.complaint.test(text))       { isComplaint = true; tags.push('운영불만') }
  if (C.layout.test(text))          { isComplaint = true; tags.push('LAYOUT_COMPLAINT') }
  if (C.display.test(text))         { isComplaint = true; tags.push('DISPLAY_ISSUE') }
  if (C.duration.test(text))        { isComplaint = true; tags.push('DURATION_COMPLAINT') }
  if (C.crowd.test(text))           { isComplaint = true; tags.push('CROWD_COMPLAINT') }
  if (C.interactive.test(text))     { isComplaint = true; tags.push('INTERACTIVE_COMPLAINT') }
  if (C.value.test(text))           { isComplaint = true; tags.push('VALUE_COMPLAINT') }
  // PHASE 3: 4 niche tags
  if (C.roomSpecific.test(text))    { isComplaint = true; tags.push('ROOM_SPECIFIC_COMPLAINT') }
  if (C.systemComplaint.test(text)) { isComplaint = true; tags.push('SYSTEM_COMPLAINT') }
  if (C.revisitComplaint.test(text)){ isComplaint = true; tags.push('REVISIT_COMPLAINT') }
  if (C.staffComplaint.test(text))  { isComplaint = true; tags.push('STAFF_COMPLAINT') }
  if (isComplaint) isArtworkFocused = false

  // ── Layer 2: 재방문 / 이탈 (2-A → 2-B → 2-C 우선순위) ───────────────────────────
  if (C.churn.test(text)) {
    isRepeatVisitor = false
    isChurnRisk = true
    tags.push('이탈위험')
  } else if (C.repeat.test(text)) {
    isRepeatVisitor = true
    tags.push('repeat visitor')
  } else if (C.futureHope.test(text)) {
    isRepeatVisitor = false
  }

  // ── Layer 3: 이중부정/도치 복구 (불만 오인 → 긍정) ──────────────────────────────
  // SARCASM_VETO: 이 단어들이 있으면 사캐즘 복구 불가 — "나쁘지 않으나 최악" 같은 복합 문장에서
  // 사캐즘 부분이 전체 불만을 덮어쓰는 오류 방지.
  const SARCASM_VETO =
    /(최악|완전\s*최악|진짜\s*최악|기분을?\s*다?\s*망쳤|기분이?\s*망가|ruined|terrible\s*experience|horrible|atrocious|unacceptable|complete\s*disaster)/i
  let sarcasmPositive = false
  if (C.sarcasm.test(text) && !SARCASM_VETO.test(text)) {
    isComplaint = false
    sarcasmPositive = true
    tags.push('이중부정(긍정)')
  }

  // ── 감성 신호 ──────────────────────────────────────────────────────────────────
  // Rating 1-2: 필러 추천 문장 제거 후 긍정 판정 (FILLER_PATTERN = 고도화 NOISE_POSITIVE)
  const ratingLow = typeof rating === 'number' && rating <= 2
  const ratingHigh = typeof rating === 'number' && rating >= 4
  const textForPositive = ratingLow ? text.replace(NOISE_POSITIVE, '') : text

  // ── Layer 3.5: 저평점(1-2★) 부정 본문 신호 강제 보정 ───────────────────────────
  // 사캐즘 복구 이후에도 저평점+부정 본문이면 COMPLAINT로 격상 (필러 추천 오탐 방지)
  // 대상: "기대한 만큼은 아니었습니다. 커플 데이트로 추천합니다." [1★] 형태
  if (ratingLow && !isComplaint && LOW_RATING_NEGATIVE_BODY.test(text)) {
    isComplaint = true
    sarcasmPositive = false  // 사캐즘 복구 무력화 (저평점에서 안전 우선)
    tags.push('저평점_부정신호')
  }

  const hasPositive = sarcasmPositive || C.positive.test(textForPositive)
  const isQuestion = C.question.test(text)
  if (!isComplaint && hasPositive && C.artwork.test(text)) {
    isArtworkFocused = true
    tags.push('작품감상')
  }

  // ── 최종 판정 ──────────────────────────────────────────────────────────────────
  let status: ReviewClass
  let requiresLLM: boolean
  let reason: string

  // ── Rating Override — 고평점(4·5점)은 EMERGENCY가 아닌 한 건설적 피드백(COMPLIMENT)으로 완화 ──
  // ratingHigh는 Layer 3.5에서 이미 선언됨

  if (isComplaint) {
    if (ratingHigh) {
      status = 'COMPLIMENT'
      requiresLLM = false
      reason = '고평점(4·5점) 건설적 피드백 — Rating Override로 완화(정적 응대)'
    } else {
      status = 'COMPLAINT'
      requiresLLM = true
      reason = '운영/서비스 불만 감지 → LLM 공감 사과문(STANDARD)'
    }
  } else if (hasPositive && !isQuestion) {
    status = ratingHigh ? 'COMPLIMENT' : 'SAFE'
    requiresLLM = false
    reason = isArtworkFocused
      ? '작품 중심 긍정 리뷰 → 정적 템플릿(ETERNAL NATURE)'
      : ratingHigh ? '고평점 긍정 리뷰 → COMPLIMENT(정적 감사)' : '일반 긍정 리뷰 → 정적 감사 템플릿'
  } else {
    status = 'AMBIGUOUS'
    requiresLLM = true
    reason = '알고리즘 확신 불가(중립/질문/모호) → LLM 위임'
  }

  // ── 별점 기반 최후 보정 — AMBIGUOUS 상태에서만 동작 ─────────────────────────────
  // (긍정 패턴 미탐지 시 별점으로 추론, 파국적 오분류 방지)
  if (status === 'AMBIGUOUS') {
    if (ratingHigh && !isComplaint) {
      // 5·4★ + 불만 없음 → COMPLIMENT 격상 (완벽/오아시스 등 신규 긍정어 미탐지 보정)
      status = 'COMPLIMENT'
      requiresLLM = false
      reason = '고평점(4·5점) 긍정 미탐지 → 별점 기반 COMPLIMENT 격상'
    } else if (typeof rating === 'number' && rating <= 1 && !C.positive.test(text) && tags.length === 0) {
      // 1★ + 원문에 긍정 신호 전혀 없음 + 분류 태그 없음 → COMPLAINT 격상
      // !hasPositive 대신 원문(raw) 기준으로 판정: 필러 제거 후에만 긍정이 사라지는 경우(S3b) 방어
      isComplaint = true
      status = 'COMPLAINT'
      requiresLLM = true
      reason = '최저 별점(1점), 긍정/분류 태그 없음 → COMPLAINT 격상'
      tags.push('저평점_부정신호')
    }
  }

  // 피크 시간대 언급 탐지 — 한국어 패턴 추가 (기존 EN-only → KO/EN)
  const hasPeakHours =
    /\b(?:peak|busy)\s+hours?\b/i.test(text) ||
    /평일[에에는]?\s*(?:가면|오면|방문하면|오시면|방문을\s*추천)|주말[에에는]?\s*(?:사람이?\s*많|혼잡|북적|복잡|피하|삼가)|피크\s*타임|혼잡한?\s*시간대?/i.test(text)

  // 맥락 거울: 리뷰 감성 핵심 키워드 추출 (답변 슬롯 B/E 맞춤 구성용)
  const contextMirror = extractContextMirror(text)

  return {
    status,
    requiresLLM,
    reason,
    tags: dedupe(tags),
    tone: 'STANDARD',
    isEmergency: false,
    isComplaint,
    isArtworkFocused,
    isRepeatVisitor,
    isChurnRisk,
    hasPeakHours,
    contextMirror,
  }
}

/**
 * scanForbidden — Double-Check 금칙어 필터 (게시 전 최종 방어선).
 * 정적/LLM 출처 무관하게 모든 답변이 통과해야 한다. 약속성 보상/법적책임/CCTV/직원징계 탐지.
 * @returns clean=false 이면 금칙 표현 존재 → 승인 대기로 강등해야 함.
 */
export function scanForbidden(text: string): { clean: boolean; hits: string[] } {
  const t = (text ?? '').toLowerCase()
  const RULES: Array<{ re: RegExp; label: string }> = [
    { re: /환불(해|을|해\s*드리|\s*가능)|전액\s*환불|돈\s*돌려|refund(ed|ing)?\b|charge\s*back/i, label: '환불 약속' },
    { re: /보상(해|을|금|\s*가능)|배상(해|금)|무료\s*티켓|무료\s*입장|free\s*ticket|compensat(e|ion)|voucher/i, label: '보상 약속' },
    { re: /법적\s*책임|저희\s*과실|저희\s*잘못입니다|legal(ly)?\s*(liable|responsible)|our\s*(fault|liability)/i, label: '법적 책임 인정' },
    { re: /cctv|시시티비|감시\s*카메라|surveillance\s*footage|security\s*footage/i, label: 'CCTV 언급' },
    { re: /직원(을|를)?\s*(해고|징계|처벌)|fire\s+the\s+(staff|employee)|disciplin(e|ary)/i, label: '직원 징계 약속' },
  ]
  const hits: string[] = []
  for (const r of RULES) if (r.re.test(t)) hits.push(r.label)
  return { clean: hits.length === 0, hits: dedupe(hits) }
}

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
import { FILLER_PATTERN, LOW_RATING_NEGATIVE_BODY, extractContextMirror, extractSensoryFocus, extractCompanion, extractTemporal, extractSpatial, fuzzyPositive } from '@/lib/synonymEngine'
import { promotedPositiveRegex, promotedComplaintRules } from '@/lib/promotedPatterns'

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
  /** 감각 초점 — 빛/물/향/소리. 라이트·미디어 아트 특화 감각 반향 슬롯용 (COMPLIMENT 전용). */
  sensoryFocus?: string | null
  /** 동반자 맥락 — 가족/데이트/친구. contextMirror와 독립(중복 echo는 governor가 차단). */
  companionContext?: string | null
  /** 방문 시간대 — 아침/저녁/주말. Fragment Pool 'temporal' 차원 (COMPLIMENT 전용). */
  temporalContext?: string | null
  /** 공간감(긍정) — 포토스팟/넓은공간. Fragment Pool 'spatial' 차원 (COMPLIMENT 전용). */
  spatialContext?: string | null
  /** 복합 의도(긍정+불만 대비 구조) — Hybrid Assembly 트리거 (사과+긍정인정+개선, 자동완료). */
  isHybrid?: boolean
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
  /(다쳤|넘어졌|피가|병원|119|어지러(?!울\s*(?:정도|만큼))|멀미|구토|발작|분실물|경찰|고소|소비자원|보상|환불(?!\s*(?:했다(?:는|대|더|던|길래)|받았다(?:는|대|더|던)|얘기|이야기))|해고해|처벌받아야|징계[^.!?\n]{0,5}내려|천식\s*발작|기도\s*막힘|호흡\s*곤란)|\b(?:hurt|injur\w*|paramedic|nausea|vomit\w*|puke|seizure|epilepsy|stolen|police|lawyer|attorney|lawsuit|refund\w*|compensat\w*|chargeback|asthma\s*attack|inhaler\s*urgently)\b|\bfell\b[^.!?\n]{0,25}(?:hit|hurt|injur\w*|floor|ground|stairs?|step\b|over\b|hard\b|down\b|on\s+(?:the\s+)?(?:floor|ground|steps?|stairs?))|\bbleed\w*\b(?!\s*[-\s]?edge\b|\s*heart\b)|\bhospital\b(?!\s*(?:nurse|worker|staff|doctor|physician|administrator|employee))|\bsue[d]?\b(?![^.!?\n]{0,30}for\s+(?:being|making|having|creating|how)\s*[^.!?\n]{0,20}(?:beautiful|amazing|gorgeous|incredible|stunning|wonderful|perfect|lovely|breathtaking|fantastic))|\bdizzy\b(?!\s+with\s+(?:delight|excitement|joy|wonder|awe|amazement))|\bdisput\w+[^.!?\n]{0,20}charge\b|\bcredit\s*card[^.!?\n]{0,15}disput\w*\b|\b911\b|\btrip(?:ped|ping)\b|\b(?:lost|missing)\b(?!\s+(?:one|a|two|three|\d+)\s*stars?|\s+(?:my|our|their|his|her)\s+(?:mother|father|mom|dad|mum|mam|parents?|husband|wife|partner|sibling|brother|sister|son|daughter|loved\s+one|grandm\w*|grandf\w*|spouse|fianc\w+)|\s+(?:a|an|the|your|our)\s+(?:major|big|huge|great|golden|important|key|potential|promotional|business|marketing|revenue|sale\w*|opportunity|chance|customer|client|deal|contract|subscriber|follower|fan)|\s+[^.!?\n]{0,25}(?:time[\s-]+)?(?:slot|reservation|booking|seat|ticket)\b|\s+track\s+of\b)|\b(?:fire|fires)\s+(?:that|this|the)\s*(?:staff|employee|worker|guard|person)\b|staff\b[^.!?\n]{0,20}\bshould\s+be\s+fired\b|足をひねっ\w*|転倒して(?:怪我|しまい)|けが(?:をし|してしま)|怪我(?:をし|してしま)|아이[^.!?\n]{0,10}(?:보이지\s*않|없어\s*(?:서|요)|실종|찾을\s*수\s*없)|devrait\s+être\s+(?:renvoyé|viré|licencié)\w*|virez?\s+(?:cet?|ce|les)\s+(?:employé|agent|staff|personnel)\w*|sollte[^.!?\n]{0,15}(?:entlassen|gefeuert)\s+werden|müssen\s+(?:entlassen|gefeuert)\s+werden|debería\w*\s+(?:ser\s+)?despedid[ao]\w*|despidan\s+(?:a\s+)?(?:ese|al|este)\s+(?:empleado|personal|agente)\w*|зверн\S*\s+до\s+суд\S*|шахрайств\S*|\bchargeback\b|file\w*\s+a\s+(?:chargeback|dispute)|contact\w*\s+(?:the\s+)?(?:local\s+)?(?:news\b|media\b|press\b|journalist)|report\w*[^.!?\n]{0,15}health\s+(?:department|inspector|authority|official)|health\s+(?:code\s+)?(?:violation|hazard|safety\s+issue)|report\w*[^.!?\n]{0,15}(?:the\s+)?(?:authorities|regulat\w*|government\b)|rechtliche\s+Schritte\b|\bR\S*erstattung\b|弁護士[^.!？\n]{0,10}(?:相談|依頼)|法的\s*措置|محامي|رفع\s*(?:دعوى|قضية)|\bavvocato\b|azione\s+legale\b|\bquerela\b|(?:contacter|alerter|prévenir)\s+(?:les\s+)?(?:journalistes|médias|presse)\w*|porter\s+(?:une\s+)?plainte\b|acciones\s+legales\b|demanda\s+(?:judicial|legal)\b|medidas\s+legales\b|processo\s+(?:judicial|legal)\b|\badvogado\b|ação\s+(?:judicial|legal)\b|судебный\s+иск\S*|адвокат\S*|обращусь\s+(?:в\s+суд|к\s+(?:юристу|адвокату))|fire\s+(?:exit|escape)[^.!?\n]{0,30}(?:blocked|locked|shut|closed|inaccessible|missing)|पैसे\s*वापस|कोर्ट\s*(?:जाऊंगा|जाऊँगा|जाएंगे)|वकील\s*(?:करूंगा|करेंगे)|कानूनी\s*(?:कार्रवाई|नोटिस)/i

// 'bad'는 부정이지만 "not bad"(긍정 관용구)는 제외 (?<!not\s).
const DEFAULT_COMPLAINT =
  /(불친절|짜증|최악|실망|돈[^.!?\n]{0,4}아깝|바가지|시장통|도떼기|더럽|냄새|의자\s*없|주차\s*불편|대기\s*너무|위생[^.!?\n]{0,15}(?:불량|문제|엉망|불결|못\s*따라|수준\s*못|아쉬|나쁘|불만)|화장실[^.!?\n]{0,15}(?:더럽|냄새|지저분|청소|불결|위생)|끈적|환기[^.!?\n]{0,8}(?:안|불량)|에어컨[^.!?\n]{0,12}(?:고장|꺼|없|안\s*(?:나오|나와)|작동\s*(?:안|불량)|냉방\s*(?:안|불량|고장))|휠체어[^.!?\n]{0,20}(?:못|안\s*됨|없|불가|어렵|힘들)|장애인\s*(?:편의|접근|시설|화장실)[^.!?\n]{0,10}(?:없|불가|부족|안\s*됨)|자막[^.!?\n]{0,4}없|경사로[^.!?\n]{0,4}없|수어\s*(?:안내|통역)[^.!?\n]{0,4}없|장벽|청각\s*장애[^.!?\n]{0,10}(?:배려|안내|불편)|폐소공포증|어둡고[^.!?\n]{0,8}(?:좁아서|답답)|답답한\s*느낌|시각장애[^.!?\n]{0,10}(?:안내|배려|서비스)[^.!?\n]{0,6}(?:없|부족|안\s*됨|운영\s*안)|점자\s*(?:안내판|블록)\s*없|음성\s*안내\s*없)|(rude|attitude|unprofessional|worst|disappoint|rip\s*off|waste\s*of|overprice|scam|packed|crowded|zoo|messy|dirty|filthy|smell|stink|no\s*seat|nowhere\s*to\s*sit|parking|long\s*(line|wait|queue)|not\s*worth|overrated|no\s*air\s*(?:con|conditioning)|unbearably\s*hot|sweltering|ac\s*(?:broken|off|wasn[''']?t\s*working)|stuffy|poor\s*ventilation|ruined\s*by|restroom[^.!?\n]{0,8}(?:dirty|disgusting|filthy|unclean)|safety\s*(?:issue|concern|hazard|risk|failure)|allergen|organizational\s*failure|complete\s*(?:failure|disaster)|double[- ]?book\w*|overbooking|wheelchair[^.!?\n]{0,20}(?:inaccessible|no\s*(?:access|ramp)|couldn|not\s*(?:accessible|allowed))|not\s*wheelchair\s*accessible|no\s*(?:wheelchair|disabled|handicap)\s*access|accessibility[^.!?\n]{0,20}(?:issue|problem|concern|barrier|fail)|hearing\s*(?:loop|impair\w*|aid)[^.!?\n]{0,10}(?:no|not|missing|lacking)|no\s*(?:captions?|subtitles?)|deaf[^.!?\n]{0,20}(?:no|not|couldn|ignored|unhelpful)|\bcolorblind\b|panic\s*(?:attack|disorder)|no\s*(?:content|trigger)\s*warning|no\s*warning\s*(?:beforehand|given|provided|about\s*the)|sensory\s*(?:overwhelm|overload|distress|break\s*area|guide)|no\s*(?:quiet|sensory)\s*(?:room|area|space)|asthma[^.!?\n]{0,20}(?:attack|triggered|inhaler|airways)|stickig|schwül|Klimaanlage[^.!?\n]{0,15}(?:kaputt|ausgefallen|defekt)|keine\s*Klimaanlage|Warteschlange[^.!?\n]{0,20}(?:lang|Stunde|ewig|unerträglich|endlos)|personnel[^.!?\n]{0,20}(?:agressif|impoli|grossier|irrespectueux|désagréable)|crié\s*(?:dessus|sur\s*nous|contre)|humiliant\w*|grossièrement|malpoli\w*|court\s+pour\s+le\s+prix|peu\s+pour\s+ce\s+que\s+ça\s+coûte|trop\s+cher[^.!?\n]{0,20}(?:pour|par\s+rapport)|不親切[^.!?\n]{0,15}(?:スタッフ|店員|従業員|職員)|(?:スタッフ|店員|従業員|職員)[^.!?\n]{0,15}不親切|怒鳴られ\w*|がっかり[^.!?\n]{0,8}(?:でした|です|しまい)|値段のわりに[^.!?\n]{0,15}(?:少|物足|短|もの足)|ازدحام|مزدحم\w*|الأسعار\s*مرتفع\w*|thất\s*vọng|giá\s*(?:vé\s*)?(?:quá\s*)?đắt|không\s*đáng\s*(?:giá|tiền)|für\s+(?:den\s+)?Preis[^.!?\n]{0,20}(?:zu\s+wenig|nicht\s+genug|enttäuschend)|두통[^.!?\n]{0,5}(?:생겼|왔|있어|심해)|غير\s*مهذب\w*|خدمة[^.!?\n]{0,10}سيئ\w*|تكيف[^.!?\n]{0,10}(?:لم|لا\s*يعمل)|حار[^.!?\n]{0,5}(?:جداً|جدا)|非常失望|很失望|太失望|体验[^.!?\n]{0,5}失望|decepcionante|decepcionado\w*|muy\s*(?:mal\w*|decepcionant\w*)|décevant\w*|déçu\w*|vraiment\s+(?:décevant|déçu|mauvais|nul)|franchement\s+décevant|pas\s+à\s+la\s+hauteur|разочарован\w*|разочаровывающ\w*|слишком\s+(?:дорого|дорогой|дорого)|очень\s+(?:долг\w+|плох\w+|разочаровал)|персонал[^.!?\n]{0,10}(?:грубый|грубо|равнодушн\w+)|không\s*đáng\s*(?:giá|tiền|để\s*đến)|nhân\s*viên[^.!?\n]{0,15}(?:thô\s*lỗ|không\s*nhiệt\s*tình|vô\s*lễ|không\s*thân\s*thiện)|không\s*có\s*(?:hướng\s*dẫn|biển\s*báo|thuyết\s*minh)[^.!?\n]{0,10}(?:tiếng\s*Việt|bằng\s*tiếng\s*Việt)|nhân\s*viên[^.!?\n]{0,20}không\s*(?:nói|hiểu)\s*(?:được\s*)?tiếng\s*Việt|demasiada\s+gente|demasiado\s+(?:lleno|llena|aglomerado\w*)|no\s+(?:se\s+)?pod[íi]\w*\s+(?:disfrutar|ver\s+nada)|proyector[^.!?\n]{0,35}(?:fallando|roto|no\s+funciona\w*|averiado|estropeado)|sala[^.!?\n]{0,10}(?:cerrada|no\s+disponible)|frustrante\b|señali[^.!?\n]{0,20}(?:inglés|coreano|sin\s+español)|no\s+hay[^.!?\n]{0,10}información[^.!?\n]{0,10}español|très\s+bondé\b|bondé\s+et\s+bruyant|files?\s+d[''']attente[^.!?\n]{0,10}(?:longues|long|trop)|مثير\w*\s+للقلق|zu\s+dunkel[^.!?\n]{0,15}(?:für|ohne)\s+(?:gute\s+)?Fotos|混雑[^.!?\n]{0,10}(?:ひどく|すぎ|過ぎ|最悪|で\s*ゆっくり)|ゆっくり[^.!?\n]{0,15}(?:できません|できなかった|鑑賞できな)|단차[^.!?\n]{0,8}(?:표시|없|위험|부족)|유도등[^.!?\n]{0,8}(?:없|흐릿|부족|안\s*보)|rozczarowując\w*|rozczarowany\w*|zbyt\s*(?:drogo|drogi\w*|droga\w*)|za\s*drogi\w*|mehr\s+(?:Inhalt|Ausstellungen|Räume)[^.!?\n]{0,15}erwartet|Fotoregeln[^.!?\n]{0,20}(?:unklar|widersprüchlich)|人太多[^.!?\n]{0,5}(?:了|没办法|根本)|挤来挤去|体验[^.!?\n]{0,5}(?:很差|太差|极差)|投影[^.!?\n]{0,5}(?:壞|坏|故障|不工作|不正常)|感[覺觉]被欺騙|被欺骗\w*|票[价價][^.!?\n]{0,10}(?:偏高|太贵|太貴|涨了|涨价|上涨)|時間[^.!?\n]{0,5}太短|时间[^.!?\n]{0,5}(?:太短|很短)|内容[^.!?\n]{0,10}(?:一模一样|没有变化|太少|有些少)|没有椅子|没有座位|椅子[^.!?\n]{0,5}(?:没有|太少)|团体优惠[^.!?\n]{0,15}(?:没有|不认|拒绝)|空[调調][^.!?\n]{0,8}(?:太冷|太热|坏了|没有|故障)|高い割に[^.!?\n]{0,10}(?:少ない|短い|物足りない)|見応えが(?:少なかった|少ない|なかった|ありません)|日本語[^.!?\n]{0,10}(?:ガイド|案内|説明|サービス|対応)[^.!?\n]{0,10}(?:ない|なく|なかった|なし)|オーディオガイド[^.!?\n]{0,10}(?:ない|なく|なかった)|作品数[^.!?\n]{0,10}(?:少なく|減っ|前回より)|部屋[^.!?\n]{0,5}(?:閉鎖|閉まっ)|tiếng\s*Việt[^.!?\n]{0,15}hạn\s*chế|(?:máy\s*chiếu|màn\s*hình)[^.!?\n]{0,10}(?:lỗi|bị\s*hỏng|không\s*hoạt)|(?:bị\s+lỗi|hỏng)[^.!?\n]{0,10}máy\s*chiếu|lỗi\s+máy\s*chiếu|feel\w*\s+(?:excluded|invisible|ignored|marginali[sz]ed)\b|left\s+feel\w*\s+(?:excluded|unwelcome|invisible)|leaving\s+(?:guests?|visitors?|customers?)[^.!?\n]{0,20}\bexcluded\b|no\s+(?:places?|benches?)\s+to\s+(?:sit|rest)|zero\s+(?:benches?|seats?)\b|complete\s+lack\s+of\s+seating|nowhere\s+to\s+(?:sit|rest)\b|only\s+(?:displayed|written|shown|available)\s+in\s+Korean\b|no\s+English\s+(?:translat|descript|sign)\w*\b|내부가?\s*너무\s*추워|너무\s*추워서|긴팔이\s*필요|waited\s+\d+\s+(?:minutes?|hours?)[^.!?\n]{0,15}(?:to\s+get\s+in|in\s+(?:line|queue))|ticketing\s+system\s+(?:is\s+)?(?:broken|down|not\s+working)|PTSD[^.!?\n]{0,20}triggered\b|loud\s+(?:booms?|sounds?|noises?)[^.!?\n]{0,35}triggered\b|triggered\s+(?:me|my|us)\s+(?:badly|severely|hard\b)|(?:became?|becoming)\s+(?:very\s+)?(?:distressed|panicked|disoriented)\b|panicking\b[^.!?\n]{0,20}(?:had\s+to|couldn|difficult)|no\s+(?:way\s+to\s+quickly|clear)\s+exit|no\s+(?:tactile|audio)\s+(?:description\w*|guide\w*|alternative\w*)|very\s+little\s+(?:tactile\s+or\s+audio|audio\s+or\s+tactile)|nobody\s+(?:told|warned|mentioned|informed)\s+(?:us\s+)?(?:about\s+)?(?:the\s+)?photo(?:graphy)?\s+rule|photo\s+rule\w*[^.!?\n]{0,20}(?:not\s+mentioned|nobody\s+told|no\s+warning)|nobody\s+(?:told|mentioned|warned|informed)[^.!?\n]{0,10}(?:at\s+the\s+entrance|beforehand|in\s+advance|before\s+(?:entering|we\s+came|buying))|inconsistent\s+(?:enforcement|policy|rules?|messaging)\b|different\s+staff[^.!?\n]{0,20}(?:different|contradict\w*|inconsistent)\s+(?:answer|response|rule)|feel\s*(?:misled|deceived|cheated)\b|felt\s*(?:misled|deceived|cheated)\b|조명이?\s*너무\s*(?:강렬|밝|자극|눈부)|체험에?\s*(?:한계|제한)\w*|배리어프리[^.!?\n]{0,10}(?:없|부족|필요)|没有[^.!?\n]{0,5}(?:团体优惠|团体折扣)|sound\s+levels?[^.!?\n]{0,25}(?:very\s+)?(?:uncomfort\w+|too\s+loud|overwhelming\b)|room[^.!?\n]{0,40}(?:was\s+)?(?:closed|shut)(?!\s+on\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))|全くありません|ราคาแพง\w*|อุปกรณ์\s*เสีย|ไม่คุ้มราคา|ไม่คุ้ม\s*เงิน|ผิดหวัง\w*|teleur\w+|niet\s+de\s+moeite\s+waard|veel\s+te\s+druk\b|te\s+donker[^.!?\n]{0,15}(?:voor|voor\s+(?:goede\s+)?foto)|wachtrij[^.!?\n]{0,10}(?:lang\b|te\s+lang|uur\b)|απογοητευτικ\w+|πολύ\s+(?:ακριβ\w+|γεμάτ\w+\b|κόσμ\w+\b)|δεν\s+αξίζει|skuffet\w*|ikke\s+tilgjengelig\b|rullestol[^.!?\n]{0,15}(?:ikke\b|vanskelig\b)|dyrt\b|for\s+dyrt\b|zklamání\w*|zklamaný\w*|příliš\s+drah\w+|moc\s+drah\w+|přeplněno\w*|dezamăg\w*|prea\s+scump\w*|aglomerat\w*|hayal\s+kırıklığ\w+|çok\s+(?:kalabalık|pahalı)\w*|maalesef\s+(?:kötü|hayal)|stroller[^.!?\n]{0,30}(?:could\s+not|couldn\b|cannot|not\s+(?:accessible|allowed|fit|pass)|no\s+(?:ramp|access|lift|elevator))|no\s+(?:lift|ramp|elevator)[^.!?\n]{0,20}stroller\b|pram[^.!?\n]{0,20}(?:couldn|could\s+not|not\s+(?:accessible|allowed|fit)|no\s+(?:ramp|access))|pushchair[^.!?\n]{0,15}(?:access|ramp|couldn)|allerg\w+[^.!?\n]{0,20}(?:reaction|trigger\w*|to\s+the\s+scent|to\s+(?:the\s+)?fragrance\w*)|no\s+(?:allerg\w*|fragrance)\s+warning|pettymys\S*|liian\s+kalli\S*|täynnä|en\s+suosittele\b|\bbastos\b|nakakainis\b|nakakabigo\b|hindi[^.!?\n]{0,20}(?:babalik|ulit)\b|\bfreezing\s+cold\b|too\s+cold\b|air\s+con(?:ditioning)?\s+(?:too\s+)?(?:strong|too\s+cold|freezing|blast)|(?:booking|ticket)\s*(?:website|site|app|system|platform)[^.!?\n]{0,20}(?:broken\b|down\b|not\s+working|crashed\b|unavailable\b)|csalódtam\b|nem\s+ajánlom\b|túl\s+drága\b|ناامید\S*|شلوغی\S*|\bchaotic\b|not\s+(?:honored|honoured)\b|mengecewakan\b|tidak\s+berbaloi\b|mahal\s+sangat\b|sangat\s+teruk\b|teruk\s+sangat\b|enttäusch\S*|nicht\s+(?:wirklich\s+)?empfehlenswert\b|sehr\s+enttäusch\S*|হতাশাজনক|অপচয়|খারাপ\s*অভিজ্ঞতা|იმედგაცრუება|ძალიან\s+ძვირია|false\s+advertising\b|misleading\s+advertisement\b|(?:曝光|投诉|举报)\S{0,5}(?:微博|朋友圈|小红书|微信|抖音)|(?:微博|朋友圈|小红书)\S{0,10}(?:曝光|发帖|投诉)|walang\s+(?:respeto|serbisyo|kwenta)\b|masyadong\s+(?:mahal|marami\w*|magulo)\b|napakatagal\b|hindi\s+(?:sulit|katanggap\S*)\b|निराशाजनक|पैसे\s*की\s*बर्बादी|बहुत\s*बुरा\b|वापस\s*नहीं\s*(?:आएंगे|आऊंगा|आएगा)|مخيب\s*للآمال|خيبة\s*أمل|Ожидал\S*\s+больш|Цена\s+не\s+соответств\S*|не\s+(?:стоит\s+своих\s+денег|оправдал\w*\s+ожидан\w*)|decepci\S*|p[eé]sim[oa]\b|pesadilla\b)|(?<!not\s)\bbad\b/i

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
  /(완벽|오아시스|대박|100점|200점|좋|최고|감동|멋지|멋진|멋졌|멋있|예쁘|예쁜|예뻐|예뻤|이쁘|이쁜|이뻐|이뻤|훌륭|환상|만족|행복|즐거|추천|볼\s*만|아름답|아름다운|아름다웠|인생\s*샷|괜찮|힐링|몰입|감격|기대\s*이상|기대\s*그\s*이상|재밌|재미있|재밋|넘\s*좋|너무\s*좋|개\s*좋|존\s*좋|굿|꿀잼|강추|신기|신선|특별|설레)|(beautiful|amazing|love|wonderful|perfect|gorgeous|stunning|incredible|awesome|fantastic|enjoyed|worth\s*(?:it|checking\s*out)|good\s*location|healing|immersive|relaxing|must[- ]?see|must[- ]?visit|pretty|charming|lovely|breathtaking|mesmerizing|outstanding|exceptional|superb|delightful)|\b(?<!not\s)(?<!wouldn[''']?t\s)great\b|\b(?<!not\s)(?<!wouldn[''']?t\s)recommend\b/i

const DEFAULT_QUESTION =
  /[?？]|(인가요|나요|까요|을까|ㄴ가요|어때|되나요|있나요|하나요|일까)/i

// 서비스 질문(시설/운영 정보 문의) — 수사적 감탄("예쁘죠?")과 구분.
// 매칭 시 고평점 COMPLIMENT 격상을 차단하고 사람/LLM 응대로 격리한다.
const SERVICE_QUESTION =
  /(되나요|있나요|가능한가요|가능할까요|가능해요|하나요|할까요|될까요|어떻게\s*(?:하나|해야|되|이용)|몇\s*시|얼마(?:인가요|예요|에요|죠|인지)|언제(?:부터|까지)|주차|유모차|휠체어|수유실|물품\s*보관|보관함|짐\s*맡|할인|재입장|예매|단체\s*(?:예약|관람)|반려동물|애완|입장\s*(?:연령|나이))|\bcan\s+(?:i|we|you)\b|\bdo\s+you\b|\bis\s+there\b|\bare\s+there\b|\bhow\s+(?:much|long|do|can|early)\b|\bwhat\s+time\b|\bwhen\s+(?:do|does|is)\b|\bwhere\s+(?:is|can|do)\b|\bstroller\b|\bwheelchair\b|\bparking\b|\bdiscount\b|\bre-?entry\b/i

const DEFAULT_ARTWORK =
  /(작품|전시|몰입|미디어\s*아트|미디어아트|예술|아트)|(immersive|\bart(?:s|work)?\b|exhibition|installation|media\s*art)/i

// ── 현장 운영 중심 컴플레인 (복합 리뷰 의미 희석 방지: 1개라도 매칭 시 COMPLAINT 확정) ──
// (?<!안\s) — "동선이 안 복잡"(부정) 등 회피. [^.!?\n]{0,N} — 문장 범위 내 근접 매칭.
const DEFAULT_LAYOUT =
  /(?<!안\s)동선[^.!?\n]{0,12}(복잡|불편|엉망|얽|헷갈)|표지판[^.!?\n]{0,8}(?:없|부족|안\s*보|미흡|제로)|안내[^.!?\n]{0,8}(?:없음|부족|미흡|미비)|길\s*(?:찾기|찾다)[^.!?\n]{0,10}(?:힘들|어렵|헷갈|못|30분|한참)|입구[^.!?\n]{0,10}(?:못\s*찾|안\s*보|헷갈)|指示牌|找不到(?:出口|入口|路)|找了很久|看不到出口|迷路了|hard\s*to\s*navigate|confusing\s*(layout|flow|path)|maze[-\s]?like|no\s*(?:signs?|signage)\b|signs?\s*(?:are\s*)?(?:missing|unclear|non[- ]?existent|nowhere)|couldn[''']?t\s*find\s*(?:the\s+)?(?:entrance|exit|way)/i
const DEFAULT_DISPLAY =
  /(?<!안\s)(영상[^.!?\n]{0,8}(흐릿|흐림|깨)|화질[^.!?\n]{0,8}(흐릿|번져|번짐|별로|구림|나쁨|저하|문제|안\s*좋)|프로젝터[^.!?\n]{0,10}(흐릿|이상|문제|안\s*됨)|디스플레이[^.!?\n]{0,6}(고장|문제)|공사\s*(?:소음|중)[^.!?\n]{0,12}(?:시끄|소음|방해|시끄러)|(?:공사|리모델링)\s*(?:때문|소리)[^.!?\n]{0,10}(?:시끄|소음|방해|집중)|工事[^.!?\n]{0,8}(?:騒音|うるさ|ひどく)|騒音[^.!?\n]{0,8}(?:工事|ひどく|壊れ|邪魔))|blurry|out\s*of\s*sync|low\s*resolution|projector[^.!?\n]{0,14}(blurry|broken|off|sync|issue)|construction\s*(?:noise|sounds?|work)|scaffolding|under\s*(?:renovation|construction)\b/i
const DEFAULT_DURATION =
  /(?<!안\s)(규모[^.!?\n]{0,6}작|금방\s*끝|너무\s*짧|관람\s*시간[^.!?\n]{0,8}짧|\d+분\s*만에\s*(?:다\s*)?끝)|shorter\s*than\s*advertised|too\s*short|只有[^.!?\n]{0,3}\d+\s*(?:分钟|分钟)\b/i
const DEFAULT_CROWD =
  /(?<!안\s)(사람[^.!?\n]{0,4}(너무\s*)?많|제대로\s*감상[^.!?\n]{0,8}힘들|북적|혼잡|입장\s*대기[^.!?\n]{0,10}(?:길|오래|너무|줄|지쳤|힘들|불편)|대기\s*(?:시간이|가)\s*(?:길었|오래|너무|길어|좀)|줄이?\s*(?:너무\s*)?길(?:어서|었)|오래\s*기다(?:렸|려야)|\d+분이나\s*줄\s*서서|통로[^.!?\n]{0,12}(?:막|서서|지나갈\s*수\s*없)|틱톡\s*(?:춤|촬영|찍)|관람객\s*통제[^.!?\n]{0,8}(?:안\s*됨|전혀|없음|불가|안\s*되)|플래시[^.!?\n]{0,10}(?:터(?:트|뜨)|남발|막지|통제))|overcrowded|too\s*crowded|packed\s*with\s*people|crowd\s*(?:management|control)\s*(?:(?:is|was|totally|completely|absolutely)\s*)?(?:non[- ]?existent|terrible|absent|lacking|poor|nowhere|awful)|people\s*(?:were\s*)?(?:push|pushing|bumping|shoving)|no\s*crowd\s*control|排[了]{0,1}[^.!?\n]{0,5}(?:两|一|三|几)\s*(?:个\s*)?小时[^.!?\n]{0,5}队|esperar\S{0,2}[^.!?\n]{0,15}hora\w*\b|стоять[^.!?\n]{0,10}(?:в\s+)?очереди/i

// AMLV 보강: 인터랙티브 부족 (센서/체험 불만) + 가격 불만
const DEFAULT_INTERACTIVE =
  /\bnot\s+(?:very\s+)?interactive\b|\bexpected\s+more\s+interaction\b|\black\s+of\s+interaction\b/i

const DEFAULT_VALUE =
  /\b(?:ticket\s+)?price\b|\bexpected\s+more\s+for\s+the\s+money\b|\btoo\s+expensive\b|\bnot\s+worth\s+(?:the\s+)?(?:money|price)\b|가격\s*대비[^.!?\n]{0,15}(?:아쉬|별로|좀|부족|실망|않)|가성비[^.!?\n]{0,10}(?:아쉬|별로|좀|부족|나쁨|떨어|않)|가격에\s*비해\s*(?:좀|많이|너무)?\s*(?:아쉬|별로|실망)|(?:입장료|티켓값|요금)[^.!?\n]{0,8}(?:비싸|아깝|부담|높)|돈\s*낭비|desperdici\S+|расстаться[^.!?\n]{0,10}(?:с\s+)?деньг\S*/i

// Rating 1-2 노이즈 필터: 저평점 리뷰에서 아이러니하게 붙는 필러 추천 문장 → 무시
// synonymEngine.FILLER_PATTERN으로 고도화 (기존 영문 2패턴 → 한/영 N-gram 17패턴으로 확장)
// 정상 맥락(고평점)에선 긍정 신호로 처리되지만, rating ≤ 2인 경우 텍스트에서 먼저 제거.
const NOISE_POSITIVE = FILLER_PATTERN

// ── 구어체 긍정 신호 (정식 긍정 사전이 놓치는 캐주얼 호평) ──────────────────────────
// "별점은 낮은데 본문은 사실상 긍정"(예: ★2 "꿀팁…아이한테 딱이에요")이 hasPositive 미탐지로
// COMPLAINT(사과)로 떨어지던 문제 보정. 부정과 결합되기 쉬운 토큰(추천/갈 만/또 가고 싶 등)은
// 의도적으로 제외 — 그런 토큰은 저평점에서 반어/필러일 확률이 높아 FILLER_PATTERN이 따로 제거한다.
// 여기 토큰은 부정형이 드물고(부정 시 형태가 달라짐: 후회'없'↔후회'했', 딱이에요↔해당없음) 고정밀.
const COLLOQUIAL_POSITIVE =
  /딱이[에야]|딱\s?좋|안성맞춤|꿀팁|꿀잼|핵잼|강추|인생\s?샷|인생\s?사진|후회\s?없|후회\s?안|아깝지\s?않|돈\s?안\s?아까|고마워할\s?거|나중에\s?고마/

// ── PHASE 3: 4 Niche Complaint Tags ──────────────────────────────────────────────

// ROOM_SPECIFIC_COMPLAINT: 특정 전시 구역/방 불만 (슬롯 C → highlight_room 언급 + 개선 약속)
const DEFAULT_ROOM_SPECIFIC =
  /(?<!안\s*)(특정\s*(?:공간|구역|방|존)[^.!?\n]{0,10}(?:불만|별로|좁|어둡|비좁|답답|불편))|(?:this\s+(?:room|area|space|section|zone)|(?:the\s+)?(?:first|second|last)\s+(?:room|section))[^.!?\n]{0,20}(?:was\s+(?:bad|terrible|disappointing|boring|small|dark|cramped)|felt\s+(?:cramped|empty|rushed))/i

// SYSTEM_COMPLAINT: 키오스크·앱·예약·입장 시스템 오류 (슬롯 C → 기술팀 즉시 조치 약속)
const DEFAULT_SYSTEM_COMPLAINT =
  /(?<!안\s*)(키오스크[^.!?\n]{0,10}(?:오류|고장|안\s*됨|에러|먹통))|(?:예약|입장)\s*시스템[^.!?\n]{0,10}(?:오류|문제|실패|먹통)|(?:티바|티바\s*테이블)[^.!?\n]{0,15}(?:더럽|안\s*닦|끈적|위생|냄새|불결)|kiosk[^.!?\n]{0,20}(?:broken|error|didn[''']?t\s*work|froze|crashed|failed)|(?:booking|ticket)[^.!?\n]{0,20}(?:system[^.!?\n]{0,10}failed|didn[''']?t\s*work)|app\s*(?:crashed|froze|didn[''']?t\s*work)|gift\s*(?:card|voucher)[^.!?\n]{0,20}(?:didn[''']?t\s*work|couldn[''']?t|could\s*not|failed|rejected|invalid|error|broken|not\s*accepted)|(?:couldn[''']?t|could\s*not)\s*redeem|paid\s*out\s*of\s*pocket|paying\s*out\s*of\s*pocket|voucher\s*(?:rejected|invalid|not\s*accepted)|qr[^.!?\n]{0,15}(?:didn[''']?t\s*work|couldn[''']?t|could\s*not|failed|error|broken)|(?:tea\s*bar\s*(?:table|counter|surface)?)[^.!?\n]{0,15}(?:dirty|sticky|unclean|hygiene|grimy)/i

// REVISIT_COMPLAINT: 재방문 실망 패턴 (단순 재방문 언급과 달리 부정 비교 맥락 포함)
// REVISIT_COMPLAINT: 재방문 '실망' — 단순 재방문 언급(긍정 재방문)과 구분하기 위해
// 반드시 부정/실망 신호가 재방문 마커 근처(40자 이내)에 동반될 때만 매칭.
// (긍정 재방문 "두 번째인데도 여전히 새롭고 감동적"은 isRepeatVisitor로만 처리 → COMPLIMENT)
const DEFAULT_REVISIT_COMPLAINT =
  /\b(?:second\s+visit|visited\s+before|came\s+back|used\s+to\s+be|been\s+here\s+before)\b[^.!?\n]{0,40}(?:disappoint\w*|worse|not\s+as\s+good|nothing\s+(?:new|changed|different)|same\s+(?:as|old)|let\s+down|underwhelm\w*|expected\s+more)|disappointed\s+this\s+time|(?<!안\s*)(?:재방문|두\s*번째|세\s*번째|예전에는?|과거에|지난번)[^.!?\n]{0,40}(?:아쉬|실망|별로|예전만\s*못|전보다\s*못|똑같|그대로|변화\s*(?:가\s*)?없|바뀐\s*게\s*없|달라진\s*게\s*없|새로운\s*게\s*없|기대\s*이하|나아진\s*게\s*없|그\s*나물에\s*그\s*밥)/i

// STAFF_COMPLAINT: 직원 태도/응대 불만 (위험도 medium 격상 — processReviewById의 COMPLAINT → medium이 자동 처리)
// 싸가지없음/직원최악 등 슬랭 포함: Tier 1 sanitizer와 협력 — 탐지는 여기서, 순화는 sanitizeAndScoreRisk
const DEFAULT_STAFF_COMPLAINT =
  /(?:직원[^.!?\n]{0,10}(?:태도|무시|불친절|응대[^.!?\n]{0,6}(?:나쁨|별로|불만)|인사\s*도\s*안|짜증|싸가지|ㅂ[ㅅ이]\s*짓|개\s*같|폰\s*만\s*봄|핸드폰[^.!?\n]{0,6}봄))|(?:직원|스태프)\s*(?:최악|꼰대|개판)|직원[^.!?\n]{0,15}(?:질문|대답|말)[^.!?\n]{0,8}(?:안\s*하|무시|없이|모르쇠|제대로\s*안|제대로\s*못)|직원[^.!?\n]{0,50}도와주지|도와주지[^.!?\n]{0,3}(?:않았|않아|안\s*했)|안내[^.!?\n]{0,10}제대로\s*(?:안|못)|모르겠다고\s*(?:했|하더|하면서)|(?:직원|스태프)[^.!?\n]{0,20}(?:아무도\s*제지|제지를?\s*(?:안\s*했|안\s*하)|제지하지\s*않았)|(?:staff|employee|worker|guard|host|cashier|server)[^.!?\n]{0,30}(?:rude|unfriendly|ignored?|dismissive|unhelpful|impolite|condescending|unprepared|untrained|had\s+(?:an?\s+)?attitude|(?:told|asked|made)\s+(?:us|me)\s+(?:to\s+)?(?:move|keep\s+moving|leave|hurry|rush)|rushed?\s+(?:us|me)|threw?\s+(?:our|my|the)\s+(?:cups?|drinks?|items?|things?)|could\s+not\s+(?:tell|answer|help|inform)|did\s+nothing\s+to\s+(?:help|manage|control|stop|address)|stood\s+(?:by|around)\s+and\s+(?:watched|did\s+nothing))|(?:tea\s*bar)[^.!?\n]{0,20}(?:rude|불친절|무례|unfriendly)|スタッフ[^.!?\n]{0,20}(?:対応できない|対応してもらえなかった|知らないと言われた|わかりませんと言われた)|不理会[^.!?\n]{0,8}(?:游客|顾客|访客|参观者)/i

// ACCESSIBILITY_COMPLAINT: 휠체어·유모차·고령자 접근성 (경사로/엘리베이터/배리어프리 부재 등)
//   부정 신호 동반 시에만 매칭("휠체어 접근 좋았어요" 같은 긍정 오탐 방지).
const DEFAULT_ACCESSIBILITY =
  /(?:휠체어|유모차|거동\s*불편|장애인|어르신|고령)[^.!?\n]{0,20}(?:없|안\s*되|불편|막혀|힘들|어렵|이용\s*(?:못|불가)|배려\s*(?:가\s*)?없|곤란)|(?:경사로|엘리베이터|승강기)[^.!?\n]{0,15}(?:없|못\s*찾|안\s*보|부족|고장)|배리어[\s-]*프리[^.!?\n]{0,10}(?:안|없|부족)|wheelchair[^.!?\n]{0,25}(?:no\b|not\b|couldn|cannot|can[''']?t|inaccessible|difficult|hard|impossible|struggl)|no\s+(?:wheelchair\s+(?:access|ramp)|ramp|elevator|lift)\b|stroller[^.!?\n]{0,20}(?:difficult|hard|couldn|cannot|no\s+access|struggl)|not\s+(?:wheelchair|disabled|stroller)[\s-]*(?:accessible|friendly)|車椅子[^.!?\n]{0,15}(?:利用できない|使えない|不便|難しい)|ベビーカー[^.!?\n]{0,15}(?:不便|難しい|入れない)|轮椅[^.!?\n]{0,12}(?:无法|不能|不便|困难)|无障碍[^.!?\n]{0,10}(?:没有|不足|缺)/i

// LANGUAGE_SERVICE_COMPLAINT: 외국어 안내/통역/다국어 서비스 부재 (국제 관람객 다수 지점)
//   "영어 안내 잘 돼 있어요" 같은 긍정 오탐 방지 — 부재/불통 신호 필수.
const DEFAULT_LANGUAGE_SERVICE =
  /(?:영어|중국어|일본어|외국어|다국어)[^.!?\n]{0,15}(?:안내|가이드|설명|자막|표기)?[^.!?\n]{0,10}(?:없|부족|전혀\s*안|안\s*돼|안\s*되|미비)|통역[^.!?\n]{0,10}(?:없|부족|안\s*돼)|한국어로만[^.!?\n]{0,10}(?:돼|되어|있)|(?:no|not\s+enough|lack\s+of)\s+(?:english|chinese|japanese|foreign[\s-]*language)\s+(?:guide|guidance|signage|sign|caption|subtitle|information|info|support|instruction)|staff[^.!?\n]{0,20}(?:didn[''']?t|did\s+not|couldn[''']?t|could\s+not|don[''']?t)\s+speak\s+(?:english|any\s+english)|英語[^.!?\n]{0,12}(?:案内|表記|ガイド|字幕)?[^.!?\n]{0,8}(?:な(?:い|く|かった)|通じ(?:ない|なかった|ず)|不足|困)|中文[^.!?\n]{0,10}(?:讲解|说明|指示|导览)?[^.!?\n]{0,6}(?:没有|缺|不足)|不会\s*(?:说)?\s*(?:中文|英文|英语)/i

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
  // Wave 23: 예상 리뷰 보강 — 접근성·외국어 서비스
  accessibility: RegExp; languageService: RegExp
}

const DEFAULTS: Compiled = {
  emergency:  DEFAULT_EMERGENCY,  complaint: DEFAULT_COMPLAINT, churn: DEFAULT_CHURN,
  repeat:     DEFAULT_REPEAT,     futureHope: DEFAULT_FUTURE_HOPE, sarcasm: DEFAULT_SARCASM,
  positive:   DEFAULT_POSITIVE,   question: DEFAULT_QUESTION, artwork: DEFAULT_ARTWORK,
  layout:     DEFAULT_LAYOUT,     display: DEFAULT_DISPLAY, duration: DEFAULT_DURATION, crowd: DEFAULT_CROWD,
  interactive: DEFAULT_INTERACTIVE, value: DEFAULT_VALUE,
  roomSpecific: DEFAULT_ROOM_SPECIFIC, systemComplaint: DEFAULT_SYSTEM_COMPLAINT,
  revisitComplaint: DEFAULT_REVISIT_COMPLAINT, staffComplaint: DEFAULT_STAFF_COMPLAINT,
  accessibility: DEFAULT_ACCESSIBILITY, languageService: DEFAULT_LANGUAGE_SERVICE,
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
    accessibility:   compileCategory(byCat('ACCESSIBILITY_COMPLAINT'), DEFAULT_ACCESSIBILITY),
    languageService: compileCategory(byCat('LANGUAGE_SERVICE_COMPLAINT'), DEFAULT_LANGUAGE_SERVICE),
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
      if (lm && lm !== 'the heart of the city') {  // EN DEFAULT 랜드마크 placeholder는 FP 검사 제외
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
  // Wave 23: 예상 리뷰 보강 — 접근성·외국어 서비스 (구체 개선 약속으로 '충분한 답변' 보장)
  if (C.accessibility.test(text))   { isComplaint = true; tags.push('ACCESSIBILITY_COMPLAINT') }
  if (C.languageService.test(text)) { isComplaint = true; tags.push('LANGUAGE_SERVICE_COMPLAINT') }
  // Auto-Promotion: 사람 승인(accept)된 운영/시설 불만 패턴 additive 적용 (EMERGENCY와 무관, DECISIONS #19)
  for (const { tag, re } of promotedComplaintRules()) {
    if (re.test(text)) { isComplaint = true; tags.push(tag) }
  }
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

  // fuzzy: 정확 정규식이 놓친 긍정 오탈자(awsome/amazng 등) 흡수 (긍정 보강 전용)
  // Auto-Promotion: 사람 승인된 긍정어도 additive 적용 (긍정 인식 보강 — 안전)
  const promotedPos = promotedPositiveRegex()
  // 명시적 장단점 구조("장점:…단점:", "Pros:…Cons:", "좋은 점/아쉬운 점")는 작성자가 직접 좋은 점을
  //   밝힌 '혼합' 리뷰 → 긍정 신호로 인정(아래에서 균형 답변으로 라우팅 → 과한 사과 방지).
  const prosConsStructure = /장점\s*[:：]|좋은\s*점|아쉬운\s*점|단점\s*[:：]|\bpros\s*[:：]|\bcons\s*[:：]|the\s+good\s*[:：]|the\s+bad\s*[:：]/i.test(text)
  const hasPositive = sarcasmPositive || C.positive.test(textForPositive) || fuzzyPositive(textForPositive)
                      || (promotedPos?.test(textForPositive) ?? false) || prosConsStructure
                      || COLLOQUIAL_POSITIVE.test(textForPositive)
  const isQuestion = C.question.test(text)
  if (!isComplaint && hasPositive && C.artwork.test(text)) {
    isArtworkFocused = true
    tags.push('작품감상')
  }

  // ── 최종 판정 ──────────────────────────────────────────────────────────────────
  let status: ReviewClass
  let requiresLLM: boolean
  let reason: string
  let isHybrid = false

  // 복합 의도(긍정+불만) 대비 구조 — 정직한 대조 접속(는데/지만/but/但是/pero…)이 긍정과 불만을
  // 잇는 경우 = 진짜 혼합 의도(사캐즘 아님). 사캐즘은 반어적 칭찬+불만 나열일 뿐 정직한 대조가 없다.
  // 한국어 대조 연결어미는 음절에 융합됨(멋지+ㄴ데→멋진데). 융합 형태(받침 ㄴ/ㄹ + 데)와
  // 분리 어미(지만)·접속부사(그런데/하지만)를 모두 포괄. 그 외 8개 언어는 접속사로 포착.
  const MIXED_CONTRAST =
    /지만|하지만|그렇지만|그러나|그런데|근데|반면|은데|는데|진데|쁜데|싼데|운데|른데|큰데|좋긴|훌륭한데|깔끔한데|아쉬운데|괜찮은데|though|however|\bbut\b|\byet\b|けど|けれど|だが|但是?|不过|然而|却|\bpero\b|sin\s*embargo|\bно\b|однако|لكن|ولكن|लेकिन|मगर|ngunit|\bkaso\b|subalit/i

  // ── Rating Override — 고평점(4·5점)은 EMERGENCY가 아닌 한 건설적 피드백(COMPLIMENT)으로 완화 ──
  // ratingHigh는 Layer 3.5에서 이미 선언됨

  if (isComplaint) {
    // 복합 의도 해상도(최우선): 고평점 + 긍정어 + 정직한 대조 구조(는데/but/但是…) →
    //   Hybrid(사과+긍정인정+개선) 정적 자동완료. 태그 수 무관 — "작품은 멋진데 대기가 김"(1태그)도 포함.
    //   대조 없는 반어적 칭찬+불만 나열은 사캐즘으로 보아 아래 AMBIGUOUS로 격리.
    if (ratingHigh && hasPositive && MIXED_CONTRAST.test(text)) {
      // 고평점(★4-5) + 긍정 + 정직한 대조("좋은데 ~아쉬움") → 균형 답변(AMBIGUOUS). ★4-5는 전반적
      //   만족이므로 사과로 시작하면("죄송합니다") 모순/과잉이 된다. 좋은 점 인정 + 경미 피드백 수용.
      //   isComplaint=false 로 내려 사과가 아닌 균형 답변을 조립.
      isComplaint = false
      status = 'AMBIGUOUS'
      requiresLLM = false
      reason = '고평점(4·5점) + 긍정 + 대조 구조 → 균형 답변(과잉 사과 방지)'
    } else if (ratingHigh && tags.length < 2) {
      status = 'COMPLIMENT'         // 경미 단일 불만, 대조 없음 → 건설적 피드백 완화
      requiresLLM = false
      reason = '고평점(4·5점) 건설적 피드백 — Rating Override로 완화(정적 응대)'
    } else if (ratingHigh) {
      // 고평점 + 복합 불만(대조 없음, 잠재 사캐즘 포함) → 균형 답변. ★4-5는 사과 경로로 보내지 않는다
      //   (★5+불만을 COMPLAINT로 두면 오분류 게이트가 잡고, 진성 고평점엔 과잉 사과가 된다).
      //   (과거: AMBIGUOUS인데 isComplaint=true가 남아 사과문을 조립하던 버그 → isComplaint=false.)
      isComplaint = false
      status = 'AMBIGUOUS'
      requiresLLM = false
      reason = '고평점(4·5점) + 복합 불만(대조 없음) → 균형 답변(과잉 사과 방지)'
    } else if ((rating === 3 || (rating === 2 && hasPositive)) && !isChurnRisk && !tags.includes('STAFF_COMPLAINT')) {
      // ★3(중립) 또는 ★2+긍정 본문(혼합·장단점)의 '경미' 불만 → 균형 답변(AMBIGUOUS). ★2라도 좋은 점을
      //   함께 말한 리뷰("장점: 직원 친절… 단점: 얕음")에 4블록 그루블링 사과를 달면 과하고 무례하다.
      //   ★1·★2 순수 부정·직원불만·이탈은 아래 COMPLAINT(사과) 유지.
      //   ★3(명시적 중립 평점)의 '경미' 불만 → 균형 답변(AMBIGUOUS). 중립 평점에 그루블링 사과를 달면
      //   칭찬을 무시하거나 호평한 요소(예: "에어컨 빵빵해서 힐링")까지 사과하는 무관/AI 답변이 된다.
      //   긍정어가 키워드로 안 잡혀도(서술형 칭찬 "폭포 방 진짜 물 같았어요") ★3은 본디 중립이므로
      //   균형 인정이 사과보다 안전하다. isComplaint=false 로 내려 buildStaticReply가 균형 답변을 조립.
      //   단, '심각' 불만(직원 불친절 STAFF_COMPLAINT·이탈징후)은 제외 → 제대로 된 사과(COMPLAINT) 유지.
      //   (무평점/★1-2 불만도 아래 COMPLAINT 유지 — 저평점은 실제 불만일 확률이 높음.)
      isComplaint = false
      status = 'AMBIGUOUS'
      requiresLLM = false           // reviewProcessor가 ★3은 정적 균형 답변으로 자동완료
      reason = '중립 평점(3점) + 경미 불만 → 균형 답변(과잉 사과·무관 사과 방지)'
    } else {
      status = 'COMPLAINT'          // ★1-2 또는 ★3 순수 불만(긍정 없음) → 공감 사과
      requiresLLM = true
      reason = '운영/서비스 불만 감지 → LLM 공감 사과문(STANDARD)'
    }
  } else if (hasPositive && !isQuestion) {
    if (ratingLow) {
      // ★1-2 + 긍정 본문 = 별점·본문 충돌 (미탐지 불만/혼합 뉘앙스/사캐즘 잔존 가능성)
      // 저평점 리뷰가 무승인 ai_done으로 직행하는 것을 차단 → 사람 검토 필수
      status = 'AMBIGUOUS'
      requiresLLM = true
      reason = '저평점(1·2점) + 긍정 본문 충돌 → 미탐지 불만 가능성, LLM/사람 검토 격리'
      tags.push('저평점_부정신호')
    } else {
      status = ratingHigh ? 'COMPLIMENT' : 'SAFE'
      requiresLLM = false
      reason = isArtworkFocused
        ? '작품 중심 긍정 리뷰 → 정적 템플릿(ETERNAL NATURE)'
        : ratingHigh ? '고평점 긍정 리뷰 → COMPLIMENT(정적 감사)' : '일반 긍정 리뷰 → 정적 감사 템플릿'
    }
  } else {
    status = 'AMBIGUOUS'
    requiresLLM = true
    reason = '알고리즘 확신 불가(중립/질문/모호) → LLM 위임'
  }

  // ── 별점 기반 최후 보정 — AMBIGUOUS 상태에서만 동작 ─────────────────────────────
  // (긍정 패턴 미탐지 시 별점으로 추론, 파국적 오분류 방지)
  // 단, 시설/운영 '서비스 질문'(유모차/주차/예약 등)은 답을 요구하는 리뷰이므로
  // 고평점이어도 정적 COMPLIMENT로 격상하지 않는다 → 사람/LLM이 질문에 답하도록 격리.
  const serviceQuestion = isQuestion && SERVICE_QUESTION.test(text)
  if (serviceQuestion) tags.push('질문')
  if (status === 'AMBIGUOUS') {
    if (ratingHigh && !isComplaint && !serviceQuestion) {
      // 5·4★ + 불만 없음 → COMPLIMENT 격상 (완벽/오아시스 등 신규 긍정어 미탐지 보정)
      status = 'COMPLIMENT'
      requiresLLM = false
      reason = '고평점(4·5점) 긍정 미탐지 → 별점 기반 COMPLIMENT 격상'
    } else if (serviceQuestion && !isComplaint) {
      requiresLLM = true
      reason = '리뷰 내 시설/운영 질문 감지 → 답변 필요, LLM/사람 응대 격리'
    } else if (typeof rating === 'number' && rating <= 2 && !C.positive.test(text) && !fuzzyPositive(text) && tags.length === 0) {
      // ★1-2 + 원문에 긍정 신호 전혀 없음(정확+fuzzy) + 분류 태그 없음 → COMPLAINT 격상.
      //   다국어 불만 미탐지(예: tl/hi 불만)로 AMBIGUOUS에 빠진 저평점 리뷰를 정적 사과로 회수
      //   (커버리지 확대). 긍정 본문이 있는 ★1-2는 위 저평점 게이트가 이미 AMBIGUOUS로 격리.
      isComplaint = true
      status = 'COMPLAINT'
      requiresLLM = true
      reason = '저평점(1·2점), 긍정/분류 태그 없음 → COMPLAINT 격상(정적 사과)'
      tags.push('저평점_부정신호')
    }
  }

  // 피크 시간대 언급 탐지 — 한국어 패턴 추가 (기존 EN-only → KO/EN)
  const hasPeakHours =
    /\b(?:peak|busy)\s+hours?\b/i.test(text) ||
    /평일[에에는]?\s*(?:가면|오면|방문하면|오시면|방문을\s*추천)|주말[에에는]?\s*(?:사람이?\s*많|혼잡|북적|복잡|피하|삼가)|피크\s*타임|혼잡한?\s*시간대?/i.test(text)

  // 맥락 거울: 리뷰 감성 핵심 키워드 추출 (답변 슬롯 B/E 맞춤 구성용)
  const contextMirror = extractContextMirror(text)
  // 감각/동반자/시간/공간 — 긍정 리뷰에서만 의미 (Fragment Pool 차원; 불만/긴급은 미사용)
  const sensoryFocus     = !isComplaint ? extractSensoryFocus(text) : null
  const companionContext = !isComplaint ? extractCompanion(text)    : null
  const temporalContext  = !isComplaint ? extractTemporal(text)     : null
  const spatialContext   = !isComplaint ? extractSpatial(text)      : null

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
    sensoryFocus,
    companionContext,
    temporalContext,
    spatialContext,
    isHybrid,
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

# ARCHITECTURE.md — 시스템 아키텍처 (현행 구현 기준)
> 최종 갱신: 2026-06-11 · commit `bd8dbdf` 기준 · 계획 문서가 아니라 **실제 코드가 하는 일**을 기술한다.
> 읽기 순서: `CLAUDE_CONTEXT.md` → 이 파일 → `DECISIONS.md`(설계 근거)

---

## 1. 기술 스택

| 레이어 | 기술 |
|---|---|
| Frontend | Next.js 16.2.4 (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| DB & Auth | Supabase (PostgreSQL 17, RLS) — 프로젝트 `vmrvyqqlebviaczsgapn` |
| LLM (예외 처리 전용) | OpenAI SDK 호환 — `GROQ_API_KEY ?? GEMINI_API_KEY ?? OPENAI_API_KEY` 키 존재 우선순위 |
| 배포 | Vercel (main push → 자동 배포) · cron `/api/cron/sync-all` 일 1회 |

## 2. 핵심 설계: Algorithm-First 하이브리드 게이트키퍼

LLM은 기본 엔진이 아니다. **결정론적 5-레이어 분류 + Matrix Fragment Pool 조립**이 기본이고,
LLM은 COMPLAINT/AMBIGUOUS 전용 격리 폴백이다 (출력은 항상 `pending_approval`).

```
인입 (CSV import / 수동 등록 / Google sync)
  │  5-dim SHA-256 dedup (branch|channel|author|date|cleanedText)
  ▼
WaterfallRegexEngine (5-Layer, LLM 미사용)
  Layer 0  EMERGENCY  — 부상/법적위협/환불요구/언론위협 (코드 하드코딩, DB로 약화 불가)
  Layer 1  COMPLAINT  — 11종 불만 태그 (STAFF/SYSTEM/ROOM/INTERACTIVE/VALUE/CROWD/
                         LAYOUT/DISPLAY/DURATION/REVISIT/운영불만)
  Layer 2  CHURN/Repeat — 이탈위험·재방문 신호
  Layer 3  Sarcasm    — 비꼬기 복구 (★별점 충돌 검사)
  Layer 4  Sentiment  — 긍정/질문/작품감상 + contextMirror 추출
  ▼
Rating Override & 안전 게이트 (waterfallRegexEngine.ts 최종 판정부)
  • ★4-5 + 긍정 + 대조(는데/but/但是) → Hybrid COMPLAINT 정적 자동완료 (사과+긍정인정+개선; DECISIONS #18)
  • ★4-5 + 불만태그 <2  → COMPLIMENT (건설적 피드백 완화)
  • ★4-5 + 불만태그 ≥2 (대조 없음=사캐즘) → AMBIGUOUS (LLM)
  • ★1-2 + 긍정 본문     → AMBIGUOUS (별점·본문 충돌 = 미탐지 불만 가능성, 무승인 ai_done 차단)
  • ★1-2 + 무긍정(정확+fuzzy)·무태그 → COMPLAINT 격상 (다국어 미탐지 불만 정적 사과 회수)
  • 서비스 질문(유모차/주차/예약…) → [질문] 태그 + AMBIGUOUS (정적 격상 금지, 사람이 답변)
  • 감성 신호: contextMirror + fuzzyPositive(오탈자 흡수, 긍정 보강 전용)
  ▼
reviewProcessor (3-Tier 스마트 라우팅)
  EMERGENCY            → route='manual'  건조 사과 초안 + pending_approval
  SAFE / COMPLIMENT    → route='static'  다중 슬롯 정적 답변 + ai_done (승인 불필요)
  COMPLAINT Tier 1     → route='static'  사전 검수 사과 템플릿 + ai_done
  COMPLAINT Tier 2/3   → route='manual'  독성/critical → pending_approval
  AMBIGUOUS Tier 1     → route='llm'     태그·근거 주입 프롬프트 → 항상 pending_approval
  ▼
scanForbidden Double-Check (정적/LLM 출처 무관 전수 금칙어 검사)
  환불 약속 · 법적 책임 · CCTV · 직원 징계 — 검출 시 강제 수정 플래그
  ▼
사람 승인 → 수동 게시(복사/붙여넣기 기본) → 아카이브
```

## 3. 9개 언어 네이티브 답변 엔진 (Rounds 36–44)

### 3.1 언어 타입 SSOT — `src/lib/replyLanguage.ts`
```
UI Language     = 'ko'|'en'|'ja'|'zh'            (i18n/index.ts — 화면 라벨용)
ReplyLanguage   = UI 4 + 'es'|'ru'|'ar'|'hi'|'tl' (답변 엔진 — 9개 핵심 언어)
toReplyLanguage(dbString) → ReplyLanguage         (미지원 언어 → 'ko' 폴백)
```
파일별 로컬 타입 섀도잉 금지 — 과거 per-file shadow가 모듈 경계 타입 충돌 163건을
일으켜 Vercel 빌드를 깨뜨렸다 (`50e911b`에서 SSOT로 통합).

### 3.2 Matrix Fragment Pool 조립 — `fragmentPool.ts` + `staticTemplates.ts` + `replyTemplates.ts`
고정 슬롯(A 오프닝 + B 감정/수용 + E 클로징) 사이의 **본문**을, 선형 슬롯이 아닌
**4차원 마이크로 조각 풀에서 가중치 거버너로 동적 선택(top-N pruning)**해 조립한다 (`fragmentPool.ts`).
```
COMPLIMENT/SAFE 본문 — Matrix Fragment Pool (4 dimensions):
  persona  (가족/데이트/친구/단골)  weight 9·8   [slotCompanion/slotRepeatVisitor 재사용]
  sensory  (빛/물/향/소리)          weight 10    [slotSensory 재사용]
  spatial  (포토스팟/넓은공간)       weight 6     [fragmentPool 신규]
  temporal (아침/저녁/주말)          weight 5     [fragmentPool 신규]
  selectFragments(): 가중치 내림차순 → 상위 budget개 pruning → 서사 순서 재배열.
  budget = 리뷰 길이 비례(1~3) → 신호 5개 잡혀도 적합도 상위 2~3개만 조립 (TMI 없이 다양).
  수십 개 조각 → 수천 조합 (Zero-Cost Matrix). 코드 내부 전용(프런트 UI/DB 미노출).
COMPLAINT 본문(조건부): Empathy(공감) · Tag-Pivot(13종) · Peak · Reassurance(안심)  ← 보상·약속 0
변형 선택: reviewId → 소수 해시(2,3,5,7,11,13,17,19,23,29) → KO 8 / 타언어 4·2 변형 순환
```
- **신호 추출**(`synonymEngine`): `extractSensoryFocus`·`extractCompanion`·`extractTemporal`·`extractSpatial`
  + `isRepeatVisitor` → 전부 `WaterfallResult`에 적재(COMPLIMENT 전용 계산).
- **중복 echo 차단**: `companionContext === contextMirror` 또는 spatial 포토스팟 = mirror(사진/분위기) 시 신호 생략.
- Fragment 0개(plain 리뷰) → 작품/일반 + 피크 폴백 (원래 동작 무회귀).
- 실측: 저녁+데이트+소리 → 3차원 조합 / 주말+가족+빛+넓은공간 → governor가 빛·넓은공간 선택, 주말 pruning.
- 전 조각 9개 언어 변형. 미커버 언어는 '' 반환 → governor 스킵 (WRONG_SCRIPT 방어).
- `contextMirror`(힐링/데이트/가족/생일 등) → slotB/slotE 맞춤 echo (KO/EN/JA/ZH).
- LEGAL_THREAT / COMPENSATION_DEMAND / PUNISHMENT_DEMAND 피벗은 "보고+연락 약속"만 —
  어떤 언어에서도 보상·책임 인정 문구 없음. 긴급은 공감/안심 슬롯 차단(건조 유지).

### 3.3 9개 언어 독성 필터 — `synonymEngine.sanitizeAndScoreRisk()`
COMPLAINT/AMBIGUOUS 라우팅 전 3-Tier 독성 평가 (KO + EN/JA/ZH 글로벌 딕셔너리):
- **Tier 1**(순화 → AI_DONE 허용): 비속어/슬랭을 비즈니스 언어로 치환 (가격/직원/혼잡/가치, 4개 언어).
- **Tier 2**(Critical → PENDING_APPROVAL + `risk_level:'high'`): 부상·환불요구·소송·경찰/언론 위협 (4개 언어).
  환불은 '요구/거부' 맥락만(보고화법 제외). `processReviewById`가 riskTier≥2 → risk 'high' 강제 floor.
- **Tier 3**(미지 극단 욕설): fallback 텍스트 덮어쓰기 + 격리.
- ⚠ `\b`는 라틴(EN/ES/TL)에만 — CJK/키릴/아랍/데바나가리는 평문 교차.

### 3.4 지점 토큰 팩토리 — `branchMetadata.ts`
- `{branch_name} {landmark} {highlight_room} {facility}` → `applyBranchTokens()` 일괄 치환.
- 미등록 지점 코드 → `DEFAULT_TOKENS[lang]` (9개 언어 현지화 — "our location" Konglish 제거).
- **한국어 조사 자동 보정**: 치환값 받침에 맞춰 을/를·이/가·은/는·과/와 재계산
  (영문 음독 근사 m/n/l/k/g=받침, t/d/p/b=모음화, `JONG_EXCEPTIONS`: WHALE=웨일).

## 4. 품질 검증 루프 — `scripts/deep-learning-loop.ts`

813건 합성 리뷰 (30개 언어 × 다인종/연령/시나리오) → `processReview()` 전수 통과 → 14종 검출기:

| # | 검출기 | 심각도 | 내용 |
|---|---|---|---|
| 1 | MISCLASSIFY | P0 | ★5 COMPLAINT/EMERGENCY, ★1 SAFE 등 오분류 |
| 2 | FORBIDDEN | P0 | 환불/보상/CCTV/징계/법적책임 문구 |
| 3 | LENGTH | P1-2 | TOO_SHORT / OVER_LONG / TMI(단문리뷰→장문답변) |
| 4 | TONE_MISMATCH | P1 | COMPLIMENT에 사과, COMPLAINT에 환호 |
| 5 | AI_SMELL | P1 | 언어별 상투구·중복 사과 패턴 |
| 6 | DUPLICATE | P1 | 동일 문장 반복 |
| 7 | LANG_MIX | P1 | 답변 내 언어 혼입 |
| 8 | MISSED_ECHO | P2 | 힐링/데이트/가족 키워드 미반영 |
| 9 | REPETITIVE_CLOSING | P2 | 클로징 과다 반복 (5% 동적 임계) |
| 10 | UNREPLACED_TOKEN | P0 | `{branch_name}` 등 토큰 미치환 노출 |
| 11 | WRONG_SCRIPT | P0 | 9개 언어 문자체계 검증 (한글/가나/한자/키릴/아랍/데바나가리 + ES/EN/TL 마커) |
| 12 | BRANCH_CONTAMINATION | P0 | 타 지점 도시명 혼입 |
| 13 | ARTIFACT | P1 | 빈 슬롯/이중 개행/공백 아티팩트 |
| 14 | APPROVAL_BYPASS | P0 | ★≤2 COMPLIMENT/SAFE 무승인 자동완료 |

**현재 기준선: 0/813 이슈.** 엔진/템플릿 수정 시 이 루프가 회귀 게이트다:
```bash
npx tsx scripts/deep-learning-loop.ts 2>&1 | grep "이슈 있는 리뷰:"   # 0/813 필수
```

## 5. API 라우트 (실제 구현)

| 라우트 | 역할 |
|---|---|
| `POST /api/review/generate` | 결정론적 게이트키퍼 단일 진입점 (분류→라우팅→초안) |
| `POST /api/review/bulk-process` | 청크 일괄 처리 (`processReviewById` 공통 헬퍼) |
| `POST /api/review/re-process` | 단건 재처리 |
| `POST /api/review/publish` | 게시 보조 (google→webhook→manual 폴백; 자동 게시 아님) |
| `POST /api/review/bulk-delete` | Gmail식 필터 페이로드 일괄 soft delete |
| `GET /api/review/export` | CSV 내보내기 |
| `GET/POST /api/admin/rules` | DB 규칙 CRUD (`automation_rules`/`response_templates`, 관리자) |
| `POST /api/google/sync` | 수동 "리뷰 가져오기" → 수집·적재 후 **전수 `processReviewById`** (수집분도 엔진 100% 통과) |
| `GET/POST /api/cron/sync-all` | 일간/수동 동기화 — `google/sync`와 **동일 헬퍼** `syncGoogleAccountReviews` 공유 |
| `/api/google/reply` `/api/auth/google[/callback]` | GBP 게시/인증 보조 |
| `/api/ai/generate-reply` | ⚠ 레거시 LLM 직행 경로 — 게이트키퍼 수렴 예정 |

## 6. DB (Supabase) — 적용 상태는 `CLAUDE_CONTEXT.md` §4가 SSOT

핵심 테이블: `reviews`(soft delete, 5-dim hash dedup) · `reply_drafts`(텔레메트리:
intent_code/confidence/pipeline_engine) · `activity_logs`(전 액션 감사) · `branches`(11지점) ·
`profiles`(role + assigned_branches) · `automation_rules`/`response_templates`(DB 규칙, RLS ON).

**RLS STEP B는 GATED** — `supabase/gated/rbac_rls_step_b.sql`은 백필 100% + admin 검증 +
명시적 "RLS 락 해제" 승인 전까지 적용 금지 (전 지점 staff lockout 위험).

## 7. 안전 불변식 (코드 레벨 강제 지점)

| 규칙 | 강제 위치 |
|---|---|
| 환불/보상/CCTV/징계/법적책임 금지 | `scanForbidden` Double-Check + LLM 시스템 프롬프트 + 정적 템플릿 사전 검수 |
| EMERGENCY 레이어 불변 | `waterfallRegexEngine.ts` 하드코딩 (DB 규칙은 additive only) |
| ★≤2 무승인 자동완료 차단 | Rating 게이트 (`hasPositive && ratingLow → AMBIGUOUS`) |
| 자동 공개 게시 금지 | publish 라우트는 보조 수단; 사람 승인 선행 |
| 전 액션 감사 로그 | `activity_logs` (timestamp + actor) |

## 8. 핵심 파일 지도

```
src/lib/
  replyLanguage.ts        ReplyLanguage SSOT (9개 언어 + toReplyLanguage)
  waterfallRegexEngine.ts 5-Layer 분류 + Rating/질문 게이트 + scanForbidden
  synonymEngine.ts        3-Tier Risk Dict + 독성순화 + contextMirror 추출
  reviewProcessor.ts      3-Tier 스마트 라우팅 게이트키퍼 (순수 함수)
  fragmentPool.ts         Matrix Fragment Pool (persona/sensory/spatial/temporal 4차원 + selectFragments 거버너)
  staticTemplates.ts      슬롯 변형 풀 (9개 언어 × A/B/C/D/E + Sensory/Companion/Repeat/Empathy/Reassurance + SLOT_C_PIVOTS 13종)
  replyTemplates.ts       buildStaticReply — Matrix Fragment Pool 본문 조립 + Kill-Switch
  branchMetadata.ts       지점 토큰 팩토리 + DEFAULT 9개 언어 + KO 조사 보정
  branches.ts             지점 코드 SSOT (도시명/시그니처 작품, EN 폴백)
  processReviewById.ts    admin-context 단건 처리 공통 헬퍼 (bulk/re-process/cron/sync) + 빈텍스트·rating 가드
  google/syncReviews.ts   Google 수집→적재→엔진 단일 출처 (수동 sync + cron 공유) + detectReviewLanguage(9-lang)
  rulesCache.ts           DB 규칙 인메모리 캐시 (TTL 60s)
src/services/
  filterService.ts        인입 키워드 필터 (5개 국어 위험 패턴, 보고화법 제외 처리)
  aiService.ts            국가별 문화 프로파일 + LLM 프롬프트 SSOT
scripts/
  deep-learning-loop.ts   813건 합성 리뷰 × 14종 검출기 회귀 게이트
  validate-waterfall.ts   116+ TDD 분류/슬롯 케이스 (S1~S20)
  regression-guard.ts     통합 회귀 방어 게이트 (tsc + validate-waterfall + loop, 1개라도 FAIL→차단)
```

> **회귀 방어 워크플로**: 엔진/딕셔너리/Fragment Pool 수정 후 `npx tsx scripts/regression-guard.ts`
> 실행 → "✅ SAFE TO COMMIT"면 유지·푸시, "❌ BLOCKED"면 즉시 롤백. 기존 통과 케이스를 깨는 수정 차단.

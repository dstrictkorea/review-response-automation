# CURRENT_TASK.md — Active execution context
> Updated 2026-06-15. Keep <300 lines. **No historical wave logs** (those live in git history / a slim CHANGELOG). This file answers: "What is being worked on right now, what's next, what must I not touch?"

## Current phase
**✅ EPIC COMPLETE: 답변 간결화·중복 제거·커버리지 100%·예상 리뷰 보강 (Wave 23)**

### 이번 EPIC 완료 사항 (사용자 피드백: "짧고 담백, 중복↓, 충분한 답변, 모든 리뷰에 회신")
- **중복 근본 해결** (`replyTemplates.slotHash`): 시드-소수 폴리해시가 긴 UUID에서 상쇄되어 슬롯 인덱스가
  상관 → 사실상 조합 수 급감이 중복의 진짜 원인. **FNV-1a + prime 아발란치 finalize**로 idxA/B/E 독립화.
  정적 답변 exact-dup 44.5%→**~5%**, 구조적(고유 입력) dup 32%→**~4%**.
- **길이 자동 밴드**: 불만 [85,320]자 · 칭찬 ≤360자 가드로 언어 밀도(영어 다어절 vs CJK 고밀도) 자동 흡수.
  불만 재량 라인 최대 1개(공감)·작품 echo보다 데이트/가족 개인화 우선. **평균 392→272자, TMI 42%→15%**.
- **묻지 않은 공간 설명 제거**: 신호 없는 단순 칭찬엔 작품/공간 블록 미부착(작품 직접 언급 시에만 slotC_artwork).
- **커버리지 100%** (`reviewProcessor`): AMBIGUOUS Tier1의 'llm'/빈 답변 제거. ★3+·신호 → 균형 정적 답변
  자동완료(`slotAmbiguousAck`), ★1-2·무신호 질문 → 사람 승인 격리하되 **동일 초안 제공**. 500건: 정적 456 +
  격리 44, **LLM 0**. import genStatic·status 정합 + processReviewById 동일 → 모든 리뷰가 결정론적 초안 보유.
- **모든 불만에 개선 약속**: 일반 폴백 pivot(`운영불만`·`저평점_부정신호`, 9개 언어) → 구체 태그 없어도 '충분한
  답변'. 우선순위: 구체 태그 → promoted(에어컨 등) → 일반 폴백 (구체 약속이 묻히지 않도록).
- **예상 리뷰 보강**: `ACCESSIBILITY_COMPLAINT`(휠체어/유모차/경사로)·`LANGUAGE_SERVICE_COMPLAINT`(외국어
  안내 부재) 신규 태그 + 9개 언어 pivot + 긍정 오탐 가드. validate-waterfall **S8b/S8c** 추가.
- **EMERGENCY 오탐 정밀화**(불변층 — 약화 아님): 한국어 '어지러울 정도로 아름답다'(긍정 비유) 격리 오탐 제거
  (영어 `dizzy` 가드와 동일 패턴). 실제 멀미/어지럼 distress·부상·법적위협 격리는 그대로 유지.
- **가족 echo 확대**: 손자/손녀/3대가/온 가족/할머니 등 다세대 가족 맥락 인식(MISSED_ECHO 해소).
- 검증: regression-guard ✅ (tsc 0 · validate-waterfall ALL PASS · loop **0/813**).

---

**이전 EPIC COMPLETE: 데이터 기반 미인식 패턴 발견 & Fragment 자가 승격 (Auto-Promotion Engine, Wave 22)**

### 이번 EPIC 완료 사항 (DECISIONS #19)
- **Shadow Data Mining** `scripts/data-discovery-engine.ts`: 미처리(LLM-fallback/사람 수정) 리뷰에서
  빈출 N-gram 역추출 + 다국어 토픽 앵커(에어컨/오디오가이드/락커/좌석). 내장 코퍼스 + `--csv`.
- **Auto-Promotion 제안 + Human-in-the-loop**: 임계치 초과 → [신규 정규식]+[9개 언어 조각] →
  `proposed_fragments.json`(코드 변경 X). `accept <TAG>`만 `src/lib/promotedPatterns.ts`(ADDITIVE) 병합 →
  엔진 반영(waterfallRegexEngine Layer1·긍정 / slotC_pivot 9-lang 폴백).
- **안전 불변**: ⛔ EMERGENCY 토픽(환불/부상/법적/징계) BLOCKLIST 자동 승격 차단 · ADDITIVE only ·
  accept 후 regression-guard 필수. validate-waterfall **S21**(승격 인식 + EMERGENCY 미우회) 추가.
- **실증**: discover → AC(6×)/audio(3×) 제안 → `accept FACILITY_AC_COMPLAINT` → AC 리뷰 Miss 62.5%→37.5%,
  KO/EN 토픽별 사과 자동 생성. 검증: regression-guard ✅ (tsc 0 · validate-waterfall ALL PASS · loop 0/813).
- `proposed_fragments.json`은 .gitignore (재생성 가능 임시 산출물).

---

**이전 EPIC COMPLETE: 복합 의도 수용 + 퍼지 매칭으로 자동 답변 커버리지 극대화 (Wave 21)**

### 이번 EPIC 완료 사항
- **Mixed-Intent Resolver** (DECISIONS #18): 고평점 + 긍정어 + 정직한 대조(는데/but/但是) →
  isHybrid → COMPLAINT Tier1 정적 자동완료(사과+긍정인정 slotHybridAck+개선). 과거 LLM 위임/불만 무시 해소.
  대조 없는 반어적 칭찬+불만 = 사캐즘 → AMBIGUOUS 유지(안전).
- **Fuzzy/Typo Tolerance** (synonymEngine): `levenshtein`(≤1) + `fuzzyPositive` — awsome/amazng/beatiful 등
  오탈자 흡수(부정어 가드). 한국어 활용형(멋진/예쁜)·축약·은어(굿/강추/꿀잼/넘좋) DEFAULT_POSITIVE 보강.
- **Ultra-short Auto-Done**: "굿"/"最高"/"Awesome" ≤10자 무신호 → 인사+감사 2조각 즉시 자동완료.
- **★1-2 미인식 불만 회수**: 다국어 미탐지 저평점 → COMPLAINT 정적 사과(AMBIGUOUS 보정 ★1→★1-2).
- **Coverage/Miss Rate 계측 + Round 45(100건)**: auto-done 85.1% · 의도적 격리 10.1% · Miss Rate(LLM) 4.8%.
  → 알고리즘 처리 95.2%. 오탈자/복합/초단문/은어/미인식불만 전부 자동화, 진짜 ★3 모호만 LLM.
- 검증: regression-guard ✅ (tsc 0 · validate-waterfall ALL PASS · loop **0/813**).

---

**이전 EPIC COMPLETE: Matrix-Based Fragment Pool + 9개국어 독성 필터 + 회귀 가드 (Wave 20)**

### 이번 EPIC 완료 사항
- **선형 슬롯 → 4차원 Matrix Fragment Pool** (DECISIONS #16): `src/lib/fragmentPool.ts` 신규.
  persona/sensory/spatial/temporal 차원 마이크로 조각 → `selectFragments` 가중치 거버너 top-N pruning.
  spatial(포토스팟/넓은공간)·temporal(아침/저녁/주말) 신규 차원 9개 언어. 수십 조각 → 수천 조합.
  persona/sensory는 기존 검증 슬롯 재사용(무회귀). Fragment 0개 → 작품/일반+피크 폴백.
- **9개국어 독성 필터** (DECISIONS #17): `sanitizeAndScoreRisk` EN/JA/ZH 비속어(Tier1)·법적위협/부상/환불요구(Tier2+risk high).
- **회귀 방어 게이트** `scripts/regression-guard.ts`: tsc+validate-waterfall+loop 1-커맨드, FAIL 시 차단.
- **Round 44** 30건(temporal/spatial 복합 + EN/JA/ZH 독성) → **0/813**.
- 검증: regression-guard ✅ (tsc 0 · validate-waterfall ALL PASS · loop 0/813) · next build OK.

---

**이전 EPIC COMPLETE: 실제 수집(Sync) 파이프라인에 고도화 엔진 완전 이식**

### 이번 EPIC 완료 사항
- **수집부 누락 구간 차단**: `/api/google/sync`(수동 수집)가 엔진을 호출하지 않고 `status='new'`로
  방치하던 레거시 경로 제거 → 수집 직후 전수 `processReviewById`(9-lang 슬롯 + 3-Tier Risk Routing).
- **단일 출처 헬퍼** `src/lib/google/syncReviews.ts`: 수집·적재·엔진처리 통합. 수동 sync + cron/sync-all 공유.
- **9개 언어 수집 감지** `detectReviewLanguage`(문자체계 + es/tl 기능어). 과거 ko/en 2종 한계 해소.
- **실데이터 가드(processReviewById)**: `coerceRating`(누락/문자열/범위초과 → null), 빈 텍스트는
  분류 엔진 미실행 → 비부정 정적 감사 ai_done / 저평점 건조 사과 pending_approval.
- 보너스: processReviewById가 `reviewId`를 processReview에 전달 → 수집분도 슬롯 변형 다양성 확보(과거 idx=0 고정).
- **검증**: tsc 0 · validate-waterfall ✅ ALL PASS(S20 추가) · deep-learning-loop **0/813** · next build OK.
  (※ R42 REVISIT_COMPLAINT 강화로 깨졌던 validate-waterfall S7도 '아쉽→아쉬' 조사 보정으로 복구.)

---

**이전 EPIC COMPLETE: Governed 다중 슬롯 조립 (5-슬롯 → 조건부 팔레트) — 더 다양·상황적 답변 (Rounds 42–43)**

### 이번 EPIC 완료 사항 (commits `75d68b2`…`6fb8354`)
- **5-슬롯 → governed 다중 슬롯 팔레트** (DECISIONS #15)
  - 신규 슬롯(9개 언어): `slotSensory`(빛/물/향/소리) · `slotCompanion`(가족/데이트/친구) ·
    `slotRepeatVisitor`(단골 인정) · `slotEmpathy`/`slotReassurance`(COMPLAINT, 보상·약속 0)
  - 신규 신호: `extractSensoryFocus`/`extractCompanion`(synonymEngine) → WaterfallResult.
    미활용이던 `isRepeatVisitor` 활성화
  - `buildStaticReply` governor: 리뷰 길이 비례 bodyBudget(COMPLIMENT 1~3 / COMPLAINT 재량 0~2)
    → 풍부한 리뷰=풍부한 답변, 단문=최소 (슬롯 많아도 TMI 없음)
  - 중복 echo 차단(companion===mirror 스킵), 긴급은 공감/안심 차단(건조 유지)
  - 실측: 가족+빛+재방문 → "가족 echo + 물결 감각 + 재방문 인정"을 183자 한 답변에 응축
- **버그 3건 (루프가 적발)**: "lost track of time" EMERGENCY 오탐 · 긍정 재방문 REVISIT_COMPLAINT
  오탐(→ LLM 우회) · "빛으로" 감각 미탐지. 모두 수정 + 회귀 케이스 추가
- **Round 42–43**: 신규 슬롯 검증 28건 (감각 4종·동반자·재방문·공감·부정맥락 차단·예산 상한)
- 검증: **0/813 이슈**, tsc 0, next build OK

---

**이전 EPIC COMPLETE: 다국어 딥러닝 루프 고도화 (Rounds 36–41) — 9개 핵심 언어 네이티브 답변 + 안전 게이트 + Vercel 빌드 복구**

### 이번 EPIC 완료 사항 (commits `4480507`…`bd8dbdf`)
- **9개 핵심 언어 답변 엔진 완비** (ko/en/ja/zh/es/ru/ar/hi/tl)
  - `src/lib/replyLanguage.ts` 신규 — `ReplyLanguage` 타입 + `toReplyLanguage()` SSOT.
    파일별 로컬 Language 섀도잉 전면 제거 (모듈 경계 타입충돌 163건 → 0, Vercel 빌드 복구 `50e911b`)
  - `staticTemplates.ts`: 전 슬롯 함수(A인사/사과·B감사/수용·C작품/일반·D피크·E클로징) ES/RU/AR/HI/TL 4변형씩 추가
  - `SLOT_C_PIVOTS` 13종 불만 피벗 전부 9개 언어 완비 (LEGAL/COMPENSATION/PUNISHMENT 포함 — 보상·책임 문구 0)
  - JA/ZH contextMirror echo 추가 (가족/생일/데이트/힐링), ES 인사풀 영어 혼입 변형 수정
- **안전 게이트 3종 (waterfallRegexEngine)**
  - ★1-2 + 긍정 본문 → AMBIGUOUS 격리 (저평점 무승인 ai_done 차단 — APPROVAL_BYPASS 4건 적발 후 수정)
  - 서비스 질문(유모차/주차/예약…) → `[질문]` 태그 + 고평점 COMPLIMENT 격상 차단 → 사람이 답변
  - 환불 보고화법 오탐 수정: "친구가 환불했다는 얘기" ★5 → EMERGENCY 격리 해제 (요구형은 전부 유지)
- **미등록 지점 토큰 현지화 + KO 조사 보정 (branchMetadata)**
  - `DEFAULT_TOKENS[lang]` 9개 언어 ("our location에 위치한" Konglish 제거, highlight_room='ETERNAL NATURE')
  - `applyBranchTokens(…, lang)` 한국어 조사 자동 보정: GANGNEUNG를→을, SINGAPORE이→가, FOREST을→를, WHALE를→을
    (영문 음독 근사 m/n/l/k/g=받침 + JONG_EXCEPTIONS)
- **deep-learning-loop 확장: 813건 / 30개 언어 / 14종 검출기 / 0 이슈**
  - 신규 검출기 5종: UNREPLACED_TOKEN·WRONG_SCRIPT(9개 언어 문자체계)·BRANCH_CONTAMINATION·ARTIFACT·APPROVAL_BYPASS (전부 P0/P1)
  - Round 40: ES/RU/AR/HI SLOT_C 네이티브 검증 8건 · Round 41: 적대적 16건 (저평점+긍정충돌 회귀 9개 언어, 이모지, 코드스위칭, 미등록지점, 질문, 장문 묻힌 불만)
- **branches.ts** branchCity/officialName/signatureWork → ReplyLanguage 수용, 확장 언어는 EN 고유명사 폴백

### 검증 상태
`tsc 0` · `next build 성공` · `validate-waterfall 116+ PASS` · **`deep-learning-loop 0/813`** · Vercel 자동 배포 정상

---

**이전 EPIC (완료): 3-Tier Risk Dictionary + 스마트 게이트키퍼 + RLS STEP B 언블로커**
- `synonymEngine.ts` 3-Tier Risk Dict(`sanitizeAndScoreRisk`) · `reviewProcessor.ts` INTENT_PRIORITY 10단계 + primaryIntent · COMPLAINT Tier1→AI_DONE, Tier2/3→격리 · migration 016 backfill 파일 · validate-waterfall 116 PASS
**이전 EPIC (완료): Zero-Cost NLP 모사 + 5-Slot 조립 엔진** — synonymEngine N-gram·FILLER 17패턴·contextMirror / KO 8-variant·SHORT 모드·1,024+ 조합
**이전 EPIC (완료): 레거시 청산** — `processReviewById.ts` 공통화, IntelligentOrchestrator·templateEngineService 삭제, migration 015 DROP 적용

## Just shipped (continuity only — not a log)
- `bd8dbdf` **R41**: DEFAULT 토큰 9개 언어 현지화 · KO 조사 보정 · 서비스질문 게이트 · 환불 보고화법 FP 수정 · 적대 케이스 16건
- `101b16c` **안전 게이트**: ★≤2+긍정→AMBIGUOUS (무승인 차단) + 신규 검출기 5종 (APPROVAL_BYPASS 등)
- `50e911b` **Vercel 빌드 복구**: ReplyLanguage SSOT 통합 (per-file shadow 제거, 163 type errors → 0)
- `9176488` route/processReviewById/replyTemplates 9개 언어 타입 확장
- `5e8e83d` **R40**: SLOT_C_PIVOTS 13종 × ES/RU/AR/HI/TL (813줄)
- `9c80951` **R37-39**: 사캐즘 다국어 · contextMirror JA/ZH · 힐링/데이트 echo 수정 · 0-issue 기준선

## ⏭️ Known follow-ups (intentional scope boundaries)
- **ES/RU/AR/HI/TL contextMirror echo 미구현** — 현재 generic 네이티브 풀로 폴백 (KO/EN/JA/ZH만 echo). 다음 루프 라운드 후보.
- Detail page `/reviews/[id]` + legacy `/api/ai/generate-reply`: 여전히 short/careful 변형 + 무조건 LLM → 결정론적 게이트키퍼로 수렴 필요.
- `app_settings.risk_keywords` (RLS-off 레거시) → `automation_rules` 수렴 권장.
- `risk_level` 정렬 텍스트 순(lexical) — severity ordinal 필요 (Med 잠재 버그).
- migration 016 live DB 적용 + admin role 검증 → RLS STEP B 조건 점검.

## 🔒 Active locks / blockers (read before any DB or auth work)
- **RLS STEP B is GATED.** `supabase/gated/rbac_rls_step_b.sql` must **NOT** be applied to live DB, and must NOT be moved into `supabase/migrations/`, until ALL of:
  1. `profiles.assigned_branches` backfill is **100% complete**,
  2. at least one verified **admin** role exists,
  3. user gives explicit **"RLS 락 해제"** approval.
  Applying early = global staff lockout. This is an absolute principle (phased rollout).
- App-layer branch scoping (`lib/auth/branchAccess.ts`) is the **current** enforcement; it is fail-closed (empty branches ⇒ no access) and must remain until RLS is live.

## Next candidate tasks (priority order — none started)
1. **ES/RU/AR/HI/TL contextMirror echo (High):** 가족/생일/데이트/힐링 맞춤 echo를 5개 확장 언어 slotB/slotE에 추가 → MISSED_ECHO 검출기 9개 언어로 확장 → 루프 검증.
2. **migration 016 live DB 적용 + RLS STEP B 조건 검증 (High):** Supabase MCP로 016 적용 → admin role 확인 → 빈 배열 0건 → 명시적 승인 시 STEP B.
3. **Archive the planning tree (High):** `00_`–`12_` (102 files) → `archive/` 이동 또는 `.aiignore` — 최대 토큰 낭비원.
4. **`risk_level` sort ordinal (Med):** `reviews/page.tsx` severity rank 정렬.
5. **Dashboard widget (Med):** 알고리즘 방어율(template-handled %) — `reply_drafts.pipeline_engine` 텔레메트리.
6. **`/reviews/[id]` 게이트키퍼 수렴 (Low):** short/careful 제거, `processReviewById` 단일화.

## Do NOT touch / out of scope (guardrails)
- Do NOT build: GBP/Naver/TripAdvisor **auto-posting**, full enterprise RBAC, PDF report generation, Slack/email automation, any **automatic public posting**.
- Do NOT weaken safety rules (`aiService.ts` 프로파일, `scanForbidden`, EMERGENCY 레이어, 저평점/질문 게이트).
- Do NOT treat the `00_`–`12_` planning tree as the current spec (it describes an n8n architecture that was never built).
- Do NOT add generic type helpers to Supabase query builders (TS2589). Inline the `.eq()` chains.
- Do NOT re-introduce per-file `Language` type shadows — `src/lib/replyLanguage.ts`가 유일한 출처.

## Verify & ship checklist (every change)
- [ ] `npx tsc --noEmit` = 0 errors  (there is no `npm run typecheck`)
- [ ] `npm run lint` = 0  •  [ ] `npm run build` = 0
- [ ] 엔진/템플릿 변경 시: `npx tsx scripts/deep-learning-loop.ts` → **0/813 이슈** + `validate-waterfall` ALL PASS
- [ ] DB change applied via Supabase MCP (`vmrvyqqlebviaczsgapn`) **and** committed as a `supabase/migrations/NNN_*.sql` file — update the table in `CLAUDE_CONTEXT.md` §4
- [ ] Commit + `git push origin main` **only when the user asks** → Vercel auto-deploys

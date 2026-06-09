# CURRENT_TASK.md — Active execution context
> Updated 2026-06-09. Keep <300 lines. **No historical wave logs** (those live in git history / a slim CHANGELOG). This file answers: "What is being worked on right now, what's next, what must I not touch?"

## Current phase
**✅ EPIC COMPLETE: 3-Tier Risk Dictionary + 스마트 게이트키퍼 + RLS STEP B 언블로커**

### 이번 EPIC 완료 사항
- **PHASE 1: 3-Tier Risk Dictionary & 독성 순화(Sanitization) 레이어 — `synonymEngine.ts`**
  - `RiskAssessment` 인터페이스 신규
  - `TIER1_SANITIZE` (5개 카테고리, 한국어 비속어→비즈니스 언어): 창렬/돈ㅈㄴ아깝→티켓가격, 시장통/개많음→혼잡한관람환경, 싸가지없음→직원서비스, 열받음→관람불편, 바가지→관람만족도
  - `TIER2_CRITICAL`: 특정직원지목, 아동부상근접패턴, 법적대응, 환불요구 등 Critical 즉시격리
  - `TIER3_UNKNOWN_TOXIC`: ㅅㅂ/ㄲㅈ/ㅁㅊ/씨@발 등 딕셔너리 미등록 극단 욕설 → fallback 덮어쓰기
  - `sanitizeAndScoreRisk()` export 함수 — 처리 파이프라인: Tier2→Tier1 치환→Tier3→clean
- **PHASE 2: 다중 불만 우선순위 라우터 & 스마트 게이트키퍼 — `reviewProcessor.ts`**
  - `INTENT_PRIORITY`: STAFF>SYSTEM>ROOM>INTERACTIVE>VALUE>CROWD>LAYOUT>DISPLAY>DURATION>REVISIT (10단계)
  - `extractPrimaryIntent()`: 복합 태그에서 우선순위 최상위 1개 추출
  - `ProcessDecision` 인터페이스 확장: `primaryIntent`, `riskTier`, `sanitizedText` 추가
  - COMPLAINT Tier 1 → route='static', requiresApproval=false (AI_DONE 자동화 극대화)
  - COMPLAINT/AMBIGUOUS Tier 2/3 → route='manual', requiresApproval=true (PENDING_APPROVAL 격리)
  - `waterfallRegexEngine.ts`: DEFAULT_STAFF_COMPLAINT에 `싸가지`/`직원최악`/`직원꼰대` 패턴 추가
- **PHASE 3: RLS STEP B 언블로커 — `supabase/migrations/016_assigned_branches_backfill.sql`**
  - admin role → 전 지점 배열 {AMLV,AMGN,AMDB,AMNY,AMBS,AMJJ,AMYS} 백필
  - staff role → 기본 지점 {AMLV} 백필 (관리자 UI에서 이후 교정)
  - 방어적 후처리 DO 블록 + WARNING/NOTICE 로그
- **PHASE 4: TDD 검증 116 케이스 ALL PASS, build clean**
  - S17: 복합불만(돈ㅈㄴ아깝+개많고+싸가지없음) → STAFF_COMPLAINT메인, Tier1순화, AI_DONE
  - S18: 부상+환불 → EMERGENCY(waterfall Layer0) + Tier2 sanitizer 이중 방어망 확인
  - S19: ㅅㅂㄲㅈ 미지욕설 → Tier3 fallback='말씀해주신관람불편사항', PENDING_APPROVAL
  - C1/C7 route 기대값 업데이트: 'llm' → 'static' (새 AI_DONE 행동 반영)

---

**이전 완료 EPIC: Zero-Cost NLP 모사 엔진 고도화 + 5-Slot 다지점 조립 엔진**
- **PHASE 1: Zero-Cost NLP 엔진 (waterfallRegexEngine + synonymEngine)**
  - `src/lib/synonymEngine.ts` 신규: 유의어 사전 N-gram 패턴 생성기, FILLER_PATTERN(17개 한/영 필러문장), LOW_RATING_NEGATIVE_BODY(29개 부정 신호), extractContextMirror(8개 감성 키워드)
  - `DEFAULT_CROWD` 한국어 확장: "입장 대기가 길어서 지쳤네요" 탐지 → CSV row 4 (2★) 오분류 수정
  - `DEFAULT_VALUE` 한국어 확장: "가격 대비 만족도 아쉬웠어요" → VALUE_COMPLAINT 탐지 → CSV row 15 수정
  - `DEFAULT_POSITIVE` 확장: 괜찮/힐링/몰입/감격/기대이상/재밌/신선/특별 추가
  - `NOISE_POSITIVE` → `FILLER_PATTERN` 교체: 2개 영문 패턴 → 17개 N-gram 한/영 패턴
  - `LOW_RATING_NEGATIVE_BODY` 체크 추가: Layer 3.5 — 1-2★ + 부정 본문 신호 → COMPLAINT 강제 (추천 필러 오탐 근본 차단)
  - `hasPeakHours` 한국어 확장: "평일에 가면", "주말엔 혼잡", "피크타임" 등 → CSV 기반 교정
  - `contextMirror` WaterfallResult 추가: 힐링/몰입/데이트/가족/친구/사진/감동/분위기 감성 추출
- **PHASE 2: 5-Slot 답변 조립 엔진 (staticTemplates + replyTemplates)**
  - `slotA_greeting/apology` KO: 4 → 8 variants (단어 클래식 + SHORT 캐주얼)
  - `slotB_appreciation` contextMirror 지원 + KO 8 variants (echo map 8개)
  - `slotB_acknowledgment` KO: 4 → 8 variants (SHORT 직접 수용 포함)
  - `slotE_positive` contextMirror 지원 + KO 8 variants (close map 8개)
  - `slotE_negative` KO: 4 → 8 variants
  - `buildSlotIndices` % 4 → % 8 (KO 8-variant 인덱스 활용)
  - SHORT 모드: SAFE(무평점) + 단순긍정 → Slot C 생략 → A+B+E 3슬롯 (TMI 방지)
  - 1,024+ 답변 조합 (8×8×4×4 KO 기본) × 10 태그 × 다지점 메타데이터
- **PHASE 3: TDD 검증 (validate-waterfall 82 → 98 케이스)**
  - S9: 1★ + 필러추천 꼬리 → NOT SAFE 보장
  - S10: 2★ + "입장 대기 길어서" → COMPLAINT (CROWD_COMPLAINT)
  - S11: 2★ + "가격 대비 아쉬웠어요" → COMPLAINT (VALUE_COMPLAINT)
  - S12: 한국어 hasPeakHours 탐지 (평일언급, 혼잡언급)
  - S13: 5★ + 힐링 → contextMirror='힐링' + 답변에 힐링 반영
  - S14: 4★ + 데이트 → contextMirror='데이트' + 답변에 데이트 반영
  - S15: 3★ + "괜찮았어요" → SAFE (not AMBIGUOUS)
  - S16: 무평점 단순긍정 → SHORT 모드 (Slot C 생략)
  - **ALL 98+ TESTS PASS ✅, build clean ✅**

---

**이전 완료 EPIC: 레거시 청산 + 단일 결정론적 파이프라인** — `IntelligentOrchestrator` + `templateEngineService` 완전 제거, 레거시 3개 테이블 DROP, 신규 `processReviewById` 공통 헬퍼로 전 배치 파이프라인 통합.
- **PHASE 1 ✅:** `src/lib/processReviewById.ts` 신규 — admin-context 단일 리뷰 처리. `reviewProcessor` + `WaterfallRegexEngine` 기반 결정론적 게이트키퍼. `bulk-process` / `re-process` / `cron/sync-all` 재배선 완료. `rating` 전달 → Rating Override 정상 작동.
- **PHASE 2 ✅:** 의존성 0% 검증 완료. `IntelligentOrchestrator.ts` + `templateEngineService.ts` 삭제. `i18n/index.ts` 레거시 이름 4개국어 정리. JSDoc 위생 처리.
- **PHASE 3 ✅:** `migration 015_legacy_purge.sql` — `reply_template_variants` / `intent_keywords` / `detect_review_intent()` / `review_intents` DROP. `automation_rules` + `response_templates` RLS authenticated-SELECT-only 재확인. 라이브 DB 적용 완료.
- `tsc 0 에러` · `Next.js build 전 라우트 정상` · `git 9019334` · Vercel 자동 배포 진행 중.

> 이전 DB-driven dynamic engine EPIC (migration 013–014, `rulesCache`, `/api/admin/rules` CRUD, `/settings/rules`, 시뮬레이터, AMLV 오진단 수정, Rating Override, LAYOUT/DISPLAY/DURATION/CROWD 카테고리, `validate-waterfall` 44+ 케이스) 모두 ✅.

## Just shipped (continuity only — not a log)
- **(이번)** **Risk-Based 스마트 라우팅 및 RLS 백필 완료**: `synonymEngine.ts` 3-Tier Risk Dict + `sanitizeAndScoreRisk()` · `reviewProcessor.ts` 다중 인텐트 우선순위 라우터 + 스마트 게이트키퍼(COMPLAINT Tier1→AI_DONE, Tier2/3→PENDING_APPROVAL) · `waterfallRegexEngine` DEFAULT_STAFF_COMPLAINT 슬랭 확장 · `migration 016` assigned_branches 백필 · validate-waterfall S17-S19 신규 + C1/C7 기대값 업데이트. **116 ALL PASS, build clean.**
- `4cc927a` **Zero-Cost NLP 모사 엔진**: `synonymEngine.ts` 신규(N-gram 유의어사전) · `waterfallRegexEngine` CROWD/VALUE/POSITIVE 한국어 확장 · FILLER_PATTERN 17패턴 · LOW_RATING_NEGATIVE_BODY Layer 3.5 · hasPeakHours 한국어 · contextMirror WaterfallResult 추가. `staticTemplates` KO 8-variant 확장 + contextMirror echo/close map · `replyTemplates` SHORT 모드 + 8-variant 인덱스 · validate-waterfall S9-S16 신규 케이스. ALL 98+ PASS.
- `9019334` **레거시 청산**: `processReviewById.ts` 신규 · bulk/re-process/cron 재배선 · `IntelligentOrchestrator`+`templateEngineService` 삭제 · migration 015 DROP 3 tables · RLS 재확인.
- `f5842a0` 엔진 정밀도: AMLV Strip→trip 수정 · Rating Override · LAYOUT/DISPLAY/DURATION/CROWD · `validate-waterfall` P3-1~6 · 시뮬레이터 Full Composed Preview.
- `426ad16` ingestion-time 분류 (import → classify → route; SAFE 자동 응답, LLM 미사용).
- `641b91c` deterministic `waterfallRegexEngine` + `reviewProcessor` + `POST /api/review/generate`.

## ⏭️ Known follow-ups (intentional scope boundaries)
- Detail page `/reviews/[id]` + legacy `/api/ai/generate-reply`: 여전히 short/careful 변형 + 무조건 LLM 사용 → 결정론적 게이트키퍼로 수렴 필요(별도 태스크).
- `app_settings.risk_keywords` (RLS-off 레거시 키워드 설정): `automation_rules`로 수렴 권장.
- `risk_level` 정렬이 텍스트 순(lexical) — severity 순이 아님(Med 잠재 버그): DB ordinal 또는 computed rank 필요.
- **RLS STEP B 조건 점검 필요**: migration 016 live DB 적용 후 admin role 검증, 빈 배열 0건 확인하면 STEP B 적용 가능.

## 🔒 Active locks / blockers (read before any DB or auth work)
- **RLS STEP B is GATED.** `supabase/gated/rbac_rls_step_b.sql` must **NOT** be applied to live DB, and must NOT be moved into `supabase/migrations/`, until ALL of:
  1. `profiles.assigned_branches` backfill is **100% complete**,
  2. at least one verified **admin** role exists,
  3. user gives explicit **"RLS 락 해제"** approval.
  Applying early = global staff lockout. This is an absolute principle (phased rollout).
- App-layer branch scoping (`lib/auth/branchAccess.ts`) is the **current** enforcement; it is fail-closed (empty branches ⇒ no access) and must remain until RLS is live.

## Next candidate tasks (priority order — none started)
1. **migration 016 live DB 적용 + RLS STEP B 조건 검증 (High):** `supabase db push` 또는 Supabase MCP로 migration 016 적용 → admin role 확인 → 빈 배열 0건 확인 → 명시적 "RLS 락 해제" 승인 시 STEP B 적용.
2. **Doc sync (High):** add shipped features to `docs/ARCHITECTURE.md` (migration table 016, route list, processReviewById). Slim `PROJECT_STATE.md`.
3. **Archive the planning tree (High):** mark/relocate `00_`–`12_` (102 files) as `archive/` or add `.aiignore` so scans/globs skip them. Biggest single token-waste source.
4. **`risk_level` sort (Med — latent bug):** `reviews/page.tsx` orders `risk_level` as text → severity rank needed (CASE/ordinal). Same class as date-sort bug already fixed.
5. **Dashboard widget (Med):** LLM-cost vs algorithm-defense-rate (template-handled %) using `reply_drafts.pipeline_engine` telemetry.
6. **Bulk-process progress UX (Low):** ensure progress toast + stop control exist in `ReviewsListClient.tsx`.
7. **`/reviews/[id]` + `/api/ai/generate-reply` 수렴 (Low):** short/careful 변형 제거, `processReviewById` 결정론적 게이트키퍼로 단일화.

## Do NOT touch / out of scope (guardrails)
- Do NOT build: GBP/Naver/TripAdvisor **auto-posting**, full enterprise RBAC, PDF report generation, Slack/email automation, any **automatic public posting**.
- Do NOT weaken the safety rules in `aiService.ts` country profiles (no refund/liability/CCTV/staff-punishment). See `CLAUDE_CONTEXT.md` §2.
- Do NOT treat the `00_`–`12_` planning tree as the current spec (it describes an n8n architecture that was never built).
- Do NOT add generic type helpers to Supabase query builders (TS2589). Inline the `.eq()` chains.

## Verify & ship checklist (every change)
- [ ] `npx tsc --noEmit` = 0 errors  (there is no `npm run typecheck`)
- [ ] `npm run lint` = 0  •  [ ] `npm run build` = 0
- [ ] DB change applied via Supabase MCP (`vmrvyqqlebviaczsgapn`) **and** committed as a `supabase/migrations/NNN_*.sql` file — update the table in `CLAUDE_CONTEXT.md` §4
- [ ] Commit + `git push origin main` **only when the user asks** → Vercel auto-deploys

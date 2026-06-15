# DECISIONS.md — Locked architectural decisions
> Read before changing architecture. Each entry is **LOCKED**: do not re-litigate without an explicit decision to reopen (change Status and append rationale). Updated 2026-06-11.
> Index: 1 Algorithm-First · 2 LLM Provider · 3 Supabase SSOT · 4 5-Dim Hash · 5 Google Integration · 6 Review Pipeline · 7 Branch Management · 8 Risk Classification · 9 Soft Delete · 10 RBAC Rollout · 11 DB-Driven Rules (immutable Emergency) · 12 ReplyLanguage SSOT · 13 Low-Star/Question Isolation Gates · 14 Deep-Learning Loop = Merge Gate · 15 Governed Multi-Slot Assembly · 16 Matrix Fragment Pool · 17 9-Lang Sanitization + Regression Guard · 18 Mixed-Intent Hybrid + Fuzzy Coverage · 19 Auto-Promotion Engine (human-gated)

---
## 1. Algorithm-First (template before LLM)
- **Status:** LOCKED
- **Decision:** Detect intent with pg_trgm (`detect_review_intent` RPC). If a confident, single, low-risk intent matches, fill a pre-vetted template (**LLM cost = 0**). Only fall through to an LLM when the algorithm is not confident.
- **Reason:** At hundreds–thousands of reviews, LLM-per-review is costly and non-deterministic. Templates are pre-approved → safer and auditable. "Algorithm defense rate" (% handled without LLM) is a KPI.
- **Alternatives:** (a) LLM for every review; (b) rules/templates only, no LLM.
- **Why rejected:** (a) cost + nondeterminism + harder safety guarantees; (b) can't handle novel/complex/mixed-language reviews.
- **Consequences:** Must maintain `intent_keywords` (226) + `reply_template_variants` (69) in DB. Confidence + multi-intent thresholds gate routing. Telemetry (`pipeline_engine`) records which path ran.
- **Files:** `src/lib/automation/IntelligentOrchestrator.ts`, `src/services/templateEngineService.ts`, `supabase/migrations/005_algorithm_first_pipeline.sql`.

## 2. LLM provider = OpenAI-compatible SDK, key-presence priority
- **Status:** LOCKED
- **Decision:** Use the `openai` SDK with a swappable `baseURL`. Provider chosen by which env key is set: `GROQ_API_KEY ?? GEMINI_API_KEY ?? OPENAI_API_KEY`. Default models: Groq `llama-3.3-70b-versatile`, Gemini `gemini-2.0-flash-lite`, OpenAI `gpt-4o`.
- **Reason:** One client, one code path, cheap default (Groq), trivial provider swap via env, no per-provider SDK sprawl.
- **Alternatives:** (a) native SDK per provider; (b) single hardcoded provider.
- **Why rejected:** (a) more deps/branching; (b) vendor lock-in + cost exposure.
- **Consequences:** This is **priority-by-key-presence, NOT error-failover** — setting `GROQ_API_KEY` pins Groq even if it errors. `@anthropic-ai/sdk` is in `package.json` but unused in the LLM hot paths (candidate dead dep).
- **Files:** `src/lib/automation/IntelligentOrchestrator.ts`, `src/app/api/ai/generate-reply/route.ts`, `src/services/aiService.ts`.

## 3. Supabase as Single Source of Truth
- **Status:** LOCKED
- **Decision:** All state (reviews, drafts, templates, intents, settings, profiles) lives in Supabase Postgres. Settings/templates are editable from the admin frontend. No separate backend service.
- **Reason:** One store, RLS-capable, MCP-manageable, Vercel-friendly; fits an MVP without standing infra.
- **Alternatives:** Separate API server + n8n workflow engine + LLM gateway (the `04_architecture/` planning design).
- **Why rejected:** Over-engineered for this MVP; more infra to run and secure.
- **Consequences:** **Live-DB drift is a real risk** — repo `.sql` files are not proof of what's applied; telemetry SELECTs fail silently if a migration wasn't applied (this bit us with 006). Always reconcile via `CLAUDE_CONTEXT.md` §4 or MCP `list_migrations`.
- **Files:** `supabase/*`, `src/lib/supabase/{server,admin,client}.ts`.

## 4. 5-Dimensional context hash for dedup
- **Status:** LOCKED
- **Decision:** CSV import dedup key = `SHA256(branch | channel | authorId | YYYY-MM-DD | cleanedText)`. Upsert with `onConflict: 'branch_code,channel_code,normalized_hash'` to match the **live 3-column unique index**.
- **Reason:** Re-imports must dedup, but the same text from different authors/branches/days is legitimately distinct. The onConflict target must equal the actual live index, not the (stale) single-column index described in migration 004.
- **Alternatives:** (a) hash review text only; (b) dedup on `external_review_id`.
- **Why rejected:** (a) over-dedups — collides distinct reviewers with identical short text ("좋아요"); (b) `external_review_id` is absent/unreliable for CSV sources. (This was the real cause of the ON-CONFLICT import error — not `external_review_id`.)
- **Consequences:** Google sync uses a **different** hash (polynomial of `source_review_id`) — two hashing systems coexist by design. Migration 004's single-col index comment is stale; do not trust it.
- **Files:** `src/app/(admin)/reviews/import/actions.ts`, `src/lib/importMapping.ts`.

## 5. Google integration is assistive; manual publish is primary
- **Status:** LOCKED
- **Decision:** Google sync may pull reviews; a publish route (Google API / webhook) exists but the **normal** flow is staff copying the approved reply and pasting it manually. **No automatic public posting.**
- **Reason:** Hard safety rule (human approves before anything is public) + platform ToS + MVP scope.
- **Alternatives:** Full Google Business Profile auto-reply.
- **Why rejected:** Violates "no automatic public posting"; explicitly out of MVP scope.
- **Consequences:** `/api/review/publish` is assistive, never autonomous. Naver/TripAdvisor/Klook auto-posting are NOT built.
- **Files:** `src/app/api/google/*`, `src/app/api/review/publish/route.ts`, `src/app/api/auth/google*`.

## 6. Review pipeline shape (fixed ordering)
- **Status:** LOCKED
- **Decision:** ingest → **ingestion keyword triage** → orchestrator route (algorithm/LLM) → draft → **human approve** → manual publish → archive. Ingestion triage is cheap keyword-only (no LLM); heavy processing is deferred to the orchestrator.
- **Reason:** Critical reviews must be visible & isolated the instant they land, without paying LLM cost on every imported row.
- **Alternatives:** (a) triage only inside the orchestrator; (b) LLM-based triage at ingest.
- **Why rejected:** (a) critical reviews briefly sit in the normal/auto queue; (b) LLM cost on every imported row.
- **Consequences:** Two risk passes (ingest keyword + orchestrator `floorRisk`). Critical/high at ingest → `status='pending_approval'`, isolated from any auto-publish path at the data level.
- **Files:** `src/app/(admin)/reviews/import/actions.ts`, `src/lib/automation/IntelligentOrchestrator.ts`, `src/services/filterService.ts`.

## 7. Branch management = code SSOT + DB country_code
- **Status:** LOCKED
- **Decision:** Branch codes, city names, domestic/global classification, and multi-language alias detection live in `lib/branches.ts`; the `branches` table is seeded for joins/filters and carries `country_code`. `detectBranchCode` resolves a branch from CSV column or filename; aliases are matched longest-first.
- **Reason:** Deterministic detection across 4 languages and messy CSV/file naming; longest-first ordering prevents substring collisions (e.g. `jeju` ⊂ `jejukids`).
- **Alternatives:** (a) DB-only branch lookup; (b) free-text branch field.
- **Why rejected:** (a) can't do fuzzy/alias/filename detection; (b) produces dirty, unjoinable data.
- **Consequences:** Adding a branch requires updating both `lib/branches.ts` and a seed migration. Country code drives the cultural tone profile in `aiService.ts`.
- **Files:** `src/lib/branches.ts`, `src/lib/importMapping.ts`, `supabase/migrations/007_branches_seed.sql`.

## 8. Risk classification = keyword-first, floor-only
- **Status:** LOCKED
- **Decision:** Hardcoded high-risk keywords (환불·취소·보상·고소·부상·사고·싸움·최악 …) are scanned at ingest (`scanText`). The orchestrator may **raise** risk but **never lower** it (`floorRisk`). Critical/High always require explicit human approval.
- **Reason:** The safety non-negotiables (legal/injury/refund) must be caught deterministically and can never be downgraded by a model.
- **Alternatives:** (a) LLM-only risk scoring; (b) symmetric adjustment (model may lower risk).
- **Why rejected:** (a) misses/varies on legal terms and costs tokens; (b) lowering risk defeats the safety gate.
- **Consequences:** Keyword lists currently live in `filterService.ts` (code, not DB) — known tech-debt. `risk_level` is stored as text, so naive ordering is **lexical not severity-ranked** (see CURRENT_TASK open issue #3).
- **Files:** `src/services/filterService.ts`, `src/lib/automation/IntelligentOrchestrator.ts` (`floorRisk`), `src/app/(admin)/reviews/import/actions.ts`.

## 9. Soft delete, never hard delete
- **Status:** LOCKED
- **Decision:** Deletion sets `reviews.deleted_at`; it never removes rows. Every read filters `deleted_at IS NULL`. A partial index covers active rows.
- **Reason:** Safety rule requires a full, recoverable history of reviews and replies; supports audit/archive.
- **Alternatives:** Hard `DELETE`.
- **Why rejected:** Irreversible; violates "full history is stored."
- **Consequences:** **Every** reviews query must add `.is('deleted_at', null)` — forgetting it is a recurring bug class (resurfaces deleted rows / wrong counts). Bulk-delete writes a timestamp; bulk-process and list queries all filter it.
- **Files:** `supabase/migrations/010_reviews_soft_delete.sql`, `src/app/(admin)/reviews/page.tsx`, `src/app/api/review/bulk-delete/route.ts`, `src/app/api/review/bulk-process/route.ts`.

## 10. RBAC rollout = phased, gated RLS
- **Status:** LOCKED (STEP B gated — see CURRENT_TASK lock)
- **Decision:** STEP A (`profiles.role`, `profiles.assigned_branches` columns) is applied. STEP B (RLS policies) is held in `supabase/gated/rbac_rls_step_b.sql`, deliberately **outside** `migrations/`, and is applied only after backfill is 100% complete, an admin is verified, and the user explicitly approves ("RLS 락 해제"). Until then, `lib/auth/branchAccess.ts` enforces branch scope at the app layer (fail-closed).
- **Reason:** Enabling RLS before `assigned_branches` is backfilled would lock out **all** staff globally on deploy.
- **Alternatives:** (a) ship RLS together with the column migration; (b) rely on the app-layer guard permanently.
- **Why rejected:** (a) lockout risk the moment it deploys; (b) Service-Role paths bypass app-layer checks, so DB-level RLS is needed eventually.
- **Consequences:** Two enforcement layers temporarily. Gated SQL must stay out of `migrations/` so `supabase db push` cannot apply it accidentally. An emergency-rollback SQL + backfill-verification query live alongside the gated file.
- **Files:** `supabase/migrations/009_multi_branch_rbac.sql` (STEP A), `supabase/gated/rbac_rls_step_b.sql` (STEP B, gated), `src/lib/auth/branchAccess.ts`.

## 11. DB-driven classification rules + immutable Emergency layer
- **Status:** LOCKED (PHASE 1 shipped — schema + admin API; PHASE 2 engine-wiring pending)
- **Decision:** Classification keywords/patterns + reply templates are externalized to DB (`automation_rules`, `response_templates`), loaded into an in-memory cache (`rulesCache`: TTL + invalidate-on-write) and compiled to `RegExp` at runtime (DynamicEngine). Staff edit rules via `/api/admin/rules` (admin-only) — **no code deploy**. **The EMERGENCY safety layer stays hardcoded & immutable in `waterfallRegexEngine.ts`; DB EMERGENCY rows are additive only and can never weaken or replace it.**
- **Reason:** Operational agility (new branch/country/keyword = a DB row, not a deploy) + visibility (admin sees the "word → response" mapping). Safety must survive DB corruption/tampering, so the emergency net cannot depend on DB.
- **Alternatives:** (a) keep all rules hardcoded; (b) move EVERYTHING incl. emergency to DB.
- **Why rejected:** (a) every keyword tweak needs a deploy + a developer; (b) DB tampering (e.g. via the anon key) could silently disable the safety net — unacceptable.
- **Consequences:** New tables have **RLS on** (authenticated read; writes via service-role) — safer than the older `intent_keywords`/`reply_template_variants` (RLS off — a known exposure to revisit). Overlap with legacy `app_settings.risk_keywords` + migration-005 `intent_keywords`/`reply_template_variants` → those are **legacy to converge**, not parallel SSOTs. Cache is per-serverless-instance + TTL ⇒ cross-instance propagation is eventual (≤60s).
- **Files:** `supabase/migrations/013_automation_rules.sql`, `src/lib/rulesCache.ts`, `src/app/api/admin/rules/route.ts`, `src/lib/waterfallRegexEngine.ts` (immutable emergency).

## 12. ReplyLanguage SSOT — UI 언어(4)와 답변 언어(9) 분리
- **Status:** LOCKED (2026-06-11, commits `50e911b`/`9176488`)
- **Decision:** UI `Language`(`'ko'|'en'|'ja'|'zh'`, `i18n/index.ts`)는 화면 라벨 전용으로 유지하고, 답변 엔진은 별도 `ReplyLanguage`(UI 4 + `'es'|'ru'|'ar'|'hi'|'tl'`)를 `src/lib/replyLanguage.ts` 단일 모듈에서 가져다 쓴다. DB 언어 문자열 → `toReplyLanguage()` (미지원 → `'ko'` 폴백). **파일별 로컬 `type Language = ...` 섀도잉 금지.**
- **Reason:** UI 9개 언어 번역 없이 답변만 9개 언어로 확장해야 했다. per-file shadow 방식은 모듈 경계(`processReview`, `branchOfficialName` 등)에서 i18n 타입과 충돌해 **타입 에러 163건 + Vercel 빌드 실패**를 일으켰다 — `next build`는 `scripts/**`까지 타입체크하므로 단일 출처가 필수.
- **Alternatives:** (a) i18n `Language`를 9개로 확장; (b) per-file 로컬 타입 유지; (c) `string` 사용.
- **Why rejected:** (a) UI 사전(DICT) 9개 언어 강제 — 범위 밖; (b) 실제로 빌드를 깨뜨림; (c) 타입 안전성 상실(슬롯 풀 키 누락을 컴파일이 못 잡음).
- **Consequences:** `branches.ts`의 4-언어 데이터는 확장 언어에서 **EN 고유명사 폴백**. 미등록 지점 `DEFAULT_TOKENS`는 9개 언어 현지화 + 한국어는 조사(을/를·이/가) 자동 보정(`fixKoreanJosa`, 영문 음독 근사 + `JONG_EXCEPTIONS`). 비코어 언어(de/fr/pt…)는 ko 폴백 초안 — 운영자가 번역 후 게시.
- **Files:** `src/lib/replyLanguage.ts`, `src/lib/{staticTemplates,replyTemplates,reviewProcessor,branchMetadata,branches,processReviewById}.ts`, `src/app/api/review/generate/route.ts`.

## 13. 저평점·질문 격리 게이트 (무승인 자동완료 차단)
- **Status:** LOCKED (2026-06-11, commits `101b16c`/`bd8dbdf`)
- **Decision:** ① ★1–2 + 긍정 패턴 본문 = 별점·본문 충돌 → **AMBIGUOUS 격리** (SAFE/COMPLIMENT `ai_done` 금지). ② 서비스 질문(유모차/주차/예약/할인…) 포함 리뷰는 `[질문]` 태그 + 고평점이어도 정적 COMPLIMENT 격상 차단 → LLM/사람이 답변. ③ EMERGENCY 환불 키워드는 보고 화법("환불했다는/했대/얘기")을 negative lookahead로 제외 — 요구형은 전부 유지.
- **Reason:** 루프 검출기(APPROVAL_BYPASS)가 실제 구멍 4건을 적발 — 티바 대기/락커 부족/"too commercial" 불만이 정규식 미탐지로 SAFE→무승인 자동완료되어 명랑한 감사 답변이 나갔다. 질문 리뷰는 정적 템플릿이 답을 못 하므로(시설 정보 날조 위험) 사람 응대가 유일하게 안전하다. ★5 호평이 "친구가 환불했다는 얘기" 인용만으로 EMERGENCY 격리되는 오탐도 동시 수정.
- **Alternatives:** (a) ★≤2 전부 COMPLAINT 강제; (b) 질문 무시하고 감사 답변; (c) 환불 키워드 전부 유지.
- **Why rejected:** (a) 혼합 뉘앙스 리뷰에 일률 사과문 — 부정확; (b) 직접 질문 무시는 "말도 안 되는 답변"의 대표 사례; (c) 보고 화법 오탐은 EMERGENCY 큐 신뢰도를 깎는다.
- **Consequences:** 저평점 모호 리뷰의 LLM/수동 처리량 증가(의도된 트레이드오프 — 안전 우선). `SERVICE_QUESTION` 패턴은 수사적 감탄("예쁘죠?")과 구분되어야 하므로 시설/운영 명사 기반으로만 확장할 것.
- **Files:** `src/lib/waterfallRegexEngine.ts` (rating gate, SERVICE_QUESTION, refund lookahead), `src/services/filterService.ts` (KO 환불 패턴).

## 14. deep-learning-loop 0건 = 엔진/템플릿 변경의 머지 게이트
- **Status:** LOCKED (2026-06-11)
- **Decision:** `scripts/deep-learning-loop.ts`(813건 합성 리뷰 / 30개 언어 / 14종 검출기)에서 **이슈 0건**이 waterfall/slot/필터 변경의 통과 조건이다. 새 버그를 고치면 반드시 그 버그를 재현하는 리뷰 케이스를 데이터셋에 추가한다(회귀 고정). 검출기 P0 = MISCLASSIFY·FORBIDDEN·UNREPLACED_TOKEN·WRONG_SCRIPT·BRANCH_CONTAMINATION·APPROVAL_BYPASS.
- **Reason:** 답변 품질 결함(언어 혼입, 토큰 노출, 무승인 우회, 타 지점명)은 단위 테스트로는 못 잡고 전수 조립 출력에서만 드러난다. 0건 기준선이 있어야 "수정이 다른 언어를 깨뜨렸는지"를 1커맨드로 안다.
- **Alternatives:** (a) validate-waterfall(분류 단위 테스트)만; (b) 수동 샘플 검수.
- **Why rejected:** (a) 분류는 맞아도 조립 출력이 깨지는 클래스(josa, 토큰, 슬롯 언어)를 못 본다; (b) 813×9언어 수동 검수는 불가능.
- **Consequences:** 데이터셋/검출기가 자라며 루프 실행 ~30s. `npx tsx`는 타입체크를 안 하므로 **루프 통과 ≠ 빌드 통과** — `tsc --noEmit` 별도 필수. 의도된 폴백(비코어 언어 ko 답변)은 검출기에서 명시적으로 제외해 두었다.
- **Files:** `scripts/deep-learning-loop.ts`, `scripts/validate-waterfall.ts`.

## 15. Governed 다중 슬롯 조립 (5-슬롯 → 조건부 팔레트 + 길이 비례 governor)
- **Status:** LOCKED (2026-06-11, commits `75d68b2`…`6fb8354`)
- **Decision:** 답변 조립을 고정 5-슬롯에서 **조건부 상황 본문 슬롯 팔레트**로 확장한다. 고정은 A(인사/사과)+B(감정/수용)+E(클로징)뿐이고, 사이 본문은 신호에 따라 선택: COMPLIMENT={Sensory(빛/물/향/소리)·Companion(가족/데이트/친구)·RepeatVisitor·Artwork/General·Peak}, COMPLAINT={Empathy·Tag-Pivot·Peak·Reassurance}. **Governor**가 리뷰 길이 비례 `bodyBudget`(COMPLIMENT 1~3, COMPLAINT 재량 0~2, pivot은 항상)으로 가장 상황적인 슬롯만 선택한다. 슬롯이 많아져도 답변 길이는 리뷰 풍부도에 비례할 뿐 일률적으로 늘지 않는다.
- **Reason:** "AI같고 같은말만 반복" + "TMI" 두 피드백을 동시에 해결. 더 많은 슬롯 = 특정 리뷰에 더 정확히 맞춤(라이트·미디어 아트 감각 echo, 동반자 맥락, 단골 인정) — 더 길어지는 게 아니라. 미활용이던 `isRepeatVisitor` 신호도 활성화.
- **Alternatives:** (a) 5-슬롯 유지; (b) 모든 슬롯 무조건 삽입(10-슬롯 고정); (c) LLM으로 다양성 확보.
- **Why rejected:** (a) 감각/동반자/재방문을 반영 못 함 — 제네릭; (b) 길이 폭증 = TMI, 안전 규칙 위반 위험; (c) 결정론·무비용·감사가능성 상실(DECISIONS #1).
- **Consequences:** 신규 슬롯은 전부 9개 언어 변형(미커버 언어 '' → governor 스킵, WRONG_SCRIPT 방어). 중복 echo 차단: `companionContext === contextMirror`이면 Companion 생략. 긴급은 공감/안심 슬롯 차단(건조 유지) — 안전 posture 보존. 슬롯 추가 시 deep-learning-loop 0건 필수(#14). 감각 탐지 패턴은 한국어 조사 전반 커버하되 '취향/방향' 등 오탐 회피.
- **Files:** `src/lib/synonymEngine.ts` (extractSensoryFocus/extractCompanion), `src/lib/waterfallRegexEngine.ts` (sensoryFocus/companionContext 신호), `src/lib/staticTemplates.ts` (slotSensory/slotCompanion/slotRepeatVisitor/slotEmpathy/slotReassurance), `src/lib/replyTemplates.ts` (buildStaticReply governor).

## 16. Matrix-Based Fragment Pool (선형 슬롯 → 4차원 동적 조각 조립)
- **Status:** LOCKED (2026-06-11) — #15(Governed Multi-Slot)를 일반화·대체.
- **Decision:** COMPLIMENT 본문을 고정 슬롯의 선형 연결이 아니라 **4차원 마이크로 조각 풀**(`src/lib/fragmentPool.ts`)에서 가중치 거버너(`selectFragments`)로 조립한다. 차원=persona(가족/데이트/친구/단골)·sensory(빛/물/향/소리)·spatial(포토스팟/넓은공간)·temporal(아침/저녁/주말). 신호별 가중치 내림차순 → 리뷰 길이 비례 budget(1~3)개 top-N pruning → 서사 순서 재배열. persona/sensory는 기존 검증 슬롯(slotCompanion/slotRepeatVisitor/slotSensory) 재사용, spatial/temporal은 풀 신규. **풀은 코드 내부 전용 — 프런트엔드 UI/DB 미노출.**
- **Reason:** "10개 슬롯 무식하게 이어붙이기"의 한계(조합 폭발 불가, 길이 폭증)를 깬다. 수십 조각으로 수천 자연스러운 조합 생성(Zero-Cost Matrix)하되, 거버너 pruning으로 신호 5개가 잡혀도 상위 2~3개만 조립 → 다양하되 TMI 없음.
- **Alternatives:** (a) #15 선형 슬롯 유지; (b) 모든 신호 무조건 조립; (c) LLM으로 다양성.
- **Why rejected:** (a) 새 차원 추가 시마다 ad-hoc 분기 증가; (b) 길이 폭증·TMI; (c) 결정론·무비용·감사가능성 상실(#1).
- **Consequences:** 신규 차원은 `WaterfallResult`에 신호 필드 추가(temporalContext/spatialContext) + extractor(synonymEngine). 전 조각 9개 언어(미커버 '' → governor 스킵, WRONG_SCRIPT 방어). 중복 echo 차단(companion===mirror, spatial 포토스팟=mirror 사진/분위기). Fragment 0개 → 작품/일반+피크 폴백(plain 리뷰 무회귀). 차원/조각 추가 시 regression-guard 통과 필수(#17).
- **Files:** `src/lib/fragmentPool.ts`, `src/lib/synonymEngine.ts`(extractTemporal/extractSpatial), `src/lib/waterfallRegexEngine.ts`(temporalContext/spatialContext), `src/lib/replyTemplates.ts`(buildStaticReply Fragment Pool 본문).

## 17. 9개 언어 독성 필터 + Regression Guard
- **Status:** LOCKED (2026-06-11)
- **Decision:** `sanitizeAndScoreRisk()`를 KO 단일 → KO/EN/JA/ZH 글로벌 딕셔너리로 확장. Tier1(비속어→비즈니스 언어 순화, AI_DONE 허용), Tier2(부상/환불요구/소송/경찰·언론 위협 → PENDING_APPROVAL + `risk_level:'high'` 강제), Tier3(미지 욕설 → fallback). `processReviewById`가 riskTier≥2 → risk 'high' floor. 동시에 `scripts/regression-guard.ts`로 tsc+validate-waterfall+deep-learning-loop을 1-커맨드 통합 게이트화 — 1개라도 FAIL 시 비-제로 종료(롤백 신호).
- **Reason:** 글로벌 9개 언어 리뷰에서 EN/JA/ZH 욕설·치명적 위협이 KO-only 필터를 통과하던 구멍 차단. Regression Guard는 AI 자체 고도화 루프가 기존 통과 케이스를 깨는 수정을 원천 차단(회귀 방어).
- **Alternatives:** (a) KO 필터만 유지(다른 언어는 waterfall EMERGENCY에만 의존); (b) 게이트 수동 개별 실행.
- **Why rejected:** (a) waterfall EMERGENCY는 인입 분류용 — 라우팅 직전 sanitizer 보완망이 별도로 필요(특히 욕설 순화·환불요구 격리); (b) 수동 실행은 누락 위험 — 단일 게이트가 회귀 방어를 강제.
- **Consequences:** Tier2 환불은 '요구/거부' 맥락만(보고화법 제외) → 오격리 방지. `\b`는 라틴(EN/ES/TL)에만 — CJK는 평문 교차(비ASCII 워드바운더리 버그 회피). regression-guard는 ~1~2분 소요(loop 포함). 검출기 SSOT는 여전히 #14.
- **Files:** `src/lib/synonymEngine.ts`(TIER1_SANITIZE/TIER2_CRITICAL 9-lang), `src/lib/processReviewById.ts`(riskTier floor), `scripts/regression-guard.ts`.

## 18. Mixed-Intent Hybrid + Fuzzy Coverage (자동 처리 커버리지 극대화)
- **Status:** LOCKED (2026-06-11)
- **Decision:** 자동 처리(auto-done) 커버리지를 높이기 위해 세 가지를 도입한다. (1) **Mixed-Intent Hybrid**: 고평점(★4-5) + 긍정어 + 정직한 대조 접속(는데/지만/but/但是/pero…) 동반 시 `isHybrid` → COMPLAINT Tier1 정적 자동완료(사과 A + 긍정 인정 `slotHybridAck` + 개선 pivot + 클로징). 대조 없는 반어적 칭찬+불만 나열은 사캐즘으로 보아 AMBIGUOUS(LLM) 유지. (2) **Fuzzy/Typo Tolerance**: 경량 Levenshtein(거리≤1) `fuzzyPositive`로 구별성 높은 긍정어(awesome/amazing/beautiful…) 오탈자 흡수 + 한국어 활용형(멋진/예쁜)·축약/은어(굿/강추/꿀잼) 보강. (3) **저평점 회수**: ★1-2 + 긍정(정확+fuzzy) 없음 + 태그 없음 → COMPLAINT 정적 사과(다국어 미탐지 불만 회수).
- **Reason:** 정규식 단일 감정 인식의 경직성(오탈자/복합 감정 미수용)으로 LLM/사람 대기열로 새던 리뷰를 정적 자동완료로 흡수. 측정: deep-learning-loop의 Coverage/Miss Rate(auto-done ~85% · 격리 ~10% · LLM ~5%).
- **Alternatives:** (a) ★4-5+복합불만 전부 LLM(기존); (b) 모든 불만 정적 사과; (c) 전면 퍼지(모든 패턴 Levenshtein).
- **Why rejected:** (a) 진짜 복합 의도(긍정+경미 불만)까지 LLM — 비용·지연; (b) 사캐즘/심각 불만을 무비판 자동완료 = 안전 위험; (c) 불만/긴급에 퍼지 적용 시 오탐 = 안전 위험.
- **Consequences:** 안전 경계 — fuzzy는 **긍정 보강 전용**(불만/긴급은 정확 매칭 유지) + 부정어 직후 토큰 제외. Hybrid는 ★5라도 불만 부분 사과가 정당 → 루프 검출기(5STAR_COMPLAINT/5STAR_HAS_APOLOGY)는 isHybrid 면제. ★3 진짜 모호·★5 사캐즘·★1-2+긍정충돌은 여전히 LLM/사람 격리(의도된 미스). 새 긍정어 추가 시 저평점 사캐즘 오격리 주의 — regression-guard 필수(#14/#17).
- **Files:** `src/lib/waterfallRegexEngine.ts`(MIXED_CONTRAST/isHybrid/DEFAULT_POSITIVE 확장/★1-2 회수), `src/lib/synonymEngine.ts`(levenshtein/fuzzyPositive), `src/lib/staticTemplates.ts`(slotHybridAck), `src/lib/replyTemplates.ts`(Hybrid 조립/ultra-short), `scripts/deep-learning-loop.ts`(Coverage/Miss Rate).

## 19. Auto-Promotion Engine (데이터 기반 미인식 패턴 발견 — Human-in-the-loop)
- **Status:** LOCKED (2026-06-11)
- **Decision:** 하드코딩 규칙 추가에만 의존하지 않고, 알고리즘이 자동 처리하지 못한 리뷰(LLM-fallback/사람 수정)를 마이닝해 빈출 토픽을 발견하고 규칙·조각을 **제안**한다(`scripts/data-discovery-engine.ts`). 제안은 `proposed_fragments.json`으로만 출력하고, 관리자가 `accept <TAG>` 할 때만 ADDITIVE 레지스트리 `src/lib/promotedPatterns.ts`에 병합되어 엔진(waterfallRegexEngine Layer1 / 긍정 / slotC_pivot 폴백)에 반영된다. 즉시 코드 덮어쓰기 금지.
- **Reason:** 글로벌 운영에서 신규 시설/트렌드 키워드(에어컨/오디오가이드/락커 등)가 누적되며 등장 — 사람이 일일이 찾기 어렵다. 데이터가 직접 미인식 패턴을 드러내게 하되, 자동 학습이 안전을 훼손하지 않도록 사람 승인 + 회귀 게이트를 강제.
- **Alternatives:** (a) 하드코딩만; (b) 발견 즉시 자동 병합(무인 자가수정); (c) LLM 재분류 상시.
- **Why rejected:** (a) 확장성 부족·발견 누락; (b) 사캐즘/심각 불만을 자동 학습으로 오격리/우회할 위험 — 안전 불가; (c) 비용·비결정성(DECISIONS #1).
- **Consequences (안전 불변):** ⛔ EMERGENCY 토픽(환불/부상/법적/징계)은 BLOCKLIST로 **자동 승격 불가** — 코드 하드코딩 유지(#11). 승격은 ADDITIVE only(기존 규칙 약화/대체 금지). 모든 accept 직후 regression-guard(#14/#17) 통과 필수 — FAIL이면 롤백. validate-waterfall S21이 '승격 인식 + EMERGENCY 미우회'를 상시 검증. 긍정 승격은 안전(인식 보강), 불만 승격은 라우팅(격리/정적 사과)에만 영향. `proposed_fragments.json`은 임시 산출물(.gitignore).
- **Files:** `scripts/data-discovery-engine.ts`(discover/accept), `src/lib/promotedPatterns.ts`(레지스트리), `src/lib/waterfallRegexEngine.ts`(additive 소비), `src/lib/staticTemplates.ts`(slotC_pivot 폴백), `scripts/validate-waterfall.ts`(S21).

# DECISIONS.md — Locked architectural decisions
> Read before changing architecture. Each entry is **LOCKED**: do not re-litigate without an explicit decision to reopen (change Status and append rationale). Updated 2026-06-11.
> Index: 1 Algorithm-First · 2 LLM Provider · 3 Supabase SSOT · 4 5-Dim Hash · 5 Google Integration · 6 Review Pipeline · 7 Branch Management · 8 Risk Classification · 9 Soft Delete · 10 RBAC Rollout · 11 DB-Driven Rules (immutable Emergency) · 12 ReplyLanguage SSOT · 13 Low-Star/Question Isolation Gates · 14 Deep-Learning Loop = Merge Gate

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
- **Decision:** `scripts/deep-learning-loop.ts`(655건 합성 리뷰 / 30개 언어 / 14종 검출기)에서 **이슈 0건**이 waterfall/slot/필터 변경의 통과 조건이다. 새 버그를 고치면 반드시 그 버그를 재현하는 리뷰 케이스를 데이터셋에 추가한다(회귀 고정). 검출기 P0 = MISCLASSIFY·FORBIDDEN·UNREPLACED_TOKEN·WRONG_SCRIPT·BRANCH_CONTAMINATION·APPROVAL_BYPASS.
- **Reason:** 답변 품질 결함(언어 혼입, 토큰 노출, 무승인 우회, 타 지점명)은 단위 테스트로는 못 잡고 전수 조립 출력에서만 드러난다. 0건 기준선이 있어야 "수정이 다른 언어를 깨뜨렸는지"를 1커맨드로 안다.
- **Alternatives:** (a) validate-waterfall(분류 단위 테스트)만; (b) 수동 샘플 검수.
- **Why rejected:** (a) 분류는 맞아도 조립 출력이 깨지는 클래스(josa, 토큰, 슬롯 언어)를 못 본다; (b) 655×9언어 수동 검수는 불가능.
- **Consequences:** 데이터셋/검출기가 자라며 루프 실행 ~30s. `npx tsx`는 타입체크를 안 하므로 **루프 통과 ≠ 빌드 통과** — `tsc --noEmit` 별도 필수. 의도된 폴백(비코어 언어 ko 답변)은 검출기에서 명시적으로 제외해 두었다.
- **Files:** `scripts/deep-learning-loop.ts`, `scripts/validate-waterfall.ts`.

# DECISIONS.md — Locked architectural decisions
> Read before changing architecture. Each entry is **LOCKED**: do not re-litigate without an explicit decision to reopen (change Status and append rationale). Updated 2026-06-04.
> Index: 1 Algorithm-First · 2 LLM Provider · 3 Supabase SSOT · 4 5-Dim Hash · 5 Google Integration · 6 Review Pipeline · 7 Branch Management · 8 Risk Classification · 9 Soft Delete · 10 RBAC Rollout · 11 DB-Driven Rules (immutable Emergency)

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

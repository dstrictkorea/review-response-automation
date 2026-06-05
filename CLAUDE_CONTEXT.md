# CLAUDE_CONTEXT.md — READ THIS FIRST (always)
> Single source of orientation. Updated 2026-06-04. Keep <200 lines. If reality and this file disagree, fix this file.
> Read order: **this file** → `CURRENT_TASK.md` (doing work) → `DECISIONS.md` (changing architecture) → code.

## 1. What this is
ARTE Museum **review-response automation** — internal admin tool for staff to ingest customer reviews, auto/AI-draft replies, have a **human approve**, then **manually** post. NOT a public auto-reply bot. Korean-first UI, admin-only, 4-lang content (ko/en/ja/zh). Stack: **Next.js 16.2.4** (App Router, React 19) + **Supabase** (Postgres 17, SSOT) + OpenAI-compatible LLM. Deployed on Vercel.

## 2. ⚠️ Non-negotiable safety rules (source: CLAUDE.md; enforced in `aiService.ts` country profiles)
- NEVER promise **refunds / compensation**.
- NEVER admit **legal liability / responsibility** (incl. injuries).
- NEVER mention **CCTV review**.
- NEVER promise **staff punishment / discipline**.
- High-risk reviews (legal threat, severe complaint) → **flag + require explicit human approval**.
- **EMERGENCY classification layer is hardcoded & immutable** (`waterfallRegexEngine.ts`). DB rules (`automation_rules`) are **additive only** — they can never weaken the code safety net (DECISIONS #11).
- **NO automatic public posting of any kind.** Human approves before anything is posted.
- Log every important action (register/approve/publish/archive) with **timestamp + user**.
- Out of scope (do NOT build): GBP/Naver/TripAdvisor auto-posting, RBAC beyond current, PDF reports, Slack/email automation.

## 3. Production environment (verify drift here, not by guessing)
- **Supabase project ref:** `vmrvyqqlebviaczsgapn` (ap-southeast-1). Use Supabase MCP `apply_migration` / `execute_sql` / `list_migrations`.
- **Git:** `github.com/dstrictkorea/review-response-automation`, branch **main** → push triggers **Vercel auto-deploy**. (Vercel CLI is NOT installed; deploy = `git push origin main`.)
- **Cron:** `vercel.json` → `/api/cron/sync-all` daily `0 0 * * *`.
- **LLM:** OpenAI SDK with swappable `baseURL`. Provider chosen by **which env key is set**, priority `GROQ_API_KEY ?? GEMINI_API_KEY ?? OPENAI_API_KEY` (first present wins — **NOT** failover-on-error). Models: Groq `llama-3.3-70b-versatile` / Gemini `gemini-2.0-flash-lite` / OpenAI `gpt-4o`. (`@anthropic-ai/sdk` is in deps but unused in LLM hot paths.)

## 4. 🔴 Live-DB ↔ repo migration state (the #1 rediscovery trap — keep current)
Repo `supabase/migrations/`: `001 002 003 004 005 006 007 009 010 011 012 013` (**no 008** — intentional gap; the CSV ON-CONFLICT bug was fixed in code, not a migration).
| Migration | Live? | Notes |
|---|---|---|
| 001–003 initial/channels/import | ✅ applied | baseline |
| 004 global_optimization | ⚠️ **partial** | `country_code` landed via 007; the **single-col** `normalized_hash` unique index was NOT applied. Live unique index is **3-col** `(branch_code, channel_code, normalized_hash)`. Import code uses `onConflict:'branch_code,channel_code,normalized_hash'` to match. |
| 005 algorithm_first_pipeline | ✅ applied | pg_trgm, review_intents, intent_keywords(226), reply_template_variants(69), `detect_review_intent` RPC |
| 006 review_telemetry | ✅ applied | reply_drafts: intent_code / intent_confidence / pipeline_engine |
| 007 branches_seed | ✅ applied | 11 branches w/ country_code |
| 009 multi_branch_rbac **STEP A** | ✅ applied | `profiles.role`, `profiles.assigned_branches` columns only |
| 009 RBAC **STEP B** (RLS) | ⛔ **GATED — NOT applied** | lives in `supabase/gated/rbac_rls_step_b.sql`, deliberately OUTSIDE `migrations/`. **Do NOT apply** until backfill 100% + admin verified + explicit "RLS 락 해제". See DECISIONS. |
| 010 reviews_soft_delete | ✅ applied | `deleted_at` + partial active index |
| 011 hard_delete_rpc | ✅ applied | `hard_delete_reviews(uuid[])` RPC for archive permanent delete |
| 012 hard_delete_rpc_fix | ✅ applied | fixes circular FK — NULLs `review_import_rows.review_id` instead of deleting |
| 013 automation_rules | ✅ applied | `automation_rules` + `response_templates` (DB-driven engine config). **RLS ON** (authenticated read; writes via service-role). Seeded from current engine. EMERGENCY stays **code-immutable**. |

## 5. Architecture in one screen (Algorithm-First + LLM-Fallback)
**Ingestion** (CSV import `reviews/import/actions.ts`, or Google sync) →
  • CSV: branch auto-detect (`detectBranchCode`, col/filename) + **5-dim SHA-256 hash** `branch|channel|author|YYYY-MM-DD|cleanedText`, upsert on 3-col index.
  • **Ingestion-time deterministic classification** (`reviewProcessor`→`waterfallRegexEngine`, **no LLM**): EMERGENCY/COMPLAINT/low-rating(≤2) → `pending_approval` (isolated); SAFE → `ai_done` + static STANDARD template auto-reply; AMBIGUOUS → `new`. Writes risk_level + categories(tags) + reason. (DB-driven config: `automation_rules`/`response_templates` via `rulesCache`; **PHASE 2 wires the engine to load them**; EMERGENCY layer stays code-immutable.)
**Processing** `IntelligentOrchestrator.processReview(id)` (dual routing):
  1. `scanText` (filterService) risk/safety scan → 2. `detect_review_intent` RPC (pg_trgm word_similarity) →
  3. confident single low-risk intent ⇒ **template fill (LLM cost 0)**; else ⇒ **LLM** (provider §3) →
  4. `floorRisk` (never lower risk) + `needsSecondaryReview` routing → 5. write `reply_drafts` + telemetry.
**Deterministic gatekeeper (primary):** `POST /api/review/generate` (`reviewProcessor`): SAFE→static template (LLM 0) · EMERGENCY→manual · COMPLAINT/AMBIGUOUS→LLM (algorithm tags injected, always `pending_approval`); all replies pass `scanForbidden` Double-Check. **Legacy LLM:** `/api/ai/generate-reply` + `IntelligentOrchestrator` (bulk-process). **Other:** `/api/review/{bulk-process,bulk-delete,export}`, `/api/admin/rules` (DB rule CRUD, admin-only).
**Publish:** human approves → `/api/review/publish` (Google API/webhook optional; **manual paste is the norm**). Soft delete everywhere: queries filter `deleted_at IS NULL`.

## 6. Important file locations
- **Brain:** `src/lib/automation/IntelligentOrchestrator.ts` (dual routing, provider select, floorRisk)
- **LLM prompt + country tone:** `src/services/aiService.ts` (safety rules embedded per country)
- **Risk/safety scan:** `src/services/filterService.ts` (`scanText`, keyword lists)
- **Deterministic engine:** `src/lib/waterfallRegexEngine.ts` (KO/EN layers 0–3, EMERGENCY **immutable**, `scanForbidden`) + `src/lib/reviewProcessor.ts` (gatekeeper) + `src/lib/{staticTemplates,replyTemplates}.ts` (STANDARD blocks + kill-switch) + `src/lib/rulesCache.ts` (DB rule cache, TTL+invalidate)
- **DB rule config:** `automation_rules`/`response_templates` tables · CRUD `src/app/api/admin/rules/route.ts` (admin) · validation script `scripts/validate-waterfall.ts`
- **Template fill:** `src/services/templateEngineService.ts`
- **Branch SSOT:** `src/lib/branches.ts` (DOMESTIC/GLOBAL codes, `detectBranchCode`, `classifyBranch`, `branchCity`)
- **CSV mapping:** `src/lib/importMapping.ts` · **Import+triage:** `src/app/(admin)/reviews/import/actions.ts`
- **Reviews list UI (~900 lines):** `src/app/(admin)/reviews/ReviewsListClient.tsx` (Gmail-style select, bulk process/delete)
- **Server pagination+sort:** `src/app/(admin)/reviews/page.tsx` (`?sort=date|rating|risk|status&dir=asc|desc`, whole-DB)
- **Branch guard (app-layer):** `src/lib/auth/branchAccess.ts` (`getBranchAccess`, fail-closed)
- **Migrations:** `supabase/migrations/` · **Gated RLS (do not apply):** `supabase/gated/rbac_rls_step_b.sql`
- **i18n:** `src/lib/i18n/index.ts` (DICT) + `LanguageContext`
- 🚫 **`00_`–`12_` numbered tree = HISTORICAL PLANNING/RESEARCH (102 files). NOT living spec, NOT current architecture.** Do not read as source of truth; describes an n8n design that was NOT built.

## 7. Typical workflow
1. Edit code (read `node_modules/next/dist/docs/` before any novel Next 16 API — see AGENTS.md).
2. **Verify (all must be 0):** `npx tsc --noEmit` → `npm run lint` → `npm run build`. (No `typecheck` script exists.)
3. DB change → Supabase MCP `apply_migration` on `vmrvyqqlebviaczsgapn` AND add file to `supabase/migrations/`. Never apply gated RLS.
4. Commit + `git push origin main` (only when asked) → Vercel deploys. Co-author footer per repo convention.

## 8. Common mistakes (don't repeat)
- **Bash cwd resets** to the worktree between calls → use absolute paths or `cd <path> && cmd` in one command.
- Repo migrations ≠ live DB → trust §4, or `list_migrations` via MCP. Never assume a repo `.sql` is applied.
- `(admin)` route-group parens → quote paths in PowerShell.
- Don't send thousands of IDs for bulk ops → use `isAllMatching` + filter payload (Gmail pattern).
- Don't add generic helper types in Supabase query chains → causes TS2589 "excessively deep"; inline `.eq()` chains instead.
- Provider selection is key-presence priority, not error-failover — setting `GROQ_API_KEY` pins Groq.

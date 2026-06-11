# CLAUDE_CONTEXT.md — READ THIS FIRST (always)
> Single source of orientation. Updated 2026-06-11. Keep <200 lines. If reality and this file disagree, fix this file.
> Read order: **this file** → `CURRENT_TASK.md` (doing work) → `DECISIONS.md` (changing architecture) → `ARCHITECTURE.md` (system detail) → code.

## 1. What this is
ARTE Museum **review-response automation** — internal admin tool for staff to ingest customer reviews, auto/AI-draft replies, have a **human approve**, then **manually** post. NOT a public auto-reply bot. Korean-first UI, admin-only. **UI languages: ko/en/ja/zh (i18n). Reply-engine languages: 9 — ko/en/ja/zh/es/ru/ar/hi/tl (`src/lib/replyLanguage.ts` SSOT); other languages fall back to ko draft (staff translates).** Stack: **Next.js 16.2.4** (App Router, React 19) + **Supabase** (Postgres 17, SSOT) + OpenAI-compatible LLM (exception handler only). Deployed on Vercel.

## 2. ⚠️ Non-negotiable safety rules (source: CLAUDE.md; enforced in code)
- NEVER promise **refunds / compensation**.
- NEVER admit **legal liability / responsibility** (incl. injuries).
- NEVER mention **CCTV review**.
- NEVER promise **staff punishment / discipline**.
- High-risk reviews (legal threat, severe complaint) → **flag + require explicit human approval**.
- **EMERGENCY classification layer is hardcoded & immutable** (`waterfallRegexEngine.ts`). DB rules (`automation_rules`) are **additive only** (DECISIONS #11).
- **★1–2 + positive-sounding body → AMBIGUOUS isolation** (no unapproved `ai_done`); **service questions → `[질문]` tag + isolation** (no static upgrade). Do not weaken these gates.
- **NO automatic public posting of any kind.** Human approves before anything is posted.
- Log every important action (register/approve/publish/archive) with **timestamp + user**.
- Out of scope (do NOT build): GBP/Naver/TripAdvisor auto-posting, RBAC beyond current, PDF reports, Slack/email automation.

## 3. Production environment (verify drift here, not by guessing)
- **Supabase project ref:** `vmrvyqqlebviaczsgapn` (ap-southeast-1). Use Supabase MCP `apply_migration` / `execute_sql` / `list_migrations`.
- **Git:** `github.com/dstrictkorea/review-response-automation`, branch **main** → push triggers **Vercel auto-deploy**. (Vercel CLI is NOT installed; deploy = `git push origin main`.)
- **⚠ `next build` type-checks `scripts/**` too** (tsconfig includes `**/*.ts`) — a type error in `scripts/deep-learning-loop.ts` breaks the Vercel deploy. `npx tsx` does NOT type-check; always run `npx tsc --noEmit` before push.
- **Cron:** `vercel.json` → `/api/cron/sync-all` daily `0 0 * * *`.
- **LLM:** OpenAI SDK with swappable `baseURL`. Provider chosen by **which env key is set**, priority `GROQ_API_KEY ?? GEMINI_API_KEY ?? OPENAI_API_KEY` (first present wins — **NOT** failover-on-error). Models: Groq `llama-3.3-70b-versatile` / Gemini `gemini-2.0-flash-lite` / OpenAI `gpt-4o`.

## 4. 🔴 Live-DB ↔ repo migration state (the #1 rediscovery trap — keep current)
Repo `supabase/migrations/`: `001–007, 009–016` (**no 008** — intentional gap; CSV ON-CONFLICT bug was fixed in code).
| Migration | Live? | Notes |
|---|---|---|
| 001–003 initial/channels/import | ✅ applied | baseline |
| 004 global_optimization | ⚠️ **partial** | `country_code` via 007; single-col hash index NOT applied — live unique index is **3-col** `(branch_code, channel_code, normalized_hash)`; import code matches |
| 005 algorithm_first_pipeline | ✅ applied | pg_trgm + intents/keywords/templates + RPC (legacy tables since dropped by 015) |
| 006 review_telemetry | ✅ applied | reply_drafts: intent_code / intent_confidence / pipeline_engine |
| 007 branches_seed | ✅ applied | 11 branches w/ country_code |
| 009 RBAC **STEP A** | ✅ applied | `profiles.role`, `profiles.assigned_branches` columns only |
| 009 RBAC **STEP B** (RLS) | ⛔ **GATED — NOT applied** | `supabase/gated/rbac_rls_step_b.sql`, deliberately OUTSIDE `migrations/`. Apply only after backfill 100% + admin verified + explicit "RLS 락 해제" |
| 010 reviews_soft_delete | ✅ applied | `deleted_at` + partial active index |
| 011–012 hard_delete_rpc(+fix) | ✅ applied | archive permanent delete RPC |
| 013–014 automation_rules (+phase2) | ✅ applied | `automation_rules`/`response_templates`, RLS ON, engine loads via `rulesCache` (TTL 60s). EMERGENCY stays code-immutable |
| 015 legacy_purge | ✅ applied | DROP review_intents / intent_keywords / reply_template_variants / detect_review_intent |
| 016 assigned_branches_backfill | ⚠️ **file only** | live 적용 + admin 검증은 next task (RLS STEP B 전제조건) |

## 5. Architecture in one screen (Algorithm-First + LLM-Fallback) — detail: `ARCHITECTURE.md`
**Ingestion** (CSV import w/ branch auto-detect + **5-dim SHA-256** dedup on 3-col index, or Google sync) → **deterministic classification at ingest** (no LLM).
**Classification** `waterfallRegexEngine` 5 layers: EMERGENCY(0, immutable) → COMPLAINT(1, 11 tags) → CHURN/Repeat(2) → Sarcasm(3) → Sentiment(4, contextMirror) + gates: ★4-5+tags<2→COMPLIMENT · ★4-5+tags≥2→AMBIGUOUS · **★1-2+positive→AMBIGUOUS** · **service question→`[질문]`+AMBIGUOUS** · refund reported-speech excluded from EMERGENCY.
**Routing** `reviewProcessor` (3-Tier): SAFE/COMPLIMENT→static `ai_done` (LLM 0) · COMPLAINT Tier1→static apology `ai_done` · Tier2/3→manual isolation · AMBIGUOUS Tier1→LLM (tags injected, always `pending_approval`) · EMERGENCY→manual. All replies pass `scanForbidden` Double-Check.
**Reply assembly** `buildStaticReply` 5-slot (A/B/C/D/E) × 9 languages × reviewId-hash variants (KO 8, others 4) + SHORT mode (≤40-char reviews) + contextMirror echo (KO/EN/JA/ZH) + `SLOT_C_PIVOTS` 13 complaint pivots × 9 langs + branch tokens w/ localized DEFAULT + **KO josa auto-correction**.
**Quality gate** `scripts/deep-learning-loop.ts`: 655 synthetic reviews / 30 langs / **14 detectors** (incl. WRONG_SCRIPT, UNREPLACED_TOKEN, APPROVAL_BYPASS, BRANCH_CONTAMINATION) — **0/655 is the merge bar** for engine/template changes.
**Publish:** human approves → `/api/review/publish` (assistive; **manual paste is the norm**). Soft delete everywhere.

## 6. Important file locations
- **Language SSOT:** `src/lib/replyLanguage.ts` (`ReplyLanguage` 9 langs + `toReplyLanguage`) — **never re-create per-file Language shadows**
- **Deterministic engine:** `src/lib/waterfallRegexEngine.ts` (5 layers, gates, `scanForbidden`, EMERGENCY immutable) + `src/lib/reviewProcessor.ts` (3-Tier gatekeeper) + `src/lib/synonymEngine.ts` (risk dict, sanitizer, contextMirror)
- **Reply assembly:** `src/lib/staticTemplates.ts` (slot pools 9 langs, ~2,900 lines — grep, don't read whole) + `src/lib/replyTemplates.ts` (buildStaticReply) + `src/lib/branchMetadata.ts` (tokens, DEFAULT 9 langs, josa fixer) + `src/lib/branches.ts` (city/signature, EN fallback)
- **Single-review processing:** `src/lib/processReviewById.ts` (admin-context; bulk/re-process/cron 공통) · API gatekeeper `src/app/api/review/generate/route.ts`
- **Inbound filter:** `src/services/filterService.ts` (5-lang hardcoded rules; KO refund excludes reported speech) · **LLM prompt:** `src/services/aiService.ts`
- **DB rules:** `automation_rules`/`response_templates` + `src/lib/rulesCache.ts` + `/api/admin/rules`
- **Quality loops:** `scripts/deep-learning-loop.ts` (655×14 detectors, ~4,000 lines — grep by scenario/Round) · `scripts/validate-waterfall.ts` (116+ TDD)
- **Reviews list UI (~900 lines):** `src/app/(admin)/reviews/ReviewsListClient.tsx` · server sort `page.tsx`
- **Branch guard (app-layer):** `src/lib/auth/branchAccess.ts` (fail-closed) · **Gated RLS (do not apply):** `supabase/gated/rbac_rls_step_b.sql`
- **i18n (UI only, 4 langs):** `src/lib/i18n/index.ts`
- 🚫 **`00_`–`12_` numbered tree = HISTORICAL PLANNING (102 files). NOT living spec** (describes an n8n design never built).

## 7. Typical workflow
1. Edit code (read `node_modules/next/dist/docs/` before any novel Next 16 API — see AGENTS.md).
2. **Verify (all must pass):** `npx tsc --noEmit` → `npm run lint` → `npm run build` → engine/template changes also need `npx tsx scripts/deep-learning-loop.ts` = **0/655** and `validate-waterfall` ALL PASS.
3. DB change → Supabase MCP `apply_migration` on `vmrvyqqlebviaczsgapn` AND add file to `supabase/migrations/`. Never apply gated RLS. Update §4 table.
4. Commit + `git push origin main` (only when asked) → Vercel deploys. Co-author footer per repo convention.

## 8. Common mistakes (don't repeat)
- **Bash cwd resets** to the worktree between calls → use absolute paths or `cd <path> && cmd` in one command.
- Repo migrations ≠ live DB → trust §4, or `list_migrations` via MCP.
- **`npx tsx` runs without type-checking** — a script can "work" locally yet break `next build` on Vercel. Always `tsc --noEmit`.
- `(admin)` route-group parens → quote paths in PowerShell.
- Don't send thousands of IDs for bulk ops → use `isAllMatching` + filter payload (Gmail pattern).
- Don't add generic helper types in Supabase query chains (TS2589); inline `.eq()` chains.
- Provider selection is key-presence priority, not error-failover — setting `GROQ_API_KEY` pins Groq.
- `\b` word boundary is ASCII-only — NEVER use with Devanagari/Arabic/CJK patterns (use context anchors instead).
- Slot variant pools: every variant in a language pool must BE that language (an EN string in the `es:` pool shipped once — caught in R41).

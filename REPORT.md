# REPORT.md — Repository & Context-Efficiency Audit
> Generated 2026-06-04 · read-only analysis of actual code (not doc claims) · no code modified
> Repo: `dstrictkorea/review-response-automation` · App: Next.js 16 App Router + Supabase + LLM
> **Status 2026-06-05:** recommended doc architecture adopted (`CLAUDE_CONTEXT.md` = first read). Since the audit, shipped: deterministic `WaterfallRegexEngine` + hybrid pipeline, ingestion-time classification, archive/safe-hard-delete, reason display + rating-aware triage + CSV export. DB-driven dynamic rules engine PHASE 1 (migration 013 + `/api/admin/rules`) done.
> **Status 2026-06-11:** audit recommendations #1/#3/#5 done (`CLAUDE_CONTEXT.md` first-read 정착, migration table 유지, `ARCHITECTURE.md`/`OPERATIONAL_GUIDE.md` 신설). Since then shipped: DB rules PHASE 2–4 (engine wiring + `/settings/rules` + simulator), 3-Tier risk routing, legacy purge (migration 015, IntelligentOrchestrator/templateEngineService 삭제 — §1.2/§2의 해당 행은 역사 기록), **9-language reply engine (`replyLanguage.ts` SSOT) + deep-learning loop 655×14 detectors = merge gate (0 issues)**, low-star/question isolation gates, Vercel build 복구. **Remaining from this audit:** #2 planning-tree archive (102 files — 최대 토큰 낭비원), `PROJECT_STATE.md` slimming, `risk_level` ordinal sort. See `CURRENT_TASK.md`.

---

## 0. Executive Summary

The application code is healthy (tsc/eslint/build all pass; production-deployed). The **context-efficiency problem is documentation, not code**:

1. **102 of 110 tracked `.md` files are a frozen planning/research tree** (`00_`–`12_`) that outnumbers the 66 source files ~1.5:1. Every broad scan/glob pays for them.
2. **Living state is split across 3 places** — `PROJECT_STATE.md` (wave logs), `docs/ARCHITECTURE.md`, and the live DB — with no single "read this first" entry point.
3. **Repo ↔ live-DB schema drift** is the single biggest recurring rediscovery: which migrations are actually applied can only be learned by querying Supabase via MCP. Claude re-derives this every session.
4. **Recent features (Waves after ~15) are under-documented**: bulk-process, ingestion triage, sort fix, CSV branch auto-detect, soft-delete UI exist in code but not in `PROJECT_STATE.md`.

The four new files (`CLAUDE_CONTEXT.md`, `CURRENT_TASK.md`, `DECISIONS.md`, this `REPORT.md`) collapse rediscovery to a single <200-line read.

---

## 1. Documentation Accuracy Audit

### Features in code but missing/stale in `PROJECT_STATE.md`
| Severity | Location | Finding | Recommended fix |
|---|---|---|---|
| High | `src/app/api/review/bulk-process/route.ts` | Chunked bulk auto-process (dual-routing orchestrator, self-advancing) — not in PROJECT_STATE | Add to a slim CHANGELOG; remove verbose wave logs |
| High | `src/app/(admin)/reviews/import/actions.ts` (triage block) | Ingestion-time keyword risk triage (critical/high → `pending_approval`) — undocumented | Document in `DECISIONS.md` (done) |
| High | `src/lib/branches.ts` `detectBranchCode` + `import/page.tsx` | CSV/filename branch auto-detection — undocumented | Document in ARCHITECTURE ingestion section |
| Med | `src/app/(admin)/reviews/page.tsx` (sort) | Server-side whole-DB sort via `?sort/&dir` — undocumented | Note in ARCHITECTURE |
| Med | `src/app/api/review/bulk-delete/route.ts` | Filter-payload bulk soft-delete — undocumented | Note in ARCHITECTURE |
| Med | `src/lib/auth/branchAccess.ts` | App-layer branch guard — partially documented | Cross-ref in DECISIONS |

### Features documented but not (fully) implemented
| Severity | Location | Finding | Recommended fix |
|---|---|---|---|
| High | `04_architecture/ARCH_04_N8N_WORKFLOWS.md` etc. | The planning tree describes an **n8n + LLM-gateway + reporting-engine** architecture that was NOT built; the app is a Next.js+Supabase monolith with the orchestrator in-process | Mark planning tree as `ARCHIVE/` (historical), not living spec |
| Med | Planning docs reference TripAdvisor/Naver/Klook auto-posting | Code only implements Google GBP API + generic webhook + manual fallback | Clarify in ARCHITECTURE "implemented channels" |
| Med | Monthly report / PDF reporting (`11_reporting/`) | Not implemented in `src/` | Mark out-of-scope in CURRENT_TASK |

### Migrations / schema drift (CRITICAL)
| Severity | Finding | Detail |
|---|---|---|
| Critical | **Repo migrations ≠ live DB** | Live applied (verified via MCP this session): 001–003, 005, 006, 007, 010, + `profiles.role/assigned_branches`. **004 only partially** (country_code via 007 safety-net; single-col hash index never applied → code uses 3-col `onConflict`). **009 STEP B (RLS) deliberately NOT applied** (gated). |
| High | **Migration `008` does not exist** | Numbering gap. The "ON CONFLICT" CSV bug was fixed in code (onConflict → 3-col index) after diagnosing it was `normalized_hash`, NOT `external_review_id`. Gap is intentional but confusing. |
| High | RLS DDL lives outside `migrations/` | `supabase/gated/rbac_rls_step_b.sql` is intentionally excluded from `supabase db push` to prevent accidental staff lockout. |

### Incorrect implementation assumptions found in docs/code comments
- `004_global_optimization.sql` comment claims a single-col `reviews_normalized_hash_unique` index that is **not in the live DB**; the live unique index is 3-col `reviews_branch_code_channel_code_normalized_hash_key`. Import code correctly targets the 3-col index.
- Two hashing systems coexist: CSV import = 5-dim SHA-256; Google sync = polynomial hash of `source_review_id`. Not documented together.

### Missing API documentation
No API contract doc reflects the **actually-implemented** routes. Real routes: `/api/ai/generate-reply`, `/api/review/{publish,re-process,bulk-delete,bulk-process}`, `/api/google/{sync,reply}`, `/api/auth/google[/callback]`, `/api/auth/signout`, `/api/cron/sync-all`. (The `04_architecture/ARCH_03_API_CONTRACTS.md` describes a different, planned API.)

---

## 2. Context Rediscovery Audit

| Repeatedly rediscovered | Why Claude must re-derive it | Est. token waste / session | Permanent home |
|---|---|---|---|
| **Which migrations are applied to live DB** | Only knowable by Supabase MCP queries; repo files ≠ live | 3–8k (MCP round-trips + reasoning) | `CLAUDE_CONTEXT.md` → "Production Environment" |
| **Pipeline routing (algorithm vs LLM) + risk floor** | Spread across `IntelligentOrchestrator.ts`, `templateEngineService.ts`, `aiService.ts`, `filterService.ts` | 5–10k (4-file read) | `DECISIONS.md` + ARCHITECTURE flow |
| **Branch code taxonomy & grouping rules** | `lib/branches.ts` + DB `country_code` + planning `APPENDIX_01` | 2–4k | `DECISIONS.md` (Branch Management) |
| **Safety rules (no refund/CCTV/legal/staff)** | `CLAUDE.md` + `aiService` prompt + `03_policies/` tree | 2–5k | `CLAUDE_CONTEXT.md` → "Core Business Rules" |
| **RLS gating status & rollout order** | Only in commit messages + `supabase/gated/` header | 3–6k | `DECISIONS.md` (RBAC Rollout) |
| **5-dim hash + onConflict target** | `import/actions.ts` comments + live index name | 2–4k | `DECISIONS.md` (5-D Hashing) |
| **Which planning docs are live vs archive** | No marker; must infer 00-12 is historical | 5–15k (if Claude reads them) | `CLAUDE_CONTEXT.md` → "Important File Locations" |
| **Verify/commit workflow (tsc+lint+build, push main→Vercel)** | Implicit from history | 1–2k | `CLAUDE_CONTEXT.md` → "Typical Workflow" |
| **Build/commit env quirks** (cwd resets to worktree; PowerShell vs Bash; LF→CRLF) | Learned by trial | 2–4k | `CLAUDE_CONTEXT.md` → "Common Mistakes" |

**Business rules requiring source analysis:** risk-floor calculation (`floorRisk`), `needsSecondaryReview` conditions, confidence/multi-intent thresholds (`CONFIDENCE_THRESHOLD=0.50`, `MULTI_INTENT_GAP=0.12`), branch-detection alias priority — all in `DECISIONS.md` now.

---

## 3. Token Consumption Audit (ranked)

| Rank | Cause | Why | Mitigation |
|---|---|---|---|
| **Critical** | 102-file planning/research tree mixed with code | Globs/`Explore`/grep sweep them; tempting to read as spec | Move `00_`–`12_` to `archive/` or `.aiignore`; mark non-living |
| **Critical** | Live-DB drift rediscovery | No file records applied-migration state | `CLAUDE_CONTEXT.md` "Production Environment" table |
| **High** | Architecture re-analysis across 4 service files | No single pipeline diagram tied to real files | ARCHITECTURE §7 exists but verbose; `DECISIONS.md` summarizes |
| **High** | `PROJECT_STATE.md` wave-log accretion (Waves 1–16) | Long history; current priorities buried | Replace history with `CURRENT_TASK.md` + slim CHANGELOG |
| **Med** | Large client components re-read | `ReviewsListClient.tsx` ~900 lines, `SettingsClient.tsx`, detail page | Note key files + responsibilities in CLAUDE_CONTEXT |
| **Med** | Decision re-litigation (RLS, soft-delete, hashing) | No locked-decision registry | `DECISIONS.md` (this audit) |
| **Low** | Dead/duplicate prompt copies | Templates exist in DB (005 seed), `08_templates/`, and `aiService` | Single SSOT = DB `reply_template_variants` |

---

## 4. Recommended Documentation Architecture

**Read order for any future session:** `CLAUDE_CONTEXT.md` (always) → `CURRENT_TASK.md` (if doing work) → `DECISIONS.md` (before changing architecture) → code.

| File | Contains | Never contains |
|---|---|---|
| `CLAUDE_CONTEXT.md` | <200 lines: summary, prod env, live-DB state, safety rules, locked arch, file map, workflow, pitfalls | Wave history, long prose, code dumps |
| `CURRENT_TASK.md` | <300 lines: current phase, priorities, blockers, next tasks, ignore-list | Completed milestones, history |
| `DECISIONS.md` | Locked architectural decisions + rationale + files affected | Task status |
| `PROJECT_STATE.md` | **Slim to:** North Star, a short CHANGELOG (1 line/wave), 🔴 open issues table | Per-wave verbose logs (move to git history) |
| `docs/ARCHITECTURE.md` | Schema, pipeline diagram, route list — kept current | Decision rationale (→ DECISIONS) |
| `00_`–`12_` tree | Historical planning — **prefix `archive/` or add `.aiignore`** | Treated as living spec |

**Should be REMOVED from `PROJECT_STATE.md`:** all per-wave verbose logs (Waves 1–16 prose), duplicated drift notes.
**Should REMAIN in `PROJECT_STATE.md`:** North Star, the live-DB drift table (or move to CLAUDE_CONTEXT), 🔴 open-issues table.
**Never duplicate:** safety rules (CLAUDE.md is source), pipeline thresholds (code is source; DECISIONS references), applied-migration state (CLAUDE_CONTEXT is the one human-maintained mirror).

---

## 5. Top 5 Fixes (highest efficiency ROI)
1. Adopt `CLAUDE_CONTEXT.md` as the mandatory first read (this audit creates it).
2. Mark/relocate the `00_`–`12_` planning tree as archive so scans skip it.
3. Maintain the applied-migration table in `CLAUDE_CONTEXT.md` whenever a migration is applied to live.
4. Slim `PROJECT_STATE.md` to North Star + CHANGELOG + open issues.
5. Keep `docs/ARCHITECTURE.md` route list + pipeline diagram in sync on each feature (1 line each).

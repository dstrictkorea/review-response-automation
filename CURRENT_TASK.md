# CURRENT_TASK.md — Active execution context
> Updated 2026-06-04. Keep <300 lines. **No historical wave logs** (those live in git history / a slim CHANGELOG). This file answers: "What is being worked on right now, what's next, what must I not touch?"

## Current phase
**✅ EPIC COMPLETE: DB-driven dynamic rules engine** — hardcoded regexes externalized to DB; CS staff edit rules with no deploy. **EMERGENCY layer stays hardcoded immutable** (DECISIONS #11).
- **PHASE 1 ✅:** `automation_rules` + `response_templates` (migration 013, RLS on, seeded) + `rulesCache.ts` (TTL 60s + `invalidateRulesCache()`) + `GET/POST/DELETE /api/admin/rules` (admin CRUD, regex validity, cache invalidation, activity-logged).
- **PHASE 2 ✅:** `waterfallRegexEngine` = DynamicEngine — `DEFAULT_*` immutable baseline + `applyRulesBundle()` compiles DB rules at runtime; `refreshEngineFromDB()` (dynamic import keeps admin client off the static graph) called once/request in import + generate; `analyzeReview` stays sync (snapshots COMPILED). EMERGENCY = base ∪ DB (additive, proven immutable). DB-compile validation passes.
- **PHASE 3 ✅:** `/settings/rules` (admin) — rules + templates CRUD (inline) + **simulation** (`/api/admin/rules/simulate`: forces reload → real engine classify). Sidebar `nav_rules` (admin-only).
- **PHASE 4 ✅:** cache invalidation on every write (same-instance immediate, cross-instance ≤60s); simulate endpoint + `validate-waterfall.ts` verify edited rules reflect in the engine + TDD cases pass.

> 🔴 PENDING (승인됨 Option A, 미완): **레거시 테이블 청산** — `bulk-process`/`re-process`/`cron/sync-all`을 신규 게이트키퍼(`reviewProcessor`)로 재배선해 `IntelligentOrchestrator`+`templateEngineService`를 미사용화한 뒤 `intent_keywords`/`review_intents`/`reply_template_variants` DROP + RLS 강화. (현재 이 3개 테이블이 templateEngine의 `detect_review_intent` RPC 경유로 **실사용 중** → 선(先)리팩토링 필수. tsc/build는 untyped 클라이언트라 DROP 시 깨짐을 못 잡으니 주의.)
> Follow-ups: simulate UNSAVED edits (currently saved-then-simulate); converge legacy keyword stores onto `automation_rules` + revisit their RLS-off exposure; RulesManager Korean-first (i18n later).

## Just shipped (continuity only — not a log)
- **엔진 정밀도 (this change)**: AMLV `Strip→trip` 오진단 수정(`\btrip` 경계; migration 014로 DB EMERGENCY en도 경계 regex 교체) · **Rating Override**(별점 4·5 → `COMPLIMENT`로 완화, EMERGENCY 제외) · 복합 리뷰 희석 방지(LAYOUT/DISPLAY/DURATION/CROWD 카테고리 — 1개라도 매칭 시 COMPLAINT 확정) · `not bad`/`아깝지 않` 이중부정 · 시뮬레이터 Full Composed Preview. `analyzeReview(text, rating)`. `validate-waterfall` P3-1~6 통과.
- `426ad16` ingestion-time deterministic classification (import → classify → route; SAFE auto-answered, no LLM at ingest).
- `641b91c` deterministic `waterfallRegexEngine` + `reviewProcessor` + static/`replyTemplates` + `POST /api/review/generate` (gatekeeper) + `scripts/validate-waterfall.ts`.
- `b57e7e4` admin select-all hard delete + circular-FK fix (migration 012); `2f6c1ad` archive tab/restore/safe hard-delete.

## ⏭️ Known follow-ups (intentional scope boundaries)
- Detail page `/reviews/[id]` + legacy `/api/ai/generate-reply` + `IntelligentOrchestrator` still use short/careful variants + unconditional LLM → converge onto the deterministic gatekeeper + STANDARD tone.
- Two engines coexist (`IntelligentOrchestrator` bulk-process vs `reviewProcessor`) — converge.
- Legacy keyword/template stores (`app_settings.risk_keywords`, migration-005 `intent_keywords`/`reply_template_variants`, **RLS-off**) → converge onto `automation_rules`/`response_templates` + revisit their RLS exposure.

## 🔒 Active locks / blockers (read before any DB or auth work)
- **RLS STEP B is GATED.** `supabase/gated/rbac_rls_step_b.sql` must **NOT** be applied to live DB, and must NOT be moved into `supabase/migrations/`, until ALL of:
  1. `profiles.assigned_branches` backfill is **100% complete**,
  2. at least one verified **admin** role exists,
  3. user gives explicit **"RLS 락 해제"** approval.
  Applying early = global staff lockout. This is an absolute principle (phased rollout).
- App-layer branch scoping (`lib/auth/branchAccess.ts`) is the **current** enforcement; it is fail-closed (empty branches ⇒ no access) and must remain until RLS is live.

## Next candidate tasks (priority order — none started)
1. **Doc sync (High):** add the 3 shipped features to `docs/ARCHITECTURE.md` (route list + ingestion/triage + sort). Slim `PROJECT_STATE.md` to North Star + 1-line CHANGELOG + open-issues table (move verbose wave prose to git history).
2. **Archive the planning tree (High):** mark/relocate `00_`–`12_` (102 files) as `archive/` or add `.aiignore` so scans/globs skip them. Biggest single token-waste source.
3. **`risk_level` sort is lexical, not severity-ranked (Med — latent bug):** `reviews/page.tsx` orders `risk_level` as text → `critical, high, low, normal` instead of severity order. Needs a CASE/severity map (DB ordinal column or `order` on a computed rank). Same class as the date-sort bug already fixed. Do NOT fix during this audit.
4. **`assigned_branches` backfill (High — unblocks RLS):** populate `profiles.assigned_branches` for all staff, verify admin role. Precondition for unlocking RLS STEP B.
5. **Dashboard widget (Med, architect suggestion from triage work):** LLM-cost vs algorithm-defense-rate (template-handled %) using `reply_drafts.pipeline_engine` telemetry. Surfaces the cost saved by Algorithm-First.
6. **Bulk-process progress UX (Low):** the self-advancing loop reports `{processed, remaining, done}`; ensure a progress toast and a stop control exist in `ReviewsListClient.tsx`.

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

## This audit task (in progress)
Producing exactly four files — `REPORT.md`, `CURRENT_TASK.md`, `DECISIONS.md`, `CLAUDE_CONTEXT.md`. Read-only: no code/doc edits, no commits, no PRs, no package installs. The trailing `[지령: {작업명 요약}]` block in the request is a **placeholder template**, not an executable task.

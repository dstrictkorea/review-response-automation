# CURRENT_TASK.md — Active execution context
> Updated 2026-06-04. Keep <300 lines. **No historical wave logs** (those live in git history / a slim CHANGELOG). This file answers: "What is being worked on right now, what's next, what must I not touch?"

## Current phase
**Stabilization + documentation hardening.** Core pipeline (ingest → triage → algorithm/LLM draft → human approve → manual publish → archive) is built and deployed. Focus is now reducing per-session context rediscovery and closing small correctness gaps — not new feature surface.

## Just shipped (continuity only — not a log)
- **결정론적 하이브리드 답변 파이프라인** (this change): `waterfallRegexEngine.ts`(KO/EN 다층 정규식 분류, `/i`, Early-Return) + `reviewProcessor.ts`(게이트키퍼) + `staticTemplates.ts`/`replyTemplates.ts`(정적 STANDARD + ETERNAL NATURE + Kill-Switch) + `POST /api/review/generate`. SAFE=정적(LLM 0) · EMERGENCY=수동격리 · COMPLAINT/AMBIGUOUS=LLM Fallback(태그/근거 주입 + 금칙어 Double-Check + 항상 `pending_approval`). 배치 "AI 초안 생성"이 이 게이트키퍼로 재배선됨. `scripts/validate-waterfall.ts` 34/34 통과.
- **🐞 filterService 버그 수정**: 부상 규칙의 `|ER`(대소문자 무시·비앵커) → `\bER\b`. 기존엔 "Nev**er**/h**er**e/wat**er**" 등 'er' 포함 영어 리뷰가 전부 critical-부상으로 오격리되어 인입 자동응답을 막고 있었음(중대 버그). 이제 인입 정밀도 대폭 개선.
- archive 탭/복구/안전형 하드삭제(`2f6c1ad`), 인입 트리아지+벌크매칭(`9e4f60e`), 전체DB 정렬(`2194747`), CSV 지점 자동감지(`0405927`).

## ⏭️ 이번 변경의 후속(follow-up — 아직 안 함, 의도적 스코프 경계)
- 상세페이지 `/reviews/[id]` 및 레거시 `/api/ai/generate-reply` · `IntelligentOrchestrator`는 여전히 short/careful 변형 + 무조건 LLM. → 게이트키퍼로 재배선 + 톤 STANDARD 단일화 필요(현재 배치 경로만 전환됨).
- `ReviewDrawer`: 정적/LLM 신규 초안은 draft_short/careful=null → 짧게/조심스럽게 탭이 빈칸. 탭 단일화 + 생성·승인 버튼 연결 권장.
- `bulk-process`(IntelligentOrchestrator)와 신규 `reviewProcessor` 두 엔진 공존 — 장기적으로 단일 엔진 수렴 검토.

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

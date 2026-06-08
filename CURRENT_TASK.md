# CURRENT_TASK.md — Active execution context
> Updated 2026-06-08. Keep <300 lines. **No historical wave logs** (those live in git history / a slim CHANGELOG). This file answers: "What is being worked on right now, what's next, what must I not touch?"

## Current phase
**✅ EPIC COMPLETE: 레거시 청산 + 단일 결정론적 파이프라인** — `IntelligentOrchestrator` + `templateEngineService` 완전 제거, 레거시 3개 테이블 DROP, 신규 `processReviewById` 공통 헬퍼로 전 배치 파이프라인 통합.
- **PHASE 1 ✅:** `src/lib/processReviewById.ts` 신규 — admin-context 단일 리뷰 처리. `reviewProcessor` + `WaterfallRegexEngine` 기반 결정론적 게이트키퍼. `bulk-process` / `re-process` / `cron/sync-all` 재배선 완료. `rating` 전달 → Rating Override 정상 작동.
- **PHASE 2 ✅:** 의존성 0% 검증 완료. `IntelligentOrchestrator.ts` + `templateEngineService.ts` 삭제. `i18n/index.ts` 레거시 이름 4개국어 정리. JSDoc 위생 처리.
- **PHASE 3 ✅:** `migration 015_legacy_purge.sql` — `reply_template_variants` / `intent_keywords` / `detect_review_intent()` / `review_intents` DROP. `automation_rules` + `response_templates` RLS authenticated-SELECT-only 재확인. 라이브 DB 적용 완료.
- `tsc 0 에러` · `Next.js build 전 라우트 정상` · `git 9019334` · Vercel 자동 배포 진행 중.

> 이전 DB-driven dynamic engine EPIC (migration 013–014, `rulesCache`, `/api/admin/rules` CRUD, `/settings/rules`, 시뮬레이터, AMLV 오진단 수정, Rating Override, LAYOUT/DISPLAY/DURATION/CROWD 카테고리, `validate-waterfall` 44+ 케이스) 모두 ✅.

## Just shipped (continuity only — not a log)
- `9019334` **레거시 청산**: `processReviewById.ts` 신규 · bulk/re-process/cron 재배선 · `IntelligentOrchestrator`+`templateEngineService` 삭제 · migration 015 DROP 3 tables · RLS 재확인.
- `f5842a0` 엔진 정밀도: AMLV Strip→trip 수정 · Rating Override · LAYOUT/DISPLAY/DURATION/CROWD · `validate-waterfall` P3-1~6 · 시뮬레이터 Full Composed Preview.
- `426ad16` ingestion-time 분류 (import → classify → route; SAFE 자동 응답, LLM 미사용).
- `641b91c` deterministic `waterfallRegexEngine` + `reviewProcessor` + `POST /api/review/generate`.
- `b57e7e4` admin select-all hard delete + circular-FK fix (migration 012); `2f6c1ad` archive tab/restore.

## ⏭️ Known follow-ups (intentional scope boundaries)
- Detail page `/reviews/[id]` + legacy `/api/ai/generate-reply`: 여전히 short/careful 변형 + 무조건 LLM 사용 → 결정론적 게이트키퍼로 수렴 필요(별도 태스크).
- `app_settings.risk_keywords` (RLS-off 레거시 키워드 설정): `automation_rules`로 수렴 권장.
- `risk_level` 정렬이 텍스트 순(lexical) — severity 순이 아님(Med 잠재 버그): DB ordinal 또는 computed rank 필요.

## 🔒 Active locks / blockers (read before any DB or auth work)
- **RLS STEP B is GATED.** `supabase/gated/rbac_rls_step_b.sql` must **NOT** be applied to live DB, and must NOT be moved into `supabase/migrations/`, until ALL of:
  1. `profiles.assigned_branches` backfill is **100% complete**,
  2. at least one verified **admin** role exists,
  3. user gives explicit **"RLS 락 해제"** approval.
  Applying early = global staff lockout. This is an absolute principle (phased rollout).
- App-layer branch scoping (`lib/auth/branchAccess.ts`) is the **current** enforcement; it is fail-closed (empty branches ⇒ no access) and must remain until RLS is live.

## Next candidate tasks (priority order — none started)
1. **`assigned_branches` backfill (High — unblocks RLS):** populate `profiles.assigned_branches` for all staff, verify admin role. Precondition for unlocking RLS STEP B.
2. **Doc sync (High):** add shipped features to `docs/ARCHITECTURE.md` (migration table 015, route list, processReviewById). Slim `PROJECT_STATE.md`.
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

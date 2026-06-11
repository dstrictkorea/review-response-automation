@AGENTS.md

# ARTE Museum — Review Response Automation MVP

## What This Is

An internal review operation ledger for ARTE Museum staff.
This is NOT a fully automated public reply bot.
Humans approve every reply before it goes public.

## Core Workflow (Build in This Order)

1. Manual review registration — staff paste in a review
2. AI reply draft generation — Claude suggests a response
3. Human edit and approval — staff edits the draft
4. Copy final reply — staff copies and pastes manually to the platform
5. Mark as published — staff marks the review as done
6. Archive — full history of reviews and replies is stored
7. Settings/templates — editable by staff from the frontend

## Do NOT Build (Out of Scope for MVP)

- Google Business Profile API integration
- Naver auto-posting
- TripAdvisor auto-posting
- Full enterprise permission system
- PDF report generation
- Slack or email automation
- Any automatic public posting of any kind

## Safety Rules (Non-Negotiable)

- Never promise refunds or compensation in generated replies
- Never admit legal responsibility
- Never promise CCTV review
- Never promise staff punishment
- High-risk reviews (legal threats, severe complaints) must be flagged and require explicit human approval
- Every important action (registration, approval, publish, archive) must be logged with timestamp and user
- **RLS STEP B GATED**: do NOT apply `supabase/gated/rbac_rls_step_b.sql` until explicit "RLS 락 해제" approval

## Design

- Korean-first UI — all labels, buttons, and messages in Korean
- Clean, bright dashboard — no dark mode required for MVP
- High contrast text — no pale gray on light backgrounds
- Desktop-first layout, must also be usable on mobile
- Admin-facing only — no public-facing pages

## Reply Engine Languages (UI와 분리)

- UI Language = ko/en/ja/zh (`src/lib/i18n`). **Reply Language = 9개** — ko/en/ja/zh/es/ru/ar/hi/tl.
- 타입 SSOT는 `src/lib/replyLanguage.ts` 하나뿐 — 파일별 로컬 `type Language` 섀도잉 금지 (빌드 깨짐 전력).
- 비코어 언어 리뷰는 ko 폴백 초안 → 운영자가 번역 후 게시.

## Quality Gate (엔진/템플릿 변경 시 필수)

- `npx tsx scripts/deep-learning-loop.ts` → **"이슈 있는 리뷰: 0/655"** 가 머지 조건 (DECISIONS #14)
- `npx tsx scripts/validate-waterfall.ts` → ALL PASS
- `npx tsc --noEmit` → 0 (next build가 scripts/**까지 타입체크 — tsx 통과 ≠ 빌드 통과)
- 버그 수정 시 그 버그를 재현하는 합성 리뷰를 루프 데이터셋에 추가 (회귀 고정)

---

## Compact Instructions

When compacting, preserve:
- Current task objective and exact completion status (which phase/step is done)
- File paths and function/export names touched this session
- Error messages and their root-cause fixes
- All Safety Rules above verbatim
- RLS gate status and any pending migration blockers
- Staged/committed git state (what was pushed, what is pending)

Discard: exploratory reasoning chains, superseded code attempts, raw tool output logs, re-read file contents.

## Session Management

- Run `/compact` after **each completed phase** — do not wait for auto-compaction
- Run `/compact` when context hits **~50%** (check with `/usage`)
- Run `/clear` when switching to a completely unrelated task; use `/rename` first so session is resumable via `/resume`
- Run `/usage` before starting any large multi-file operation to baseline token burn
- Between unrelated tasks: `/clear` > stacking context on dead history

## Model & Prompt Discipline

- **Default model: Sonnet.** Switch to Opus only for architecture decisions or cross-file reasoning requiring deep multi-step inference.
- **Always specify exact paths**: `src/lib/waterfallRegexEngine.ts:analyzeReview()` not "the analysis function"
- **Use plan mode** (Shift+Tab) before any multi-file refactor — prevents expensive wrong-direction runs
- **Press Escape immediately** if output is going the wrong direction; use `/rewind` to checkpoint-restore
- Keep prompts ≤ 3 sentences; include a verification target (test name, expected output, build status)
- Never ask to "review the whole codebase" — scope to specific files or exports

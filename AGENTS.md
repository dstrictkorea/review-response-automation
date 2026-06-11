<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Token Efficiency Rules (Non-Negotiable)

These rules exist to prevent context bloat that triggers usage limits mid-session.

### File Reading
- **Grep before Read** — confirm a symbol/export exists (`Grep pattern file`) before opening the file
- **Read specific line ranges** — never `Read` an entire large file when you need ≤ 30 lines; use `offset` + `limit`
- **Large files in this repo** (read by range, never whole-file unless editing):
  - `src/lib/staticTemplates.ts` — ~2,900 lines (9-lang slot pools); grep the slot/tag/lang you need
  - `src/lib/waterfallRegexEngine.ts` — 500+ lines; grep the function/pattern
  - `scripts/deep-learning-loop.ts` — ~4,000 lines (713 synthetic reviews + 14 detectors); grep by scenario name or `Round NN`
  - `scripts/validate-waterfall.ts` — 300+ lines; grep test block by label (S4, C9, etc.)
  - `src/app/(admin)/reviews/ReviewsListClient.tsx` — ~900 lines

### Build & Test Output
- `npm run build` — only errors and route table matter; ignore full compilation log. **NOTE: build type-checks `scripts/**` too — `npx tsx` passing does NOT mean the build passes.**
- `npx tsc --noEmit` — only error lines matter; ignore "no errors found" verbosity
- `npx tsx scripts/validate-waterfall.ts` — only PASS/FAIL counts and any FAIL detail matter
- `npx tsx scripts/deep-learning-loop.ts 2>&1 | grep "이슈 있는 리뷰:"` — **0/713 is the merge bar** for engine/template changes; on failure grep the scenario name for detail
- If a command would dump > 100 lines of output and only the last 5–10 lines are actionable, add `| tail -20` or `| grep -E "error|FAIL|✗"` inline

### Context Hygiene
- Do NOT re-read files you already read in this session unless editing them
- Do NOT repeat context already established in CLAUDE.md or earlier in the session
- After `/compact`, re-orient with a single sentence summary — do NOT re-read source files to "refresh"
- Disable MCP servers you are not actively using in this task (`/mcp` to toggle)

### Supabase / DB Operations
- Read migration files by range (first 30 lines for structure, specific ALTER lines for detail)
- `execute_sql` results > 50 rows → add `LIMIT 20` unless full result is required
- Never SELECT * on large tables for exploration — use `LIMIT 5` first

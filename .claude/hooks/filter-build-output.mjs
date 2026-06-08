#!/usr/bin/env node
/**
 * filter-build-output.mjs — PreToolUse hook
 *
 * Intercepts verbose Bash commands and rewrites them to emit only
 * actionable signal lines. Prevents context bloat from build/test
 * output that can easily consume 5,000–20,000 tokens per invocation.
 *
 * Registered in .claude/settings.json → hooks.PreToolUse
 */

let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let payload
try { payload = JSON.parse(raw) } catch { process.stdout.write('{}'); process.exit(0) }

const cmd = (payload?.tool_input?.command ?? '').trim()

function reply(filteredCmd) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { command: filteredCmd },
    },
  }))
  process.exit(0)
}

// ── npm run build / next build ────────────────────────────────────────────────
// Full Next.js build dumps 200–500 lines. We only care about errors + route summary.
if (/npm run build|npx next build/.test(cmd) && !/grep/.test(cmd)) {
  reply(`${cmd} 2>&1 | grep -E "(error TS|Error:|error:|TypeError|Route|✓|✗|warn:|Failed to compile|compiled successfully)" | tail -40`)
}

// ── tsc --noEmit ──────────────────────────────────────────────────────────────
// TypeScript type-check: only error lines matter; success is silent.
if (/tsc.*--noEmit/.test(cmd) && !/grep/.test(cmd)) {
  reply(`${cmd} 2>&1 | grep -E "(error TS|warning TS|error:|✓)" | head -50 || echo "tsc: no errors"`)
}

// ── validate-waterfall (TDD runner) ──────────────────────────────────────────
// 82-test suite: only PASS/FAIL counts and individual FAIL detail needed.
if (/validate-waterfall/.test(cmd) && !/grep/.test(cmd)) {
  reply(`${cmd} 2>&1 | grep -E "(PASS|FAIL|TOTAL|ERROR|✓|✗|^  [A-Z])" | tail -30`)
}

// ── npm test / jest / vitest ──────────────────────────────────────────────────
if (/^(npm test|npx jest|npx vitest)/.test(cmd) && !/grep/.test(cmd)) {
  reply(`${cmd} 2>&1 | grep -E "(PASS|FAIL|✓|✗|×|error|Error)" | tail -40`)
}

// ── git log (verbose) ────────────────────────────────────────────────────────
// Unbounded git log can dump hundreds of commits.
if (/^git log/.test(cmd) && !/-n\s*\d/.test(cmd) && !/--oneline/.test(cmd)) {
  reply(`git log --oneline -15`)
}

// Default: pass through unchanged
process.stdout.write('{}')

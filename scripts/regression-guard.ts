/**
 * regression-guard.ts — 회귀 방어 통합 게이트 (Regression Guard)
 *
 * 엔진/딕셔너리/슬롯/Fragment Pool을 수정한 직후 실행하는 단일 관문.
 * 다음을 서브프로세스로 순차 실행하고, 하나라도 실패하면 비-제로 종료한다:
 *   1. tsc --noEmit            (타입 — Vercel 빌드와 동일 범위, scripts/** 포함)
 *   2. validate-waterfall.ts   (분류/슬롯 TDD — S1~S20+ 단 1개라도 FAIL 시 차단)
 *   3. deep-learning-loop.ts   (합성 리뷰 품질 — '이슈 있는 리뷰: 0/N' 아니면 차단)
 *
 * 용도: AI 자체 고도화 루프가 기존 통과 케이스를 깨는 수정을 원천 차단(가드).
 *   "수정 → regression-guard → PASS면 유지, FAIL이면 즉시 롤백" 워크플로의 PASS/FAIL 판정기.
 *
 * 실행: npx tsx scripts/regression-guard.ts
 * 종료코드: 0 = 전 게이트 통과(머지/푸시 안전), 1 = 1개 이상 실패(롤백 필요).
 */
import { spawnSync } from 'node:child_process'

interface GateResult { name: string; pass: boolean; detail: string }

function run(cmd: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 })
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const gates: GateResult[] = []

// ── Gate 1: TypeScript (tsc --noEmit) ─────────────────────────────────────────
{
  const { out } = run('npx', ['tsc', '--noEmit'])
  const errs = (out.match(/error TS\d+/g) ?? []).length
  gates.push({ name: 'tsc --noEmit', pass: errs === 0, detail: errs === 0 ? '0 errors' : `${errs} type error(s)` })
}

// ── Gate 2: validate-waterfall (분류/슬롯 TDD) ────────────────────────────────
{
  const { out } = run('npx', ['tsx', 'scripts/validate-waterfall.ts'])
  const fails = (out.match(/\[FAIL\]/g) ?? []).length
  const allPass = /✅ ALL PASS/.test(out)
  gates.push({ name: 'validate-waterfall', pass: allPass && fails === 0, detail: allPass ? 'ALL PASS' : `${fails} FAIL(S)` })
}

// ── Gate 3: deep-learning-loop (합성 리뷰 품질) ───────────────────────────────
{
  const { out } = run('npx', ['tsx', 'scripts/deep-learning-loop.ts'])
  const m = out.match(/이슈 있는 리뷰:\s*(\d+)\/(\d+)/)
  const issues = m ? parseInt(m[1], 10) : -1
  const total  = m ? parseInt(m[2], 10) : 0
  gates.push({ name: 'deep-learning-loop', pass: issues === 0, detail: m ? `${issues}/${total} issues` : 'no summary found' })
}

// ── 결과 ───────────────────────────────────────────────────────────────────────
console.log('\n═══════ Regression Guard ═══════')
for (const g of gates) console.log(`  ${g.pass ? '✅' : '❌'} ${g.name.padEnd(22)} ${g.detail}`)
const allPass = gates.every((g) => g.pass)
console.log(`\n${allPass ? '✅ SAFE TO COMMIT — 전 게이트 통과' : '❌ BLOCKED — 회귀 발생, 수정 롤백 필요'}`)
process.exit(allPass ? 0 : 1)

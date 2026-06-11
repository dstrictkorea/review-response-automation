/**
 * GET /api/cron/sync-all
 *
 * Hourly cron job — syncs reviews from all connected Google Business Profile accounts.
 * Called by Vercel Cron (vercel.json) and authenticated via Authorization: Bearer <CRON_SECRET>.
 * Uses the admin Supabase client so no user session is needed.
 *
 * 수집·적재·엔진 처리는 `syncGoogleAccountReviews`(공유 헬퍼)에 위임 → 수동 sync와
 * 완전히 동일한 경로. 수집된 모든 신규 리뷰가 결정론적 게이트키퍼를 100% 통과한다.
 *
 * Security:
 *   - If CRON_SECRET env var is set, the Authorization header must match exactly.
 *   - If CRON_SECRET is not set the route is open (useful for local dev; set it in prod).
 *
 * Also supports POST so it can be triggered manually from Settings if needed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncGoogleAccountReviews } from '@/lib/google/syncReviews'

// ── Auth guard ───────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // no secret configured — allow (set CRON_SECRET in prod)
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

// ── Handler (supports GET from Vercel Cron and POST for manual trigger) ──────────

async function handler(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: accounts, error: fetchErr } = await admin
    .from('google_accounts')
    .select('id, google_account_email, branch_code')
    .not('refresh_token', 'is', null)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      synced_accounts: 0,
      message: '연결된 Google 계정 없음',
    })
  }

  const results: Record<string, { imported?: number; orchestrated?: number; error?: string }> = {}

  for (const account of accounts) {
    const key = account.google_account_email ?? account.id
    try {
      results[key] = await syncGoogleAccountReviews(admin, account.id, 'system:cron')
    } catch (err: unknown) {
      results[key] = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  const totalImported     = Object.values(results).reduce((sum, r) => sum + (r.imported     ?? 0), 0)
  const totalOrchestrated = Object.values(results).reduce((sum, r) => sum + (r.orchestrated ?? 0), 0)

  // Activity log — review_id is nullable so cron entries log without a specific review
  await admin.from('activity_logs').insert({
    review_id: null,
    actor_name: 'system:cron',
    action: 'google_sync_cron',
    detail: { synced_accounts: accounts.length, total_imported: totalImported, total_orchestrated: totalOrchestrated, results },
  })

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    synced_accounts: accounts.length,
    total_imported: totalImported,
    total_orchestrated: totalOrchestrated,
    results,
  })
}

export const GET  = handler
export const POST = handler

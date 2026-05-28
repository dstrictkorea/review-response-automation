/**
 * GET /api/cron/sync-all
 *
 * Hourly cron job — syncs reviews from all connected Google Business Profile accounts.
 * Called by Vercel Cron (vercel.json) and authenticated via Authorization: Bearer <CRON_SECRET>.
 * Uses the admin Supabase client so no user session is needed.
 *
 * Security:
 *   - If CRON_SECRET env var is set, the Authorization header must match exactly.
 *   - If CRON_SECRET is not set the route is open (useful for local dev; set it in prod).
 *
 * Also supports POST so it can be triggered manually from Settings if needed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, listGoogleReviews } from '@/lib/google/api'
import { IntelligentOrchestrator } from '@/lib/automation/IntelligentOrchestrator'

// ── Helpers (duplicated from /api/google/sync to avoid cross-route import) ──────

function starRatingToNumber(star: string): number {
  const map: Record<string, number> = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 }
  return map[star] ?? 0
}

function makeHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// ── Core sync logic for a single account ────────────────────────────────────────

async function syncOneAccount(
  admin: ReturnType<typeof createAdminClient>,
  googleAccountId: string,
): Promise<{ imported: number }> {
  const { data: ga } = await admin
    .from('google_accounts')
    .select('*')
    .eq('id', googleAccountId)
    .single()

  if (!ga) throw new Error('계정을 찾을 수 없습니다.')
  if (!ga.branch_code) throw new Error('지점(branch_code)이 설정되지 않았습니다.')
  if (!ga.google_location_name) throw new Error('Location name이 설정되지 않았습니다.')

  const token = await getValidAccessToken(googleAccountId)
  let imported = 0
  let nextPageToken: string | undefined
  const newReviewIds: string[] = []  // IDs of genuinely new (non-duplicate) inserts

  do {
    const data = await listGoogleReviews(ga.google_location_name, token, nextPageToken)
    const reviews: any[] = data.reviews ?? []
    nextPageToken = data.nextPageToken

    for (const review of reviews) {
      const sourceId: string = review.name
      const hash = makeHash(sourceId)

      // With ignoreDuplicates:true, maybeSingle() returns the inserted row for new
      // reviews and null for duplicates — lets us identify truly new reviews.
      const { data: upserted, error } = await admin.from('reviews').upsert(
        {
          branch_code: ga.branch_code,
          channel_code: 'google',
          source_review_id: sourceId,
          reviewer_name: review.reviewer?.displayName ?? '익명',
          rating: starRatingToNumber(review.starRating),
          review_text: review.comment ?? null,
          review_language: review.comment
            ? /[가-힯]/.test(review.comment) ? 'ko' : 'en'
            : null,
          review_created_at: review.createTime ?? null,
          status: 'new',
          normalized_hash: hash,
        },
        { onConflict: 'branch_code,channel_code,normalized_hash', ignoreDuplicates: true },
      ).select('id').maybeSingle()

      if (!error && upserted?.id) {
        imported++
        newReviewIds.push(upserted.id)
      }
    }
  } while (nextPageToken)

  await admin
    .from('google_accounts')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', googleAccountId)

  // ── Kick off AI draft generation + risk routing for each new review ────────
  let orchestrated = 0
  if (newReviewIds.length > 0) {
    const { processed } = await IntelligentOrchestrator.processBatch(newReviewIds)
    orchestrated = processed
  }

  return { imported, orchestrated }
}

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
      results[key] = await syncOneAccount(admin, account.id)
    } catch (err: any) {
      results[key] = { error: err.message }
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

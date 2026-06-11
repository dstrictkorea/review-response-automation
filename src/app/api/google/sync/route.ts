/**
 * POST /api/google/sync — 수동 "리뷰 가져오기" (단일 계정)
 *
 * 외부 Google Business Profile에서 리뷰를 수집·적재한 직후, 수집된 모든 신규 리뷰를
 * `syncGoogleAccountReviews`(공유 헬퍼)가 결정론적 게이트키퍼(`processReviewById`)로
 * 전수 처리한다 → 9개 언어 governed 다중 슬롯 + 3-Tier Risk Routing 100% 적용.
 * (cron/sync-all과 동일한 수집·처리 경로를 공유 — 누락 구간 없음.)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncGoogleAccountReviews } from '@/lib/google/syncReviews'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let googleAccountId: string
  try {
    ({ googleAccountId } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!googleAccountId) return NextResponse.json({ error: 'googleAccountId가 필요합니다.' }, { status: 400 })

  const admin = createAdminClient()

  try {
    const { imported, orchestrated } = await syncGoogleAccountReviews(
      admin,
      googleAccountId,
      user.email ?? 'system:manual-sync',
    )
    await admin.from('activity_logs').insert({
      review_id: null,
      actor_name: user.email ?? 'system:manual-sync',
      action: 'google_sync_manual',
      detail: { google_account_id: googleAccountId, imported, orchestrated },
    })
    return NextResponse.json({ success: true, imported, orchestrated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('찾을 수 없') ? 404 : message.includes('설정되지') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

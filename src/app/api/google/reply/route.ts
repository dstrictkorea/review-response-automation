import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, postGoogleReply } from '@/lib/google/api'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId, comment } = await req.json()
  const admin = createAdminClient()

  const { data: review } = await admin
    .from('reviews')
    .select('id, branch_code, source_review_id, channel_code')
    .eq('id', reviewId)
    .single()

  if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
  if (review.channel_code !== 'google') return NextResponse.json({ error: 'Google 리뷰가 아닙니다.' }, { status: 400 })
  if (!review.source_review_id) return NextResponse.json({ error: 'Google 리뷰 ID가 없습니다.' }, { status: 400 })

  const { data: ga } = await admin
    .from('google_accounts')
    .select('id')
    .eq('branch_code', review.branch_code)
    .eq('is_active', true)
    .maybeSingle()

  if (!ga) return NextResponse.json({ error: '연결된 Google 계정이 없습니다.' }, { status: 400 })

  try {
    const token = await getValidAccessToken(ga.id)
    await postGoogleReply(review.source_review_id, token, comment)

    await admin
      .from('reviews')
      .update({ status: 'manual_published', updated_at: new Date().toISOString() })
      .eq('id', reviewId)

    await admin.from('activity_logs').insert({
      review_id: reviewId,
      actor_name: user.email,
      action: 'google_reply_posted',
      detail: { preview: comment.substring(0, 100) },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

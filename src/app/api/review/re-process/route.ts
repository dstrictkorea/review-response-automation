/**
 * POST /api/review/re-process
 *
 * 결정론적 게이트키퍼(processReviewById)로 단일 리뷰를 재처리한다.
 * "🔄 AI 재분석" 버튼(ReviewDetailClient)에서 호출.
 *
 * 안전: final 상태(manual_published, no_reply) 리뷰는 재분석 불가.
 * 인증된 사용자 세션 필요.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processReviewById } from '@/lib/processReviewById'

const FINAL_STATUSES = new Set(['manual_published', 'no_reply'])

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const actorEmail = user.email ?? 'system:re-process'

  // ── Parse body ─────────────────────────────────────────────────────────────
  let review_id: string
  try {
    const body = await request.json()
    review_id = body.review_id
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!review_id) {
    return NextResponse.json({ error: 'review_id is required' }, { status: 400 })
  }

  // ── Fetch review + guard against final statuses ────────────────────────────
  const admin = createAdminClient()
  const { data: review, error: fetchErr } = await admin
    .from('reviews')
    .select('id, status')
    .eq('id', review_id)
    .single()

  if (fetchErr || !review) {
    return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (FINAL_STATUSES.has(review.status)) {
    return NextResponse.json(
      { error: '게시 완료 또는 답변 불필요 처리된 리뷰는 재분석할 수 없습니다.' },
      { status: 400 },
    )
  }

  // ── 결정론적 게이트키퍼로 재처리 ──────────────────────────────────────────
  try {
    await processReviewById(review_id, actorEmail, admin)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[re-process] processReviewById failed:', msg)
    return NextResponse.json({ error: msg || 'AI 재분석 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── Return updated review + draft ──────────────────────────────────────────
  const [updatedReview, updatedDraft] = await Promise.all([
    admin
      .from('reviews')
      .select('status, risk_level, sentiment, categories, risk_reasons, forbidden_check, internal_note_ko')
      .eq('id', review_id)
      .single(),
    admin
      .from('reply_drafts')
      .select('*')
      .eq('review_id', review_id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    success: true,
    review: updatedReview.data,
    draft: updatedDraft.data,
  })
}

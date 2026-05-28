/**
 * POST /api/review/re-process
 *
 * Triggers IntelligentOrchestrator.processReview() for a single review.
 * Used by the "🔄 AI 재분석" button in ReviewDetailClient.
 *
 * Safety: only allows reprocessing reviews that are not in a final state
 * (manual_published or no_reply). Requires an authenticated user session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IntelligentOrchestrator } from '@/lib/automation/IntelligentOrchestrator'

const FINAL_STATUSES = new Set(['manual_published', 'no_reply'])

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // ── Run orchestrator ───────────────────────────────────────────────────────
  try {
    await IntelligentOrchestrator.processReview(review_id)
  } catch (err: any) {
    console.error('[re-process] Orchestrator failed:', err.message)
    return NextResponse.json({ error: err.message ?? 'AI 재분석 중 오류가 발생했습니다.' }, { status: 500 })
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

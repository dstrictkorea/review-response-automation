import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAutoGeneratable, generateAutoReply, type VisitorInfo } from '@/lib/autoReply'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let review_id: string
  let draft_type: 'standard' | 'short' | 'careful' = 'standard'
  try {
    const body = await request.json()
    review_id = body.review_id
    if (body.draft_type === 'short' || body.draft_type === 'careful') draft_type = body.draft_type
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!review_id) return NextResponse.json({ error: 'review_id가 필요합니다.' }, { status: 400 })

  const { data: review } = await supabase
    .from('reviews').select('*').eq('id', review_id).single()
  if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })

  const check = checkAutoGeneratable(review.rating, review.review_text)
  if (!check.canAuto) {
    return NextResponse.json({ error: `자동 생성 불가: ${check.reason}` }, { status: 422 })
  }

  // ── 재방문 감지 (전 지점 통합) ────────────────────────────────────────────────
  const visitorInfo: VisitorInfo = {
    isReturning: false,
    isCrossBranch: false,
    previousBranchNames: [],
    currentBranchName: undefined,
  }

  if (review.reviewer_name) {
    // 같은 리뷰어가 다른 리뷰를 작성한 이력 조회 (전 지점)
    const { data: prevReviews } = await supabase
      .from('reviews')
      .select('branch_code')
      .eq('reviewer_name', review.reviewer_name)
      .neq('id', review_id)

    if (prevReviews && prevReviews.length > 0) {
      visitorInfo.isReturning = true
      const prevBranchCodes = [...new Set(prevReviews.map(r => r.branch_code))]
      const otherBranchCodes = prevBranchCodes.filter(c => c !== review.branch_code)
      visitorInfo.isCrossBranch = otherBranchCodes.length > 0

      if (otherBranchCodes.length > 0) {
        // 지점 이름 조회
        const { data: branches } = await supabase
          .from('branches')
          .select('code, name_ko')
          .in('code', otherBranchCodes)

        visitorInfo.previousBranchNames = (branches ?? []).map(b => b.name_ko ?? b.code)

        // 현재 지점 이름
        const { data: currBranch } = await supabase
          .from('branches')
          .select('name_ko')
          .eq('code', review.branch_code)
          .maybeSingle()
        visitorInfo.currentBranchName = currBranch?.name_ko ?? review.branch_code
      }
    }
  }

  const result = generateAutoReply(review_id, review.rating!, review.review_text, visitorInfo)

  // Upsert reply_drafts
  const { data: existing } = await supabase
    .from('reply_drafts').select('id').eq('review_id', review_id).maybeSingle()

  const selectedReply =
    draft_type === 'short' ? result.draft_short
    : draft_type === 'careful' ? result.draft_careful
    : result.draft_standard

  const payload = {
    review_id,
    draft_short: result.draft_short,
    draft_standard: result.draft_standard,
    draft_careful: result.draft_careful,
    selected_draft_type: draft_type,
    selected_reply: selectedReply,
    forbidden_check: result.forbidden_check,
    prompt_version: 'auto-v2',
    model_name: 'rule-based',
    updated_at: new Date().toISOString(),
  }

  let draft
  if (existing) {
    const { data } = await supabase
      .from('reply_drafts').update(payload).eq('id', existing.id).select().single()
    draft = data
  } else {
    const { data } = await supabase
      .from('reply_drafts').insert(payload).select().single()
    draft = data
  }

  await supabase.from('reviews').update({
    status: 'ai_done',
    risk_level: result.risk_level,
    sentiment: result.sentiment,
    categories: result.categories,
    risk_reasons: result.risk_reasons,
    review_language: result.detected_language,
    internal_note_ko: result.internal_note_ko,
    updated_at: new Date().toISOString(),
  }).eq('id', review_id)

  await supabase.from('activity_logs').insert({
    review_id,
    actor_name: user.email,
    action: 'ai_draft_generated',
    detail: {
      model: 'rule-based',
      is_returning: visitorInfo.isReturning,
      is_cross_branch: visitorInfo.isCrossBranch,
    },
  })

  return NextResponse.json({
    draft,
    risk_level: result.risk_level,
    sentiment: result.sentiment,
    categories: result.categories,
    auto: true,
  })
}

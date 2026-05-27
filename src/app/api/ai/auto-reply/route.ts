import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAutoGeneratable, generateAutoReply } from '@/lib/autoReply'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let review_id: string
  try {
    const body = await request.json()
    review_id = body.review_id
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!review_id) return NextResponse.json({ error: 'review_id가 필요합니다.' }, { status: 400 })

  const { data: review } = await supabase
    .from('reviews').select('*').eq('id', review_id).single()
  if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })

  // Check eligibility
  const check = checkAutoGeneratable(review.rating, review.review_text)
  if (!check.canAuto) {
    return NextResponse.json({ error: `자동 생성 불가: ${check.reason}` }, { status: 422 })
  }

  const result = generateAutoReply(review_id, review.rating!, review.review_text)

  // Upsert reply_drafts
  const { data: existing } = await supabase
    .from('reply_drafts').select('id').eq('review_id', review_id).maybeSingle()

  const payload = {
    review_id,
    draft_short: result.draft_short,
    draft_standard: result.draft_standard,
    draft_careful: result.draft_careful,
    selected_draft_type: 'standard',
    selected_reply: result.draft_standard,
    forbidden_check: result.forbidden_check,
    prompt_version: 'auto-v1',
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
    detail: { model: 'rule-based', risk_level: 'low', sentiment: 'positive' },
  })

  return NextResponse.json({
    draft,
    risk_level: result.risk_level,
    sentiment: result.sentiment,
    categories: result.categories,
    auto: true,
  })
}

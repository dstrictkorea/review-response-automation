/**
 * Bulk rule-based auto-reply endpoint.
 * Cross-branch returning visitor detection: checks reviewer_name across ALL branches.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAutoGeneratable, generateAutoReply, type VisitorInfo } from '@/lib/autoReply'

type DraftType = 'standard' | 'short' | 'careful'

interface BulkResultItem {
  review_id: string
  status: 'success' | 'error' | 'skipped'
  error?: string
  draft?: {
    id: string
    draft_short: string
    draft_standard: string
    draft_careful: string
    selected_reply: string
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let review_ids: string[]
  let draft_type: DraftType = 'standard'
  try {
    const body = await request.json()
    review_ids = body.review_ids
    if (body.draft_type === 'short' || body.draft_type === 'careful') draft_type = body.draft_type
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  if (!Array.isArray(review_ids) || review_ids.length === 0)
    return NextResponse.json({ error: 'review_ids 배열이 필요합니다.' }, { status: 400 })
  if (review_ids.length > 200)
    return NextResponse.json({ error: '한 번에 최대 200건까지 처리 가능합니다.' }, { status: 400 })

  // ── 1. 리뷰 일괄 조회 ────────────────────────────────────────────────────────
  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('*')
    .in('id', review_ids)

  if (reviewsError || !reviews)
    return NextResponse.json({ error: '리뷰 조회 실패' }, { status: 500 })

  const reviewMap = new Map(reviews.map(r => [r.id, r]))

  // ── 2. 재방문 여부 전지점 통합 감지 ──────────────────────────────────────────
  const reviewerNames = [...new Set(reviews.map(r => r.reviewer_name).filter(Boolean))]

  // reviewer_name으로만 조회 (branch_code 제한 없음)
  const { data: prevByName } = reviewerNames.length
    ? await supabase
        .from('reviews')
        .select('reviewer_name, branch_code')
        .in('reviewer_name', reviewerNames)
        .not('id', 'in', `(${review_ids.map(id => `'${id}'`).join(',')})`)
    : { data: [] }

  // reviewer_name → Set<branch_code> (previous visits)
  const prevBranchMap = new Map<string, Set<string>>()
  for (const r of prevByName ?? []) {
    if (!r.reviewer_name) continue
    if (!prevBranchMap.has(r.reviewer_name)) prevBranchMap.set(r.reviewer_name, new Set())
    prevBranchMap.get(r.reviewer_name)!.add(r.branch_code)
  }

  // 크로스 지점 branch_code 수집 → 이름 일괄 조회
  const crossBranchCodes = new Set<string>()
  for (const review of reviews) {
    const prev = review.reviewer_name ? prevBranchMap.get(review.reviewer_name) : null
    if (prev) {
      for (const code of prev) {
        if (code !== review.branch_code) crossBranchCodes.add(code)
      }
    }
    // current branch도 조회 대상
    if (review.branch_code) crossBranchCodes.add(review.branch_code)
  }

  const { data: allBranches } = crossBranchCodes.size
    ? await supabase
        .from('branches')
        .select('code, name_ko')
        .in('code', [...crossBranchCodes])
    : { data: [] }

  const branchNameMap = new Map<string, string>(
    (allBranches ?? []).map(b => [b.code, b.name_ko ?? b.code])
  )

  // ── 3. 기존 draft 조회 ────────────────────────────────────────────────────────
  const { data: existingDrafts } = await supabase
    .from('reply_drafts')
    .select('id, review_id')
    .in('review_id', review_ids)

  const existingDraftMap = new Map((existingDrafts ?? []).map(d => [d.review_id, d.id]))

  // ── 4. 메모리 내 답변 생성 ────────────────────────────────────────────────────
  const results: BulkResultItem[] = []
  const toUpsertDrafts: object[] = []
  const toUpdateReviews: { id: string; status: string; risk_level: string; sentiment: string; categories: string[]; review_language: string; internal_note_ko: string }[] = []
  const toLogActivities: object[] = []

  for (const id of review_ids) {
    const review = reviewMap.get(id)
    if (!review) {
      results.push({ review_id: id, status: 'error', error: '리뷰를 찾을 수 없습니다.' })
      continue
    }

    const check = checkAutoGeneratable(review.rating, review.review_text)
    if (!check.canAuto) {
      results.push({ review_id: id, status: 'skipped', error: check.reason })
      continue
    }

    // Build VisitorInfo
    const prevBranches = review.reviewer_name ? prevBranchMap.get(review.reviewer_name) : null
    const isReturning = (prevBranches?.size ?? 0) > 0
    const otherBranchCodes = isReturning
      ? [...(prevBranches ?? [])].filter(c => c !== review.branch_code)
      : []
    const isCrossBranch = otherBranchCodes.length > 0

    const visitorInfo: VisitorInfo = {
      isReturning,
      isCrossBranch,
      previousBranchNames: otherBranchCodes.map(c => branchNameMap.get(c) ?? c),
      currentBranchName: branchNameMap.get(review.branch_code) ?? review.branch_code,
    }

    const generated = generateAutoReply(id, review.rating!, review.review_text, visitorInfo)

    const selectedReply =
      draft_type === 'short'   ? generated.draft_short
      : draft_type === 'careful' ? generated.draft_careful
      : generated.draft_standard

    const draftPayload = {
      review_id: id,
      draft_short:    generated.draft_short,
      draft_standard: generated.draft_standard,
      draft_careful:  generated.draft_careful,
      selected_draft_type: draft_type,
      selected_reply: selectedReply,
      forbidden_check: generated.forbidden_check,
      prompt_version: 'auto-v2',
      model_name: 'rule-based',
      updated_at: new Date().toISOString(),
    }

    const existingDraftId = existingDraftMap.get(id)
    if (existingDraftId) {
      toUpsertDrafts.push({ id: existingDraftId, ...draftPayload })
    } else {
      toUpsertDrafts.push(draftPayload)
    }

    toUpdateReviews.push({
      id,
      status: 'ai_done',
      risk_level: generated.risk_level,
      sentiment: generated.sentiment,
      categories: generated.categories,
      review_language: generated.detected_language,
      internal_note_ko: generated.internal_note_ko,
    })

    toLogActivities.push({
      review_id: id,
      actor_name: user.email,
      action: 'ai_draft_generated',
      detail: { model: 'rule-based', bulk: true, is_returning: isReturning, is_cross_branch: isCrossBranch },
    })
  }

  // ── 5. 일괄 저장 ──────────────────────────────────────────────────────────────
  const now = new Date().toISOString()

  const draftsToUpdate = toUpsertDrafts.filter((d: any) => d.id)
  const draftsToInsert = toUpsertDrafts.filter((d: any) => !d.id)

  let insertedDrafts: any[] = []
  if (draftsToInsert.length > 0) {
    const { data } = await supabase
      .from('reply_drafts')
      .insert(draftsToInsert)
      .select('id, review_id, draft_short, draft_standard, draft_careful, selected_reply')
    insertedDrafts = data ?? []
  }
  for (const d of draftsToUpdate) {
    const { id: draftId, ...rest } = d as any
    await supabase.from('reply_drafts').update(rest).eq('id', draftId)
  }

  const draftResultMap = new Map<string, any>()
  for (const d of insertedDrafts) draftResultMap.set(d.review_id, d)
  for (const d of draftsToUpdate) {
    const dd = d as any
    draftResultMap.set(dd.review_id, dd)
  }

  if (toUpdateReviews.length > 0) {
    await Promise.all(
      toUpdateReviews.map(({ id, ...rest }) =>
        supabase.from('reviews').update({ ...rest, updated_at: now }).eq('id', id)
      )
    )
  }

  if (toLogActivities.length > 0) {
    await supabase.from('activity_logs').insert(toLogActivities)
  }

  // ── 6. 결과 조립 ──────────────────────────────────────────────────────────────
  for (const id of review_ids) {
    if (results.find(r => r.review_id === id)) continue
    const draft = draftResultMap.get(id)
    results.push({
      review_id: id,
      status: 'success',
      draft: draft ? {
        id: draft.id,
        draft_short:    draft.draft_short,
        draft_standard: draft.draft_standard,
        draft_careful:  draft.draft_careful,
        selected_reply: draft.selected_reply,
      } : undefined,
    })
  }

  return NextResponse.json({
    total:   review_ids.length,
    success: results.filter(r => r.status === 'success').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors:  results.filter(r => r.status === 'error').length,
    results,
  })
}

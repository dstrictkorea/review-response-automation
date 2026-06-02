import { createClient } from '@/lib/supabase/server'
import type { Review, ReviewTelemetry } from '@/types/database'
import ReviewsListClient, { type ServerPaginationProps } from './ReviewsListClient'
import ReviewsFilterPanel from './ReviewsFilterPanel'

interface BranchRow { code: string; name_ko: string; country_code: string | null }

interface SearchParams {
  branch?: string
  channel?: string
  status?: string
  risk?: string
  rating?: string
  q?: string
  date_from?: string
  date_to?: string
  page?: string
  limit?: string
}

const PAGE_SIZES = [10, 20, 50, 100]
const DEFAULT_LIMIT = 20

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const page  = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const limit = PAGE_SIZES.includes(Number(params.limit)) ? Number(params.limit) : DEFAULT_LIMIT
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  const qSafe = (params.q ?? '').replace(/[%,()]/g, ' ').trim()

  // ── rows 쿼리 (페이지네이션 + 정확한 total count) ───────────────────────────────
  let rowsQuery = supabase
    .from('reviews')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('review_created_at', { ascending: false, nullsFirst: false })
  if (params.branch)    rowsQuery = rowsQuery.eq('branch_code', params.branch)
  if (params.channel)   rowsQuery = rowsQuery.eq('channel_code', params.channel)
  if (params.status)    rowsQuery = rowsQuery.eq('status', params.status)
  if (params.risk)      rowsQuery = rowsQuery.eq('risk_level', params.risk)
  if (params.rating)    rowsQuery = rowsQuery.eq('rating', Number(params.rating))
  if (params.date_from) rowsQuery = rowsQuery.gte('review_created_at', params.date_from)
  if (params.date_to)   rowsQuery = rowsQuery.lte('review_created_at', params.date_to + 'T23:59:59')
  if (qSafe) rowsQuery = rowsQuery.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  rowsQuery = rowsQuery.range(from, to)

  // ── stats 쿼리 (필터 전체 집합, 경량 rating select) ───────────────────────────
  let statsQuery = supabase.from('reviews').select('rating').is('deleted_at', null)
  if (params.branch)    statsQuery = statsQuery.eq('branch_code', params.branch)
  if (params.channel)   statsQuery = statsQuery.eq('channel_code', params.channel)
  if (params.status)    statsQuery = statsQuery.eq('status', params.status)
  if (params.risk)      statsQuery = statsQuery.eq('risk_level', params.risk)
  if (params.rating)    statsQuery = statsQuery.eq('rating', Number(params.rating))
  if (params.date_from) statsQuery = statsQuery.gte('review_created_at', params.date_from)
  if (params.date_to)   statsQuery = statsQuery.lte('review_created_at', params.date_to + 'T23:59:59')
  if (qSafe) statsQuery = statsQuery.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)

  const [
    { data: rows, count },
    { data: statsRows },
    { data: branches },
    { data: channels },
  ] = await Promise.all([
    rowsQuery,
    statsQuery,
    supabase.from('branches').select('code, name_ko, country_code').eq('is_active', true).order('code'),
    supabase.from('channels').select('code, name').eq('is_active', true).order('code'),
  ])

  const pageReviews: Review[] = (rows ?? []) as unknown as Review[]
  const total = count ?? 0

  // ── 답변 초안 + 텔레메트리 조인 (현재 페이지 행만) ─────────────────────────────
  const reviewIds = pageReviews.map((r) => r.id)
  const { data: drafts } = reviewIds.length
    ? await supabase
        .from('reply_drafts')
        .select('review_id, selected_reply, intent_code, intent_confidence, pipeline_engine, model_name, prompt_version')
        .in('review_id', reviewIds)
    : { data: [] }

  const draftMap: Record<string, string> = {}
  const telemetryMap: Record<string, ReviewTelemetry> = {}
  for (const d of drafts ?? []) {
    if (d.selected_reply) draftMap[d.review_id] = d.selected_reply
    telemetryMap[d.review_id] = {
      intent_code:       d.intent_code ?? null,
      intent_confidence: d.intent_confidence ?? null,
      pipeline_engine:   d.pipeline_engine ?? null,
      model_name:        d.model_name ?? null,
      prompt_version:    d.prompt_version ?? null,
    }
  }

  // ── stats 계산 ─────────────────────────────────────────────────────────────────
  const ratings = (statsRows ?? [])
    .map((r: { rating: number | null }) => r.rating)
    .filter((x): x is number => x != null)
  const avgRating = ratings.length > 0 ? ratings.reduce((s, x) => s + x, 0) / ratings.length : null
  const ratingDist = ([5, 4, 3, 2, 1] as const).map((star) => ({
    star, count: ratings.filter((x) => x === star).length,
  }))

  // ── 보존 쿼리 (페이지네이션/필터 칩 외) ────────────────────────────────────────
  const preservedQuery: Record<string, string> = {}
  if (params.branch)    preservedQuery.branch = params.branch
  if (params.channel)   preservedQuery.channel = params.channel
  if (params.q)         preservedQuery.q = params.q
  if (params.date_from) preservedQuery.date_from = params.date_from
  if (params.date_to)   preservedQuery.date_to = params.date_to

  const serverProps: ServerPaginationProps = {
    page, limit, total,
    activeStatus: params.status ?? '',
    activeRisk:   params.risk ?? '',
    activeRating: params.rating ?? '',
    basePath: '/reviews',
    query: preservedQuery,
  }

  return (
    <div>
      <ReviewsFilterPanel
        branches={(branches ?? []) as BranchRow[]}
        channels={(channels ?? []) as { code: string; name: string }[]}
        params={params}
        total={total}
        avgRating={avgRating}
        ratingDist={ratingDist}
        ratingsLen={ratings.length}
      />

      <ReviewsListClient
        reviews={pageReviews}
        draftMap={draftMap}
        telemetryMap={telemetryMap}
        server={serverProps}
      />
    </div>
  )
}

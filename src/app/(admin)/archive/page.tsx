import { createClient } from '@/lib/supabase/server'
import type { Review, ReviewTelemetry } from '@/types/database'
import ReviewsListClient, { type ServerPaginationProps } from '../reviews/ReviewsListClient'
import ArchiveFilterBar from './ArchiveFilterBar'

/**
 * /archive — 보관함(아카이브) (Wave 17)
 *
 * 소프트 삭제된 리뷰(deleted_at IS NOT NULL)만 노출하는 "휴지통/보관함".
 * 서버사이드 URL 기반 페이지네이션(페이지당 20건 기본) + 전체 DB 정렬.
 * ReviewsListClient 를 archiveMode 로 재사용 → 복구(Restore) / 영구 삭제(Hard Delete) 액션만 노출.
 *
 * (참고: 게시완료/답변불필요/에스컬레이션 등 "처리 완료" 리뷰는 /reviews 의 상태 필터로 조회한다.)
 */

interface BranchRow { code: string; name_ko: string }

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
  sort?: string
  dir?: string
}

const PAGE_SIZES = [10, 20, 50, 100]
const DEFAULT_LIMIT = 20

// 정렬 키 → 실제 DB 컬럼 (전체 DB 기준 서버사이드 정렬)
const SORT_COLUMNS: Record<string, string> = {
  date: 'review_created_at',
  rating: 'rating',
  risk: 'risk_level',
  status: 'status',
}
type SortKey = 'date' | 'rating' | 'risk' | 'status'

export default async function ArchivePage({
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

  const sortKey: SortKey = (params.sort && SORT_COLUMNS[params.sort] ? params.sort : 'date') as SortKey
  const ascending = params.dir === 'asc'
  const sortColumn = SORT_COLUMNS[sortKey]

  // ── 보관함 행 쿼리 (deleted_at IS NOT NULL 만) ──────────────────────────────────
  let rowsQuery = supabase
    .from('reviews')
    .select('*', { count: 'exact' })
    .not('deleted_at', 'is', null)
    .order(sortColumn, { ascending, nullsFirst: false })
  if (params.branch)    rowsQuery = rowsQuery.eq('branch_code', params.branch)
  if (params.channel)   rowsQuery = rowsQuery.eq('channel_code', params.channel)
  if (params.status)    rowsQuery = rowsQuery.eq('status', params.status)
  if (params.risk)      rowsQuery = rowsQuery.eq('risk_level', params.risk)
  if (params.rating)    rowsQuery = rowsQuery.eq('rating', Number(params.rating))
  if (params.date_from) rowsQuery = rowsQuery.gte('review_created_at', params.date_from)
  if (params.date_to)   rowsQuery = rowsQuery.lte('review_created_at', params.date_to + 'T23:59:59')
  if (qSafe) rowsQuery = rowsQuery.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  rowsQuery = rowsQuery.range(from, to)

  const [
    { data: rows, count },
    { data: branches },
  ] = await Promise.all([
    rowsQuery,
    supabase.from('branches').select('code, name_ko').eq('is_active', true).order('code'),
  ])

  const pageReviews: Review[] = (rows ?? []) as unknown as Review[]
  const total = count ?? 0

  // ── 답변 초안 + 텔레메트리 조인 (현재 페이지 행만, 미리보기용) ──────────────────
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

  // ── 보존 쿼리 (정렬/필터 칩 네비게이션 시 유지) ────────────────────────────────
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
    activeSort:   sortKey,
    activeDir:    ascending ? 'asc' : 'desc',
    basePath: '/archive',
    query: preservedQuery,
  }

  return (
    <div>
      <ArchiveFilterBar
        branches={(branches ?? []) as BranchRow[]}
        params={params}
        total={total}
      />

      <ReviewsListClient
        reviews={pageReviews}
        draftMap={draftMap}
        telemetryMap={telemetryMap}
        server={serverProps}
        archiveMode
      />
    </div>
  )
}

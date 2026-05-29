import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Review, ReviewTelemetry } from '@/types/database'
import ReviewsListClient, { type ServerPaginationProps } from './ReviewsListClient'
import DateInput from './DateInput'

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
  let statsQuery = supabase.from('reviews').select('rating')
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
    supabase.from('branches').select('code, name_ko').eq('is_active', true).order('code'),
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">리뷰 목록</h2>
          <p className="text-sm text-gray-600 mt-1">총 {total}건</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reviews/import"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            CSV 가져오기
          </Link>
          <Link href="/reviews/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
            + 1건 등록
          </Link>
        </div>
      </div>

      {/* ── 서버사이드 필터 폼 (branch/channel/q/date) ── status/risk/rating은 퀵필터 칩 담당 ── */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">리뷰 내용 / 작성자 검색</label>
          <input type="text" name="q" defaultValue={params.q ?? ''}
            placeholder="검색어 (리뷰 내용, 작성자명, 지점/채널 코드)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">리뷰 작성일 (시작)</label>
            <DateInput name="date_from" defaultValue={params.date_from ?? ''} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">리뷰 작성일 (종료)</label>
            <DateInput name="date_to" defaultValue={params.date_to ?? ''} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">지점</label>
            <select name="branch" defaultValue={params.branch ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none">
              <option value="">전체</option>
              {(branches ?? []).map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name_ko}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">채널</label>
            <select name="channel" defaultValue={params.channel ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none">
              <option value="">전체</option>
              {(channels ?? []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {/* 퀵필터(상태/위험도/별점)는 URL 보존 — 폼 제출 시 hidden 동반 전송 */}
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.risk   && <input type="hidden" name="risk" value={params.risk} />}
        {params.rating && <input type="hidden" name="rating" value={params.rating} />}
        <div className="flex gap-2 mt-3">
          <button type="submit"
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
            필터 적용
          </button>
          <Link href="/reviews"
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            초기화
          </Link>
        </div>
      </form>

      {/* 통계 요약 (필터 전체 집합 기준) */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {(params.date_from || params.date_to) && (
            <div className="flex items-center gap-1 text-xs text-gray-500 border-r border-gray-200 pr-6">
              <span>📅</span><span>{params.date_from ?? '—'} ~ {params.date_to ?? '—'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">총</span>
            <span className="text-base font-bold text-gray-900">{total}건</span>
          </div>
          {avgRating !== null && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
              <span className="text-xs text-gray-500">평균 별점</span>
              <span className={`text-base font-bold ${avgRating >= 4.5 ? 'text-green-600' : avgRating >= 3.5 ? 'text-yellow-500' : 'text-red-500'}`}>★ {avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">/ 5.0</span>
            </div>
          )}
          {ratings.length > 0 && (
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              {ratingDist.filter((d) => d.count > 0).map(({ star, count }) => (
                <div key={star} className="flex items-center gap-1">
                  <span className="text-xs text-yellow-500 font-medium">{star}★</span>
                  <span className="text-xs font-semibold text-gray-700">{count}</span>
                  <span className="text-xs text-gray-400">({Math.round((count / ratings.length) * 100)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ReviewsListClient
        reviews={pageReviews}
        draftMap={draftMap}
        telemetryMap={telemetryMap}
        server={serverProps}
      />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel, Sentiment } from '@/types/database'
import ReviewsFilterPanel from '../reviews/ReviewsFilterPanel'

const sentimentLabel: Record<Sentiment, string> = {
  positive: '긍정',
  neutral: '중립',
  mixed: '복합',
  negative: '부정',
}

const ARCHIVE_STATUSES = ['manual_published', 'no_reply', 'escalated']

interface SearchParams {
  branch?: string
  channel?: string
  status?: string   // 보관 사유 (archive sub-status)
  rating?: string
  q?: string
  date_from?: string
  date_to?: string
}

interface BranchRow { code: string; name_ko: string; country_code: string | null }

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const qSafe = (params.q ?? '').replace(/[%,()]/g, ' ').trim()
  // 보관 사유 필터: 지정 시 해당 상태만, 미지정 시 아카이브 3종 전체
  const statusFilter = ARCHIVE_STATUSES.includes(params.status ?? '')
    ? [params.status as string]
    : ARCHIVE_STATUSES

  // rows 쿼리 (필터 + count)
  let rowsQuery = supabase.from('reviews').select('*', { count: 'exact' })
    .in('status', statusFilter).is('deleted_at', null)
  if (params.branch)    rowsQuery = rowsQuery.eq('branch_code', params.branch)
  if (params.channel)   rowsQuery = rowsQuery.eq('channel_code', params.channel)
  if (params.rating)    rowsQuery = rowsQuery.eq('rating', Number(params.rating))
  if (params.date_from) rowsQuery = rowsQuery.gte('review_created_at', params.date_from)
  if (params.date_to)   rowsQuery = rowsQuery.lte('review_created_at', params.date_to + 'T23:59:59')
  if (qSafe) rowsQuery = rowsQuery.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  rowsQuery = rowsQuery.order('updated_at', { ascending: false }).range(0, 199)

  // stats 쿼리 (rating)
  let statsQuery = supabase.from('reviews').select('rating')
    .in('status', statusFilter).is('deleted_at', null)
  if (params.branch)    statsQuery = statsQuery.eq('branch_code', params.branch)
  if (params.channel)   statsQuery = statsQuery.eq('channel_code', params.channel)
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

  const archived: Review[] = (rows ?? []) as unknown as Review[]
  const total = count ?? 0

  const ratings = (statsRows ?? [])
    .map((r: { rating: number | null }) => r.rating)
    .filter((x): x is number => x != null)
  const avgRating = ratings.length > 0 ? ratings.reduce((s, x) => s + x, 0) / ratings.length : null
  const ratingDist = ([5, 4, 3, 2, 1] as const).map((star) => ({
    star, count: ratings.filter((x) => x === star).length,
  }))

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
        archiveMode
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">처리일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">별점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">감성</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰 미리보기</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {archived.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  보관된 리뷰가 없습니다.
                </td>
              </tr>
            )}
            {archived.map((review) => (
              <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                  {new Date(review.updated_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-bold uppercase text-gray-900">{review.branch_code}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{review.channel_code}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {review.rating != null ? `${review.rating}★` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
                    {statusLabel(review.status as ReviewStatus)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {review.risk_level && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
                      {riskLabel(review.risk_level as RiskLevel)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {review.sentiment ? sentimentLabel[review.sentiment] : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                  {review.review_text?.slice(0, 60) ?? '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/reviews/${review.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                    상세보기
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

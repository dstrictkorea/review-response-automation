import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'

interface SearchParams {
  branch?: string
  channel?: string
  status?: string
  risk?: string
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase.from('reviews').select('*').order('created_at', { ascending: false })

  if (params.branch) query = query.eq('branch_code', params.branch)
  if (params.channel) query = query.eq('channel_code', params.channel)
  if (params.status) query = query.eq('status', params.status)
  if (params.risk) query = query.eq('risk_level', params.risk)

  const [{ data: reviews }, { data: branches }, { data: channels }] = await Promise.all([
    query,
    supabase.from('branches').select('code, name_ko').eq('is_active', true).order('code'),
    supabase.from('channels').select('code, name').eq('is_active', true).order('code'),
  ])

  const allReviews: Review[] = reviews ?? []

  const statuses: ReviewStatus[] = ['new', 'ai_done', 'approved', 'manual_published', 'no_reply', 'escalated']
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">리뷰 목록</h2>
          <p className="text-sm text-gray-600 mt-1">총 {allReviews.length}건</p>
        </div>
        <Link
          href="/reviews/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + 리뷰 등록
        </Link>
      </div>

      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">지점</label>
            <select
              name="branch"
              defaultValue={params.branch ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체</option>
              {(branches ?? []).map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} — {b.name_ko}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">채널</label>
            <select
              name="channel"
              defaultValue={params.channel ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체</option>
              {(channels ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
            <select
              name="status"
              defaultValue={params.status ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">위험도</label>
            <select
              name="risk"
              defaultValue={params.risk ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체</option>
              {riskLevels.map((r) => (
                <option key={r} value={r}>
                  {riskLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            필터 적용
          </button>
          <Link
            href="/reviews"
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            초기화
          </Link>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">등록일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">별점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰 미리보기</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allReviews.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  해당 조건의 리뷰가 없습니다.
                </td>
              </tr>
            )}
            {allReviews.map((review) => (
              <tr
                key={review.id}
                className={`hover:bg-gray-50 transition-colors ${
                  review.risk_level === 'critical' || review.risk_level === 'high'
                    ? 'bg-red-50 hover:bg-red-100'
                    : ''
                }`}
              >
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                  {new Date(review.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{review.branch_code}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{review.channel_code}</td>
                <td className="px-4 py-3 text-gray-700">
                  {review.rating != null ? `${review.rating}★` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}
                  >
                    {statusLabel(review.status as ReviewStatus)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {review.risk_level && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}
                    >
                      {riskLabel(review.risk_level as RiskLevel)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-sm truncate text-xs">
                  {review.review_text?.slice(0, 60) ?? '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/reviews/${review.id}`}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
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

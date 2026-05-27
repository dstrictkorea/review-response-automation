import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusLabel, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import ReviewsListClient from './ReviewsListClient'

interface SearchParams {
  branch?: string
  channel?: string
  status?: string
  risk?: string
  q?: string
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

  const searchText = (params.q ?? '').toLowerCase()
  const allReviews: Review[] = (reviews ?? []).filter((r) => {
    if (!searchText) return true
    return (
      r.review_text?.toLowerCase().includes(searchText) ||
      r.reviewer_name?.toLowerCase().includes(searchText) ||
      r.branch_code.toLowerCase().includes(searchText) ||
      r.channel_code.toLowerCase().includes(searchText)
    )
  })

  const statuses: ReviewStatus[] = ['new', 'ai_done', 'approved', 'manual_published', 'no_reply', 'escalated']
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">리뷰 목록</h2>
          <p className="text-sm text-gray-600 mt-1">총 {allReviews.length}건</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reviews/import"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            CSV 가져오기
          </Link>
          <Link
            href="/reviews/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + 1건 등록
          </Link>
        </div>
      </div>

      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        {/* 텍스트 검색 */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">리뷰 내용 / 작성자 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="검색어를 입력하세요 (리뷰 내용, 작성자명, 지점/채널 코드)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

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

      <ReviewsListClient reviews={allReviews} />
    </div>
  )
}

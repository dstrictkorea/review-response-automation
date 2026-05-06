import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })

  const allReviews: Review[] = reviews ?? []

  const stats = {
    total: allReviews.length,
    new: allReviews.filter((r) => r.status === 'new').length,
    ai_done: allReviews.filter((r) => r.status === 'ai_done').length,
    escalated: allReviews.filter((r) => r.status === 'escalated').length,
    high_risk: allReviews.filter(
      (r) => r.risk_level === 'high' || r.risk_level === 'critical'
    ).length,
    published_this_month: allReviews.filter((r) => {
      if (r.status !== 'manual_published') return false
      const d = new Date(r.updated_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
  }

  const recent = allReviews.slice(0, 10)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-600 mt-1">리뷰 응대 현황 요약</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: '전체 리뷰', value: stats.total, color: 'text-gray-900' },
          { label: '신규', value: stats.new, color: 'text-blue-700' },
          { label: 'AI 완료', value: stats.ai_done, color: 'text-purple-700' },
          { label: '에스컬레이션', value: stats.escalated, color: 'text-red-700' },
          { label: '고위험', value: stats.high_risk, color: 'text-orange-700' },
          { label: '이번달 게시', value: stats.published_this_month, color: 'text-teal-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">최근 리뷰</h3>
          <Link href="/reviews" className="text-xs text-blue-600 hover:underline">
            전체 보기
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">등록일</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">별점</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">미리보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                    등록된 리뷰가 없습니다.
                  </td>
                </tr>
              )}
              {recent.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(review.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{review.branch_code}</td>
                  <td className="px-4 py-3 text-gray-700">{review.channel_code}</td>
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
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    <Link href={`/reviews/${review.id}`} className="hover:text-blue-600 hover:underline">
                      {review.review_text?.slice(0, 50) ?? '-'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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

  const needsAction = allReviews.filter((r) => r.status === 'new' || r.status === 'ai_done').length
  const responded = allReviews.filter((r) => r.status === 'manual_published').length
  const responseRate = allReviews.length > 0 ? Math.round((responded / allReviews.length) * 100) : 0

  const statCards = [
    { label: '전체 리뷰', value: allReviews.length, color: 'text-gray-900', href: '/reviews' },
    { label: '신규 접수', value: allReviews.filter((r) => r.status === 'new').length, color: 'text-blue-700', href: '/reviews?status=new' },
    { label: 'AI 초안 완료', value: allReviews.filter((r) => r.status === 'ai_done').length, color: 'text-purple-700', href: '/reviews?status=ai_done' },
    { label: '에스컬레이션', value: allReviews.filter((r) => r.status === 'escalated').length, color: 'text-red-700', href: '/reviews?status=escalated' },
    { label: '고위험', value: allReviews.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length, color: 'text-orange-700', href: '/reviews?risk=high' },
    { label: '이번달 게시', value: allReviews.filter((r) => {
      if (r.status !== 'manual_published') return false
      const d = new Date(r.updated_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length, color: 'text-teal-700', href: '/reviews?status=manual_published' },
  ]

  const recent = allReviews.slice(0, 10)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-600 mt-1">리뷰 응대 현황 요약</p>
      </div>

      {/* 응답률 + 즉시 처리 필요 배너 */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4">
          <p className="text-xs text-blue-600 font-medium mb-1">전체 응답률</p>
          <p className="text-2xl font-bold text-blue-700">{responseRate}%</p>
          <p className="text-xs text-blue-500 mt-1">{responded}건 게시 완료</p>
        </div>
        <Link
          href="/reviews?status=new"
          className={`rounded-xl border px-4 py-4 transition-all hover:shadow-sm ${
            needsAction > 0
              ? 'bg-orange-50 border-orange-300 hover:border-orange-400'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <p className="text-xs font-medium mb-1 text-orange-600">즉시 처리 필요</p>
          <p className={`text-2xl font-bold ${needsAction > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {needsAction}건
          </p>
          <p className="text-xs text-orange-500 mt-1">신규 + AI완료 미승인</p>
        </Link>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">전체 리뷰 수</p>
          <p className="text-2xl font-bold text-gray-900">{allReviews.length}</p>
          <p className="text-xs text-gray-400 mt-1">누적</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">미응답 (에스컬레이션)</p>
          <p className="text-2xl font-bold text-red-700">
            {allReviews.filter((r) => r.status === 'escalated').length}
          </p>
          <p className="text-xs text-gray-400 mt-1">검토 필요</p>
        </div>
      </div>

      {/* 상태별 통계 카드 — 클릭 시 필터 이동 */}
      <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white rounded-xl border border-gray-200 px-4 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      {/* 최근 리뷰 테이블 */}
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
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {new Date(review.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{review.branch_code}</td>
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
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    <Link href={`/reviews/${review.id}`} className="hover:text-blue-600 hover:underline text-xs">
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

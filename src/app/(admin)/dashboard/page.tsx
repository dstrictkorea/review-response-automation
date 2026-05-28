import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusClasses, statusLabel, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import ReviewsListClient from '../reviews/ReviewsListClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 전체 리뷰 (통계용) + 처리 대기 리뷰 (배치용) 병렬 조회
  const [{ data: allData }, { data: pendingData }] = await Promise.all([
    supabase.from('reviews').select('*').order('created_at', { ascending: false }),
    supabase
      .from('reviews')
      .select('*')
      .in('status', ['new', 'ai_done'])
      .order('review_created_at', { ascending: false }),
  ])

  const allReviews: Review[] = allData ?? []
  const pendingReviews: Review[] = pendingData ?? []

  const newCount = allReviews.filter((r) => r.status === 'new').length
  const aiDoneCount = allReviews.filter((r) => r.status === 'ai_done').length
  const responded = allReviews.filter((r) => r.status === 'manual_published').length
  const responseRate = allReviews.length > 0 ? Math.round((responded / allReviews.length) * 100) : 0

  // 이번달 게시 수
  const thisMonthPublished = allReviews.filter((r) => {
    if (r.status !== 'manual_published') return false
    const d = new Date(r.updated_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const statCards = [
    { label: '전체 리뷰', value: allReviews.length, color: 'text-gray-900', href: '/reviews' },
    { label: '신규 접수', value: newCount, color: 'text-blue-700', href: '/reviews?status=new' },
    { label: 'AI 초안 완료', value: aiDoneCount, color: 'text-purple-700', href: '/reviews?status=ai_done' },
    { label: '에스컬레이션', value: allReviews.filter((r) => r.status === 'escalated').length, color: 'text-red-700', href: '/reviews?status=escalated' },
    { label: '고위험', value: allReviews.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length, color: 'text-orange-700', href: '/reviews?risk=high' },
    { label: '이번달 게시', value: thisMonthPublished, color: 'text-teal-700', href: '/reviews?status=manual_published' },
  ]

  // 최근 완료·게시된 리뷰 5건 (활동 피드용)
  const recentActivity = allReviews
    .filter((r) => r.status === 'manual_published' || r.status === 'approved')
    .slice(0, 5)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-600 mt-1">리뷰 응대 현황 요약</p>
      </div>

      {/* ── 상단 지표 카드 ────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4">
          <p className="text-xs text-blue-600 font-medium mb-1">전체 응답률</p>
          <p className="text-2xl font-bold text-blue-700">{responseRate}%</p>
          <p className="text-xs text-blue-500 mt-1">{responded}건 게시 완료</p>
        </div>
        <Link
          href="/reviews?status=new"
          className={`rounded-xl border px-4 py-4 transition-all hover:shadow-sm ${
            newCount > 0 ? 'bg-orange-50 border-orange-300 hover:border-orange-400' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <p className="text-xs font-medium mb-1 text-orange-600">신규 — 답변 대기</p>
          <p className={`text-2xl font-bold ${newCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{newCount}건</p>
          <p className="text-xs text-orange-500 mt-1">즉시 처리 가능</p>
        </Link>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">AI 초안 완료 — 승인 대기</p>
          <p className={`text-2xl font-bold ${aiDoneCount > 0 ? 'text-purple-700' : 'text-gray-400'}`}>{aiDoneCount}건</p>
          <p className="text-xs text-gray-400 mt-1">검토 후 게시 가능</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-xs text-gray-500 mb-1">미응답 (에스컬레이션)</p>
          <p className="text-2xl font-bold text-red-700">
            {allReviews.filter((r) => r.status === 'escalated').length}
          </p>
          <p className="text-xs text-gray-400 mt-1">검토 필요</p>
        </div>
      </div>

      {/* ── 상태별 통계 카드 ──────────────────────────────────────────────────── */}
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

      {/* ── 처리 대기 리뷰 — 배치 처리 ──────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">처리 대기 리뷰</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              신규({newCount}건) + AI완료({aiDoneCount}건) — 체크박스 선택 후 일괄 답변 생성
            </p>
          </div>
          <Link href="/reviews?status=new" className="text-xs text-blue-600 hover:underline">
            전체 리뷰 보기 →
          </Link>
        </div>

        {pendingReviews.length > 0 ? (
          <ReviewsListClient reviews={pendingReviews} defaultStatusFilter="new" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-gray-500 text-sm">처리 대기 중인 리뷰가 없습니다 ✓</p>
            <p className="text-gray-400 text-xs mt-1">모든 리뷰가 처리된 상태입니다.</p>
          </div>
        )}
      </div>

      {/* ── 최근 처리 완료 ─────────────────────────────────────────────────────── */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">최근 처리 완료</h3>
            <Link href="/reviews?status=manual_published" className="text-xs text-blue-600 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">작성일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">별점</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentActivity.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {new Date(review.review_created_at ?? review.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{review.branch_code}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{review.channel_code}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-medium">
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
                    <td className="px-4 py-3 text-gray-600 max-w-xs text-xs">
                      <Link href={`/reviews/${review.id}`} className="hover:text-blue-600 hover:underline truncate block">
                        {review.review_text?.slice(0, 50) ?? '-'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

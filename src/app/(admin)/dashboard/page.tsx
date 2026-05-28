import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusClasses, statusLabel, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import ReviewsListClient from '../reviews/ReviewsListClient'
import DashboardStats from './DashboardStats'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: allData }, { data: pendingData }] = await Promise.all([
    // Project only fields needed for DashboardStats (counts/ratings/dates) and recentActivity table.
    // Avoids transferring heavy fields (review_text bulk, import metadata) for the full-dataset query.
    supabase
      .from('reviews')
      .select('id, branch_code, channel_code, rating, review_text, review_created_at, created_at, status, risk_level, sentiment')
      .order('created_at', { ascending: false }),
    // Pending list: full projection needed by ReviewsListClient for display + editing
    supabase
      .from('reviews')
      .select('id, branch_code, channel_code, source_review_id, review_url, reviewer_name, rating, review_text, review_language, review_created_at, status, risk_level, categories, risk_reasons, sentiment, internal_note_ko, normalized_hash, created_at, updated_at')
      .in('status', ['new', 'ai_done', 'pending_approval'])
      .order('review_created_at', { ascending: false }),
  ])

  const allReviews: Review[]     = allData     ?? []
  const pendingReviews: Review[] = pendingData ?? []

  // 대기 리뷰 답변 초안 미리보기
  const pendingIds = pendingReviews.map(r => r.id)
  const { data: pendingDrafts } = pendingIds.length
    ? await supabase
        .from('reply_drafts')
        .select('review_id, selected_reply')
        .in('review_id', pendingIds)
    : { data: [] }

  const pendingDraftMap: Record<string, string> = {}
  for (const d of pendingDrafts ?? []) {
    if (d.selected_reply) pendingDraftMap[d.review_id] = d.selected_reply
  }

  const newCount             = allReviews.filter(r => r.status === 'new').length
  const aiDoneCount          = allReviews.filter(r => r.status === 'ai_done').length
  const pendingApprovalCount = allReviews.filter(r => r.status === 'pending_approval').length

  // 최근 완료·게시된 리뷰 5건
  const recentActivity = allReviews
    .filter(r => r.status === 'manual_published' || r.status === 'approved')
    .slice(0, 5)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-600 mt-1">리뷰 응대 현황 요약</p>
      </div>

      {/* ── 기간별 지표 (클라이언트 컴포넌트) ───────────────────────────────── */}
      <DashboardStats allReviews={allReviews} />

      {/* ── 처리 대기 리뷰 ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">처리 대기 리뷰</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              신규({newCount}건) + AI완료({aiDoneCount}건) + AI격리({pendingApprovalCount}건) — 체크박스 선택 후 일괄 답변 생성
            </p>
          </div>
          <Link href="/reviews?status=new" className="text-xs text-blue-600 hover:underline">
            전체 리뷰 보기 →
          </Link>
        </div>

        {pendingReviews.length > 0 ? (
          <ReviewsListClient reviews={pendingReviews} draftMap={pendingDraftMap} defaultStatusFilter="new" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-gray-500 text-sm">처리 대기 중인 리뷰가 없습니다 ✓</p>
            <p className="text-gray-400 text-xs mt-1">모든 리뷰가 처리된 상태입니다.</p>
          </div>
        )}
      </div>

      {/* ── 최근 처리 완료 ──────────────────────────────────────────────────── */}
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
                {recentActivity.map(review => (
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
                    <td className="px-4 py-3 text-gray-600 max-w-0 w-full text-xs">
                      <Link href={`/reviews/${review.id}`} className="hover:text-blue-600 hover:underline truncate block break-words">
                        {review.review_text?.slice(0, 60) ?? '-'}
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

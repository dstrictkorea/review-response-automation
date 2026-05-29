import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusClasses, statusLabel, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import ReviewsListClient from '../reviews/ReviewsListClient'
import DashboardStats from './DashboardStats'
import DashboardFilterBar from './DashboardFilterBar'
import DashboardCharts from '@/components/dashboard/DashboardCharts'

const PENDING_PAGE_SIZE = 20

// ── URL builder used by pagination links (preserves branch + channel params) ──
function pageUrl(page: number, branch: string, channel: string): string {
  const params = new URLSearchParams()
  if (branch)  params.set('branch',  branch)
  if (channel) params.set('channel', channel)
  if (page > 1) params.set('pending_page', String(page))
  const qs = params.toString()
  return qs ? `/dashboard?${qs}` : '/dashboard'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    pending_page?: string
    branch?: string
    channel?: string
  }>
}) {
  const params      = await searchParams
  const page        = Math.max(1, parseInt(params.pending_page ?? '1', 10))
  const offset      = (page - 1) * PENDING_PAGE_SIZE
  const activeBranch  = params.branch  ?? ''
  const activeChannel = params.channel ?? ''

  const supabase = await createClient()

  // ── Parallel fetch: all stats + pending page + filter option lists ──────────
  const [
    { data: allData },
    pendingResult,
    { data: branches },
    { data: channels },
  ] = await Promise.all([
    // Full dataset (filtered by branch/channel) — used by DashboardStats
    (() => {
      let q = supabase
        .from('reviews')
        .select(
          'id, branch_code, channel_code, rating, review_text, review_created_at, created_at, status, risk_level, sentiment',
        )
        .order('created_at', { ascending: false })
      if (activeBranch)  q = q.eq('branch_code',  activeBranch)
      if (activeChannel) q = q.eq('channel_code', activeChannel)
      return q
    })(),

    // Pending list — same branch/channel filter + status filter + pagination
    (() => {
      let q = supabase
        .from('reviews')
        .select(
          'id, branch_code, channel_code, source_review_id, review_url, reviewer_name, rating, review_text, review_language, review_created_at, status, risk_level, categories, risk_reasons, sentiment, internal_note_ko, normalized_hash, created_at, updated_at',
          { count: 'exact' },
        )
        .in('status', ['new', 'ai_done', 'pending_approval'])
        .order('review_created_at', { ascending: false })
        .range(offset, offset + PENDING_PAGE_SIZE - 1)
      if (activeBranch)  q = q.eq('branch_code',  activeBranch)
      if (activeChannel) q = q.eq('channel_code', activeChannel)
      return q
    })(),

    // Filter option lists (fetched once per render; cheap query)
    supabase.from('branches').select('code, name_ko, name_en').eq('is_active', true).order('code'),
    supabase.from('channels').select('code, name').eq('is_active', true).order('code'),
  ])

  const pendingData       = pendingResult.data
  const pendingTotal      = pendingResult.count ?? 0
  const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / PENDING_PAGE_SIZE))

  const allReviews: Review[]     = (allData     ?? []) as unknown as Review[]
  const pendingReviews: Review[] = (pendingData ?? []) as unknown as Review[]

  // ── Draft preview map for pending list ──────────────────────────────────────
  const pendingIds = pendingReviews.map((r) => r.id)
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

  // ── Status counters (derived from the branch/channel-filtered full set) ─────
  const newCount             = allReviews.filter((r) => r.status === 'new').length
  const aiDoneCount          = allReviews.filter((r) => r.status === 'ai_done').length
  const pendingApprovalCount = allReviews.filter((r) => r.status === 'pending_approval').length

  // ── Recent activity (last 5 published / approved) ───────────────────────────
  const recentActivity = allReviews
    .filter((r) => r.status === 'manual_published' || r.status === 'approved')
    .slice(0, 5)

  // ── Pagination page number list (ellipsis compression) ─────────────────────
  type PageItem = number | '...'
  const pageItems: PageItem[] = Array.from({ length: pendingTotalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === pendingTotalPages || Math.abs(p - page) <= 1)
    .reduce<PageItem[]>((acc, p, idx, arr) => {
      if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) {
        acc.push('...')
      }
      acc.push(p)
      return acc
    }, [])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
        <p className="text-sm text-gray-600 mt-1">리뷰 응대 현황 요약</p>
      </div>

      {/* ── 글로벌 지점·채널 필터 ────────────────────────────────────────────── */}
      <DashboardFilterBar
        branches={branches ?? []}
        channels={channels ?? []}
        currentBranch={activeBranch}
        currentChannel={activeChannel}
      />

      {/* ── 기간별 지표 (클라이언트 컴포넌트) ───────────────────────────────── */}
      <DashboardStats allReviews={allReviews} />

      {/* ── 지점별 차트 ─────────────────────────────────────────────────────── */}
      <DashboardCharts allData={allReviews} />

      {/* ── 처리 대기 리뷰 ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">처리 대기 리뷰</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              신규({newCount}건) + AI완료({aiDoneCount}건) + AI격리({pendingApprovalCount}건)
              {(activeBranch || activeChannel) && (
                <span className="ml-1.5 text-blue-600 font-medium">
                  — {[activeBranch, activeChannel].filter(Boolean).join(' · ')} 필터 적용
                </span>
              )}
              {' '}— 체크박스 선택 후 일괄 답변 생성
            </p>
          </div>
          <Link href="/reviews?status=new" className="text-xs text-blue-600 hover:underline">
            전체 리뷰 보기 →
          </Link>
        </div>

        {pendingReviews.length > 0 ? (
          <>
            <ReviewsListClient
              reviews={pendingReviews}
              draftMap={pendingDraftMap}
              defaultStatusFilter="new"
            />

            {/* ── 페이지네이션 UI ────────────────────────────────────────────── */}
            {pendingTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-xs text-gray-500">
                  {pendingTotal}건 중 {offset + 1}–{Math.min(offset + PENDING_PAGE_SIZE, pendingTotal)}건
                </p>
                <div className="flex items-center gap-1">
                  {page > 1 && (
                    <Link
                      href={pageUrl(page - 1, activeBranch, activeChannel)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      ← 이전
                    </Link>
                  )}

                  {pageItems.map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-xs text-gray-400">
                        …
                      </span>
                    ) : (
                      <Link
                        key={p}
                        href={pageUrl(p, activeBranch, activeChannel)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          p === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </Link>
                    ),
                  )}

                  {page < pendingTotalPages && (
                    <Link
                      href={pageUrl(page + 1, activeBranch, activeChannel)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      다음 →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-gray-500 text-sm">처리 대기 중인 리뷰가 없습니다 ✓</p>
            <p className="text-gray-400 text-xs mt-1">
              {activeBranch || activeChannel
                ? '선택한 필터 조건에 해당하는 대기 리뷰가 없습니다.'
                : '모든 리뷰가 처리된 상태입니다.'}
            </p>
          </div>
        )}
      </div>

      {/* ── 최근 처리 완료 ──────────────────────────────────────────────────── */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">최근 처리 완료</h3>
            <Link
              href="/reviews?status=manual_published"
              className="text-xs text-blue-600 hover:underline"
            >
              전체 보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    작성일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    지점
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-20">
                    채널
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-16">
                    별점
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    위험도
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentActivity.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {new Date(review.review_created_at ?? review.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 truncate">
                      {review.branch_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 truncate">{review.channel_code}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-medium whitespace-nowrap">
                      {review.rating != null ? `${review.rating}★` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(
                          review.status as ReviewStatus,
                        )}`}
                      >
                        {statusLabel(review.status as ReviewStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {review.risk_level && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(
                            review.risk_level as RiskLevel,
                          )}`}
                        >
                          {riskLabel(review.risk_level as RiskLevel)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-0 w-full text-xs">
                      <Link
                        href={`/reviews/${review.id}`}
                        className="hover:text-blue-600 hover:underline truncate block break-words"
                      >
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

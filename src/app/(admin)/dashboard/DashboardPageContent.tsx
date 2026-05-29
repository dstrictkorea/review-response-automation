'use client'

/**
 * DashboardPageContent
 *
 * Client shell for dashboard/page.tsx — receives all pre-fetched data as props
 * and renders the full dashboard UI with 4-language support via LanguageContext.
 *
 * The server component (page.tsx) remains responsible for all DB queries.
 * This component is responsible only for rendering + i18n.
 */

import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { LANG_LOCALE } from '@/lib/i18n'
import { statusClasses, riskClasses } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import ReviewsListClient from '../reviews/ReviewsListClient'
import DashboardStats from './DashboardStats'
import DashboardFilterBar from './DashboardFilterBar'
import DashboardCharts from '@/components/dashboard/DashboardCharts'

type PageItem = number | '...'

export interface Branch {
  code: string
  name_ko: string
  name_en: string
}

export interface Channel {
  code: string
  name: string
}

export interface DashboardPageContentProps {
  allReviews:         Review[]
  pendingReviews:     Review[]
  pendingDraftMap:    Record<string, string>
  pendingTotal:       number
  page:               number
  offset:             number
  pendingTotalPages:  number
  activeBranch:       string
  activeChannel:      string
  branches:           Branch[]
  channels:           Channel[]
  isDirector:         boolean
  isolatedReviews:    Review[]
  newCount:           number
  aiDoneCount:        number
  pendingApprovalCount: number
  recentActivity:     Review[]
  pageItems:          PageItem[]
}

export default function DashboardPageContent({
  allReviews,
  pendingReviews,
  pendingDraftMap,
  pendingTotal,
  page,
  offset,
  pendingTotalPages,
  activeBranch,
  activeChannel,
  branches,
  channels,
  isDirector,
  isolatedReviews,
  newCount,
  aiDoneCount,
  pendingApprovalCount,
  recentActivity,
  pageItems,
}: DashboardPageContentProps) {
  const { lang, t } = useLanguage()
  const locale = LANG_LOCALE[lang]

  // ── Locale-aware date formatter ────────────────────────────────────────────
  function fmtDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale)
  }

  // ── Pagination URL builder ─────────────────────────────────────────────────
  function pageUrl(p: number, branch: string, channel: string): string {
    const params = new URLSearchParams()
    if (branch)  params.set('branch',  branch)
    if (channel) params.set('channel', channel)
    if (p > 1)   params.set('pending_page', String(p))
    const qs = params.toString()
    return qs ? `/dashboard?${qs}` : '/dashboard'
  }

  // ── Translated badge labels ────────────────────────────────────────────────
  function tStatus(status: ReviewStatus): string {
    const map: Record<ReviewStatus, string> = {
      new:               t.status_new,
      ai_done:           t.status_ai_done,
      pending_approval:  t.status_pending_approval,
      approved:          t.status_approved,
      manual_published:  t.status_published,
      no_reply:          t.status_no_reply,
      escalated:         t.status_escalated,
      failed:            t.status_failed,
    }
    return map[status] ?? status
  }

  function tRisk(risk: RiskLevel | null): string {
    if (!risk) return '-'
    const map: Record<RiskLevel, string> = {
      low:      t.risk_low,
      medium:   t.risk_medium,
      high:     t.risk_high,
      critical: t.risk_critical,
    }
    return map[risk]
  }

  const PENDING_PAGE_SIZE = 20

  return (
    <div>
      {/* ── 페이지 헤더 ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t.dash_title}</h2>
        <p className="text-sm text-gray-600 mt-1">{t.dash_subtitle}</p>
      </div>

      {/* ── 글로벌 지점·채널 필터 ────────────────────────────────────────────── */}
      <DashboardFilterBar
        branches={branches}
        channels={channels}
        currentBranch={activeBranch}
        currentChannel={activeChannel}
      />

      {/* ── 기간별 지표 ──────────────────────────────────────────────────────── */}
      <DashboardStats allReviews={allReviews} />

      {/* ── 지점별 차트 ──────────────────────────────────────────────────────── */}
      <DashboardCharts allData={allReviews} />

      {/* ── 🚨 Director 전용: 고위험 격리 리뷰 ──────────────────────────────── */}
      {isDirector && isolatedReviews.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">🚨</span>
              <div>
                <h3 className="text-sm font-bold text-red-800">{t.dash_isolated_title}</h3>
                <p className="text-xs text-red-600 mt-0.5">
                  {t.dash_isolated_desc} — {isolatedReviews.length}{t.stat_unit}
                </p>
              </div>
            </div>
            <Link
              href="/reviews?status=pending_approval"
              className="text-xs text-red-600 hover:underline font-medium"
            >
              {t.dash_view_all_isolated}
            </Link>
          </div>

          <div className="rounded-xl border-2 border-red-200 overflow-hidden">
            <table className="w-full text-sm table-fixed min-w-[540px]">
              <thead>
                <tr className="bg-red-50 border-b border-red-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-red-700 whitespace-nowrap w-24">
                    {t.dash_col_risk}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-red-700 whitespace-nowrap w-24">
                    {t.dash_col_branch}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-red-700 whitespace-nowrap w-20">
                    {t.dash_col_channel}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-red-700 whitespace-nowrap w-14">
                    {t.dash_col_rating}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-red-700 whitespace-nowrap w-24">
                    {t.dash_col_date}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-red-700">
                    {t.dash_col_preview}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 bg-white">
                {isolatedReviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-red-50 transition-colors">
                    <td className="px-4 py-3">
                      {rev.risk_level && (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${riskClasses(rev.risk_level as RiskLevel)}`}>
                          {tRisk(rev.risk_level as RiskLevel)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 truncate">
                      {rev.branch_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 truncate">
                      {rev.channel_code}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {rev.rating != null ? `${rev.rating}★` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(rev.review_created_at ?? rev.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-0 w-full">
                      <Link
                        href={`/reviews/${rev.id}`}
                        className="hover:text-red-700 hover:underline font-medium block truncate"
                      >
                        {t.dash_review_link}{' '}
                        <span className="font-normal text-gray-600">
                          {rev.review_text?.slice(0, 80) ?? '-'}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 처리 대기 리뷰 ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t.dash_pending_title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.status_new}({newCount}{t.stat_unit})
              {' + '}
              {t.status_ai_done}({aiDoneCount}{t.stat_unit})
              {' + '}
              {t.status_pending_approval}({pendingApprovalCount}{t.stat_unit})
              {(activeBranch || activeChannel) && (
                <span className="ml-1.5 text-blue-600 font-medium">
                  — {[activeBranch, activeChannel].filter(Boolean).join(' · ')} {t.dash_filter_active}
                </span>
              )}
              {' — '}{t.dash_pending_hint}
            </p>
          </div>
          <Link href="/reviews?status=new" className="text-xs text-blue-600 hover:underline">
            {t.dash_pending_view_all}
          </Link>
        </div>

        {pendingReviews.length > 0 ? (
          <>
            <ReviewsListClient
              reviews={pendingReviews}
              draftMap={pendingDraftMap}
              defaultStatusFilter="new"
            />

            {/* ── 페이지네이션 ────────────────────────────────────────────── */}
            {pendingTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-xs text-gray-500">
                  {pendingTotal}{t.stat_unit} {lang === 'ko' ? '중' : '/'}{' '}
                  {offset + 1}–{Math.min(offset + PENDING_PAGE_SIZE, pendingTotal)}{t.stat_unit}
                </p>
                <div className="flex items-center gap-1">
                  {page > 1 && (
                    <Link
                      href={pageUrl(page - 1, activeBranch, activeChannel)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t.dash_prev}
                    </Link>
                  )}

                  {pageItems.map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-xs text-gray-400">…</span>
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
                      {t.dash_next}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center">
            <p className="text-gray-500 text-sm">{t.dash_no_pending}</p>
            <p className="text-gray-400 text-xs mt-1">
              {activeBranch || activeChannel
                ? t.dash_no_pending_filtered
                : t.dash_all_done}
            </p>
          </div>
        )}
      </div>

      {/* ── 최근 처리 완료 ──────────────────────────────────────────────────── */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">{t.dash_recent_title}</h3>
            <Link
              href="/reviews?status=manual_published"
              className="text-xs text-blue-600 hover:underline"
            >
              {t.dash_view_all}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    {t.dash_col_date}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    {t.dash_col_branch}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-20">
                    {t.dash_col_channel}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-16">
                    {t.dash_col_rating}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    {t.dash_col_status}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-24">
                    {t.dash_col_risk}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    {t.dash_col_review}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentActivity.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {fmtDate(review.review_created_at ?? review.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 truncate">
                      {review.branch_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 truncate">
                      {review.channel_code}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-medium whitespace-nowrap">
                      {review.rating != null ? `${review.rating}★` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
                        {tStatus(review.status as ReviewStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {review.risk_level && (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
                          {tRisk(review.risk_level as RiskLevel)}
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

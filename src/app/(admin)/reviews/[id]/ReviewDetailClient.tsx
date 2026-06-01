'use client'

import { useState, useTransition } from 'react'
import type { Review, ReplyDraft, ActivityLog, ReviewStatus, RiskLevel, UserRole } from '@/types/database'
import { statusClasses, riskClasses } from '@/lib/badges'
import { approveReview, escalateReview, markNoReply, markPublished, saveDraft, resetReviewStatus, deleteReview } from './actions'
import ReviewActionPanel, { type ReviewPanelAction } from '@/components/dashboard/ReviewActionPanel'
import { useLanguage } from '@/context/LanguageContext'
import { LANG_LOCALE, type I18nDict } from '@/lib/i18n'
import { branchCity } from '@/lib/branches'

interface Props {
  review: Review
  draft: ReplyDraft | null
  logs: ActivityLog[]
  userRole: UserRole
}

const ACTIVE_STATUSES = new Set(['new', 'ai_done', 'pending_approval', 'approved'])

/** 경과 일수 — 모듈 레벨 헬퍼 (렌더 중 Date.now() 직접 호출 회피) */
function elapsedDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

/** 템플릿 문자열 보간 — {key} → 값 */
function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

// ── i18n 매핑 헬퍼 ────────────────────────────────────────────────────────────────
function tStatus(t: I18nDict, s: ReviewStatus): string {
  const m: Record<ReviewStatus, string> = {
    new: t.status_new, ai_done: t.status_ai_done, pending_approval: t.status_pending_approval,
    approved: t.status_approved, manual_published: t.status_published, no_reply: t.status_no_reply,
    escalated: t.status_escalated, failed: t.status_failed,
  }
  return m[s] ?? s
}
function tRisk(t: I18nDict, r: RiskLevel): string {
  const m: Record<RiskLevel, string> = { low: t.risk_low, medium: t.risk_medium, high: t.risk_high, critical: t.risk_critical }
  return m[r]
}
function tSentiment(t: I18nDict, s: string): string {
  const m: Record<string, string> = {
    positive: t.rd_sent_positive, neutral: t.rd_sent_neutral, mixed: t.rd_sent_mixed, negative: t.rd_sent_negative,
  }
  return m[s] ?? s
}
function tForbidden(t: I18nDict, key: string): string {
  const m: Record<string, string> = {
    refund_promise: t.rd_fb_refund, legal_admission: t.rd_fb_legal, cctv_mention: t.rd_fb_cctv, staff_discipline: t.rd_fb_staff,
  }
  return m[key] ?? key
}
function tActionLog(t: I18nDict, action: string): string {
  const m: Record<string, string> = {
    review_registered: t.rd_act_registered,
    ai_draft_generated: t.rd_act_ai_generated,
    algo_draft_generated: t.rd_act_ai_generated,
    review_isolated: t.rd_act_ai_generated,
    reply_edited: t.rd_act_edited,
    review_approved: t.rd_act_approved,
    review_escalated: t.rd_act_escalated,
    review_no_reply: t.rd_act_no_reply,
    review_published: t.rd_act_published,
    google_reply_posted: t.rd_act_published,
    webhook_reply_posted: t.rd_act_published,
  }
  return m[action] ?? action
}

// 현재 상태에서 되돌릴 수 있는 상태 맵 (로직)
const REVERT_STATUS: Partial<Record<string, string>> = {
  ai_done: 'new',
  pending_approval: 'new',
  approved: 'ai_done',
  manual_published: 'approved',
  no_reply: 'new',
  escalated: 'new',
}
function tRevertLabel(t: I18nDict, status: string): string {
  const m: Record<string, string> = {
    ai_done: t.rd_revert_to_new,
    pending_approval: t.rd_revert_to_new,
    approved: t.rd_revert_to_ai_done,
    manual_published: t.rd_revert_to_approved,
    no_reply: t.rd_revert_to_new,
    escalated: t.rd_revert_to_new,
  }
  return m[status] ?? t.rd_revert_to_new
}

/**
 * 채널별 관리자(답변 등록) 페이지 URL 매핑.
 * review.review_url 이 있으면 해당 URL 을 우선 사용.
 */
const CHANNEL_ADMIN_URLS: Record<string, string> = {
  naver:       'https://smartplace.naver.com/business/review',
  kakao:       'https://place.map.kakao.com',
  tripadvisor: 'https://www.tripadvisor.com/Management',
  klook:       'https://partner.klook.com/activity/review',
  'trip.com':  'https://ebooking.trip.com',
}

function getChannelAdminUrl(channelCode: string, reviewUrl?: string | null): string {
  if (reviewUrl) return reviewUrl
  return CHANNEL_ADMIN_URLS[channelCode.toLowerCase()] ?? ''
}

export default function ReviewDetailClient({ review: initialReview, draft: initialDraft, logs: initialLogs, userRole }: Props) {
  const { lang, t } = useLanguage()
  const locale = LANG_LOCALE[lang]

  const [review, setReview] = useState(initialReview)
  const [draft, setDraft] = useState(initialDraft)
  const [logs] = useState(initialLogs)
  const [selectedTab, setSelectedTab] = useState<'standard' | 'short' | 'careful'>('standard')
  const [editedReply, setEditedReply] = useState(initialDraft?.human_edited_reply ?? '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isGooglePosting, setIsGooglePosting] = useState(false)

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setActionMessage(t.rd_toast_copied)
    setTimeout(() => setActionMessage(null), 2000)
  }

  async function generateDraft() {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error ?? t.rd_toast_gen_fail)
        return
      }
      setDraft(data.draft)
      setReview((r) => ({ ...r, status: 'ai_done', risk_level: data.risk_level, sentiment: data.sentiment, categories: data.categories }))
      setEditedReply(data.draft?.draft_standard ?? '')
    } catch {
      setGenerateError(t.rd_toast_server_err)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleGooglePost() {
    if (!editedReply.trim()) {
      setActionMessage(t.rd_toast_enter_reply)
      return
    }
    if (!confirm(t.rd_confirm_google)) return
    setIsGooglePosting(true)
    try {
      const res = await fetch('/api/google/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, comment: editedReply }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMessage(fmt(t.rd_toast_google_fail, { error: data.error ?? t.rd_unknown_error }))
      } else {
        setActionMessage(t.rd_toast_google_ok)
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch {
      setActionMessage(t.rd_toast_server_err)
    } finally {
      setIsGooglePosting(false)
    }
  }

  /** 비 Google 채널 전용: 답변 클립보드 복사 + 관리자 페이지 새 탭 열기 */
  async function handleCopyAndOpen() {
    if (!editedReply.trim()) {
      setActionMessage(t.rd_toast_enter_reply)
      return
    }
    try {
      await navigator.clipboard.writeText(editedReply)
    } catch {
      /* clipboard API 지원 안 하는 환경 — 무시 */
    }
    const adminUrl = getChannelAdminUrl(review.channel_code, review.review_url)
    if (adminUrl) window.open(adminUrl, '_blank', 'noopener,noreferrer')
    setActionMessage(adminUrl ? t.rd_toast_copy_opened : t.rd_toast_copy_manual)
  }

  /**
   * 통합 자동 게시 — /api/review/publish 호출
   * Google: GBP API, 웹훅 설정 채널: 웹훅, 그 외: 클립보드 fallback
   */
  async function handleAutoPublish() {
    if (!editedReply.trim()) {
      setActionMessage(t.rd_toast_enter_reply)
      return
    }
    if (!confirm(fmt(t.rd_confirm_publish, { channel: review.channel_code }))) return

    setIsGooglePosting(true)
    try {
      const res = await fetch('/api/review/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, finalReply: editedReply }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMessage(fmt(t.rd_toast_publish_fail, { error: data.error ?? t.rd_unknown_error }))
      } else if (data.method === 'fallback_manual') {
        // 웹훅·API 미설정 채널 → 클립보드 복사 + 플랫폼 이동으로 fallback
        await handleCopyAndOpen()
      } else {
        setActionMessage(t.rd_toast_published)
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch {
      setActionMessage(t.rd_toast_server_err)
    } finally {
      setIsGooglePosting(false)
    }
  }

  async function handleReprocess() {
    setIsReprocessing(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/review/re-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error ?? t.rd_toast_reanalyze_fail)
        return
      }
      setDraft(data.draft)
      setReview((r) => ({
        ...r,
        status: data.review?.status ?? r.status,
        risk_level: data.review?.risk_level ?? r.risk_level,
        sentiment: data.review?.sentiment ?? r.sentiment,
        categories: data.review?.categories ?? r.categories,
        risk_reasons: data.review?.risk_reasons ?? r.risk_reasons,
      }))
      setEditedReply(data.draft?.draft_standard ?? '')
    } catch {
      setGenerateError(t.rd_toast_server_err)
    } finally {
      setIsReprocessing(false)
    }
  }

  function handleAction(fn: () => Promise<{ success?: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.error) {
        setActionMessage(fmt(t.rd_toast_error, { error: result.error }))
      } else {
        setActionMessage(successMsg)
        window.location.reload()
      }
    })
  }

  /** ReviewActionPanel 액션 → 기존 서버 액션으로 매핑 */
  function handlePanelAction(action: ReviewPanelAction) {
    switch (action) {
      case 'publish':
        handleAutoPublish()
        break
      case 'escalate':
        // 관장 결재 요청 = 에스컬레이션
        handleAction(() => escalateReview(review.id), t.rd_toast_request_director)
        break
      case 'approve':
        // director: 전결 승인 (승인 후 바로 게시 완료 처리)
        handleAction(async () => {
          const approveResult = await approveReview(review.id, editedReply)
          if (approveResult.error) return approveResult
          return markPublished(review.id)
        }, t.rd_toast_approve_publish)
        break
      case 'hq_escalate':
        // 본사 이관 = 에스컬레이션 (HQ)
        handleAction(() => escalateReview(review.id), t.rd_toast_hq_escalate)
        break
    }
  }

  const selectedDraftText =
    selectedTab === 'short' ? draft?.draft_short :
    selectedTab === 'careful' ? draft?.draft_careful :
    draft?.draft_standard

  const isHighRisk = review.risk_level === 'high' || review.risk_level === 'critical'
  const canApprove = review.status === 'ai_done' || review.status === 'pending_approval' || review.status === 'approved'
  const canPublish = review.status === 'approved'

  const isActive = ACTIVE_STATUSES.has(review.status)
  const reviewDateStr = review.review_created_at ?? null
  const elapsedDays = elapsedDaysSince(reviewDateStr)
  const elapsedShort = elapsedDays === null ? null : elapsedDays === 0 ? t.rv_today : `${elapsedDays}d`
  const isSlaWarning = isActive && elapsedDays !== null && elapsedDays >= 3
  const cityName = branchCity(review.branch_code, lang)

  return (
    <div className="space-y-5">
      {/* AI 격리 배너 — pending_approval */}
      {review.status === 'pending_approval' && (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-400 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600 font-bold text-xl">⚠</span>
            <p className="text-sm font-bold text-amber-900">{t.rd_isolated_title}</p>
          </div>
          <p className="text-xs text-amber-800 mb-3">{t.rd_isolated_desc}</p>
          {(review.risk_reasons ?? []).length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-amber-800 mb-1">{t.rd_risk_reasons}</p>
              <ul className="space-y-0.5">
                {(review.risk_reasons ?? []).map((reason, i) => (
                  <li key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">▸</span>{reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft?.forbidden_check && Object.entries(draft.forbidden_check).some(([, v]) => v === true) && (
            <div className="mt-2 rounded-lg bg-rose-50 border border-rose-300 px-3 py-2">
              <p className="text-xs font-semibold text-rose-700 mb-1">{t.rd_forbidden_detected}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {Object.entries(draft.forbidden_check)
                  .filter(([, v]) => v === true)
                  .map(([key]) => (
                    <span key={key} className="text-xs text-rose-800 font-medium">✗ {tForbidden(t, key)}</span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SLA 경고 배너 */}
      {isSlaWarning && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 px-5 py-3 flex items-center gap-3">
          <span className="text-amber-600 font-bold text-lg">!</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">{t.rd_sla_title}</p>
            <p className="text-xs text-amber-700">{fmt(t.rd_sla_desc, { days: elapsedDays ?? 0 })}</p>
          </div>
        </div>
      )}

      {/* Review info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
            {tStatus(t, review.status as ReviewStatus)}
          </span>
          {review.risk_level && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
              {t.rd_label_risk}: {tRisk(t, review.risk_level as RiskLevel)}
            </span>
          )}
          {review.sentiment && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {t.rd_label_sentiment}: {tSentiment(t, review.sentiment)}
            </span>
          )}
          {(review.categories ?? []).map((c) => (
            <span key={c} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">
              {c}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4 sm:grid-cols-4">
          <div>
            <span className="text-gray-500">{t.rd_label_branch}</span>
            <p className="font-mono font-bold uppercase tracking-wide text-gray-900">
              {review.branch_code}
              {cityName && <span className="ml-1.5 font-sans font-normal text-xs text-gray-500">{cityName}</span>}
            </p>
          </div>
          <div>
            <span className="text-gray-500">{t.rd_label_channel}</span>
            <p className="font-medium text-gray-900">{review.channel_code}</p>
          </div>
          <div>
            <span className="text-gray-500">{t.rd_label_rating}</span>
            <p className="font-medium text-gray-900">{review.rating != null ? `${review.rating}★` : '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">{t.rd_label_date}</span>
            <p className="font-medium text-gray-900">
              {review.review_created_at
                ? new Date(review.review_created_at).toLocaleDateString(locale)
                : '-'}
              {elapsedShort && (
                <span className={`ml-2 text-xs font-normal ${isSlaWarning ? 'text-amber-600' : 'text-gray-400'}`}>
                  ({elapsedShort})
                </span>
              )}
            </p>
          </div>
        </div>

        {review.reviewer_name && (
          <p className="text-xs text-gray-500 mb-2">{t.rd_label_reviewer}: {review.reviewer_name}</p>
        )}
        {review.review_url && (
          <p className="text-xs text-gray-500 mb-3">
            URL:{' '}
            <a href={review.review_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {review.review_url}
            </a>
          </p>
        )}

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">{t.rd_review_original}</p>
          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{review.review_text}</p>
        </div>

        {review.internal_note_ko && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <p className="text-xs font-medium text-blue-700 mb-1">{t.rd_ai_note}</p>
            <p className="text-sm text-blue-900">{review.internal_note_ko}</p>
          </div>
        )}

        {(review.risk_reasons ?? []).length > 0 && (
          <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
            <p className="text-xs font-medium text-orange-700 mb-1">{t.rd_risk_reasons}</p>
            <ul className="text-sm text-orange-900 list-disc list-inside space-y-0.5">
              {(review.risk_reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* High risk warning */}
      {isHighRisk && (
        <div className="rounded-xl bg-red-50 border border-red-300 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">{t.rd_highrisk_title}</p>
          <p className="text-sm text-red-700 mt-1">{t.rd_highrisk_desc}</p>
        </div>
      )}

      {/* AI Draft section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{t.rd_ai_draft_title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={generateDraft}
              disabled={isGenerating || isReprocessing}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {isGenerating ? t.rd_generating : draft ? t.rd_regenerate : t.rd_generate}
            </button>
            <button
              onClick={handleReprocess}
              disabled={isReprocessing || isGenerating}
              title={t.rd_reanalyze_title}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {isReprocessing ? t.rd_analyzing : t.rd_reanalyze}
            </button>
          </div>
        </div>

        {generateError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {generateError}
          </div>
        )}

        {draft ? (
          <>
            <div className="flex gap-1 mb-3 border-b border-gray-200">
              {(['standard', 'short', 'careful'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    selectedTab === tab
                      ? 'border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'standard' ? t.rd_tab_standard : tab === 'short' ? t.rd_tab_short : t.rd_tab_careful}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-3">
              <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                {selectedDraftText ?? t.rd_no_draft_variant}
              </p>
              {selectedDraftText && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      copyText(selectedDraftText)
                      setEditedReply(selectedDraftText)
                    }}
                    className="rounded bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {t.rd_apply_to_editor}
                  </button>
                </div>
              )}
            </div>

            {draft.forbidden_check && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 mb-3">
                <p className="text-xs font-medium text-gray-600 mb-2">{t.rd_forbidden_check}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {Object.entries(draft.forbidden_check).map(([key, val]) => (
                    <div key={key} className={`flex items-center gap-1.5 ${val ? 'text-red-700' : 'text-green-700'}`}>
                      <span>{val ? '✗' : '✓'}</span>
                      <span>{tForbidden(t, key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-8 text-center">
            <p className="text-sm text-gray-500">{t.rd_no_draft_yet}</p>
          </div>
        )}
      </div>

      {/* Human edit section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">{t.rd_final_edit}</h3>
          {editedReply && (
            <button
              onClick={() => copyText(editedReply)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t.rd_copy_reply}
            </button>
          )}
        </div>

        <textarea
          value={editedReply}
          onChange={(e) => setEditedReply(e.target.value)}
          rows={8}
          placeholder={t.rd_editor_placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
        />
        <p className={`text-xs text-right mt-1 ${editedReply.length > 1000 ? 'text-amber-600' : 'text-gray-400'}`}>
          {fmt(t.rd_chars, { n: editedReply.length.toLocaleString() })}
        </p>

        <div className="mt-2">
          <button
            onClick={() => {
              if (draft) {
                startTransition(async () => {
                  await saveDraft(review.id, editedReply)
                  setActionMessage(t.rd_toast_temp_saved)
                })
              }
            }}
            disabled={isPending || !draft}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {t.rd_temp_save}
          </button>
        </div>
      </div>

      {/* 역할 기반 주요 액션 패널 */}
      <ReviewActionPanel
        role={userRole}
        channel={review.channel_code}
        riskLevel={review.risk_level ?? null}
        isLoading={isPending || isGooglePosting}
        onAction={handlePanelAction}
      />

      {/* director 전용: 고급 처리 옵션 */}
      {userRole === 'director' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.rd_advanced}</h3>

          <div className="flex flex-wrap gap-3">
            {canApprove && (
              <button
                onClick={() =>
                  handleAction(
                    () => approveReview(review.id, editedReply),
                    t.rd_toast_approved
                  )
                }
                disabled={isPending || !editedReply.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {t.rd_approve}
              </button>
            )}

            {/* Google 리뷰: 직접 API 게시 */}
            {canPublish && review.channel_code === 'google' && (
              <button
                onClick={handleGooglePost}
                disabled={isPending || isGooglePosting || !editedReply.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGooglePosting ? t.rd_posting : t.rd_google_post}
              </button>
            )}

            {/* 비 Google 채널: 답변 복사 + 관리자 딥링크 원클릭 */}
            {canPublish && review.channel_code !== 'google' && (
              <button
                onClick={handleCopyAndOpen}
                disabled={isPending || !editedReply.trim()}
                title={
                  getChannelAdminUrl(review.channel_code, review.review_url)
                    ? fmt(t.rd_copy_and_open_title, { channel: review.channel_code })
                    : t.rd_copy_only_title
                }
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {t.rd_copy_and_open}
              </button>
            )}

            {/* 게시 완료 확인 버튼 — 모든 채널 (플랫폼에 실제 게시한 뒤 클릭) */}
            {canPublish && (
              <button
                onClick={() => handleAction(() => markPublished(review.id), t.rd_toast_mark_published)}
                disabled={isPending}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {review.channel_code === 'google' ? t.rd_mark_published_manual : t.rd_mark_published}
              </button>
            )}

            {review.status !== 'no_reply' && review.status !== 'manual_published' && (
              <button
                onClick={() => handleAction(() => markNoReply(review.id), t.rd_toast_mark_no_reply)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {t.rd_no_reply}
              </button>
            )}

            {review.status !== 'escalated' && (
              <button
                onClick={() => handleAction(() => escalateReview(review.id), t.rd_toast_escalated)}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {t.rd_escalate}
              </button>
            )}

            {/* 상태 되돌리기 */}
            {REVERT_STATUS[review.status] && (
              <button
                onClick={() =>
                  handleAction(
                    () => resetReviewStatus(review.id, REVERT_STATUS[review.status]!),
                    t.rd_toast_reverted
                  )
                }
                disabled={isPending}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                ↩ {tRevertLabel(t, review.status)}
              </button>
            )}
          </div>

          {actionMessage && (
            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              {actionMessage}
            </div>
          )}
        </div>
      )}

      {/* marketing_staff 전용: 액션 결과 메시지 */}
      {userRole === 'marketing_staff' && actionMessage && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-3 text-sm text-green-700">
          {actionMessage}
        </div>
      )}

      {/* 리뷰 삭제 */}
      <div className="bg-white rounded-xl border border-red-100 p-5">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">{t.rd_danger_zone}</h3>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            {t.rd_delete}
          </button>
        ) : (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-800 mb-1">{t.rd_delete_confirm_title}</p>
            <p className="text-xs text-red-600 mb-3">{t.rd_delete_confirm_desc}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  startTransition(async () => {
                    await deleteReview(review.id)
                  })
                }}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? t.rd_deleting : t.rd_delete_confirm_btn}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t.rd_cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.rd_history}</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">{t.rd_no_history}</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {logs.map((log) => (
              <li key={log.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-400" />
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {tActionLog(t, log.action)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString(locale)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{log.actor_name}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

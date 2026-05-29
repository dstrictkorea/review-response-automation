'use client'

import { useState, useTransition } from 'react'
import type { Review, ReplyDraft, ActivityLog, ReviewStatus, RiskLevel, UserRole } from '@/types/database'
import { statusLabel, statusClasses, riskLabel, riskClasses } from '@/lib/badges'
import { approveReview, escalateReview, markNoReply, markPublished, saveDraft, resetReviewStatus, deleteReview } from './actions'
import ReviewActionPanel, { type ReviewPanelAction } from '@/components/dashboard/ReviewActionPanel'

interface Props {
  review: Review
  draft: ReplyDraft | null
  logs: ActivityLog[]
  userRole: UserRole
}

const actionLabels: Record<string, string> = {
  review_registered: '리뷰 등록',
  ai_draft_generated: 'AI 초안 생성',
  reply_edited: '답변 수정',
  review_approved: '승인',
  review_escalated: '에스컬레이션',
  review_no_reply: '답변 불필요 처리',
  review_published: '게시 완료',
}

const sentimentKo: Record<string, string> = {
  positive: '긍정',
  neutral: '중립',
  mixed: '복합',
  negative: '부정',
}

const ACTIVE_STATUSES = new Set(['new', 'ai_done', 'pending_approval', 'approved'])

function elapsedLabel(dateStr: string | null): string | null {
  if (!dateStr) return null
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000)
  if (hours < 24) return '오늘'
  if (hours < 48) return '어제'
  return `${Math.floor(hours / 24)}일 전`
}

// 현재 상태에서 되돌릴 수 있는 상태 맵
const REVERT_STATUS: Partial<Record<string, string>> = {
  ai_done: 'new',
  pending_approval: 'new',
  approved: 'ai_done',
  manual_published: 'approved',
  no_reply: 'new',
  escalated: 'new',
}

const REVERT_LABEL: Partial<Record<string, string>> = {
  ai_done: '신규로 되돌리기',
  pending_approval: '신규로 되돌리기',
  approved: 'AI완료로 되돌리기',
  manual_published: '승인됨으로 되돌리기',
  no_reply: '신규로 되돌리기',
  escalated: '신규로 되돌리기',
}

/**
 * 채널별 관리자(답변 등록) 페이지 URL 매핑.
 * review.review_url 이 있으면 해당 URL 을 우선 사용.
 * 없으면 채널 코드로 관리 콘솔 홈을 연다.
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
    setActionMessage('클립보드에 복사되었습니다.')
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
        setGenerateError(data.error ?? 'AI 초안 생성에 실패했습니다.')
        return
      }
      setDraft(data.draft)
      setReview((r) => ({ ...r, status: 'ai_done', risk_level: data.risk_level, sentiment: data.sentiment, categories: data.categories }))
      setEditedReply(data.draft?.draft_standard ?? '')
    } catch {
      setGenerateError('서버 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleGooglePost() {
    if (!editedReply.trim()) {
      setActionMessage('게시할 답변을 입력해주세요.')
      return
    }
    if (!confirm('Google 비즈니스 프로필에 이 답변을 직접 게시하시겠습니까?\n게시 후에는 Google에서 직접 수정해야 합니다.')) return
    setIsGooglePosting(true)
    try {
      const res = await fetch('/api/google/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, comment: editedReply }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMessage(`Google 게시 실패: ${data.error ?? '알 수 없는 오류'}`)
      } else {
        setActionMessage('Google에 성공적으로 게시되었습니다!')
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch {
      setActionMessage('서버 오류가 발생했습니다.')
    } finally {
      setIsGooglePosting(false)
    }
  }

  /** 비 Google 채널 전용: 답변 클립보드 복사 + 관리자 페이지 새 탭 열기 */
  async function handleCopyAndOpen() {
    if (!editedReply.trim()) {
      setActionMessage('게시할 답변을 입력해주세요.')
      return
    }
    try {
      await navigator.clipboard.writeText(editedReply)
    } catch {
      /* clipboard API 지원 안 하는 환경 — 무시 */
    }
    const adminUrl = getChannelAdminUrl(review.channel_code, review.review_url)
    if (adminUrl) window.open(adminUrl, '_blank', 'noopener,noreferrer')
    setActionMessage(
      adminUrl
        ? '✓ 답변 복사 완료 — 새 탭이 열렸습니다. 붙여넣기 후 "게시 완료 처리"를 눌러주세요.'
        : '✓ 답변 복사 완료 — 플랫폼 관리자 페이지에 접속해 붙여넣기 후 "게시 완료 처리"를 눌러주세요.',
    )
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
        setGenerateError(data.error ?? 'AI 재분석에 실패했습니다.')
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
      setGenerateError('서버 오류가 발생했습니다.')
    } finally {
      setIsReprocessing(false)
    }
  }

  function handleAction(fn: () => Promise<{ success?: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.error) {
        setActionMessage(`오류: ${result.error}`)
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
        // marketing_staff: Google이면 직접 게시, 아니면 복사+이동
        if (review.channel_code === 'google') {
          handleGooglePost()
        } else {
          handleCopyAndOpen()
        }
        break
      case 'escalate':
        // 관장 결재 요청 = 에스컬레이션
        handleAction(() => escalateReview(review.id), '관장 결재 요청이 접수되었습니다.')
        break
      case 'approve':
        // director: 전결 승인 (승인 후 바로 게시 완료 처리)
        handleAction(async () => {
          const approveResult = await approveReview(review.id, editedReply)
          if (approveResult.error) return approveResult
          return markPublished(review.id)
        }, '지점장 전결 승인 및 게시 완료 처리되었습니다.')
        break
      case 'hq_escalate':
        // 본사 이관 = 에스컬레이션 (HQ)
        handleAction(() => escalateReview(review.id), '본사(HQ) 이관 처리되었습니다.')
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
  const elapsedStr = elapsedLabel(reviewDateStr)
  const elapsedDays = reviewDateStr
    ? Math.floor((Date.now() - new Date(reviewDateStr).getTime()) / 86400000)
    : null
  const isSlaWarning = isActive && elapsedDays !== null && elapsedDays >= 3

  return (
    <div className="space-y-5">
      {/* AI 격리 배너 — pending_approval */}
      {review.status === 'pending_approval' && (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-400 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600 font-bold text-xl">⚠</span>
            <p className="text-sm font-bold text-amber-900">AI 격리됨 — 2차 검토 필요</p>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            이 리뷰는 AI가 위험 요소를 감지하여 자동 격리했습니다. 반드시 직접 검토 후 승인하세요.
          </p>
          {(review.risk_reasons ?? []).length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-amber-800 mb-1">위험 사유</p>
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
              <p className="text-xs font-semibold text-rose-700 mb-1">⛔ 금지 표현 감지</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {Object.entries(draft.forbidden_check)
                  .filter(([, v]) => v === true)
                  .map(([key]) => {
                    const labels: Record<string, string> = {
                      refund_promise: '환불 약속',
                      legal_admission: '법적 책임 인정',
                      cctv_mention: 'CCTV 언급',
                      staff_discipline: '직원 징계 약속',
                    }
                    return (
                      <span key={key} className="text-xs text-rose-800 font-medium">✗ {labels[key] ?? key}</span>
                    )
                  })}
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
            <p className="text-sm font-semibold text-amber-800">응답 지연 주의</p>
            <p className="text-xs text-amber-700">
              이 리뷰가 작성된 지 <strong>{elapsedDays}일</strong>이 지났습니다. 빠른 답변 처리가 필요합니다.
            </p>
          </div>
        </div>
      )}

      {/* Review info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
            {statusLabel(review.status as ReviewStatus)}
          </span>
          {review.risk_level && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
              위험도: {riskLabel(review.risk_level as RiskLevel)}
            </span>
          )}
          {review.sentiment && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              감성: {sentimentKo[review.sentiment] ?? review.sentiment}
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
            <span className="text-gray-500">지점</span>
            <p className="font-medium text-gray-900">{review.branch_code}</p>
          </div>
          <div>
            <span className="text-gray-500">채널</span>
            <p className="font-medium text-gray-900">{review.channel_code}</p>
          </div>
          <div>
            <span className="text-gray-500">별점</span>
            <p className="font-medium text-gray-900">{review.rating != null ? `${review.rating}★` : '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">작성일</span>
            <p className="font-medium text-gray-900">
              {review.review_created_at
                ? new Date(review.review_created_at).toLocaleDateString('ko-KR')
                : '-'}
              {elapsedStr && (
                <span className={`ml-2 text-xs font-normal ${isSlaWarning ? 'text-amber-600' : 'text-gray-400'}`}>
                  ({elapsedStr})
                </span>
              )}
            </p>
          </div>
        </div>

        {review.reviewer_name && (
          <p className="text-xs text-gray-500 mb-2">작성자: {review.reviewer_name}</p>
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
          <p className="text-xs font-medium text-gray-500 mb-2">리뷰 원문</p>
          <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{review.review_text}</p>
        </div>

        {review.internal_note_ko && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <p className="text-xs font-medium text-blue-700 mb-1">AI 내부 메모</p>
            <p className="text-sm text-blue-900">{review.internal_note_ko}</p>
          </div>
        )}

        {(review.risk_reasons ?? []).length > 0 && (
          <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
            <p className="text-xs font-medium text-orange-700 mb-1">위험 사유</p>
            <ul className="text-sm text-orange-900 list-disc list-inside space-y-0.5">
              {(review.risk_reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* High risk warning */}
      {isHighRisk && (
        <div className="rounded-xl bg-red-50 border border-red-300 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">⚠ 고위험 리뷰</p>
          <p className="text-sm text-red-700 mt-1">
            이 리뷰는 고위험으로 분류되었습니다. 반드시 직접 검토 후 답변을 작성하세요.
            환불 약속, 법적 책임 인정, CCTV 확인, 직원 징계 약속은 절대 포함하지 마세요.
          </p>
        </div>
      )}

      {/* AI Draft section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-900">AI 답변 초안</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={generateDraft}
              disabled={isGenerating || isReprocessing}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {isGenerating ? '생성 중...' : draft ? 'AI 재생성' : 'AI 초안 생성'}
            </button>
            <button
              onClick={handleReprocess}
              disabled={isReprocessing || isGenerating}
              title="IntelligentOrchestrator로 AI 재분석 — 위험도 재평가 및 초안 재생성"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {isReprocessing ? '분석 중...' : '🔄 AI 재분석'}
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
                  {tab === 'standard' ? '표준' : tab === 'short' ? '짧게' : '조심스럽게'}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-3">
              <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                {selectedDraftText ?? '해당 초안이 없습니다.'}
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
                    편집란에 적용
                  </button>
                </div>
              )}
            </div>

            {draft.forbidden_check && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 mb-3">
                <p className="text-xs font-medium text-gray-600 mb-2">금지 표현 검사</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {Object.entries(draft.forbidden_check).map(([key, val]) => {
                    const labels: Record<string, string> = {
                      refund_promise: '환불 약속',
                      legal_admission: '법적 책임 인정',
                      cctv_mention: 'CCTV 언급',
                      staff_discipline: '직원 징계 약속',
                    }
                    return (
                      <div key={key} className={`flex items-center gap-1.5 ${val ? 'text-red-700' : 'text-green-700'}`}>
                        <span>{val ? '✗' : '✓'}</span>
                        <span>{labels[key] ?? key}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-8 text-center">
            <p className="text-sm text-gray-500">아직 AI 초안이 없습니다. 위 버튼을 눌러 생성하세요.</p>
          </div>
        )}
      </div>

      {/* Human edit section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">최종 답변 편집</h3>
          {editedReply && (
            <button
              onClick={() => copyText(editedReply)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              답변 복사
            </button>
          )}
        </div>

        <textarea
          value={editedReply}
          onChange={(e) => setEditedReply(e.target.value)}
          rows={8}
          placeholder="여기에 최종 답변을 작성하거나 붙여넣으세요. 외부 플랫폼에 직접 복사하여 게시하세요."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
        />
        <p className={`text-xs text-right mt-1 ${editedReply.length > 1000 ? 'text-amber-600' : 'text-gray-400'}`}>
          {editedReply.length.toLocaleString()}자
        </p>

        <div className="mt-2">
          <button
            onClick={() => {
              if (draft) {
                startTransition(async () => {
                  await saveDraft(review.id, editedReply)
                  setActionMessage('임시 저장되었습니다.')
                })
              }
            }}
            disabled={isPending || !draft}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            임시 저장
          </button>
        </div>
      </div>

      {/* 역할 기반 주요 액션 패널 */}
      <ReviewActionPanel
        role={userRole}
        channel={review.channel_code}
        isLoading={isPending || isGooglePosting}
        onAction={handlePanelAction}
      />

      {/* director 전용: 고급 처리 옵션 */}
      {userRole === 'director' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">고급 처리 옵션</h3>

          <div className="flex flex-wrap gap-3">
            {canApprove && (
              <button
                onClick={() =>
                  handleAction(
                    () => approveReview(review.id, editedReply),
                    '답변이 승인되었습니다.'
                  )
                }
                disabled={isPending || !editedReply.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                승인
              </button>
            )}

            {/* Google 리뷰: 직접 API 게시 */}
            {canPublish && review.channel_code === 'google' && (
              <button
                onClick={handleGooglePost}
                disabled={isPending || isGooglePosting || !editedReply.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGooglePosting ? '게시 중...' : '🔵 Google에 직접 게시'}
              </button>
            )}

            {/* 비 Google 채널: 답변 복사 + 관리자 딥링크 원클릭 */}
            {canPublish && review.channel_code !== 'google' && (
              <button
                onClick={handleCopyAndOpen}
                disabled={isPending || !editedReply.trim()}
                title={
                  getChannelAdminUrl(review.channel_code, review.review_url)
                    ? `답변을 복사하고 ${review.channel_code} 관리자 페이지를 새 탭으로 엽니다`
                    : '답변을 클립보드에 복사합니다'
                }
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                📋 답변 복사 + 관리자 이동
              </button>
            )}

            {/* 게시 완료 확인 버튼 — 모든 채널 (플랫폼에 실제 게시한 뒤 클릭) */}
            {canPublish && (
              <button
                onClick={() => handleAction(() => markPublished(review.id), '게시 완료 처리되었습니다.')}
                disabled={isPending}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {review.channel_code === 'google' ? '수동 게시 완료 처리' : '✓ 게시 완료 처리'}
              </button>
            )}

            {review.status !== 'no_reply' && review.status !== 'manual_published' && (
              <button
                onClick={() => handleAction(() => markNoReply(review.id), '답변 불필요 처리되었습니다.')}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                답변 불필요
              </button>
            )}

            {review.status !== 'escalated' && (
              <button
                onClick={() => handleAction(() => escalateReview(review.id), '에스컬레이션 처리되었습니다.')}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                에스컬레이션
              </button>
            )}

            {/* 상태 되돌리기 */}
            {REVERT_STATUS[review.status] && (
              <button
                onClick={() =>
                  handleAction(
                    () => resetReviewStatus(review.id, REVERT_STATUS[review.status]!),
                    '상태가 되돌려졌습니다.'
                  )
                }
                disabled={isPending}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                ↩ {REVERT_LABEL[review.status]}
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
        <h3 className="text-sm font-semibold text-gray-500 mb-3">위험 구역</h3>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            리뷰 삭제
          </button>
        ) : (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-800 mb-1">정말 삭제하시겠습니까?</p>
            <p className="text-xs text-red-600 mb-3">
              이 리뷰와 관련된 모든 초안, 처리 이력이 영구 삭제됩니다. 되돌릴 수 없습니다.
            </p>
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
                {isPending ? '삭제 중...' : '삭제 확인'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">처리 이력</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">이력이 없습니다.</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {logs.map((log) => (
              <li key={log.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-400" />
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {actionLabels[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString('ko-KR')}
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

'use client'

import { useState, useTransition } from 'react'
import type { Review, ReplyDraft, ActivityLog, ReviewStatus, RiskLevel } from '@/types/database'
import { statusLabel, statusClasses, riskLabel, riskClasses } from '@/lib/badges'
import { approveReview, escalateReview, markNoReply, markPublished, saveDraft } from './actions'

interface Props {
  review: Review
  draft: ReplyDraft | null
  logs: ActivityLog[]
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

export default function ReviewDetailClient({ review: initialReview, draft: initialDraft, logs: initialLogs }: Props) {
  const [review, setReview] = useState(initialReview)
  const [draft, setDraft] = useState(initialDraft)
  const [logs] = useState(initialLogs)
  const [selectedTab, setSelectedTab] = useState<'standard' | 'short' | 'careful'>('standard')
  const [editedReply, setEditedReply] = useState(initialDraft?.human_edited_reply ?? '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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

  function handleAction(fn: () => Promise<{ success?: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.error) {
        setActionMessage(`오류: ${result.error}`)
      } else {
        setActionMessage(successMsg)
        // Reload the page to reflect new status
        window.location.reload()
      }
    })
  }

  const selectedDraftText =
    selectedTab === 'short' ? draft?.draft_short :
    selectedTab === 'careful' ? draft?.draft_careful :
    draft?.draft_standard

  const isHighRisk = review.risk_level === 'high' || review.risk_level === 'critical'
  const canApprove = review.status === 'ai_done' || review.status === 'approved'
  const canPublish = review.status === 'approved'

  return (
    <div className="space-y-5">
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
              감성: {review.sentiment}
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
              {review.review_created_at ? new Date(review.review_created_at).toLocaleDateString('ko-KR') : '-'}
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">AI 답변 초안</h3>
          <button
            onClick={generateDraft}
            disabled={isGenerating}
            className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
          >
            {isGenerating ? '생성 중...' : draft ? '초안 재생성' : 'AI 초안 생성'}
          </button>
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

            <div className="relative rounded-lg bg-gray-50 border border-gray-200 p-4 mb-3">
              <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                {selectedDraftText ?? '해당 초안이 없습니다.'}
              </p>
              {selectedDraftText && (
                <button
                  onClick={() => {
                    copyText(selectedDraftText)
                    setEditedReply(selectedDraftText)
                  }}
                  className="absolute top-3 right-3 rounded bg-white border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  복사 & 편집란에 적용
                </button>
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

        <div className="mt-3">
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

      {/* Action buttons */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">처리 액션</h3>

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

          {canPublish && (
            <button
              onClick={() => handleAction(() => markPublished(review.id), '게시 완료 처리되었습니다.')}
              disabled={isPending}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              게시 완료 처리
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
        </div>

        {actionMessage && (
          <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            {actionMessage}
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

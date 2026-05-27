'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'

const ACTIVE_STATUSES = new Set(['new', 'ai_done', 'approved'])

function elapsedDays(review: Review): number | null {
  const dateStr = review.review_created_at ?? review.created_at
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function ReviewsListClient({ reviews }: { reviews: Review[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: '' })
  const [batchErrors, setBatchErrors] = useState<{ id: string; error: string }[]>([])

  // Only `new` status reviews can be batch-generated
  const batchCandidates = reviews.filter((r) => r.status === 'new')
  const selectedNew = [...selected].filter((id) => batchCandidates.some((r) => r.id === id))

  function toggleAll() {
    if (selected.size === batchCandidates.length && batchCandidates.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(batchCandidates.map((r) => r.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBatch() {
    if (selectedNew.length === 0) return
    setBatchStatus('running')
    setBatchErrors([])
    setBatchProgress({ done: 0, total: selectedNew.length, current: '' })

    for (let i = 0; i < selectedNew.length; i++) {
      const id = selectedNew[i]
      const review = reviews.find((r) => r.id === id)
      setBatchProgress({ done: i, total: selectedNew.length, current: review?.reviewer_name ?? id.slice(0, 8) })
      try {
        const res = await fetch('/api/ai/generate-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_id: id }),
        })
        const data = await res.json()
        if (!res.ok) {
          setBatchErrors((prev) => [...prev, { id, error: data.error ?? '알 수 없는 오류' }])
        }
      } catch {
        setBatchErrors((prev) => [...prev, { id, error: '네트워크 오류' }])
      }
    }

    setBatchProgress((p) => ({ ...p, done: p.total, current: '' }))
    setBatchStatus('done')
    setSelected(new Set())
    // Refresh after a moment so statuses update
    setTimeout(() => window.location.reload(), 800)
  }

  const allNewChecked = batchCandidates.length > 0 && batchCandidates.every((r) => selected.has(r.id))
  const someChecked = selected.size > 0

  return (
    <>
      {/* Batch action bar */}
      {(someChecked || batchStatus !== 'idle') && (
        <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex flex-wrap items-center gap-3">
          {batchStatus === 'idle' && (
            <>
              <span className="text-sm font-medium text-blue-800">
                {selectedNew.length}건 선택됨 (신규 상태만 처리 가능)
              </span>
              <button
                onClick={runBatch}
                disabled={selectedNew.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                AI 초안 일괄 생성
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
              >
                선택 해제
              </button>
            </>
          )}
          {batchStatus === 'running' && (
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-medium text-blue-800">
                  처리 중... {batchProgress.done}/{batchProgress.total}
                  {batchProgress.current && ` — ${batchProgress.current}`}
                </span>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {batchStatus === 'done' && (
            <span className="text-sm font-medium text-green-700">
              ✓ 완료 ({batchProgress.total - batchErrors.length}건 성공
              {batchErrors.length > 0 && `, ${batchErrors.length}건 실패`}) — 페이지 새로고침 중...
            </span>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allNewChecked}
                  onChange={toggleAll}
                  title="신규 리뷰 전체 선택"
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">작성일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">경과</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">별점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰 미리보기</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reviews.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                  해당 조건의 리뷰가 없습니다.
                </td>
              </tr>
            )}
            {reviews.map((review) => {
              const elapsed = elapsedDays(review)
              const isActive = ACTIVE_STATUSES.has(review.status)
              const isOverdue = isActive && elapsed !== null && elapsed >= 3
              const displayDate = review.review_created_at ?? review.created_at
              const isNew = review.status === 'new'
              const isChecked = selected.has(review.id)

              return (
                <tr
                  key={review.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    review.risk_level === 'critical' || review.risk_level === 'high'
                      ? 'bg-red-50 hover:bg-red-100'
                      : isChecked
                        ? 'bg-blue-50'
                        : ''
                  }`}
                >
                  <td className="px-3 py-3 text-center">
                    {isNew ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(review.id)}
                        className="rounded border-gray-300"
                      />
                    ) : (
                      <span className="inline-block w-4" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {new Date(displayDate).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isActive && elapsed !== null && (
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {elapsed === 0 ? '오늘' : `${elapsed}일`}
                        {isOverdue && ' ⚠'}
                      </span>
                    )}
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
                  <td className="px-4 py-3 text-gray-600 max-w-sm truncate text-xs">
                    {review.review_text?.slice(0, 60) ?? '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/reviews/${review.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                      상세보기
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

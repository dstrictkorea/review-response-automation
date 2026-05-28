'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'
import { checkAutoGeneratable } from '@/lib/autoReply'

const ACTIVE_STATUSES = new Set(['new', 'ai_done', 'approved'])
const RISK_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

type SortCol = 'date' | 'rating' | 'risk' | 'status'

const ALL_STATUSES: ReviewStatus[] = ['new', 'ai_done', 'approved', 'manual_published', 'no_reply', 'escalated']
const ALL_RISKS: RiskLevel[] = ['critical', 'high', 'medium', 'low']

function elapsedDays(review: Review): number | null {
  const dateStr = review.review_created_at ?? review.created_at
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function ReviewsListClient({
  reviews,
  defaultStatusFilter = '',
}: {
  reviews: Review[]
  defaultStatusFilter?: string
}) {
  // ── 배치 처리 ─────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current: string }>({
    done: 0, total: 0, current: '',
  })
  const [batchErrors, setBatchErrors] = useState<{ id: string; error: string }[]>([])

  // ── 퀵 필터 ──────────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>(defaultStatusFilter)
  const [filterRating, setFilterRating] = useState<number | ''>('')
  const [filterRisk, setFilterRisk] = useState<string>('')

  // ── 정렬 ─────────────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  // ── 필터 + 정렬 적용 리스트 ───────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let r = [...reviews]
    if (filterStatus) r = r.filter((rev) => rev.status === filterStatus)
    if (filterRating !== '') r = r.filter((rev) => rev.rating === filterRating)
    if (filterRisk) r = r.filter((rev) => rev.risk_level === filterRisk)

    r.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortCol) {
        case 'date':
          va = a.review_created_at ?? a.created_at ?? ''
          vb = b.review_created_at ?? b.created_at ?? ''
          break
        case 'rating':
          va = a.rating ?? 0; vb = b.rating ?? 0
          break
        case 'risk':
          va = RISK_ORDER[a.risk_level ?? ''] ?? 0
          vb = RISK_ORDER[b.risk_level ?? ''] ?? 0
          break
        case 'status':
          va = a.status; vb = b.status
          break
        default:
          va = ''; vb = ''
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return r
  }, [reviews, filterStatus, filterRating, filterRisk, sortCol, sortDir])

  // ── 배치 대상: 현재 표시된 신규 리뷰만 ─────────────────────────────────────────
  const batchCandidates = displayed.filter((r) => r.status === 'new')
  const selectedNew = [...selected].filter((id) => batchCandidates.some((r) => r.id === id))
  const autoEligible = selectedNew.filter((id) => {
    const r = reviews.find((rev) => rev.id === id)
    return r ? checkAutoGeneratable(r.rating, r.review_text).canAuto : false
  })
  const aiRequired = selectedNew.filter((id) => !autoEligible.includes(id))

  function toggleAll() {
    if (batchCandidates.length > 0 && batchCandidates.every((r) => selected.has(r.id))) {
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

  async function runBatch(mode: 'ai' | 'auto') {
    const targets = mode === 'auto' ? autoEligible : selectedNew
    if (!targets.length) return
    setBatchStatus('running')
    setBatchErrors([])
    setBatchProgress({ done: 0, total: targets.length, current: '' })
    const endpoint = mode === 'auto' ? '/api/ai/auto-reply' : '/api/ai/generate-reply'

    for (let i = 0; i < targets.length; i++) {
      const id = targets[i]
      const review = reviews.find((r) => r.id === id)
      setBatchProgress({ done: i, total: targets.length, current: review?.reviewer_name ?? id.slice(0, 8) })
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_id: id }),
        })
        const data = await res.json()
        if (!res.ok) setBatchErrors((prev) => [...prev, { id, error: data.error ?? '오류' }])
      } catch {
        setBatchErrors((prev) => [...prev, { id, error: '네트워크 오류' }])
      }
    }

    setBatchProgress((p) => ({ ...p, done: p.total, current: '' }))
    setBatchStatus('done')
    setSelected(new Set())
    setTimeout(() => window.location.reload(), 800)
  }

  const allNewChecked = batchCandidates.length > 0 && batchCandidates.every((r) => selected.has(r.id))
  const someNewChecked = selectedNew.length > 0
  const hasFilter = !!(filterStatus || filterRating !== '' || filterRisk)

  const sortIcon = (col: SortCol) =>
    sortCol === col ? (
      <span className="ml-0.5 text-blue-500">{sortDir === 'desc' ? '↓' : '↑'}</span>
    ) : (
      <span className="ml-0.5 text-gray-300">↕</span>
    )

  return (
    <>
      {/* ── 퀵 필터 바 ────────────────────────────────────────────────────────── */}
      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex flex-wrap gap-y-2 gap-x-1.5 items-center">
        {/* 상태 */}
        <span className="text-xs font-medium text-gray-400 mr-0.5">상태</span>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
              filterStatus === s
                ? 'bg-gray-800 text-white border-gray-800'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}

        <div className="h-3.5 w-px bg-gray-300 mx-1.5" />

        {/* 별점 */}
        <span className="text-xs font-medium text-gray-400 mr-0.5">별점</span>
        {[5, 4, 3, 2, 1].map((r) => (
          <button
            key={r}
            onClick={() => setFilterRating(filterRating === r ? '' : r)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
              filterRating === r
                ? 'bg-yellow-400 text-white border-yellow-400'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {r}★
          </button>
        ))}

        <div className="h-3.5 w-px bg-gray-300 mx-1.5" />

        {/* 위험도 */}
        <span className="text-xs font-medium text-gray-400 mr-0.5">위험도</span>
        {ALL_RISKS.map((risk) => (
          <button
            key={risk}
            onClick={() => setFilterRisk(filterRisk === risk ? '' : risk)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
              filterRisk === risk
                ? 'bg-red-600 text-white border-red-600'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {riskLabel(risk)}
          </button>
        ))}

        {hasFilter && (
          <>
            <div className="h-3.5 w-px bg-gray-300 mx-1.5" />
            <button
              onClick={() => { setFilterStatus(''); setFilterRating(''); setFilterRisk('') }}
              className="rounded-full px-2.5 py-0.5 text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              ✕ 초기화
            </button>
          </>
        )}

        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
          {displayed.length} / {reviews.length}건
        </span>
      </div>

      {/* ── 배치 처리 바 ──────────────────────────────────────────────────────── */}
      {(someNewChecked || batchStatus !== 'idle') && (
        <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex flex-wrap items-center gap-3">
          {batchStatus === 'idle' && (
            <>
              <span className="text-sm font-medium text-blue-800">
                신규 {selectedNew.length}건 선택
                {autoEligible.length > 0 && (
                  <span className="ml-1.5 text-green-700">⚡ {autoEligible.length}건 자동 처리 가능</span>
                )}
                {aiRequired.length > 0 && (
                  <span className="ml-1.5 text-blue-600">AI {aiRequired.length}건</span>
                )}
              </span>

              {autoEligible.length > 0 && (
                <button
                  onClick={() => runBatch('auto')}
                  title="AI 토큰 없이 즉시 처리 (4-5★ 짧은 긍정 리뷰)"
                  className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                >
                  ⚡ 자동 생성 ({autoEligible.length}건)
                </button>
              )}
              {selectedNew.length > 0 && (
                <button
                  onClick={() => runBatch('ai')}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  AI 초안 생성 ({selectedNew.length}건)
                </button>
              )}
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
              {batchErrors.length > 0 && `, ${batchErrors.length}건 실패`}) — 새로고침 중...
            </span>
          )}
        </div>
      )}

      {/* ── 테이블 ────────────────────────────────────────────────────────────── */}
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
                  disabled={batchCandidates.length === 0}
                />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('date')}
              >
                작성일 {sortIcon('date')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">경과</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('rating')}
              >
                별점 {sortIcon('rating')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('status')}
              >
                상태 {sortIcon('status')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('risk')}
              >
                위험도 {sortIcon('risk')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰 미리보기</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">
                  해당 조건의 리뷰가 없습니다.
                </td>
              </tr>
            )}
            {displayed.map((review) => {
              const elapsed = elapsedDays(review)
              const isActive = ACTIVE_STATUSES.has(review.status)
              const isOverdue = isActive && elapsed !== null && elapsed >= 3
              const displayDate = review.review_created_at ?? review.created_at
              const isNew = review.status === 'new'
              const isChecked = selected.has(review.id)
              const canAuto = isNew && checkAutoGeneratable(review.rating, review.review_text).canAuto

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
                  <td className="px-4 py-3 text-gray-600 max-w-sm text-xs">
                    <span className="truncate block">{review.review_text?.slice(0, 60) ?? '-'}</span>
                    {canAuto && (
                      <span className="text-green-600 font-medium text-xs">⚡ 자동가능</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/reviews/${review.id}`}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
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

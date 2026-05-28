'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Review, ReviewStatus, RiskLevel } from '@/types/database'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'
import { checkAutoGeneratable } from '@/lib/autoReply'
import { createClient } from '@/lib/supabase/client'

// ── Types ───────────────────────────────────────────────────────────────────────
type DraftType = 'standard' | 'short' | 'careful'
type SortCol = 'date' | 'rating' | 'risk' | 'status'

interface BatchResultItem {
  id: string
  reviewerName: string
  reviewText: string
  rating: number | null
  status: 'success' | 'error' | 'skipped'
  error?: string
  draftId?: string
  draftShort?: string
  draftStandard?: string
  draftCareful?: string
  selectedReply?: string
}

interface FilterState {
  filterStatus: string
  filterRating: number | ''
  filterRisk: string
  sortCol: SortCol
  sortDir: 'asc' | 'desc'
}

// ── Constants ───────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = new Set(['new', 'ai_done', 'pending_approval', 'approved'])
const RISK_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const ALL_STATUSES: ReviewStatus[] = ['new', 'ai_done', 'pending_approval', 'approved', 'manual_published', 'no_reply', 'escalated']
const ALL_RISKS: RiskLevel[] = ['critical', 'high', 'medium', 'low']
const DRAFT_TYPE_LABELS: Record<DraftType, string> = { standard: '표준', short: '짧게', careful: '조심스럽게' }
const CONCURRENCY = 4 // AI 생성 동시 처리 수

function elapsedDays(review: Review): number | null {
  const dateStr = review.review_created_at ?? review.created_at
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

// ── Batch Summary Modal ─────────────────────────────────────────────────────────
function BatchSummaryModal({
  results,
  draftType,
  onClose,
}: {
  results: BatchResultItem[]
  draftType: DraftType
  onClose: () => void
}) {
  const supabase = createClient()
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length

  const getDraftText = useCallback(
    (item: BatchResultItem): string => {
      if (draftType === 'short') return item.draftShort ?? item.selectedReply ?? ''
      if (draftType === 'careful') return item.draftCareful ?? item.selectedReply ?? ''
      return item.draftStandard ?? item.selectedReply ?? ''
    },
    [draftType]
  )

  async function saveDraft(item: BatchResultItem) {
    if (!item.draftId) return
    const text = editedTexts[item.id] ?? getDraftText(item)
    setSavingIds((prev) => new Set([...prev, item.id]))
    try {
      await supabase
        .from('reply_drafts')
        .update({ selected_reply: text, updated_at: new Date().toISOString() })
        .eq('id', item.draftId)
      setSavedIds((prev) => new Set([...prev, item.id]))
    } catch {
      // ignore
    }
    setSavingIds((prev) => { const n = new Set(prev); n.delete(item.id); return n })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">배치 생성 완료</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              총 {results.length}건 —{' '}
              <span className="text-green-600 font-medium">{successCount}건 성공</span>
              {skippedCount > 0 && <span className="ml-2 text-gray-400">{skippedCount}건 건너뜀</span>}
              {errorCount > 0 && <span className="ml-2 text-red-500 font-medium">{errorCount}건 실패</span>}
              <span className="ml-2 text-gray-400">[{DRAFT_TYPE_LABELS[draftType]} 유형]</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light"
          >×</button>
        </div>

        {/* Results */}
        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {results.map((item) => {
            const draftText = getDraftText(item)
            const currentText = editedTexts[item.id] ?? draftText
            const isEdited = editedTexts[item.id] !== undefined && editedTexts[item.id] !== draftText
            const isSaved = savedIds.has(item.id)
            const isSaving = savingIds.has(item.id)

            return (
              <div key={item.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
                    {item.reviewerName || '익명'}
                  </span>
                  {item.rating != null && (
                    <span className="text-xs font-medium text-yellow-500">{item.rating}★</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.status === 'success' ? 'bg-green-100 text-green-700'
                    : item.status === 'skipped' ? 'bg-gray-100 text-gray-500'
                    : 'bg-red-100 text-red-600'
                  }`}>
                    {item.status === 'success' ? '성공' : item.status === 'skipped' ? '건너뜀' : '실패'}
                  </span>
                  <Link
                    href={`/reviews/${item.id}`}
                    className="ml-auto text-xs text-blue-500 hover:underline whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    상세보기 →
                  </Link>
                </div>
                <p className="text-xs text-gray-400 mb-2 truncate">{item.reviewText.slice(0, 100)}</p>

                {item.status === 'success' && draftText && (
                  <div>
                    <textarea
                      value={currentText}
                      onChange={(e) => setEditedTexts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none resize-none"
                    />
                    <div className="flex items-center justify-end gap-2 mt-1.5">
                      {isEdited && !isSaved && <span className="text-xs text-amber-500">수정됨</span>}
                      {isSaved ? (
                        <span className="text-xs text-green-600 font-medium">✓ 저장됨</span>
                      ) : (
                        <button
                          onClick={() => saveDraft(item)}
                          disabled={isSaving}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isSaving ? '저장 중...' : '저장'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {(item.status === 'error' || item.status === 'skipped') && item.error && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{item.error}</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">저장 후 완료 버튼을 누르면 목록이 새로고침됩니다.</p>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            완료 (새로고침)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function ReviewsListClient({
  reviews,
  draftMap = {},
  defaultStatusFilter = '',
  persistKey,
}: {
  reviews: Review[]
  draftMap?: Record<string, string>
  defaultStatusFilter?: string
  persistKey?: string
}) {
  const router = useRouter()

  // ── 필터 + 정렬 ──────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>(defaultStatusFilter)
  const [filterRating, setFilterRating] = useState<number | ''>('')
  const [filterRisk, setFilterRisk] = useState<string>('')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filtersReady, setFiltersReady] = useState(!persistKey)

  // sessionStorage 복원
  useEffect(() => {
    if (!persistKey) return
    try {
      const raw = sessionStorage.getItem(persistKey)
      if (raw) {
        const saved: Partial<FilterState> = JSON.parse(raw)
        if (saved.filterStatus !== undefined) setFilterStatus(saved.filterStatus)
        if (saved.filterRating !== undefined) setFilterRating(saved.filterRating)
        if (saved.filterRisk !== undefined) setFilterRisk(saved.filterRisk)
        if (saved.sortCol) setSortCol(saved.sortCol)
        if (saved.sortDir) setSortDir(saved.sortDir)
      }
    } catch {}
    setFiltersReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // sessionStorage 저장
  useEffect(() => {
    if (!persistKey || !filtersReady) return
    try {
      sessionStorage.setItem(persistKey, JSON.stringify({ filterStatus, filterRating, filterRisk, sortCol, sortDir }))
    } catch {}
  }, [filterStatus, filterRating, filterRisk, sortCol, sortDir, filtersReady, persistKey])

  // ── 배치 상태 ─────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchDraftType, setBatchDraftType] = useState<DraftType>('standard')
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: '' })
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const abortRef = useRef(false)

  // 필터 바뀌면 선택 초기화
  useEffect(() => { setSelected(new Set()) }, [filterStatus, filterRating, filterRisk])

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  const displayed = useMemo(() => {
    if (!filtersReady) return [...reviews]
    let r = [...reviews]
    if (filterStatus) r = r.filter((rev) => rev.status === filterStatus)
    if (filterRating !== '') r = r.filter((rev) => rev.rating === filterRating)
    if (filterRisk) r = r.filter((rev) => rev.risk_level === filterRisk)
    r.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortCol) {
        case 'date':  va = a.review_created_at ?? a.created_at ?? ''; vb = b.review_created_at ?? b.created_at ?? ''; break
        case 'rating': va = a.rating ?? 0; vb = b.rating ?? 0; break
        case 'risk':  va = RISK_ORDER[a.risk_level ?? ''] ?? 0; vb = RISK_ORDER[b.risk_level ?? ''] ?? 0; break
        case 'status': va = a.status; vb = b.status; break
        default:      va = ''; vb = ''
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return r
  }, [reviews, filterStatus, filterRating, filterRisk, sortCol, sortDir, filtersReady])

  const batchCandidates = displayed.filter((r) => r.status === 'new')
  const selectedNew = [...selected].filter((id) => batchCandidates.some((r) => r.id === id))
  const autoEligible = selectedNew.filter((id) => {
    const r = reviews.find((rev) => rev.id === id)
    return r ? checkAutoGeneratable(r.rating, r.review_text).canAuto : false
  })
  const aiOnly = selectedNew.filter((id) => !autoEligible.includes(id))

  function toggleAll() {
    if (batchCandidates.length > 0 && batchCandidates.every((r) => selected.has(r.id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(batchCandidates.map((r) => r.id)))
    }
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── 자동 생성 (bulk API — 단일 요청) ────────────────────────────────────────
  async function runAutoBatch() {
    if (!autoEligible.length) return
    abortRef.current = false
    setBatchStatus('running')
    setBatchProgress({ done: 0, total: autoEligible.length, current: '처리 중...' })

    try {
      const res = await fetch('/api/ai/bulk-auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_ids: autoEligible, draft_type: batchDraftType }),
      })
      const data = await res.json()

      const results: BatchResultItem[] = (data.results ?? []).map((r: any) => {
        const review = reviews.find((rev) => rev.id === r.review_id)
        return {
          id: r.review_id,
          reviewerName: review?.reviewer_name ?? '익명',
          reviewText: review?.review_text ?? '',
          rating: review?.rating ?? null,
          status: r.status,
          error: r.error,
          draftId: r.draft?.id,
          draftShort: r.draft?.draft_short,
          draftStandard: r.draft?.draft_standard,
          draftCareful: r.draft?.draft_careful,
          selectedReply: r.draft?.selected_reply,
        }
      })

      setBatchProgress({ done: autoEligible.length, total: autoEligible.length, current: '' })
      setBatchResults(results)
    } catch {
      setBatchResults(autoEligible.map((id) => {
        const review = reviews.find((r) => r.id === id)
        return { id, reviewerName: review?.reviewer_name ?? '익명', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'error', error: '네트워크 오류' }
      }))
    }

    setBatchStatus('done')
    setSelected(new Set())
    setShowModal(true)
  }

  // ── AI 생성 (병렬 처리) ──────────────────────────────────────────────────────
  async function runAiBatch() {
    if (!selectedNew.length) return
    abortRef.current = false
    setBatchStatus('running')
    setBatchProgress({ done: 0, total: selectedNew.length, current: '' })

    const results: BatchResultItem[] = new Array(selectedNew.length).fill(null)
    let completedCount = 0

    for (let i = 0; i < selectedNew.length; i += CONCURRENCY) {
      if (abortRef.current) break
      const chunk = selectedNew.slice(i, i + CONCURRENCY)
      await Promise.all(
        chunk.map(async (id, j) => {
          if (abortRef.current) return
          const review = reviews.find((r) => r.id === id)
          const idx = i + j
          setBatchProgress({ done: completedCount, total: selectedNew.length, current: review?.reviewer_name ?? id.slice(0, 8) })
          try {
            const res = await fetch('/api/ai/generate-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ review_id: id, draft_type: batchDraftType }),
            })
            const data = await res.json()
            const draft = data.draft ?? {}
            results[idx] = res.ok
              ? { id, reviewerName: review?.reviewer_name ?? '익명', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'success', draftId: draft.id, draftShort: draft.draft_short, draftStandard: draft.draft_standard, draftCareful: draft.draft_careful, selectedReply: draft.selected_reply }
              : { id, reviewerName: review?.reviewer_name ?? '익명', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'error', error: data.error ?? '오류' }
          } catch {
            results[idx] = { id, reviewerName: review?.reviewer_name ?? '익명', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'error', error: '네트워크 오류' }
          }
          completedCount++
          setBatchProgress({ done: completedCount, total: selectedNew.length, current: '' })
        })
      )
    }

    setBatchProgress({ done: abortRef.current ? completedCount : selectedNew.length, total: selectedNew.length, current: '' })
    setBatchResults(results.filter(Boolean))
    setBatchStatus('done')
    setSelected(new Set())
    setShowModal(true)
  }

  function cancelBatch() {
    abortRef.current = true
    setBatchProgress((p) => ({ ...p, current: '취소 중...' }))
  }

  function handleModalClose() {
    setShowModal(false)
    setBatchStatus('idle')
    setBatchResults([])
    window.location.reload()
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const allNewChecked = batchCandidates.length > 0 && batchCandidates.every((r) => selected.has(r.id))
  const someNewChecked = selectedNew.length > 0
  const hasFilter = !!(filterStatus || filterRating !== '' || filterRisk)

  const sortIcon = (col: SortCol) =>
    sortCol === col
      ? <span className="ml-0.5 text-blue-500">{sortDir === 'desc' ? '↓' : '↑'}</span>
      : <span className="ml-0.5 text-gray-300">↕</span>

  return (
    <>
      {/* ── 퀵 필터 바 ───────────────────────────────────────────────────────── */}
      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex flex-wrap gap-y-2 gap-x-1.5 items-center">
        <span className="text-xs font-medium text-gray-400 mr-0.5">상태</span>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${filterStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {statusLabel(s)}
          </button>
        ))}
        <div className="h-3.5 w-px bg-gray-300 mx-1.5" />
        <span className="text-xs font-medium text-gray-400 mr-0.5">별점</span>
        {[5, 4, 3, 2, 1].map((r) => (
          <button key={r} onClick={() => setFilterRating(filterRating === r ? '' : r)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${filterRating === r ? 'bg-yellow-400 text-white border-yellow-400' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {r}★
          </button>
        ))}
        <div className="h-3.5 w-px bg-gray-300 mx-1.5" />
        <span className="text-xs font-medium text-gray-400 mr-0.5">위험도</span>
        {ALL_RISKS.map((risk) => (
          <button key={risk} onClick={() => setFilterRisk(filterRisk === risk ? '' : risk)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${filterRisk === risk ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {riskLabel(risk)}
          </button>
        ))}
        {hasFilter && (
          <>
            <div className="h-3.5 w-px bg-gray-300 mx-1.5" />
            <button onClick={() => { setFilterStatus(''); setFilterRating(''); setFilterRisk('') }}
              className="rounded-full px-2.5 py-0.5 text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
              ✕ 초기화
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{displayed.length} / {reviews.length}건</span>
      </div>

      {/* ── 배치 처리 바 ─────────────────────────────────────────────────────── */}
      {(someNewChecked || batchStatus === 'running') && (
        <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          {batchStatus === 'idle' && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-blue-800">
                신규 {selectedNew.length}건 선택
                {autoEligible.length > 0 && <span className="ml-1.5 text-green-700">⚡ {autoEligible.length}건 자동</span>}
                {aiOnly.length > 0 && <span className="ml-1.5 text-blue-600">AI {aiOnly.length}건</span>}
              </span>
              {/* 답변 유형 선택 */}
              <div className="flex items-center gap-1.5 border-l border-blue-200 pl-3">
                <span className="text-xs text-blue-600 font-medium whitespace-nowrap">답변 유형</span>
                {(['standard', 'short', 'careful'] as DraftType[]).map((dt) => (
                  <button key={dt} onClick={() => setBatchDraftType(dt)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${batchDraftType === dt ? 'bg-blue-700 text-white border-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-100'}`}>
                    {DRAFT_TYPE_LABELS[dt]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {autoEligible.length > 0 && (
                  <button onClick={runAutoBatch}
                    title="AI 토큰 없이 즉시 처리 (4-5★ 짧은 긍정 리뷰) — 단일 요청으로 빠르게 처리"
                    className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
                    ⚡ 자동 생성 ({autoEligible.length}건)
                  </button>
                )}
                {selectedNew.length > 0 && (
                  <button onClick={runAiBatch}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                    AI 초안 생성 ({selectedNew.length}건)
                  </button>
                )}
                <button onClick={() => setSelected(new Set())}
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                  선택 해제
                </button>
              </div>
            </div>
          )}

          {batchStatus === 'running' && (
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm font-medium text-blue-800">
                  처리 중... {batchProgress.done}/{batchProgress.total}
                  {batchProgress.current && ` — ${batchProgress.current}`}
                </span>
                <button onClick={cancelBatch}
                  className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                  취소
                </button>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 테이블 ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-3 w-0">
                <input type="checkbox" checked={allNewChecked} onChange={toggleAll}
                  title="신규 리뷰 전체 선택" className="rounded border-gray-300"
                  disabled={batchCandidates.length === 0} />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap w-0"
                onClick={() => handleSort('date')}>
                작성일 {sortIcon('date')}
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-0">경과</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-0">지점</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-0">채널</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap w-0"
                onClick={() => handleSort('rating')}>
                별점 {sortIcon('rating')}
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap w-0"
                onClick={() => handleSort('status')}>
                상태 {sortIcon('status')}
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap w-0"
                onClick={() => handleSort('risk')}>
                위험도 {sortIcon('risk')}
              </th>
              {/* 리뷰 미리보기 — 남은 공간 전부 */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                리뷰 미리보기 / 답변 초안
              </th>
              <th className="px-3 py-3 w-0" />
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
              const isHighRisk = review.risk_level === 'critical' || review.risk_level === 'high'
              const draftSnippet = draftMap[review.id]

              return (
                <tr key={review.id}
                  onClick={() => router.push(`/reviews/${review.id}`)}
                  className={`transition-colors cursor-pointer ${
                    isHighRisk ? 'bg-red-50 hover:bg-red-100'
                    : isChecked ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-3 text-center w-0" onClick={(e) => e.stopPropagation()}>
                    {isNew ? (
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(review.id)}
                        className="rounded border-gray-300" />
                    ) : (
                      <span className="inline-block w-4" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs w-0">
                    {new Date(displayDate).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap w-0">
                    {isActive && elapsed !== null && (
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {elapsed === 0 ? '오늘' : `${elapsed}일`}{isOverdue && ' ⚠'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-gray-700 whitespace-nowrap w-0">{review.branch_code}</td>
                  <td className="px-2 py-3 text-xs text-gray-700 whitespace-nowrap w-0">{review.channel_code}</td>
                  <td className="px-2 py-3 text-gray-700 text-xs font-medium whitespace-nowrap w-0">
                    {review.rating != null ? `${review.rating}★` : '-'}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap w-0">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
                      {statusLabel(review.status as ReviewStatus)}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap w-0">
                    {review.risk_level && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
                        {riskLabel(review.risk_level as RiskLevel)}
                      </span>
                    )}
                  </td>
                  {/* 리뷰 미리보기 + 답변 초안 — max-w-0 + w-full 로 열 너비 고정, 다국어 긴 텍스트 방어 */}
                  <td className="px-4 py-3 max-w-0 w-full">
                    <p className="text-xs text-gray-700 line-clamp-2 break-words">{review.review_text ?? '-'}</p>
                    {draftSnippet && (
                      <p className="text-xs text-blue-600 mt-1 line-clamp-1 break-words">
                        ↳ {draftSnippet}
                      </p>
                    )}
                    {canAuto && !draftSnippet && (
                      <span className="text-green-600 font-medium text-xs">⚡ 자동가능</span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap w-0" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/reviews/${review.id}`}
                      className="text-xs text-blue-600 hover:underline font-medium">
                      상세보기
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── 배치 결과 모달 ───────────────────────────────────────────────────── */}
      {showModal && batchResults.length > 0 && (
        <BatchSummaryModal results={batchResults} draftType={batchDraftType} onClose={handleModalClose} />
      )}
    </>
  )
}

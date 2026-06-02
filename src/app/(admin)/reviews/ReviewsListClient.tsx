'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Review, ReviewStatus, RiskLevel, ReviewTelemetry } from '@/types/database'
import { statusClasses, riskClasses } from '@/lib/badges'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/context/LanguageContext'
import { LANG_LOCALE, type I18nDict } from '@/lib/i18n'
import { intentLabel, intentBadgeClass, inferPipelineEngine } from '@/lib/intents'
import ReviewDrawer from './ReviewDrawer'

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

/** 서버사이드 페이지네이션 모드 (옵션). 없으면 클라이언트 인메모리 모드(대시보드). */
export interface ServerPaginationProps {
  page: number
  limit: number
  total: number
  activeStatus: string
  activeRisk: string
  activeRating: string
  basePath: string
  /** 페이지네이션 외 보존할 쿼리 파라미터 (branch, channel, q, date_*) */
  query: Record<string, string>
}

// ── Constants ───────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = new Set(['new', 'ai_done', 'pending_approval', 'approved'])
const RISK_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
const ALL_STATUSES: ReviewStatus[] = ['new', 'ai_done', 'pending_approval', 'approved', 'manual_published', 'no_reply', 'escalated']
const ALL_RISKS: RiskLevel[] = ['critical', 'high', 'medium', 'low']
const PAGE_SIZES = [10, 20, 50, 100]
const CONCURRENCY = 4

function elapsedDays(review: Review): number | null {
  const dateStr = review.review_created_at ?? review.created_at
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

/** 템플릿 문자열 보간 — {key} → 값 */
function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

// ── i18n badge helpers ────────────────────────────────────────────────────────────
function tStatus(t: I18nDict, status: ReviewStatus): string {
  const map: Record<ReviewStatus, string> = {
    new: t.status_new, ai_done: t.status_ai_done, pending_approval: t.status_pending_approval,
    approved: t.status_approved, manual_published: t.status_published, no_reply: t.status_no_reply,
    escalated: t.status_escalated, failed: t.status_failed,
  }
  return map[status] ?? status
}
function tRisk(t: I18nDict, risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: t.risk_low, medium: t.risk_medium, high: t.risk_high, critical: t.risk_critical,
  }
  return map[risk]
}

// ── Batch Summary Modal ─────────────────────────────────────────────────────────
function BatchSummaryModal({
  results,
  draftType,
  onClose,
  t,
}: {
  results: BatchResultItem[]
  draftType: DraftType
  onClose: () => void
  t: I18nDict
}) {
  const supabase = createClient()
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const draftLabel: Record<DraftType, string> = {
    standard: t.rv_draft_standard, short: t.rv_draft_short, careful: t.rv_draft_careful,
  }
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
        .update({ selected_reply: text, human_edited_reply: text, updated_at: new Date().toISOString() })
        .eq('id', item.draftId)
      setSavedIds((prev) => new Set([...prev, item.id]))
    } catch {
      /* ignore */
    }
    setSavingIds((prev) => { const n = new Set(prev); n.delete(item.id); return n })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.rv_generate} ✓</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {results.length}{t.stat_unit} —{' '}
              <span className="text-green-600 font-medium">{successCount} ✓</span>
              {skippedCount > 0 && <span className="ml-2 text-gray-400">{skippedCount} skip</span>}
              {errorCount > 0 && <span className="ml-2 text-red-500 font-medium">{errorCount} ✗</span>}
              <span className="ml-2 text-gray-400">[{draftLabel[draftType]}]</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">×</button>
        </div>

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
                    {item.reviewerName || '—'}
                  </span>
                  {item.rating != null && <span className="text-xs font-medium text-yellow-500">{item.rating}★</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.status === 'success' ? 'bg-green-100 text-green-700'
                    : item.status === 'skipped' ? 'bg-gray-100 text-gray-500'
                    : 'bg-red-100 text-red-600'
                  }`}>
                    {item.status === 'success' ? '✓' : item.status === 'skipped' ? 'skip' : '✗'}
                  </span>
                  <Link href={`/reviews/${item.id}`} className="ml-auto text-xs text-blue-500 hover:underline whitespace-nowrap">
                    {t.rv_view_detail} →
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
                      {isEdited && !isSaved && <span className="text-xs text-amber-500">{t.rv_edited}</span>}
                      {isSaved ? (
                        <span className="text-xs text-green-600 font-medium">✓ {t.rv_saved}</span>
                      ) : (
                        <button onClick={() => saveDraft(item)} disabled={isSaving}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {isSaving ? t.rv_saving : t.rv_save}
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

        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
            {t.rv_close}
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
  telemetryMap = {},
  defaultStatusFilter = '',
  server,
}: {
  reviews: Review[]
  draftMap?: Record<string, string>
  telemetryMap?: Record<string, ReviewTelemetry>
  defaultStatusFilter?: string
  server?: ServerPaginationProps
}) {
  const router = useRouter()
  const { lang, t } = useLanguage()
  const locale = LANG_LOCALE[lang]
  const isServer = !!server

  // ── 클라이언트 필터/정렬 (대시보드 모드) ──────────────────────────────────────
  // /reviews(서버 모드)는 URL로 상태가 보존되므로 인메모리 영속화 불필요.
  const [filterStatus, setFilterStatus] = useState<string>(defaultStatusFilter)
  const [filterRating, setFilterRating] = useState<number | ''>('')
  const [filterRisk, setFilterRisk] = useState<string>('')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // 드로어 + 드로어 저장 후 미리보기 즉시 갱신용 오버라이드.
  // (props.draftMap 위에 머지 — useEffect 동기화 불필요)
  const [activeReview, setActiveReview] = useState<Review | null>(null)
  const [draftOverrides, setDraftOverrides] = useState<Record<string, string>>({})
  const effectiveDraftMap = { ...draftMap, ...draftOverrides }

  // ── 배치 상태 ─────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchDraftType, setBatchDraftType] = useState<DraftType>('standard')
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: '' })
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const abortRef = useRef(false)

  // ── Gmail식 일괄 선택 / Soft Delete 상태 (Wave 15) ──────────────────────────────
  const [selectAllMatching, setSelectAllMatching] = useState(false)  // 필터 조건 전체 선택
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

  // ── 서버 모드 URL 네비게이션 ────────────────────────────────────────────────────
  const buildServerUrl = useCallback(
    (overrides: Record<string, string | number | null>): string => {
      if (!server) return server!.basePath
      const params = new URLSearchParams()
      // 기존 보존 쿼리
      for (const [k, v] of Object.entries(server.query)) if (v) params.set(k, v)
      // 현재 필터/페이지
      if (server.activeStatus) params.set('status', server.activeStatus)
      if (server.activeRisk)   params.set('risk', server.activeRisk)
      if (server.activeRating) params.set('rating', server.activeRating)
      params.set('page', String(server.page))
      params.set('limit', String(server.limit))
      // 오버라이드 적용
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null || v === '') params.delete(k)
        else params.set(k, String(v))
      }
      const qs = params.toString()
      return qs ? `${server.basePath}?${qs}` : server.basePath
    },
    [server]
  )

  function toggleServerFilter(key: 'status' | 'risk' | 'rating', value: string) {
    const current = key === 'status' ? server!.activeStatus : key === 'risk' ? server!.activeRisk : server!.activeRating
    router.push(buildServerUrl({ [key]: current === value ? null : value, page: 1 }))
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  // ── 표시 행 계산 ────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let r = [...reviews]
    // 클라이언트 모드에서만 인메모리 필터링 (서버 모드는 이미 서버에서 필터됨)
    if (!isServer) {
      if (filterStatus) r = r.filter((rev) => rev.status === filterStatus)
      if (filterRating !== '') r = r.filter((rev) => rev.rating === filterRating)
      if (filterRisk) r = r.filter((rev) => rev.risk_level === filterRisk)
    }
    // 정렬은 양 모드 모두 적용 (현재 페이지 내 정렬)
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
  }, [reviews, filterStatus, filterRating, filterRisk, sortCol, sortDir, isServer])

  // AI 배치는 'new' 상태만 대상 (삭제는 전체 행 대상)
  const batchCandidates = displayed.filter((r) => r.status === 'new')
  const selectedNew = [...selected].filter((id) => batchCandidates.some((r) => r.id === id))

  // 헤더 체크박스: 현재 페이지(displayed)의 전체 행 선택/해제
  const allDisplayedChecked = displayed.length > 0 && displayed.every((r) => selected.has(r.id))

  function toggleAll() {
    if (allDisplayedChecked) {
      setSelected(new Set())
      setSelectAllMatching(false)
    } else {
      setSelected(new Set(displayed.map((r) => r.id)))
    }
  }
  function toggleOne(id: string) {
    setSelectAllMatching(false) // 수동 선택 시 "전체 선택" 해제
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function clearSelection() {
    setSelected(new Set())
    setSelectAllMatching(false)
  }

  // 선택 건수: 전체 선택 모드면 서버 total, 아니면 선택 Set 크기
  const selectedCount = selectAllMatching ? (server?.total ?? selected.size) : selected.size

  // ── 일괄 Soft Delete ────────────────────────────────────────────────────────────
  async function runBulkDelete() {
    setIsDeleting(true)
    try {
      const payload = selectAllMatching && server
        ? {
            mode: 'filter',
            filter: {
              ...server.query,
              status: server.activeStatus || undefined,
              risk:   server.activeRisk || undefined,
              rating: server.activeRating || undefined,
            },
          }
        : { mode: 'ids', ids: [...selected] }

      const res = await fetch('/api/review/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteMsg(data.error ?? 'error')
      } else {
        setDeleteMsg(fmt(t.rv_del_done, { n: data.count ?? 0 }))
        clearSelection()
        setShowDeleteModal(false)
        router.refresh()
      }
    } catch {
      setDeleteMsg(t.rd_toast_server_err)
    }
    setIsDeleting(false)
  }

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
              ? { id, reviewerName: review?.reviewer_name ?? '—', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'success', draftId: draft.id, draftShort: draft.draft_short, draftStandard: draft.draft_standard, draftCareful: draft.draft_careful, selectedReply: draft.selected_reply }
              : { id, reviewerName: review?.reviewer_name ?? '—', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'error', error: data.error ?? 'error' }
          } catch {
            results[idx] = { id, reviewerName: review?.reviewer_name ?? '—', reviewText: review?.review_text ?? '', rating: review?.rating ?? null, status: 'error', error: 'network error' }
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
    setBatchProgress((p) => ({ ...p, current: '…' }))
  }

  function handleModalClose() {
    setShowModal(false)
    setBatchStatus('idle')
    setBatchResults([])
    router.refresh()
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const someNewChecked = selectedNew.length > 0
  const hasSelection   = selected.size > 0 || selectAllMatching
  // Gmail식 배너: 페이지 전체 선택 && 서버 모드 && 추가 매칭 존재 && 아직 "전체선택" 아님
  const showSelectAllBanner = allDisplayedChecked && isServer && !selectAllMatching && (server!.total > displayed.length)

  // 활성 필터 값 (서버/클라이언트 통합)
  const curStatus = isServer ? server!.activeStatus : filterStatus
  const curRisk   = isServer ? server!.activeRisk : filterRisk
  const curRating = isServer ? (server!.activeRating ? Number(server!.activeRating) : '') : filterRating
  const hasFilter = !!(curStatus || curRating !== '' || curRisk)

  // 클라이언트 모드: 필터 변경 시 배치 선택도 함께 초기화 (서버 모드는 URL 이동으로 자연 초기화)
  function clickStatus(s: ReviewStatus) {
    if (isServer) toggleServerFilter('status', s)
    else { setFilterStatus(filterStatus === s ? '' : s); setSelected(new Set()) }
  }
  function clickRating(r: number) {
    if (isServer) toggleServerFilter('rating', String(r))
    else { setFilterRating(filterRating === r ? '' : r); setSelected(new Set()) }
  }
  function clickRisk(risk: RiskLevel) {
    if (isServer) toggleServerFilter('risk', risk)
    else { setFilterRisk(filterRisk === risk ? '' : risk); setSelected(new Set()) }
  }
  function clickReset() {
    if (isServer) router.push(buildServerUrl({ status: null, risk: null, rating: null, page: 1 }))
    else { setFilterStatus(''); setFilterRating(''); setFilterRisk(''); setSelected(new Set()) }
  }

  const sortIcon = (col: SortCol) =>
    sortCol === col
      ? <span className="ml-0.5 text-blue-500">{sortDir === 'desc' ? '↓' : '↑'}</span>
      : <span className="ml-0.5 text-gray-300">↕</span>

  // ── 페이지네이션 계산 (서버 모드) ──────────────────────────────────────────────
  const totalPages = isServer ? Math.max(1, Math.ceil(server!.total / server!.limit)) : 1
  const fromIdx = isServer ? (server!.page - 1) * server!.limit + 1 : 0
  const toIdx   = isServer ? Math.min(server!.page * server!.limit, server!.total) : 0

  type PageItem = number | '...'
  const pageItems: PageItem[] = isServer
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - server!.page) <= 1)
        .reduce<PageItem[]>((acc, p, idx, arr) => {
          if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) acc.push('...')
          acc.push(p)
          return acc
        }, [])
    : []

  const draftLabel: Record<DraftType, string> = {
    standard: t.rv_draft_standard, short: t.rv_draft_short, careful: t.rv_draft_careful,
  }

  return (
    <>
      {/* ── 퀵 필터 바 ───────────────────────────────────────────────────────── */}
      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex flex-wrap gap-y-2 gap-x-1.5 items-center">
        <span className="text-xs font-medium text-gray-400 mr-0.5 shrink-0">{t.rv_filter_status}</span>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => clickStatus(s)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${curStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {tStatus(t, s)}
          </button>
        ))}
        <div className="h-3.5 w-px bg-gray-300 mx-1.5 shrink-0" />
        <span className="text-xs font-medium text-gray-400 mr-0.5 shrink-0">{t.rv_filter_rating}</span>
        {[5, 4, 3, 2, 1].map((r) => (
          <button key={r} onClick={() => clickRating(r)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${curRating === r ? 'bg-yellow-400 text-white border-yellow-400' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {r}★
          </button>
        ))}
        <div className="h-3.5 w-px bg-gray-300 mx-1.5 shrink-0" />
        <span className="text-xs font-medium text-gray-400 mr-0.5 shrink-0">{t.rv_filter_risk}</span>
        {ALL_RISKS.map((risk) => (
          <button key={risk} onClick={() => clickRisk(risk)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${curRisk === risk ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
            {tRisk(t, risk)}
          </button>
        ))}
        {hasFilter && (
          <>
            <div className="h-3.5 w-px bg-gray-300 mx-1.5 shrink-0" />
            <button onClick={clickReset}
              className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
              ✕ {t.rv_filter_reset}
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap shrink-0">
          {isServer ? `${server!.total}${t.stat_unit}` : `${displayed.length} / ${reviews.length}${t.stat_unit}`}
        </span>
      </div>

      {/* ── Gmail식 "필터 조건 전체 선택" 배너 ───────────────────────────────── */}
      {(showSelectAllBanner || selectAllMatching) && (
        <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 flex flex-wrap items-center justify-center gap-2 text-sm">
          {selectAllMatching ? (
            <>
              <span className="text-amber-900 font-medium">
                {fmt(t.rv_bulk_all_selected, { x: server?.total ?? 0 })}
              </span>
              <button onClick={clearSelection} className="text-blue-600 hover:underline font-medium">
                {t.rv_bulk_clear}
              </button>
            </>
          ) : (
            <>
              <span className="text-amber-900">
                {fmt(t.rv_bulk_page_selected, { n: displayed.length })}
              </span>
              <button onClick={() => setSelectAllMatching(true)} className="text-blue-600 hover:underline font-semibold">
                {fmt(t.rv_bulk_select_all, { x: server?.total ?? 0 })}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 선택/배치 액션 바 ─────────────────────────────────────────────────── */}
      {(hasSelection || batchStatus === 'running') && (
        <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          {batchStatus === 'idle' && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-blue-800">{t.rv_batch_selected}: {selectedCount}{t.stat_unit}</span>
              {someNewChecked && !selectAllMatching && (
                <div className="flex items-center gap-1.5 border-l border-blue-200 pl-3">
                  <span className="text-xs text-blue-600 font-medium whitespace-nowrap">{t.rv_draft_type}</span>
                  {(['standard', 'short', 'careful'] as DraftType[]).map((dt) => (
                    <button key={dt} onClick={() => setBatchDraftType(dt)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${batchDraftType === dt ? 'bg-blue-700 text-white border-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-100'}`}>
                      {draftLabel[dt]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {someNewChecked && !selectAllMatching && (
                  <button onClick={runAiBatch}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                    {t.rv_generate} ({selectedNew.length})
                  </button>
                )}
                <button onClick={() => setShowDeleteModal(true)}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
                  🗑 {fmt(t.rv_delete_selected, { n: selectedCount })}
                </button>
                <button onClick={clearSelection}
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                  {t.rv_deselect}
                </button>
              </div>
            </div>
          )}
          {batchStatus === 'running' && (
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm font-medium text-blue-800">
                  {t.rv_processing}… {batchProgress.done}/{batchProgress.total}
                  {batchProgress.current && ` — ${batchProgress.current}`}
                </span>
                <button onClick={cancelBatch}
                  className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                  {t.rv_cancel}
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

      {/* ── 테이블 (table-fixed + min-w → 4개국어 무결점 플루이드) ──────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm table-fixed min-w-[860px]">
          <colgroup>
            <col className="w-9" /><col className="w-24" /><col className="w-14" />
            <col className="w-16" /><col className="w-20" /><col className="w-14" />
            <col className="w-20" /><col className="w-20" /><col className="w-24" />
            <col className="w-20" /><col /><col className="w-16" />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-3">
                <input type="checkbox" checked={allDisplayedChecked} onChange={toggleAll}
                  className="rounded border-gray-300" disabled={displayed.length === 0} />
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('date')}>{t.rv_col_date} {sortIcon('date')}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t.rv_col_elapsed}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t.rv_col_branch}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t.rv_col_channel}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('rating')}>{t.rv_col_rating} {sortIcon('rating')}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('status')}>{t.rv_col_status} {sortIcon('status')}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                onClick={() => handleSort('risk')}>{t.rv_col_risk} {sortIcon('risk')}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t.rv_col_intent}</th>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{t.rv_col_pipeline}</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">{t.rv_col_preview}</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400 text-sm">{t.rv_empty}</td></tr>
            )}
            {displayed.map((review) => {
              const elapsed = elapsedDays(review)
              const isActive = ACTIVE_STATUSES.has(review.status)
              const isOverdue = isActive && elapsed !== null && elapsed >= 3
              const displayDate = review.review_created_at ?? review.created_at
              const isChecked = selected.has(review.id) || selectAllMatching
              const isHighRisk = review.risk_level === 'critical' || review.risk_level === 'high'
              const draftSnippet = effectiveDraftMap[review.id]

              const tele = telemetryMap[review.id]
              const engine = inferPipelineEngine({
                pipelineEngine: tele?.pipeline_engine,
                modelName:      tele?.model_name,
                promptVersion:  tele?.prompt_version,
              })
              const intentCode = tele?.intent_code ?? review.categories?.[0] ?? null
              const intentTxt = intentLabel(intentCode, lang)
              const confidence = tele?.intent_confidence

              return (
                <tr key={review.id}
                  onClick={() => setActiveReview(review)}
                  className={`transition-colors cursor-pointer ${
                    isHighRisk ? 'bg-red-50 hover:bg-red-100'
                    : isChecked ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked || selectAllMatching} onChange={() => toggleOne(review.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-2 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {displayDate ? new Date(displayDate).toLocaleDateString(locale) : '—'}
                  </td>
                  <td className="px-1 py-3 whitespace-nowrap">
                    {isActive && elapsed !== null && (
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {elapsed === 0 ? t.rv_today : `${elapsed}d`}{isOverdue && ' ⚠'}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-3 truncate">
                    <span className="font-mono text-xs font-bold uppercase tracking-wide text-gray-900">{review.branch_code}</span>
                  </td>
                  <td className="px-1 py-3 text-xs text-gray-700 truncate">{review.channel_code}</td>
                  <td className="px-1 py-3 text-gray-700 text-xs font-medium whitespace-nowrap">
                    {review.rating != null ? `${review.rating}★` : '—'}
                  </td>
                  <td className="px-1 py-3 whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
                      {tStatus(t, review.status as ReviewStatus)}
                    </span>
                  </td>
                  <td className="px-1 py-3 whitespace-nowrap">
                    {review.risk_level && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
                        {tRisk(t, review.risk_level as RiskLevel)}
                      </span>
                    )}
                  </td>
                  {/* 인텐트 배지 + 신뢰도 */}
                  <td className="px-1 py-3 whitespace-nowrap">
                    {intentTxt ? (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${intentBadgeClass(intentCode)}`}>
                        <span className="truncate max-w-[64px]">{intentTxt}</span>
                        {typeof confidence === 'number' && <span className="opacity-70">{Math.round(confidence * 100)}%</span>}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  {/* 파이프라인 배지 */}
                  <td className="px-1 py-3 whitespace-nowrap">
                    {engine ? (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        engine === 'template'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-violet-50 text-violet-700 border border-violet-200'
                      }`}>
                        {engine === 'template' ? '⚡' : '✨'}
                        <span className="truncate">{engine === 'template' ? t.rv_pipeline_template : t.rv_pipeline_llm}</span>
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  {/* 리뷰 미리보기 + 답변 초안 — 남은 공간 전부, truncate + hover 펼침 */}
                  <td className="px-3 py-3 max-w-0">
                    <p className="text-xs text-gray-700 line-clamp-2 break-words hover:line-clamp-none">{review.review_text ?? '—'}</p>
                    {draftSnippet && (
                      <p className="text-xs text-blue-600 mt-1 line-clamp-1 break-words hover:line-clamp-none">↳ {draftSnippet}</p>
                    )}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/reviews/${review.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                      {t.rv_view_detail}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── 페이지네이션 (서버 모드 전용) ──────────────────────────────────────── */}
      {isServer && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {server!.total > 0 ? `${fromIdx}–${toIdx} / ${server!.total}${t.stat_unit}` : `0${t.stat_unit}`}
            </span>
            <select
              value={server!.limit}
              onChange={(e) => router.push(buildServerUrl({ limit: Number(e.target.value), page: 1 }))}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / {t.rv_per_page}</option>)}
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {server!.page > 1 && (
                <Link href={buildServerUrl({ page: server!.page - 1 })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  ← {t.rv_prev}
                </Link>
              )}
              {pageItems.map((p, idx) =>
                p === '...' ? (
                  <span key={`e-${idx}`} className="px-2 text-xs text-gray-400">…</span>
                ) : (
                  <Link key={p} href={buildServerUrl({ page: p })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      p === server!.page ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}>
                    {p}
                  </Link>
                )
              )}
              {server!.page < totalPages && (
                <Link href={buildServerUrl({ page: server!.page + 1 })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  {t.rv_next} →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 슬라이드오버 드로어 ──────────────────────────────────────────────── */}
      <ReviewDrawer
        review={activeReview}
        onClose={() => setActiveReview(null)}
        onSaved={(id, reply) => setDraftOverrides((prev) => ({ ...prev, [id]: reply }))}
      />

      {/* ── 배치 결과 모달 ───────────────────────────────────────────────────── */}
      {showModal && batchResults.length > 0 && (
        <BatchSummaryModal results={batchResults} draftType={batchDraftType} onClose={handleModalClose} t={t} />
      )}

      {/* ── 일괄 삭제 2중 경고 모달 ─────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🗑️</span>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {fmt(t.rv_del_confirm_title, { n: selectedCount })}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{t.rv_del_confirm_desc}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {t.rv_cancel}
              </button>
              <button onClick={runBulkDelete} disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {isDeleting ? t.rv_deleting : t.rv_del_confirm_btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 결과 토스트 ───────────────────────────────────────────────────── */}
      {deleteMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-gray-900 text-white text-sm px-4 py-2.5 shadow-lg flex items-center gap-3">
          <span>{deleteMsg}</span>
          <button onClick={() => setDeleteMsg(null)} className="text-gray-300 hover:text-white">×</button>
        </div>
      )}
    </>
  )
}

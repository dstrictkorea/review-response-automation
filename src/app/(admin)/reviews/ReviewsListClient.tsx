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
  /** 서버사이드 정렬 컬럼 (date|rating|risk|status) — 전체 DB 기준 정렬 */
  activeSort: SortCol
  activeDir: 'asc' | 'desc'
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
const MAX_HARD_DELETE = 100  // 영구 삭제 비가역 — 한 번에 처리 가능한 상한 (서버와 동일)

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
  archiveMode = false,
  isAdmin = false,
}: {
  reviews: Review[]
  draftMap?: Record<string, string>
  telemetryMap?: Record<string, ReviewTelemetry>
  defaultStatusFilter?: string
  server?: ServerPaginationProps
  /** 아카이브(보관함) 모드 — AI/배치 액션 숨김, 복구·영구삭제 액션만 노출 */
  archiveMode?: boolean
  /** 관리자 여부 — true면 "필터 전체 선택" 상태에서도 영구 삭제 허용 */
  isAdmin?: boolean
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
  const [batchDraftType] = useState<DraftType>('standard')  // 톤 단일화: STANDARD 고정
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: '' })
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const abortRef = useRef(false)

  // ── 일괄 자동 처리(triage 파이프라인) 상태 (Wave 16) ───────────────────────────
  const [bulkProcRunning, setBulkProcRunning] = useState(false)
  const [bulkProcDone, setBulkProcDone] = useState(0)
  const [bulkProcRemaining, setBulkProcRemaining] = useState(0)

  // ── 전체 답변 재생성(엔진 업그레이드 반영) 상태 (Wave 24) ──────────────────────
  const [regenRunning, setRegenRunning] = useState(false)
  const [regenDone, setRegenDone] = useState(0)

  // ── Gmail식 일괄 선택 / Soft Delete 상태 (Wave 15) ──────────────────────────────
  const [selectAllMatching, setSelectAllMatching] = useState(false)  // 필터 조건 전체 선택
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

  // ── 아카이브 모드: 복구 / 영구 삭제(이중 확인) 상태 (Wave 17) ────────────────────
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [hardStep, setHardStep] = useState<0 | 1 | 2>(0)  // 0=닫힘, 1=1차 경고, 2=최종 확인
  const [hardAck, setHardAck] = useState(false)           // 최종 단계 "되돌릴 수 없음" 동의
  const [isHardDeleting, setIsHardDeleting] = useState(false)

  // ── 서버 모드 URL 네비게이션 ────────────────────────────────────────────────────
  const buildServerUrl = useCallback(
    (overrides: Record<string, string | number | null>): string => {
      if (!server) return server!.basePath
      const params = new URLSearchParams()
      // 기존 보존 쿼리
      for (const [k, v] of Object.entries(server.query)) if (v) params.set(k, v)
      // 현재 필터/정렬/페이지
      if (server.activeStatus) params.set('status', server.activeStatus)
      if (server.activeRisk)   params.set('risk', server.activeRisk)
      if (server.activeRating) params.set('rating', server.activeRating)
      // 정렬 (기본 date/desc가 아닐 때만 URL에 명시)
      if (server.activeSort !== 'date') params.set('sort', server.activeSort)
      if (server.activeDir !== 'desc')  params.set('dir', server.activeDir)
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

  // 현재 필터 기준 Excel(CSV) 내보내기 URL
  function buildExportUrl(): string {
    if (!server) return '/api/review/export'
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(server.query)) if (v) p.set(k, v)
    if (server.activeStatus) p.set('status', server.activeStatus)
    if (server.activeRisk)   p.set('risk', server.activeRisk)
    if (server.activeRating) p.set('rating', server.activeRating)
    const qs = p.toString()
    return qs ? `/api/review/export?${qs}` : '/api/review/export'
  }

  function toggleServerFilter(key: 'status' | 'risk' | 'rating', value: string) {
    const current = key === 'status' ? server!.activeStatus : key === 'risk' ? server!.activeRisk : server!.activeRating
    router.push(buildServerUrl({ [key]: current === value ? null : value, page: 1 }))
  }

  // 정렬 상태 (서버/클라이언트 통합)
  const curSort: SortCol = isServer ? server!.activeSort : sortCol
  const curDir: 'asc' | 'desc' = isServer ? server!.activeDir : sortDir

  function handleSort(col: SortCol) {
    if (isServer) {
      // 서버 모드: 전체 DB 기준 정렬 → URL 갱신, 1페이지로 이동
      const nextDir = server!.activeSort === col && server!.activeDir === 'desc' ? 'asc' : 'desc'
      router.push(buildServerUrl({ sort: col, dir: nextDir, page: 1 }))
    } else {
      if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      else { setSortCol(col); setSortDir('desc') }
    }
  }

  // ── 표시 행 계산 ────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    // 서버 모드: 서버에서 이미 필터·정렬됨 → 그대로 사용 (전체 DB 기준)
    if (isServer) return reviews

    // 클라이언트 모드(대시보드): 인메모리 필터 + 정렬
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

  // ── 아카이브: 일괄 복구 (가역 — 전체선택 허용) ──────────────────────────────────
  async function runRestore() {
    setIsRestoring(true)
    try {
      const payload = selectAllMatching && server
        ? {
            action: 'restore',
            mode: 'filter',
            filter: {
              ...server.query,
              status: server.activeStatus || undefined,
              risk:   server.activeRisk || undefined,
              rating: server.activeRating || undefined,
            },
          }
        : { action: 'restore', mode: 'ids', ids: [...selected] }

      const res = await fetch('/api/review/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteMsg(data.error ?? 'error')
      } else {
        setDeleteMsg(fmt(t.arch_restore_done, { n: data.count ?? 0 }))
        clearSelection()
        setShowRestoreModal(false)
        router.refresh()
      }
    } catch {
      setDeleteMsg(t.rd_toast_server_err)
    }
    setIsRestoring(false)
  }

  // ── 아카이브: 일괄 영구 삭제 (비가역 — 개별 선택 ID만, 전체선택 차단) ─────────────
  function closeHard() { setHardStep(0); setHardAck(false) }
  async function runHardDelete() {
    // 안전 잠금: 비관리자는 전체선택 영구삭제 불가. 관리자는 필터 전체 삭제 허용.
    if (selectAllMatching && !isAdmin) return
    setIsHardDeleting(true)
    try {
      const payload = selectAllMatching && server
        ? {
            action: 'hard_delete',
            mode: 'filter',
            filter: {
              ...server.query,
              status: server.activeStatus || undefined,
              risk:   server.activeRisk || undefined,
              rating: server.activeRating || undefined,
            },
          }
        : { action: 'hard_delete', mode: 'ids', ids: [...selected] }

      const res = await fetch('/api/review/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteMsg(data.error ?? 'error')
      } else {
        setDeleteMsg(fmt(t.arch_harddelete_done, { n: data.count ?? 0 }))
        clearSelection()
        closeHard()
        router.refresh()
      }
    } catch {
      setDeleteMsg(t.rd_toast_server_err)
    }
    setIsHardDeleting(false)
  }

  // ── 일괄 자동 처리 (Wave 16) — 청크 반복 호출로 대량 안전 처리 ──────────────────
  // 듀얼 라우팅(저위험=알고리즘 템플릿 / 고위험=AI 초안+격리)은 백엔드 오케스트레이터가 수행.
  async function runBulkProcess() {
    if (bulkProcRunning) return
    abortRef.current = false
    setBulkProcRunning(true)
    setBulkProcDone(0)
    setBulkProcRemaining(selectedCount)

    const basePayload = selectAllMatching && server
      ? {
          mode: 'filter' as const,
          filter: {
            ...server.query,
            risk:   server.activeRisk || undefined,
            rating: server.activeRating || undefined,
          },
        }
      : { mode: 'ids' as const, ids: [...selected] }

    let totalProcessed = 0
    try {
      // done=true 또는 진행 정지(처리 0건)까지 청크 반복
      for (let guard = 0; guard < 1000; guard++) {
        if (abortRef.current) break
        const res = await fetch('/api/review/bulk-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload),
        })
        const data = await res.json()
        if (!res.ok) { setDeleteMsg(data.error ?? 'error'); break }
        totalProcessed += data.processed ?? 0
        setBulkProcDone(totalProcessed)
        setBulkProcRemaining(data.remaining ?? 0)
        if (data.done || (data.processed ?? 0) === 0) break
      }
      setDeleteMsg(`✅ 일괄 처리 완료 — ${totalProcessed}건 처리됨`)
      clearSelection()
      router.refresh()
    } catch {
      setDeleteMsg(t.rd_toast_server_err)
    }
    setBulkProcRunning(false)
  }

  // ── 전체 답변 재생성 (Wave 24) — 엔진 업그레이드를 기존 초안에 반영 ───────────────
  // 커서 페이지네이션으로 final 아닌 전체 리뷰를 1회 순회하며 최신 엔진으로 초안을 다시 만든다.
  // 사람이 수정한 초안은 서버가 자동 스킵(보존). 현재 필터 범위에만 적용.
  async function runRegenerate() {
    if (regenRunning) return
    if (!confirm('현재 목록(필터) 범위의 답변 초안을 최신 엔진으로 다시 생성합니다.\n사람이 수정한 초안은 보존됩니다. 계속할까요?')) return
    abortRef.current = false
    setRegenRunning(true)
    setRegenDone(0)
    const filter = server
      ? { ...server.query, risk: server.activeRisk || undefined, rating: server.activeRating || undefined }
      : {}
    let cursor = ''
    let total = 0
    try {
      for (let guard = 0; guard < 4000; guard++) {
        if (abortRef.current) break
        const res = await fetch('/api/review/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor, filter }),
        })
        const data = await res.json()
        if (!res.ok) { setDeleteMsg(data.error ?? 'error'); break }
        total += data.processed ?? 0
        setRegenDone(total)
        cursor = data.nextCursor ?? cursor
        if (data.done) break
      }
      setDeleteMsg(`✅ 답변 재생성 완료 — ${total}건 갱신됨`)
      router.refresh()
    } catch {
      setDeleteMsg(t.rd_toast_server_err)
    }
    setRegenRunning(false)
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
            // 결정론적 게이트키퍼: SAFE=정적 템플릿(LLM 미사용) / 불만·모호=LLM Fallback / 긴급=수동 격리
            const res = await fetch('/api/review/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ review_id: id }),
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
    curSort === col
      ? <span className="ml-0.5 text-blue-500">{curDir === 'desc' ? '↓' : '↑'}</span>
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
        {isServer && (
          <a href={buildExportUrl()} download
            className="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
            ⬇ {t.rv_export_excel}
          </a>
        )}
        {isServer && isAdmin && (
          <button onClick={runRegenerate} disabled={regenRunning} title="최신 엔진으로 현재 필터 범위의 답변 초안을 다시 생성합니다 (사람 수정분 보존)"
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors disabled:opacity-50 ${isServer ? '' : 'ml-auto'} border-purple-300 text-purple-700 hover:bg-purple-50`}>
            {regenRunning ? `♻ 재생성 중… ${regenDone}건` : '♻ 답변 재생성'}
          </button>
        )}
        <span className={`${isServer ? 'ml-2' : 'ml-auto'} text-xs text-gray-400 whitespace-nowrap shrink-0`}>
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
        <div className={`mb-3 rounded-xl px-4 py-3 border ${archiveMode ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
          {/* 아카이브 모드: 복구 + 영구 삭제만 노출 (AI/배치/소프트삭제 숨김) */}
          {archiveMode && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-800">{t.rv_batch_selected}: {selectedCount}{t.stat_unit}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => setShowRestoreModal(true)} disabled={isRestoring || !hasSelection}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  ↩ {fmt(t.arch_restore_selected, { n: selectedCount })}
                </button>
                <button
                  onClick={() => { setHardAck(false); setHardStep(1) }}
                  disabled={selectAllMatching ? (!isAdmin || (server?.total ?? 0) === 0) : (selected.size === 0 || selected.size > MAX_HARD_DELETE)}
                  title={selectAllMatching && !isAdmin ? t.arch_hard_no_selectall : (!selectAllMatching && selected.size > MAX_HARD_DELETE) ? fmt(t.arch_hard_cap_warn, { max: MAX_HARD_DELETE }) : ''}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  🔥 {fmt(t.arch_harddelete_selected, { n: selectAllMatching ? selectedCount : selected.size })}
                </button>
                <button onClick={clearSelection}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                  {t.rv_deselect}
                </button>
              </div>
              {selectAllMatching && !isAdmin && (
                <p className="w-full text-xs text-amber-700 mt-0.5">⚠ {t.arch_hard_no_selectall}</p>
              )}
              {selectAllMatching && isAdmin && (
                <p className="w-full text-xs text-red-700 font-medium mt-0.5">🔥 {fmt(t.arch_hard_all_warn, { n: selectedCount })}</p>
              )}
              {!selectAllMatching && selected.size > MAX_HARD_DELETE && (
                <p className="w-full text-xs text-amber-700 mt-0.5">⚠ {fmt(t.arch_hard_cap_warn, { max: MAX_HARD_DELETE })}</p>
              )}
            </div>
          )}
          {!archiveMode && batchStatus === 'idle' && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-blue-800">{t.rv_batch_selected}: {selectedCount}{t.stat_unit}</span>
              {/* 톤 단일화(STANDARD): 표준/짧게/조심스럽게 선택기 제거 — 게이트키퍼가 톤·엔진 결정 */}
              <div className="flex items-center gap-2 ml-auto">
                {/* 소량(현재 페이지 new) 편집형 AI 배치 — 인라인 모달 UX */}
                {someNewChecked && !selectAllMatching && (
                  <button onClick={runAiBatch}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                    {t.rv_generate} ({selectedNew.length})
                  </button>
                )}
                {/* 대량 자동 처리 — 전체선택 시에도 노출(uncap). 듀얼 라우팅 백엔드 청크 처리 */}
                <button onClick={runBulkProcess} disabled={bulkProcRunning}
                  className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {bulkProcRunning
                    ? `⚙ 처리 중… ${bulkProcDone}건 완료 (남은 ${bulkProcRemaining})`
                    : `⚡ 일괄 자동 처리 (${selectedCount})`}
                </button>
                <button onClick={() => setShowDeleteModal(true)} disabled={bulkProcRunning}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  🗑 {fmt(t.rv_delete_selected, { n: selectedCount })}
                </button>
                <button onClick={clearSelection}
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                  {t.rv_deselect}
                </button>
              </div>
            </div>
          )}
          {!archiveMode && batchStatus === 'running' && (
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
                  onClick={archiveMode ? undefined : () => setActiveReview(review)}
                  className={`transition-colors ${archiveMode ? '' : 'cursor-pointer'} ${
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
                    {(review.status === 'ai_done' || review.status === 'pending_approval') && (review.risk_reasons?.[0] || review.internal_note_ko) && (
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-1 break-words hover:line-clamp-none"
                        title={review.risk_reasons?.[0] ?? review.internal_note_ko ?? ''}>
                        🏷 {review.risk_reasons?.[0] ?? review.internal_note_ko}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {archiveMode ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      <Link href={`/reviews/${review.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                        {t.rv_view_detail}
                      </Link>
                    )}
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

      {/* ── 슬라이드오버 드로어 (아카이브 모드에서는 비활성) ──────────────────── */}
      {!archiveMode && (
        <ReviewDrawer
          review={activeReview}
          onClose={() => setActiveReview(null)}
          onSaved={(id, reply) => setDraftOverrides((prev) => ({ ...prev, [id]: reply }))}
        />
      )}

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

      {/* ── 아카이브: 복구 확인 모달 (가역, 1단계) ─────────────────────────────── */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isRestoring) setShowRestoreModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">↩️</span>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {fmt(t.arch_restore_confirm_title, { n: selectedCount })}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{t.arch_restore_confirm_desc}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowRestoreModal(false)} disabled={isRestoring}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {t.rv_cancel}
              </button>
              <button onClick={runRestore} disabled={isRestoring}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {isRestoring ? t.arch_restoring : t.arch_restore_confirm_btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 아카이브: 영구 삭제 이중 경고 모달 (비가역, 2단계 + 동의 체크) ────────── */}
      {hardStep > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isHardDeleting) closeHard() }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-2 border-red-200">
            {hardStep === 1 ? (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <h3 className="text-base font-bold text-red-700">
                      {fmt(t.arch_hard_title1, { n: selectAllMatching ? selectedCount : selected.size })}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{t.arch_hard_desc1}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-5">
                  <button onClick={closeHard}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    {t.rv_cancel}
                  </button>
                  <button onClick={() => setHardStep(2)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
                    {t.arch_hard_next} →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-base font-bold text-red-700">
                      {fmt(t.arch_hard_title2, { n: selectAllMatching ? selectedCount : selected.size })}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{t.arch_hard_desc2}</p>
                  </div>
                </div>
                <label className="flex items-start gap-2 mt-3 cursor-pointer rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <input type="checkbox" checked={hardAck} onChange={(e) => setHardAck(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300" />
                  <span className="text-sm text-red-800 font-medium">{t.arch_hard_ack}</span>
                </label>
                <div className="flex items-center justify-end gap-2 mt-5">
                  <button onClick={closeHard} disabled={isHardDeleting}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {t.rv_cancel}
                  </button>
                  <button onClick={runHardDelete} disabled={!hardAck || isHardDeleting}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {isHardDeleting ? t.arch_deleting : t.arch_hard_confirm_btn}
                  </button>
                </div>
              </>
            )}
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

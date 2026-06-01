import { createClient } from '@/lib/supabase/server'
import type { Review, ReviewTelemetry } from '@/types/database'
import DashboardPageContent from './DashboardPageContent'

const PENDING_PAGE_SIZE = 20

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    pending_page?: string
    branch?: string
    channel?: string
  }>
}) {
  const params        = await searchParams
  const page          = Math.max(1, parseInt(params.pending_page ?? '1', 10))
  const offset        = (page - 1) * PENDING_PAGE_SIZE
  const activeBranch  = params.branch  ?? ''
  const activeChannel = params.channel ?? ''

  const supabase = await createClient()

  // ── 현재 사용자 역할 조회 ─────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  // 상태별 정확한 카운트 헬퍼 (head:true — 행 미반환, count만). allReviews 인메모리
  // 집계는 Supabase 기본 1000행 cap에 영향받으므로, 위젯 카운트는 exact count로 분리한다.
  const statusCountQuery = (status: string) => {
    let q = supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', status)
    if (activeBranch)  q = q.eq('branch_code',  activeBranch)
    if (activeChannel) q = q.eq('channel_code', activeChannel)
    return q
  }

  // ── 병렬 조회 ────────────────────────────────────────────────────────────────
  const [
    { data: allData },
    pendingResult,
    { data: branches },
    { data: channels },
    { data: profile },
    { count: newCountExact },
    { count: aiDoneCountExact },
    { count: pendingApprovalCountExact },
  ] = await Promise.all([
    // 전체 데이터셋 (필터 적용) — DashboardStats용
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

    // 처리 대기 목록 — 페이지네이션
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

    // 필터 옵션 목록
    supabase.from('branches').select('code, name_ko, name_en').eq('is_active', true).order('code'),
    supabase.from('channels').select('code, name').eq('is_active', true).order('code'),

    // 사용자 역할
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),

    // 상태별 정확한 카운트 (위젯-리스트 동기화용)
    statusCountQuery('new'),
    statusCountQuery('ai_done'),
    statusCountQuery('pending_approval'),
  ])

  const pendingData       = pendingResult.data
  const pendingTotal      = pendingResult.count ?? 0
  const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / PENDING_PAGE_SIZE))

  const allReviews: Review[]     = (allData     ?? []) as unknown as Review[]
  const pendingReviews: Review[] = (pendingData ?? []) as unknown as Review[]

  // ── 초안 미리보기 + 텔레메트리 맵 ─────────────────────────────────────────────
  const pendingIds = pendingReviews.map((r) => r.id)
  const { data: pendingDrafts } = pendingIds.length
    ? await supabase
        .from('reply_drafts')
        .select('review_id, selected_reply, intent_code, intent_confidence, pipeline_engine, model_name, prompt_version')
        .in('review_id', pendingIds)
    : { data: [] }

  const pendingDraftMap: Record<string, string> = {}
  const pendingTelemetryMap: Record<string, ReviewTelemetry> = {}
  for (const d of pendingDrafts ?? []) {
    if (d.selected_reply) pendingDraftMap[d.review_id] = d.selected_reply
    pendingTelemetryMap[d.review_id] = {
      intent_code:       d.intent_code ?? null,
      intent_confidence: d.intent_confidence ?? null,
      pipeline_engine:   d.pipeline_engine ?? null,
      model_name:        d.model_name ?? null,
      prompt_version:    d.prompt_version ?? null,
    }
  }

  // ── 역할 판별 ──────────────────────────────────────────────────────────────────
  const isDirector = profile?.role === 'admin' || profile?.role === 'director'

  // ── 격리 리뷰 (director 전용) — risk 내림차순 → 날짜 내림차순 ───────────────────
  const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const isolatedReviews = allReviews
    .filter((r) => r.status === 'pending_approval')
    .sort((a, b) => {
      const ra = RISK_ORDER[a.risk_level ?? 'low'] ?? 3
      const rb = RISK_ORDER[b.risk_level ?? 'low'] ?? 3
      if (ra !== rb) return ra - rb
      return (
        new Date(b.review_created_at ?? b.created_at).getTime() -
        new Date(a.review_created_at ?? a.created_at).getTime()
      )
    })
    .slice(0, 30)

  // ── 상태별 카운터 (exact count — 위젯 합계 = pendingTotal = 리스트 전체 건수) ──────
  const newCount             = newCountExact ?? 0
  const aiDoneCount          = aiDoneCountExact ?? 0
  const pendingApprovalCount = pendingApprovalCountExact ?? 0

  // ── 최근 처리 완료 ──────────────────────────────────────────────────────────────
  const recentActivity = allReviews
    .filter((r) => r.status === 'manual_published' || r.status === 'approved')
    .slice(0, 5)

  // ── 페이지 번호 목록 (말줄임 압축) ─────────────────────────────────────────────
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
    <DashboardPageContent
      allReviews={allReviews}
      pendingReviews={pendingReviews}
      pendingDraftMap={pendingDraftMap}
      pendingTelemetryMap={pendingTelemetryMap}
      pendingTotal={pendingTotal}
      page={page}
      offset={offset}
      pendingTotalPages={pendingTotalPages}
      activeBranch={activeBranch}
      activeChannel={activeChannel}
      branches={branches ?? []}
      channels={channels ?? []}
      isDirector={isDirector}
      isolatedReviews={isolatedReviews}
      newCount={newCount}
      aiDoneCount={aiDoneCount}
      pendingApprovalCount={pendingApprovalCount}
      recentActivity={recentActivity}
      pageItems={pageItems}
    />
  )
}

/**
 * POST /api/review/bulk-delete  (Wave 15 → 확장 Wave 17)
 *
 * 리뷰 일괄 액션 — body.action 으로 분기:
 *   - 'soft_delete' (기본) : deleted_at 설정(보관함 이동). ids | filter(Gmail 전체선택) 지원.
 *   - 'restore'            : deleted_at = null(복구). ids | filter 지원(가역적이므로 안전).
 *   - 'hard_delete'        : 물리 삭제(DELETE). ★안전 잠금★ — 아래 제약 참조.
 *
 * 페이로드:
 *   { action?, mode: 'ids',    ids: string[] }           현재 페이지 선택분
 *   { action?, mode: 'filter', filter: ReviewFilter }    "필터 조건 전체 선택" (수천 건, ID 미전송)
 *
 * ── Hard Delete 안전 잠금 (DECISIONS #9 / CLAUDE.md 핵심규칙 #6 보존 취지) ──
 *   1) ids 모드만 허용 — filter/전체선택(isAllMatching) 대량 물리 삭제는 원천 차단.
 *   2) 최대 MAX_HARD_DELETE 건 상한.
 *   3) 이미 소프트 삭제된(deleted_at IS NOT NULL) 행만 대상 — 라이브 리뷰는 물리 삭제 불가.
 *   4) staff 는 담당 지점 범위 내에서만 (앱 레이어 가드, RLS 미적용 환경 방어).
 *   5) 삭제 전 activity_logs 감사 기록(행이 사라지므로 사전 기록).
 *   6) 실제 삭제는 hard_delete_reviews RPC(트랜잭션 + FK 보호 + deleted_at 재검증)로 수행.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBranchAccess } from '@/lib/auth/branchAccess'

interface ReviewFilter {
  branch?: string
  channel?: string
  status?: string
  risk?: string
  rating?: string
  q?: string
  date_from?: string
  date_to?: string
}

type Action = 'soft_delete' | 'restore' | 'hard_delete'

const MAX_IDS = 500          // soft delete / restore (가역)
const MAX_HARD_DELETE = 100  // 영구 삭제 (비가역) — 더 엄격한 상한

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // staff는 담당 지점 밖 데이터를 일괄 처리할 수 없다(범위 강제). admin은 제한 없음.
  const branchGuard = !access.isAdmin

  let body: { mode?: string; ids?: string[]; filter?: ReviewFilter; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const action: Action =
    body.action === 'restore' ? 'restore'
    : body.action === 'hard_delete' ? 'hard_delete'
    : 'soft_delete'

  // ════════════════════════════════════════════════════════════════════════
  //  HARD DELETE — 물리 삭제 (안전 잠금)
  // ════════════════════════════════════════════════════════════════════════
  if (action === 'hard_delete') {
    const isFilter = body.mode === 'filter'
    if (!isFilter && body.mode !== 'ids') {
      return NextResponse.json({ error: 'mode는 ids 또는 filter여야 합니다.' }, { status: 400 })
    }

    let targetIds: string[]
    let auditDetail: Record<string, unknown>

    if (isFilter) {
      // ── 필터 조건 전체 영구 삭제 (Gmail식 전체 선택) — 관리자 전용 ──────────────
      if (!access.isAdmin) {
        return NextResponse.json(
          { error: '필터 조건 전체 영구 삭제는 관리자만 가능합니다. 개별 항목을 선택해 주세요.' },
          { status: 403 },
        )
      }
      const f = body.filter ?? {}
      const qSafe = (f.q ?? '').replace(/[%,()]/g, ' ').trim()
      // 보관함(deleted_at IS NOT NULL) 중 필터 일치 행만 대상. 관리자이므로 지점 제한 없음.
      let sq = supabase.from('reviews').select('id').not('deleted_at', 'is', null)
      if (f.branch)    sq = sq.eq('branch_code', f.branch)
      if (f.channel)   sq = sq.eq('channel_code', f.channel)
      if (f.status)    sq = sq.eq('status', f.status)
      if (f.risk)      sq = sq.eq('risk_level', f.risk)
      if (f.rating)    sq = sq.eq('rating', Number(f.rating))
      if (f.date_from) sq = sq.gte('review_created_at', f.date_from)
      if (f.date_to)   sq = sq.lte('review_created_at', f.date_to + 'T23:59:59')
      if (qSafe) sq = sq.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
      const { data: rows, error: sErr } = await sq
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
      targetIds = (rows ?? []).map((r) => r.id as string)
      auditDetail = { mode: 'filter', filter: f, count_requested: targetIds.length }
    } else {
      const ids = (body.ids ?? []).filter((x) => typeof x === 'string')
      if (ids.length === 0) return NextResponse.json({ error: '선택된 항목이 없습니다.' }, { status: 400 })
      if (ids.length > MAX_HARD_DELETE) {
        return NextResponse.json({ error: `영구 삭제는 한 번에 최대 ${MAX_HARD_DELETE}건까지 가능합니다.` }, { status: 400 })
      }
      // 대상 검증: 소프트 삭제됨(보관함) + (staff면) 담당 지점 범위.
      let vq = supabase.from('reviews').select('id').in('id', ids).not('deleted_at', 'is', null)
      if (branchGuard) vq = vq.in('branch_code', access.branches)
      const { data: rows, error: vErr } = await vq
      if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
      targetIds = (rows ?? []).map((r) => r.id as string)
      auditDetail = { mode: 'ids', count_requested: ids.length }
    }

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: '영구 삭제할 수 있는 항목이 없습니다. (보관함에 있는 항목만 영구 삭제할 수 있습니다.)' },
        { status: 400 },
      )
    }

    // 감사 로그 — 행이 물리적으로 사라지므로 삭제 전에 기록한다.
    await supabase.from('activity_logs').insert({
      review_id:  null,
      actor_name: access.email,
      action:     'bulk_hard_deleted',
      detail:     auditDetail,
    })

    // 물리 삭제 (RPC: 트랜잭션 + deleted_at 재검증 + 순환 FK 정리). 대량 대비 청크 처리.
    const CHUNK = 200
    let deleted = 0
    for (let i = 0; i < targetIds.length; i += CHUNK) {
      const slice = targetIds.slice(i, i + CHUNK)
      const { data: delCount, error: dErr } = await supabase.rpc('hard_delete_reviews', { p_ids: slice })
      if (dErr) return NextResponse.json({ error: dErr.message, partial_deleted: deleted }, { status: 500 })
      deleted += (delCount as number) ?? slice.length
    }

    return NextResponse.json({ success: true, action, count: deleted })
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SOFT DELETE / RESTORE — deleted_at 토글 (가역)
  // ════════════════════════════════════════════════════════════════════════
  const isRestore = action === 'restore'
  const nowIso = new Date().toISOString()

  // restore: 삭제된 행을 되살림(deleted_at=null) / soft_delete: 살아있는 행을 보관(deleted_at=now)
  let q = supabase
    .from('reviews')
    .update({ deleted_at: isRestore ? null : nowIso, updated_at: nowIso })
  q = isRestore ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null)

  let scope: Record<string, unknown>

  if (body.mode === 'ids') {
    const ids = (body.ids ?? []).filter((x) => typeof x === 'string')
    if (ids.length === 0) return NextResponse.json({ error: '선택된 항목이 없습니다.' }, { status: 400 })
    if (ids.length > MAX_IDS) return NextResponse.json({ error: `한 번에 최대 ${MAX_IDS}건까지 처리할 수 있습니다.` }, { status: 400 })
    q = q.in('id', ids)
    scope = { mode: 'ids', count_requested: ids.length }
  } else if (body.mode === 'filter') {
    const f = body.filter ?? {}
    const qSafe = (f.q ?? '').replace(/[%,()]/g, ' ').trim()
    if (f.branch)    q = q.eq('branch_code', f.branch)
    if (f.channel)   q = q.eq('channel_code', f.channel)
    if (f.status)    q = q.eq('status', f.status)
    if (f.risk)      q = q.eq('risk_level', f.risk)
    if (f.rating)    q = q.eq('rating', Number(f.rating))
    if (f.date_from) q = q.gte('review_created_at', f.date_from)
    if (f.date_to)   q = q.lte('review_created_at', f.date_to + 'T23:59:59')
    if (qSafe) q = q.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
    scope = { mode: 'filter', filter: f }
  } else {
    return NextResponse.json({ error: 'mode는 ids 또는 filter여야 합니다.' }, { status: 400 })
  }

  // 지점 권한 강제 (staff는 담당 지점만). 빈 배열이면 아무것도 매칭되지 않음(fail-closed).
  if (branchGuard) q = q.in('branch_code', access.branches)

  const { data, error } = await q.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const count = data?.length ?? 0

  await supabase.from('activity_logs').insert({
    review_id:  null,
    actor_name: access.email,
    action:     isRestore ? 'bulk_restored' : 'bulk_soft_deleted',
    detail:     { ...scope, [isRestore ? 'restored_count' : 'deleted_count']: count },
  })

  return NextResponse.json({ success: true, action, count })
}

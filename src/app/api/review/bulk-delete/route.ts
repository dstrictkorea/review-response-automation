/**
 * POST /api/review/bulk-delete  (Wave 15)
 *
 * 대규모 일괄 Soft Delete — 두 모드:
 *   { mode: 'ids',    ids: string[] }          현재 페이지에서 선택된 항목
 *   { mode: 'filter', filter: ReviewFilter }   "필터 조건 전체 선택" (Gmail 방식)
 *
 * 'filter' 모드는 수천 개 ID를 클라이언트→서버로 전송하지 않고, 필터 조건만
 * 페이로드로 받아 백엔드에서 단일 UPDATE 쿼리로 처리한다 (병목 없음).
 *
 * 사용자 세션 클라이언트를 사용하므로(RLS 적용 시) 권한 밖 지점은 자동 제외된다.
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

const MAX_IDS = 500

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // staff는 담당 지점 밖 데이터를 일괄 삭제할 수 없다 (범위 강제).
  // admin은 제한 없음. RLS(009) 미적용 환경에서도 앱 레이어에서 차단.
  const branchGuard = !access.isAdmin

  let body: { mode?: string; ids?: string[]; filter?: ReviewFilter }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()

  // ── 빌드: soft-delete UPDATE 쿼리 (deleted_at IS NULL 만 대상) ───────────────
  let q = supabase
    .from('reviews')
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .is('deleted_at', null)

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

  // 업데이트된 행 ID 반환 → 처리 건수 집계
  const { data, error } = await q.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const count = data?.length ?? 0

  await supabase.from('activity_logs').insert({
    review_id:  null,
    actor_name: access.email,
    action:     'bulk_soft_deleted',
    detail:     { ...scope, deleted_count: count },
  })

  return NextResponse.json({ success: true, count })
}

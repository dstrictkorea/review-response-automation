/**
 * POST /api/review/bulk-process  (Wave 16)
 *
 * 대량 자동 처리 — 청크(25건) 단위로 결정론적 게이트키퍼(processReviewById)를 돌린다.
 * 엔진이 듀얼 라우팅을 수행:
 *   - SAFE/COMPLIMENT: 정적 템플릿(LLM 비용 0) → ai_done
 *   - EMERGENCY/COMPLAINT/AMBIGUOUS: AI 초안 + pending_approval 격리 (자동 게시 원천 차단)
 *
 * 페이로드:
 *   { mode: 'filter', filter: ReviewFilter }   "필터 조건 전체"(수천 건) — ID 미전송
 *   { mode: 'ids',    ids: string[] }           현재 페이지 선택분
 *
 * 자기-전진(self-advancing): status='new' 인 행만 처리 → 처리되면 'new'에서 빠지므로
 * 클라이언트가 done=false 동안 반복 호출하면 다음 청크가 자연히 처리된다.
 * Rate-limit/timeout 방지를 위해 한 요청당 CHUNK 건만, 동시성 CONCURRENCY 로 제한.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBranchAccess } from '@/lib/auth/branchAccess'
import { processReviewById } from '@/lib/processReviewById'

interface ReviewFilter {
  branch?: string
  channel?: string
  risk?: string
  rating?: string
  q?: string
  date_from?: string
  date_to?: string
}

const CHUNK = 25
const CONCURRENCY = 3

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: { mode?: string; ids?: string[]; filter?: ReviewFilter }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const isIds = body.mode === 'ids'
  const ids0  = (body.ids ?? []).filter((x) => typeof x === 'string')
  const f     = body.filter ?? {}
  const qSafe = (f.q ?? '').replace(/[%,()]/g, ' ').trim()

  // ── 이번 청크 대상 ID (미처리 status='new' 만) ──────────────────────────────
  let selQ = supabase.from('reviews').select('id').eq('status', 'new').is('deleted_at', null)
  if (isIds) {
    selQ = selQ.in('id', ids0)
  } else {
    if (f.branch)    selQ = selQ.eq('branch_code', f.branch)
    if (f.channel)   selQ = selQ.eq('channel_code', f.channel)
    if (f.risk)      selQ = selQ.eq('risk_level', f.risk)
    if (f.rating)    selQ = selQ.eq('rating', Number(f.rating))
    if (f.date_from) selQ = selQ.gte('review_created_at', f.date_from)
    if (f.date_to)   selQ = selQ.lte('review_created_at', f.date_to + 'T23:59:59')
    if (qSafe) selQ = selQ.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  }
  if (!access.isAdmin) selQ = selQ.in('branch_code', access.branches)  // staff 지점 범위 강제
  selQ = selQ.order('review_created_at', { ascending: true, nullsFirst: true }).limit(CHUNK)

  const { data: idRows, error: selErr } = await selQ
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  const ids = (idRows ?? []).map((r) => r.id as string)

  // 처리 (제한 동시성). 실패 건은 'failed'로 표기하여 무한 재처리 방지.
  const admin = createAdminClient()
  let processed = 0
  let failed = 0
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (id) => {
        try {
          await processReviewById(id, 'system:bulk-process', admin)
          processed++
        } catch (err) {
          failed++
          await admin.from('reviews').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
          console.error(`[bulk-process] ${id} failed:`, err instanceof Error ? err.message : String(err))
        }
      }),
    )
  }

  // ── 남은 미처리 건수 (동일 필터 head count) ─────────────────────────────────
  let cntQ = supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'new').is('deleted_at', null)
  if (isIds) {
    cntQ = cntQ.in('id', ids0)
  } else {
    if (f.branch)    cntQ = cntQ.eq('branch_code', f.branch)
    if (f.channel)   cntQ = cntQ.eq('channel_code', f.channel)
    if (f.risk)      cntQ = cntQ.eq('risk_level', f.risk)
    if (f.rating)    cntQ = cntQ.eq('rating', Number(f.rating))
    if (f.date_from) cntQ = cntQ.gte('review_created_at', f.date_from)
    if (f.date_to)   cntQ = cntQ.lte('review_created_at', f.date_to + 'T23:59:59')
    if (qSafe) cntQ = cntQ.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  }
  if (!access.isAdmin) cntQ = cntQ.in('branch_code', access.branches)
  const { count } = await cntQ
  const remaining = count ?? 0

  return NextResponse.json({
    success: true,
    processed,
    failed,
    remaining,
    done: remaining === 0,
  })
}

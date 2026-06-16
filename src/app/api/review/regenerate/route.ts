/**
 * POST /api/review/regenerate  (Wave 24)
 *
 * 엔진 업그레이드 후, 이미 처리된 리뷰들의 정적 초안을 최신 엔진으로 '재생성'한다.
 * bulk-process는 status='new'만 처리하므로, ai_done/pending_approval로 굳어진 기존 초안은
 * 엔진이 좋아져도 갱신되지 않는다(작품 자랑·discover·중복 등 옛 문구가 남음). 이 엔드포인트가
 * 그 간극을 메운다.
 *
 * 안전 원칙:
 *   - 사람이 수정한 초안(reply_drafts.human_edited_reply != null)은 절대 덮어쓰지 않는다(스킵).
 *   - final 상태(manual_published, no_reply)는 재생성하지 않는다.
 *   - processReviewById가 인입 위험도/긴급 격리/금칙어 가드를 그대로 적용 → 안전 규칙 불변.
 *
 * 커서 페이지네이션(자기-전진): id 오름차순으로 CHUNK씩 처리하고 마지막 id를 nextCursor로 반환.
 * 클라이언트가 done=false 동안 nextCursor를 넘겨 반복 호출 → 전체 1회 순회 후 종료.
 *
 * 페이로드: { cursor?: string, filter?: ReviewFilter }
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
// 재생성 대상 = final(manual_published/no_reply)·아카이브를 제외한 처리 상태 전부.
const REGENERATABLE_STATUSES = ['new', 'ai_done', 'pending_approval', 'failed']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: { cursor?: string; filter?: ReviewFilter }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const cursor = typeof body.cursor === 'string' ? body.cursor : ''
  const f = body.filter ?? {}
  const qSafe = (f.q ?? '').replace(/[%,()]/g, ' ').trim()

  // ── 이번 청크 대상: final 아님 + 미삭제 + (커서 이후), id 오름차순 ──────────────
  let selQ = supabase
    .from('reviews')
    .select('id, status')
    .in('status', REGENERATABLE_STATUSES)
    .is('deleted_at', null)
  if (cursor) selQ = selQ.gt('id', cursor)
  if (f.branch)    selQ = selQ.eq('branch_code', f.branch)
  if (f.channel)   selQ = selQ.eq('channel_code', f.channel)
  if (f.risk)      selQ = selQ.eq('risk_level', f.risk)
  if (f.rating)    selQ = selQ.eq('rating', Number(f.rating))
  if (f.date_from) selQ = selQ.gte('review_created_at', f.date_from)
  if (f.date_to)   selQ = selQ.lte('review_created_at', f.date_to + 'T23:59:59')
  if (qSafe) selQ = selQ.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  if (!access.isAdmin) selQ = selQ.in('branch_code', access.branches)
  selQ = selQ.order('id', { ascending: true }).limit(CHUNK)

  const { data: idRows, error: selErr } = await selQ
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  const rows = (idRows ?? []) as Array<{ id: string }>
  const ids = rows.map((r) => r.id)

  if (ids.length === 0) {
    return NextResponse.json({ success: true, processed: 0, skipped: 0, nextCursor: cursor, done: true })
  }

  const admin = createAdminClient()

  // ── 사람이 수정한 초안은 스킵(보존) — 한 번에 조회해 집합으로 ──────────────────
  const { data: editedRows } = await admin
    .from('reply_drafts')
    .select('review_id')
    .in('review_id', ids)
    .not('human_edited_reply', 'is', null)
  const editedSet = new Set((editedRows ?? []).map((r) => (r as { review_id: string }).review_id))

  let processed = 0
  let skipped = 0
  const targets = ids.filter((id) => !editedSet.has(id))
  skipped += ids.length - targets.length

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (id) => {
        try {
          await processReviewById(id, 'system:regenerate', admin)
          processed++
        } catch (err) {
          skipped++
          console.error(`[regenerate] ${id} failed:`, err instanceof Error ? err.message : String(err))
        }
      }),
    )
  }

  // 다음 청크 커서 = 이번 청크의 마지막 id. CHUNK 미만이면 마지막 페이지 → done.
  const nextCursor = ids[ids.length - 1]
  const done = ids.length < CHUNK

  return NextResponse.json({ success: true, processed, skipped, nextCursor, done })
}

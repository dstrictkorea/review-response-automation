/**
 * GET /api/review/export — 리뷰 + 자동 생성 답변을 Excel(CSV, UTF-8 BOM)로 내려받는다.
 *
 * 현재 목록의 필터(branch/channel/status/risk/rating/q/date)를 쿼리스트링으로 받아 동일 조건으로 추출.
 * 분류 사유/태그/파이프라인까지 포함해, 엑셀에서 오분류를 검토하고 규칙을 개선하는 데 사용한다.
 * staff는 담당 지점만, admin은 전체. (deleted_at IS NULL 만, 최대 MAX_EXPORT 건)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBranchAccess } from '@/lib/auth/branchAccess'

const MAX_EXPORT = 5000

/** CSV 셀 이스케이프 — 줄바꿈 제거, 따옴표 이스케이프, 큰따옴표로 감싸기 */
function csvCell(v: unknown): string {
  if (v == null) return '""'
  const s = (Array.isArray(v) ? v.join(' / ') : String(v)).replace(/\r?\n/g, ' ').replace(/"/g, '""')
  return `"${s}"`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const f = {
    branch:    sp.get('branch'),
    channel:   sp.get('channel'),
    status:    sp.get('status'),
    risk:      sp.get('risk'),
    rating:    sp.get('rating'),
    q:         sp.get('q'),
    date_from: sp.get('date_from'),
    date_to:   sp.get('date_to'),
  }
  const qSafe = (f.q ?? '').replace(/[%,()]/g, ' ').trim()

  let query = supabase
    .from('reviews')
    .select('*')
    .is('deleted_at', null)
    .order('review_created_at', { ascending: false, nullsFirst: false })
  if (f.branch)    query = query.eq('branch_code', f.branch)
  if (f.channel)   query = query.eq('channel_code', f.channel)
  if (f.status)    query = query.eq('status', f.status)
  if (f.risk)      query = query.eq('risk_level', f.risk)
  if (f.rating)    query = query.eq('rating', Number(f.rating))
  if (f.date_from) query = query.gte('review_created_at', f.date_from)
  if (f.date_to)   query = query.lte('review_created_at', f.date_to + 'T23:59:59')
  if (qSafe) query = query.or(`review_text.ilike.%${qSafe}%,reviewer_name.ilike.%${qSafe}%,branch_code.ilike.%${qSafe}%,channel_code.ilike.%${qSafe}%`)
  if (!access.isAdmin) query = query.in('branch_code', access.branches)  // staff 지점 범위
  query = query.limit(MAX_EXPORT)

  const { data: reviews, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 답변 초안 조인 (현재 추출 행)
  const ids = (reviews ?? []).map((r) => r.id as string)
  const draftMap = new Map<string, { reply: string; engine: string; version: string; edited: boolean }>()
  if (ids.length) {
    const { data: drafts } = await supabase
      .from('reply_drafts')
      .select('review_id, selected_reply, human_edited_reply, pipeline_engine, prompt_version')
      .in('review_id', ids)
    for (const d of drafts ?? []) {
      draftMap.set(d.review_id, {
        reply:   d.human_edited_reply ?? d.selected_reply ?? '',
        engine:  d.pipeline_engine ?? '',
        version: d.prompt_version ?? '',
        edited:  !!d.human_edited_reply,
      })
    }
  }

  const headers = ['지점', '채널', '작성자', '별점', '상태', '위험도', '분류태그', '분류사유', '파이프라인', '프롬프트버전', '사람수정', '리뷰원문', '작성일', '답변초안']
  const lines = [headers.map(csvCell).join(',')]
  for (const r of reviews ?? []) {
    const dr = draftMap.get(r.id as string)
    lines.push([
      r.branch_code,
      r.channel_code,
      r.reviewer_name,
      r.rating,
      r.status,
      r.risk_level,
      r.categories ?? [],
      r.risk_reasons?.[0] ?? r.internal_note_ko ?? '',
      dr?.engine ?? '',
      dr?.version ?? '',
      dr?.edited ? 'Y' : '',
      r.review_text,
      r.review_created_at,
      dr?.reply ?? '',
    ].map(csvCell).join(','))
  }

  const csv = '﻿' + lines.join('\r\n')  // UTF-8 BOM → Excel 한글 정상 표시
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="arte_reviews_${stamp}.csv"`,
      'Cache-Control':       'no-store',
    },
  })
}

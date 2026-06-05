/**
 * POST /api/admin/rules/simulate — 시뮬레이션/프리뷰 (관리자 전용)
 *
 * 저장된 DB 규칙을 강제 재로딩(refreshEngineFromDB(true))한 뒤, 입력 리뷰 텍스트를
 * 실제 분류 엔진(processReview)에 통과시켜 결과를 반환한다.
 * → "규칙 수정 → 저장 → 시뮬레이션"으로 변경이 엔진에 즉시 반영됨을 검증(PHASE 3/4).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBranchAccess } from '@/lib/auth/branchAccess'
import { processReview } from '@/lib/reviewProcessor'
import { refreshEngineFromDB, isUsingDefaults } from '@/lib/waterfallRegexEngine'
import type { Language } from '@/lib/i18n'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  if (!access.isAdmin) return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 })

  let body: { text?: string; rating?: number; branch?: string; language?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 }) }
  const text = (body.text ?? '').toString()
  if (!text.trim()) return NextResponse.json({ error: '리뷰 텍스트를 입력하세요.' }, { status: 400 })

  // 최신 DB 규칙으로 강제 갱신 후 분류 (수정사항 즉시 반영 검증)
  await refreshEngineFromDB(true)
  const lang = (['ko', 'en', 'ja', 'zh'].includes(body.language ?? '') ? body.language : 'ko') as Language

  const decision = processReview({
    reviewText:   text,
    branchCode:   body.branch || 'AMGN',
    language:     lang,
    reviewerName: null,
  })

  return NextResponse.json({
    usingDefaults:    isUsingDefaults(),  // true면 DB 미반영(하드코딩 DEFAULTS)로 동작 중
    classification:   decision.classification,
    route:            decision.route,
    requiresApproval: decision.requiresApproval,
    staticReply:      decision.staticReply,
    rating:           typeof body.rating === 'number' ? body.rating : null,
  })
}

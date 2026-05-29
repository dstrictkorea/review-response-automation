/**
 * POST /api/review/publish
 *
 * 마케터 최종 승인 후 외부 플랫폼에 답변을 자동 게시합니다.
 *
 * 라우팅 우선순위:
 *   1. Google 채널 + 연결된 Google 계정 → Google Business Profile API
 *   2. 아웃바운드 웹훅 설정된 채널 → 웹훅 POST
 *   3. 웹훅 미설정 → { method: 'fallback_manual' } 반환 (UI가 클립보드 처리)
 *
 * 보안:
 *   - 인증 필수
 *   - risk_level이 'low'가 아닌 리뷰는 승인된(approved) 상태여야 게시 허용
 *   - 최종 답변이 비어있으면 거부
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, postGoogleReply } from '@/lib/google/api'

type PublishMethod = 'api_google' | 'webhook' | 'fallback_manual'

export async function POST(req: NextRequest) {
  // ── 인증 ────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 요청 파싱 ────────────────────────────────────────────────────────────────
  let reviewId: string, finalReply: string
  try {
    const body = await req.json()
    reviewId = body.reviewId
    finalReply = body.finalReply
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  if (!reviewId) return NextResponse.json({ error: 'reviewId가 필요합니다.' }, { status: 400 })
  if (!finalReply?.trim()) return NextResponse.json({ error: '게시할 답변을 입력해주세요.' }, { status: 400 })

  const admin = createAdminClient()

  // ── 리뷰 조회 ─────────────────────────────────────────────────────────────────
  const { data: review } = await admin
    .from('reviews')
    .select('id, branch_code, channel_code, source_review_id, review_url, status, risk_level')
    .eq('id', reviewId)
    .single()

  if (!review) return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })

  // ── 보안 가드: low 리스크가 아니면 approved 상태여야 게시 허용 ─────────────────
  if (review.risk_level !== 'low' && review.status !== 'approved') {
    return NextResponse.json(
      { error: '고위험 리뷰는 관장 승인 후 게시할 수 있습니다.' },
      { status: 403 }
    )
  }

  // ── 이미 게시된 경우 ──────────────────────────────────────────────────────────
  if (review.status === 'manual_published') {
    return NextResponse.json({ error: '이미 게시 완료된 리뷰입니다.' }, { status: 400 })
  }

  // ── 답변 초안 업데이트 ────────────────────────────────────────────────────────
  await admin
    .from('reply_drafts')
    .update({ human_edited_reply: finalReply, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  let method: PublishMethod = 'fallback_manual'

  // ── 1. Google Business Profile API ─────────────────────────────────────────
  if (review.channel_code === 'google') {
    if (!review.source_review_id) {
      return NextResponse.json({ error: 'Google 리뷰 ID(source_review_id)가 없습니다.' }, { status: 400 })
    }

    const { data: ga } = await admin
      .from('google_accounts')
      .select('id')
      .eq('branch_code', review.branch_code)
      .eq('is_active', true)
      .maybeSingle()

    if (ga) {
      try {
        const token = await getValidAccessToken(ga.id)
        await postGoogleReply(review.source_review_id, token, finalReply)
        method = 'api_google'
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `Google 게시 실패: ${msg}` }, { status: 500 })
      }
    }
    // Google 계정 미연결 → fallback_manual (UI가 처리)
  }

  // ── 2. 아웃바운드 웹훅 ────────────────────────────────────────────────────────
  if (method === 'fallback_manual' && review.channel_code !== 'google') {
    const { data: webhookSetting } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'channel_webhooks')
      .maybeSingle()

    const webhooks = (webhookSetting?.value ?? {}) as Record<string, string>
    const webhookUrl = webhooks[review.channel_code]

    if (webhookUrl) {
      try {
        const webhookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewId: review.id,
            channelCode: review.channel_code,
            branchCode: review.branch_code,
            reviewUrl: review.review_url,
            replyText: finalReply,
            timestamp: new Date().toISOString(),
          }),
        })
        if (!webhookRes.ok) {
          const body = await webhookRes.text()
          return NextResponse.json({ error: `웹훅 오류 ${webhookRes.status}: ${body}` }, { status: 500 })
        }
        method = 'webhook'
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `웹훅 전송 실패: ${msg}` }, { status: 500 })
      }
    }
  }

  // ── 상태 업데이트 (manual 제외: UI가 markPublished 호출) ──────────────────────
  if (method !== 'fallback_manual') {
    await admin
      .from('reviews')
      .update({ status: 'manual_published', updated_at: new Date().toISOString() })
      .eq('id', reviewId)
  }

  // ── 활동 로그 ──────────────────────────────────────────────────────────────────
  await admin.from('activity_logs').insert({
    review_id:  reviewId,
    actor_name: user.email,
    action:     method === 'api_google'      ? 'google_reply_posted'
                : method === 'webhook'       ? 'webhook_reply_posted'
                :                             'publish_fallback_manual',
    detail: {
      method,
      channel: review.channel_code,
      preview: finalReply.slice(0, 100),
    },
  })

  return NextResponse.json({ success: true, method })
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reviewId: string,
  actorName: string,
  action: string,
  detail?: Record<string, unknown>
) {
  await supabase.from('activity_logs').insert({
    review_id: reviewId,
    actor_name: actorName,
    action,
    detail: detail ?? null,
  })
}

export async function approveReview(reviewId: string, finalReply: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  if (!finalReply.trim()) return { error: '최종 답변을 입력하세요.' }

  await supabase
    .from('reply_drafts')
    .update({ human_edited_reply: finalReply, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  await supabase
    .from('reviews')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'review_approved', {
    reply_preview: finalReply.slice(0, 100),
  })

  revalidatePath(`/reviews/${reviewId}`)
  return { success: true }
}

export async function escalateReview(reviewId: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  await supabase
    .from('reviews')
    .update({ status: 'escalated', updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'review_escalated')

  revalidatePath(`/reviews/${reviewId}`)
  return { success: true }
}

export async function markNoReply(reviewId: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  await supabase
    .from('reviews')
    .update({ status: 'no_reply', updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'review_no_reply')

  revalidatePath(`/reviews/${reviewId}`)
  return { success: true }
}

export async function markPublished(reviewId: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  await supabase
    .from('reviews')
    .update({ status: 'manual_published', updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'review_published')

  revalidatePath(`/reviews/${reviewId}`)
  return { success: true }
}

export async function saveDraft(reviewId: string, humanEditedReply: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  await supabase
    .from('reply_drafts')
    .update({ human_edited_reply: humanEditedReply, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'reply_edited', {
    preview: humanEditedReply.slice(0, 100),
  })

  revalidatePath(`/reviews/${reviewId}`)
  return { success: true }
}

export async function resetReviewStatus(reviewId: string, targetStatus: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  await supabase
    .from('reviews')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', reviewId)

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'status_reset', {
    target_status: targetStatus,
  })

  revalidatePath(`/reviews/${reviewId}`)
  revalidatePath('/reviews')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Soft Delete — 물리 삭제 대신 deleted_at 타임스탬프를 기록한다.
 * 감사/컴플레인 추적을 위해 reply_drafts·activity_logs는 보존된다.
 * 목록/대시보드/아카이브 쿼리는 deleted_at IS NULL 만 노출하므로 즉시 숨겨진다.
 */
export async function deleteReview(reviewId: string, reason?: string) {
  const { supabase, user } = await getUser()
  if (!user) return { error: '인증 필요' }

  const { error } = await supabase
    .from('reviews')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', reviewId)
  if (error) return { error: error.message }

  await logActivity(supabase, reviewId, user.email ?? 'unknown', 'review_soft_deleted', {
    reason: reason ?? null,
  })

  revalidatePath('/reviews')
  revalidatePath('/dashboard')
  revalidatePath('/archive')

  // 삭제 후 목록으로 redirect — 서버 액션에서는 throw 방식 사용
  redirect('/reviews')
}

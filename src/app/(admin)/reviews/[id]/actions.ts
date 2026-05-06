'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import crypto from 'crypto'

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function createReviewAction(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '인증이 필요합니다.' }

  const branch_code = formData.get('branch_code') as string
  const channel_code = formData.get('channel_code') as string
  const rating = parseFloat(formData.get('rating') as string)
  const review_text = formData.get('review_text') as string
  const review_created_at = formData.get('review_created_at') as string
  const review_url = (formData.get('review_url') as string) || null
  const reviewer_name = (formData.get('reviewer_name') as string) || null

  if (!branch_code || !channel_code || !review_text) {
    return { error: '지점, 채널, 리뷰 내용은 필수입니다.' }
  }

  const normalized = normalizeText(review_text)
  const normalized_hash = crypto.createHash('sha256').update(normalized).digest('hex')

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      branch_code,
      channel_code,
      rating: isNaN(rating) ? null : rating,
      review_text,
      review_created_at: review_created_at || null,
      review_url,
      reviewer_name,
      normalized_hash,
      status: 'new',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: '동일한 리뷰가 이미 등록되어 있습니다. (중복 방지)' }
    }
    return { error: `저장 실패: ${error.message}` }
  }

  await supabase.from('activity_logs').insert({
    review_id: review.id,
    actor_name: user.email,
    action: 'review_registered',
    detail: { branch_code, channel_code, rating },
  })

  redirect(`/reviews/${review.id}`)
}

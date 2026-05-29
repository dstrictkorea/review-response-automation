'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken, listGoogleReviews } from '@/lib/google/api'
import { revalidatePath } from 'next/cache'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요', user: null }
  return { error: null, user }
}

export async function updateGoogleLocationAction(accountId: string, locationName: string, locationTitle: string) {
  const { error } = await requireAuth()
  if (error) return { error }

  const admin = createAdminClient()
  const { error: e } = await admin
    .from('google_accounts')
    .update({
      google_location_name: locationName,
      google_account_name: locationName.split('/locations/')[0] ?? locationName,
      google_location_title: locationTitle || locationName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  if (e) return { error: e.message }
  revalidatePath('/settings/google')
  return { success: true }
}

export async function updateGoogleBranchAction(accountId: string, branchCode: string) {
  const { error } = await requireAuth()
  if (error) return { error }

  const admin = createAdminClient()
  const { error: e } = await admin
    .from('google_accounts')
    .update({ branch_code: branchCode || null, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  if (e) return { error: e.message }
  revalidatePath('/settings/google')
  return { success: true }
}

export async function disconnectGoogleAction(accountId: string) {
  const { error } = await requireAuth()
  if (error) return { error }

  const admin = createAdminClient()
  const { error: e } = await admin
    .from('google_accounts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  if (e) return { error: e.message }
  revalidatePath('/settings/google')
  return { success: true }
}

function makeHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(36)
}

export async function syncGoogleReviewsAction(accountId: string) {
  const { error } = await requireAuth()
  if (error) return { error }

  const admin = createAdminClient()
  const { data: ga } = await admin
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (!ga) return { error: '계정을 찾을 수 없습니다.' }
  if (!ga.branch_code) return { error: '먼저 지점을 설정해주세요.' }

  try {
    const token = await getValidAccessToken(accountId)
    let imported = 0
    let nextPageToken: string | undefined

    do {
      const data = await listGoogleReviews(ga.google_location_name, token, nextPageToken)
      const reviews = data.reviews ?? []
      nextPageToken = data.nextPageToken

      for (const review of reviews) {
        const sourceId: string = review.name
        const hash = makeHash(sourceId)

        const { error: uErr } = await admin.from('reviews').upsert({
          branch_code: ga.branch_code,
          channel_code: 'google',
          source_review_id: sourceId,
          reviewer_name: review.reviewer?.displayName ?? '익명',
          rating: ({ FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 } as Record<string, number>)[review.starRating] ?? 0,
          review_text: review.comment ?? null,
          review_language: review.comment ? (/[가-힯]/.test(review.comment) ? 'ko' : 'en') : null,
          review_created_at: review.createTime ?? null,
          status: 'new',
          normalized_hash: hash,
        }, { onConflict: 'branch_code,channel_code,normalized_hash', ignoreDuplicates: true })

        if (!uErr) imported++
      }
    } while (nextPageToken)

    await admin
      .from('google_accounts')
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', accountId)

    revalidatePath('/settings/google')
    return { success: true, imported }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

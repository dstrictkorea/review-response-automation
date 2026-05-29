import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, listGoogleReviews } from '@/lib/google/api'

function starRatingToNumber(star: string): number {
  const map: Record<string, number> = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 }
  return map[star] ?? 0
}

function makeHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(36)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { googleAccountId } = await req.json()
  const admin = createAdminClient()

  const { data: ga } = await admin
    .from('google_accounts')
    .select('*')
    .eq('id', googleAccountId)
    .single()

  if (!ga) return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  if (!ga.branch_code) return NextResponse.json({ error: '지점이 설정되지 않았습니다.' }, { status: 400 })

  try {
    const token = await getValidAccessToken(googleAccountId)
    let imported = 0
    let nextPageToken: string | undefined

    do {
      const data = await listGoogleReviews(ga.google_location_name, token, nextPageToken)
      const reviews = data.reviews ?? []
      nextPageToken = data.nextPageToken

      for (const review of reviews) {
        const sourceId: string = review.name
        const hash = makeHash(sourceId)

        const { error } = await admin.from('reviews').upsert({
          branch_code: ga.branch_code,
          channel_code: 'google',
          source_review_id: sourceId,
          reviewer_name: review.reviewer?.displayName ?? '익명',
          rating: starRatingToNumber(review.starRating),
          review_text: review.comment ?? null,
          review_language: review.comment
            ? (/[가-힯]/.test(review.comment) ? 'ko' : 'en')
            : null,
          review_created_at: review.createTime ?? null,
          status: 'new',
          normalized_hash: hash,
        }, { onConflict: 'branch_code,channel_code,normalized_hash', ignoreDuplicates: true })

        if (!error) imported++
      }
    } while (nextPageToken)

    await admin
      .from('google_accounts')
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', googleAccountId)

    return NextResponse.json({ success: true, imported })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { refreshGoogleToken } from './auth'

export async function getValidAccessToken(googleAccountId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: acct } = await admin
    .from('google_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', googleAccountId)
    .single()

  if (!acct) throw new Error('Google 계정을 찾을 수 없습니다.')

  const expiresAt = acct.token_expires_at ? new Date(acct.token_expires_at) : new Date(0)
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (needsRefresh && acct.refresh_token) {
    const refreshed = await refreshGoogleToken(acct.refresh_token)
    if (refreshed.error) throw new Error(`토큰 갱신 실패: ${refreshed.error}`)

    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await admin
      .from('google_accounts')
      .update({ access_token: refreshed.access_token, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
      .eq('id', googleAccountId)

    return refreshed.access_token
  }

  return acct.access_token
}

async function gbpFetch(url: string, token: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google API ${res.status}: ${body}`)
  }
  return res.json()
}

export async function listGoogleAccounts(token: string) {
  return gbpFetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token)
}

export async function listGoogleLocations(accountName: string, token: string) {
  return gbpFetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    token
  )
}

/** Google Business Profile v4 리뷰 객체 (사용 필드만) */
export interface GoogleReview {
  name: string
  reviewer?: { displayName?: string | null }
  starRating: string
  comment?: string | null
  createTime?: string | null
}

export interface GoogleReviewsResponse {
  reviews?: GoogleReview[]
  nextPageToken?: string
}

export async function listGoogleReviews(
  locationName: string,
  token: string,
  pageToken?: string,
): Promise<GoogleReviewsResponse> {
  const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`)
  url.searchParams.set('pageSize', '50')
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  return gbpFetch(url.toString(), token)
}

export async function postGoogleReply(reviewName: string, token: string, comment: string) {
  return gbpFetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, token, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  })
}

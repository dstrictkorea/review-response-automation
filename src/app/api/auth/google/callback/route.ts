import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens } from '@/lib/google/auth'
import { listGoogleAccounts, listGoogleLocations } from '@/lib/google/api'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://project-t3oud.vercel.app'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/settings/google?error=${encodeURIComponent(error ?? 'no_code')}`)
  }

  const tokens = await exchangeCodeForTokens(code)
  if (tokens.error) {
    return NextResponse.redirect(
      `${APP_URL}/settings/google?error=${encodeURIComponent(tokens.error_description ?? tokens.error)}`
    )
  }

  const { access_token, refresh_token, expires_in } = tokens
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()
  const admin = createAdminClient()

  try {
    const accountsData = await listGoogleAccounts(access_token)
    const accounts: any[] = accountsData.accounts ?? []

    if (accounts.length === 0) {
      return NextResponse.redirect(`${APP_URL}/settings/google?error=${encodeURIComponent('연결된 Google Business 계정이 없습니다.')}`)
    }

    for (const account of accounts) {
      const accountName: string = account.name

      let locations: any[] = []
      try {
        const locData = await listGoogleLocations(accountName, access_token)
        locations = locData.locations ?? []
      } catch {
        // 위치 정보 없을 수 있음
      }

      if (locations.length > 0) {
        for (const loc of locations) {
          await admin.from('google_accounts').upsert({
            google_account_name: accountName,
            google_location_name: loc.name,
            google_location_title: loc.title ?? loc.name,
            access_token,
            refresh_token: refresh_token ?? null,
            token_expires_at: expiresAt,
            connected_by: user.email,
            connected_at: new Date().toISOString(),
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'google_location_name' })
        }
      } else {
        await admin.from('google_accounts').upsert({
          google_account_name: accountName,
          google_location_name: accountName,
          google_location_title: account.accountName ?? accountName,
          access_token,
          refresh_token: refresh_token ?? null,
          token_expires_at: expiresAt,
          connected_by: user.email,
          connected_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'google_location_name' })
      }
    }

    return NextResponse.redirect(`${APP_URL}/settings/google?connected=1`)
  } catch (err: any) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(
      `${APP_URL}/settings/google?error=${encodeURIComponent(err.message ?? '연결 실패')}`
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens } from '@/lib/google/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://project-t3oud.vercel.app'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${APP_URL}/settings/google?error=${encodeURIComponent(error ?? 'no_code')}`
    )
  }

  const tokens = await exchangeCodeForTokens(code)
  if (tokens.error) {
    return NextResponse.redirect(
      `${APP_URL}/settings/google?error=${encodeURIComponent(tokens.error_description ?? tokens.error)}`
    )
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const admin = createAdminClient()

  // 토큰만 저장 — location은 사용자가 설정 페이지에서 입력
  const { error: dbErr } = await admin.from('google_accounts').insert({
    google_account_name: 'pending',
    google_location_name: `pending_${Date.now()}`,
    google_location_title: '(미설정)',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires_at: expiresAt,
    connected_by: user.email,
    connected_at: new Date().toISOString(),
    is_active: true,
  })

  if (dbErr) {
    return NextResponse.redirect(
      `${APP_URL}/settings/google?error=${encodeURIComponent(dbErr.message)}`
    )
  }

  return NextResponse.redirect(`${APP_URL}/settings/google?connected=1`)
}

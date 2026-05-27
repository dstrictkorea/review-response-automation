import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthUrl } from '@/lib/google/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://project-t3oud.vercel.app'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  return NextResponse.redirect(getGoogleOAuthUrl())
}

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING',
    ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SERVICE_ROLE_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_SET: !!process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  })
}

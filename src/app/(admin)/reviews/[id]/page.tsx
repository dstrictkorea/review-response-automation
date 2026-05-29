import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReviewDetailClient from './ReviewDetailClient'
import type { Review, ReplyDraft, ActivityLog, UserRole } from '@/types/database'

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }

  // admin/director → director 권한, 그 외 → marketing_staff
  const userRole: UserRole =
    profile?.role === 'admin' || profile?.role === 'director'
      ? 'director'
      : 'marketing_staff'

  const [{ data: review }, { data: draft }, { data: logs }] = await Promise.all([
    supabase.from('reviews').select('*').eq('id', id).single(),
    supabase.from('reply_drafts').select('*').eq('review_id', id).maybeSingle(),
    supabase
      .from('activity_logs')
      .select('*')
      .eq('review_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!review) notFound()

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reviews" className="text-sm text-gray-500 hover:text-gray-700">
          ← 리뷰 목록
        </Link>
        <span className="text-gray-300">/</span>
        <h2 className="text-xl font-bold text-gray-900">리뷰 상세</h2>
      </div>

      <ReviewDetailClient
        review={review as Review}
        draft={draft as ReplyDraft | null}
        logs={(logs as ActivityLog[]) ?? []}
        userRole={userRole}
      />
    </div>
  )
}

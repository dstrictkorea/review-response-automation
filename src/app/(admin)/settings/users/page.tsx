import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import UsersClient, { type UserRow } from './UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only admins can access this page
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (myProfile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch all auth users via admin client
  const admin = createAdminClient()
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 200 })
  const authUsers = authData?.users ?? []

  // Fetch all profiles + branches (for assigned_branches checkbox UI)
  const [{ data: profiles }, { data: branches }] = await Promise.all([
    admin.from('profiles').select('id, email, display_name, role, is_active, assigned_branches, created_at'),
    admin.from('branches').select('code, name_ko, country_code').eq('is_active', true).order('code'),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  // Merge: auth user list + profile data
  const rows: UserRow[] = authUsers.map(au => {
    const profile = profileMap.get(au.id) as
      | { display_name: string | null; role: string; is_active: boolean; assigned_branches: string[] | null; created_at: string }
      | undefined
    return {
      id: au.id,
      email: au.email ?? '',
      display_name: profile?.display_name ?? null,
      role: (profile?.role as 'admin' | 'staff') ?? 'staff',
      is_active: profile?.is_active ?? true,
      assigned_branches: profile?.assigned_branches ?? [],
      created_at: profile?.created_at ?? au.created_at,
    }
  })

  // Sort: admins first, then by email
  rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return a.email.localeCompare(b.email)
  })

  return (
    <UsersClient
      users={rows}
      currentUserId={user.id}
      branches={(branches ?? []) as { code: string; name_ko: string; country_code: string | null }[]}
    />
  )
}

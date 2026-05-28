import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from './Sidebar'
import ScrollToTop from './ScrollToTop'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={user.email ?? ''}
        displayName={profile?.display_name ?? null}
        isAdmin={isAdmin}
      />
      <main className="flex-1 ml-60 p-6 bg-gray-50 min-h-screen">{children}</main>
      <ScrollToTop />
    </div>
  )
}

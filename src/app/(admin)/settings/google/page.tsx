import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import GoogleSettingsClient from './GoogleSettingsClient'

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: accounts }, { data: branches }] = await Promise.all([
    admin.from('google_accounts').select('*').eq('is_active', true).order('created_at', { ascending: false }),
    admin.from('branches').select('code, name_ko').eq('is_active', true).order('name_ko'),
  ])

  return (
    <GoogleSettingsClient
      accounts={accounts ?? []}
      branches={branches ?? []}
      justConnected={params.connected === '1'}
      connectError={params.error}
    />
  )
}

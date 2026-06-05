import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBranchAccess } from '@/lib/auth/branchAccess'
import RulesManagerClient from './RulesManagerClient'

/**
 * /settings/rules — DB 구동 분류 규칙/응답 템플릿 관리 (관리자 전용, PHASE 3)
 */
export default async function RulesSettingsPage() {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) redirect('/login')
  if (!access.isAdmin) redirect('/settings') // 비관리자 차단

  const admin = createAdminClient()
  const [{ data: rules }, { data: templates }] = await Promise.all([
    admin.from('automation_rules').select('*').order('category').order('language'),
    admin.from('response_templates').select('*').order('category').order('language'),
  ])

  return (
    <RulesManagerClient
      initialRules={rules ?? []}
      initialTemplates={templates ?? []}
    />
  )
}

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요', user: null, supabase: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: '관리자 권한 필요', user: null, supabase: null }
  return { error: null, user, supabase }
}

export async function createUserAction(data: {
  email: string
  password: string
  displayName: string
  role: 'admin' | 'staff'
}) {
  const { error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }

  if (!data.email.trim() || !data.password.trim()) {
    return { error: '이메일과 비밀번호는 필수입니다.' }
  }
  if (data.password.length < 6) {
    return { error: '비밀번호는 6자 이상이어야 합니다.' }
  }

  const admin = createAdminClient()

  // Create auth user
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    email_confirm: true,
    user_metadata: { display_name: data.displayName.trim() || null },
  })

  if (createErr) {
    if (createErr.message?.includes('already been registered')) {
      return { error: '이미 등록된 이메일입니다.' }
    }
    return { error: createErr.message }
  }

  // Upsert profile with chosen role (trigger creates 'staff' by default, we override)
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      email: newUser.user.email!,
      display_name: data.displayName.trim() || null,
      role: data.role,
      is_active: true,
    })

  if (profileErr) return { error: profileErr.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function updateUserRoleAction(userId: string, role: 'admin' | 'staff') {
  const { error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  const { error: authErr, user } = await requireAdmin()
  if (authErr) return { error: authErr }

  // Prevent self-deactivation
  if (user && user.id === userId && !isActive) {
    return { error: '자기 자신을 비활성화할 수 없습니다.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function resetPasswordAction(userId: string, newPassword: string) {
  const { error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }

  if (newPassword.length < 6) return { error: '비밀번호는 6자 이상이어야 합니다.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteUserAction(userId: string) {
  const { error: authErr, user } = await requireAdmin()
  if (authErr) return { error: authErr }

  if (user && user.id === userId) {
    return { error: '자기 자신을 삭제할 수 없습니다.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

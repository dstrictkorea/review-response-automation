'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// ─── App settings (keywords, templates) ──────────────────────────────────────

export async function saveSettingAction(key: string, value: unknown, description?: string) {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: '인증 필요' }

  const { error } = await supabase.from('app_settings').upsert(
    { key, value, description: description ?? null, updated_by: user.email },
    { onConflict: 'key' }
  )
  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    review_id: null,
    actor_name: user.email,
    action: 'settings_updated',
    detail: { key },
  })

  revalidatePath('/settings')
  return { success: true }
}

// ─── Branch CRUD ──────────────────────────────────────────────────────────────

export async function addBranchAction(data: {
  code: string
  name_ko: string
  name_en: string
  default_language: string
}) {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: '인증 필요' }

  if (!data.code.trim() || !data.name_ko.trim()) {
    return { error: '지점 코드와 한국어 이름은 필수입니다.' }
  }

  const code = data.code.trim().toUpperCase()

  const { error } = await supabase.from('branches').insert({
    code,
    name_ko: data.name_ko.trim(),
    name_en: data.name_en.trim() || null,
    default_language: data.default_language,
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') return { error: `지점 코드 "${code}" 가 이미 존재합니다.` }
    return { error: error.message }
  }

  await supabase.from('activity_logs').insert({
    review_id: null,
    actor_name: user.email,
    action: 'settings_updated',
    detail: { key: 'branches', action: 'add', code },
  })

  revalidatePath('/settings')
  revalidatePath('/reviews')
  revalidatePath('/reviews/register')
  return { success: true }
}

export async function updateBranchAction(
  id: string,
  data: { name_ko: string; name_en: string; default_language: string }
) {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: '인증 필요' }

  if (!data.name_ko.trim()) return { error: '한국어 지점명은 필수입니다.' }

  const { error } = await supabase
    .from('branches')
    .update({
      name_ko: data.name_ko.trim(),
      name_en: data.name_en.trim() || null,
      default_language: data.default_language,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    review_id: null,
    actor_name: user.email,
    action: 'settings_updated',
    detail: { key: 'branches', action: 'update', id },
  })

  revalidatePath('/settings')
  return { success: true }
}

export async function toggleBranchActiveAction(id: string, currentValue: boolean) {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: '인증 필요' }

  const { error } = await supabase
    .from('branches')
    .update({ is_active: !currentValue })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/reviews')
  revalidatePath('/reviews/register')
  return { success: true }
}

// ─── Channel updates ──────────────────────────────────────────────────────────

export async function updateChannelAction(
  id: string,
  data: {
    name?: string
    publish_mode?: string
    api_enabled?: boolean
    is_active?: boolean
  }
) {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: '인증 필요' }

  const { error } = await supabase.from('channels').update(data).eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('activity_logs').insert({
    review_id: null,
    actor_name: user.email,
    action: 'settings_updated',
    detail: { key: 'channels', action: 'update', id, ...data },
  })

  revalidatePath('/settings')
  revalidatePath('/reviews')
  revalidatePath('/reviews/register')
  return { success: true }
}

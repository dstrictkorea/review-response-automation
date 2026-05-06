'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveSettingAction(key: string, value: unknown, description?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

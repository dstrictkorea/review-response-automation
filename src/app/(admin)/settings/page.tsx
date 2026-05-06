import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [
    { data: branches },
    { data: channels },
    { data: riskKeywordsRow },
    { data: templatesRow },
  ] = await Promise.all([
    supabase.from('branches').select('*').order('code'),
    supabase.from('channels').select('*').order('code'),
    supabase.from('app_settings').select('*').eq('key', 'risk_keywords').maybeSingle(),
    supabase.from('app_settings').select('*').eq('key', 'reply_templates').maybeSingle(),
  ])

  const riskKeywords: RiskKeyword[] = (riskKeywordsRow?.value as RiskKeyword[]) ?? []
  const replyTemplates: ReplyTemplate[] = (templatesRow?.value as ReplyTemplate[]) ?? []

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">설정</h2>
        <p className="text-sm text-gray-600 mt-1">템플릿, 위험 키워드, 지점/채널 설정을 관리합니다.</p>
      </div>
      <SettingsClient
        branches={branches ?? []}
        channels={channels ?? []}
        riskKeywords={riskKeywords}
        replyTemplates={replyTemplates}
      />
    </div>
  )
}

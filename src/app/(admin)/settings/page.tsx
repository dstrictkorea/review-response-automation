import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import type { RatingTemplateRules } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [
    { data: branches },
    { data: channels },
    { data: riskKeywordsRow },
    { data: templatesRow },
    { data: webhooksRow },
    { data: ratingRulesRow },
  ] = await Promise.all([
    supabase.from('branches').select('*').order('code'),
    supabase.from('channels').select('*').order('code'),
    supabase.from('app_settings').select('*').eq('key', 'risk_keywords').maybeSingle(),
    supabase.from('app_settings').select('*').eq('key', 'reply_templates').maybeSingle(),
    supabase.from('app_settings').select('*').eq('key', 'channel_webhooks').maybeSingle(),
    supabase.from('app_settings').select('*').eq('key', 'rating_template_rules').maybeSingle(),
  ])

  const riskKeywords: RiskKeyword[]            = (riskKeywordsRow?.value  as RiskKeyword[])   ?? []
  const replyTemplates: ReplyTemplate[]        = (templatesRow?.value     as ReplyTemplate[]) ?? []
  const channelWebhooks: Record<string,string> = (webhooksRow?.value      as Record<string,string>) ?? {}
  const ratingRules: RatingTemplateRules       = (ratingRulesRow?.value   as RatingTemplateRules)
    ?? { 'low_star': 'high_risk', 'mid_star': 'neutral', 'high_star': 'positive' }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">설정</h2>
        <p className="text-sm text-gray-600 mt-1">
          글로벌 위험 키워드, 답변 템플릿, 지점/채널, 웹훅 연동을 관리합니다.
        </p>
      </div>
      <SettingsClient
        branches={branches ?? []}
        channels={channels ?? []}
        riskKeywords={riskKeywords}
        replyTemplates={replyTemplates}
        channelWebhooks={channelWebhooks}
        ratingRules={ratingRules}
      />
    </div>
  )
}

/**
 * rulesCache.ts — DB 분류 규칙/템플릿의 인메모리 캐시 (PHASE 1 기반)
 *
 * 매 리뷰마다 DB를 호출하지 않도록 모듈 레벨 캐시 + TTL을 둔다.
 * 관리 API가 규칙을 수정하면 invalidateRulesCache()로 무효화 → 다음 ensureRulesLoaded()가 재로딩.
 *
 * ※ PHASE 2: DynamicEngine(WaterfallRegexEngine)이 ensureRulesLoaded()로 규칙을 받아
 *   인메모리에서 RegExp를 동적 컴파일한다. EMERGENCY 안전망은 코드 하드코딩 불변(여기에 의존하지 않음).
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface AutomationRule {
  id: string
  category: string
  language: string
  keywords: string[]
  regex_pattern: string | null
  is_active: boolean
  priority: number
}

export interface ResponseTemplate {
  id: string
  category: string
  language: string
  template_text: string
  tone: string
  is_active: boolean
}

export interface RulesBundle {
  rules: AutomationRule[]
  templates: ResponseTemplate[]
  loadedAt: number
  version: number
}

const TTL_MS = 60_000

let cache: RulesBundle | null = null
let version = 0

/** 규칙 수정 시 호출 — 캐시 무효화(다음 로드에서 재조회) + 버전 증가 */
export function invalidateRulesCache(): void {
  cache = null
  version++
}

export function getCacheMeta() {
  return { loaded: !!cache, loadedAt: cache?.loadedAt ?? 0, version, ttlMs: TTL_MS }
}

/**
 * 활성 규칙/템플릿을 로드. 캐시가 신선하면(<TTL) 캐시를 반환(= DB 호출 없음).
 * 로드 실패 시 기존 캐시(또는 null)를 반환 → 엔진은 하드코딩 규칙으로 안전 동작.
 */
export async function ensureRulesLoaded(force = false): Promise<RulesBundle | null> {
  const now = Date.now()
  if (!force && cache && now - cache.loadedAt < TTL_MS) return cache
  try {
    const admin = createAdminClient()
    const [{ data: rules }, { data: templates }] = await Promise.all([
      admin.from('automation_rules').select('id, category, language, keywords, regex_pattern, is_active, priority').eq('is_active', true),
      admin.from('response_templates').select('id, category, language, template_text, tone, is_active').eq('is_active', true),
    ])
    cache = {
      rules: (rules ?? []) as AutomationRule[],
      templates: (templates ?? []) as ResponseTemplate[],
      loadedAt: now,
      version,
    }
    return cache
  } catch {
    return cache
  }
}

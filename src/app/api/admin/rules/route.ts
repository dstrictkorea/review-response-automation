/**
 * /api/admin/rules — automation_rules / response_templates 관리 API (관리자 전용)
 *
 * GET            전체 규칙/템플릿 + 캐시 메타 조회
 * POST {type}    rule | template 생성/수정(upsert). 정규식 유효성 검증 + 캐시 무효화.
 * DELETE ?type&id  규칙/템플릿 삭제 + 캐시 무효화.
 *
 * 쓰기는 service-role(admin client)로 수행 → RLS 우회. 접근은 앱 레이어에서 admin 강제.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBranchAccess, type BranchAccess } from '@/lib/auth/branchAccess'
import { invalidateRulesCache, getCacheMeta } from '@/lib/rulesCache'

type AuthResult = { ok: true; access: BranchAccess } | { ok: false; response: NextResponse }

async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient()
  const access = await getBranchAccess(supabase)
  if (!access) return { ok: false, response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) }
  if (!access.isAdmin) return { ok: false, response: NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 }) }
  return { ok: true, access }
}

interface RuleBody {
  type?: string
  id?: string
  category?: string
  language?: string
  keywords?: unknown
  regex_pattern?: string
  is_active?: boolean
  priority?: number
  notes?: string
  template_text?: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const admin = createAdminClient()
  const [{ data: rules }, { data: templates }] = await Promise.all([
    admin.from('automation_rules').select('*').order('category').order('language'),
    admin.from('response_templates').select('*').order('category').order('language'),
  ])
  return NextResponse.json({ rules: rules ?? [], templates: templates ?? [], cache: getCacheMeta() })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: RuleBody
  try { body = await req.json() } catch { return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 }) }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // ── 분류 규칙 ────────────────────────────────────────────────────────────────
  if (body.type === 'rule') {
    if (!body.category) return NextResponse.json({ error: 'category는 필수입니다.' }, { status: 400 })
    // 정규식 유효성 즉시 검증 (잘못된 패턴이 엔진에 들어가는 것을 사전 차단)
    if (body.regex_pattern) {
      try { new RegExp(body.regex_pattern, 'i') } catch (e) {
        return NextResponse.json({ error: `정규식 오류: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 })
      }
    }
    const row = {
      category:      String(body.category).toUpperCase(),
      language:      body.language ?? 'any',
      keywords:      Array.isArray(body.keywords) ? (body.keywords as unknown[]).map(String) : [],
      regex_pattern: body.regex_pattern || null,
      is_active:     body.is_active !== false,
      priority:      Number(body.priority ?? 100),
      notes:         body.notes ?? null,
      updated_at:    now,
    }
    const res = body.id
      ? await admin.from('automation_rules').update(row).eq('id', body.id).select().single()
      : await admin.from('automation_rules').insert(row).select().single()
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
    invalidateRulesCache()
    await admin.from('activity_logs').insert({
      review_id: null, actor_name: auth.access.email,
      action: body.id ? 'rule_updated' : 'rule_created',
      detail: { id: (res.data as { id?: string })?.id, category: row.category, language: row.language },
    })
    return NextResponse.json({ rule: res.data, cache: getCacheMeta() })
  }

  // ── 응답 템플릿 ──────────────────────────────────────────────────────────────
  if (body.type === 'template') {
    if (!body.category || !body.language || !body.template_text) {
      return NextResponse.json({ error: 'category, language, template_text는 필수입니다.' }, { status: 400 })
    }
    const row = {
      category:      body.category,
      language:      body.language,
      template_text: body.template_text,
      tone:          'STANDARD',
      is_active:     body.is_active !== false,
      notes:         body.notes ?? null,
      updated_at:    now,
    }
    const res = body.id
      ? await admin.from('response_templates').update(row).eq('id', body.id).select().single()
      : await admin.from('response_templates').insert(row).select().single()
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
    invalidateRulesCache()
    await admin.from('activity_logs').insert({
      review_id: null, actor_name: auth.access.email,
      action: body.id ? 'template_updated' : 'template_created',
      detail: { id: (res.data as { id?: string })?.id, category: row.category, language: row.language },
    })
    return NextResponse.json({ template: res.data, cache: getCacheMeta() })
  }

  return NextResponse.json({ error: "type은 'rule' 또는 'template'이어야 합니다." }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const sp = req.nextUrl.searchParams
  const type = sp.get('type')
  const id = sp.get('id')
  if (!id || (type !== 'rule' && type !== 'template')) {
    return NextResponse.json({ error: 'type(rule|template)과 id가 필요합니다.' }, { status: 400 })
  }
  const admin = createAdminClient()
  const table = type === 'rule' ? 'automation_rules' : 'response_templates'
  const { error: dErr } = await admin.from(table).delete().eq('id', id)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
  invalidateRulesCache()
  await admin.from('activity_logs').insert({
    review_id: null, actor_name: auth.access.email, action: `${type}_deleted`, detail: { id },
  })
  return NextResponse.json({ success: true, cache: getCacheMeta() })
}

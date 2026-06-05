'use client'

/**
 * RulesManagerClient — DB 구동 분류 규칙/응답 템플릿 관리 + 시뮬레이션 (관리자 전용)
 * 관리자 도구이므로 한국어 우선(CLAUDE.md). 저장 시 서버가 캐시를 무효화 → 즉시 반영.
 */

import { useState } from 'react'

interface Rule {
  id: string
  category: string
  language: string
  keywords: string[]
  regex_pattern: string | null
  is_active: boolean
  priority: number
}
interface Template {
  id: string
  category: string
  language: string
  template_text: string
  tone: string
  is_active: boolean
}
interface SimResult {
  error?: string
  usingDefaults?: boolean
  route?: string
  requiresApproval?: boolean
  staticReply?: string | null
  classification?: {
    status: string; reason: string; tags: string[]
    isEmergency: boolean; isComplaint: boolean; isArtworkFocused: boolean
    isRepeatVisitor: boolean; isChurnRisk: boolean
  }
}

const RULE_CATS = ['EMERGENCY', 'COMPLAINT', 'CHURN', 'REPEAT', 'FUTURE_HOPE', 'SARCASM', 'POSITIVE', 'QUESTION', 'ARTWORK']
const RULE_LANGS = ['any', 'ko', 'en', 'ja', 'zh']
const TPL_CATS = ['greeting', 'thanks', 'eternal_nature', 'closing', 'dry_apology']
const TPL_LANGS = ['ko', 'en', 'ja', 'zh']

const STATUS_COLOR: Record<string, string> = {
  EMERGENCY: 'bg-red-100 text-red-700', COMPLAINT: 'bg-orange-100 text-orange-700',
  AMBIGUOUS: 'bg-amber-100 text-amber-700', SAFE: 'bg-green-100 text-green-700',
}

export default function RulesManagerClient({
  initialRules, initialTemplates,
}: { initialRules: Rule[]; initialTemplates: Template[] }) {
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [simText, setSimText] = useState('')
  const [simRating, setSimRating] = useState<number | ''>('')
  const [simLang, setSimLang] = useState('ko')
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [simBusy, setSimBusy] = useState(false)

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  async function refetch() {
    const res = await fetch('/api/admin/rules')
    if (res.ok) { const d = await res.json(); setRules(d.rules ?? []); setTemplates(d.templates ?? []) }
  }

  async function postRule(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok) flash('❌ ' + (d.error ?? 'error'))
      else { flash('✅ 저장 완료 — 캐시 무효화됨 (다음 분류부터 반영)'); await refetch() }
    } catch { flash('❌ 서버 오류') }
    setBusy(false)
  }

  async function del(type: 'rule' | 'template', id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/rules?type=${type}&id=${id}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) flash('❌ ' + (d.error ?? 'error'))
      else { flash('✅ 삭제됨'); await refetch() }
    } catch { flash('❌ 서버 오류') }
    setBusy(false)
  }

  async function runSim() {
    if (!simText.trim()) return
    setSimBusy(true); setSimResult(null)
    try {
      const res = await fetch('/api/admin/rules/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: simText, rating: simRating === '' ? undefined : Number(simRating), language: simLang }),
      })
      const d = await res.json()
      setSimResult(res.ok ? d : { error: d.error })
    } catch { setSimResult({ error: '서버 오류' }) }
    setSimBusy(false)
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">분류 규칙 / 응답 템플릿 (DB 구동 엔진)</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          키워드·정규식을 수정하면 코드 배포 없이 즉시 반영됩니다. 🛡 <b>EMERGENCY</b> 안전망은 코드에 하드코딩되어 있어 DB가 비어도 항상 작동하며, DB의 EMERGENCY는 추가만 됩니다.
        </p>
      </div>

      {/* ── 시뮬레이션 ─────────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-2">🧪 시뮬레이션 (현재 저장된 규칙으로 테스트)</h2>
        <textarea value={simText} onChange={(e) => setSimText(e.target.value)} rows={3}
          placeholder="리뷰 텍스트를 입력하고 '분류 테스트'를 누르세요. (예: 직원이 불친절하고 다시는 안 올 거예요)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <select value={simLang} onChange={(e) => setSimLang(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            {TPL_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={simRating} onChange={(e) => setSimRating(e.target.value === '' ? '' : Number(e.target.value))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">별점 없음</option>
            {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}★</option>)}
          </select>
          <button onClick={runSim} disabled={simBusy || !simText.trim()}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {simBusy ? '분류 중…' : '분류 테스트'}
          </button>
        </div>
        {simResult && (
          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
            {simResult.error ? (
              <p className="text-red-600">❌ {simResult.error}</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[simResult.classification?.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                    {simResult.classification?.status}
                  </span>
                  <span className="text-xs text-gray-500">route: <b>{simResult.route}</b></span>
                  <span className="text-xs text-gray-500">승인필요: {simResult.requiresApproval ? '예' : '아니오'}</span>
                  {simResult.usingDefaults && <span className="text-xs text-amber-600">⚠ DB 미반영(DEFAULTS)</span>}
                </div>
                <p className="text-xs text-gray-700">사유: {simResult.classification?.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {(simResult.classification?.tags ?? []).map((t, i) => <span key={i} className="rounded-full bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5">{t}</span>)}
                </div>
                {simResult.staticReply && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap bg-white border border-gray-100 rounded p-2 mt-1">↳ {simResult.staticReply}</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 분류 규칙 ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 mb-2">📋 분류 규칙 (automation_rules) — {rules.length}건</h2>
        <div className="space-y-2">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} busy={busy}
              onSave={(p) => postRule({ type: 'rule', id: r.id, ...p })}
              onDelete={() => del('rule', r.id)} />
          ))}
        </div>
        <RuleRow busy={busy} onSave={(p) => postRule({ type: 'rule', ...p })} isNew />
      </section>

      {/* ── 응답 템플릿 ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-800 mb-2">💬 응답 템플릿 (response_templates) — {templates.length}건</h2>
        <p className="text-xs text-gray-400 mb-2">치환자: {'{{name}}'} {'{{official}}'} {'{{signature_phrase}}'} {'{{name_honorific}}'}</p>
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow key={t.id} tpl={t} busy={busy}
              onSave={(p) => postRule({ type: 'template', id: t.id, ...p })}
              onDelete={() => del('template', t.id)} />
          ))}
        </div>
        <TemplateRow busy={busy} onSave={(p) => postRule({ type: 'template', ...p })} isNew />
      </section>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-gray-900 text-white text-sm px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── 규칙 행 (인라인 편집) ──────────────────────────────────────────────────────
function RuleRow({ rule, busy, onSave, onDelete, isNew }: {
  rule?: Rule; busy: boolean; isNew?: boolean
  onSave: (p: Record<string, unknown>) => void; onDelete?: () => void
}) {
  const [category, setCategory] = useState(rule?.category ?? 'COMPLAINT')
  const [language, setLanguage] = useState(rule?.language ?? 'any')
  const [keywords, setKeywords] = useState((rule?.keywords ?? []).join(', '))
  const [regex, setRegex] = useState(rule?.regex_pattern ?? '')
  const [active, setActive] = useState(rule?.is_active ?? true)

  function save() {
    onSave({
      category, language,
      keywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
      regex_pattern: regex.trim() || null,
      is_active: active,
    })
    if (isNew) { setKeywords(''); setRegex('') }
  }

  return (
    <div className={`rounded-lg border px-3 py-2 ${isNew ? 'border-dashed border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs font-medium">
          {RULE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs">
          {RULE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> 활성
        </label>
        <div className="ml-auto flex gap-1">
          <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {isNew ? '추가' : '저장'}
          </button>
          {!isNew && onDelete && (
            <button onClick={onDelete} disabled={busy} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">삭제</button>
          )}
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-1.5">
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="키워드 (쉼표로 구분)"
          className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none" />
        <input value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="정규식 패턴 (있으면 키워드 대신 사용)"
          className="rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:border-blue-500 focus:outline-none" />
      </div>
      {category === 'EMERGENCY' && (
        <p className="text-[10px] text-amber-600 mt-1">🛡 EMERGENCY는 코드 하드코딩 안전망에 <b>추가</b>만 됩니다(약화 불가).</p>
      )}
    </div>
  )
}

// ── 템플릿 행 (인라인 편집) ────────────────────────────────────────────────────
function TemplateRow({ tpl, busy, onSave, onDelete, isNew }: {
  tpl?: Template; busy: boolean; isNew?: boolean
  onSave: (p: Record<string, unknown>) => void; onDelete?: () => void
}) {
  const [category, setCategory] = useState(tpl?.category ?? 'greeting')
  const [language, setLanguage] = useState(tpl?.language ?? 'ko')
  const [text, setText] = useState(tpl?.template_text ?? '')
  const [active, setActive] = useState(tpl?.is_active ?? true)

  function save() {
    if (!text.trim()) return
    onSave({ category, language, template_text: text, is_active: active })
    if (isNew) setText('')
  }

  return (
    <div className={`rounded-lg border px-3 py-2 ${isNew ? 'border-dashed border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs font-medium">
          {TPL_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs">
          {TPL_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> 활성
        </label>
        <div className="ml-auto flex gap-1">
          <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {isNew ? '추가' : '저장'}
          </button>
          {!isNew && onDelete && (
            <button onClick={onDelete} disabled={busy} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">삭제</button>
          )}
        </div>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
        placeholder="응답 템플릿 ({{official}}, {{name}} 등 치환자 사용)"
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none resize-none" />
    </div>
  )
}

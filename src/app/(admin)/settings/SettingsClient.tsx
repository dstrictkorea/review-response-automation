'use client'

import { useState, useTransition } from 'react'
import type { RiskKeyword, ReplyTemplate, Branch, Channel } from '@/types/database'
import {
  saveSettingAction,
  addBranchAction,
  updateBranchAction,
  toggleBranchActiveAction,
  updateChannelAction,
} from './actions'
import { useRouter } from 'next/navigation'

type Tab = 'keywords' | 'templates' | 'branches' | 'channels'

interface Props {
  branches: Branch[]
  channels: Channel[]
  riskKeywords: RiskKeyword[]
  replyTemplates: ReplyTemplate[]
}

const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ar', label: 'العربية' },
]

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        value ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function SettingsClient({
  branches,
  channels,
  riskKeywords: initialKeywords,
  replyTemplates: initialTemplates,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('keywords')
  const [keywords, setKeywords] = useState<RiskKeyword[]>(initialKeywords)
  const [templates, setTemplates] = useState<ReplyTemplate[]>(initialTemplates)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Keyword state
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    language: 'ko',
    risk_level: 'high',
    action: 'human_review',
    is_active: true,
  })

  // Template state
  const [editingTemplate, setEditingTemplate] = useState<ReplyTemplate | null>(null)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    language: 'ko',
    category: 'positive',
    content: '',
  })

  // Branch state
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [newBranch, setNewBranch] = useState({
    code: '',
    name_ko: '',
    name_en: '',
    default_language: 'ko',
  })
  const [editingBranch, setEditingBranch] = useState<{
    id: string
    name_ko: string
    name_en: string
    default_language: string
  } | null>(null)

  // Channel state
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [editingChannelName, setEditingChannelName] = useState('')

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  async function runAction(
    fn: () => Promise<{ success?: boolean; error?: string }>,
    successMsg: string
  ) {
    const result = await fn()
    if (result.error) showMsg(result.error, 'error')
    else {
      showMsg(successMsg)
      router.refresh()
    }
  }

  // ── Keywords ──────────────────────────────────────────────────────────────

  function addKeyword() {
    if (!newKeyword.keyword.trim()) return
    const updated = [
      ...keywords,
      { ...newKeyword, id: crypto.randomUUID() } as RiskKeyword,
    ]
    setKeywords(updated)
    setNewKeyword({ keyword: '', language: 'ko', risk_level: 'high', action: 'human_review', is_active: true })
    startTransition(async () => {
      const result = await saveSettingAction('risk_keywords', updated)
      if (result.error) showMsg(result.error, 'error')
      else showMsg('위험 키워드가 저장되었습니다.')
    })
  }

  function removeKeyword(id: string) {
    const updated = keywords.filter((k) => k.id !== id)
    setKeywords(updated)
    startTransition(async () => {
      await saveSettingAction('risk_keywords', updated)
      showMsg('키워드가 삭제되었습니다.')
    })
  }

  // ── Templates ────────────────────────────────────────────────────────────

  function saveTemplates(updated: ReplyTemplate[]) {
    setTemplates(updated)
    startTransition(async () => {
      const result = await saveSettingAction('reply_templates', updated)
      if (result.error) showMsg(result.error, 'error')
      else showMsg('템플릿이 저장되었습니다.')
    })
  }

  function addTemplate() {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) return
    saveTemplates([...templates, { ...newTemplate, id: crypto.randomUUID() }])
    setNewTemplate({ name: '', language: 'ko', category: 'positive', content: '' })
  }

  // ── Branches ─────────────────────────────────────────────────────────────

  async function handleAddBranch() {
    if (!newBranch.code.trim() || !newBranch.name_ko.trim()) {
      showMsg('지점 코드와 한국어 이름은 필수입니다.', 'error')
      return
    }
    await runAction(() => addBranchAction(newBranch), '새 지점이 추가되었습니다.')
    setNewBranch({ code: '', name_ko: '', name_en: '', default_language: 'ko' })
    setShowAddBranch(false)
  }

  async function handleUpdateBranch() {
    if (!editingBranch) return
    await runAction(
      () => updateBranchAction(editingBranch.id, editingBranch),
      '지점 정보가 수정되었습니다.'
    )
    setEditingBranch(null)
  }

  async function handleToggleBranch(id: string, is_active: boolean) {
    await runAction(
      () => toggleBranchActiveAction(id, is_active),
      is_active ? '지점이 비활성화되었습니다.' : '지점이 활성화되었습니다.'
    )
  }

  // ── Channels ─────────────────────────────────────────────────────────────

  async function handleChannelNameSave(id: string) {
    if (!editingChannelName.trim()) return
    await runAction(
      () => updateChannelAction(id, { name: editingChannelName.trim() }),
      '채널 이름이 수정되었습니다.'
    )
    setEditingChannelId(null)
  }

  async function handleToggleChannelField(
    id: string,
    field: 'is_active' | 'api_enabled' | 'manual_publish',
    currentValue: boolean
  ) {
    if (field === 'manual_publish') {
      const newMode = currentValue ? 'no_publish' : 'manual_copy'
      await runAction(
        () => updateChannelAction(id, { publish_mode: newMode }),
        '수동 게시 설정이 변경되었습니다.'
      )
    } else {
      await runAction(
        () => updateChannelAction(id, { [field]: !currentValue }),
        `채널 설정이 변경되었습니다.`
      )
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'keywords', label: '위험 키워드' },
    { id: 'templates', label: '답변 템플릿' },
    { id: 'branches', label: '지점 관리' },
    { id: 'channels', label: '채널 관리' },
  ]

  return (
    <div>
      {message && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2 text-sm ${
            message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Risk Keywords ── */}
      {activeTab === 'keywords' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">새 키워드 추가</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
              <input
                type="text"
                placeholder="키워드"
                value={newKeyword.keyword}
                onChange={(e) => setNewKeyword((p) => ({ ...p, keyword: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={newKeyword.language}
                onChange={(e) => setNewKeyword((p) => ({ ...p, language: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="any">모든 언어</option>
              </select>
              <select
                value={newKeyword.risk_level}
                onChange={(e) => setNewKeyword((p) => ({ ...p, risk_level: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="critical">위험</option>
              </select>
              <select
                value={newKeyword.action}
                onChange={(e) => setNewKeyword((p) => ({ ...p, action: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="human_review">담당자 검토</option>
                <option value="escalate">에스컬레이션</option>
              </select>
            </div>
            <button
              onClick={addKeyword}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              추가
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">키워드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">언어</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조치</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keywords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      등록된 키워드가 없습니다.
                    </td>
                  </tr>
                )}
                {keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{kw.keyword}</td>
                    <td className="px-4 py-3 text-gray-600">{kw.language}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          kw.risk_level === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : kw.risk_level === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {kw.risk_level === 'critical' ? '위험' : kw.risk_level === 'high' ? '높음' : '보통'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {kw.action === 'escalate' ? '에스컬레이션' : '담당자 검토'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeKeyword(kw.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reply Templates ── */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">새 템플릿 추가</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                placeholder="템플릿명"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={newTemplate.language}
                onChange={(e) => setNewTemplate((p) => ({ ...p, language: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <select
                value={newTemplate.category}
                onChange={(e) => setNewTemplate((p) => ({ ...p, category: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="positive">긍정 리뷰</option>
                <option value="neutral">중립 리뷰</option>
                <option value="negative">부정 리뷰</option>
                <option value="high_risk">고위험 리뷰</option>
              </select>
            </div>
            <textarea
              rows={4}
              placeholder="템플릿 내용을 입력하세요."
              value={newTemplate.content}
              onChange={(e) => setNewTemplate((p) => ({ ...p, content: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none mb-3"
            />
            <button
              onClick={addTemplate}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              템플릿 추가
            </button>
          </div>

          <div className="space-y-3">
            {templates.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                등록된 템플릿이 없습니다.
              </div>
            )}
            {templates.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                {editingTemplate?.id === t.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) =>
                        setEditingTemplate((p) => (p ? { ...p, name: e.target.value } : null))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <textarea
                      rows={5}
                      value={editingTemplate.content}
                      onChange={(e) =>
                        setEditingTemplate((p) => (p ? { ...p, content: e.target.value } : null))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          saveTemplates(
                            templates.map((x) =>
                              x.id === editingTemplate.id ? editingTemplate : x
                            )
                          )
                          setEditingTemplate(null)
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingTemplate(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                            {t.language}
                          </span>
                          <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                            {t.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingTemplate(t)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => saveTemplates(templates.filter((x) => x.id !== t.id))}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {t.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Branch Management ── */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              총 {branches.length}개 지점 (활성 {branches.filter((b) => b.is_active).length}개)
            </p>
            <button
              onClick={() => {
                setShowAddBranch((p) => !p)
                setNewBranch({ code: '', name_ko: '', name_en: '', default_language: 'ko' })
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              {showAddBranch ? '취소' : '+ 새 지점 추가'}
            </button>
          </div>

          {showAddBranch && (
            <div className="bg-white rounded-xl border border-blue-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">새 지점 추가</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    지점 코드 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: AMSG"
                    value={newBranch.code}
                    onChange={(e) =>
                      setNewBranch((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                    }
                    maxLength={10}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    한국어 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: 아르떼뮤지엄 싱가포르"
                    value={newBranch.name_ko}
                    onChange={(e) => setNewBranch((p) => ({ ...p, name_ko: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    영어 이름 (선택)
                  </label>
                  <input
                    type="text"
                    placeholder="예: ARTE Museum Singapore"
                    value={newBranch.name_en}
                    onChange={(e) => setNewBranch((p) => ({ ...p, name_en: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">기본 언어</label>
                  <select
                    value={newBranch.default_language}
                    onChange={(e) =>
                      setNewBranch((p) => ({ ...p, default_language: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddBranch}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                지점 추가
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">코드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    지점명 (한국어)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    지점명 (영어)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">기본 언어</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">활성화</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {branches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      등록된 지점이 없습니다.
                    </td>
                  </tr>
                )}
                {branches.map((b) =>
                  editingBranch?.id === b.id ? (
                    <tr key={b.id} className="bg-blue-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.code}</td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editingBranch.name_ko}
                          onChange={(e) =>
                            setEditingBranch((p) => (p ? { ...p, name_ko: e.target.value } : null))
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editingBranch.name_en}
                          onChange={(e) =>
                            setEditingBranch((p) => (p ? { ...p, name_en: e.target.value } : null))
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editingBranch.default_language}
                          onChange={(e) =>
                            setEditingBranch((p) =>
                              p ? { ...p, default_language: e.target.value } : null
                            )
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          {LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Toggle
                          value={b.is_active}
                          onChange={() => handleToggleBranch(b.id, b.is_active)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={handleUpdateBranch}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingBranch(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          취소
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={b.id} className={`hover:bg-gray-50 ${!b.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.code}</td>
                      <td className="px-4 py-3 text-gray-900">{b.name_ko}</td>
                      <td className="px-4 py-3 text-gray-600">{b.name_en ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{b.default_language}</td>
                      <td className="px-4 py-3">
                        <Toggle
                          value={b.is_active}
                          onChange={() => handleToggleBranch(b.id, b.is_active)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            setEditingBranch({
                              id: b.id,
                              name_ko: b.name_ko,
                              name_en: b.name_en ?? '',
                              default_language: b.default_language,
                            })
                          }
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Channel Management ── */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            총 {channels.length}개 채널 (활성 {channels.filter((c) => c.is_active).length}개)
          </p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">코드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널명</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                    수동 게시
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                    API 연동
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">활성화</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {channels.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.code}</td>
                    <td className="px-4 py-2">
                      {editingChannelId === c.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingChannelName}
                            onChange={(e) => setEditingChannelName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleChannelNameSave(c.id)
                              if (e.key === 'Escape') setEditingChannelId(null)
                            }}
                            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleChannelNameSave(c.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingChannelId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-900">{c.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          value={c.publish_mode === 'manual_copy'}
                          onChange={() =>
                            handleToggleChannelField(
                              c.id,
                              'manual_publish',
                              c.publish_mode === 'manual_copy'
                            )
                          }
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          value={c.api_enabled}
                          onChange={() =>
                            handleToggleChannelField(c.id, 'api_enabled', c.api_enabled)
                          }
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          value={c.is_active}
                          onChange={() => handleToggleChannelField(c.id, 'is_active', c.is_active)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingChannelId(c.id)
                          setEditingChannelName(c.name)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        이름 수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">
            <p className="font-medium mb-1">채널 설정 안내</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li><strong>수동 게시</strong>: 담당자가 직접 복사하여 게시하는 채널</li>
              <li><strong>API 연동</strong>: 향후 API 자동 게시 연동 예정 채널 표시 (현재 미구현)</li>
              <li><strong>활성화</strong>: 비활성화 시 리뷰 등록 드롭다운에서 숨겨짐</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

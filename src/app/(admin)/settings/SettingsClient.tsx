'use client'

import { useState, useTransition } from 'react'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import { saveSettingAction } from './actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Tab = 'keywords' | 'templates' | 'branches' | 'channels'

interface Branch {
  id: string
  code: string
  name_ko: string
  name_en: string | null
  default_language: string
  is_active: boolean
}

interface Channel {
  id: string
  code: string
  name: string
  collection_mode: string
  publish_mode: string
  is_active: boolean
}

interface Props {
  branches: Branch[]
  channels: Channel[]
  riskKeywords: RiskKeyword[]
  replyTemplates: ReplyTemplate[]
}

export default function SettingsClient({ branches, channels, riskKeywords: initial_keywords, replyTemplates: initial_templates }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('keywords')
  const [keywords, setKeywords] = useState<RiskKeyword[]>(initial_keywords)
  const [templates, setTemplates] = useState<ReplyTemplate[]>(initial_templates)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [newKeyword, setNewKeyword] = useState({ keyword: '', language: 'ko', risk_level: 'high', action: 'human_review', is_active: true })
  const [editingTemplate, setEditingTemplate] = useState<ReplyTemplate | null>(null)
  const [newTemplate, setNewTemplate] = useState({ name: '', language: 'ko', category: 'positive', content: '' })

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  function addKeyword() {
    if (!newKeyword.keyword.trim()) return
    const updated = [...keywords, { ...newKeyword, id: crypto.randomUUID() } as RiskKeyword]
    setKeywords(updated)
    setNewKeyword({ keyword: '', language: 'ko', risk_level: 'high', action: 'human_review', is_active: true })
    startTransition(async () => {
      const result = await saveSettingAction('risk_keywords', updated)
      if (result.error) showMessage(`오류: ${result.error}`)
      else showMessage('위험 키워드가 저장되었습니다.')
    })
  }

  function removeKeyword(id: string) {
    const updated = keywords.filter((k) => k.id !== id)
    setKeywords(updated)
    startTransition(async () => {
      await saveSettingAction('risk_keywords', updated)
      showMessage('키워드가 삭제되었습니다.')
    })
  }

  function saveTemplates(updated: ReplyTemplate[]) {
    setTemplates(updated)
    startTransition(async () => {
      const result = await saveSettingAction('reply_templates', updated)
      if (result.error) showMessage(`오류: ${result.error}`)
      else showMessage('템플릿이 저장되었습니다.')
    })
  }

  function addTemplate() {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) return
    const updated = [...templates, { ...newTemplate, id: crypto.randomUUID() }]
    saveTemplates(updated)
    setNewTemplate({ name: '', language: 'ko', category: 'positive', content: '' })
  }

  async function toggleBranch(id: string, is_active: boolean) {
    const supabase = createClient()
    await supabase.from('branches').update({ is_active: !is_active }).eq('id', id)
    router.refresh()
    showMessage('지점 설정이 변경되었습니다.')
  }

  async function toggleChannel(id: string, is_active: boolean) {
    const supabase = createClient()
    await supabase.from('channels').update({ is_active: !is_active }).eq('id', id)
    router.refresh()
    showMessage('채널 설정이 변경되었습니다.')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'keywords', label: '위험 키워드' },
    { id: 'templates', label: '답변 템플릿' },
    { id: 'branches', label: '지점 설정' },
    { id: 'channels', label: '채널 설정' },
  ]

  return (
    <div>
      {message && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {message}
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

      {/* Risk Keywords */}
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keywords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      등록된 키워드가 없습니다.
                    </td>
                  </tr>
                )}
                {keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{kw.keyword}</td>
                    <td className="px-4 py-3 text-gray-600">{kw.language}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        kw.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                        kw.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {kw.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{kw.action}</td>
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

      {/* Reply Templates */}
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
                <option value="ko">한국어</option>
                <option value="en">English</option>
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
              <div className="bg-white rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500 text-sm">
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
                      onChange={(e) => setEditingTemplate((p) => p ? { ...p, name: e.target.value } : null)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <textarea
                      rows={5}
                      value={editingTemplate.content}
                      onChange={(e) => setEditingTemplate((p) => p ? { ...p, content: e.target.value } : null)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updated = templates.map((x) => x.id === editingTemplate.id ? editingTemplate : x)
                          saveTemplates(updated)
                          setEditingTemplate(null)
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        저장
                      </button>
                      <button onClick={() => setEditingTemplate(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
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
                          <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{t.language}</span>
                          <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{t.category}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingTemplate(t)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">수정</button>
                        <button
                          onClick={() => saveTemplates(templates.filter((x) => x.id !== t.id))}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-3">{t.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branches */}
      {activeTab === 'branches' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점명 (한국어)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점명 (영어)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">기본 언어</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">활성화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.code}</td>
                  <td className="px-4 py-3 text-gray-900">{b.name_ko}</td>
                  <td className="px-4 py-3 text-gray-600">{b.name_en ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.default_language}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBranch(b.id, b.is_active)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${b.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${b.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Channels */}
      {activeTab === 'channels' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널명</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">수집 방식</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">게시 방식</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">활성화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channels.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.code}</td>
                  <td className="px-4 py-3 text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.collection_mode}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.publish_mode}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleChannel(c.id, c.is_active)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${c.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${c.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

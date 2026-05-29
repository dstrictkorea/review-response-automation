'use client'

/**
 * SettingsClient — 글로벌 CS 시스템 통합 설정 페이지
 *
 * Tabs:
 *   1. 위험 키워드  — 글로벌 다국어 (KO/EN/JA/ZH/AR) 필터 키워드 관리
 *   2. 답변 템플릿  — 시스템 동적 변수 가이드 칩 + 별점 구간 분기 규칙
 *   3. 지점 관리    — CRUD
 *   4. 채널 관리    — 게시 모드 / API 토글
 *   5. 웹훅 설정    — 채널별 아웃바운드 웹훅 URL 구성
 */

import { useState, useTransition, useRef, useCallback } from 'react'
import type { RiskKeyword, ReplyTemplate, Branch, Channel } from '@/types/database'
import { SYSTEM_VARIABLES } from '@/services/aiService'
import {
  saveSettingAction,
  addBranchAction,
  updateBranchAction,
  toggleBranchActiveAction,
  updateChannelAction,
} from './actions'
import { useRouter } from 'next/navigation'

// ── 공개 타입 (settings/page.tsx에서 임포트) ───────────────────────────────────

export interface RatingTemplateRules {
  low_star:  string   // 1–2★
  mid_star:  string   // 3★
  high_star: string   // 4–5★
}

// ── 내부 타입 ─────────────────────────────────────────────────────────────────

type Tab = 'keywords' | 'templates' | 'branches' | 'channels' | 'webhooks'
type KeywordLangFilter = 'all' | 'ko' | 'en' | 'ja' | 'zh' | 'ar' | 'any'

interface Props {
  branches: Branch[]
  channels: Channel[]
  riskKeywords: RiskKeyword[]
  replyTemplates: ReplyTemplate[]
  channelWebhooks: Record<string, string>
  ratingRules: RatingTemplateRules
}

// ── 상수 ───────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'ko',  label: '한국어',    flag: '🇰🇷' },
  { value: 'en',  label: 'English',  flag: '🇺🇸' },
  { value: 'ja',  label: '日本語',    flag: '🇯🇵' },
  { value: 'zh',  label: '中文',      flag: '🇨🇳' },
  { value: 'ar',  label: 'العربية',  flag: '🇦🇪' },
  { value: 'any', label: '모든 언어', flag: '🌐' },
]

const LANG_FILTER_TABS: { id: KeywordLangFilter; label: string; flag: string }[] = [
  { id: 'all', label: '전체', flag: '' },
  { id: 'ko',  label: '한국어', flag: '🇰🇷' },
  { id: 'en',  label: 'EN', flag: '🇺🇸' },
  { id: 'ja',  label: '日',  flag: '🇯🇵' },
  { id: 'zh',  label: '中',  flag: '🇨🇳' },
  { id: 'ar',  label: 'AR', flag: '🇦🇪' },
  { id: 'any', label: '공통', flag: '🌐' },
]

const TEMPLATE_CATEGORIES = [
  { value: 'positive',  label: '긍정 리뷰 (4–5★)' },
  { value: 'neutral',   label: '중립 리뷰 (3★)' },
  { value: 'negative',  label: '부정 리뷰 (1–2★)' },
  { value: 'high_risk', label: '고위험 리뷰' },
]

// ── 토글 컴포넌트 ──────────────────────────────────────────────────────────────

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

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function SettingsClient({
  branches,
  channels,
  riskKeywords: initialKeywords,
  replyTemplates: initialTemplates,
  channelWebhooks: initialWebhooks,
  ratingRules: initialRatingRules,
}: Props) {
  const [activeTab, setActiveTab]           = useState<Tab>('keywords')
  const [keywords, setKeywords]             = useState<RiskKeyword[]>(initialKeywords)
  const [templates, setTemplates]           = useState<ReplyTemplate[]>(initialTemplates)
  const [webhooks, setWebhooks]             = useState<Record<string,string>>(initialWebhooks)
  const [ratingRules, setRatingRules]       = useState<RatingTemplateRules>(initialRatingRules)
  const [keywordLangFilter, setKeywordLangFilter] = useState<KeywordLangFilter>('all')
  const [message, setMessage]               = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition]        = useTransition()
  const [copiedChip, setCopiedChip]         = useState<string | null>(null)
  const router = useRouter()

  // ── 텍스트에어리어 포커스 트래킹 (변수 칩 주입용) ──────────────────────────────
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const trackTextarea = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    activeTextareaRef.current = e.target
  }, [])

  // ── 변수 칩 복사 ─────────────────────────────────────────────────────────────
  function copyVariableChip(variable: string) {
    navigator.clipboard.writeText(variable).catch(() => undefined)
    setCopiedChip(variable)
    setTimeout(() => setCopiedChip(null), 1500)
  }

  // ── Keyword state ──────────────────────────────────────────────────────────
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    language: 'ko',
    risk_level: 'high',
    action: 'human_review',
    is_active: true,
  })

  // ── Template state ────────────────────────────────────────────────────────
  const [editingTemplate, setEditingTemplate] = useState<ReplyTemplate | null>(null)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    language: 'ko',
    category: 'positive',
    content: '',
  })

  // ── Branch state ─────────────────────────────────────────────────────────
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

  // ── Channel state ─────────────────────────────────────────────────────────
  const [editingChannelId, setEditingChannelId]   = useState<string | null>(null)
  const [editingChannelName, setEditingChannelName] = useState('')

  // ── 공통 메시지 핸들러 ────────────────────────────────────────────────────────
  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  async function runAction(
    fn: () => Promise<{ success?: boolean; error?: string }>,
    successMsg: string,
  ) {
    const result = await fn()
    if (result.error) showMsg(result.error, 'error')
    else {
      showMsg(successMsg)
      router.refresh()
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // KEYWORDS
  // ════════════════════════════════════════════════════════════════════════════

  function addKeyword() {
    if (!newKeyword.keyword.trim()) return
    const updated: RiskKeyword[] = [
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

  function toggleKeywordActive(id: string) {
    const updated = keywords.map((k) =>
      k.id === id ? { ...k, is_active: !k.is_active } : k,
    )
    setKeywords(updated)
    startTransition(async () => {
      await saveSettingAction('risk_keywords', updated)
    })
  }

  const filteredKeywords =
    keywordLangFilter === 'all'
      ? keywords
      : keywords.filter((k) => k.language === keywordLangFilter)

  // ════════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════════════════════

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

  function saveRatingRules(updated: RatingTemplateRules) {
    setRatingRules(updated)
    startTransition(async () => {
      const result = await saveSettingAction('rating_template_rules', updated)
      if (result.error) showMsg(result.error, 'error')
      else showMsg('별점 분기 규칙이 저장되었습니다.')
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BRANCHES
  // ════════════════════════════════════════════════════════════════════════════

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
      '지점 정보가 수정되었습니다.',
    )
    setEditingBranch(null)
  }

  async function handleToggleBranch(id: string, is_active: boolean) {
    await runAction(
      () => toggleBranchActiveAction(id, is_active),
      is_active ? '지점이 비활성화되었습니다.' : '지점이 활성화되었습니다.',
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHANNELS
  // ════════════════════════════════════════════════════════════════════════════

  async function handleChannelNameSave(id: string) {
    if (!editingChannelName.trim()) return
    await runAction(
      () => updateChannelAction(id, { name: editingChannelName.trim() }),
      '채널 이름이 수정되었습니다.',
    )
    setEditingChannelId(null)
  }

  async function handleToggleChannelField(
    id: string,
    field: 'is_active' | 'api_enabled' | 'manual_publish',
    currentValue: boolean,
  ) {
    if (field === 'manual_publish') {
      const newMode = currentValue ? 'no_publish' : 'manual_copy'
      await runAction(
        () => updateChannelAction(id, { publish_mode: newMode }),
        '수동 게시 설정이 변경되었습니다.',
      )
    } else {
      await runAction(
        () => updateChannelAction(id, { [field]: !currentValue }),
        '채널 설정이 변경되었습니다.',
      )
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ════════════════════════════════════════════════════════════════════════════

  function updateWebhookUrl(channelCode: string, url: string) {
    setWebhooks((prev) => {
      const next = { ...prev }
      if (url.trim()) {
        next[channelCode] = url.trim()
      } else {
        delete next[channelCode]
      }
      return next
    })
  }

  function saveWebhooks() {
    startTransition(async () => {
      const result = await saveSettingAction('channel_webhooks', webhooks)
      if (result.error) showMsg(result.error, 'error')
      else showMsg('웹훅 설정이 저장되었습니다.')
    })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'keywords',  label: '위험 키워드', badge: keywords.length > 0 ? keywords.filter(k => k.is_active).length : undefined },
    { id: 'templates', label: '답변 템플릿', badge: templates.length > 0 ? templates.length : undefined },
    { id: 'branches',  label: '지점 관리' },
    { id: 'channels',  label: '채널 관리' },
    { id: 'webhooks',  label: '웹훅 설정',   badge: Object.keys(webhooks).length > 0 ? Object.keys(webhooks).length : undefined },
  ]

  return (
    <div>
      {/* 메시지 토스트 */}
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

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: 위험 키워드                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'keywords' && (
        <div className="space-y-4">
          {/* 하드코딩 글로벌 필터 안내 */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4">
            <p className="text-xs font-semibold text-amber-800 mb-1.5">
              🔒 시스템 내장 글로벌 필터 (수정 불가, 항상 활성)
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-amber-700 sm:grid-cols-3">
              <span>🇰🇷 소송·부상·경찰·환불·CCTV·차별</span>
              <span>🇺🇸 lawsuit·injury·slip·fall·refund·police</span>
              <span>🇯🇵 訴訟·怪我·転倒·返金·警察·差別</span>
              <span>🇨🇳 起诉·受伤·摔倒·退款·报警·歧视</span>
              <span>🇦🇪 دعوى·إصابة·انزلاق·تعويض·شرطة</span>
            </div>
            <p className="text-xs text-amber-600 mt-2">
              위 단어 중 하나라도 리뷰에 포함되면 평점·AI 결과와 무관하게 즉시 <strong>pending_approval</strong> 격리됩니다.
            </p>
          </div>

          {/* 새 키워드 추가 폼 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">DB 키워드 추가</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
              <input
                type="text"
                placeholder="키워드 (예: 불친절)"
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
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                ))}
              </select>
              <select
                value={newKeyword.risk_level}
                onChange={(e) => setNewKeyword((p) => ({ ...p, risk_level: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="medium">🟡 보통 (medium)</option>
                <option value="high">🟠 높음 (high)</option>
                <option value="critical">🔴 위험 (critical)</option>
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
              disabled={isPending || !newKeyword.keyword.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              추가
            </button>
          </div>

          {/* 언어별 필터 탭 */}
          <div className="flex gap-1 flex-wrap">
            {LANG_FILTER_TABS.map((lf) => (
              <button
                key={lf.id}
                onClick={() => setKeywordLangFilter(lf.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  keywordLangFilter === lf.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {lf.flag && <span className="mr-1">{lf.flag}</span>}
                {lf.label}
                {lf.id !== 'all' && (
                  <span className="ml-1 opacity-60">
                    ({keywords.filter(k => lf.id === 'all' || k.language === lf.id).length})
                  </span>
                )}
                {lf.id === 'all' && (
                  <span className="ml-1 opacity-60">({keywords.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* 키워드 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">키워드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">언어</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조치</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">활성</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredKeywords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      {keywordLangFilter === 'all'
                        ? '등록된 키워드가 없습니다.'
                        : `${keywordLangFilter} 언어에 등록된 키워드가 없습니다.`}
                    </td>
                  </tr>
                )}
                {filteredKeywords.map((kw) => {
                  const langInfo = LANGUAGES.find((l) => l.value === kw.language)
                  return (
                    <tr key={kw.id} className={`hover:bg-gray-50 ${!kw.is_active ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{kw.keyword}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5">
                          {langInfo?.flag} {kw.language}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          kw.risk_level === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : kw.risk_level === 'high'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {kw.risk_level === 'critical' ? '🔴 위험' : kw.risk_level === 'high' ? '🟠 높음' : '🟡 보통'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {kw.action === 'escalate' ? '에스컬레이션' : '담당자 검토'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            value={kw.is_active}
                            onChange={() => toggleKeywordActive(kw.id)}
                          />
                        </div>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: 답변 템플릿                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* 별점 구간 분기 규칙 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">별점 구간 → 템플릿 카테고리 분기 규칙</h3>
                <p className="text-xs text-gray-500 mt-0.5">별점에 따라 AI가 우선 참조할 템플릿 카테고리를 지정합니다.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { key: 'low_star',  label: '🔴 1–2★ (부정/위험)' },
                  { key: 'mid_star',  label: '🟡 3★ (중립)' },
                  { key: 'high_star', label: '🟢 4–5★ (긍정)' },
                ] as const
              ).map((rule) => (
                <div key={rule.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{rule.label}</label>
                  <select
                    value={ratingRules[rule.key]}
                    onChange={(e) => {
                      const updated = { ...ratingRules, [rule.key]: e.target.value }
                      saveRatingRules(updated)
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 새 템플릿 추가 + 변수 가이드 */}
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            {/* 왼쪽: 편집 폼 */}
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
                    <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                  ))}
                </select>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, category: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                rows={5}
                placeholder={`템플릿 내용 (예: {{branch_name}} 방문에 감사드립니다. {{core_complaint}}에 대한 소중한 의견 잘 받았습니다.)`}
                value={newTemplate.content}
                onChange={(e) => setNewTemplate((p) => ({ ...p, content: e.target.value }))}
                onFocus={trackTextarea}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none mb-3"
              />
              <button
                onClick={addTemplate}
                disabled={isPending || !newTemplate.name.trim() || !newTemplate.content.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                템플릿 추가
              </button>
            </div>

            {/* 오른쪽: 시스템 동적 변수 가이드 칩 */}
            <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                시스템 동적 변수
              </p>
              <p className="text-xs text-slate-500 mb-3">
                칩을 클릭하면 클립보드에 복사됩니다.
                편집 중인 텍스트 상자에 붙여넣기(Ctrl+V)하세요.
              </p>
              <div className="flex flex-col gap-2">
                {SYSTEM_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => copyVariableChip(v.key)}
                    className={`text-left rounded-lg border px-3 py-2 transition-all ${
                      copiedChip === v.key
                        ? 'border-green-400 bg-green-50 text-green-800'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono font-bold">{v.key}</code>
                      {copiedChip === v.key && (
                        <span className="text-xs text-green-600 font-medium">✓ 복사됨</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 기존 템플릿 목록 */}
          <div className="space-y-3">
            {templates.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                등록된 템플릿이 없습니다.
              </div>
            )}
            {templates.map((t) => {
              const langInfo = LANGUAGES.find((l) => l.value === t.language)
              return (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  {editingTemplate?.id === t.id ? (
                    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate((p) => p ? { ...p, name: e.target.value } : null)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editingTemplate.language}
                            onChange={(e) => setEditingTemplate((p) => p ? { ...p, language: e.target.value } : null)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            {LANGUAGES.map((l) => (
                              <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                            ))}
                          </select>
                          <select
                            value={editingTemplate.category}
                            onChange={(e) => setEditingTemplate((p) => p ? { ...p, category: e.target.value } : null)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            {TEMPLATE_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          rows={6}
                          value={editingTemplate.content}
                          onChange={(e) => setEditingTemplate((p) => p ? { ...p, content: e.target.value } : null)}
                          onFocus={trackTextarea}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              saveTemplates(templates.map((x) => x.id === editingTemplate.id ? editingTemplate : x))
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
                      {/* 편집 모드에서도 변수 가이드 패널 표시 */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-600 mb-2">변수 삽입</p>
                        <div className="flex flex-col gap-1.5">
                          {SYSTEM_VARIABLES.map((v) => (
                            <button
                              key={v.key}
                              onClick={() => copyVariableChip(v.key)}
                              className={`text-left rounded px-2 py-1.5 text-xs transition-all ${
                                copiedChip === v.key
                                  ? 'bg-green-50 text-green-700 border border-green-300'
                                  : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700'
                              }`}
                            >
                              <code className="font-mono">{v.key}</code>
                              {copiedChip === v.key && <span className="ml-1 text-green-600">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                              {langInfo?.flag} {t.language}
                            </span>
                            <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                              {TEMPLATE_CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
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
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: 지점 관리                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
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
                    onChange={(e) => setNewBranch((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">영어 이름 (선택)</label>
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
                    onChange={(e) => setNewBranch((p) => ({ ...p, default_language: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {LANGUAGES.filter(l => l.value !== 'any').map((l) => (
                      <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점명 (한국어)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점명 (영어)</th>
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
                          onChange={(e) => setEditingBranch((p) => p ? { ...p, name_ko: e.target.value } : null)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editingBranch.name_en}
                          onChange={(e) => setEditingBranch((p) => p ? { ...p, name_en: e.target.value } : null)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editingBranch.default_language}
                          onChange={(e) => setEditingBranch((p) => p ? { ...p, default_language: e.target.value } : null)}
                          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          {LANGUAGES.filter(l => l.value !== 'any').map((l) => (
                            <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Toggle value={b.is_active} onChange={() => handleToggleBranch(b.id, b.is_active)} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={handleUpdateBranch} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3">저장</button>
                        <button onClick={() => setEditingBranch(null)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">취소</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={b.id} className={`hover:bg-gray-50 ${!b.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.code}</td>
                      <td className="px-4 py-3 text-gray-900">{b.name_ko}</td>
                      <td className="px-4 py-3 text-gray-600">{b.name_en ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">
                          {LANGUAGES.find(l => l.value === b.default_language)?.flag}{' '}
                          {b.default_language}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Toggle value={b.is_active} onChange={() => handleToggleBranch(b.id, b.is_active)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditingBranch({ id: b.id, name_ko: b.name_ko, name_en: b.name_en ?? '', default_language: b.default_language })}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: 채널 관리                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">수동 게시</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">API 연동</th>
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
                          <button onClick={() => handleChannelNameSave(c.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">저장</button>
                          <button onClick={() => setEditingChannelId(null)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">취소</button>
                        </div>
                      ) : (
                        <span className="text-gray-900">{c.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          value={c.publish_mode === 'manual_copy'}
                          onChange={() => handleToggleChannelField(c.id, 'manual_publish', c.publish_mode === 'manual_copy')}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle value={c.api_enabled} onChange={() => handleToggleChannelField(c.id, 'api_enabled', c.api_enabled)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle value={c.is_active} onChange={() => handleToggleChannelField(c.id, 'is_active', c.is_active)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditingChannelId(c.id); setEditingChannelName(c.name) }}
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
              <li><strong>API 연동</strong>: API 자동 게시 연동 채널 표시 (Google은 별도 구성 필요)</li>
              <li><strong>활성화</strong>: 비활성화 시 리뷰 등록 드롭다운에서 숨겨짐</li>
            </ul>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: 웹훅 설정                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">웹훅 자동 게시 파이프라인 안내</p>
            <p className="text-xs text-blue-700">
              아래 채널에 웹훅 URL을 설정하면, 마케터가 [🟢 즉시 게시]를 클릭했을 때 해당 URL로
              답변 데이터가 자동 전송됩니다. Google은 GBP API를 별도 사용합니다.
              웹훅 미설정 채널은 클립보드 복사 → 수동 붙여넣기 방식으로 fallback됩니다.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">채널별 아웃바운드 웹훅 URL</h3>
            {channels.filter((c) => c.is_active).map((c) => {
              const isGoogle = c.code.toLowerCase() === 'google'
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <span className="text-sm font-medium text-gray-700">{c.name}</span>
                    <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                  </div>
                  {isGoogle ? (
                    <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <p className="text-xs text-emerald-700 font-medium">
                        ✅ Google Business Profile API 자동 연동 — 별도 웹훅 불필요
                      </p>
                      <p className="text-xs text-emerald-600">
                        Google 연동 설정은 [Google 연동] 메뉴에서 관리하세요.
                      </p>
                    </div>
                  ) : (
                    <input
                      type="url"
                      placeholder={`https://hooks.example.com/${c.code.toLowerCase()}`}
                      value={webhooks[c.code] ?? ''}
                      onChange={(e) => updateWebhookUrl(c.code, e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none placeholder-gray-300"
                    />
                  )}
                  {!isGoogle && webhooks[c.code] && (
                    <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ 설정됨</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              웹훅 페이로드: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{'{ reviewId, channelCode, branchCode, reviewUrl, replyText, timestamp }'}</code>
            </p>
            <button
              onClick={saveWebhooks}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isPending ? '저장 중...' : '웹훅 설정 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

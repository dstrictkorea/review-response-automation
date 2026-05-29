'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Review } from '@/types/database'
import { useLanguage } from '@/context/LanguageContext'
import { LANG_LOCALE } from '@/lib/i18n'

interface Props {
  allReviews: Review[]
}

type Preset = 'today' | '1w' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'custom' | 'all'

function presetRange(preset: Preset): { from: Date | null; to: Date | null } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'all':    return { from: null, to: null }
    case 'today':  return { from: todayStart, to: todayEnd }
    case '1w':     return { from: new Date(todayStart.getTime() - 6 * 86400000), to: todayEnd }
    case '1m':     return { from: new Date(todayStart.getTime() - 29 * 86400000), to: todayEnd }
    case '3m':     return { from: new Date(todayStart.getTime() - 89 * 86400000), to: todayEnd }
    case '6m':     return { from: new Date(todayStart.getTime() - 179 * 86400000), to: todayEnd }
    case '1y':     return { from: new Date(todayStart.getTime() - 364 * 86400000), to: todayEnd }
    case 'ytd': {
      const jan1 = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      return { from: jan1, to: todayEnd }
    }
    default:       return { from: null, to: null }
  }
}

// fmt is locale-aware — called inside the component where lang is in scope

export default function DashboardStats({ allReviews }: Props) {
  const { lang, t } = useLanguage()
  const locale = LANG_LOCALE[lang]

  function fmt(d: Date) {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  const [preset, setPreset]         = useState<Preset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const PRESET_LABELS: Record<Preset, string> = {
    all:    t.period_all,
    today:  t.period_today,
    '1w':   t.period_1w,
    '1m':   t.period_1m,
    '3m':   t.period_3m,
    '6m':   t.period_6m,
    '1y':   t.period_1y,
    ytd:    t.period_ytd,
    custom: t.period_custom,
  }

  const filtered = useMemo(() => {
    let from: Date | null = null
    let to:   Date | null = null

    if (preset === 'custom') {
      if (customFrom) from = new Date(customFrom + 'T00:00:00')
      if (customTo)   to   = new Date(customTo   + 'T23:59:59')
    } else {
      const r = presetRange(preset)
      from = r.from
      to   = r.to
    }

    return allReviews.filter(r => {
      const d = new Date(r.review_created_at ?? r.created_at)
      if (from && d < from) return false
      if (to   && d > to)   return false
      return true
    })
  }, [allReviews, preset, customFrom, customTo])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total           = filtered.length
  const newCount        = filtered.filter(r => r.status === 'new').length
  const aiDone          = filtered.filter(r => r.status === 'ai_done').length
  const pendingApproval = filtered.filter(r => r.status === 'pending_approval').length
  const escalated       = filtered.filter(r => r.status === 'escalated').length
  const highRisk        = filtered.filter(r => r.risk_level === 'high' || r.risk_level === 'critical').length
  const published       = filtered.filter(r => r.status === 'manual_published').length
  const responseRate = total > 0 ? Math.round((published / total) * 100) : 0

  const rated    = filtered.filter(r => r.rating != null)
  const avgRating = rated.length > 0
    ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length
    : null

  const ratingDist = ([5, 4, 3, 2, 1] as const).map(star => ({
    star,
    count: rated.filter(r => r.rating === star).length,
  }))

  // ── Range label ────────────────────────────────────────────────────────────
  let rangeLabel = ''
  if (preset !== 'all' && preset !== 'custom') {
    const { from, to } = presetRange(preset)
    if (from && to) rangeLabel = `${fmt(from)} ~ ${fmt(to)}`
  } else if (preset === 'custom' && (customFrom || customTo)) {
    rangeLabel = `${customFrom || '—'} ~ ${customTo || '—'}`
  }

  const avgColor =
    avgRating == null       ? 'text-gray-400'
    : avgRating >= 4.5      ? 'text-green-600'
    : avgRating >= 3.5      ? 'text-yellow-500'
    : 'text-red-500'

  return (
    <div className="mb-8">
      {/* ── 기간 선택 ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">{t.stat_period_label}</span>
          {(Object.keys(PRESET_LABELS) as Preset[]).map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                preset === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Custom range inputs */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            {rangeLabel && (
              <span className="text-xs text-gray-400">{total}{t.stat_unit}</span>
            )}
          </div>
        )}

        {rangeLabel && preset !== 'custom' && (
          <p className="text-xs text-gray-400 mt-1.5">{rangeLabel} · {total}{t.stat_unit}</p>
        )}
      </div>

      {/* ── 평균 평점 + 분포 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Average rating card */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 flex items-center gap-5">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t.stat_avg_rating}</p>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-bold tracking-tight ${avgColor}`}>
                {avgRating != null ? avgRating.toFixed(1) : '—'}
              </span>
              <span className="text-base text-gray-400 mb-1">{t.stat_per_5}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{rated.length}{t.stat_rating_basis}</p>
          </div>
          {/* Star visual */}
          {avgRating != null && (
            <div className="flex flex-col gap-1 ml-auto">
              {ratingDist.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 w-3">{star}</span>
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${star >= 4 ? 'bg-yellow-400' : star === 3 ? 'bg-orange-300' : 'bg-red-400'}`}
                      style={{ width: rated.length > 0 ? `${(count / rated.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Response rate card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5">
          <p className="text-xs text-blue-600 font-medium mb-1">{t.stat_response_rate}</p>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold tracking-tight text-blue-700">{responseRate}</span>
            <span className="text-base text-blue-400 mb-1">%</span>
          </div>
          <p className="text-xs text-blue-500 mt-1">{published}{t.stat_published_of} {total}{t.stat_unit}</p>
        </div>
      </div>

      {/* ── 상태별 지표 카드 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* New */}
        <Link
          href="/reviews?status=new"
          className={`rounded-xl border px-4 py-4 transition-all hover:shadow-sm ${
            newCount > 0 ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-xs font-medium text-orange-600 mb-1">{t.stat_new}</p>
          <p className={`text-3xl font-bold ${newCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{newCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.stat_unit}</p>
        </Link>

        {/* AI done */}
        <Link
          href="/reviews?status=ai_done"
          className="bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-purple-300 hover:shadow-sm transition-all"
        >
          <p className="text-xs text-gray-500 mb-1">{t.stat_ai_done}</p>
          <p className={`text-3xl font-bold ${aiDone > 0 ? 'text-purple-700' : 'text-gray-400'}`}>{aiDone}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.stat_unit}</p>
        </Link>

        {/* AI isolated — pending_approval */}
        <Link
          href="/reviews?status=pending_approval"
          className={`rounded-xl border px-4 py-4 transition-all hover:shadow-sm ${
            pendingApproval > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'
          }`}
        >
          <p className={`text-xs font-medium mb-1 ${pendingApproval > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{t.stat_pending_approval}</p>
          <p className={`text-3xl font-bold ${pendingApproval > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{pendingApproval}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.stat_unit}</p>
        </Link>

        {/* Escalated */}
        <Link
          href="/reviews?status=escalated"
          className={`rounded-xl border px-4 py-4 transition-all hover:shadow-sm ${
            escalated > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-xs text-red-600 mb-1">{t.stat_escalated}</p>
          <p className={`text-3xl font-bold ${escalated > 0 ? 'text-red-700' : 'text-gray-400'}`}>{escalated}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.stat_unit}</p>
        </Link>

        {/* High risk */}
        <Link
          href="/reviews?risk=high"
          className="bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-orange-300 hover:shadow-sm transition-all"
        >
          <p className="text-xs text-orange-600 mb-1">{t.stat_high_risk}</p>
          <p className={`text-3xl font-bold ${highRisk > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{highRisk}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.stat_unit}</p>
        </Link>
      </div>
    </div>
  )
}

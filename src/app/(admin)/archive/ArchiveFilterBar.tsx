'use client'

/**
 * ArchiveFilterBar — 보관함(아카이브) 상단 헤더 + 필터 (Wave 17)
 *
 * 4개국어(useLanguage) + 플루이드(flex-wrap) 레이아웃.
 * 지점 / 검색어 / 작성일 범위로 필터하여 /archive 로 서버사이드 네비게이션.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

interface BranchOpt { code: string; name_ko: string }

export default function ArchiveFilterBar({
  branches,
  params,
  total,
}: {
  branches: BranchOpt[]
  params: { branch?: string; q?: string; date_from?: string; date_to?: string }
  total: number
}) {
  const router = useRouter()
  const { t } = useLanguage()

  const [branch, setBranch]     = useState(params.branch ?? '')
  const [q, setQ]               = useState(params.q ?? '')
  const [dateFrom, setDateFrom] = useState(params.date_from ?? '')
  const [dateTo, setDateTo]     = useState(params.date_to ?? '')

  function apply() {
    const sp = new URLSearchParams()
    if (branch)        sp.set('branch', branch)
    if (q.trim())      sp.set('q', q.trim())
    if (dateFrom)      sp.set('date_from', dateFrom)
    if (dateTo)        sp.set('date_to', dateTo)
    const qs = sp.toString()
    router.push(qs ? `/archive?${qs}` : '/archive')
  }

  function reset() {
    setBranch(''); setQ(''); setDateFrom(''); setDateTo('')
    router.push('/archive')
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t.arch_title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.arch_subtitle}</p>
        </div>
        <span className="text-sm text-gray-400 whitespace-nowrap">{total}{t.stat_unit}</span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); apply() }}
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-gray-500">{t.filter_branch_label}</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          >
            <option value="">{t.arch_branch_all}</option>
            {branches.map((b) => (
              <option key={b.code} value={b.code}>{b.code} · {b.name_ko}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500">{t.rv_search_label}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.arch_search_ph}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">{t.rv_date_from}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">{t.rv_date_to}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            {t.arch_apply}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t.arch_reset}
          </button>
        </div>
      </form>
    </div>
  )
}

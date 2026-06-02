'use client'

/**
 * ReviewsFilterPanel — 리뷰 목록 상단 헤더 + 검색/필터 폼 + 통계 카드 (Wave 13)
 *
 * reviews/page.tsx(서버)에서 데이터를 받아 i18n(useLanguage)로 렌더링합니다.
 * 서버 컴포넌트는 useLanguage를 쓸 수 없으므로 필터 레이어를 클라이언트로 분리.
 *
 * 지점 select: 국내/글로벌 <optgroup> 이원화 + 코드 최우선 표기 (AMDB (Dubai)).
 */

import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { classifyBranch, branchCity } from '@/lib/branches'
import DateInput from './DateInput'

interface BranchRow { code: string; name_ko: string; country_code: string | null }
interface ChannelRow { code: string; name: string }

interface FilterParams {
  branch?: string
  channel?: string
  status?: string
  risk?: string
  rating?: string
  q?: string
  date_from?: string
  date_to?: string
}

interface Props {
  branches: BranchRow[]
  channels: ChannelRow[]
  params: FilterParams
  total: number
  avgRating: number | null
  ratingDist: { star: number; count: number }[]
  ratingsLen: number
  /** 아카이브 모드: 평점 + 보관 사유(status) 셀렉트 활성화, 헤더/통계 조정 */
  archiveMode?: boolean
}

// 아카이브 "보관 사유" = 처리 완료 상태 3종
const ARCHIVE_STATUSES = ['manual_published', 'no_reply', 'escalated'] as const

export default function ReviewsFilterPanel({
  branches, channels, params, total, avgRating, ratingDist, ratingsLen, archiveMode = false,
}: Props) {
  const { lang, t } = useLanguage()

  function statusLabelOf(code: string): string {
    const m: Record<string, string> = {
      manual_published: t.status_published, no_reply: t.status_no_reply, escalated: t.status_escalated,
    }
    return m[code] ?? code
  }

  // 지점 옵션 표기: 코드 최우선 + 도시명(현재 locale)
  function branchOptionLabel(b: BranchRow): string {
    const city = branchCity(b.code, lang) ?? b.name_ko.replace('아르떼뮤지엄 ', '')
    return city ? `${b.code} (${city})` : b.code
  }

  const domestic = branches.filter((b) => classifyBranch(b.code, b.country_code) === 'domestic')
  const global   = branches.filter((b) => classifyBranch(b.code, b.country_code) === 'global')

  return (
    <>
      {/* ── 헤더 ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{archiveMode ? t.nav_archive : t.rv_list_title}</h2>
          <p className="text-sm text-gray-600 mt-1">{t.rv_total_word} {total}{t.stat_unit}</p>
        </div>
        {!archiveMode && (
          <div className="flex gap-2">
            <Link href="/reviews/import"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              {t.rv_import_csv}
            </Link>
            <Link href="/reviews/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              {t.rv_register_one}
            </Link>
          </div>
        )}
      </div>

      {/* ── 서버사이드 필터 폼 (GET) ─────────────────────────────────────────── */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_search_label}</label>
          <input type="text" name="q" defaultValue={params.q ?? ''}
            placeholder={t.rv_search_ph}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_date_from}</label>
            <DateInput name="date_from" defaultValue={params.date_from ?? ''} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_date_to}</label>
            <DateInput name="date_to" defaultValue={params.date_to ?? ''} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_col_branch}</label>
            <select name="branch" defaultValue={params.branch ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none">
              <option value="">{t.rv_group_all}</option>
              {domestic.length > 0 && (
                <optgroup label={`🇰🇷 ${t.rv_group_domestic}`}>
                  {domestic.map((b) => <option key={b.code} value={b.code}>{branchOptionLabel(b)}</option>)}
                </optgroup>
              )}
              {global.length > 0 && (
                <optgroup label={`🌐 ${t.rv_group_global}`}>
                  {global.map((b) => <option key={b.code} value={b.code}>{branchOptionLabel(b)}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_col_channel}</label>
            <select name="channel" defaultValue={params.channel ?? ''}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none">
              <option value="">{t.rv_group_all}</option>
              {channels.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── 아카이브 모드: 평점 + 보관 사유 셀렉트 ──────────────────────────── */}
        {archiveMode && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_col_rating}</label>
              <select name="rating" defaultValue={params.rating ?? ''}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none">
                <option value="">{t.rv_group_all}</option>
                {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}★</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t.rv_archive_reason}</label>
              <select name="status" defaultValue={params.status ?? ''}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none">
                <option value="">{t.rv_group_all}</option>
                {ARCHIVE_STATUSES.map((s) => <option key={s} value={s}>{statusLabelOf(s)}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* 퀵필터(상태/위험도/별점)는 URL 보존 — 폼 제출 시 hidden 동반 전송 (아카이브 모드는 셀렉트가 담당) */}
        {!archiveMode && params.status && <input type="hidden" name="status" value={params.status} />}
        {params.risk   && <input type="hidden" name="risk" value={params.risk} />}
        {!archiveMode && params.rating && <input type="hidden" name="rating" value={params.rating} />}
        <div className="flex gap-2 mt-3">
          <button type="submit"
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
            {t.rv_apply}
          </button>
          <Link href={archiveMode ? '/archive' : '/reviews'}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {t.rv_filter_reset}
          </Link>
        </div>
      </form>

      {/* ── 통계 요약 (필터 전체 집합 기준) ──────────────────────────────────── */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {(params.date_from || params.date_to) && (
            <div className="flex items-center gap-1 text-xs text-gray-500 border-r border-gray-200 pr-6">
              <span>📅</span><span>{params.date_from ?? '—'} ~ {params.date_to ?? '—'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{t.rv_total_word}</span>
            <span className="text-base font-bold text-gray-900">{total}{t.stat_unit}</span>
          </div>
          {avgRating !== null && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
              <span className="text-xs text-gray-500">{t.stat_avg_rating}</span>
              <span className={`text-base font-bold ${avgRating >= 4.5 ? 'text-green-600' : avgRating >= 3.5 ? 'text-yellow-500' : 'text-red-500'}`}>★ {avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">/ 5.0</span>
            </div>
          )}
          {ratingsLen > 0 && (
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              {ratingDist.filter((d) => d.count > 0).map(({ star, count }) => (
                <div key={star} className="flex items-center gap-1">
                  <span className="text-xs text-yellow-500 font-medium">{star}★</span>
                  <span className="text-xs font-semibold text-gray-700">{count}</span>
                  <span className="text-xs text-gray-400">({Math.round((count / ratingsLen) * 100)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

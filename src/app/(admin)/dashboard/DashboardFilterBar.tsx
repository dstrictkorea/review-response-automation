'use client'

/**
 * DashboardFilterBar — branch × channel badge-toggle filter.
 *
 * Receives branch/channel lists + current active values as props (resolved
 * server-side) so no useSearchParams() is needed — avoids Suspense wrapper.
 * Uses useRouter().push() to update the URL, triggering a server re-render
 * that applies the Supabase filter and resets pending_page to 1.
 *
 * Language: wired to LanguageContext — all labels translate in real time.
 */

import { useRouter } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'

export interface Branch {
  code: string
  name_ko: string
  name_en: string
}

export interface Channel {
  code: string
  name: string
}

interface Props {
  branches: Branch[]
  channels: Channel[]
  currentBranch: string   // '' = all
  currentChannel: string  // '' = all
}

// Short location name extracted from the branch name
function shortBranchName(b: Branch, lang: string): string {
  if (lang === 'ko') return b.name_ko.replace('아르떼뮤지엄 ', '')
  return b.name_en.replace('ARTE Museum ', '')
}

export default function DashboardFilterBar({
  branches,
  channels,
  currentBranch,
  currentChannel,
}: Props) {
  const router = useRouter()
  const { lang, t } = useLanguage()

  const hasFilter = !!(currentBranch || currentChannel)

  // Build the /dashboard URL preserving active filters; pending_page always resets to 1
  function buildUrl(newBranch: string, newChannel: string): string {
    const params = new URLSearchParams()
    if (newBranch)  params.set('branch',  newBranch)
    if (newChannel) params.set('channel', newChannel)
    const qs = params.toString()
    return qs ? `/dashboard?${qs}` : '/dashboard'
  }

  function setBranch(code: string) {
    // Toggle off if already active
    router.push(buildUrl(currentBranch === code ? '' : code, currentChannel))
  }

  function setChannel(code: string) {
    router.push(buildUrl(currentBranch, currentChannel === code ? '' : code))
  }

  function reset() {
    router.push('/dashboard')
  }

  // Translate known channel codes; fall back to the DB name field
  function channelLabel(code: string, dbName: string): string {
    if (code === 'google') return t.filter_channel_google
    if (code === 'manual') return t.filter_channel_manual
    return dbName
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4 space-y-2.5">
      {/* ── Branch row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500 w-10 shrink-0">
          {t.filter_branch_label}
        </span>

        {/* All */}
        <button
          onClick={() => setBranch('')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
            !currentBranch
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t.filter_all}
        </button>

        {/* Individual branches */}
        {branches.map((b) => (
          <button
            key={b.code}
            onClick={() => setBranch(b.code)}
            title={lang === 'ko' ? b.name_ko : b.name_en}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all max-w-[140px] truncate ${
              currentBranch === b.code
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {shortBranchName(b, lang)}
          </button>
        ))}
      </div>

      {/* ── Channel row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500 w-10 shrink-0">
          {t.filter_channel_label}
        </span>

        {/* All */}
        <button
          onClick={() => setChannel('')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
            !currentChannel
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t.filter_all}
        </button>

        {/* Individual channels */}
        {channels.map((c) => (
          <button
            key={c.code}
            onClick={() => setChannel(c.code)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              currentChannel === c.code
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.code === 'google' && (
              <span className="mr-1" aria-hidden="true">🔵</span>
            )}
            {channelLabel(c.code, c.name)}
          </button>
        ))}

        {/* Reset — shown only when any filter is active */}
        {hasFilter && (
          <button
            onClick={reset}
            className="ml-auto rounded-full px-3 py-1 text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            ✕ {t.filter_reset}
          </button>
        )}
      </div>

      {/* ── Active filter summary chip ───────────────────────────────────────── */}
      {hasFilter && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 border-t border-gray-100">
          <span className="text-xs text-gray-400">📍 {t.filter_active_label}:</span>
          {currentBranch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {t.filter_branch_label}:{' '}
              {(() => {
                const b = branches.find((x) => x.code === currentBranch)
                return b ? shortBranchName(b, lang) : currentBranch
              })()}
              <button
                onClick={() => router.push(buildUrl('', currentChannel))}
                className="ml-0.5 text-blue-400 hover:text-blue-700"
                aria-label="Remove branch filter"
              >
                ×
              </button>
            </span>
          )}
          {currentChannel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {t.filter_channel_label}:{' '}
              {channelLabel(
                currentChannel,
                channels.find((c) => c.code === currentChannel)?.name ?? currentChannel,
              )}
              <button
                onClick={() => router.push(buildUrl(currentBranch, ''))}
                className="ml-0.5 text-blue-400 hover:text-blue-700"
                aria-label="Remove channel filter"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

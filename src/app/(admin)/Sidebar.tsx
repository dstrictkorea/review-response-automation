'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/context/LanguageContext'
import type { Language } from '@/lib/i18n'
import { LANG_LABELS } from '@/lib/i18n'

const LANGUAGES: Language[] = ['ko', 'en', 'ja', 'zh']

export default function Sidebar({
  userEmail,
  displayName,
  isAdmin,
}: {
  userEmail: string
  displayName: string | null
  isAdmin: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLanguage()

  const mainNav = [
    { href: '/dashboard', label: t.nav_dashboard },
    { href: '/reviews', label: t.nav_reviews },
    { href: '/reviews/import', label: t.nav_import },
    { href: '/reviews/register', label: t.nav_register },
    { href: '/archive', label: t.nav_archive },
  ]

  const settingsNav = [
    { href: '/settings', label: t.nav_settings },
    { href: '/settings/google', label: t.nav_google },
    { href: '/settings/users', label: t.nav_users, adminOnly: true },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/reviews') {
      return (
        pathname === '/reviews' ||
        (pathname.startsWith('/reviews/') &&
          pathname !== '/reviews/register' &&
          pathname !== '/reviews/import')
      )
    }
    if (href === '/settings') {
      return pathname === '/settings'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const visibleSettings = settingsNav.filter(i => !i.adminOnly || isAdmin)

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-10">
      <Link
        href="/dashboard"
        className="px-5 py-5 border-b border-gray-200 block hover:bg-gray-50 transition-colors"
      >
        <h1 className="text-base font-bold text-gray-900 leading-tight">ARTE Review Desk</h1>
        <p className="text-xs text-gray-500 mt-0.5">아르떼뮤지엄 리뷰 관리</p>
      </Link>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1 mb-4">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors truncate ${
                isActive(item.href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {visibleSettings.length > 0 && (
          <div>
            <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {t.nav_admin_section}
            </p>
            <div className="space-y-1">
              {visibleSettings.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors truncate ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                  {item.adminOnly && (
                    <span className="ml-1.5 text-xs text-blue-400">{t.nav_admin_badge}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── 언어 선택 ─────────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-gray-200">
        <div className="flex gap-1 flex-wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 min-w-0 rounded-md px-1.5 py-1 text-xs font-medium transition-colors truncate ${
                lang === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* ── 사용자 정보 + 로그아웃 ──────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="px-3 mb-2">
          {displayName && <p className="text-xs font-semibold text-gray-700 truncate">{displayName}</p>}
          <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          {isAdmin && <p className="text-xs text-blue-500 mt-0.5">{t.nav_admin_badge}</p>}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-left transition-colors"
        >
          {t.nav_signout}
        </button>
      </div>
    </aside>
  )
}

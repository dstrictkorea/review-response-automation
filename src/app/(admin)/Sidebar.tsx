'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const mainNav = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/reviews', label: '리뷰 목록' },
  { href: '/reviews/import', label: '리뷰 가져오기' },
  { href: '/reviews/register', label: '1건 수동 입력' },
  { href: '/archive', label: '아카이브' },
]

const settingsNav = [
  { href: '/settings', label: '설정' },
  { href: '/settings/google', label: 'Google 연동' },
  { href: '/settings/users', label: '사용자 관리', adminOnly: true },
]

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
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
            <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">관리</p>
            <div className="space-y-1">
              {visibleSettings.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                  {item.adminOnly && (
                    <span className="ml-1.5 text-xs text-blue-400">관리자</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <div className="px-3 mb-2">
          {displayName && <p className="text-xs font-semibold text-gray-700">{displayName}</p>}
          <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          {isAdmin && <p className="text-xs text-blue-500 mt-0.5">관리자</p>}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-left transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/reviews', label: '리뷰 목록' },
  { href: '/reviews/register', label: '리뷰 등록' },
  { href: '/archive', label: '아카이브' },
  { href: '/settings', label: '설정' },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-10">
      <div className="px-5 py-5 border-b border-gray-200">
        <h1 className="text-base font-bold text-gray-900 leading-tight">ARTE Review Desk</h1>
        <p className="text-xs text-gray-500 mt-0.5">아르떼뮤지엄 리뷰 관리</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/reviews'
              ? pathname === '/reviews' || (pathname.startsWith('/reviews/') && pathname !== '/reviews/register')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 px-3 mb-2 truncate">{userEmail}</p>
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

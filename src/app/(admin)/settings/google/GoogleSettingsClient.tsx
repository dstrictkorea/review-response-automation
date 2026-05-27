'use client'

import { useState, useTransition } from 'react'
import { updateGoogleBranchAction, disconnectGoogleAction, syncGoogleReviewsAction } from './actions'

interface GoogleAccount {
  id: string
  google_location_title: string | null
  google_account_name: string
  google_location_name: string
  branch_code: string | null
  last_synced_at: string | null
  connected_by: string | null
  connected_at: string
}

interface Branch {
  code: string
  name_ko: string
}

export default function GoogleSettingsClient({
  accounts,
  branches,
  justConnected,
  connectError,
}: {
  accounts: GoogleAccount[]
  branches: Branch[]
  justConnected: boolean
  connectError?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(
    justConnected ? { text: 'Google 계정이 연결됐습니다.', ok: true } : null
  )

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  function handleBranchChange(accountId: string, branchCode: string) {
    startTransition(async () => {
      const res = await updateGoogleBranchAction(accountId, branchCode)
      if (res.error) flash(res.error, false)
      else flash('지점이 설정됐습니다.')
    })
  }

  function handleSync(accountId: string) {
    startTransition(async () => {
      const res = await syncGoogleReviewsAction(accountId)
      if (res.error) flash(res.error, false)
      else flash(`리뷰 ${(res as any).imported}건 가져왔습니다.`)
    })
  }

  function handleDisconnect(accountId: string, title: string) {
    if (!confirm(`"${title}" 연결을 해제하시겠습니까?`)) return
    startTransition(async () => {
      const res = await disconnectGoogleAction(accountId)
      if (res.error) flash(res.error, false)
      else flash('연결이 해제됐습니다.')
    })
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Google Business Profile 연동</h2>
          <p className="text-sm text-gray-600 mt-1">Google 리뷰를 자동으로 가져오고 답변을 게시합니다.</p>
        </div>
        <a
          href="/api/auth/google"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Google 계정 연결
        </a>
      </div>

      {connectError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          연결 실패: {decodeURIComponent(connectError)}
        </div>
      )}
      {msg && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-gray-700 font-medium mb-1">연결된 Google 계정이 없습니다</p>
          <p className="text-sm text-gray-500 mb-4">Google Business Profile과 연결하면 리뷰를 자동으로 가져올 수 있습니다.</p>
          <a
            href="/api/auth/google"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Google 계정 연결하기
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acct) => (
            <div key={acct.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {acct.google_location_title ?? acct.google_location_name}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">Google</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{acct.google_location_name}</p>
                  {acct.last_synced_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      마지막 동기화: {new Date(acct.last_synced_at).toLocaleString('ko-KR')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">연결: {acct.connected_by} ({new Date(acct.connected_at).toLocaleDateString('ko-KR')})</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={acct.branch_code ?? ''}
                    disabled={isPending}
                    onChange={e => handleBranchChange(acct.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">지점 선택</option>
                    {branches.map(b => (
                      <option key={b.code} value={b.code}>{b.name_ko}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleSync(acct.id)}
                    disabled={isPending || !acct.branch_code}
                    title={!acct.branch_code ? '지점을 먼저 선택하세요' : '리뷰 동기화'}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending ? '동기화 중…' : '동기화'}
                  </button>

                  <button
                    onClick={() => handleDisconnect(acct.id, acct.google_location_title ?? acct.google_location_name)}
                    disabled={isPending}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    연결 해제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-xs text-yellow-800 space-y-1">
        <p className="font-semibold">⚠️ Google Business Profile API 접근 권한 필요</p>
        <p>리뷰 동기화 및 답변 게시를 위해 Google에 API 접근 신청이 필요할 수 있습니다.</p>
        <p>
          신청:{' '}
          <a href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noopener noreferrer" className="underline">
            developers.google.com/my-business/content/prereqs
          </a>
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { updateGoogleBranchAction, disconnectGoogleAction, syncGoogleReviewsAction, updateGoogleLocationAction } from './actions'

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
    justConnected ? { text: 'Google 계정이 연결됐습니다. 아래에서 location 이름을 설정해주세요.', ok: true } : null
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [locationInput, setLocationInput] = useState('')
  const [titleInput, setTitleInput] = useState('')

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 5000)
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
      flash('동기화 중...', true)
      const res = await syncGoogleReviewsAction(accountId)
      if (res.error) flash(res.error, false)
      else flash(`리뷰 ${(res as { imported?: number }).imported ?? 0}건 가져왔습니다.`)
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

  function handleSaveLocation(accountId: string) {
    if (!locationInput.trim()) return
    startTransition(async () => {
      const res = await updateGoogleLocationAction(accountId, locationInput.trim(), titleInput.trim())
      if (res.error) flash(res.error, false)
      else {
        flash('Location이 저장됐습니다.')
        setEditingId(null)
        setLocationInput('')
        setTitleInput('')
      }
    })
  }

  const isPending_ = (acct: GoogleAccount) =>
    acct.google_location_name.startsWith('pending_')

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Google Business Profile 연동</h2>
          <p className="text-sm text-gray-600 mt-1">Google 리뷰를 가져오고 답변을 게시합니다.</p>
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

      {/* Location ID 찾는 방법 안내 */}
      <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">📍 Google Business Location 이름 찾는 방법</p>
        <p>1. <a href="https://business.google.com" target="_blank" rel="noopener" className="underline">business.google.com</a> 접속 → 관리할 지점 선택</p>
        <p>2. URL에서 확인: <code className="bg-blue-100 px-1 rounded">business.google.com/dashboard/l/<strong>숫자</strong></code></p>
        <p>3. Location 이름 형식: <code className="bg-blue-100 px-1 rounded">accounts/계정ID/locations/위치ID</code></p>
        <p className="text-blue-600">예시: <code className="bg-blue-100 px-1 rounded">accounts/123456789/locations/987654321</code></p>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-gray-700 font-medium mb-1">연결된 Google 계정이 없습니다</p>
          <a href="/api/auth/google" className="inline-block mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Google 계정 연결하기
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acct) => (
            <div key={acct.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {acct.google_location_title ?? '(미설정)'}
                    </span>
                    {isPending_(acct) && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5">Location 미설정</span>
                    )}
                  </div>
                  {!isPending_(acct) && (
                    <p className="text-xs text-gray-400 truncate font-mono">{acct.google_location_name}</p>
                  )}
                  {acct.last_synced_at && (
                    <p className="text-xs text-gray-400 mt-1">마지막 동기화: {new Date(acct.last_synced_at).toLocaleString('ko-KR')}</p>
                  )}
                  <p className="text-xs text-gray-400">연결: {acct.connected_by} · {new Date(acct.connected_at).toLocaleDateString('ko-KR')}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={acct.branch_code ?? ''}
                    disabled={isPending}
                    onChange={e => handleBranchChange(acct.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">지점 선택</option>
                    {branches.map(b => <option key={b.code} value={b.code}>{b.name_ko}</option>)}
                  </select>

                  <button
                    onClick={() => { setEditingId(acct.id); setLocationInput(isPending_(acct) ? '' : acct.google_location_name); setTitleInput(acct.google_location_title ?? '') }}
                    className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    Location 설정
                  </button>

                  <button
                    onClick={() => handleSync(acct.id)}
                    disabled={isPending || !acct.branch_code || isPending_(acct)}
                    title={!acct.branch_code ? '지점을 먼저 선택하세요' : isPending_(acct) ? 'Location을 먼저 설정하세요' : '리뷰 동기화'}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    동기화
                  </button>

                  <button
                    onClick={() => handleDisconnect(acct.id, acct.google_location_title ?? acct.google_location_name)}
                    disabled={isPending}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    해제
                  </button>
                </div>
              </div>

              {/* Location 설정 폼 */}
              {editingId === acct.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Location 이름 (필수)</label>
                    <input
                      type="text"
                      value={locationInput}
                      onChange={e => setLocationInput(e.target.value)}
                      placeholder="accounts/123456789/locations/987654321"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">business.google.com 대시보드 URL에서 확인하세요.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">표시 이름 (선택)</label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={e => setTitleInput(e.target.value)}
                      placeholder="아르떼뮤지엄 부산"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveLocation(acct.id)}
                      disabled={isPending || !locationInput.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

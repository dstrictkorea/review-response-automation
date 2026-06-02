'use client'

import { useState, useTransition } from 'react'
import {
  createUserAction,
  updateUserRoleAction,
  updateAssignedBranchesAction,
  toggleUserActiveAction,
  resetPasswordAction,
  deleteUserAction,
} from './actions'
import { classifyBranch } from '@/lib/branches'

export interface UserRow {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'staff'
  is_active: boolean
  assigned_branches: string[]
  created_at: string
}

interface BranchRow { code: string; name_ko: string; country_code: string | null }

const roleClasses: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700',
  staff: 'bg-gray-100 text-gray-700',
}

export default function UsersClient({
  users,
  currentUserId,
  branches,
}: {
  users: UserRow[]
  currentUserId: string
  branches: BranchRow[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [branchTarget, setBranchTarget] = useState<UserRow | null>(null)
  const [branchSel, setBranchSel] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  const domesticBranches = branches.filter((b) => classifyBranch(b.code, b.country_code) === 'domestic')
  const globalBranches   = branches.filter((b) => classifyBranch(b.code, b.country_code) === 'global')

  function openBranchEditor(u: UserRow) {
    setBranchSel(new Set(u.assigned_branches ?? []))
    setBranchTarget(u)
  }
  function toggleBranch(code: string) {
    setBranchSel((prev) => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n })
  }
  function handleSaveBranches() {
    if (!branchTarget) return
    startTransition(async () => {
      const res = await updateAssignedBranchesAction(branchTarget.id, [...branchSel])
      if (res.error) { flash(res.error, true); return }
      flash('담당 지점이 저장되었습니다.')
      setBranchTarget(null)
    })
  }

  // New user form state
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'staff' as 'admin' | 'staff' })
  // Password reset state
  const [newPw, setNewPw] = useState('')

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 3000)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createUserAction(form)
      if (res.error) { flash(res.error, true); return }
      flash('계정이 생성되었습니다.')
      setForm({ email: '', password: '', displayName: '', role: 'staff' })
      setShowForm(false)
    })
  }

  function handleRoleChange(userId: string, role: 'admin' | 'staff') {
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, role)
      if (res.error) flash(res.error, true)
      else flash('역할이 변경되었습니다.')
    })
  }

  function handleToggleActive(userId: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleUserActiveAction(userId, !current)
      if (res.error) flash(res.error, true)
      else flash(!current ? '계정이 활성화되었습니다.' : '계정이 비활성화되었습니다.')
    })
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    startTransition(async () => {
      const res = await resetPasswordAction(resetTarget.id, newPw)
      if (res.error) { flash(res.error, true); return }
      flash('비밀번호가 변경되었습니다.')
      setResetTarget(null)
      setNewPw('')
    })
  }

  function handleDelete(user: UserRow) {
    if (!confirm(`"${user.email}" 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    startTransition(async () => {
      const res = await deleteUserAction(user.id)
      if (res.error) flash(res.error, true)
      else flash('계정이 삭제되었습니다.')
    })
  }

  return (
    <div>
      {/* Toast */}
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">사용자 관리</h2>
          <p className="text-sm text-gray-600 mt-1">직원 계정 및 권한을 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + 계정 추가
        </button>
      </div>

      {/* New user form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-blue-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">새 계정 추가</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">이메일 *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="staff@artecorp.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">비밀번호 * (6자 이상)</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">표시 이름</label>
              <input
                type="text"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="홍길동"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">역할</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'staff' }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="staff">일반 (staff)</option>
                <option value="admin">관리자 (admin)</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? '생성 중...' : '계정 생성'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password reset modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">비밀번호 재설정</h3>
            <p className="text-xs text-gray-500 mb-4">{resetTarget.email}</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="password"
                required
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setResetTarget(null); setNewPw('') }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 담당 지점 할당 모달 */}
      {branchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setBranchTarget(null) }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">담당 지점 할당</h3>
            <p className="text-xs text-gray-500 mb-4">{branchTarget.email} — 선택한 지점의 리뷰만 접근할 수 있습니다.</p>

            <div className="space-y-3">
              {domesticBranches.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">🇰🇷 국내 지점</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {domesticBranches.map((b) => (
                      <label key={b.code} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={branchSel.has(b.code)} onChange={() => toggleBranch(b.code)} className="rounded border-gray-300" />
                        <span className="font-mono font-bold">{b.code}</span>
                        <span className="text-gray-500 truncate">{b.name_ko.replace('아르떼뮤지엄 ', '')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {globalBranches.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">🌐 글로벌 지점</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {globalBranches.map((b) => (
                      <label key={b.code} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={branchSel.has(b.code)} onChange={() => toggleBranch(b.code)} className="rounded border-gray-300" />
                        <span className="font-mono font-bold">{b.code}</span>
                        <span className="text-gray-500 truncate">{b.name_ko.replace('아르떼뮤지엄 ', '')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-5">
              <span className="text-xs text-gray-400">{branchSel.size}개 선택됨</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBranchTarget(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">취소</button>
                <button type="button" onClick={handleSaveBranches} disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이메일</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">역할</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">담당 지점</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상태</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">생성일</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                  등록된 계정이 없습니다.
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {u.email}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-blue-500">(나)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.display_name ?? '-'}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={u.id === currentUserId || isPending}
                    onChange={e => handleRoleChange(u.id, e.target.value as 'admin' | 'staff')}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${roleClasses[u.role]} disabled:cursor-default`}
                  >
                    <option value="admin">관리자</option>
                    <option value="staff">일반</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.role === 'admin' ? (
                    <span className="text-xs text-gray-400">전체 지점</span>
                  ) : (
                    <button
                      onClick={() => openBranchEditor(u)}
                      disabled={isPending}
                      className="text-xs rounded-full border border-gray-300 px-2.5 py-0.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {(u.assigned_branches?.length ?? 0) > 0
                        ? `${u.assigned_branches.length}개 지점 ✎`
                        : '미할당 ✎'}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResetTarget(u)}
                      disabled={isPending}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      비밀번호
                    </button>
                    {u.id !== currentUserId && (
                      <>
                        <button
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          disabled={isPending}
                          className="text-xs text-orange-600 hover:underline disabled:opacity-50"
                        >
                          {u.is_active ? '비활성화' : '활성화'}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role guide */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
        <p><span className={`inline-block rounded-full px-2 py-0.5 font-medium mr-2 ${roleClasses.admin}`}>관리자</span>사용자 관리, 모든 설정 변경 가능</p>
        <p><span className={`inline-block rounded-full px-2 py-0.5 font-medium mr-2 ${roleClasses.staff}`}>일반</span>리뷰 조회, AI 초안 생성, 응대 승인 가능</p>
      </div>
    </div>
  )
}

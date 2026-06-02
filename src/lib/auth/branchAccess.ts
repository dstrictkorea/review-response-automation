/**
 * branchAccess.ts — 앱 레이어 지점 접근 제어 (Wave 15)
 *
 * SSR/API 라우트가 Service Role Key(admin 클라이언트)로 RLS를 우회할 때,
 * 권한 밖 지점 데이터에 접근하지 못하도록 앱 레이어에서 강제하는 가드.
 *
 * - admin: 전체 접근 (isAdmin=true, 제한 없음)
 * - staff: assigned_branches 한정 (빈 배열이면 접근 가능 지점 없음 = fail-closed)
 *
 * RLS(009 STEP B)가 적용되면 DB 레벨에서도 이중 방어된다.
 */

import { createClient } from '@/lib/supabase/server'

export interface BranchAccess {
  userId: string
  email: string | null
  role: string
  isAdmin: boolean
  branches: string[]   // staff의 담당 지점 (admin은 무시)
}

/** 현재 세션 사용자의 지점 접근 권한을 조회. 비로그인 시 null. */
export async function getBranchAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<BranchAccess | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: p } = await supabase
    .from('profiles')
    .select('role, assigned_branches')
    .eq('id', user.id)
    .maybeSingle()

  const role = (p?.role as string) ?? 'staff'
  return {
    userId:   user.id,
    email:    user.email ?? null,
    role,
    isAdmin:  role === 'admin',
    branches: (p?.assigned_branches as string[] | null) ?? [],
  }
}

/** 특정 지점에 접근 가능한가 (admin 또는 담당 지점) */
export function canAccessBranch(access: BranchAccess, branchCode: string): boolean {
  return access.isAdmin || access.branches.includes(branchCode)
}

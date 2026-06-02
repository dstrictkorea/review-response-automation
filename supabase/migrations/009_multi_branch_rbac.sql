-- ============================================================
-- Migration 009: Multi-Branch Access Control (RBAC + RLS)
-- Wave 14 — 2026-06-01
-- ============================================================
-- ⚠️ 보안 임계 마이그레이션 — 라이브 적용 시 명시적 승인 필요 ⚠️
--
-- 이 마이그레이션은 reviews 테이블의 RLS 정책을 '전체 허용(using true)'에서
-- '담당 지점 제한'으로 교체한다. assigned_branches 백필 전에 적용하면
-- 모든 staff 사용자가 리뷰를 보지 못하는 LOCKOUT이 발생할 수 있다.
--
-- 안전 적용 순서:
--   1) STEP A(컬럼 추가)만 먼저 적용 — 안전(additive).
--   2) 관리자 UI에서 각 staff에게 assigned_branches 할당 (백필).
--   3) admin 계정의 role='admin' 확인.
--   4) 그 후에만 STEP B(RLS 정책 교체) 적용.
-- ============================================================

-- ── STEP A: profiles 컬럼 (additive, 안전) ───────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_branches text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.role             IS 'admin = 전체 접근, staff = assigned_branches 한정';
COMMENT ON COLUMN profiles.assigned_branches IS '담당 지점 코드 배열 (예: {AMNY,AMLV}). admin은 무시됨';

-- 현재 role 컬럼이 'admin'|'staff' 외 값을 가질 수 있으므로 체크 제약은 강제하지 않음.

-- ════════════════════════════════════════════════════════════════════════════
-- ⚠️ STEP B 이하는 백필 완료 후에만 적용할 것 (라이브 LOCKOUT 위험) ⚠️
-- ════════════════════════════════════════════════════════════════════════════

-- helper: 현재 사용자가 admin 인가
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
$$;

-- helper: 현재 사용자가 해당 지점에 접근 가능한가 (admin 또는 담당 지점)
CREATE OR REPLACE FUNCTION can_access_branch(p_branch_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p_branch_code = ANY(p.assigned_branches))
  )
$$;

-- reviews RLS 교체 (전체 허용 → 담당 지점 제한)
DROP POLICY IF EXISTS "authenticated_read_reviews"  ON reviews;
DROP POLICY IF EXISTS "authenticated_write_reviews" ON reviews;

CREATE POLICY "rbac_read_reviews" ON reviews
  FOR SELECT TO authenticated
  USING ( can_access_branch(branch_code) );

CREATE POLICY "rbac_write_reviews" ON reviews
  FOR ALL TO authenticated
  USING ( can_access_branch(branch_code) )
  WITH CHECK ( can_access_branch(branch_code) );

-- reply_drafts / activity_logs 도 review의 지점에 종속되도록 제한
DROP POLICY IF EXISTS "authenticated_read_drafts"  ON reply_drafts;
DROP POLICY IF EXISTS "authenticated_write_drafts" ON reply_drafts;

CREATE POLICY "rbac_read_drafts" ON reply_drafts
  FOR SELECT TO authenticated
  USING ( EXISTS (SELECT 1 FROM reviews r WHERE r.id = reply_drafts.review_id AND can_access_branch(r.branch_code)) );

CREATE POLICY "rbac_write_drafts" ON reply_drafts
  FOR ALL TO authenticated
  USING ( EXISTS (SELECT 1 FROM reviews r WHERE r.id = reply_drafts.review_id AND can_access_branch(r.branch_code)) )
  WITH CHECK ( EXISTS (SELECT 1 FROM reviews r WHERE r.id = reply_drafts.review_id AND can_access_branch(r.branch_code)) );

-- ============================================================================
-- ⛔ GATED — DO NOT AUTO-APPLY ⛔   RBAC RLS STEP B (담당 지점 제한)
-- ============================================================================
-- 이 파일은 supabase/migrations/ 가 아닌 supabase/gated/ 에 위치하므로
-- `supabase db push` 자동 마이그레이션에 포함되지 않는다 (의도적 격리).
--
-- 적용 시 reviews/reply_drafts RLS가 '전체 허용(using true)'에서
-- '담당 지점 제한'으로 교체된다. 백필 미완료 상태에서 적용하면
-- 모든 staff 사용자가 LOCKOUT 된다.
--
-- ─ 락 해제(적용) 선결 조건 (반드시 100% 완료 후) ─────────────────────────────
--   1. 009_multi_branch_rbac.sql(STEP A) 적용 완료 (profiles 컬럼 존재).
--   2. 관리자 UI(/settings/users)에서 모든 staff에게 assigned_branches 백필 완료.
--   3. 운영 admin 계정의 profiles.role = 'admin' 검증 완료.
--   4. 명시적 "RLS 락 해제" 승인 수령.
--
-- 검증 쿼리 (적용 전 실행 권장):
--   select role, count(*),
--          count(*) filter (where coalesce(array_length(assigned_branches,1),0)=0) as unassigned
--     from profiles group by role;
--   → role='staff' 의 unassigned 가 0 이어야 안전 (전원 백필 완료).
-- ============================================================================

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

-- reply_drafts 도 review의 지점에 종속되도록 제한
DROP POLICY IF EXISTS "authenticated_read_drafts"  ON reply_drafts;
DROP POLICY IF EXISTS "authenticated_write_drafts" ON reply_drafts;

CREATE POLICY "rbac_read_drafts" ON reply_drafts
  FOR SELECT TO authenticated
  USING ( EXISTS (SELECT 1 FROM reviews r WHERE r.id = reply_drafts.review_id AND can_access_branch(r.branch_code)) );

CREATE POLICY "rbac_write_drafts" ON reply_drafts
  FOR ALL TO authenticated
  USING ( EXISTS (SELECT 1 FROM reviews r WHERE r.id = reply_drafts.review_id AND can_access_branch(r.branch_code)) )
  WITH CHECK ( EXISTS (SELECT 1 FROM reviews r WHERE r.id = reply_drafts.review_id AND can_access_branch(r.branch_code)) );

-- ── 비상 롤백 (lockout 발생 시 즉시 실행) ──────────────────────────────────────
-- DROP POLICY IF EXISTS "rbac_read_reviews"  ON reviews;
-- DROP POLICY IF EXISTS "rbac_write_reviews" ON reviews;
-- DROP POLICY IF EXISTS "rbac_read_drafts"   ON reply_drafts;
-- DROP POLICY IF EXISTS "rbac_write_drafts"  ON reply_drafts;
-- CREATE POLICY "authenticated_read_reviews"  ON reviews      FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "authenticated_write_reviews" ON reviews      FOR ALL    TO authenticated USING (true);
-- CREATE POLICY "authenticated_read_drafts"   ON reply_drafts FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "authenticated_write_drafts"  ON reply_drafts FOR ALL    TO authenticated USING (true);

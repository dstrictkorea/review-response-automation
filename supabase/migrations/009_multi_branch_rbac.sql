-- ============================================================
-- Migration 009: Multi-Branch RBAC — STEP A only (안전/additive)
-- Wave 14/15 — 2026-06-01
-- ============================================================
-- 이 마이그레이션은 profiles 컬럼 추가(additive)만 포함한다.
--
-- ⚠️ RLS 정책 교체(STEP B)는 이 파일에서 의도적으로 제외되었다. ⚠️
--    백필 미완료 상태에서 RLS를 적용하면 전 세계 지사 staff가 lockout 된다.
--    STEP B DDL은 supabase/gated/rbac_rls_step_b.sql 에 보관되어 있으며,
--    자동 마이그레이션 파이프라인(supabase db push)에 포함되지 않는다.
--
-- 단계적 배포(무결성) 파이프라인:
--    1) 본 STEP A 적용 (컬럼 추가)            ← 안전
--    2) 관리자 UI에서 각 staff assigned_branches 백필 (100%)
--    3) admin 권한 격리 검증
--    4) 위 1~3 완료 + 명시적 "RLS 락 해제" 승인 후에만 STEP B 적용
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_branches text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.role             IS 'admin = 전체 접근, staff = assigned_branches 한정';
COMMENT ON COLUMN profiles.assigned_branches IS '담당 지점 코드 배열 (예: {AMNY,AMLV}). admin은 무시됨';

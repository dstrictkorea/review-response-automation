-- ============================================================
-- Migration 016: assigned_branches Backfill — RLS STEP B 선결 조건
-- 2026-06-09
-- ============================================================
-- 목적: profiles.assigned_branches = '{}' (빈 배열)인 모든 레코드를 백필하여
--       RLS STEP B(rbac_rls_step_b.sql) 적용 전 100% 채움 보장.
--
-- 규칙:
--   - role = 'admin'  → 전 지점 배열 {AMLV,AMGN,AMDB,AMNY,AMBS,AMJJ,AMYS}
--   - role = 'staff' (또는 기타) → 기본 지점 {AMLV} (관리자가 이후 UI로 조정)
--
-- ⚠️ 이 마이그레이션 실행 후 반드시 아래 검증 쿼리로 빈 배열 잔존 여부 확인할 것:
--   SELECT id, role, assigned_branches
--   FROM profiles
--   WHERE array_length(assigned_branches, 1) IS NULL OR array_length(assigned_branches, 1) = 0;
--
-- ⚠️ RLS STEP B는 아직 적용하지 말 것. 명시적 "RLS 락 해제" 승인 후에만 적용.
-- ============================================================

BEGIN;

-- ── Step 1: admin 역할 — 모든 등록 지점 배정 ─────────────────────────────────────
-- admin은 RLS에서 assigned_branches 무시됨(전체 접근)이지만,
-- 백필 완료 조건 충족 + 감사 추적을 위해 전 지점으로 설정.
UPDATE public.profiles
SET assigned_branches = ARRAY['AMLV', 'AMGN', 'AMDB', 'AMNY', 'AMBS', 'AMJJ', 'AMYS']
WHERE role = 'admin'
  AND (array_length(assigned_branches, 1) IS NULL OR array_length(assigned_branches, 1) = 0);

-- ── Step 2: staff(및 기타) 역할 — 기본 지점 AMLV 배정 ──────────────────────────
-- 실제 소속 지점은 관리자가 대시보드 UI(/settings/staff 또는 유사 경로)에서 수동 확인 후 교정.
-- AMLV(Las Vegas)를 폴백으로 사용: 시스템 내 지점 중 가장 먼저 등록된 기준 지점.
UPDATE public.profiles
SET assigned_branches = ARRAY['AMLV']
WHERE (role IS NULL OR role != 'admin')
  AND (array_length(assigned_branches, 1) IS NULL OR array_length(assigned_branches, 1) = 0);

-- ── Step 3: 방어적 후처리 — 위 두 UPDATE 후에도 비어 있는 레코드 최종 처리 ──────────
-- (role 컬럼이 예기치 않게 NULL인 경우 등)
UPDATE public.profiles
SET assigned_branches = ARRAY['AMLV']
WHERE array_length(assigned_branches, 1) IS NULL;

-- ── Step 4: 마이그레이션 완료 로그 ─────────────────────────────────────────────
-- (Supabase migration 로그에 기록되도록 DO 블록 사용)
DO $$
DECLARE
  empty_count integer;
BEGIN
  SELECT COUNT(*) INTO empty_count
  FROM public.profiles
  WHERE array_length(assigned_branches, 1) IS NULL OR array_length(assigned_branches, 1) = 0;

  IF empty_count > 0 THEN
    RAISE WARNING 'Migration 016: % profile(s) still have empty assigned_branches after backfill. Manual review required.', empty_count;
  ELSE
    RAISE NOTICE 'Migration 016: assigned_branches backfill complete. All profiles have >= 1 branch. RLS STEP B precondition met.';
  END IF;
END;
$$;

COMMIT;

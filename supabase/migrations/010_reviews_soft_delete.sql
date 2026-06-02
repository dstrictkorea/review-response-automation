-- ============================================================
-- Migration 010: Reviews Soft Delete
-- Wave 14 — 2026-06-01
-- ============================================================
-- 물리적 Hard Delete(감사/컴플레인 추적 리스크)를 Soft Delete로 전환.
-- deleted_at IS NULL 인 행만 일반 뷰에 노출. 90일 경과분만 별도 정책으로 영구 파기 가능.
-- ============================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN reviews.deleted_at IS
  'Soft delete 타임스탬프. NULL = 활성. 값 존재 = 삭제됨(목록/대시보드/아카이브에서 숨김). '
  '감사 추적을 위해 reply_drafts/activity_logs는 보존된다.';

-- 활성 리뷰 조회 가속 (deleted_at NULL 부분 인덱스)
CREATE INDEX IF NOT EXISTS reviews_active_idx
  ON reviews (created_at DESC)
  WHERE deleted_at IS NULL;

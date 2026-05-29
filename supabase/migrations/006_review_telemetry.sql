-- ============================================================
-- Migration 006: Review Pipeline Telemetry
-- Wave 11 — 2026-05-29
-- reply_drafts에 인텐트/신뢰도/파이프라인 엔진 텔레메트리 컬럼 추가.
-- update_review_and_save_drafts RPC는 변경하지 않고, Orchestrator/route가
-- RPC 호출 직후 follow-up UPDATE로 채운다 (기존 internal_note_ko 패턴 동일).
-- ============================================================

ALTER TABLE reply_drafts
  ADD COLUMN IF NOT EXISTS intent_code      text  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intent_confidence float DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pipeline_engine   text  DEFAULT NULL;  -- 'template' | 'llm'

COMMENT ON COLUMN reply_drafts.intent_code      IS 'Wave 10 pg_trgm 검출 인텐트 코드 (algo 경로) 또는 LLM categories[0]';
COMMENT ON COLUMN reply_drafts.intent_confidence IS 'pg_trgm word_similarity 신뢰도 (0-1). LLM 경로는 NULL';
COMMENT ON COLUMN reply_drafts.pipeline_engine   IS 'template = Algorithm-First 즉시 처리, llm = LLM Fallback';

CREATE INDEX IF NOT EXISTS reply_drafts_pipeline_engine_idx ON reply_drafts(pipeline_engine);

-- ============================================================
-- Migration 004: Global Optimization
-- Wave 6/7 — 2026-05-29
-- ============================================================
-- 1. branches.country_code 컬럼 추가 (하드코딩 BRANCH_TO_COUNTRY 대체)
-- 2. app_settings 초기값 보장 (rating_template_rules)
-- 3. reviews.normalized_hash에 독립 UNIQUE 인덱스 추가
--    (5차원 해시가 branch+channel을 내포하므로 글로벌 유일성 확보)
-- ============================================================

-- ── 1. branches.country_code ──────────────────────────────────────────────────
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT NULL;

COMMENT ON COLUMN branches.country_code IS
  'ISO 3166-1 alpha-2 country code (KR, US, AE, JP, CN, AR …). '
  'Used by aiService.getCulturalProfile() to select tone-of-voice profile. '
  'When set, overrides the BRANCH_TO_COUNTRY hardcoded map.';

-- 기존 지점 코드 → 국가 코드 초기화
UPDATE branches SET country_code = 'US' WHERE code IN ('AMNY', 'AMLV');
UPDATE branches SET country_code = 'AE' WHERE code IN ('AMDB', 'AMDU');
UPDATE branches SET country_code = 'CN' WHERE code IN ('AMSH', 'AMGZ', 'AMCN');
UPDATE branches SET country_code = 'JP' WHERE code IN ('AMTK', 'AMSK', 'AMOK');
UPDATE branches SET country_code = 'KR' WHERE code IN ('AMBS', 'AMJE', 'AMGW', 'AMGO', 'AMYJ', 'AMJJ', 'AMSE');

-- ── 2. app_settings 초기값 보장 ──────────────────────────────────────────────
-- rating_template_rules
INSERT INTO app_settings (key, value, description)
VALUES (
  'rating_template_rules',
  '{"low_star":"high_risk","mid_star":"neutral","high_star":"positive"}'::jsonb,
  '별점 구간별 기본 템플릿 카테고리: low_star(1-2★), mid_star(3★), high_star(4-5★)'
)
ON CONFLICT (key) DO NOTHING;

-- channel_webhooks (빈 오브젝트로 초기화)
INSERT INTO app_settings (key, value, description)
VALUES (
  'channel_webhooks',
  '{}'::jsonb,
  '채널별 아웃바운드 웹훅 URL 맵 { channelCode: url }'
)
ON CONFLICT (key) DO NOTHING;

-- ── 3. normalized_hash 독립 유니크 인덱스 ─────────────────────────────────────
-- 5차원 해시(branch|channel|author|date|text)가 글로벌 유일성을 보장하므로
-- normalized_hash 단독 UNIQUE 제약을 추가한다.
-- 이를 통해 upsert onConflict: 'normalized_hash' 가 단일 컬럼으로 작동 가능해진다.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_normalized_hash_unique
  ON reviews (normalized_hash);

COMMENT ON INDEX reviews_normalized_hash_unique IS
  '5차원 컨텍스트 해시(branch+channel+author+date+text)의 전역 유일성 인덱스. '
  'bulk upsert ON CONFLICT DO NOTHING 에 사용된다.';

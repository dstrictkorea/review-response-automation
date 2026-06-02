-- ============================================================
-- Migration 007: Branches Master Data Seed (Global Operations)
-- Wave 13 — 2026-06-01
-- ============================================================
-- lib/branches.ts(코드 텍소노미 SSOT)와 물리 DB 정합성 일치.
-- 멱등성: code UNIQUE 기준 ON CONFLICT DO UPDATE — 재실행/기존행 충돌 안전.
-- country_code(migration 004 컬럼)를 포함해 국내(KR)/글로벌 그룹 분류와 동기화.
-- ============================================================

-- branches.country_code 컬럼이 없을 수 있는 환경 대비 (004 미적용 안전망)
ALTER TABLE branches ADD COLUMN IF NOT EXISTS country_code varchar(2) DEFAULT NULL;

INSERT INTO branches (code, name_ko, name_en, default_language, country_code, is_active) VALUES
  -- ── 국내 지점 (Domestic / KR) ──────────────────────────────────────────────
  ('AMGN', '아르떼뮤지엄 강릉',     'ARTE Museum Gangneung',   'ko', 'KR', true),
  ('AMYS', '아르떼뮤지엄 여수',     'ARTE Museum Yeosu',       'ko', 'KR', true),
  ('AMBS', '아르떼뮤지엄 부산',     'ARTE Museum Busan',       'ko', 'KR', true),
  ('AMJJ', '아르떼뮤지엄 제주',     'ARTE Museum Jeju',        'ko', 'KR', true),
  ('AKJJ', '아르떼뮤지엄 제주 키즈', 'ARTE Museum Jeju Kids',   'ko', 'KR', true),
  -- ── 글로벌 지점 (Global) ───────────────────────────────────────────────────
  ('AMNY', '아르떼뮤지엄 뉴욕',       'ARTE Museum New York',    'en', 'US', true),
  ('AMLV', '아르떼뮤지엄 라스베이거스', 'ARTE Museum Las Vegas',  'en', 'US', true),
  ('AMLA', '아르떼뮤지엄 로스앤젤레스', 'ARTE Museum Los Angeles', 'en', 'US', true),
  ('AMDB', '아르떼뮤지엄 두바이',     'ARTE Museum Dubai',       'en', 'AE', true),
  ('AMNG', '아르떼뮤지엄 나고야',     'ARTE Museum Nagoya',      'ja', 'JP', true),
  ('AMKH', '아르떼뮤지엄 가오슝',     'ARTE Museum Kaohsiung',   'zh', 'TW', true)
ON CONFLICT (code) DO UPDATE SET
  name_ko          = EXCLUDED.name_ko,
  name_en          = EXCLUDED.name_en,
  default_language = EXCLUDED.default_language,
  country_code     = EXCLUDED.country_code,
  is_active        = EXCLUDED.is_active;

-- 검증용 주석:
--   국내(country_code='KR'): AMGN, AMYS, AMBS, AMJJ, AKJJ
--   글로벌(그 외):          AMNY, AMLV, AMLA(US), AMDB(AE), AMNG(JP), AMKH(TW)
--   lib/branches.classifyBranch() 와 100% 일치.

-- 015_legacy_purge.sql
-- 레거시 테이블 영구 삭제 + 신규 테이블 RLS 보안 확정
--
-- PHASE 3: bulk-process/re-process/cron 재배선 후 의존성 0% 확인 완료.
--
-- DROP 대상 (pg_trgm 기반 인텐트-분류 파이프라인 — 신규 결정론적 엔진으로 대체):
--   1) reply_template_variants  (FK → review_intents CASCADE)
--   2) intent_keywords           (FK → review_intents CASCADE)
--   3) detect_review_intent()    (RPC — intent_keywords + review_intents 쿼리)
--   4) review_intents            (root 테이블)
--
-- 보안 확정 대상 (신규 테이블):
--   automation_rules, response_templates
--   → authenticated: SELECT only (쓰기 정책 없음 = 기본 DENY)
--   → service_role(createAdminClient): RLS bypass = 관리 API 전용 쓰기
--   → anon: 접근 불가

-- ── STEP 1: 레거시 테이블 + RPC DROP ─────────────────────────────────────────
drop table if exists public.reply_template_variants cascade;
drop table if exists public.intent_keywords cascade;
drop function if exists public.detect_review_intent(text, text, integer);
drop table if exists public.review_intents cascade;

-- ── STEP 2: 신규 테이블 RLS 이중 확인 + 명시적 재선언 ─────────────────────────
-- migration 013에서 이미 적용됨. 본 마이그레이션이 최종 보안 기준선이다.
alter table public.automation_rules   enable row level security;
alter table public.response_templates enable row level security;

drop policy if exists automation_rules_read   on public.automation_rules;
drop policy if exists response_templates_read on public.response_templates;

-- authenticated(로그인된 관리자 앱): 읽기 전용
create policy automation_rules_read
  on public.automation_rules
  for select
  to authenticated
  using (true);

create policy response_templates_read
  on public.response_templates
  for select
  to authenticated
  using (true);

-- 쓰기(INSERT/UPDATE/DELETE) 정책 부재 → authenticated 완전 차단(PostgreSQL 기본값).
-- 쓰기는 오직 service_role(createAdminClient, RLS bypass)만 가능 — 관리 API 전용.
-- 이 주석이 automation_rules/response_templates RLS 설계의 단일 진실 공급원.

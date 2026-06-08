-- 014_engine_precision_amlv.sql
-- 엔진 정밀도 향상 (PHASE 2):
--   1) AMLV 'Strip' 오진단 수정 — DB EMERGENCY(en) 규칙의 비앵커 'trip'(Strip), 'sue'(issue) 등을
--      \b 경계 정규식으로 교체. (엔진 DEFAULT_EMERGENCY 영문부와 동일. compileEmergency가 additive로
--      이 값을 합치므로, DB가 로드돼도 Strip이 다시 EMERGENCY로 오분류되지 않게 한다.)
--   2) 신규 현장 운영 컴플레인 카테고리(LAYOUT/DISPLAY/DURATION/CROWD)를 시드 — 엔진 DEFAULT와 동일 패턴,
--      관리자가 /settings/rules 에서 편집 가능.

update public.automation_rules
set keywords = '{}',
    regex_pattern = '\b(?:hurt|injur\w*|fell|bleed\w*|hospital|paramedic|dizzy|nausea|vomit\w*|puke|seizure|epilepsy|stolen|police|sue|sued|lawyer|attorney|lawsuit|refund\w*|compensat\w*|chargeback)\b|\b911\b|\btrip(?:ped|ping|s)?\b|\b(?:lost|missing)\b',
    notes = 'AMLV Strip 오진단 수정 — 영문 토큰 \b 경계',
    updated_at = now()
where category = 'EMERGENCY' and language = 'en';

insert into public.automation_rules (category, language, keywords, regex_pattern, priority, notes) values
  ('LAYOUT_COMPLAINT','any', '{}', '(?<!안\s)동선[^.!?\n]{0,12}(복잡|불편|엉망|얽|헷갈)|hard\s*to\s*navigate|confusing\s*(layout|flow|path)|maze[-\s]?like', 100, '관람 동선 불만'),
  ('DISPLAY_ISSUE','any', '{}', '(?<!안\s)(영상[^.!?\n]{0,8}(흐릿|흐림|깨)|화질[^.!?\n]{0,6}(별로|구림|나쁨|저하|문제)|디스플레이[^.!?\n]{0,6}(고장|문제))|blurry|out\s*of\s*sync|low\s*resolution|projector[^.!?\n]{0,14}(blurry|broken|off|sync|issue)', 100, '디스플레이/하드웨어 장애'),
  ('DURATION_COMPLAINT','any', '{}', '(?<!안\s)(규모[^.!?\n]{0,6}작|금방\s*끝|너무\s*짧|관람\s*시간[^.!?\n]{0,8}짧)|shorter\s*than\s*advertised|too\s*short', 100, '규모/관람시간 대비 가치 불만'),
  ('CROWD_COMPLAINT','any', '{}', '(?<!안\s)(사람[^.!?\n]{0,4}(너무\s*)?많|제대로\s*감상[^.!?\n]{0,8}힘들|북적|혼잡)|overcrowded|too\s*crowded|packed\s*with\s*people', 100, '혼잡도 통제 미흡');

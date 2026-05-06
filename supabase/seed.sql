-- ARTE Review Desk — Seed Data
-- Run after 001_initial.sql

-- Branches
insert into branches (code, name_ko, name_en, default_language) values
  ('AMBS', '아르떼뮤지엄 부산', 'ARTE Museum Busan', 'ko'),
  ('AMJJ', '아르떼뮤지엄 제주', 'ARTE Museum Jeju', 'ko'),
  ('AMYS', '아르떼뮤지엄 여수', 'ARTE Museum Yeosu', 'ko'),
  ('AMGN', '아르떼뮤지엄 강릉', 'ARTE Museum Gangneung', 'ko'),
  ('AMDB', '아르떼뮤지엄 두바이', 'ARTE Museum Dubai', 'en'),
  ('AMNY', '아르떼뮤지엄 뉴욕', 'ARTE Museum New York', 'en'),
  ('AMLV', '아르떼뮤지엄 라스베이거스', 'ARTE Museum Las Vegas', 'en')
on conflict (code) do nothing;

-- Channels
insert into channels (code, name, collection_mode, publish_mode) values
  ('google', '구글 리뷰', 'manual', 'manual_copy'),
  ('naver', '네이버 리뷰', 'manual', 'manual_copy'),
  ('tripadvisor', '트립어드바이저', 'manual', 'manual_copy'),
  ('ota', 'OTA (기타)', 'manual', 'manual_copy'),
  ('manual', '직접 입력', 'manual', 'manual_copy')
on conflict (code) do nothing;

-- Default risk keywords
insert into app_settings (key, value, description) values (
  'risk_keywords',
  '[
    {"id":"rk-01","keyword":"환불","language":"ko","risk_level":"high","action":"human_review","is_active":true},
    {"id":"rk-02","keyword":"보상","language":"ko","risk_level":"high","action":"human_review","is_active":true},
    {"id":"rk-03","keyword":"다쳤","language":"ko","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-04","keyword":"사고","language":"ko","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-05","keyword":"차별","language":"ko","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-06","keyword":"법적","language":"ko","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-07","keyword":"언론","language":"ko","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-08","keyword":"CCTV","language":"any","risk_level":"high","action":"human_review","is_active":true},
    {"id":"rk-09","keyword":"refund","language":"en","risk_level":"high","action":"human_review","is_active":true},
    {"id":"rk-10","keyword":"injured","language":"en","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-11","keyword":"lawsuit","language":"en","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-12","keyword":"discrimination","language":"en","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-13","keyword":"police","language":"en","risk_level":"critical","action":"escalate","is_active":true},
    {"id":"rk-14","keyword":"compensation","language":"en","risk_level":"high","action":"human_review","is_active":true}
  ]'::jsonb,
  '위험 키워드 목록. 이 키워드가 포함된 리뷰는 자동으로 고위험으로 분류됩니다.'
) on conflict (key) do nothing;

-- Default reply templates
insert into app_settings (key, value, description) values (
  'reply_templates',
  '[
    {
      "id":"rt-01",
      "name":"긍정 리뷰 감사 (한국어 표준)",
      "language":"ko",
      "category":"positive",
      "content":"소중한 시간을 내어 아르떼뮤지엄을 방문해 주시고 따뜻한 후기를 남겨 주셔서 진심으로 감사드립니다. 고객님의 소중한 경험이 저희에게 큰 힘이 됩니다. 앞으로도 더욱 아름다운 전시와 공간으로 보답하겠습니다. 다음에도 방문해 주시길 기대하겠습니다."
    },
    {
      "id":"rt-02",
      "name":"긍정 리뷰 감사 (영어 표준)",
      "language":"en",
      "category":"positive",
      "content":"Thank you so much for visiting ARTE Museum and for taking the time to share your kind words. Your experience truly means a great deal to us. We hope to welcome you back again soon."
    },
    {
      "id":"rt-03",
      "name":"개선 요청 리뷰 응대 (한국어)",
      "language":"ko",
      "category":"negative",
      "content":"방문해 주셔서 감사하며, 불편하셨던 점에 대해 진심으로 사과드립니다. 고객님의 소중한 의견은 저희가 더 나은 경험을 제공하는 데 반드시 반영하겠습니다. 앞으로 개선된 모습으로 다시 뵐 수 있기를 희망합니다."
    },
    {
      "id":"rt-04",
      "name":"개선 요청 리뷰 응대 (영어)",
      "language":"en",
      "category":"negative",
      "content":"Thank you for visiting ARTE Museum and for sharing your feedback. We sincerely apologize for any inconvenience you experienced. Your comments are important to us and will be used to improve the experience for all guests. We hope to have the opportunity to welcome you again."
    }
  ]'::jsonb,
  '답변 템플릿. AI 초안 생성 시 참고 자료로 사용됩니다.'
) on conflict (key) do nothing;

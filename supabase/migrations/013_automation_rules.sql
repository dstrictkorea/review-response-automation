-- 013_automation_rules.sql
-- DB 구동형 동적 분류/답변 엔진 (PHASE 1: 스키마 + 시드)
--
-- WaterfallRegexEngine의 하드코딩 규칙을 DB로 외부화하기 위한 캐노니컬 설정 테이블.
-- ※ 안전 불변 규칙: EMERGENCY Layer는 코드(waterfallRegexEngine.ts)에 하드코딩 유지.
--   DB의 EMERGENCY 행은 '추가(additive)' 전용이며, 코드 안전망을 약화/대체할 수 없다(DECISIONS #11).
-- ※ 보안: 기존 intent_keywords 등과 달리 RLS ON + authenticated 읽기전용. 쓰기는 service-role(관리 API)만.

-- ── 분류 규칙 ─────────────────────────────────────────────────────────────────────
create table if not exists public.automation_rules (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,                 -- EMERGENCY|COMPLAINT|CHURN|REPEAT|FUTURE_HOPE|SARCASM|POSITIVE|QUESTION|ARTWORK
  language      text not null default 'any',   -- ko|en|ja|zh|any
  keywords      text[] not null default '{}',  -- 키워드 목록(엔진이 alternation으로 컴파일)
  regex_pattern text,                          -- 원시 정규식(있으면 keywords 대신 사용)
  is_active     boolean not null default true,
  priority      integer not null default 100,  -- 낮을수록 우선
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists automation_rules_active_idx on public.automation_rules (category, is_active);

-- ── 응답 템플릿 ───────────────────────────────────────────────────────────────────
create table if not exists public.response_templates (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,                 -- greeting|thanks|eternal_nature|closing|dry_apology
  language      text not null,                 -- ko|en|ja|zh
  template_text text not null,                 -- {{name}} {{official}} {{signature}} 치환자 지원
  tone          text not null default 'STANDARD',
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists response_templates_lookup_idx on public.response_templates (category, language, is_active);

-- ── RLS: authenticated 읽기 전용. 쓰기는 service-role(관리 API)만 → anon 접근 차단 ──
alter table public.automation_rules   enable row level security;
alter table public.response_templates enable row level security;
drop policy if exists automation_rules_read   on public.automation_rules;
drop policy if exists response_templates_read on public.response_templates;
create policy automation_rules_read   on public.automation_rules   for select to authenticated using (true);
create policy response_templates_read on public.response_templates for select to authenticated using (true);

-- ── 시드: 현재 하드코딩 엔진을 그대로 미러링 (PHASE 2에서 엔진이 로드) ─────────────
insert into public.automation_rules (category, language, keywords, regex_pattern, priority, notes) values
  -- EMERGENCY (참조/추가용 — 코드 하드코딩이 불변 안전망. DB는 additive only)
  ('EMERGENCY','ko', array['다쳤','넘어졌','피가','병원','119','어지러','멀미','구토','발작','분실물','경찰','고소','소비자원','보상','환불'], null, 0, '코드 하드코딩 불변 + DB additive'),
  ('EMERGENCY','en', array['hurt','injur','fell','trip','bleed','hospital','911','paramedic','dizzy','nausea','vomit','seizure','lost','stolen','police','sue','lawyer','lawsuit','refund','compensat','chargeback'], null, 0, '코드 하드코딩 불변 + DB additive'),
  -- COMPLAINT
  ('COMPLAINT','ko', array['불친절','짜증','최악','실망','돈 아깝','바가지','시장통','도떼기','더럽','냄새','의자 없','주차 불편','대기 너무'], null, 100, null),
  ('COMPLAINT','en', array['rude','attitude','unprofessional','worst','disappoint','rip off','waste of','overprice','scam','packed','crowded','zoo','messy','dirty','filthy','smell','stink','no seat','nowhere to sit','parking','long line','long wait','long queue','not worth','overrated'], null, 100, null),
  -- 복합 규칙은 regex_pattern으로
  ('CHURN','any', '{}', '(다시는|두번\s*다시는)\s*(안\s*올|안\s*갈)|(never\s*again|never\s*com|won[''’]?t\s*be\s*back|won[''’]?t\s*return|wouldn[''’]?t\s*recommend|not\s*recommend|do\s*not\s*go|skip\s*this|regret)', 100, '이탈 위험'),
  ('REPEAT','any', '{}', '(두\s*번째|2번째|3번째|다회차)\s*(방문|관람|왔)|(second\s*time|2nd\s*time|third\s*time|3rd\s*time|multiple\s*times|back\s*again|returned|came\s*back|visit\s*again)', 100, '재방문 입증'),
  ('FUTURE_HOPE','any', '{}', '(나중에|다음에|기회\s*되면)\s*(꼭|무조건)?\s*(재방문|또\s*방문|다시\s*올)|(will\s*be\s*back|next\s*time|definitely\s*return|will\s*(visit|come)\s*again|would\s*go\s*back)', 100, '단순 미래 희망'),
  ('SARCASM','any', '{}', '(안\s*아깝|나쁘지\s*않|나쁘지않)|(not\s*(too\s*)?bad|not\s*a\s*waste|didn[''’]?t\s*disappoint)', 90, '이중부정 복구(긍정)'),
  ('POSITIVE','ko', array['좋','최고','감동','멋지','멋있','예쁘','이쁘','훌륭','환상','만족','행복','즐거','추천','볼 만','아름답','인생 샷'], null, 100, null),
  ('POSITIVE','en', array['beautiful','amazing','great','love','wonderful','perfect','gorgeous','stunning','incredible','awesome','fantastic','enjoyed','recommend','worth it'], null, 100, null),
  ('QUESTION','any', '{}', '[?？]|(인가요|나요|까요|을까|ㄴ가요|어때|되나요|있나요|하나요|일까)', 100, '질문/모호'),
  ('ARTWORK','any', array['작품','전시','몰입','미디어 아트','미디어아트','예술','아트','immersive','art','artwork','exhibition','installation','media art'], null, 100, '작품 감상');

insert into public.response_templates (category, language, template_text) values
  ('greeting','ko','안녕하세요{{name_honorific}}. {{official}}을(를) 방문해 주셔서 진심으로 감사드립니다.'),
  ('greeting','en','Dear {{name}}, thank you so much for visiting {{official}}.'),
  ('greeting','ja','{{name_honorific}}この度は{{official}}にお越しいただき、誠にありがとうございます。'),
  ('greeting','zh','{{name_honorific}}衷心感谢您莅临{{official}}。'),
  ('thanks','ko','남겨주신 따뜻한 후기를 읽으며 저희 또한 큰 힘을 얻었습니다. 소중한 시간을 함께해 주셔서 감사합니다.'),
  ('thanks','en','Your kind words mean a great deal to our entire team. Thank you for spending your time with us.'),
  ('thanks','ja','頂いた温かいお言葉に、スタッフ一同大変励まされております。お時間を共にしていただき、ありがとうございます。'),
  ('thanks','zh','您温暖的评价让我们全体员工倍感鼓舞。感谢您与我们共度宝贵的时光。'),
  ('eternal_nature','ko','특히 ''ETERNAL NATURE(영원한 자연)''를 주제로 한 저희의 몰입형 미디어아트{{signature_phrase}}에서 깊은 울림을 느끼셨다니 더없이 기쁩니다.'),
  ('eternal_nature','en','We are especially delighted that our immersive media art — created under our philosophy of "ETERNAL NATURE"{{signature_phrase}} — resonated so deeply with you.'),
  ('eternal_nature','ja','とりわけ「ETERNAL NATURE（永遠の自然）」をテーマにした没入型メディアアート{{signature_phrase}}に深く心を動かされたとのこと、大変嬉しく存じます。'),
  ('eternal_nature','zh','尤其令我们欣喜的是，以"ETERNAL NATURE（永恒自然）"为主题的沉浸式媒体艺术{{signature_phrase}}，能让您深受触动。'),
  ('closing','ko','앞으로도 잊지 못할 영감과 감동을 선사하는 {{official}}이(가) 되겠습니다. 다시 만나뵐 그날을 기대하겠습니다.'),
  ('closing','en','It would be our honor to welcome you back to {{official}} for another unforgettable experience.'),
  ('closing','ja','これからも忘れられない感動をお届けできる{{official}}であり続けます。またお会いできる日を心よりお待ちしております。'),
  ('closing','zh','我们将继续为您呈现难忘的感动，期待与您再次相见于{{official}}。'),
  ('dry_apology','ko','안녕하세요{{name_honorific}}. 먼저 {{official}} 이용 중 불편을 드린 점 진심으로 사과드립니다. 말씀해 주신 내용을 무겁게 받아들이며, 담당자가 신속히 확인하여 성심껏 안내드리겠습니다. 소중한 의견 감사합니다.'),
  ('dry_apology','en','Dear {{name}}, we sincerely apologize for the inconvenience you experienced at {{official}}. We take your feedback seriously, and a member of our team will review it promptly and follow up with care. Thank you for letting us know.'),
  ('dry_apology','ja','{{name_honorific}}この度は{{official}}にてご不便をおかけし、誠に申し訳ございません。頂いたご意見を重く受け止め、担当者が速やかに確認のうえ、誠心誠意ご案内いたします。貴重なご意見をありがとうございます。'),
  ('dry_apology','zh','{{name_honorific}}对于您在{{official}}遇到的不便，我们深表歉意。我们会认真对待您的反馈，由专员尽快核实并诚挚跟进。感谢您的宝贵意见。');

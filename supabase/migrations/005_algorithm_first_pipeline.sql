-- ============================================================
-- Migration 005: Algorithm-First Pipeline
-- Wave 10 — 2026-05-29
-- pg_trgm + review_intents + intent_keywords + reply_template_variants
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── review_intents ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_intents (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  code         text    UNIQUE NOT NULL,
  label_ko     text    NOT NULL,
  label_en     text    NOT NULL,
  risk_level   text    NOT NULL DEFAULT 'low',
  requires_llm boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ── intent_keywords ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intent_keywords (
  id          uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_code text  NOT NULL REFERENCES review_intents(code) ON DELETE CASCADE,
  keyword     text  NOT NULL,
  language    text  NOT NULL DEFAULT 'any',
  weight      float NOT NULL DEFAULT 1.0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intent_keywords_trgm_idx  ON intent_keywords USING gin(keyword gin_trgm_ops);
CREATE INDEX IF NOT EXISTS intent_keywords_lang_idx  ON intent_keywords(language);
CREATE INDEX IF NOT EXISTS intent_keywords_code_idx  ON intent_keywords(intent_code);

-- ── reply_template_variants ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reply_template_variants (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_code    text    NOT NULL REFERENCES review_intents(code) ON DELETE CASCADE,
  language       text    NOT NULL,
  variant_num    integer NOT NULL DEFAULT 1,
  draft_short    text    NOT NULL,
  draft_standard text    NOT NULL,
  draft_careful  text    NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(intent_code, language, variant_num)
);

CREATE INDEX IF NOT EXISTS rtv_intent_lang_idx ON reply_template_variants(intent_code, language);

-- ── RPC: detect_review_intent ─────────────────────────────────────────────────
-- Returns top-N intents ranked by fuzzy keyword similarity.
-- p_lang: review language code (ko/en/ja/zh/ar); also matches language='any'
-- p_top_n: number of top results to return
CREATE OR REPLACE FUNCTION detect_review_intent(
  p_text  text,
  p_lang  text    DEFAULT 'ko',
  p_top_n integer DEFAULT 3
)
RETURNS TABLE(
  intent_code  text,
  confidence   float4,
  risk_level   text,
  requires_llm boolean
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    ik.intent_code,
    MAX(word_similarity(ik.keyword, p_text))::float4 AS confidence,
    ri.risk_level,
    ri.requires_llm
  FROM intent_keywords ik
  JOIN review_intents ri ON ri.code = ik.intent_code
  WHERE
    ri.is_active = true
    AND ik.is_active = true
    AND (ik.language = p_lang OR ik.language = 'any')
    AND word_similarity(ik.keyword, p_text) > 0.25
  GROUP BY ik.intent_code, ri.risk_level, ri.requires_llm
  ORDER BY confidence DESC
  LIMIT p_top_n
$$;

-- ── Seed: 20 review_intents ───────────────────────────────────────────────────
INSERT INTO review_intents (code, label_ko, label_en, risk_level, requires_llm) VALUES
  ('positive_overall',    '긍정 전반',      'Overall positive',          'low',      false),
  ('immersive_exp',       '몰입 경험',      'Immersive experience',      'low',      false),
  ('photo_zone',          '포토존/사진',    'Photo opportunities',        'low',      false),
  ('lighting_display',    '조명/전시물',    'Lighting & display',         'low',      false),
  ('staff_praise',        '직원 칭찬',      'Staff praise',               'low',      false),
  ('child_friendly',      '가족/아이',      'Family & children',          'low',      false),
  ('repeat_visit',        '재방문 의사',    'Repeat visit intent',        'low',      false),
  ('crowd_complaint',     '혼잡 불만',      'Overcrowding complaint',     'low',      false),
  ('wait_time',           '대기시간 불만',  'Wait time complaint',        'low',      false),
  ('cleanliness',         '청결 불만',      'Cleanliness complaint',      'low',      false),
  ('ticket_price',        '가격 불만',      'Ticket price complaint',     'low',      false),
  ('ticket_booking',      '예매/예약 불편', 'Booking difficulty',         'low',      false),
  ('staff_complaint',     '직원 불만',      'Staff complaint',            'medium',   false),
  ('parking',             '주차 불편',      'Parking issue',              'low',      false),
  ('food_cafe',           '카페/식음료',    'Food & cafe',                'low',      false),
  ('souvenir_merch',      '굿즈/기념품',    'Souvenirs & merchandise',    'low',      false),
  ('accessibility',       '장애인/접근성',  'Accessibility',              'low',      false),
  ('location_access',     '위치/교통',      'Location & access',          'low',      false),
  ('safety_concern',      '안전 우려',      'Safety concern',             'high',     true),
  ('refund_complaint',    '환불/보상 요구', 'Refund / compensation',      'high',     true)
ON CONFLICT (code) DO NOTHING;

-- ── Seed: intent_keywords (KO + EN + JP + ZH + AR) ───────────────────────────
INSERT INTO intent_keywords (intent_code, keyword, language) VALUES
-- positive_overall
('positive_overall','너무 좋아요','ko'),('positive_overall','최고예요','ko'),
('positive_overall','강력 추천','ko'),('positive_overall','완전 만족','ko'),
('positive_overall','대박이에요','ko'),('positive_overall','정말 좋았어요','ko'),
('positive_overall','훌륭해요','ko'),('positive_overall','감동받았어요','ko'),
('positive_overall','amazing','en'),('positive_overall','absolutely loved','en'),
('positive_overall','highly recommend','en'),('positive_overall','fantastic','en'),
('positive_overall','wonderful experience','en'),('positive_overall','great visit','en'),
('positive_overall','素晴らしい','ja'),('positive_overall','最高でした','ja'),
('positive_overall','太棒了','zh'),('positive_overall','非常好','zh'),
('positive_overall','رائع','ar'),('positive_overall','ممتاز','ar'),

-- immersive_exp
('immersive_exp','몰입감','ko'),('immersive_exp','빠져들었어','ko'),
('immersive_exp','완전히 몰입','ko'),('immersive_exp','신세계','ko'),
('immersive_exp','신비로워요','ko'),('immersive_exp','압도적','ko'),
('immersive_exp','immersive','en'),('immersive_exp','mind-blowing','en'),
('immersive_exp','blew my mind','en'),('immersive_exp','breathtaking','en'),
('immersive_exp','没入感','zh'),('immersive_exp','身临其境','zh'),
('immersive_exp','没入できる','ja'),

-- photo_zone
('photo_zone','사진 잘 나와요','ko'),('photo_zone','인생샷','ko'),
('photo_zone','포토존','ko'),('photo_zone','인스타','ko'),
('photo_zone','사진 찍기 좋아요','ko'),('photo_zone','배경 예뻐요','ko'),
('photo_zone','great for photos','en'),('photo_zone','instagram worthy','en'),
('photo_zone','photo opportunities','en'),('photo_zone','インスタ映え','ja'),
('photo_zone','拍照好看','zh'),('photo_zone','适合拍照','zh'),

-- lighting_display
('lighting_display','조명이 예뻐요','ko'),('lighting_display','불빛이 아름다워요','ko'),
('lighting_display','영상이 멋져요','ko'),('lighting_display','전시가 화려해요','ko'),
('lighting_display','빛이 아름다워','ko'),
('lighting_display','beautiful lights','en'),('lighting_display','stunning visuals','en'),
('lighting_display','gorgeous display','en'),
('lighting_display','灯光漂亮','zh'),('lighting_display','光影效果','zh'),
('lighting_display','照明が美しい','ja'),

-- staff_praise
('staff_praise','직원이 친절해요','ko'),('staff_praise','친절한 직원','ko'),
('staff_praise','직원분이 좋아요','ko'),('staff_praise','도움이 많이 됐어요','ko'),
('staff_praise','안내를 잘 해줬어요','ko'),
('staff_praise','staff was great','en'),('staff_praise','friendly staff','en'),
('staff_praise','helpful employees','en'),('staff_praise','kind staff','en'),
('staff_praise','スタッフが親切','ja'),('staff_praise','工作人员很好','zh'),

-- child_friendly
('child_friendly','아이들이 좋아해요','ko'),('child_friendly','아이랑 왔어요','ko'),
('child_friendly','가족 여행','ko'),('child_friendly','어린이','ko'),
('child_friendly','아이 데리고','ko'),('child_friendly','아이 만족','ko'),
('child_friendly','kids loved it','en'),('child_friendly','family friendly','en'),
('child_friendly','great for kids','en'),('child_friendly','children enjoyed','en'),
('child_friendly','子供が楽しめる','ja'),('child_friendly','适合孩子','zh'),
('child_friendly','مناسب للأطفال','ar'),

-- repeat_visit
('repeat_visit','또 오고 싶어요','ko'),('repeat_visit','재방문할게요','ko'),
('repeat_visit','다시 오고 싶다','ko'),('repeat_visit','또 올게요','ko'),
('repeat_visit','will come back','en'),('repeat_visit','definitely returning','en'),
('repeat_visit','coming back','en'),('repeat_visit','また来たい','ja'),
('repeat_visit','想再来','zh'),

-- crowd_complaint
('crowd_complaint','너무 붐벼요','ko'),('crowd_complaint','사람이 너무 많아요','ko'),
('crowd_complaint','혼잡해요','ko'),('crowd_complaint','북적북적','ko'),
('crowd_complaint','인파','ko'),('crowd_complaint','사람이 넘쳐요','ko'),
('crowd_complaint','빡빡해요','ko'),
('crowd_complaint','too crowded','en'),('crowd_complaint','very busy','en'),
('crowd_complaint','packed','en'),('crowd_complaint','sooooo crowded','en'),
('crowd_complaint','人が多い','ja'),('crowd_complaint','人很多','zh'),
('crowd_complaint','ازدحام','ar'),

-- wait_time
('wait_time','줄이 너무 길어요','ko'),('wait_time','대기가 길어요','ko'),
('wait_time','오래 기다렸어요','ko'),('wait_time','기다리는 시간이 길어요','ko'),
('wait_time','줄이 엄청 길어요','ko'),('wait_time','웨이팅이 너무 길어요','ko'),
('wait_time','long wait','en'),('wait_time','long queue','en'),
('wait_time','waited forever','en'),('wait_time','queue was insane','en'),
('wait_time','長い待ち時間','ja'),('wait_time','排队时间长','zh'),

-- cleanliness
('cleanliness','화장실이 더러워요','ko'),('cleanliness','청결하지 않아요','ko'),
('cleanliness','지저분해요','ko'),('cleanliness','냄새가 나요','ko'),
('cleanliness','위생 상태가 안 좋아요','ko'),
('cleanliness','dirty','en'),('cleanliness','not clean','en'),
('cleanliness','bathroom was dirty','en'),('cleanliness','unhygienic','en'),
('cleanliness','汚い','ja'),('cleanliness','不卫生','zh'),

-- ticket_price
('ticket_price','입장료가 비싸요','ko'),('ticket_price','가격이 너무 높아요','ko'),
('ticket_price','가성비가 별로','ko'),('ticket_price','비용이 부담돼요','ko'),
('ticket_price','너무 비싸요','ko'),('ticket_price','금액이 높아요','ko'),
('ticket_price','expensive','en'),('ticket_price','overpriced','en'),
('ticket_price','not worth the price','en'),('ticket_price','too costly','en'),
('ticket_price','高すぎる','ja'),('ticket_price','票价贵','zh'),

-- ticket_booking
('ticket_booking','예매가 불편해요','ko'),('ticket_booking','예약이 어려워요','ko'),
('ticket_booking','앱이 불편해요','ko'),('ticket_booking','예매 시스템','ko'),
('ticket_booking','티켓 구매가 힘들어요','ko'),
('ticket_booking','hard to book','en'),('ticket_booking','booking system','en'),
('ticket_booking','app issues','en'),
('ticket_booking','チケット購入が難しい','ja'),('ticket_booking','订票困难','zh'),

-- staff_complaint
('staff_complaint','직원이 불친절해요','ko'),('staff_complaint','직원 태도가 안 좋아요','ko'),
('staff_complaint','직원이 무례해요','ko'),('staff_complaint','안내가 불친절','ko'),
('staff_complaint','스태프 태도','ko'),
('staff_complaint','rude staff','en'),('staff_complaint','unfriendly staff','en'),
('staff_complaint','staff attitude','en'),('staff_complaint','bad service','en'),
('staff_complaint','スタッフが無礼','ja'),('staff_complaint','工作人员态度差','zh'),

-- parking
('parking','주차가 불편해요','ko'),('parking','주차 공간이 없어요','ko'),
('parking','주차하기 힘들어요','ko'),('parking','주차장이 협소해요','ko'),
('parking','parking is a nightmare','en'),('parking','no parking','en'),
('parking','parking was terrible','en'),
('parking','駐車場が不便','ja'),('parking','停车不方便','zh'),

-- food_cafe
('food_cafe','카페가 맛있어요','ko'),('food_cafe','음식이 좋아요','ko'),
('food_cafe','카페 추천해요','ko'),('food_cafe','카페가 별로예요','ko'),
('food_cafe','먹거리가 없어요','ko'),
('food_cafe','great cafe','en'),('food_cafe','food was good','en'),
('food_cafe','cafe food','en'),('food_cafe','no food options','en'),

-- souvenir_merch
('souvenir_merch','굿즈가 예뻐요','ko'),('souvenir_merch','기념품이 좋아요','ko'),
('souvenir_merch','굿즈 사고 싶어요','ko'),('souvenir_merch','굿즈가 별로예요','ko'),
('souvenir_merch','nice souvenirs','en'),('souvenir_merch','great merchandise','en'),
('souvenir_merch','グッズが可愛い','ja'),('souvenir_merch','周边好看','zh'),

-- accessibility
('accessibility','휠체어','ko'),('accessibility','장애인 시설','ko'),
('accessibility','유모차','ko'),('accessibility','접근성이 좋아요','ko'),
('accessibility','배리어 프리','ko'),
('accessibility','wheelchair accessible','en'),('accessibility','accessible','en'),
('accessibility','stroller friendly','en'),
('accessibility','バリアフリー','ja'),('accessibility','无障碍设施','zh'),

-- location_access
('location_access','찾기 힘들어요','ko'),('location_access','위치가 불편해요','ko'),
('location_access','교통이 불편해요','ko'),('location_access','접근성이 나빠요','ko'),
('location_access','hard to find','en'),('location_access','difficult to access','en'),
('location_access','bad location','en'),
('location_access','分かりにくい','ja'),('location_access','难找','zh'),

-- safety_concern
('safety_concern','위험해요','ko'),('safety_concern','안전하지 않아요','ko'),
('safety_concern','다쳤어요','ko'),('safety_concern','안전사고','ko'),
('safety_concern','dangerous','en'),('safety_concern','unsafe','en'),
('safety_concern','got injured','en'),('safety_concern','safety issue','en'),
('safety_concern','危険','ja'),('safety_concern','不安全','zh'),
('safety_concern','خطير','ar'),

-- refund_complaint
('refund_complaint','환불해주세요','ko'),('refund_complaint','환불 요청','ko'),
('refund_complaint','돈 돌려줘요','ko'),('refund_complaint','보상해주세요','ko'),
('refund_complaint','refund','en'),('refund_complaint','want my money back','en'),
('refund_complaint','compensation','en'),('refund_complaint','demand refund','en'),
('refund_complaint','返金してください','ja'),('refund_complaint','退款','zh'),
('refund_complaint','استرداد المبلغ','ar')

ON CONFLICT DO NOTHING;

-- ── Seed: reply_template_variants ─────────────────────────────────────────────
-- KO: 5 variants for positive_overall, immersive_exp, photo_zone, lighting_display,
--     staff_praise, child_friendly, crowd_complaint, wait_time, cleanliness,
--     ticket_price, staff_complaint
-- EN: 5 variants for positive_overall, crowd_complaint, wait_time, staff_complaint, staff_praise

INSERT INTO reply_template_variants (intent_code, language, variant_num, draft_short, draft_standard, draft_careful) VALUES

-- ═══════════════════════════════════════════════════════
-- positive_overall / KO
-- ═══════════════════════════════════════════════════════
('positive_overall','ko',1,
 '{{branch_name}}을 찾아 주시고 따뜻한 후기까지 남겨 주셔서 진심으로 감사드립니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 소중한 후기를 남겨 주셔서 진심으로 감사드립니다. 고객님의 긍정적인 말씀이 저희 팀 모두에게 큰 힘이 됩니다. 앞으로도 최고의 전시 경험을 제공하기 위해 더욱 노력하겠습니다.',
 '{{reviewer_name}}님, 바쁘신 일상 중에 {{branch_name}}을 방문해 주시고 이렇게 귀한 후기까지 남겨 주셔서 깊이 감사드립니다. 고객님처럼 저희 전시를 사랑해 주시는 분들이 계시기에 팀 모두가 더욱 열정을 가지고 최선을 다할 수 있습니다. 아르떼뮤지엄은 빛과 예술의 경계를 허무는 세계 최고 수준의 몰입형 전시를 위해 끊임없이 새로운 콘텐츠를 연구하고 있습니다. 고객님의 다음 방문에서도 더욱 특별한 경험으로 보답드릴 것을 약속드립니다.'),

('positive_overall','ko',2,
 '소중한 방문과 멋진 후기에 진심으로 감사드립니다!',
 '안녕하세요, {{reviewer_name}}님! {{branch_name}}에 방문해 주셔서 감사합니다. 저희 전시가 특별한 추억이 되셨다니 무엇보다 기쁩니다. 다음에도 새로운 전시와 함께 고객님을 맞이할 수 있기를 기대하겠습니다.',
 '안녕하세요, {{reviewer_name}}님! {{branch_name}}을 찾아 주셔서 진심으로 감사드립니다. 고객님과 함께한 시간이 저희에게도 특별한 의미로 남아 있습니다. 아르떼뮤지엄은 빛과 예술이 어우러진 독보적인 몰입 공간을 만들기 위해 항상 새로운 콘텐츠와 경험을 연구하고 있습니다. 고객님의 소중한 후기가 저희의 지속적인 발전에 큰 힘이 됩니다. 언제든지 다시 찾아 주시면 또 다른 특별한 경험으로 맞이하겠습니다.'),

('positive_overall','ko',3,
 '귀중한 시간을 내어 좋은 후기를 남겨 주셔서 감사합니다.',
 '{{reviewer_name}}님, 즐거운 관람 경험을 공유해 주셔서 감사합니다. 고객님이 저희 전시에서 특별한 감동을 받으셨다니 팀 모두가 매우 기쁩니다. 앞으로도 더욱 발전된 모습으로 보답드리겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서의 즐거운 경험을 이렇게 공유해 주셔서 진심으로 감사드립니다. 저희 아르떼뮤지엄은 모든 고객님께서 일상에서 벗어나 예술과 빛이 만들어 내는 특별한 순간을 경험하실 수 있도록 끊임없이 노력하고 있습니다. 고객님의 따뜻한 말씀 하나하나가 저희 팀에게는 가장 큰 동기 부여가 됩니다. 앞으로도 더욱 풍성한 전시와 서비스로 고객님의 기대에 보답하겠습니다.'),

('positive_overall','ko',4,
 '방문해 주시고 좋은 후기까지 남겨 주셔서 정말 감사드립니다.',
 '{{reviewer_name}}님의 소중한 후기 감사히 읽었습니다. 저희 {{branch_name}}이 고객님께 특별한 추억을 선사할 수 있어 무척 기쁩니다. 앞으로도 방문해 주시는 모든 분들께 잊지 못할 경험을 드릴 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 따스한 후기를 남겨 주셔서 감사드립니다. 아르떼뮤지엄은 단순한 전시 공간을 넘어, 일상의 피로를 씻어 드리는 예술의 쉼터가 되고자 합니다. 고객님의 긍정적인 경험을 통해 저희의 방향이 옳다는 것을 다시 한번 확인하게 되었습니다. 앞으로 더욱 다양하고 혁신적인 콘텐츠로 찾아뵐 것을 약속드리며, 고객님의 재방문을 진심으로 기대하겠습니다.'),

('positive_overall','ko',5,
 '소중한 방문과 후기에 감사드립니다. 곧 또 뵙겠습니다!',
 '{{reviewer_name}}님의 방문과 후기 감사히 받았습니다. 고객님처럼 아르떼뮤지엄을 사랑해 주시는 분들이 계시기에 저희가 더욱 힘을 내어 발전할 수 있습니다. 다음 방문 때도 새로운 감동을 드릴 수 있도록 준비하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서의 즐거운 경험을 공유해 주셔서 진심으로 감사드립니다. 고객님 한 분 한 분의 후기가 저희 아르떼뮤지엄의 성장과 발전에 큰 원동력이 됩니다. 저희는 앞으로도 세계 최고 수준의 디지털 아트 경험을 통해 모든 고객님께 특별한 감동의 순간을 선사하기 위해 끊임없이 혁신해 나가겠습니다. 언제든지 다시 찾아 주시면 더욱 풍성해진 전시로 맞이하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- crowd_complaint / KO
-- ═══════════════════════════════════════════════════════
('crowd_complaint','ko',1,
 '혼잡한 환경에서도 방문해 주셔서 감사합니다. 보다 쾌적한 관람 환경을 만들기 위해 노력하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사드립니다. 관람 당시 혼잡으로 인해 불편함을 드렸다면 진심으로 죄송합니다. 말씀해 주신 혼잡 문제를 귀담아듣고 입장 시간대 분산 및 동선 개선을 적극적으로 검토하겠습니다. 다음 방문에서는 더 쾌적한 환경을 경험하실 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 바쁘신 중에 {{branch_name}}을 찾아 주셔서 감사드립니다. 관람 중 혼잡으로 인해 충분히 즐기지 못하셨다면 정말 죄송합니다. 고객님의 소중한 의견을 귀담아듣겠습니다. 저희는 현재 입장 인원 분산 시스템 개선, 피크타임 안내 강화, 동선 최적화 등 혼잡 완화를 위한 다양한 방안을 적극적으로 검토하고 있습니다. 앞으로 모든 고객님이 여유롭고 쾌적한 환경에서 전시를 즐기실 수 있도록 지속적으로 개선해 나가겠습니다.'),

('crowd_complaint','ko',2,
 '혼잡한 상황에서도 방문해 주셔서 감사합니다. 쾌적한 관람을 위해 지속적으로 노력하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서 혼잡으로 인해 불편함을 겪으셨다니 죄송합니다. 방문객이 집중되는 시간대에 보다 원활한 관람이 이루어질 수 있도록 입장 관리 시스템을 개선하겠습니다. 말씀해 주신 내용을 바탕으로 더 나은 경험을 제공하기 위해 노력하겠습니다.',
 '{{reviewer_name}}님의 소중한 의견 감사히 받았습니다. 혼잡한 환경으로 인해 전시를 충분히 즐기지 못하셨다니 정말 아쉽고 죄송합니다. 고객님의 불편함을 개선하기 위해 저희는 시간대별 입장 인원 제한, 피크 타임 안내 강화, 사전 예약 시스템 개선 등 다양한 방안을 적극적으로 검토하고 시행할 예정입니다. 다음 방문에서는 보다 여유롭고 쾌적한 환경에서 아르떼뮤지엄의 전시를 충분히 즐기실 수 있도록 최선을 다하겠습니다.'),

('crowd_complaint','ko',3,
 '혼잡으로 인한 불편 말씀 감사합니다. 관람 환경 개선에 적극 반영하겠습니다.',
 '{{reviewer_name}}님, 혼잡한 환경에서도 {{branch_name}}을 찾아 주셔서 감사드립니다. 고객님의 불편 경험은 저희가 관람 환경을 개선하는 데 매우 소중한 피드백이 됩니다. 입장 인원 관리 및 혼잡도 분산을 위한 개선 방안을 즉시 검토하겠습니다.',
 '{{reviewer_name}}님, 관람 중 많은 인파로 불편하셨다는 말씀 마음속 깊이 새기겠습니다. 저희 {{branch_name}}은 모든 관람객이 여유롭고 깊이 있는 전시 경험을 누리실 수 있도록 하는 것을 최우선 목표로 하고 있습니다. 말씀해 주신 혼잡 문제를 해결하기 위해 시간대별 입장 분산, 혼잡 예보 안내, 동선 재설계 등의 개선책을 즉시 검토하고 반영하겠습니다. 귀중한 의견을 주셔서 감사하며, 다음 방문에서는 훨씬 쾌적한 환경에서 전시를 즐기실 수 있기를 바랍니다.'),

('crowd_complaint','ko',4,
 '혼잡으로 불편드려 죄송합니다. 입장 관리 개선을 통해 더 나은 경험을 드리겠습니다.',
 '{{reviewer_name}}님의 방문에 감사드립니다. 관람 시 혼잡으로 인한 불편을 드렸다면 대단히 죄송합니다. 고객님의 피드백을 바탕으로 입장 시스템 및 인원 관리 방식을 개선하여 보다 쾌적한 관람 환경을 만들어 나가겠습니다.',
 '{{reviewer_name}}님, {{branch_name}} 방문에 감사드립니다. 관람 중 혼잡한 환경으로 인해 아르떼뮤지엄만의 특별한 감동을 충분히 느끼지 못하셨다면 진심으로 죄송합니다. 고객님의 소중한 의견에 깊이 감사드리며, 말씀해 주신 혼잡 문제에 대해 입장 예약 시스템 강화, 시간대별 입장 인원 제한, 혼잡 구간 실시간 안내 등의 개선 방안을 적극적으로 추진하겠습니다. 다음 방문에서는 더욱 여유롭고 감동적인 경험을 드릴 수 있도록 최선을 다하겠습니다.'),

('crowd_complaint','ko',5,
 '혼잡 불편을 말씀해 주셔서 감사합니다. 쾌적한 관람 환경 조성에 힘쓰겠습니다.',
 '{{reviewer_name}}님, 소중한 의견 감사드립니다. 전시 관람 중 혼잡으로 불편하셨던 점 깊이 사과드립니다. 보다 쾌적하고 여유로운 관람 환경을 제공하기 위해 입장 시스템과 동선 관리를 적극적으로 개선해 나가겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 찾아 주셔서 감사드립니다. 혼잡한 환경으로 인해 기대하셨던 몰입 경험을 충분히 즐기지 못하셨다니 정말 안타깝고 죄송합니다. 고객님의 소중한 피드백은 저희가 더 나은 방향으로 발전하는 데 있어 매우 중요한 나침반이 됩니다. 방문객 분산 시스템 고도화, 피크 타임 입장 제한 강화, 혼잡 예보 알림 서비스 도입 등 다양한 개선책을 신속히 검토하고 실행하겠습니다. 다음에는 여유롭고 깊이 있는 전시 경험을 드릴 수 있도록 더욱 노력하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- wait_time / KO
-- ═══════════════════════════════════════════════════════
('wait_time','ko',1,
 '대기 시간으로 불편드려 죄송합니다. 입장 시스템 개선으로 기다림을 줄이겠습니다.',
 '{{reviewer_name}}님, 방문해 주셔서 감사드립니다. 긴 대기 시간으로 불편을 드렸다면 진심으로 죄송합니다. 고객님의 의견을 귀담아듣고 사전 예약 시스템 강화 및 입장 운영 효율화를 적극적으로 추진하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에 방문해 주셔서 감사드립니다. 기다리는 시간이 길어 불편하셨다는 말씀, 진심으로 죄송합니다. 고객님의 소중한 의견을 바탕으로 저희는 사전 예약제 확대, 시간대별 입장 인원 최적화, 대기 공간 환경 개선 등 대기 시간 단축을 위한 구체적인 방안을 즉시 검토하고 시행하겠습니다. 다음 방문에서는 보다 신속하고 쾌적한 입장 경험을 드릴 수 있도록 최선을 다하겠습니다.'),

('wait_time','ko',2,
 '긴 대기로 불편드려 정말 죄송합니다. 빠른 개선을 약속드립니다.',
 '{{reviewer_name}}님, 소중한 시간을 내어 {{branch_name}}을 방문해 주셨는데 긴 대기로 불편하셨다니 정말 죄송합니다. 피크 타임 입장 관리와 예약 시스템 개선을 통해 불편함을 최소화하겠습니다. 고객님의 의견이 큰 도움이 됩니다.',
 '{{reviewer_name}}님, 귀중한 피드백 감사드립니다. 방문 전부터 혹은 현장에서 긴 대기를 경험하셨다면 진심으로 죄송합니다. 고객님의 시간은 무엇보다 소중하며, 저희는 이 점을 깊이 인식하고 있습니다. 말씀해 주신 대기 시간 문제를 해결하기 위해 온라인 사전 예약 시스템 고도화, 시간대별 입장 인원 동적 조정, 피크타임 현장 안내 인력 보강 등의 개선 방안을 적극적으로 추진하겠습니다. 앞으로 더욱 원활하고 쾌적한 방문 경험을 드릴 수 있도록 최선을 다하겠습니다.'),

('wait_time','ko',3,
 '긴 줄로 불편드려 죄송합니다. 입장 효율화를 통해 개선하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}} 방문에 감사드립니다. 오랜 대기로 인해 전시 관람에 지장이 있으셨다니 죄송합니다. 입장 시스템 개선과 예약 운영 최적화로 대기 시간을 단축시키기 위해 노력하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에 방문해 주셔서 감사드립니다. 입장 대기로 인해 소중한 시간을 낭비하셨다면 진심으로 죄송합니다. 고객님의 불편함을 다음 방문 전에 해소할 수 있도록, 저희는 입장 예약 시스템 전면 개편, 피크 타임 안내 강화, 추가 입장 게이트 운영 등의 개선 방안을 즉시 검토하겠습니다. 귀중한 의견 덕분에 더 나은 서비스를 제공할 수 있게 되었습니다. 다음 방문을 기대해 주세요.'),

('wait_time','ko',4,
 '대기 불편을 말씀해 주셔서 감사합니다. 신속히 개선하겠습니다.',
 '{{reviewer_name}}님, 방문에 감사드립니다. 긴 줄로 관람 전부터 피로하셨을 것 같아 죄송합니다. 저희는 예약 시스템과 현장 운영 효율화를 통해 고객님이 더 빠르고 편리하게 전시를 즐기실 수 있도록 적극적으로 노력하겠습니다.',
 '{{reviewer_name}}님, 소중한 후기 감사드립니다. 방문 당시 긴 대기로 인해 전시 관람의 첫 인상이 좋지 않으셨을 것 같아 진심으로 죄송한 마음입니다. 고객님처럼 귀중한 의견을 주시는 분들 덕분에 저희가 개선의 방향을 찾을 수 있습니다. 사전 예약 우선 입장 강화, 시간대별 혼잡도 실시간 공유, 피크 타임 운영 인력 증원 등의 방안을 신속히 마련하여 시행하겠습니다.'),

('wait_time','ko',5,
 '기다리는 불편을 드려 죄송합니다. 더 나은 방문 경험을 위해 개선하겠습니다.',
 '{{reviewer_name}}님의 의견 감사히 받았습니다. 입장 대기 시간이 길어 불편하셨을 점 깊이 공감하며 죄송합니다. 더 빠르고 원활한 입장을 위해 예약 시스템과 현장 운영 방식을 적극적으로 개선해 나가겠습니다.',
 '{{reviewer_name}}님, 귀중한 피드백 주셔서 진심으로 감사드립니다. 기다리는 시간이 길어 전시 관람에 대한 기대감이 줄어드셨을 것 같아 정말 안타깝습니다. 고객님의 소중한 시간을 존중하기 위해, 저희는 사전 예약 시스템 전면 개선, 혼잡 시간대 안내 알림 도입, 현장 입장 동선 최적화 등의 방안을 적극적으로 추진하겠습니다. 다음에는 기다림 없이 바로 감동의 전시를 즐기실 수 있도록 준비하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- staff_complaint / KO
-- ═══════════════════════════════════════════════════════
('staff_complaint','ko',1,
 '불편한 경험을 전해 주셔서 감사합니다. 서비스 개선에 소중한 피드백으로 반영하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사드립니다. 직원 응대로 인해 불쾌한 경험을 하셨다면 진심으로 죄송합니다. 고객님의 소중한 의견을 직원 서비스 교육 및 응대 품질 개선에 즉시 반영하겠습니다. 다음 방문에서는 더 따뜻하고 친절한 서비스를 경험하실 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 귀중한 피드백을 주셔서 진심으로 감사드립니다. 직원 응대 과정에서 불쾌한 경험을 하셨다면 진심으로 죄송하며, 이 점을 매우 심각하게 받아들이고 있습니다. 고객님의 소중한 의견을 바탕으로 전 직원 고객 응대 교육을 즉시 강화하고, 서비스 품질 관리 체계를 전면 점검하겠습니다. 저희 아르떼뮤지엄은 전시의 감동만큼이나 따뜻하고 진심 어린 서비스로 모든 고객님을 맞이하는 것을 최우선 목표로 삼고 있습니다. 다음 방문에서는 훨씬 개선된 서비스를 경험하실 수 있도록 약속드립니다.'),

('staff_complaint','ko',2,
 '직원 서비스로 인해 불편드려 죄송합니다. 즉시 개선하겠습니다.',
 '{{reviewer_name}}님, 소중한 의견 감사드립니다. 직원 응대에서 불편함을 느끼셨다니 정말 죄송합니다. 고객 응대 품질 향상을 위한 교육과 관리 시스템을 즉시 강화하여 다음 방문에는 더 나은 경험을 드릴 수 있도록 하겠습니다.',
 '{{reviewer_name}}님, 불편한 경험을 겪으셨음에도 피드백을 남겨 주셔서 진심으로 감사드립니다. 고객님이 기대하신 따뜻하고 친절한 서비스를 제공하지 못했다면 매우 죄송합니다. 이러한 피드백은 저희 서비스 수준을 높이는 데 있어 무엇보다 소중한 자료가 됩니다. 해당 내용을 즉시 내부에 공유하여 직원 응대 교육 강화, 고객 서비스 매뉴얼 재점검, 서비스 모니터링 시스템 개선을 통해 모든 고객님이 언제나 따뜻하고 전문적인 서비스를 받으실 수 있도록 하겠습니다.'),

('staff_complaint','ko',3,
 '직원 응대로 불편드려 죄송합니다. 서비스 교육을 강화하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}} 방문에 감사드립니다. 직원의 응대 방식으로 인해 관람 경험이 저해되셨다면 진심으로 사과드립니다. 고객님의 소중한 의견을 내부 서비스 교육에 즉시 반영하여 더욱 친절하고 전문적인 응대 문화를 만들어 나가겠습니다.',
 '{{reviewer_name}}님, 방문해 주셔서 감사드립니다. 저희 직원의 응대로 인해 불쾌한 경험을 하셨다니 진심으로 죄송합니다. 아르떼뮤지엄은 훌륭한 전시 경험과 함께 따뜻하고 진심 어린 고객 서비스를 제공하기 위해 항상 노력하고 있습니다. 고객님의 피드백을 엄중히 받아들여 직원 응대 교육 전면 강화, 고객 서비스 기준 재정립, 현장 모니터링 체계 개선 등의 조치를 즉시 취하겠습니다. 앞으로는 전시만큼 감동적인 서비스로 보답드리겠습니다.'),

('staff_complaint','ko',4,
 '불편한 서비스 경험 말씀해 주셔서 감사합니다. 즉시 시정하겠습니다.',
 '{{reviewer_name}}님의 소중한 피드백 감사드립니다. 직원 서비스로 인해 불쾌한 경험을 하셨다면 진심으로 사과드립니다. 고객님의 의견을 직원 교육에 즉시 반영하고, 응대 품질을 개선하기 위한 구체적인 조치를 취하겠습니다.',
 '{{reviewer_name}}님, 귀중한 시간을 내어 {{branch_name}}을 방문해 주셨는데 직원 응대로 인해 불쾌한 경험을 하셨다면 정말 죄송합니다. 고객님이 느끼신 불편함은 저희가 반드시 개선해야 할 중요한 사항입니다. 관련 직원 응대 매뉴얼 재검토, 서비스 교육 강화, 현장 고객 만족도 모니터링 강화 등의 조치를 즉각 시행하겠습니다. 고객님의 피드백이 더 나은 아르떼뮤지엄을 만드는 데 소중한 계기가 될 것입니다.'),

('staff_complaint','ko',5,
 '서비스로 인한 불편함을 말씀해 주셔서 감사합니다. 더 나은 응대 문화를 만들겠습니다.',
 '{{reviewer_name}}님, 직원 응대로 인해 전시 관람의 즐거움이 반감되셨다니 진심으로 죄송합니다. 고객님의 소중한 의견은 저희 서비스 품질 향상을 위해 즉시 내부에 공유하고, 전 직원 응대 교육 강화에 반영하겠습니다.',
 '{{reviewer_name}}님, 소중한 피드백을 남겨 주셔서 깊이 감사드립니다. 저희 직원의 응대로 인해 방문 경험에 아쉬움이 남으셨다면 진심으로 사과드립니다. 모든 고객님이 입장부터 퇴장까지 따뜻하고 전문적인 서비스를 받으실 수 있도록 하는 것은 아르떼뮤지엄의 가장 중요한 목표 중 하나입니다. 고객님의 의견을 바탕으로 직원 응대 교육 강화, 고객 서비스 프로세스 재점검, 현장 서비스 모니터링 체계 개선을 즉시 추진하겠습니다. 다음 방문에서는 진심 어린 서비스로 보답드리겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- staff_praise / KO
-- ═══════════════════════════════════════════════════════
('staff_praise','ko',1,
 '친절한 직원을 칭찬해 주셔서 감사합니다! 더욱 힘내겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 직원을 칭찬해 주셔서 정말 감사합니다. 고객님의 따뜻한 말씀은 직원들에게 큰 힘과 동기 부여가 됩니다. 앞으로도 최고의 서비스로 보답드리겠습니다.',
 '{{reviewer_name}}님, 방문해 주시고 저희 직원에 대한 따뜻한 칭찬까지 남겨 주셔서 진심으로 감사드립니다. 고객님의 소중한 말씀은 담당 직원에게 바로 전달하겠습니다. 친절한 서비스가 전시의 감동과 함께 특별한 경험을 만들어 드린다는 것을 저희 모두가 마음에 새기고 있습니다. 앞으로도 한 분 한 분의 고객님께 진심 어린 서비스를 제공하기 위해 더욱 노력하겠습니다. 또 찾아 주시면 더욱 빛나는 전시와 서비스로 맞이하겠습니다.'),

('staff_praise','ko',2,
 '직원을 칭찬해 주셔서 감사합니다. 더욱 발전하는 아르떼가 되겠습니다.',
 '{{reviewer_name}}님, 소중한 칭찬 말씀 감사드립니다. 고객님의 따뜻한 격려가 직원들에게 큰 자랑이 될 것입니다. 앞으로도 모든 고객님이 감동적인 전시와 따뜻한 서비스를 경험하실 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 직원들에 대한 소중한 칭찬 말씀 진심으로 감사드립니다. 저희 직원들이 고객님께 긍정적인 인상을 드렸다는 사실이 팀 모두에게 큰 보람이 됩니다. 훌륭한 전시 경험과 함께 따뜻하고 전문적인 서비스를 제공하는 것이 아르떼뮤지엄의 핵심 가치입니다. 고객님의 칭찬을 직원 모두에게 공유하여 지속적으로 서비스 수준을 높여 나가겠습니다. 다음 방문에서도 더욱 빛나는 서비스로 맞이하겠습니다.'),

('staff_praise','ko',3,
 '직원 칭찬 감사합니다! 고객님의 말씀이 큰 힘이 됩니다.',
 '{{reviewer_name}}님, 방문해 주시고 직원에 대한 따뜻한 후기까지 남겨 주셔서 감사합니다. 고객님의 칭찬을 직원들에게 전달하여 더욱 발전하는 계기로 삼겠습니다. 앞으로도 훌륭한 전시와 친절한 서비스로 보답드리겠습니다.',
 '{{reviewer_name}}님, 저희 직원에 대한 칭찬을 남겨 주셔서 진심으로 감사드립니다. 고객님의 소중한 말씀을 직원들에게 바로 전달하겠습니다. 아르떼뮤지엄에서의 경험은 훌륭한 전시 콘텐츠와 함께 따뜻한 사람의 온기가 더해질 때 비로소 완성된다고 생각합니다. 앞으로도 모든 고객님이 전시와 서비스 두 측면 모두에서 감동을 받으실 수 있도록 끊임없이 노력하겠습니다.'),

('staff_praise','ko',4,
 '직원 칭찬 감사합니다. 더욱 수준 높은 서비스로 보답드리겠습니다.',
 '{{reviewer_name}}님의 따뜻한 칭찬 말씀 감사드립니다. 고객님의 말씀을 직원들에게 전달하여 더욱 힘차게 서비스할 수 있는 원동력으로 삼겠습니다. 앞으로도 방문하실 때마다 만족스러운 경험을 드릴 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 소중한 칭찬의 말씀 진심으로 감사드립니다. 저희 직원들이 고객님께 좋은 인상을 드렸다는 소식이 팀 모두에게 큰 격려가 됩니다. 아르떼뮤지엄은 전시 콘텐츠의 완성도와 함께 진심 어린 고객 서비스를 통해 모든 방문객이 특별한 순간을 경험하실 수 있도록 끊임없이 노력하고 있습니다. 고객님의 칭찬이 팀원들에게 지속적인 서비스 향상의 원동력이 될 것입니다. 다시 방문해 주시면 더욱 빛나는 전시와 서비스로 맞이하겠습니다.'),

('staff_praise','ko',5,
 '직원에 대한 칭찬 감사합니다! 계속 노력하는 아르떼가 되겠습니다.',
 '{{reviewer_name}}님, 직원들에 대한 소중한 칭찬 감사드립니다. 고객님의 따뜻한 말씀을 팀과 공유하겠습니다. 앞으로도 항상 친절하고 전문적인 서비스로 더욱 특별한 방문 경험을 드릴 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 귀중한 칭찬의 말씀을 남겨 주셔서 진심으로 감사드립니다. 고객님의 소중한 말씀은 저희 모든 팀원들에게 전달하여 앞으로도 더욱 친절하고 전문적인 서비스를 제공하는 원동력으로 삼겠습니다. 아르떼뮤지엄을 방문하시는 모든 고객님이 전시의 감동과 함께 따뜻한 서비스로 더욱 풍성한 경험을 하실 수 있도록 지속적으로 노력하겠습니다. 다음 방문도 기대해 주세요.'),

-- ═══════════════════════════════════════════════════════
-- cleanliness / KO
-- ═══════════════════════════════════════════════════════
('cleanliness','ko',1,
 '청결 관련 불편을 말씀해 주셔서 감사합니다. 즉시 점검하고 개선하겠습니다.',
 '{{reviewer_name}}님, 방문해 주셔서 감사드립니다. 청결 상태로 인해 불편하셨다면 진심으로 죄송합니다. 고객님의 소중한 의견을 바탕으로 청소 인력 배치 및 위생 관리 시스템을 즉시 점검하고 강화하겠습니다.',
 '{{reviewer_name}}님, 불편한 경험을 겪으셨음에도 귀중한 피드백을 남겨 주셔서 감사드립니다. 청결 상태가 기대에 미치지 못했다면 진심으로 죄송합니다. 저희는 모든 고객님이 깨끗하고 쾌적한 환경에서 전시를 즐기실 수 있도록 하는 것을 기본 의무로 여기고 있습니다. 말씀해 주신 부분을 즉시 확인하고, 청소 주기 강화, 위생 점검 빈도 확대, 담당 구역 관리 체계 재정비 등의 조치를 신속히 시행하겠습니다. 다음 방문에서는 더욱 청결하고 쾌적한 환경을 경험하실 수 있도록 최선을 다하겠습니다.'),

('cleanliness','ko',2,
 '청결 불편을 말씀해 주셔서 감사합니다. 신속히 개선하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}} 방문에 감사드립니다. 관람 중 청결 상태로 불편함을 느끼셨다면 진심으로 죄송합니다. 해당 내용을 즉시 현장에 전달하고 위생 관리를 강화하겠습니다.',
 '{{reviewer_name}}님, 귀중한 의견 주셔서 감사드립니다. 청결 문제로 관람 경험이 저해되셨다니 진심으로 사과드립니다. 저희는 이 사항을 즉시 내부에 공유하여 청소 일정 재조정, 위생 점검 강화, 화장실 등 공용 공간 관리 체계 개선을 신속히 추진하겠습니다. 고객님의 피드백이 보다 쾌적한 관람 환경 조성에 직접적인 도움이 됩니다.'),

('cleanliness','ko',3,
 '청결 문제를 알려 주셔서 감사합니다. 즉시 조치하겠습니다.',
 '{{reviewer_name}}님, 불편 사항을 알려 주셔서 감사드립니다. 관람 환경의 청결 유지는 저희가 가장 기본적으로 지켜야 할 사항입니다. 말씀해 주신 내용을 즉시 점검하고 관리 시스템을 강화하여 모든 고객님이 쾌적한 환경에서 전시를 즐기실 수 있도록 하겠습니다.',
 '{{reviewer_name}}님, 소중한 피드백 감사드립니다. 청결 상태에 대한 불만을 말씀해 주셔서 매우 감사하며, 이를 심각하게 받아들이고 있습니다. 쾌적하고 위생적인 관람 환경은 저희가 반드시 보장해야 할 기본 사항입니다. 말씀해 주신 내용을 즉시 현장 관리팀에 공유하여 청소 주기 단축, 위생 점검 강화, 화장실 및 공용 공간 관리 시스템 개편 등의 조치를 즉각 시행하겠습니다.'),

('cleanliness','ko',4,
 '청결 불편 피드백에 감사드립니다. 즉시 시정하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사드립니다. 청결하지 않은 환경으로 인해 불쾌한 경험을 하셨다면 진심으로 죄송합니다. 고객님의 의견을 반영하여 시설 위생 관리를 즉시 강화하겠습니다.',
 '{{reviewer_name}}님, 방문해 주시고 귀중한 의견을 남겨 주셔서 감사드립니다. 관람 중 청결하지 않은 환경에서 불편함을 느끼셨다면 진심으로 죄송합니다. 이 사항은 저희가 즉시 조치해야 할 최우선 과제입니다. 청소 담당 인력 재배치, 관리 구역별 점검 강화, 화장실 및 공용 공간 위생 기준 상향 등의 조치를 신속히 취하겠습니다. 다음 방문에서는 언제나 청결하고 쾌적한 환경을 약속드립니다.'),

('cleanliness','ko',5,
 '청결 관련 불편을 알려 주셔서 감사합니다. 더 쾌적한 환경으로 개선하겠습니다.',
 '{{reviewer_name}}님, 소중한 의견 주셔서 감사드립니다. 청결 상태로 인해 불편하셨다면 정말 죄송합니다. 고객님의 의견을 즉시 반영하여 시설 위생 관리 체계를 전반적으로 점검하고 강화하겠습니다.',
 '{{reviewer_name}}님, 귀중한 피드백을 남겨 주셔서 진심으로 감사드립니다. 청결 문제로 관람의 즐거움이 반감되셨다면 정말 죄송합니다. 모든 고객님이 깨끗하고 쾌적한 환경에서 아르떼뮤지엄의 전시를 충분히 즐기실 수 있도록 하는 것은 저희의 기본 책임입니다. 고객님의 소중한 의견을 즉시 현장 관리팀에 전달하여 청소 주기 및 관리 기준 강화, 위생 점검 빈도 확대, 담당자 책임제 도입 등의 개선 조치를 신속히 시행하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- ticket_price / KO
-- ═══════════════════════════════════════════════════════
('ticket_price','ko',1,
 '가격 관련 의견 감사드립니다. 더 큰 가치와 경험을 드리기 위해 노력하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사드립니다. 입장료에 대한 부담을 느끼셨다면 이해합니다. 저희는 세계 수준의 몰입형 전시와 최고의 고객 경험을 제공하기 위한 지속적인 투자를 바탕으로 가격 정책을 운영하고 있습니다. 앞으로도 콘텐츠 및 서비스를 지속적으로 업그레이드하여 고객님이 충분한 가치를 느끼실 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 방문해 주시고 솔직한 의견을 남겨 주셔서 감사드립니다. 입장료에 대해 부담을 느끼셨다면 이해합니다. 저희 아르떼뮤지엄의 입장료는 세계 최고 수준의 디지털 아트 기술과 몰입형 전시 환경을 유지하기 위한 지속적인 투자에 기반하고 있습니다. 고객님의 소중한 의견을 바탕으로 다양한 할인 혜택과 패키지 프로그램을 지속적으로 검토하고 개선하겠습니다. 고객님이 방문할 때마다 충분한 감동과 가치를 경험하실 수 있도록 더욱 풍성한 콘텐츠로 보답드리겠습니다.'),

('ticket_price','ko',2,
 '가격 관련 의견 주셔서 감사합니다. 더욱 풍성한 콘텐츠로 보답드리겠습니다.',
 '{{reviewer_name}}님, 방문에 감사드립니다. 입장료에 대한 의견 주셔서 감사합니다. 아르떼뮤지엄은 국내외 최고 수준의 디지털 아트를 구현하기 위해 지속적으로 투자하고 있으며, 앞으로도 더욱 풍성한 전시 경험을 제공하기 위해 노력하겠습니다.',
 '{{reviewer_name}}님, 솔직한 의견 주셔서 진심으로 감사드립니다. 입장료가 부담스럽게 느껴지셨다면 이해합니다. 저희는 지속적으로 전시 콘텐츠를 업그레이드하고 새로운 경험을 추가하여 고객님이 방문하실 때마다 충분한 가치를 느끼실 수 있도록 노력하고 있습니다. 앞으로도 더욱 다양한 할인 프로그램과 함께 콘텐츠 확충에 집중하겠습니다.'),

('ticket_price','ko',3,
 '가격에 대한 솔직한 의견 감사합니다. 더 나은 가치 제공을 위해 노력하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사드립니다. 입장료에 대한 솔직한 의견 주셔서 감사합니다. 저희는 최고의 전시 환경 유지와 지속적인 콘텐츠 업그레이드를 통해 고객님이 가격 이상의 가치를 느끼실 수 있도록 더욱 노력하겠습니다.',
 '{{reviewer_name}}님, 솔직한 피드백 감사드립니다. 입장료에 대한 부담감을 느끼셨다면 충분히 이해합니다. 아르떼뮤지엄은 글로벌 수준의 디지털 아트 기술과 함께 끊임없이 변화하는 전시 콘텐츠를 유지하기 위한 지속적인 투자를 이어가고 있습니다. 고객님의 의견을 바탕으로 다양한 방문 패키지, 조기 예매 할인, 재방문 혜택 등을 검토하여 더욱 합리적인 방문 경험을 제공하기 위해 노력하겠습니다.'),

('ticket_price','ko',4,
 '입장료 관련 의견 감사합니다. 더 큰 만족을 드리기 위해 최선을 다하겠습니다.',
 '{{reviewer_name}}님, 방문해 주시고 솔직한 의견을 남겨 주셔서 감사드립니다. 가격이 부담스럽게 느껴지셨다면 이해합니다. 아르떼뮤지엄은 최고 수준의 몰입형 전시를 제공하기 위한 지속적인 투자를 이어가면서, 동시에 합리적인 방문 경험을 드리기 위한 방안도 꾸준히 검토하고 있습니다.',
 '{{reviewer_name}}님, 소중한 의견 주셔서 감사드립니다. 입장료에 대해 부담을 느끼셨다면 이 점을 진지하게 받아들이겠습니다. 아르떼뮤지엄은 세계 최고 수준의 디지털 아트를 구현하기 위한 지속적인 기술 투자와 콘텐츠 개발을 이어가고 있습니다. 고객님의 의견을 반영하여 다양한 할인 혜택, 패키지 상품, 재방문 혜택 등을 지속적으로 확대해 나가겠습니다. 앞으로도 가격 이상의 감동을 드릴 수 있도록 더욱 풍성한 전시로 보답드리겠습니다.'),

('ticket_price','ko',5,
 '가격 의견 주셔서 감사합니다. 더욱 합리적이고 풍성한 경험을 만들겠습니다.',
 '{{reviewer_name}}님, 방문에 감사드립니다. 입장료 관련 의견 주셔서 감사합니다. 저희는 최고 수준의 전시 환경과 서비스 유지를 위한 투자를 지속하면서, 동시에 고객님이 충분한 가치를 느끼실 수 있도록 콘텐츠를 더욱 풍성하게 만들어 나가겠습니다.',
 '{{reviewer_name}}님, 귀중한 의견을 남겨 주셔서 감사드립니다. 입장료에 대한 부담감을 솔직하게 말씀해 주신 점 감사하며, 저희도 이 부분을 중요하게 생각하고 있습니다. 고객님이 방문하실 때마다 충분한 가치와 감동을 느끼실 수 있도록 전시 콘텐츠를 지속적으로 업그레이드하고, 다양한 할인 혜택과 특별 프로그램을 확대하겠습니다. 앞으로도 아르떼뮤지엄이 모든 고객님께 최고의 가치를 제공할 수 있도록 끊임없이 노력하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- photo_zone / KO
-- ═══════════════════════════════════════════════════════
('photo_zone','ko',1,
 '멋진 사진 남기셨기를 바랍니다! 다음에도 인생샷 찍으러 오세요.',
 '{{reviewer_name}}님, {{branch_name}}에서 멋진 사진을 남기셨다니 정말 기쁩니다! 저희 공간이 특별한 순간을 기록하는 데 도움이 되었다면 무엇보다 보람을 느낍니다. 다음에 또 방문해 주시면 더욱 풍성한 포토 스팟으로 맞이하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서 소중한 순간을 사진으로 남기셨다는 말씀에 저희도 무척 기쁩니다. 아르떼뮤지엄은 단순히 보는 것을 넘어, 방문객이 예술과 하나가 되어 특별한 순간을 만들어 갈 수 있는 공간을 추구합니다. 새로운 전시가 준비될 때마다 더욱 다양하고 아름다운 포토 존을 선보일 예정이니 다음 방문도 기대해 주세요. 소중한 후기 남겨 주셔서 감사합니다!'),

('photo_zone','ko',2,
 '인생샷 건지셨기를 바랍니다! 아르떼에서 또 특별한 순간 만들어 드릴게요.',
 '{{reviewer_name}}님, 소중한 후기 감사드립니다. {{branch_name}}의 전시가 특별한 사진 추억을 선사했다니 저희도 매우 기쁩니다. 빛과 예술이 만나는 공간에서 멋진 사진을 남기셨기를 바랍니다. 다음 방문에도 새로운 포토 명소로 맞이하겠습니다!',
 '{{reviewer_name}}님, {{branch_name}}에서 특별한 사진을 남기셨다니 정말 기쁩니다. 저희 아르떼뮤지엄은 단순한 전시를 넘어, 빛과 색채가 어우러진 독특한 공간을 통해 모든 방문객이 각자만의 특별한 순간을 사진에 담을 수 있도록 끊임없이 새로운 포토 존과 인터랙티브 공간을 개발하고 있습니다. 다음 방문에서도 더욱 아름다운 공간에서 잊지 못할 사진을 남기실 수 있도록 준비하겠습니다.'),

('photo_zone','ko',3,
 '예쁜 사진 남기셨기를 바랍니다. 다음에도 찾아 주세요!',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사합니다. 전시 공간이 멋진 사진을 남기기 좋았다는 말씀에 저희도 기쁩니다. 아르떼뮤지엄의 아름다운 공간이 소중한 추억의 배경이 되었기를 바랍니다. 다음에도 찾아 주세요!',
 '{{reviewer_name}}님, 방문해 주시고 소중한 후기를 남겨 주셔서 감사합니다. {{branch_name}}의 전시 공간이 특별한 사진을 남기기 좋은 환경으로 기억에 남으셨다니 정말 기쁩니다. 저희는 빛과 예술이 완벽하게 어우러진 공간을 통해 모든 방문객이 인생샷을 남길 수 있도록 포토 존을 지속적으로 발전시키고 있습니다. 다음 방문에서는 더욱 새롭고 아름다운 공간에서 특별한 순간을 담아 가실 수 있도록 준비하겠습니다.'),

('photo_zone','ko',4,
 '멋진 사진 남기셨기를 바랍니다. 다음에도 새로운 포토 스팟으로 맞이하겠습니다!',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주셔서 감사드립니다. 저희 전시 공간에서 특별한 사진을 남기셨다면 저희로서는 가장 큰 보람입니다. 앞으로도 더욱 다채롭고 아름다운 포토 스팟을 선보일 예정이니 많은 기대 부탁드립니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 따뜻한 후기까지 남겨 주셔서 감사합니다. 저희 아르떼뮤지엄은 단순히 예술을 관람하는 것을 넘어, 방문객이 공간과 하나가 되어 특별한 순간을 만들어 갈 수 있는 경험을 추구합니다. 앞으로도 빛과 색채가 만들어 내는 독창적인 포토 존을 지속적으로 확대하고 새롭게 선보여 다음 방문에서도 더욱 특별한 추억을 남기실 수 있도록 최선을 다하겠습니다.'),

('photo_zone','ko',5,
 '사진 예쁘게 나왔기를 바랍니다. 다음에도 새로운 포토 명소에서 만나요!',
 '{{reviewer_name}}님, 방문 후기 감사드립니다. {{branch_name}}의 아름다운 공간이 특별한 사진을 남기기에 좋았다니 기쁩니다. 저희는 지속적으로 새로운 포토 스팟과 체험 공간을 개발하여 다음 방문에서도 더욱 특별한 순간을 선사할 수 있도록 하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 기쁜 후기를 남겨 주셔서 진심으로 감사드립니다. 빛과 예술이 어우러진 공간에서 소중한 사진을 남기셨다는 말씀에 저희 팀도 함께 기뻐합니다. 아르떼뮤지엄은 앞으로도 인터랙티브 아트와 몰입형 환경을 지속적으로 업그레이드하여 방문하실 때마다 새롭고 더 아름다운 포토 존을 만나실 수 있도록 끊임없이 노력하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- immersive_exp / KO
-- ═══════════════════════════════════════════════════════
('immersive_exp','ko',1,
 '몰입 경험에 감동받으셨다니 정말 기쁩니다! 다음에도 더 큰 감동으로 찾아뵙겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서 깊은 몰입 경험을 하셨다니 무엇보다 기쁩니다. 아르떼뮤지엄이 추구하는 가장 큰 가치는 바로 방문객 한 분 한 분이 예술 속에 완전히 빠져드는 경험입니다. 다음 방문에서도 더욱 새롭고 깊은 감동을 드릴 수 있도록 최선을 다하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서 깊은 몰입 경험을 하셨다는 말씀에 저희 팀 모두가 함께 기뻐합니다. 아르떼뮤지엄이 추구하는 핵심 가치는 방문객이 일상의 경계를 넘어 예술과 완전히 하나가 되는 순간을 경험하는 것입니다. 이를 위해 저희는 최첨단 디지털 아트 기술과 감성적인 공간 설계를 끊임없이 연구하고 있습니다. 고객님의 감동적인 경험이 저희의 방향이 옳다는 것을 다시 한번 확인시켜 줍니다. 다음 방문에서도 더욱 깊고 새로운 몰입 경험을 드릴 수 있도록 최선을 다하겠습니다.'),

('immersive_exp','ko',2,
 '몰입감 있는 전시를 즐기셨다니 저희도 기쁩니다!',
 '{{reviewer_name}}님, {{branch_name}}에서 몰입감 있는 경험을 하셨다니 정말 기쁩니다. 저희가 추구하는 것은 바로 고객님처럼 전시에 완전히 빠져드는 경험입니다. 앞으로도 더욱 풍부한 디지털 아트 경험을 선보이겠습니다.',
 '{{reviewer_name}}님, 아르떼뮤지엄에서 깊은 몰입 경험을 하셨다는 소식이 저희에게는 가장 큰 보람입니다. 저희는 단순한 전시를 넘어, 관람객이 예술과 기술의 경계에서 새로운 차원의 감동을 경험할 수 있는 공간을 만들기 위해 끊임없이 혁신하고 있습니다. 고객님의 소중한 경험이 앞으로의 발전 방향에 큰 나침반이 됩니다. 더욱 발전된 몰입 경험으로 다시 찾아뵙겠습니다.'),

('immersive_exp','ko',3,
 '몰입감 있는 전시를 즐기셨다니 기쁩니다. 더 나은 경험으로 보답드리겠습니다!',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 소중한 후기를 남겨 주셔서 감사합니다. 저희 전시에서 깊은 몰입을 경험하셨다니 무엇보다 기쁩니다. 앞으로도 더욱 혁신적이고 감동적인 디지털 아트 경험으로 찾아뵙겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서의 몰입 경험을 공유해 주셔서 진심으로 감사드립니다. 아르떼뮤지엄은 방문객이 일상에서 벗어나 예술과 기술이 만들어 내는 새로운 세계에 완전히 빠져들 수 있는 경험을 제공하는 것을 최우선 목표로 합니다. 고객님의 감동적인 경험을 통해 저희의 방향이 옳다는 확신을 가지게 됩니다. 더욱 혁신적인 콘텐츠와 공간으로 다음 방문을 준비하겠습니다.'),

('immersive_exp','ko',4,
 '몰입감 경험에 감사드립니다. 더 깊은 감동으로 또 찾아뵙겠습니다!',
 '{{reviewer_name}}님, {{branch_name}}에서 몰입감 있는 경험을 하셨다니 저희도 정말 기쁩니다. 아르떼뮤지엄이 추구하는 가치는 바로 일상에서 벗어나 빛과 색채 속에 완전히 빠져드는 순간입니다. 앞으로도 더욱 발전된 디지털 아트로 찾아뵙겠습니다.',
 '{{reviewer_name}}님, 아르떼뮤지엄에서 깊은 몰입 경험을 하셨다니 저희 팀 모두가 정말 기쁘고 보람을 느낍니다. 저희는 최첨단 디지털 기술과 예술적 감성을 결합하여 방문객이 전시 공간 속에 완전히 녹아드는 특별한 경험을 만들기 위해 끊임없이 연구하고 있습니다. 고객님의 소중한 경험이 저희의 가장 큰 원동력입니다. 더욱 혁신적이고 감동적인 전시로 다시 찾아뵙겠습니다.'),

('immersive_exp','ko',5,
 '몰입 경험에 감동받으셨다니 기쁩니다! 다음에도 더 특별한 경험을 선사하겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}에서 몰입감 있는 전시를 즐기셨다는 말씀에 저희도 함께 기쁩니다. 아르떼뮤지엄의 전시가 일상에서 벗어난 특별한 경험이 되셨기를 바랍니다. 앞으로도 더욱 풍성하고 다양한 몰입형 콘텐츠로 찾아뵙겠습니다.',
 '{{reviewer_name}}님, {{branch_name}}을 방문해 주시고 감동적인 후기를 남겨 주셔서 진심으로 감사드립니다. 아르떼뮤지엄에서 깊은 몰입 경험을 하셨다는 말씀이 저희 팀에게는 가장 큰 보람이자 원동력입니다. 저희는 앞으로도 빛과 예술과 기술이 완벽하게 어우러진 세계 최고 수준의 몰입형 공간을 만들기 위해 끊임없이 혁신하고 발전해 나가겠습니다. 다음 방문에서도 더욱 새롭고 깊은 감동을 드릴 수 있도록 준비하겠습니다.'),

-- ═══════════════════════════════════════════════════════
-- child_friendly / KO
-- ═══════════════════════════════════════════════════════
('child_friendly','ko',1,
 '가족과 함께 즐거운 시간을 보내셨다니 기쁩니다!',
 '{{reviewer_name}}님, 가족과 함께 {{branch_name}}을 방문해 주셔서 감사드립니다. 아이들도 즐거운 시간을 보내셨다니 저희로서는 가장 큰 보람입니다. 앞으로도 온 가족이 함께 즐길 수 있는 콘텐츠를 지속적으로 개발하겠습니다.',
 '{{reviewer_name}}님, 소중한 가족과 함께 {{branch_name}}을 방문해 주셔서 진심으로 감사드립니다. 아이들도 전시에서 즐거운 경험을 했다니 저희 팀 모두가 매우 기쁩니다. 아르떼뮤지엄은 남녀노소 모든 세대가 함께 예술의 감동을 나눌 수 있는 공간을 만들기 위해 끊임없이 노력하고 있습니다. 앞으로도 어린이부터 어른까지 모두가 즐길 수 있는 다양한 체험 콘텐츠를 지속적으로 개발하겠습니다. 다음에도 온 가족과 함께 찾아 주세요!'),

('child_friendly','ko',2,
 '온 가족이 즐거운 시간을 보내셨다니 기쁩니다! 또 찾아 주세요.',
 '{{reviewer_name}}님, {{branch_name}}을 온 가족과 함께 방문해 주셔서 감사합니다. 아이들과 함께 특별한 추억을 만드셨다니 저희도 정말 기쁩니다. 앞으로도 온 가족이 즐길 수 있는 다양한 콘텐츠와 프로그램으로 찾아뵙겠습니다.',
 '{{reviewer_name}}님, 소중한 가족과 함께 방문해 주시고 따뜻한 후기를 남겨 주셔서 감사드립니다. 어린아이부터 어른까지 모두가 아르떼뮤지엄에서 즐거운 시간을 보내셨다니 저희 팀 모두가 기쁩니다. 저희는 앞으로도 가족 방문객을 위한 체험형 콘텐츠, 어린이 전용 프로그램, 가족 편의시설 개선 등을 지속적으로 추진하여 온 가족이 함께 즐기실 수 있는 최고의 문화 공간을 만들어 나가겠습니다.'),

('child_friendly','ko',3,
 '온 가족이 행복한 시간을 보내셨기를 바랍니다. 또 찾아 주세요!',
 '{{reviewer_name}}님, 가족과 함께 방문해 주셔서 감사드립니다. 아이들도 전시를 즐겁게 관람했다니 저희도 기쁩니다. 앞으로도 온 가족이 함께하는 특별한 시간이 될 수 있도록 다양한 패밀리 프로그램을 준비하겠습니다.',
 '{{reviewer_name}}님, 소중한 가족과 함께 {{branch_name}}을 찾아 주셔서 진심으로 감사드립니다. 어린 자녀분들이 아르떼뮤지엄에서 즐거운 경험을 하셨다는 말씀에 저희도 함께 기쁩니다. 모든 세대가 함께 예술과 기술의 감동을 경험할 수 있는 공간을 만드는 것이 아르떼뮤지엄의 핵심 가치 중 하나입니다. 앞으로도 어린이 체험 프로그램 강화, 가족 관람 편의 시설 개선, 패밀리 패키지 등을 지속적으로 개발하겠습니다.'),

('child_friendly','ko',4,
 '아이들과 즐거운 시간을 보내셨다니 기쁩니다! 다음에도 온 가족과 함께 와 주세요.',
 '{{reviewer_name}}님, 가족과 함께 {{branch_name}}을 방문해 주셔서 감사드립니다. 아이들도 함께 즐겁게 관람하셨다니 저희로서는 무엇보다 큰 보람입니다. 앞으로도 온 가족이 즐길 수 있는 콘텐츠와 편의시설 개선에 꾸준히 힘쓰겠습니다.',
 '{{reviewer_name}}님, 사랑하는 가족과 함께 방문해 주시고 기쁜 후기를 남겨 주셔서 진심으로 감사드립니다. 어린아이부터 어른까지 온 가족이 아르떼뮤지엄에서 즐거운 시간을 보내셨다니 저희 팀 모두가 기쁩니다. 저희는 앞으로도 다양한 연령대의 방문객 모두가 예술과 기술이 만들어 내는 감동을 함께 나눌 수 있는 공간을 만들기 위해 지속적으로 노력하겠습니다.'),

('child_friendly','ko',5,
 '가족 방문 후기 감사드립니다! 다음에도 즐거운 시간 보내세요.',
 '{{reviewer_name}}님, 가족과 함께 방문해 주셔서 감사드립니다. 아이들도 전시를 즐겼다니 저희도 기쁩니다. 앞으로도 온 가족이 특별한 추억을 만들 수 있는 공간으로 발전하겠습니다.',
 '{{reviewer_name}}님, 소중한 가족과 함께 {{branch_name}}을 방문해 주셔서 진심으로 감사드립니다. 온 가족이 즐거운 시간을 보내셨다니 저희에게는 가장 큰 보람입니다. 아르떼뮤지엄은 앞으로도 어린이 친화적인 전시 환경, 가족 편의시설 강화, 다양한 체험 프로그램 개발을 통해 온 가족이 함께 즐길 수 있는 최고의 문화 공간으로 발전해 나가겠습니다. 다음에도 가족과 함께 찾아 주세요!'),

-- ═══════════════════════════════════════════════════════
-- positive_overall / EN
-- ═══════════════════════════════════════════════════════
('positive_overall','en',1,
 'Thank you for visiting {{branch_name}} and sharing your wonderful experience!',
 'Thank you so much, {{reviewer_name}}, for visiting {{branch_name}} and leaving such a kind review. Your positive words mean a great deal to our entire team. We look forward to welcoming you back for another unforgettable experience.',
 'Dear {{reviewer_name}}, thank you for taking the time to visit {{branch_name}} and for sharing your experience with us. Your kind words inspire our entire team to continue delivering world-class immersive art experiences. At ARTE Museum, we are dedicated to pushing the boundaries of digital art and light installations to create unforgettable moments for every guest. We truly look forward to welcoming you back soon.'),

('positive_overall','en',2,
 'So glad you loved your visit to {{branch_name}}! We hope to see you again soon.',
 'Hello {{reviewer_name}}! Thank you for visiting {{branch_name}} and for your wonderful review. It means the world to us that you had such a positive experience. We are constantly working to elevate our exhibitions, and your feedback encourages us to keep pushing forward. We hope to see you again very soon!',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for the lovely review you have left. Knowing that our guests leave with a smile and lasting memories is what drives us every day. ARTE Museum is committed to delivering world-class digital art experiences that captivate and inspire, and your enthusiasm is our greatest reward. We look forward to welcoming you back and sharing even more extraordinary moments together.'),

('positive_overall','en',3,
 'Thank you for your fantastic review of {{branch_name}}! Your words inspire us.',
 '{{reviewer_name}}, thank you so much for your kind words about {{branch_name}}. It is truly wonderful to hear that you had such a great experience. Our team works tirelessly to create an exceptional environment, and your feedback is the best reward we could ask for. We hope to see you again soon!',
 'Dear {{reviewer_name}}, we are so grateful for your glowing review of {{branch_name}}. At ARTE Museum, we pour our passion into every detail — from the lighting and digital displays to the overall atmosphere — to ensure every guest leaves feeling truly inspired. Your positive experience reaffirms that we are on the right path. Thank you for being part of the ARTE community, and we look forward to welcoming you back for another memorable visit.'),

('positive_overall','en',4,
 'We are thrilled you enjoyed {{branch_name}}! Thank you for sharing your experience.',
 'Thank you, {{reviewer_name}}, for visiting {{branch_name}} and for leaving such a warm review. Your positive experience is the driving force behind everything we do. We are committed to continuously improving our exhibitions and services, and we hope to see you back again very soon.',
 'Dear {{reviewer_name}}, what a pleasure it is to read your wonderful review of {{branch_name}}. Your kind words remind us why we are so passionate about what we do — creating immersive, world-class art experiences that resonate deeply with every guest. We are continuously investing in new content and technology to ensure each visit brings fresh inspiration. We hope to welcome you back soon and deliver an experience that exceeds your expectations once again.'),

('positive_overall','en',5,
 'Hearing that you loved {{branch_name}} makes our day! Thank you for visiting.',
 '{{reviewer_name}}, thank you for your kind review of {{branch_name}}. Your appreciation is the highest compliment we can receive. We work hard every day to create an exceptional space where art and technology come together, and it is wonderful to know that our efforts made a difference. We look forward to your next visit!',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for the kind words you have shared. Your positive feedback is a tremendous source of motivation for our entire team. ARTE Museum exists to create transformative, immersive art experiences that stay with guests long after they leave. We are constantly evolving our exhibitions to bring new stories and emotions to life. We cannot wait to welcome you back and share the next chapter with you.'),

-- ═══════════════════════════════════════════════════════
-- crowd_complaint / EN
-- ═══════════════════════════════════════════════════════
('crowd_complaint','en',1,
 'Thank you for your feedback about the crowds. We are actively working to improve visitor flow.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for sharing your honest feedback. We sincerely apologize that overcrowding affected your experience. We truly appreciate your input and are actively reviewing our visitor management systems, including timed entry and capacity controls, to create a more comfortable environment. We hope to welcome you back under much improved conditions.',
 'Dear {{reviewer_name}}, thank you for taking the time to share your experience at {{branch_name}}. We are genuinely sorry that the crowds made it difficult to fully enjoy our exhibitions. Your feedback is exactly what we need to make meaningful improvements. We are currently reviewing and implementing measures including timed entry slots, enhanced crowd flow management, and real-time capacity monitoring to ensure a more comfortable visit for every guest. We value your input greatly and hope to welcome you back to a significantly improved experience.'),

('crowd_complaint','en',2,
 'We apologize for the crowding and are taking steps to improve the visitor experience.',
 '{{reviewer_name}}, thank you for your valuable feedback about {{branch_name}}. We are sorry to hear that crowding impacted your visit. We take this feedback seriously and are working on improving our entry management and visitor flow systems. We hope you will give us another chance to provide the comfortable, immersive experience you deserve.',
 'Dear {{reviewer_name}}, we appreciate your honest feedback about {{branch_name}}. We apologize that the volume of visitors made it difficult to fully immerse yourself in the experience — that is precisely the opposite of what we aim to deliver. We are actively working to address this by enhancing our reservation system, staggering entry times, and optimizing the visitor flow throughout the space. Your feedback is invaluable in helping us build a better experience for all guests, and we sincerely hope to welcome you back soon.'),

('crowd_complaint','en',3,
 'Thank you for letting us know about the crowds. Improving your comfort is our priority.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for sharing your experience. We apologize that the crowding made your visit less enjoyable than it should have been. We appreciate your feedback and are implementing improvements to our entry management and capacity control to ensure a more comfortable environment. We hope to see you again soon.',
 '{{reviewer_name}}, thank you for your candid feedback about the visitor experience at {{branch_name}}. We are sorry that overcrowding prevented you from fully enjoying our immersive exhibitions. Creating a comfortable and serene environment is fundamental to the ARTE Museum experience, and we take your feedback very seriously. We are actively reviewing our visitor management processes, including capacity restrictions, timed entry improvements, and real-time crowd monitoring. We sincerely hope you will give us another opportunity to deliver the experience you deserve.'),

('crowd_complaint','en',4,
 'Your feedback on the crowds has been noted. We are committed to improving visitor comfort.',
 '{{reviewer_name}}, thank you for visiting {{branch_name}} and for sharing your feedback. We apologize for the crowding that impacted your experience. We are actively working on enhanced visitor management strategies to ensure all guests can enjoy our exhibitions in a comfortable and immersive setting. We look forward to welcoming you back.',
 'Dear {{reviewer_name}}, thank you for your honest review of {{branch_name}}. We sincerely apologize that the high volume of visitors affected the quality of your experience. At ARTE Museum, we strive to provide a serene and deeply immersive environment for every guest, and we recognize that overcrowding undermines this goal. We are actively implementing improvements including timed entry reservations, dynamic capacity management, and enhanced crowd flow guidance to ensure all guests enjoy a comfortable visit. We truly hope to welcome you back and provide a much more enjoyable experience.'),

('crowd_complaint','en',5,
 'Thank you for the feedback on the crowds. We hear you and are working on solutions.',
 '{{reviewer_name}}, thank you for visiting {{branch_name}} and leaving your honest review. We are sorry the crowds made your visit less enjoyable. Your feedback is taken seriously and we are working on visitor flow improvements, including better entry management and capacity controls. We hope to welcome you back for a more comfortable experience soon.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and sharing your experience. We sincerely apologize for the discomfort caused by the large number of visitors during your visit. We understand how important it is to have a peaceful, immersive atmosphere in which to experience ARTE Museum, and we are committed to improving this. We are actively enhancing our ticketing system, implementing timed entry, and improving real-time crowd management to create a more comfortable visit for every guest. We hope you will return and allow us to deliver the experience you truly deserve.'),

-- ═══════════════════════════════════════════════════════
-- wait_time / EN
-- ═══════════════════════════════════════════════════════
('wait_time','en',1,
 'We apologize for the long wait and are actively working to improve our entry process.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for your honest feedback. We are truly sorry that the wait time detracted from your experience. We are actively reviewing and improving our reservation system and entry management to reduce waiting times. We hope you will give us another chance to provide a seamless and enjoyable experience.',
 'Dear {{reviewer_name}}, thank you for sharing your experience at {{branch_name}}. We sincerely apologize for the lengthy wait time you experienced. Your time is precious, and a long wait before even entering the exhibition is something we are committed to addressing. We are currently working on enhancing our online reservation system, implementing dynamic entry time management, and increasing staffing at peak hours to minimize waiting times for all guests. We truly value your feedback and hope to welcome you back to a much smoother experience very soon.'),

('wait_time','en',2,
 'Thank you for the feedback on wait times. Your experience helps us improve.',
 '{{reviewer_name}}, we apologize that the wait time negatively impacted your visit to {{branch_name}}. We take this feedback very seriously and are working hard to improve our entry process and reduce waiting times. We appreciate your patience and hope to provide a much smoother experience on your next visit.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for your candid feedback. We are genuinely sorry that you had to wait so long before enjoying our exhibitions. At ARTE Museum, we want every moment — from arrival to departure — to be an outstanding experience, and we recognize that a long queue falls far short of that standard. We are actively implementing improvements to our ticketing and entry systems, including priority time slots, advanced booking options, and real-time queue management. We hope you will return and experience the smooth, enjoyable visit you deserved from the start.'),

('wait_time','en',3,
 'We hear your feedback on waiting times and are committed to improving the entry experience.',
 'Thank you, {{reviewer_name}}, for visiting {{branch_name}} and sharing your honest review. We sincerely apologize for the inconvenience caused by long wait times. Improving our entry management and reservation system is a top priority, and we are actively working on solutions to ensure all guests enjoy a smooth and comfortable arrival experience.',
 'Dear {{reviewer_name}}, we appreciate you taking the time to share your experience at {{branch_name}}. We are truly sorry that the long wait time made your visit less enjoyable than it should have been. Minimizing wait times and ensuring a seamless entry experience is something we are committed to improving. We are currently reviewing our timed entry system, capacity allocation, and on-site queue management processes to significantly reduce waiting times. Your feedback is invaluable and will directly inform these improvements. We look forward to welcoming you back for a much better experience.'),

-- ═══════════════════════════════════════════════════════
-- staff_complaint / EN
-- ═══════════════════════════════════════════════════════
('staff_complaint','en',1,
 'We sincerely apologize for the experience with our staff and are committed to improving.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for your honest feedback. We are truly sorry that a member of our team fell short of the warm and professional service we strive to provide. We take this feedback very seriously and will use it to strengthen our staff training and service standards. We hope to welcome you back and demonstrate the level of hospitality you deserve.',
 'Dear {{reviewer_name}}, we sincerely appreciate you taking the time to share your experience at {{branch_name}}. We are very sorry to hear that our staff did not meet the high standards of service that ARTE Museum is committed to providing. Every guest deserves to be treated with warmth, professionalism, and genuine care — and we apologize that this was not your experience. We are immediately reviewing this feedback with our team and will be reinforcing our customer service training and hospitality standards. We hope you will give us the opportunity to make this right, and we look forward to welcoming you back with the service you truly deserve.'),

('staff_complaint','en',2,
 'We are very sorry for the poor service experience and will address this immediately.',
 '{{reviewer_name}}, thank you for your honest feedback about {{branch_name}}. We sincerely apologize for the experience you had with our staff. This is not the standard of service we hold ourselves to, and we are taking immediate steps to address this. We are committed to providing every guest with a warm, professional, and memorable experience, and we hope to have the opportunity to show you that on your next visit.',
 'Dear {{reviewer_name}}, thank you for sharing your experience at {{branch_name}}. We are deeply sorry to hear that our staff did not provide the level of service you expected and deserved. At ARTE Museum, delivering exceptional, warmhearted service is as important to us as delivering world-class art. We are addressing your feedback directly with our team and will be reinforcing our training and service protocols to ensure all guests are welcomed with the care and professionalism they deserve. We truly hope you will allow us to restore your faith in us by welcoming you back.'),

('staff_complaint','en',3,
 'Thank you for letting us know. We sincerely apologize and will work to improve our service.',
 '{{reviewer_name}}, thank you for your candid feedback about your visit to {{branch_name}}. We are sorry to hear that our team did not meet the service standards we hold ourselves to. Your feedback is invaluable, and we are committed to improving our staff training and guest interactions immediately. We hope to welcome you back and provide the excellent service you deserve.',
 'Dear {{reviewer_name}}, we truly appreciate your honest review of {{branch_name}} and sincerely apologize for the service experience that fell short of your expectations. Every guest who visits ARTE Museum deserves to be welcomed with genuine warmth and professionalism. We are taking your feedback very seriously and are immediately implementing enhanced service training and customer experience reviews across our team. We hope this experience does not deter you from returning, as we are fully committed to showing you the level of hospitality that reflects our true values.'),

-- ═══════════════════════════════════════════════════════
-- staff_praise / EN
-- ═══════════════════════════════════════════════════════
('staff_praise','en',1,
 'Thank you for the kind words about our staff! Your recognition means so much to us.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for the wonderful compliment about our team. Your kind words will be shared with the staff members who made your visit special. We truly believe that exceptional service is as important as exceptional art, and your review confirms that we are on the right track. We look forward to welcoming you back!',
 'Dear {{reviewer_name}}, thank you so much for visiting {{branch_name}} and for taking the time to praise our staff. Your kind words will be passed directly to the team members who served you, and I have no doubt they will be deeply appreciated. At ARTE Museum, we believe that the warmth and professionalism of our team is what transforms a great exhibition into an unforgettable experience. Your recognition motivates all of us to continue delivering exceptional hospitality. We look forward to welcoming you back very soon.'),

('staff_praise','en',2,
 'Your praise for our team truly makes our day! Thank you for sharing.',
 '{{reviewer_name}}, thank you for visiting {{branch_name}} and for the lovely feedback about our staff! Hearing that our team made a positive impact on your visit is incredibly rewarding. We will make sure to share your kind words with the relevant staff members. We hope to see you back again soon!',
 '{{reviewer_name}}, thank you for the wonderful review of {{branch_name}} and especially for the kind words about our team. We firmly believe that exceptional service goes hand in hand with exceptional art, and it is truly gratifying to hear that our staff exceeded your expectations. Your feedback will be shared with the entire team as a source of motivation and pride. We look forward to welcoming you back soon and delivering another memorable experience.'),

('staff_praise','en',3,
 'How wonderful to hear that our team made your visit special! Thank you for letting us know.',
 'Dear {{reviewer_name}}, thank you for visiting {{branch_name}} and for the warm praise you shared about our staff. It means a great deal to our team to know that they contributed positively to your experience. We will pass along your kind words to those who helped make your visit special. We look forward to seeing you again soon!',
 'Dear {{reviewer_name}}, what a wonderful review to receive! Thank you so much for visiting {{branch_name}} and for highlighting the efforts of our staff. At ARTE Museum, we invest deeply in training our team to deliver not just excellent service, but genuinely memorable moments for every guest. Your kind words are a wonderful reminder that these efforts make a real difference. We will certainly share your feedback with the team, and we look forward to welcoming you back for another outstanding visit.')

ON CONFLICT (intent_code, language, variant_num) DO NOTHING;

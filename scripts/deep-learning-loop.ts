/**
 * deep-learning-loop.ts
 *
 * 다국어·다인종·다연령·다성별 합성 리뷰 150+ 자동 생성 → processReview() → 심층 품질 분석
 * → 패턴별 문제 수집 → 콘솔 출력 (수동 코드 개선 가이드)
 *
 * 실행: npx tsx scripts/deep-learning-loop.ts
 */

import { processReview } from '../src/lib/reviewProcessor'

// ═══════════════════════════════════════════════════════════════
//  합성 리뷰 데이터셋 — 다양한 언어/인종/나이/성별/상황 조합
// ═══════════════════════════════════════════════════════════════

interface SyntheticReview {
  rating: number
  review_text: string
  reviewer_name: string
  location: 'AMLV' | 'AMDB' | 'AMNY'
  lang: 'ko' | 'en' | 'ja' | 'zh'
  demographic: string   // 분석용 메타데이터
  scenario: string      // 어떤 시나리오를 테스트하는지
}

const SYNTHETIC_REVIEWS: SyntheticReview[] = [
  // ────────────────────────────────────────────────────────────
  // [KO] 5★ COMPLIMENT — 다양한 긍정 표현
  // ────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '30대 한국인 여성', scenario: 'pure-compliment-healing',
    reviewer_name: '박지혜',
    review_text: '진짜 힐링 그 자체였어요. 라스베가스 왔다가 우연히 들렀는데 이게 여행 하이라이트가 될 줄은 몰랐습니다. 다음에 또 올게요!' },
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '20대 한국인 남성 커플', scenario: 'date-compliment',
    reviewer_name: '임준혁',
    review_text: '여자친구랑 두바이 여행 중에 왔는데 완전 대박. 파도 방에서 찍은 사진이 인생샷 됐어요. 여기 안 오면 두바이 여행 후회할 듯.' },
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '40대 한국인 부모', scenario: 'family-kids-compliment',
    reviewer_name: '정미영',
    review_text: '초등학생 아이 둘이랑 왔는데 아이들이 너무 좋아해서 오히려 제가 더 즐거웠어요. 미디어아트가 이렇게 친근할 수 있다니. 뉴욕 방문객이라면 필수 코스!' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '50대 한국인 남성', scenario: 'solo-business-trip',
    reviewer_name: '최봉준',
    review_text: '출장 중 혼자 다녀왔습니다. 조용히 작품 감상하기 좋았고, 평일이라 인파도 없어서 여유롭게 즐겼습니다. 향기 나는 숲 공간이 오랜만에 마음을 비워줬어요.' },
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '60대 한국인 부부', scenario: 'elderly-couple-compliment',
    reviewer_name: '이순자',
    review_text: '남편과 결혼 40주년 기념으로 두바이 여행 왔다가 들렀어요. 이 나이에도 이렇게 동심이 느껴지는 공간이 있다는 게 신기했습니다. 정말 아름다워요.' },

  // ────────────────────────────────────────────────────────────
  // [EN] 5★ COMPLIMENT — Various ethnicities & ages
  // ────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '25yo American female, solo', scenario: 'instagram-focused',
    reviewer_name: 'Madison Rivera',
    review_text: 'Every single room is photogenic. I spent nearly two hours here and barely scratched the surface. The flower room made me tear up — honestly not sure why, just incredibly moving.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '35yo Indian male, family', scenario: 'family-experience',
    reviewer_name: 'Arjun Sharma',
    review_text: 'Brought my two daughters (ages 6 and 9) and they absolutely loved every room. The interactive wave section kept them busy for 20 minutes alone. Worth every dirham.' },
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '45yo Black American female', scenario: 'art-connoisseur',
    reviewer_name: 'Jasmine Washington',
    review_text: 'As someone who visits art museums weekly, I was skeptical of "immersive" experiences. This proved me wrong entirely. The use of scent alongside visuals creates a synesthetic experience few installations achieve.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '28yo Latino couple', scenario: 'anniversary',
    reviewer_name: 'Carlos Mendoza',
    review_text: 'Our anniversary was absolutely perfect here. The Tea Bar at the end was such a thoughtful touch. My partner is still talking about the cherry blossom room three days later.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '55yo British tourist, female', scenario: 'returning-visitor',
    reviewer_name: 'Charlotte Hughes',
    review_text: 'Second time visiting, this time with my sister who had never been. It never gets old. The content has been refreshed since my last visit — the night sky section is new and stunning.' },
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '22yo Korean-American student', scenario: 'first-time-impressed',
    reviewer_name: 'Jenny Kim',
    review_text: "I go to a lot of pop-up art experiences in NYC and this is genuinely the best one. Don't let the ticket price scare you — it's worth it and then some. The scent design alone deserves an award." },
  { rating: 4, location: 'AMLV', lang: 'en', demographic: '38yo Australian male', scenario: '4star-minor-complaint',
    reviewer_name: 'Liam Fitzgerald',
    review_text: 'Fantastic exhibition overall. The only thing keeping this from 5 stars is the queue management — needs a proper timed entry system. But the art itself is world-class.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '30yo Japanese expat female', scenario: '4star-duration',
    reviewer_name: 'Yuki Tanaka',
    review_text: 'Beautiful and immersive. I would have given 5 stars but felt it was over too quickly for the price. Still absolutely recommend — just budget an extra 30 minutes for the Tea Bar.' },

  // ────────────────────────────────────────────────────────────
  // [JA] Reviews — Japanese speakers
  // ────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ja', demographic: '30代 日本人女性, 友人と', scenario: 'ja-pure-compliment',
    reviewer_name: '山田花子',
    review_text: '友人と訪れましたが、本当に夢の中にいるような体験でした。照明と香りの組み合わせが素晴らしく、写真では伝えられない感動があります。ドバイに来たら絶対に来るべき場所です！' },
  { rating: 5, location: 'AMLV', lang: 'ja', demographic: '40代 日本人男性, 家族旅行', scenario: 'ja-family',
    reviewer_name: '田中健二',
    review_text: 'ラスベガス旅行で家族で訪問。子供たちが大喜びで、普段はすぐ飽きる上の子（10歳）も最後まで楽しんでいました。インタラクティブな体験が特に素晴らしかったです。' },
  { rating: 3, location: 'AMNY', lang: 'ja', demographic: '25代 日本人女性, 一人旅', scenario: 'ja-mixed-review',
    reviewer_name: '佐藤美咲',
    review_text: '映像美は確かに素晴らしいのですが、会場内の混雑がひどく、ゆっくり鑑賞できませんでした。特に週末は覚悟が必要だと思います。平日に再訪したいです。' },
  { rating: 1, location: 'AMDB', lang: 'ja', demographic: '35代 日本人男性', scenario: 'ja-staff-complaint',
    reviewer_name: '鈴木太郎',
    review_text: 'スタッフの対応が非常に残念でした。質問しても無視され、案内も不十分。展示自体は綺麗でしたが、スタッフの態度のせいで楽しめませんでした。改善を強く求めます。' },
  { rating: 5, location: 'AMLV', lang: 'ja', demographic: '50代 日本人夫婦', scenario: 'ja-elderly-couple',
    reviewer_name: '中村幸子',
    review_text: '夫婦でラスベガス旅行の際に立ち寄りました。こんなに美しい空間とは思っておらず、二人で感動してしまいました。ティーバーのお茶も上品でとても良かったです。また来たいです。' },
  { rating: 2, location: 'AMNY', lang: 'ja', demographic: '28代 日本人', scenario: 'ja-value-complaint',
    reviewer_name: '伊藤さくら',
    review_text: 'チケット代が高い割に見応えが少なかったです。30分ほどで全部回ってしまいました。映像は綺麗でしたが、この価格なら内容をもう少し充実させてほしいです。' },

  // ────────────────────────────────────────────────────────────
  // [ZH] Reviews — Chinese speakers
  // ────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'zh', demographic: '30岁中国女性, 闺蜜游', scenario: 'zh-pure-compliment',
    reviewer_name: '李雨欣',
    review_text: '跟闺蜜一起来的，整个体验太美了！每个房间都是不同的主题，光影和香气的结合让人感觉置身梦境。强烈推荐给所有来迪拜的朋友，绝对不虚此行！' },
  { rating: 5, location: 'AMLV', lang: 'zh', demographic: '35岁中国男性, 家庭', scenario: 'zh-family',
    reviewer_name: '王志强',
    review_text: '带着孩子来的，孩子完全看呆了。互动区让她玩得不亦乐乎，我们大人也沉浸其中。这种体验在国内很难见到，来拉斯维加斯一定要来！' },
  { rating: 2, location: 'AMNY', lang: 'zh', demographic: '25岁中国女性', scenario: 'zh-crowd-complaint',
    reviewer_name: '陈婷婷',
    review_text: '展览本身很美，但人太多了，根本没办法好好欣赏。工作人员对人流控制几乎没有，大家都在互相挤来挤去拍照。希望能加强现场管理，限制人数。' },
  { rating: 1, location: 'AMDB', lang: 'zh', demographic: '40岁中国男性', scenario: 'zh-system-complaint',
    reviewer_name: '刘建国',
    review_text: '预约系统完全不行，明明预约了时间还要等将近一个小时。工作人员态度也很差，连基本的解释都不给。花了那么多钱，体验非常糟糕。' },
  { rating: 5, location: 'AMNY', lang: 'zh', demographic: '28岁中国留学生', scenario: 'zh-student-impressed',
    reviewer_name: '张晓燕',
    review_text: '在纽约读书，跟同学来的。说实话没抱太大期待，结果完全震撼到了！那个瀑布厅真的太美了，站在里面感觉自己在另一个世界。性价比超高，值得！' },
  { rating: 3, location: 'AMLV', lang: 'zh', demographic: '45岁中国女性', scenario: 'zh-mixed-with-duration',
    reviewer_name: '周美丽',
    review_text: '视觉效果很震撼，香味设计也很用心。但整个游览只用了35分钟就走完了，感觉有点短。如果能增加更多互动环节就完美了。整体还是值得推荐的。' },

  // ────────────────────────────────────────────────────────────
  // [EN] 1-2★ COMPLAINT — Various complaint types
  // ────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '40yo White American female', scenario: 'layout-no-signs',
    reviewer_name: 'Patricia Thompson',
    review_text: "Spent 20 minutes trying to find the entrance. No signs anywhere outside. When I finally got in, I was told I missed my time slot. The staff were unhelpful. Absolute waste of time." },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '33yo Middle Eastern male', scenario: 'ac-heat',
    reviewer_name: 'Khalid Al-Rashidi',
    review_text: 'The air conditioning was barely working. Inside felt like a sauna — completely inappropriate for Dubai weather. My wife had to leave early because of the heat. Unacceptable for this price point.' },
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '29yo Nigerian female', scenario: 'crowd-no-control',
    reviewer_name: 'Adaeze Okafor',
    review_text: 'The art was genuinely beautiful, but there was absolutely no crowd control. People were pushing and shoving to get photos. Staff stood by watching. I left with a headache.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '52yo French tourist, male', scenario: 'staff-rude-rush',
    reviewer_name: 'Jean-Pierre Dubois',
    review_text: 'The security guard kept telling us to move on and not take too long in each room. We paid good money for this and were rushed through in 20 minutes. France has better free museums.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '38yo South Korean male (EN review)', scenario: 'double-charge',
    reviewer_name: 'Hyun-woo Park',
    review_text: 'Got charged twice on my credit card. The ticketing kiosk froze and I had to redo the transaction. Staff at the desk had no idea how to issue a refund. Spent an hour at the counter.' },
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '27yo Italian female tourist', scenario: 'display-issue',
    reviewer_name: 'Giulia Esposito',
    review_text: 'Three of the projectors were out of sync — the image was blurry and flickering. It really broke the immersion. The rooms that worked were absolutely stunning but too many technical issues.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '44yo Canadian male', scenario: 'interactive-broken',
    reviewer_name: 'Ryan MacLeod',
    review_text: 'Half the interactive stations were broken. Kids were disappointed. Staff just shrugged when we pointed this out. For $60 per person I expect equipment to actually work.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '31yo Filipino female', scenario: 'restroom-hygiene',
    reviewer_name: 'Maria Santos',
    review_text: 'The bathrooms were absolutely filthy. Floor was wet, no paper towels, and it smelled terrible. Such a shame because the exhibition itself was lovely. Fix the restrooms please.' },
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '60yo German tourist, female', scenario: 'layout-cant-find-exit',
    reviewer_name: 'Ingrid Müller',
    review_text: 'There were no signs anywhere in the building. We could not find the exit for 15 minutes. We are older and it was quite stressful. The exhibition itself was nice but the navigation is terrible.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '24yo Vietnamese-American male', scenario: 'tea-bar-rude',
    reviewer_name: 'Kevin Nguyen',
    review_text: 'Tea Bar staff were so cold and dismissive. We waited 10 minutes to be acknowledged. The tea was good but the attitude ruined the mood. A beautiful experience ended on a sour note.' },

  // ────────────────────────────────────────────────────────────
  // [KO] 1-2★ COMPLAINT — Korean language complaints
  // ────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '20대 한국인 여성 학생', scenario: 'ko-system-reservation-fail',
    reviewer_name: '나연',
    review_text: '앱으로 예약했는데 현장에서 예약 내역이 안 나온다고 해서 다시 현장 구매했습니다. 중복 결제 환불도 안 해줌. 이게 무슨 시스템인지 모르겠어요.' },
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '30대 한국인 부부', scenario: 'ko-room-dark-cramped',
    reviewer_name: '한승우',
    review_text: '특정 공간은 너무 좁고 어두워서 불안감이 느껴질 정도였어요. 노약자나 폐소공포증 있는 분들은 힘들 수 있을 것 같습니다. 전반적으로는 예뻤지만 일부 공간 구성이 아쉽습니다.' },
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '40대 한국인 여성', scenario: 'ko-staff-phone',
    reviewer_name: '박연진',
    review_text: '직원들이 서로 대화하거나 핸드폰 보느라 방문객한테 관심이 없어요. 길 물어봐도 고개만 끄덕이고 안내를 안 해줌. 두바이까지 와서 이런 서비스라니 실망입니다.' },
  { rating: 2, location: 'AMNY', lang: 'ko', demographic: '25대 한국인 남성', scenario: 'ko-rush-crowded',
    reviewer_name: '김준서',
    review_text: '주말에 갔더니 사람이 너무 많아서 작품을 제대로 볼 수가 없었어요. 각 공간에 머무를 수 있는 시간도 짧게 느껴졌고, 뒷 사람 눈치를 봐야 했습니다. 평일 추천합니다.' },
  { rating: 1, location: 'AMLV', lang: 'ko', demographic: '35대 한국인 여성', scenario: 'ko-value-duration',
    reviewer_name: '오세영',
    review_text: '50달러짜리 티켓을 사고 들어갔더니 30분 만에 다 봤어요. 콘텐츠 양이 너무 적습니다. 라스베가스 다른 볼거리들이 훨씬 낫겠다 싶은 생각이 들었어요.' },
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '28대 한국인 남성', scenario: 'ko-display-blurry',
    reviewer_name: '전민준',
    review_text: '두바이점 메인 홀 프로젝터 화질이 너무 안 좋았습니다. 흐릿하고 색이 번져서 작품 감상이 제대로 안 됐어요. 기술적인 점검이 시급한 것 같습니다.' },
  { rating: 3, location: 'AMNY', lang: 'ko', demographic: '33대 한국인 여성', scenario: 'ko-mixed-positive-negative',
    reviewer_name: '신지은',
    review_text: '향기 테마가 정말 인상적이었고 전반적으로 만족스러웠어요. 다만 일부 인터랙티브 기기가 작동 안 했고 화장실 청결도가 아쉬웠습니다. 좋았지만 개선이 필요한 부분이 있어요.' },
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '45대 한국인 남성', scenario: 'ko-revisit-disappointed',
    reviewer_name: '박상현',
    review_text: '2년 전에 왔을 때는 정말 감동적이었는데, 재방문하니 콘텐츠가 거의 그대로더라고요. 업데이트가 전혀 없어서 새로운 감동이 없었습니다. 발전이 필요합니다.' },

  // ────────────────────────────────────────────────────────────
  // [EN] Mixed / Edge Cases
  // ────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '36yo Brazilian female', scenario: 'mixed-sarcasm-but-positive',
    reviewer_name: 'Fernanda Costa',
    review_text: 'Not too bad, honestly surprised me. The flower room is charming and the Tea Bar is a lovely way to end. Would have given 5 stars if they could manage the crowds better.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '48yo Canadian female', scenario: '4star-helpful-staff',
    reviewer_name: 'Sophie Martin',
    review_text: 'The staff were incredibly helpful — one of them spent five minutes helping us find the perfect angle for photos in the ocean room. The art is transportive. Small hiccup with the audio in one room.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '34yo Middle Eastern female', scenario: 'emergency-heat-exhaustion',
    reviewer_name: 'Fatima Al-Zaabi',
    review_text: 'I felt dizzy and nauseous inside — it was unbearably hot and poorly ventilated. Had to leave midway through. Never experienced anything like this at a museum. Please fix the air system.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '26yo American male, influencer', scenario: 'photo-focused-5star',
    reviewer_name: 'Tyler Brooks',
    review_text: 'Every room is a banger for content. The WAVE room alone got me 50k views on TikTok. The staff were super chill and patient with everyone shooting. 10/10 would recommend to anyone.' },
  { rating: 3, location: 'AMNY', lang: 'en', demographic: '50yo Korean-American female', scenario: 'ok-but-commercial',
    reviewer_name: 'Susan Cho',
    review_text: 'The visuals are undeniably gorgeous. My concern is how commercialized it felt — every room had a gift shop angle. Still worth seeing if you manage expectations. The art itself is beautiful.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '29yo Pakistani male', scenario: 'language-barrier-complaint',
    reviewer_name: 'Hamza Qureshi',
    review_text: 'Staff spoke almost no Arabic and minimal English. Signage was in English only — no Arabic translation at all. Dubai has a majority non-English population. This felt very exclusionary.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '39yo Mexican-American female', scenario: 'accessibility-complaint',
    reviewer_name: 'Rosa Gutierrez',
    review_text: 'I use a wheelchair and there was no ramp to one of the main rooms. I had to wait outside while my friends went in without me. No staff offered to help or find an alternative route.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '31yo Singaporean male', scenario: '4star-slight-temp',
    reviewer_name: 'Marcus Tan',
    review_text: 'Genuinely impressive exhibition. The scent design is inspired — I have never experienced anything like it in any art space globally. Minor note: the room transitions could be smoother and less jarring.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '22yo American female, Gen-Z', scenario: 'genz-casual-5star',
    reviewer_name: 'Zoe Parker',
    review_text: 'ok so i was NOT expecting to cry in an art museum but here we are lol. the waterfall room literally stopped me in my tracks. if you are in vegas you HAVE to go. no excuses.' },

  // ────────────────────────────────────────────────────────────
  // [KO] Edge cases — 애매한 케이스, 특수 상황
  // ────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '30대 한국인 직장인', scenario: 'ko-after-work-healing',
    reviewer_name: '류승범',
    review_text: '퇴근하고 혼자 들렀는데 회사 스트레스가 다 날아갔어요. 특히 별 쏟아지는 방에서 한참 있었는데 진짜 힐링됐습니다. 뉴욕에 이런 공간이 있다는 게 감사하네요.' },
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '20대 한국인 친구 그룹', scenario: 'ko-group-mixed',
    reviewer_name: '배수지',
    review_text: '친구 5명이랑 왔는데 다들 반응이 달랐어요. 사진 찍는 분들은 완전 만족, 진짜 예술 감상하러 온 분들은 좀 아쉽다고. 저는 중간 정도. 예쁜 건 맞는데 심오함이 부족한 느낌.' },
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '55대 한국인 남성', scenario: 'ko-senior-lighting-too-bright',
    reviewer_name: '김철수',
    review_text: '나이 드신 분들께는 권하기 어렵겠어요. 조명이 너무 강렬하고 빠른 화면 전환이 많아서 눈이 피로했습니다. 의자도 없어서 계속 서 있어야 했고요. 젊은 분들 위한 전시인 것 같습니다.' },
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '38대 한국인 남성', scenario: 'ko-layout-got-lost',
    reviewer_name: '조인성',
    review_text: '표지판 안내가 없어서 어느 방부터 들어가야 하는지 알 수가 없었어요. 직원한테 물어보니 자기도 모른다고 하더라고요. 동선 설계가 너무 불편했습니다.' },
  { rating: 4, location: 'AMDB', lang: 'ko', demographic: '27대 한국인 여성', scenario: 'ko-4star-good-staff',
    reviewer_name: '한소희',
    review_text: '직원들이 정말 친절하고 안내도 잘 해줬어요. 사진 찍는 것도 도와주시고요. 전시는 말할 것도 없이 아름다웠습니다. 티켓이 조금 비싸긴 한데 그만한 가치는 있어요.' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '23대 한국인 학생', scenario: 'ko-college-impressed',
    reviewer_name: '방탄이',
    review_text: '미국 교환학생 중에 라스베가스 놀러 왔다가 들렀는데 생각보다 훨씬 좋았어요! 미디어아트에 대한 인식이 완전 바뀌었어요. 한국에도 이런 거 있으면 매일 갈 것 같아요.' },

  // ────────────────────────────────────────────────────────────
  // [EN] Nuanced / Tricky Cases
  // ────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '42yo Australian female', scenario: 'constructive-3star',
    reviewer_name: 'Claire Bennett',
    review_text: 'I had a lovely time but three rooms had projector issues. The staff were kind but could not fix it. The rooms that worked were genuinely breathtaking. Worth visiting, but check for technical updates first.' },
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '37yo Cuban-American male', scenario: 'long-wait-queue',
    reviewer_name: 'Roberto Fuentes',
    review_text: 'Stood in line for over 90 minutes with a reservation. Why have reservations if they do not honor the time? By the time we got in we were exhausted and could not enjoy it. Terrible operations.' },
  { rating: 4, location: 'AMLV', lang: 'en', demographic: '55yo Japanese-American female', scenario: 'returning-4star',
    reviewer_name: 'Keiko Yamamoto',
    review_text: 'Third time visiting over three years. Each time I discover something new in the art. This is what art should do — grow with you. The Tea Bar has improved its menu too.' },
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '22yo Emirati male', scenario: 'local-perspective',
    reviewer_name: 'Rashid Al-Mansoori',
    review_text: 'I live in Dubai and this was my first visit. The art is interesting but the price is steep for locals. Also no Arabic staff, which feels strange in Dubai. Will probably not return at this price.' },
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '33yo Jamaican-British female', scenario: 'emotional-5star',
    reviewer_name: 'Simone Campbell',
    review_text: 'I came here feeling burned out after a horrible work week and left feeling completely renewed. I cannot explain it rationally — there is something about the combination of light, scent, and sound that resets you. Incredible.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '28yo Indian female', scenario: 'accessibility-complaint-2',
    reviewer_name: 'Priya Patel',
    review_text: 'I have epilepsy and there were no warnings about the flashing lights before entering. I had to leave immediately. This is a basic accessibility requirement. Deeply irresponsible of the venue.' },
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '46yo Jordanian male', scenario: 'moderate-review',
    reviewer_name: 'Yousef Haddad',
    review_text: 'The concept is innovative and the visuals are genuinely impressive. I deducted stars for the lack of seating and the rushed atmosphere. A few more benches and calmer staff would make this exceptional.' },

  // ────────────────────────────────────────────────────────────
  // [KO+EN Mix] Korean/English switchers
  // ────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '28대 재미교포', scenario: 'bilingual-positive',
    reviewer_name: 'James 이',
    review_text: '라스베가스에 사는 교포인데 처음 가봤어요. 이렇게 퀄리티가 높을 줄 몰랐어요. Every room is so beautiful and the staff are so nice. 5 stars 당연하죠!' },
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '32대 재미교포 여성', scenario: 'bilingual-complaint',
    reviewer_name: '김소연 (Sarah)',
    review_text: '두바이 출장 중에 가봤는데 실망했어요. The staff were quite rude when I asked questions in English. 가격 대비 볼거리가 너무 적고 AC도 제대로 안 됐어요.' },

  // ────────────────────────────────────────────────────────────
  // [JA] Edge Cases
  // ────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'ja', demographic: '45代 日本人男性', scenario: 'ja-complaint-rush',
    reviewer_name: '小林健',
    review_text: 'スタッフに「次の方がいるので動いてください」と急かされました。チケット代を払ってこんな扱いを受けるとは思いませんでした。作品は良かったですが体験全体は最悪でした。' },
  { rating: 4, location: 'AMDB', lang: 'ja', demographic: '29代 日本人女性', scenario: 'ja-4star-slight-crowd',
    reviewer_name: '渡辺千晶',
    review_text: '全体的に素晴らしい体験でした。香りの演出が特に印象的で、視覚だけでなく嗅覚も使った芸術に感動しました。混んでいる時間帯は少し見づらかったですが、それを除けば満点です。' },

  // ────────────────────────────────────────────────────────────
  // [ZH] Edge Cases
  // ────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'zh', demographic: '33岁中国男性', scenario: 'zh-staff-ignore',
    reviewer_name: '赵大明',
    review_text: '工作人员完全不搭理人，站在那里玩手机。问了三次问题才有人回答，态度还很差。展览本身是好的，但这种服务水平让人非常失望。希望管理层重视这个问题。' },
  { rating: 5, location: 'AMLV', lang: 'zh', demographic: '26岁中国女性', scenario: 'zh-5star-healing',
    reviewer_name: '孙怡',
    review_text: '太治愈了！每进入一个房间都有不同的香气，结合视觉效果简直是艺术享受。在那个森林主题的房间里我差点睡着了，太放松了。来拉斯维加斯一定要来这里！' },
  { rating: 2, location: 'AMDB', lang: 'zh', demographic: '50岁中国男性', scenario: 'zh-layout-navigation',
    reviewer_name: '吴建平',
    review_text: '展馆内的指示牌完全是英文，中文说明几乎没有。我们找了很久才找到出口。如果能增加中文标识会方便很多。展览内容本身还不错，但导览体验需要改善。' },

  // ────────────────────────────────────────────────────────────
  // Round 2 — 80+ 추가 다양성 확장 리뷰 (단문/TMI/다인종/다상황)
  // ────────────────────────────────────────────────────────────

  // [KO] 초단문 심플 긍정 (SHORT 모드 TMI 테스트)
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '20대 한국인 여성', scenario: 'ko-oneliner-good',
    reviewer_name: '김예지',
    review_text: '좋았어요!' },
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '30대 한국인 남성', scenario: 'ko-oneliner-best',
    reviewer_name: '박성민',
    review_text: '완전 최고. 강추합니다.' },
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '40대 한국인 여성', scenario: 'ko-oneliner-pretty',
    reviewer_name: '이미래',
    review_text: '너무 예뻤어요. 또 오고 싶어요.' },
  { rating: 4, location: 'AMLV', lang: 'ko', demographic: '25대 한국인 학생', scenario: 'ko-short-4star',
    reviewer_name: '최지원',
    review_text: '전반적으로 좋은데 사람이 많아서 아쉬웠어요.' },
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '17대 한국인 청소년', scenario: 'ko-teen-impressed',
    reviewer_name: '유지훈',
    review_text: '학교 체험학습으로 왔는데 생각보다 훨씬 재밌었어요!! 미디어아트 완전 신기함ㅋㅋ' },

  // [EN] 초단문 심플 (SHORT 모드 EN 테스트)
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '24yo American male, tourist', scenario: 'en-oneliner',
    reviewer_name: 'Tyler Brooks',
    review_text: 'Absolutely incredible. Go.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '32yo British female', scenario: 'en-short-positive',
    reviewer_name: 'Sophie Clarke',
    review_text: 'Stunning from start to finish. Worth every penny.' },
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '50yo American female', scenario: 'en-simple-wow',
    reviewer_name: 'Linda Nguyen',
    review_text: 'Best thing we did in New York. Period.' },
  { rating: 4, location: 'AMLV', lang: 'en', demographic: '29yo Canadian male', scenario: 'en-4star-short',
    reviewer_name: 'Ethan MacDonald',
    review_text: 'Gorgeous visuals. Slightly crowded but worth it.' },

  // [KO] 중간 별점 복합 감정
  { rating: 3, location: 'AMNY', lang: 'ko', demographic: '35대 한국인 여성', scenario: 'ko-3star-mixed-scent',
    reviewer_name: '한지민',
    review_text: '전시는 예쁜데 향기가 너무 강해서 두통이 생겼어요. 향기 민감한 분들은 참고하세요.' },
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '42대 한국인 남성', scenario: 'ko-3star-kids-ran',
    reviewer_name: '오준혁',
    review_text: '아이들이 뛰어다녀서 관람하기 힘들었어요. 어른들을 위한 조용한 시간대가 있으면 좋겠어요.' },

  // [EN] 특정 불만 유형 — 소음, 냄새, 접근성
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '38yo American female with disability', scenario: 'en-hearing-impaired',
    reviewer_name: 'Mia Chen',
    review_text: 'Beautiful visually but no accommodations for hearing-impaired visitors. No captions, no vibration feedback for sound elements. Would have been more meaningful with accessibility features.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '27yo British male', scenario: 'en-scent-allergy',
    reviewer_name: 'Oliver Walsh',
    review_text: 'The scent in one of the rooms triggered my asthma. No warning signs anywhere. Had to leave immediately. This is a serious safety issue that needs to be addressed immediately.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '44yo American female', scenario: 'en-no-seating',
    reviewer_name: 'Karen Williams',
    review_text: 'My elderly mother was exhausted with no places to sit. We had to leave early because there were zero benches anywhere. For a 90-minute experience, you need rest areas.' },

  // [EN] 다인종 다양성 확장
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '29yo Ethiopian-American female', scenario: 'en-diasporic-5star',
    reviewer_name: 'Selamawit Haile',
    review_text: 'As someone from East Africa living in New York, art spaces often feel exclusive. This one felt welcoming to everyone. The universal language of light and nature connects all cultures.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '40yo Turkish male, business', scenario: 'en-turkish-business',
    reviewer_name: 'Mert Yilmaz',
    review_text: 'I am here for a conference and my colleague recommended this. I have visited art installations across Europe and this ranks among the finest. The garden room is truly extraordinary.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '35yo Iranian female', scenario: 'en-farsi-barrier',
    reviewer_name: 'Nasrin Ahmadi',
    review_text: 'No Farsi guide or information available. We had three Persian-speaking visitors and felt completely lost. The art is beautiful but the lack of multilingual support is disappointing.' },
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '48yo Nigerian male, professor', scenario: 'en-academic-5star',
    reviewer_name: 'Emeka Okafor',
    review_text: 'From an art history perspective, this is a masterclass in experiential curation. The integration of scent, light and sound creates genuine emotional memory. I will bring my students next semester.' },
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '19yo Russian female student', scenario: 'en-russian-student',
    reviewer_name: 'Daria Sorokina',
    review_text: 'I expected more from a place this famous. Most rooms were the same color scheme — blue and green. It gets repetitive after the third room. Too expensive for what it offers.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '55yo Filipino-American female', scenario: 'en-filipina-5star',
    reviewer_name: 'Maria Santos',
    review_text: 'Brought my whole family — children, parents, grandparents. Every single generation loved it. My 80-year-old lola cried at the flower room. We stayed two hours and left smiling.' },
  { rating: 3, location: 'AMNY', lang: 'en', demographic: '26yo French male, artist', scenario: 'en-artist-critique',
    reviewer_name: 'Antoine Leclerc',
    review_text: 'Technically impressive but conceptually thin. Spectacular for the average visitor, but if you are looking for artistic depth beyond spectacle, you may find it lacking.' },

  // [KO] 특수 시나리오
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '27대 한국인 임산부', scenario: 'ko-pregnant-visitor',
    reviewer_name: '정수연',
    review_text: '임신 7개월인데 걱정하며 왔는데 의자도 있고 직원분이 잘 챙겨주셔서 너무 좋았어요. 아기한테도 좋은 경험이 됐을 것 같아요.' },
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '32대 한국인 남성', scenario: 'ko-fire-drill-chaos',
    reviewer_name: '김민수',
    review_text: '관람 중에 갑자기 비상벨이 울려서 대피했는데 직원들이 우왕좌왕하면서 안내를 못 했어요. 혼란스러웠고 안전 교육이 제대로 안 된 것 같았습니다.' },
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '50대 한국인 여성', scenario: 'ko-tea-bar-waittime',
    reviewer_name: '박영희',
    review_text: '전시는 괜찮았는데 티바에서 30분을 기다렸어요. 인원도 적고 서비스가 너무 느렸습니다.' },
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '29대 한국인 직장인', scenario: 'ko-teambuilding-great',
    reviewer_name: '이도윤',
    review_text: '회사 팀빌딩으로 왔는데 완전 성공! 팀원들이 다들 너무 좋아했고 사진도 엄청 찍었어요. 내년에도 또 오려고요.' },
  { rating: 4, location: 'AMNY', lang: 'ko', demographic: '36대 한국인 여성', scenario: 'ko-4star-tea-bar-good',
    reviewer_name: '조은지',
    review_text: '전시도 아름답고 마지막에 티바에서 마신 차가 너무 좋았어요. 4점 준 건 입장 전 대기가 좀 길었던 것 때문에요.' },
  { rating: 1, location: 'AMLV', lang: 'ko', demographic: '22대 한국인 학생', scenario: 'ko-stolen-item',
    reviewer_name: '신재원',
    review_text: '관람 중에 가방에서 지갑이 없어진 것 같아요. 직원한테 얘기했더니 책임 없다며 그냥 넘어가려고 했어요. 매우 불쾌합니다.' },

  // [JA] 확장 시나리오
  { rating: 5, location: 'AMNY', lang: 'ja', demographic: '22代 日本人女性, 一人旅', scenario: 'ja-solo-healing',
    reviewer_name: '木村あかり',
    review_text: 'ニューヨークで一人旅中に立ち寄りました。人生で一番美しい空間でした。香りの演出が特に素晴らしく、しばらく動けなかったほど感動しました。' },
  { rating: 1, location: 'AMLV', lang: 'ja', demographic: '38代 日本人男性', scenario: 'ja-no-japanese-guide',
    reviewer_name: '石田洋平',
    review_text: '日本語の案内が全くありません。英語のみで、スタッフも日本語不可。日本人観光客がこれほど多いのに、対応が不十分だと思います。' },
  { rating: 4, location: 'AMDB', lang: 'ja', demographic: '33代 日本人女性, カップル', scenario: 'ja-couple-4star',
    reviewer_name: '橋本さくら',
    review_text: '彼と一緒に訪れました。全体的に素晴らしかったです。ただ、一部の部屋で映像のちらつきがあったのが残念でした。' },
  { rating: 5, location: 'AMNY', lang: 'ja', demographic: '60代 日本人夫婦', scenario: 'ja-senior-couple-touched',
    reviewer_name: '松本幸雄',
    review_text: 'この年齢でこれほどの感動を受けるとは思いませんでした。花の部屋で思わず涙が出てしまいました。スタッフも親切で、素晴らしい体験でした。ありがとうございました。' },

  // [ZH] 확장 시나리오
  { rating: 5, location: 'AMNY', lang: 'zh', demographic: '20岁中国留学生男', scenario: 'zh-student-male',
    reviewer_name: '林俊杰',
    review_text: '在纽约留学，周末和同学来玩。本来以为会无聊，结果被震撼了！那个星空厅真的太美了，在里面转了好几圈。推荐给所有来纽约的朋友！' },
  { rating: 1, location: 'AMDB', lang: 'zh', demographic: '55岁中国男性', scenario: 'zh-price-outrage',
    reviewer_name: '徐国强',
    review_text: '票价太贵了，里面转了不到40分钟就全看完了。完全不值这个价格。内容太少，性价比极低。不会再来了，也不推荐给朋友。' },
  { rating: 3, location: 'AMLV', lang: 'zh', demographic: '32岁中国女性', scenario: 'zh-mixed-ac-issue',
    reviewer_name: '何婷婷',
    review_text: '艺术效果很棒，但空调太冷了，我们差点被冻坏。展品本身值得一看，但现场温度管理需要改善。' },
  { rating: 5, location: 'AMDB', lang: 'zh', demographic: '45岁中国男性, 带孩子', scenario: 'zh-father-kids',
    reviewer_name: '蒋志远',
    review_text: '带9岁的儿子来的，他非常喜欢互动区，玩了很久。大人也觉得很有意境，光与影的结合太美了。迪拜之行最值得的体验之一！' },

  // [EN/KO] 혼합 언어 리뷰 (교포/외국 거주자)
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '31대 미국 거주 한국인', scenario: 'ko-expat-5star',
    reviewer_name: '민지영',
    review_text: '뉴욕에 살면서 처음 갔는데 이렇게 좋은 곳이 있었는지 몰랐어요. 친구들한테 엄청 자랑했어요. 다음에 부모님 오시면 꼭 데려가려고요.' },
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '36yo French female', scenario: 'en-french-meh',
    reviewer_name: 'Camille Dubois',
    review_text: 'We visited this after Louvre and Centre Pompidou. It feels very commercial in comparison — more like a theme park than art. The content could go deeper. Beautiful but shallow.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '41yo South African male', scenario: 'en-sa-5star',
    reviewer_name: 'Sipho Dlamini',
    review_text: 'Coming from Johannesburg, I had not experienced immersive art of this scale before. The waterfall room left me speechless. This is what art should feel like — accessible and overwhelming in the best way.' },

  // [KO] 극단적 불만 (EMERGENCY 경계)
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '33대 한국인 여성', scenario: 'ko-emergency-slip',
    reviewer_name: '송아름',
    review_text: '관람 중 바닥이 젖어 있어서 미끄러졌어요. 다행히 크게 다치진 않았지만 무릎이 많이 아팠고 직원한테 얘기했더니 "그냥 조심하세요"라고만 했어요. 너무 황당합니다.' },
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '45대 한국인 남성', scenario: 'ko-legal-threat',
    reviewer_name: '강철호',
    review_text: '아이가 조형물에 부딪혀서 이마가 찢어졌습니다. 안전 장치가 전혀 없었어요. 법적으로 문제가 될 수 있을 것 같습니다. 반드시 개선이 필요합니다.' },

  // [EN] EMERGENCY 경계 케이스
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '52yo American male', scenario: 'en-medical-incident',
    reviewer_name: 'Richard Johnson',
    review_text: 'My wife had a severe panic attack inside due to the flashing lights and enclosed spaces. No warning signs were posted at the entrance. Staff response was slow and unhelpful. This venue needs immediate safety protocols.' },

  // [KO] SAFE 경계 케이스 (중립/애매)
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '28대 한국인 남성', scenario: 'ko-neutral-3star',
    reviewer_name: '문현우',
    review_text: '나쁘지는 않았어요. 기대가 좀 높았던 것 같아요. 보통이었습니다.' },
  { rating: 3, location: 'AMDB', lang: 'ko', demographic: '37대 한국인 여성', scenario: 'ko-so-so-3star',
    reviewer_name: '장나연',
    review_text: '그냥 그랬어요. 포토존은 예쁜데 딱히 특별한 건 못 느꼈어요.' },

  // [EN] 4★ 복합 뉘앙스
  { rating: 4, location: 'AMDB', lang: 'en', demographic: '34yo American female, photographer', scenario: 'en-photographer-4star',
    reviewer_name: 'Ashley Park',
    review_text: 'As a professional photographer I was blown away by the lighting design. The scent in the forest room is incredible. Knocked one star off because they restricted tripods — understandable but disappointing.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '60yo American male, retired', scenario: 'en-retired-4star',
    reviewer_name: 'Harold Thompson',
    review_text: 'My grandkids dragged me here and I ended up being the most amazed one in the group. The only issue was the pace — felt rushed by the crowd flow. Would love a slower, quieter session.' },

  // [ZH] 台湾/홍콩 방문자 (번체 중국어 컨텍스트)
  { rating: 5, location: 'AMNY', lang: 'zh', demographic: '28岁台湾女性', scenario: 'zh-taiwan-5star',
    reviewer_name: '陳宜蓁',
    review_text: '從台灣來紐約旅行，特地來參觀。完全超出預期！每個房間都是不同的驚喜，光影和香氣的結合讓人沉浸其中。強力推薦！' },
  { rating: 2, location: 'AMDB', lang: 'zh', demographic: '43岁香港男性', scenario: 'zh-hk-value',
    reviewer_name: '黃偉明',
    review_text: '視覺效果不錯，但票價偏高，參觀時間太短。作為香港人，見過不少類似展覽，這個算是中等水準。希望能增加更多互動內容。' },

  // [JA] SAFE 케이스 — 중립
  { rating: 3, location: 'AMNY', lang: 'ja', demographic: '45代 日本人男性', scenario: 'ja-neutral-3star',
    reviewer_name: '高橋誠司',
    review_text: '悪くはないですが、特別に感動したわけでもありません。写真映えはしますが、芸術的な深みはやや物足りない印象でした。' },

  // [EN] 직원 칭찬 (긍정 STAFF 언급)
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '23yo American female, Gen-Z', scenario: 'en-staff-praise-5star',
    reviewer_name: 'Destiny Campbell',
    review_text: 'The staff made this experience 10/10. They were so kind, took our photos in every room without being asked, and even suggested the best times to visit each installation. Hire more people like this.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '37yo Israeli female', scenario: 'en-israeli-5star',
    reviewer_name: 'Noa Goldberg',
    review_text: 'My husband and I drove in from Phoenix just for this. The night desert room felt like standing under the Milky Way. I have been to installations in Tel Aviv and Tokyo — this is right up there.' },

  // [KO] 직원 칭찬 (명시적 직원 언급)
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '31대 한국인 커플', scenario: 'ko-staff-praise',
    reviewer_name: '이준서',
    review_text: '직원분들이 정말 친절했어요. 사진도 찍어주시고 어떤 공간이 인기 있는지도 알려주셔서 더 즐겁게 관람할 수 있었어요. 전시도 아름다웠고요.' },

  // [EN] 비즈니스 리뷰어 (LinkedIn 스타일)
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '45yo American male, executive', scenario: 'en-business-executive',
    reviewer_name: 'Michael Anderson',
    review_text: 'We brought our entire executive team here for an offsite. The experience sparked the best brainstorming session we have had in years. There is something about immersive beauty that unlocks creativity.' },

  // [KO] 재방문 리뷰
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '26대 한국인 여성', scenario: 'ko-second-visit',
    reviewer_name: '권다은',
    review_text: '두 번째 방문인데 처음만큼 좋았어요. 새로운 공간도 생기고 전시 일부가 바뀌어 있어서 또 새로운 느낌이었어요. 다음에도 또 올게요.' },

  // [EN/KO] 혼합 긍정 — 재방문 영어
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '30yo Korean-American, 2nd visit', scenario: 'en-second-visit-5star',
    reviewer_name: 'Hannah Choi',
    review_text: 'Second time and it hit even harder. I brought my mom who just arrived from Korea — she was completely speechless. The wave room made her emotional. This place has a way of finding your heart.' },

  // [ZH] 부정 단문
  { rating: 1, location: 'AMNY', lang: 'zh', demographic: '29岁中国男性', scenario: 'zh-oneliner-bad',
    reviewer_name: '张伟',
    review_text: '太贵了，不值得。' },
  { rating: 2, location: 'AMLV', lang: 'zh', demographic: '38岁中国女性', scenario: 'zh-short-negative',
    reviewer_name: '刘芳',
    review_text: '人太多，体验很差。建议控制入场人数。' },

  // [JA] 단문 긍정
  { rating: 5, location: 'AMDB', lang: 'ja', demographic: '19代 日本人学生', scenario: 'ja-student-5star',
    reviewer_name: '川口ゆい',
    review_text: '最高でした！また絶対来ます！' },

  // [KO] 구체적 공간 언급
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '24대 한국인 여성', scenario: 'ko-specific-room-love',
    reviewer_name: '서예린',
    review_text: '포레스트 공간에서 향기랑 빛이 어우러지는 게 진짜 천국 같았어요. 거기서 30분은 있었던 것 같아요. 거기만 다시 가고 싶을 정도.' },
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '33대 한국인 남성', scenario: 'ko-wave-room-love',
    reviewer_name: '안재현',
    review_text: '파도 방이 압도적이었어요. 파도 소리랑 영상이 실제로 거기 있는 것처럼 느껴졌어요. 몇 번을 들어갔다 나왔는지 모르겠어요.' },

  // [EN] 구체적 공간 언급
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '28yo American female, Art teacher', scenario: 'en-art-teacher-garden',
    reviewer_name: 'Rebecca Torres',
    review_text: 'The garden room alone is worth the ticket price. I am an art teacher and I have already planned a field trip for my students next month. The way light is used as the primary medium is genuinely educational.' },

  // [KO] 불만 단문
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '48대 한국인 남성', scenario: 'ko-short-bad',
    reviewer_name: '황동수',
    review_text: '최악이었어요. 돈 아까워요.' },
  { rating: 2, location: 'AMNY', lang: 'ko', demographic: '26대 한국인 여성', scenario: 'ko-short-not-worth',
    reviewer_name: '전은혜',
    review_text: '기대에 많이 못 미쳤어요. 사진보고 기대했는데 실제로 보니 별로였어요.' },

  // [EN] 다양한 접근성 이슈
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '33yo American female, visually impaired', scenario: 'en-visually-impaired',
    reviewer_name: 'Jasmine Carter',
    review_text: 'I am low-vision and attended with a sighted friend. There is very little tactile or audio description for those with visual impairments. The experience relies 100% on visuals with no alternative.' },

  // [KO] 시설 문제
  { rating: 1, location: 'AMLV', lang: 'ko', demographic: '39대 한국인 여성', scenario: 'ko-restroom-dirty',
    reviewer_name: '남소연',
    review_text: '화장실이 너무 더럽고 냄새가 심했어요. 전시는 예쁜데 화장실 관리 좀 해주세요.' },
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '44대 한국인 남성', scenario: 'ko-ac-broken',
    reviewer_name: '변준호',
    review_text: '에어컨이 제대로 안 나와서 너무 더웠어요. 관람하는 내내 불쾌했습니다. 땀이 줄줄 흘렀어요.' },
]

// ═══════════════════════════════════════════════════════════════
//  심층 품질 분석 엔진
// ═══════════════════════════════════════════════════════════════

interface QualityIssue {
  code: string
  severity: 'P0' | 'P1' | 'P2'
  description: string
  evidence: string
}

interface ReviewResult {
  idx: number
  review: SyntheticReview
  status: string
  route: string
  tags: string[]
  primaryIntent: string | null | undefined
  reply: string
  issues: QualityIssue[]
}

// ── 반복 문장 탐지 ───────────────────────────────────────────────
function detectDuplicatePhrases(reply: string): string[] {
  // 문장 분리 — 24자 이상 문장만 (짧은 인사말 제외)
  const sentences = reply.split(/[.。！!？?\n]/).map(s => s.trim()).filter(s => s.length > 24)
  const seen = new Map<string, number>()
  const dupes: string[] = []
  for (const s of sentences) {
    // 지점명으로 시작하는 문장은 인사·클로징 모두에 등장 → 제외
    if (/^ARTE MUSEUM (LAS VEGAS|DUBAI|NEW YORK)/.test(s)) continue
    // 첫 24자 기준 근사 매칭 (20자는 지점명 공통 접두 "ARTE MUSEUM NEW YORK" 오탐 유발)
    const key = s.substring(0, 24).toLowerCase()
    if (seen.has(key)) dupes.push(s.substring(0, 30) + '…')
    else seen.set(key, 1)
  }
  return dupes
}

// ── AI 냄새 탐지 — 언어별 패턴 ────────────────────────────────────
const AI_SMELL_KO = [
  /소중한\s*의견\s*감사드리며.*더\s*나은\s*서비스로\s*보답/,   // 클로징 공식
  /최선을\s*다하겠습니다.*최선을\s*다하겠습니다/,             // 최선 중복
  /진심으로\s*사과드립니다.*진심으로\s*사과드립니다/,         // 사과 중복
  /담당자가\s*신속히.*성심껏/,                                 // 너무 반복되는 공식구
  /더\s*나은\s*서비스로\s*보답드리겠습니다/,                   // 너무 많이 쓰이는 클로징
]
const AI_SMELL_EN = [
  /We are committed to doing better\./i,     // overused corporate
  /Thank you for your valuable feedback\./i, // cliché
  /We will take immediate steps to/i,        // corporate boilerplate
  /We take your feedback seriously/i,        // cliché
  /a member of our team will review/i,       // cold corporate
  /We look forward to welcoming you back/i,  // hollow
]
const AI_SMELL_JA = [
  /誠に申し訳ございません.*誠に申し訳ございません/,  // double apology
]
const AI_SMELL_ZH = [
  /深表歉意.*深感抱歉/,  // double apology
]

function detectAISmell(reply: string, lang: string): string[] {
  const hits: string[] = []
  const patterns = lang === 'ko' ? AI_SMELL_KO :
                   lang === 'en' ? AI_SMELL_EN :
                   lang === 'ja' ? AI_SMELL_JA : AI_SMELL_ZH
  for (const p of patterns) {
    if (p.test(reply)) hits.push(p.toString().substring(0, 40) + '…')
  }
  return hits
}

// ── 답변 길이 이슈 탐지 ──────────────────────────────────────────
function detectLength(reply: string, status: string, reviewText?: string): string | null {
  const len = reply.length
  if (reply.includes('null — LLM') || len < 30) return `TOO_SHORT (${len}자)`
  if (status === 'COMPLIMENT' && len > 600) return `OVER_LONG_COMPLIMENT (${len}자)`
  if (status === 'COMPLAINT' && len < 80) return `TOO_SHORT_COMPLAINT (${len}자)`
  // TMI: 리뷰가 30자 이하 단문인데 답변이 300자 넘으면 과잉 응대 (SHORT 모드 270자 미만은 허용)
  if (reviewText && reviewText.length <= 30 && len > 300) {
    return `TMI_MISMATCH: 리뷰 ${reviewText.length}자 → 답변 ${len}자 (과잉)`
  }
  return null
}

// ── 톤 미스매치 탐지 ────────────────────────────────────────────
function detectToneMismatch(reply: string, status: string, rating: number, lang: string): string | null {
  // COMPLIMENT인데 사과 표현이 있는 경우
  if (status === 'COMPLIMENT' && lang === 'ko' && /사과드립니다|죄송합니다/.test(reply)) {
    return 'COMPLIMENT_HAS_APOLOGY'
  }
  if (status === 'COMPLIMENT' && lang === 'en' && /sincerely apologize|we apologize/i.test(reply)) {
    return 'COMPLIMENT_HAS_APOLOGY'
  }
  // COMPLAINT인데 축하/감사가 너무 강한 경우
  if (status === 'COMPLAINT' && lang === 'ko' && /정말\s*기쁩니다|너무\s*기뻐요/.test(reply)) {
    return 'COMPLAINT_TOO_CHEERFUL'
  }
  // 5★ 리뷰에 사과 표현
  if (rating >= 5 && lang === 'ko' && /불편을\s*드린\s*점.*사과/.test(reply)) {
    return '5STAR_HAS_APOLOGY'
  }
  if (rating >= 5 && lang === 'en' && /inconvenience.*apologize/i.test(reply)) {
    return '5STAR_HAS_APOLOGY'
  }
  return null
}

// ── 키워드 반향(Echo) 미활용 탐지 — COMPLIMENT/SAFE만 (불만 리뷰에서 긍정 echo 강요 X) ──
function detectMissedEcho(reviewText: string, reply: string, lang: string, status: string): string | null {
  if (status !== 'COMPLIMENT' && status !== 'SAFE') return null
  if (lang === 'ko') {
    if (/힐링/.test(reviewText) && !/힐링/.test(reply)) return 'MISSED_ECHO:힐링'
    if (/데이트/.test(reviewText) && !/데이트/.test(reply)) return 'MISSED_ECHO:데이트'
    if (/가족|아이와|아이들과/.test(reviewText) && !/가족|아이|소중/.test(reply)) return 'MISSED_ECHO:가족'
  }
  if (lang === 'en') {
    if (/\bheal\w*\b/i.test(reviewText) && !/heal|refresh/i.test(reply)) return 'MISSED_ECHO:healing'
    if (/\bdate\s*night\b/i.test(reviewText) && !/special|date/i.test(reply)) return 'MISSED_ECHO:date'
  }
  return null
}

// ── 오분류 탐지 ────────────────────────────────────────────────
function detectMisclassification(status: string, rating: number, tags: string[]): string | null {
  // 5★ COMPLAINT
  if (rating >= 5 && status === 'COMPLAINT') return `5STAR_COMPLAINT: ${tags.join(',')}`
  // 5★ EMERGENCY (긍정 리뷰가 EMERGENCY로 분류 → 오탐)
  if (rating >= 5 && status === 'EMERGENCY') return `5STAR_EMERGENCY: ${tags.join(',')}`
  // 4★ EMERGENCY
  if (rating >= 4 && status === 'EMERGENCY') return `4STAR_EMERGENCY: ${tags.join(',')}`
  // 1★ SAFE
  if (rating <= 1 && status === 'SAFE') return `1STAR_SAFE: suspicious`
  // 1★ COMPLIMENT (with complaint tags)
  if (rating <= 2 && status === 'COMPLIMENT' && tags.length > 0) return `LOW_STAR_COMPLIMENT: ${tags.join(',')}`
  return null
}

// ── 언어 일관성 탐지 ──────────────────────────────────────────
function detectLanguageMix(reply: string, expectedLang: string): string | null {
  if (expectedLang === 'ko') {
    // 한국어 답변인데 영어 문장이 섞인 경우
    const enSentences = reply.match(/[A-Z][a-z]{3,}[^.!?\n]{10,}[.!?]/g) || []
    if (enSentences.length >= 2) return `LANG_MIX: Korean reply has ${enSentences.length} EN sentences`
  }
  if (expectedLang === 'ja') {
    // 일본어 리뷰인데 한국어로 답변하는 경우
    const koChars = (reply.match(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g) || []).length
    if (koChars > 10) return `LANG_MIX: JA review but KO reply detected`
  }
  if (expectedLang === 'zh') {
    const koChars = (reply.match(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g) || []).length
    if (koChars > 10) return `LANG_MIX: ZH review but KO reply detected`
  }
  return null
}

// ── 안전 규칙 위반 탐지 ──────────────────────────────────────────
function detectForbidden(reply: string): string[] {
  const hits: string[] = []
  if (/환불|refund|chargeback/i.test(reply)) hits.push('FORBIDDEN:refund')
  if (/보상|compensat/i.test(reply)) hits.push('FORBIDDEN:compensation')
  if (/cctv|감시\s*카메라/i.test(reply)) hits.push('FORBIDDEN:cctv')
  if (/직원\s*(징계|해고)|fire\s+the\s+staff/i.test(reply)) hits.push('FORBIDDEN:staff_punishment')
  if (/법적\s*책임|legal\s*(liable|fault)/i.test(reply)) hits.push('FORBIDDEN:legal_liability')
  return hits
}

// ── 공통 후처리 클로징 과다 반복 탐지 ──────────────────────────────
const CLOSING_CORPUS: Record<string, number> = {}
function trackClosing(reply: string, lang: string): string | null {
  const closingPatterns: Record<string, RegExp> = {
    ko_closing1: /소중한 의견 감사드리며, 더 나은 서비스로 보답드리겠습니다/,
    ko_closing2: /다시 만나뵐 그날을 기대하겠습니다/,
    en_closing1: /We are committed to doing better\./i,
    en_closing2: /for another unforgettable experience/i,
  }
  for (const [key, re] of Object.entries(closingPatterns)) {
    if (re.test(reply)) {
      CLOSING_CORPUS[key] = (CLOSING_CORPUS[key] || 0) + 1
      // 150건 기준: 전체 리뷰의 5% 초과 시 반복 경고 (약 8건)
      if (CLOSING_CORPUS[key] > 7) return `REPETITIVE_CLOSING:${key}(×${CLOSING_CORPUS[key]})`
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
//  메인 분석 루프
// ═══════════════════════════════════════════════════════════════

const allResults: ReviewResult[] = []

for (let i = 0; i < SYNTHETIC_REVIEWS.length; i++) {
  const r = SYNTHETIC_REVIEWS[i]
  // 실제 UUID와 유사한 분포를 시뮬레이션하기 위해 인덱스 기반 합성 ID 사용
  // (reviewId: null이면 모든 idx=0으로 고정되어 편향 발생)
  const syntheticId = `deep-loop-synth-${String(i).padStart(3, '0')}-${r.reviewer_name.replace(/\s/g, '-')}`
  const decision = processReview({
    reviewText: r.review_text,
    branchCode: r.location,
    language: r.lang,
    reviewerName: r.reviewer_name,
    rating: r.rating,
    reviewId: syntheticId,
  })

  const reply = decision.staticReply ?? '(null — LLM route)'
  const issues: QualityIssue[] = []

  // ── 1. 오분류 체크 ──────────────────────────────────────────
  const mis = detectMisclassification(decision.classification.status, r.rating, decision.classification.tags)
  if (mis) issues.push({ code: 'MISCLASSIFY', severity: 'P0', description: mis, evidence: reply.substring(0, 60) })

  // ── 2. 안전 규칙 위반 ───────────────────────────────────────
  for (const f of detectForbidden(reply)) {
    issues.push({ code: 'FORBIDDEN', severity: 'P0', description: f, evidence: reply.substring(0, 60) })
  }

  // ── 3. 길이 이슈 ───────────────────────────────────────────
  const len = detectLength(reply, decision.classification.status, r.review_text)
  if (len) issues.push({ code: 'LENGTH', severity: len.includes('TMI_MISMATCH') ? 'P2' : 'P1', description: len, evidence: reply.substring(0, 40) })

  // ── 4. 톤 미스매치 ─────────────────────────────────────────
  const tone = detectToneMismatch(reply, decision.classification.status, r.rating, r.lang)
  if (tone) issues.push({ code: 'TONE_MISMATCH', severity: 'P1', description: tone, evidence: reply.substring(0, 60) })

  // ── 5. AI 냄새 ────────────────────────────────────────────
  const aiHits = detectAISmell(reply, r.lang)
  for (const h of aiHits) {
    issues.push({ code: 'AI_SMELL', severity: 'P1', description: h, evidence: reply.substring(0, 60) })
  }

  // ── 6. 반복 문장 ─────────────────────────────────────────
  const dupes = detectDuplicatePhrases(reply)
  for (const d of dupes) {
    issues.push({ code: 'DUPLICATE', severity: 'P1', description: d, evidence: '' })
  }

  // ── 7. 언어 일관성 ─────────────────────────────────────────
  const langMix = detectLanguageMix(reply, r.lang)
  if (langMix) issues.push({ code: 'LANG_MIX', severity: 'P1', description: langMix, evidence: '' })

  // ── 8. Echo 미활용 ─────────────────────────────────────────
  const echo = detectMissedEcho(r.review_text, reply, r.lang, decision.classification.status)
  if (echo) issues.push({ code: 'MISSED_ECHO', severity: 'P2', description: echo, evidence: '' })

  // ── 9. 클로징 반복 추적 ────────────────────────────────────
  const closing = trackClosing(reply, r.lang)
  if (closing) issues.push({ code: 'REPETITIVE_CLOSING', severity: 'P2', description: closing, evidence: '' })

  allResults.push({
    idx: i + 1,
    review: r,
    status: decision.classification.status,
    route: decision.route,
    tags: decision.classification.tags,
    primaryIntent: decision.primaryIntent,
    reply,
    issues,
  })
}

// ═══════════════════════════════════════════════════════════════
//  리포트 출력
// ═══════════════════════════════════════════════════════════════

const SEP = '═'.repeat(100)
const sep = '─'.repeat(100)

// ── 요약 ──────────────────────────────────────────────────────
console.log(`\n${SEP}`)
console.log('  ARTE MUSEUM — 심층 품질 분석 리포트 (합성 리뷰 ' + SYNTHETIC_REVIEWS.length + '건)')
console.log(SEP)

const statusCount: Record<string, number> = {}
const issueCount: Record<string, number> = {}
const p0Cases: ReviewResult[] = []
const p1Cases: ReviewResult[] = []

for (const r of allResults) {
  statusCount[r.status] = (statusCount[r.status] || 0) + 1
  for (const iss of r.issues) {
    issueCount[iss.code] = (issueCount[iss.code] || 0) + 1
    if (iss.severity === 'P0') p0Cases.push(r)
    else if (iss.severity === 'P1') p1Cases.push(r)
  }
}

console.log('\n[ 분류 현황 ]')
for (const [k, v] of Object.entries(statusCount).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}건`)
}

const routeCount: Record<string, number> = {}
for (const r of allResults) routeCount[r.route] = (routeCount[r.route] || 0) + 1
console.log('\n[ 라우팅 현황 ]')
for (const [k, v] of Object.entries(routeCount)) console.log(`  ${k.padEnd(20)} ${v}건`)

console.log('\n[ 이슈 집계 ]')
const sorted = Object.entries(issueCount).sort((a,b) => b[1]-a[1])
for (const [k, v] of sorted) console.log(`  ${k.padEnd(30)} ${v}건`)
const totalIssues = allResults.filter(r => r.issues.length > 0).length
console.log(`\n  이슈 있는 리뷰: ${totalIssues}/${SYNTHETIC_REVIEWS.length}건`)

// ── P0 케이스 먼저 ────────────────────────────────────────────
if (p0Cases.length > 0) {
  console.log(`\n${SEP}`)
  console.log('  🔴 P0 CRITICAL ISSUES (즉시 수정 필요)')
  console.log(SEP)
  const seen = new Set<number>()
  for (const r of p0Cases) {
    if (seen.has(r.idx)) continue
    seen.add(r.idx)
    const p0Issues = r.issues.filter(i => i.severity === 'P0')
    console.log(`\n[#${r.idx}] ★${r.review.rating} ${r.review.location}/${r.review.lang} | ${r.review.reviewer_name} | ${r.review.demographic}`)
    console.log(`  분류: ${r.status} | 라우트: ${r.route} | 태그: [${r.tags.join(', ')}]`)
    console.log(`  시나리오: ${r.review.scenario}`)
    console.log(`  리뷰: ${r.review.review_text.substring(0, 80)}…`)
    for (const iss of p0Issues) {
      console.log(`  ❌ ${iss.code}: ${iss.description}`)
    }
    console.log(`  답변: ${r.reply.substring(0, 120)}…`)
  }
}

// ── 전체 상세 ─────────────────────────────────────────────────
console.log(`\n${SEP}`)
console.log('  전체 답변 상세')
console.log(SEP)

for (const r of allResults) {
  const icon = r.issues.length === 0 ? '✓' : (r.issues.some(i => i.severity === 'P0') ? '🔴' : '⚠')
  console.log(`\n[#${r.idx}] ★${r.review.rating} ${r.review.location}/${r.review.lang} | ${r.review.reviewer_name} | ${r.review.demographic}`)
  console.log(`  분류: ${r.status} | 라우트: ${r.route} | 시나리오: ${r.review.scenario}`)
  console.log(`  태그: [${r.tags.join(', ')}] | 핵심인텐트: ${r.primaryIntent ?? '-'}`)
  console.log(`  리뷰: ${r.review.review_text.substring(0, 80)}${r.review.review_text.length > 80 ? '…' : ''}`)
  console.log(`  답변(${r.reply.length}자): ${icon}`)
  // 답변 전문 출력 (150자씩)
  const lines = r.reply.match(/.{1,90}/g) || [r.reply]
  for (const line of lines.slice(0, 6)) console.log(`    ${line}`)
  if (lines.length > 6) console.log(`    … (${r.reply.length}자 총)`)
  if (r.issues.length > 0) {
    for (const iss of r.issues) {
      const badge = iss.severity === 'P0' ? '❌' : iss.severity === 'P1' ? '⚠' : '💡'
      console.log(`  ${badge} [${iss.severity}] ${iss.code}: ${iss.description}`)
    }
  }
}

// ── 패턴별 개선 제안 ─────────────────────────────────────────
console.log(`\n${SEP}`)
console.log('  패턴 분석 & 개선 제안')
console.log(SEP)

// AI_SMELL 빈출 패턴 집계
const aiSmellDetails: Record<string, number> = {}
for (const r of allResults) {
  for (const iss of r.issues) {
    if (iss.code === 'AI_SMELL') {
      const key = iss.description.substring(0, 50)
      aiSmellDetails[key] = (aiSmellDetails[key] || 0) + 1
    }
  }
}
if (Object.keys(aiSmellDetails).length > 0) {
  console.log('\n[ AI_SMELL 빈출 패턴 — staticTemplates.ts 개선 필요 ]')
  for (const [k, v] of Object.entries(aiSmellDetails).sort((a,b) => b[1]-a[1])) {
    console.log(`  (${v}건) "${k}"`)
  }
}

// 클로징 반복 패턴
console.log('\n[ 반복 클로징 패턴 ]')
for (const [k, v] of Object.entries(CLOSING_CORPUS).sort((a,b) => b[1]-a[1])) {
  const pct = Math.round(v / allResults.length * 100)
  console.log(`  ${k}: ${v}회 (${pct}%)`)
}

// 분류 미스 패턴
const misclassifies = allResults.filter(r => r.issues.some(i => i.code === 'MISCLASSIFY'))
if (misclassifies.length > 0) {
  console.log('\n[ 오분류 케이스 ]')
  for (const r of misclassifies) {
    console.log(`  #${r.idx} ★${r.review.rating} ${r.review.lang} ${r.review.scenario} → ${r.status}`)
    console.log(`    "${r.review.review_text.substring(0, 60)}…"`)
  }
}

// 언어 지원 현황
const langCoverage: Record<string, { total: number; withIssue: number }> = {}
for (const r of allResults) {
  const l = r.review.lang
  langCoverage[l] = langCoverage[l] || { total: 0, withIssue: 0 }
  langCoverage[l].total++
  if (r.issues.length > 0) langCoverage[l].withIssue++
}
console.log('\n[ 언어별 이슈 비율 ]')
for (const [lang, data] of Object.entries(langCoverage)) {
  const pct = Math.round(data.withIssue / data.total * 100)
  console.log(`  ${lang}: ${data.withIssue}/${data.total} 이슈 (${pct}%)`)
}

console.log(`\n${SEP}`)
console.log('  분석 완료')
console.log(SEP + '\n')

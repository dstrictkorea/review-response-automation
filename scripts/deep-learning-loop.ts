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

  // ─────────────────────────────────────────────────────────────────
  // [ES] Spanish-speaking visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'es', demographic: '29yo Mexican female', scenario: 'es-5star-wow',
    reviewer_name: 'Valentina Reyes',
    review_text: '¡Increíble experiencia! Las instalaciones de luz son mágicas. Estuve casi 2 horas y no fue suficiente. Regresaré sin duda.' },
  { rating: 5, location: 'AMNY', lang: 'es', demographic: '35yo Colombian male', scenario: 'es-5star-emotional',
    reviewer_name: 'Andrés Morales',
    review_text: 'Me dejó sin palabras. La sala de los espejos infinitos me hizo reflexionar. Arte inmersivo como debe ser.' },
  { rating: 2, location: 'AMDB', lang: 'es', demographic: '41yo Argentine female', scenario: 'es-complaint-crowded',
    reviewer_name: 'Luciana Fernández',
    review_text: 'Demasiada gente. No se podía disfrutar nada. Había que esperar 15 minutos para entrar a cada sala. Precio muy alto para esa experiencia.' },
  { rating: 3, location: 'AMLV', lang: 'es', demographic: '26yo Spanish male', scenario: 'es-mixed-display',
    reviewer_name: 'Pablo Ruiz',
    review_text: 'Algunas salas son espectaculares pero el proyector de la sala principal estaba fallando continuamente. Arruinó la inmersión.' },

  // ─────────────────────────────────────────────────────────────────
  // [PT] Portuguese-speaking visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'pt', demographic: '31yo Brazilian female', scenario: 'pt-5star-family',
    reviewer_name: 'Isabela Santos',
    review_text: 'Fui com minha família e todos adoraram. As crianças ficaram encantadas. Um lugar realmente especial em Nova York.' },
  { rating: 2, location: 'AMDB', lang: 'pt', demographic: '45yo Portuguese male', scenario: 'pt-complaint-staff',
    reviewer_name: 'Ricardo Pereira',
    review_text: 'O funcionário na entrada foi muito grosseiro quando perguntei sobre o horário. Não era necessário ser tão rude. A exposição em si é bonita, mas o atendimento dececionou.' },

  // ─────────────────────────────────────────────────────────────────
  // [KO] Gen-Z 슬랭 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '20대 한국인 여성 Z세대', scenario: 'ko-genz-5star-slang',
    reviewer_name: '한지민',
    review_text: '진짜 대박이에요 ㅋㅋ 사진 너무 잘 나오고 몰입감 완전 최고. 인스타 올리니까 친구들이 다 물어봐요. 강추강추' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '22대 한국인 남성 Z세대', scenario: 'ko-genz-5star-short',
    reviewer_name: '서도윤',
    review_text: '갓갓갓. 진짜 개감사했어요 ㅠㅠ 다음에 또 올게요' },
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '24대 한국인 여성 Z세대', scenario: 'ko-genz-1star-rant',
    reviewer_name: '이수아',
    review_text: '헐 진짜 사람 너무 많아서 제대로 즐기지도 못했어요. 사진 찍으려고 줄 서있다가 결국 포기. 완전 돈 아까움. 직원도 불친절하고' },
  { rating: 4, location: 'AMDB', lang: 'ko', demographic: '19대 한국인 남성 Z세대', scenario: 'ko-genz-4star-mixed',
    reviewer_name: '김준혁',
    review_text: '전체적으로 좋았는데 한 방이 고장나있어서 아쉬웠어요. 나머지는 진짜 잘 만든 듯. 빛 효과 특히 좋았음' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Senior / elderly visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'en', demographic: '68yo American female senior', scenario: 'en-senior-dark-corridors',
    reviewer_name: 'Dorothy Schreiber',
    review_text: 'My husband and I are both in our late 60s and found the dark corridors between exhibits quite challenging. My husband uses a cane and there was no handrail visible. The art itself was gorgeous but I worried about our safety the whole time.' },
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '72yo British male senior', scenario: 'en-senior-no-seating',
    reviewer_name: 'Gordon Whitfield',
    review_text: 'For those of us past a certain age, the complete lack of seating is a real problem. I had to leave early because there was nowhere to rest. Magnificent visuals but not designed with older visitors in mind.' },
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '65yo American female senior slip', scenario: 'en-senior-slip-emergency',
    reviewer_name: 'Patricia Holden',
    review_text: 'I slipped on a wet patch near the entrance and hurt my wrist. Staff were not particularly helpful and there was no incident report taken. I am a senior with osteoporosis and this is a serious safety concern.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Group / corporate visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '38yo American female HR manager', scenario: 'en-corporate-group-positive',
    reviewer_name: 'Monique Hayes',
    review_text: 'Booked for a team of 22 people for a company outing. The group coordinator was incredibly helpful and the entire experience was seamless. Everyone raved about it for weeks. Would book for corporate events again.' },
  { rating: 3, location: 'AMLV', lang: 'en', demographic: '44yo American male event planner', scenario: 'en-corporate-group-neutral',
    reviewer_name: 'Derek Connolly',
    review_text: 'We did a private group booking for 40 people. The space is stunning but the group logistics were a bit chaotic — no dedicated staff for group coordination during the visit. Would benefit from a dedicated group host.' },

  // ─────────────────────────────────────────────────────────────────
  // [KO/EN] 코드스위칭 (이중언어 혼용)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '28대 교포 한국인', scenario: 'ko-en-codeswitching-5star',
    reviewer_name: '박지수',
    review_text: '두바이에서 이런 곳을 발견할 줄은 몰랐어요. So immersive and magical! 친구들한테 무조건 추천하는 곳. 진짜 beautiful experience였어요.' },
  { rating: 2, location: 'AMNY', lang: 'ko', demographic: '32대 교포 한국인', scenario: 'ko-en-codeswitching-complaint',
    reviewer_name: '최민준',
    review_text: '기대했던 것보다 disappointing. The queue was so long and 직원들이 안내를 잘 안 해줬어요. 돈이 아깝다는 생각이 들었어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [AR] Arabic visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ar', demographic: '33yo UAE female', scenario: 'ar-5star-stunning',
    reviewer_name: 'Nora Al-Rashidi',
    review_text: 'تجربة لا تُنسى! الفنون المضيئة كانت ساحرة تماماً. زرتها مع عائلتي وكان الجميع مبهوراً. سنعود بكل تأكيد.' },
  { rating: 2, location: 'AMDB', lang: 'ar', demographic: '39yo Saudi male', scenario: 'ar-complaint-crowd',
    reviewer_name: 'Faisal Al-Otaibi',
    review_text: 'الأسعار مرتفعة جداً مقارنة بالتجربة. كانت المكان مزدحماً جداً وصعب الاستمتاع. يحتاجون لتنظيم أفضل لعدد الزوار.' },

  // ─────────────────────────────────────────────────────────────────
  // [DE] German visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'de', demographic: '34yo German male', scenario: 'de-5star-immersive',
    reviewer_name: 'Thomas Becker',
    review_text: 'Wunderschönes Erlebnis. Die Lichtinstallationen sind technisch beeindruckend und künstlerisch tiefgründig. Einer der besten Museumsbesuche meines Lebens.' },
  { rating: 3, location: 'AMLV', lang: 'de', demographic: '41yo German female', scenario: 'de-complaint-duration',
    reviewer_name: 'Franziska Müller',
    review_text: 'Die Ausstellung ist schön, aber für den Preis hätte ich mehr Inhalt erwartet. Nach 45 Minuten hatte ich alles gesehen. Für Familien mit Kindern sicher schöner.' },

  // ─────────────────────────────────────────────────────────────────
  // [ZH-TW] Traditional Chinese (Taiwan / Hong Kong)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'zh', demographic: '27歲台灣女性', scenario: 'zh-tw-5star-photo',
    reviewer_name: '林雅婷',
    review_text: '超級好拍！每一個空間都像是天然的攝影棚。跟閨蜜一起來，拍了好幾百張照片。光影設計真的很美，強烈推薦！' },
  { rating: 2, location: 'AMNY', lang: 'zh', demographic: '45歲香港男性', scenario: 'zh-hk-complaint-broken',
    reviewer_name: '陳志偉',
    review_text: '其中一個展區的投影機壞掉了，工作人員說正在修理，但等了半個多小時還沒好。買票時沒有說會有展區關閉，感覺被欺騙了。' },

  // ─────────────────────────────────────────────────────────────────
  // [VI] Vietnamese visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'vi', demographic: '25 tuổi người Việt nữ', scenario: 'vi-5star-magical',
    reviewer_name: 'Nguyen Linh Chi',
    review_text: 'Trải nghiệm tuyệt vời! Ánh sáng và âm nhạc hòa quyện với nhau rất đẹp. Tôi và bạn bè đã ở lại gần 2 tiếng. Nhất định sẽ quay lại!' },
  { rating: 3, location: 'AMLV', lang: 'vi', demographic: '38 tuổi người Việt nam', scenario: 'vi-3star-mixed',
    reviewer_name: 'Tran Van Minh',
    review_text: 'Không gian đẹp nhưng hướng dẫn bằng tiếng Việt hạn chế. May mắn có bạn biết tiếng Anh đi cùng. Nên có thêm hỗ trợ đa ngôn ngữ.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Accessibility / disability-specific
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '28yo American female wheelchair user', scenario: 'en-wheelchair-positive',
    reviewer_name: 'Keisha Washington',
    review_text: 'As a wheelchair user I was relieved to find most areas fully accessible. Staff were proactive in guiding me through the accessible routes. One room had a narrow entry but a staff member helped me through without making it awkward.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '36yo British male deaf', scenario: 'en-deaf-complaint',
    reviewer_name: 'Oliver Marsh',
    review_text: 'I am deaf and rely on visual information. There were almost no captions or visual descriptions for any of the audio components. The sound is clearly a major part of the experience that I completely missed. This needs to change.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Specific room mentions (FOREST / WAVE / GARDEN)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '30yo American female', scenario: 'en-5star-forest-room',
    reviewer_name: 'Allison Park',
    review_text: 'The forest room stopped me in my tracks. I just stood there for ten minutes surrounded by projected trees and birdsong. Completely transported. Worth every penny.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '27yo Australian male', scenario: 'en-5star-wave-room',
    reviewer_name: 'Liam Henderson',
    review_text: 'The wave room is an absolute masterpiece. Lying on the floor watching the ocean move over you — pure bliss. My favourite immersive experience ever.' },
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '33yo Canadian female', scenario: 'en-3star-garden-broken',
    reviewer_name: 'Sophie Tremblay',
    review_text: 'The garden room was out of service when we visited. That was the room I most wanted to see. The rest was beautiful but I left disappointed. Please ensure all exhibits are running before selling tickets.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Repeat visitor scenarios
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '29yo American female 3rd visit', scenario: 'en-repeat-visitor-loved',
    reviewer_name: 'Brittany Cole',
    review_text: 'This is my third visit and I love it more every time. The seasonal rotation keeps it fresh. I came alone this time just to really absorb it. Some places get old — this one gets better.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '34yo Canadian male 2nd visit', scenario: 'en-repeat-visitor-disappointed',
    reviewer_name: 'Nathan Bouchard',
    review_text: 'First visit last year was amazing. Came back hoping for new content but it was almost identical. They need to rotate the exhibitions more often. Not worth the return ticket at the same price.' },

  // ─────────────────────────────────────────────────────────────────
  // [KO] 시설·운영 특화 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMNY', lang: 'ko', demographic: '31대 한국인 여성', scenario: 'ko-locker-complaint',
    reviewer_name: '임가영',
    review_text: '물건 맡기는 락커가 너무 적어요. 가방 들고 들어가니 불편하고 전시를 제대로 즐기기 힘들었어요. 락커 수를 늘려줬으면 좋겠어요.' },
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '35대 한국인 남성', scenario: 'ko-stolen-item',
    reviewer_name: '조성민',
    review_text: '락커에 물건을 맡겼는데 카드 지갑이 없어졌어요. 직원한테 말하니까 확인이 어렵다고만 하고 도움이 안 됐어요. 정말 실망스럽습니다.' },
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '29대 한국인 여성', scenario: 'ko-photo-rules-unclear',
    reviewer_name: '윤지원',
    review_text: '어디서는 사진을 못 찍게 하고 어디서는 찍어도 된다고 하는데 기준이 불명확해요. 직원마다 얘기가 달라서 혼란스러웠어요.' },
  { rating: 2, location: 'AMNY', lang: 'ko', demographic: '27대 한국인 남성', scenario: 'ko-smell-complaint',
    reviewer_name: '송민수',
    review_text: '한 구역에서 이상한 냄새가 계속 났어요. 기계 냄새인지 화학 냄새인지 불쾌했어요. 환기가 제대로 안 되는 것 같아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Photography policy & marketing clarity
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '24yo American female', scenario: 'en-no-photos-angry',
    reviewer_name: 'Jade Robinson',
    review_text: 'Was told we could not take photos in certain rooms but nobody mentioned this at the entrance. We missed our best photo opportunities because staff only told us after we were already inside. Very frustrating.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '40yo British female', scenario: 'en-photography-positive',
    reviewer_name: 'Victoria Sanders',
    review_text: 'Loved that photography is welcomed and staff even offered to take photos of us. So many museums are restrictive — this openness makes the experience so much more shareable and memorable.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '36yo American female', scenario: 'en-misleading-photos',
    reviewer_name: 'Crystal Morrison',
    review_text: 'The Instagram photos are heavily edited. In person it is much dimmer and less vibrant. I feel misled by the marketing. Please manage customer expectations or people will leave disappointed like I did.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Diverse nationalities
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '30yo Moroccan female', scenario: 'en-moroccan-5star',
    reviewer_name: 'Samira Benali',
    review_text: 'Coming from Morocco, I expected something good but this surpassed every expectation. The light installations reminded me of Moorish geometric patterns. A truly global art experience.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '27yo Vietnamese-American female', scenario: 'en-viet-american-4star',
    reviewer_name: 'Mai Tran',
    review_text: 'Beautiful and calming. My grandmother came with us and even she was moved by the light displays. Something that crosses all age and cultural barriers. Took off a star only because the wait time was long.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '36yo Pakistani male', scenario: 'en-pakistani-5star',
    reviewer_name: 'Hassan Khalid',
    review_text: 'Brought my kids for a birthday treat. The forest room had them literally jumping for joy. Staff were warm and patient with our excited children. Pure magic.' },
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '29yo Greek female', scenario: 'en-greek-3star-duration',
    reviewer_name: 'Elena Papadopoulos',
    review_text: 'Beautiful concept but feels short for the price. I finished in under an hour. Still, I expected more content for what I paid.' },
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '43yo Kenyan male legal complaint', scenario: 'en-kenyan-legal-threat',
    reviewer_name: 'James Otieno',
    review_text: 'My child was injured by a malfunctioning interactive panel that fell. Staff showed no urgency and there was no first aid kit immediately available. I am consulting with a lawyer about this incident. Management needs to be held accountable.' },

  // ─────────────────────────────────────────────────────────────────
  // [JA] Japanese visitors (varied generations)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ja', demographic: '25歳日本人女性カップル', scenario: 'ja-5star-couple',
    reviewer_name: '田中彩花',
    review_text: '彼とのデートに来ました。光と音楽のコラボレーションが最高で、二人でずっと見ていたかったです。絶対にまた来ます！' },
  { rating: 2, location: 'AMLV', lang: 'ja', demographic: '58歳日本人男性', scenario: 'ja-senior-complaint',
    reviewer_name: '小林隆',
    review_text: '暗い通路での案内が不十分で、妻が足をひねってしまいました。スタッフに報告しましたが、対応が遅く、誠意が感じられませんでした。高齢者や体の不自由な方への配慮が必要です。' },
  { rating: 5, location: 'AMNY', lang: 'ja', demographic: '16歳日本人女性修学旅行', scenario: 'ja-teen-school-trip',
    reviewer_name: '鈴木美咲',
    review_text: '修学旅行でニューヨークに来て、ここが一番の思い出になりました！光の中を歩いているみたいで夢のようでした。友達と写真をたくさん撮りました。' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Ultra-short one-liners (SHORT mode stress test)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '22yo American male', scenario: 'en-ultrashort-wow',
    reviewer_name: 'Tyler Hayes',
    review_text: 'Mind-blowing.' },
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '44yo British female', scenario: 'en-ultrashort-loved',
    reviewer_name: 'Harriet Fox',
    review_text: 'Absolutely loved it.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '33yo American female', scenario: 'en-ultrashort-best',
    reviewer_name: 'Destiny Walker',
    review_text: 'Best experience in Vegas by far.' },

  // ─────────────────────────────────────────────────────────────────
  // [KO] 극단적 단문
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '23대 한국인', scenario: 'ko-ultrashort-1',
    reviewer_name: '정도현',
    review_text: '최고' },
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '31대 한국인', scenario: 'ko-ultrashort-2',
    reviewer_name: '박현아',
    review_text: '너무 좋아요' },
  { rating: 1, location: 'AMLV', lang: 'ko', demographic: '27대 한국인', scenario: 'ko-ultrashort-bad',
    reviewer_name: '김영훈',
    review_text: '별로' },

  // ─────────────────────────────────────────────────────────────────
  // [FR] French visitors
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'fr', demographic: '32yo French female', scenario: 'fr-5star-magnifique',
    reviewer_name: 'Camille Dupont',
    review_text: 'Magnifique. La salle des miroirs est simplement hypnotisante. Une expérience que je recommande à tous les amoureux de l\'art contemporain.' },
  { rating: 2, location: 'AMLV', lang: 'fr', demographic: '47yo French male', scenario: 'fr-complaint-price',
    reviewer_name: 'Julien Martin',
    review_text: 'Visuellement impressionnant mais très court pour le prix. 40 minutes pour le tour complet, c\'est peu pour ce que ça coûte. On s\'attendrait à plus de contenu.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Constructive ★4 reviews
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMDB', lang: 'en', demographic: '35yo American male solo traveler', scenario: 'en-4star-solo-constructive',
    reviewer_name: 'Marcus Reid',
    review_text: 'Genuinely moving experience. My only note is that the audio guide was not well synced with the rooms — by the time narration finished I was already in the next room. A minor fix would make this perfect.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '41yo Indian female tourist', scenario: 'en-4star-indian-female',
    reviewer_name: 'Priya Nair',
    review_text: 'My first immersive art exhibition and I was blown away. The sensory experience is unlike anything I have tried. Only reason for 4 stars is the entry queue was quite long. Otherwise flawless.' },
  { rating: 4, location: 'AMLV', lang: 'en', demographic: '26yo Thai female', scenario: 'en-4star-thai',
    reviewer_name: 'Ploy Srisuk',
    review_text: 'Stunning artwork and very photogenic. The nature-themed rooms were my favourite. Lost one star because the tea bar ran out of what I wanted and staff seemed understaffed that day.' },

  // ─────────────────────────────────────────────────────────────────
  // [KO] 추가 다양성
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '33대 한국인 여성', scenario: 'ko-queue-system-bad',
    reviewer_name: '신은경',
    review_text: '대기 시스템이 너무 엉망이에요. 시간 예약하고 갔는데 45분을 기다렸어요. 예약 의미가 없네요. 직원도 정확한 안내를 못 해줬어요.' },
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '40대 한국인 여성 주부', scenario: 'ko-mom-5star-with-kids',
    reviewer_name: '오미영',
    review_text: '아이들 데리고 왔는데 아이들이 너무 좋아했어요. 빛이 움직이는 게 신기한가봐요. 엄마인 저도 힐링이 됐어요. 가족 나들이로 진짜 추천해요.' },
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '36대 한국인 남성', scenario: 'ko-content-same-as-last-year',
    reviewer_name: '한재원',
    review_text: '작년에도 와봤는데 내용이 거의 똑같아요. 새로운 전시가 없어서 아쉬웠어요. 주기적으로 새 콘텐츠를 추가해줬으면 좋겠어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [EN] Night event / special occasion
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '31yo American female', scenario: 'en-night-event-5star',
    reviewer_name: 'Cassandra Hill',
    review_text: 'Attended the after-dark cocktail evening. The whole atmosphere at night is completely different — more romantic and intimate. The music selection was perfect. Would 100% do this again for a date night.' },

  // ─────────────────────────────────────────────────────────────────
  // [EMERGENCY] 법적 위협 — LEGAL_THREAT 태그 (관리자 승인 필수)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '41대 한국인 남성', scenario: 'ko-legal-threat',
    reviewer_name: '강현석',
    review_text: '아이가 전시 중 미끄러져서 다쳤는데 직원이 제대로 대응을 안 했어요. 병원 진단서도 있고 변호사 통해서 법적으로 처리할 생각입니다.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '39yo American female', scenario: 'en-legal-threat',
    reviewer_name: 'Amanda Clarke',
    review_text: 'My elderly mother fell near the entrance due to a wet floor with no warning sign. She has a fractured wrist. I have already consulted with a lawyer and will be taking legal action if this is not handled properly.' },
  { rating: 1, location: 'AMLV', lang: 'ko', demographic: '35대 한국인 여성', scenario: 'ko-legal-sobirgo',
    reviewer_name: '문서연',
    review_text: '이 상황에 소비자원에 신고할 예정이에요. 티켓 구매 후 전시 일부가 운영 안 됐는데 환불도 안 해줬고 아무런 공지도 없었어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [EMERGENCY] 보상 요구 — COMPENSATION_DEMAND 태그
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '28yo British male', scenario: 'en-compensation-demand',
    reviewer_name: 'Callum Robertson',
    review_text: 'Two of the main rooms were closed when we visited — nobody told us at entry. I paid full price for a partial experience. I am requesting a refund or partial credit. This is unacceptable.' },
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '33대 한국인 여성', scenario: 'ko-refund-demand',
    reviewer_name: '김지선',
    review_text: '사전 예약하고 갔는데 기기 오류로 30분이나 기다렸어요. 관람 시간도 줄었고 체험도 제대로 못 했어요. 환불해 주셨으면 합니다.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '44yo American female', scenario: 'en-chargeback-threat',
    reviewer_name: 'Sharon Mitchell',
    review_text: 'I paid for a premium ticket and two of the interactive exhibits were broken the whole time. This is false advertising. I will be disputing this charge with my credit card company if I do not hear back.' },

  // ─────────────────────────────────────────────────────────────────
  // [EMERGENCY] 직원 처벌 요구 — PUNISHMENT_DEMAND 태그
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '37대 한국인 남성', scenario: 'ko-fire-staff',
    reviewer_name: '이재훈',
    review_text: '직원이 아이에게 너무 불친절하게 대했어요. 어린이라고 무시하는 느낌이었어요. 그 직원은 처벌받아야 한다고 생각합니다. 이런 직원이 고객 응대를 하면 안 되죠.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '31yo Australian female', scenario: 'en-fire-staff',
    reviewer_name: 'Zoe Williamson',
    review_text: 'The security guard was aggressive and unnecessarily rude to my group. He raised his voice and pointed at us in front of other visitors. That staff member should be fired. I will never come back as long as that person is employed here.' },
  { rating: 1, location: 'AMLV', lang: 'ko', demographic: '45대 한국인 여성', scenario: 'ko-punish-staff-rude',
    reviewer_name: '박순희',
    review_text: '직원이 대놓고 눈을 흘기면서 불친절했어요. 기본 에티켓도 없는 직원이에요. 직원 교육 다시 시키고 징계도 내려주세요. 이런 직원이 있으면 브랜드에 안 좋아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [EMERGENCY] 복합 유형 — 법적+보상, 처벌+보상 등
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '50yo American male', scenario: 'en-combined-legal-compensation',
    reviewer_name: 'Bruce Lawson',
    review_text: 'My wife slipped on a wet floor, no hazard sign anywhere. She is hurt and saw a doctor. I want a full refund and a formal apology. If I do not hear back within 48 hours I will be contacting my attorney.' },
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '29대 한국인 남성', scenario: 'ko-combined-punish-refund',
    reviewer_name: '정승훈',
    review_text: '입장 시 직원이 굉장히 무례했고 기기도 고장나있었어요. 직원은 징계받아야 하고, 제대로 된 환불도 요청합니다. 이건 소비자 권리예요.' },

  // ─────────────────────────────────────────────────────────────────
  // [NEW ANGLES] 다양한 관점 — 이전에 없던 시나리오
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '55대 한국인 여성 교육자', scenario: 'ko-educator-5star',
    reviewer_name: '권미숙',
    review_text: '중학교 교사인데 학생들 체험학습 장소로 선택했어요. 학생들이 미디어아트의 원리에 호기심을 갖는 모습이 너무 좋았어요. 교육적으로도 가치 있는 공간이에요.' },
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '67yo retired American male art critic', scenario: 'en-art-critic-4star',
    reviewer_name: 'Gerald Hawthorne',
    review_text: 'A serious art critic might be skeptical of the populist format, but I was genuinely impressed by the sophistication of the light design. Not every room achieved the same depth, but the best ones had real artistic vision. Recommended for open-minded traditionalists.' },
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '24yo Instagram influencer', scenario: 'en-influencer-5star',
    reviewer_name: 'Jade Summers',
    review_text: 'Honestly did not expect it to be THIS good. Every single room is a different vibe. My reel got 2 million views after posting from here. The forest room and the infinity mirror are pure content gold. If you are a creator — this is a non-negotiable.' },
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '38대 한국인 남성 청각장애인', scenario: 'ko-deaf-complaint',
    reviewer_name: '남기호',
    review_text: '청각장애인인데 소리 위주의 전시가 너무 많아서 체험에 한계가 많았어요. 진동이나 자막 등 배리어프리 요소가 더 많이 필요합니다. 접근성에 신경 써주세요.' },
  { rating: 5, location: 'AMNY', lang: 'ru', demographic: '32yo Russian female', scenario: 'ru-5star',
    reviewer_name: 'Ekaterina Volkova',
    review_text: 'Невероятный опыт! Световые инсталляции поразили меня до глубины души. Каждый зал — это отдельный мир. Обязательно вернусь снова.' },
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '42대 한국인 남성 사진작가', scenario: 'ko-photographer-3star',
    reviewer_name: '오태균',
    review_text: '사진 찍기 좋은 공간이긴 한데, 셀카봉이나 삼각대를 금지하는 구역이 너무 많아요. 전문 사진 작업을 위한 별도 시간대나 구역이 있으면 좋겠어요.' },
  { rating: 1, location: 'AMDB', lang: 'en', demographic: '35yo American male epileptic', scenario: 'en-photosensitive-safety',
    reviewer_name: 'Daniel Morrison',
    review_text: 'I have photosensitive epilepsy and there were NO clear warnings about flashing lights at the entrance. I experienced a near-seizure episode inside. This is a serious safety and accessibility failure. You must display proper warnings.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 한국어 지역 방언 & 구어체
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '30대 부산 남성 (경상도)', scenario: 'ko-busan-dialect-5star',
    reviewer_name: '강동원',
    review_text: '라스베가스 왔다가 여기 왔는데 진짜 대박이더라. 친구들이랑 왔는데 다들 입틀막. 숲 방이 진짜 장난 아니더라고. 부산에도 이런 거 하나 있으면 좋겠다 싶더라.' },
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '40대 전주 여성 (전라도)', scenario: 'ko-jeonju-dialect-complaint',
    reviewer_name: '유미진',
    review_text: '두바이까지 왔는디 기대가 너무 컸는지 생각보다 별루였어. 설명도 없고 그냥 막 돌아다니는 거더라고. 가격 대비 별로여. 한 번 보고 나면 볼 게 없음.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 기업/단체 방문
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '42yo American HR manager, group visit', scenario: 'en-corporate-group-complaint',
    reviewer_name: 'Patricia Webb',
    review_text: 'We booked for a team-building event of 30 people. The staff were unprepared — no designated guide, no group introduction, and the private room we reserved was double-booked. A complete organizational failure. I would not recommend for corporate events.' },
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '35대 한국인 행사 담당자', scenario: 'ko-corporate-group-5star',
    reviewer_name: '서민준',
    review_text: '회사 워크샵으로 40명 단체 예약했어요. 담당자분이 처음부터 끝까지 세심하게 안내해 주셨고, 팀원들 반응이 최고였어요. 업무 스트레스를 한방에 날린 느낌. 내년에도 여기로 올게요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 종교·문화 배려 필요
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '28yo Emirati female, Muslim', scenario: 'en-prayer-room-request',
    reviewer_name: 'Fatima Al-Mansoori',
    review_text: 'The exhibition itself is visually stunning. However, there is no prayer room or quiet space for Muslim visitors. Given this is Dubai, I would have expected more consideration for this. Please add a designated prayer area.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 음식 알레르기 / 카페 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '29yo American female with nut allergy', scenario: 'en-food-allergy-cafe',
    reviewer_name: 'Samantha Cruz',
    review_text: 'The exhibition was great but the café staff could not tell me whether the snacks contained nuts. I have a severe nut allergy and had to avoid everything at the café. Please train staff on allergen information — this is a safety issue.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 한국어 휠체어 접근성
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '45대 한국인 여성 휠체어 이용자', scenario: 'ko-wheelchair-accessibility',
    reviewer_name: '노선영',
    review_text: '휠체어를 이용하는데 입구 경사로는 있었지만 내부 이동 통로가 너무 좁아서 혼자 다니기가 어려웠어요. 직원도 안내를 해주지 않아서 중간에 포기하고 나왔습니다. 배리어프리 환경이 더 개선되어야 할 것 같아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 3세대 가족
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '50대 한국인 여성, 3세대 가족', scenario: 'ko-three-gen-family',
    reviewer_name: '황인숙',
    review_text: '팔순 넘은 어머니, 초등학생 손자손녀까지 3대가 함께 갔어요. 어르신도 무리 없이 감상하실 수 있었고, 아이들은 뛸 듯이 좋아했어요. 가족 모두가 공감한 공간은 처음이었어요. 두바이 방문하면 필수코스입니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 명절 연휴 혼잡
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '33대 한국인 여성 직장인', scenario: 'ko-holiday-crowd-complaint',
    reviewer_name: '최은지',
    review_text: '설 연휴에 갔더니 사람이 너무 많아서 제대로 감상을 못 했어요. 사진 한 장 찍으려면 줄을 서야 하고, 전시 공간이 워낙 사람으로 가득 차서 답답했습니다. 예약제나 입장 인원 제한이 필요할 것 같아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 퇴장 강요 / 폐관 직전 안내 불량
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '26대 한국인 남성', scenario: 'ko-staff-rushed-exit',
    reviewer_name: '김도현',
    review_text: '마지막 방에서 감상 중인데 직원이 5분 남았다고 소리 지르면서 빨리 나가라고 재촉했어요. 마지막 입장이었던 건 알지만 그렇게 몰아치는 건 기분 나쁩니다. 안내 방식이 너무 무례했어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 사진 삭제 강요 분쟁
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '31yo Canadian female', scenario: 'en-photo-deletion-demand',
    reviewer_name: 'Megan Thornton',
    review_text: 'A staff member demanded I delete photos I had taken in what I thought was a photography-allowed zone. There was no clear signage saying otherwise. Being talked to that aggressively about a honest mistake was humiliating. I left with a terrible impression.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 특정 방 공사 중 실망
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'en', demographic: '37yo American couple', scenario: 'en-room-closed-disappointment',
    reviewer_name: 'Kevin Hartley',
    review_text: 'We bought tickets specifically for the waterfall room we had seen on social media, but it was closed for maintenance with no prior notice. Other rooms were nice but we felt misled. At minimum, update your website or notify buyers in advance.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 콘텐츠 촬영 금지에 반발한 인플루언서
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '25yo UAE influencer', scenario: 'en-influencer-filming-denied',
    reviewer_name: 'Lara Nassir',
    review_text: 'I was told commercial filming requires a permit, fair enough. But even normal video with a phone was restricted in several zones with inconsistent enforcement — some staff said yes, others said no. Confusing policy that cost me content I had planned for.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 외국어 안내 부족 (영어 부족)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'en', demographic: '51yo French female tourist', scenario: 'en-language-barrier-signage',
    reviewer_name: 'Isabelle Laurent',
    review_text: 'The experience was beautiful but some important context was only displayed in Korean. For a venue this prominent in New York, full English translations of all exhibit descriptions should be standard. A multilingual audio guide would also be very welcome.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 아동 안전 우려
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '34대 한국인 여성 (영아 동반)', scenario: 'ko-toddler-safety-concern',
    reviewer_name: '이현정',
    review_text: '18개월 아이를 데리고 갔는데 어두운 방에 경계선이 없어서 아이가 너무 위험했어요. 유아 동반 가족을 위한 별도 안내나 안전 조치가 있었으면 좋겠어요. 전시 자체는 예뻤지만 아이랑은 다시 가기 망설여져요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 혼행 여성
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '29대 한국인 여성 혼자 여행', scenario: 'ko-solo-female-5star',
    reviewer_name: '송채원',
    review_text: '두바이 혼자 여행 중에 들렀는데 솔직히 여기서 제일 좋았어요. 혼자서 천천히 감상하기에 딱 좋은 페이스예요. 직원들도 자연스럽게 도와줘서 외국에서 혼자 있는 느낌이 안 들었고요. 혼여자 분들 강추!' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 굿즈 실망
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'ko', demographic: '27대 한국인 여성', scenario: 'ko-merchandise-disappointment',
    reviewer_name: '한다은',
    review_text: '전시 자체는 정말 좋았는데 굿즈 퀄리티가 너무 기대 이하예요. 가격은 비싼데 품질이 너무 저렴해 보여서 결국 아무것도 못 샀어요. 전시만큼 굿즈도 신경 써주셨으면 합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 소음 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'en', demographic: '55yo American male, sensory sensitivity', scenario: 'en-noise-complaint',
    reviewer_name: 'Thomas Greer',
    review_text: 'The visual experience is undeniably impressive. However, the sound levels in several rooms were uncomfortably loud — I had to leave early as it was overwhelming. A lower-volume option or time slot for visitors with sensory sensitivities would be appreciated.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 온도 불만 (추위)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'ko', demographic: '52대 한국인 여성', scenario: 'ko-temperature-too-cold',
    reviewer_name: '문혜숙',
    review_text: '전시는 아름다웠는데 내부가 너무 추웠어요. 두바이 밖은 40도인데 안에서는 긴팔이 필요할 정도였습니다. 특히 실내 온도에 민감하신 분들은 겉옷 꼭 챙겨 가세요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 긴 대기 줄
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '24yo American male', scenario: 'en-long-queue-complaint',
    reviewer_name: 'Tyler Brooks',
    review_text: 'Waited 90 minutes just to get in on a Saturday. The ticketing system is broken — people who pre-booked were mixed in the same line as walk-ins. Once inside it was fine but the wait completely killed the mood. Fix your entry process.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 앱/기술 오류
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '36yo American female', scenario: 'en-app-tech-failure',
    reviewer_name: 'Ashley Morgan',
    review_text: 'The QR code for the audio guide would not scan on my phone. Staff could not help fix it. I ended up going through the whole exhibit without any context or narrative, which made it far less meaningful. Tech support needs serious improvement.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 경쟁사 비교 (팀랩)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '33yo Japanese-American female', scenario: 'en-teamlab-comparison',
    reviewer_name: 'Yuki Tanaka',
    review_text: 'I have visited teamLab multiple times in Tokyo and borderless in various countries. ARTE has clear artistic ambition but the interactive depth does not quite match yet. The scent element is genuinely original though. Worth visiting if you have not been to teamLab.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 재방문 후 실망 (콘텐츠 미갱신)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '32대 한국인 남성 재방문', scenario: 'ko-repeat-visit-stale',
    reviewer_name: '이상혁',
    review_text: '6개월 전에 왔다가 너무 좋아서 이번에 또 왔어요. 근데 내용이 하나도 안 바뀌었어요. 새로운 전시나 콘텐츠 업데이트가 없으면 재방문 유인이 없겠죠. 콘텐츠 순환이 빠르면 좋겠어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] LGBTQ 커플
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '28yo American female, same-sex couple', scenario: 'en-lgbtq-couple-5star',
    reviewer_name: 'Rachel Kim',
    review_text: 'My girlfriend and I came for our anniversary and felt completely welcome. No awkward stares, no issues. The dream-like atmosphere made it feel like a safe, beautiful world. The couple\'s photos we got in the infinity mirror room are priceless. Highly recommend.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 5] 임산부 배려
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMDB', lang: 'ko', demographic: '31대 한국인 여성 임산부', scenario: 'ko-pregnant-visitor',
    reviewer_name: '김나연',
    review_text: '임신 7개월에 왔는데 직원분이 먼저 다가와서 앉을 곳 안내해 주시고 음향이 강한 방은 우회할 수 있도록 도와줬어요. 덕분에 편안하게 즐겼습니다. 작은 배려가 정말 감사했어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 짧은 한 줄 리뷰 (KO/EN)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '20대 한국인 남성', scenario: 'ko-oneliner-5star',
    reviewer_name: '장민우',
    review_text: '라스베가스 최고의 선택이었어요.' },
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '30대 한국인 여성', scenario: 'ko-oneliner-1star',
    reviewer_name: '오채린',
    review_text: '기대 이하. 실망했어요.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '29yo British male', scenario: 'en-oneliner-wow',
    reviewer_name: 'Oliver Hughes',
    review_text: 'Genuinely one of the most memorable things I have ever done. Go.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 인도 관광객 (영어)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '33yo Indian male tourist', scenario: 'en-indian-5star',
    reviewer_name: 'Arjun Mehta',
    review_text: 'Visited on our Dubai honeymoon and it exceeded all expectations. My wife was in tears at the butterfly room — utterly magical. The entire experience was spiritual in its beauty. Will carry this memory for life.' },
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '41yo Indian female tourist', scenario: 'en-indian-overcrowded',
    reviewer_name: 'Priya Sharma',
    review_text: 'We came during a school holiday period and the crowd management was non-existent. Children were running into each other, parents pushing to get photo spots. Staff stood by and watched. Beautiful concept, terrible execution on that day.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 학교 단체 방문 (교사 인솔)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '42대 한국인 여성 교사', scenario: 'ko-school-trip-teacher',
    reviewer_name: '김연주',
    review_text: '중학생 30명 데리고 왔어요. 담당 직원분이 학생 눈높이에 맞게 설명해 주시고, 혼잡하지 않게 동선도 조율해 주셨어요. 아이들이 미술과 기술의 만남에 감탄하는 모습이 감동이었어요. 내년에도 여기로 올게요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 두 지점 비교 방문 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'en', demographic: '36yo American female repeat visitor', scenario: 'en-compare-locations',
    reviewer_name: 'Heather Collins',
    review_text: 'I have now visited both the Dubai and New York locations. Dubai has a larger space and the scent immersion is more pronounced. New York feels more intimate and thoughtfully curated. Both are excellent, each in a different way. Hard to pick a favourite.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 야간 방문 / 저녁 방문
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '31대 한국인 커플', scenario: 'ko-evening-date',
    reviewer_name: '신하은',
    review_text: '저녁 마감 시간 즈음에 갔더니 사람이 줄어서 훨씬 여유롭게 즐겼어요. 조명 아래서 파도 방이 더 극적으로 느껴졌고, 남자친구랑 오래 앉아서 넋 놓고 봤어요. 야간 방문 추천해요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 이모지 가득한 MZ세대 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '22대 한국인 여성 MZ세대', scenario: 'ko-mz-emoji-5star',
    reviewer_name: '박나리',
    review_text: '두바이 여행 중 갔다가 완전 취향 저격 ㅠㅠ 사진 퀄리티가 남달라서 인스타 올렸더니 반응 미침!! 특히 물방울 떨어지는 방이 진짜 예술이야 🌊✨ 무조건 가세요!!' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 약혼 프로포즈 기념 방문
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '30yo American male, engagement', scenario: 'en-engagement-proposal',
    reviewer_name: 'Nathan Pierce',
    review_text: 'I proposed to my now-fiancée in the infinity mirror room. The staff were incredibly kind and helped us get the moment on camera. We will never forget this place. She said yes, by the way. ARTE New York will always hold a very special place for us.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 상품권 / 선물 카드 문제
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '45yo American female', scenario: 'en-gift-voucher-issue',
    reviewer_name: 'Diana Foster',
    review_text: 'I received an ARTE gift card as a birthday present. When I tried to redeem it at the box office, the system could not read it and staff could not resolve the issue. I ended up paying out of pocket and left frustrated. Please fix your gift card system.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 인도네시아 관광객 (영어)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '27yo Indonesian female tourist', scenario: 'en-indonesian-5star',
    reviewer_name: 'Dewi Rahayu',
    review_text: 'Truly a breathtaking experience. I came from Jakarta specifically to see Dubai and this was the highlight of my trip. The nature-themed rooms made me feel like I was inside a living painting. Highly recommend to all travellers.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 태국 관광객 (영어)
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMDB', lang: 'en', demographic: '28yo Thai female tourist', scenario: 'en-thai-4star',
    reviewer_name: 'Supawadee Charoenwong',
    review_text: 'Very beautiful and relaxing. The flower and butterfly rooms made me feel so peaceful. I only give 4 stars because the audio in my language was not available. It would be even better with Thai audio guides. Will tell all my friends about it.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 파킹 및 교통 불편
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'en', demographic: '49yo American male', scenario: 'en-parking-complaint',
    reviewer_name: 'Donald Reid',
    review_text: 'The exhibition was interesting and well worth seeing. However, parking in the area is a nightmare — the validation system in the garage was broken and I ended up paying $45 for parking. Improve the parking situation and I would easily give 5 stars.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 멕시코 관광객 (스페인어 — 엔진 언어 매핑 테스트)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'es', demographic: '31yo Mexican female tourist', scenario: 'es-mexican-5star',
    reviewer_name: 'Valentina Morales',
    review_text: 'Increíble experiencia. Vine desde Ciudad de México y fue lo mejor de mi viaje a Las Vegas. Las instalaciones de luces son mágicas y perfectas para fotos. Absolutamente recomendado para todos los visitantes.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 브라질 관광객 (포르투갈어)
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'pt', demographic: '26yo Brazilian female tourist', scenario: 'pt-brazilian-4star',
    reviewer_name: 'Isabella Rodrigues',
    review_text: 'Experiência visual incrível! Vim de São Paulo especialmente para conhecer Nova York e esse foi um dos pontos altos. As instalações de natureza eternas são lindíssimas. Só perco um estrela pois a espera na fila foi longa.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 오입력/오타 많은 리뷰 (자연어 노이즈 내성 테스트)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '19대 한국인 남성 (오타 다수)', scenario: 'ko-typo-heavy',
    reviewer_name: '이태민',
    review_text: '진짜 대바악!! 사진이 너무 잘나와서 인스타에 올렸더니 친구들이 어디냐고 난리났음ㅋㅋ 파도방에서 한시간넘게 있었는데 직원분이 뭐 필요하냐고 물어봐줬고 완전 감사해쩌ㅛ 두바이오면 무조건 와야댐!' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 제3자 관점 (선물로 받은 티켓)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '35대 한국인 남성 (생일 선물)', scenario: 'ko-birthday-gift-ticket',
    reviewer_name: '한재원',
    review_text: '여자친구가 생일 선물로 티켓을 사줬는데 이게 올해 최고의 선물이었어요. 평소에 미술관 잘 안 가는데 여기는 전혀 지루하지 않았어요. 별 방에 넋놓고 30분 앉아 있었네요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 6] 특정 작품명 언급 불만 (콘텐츠 낡았다)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '34yo American male repeat visitor', scenario: 'en-content-stale-specific',
    reviewer_name: 'Brandon Walsh',
    review_text: 'Second visit after 8 months and the WAVE room is exactly the same. Not a single new addition. Immersive art venues like this need constant content rotation to justify repeat visits and the premium ticket price.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 7] 일본어 보강 — 긍정/불만/긴급
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ja', demographic: '28才日本人女性カップル', scenario: 'ja-couple-5star',
    reviewer_name: '田中さくら',
    review_text: 'ドバイ旅行で訪れました。映像と音楽と香りが一体になった空間は本当に夢のようで、彼氏と二人で言葉をなくしてしまいました。特にWAVEのお部屋は圧巻でした。また来たいです。' },
  { rating: 1, location: 'AMDB', lang: 'ja', demographic: '45才日本人男性', scenario: 'ja-worst-experience',
    reviewer_name: '鈴木健二',
    review_text: '最悪でした。スタッフの態度が非常に失礼で、質問しても無視されました。これだけの入場料を払っているのに、対応が最低です。二度と来ません。' },
  { rating: 3, location: 'AMNY', lang: 'ja', demographic: '34才日本人女性', scenario: 'ja-mixed-review',
    reviewer_name: '佐藤美咲',
    review_text: '映像は美しかったですが、混雑がひどくて落ち着いて鑑賞できませんでした。週末は避けた方がいいかもしれません。スタッフさんは親切でした。' },
  { rating: 2, location: 'AMLV', lang: 'ja', demographic: '51才日本人女性', scenario: 'ja-staff-rude',
    reviewer_name: '山田花子',
    review_text: '不親切なスタッフがいて残念でした。写真を撮っていたら、突然怒鳴られてびっくりしました。アート空間なのに、雰囲気が台無しでした。がっかりです。' },
  { rating: 4, location: 'AMDB', lang: 'ja', demographic: '39才日本人男性', scenario: 'ja-minor-complaint-4star',
    reviewer_name: '中村翔',
    review_text: 'teamLabと比べても遜色ない素晴らしい体験でした。香りの演出が特に印象的。チケット代がもう少し安いといいのですが。次回は家族を連れてきたいと思います。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 7] 중국어 보강 — 다양한 유형
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'zh', demographic: '26岁中国女性情侣', scenario: 'zh-couple-5star',
    reviewer_name: '李晓雨',
    review_text: '和男友一起来的，整个体验太震撼了！光影和香气完美结合，感觉像是走进了另一个世界。每个房间都是不同的惊喜，特别是花海那个展厅，美哭了。强烈推荐！' },
  { rating: 2, location: 'AMNY', lang: 'zh', demographic: '40岁中国女性', scenario: 'zh-crowd-complaint',
    reviewer_name: '王芳',
    review_text: '人太多了，根本没办法好好欣赏！排队排了将近一个小时，进去之后还是挤。工作人员也不限制入场人数，完全没有秩序。票价不便宜，这样的体验真的很失望。' },
  { rating: 1, location: 'AMDB', lang: 'zh', demographic: '33岁中国男性', scenario: 'zh-staff-complaint',
    reviewer_name: '张伟',
    review_text: '工作人员态度极差，问了两次都被无视了。最终被莫名其妙地请出某个展间，理由都说不清楚。花了这么多钱，却得到这么差的服务，极度失望。' },
  { rating: 4, location: 'AMLV', lang: 'zh', demographic: '29岁中国台湾女性', scenario: 'zh-tw-4star',
    reviewer_name: '陳雅婷',
    review_text: '視覺效果非常震撼，特別是星空房間，感覺整個人都融入其中了。扣一顆星是因為部分投影機畫質有點模糊，希望設備可以再更新。整體體驗還是相當值得。' },
  { rating: 3, location: 'AMDB', lang: 'zh', demographic: '48岁中国男性商务出行', scenario: 'zh-value-complaint',
    reviewer_name: '刘强',
    review_text: '商务出差顺便来参观。展览本身很有创意，但说实话，以这个票价来看，内容量有些少，大概一个小时就逛完了。如果能增加互动体验或展厅数量就更好了。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 7] 스페인어 보강
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'es', demographic: '37yo Colombian male', scenario: 'es-worst',
    reviewer_name: 'Andrés Gómez',
    review_text: 'Una experiencia decepcionante. El personal fue grosero e indiferente cuando pedí información. Varias pantallas estaban apagadas o con fallas técnicas. No lo recomendaría para el precio que cobran.' },
  { rating: 5, location: 'AMDB', lang: 'es', demographic: '24yo Spanish female', scenario: 'es-5star',
    reviewer_name: 'Carmen Ruiz',
    review_text: 'Absolutamente mágico. No tenía grandes expectativas pero salí completamente enamorada de este lugar. La sala del bosque y la sala de mariposas fueron mis favoritas. Me quedé más de dos horas sin darme cuenta.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 7] 아랍어 보강
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ar', demographic: '27yo Saudi female', scenario: 'ar-5star',
    reviewer_name: 'نورة العمري',
    review_text: 'تجربة لا تُنسى! الأضواء والروائح والموسيقى تجتمع معاً لتخلق عالماً مختلفاً تماماً. قضيت أكثر من ساعتين ولم أشعر بالوقت. أنصح كل من يزور دبي بزيارة هذا المكان الرائع.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 7] 기타 소수 언어 보강
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'de', demographic: '32yo German male', scenario: 'de-5star',
    reviewer_name: 'Lukas Schneider',
    review_text: 'Absolut beeindruckend. Die Kombination aus Licht, Klang und Duft hat uns vollständig in den Bann gezogen. Die Wellenkammer war unser Highlight. Definitiv einen Besuch wert, auch für ältere Besucher.' },
  { rating: 5, location: 'AMDB', lang: 'fr', demographic: '36yo French female', scenario: 'fr-5star',
    reviewer_name: 'Chloé Dupont',
    review_text: 'Une expérience immersive époustouflante. Chaque salle est un univers sensoriel à part entière. La salle des papillons m\'a particulièrement touchée. Je recommande vivement à tous les amoureux de l\'art et du voyage.' },
  { rating: 3, location: 'AMDB', lang: 'vi', demographic: '29yo Vietnamese female', scenario: 'vi-3star',
    reviewer_name: 'Nguyễn Thị Mai',
    review_text: 'Trải nghiệm khá ấn tượng về mặt hình ảnh nhưng một số phòng bị lỗi máy chiếu. Nhân viên không thể giải thích rõ ràng bằng tiếng Anh. Giá vé khá cao so với thời gian tham quan.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 틱톡/소셜미디어 관점 — 크리에이터 경험
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMDB', lang: 'en', demographic: '21yo TikTok creator, UAE-based', scenario: 'en-tiktok-creator',
    reviewer_name: 'Amira Hassan',
    review_text: 'Went specifically for TikTok content and honestly it delivered. Every room is a different concept. My only gripe is the "no tripod" policy — hard to create stable content without one. Hopefully they will create a creator-friendly timeslot eventually.' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '24대 한국인 유튜버', scenario: 'ko-youtuber-5star',
    reviewer_name: '임지현',
    review_text: '유튜브 여행 채널 운영 중인데 라스베가스 편 촬영으로 방문했어요. 직원분들이 촬영 허용 구역과 각도 잘 안내해 주셔서 너무 감사했어요. 영상 업로드했더니 조회수 대박났네요. 구독자분들도 아르떼 너무 가고 싶다고 댓글 폭발이에요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 특수 언어 — 힌디어 / 터키어 (유럽어권 관광 패턴)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '29yo Turkish female tourist', scenario: 'en-turkish-5star',
    reviewer_name: 'Elif Kaya',
    review_text: 'The most beautiful thing I have experienced in Dubai. Everything is perfect — the lights, the music, the scent. My photos from the butterfly room look like they are from a dream. I told all my friends in Istanbul to put this on their bucket list.' },
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '34yo Iranian male tourist', scenario: 'en-iranian-3star',
    reviewer_name: 'Reza Hosseini',
    review_text: 'Visually very impressive, though some rooms felt rushed in design compared to others. I expected a more spiritual atmosphere — some rooms achieved that but others felt more commercial. Worth visiting at least once if you appreciate digital art.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 정신건강 / 명상적 관점
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '38yo American female therapist', scenario: 'en-therapist-healing',
    reviewer_name: 'Dr. Sarah Kim',
    review_text: 'As a therapist, I often recommend sensory experiences to clients working through anxiety. ARTE New York is exactly the kind of environment that can allow the nervous system to reset. The whale room in particular creates a profound sense of calm.' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '33대 한국인 남성 번아웃', scenario: 'ko-burnout-recovery',
    reviewer_name: '박동훈',
    review_text: '심한 번아웃 상태로 무기력하게 지내다가 친구 권유로 갔어요. 별이 쏟아지는 방에서 20분을 있었는데 처음으로 마음이 편해지는 느낌을 받았습니다. 예술이 치료가 될 수 있다는 걸 알게 됐어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 기업 사원 복지 방문
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMLV', lang: 'en', demographic: '41yo American female HR director', scenario: 'en-hr-employee-welfare',
    reviewer_name: 'Jennifer Wu',
    review_text: 'We organized a wellness afternoon for 20 staff members. ARTE handled the group booking smoothly, the experience energized the team in a way that no conference room exercise ever could. Ticket pricing for groups could be more competitive though.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 고령 방문객 이동 어려움
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'ko', demographic: '68대 한국인 여성', scenario: 'ko-elderly-mobility',
    reviewer_name: '윤복순',
    review_text: '칠순 기념으로 자녀들이 데려다줬어요. 전시는 아름다웠는데 서 있는 시간이 너무 길었어요. 중간에 앉을 수 있는 곳이 별로 없어서 허리가 너무 아팠습니다. 의자나 쉬는 공간이 조금 더 있으면 좋겠어요.' },
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '71yo American male with cane', scenario: 'en-elderly-no-seating',
    reviewer_name: 'Harold Jenkins',
    review_text: 'I am 71 years old and use a walking cane. There was virtually nowhere to sit in the entire exhibition. I had to leave early because standing for 90 minutes is simply not possible for me. A venue that welcomes all ages must also seat all ages.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 전시 해설 / 오디오 가이드 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'en', demographic: '52yo American male art educator', scenario: 'en-audio-guide-complaint',
    reviewer_name: 'Professor Charles Bell',
    review_text: 'The visual experience is undeniably powerful, but the lack of substantive artist and curatorial context is a missed opportunity. The audio guide is extremely shallow. For those of us with a deeper interest in media art, there is nothing to learn here about the work.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 이민자 / 해외 거주 한국인
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '43대 한국인 여성 (미국 거주)', scenario: 'ko-korean-american-5star',
    reviewer_name: '신혜림',
    review_text: '뉴욕에 10년째 살면서 처음 갔는데 왜 이제야 알았을까 싶었어요. 타향살이에 지쳐있던 마음이 한방에 풀렸어요. 한국적인 감성이 담긴 공간이 뉴욕 한복판에 있다는 게 괜히 뭉클했습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 환경/지속가능성 관심 방문객
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMDB', lang: 'en', demographic: '30yo Australian male environmental activist', scenario: 'en-eco-conscious',
    reviewer_name: 'Liam Harper',
    review_text: 'Stunning digital nature that made me think deeply about what we risk losing in the real world. I appreciate that this kind of art can create environmental awareness. Would love to see explicit sustainability messaging and know what the venue\'s carbon footprint looks like.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 반복 고객 — 여러 지점 방문 고충
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'ko', demographic: '28대 한국인 여성 해외여행 마니아', scenario: 'ko-all-locations-visited',
    reviewer_name: '전수빈',
    review_text: '두바이, 라스베가스, 뉴욕 세 곳 다 가봤어요. 각 지점마다 특색이 달라서 좋긴 한데 콘텐츠가 많이 겹쳐요. 세 군데 다 방문한 팬 입장에서는 차별화된 독점 콘텐츠가 조금 더 있으면 좋겠어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 사고 위험 재발 (두 번째 슬립/낙상 패턴)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '44yo American female', scenario: 'en-wet-floor-injury',
    reviewer_name: 'Christine Moore',
    review_text: 'The floor in the ocean room was wet and there were no wet floor signs. I slipped and fell and hurt my knee badly. When I reported it to a staff member they seemed completely indifferent. This is a serious safety hazard and needs immediate attention.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 미술 전공자의 비평적 관점
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '28yo British female, fine arts student', scenario: 'en-fine-arts-critique',
    reviewer_name: 'Eleanor Marsh',
    review_text: 'As a fine arts student, I find the concept compelling but the execution somewhat shallow. The works prioritize spectacle over meaning. That said, there are two or three rooms where genuine artistic vision shines through. Worth seeing with a critical eye.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 마케팅 전문가 관점
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '35yo American male marketing director', scenario: 'en-marketing-perspective',
    reviewer_name: 'Ryan Hoffman',
    review_text: 'As someone who works in brand experience, I was genuinely impressed by how seamlessly ARTE turns visitors into brand ambassadors. Every room is designed to be shared. The scent branding is genius. Whatever agency designed this deserves every award going.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 8] 사전 예약 없이 현장 방문 후 기다림 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '38대 한국인 남성', scenario: 'ko-walkin-long-wait',
    reviewer_name: '오진호',
    review_text: '사전 예약 안 하고 현장 방문했다가 2시간 대기했어요. 온라인 예약 시스템이 있으면 미리 알려줬어야죠. 안내판도 없고, 직원도 대기 시간을 제대로 안 알려줬어요. 결국 들어가긴 했는데 그 기다림이 너무 지쳤어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 한국어 다양한 직업/생활 환경
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '55대 한국인 남성 의사', scenario: 'ko-doctor-healing',
    reviewer_name: '이상진',
    review_text: '오랜 진료 생활로 번아웃이 심했는데 뉴욕 출장 중 들렀어요. 고요한 파도 방에서 의식적으로 아무 생각 없이 있었습니다. 오랜만에 진정한 휴식을 경험한 것 같아요. 이런 공간이 필요한 분들이 많을 것 같습니다.' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '19대 한국인 여성 대학 신입생', scenario: 'ko-college-freshman',
    reviewer_name: '박소연',
    review_text: '대학 입학 기념으로 엄마랑 같이 왔어요. 평소에 예술에 관심 없었는데 여기 오고 나서 생각이 달라졌어요. 학교에서 예술 수업 들을 때 더 재미있을 것 같아요. 진짜 삶에 풍요를 줄 수 있는 경험이었어요.' },
  { rating: 4, location: 'AMDB', lang: 'ko', demographic: '47대 한국인 남성 경영자', scenario: 'ko-ceo-4star',
    reviewer_name: '문성웅',
    review_text: '해외 임원진과 함께 비즈니스 투어로 방문했어요. 외국 파트너들의 반응이 매우 좋았습니다. 한국 기업이 이런 세계적 수준의 문화 콘텐츠를 만들었다는 게 자랑스러웠어요. 다음 방문 때도 파트너들을 데려오고 싶습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 영어 — 다양한 직업/상황
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '44yo American female nurse', scenario: 'en-nurse-healing',
    reviewer_name: 'Monica Davis',
    review_text: 'After a brutal year in the ICU, my husband surprised me with tickets. I actually cried in the whale room. There is something profoundly healing about being surrounded by that kind of beauty. Thank you for making a space like this.' },
  { rating: 2, location: 'AMLV', lang: 'en', demographic: '27yo American male veteran, PTSD', scenario: 'en-veteran-sensory-overload',
    reviewer_name: 'Marcus Johnson',
    review_text: 'I am a veteran with PTSD and sensory sensitivities. The sudden loud booms in one of the sound rooms triggered me badly. There should be a clear warning at the entrance about high-decibel audio elements for visitors who may be affected.' },
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '61yo American male architect', scenario: 'en-architect-5star',
    reviewer_name: 'Robert Finley',
    review_text: 'As an architect, I came skeptical but left converted. The spatial sequencing is masterful — each room earns the transition to the next. The way sound and scent are designed as extensions of visual space is genuinely sophisticated. Outstanding work.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 어린이 관점 / 가족 다양 구성
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '8세 한국인 어린이 (부모 대필)', scenario: 'ko-child-perspective',
    reviewer_name: '유진우 (8세)',
    review_text: '엄마가 대신 써줘요. 저는 거기서 진짜 꿈나라에 온 것 같았어요. 나비 방이 제일 좋았고, 또 가고 싶어요. 별 방에서 별이 하늘에서 떨어지는 것처럼 보여서 너무 신기했어요!' },
  { rating: 4, location: 'AMLV', lang: 'en', demographic: '39yo American father with autistic child', scenario: 'en-autism-parent',
    reviewer_name: 'David Torres',
    review_text: 'My 10-year-old son is on the autism spectrum and sometimes struggles in crowds. The sensory experience here actually delighted him — he especially loved the light patterns repeating. Staff were genuinely kind when I explained his needs. Took away one star only for the noise level in one room.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 문화적 오해 / 기대치 불일치
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'en', demographic: '55yo British male, classical art lover', scenario: 'en-classical-art-skeptic',
    reviewer_name: 'Frederick Hughes',
    review_text: 'I prefer old masters to light shows but my daughter insisted. I will admit some rooms had a kind of grandeur that was hard to deny. Not my usual cup of tea but I understand why younger generations find this moving. Give it a chance if someone you love wants to go.' },
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '46yo American female, expected museum', scenario: 'en-expected-museum',
    reviewer_name: 'Carol Patterson',
    review_text: 'I thought this was an art museum with paintings and sculpture. It is not — it is essentially a very expensive light show. I feel misled by the word museum in the name. The content itself was pleasant but totally not what I came for.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 한국어 — 소셜미디어 과장 기대 후 실망
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '26대 한국인 여성', scenario: 'ko-sns-hype-disappointment',
    reviewer_name: '최다인',
    review_text: '인스타에서 너무 예쁘게 나와서 기대하고 갔는데 직접 가보면 사진이랑 달라요. 스마트폰으로 찍으면 그냥 평범한 사진이에요. 촬영 노하우 없으면 실망할 수 있어요. 인플루언서 기준으로 기대하고 가면 안 돼요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 경쟁사 심층 비교
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMDB', lang: 'en', demographic: '37yo Singapore-based American male', scenario: 'en-deep-competitor-compare',
    reviewer_name: 'Jason Lim',
    review_text: 'I have been to teamLab in Tokyo, PACE in Shanghai, and now ARTE Dubai. Each has its own identity. ARTE wins on scent immersion, which is genuinely its own innovation. PACE is harder hitting intellectually. teamLab is more playful and interactive. All worth experiencing.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 재방문 계획 언급 with 건설적 피드백
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'ko', demographic: '32대 한국인 여성', scenario: 'ko-revisit-suggestion',
    reviewer_name: '정아영',
    review_text: '전시 자체는 훌륭해요. 다음에 또 오고 싶은데, 시즌별로 콘텐츠가 변경된다면 재방문 이유가 더 생기겠죠. 멤버십이나 충성 고객 프로그램이 있으면 주기적으로 방문하고 싶을 것 같아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 9] 한국어 — 넓이/규모 기대 실망
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '41대 한국인 남성', scenario: 'ko-scale-smaller-than-expected',
    reviewer_name: '배준혁',
    review_text: '인터넷에서 보고 규모가 엄청 클 줄 알았는데 생각보다 아담했어요. 1시간이 안 걸려서 관람이 끝났습니다. 콘텐츠 품질은 좋지만 양이 부족하게 느껴졌어요. 티켓 가격을 생각하면 좀 아쉬웠습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 다국적 커플 / 국제 커플
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '30yo mixed Korean-Canadian couple', scenario: 'en-international-couple-5star',
    reviewer_name: 'Ji-hoon Park & Sarah Campbell',
    review_text: 'My Korean husband brought me to ARTE as part of our anniversary trip to Dubai. I had never heard of it before and he was so excited to show me. The scent of the forest room made me genuinely emotional. We held hands through the whole thing. Perfect date.' },
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '33대 한국인 여성 & 34대 미국인 남성 커플', scenario: 'ko-intercultural-couple',
    reviewer_name: '이소영',
    review_text: '미국인 남자친구랑 왔는데 둘 다 문화권이 달라서 반응이 재밌었어요. 저는 한국 정서가 담긴 공간에 뭉클했고, 남자친구는 기술적 스케일에 놀랐어요. 같은 공간에서 다른 감동을 받은 게 신기했어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 종교 방문객 (불교/가톨릭 관점)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '60yo South Korean Catholic nun', scenario: 'en-nun-spiritual-5star',
    reviewer_name: 'Sister Catherine Yoon',
    review_text: 'I came with a sense of skepticism about digital art. But standing in the light-filled forest room, I felt a profound stillness — not unlike prayer. Beauty, in whatever form it takes, can be a pathway to transcendence. I am glad I came.' },
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '58대 한국인 남성 불교 신자', scenario: 'ko-buddhist-5star',
    reviewer_name: '박원석',
    review_text: '불자인데 별이 쏟아지는 공간에 앉아있었을 때 내면의 고요함을 느꼈어요. 예술이 명상과 다르지 않다는 걸 새삼 깨달았습니다. 현대 기술로 이런 공간을 만들어 낸 것이 놀랍고 감사했어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 반사회적 관람객 (다른 관람객 불만)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '39대 한국인 여성', scenario: 'ko-other-visitor-ruined',
    reviewer_name: '정유나',
    review_text: '전시 자체는 좋았는데 옆에서 플래시 사진 계속 터뜨리는 관람객 때문에 너무 힘들었어요. 직원한테 말했는데 제대로 안내를 안 해줬어요. 관람 분위기를 지킬 수 있는 더 강력한 안내가 필요합니다.' },
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '45yo American female', scenario: 'en-inconsiderate-visitors',
    reviewer_name: 'Margaret Reynolds',
    review_text: 'The exhibition itself is lovely but the visit was marred by a school group that was allowed to run through without supervision. Staff did nothing to manage the noise or behaviour. A mandatory quiet policy would go a long way.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 특수 요구 — 점자/시각장애
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'en', demographic: '35yo Omani male, partial sight', scenario: 'en-visual-impairment',
    reviewer_name: 'Hassan Al-Balushi',
    review_text: 'I have partial sight and came with a sighted companion. The scent and sound elements were genuinely accessible to me, which was a wonderful surprise. However, no tactile or audio description materials were available. With some small adaptations, this could be transformative for visually impaired visitors.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 숙취 상태 또는 음주 후 방문 (유머 리뷰)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '28yo British male, Las Vegas bachelor party', scenario: 'en-bachelor-party-fun',
    reviewer_name: 'James Whitmore',
    review_text: 'Accidentally ended up here after a night out in Vegas. Possibly the best accidental decision of my life. The group of six of us were completely mesmerized. Highly recommend as a morning-after activity. Calming, beautiful and weirdly profound for a bunch of hungover blokes.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 한국어 — 온도/냉방 불만 (여름)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '36대 한국인 여성', scenario: 'ko-ac-hot-summer',
    reviewer_name: '강지수',
    review_text: '여름에 방문했는데 에어컨이 제대로 작동 안 했어요. 안이 너무 더워서 땀이 줄줄 흘렀어요. 관람 중에 어지러울 뻔 했습니다. 두바이 여름에는 냉방 관리가 더 철저해야 할 것 같아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 어린이 진짜 리뷰 (영어, 부모 대필 아닌 본인)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '11yo American female', scenario: 'en-child-own-review',
    reviewer_name: 'Emma (age 11)',
    review_text: 'This is the BEST PLACE I have ever been to in my whole life. My favourite was the butterfly room where they go all over you. I want to go back for my birthday. I told my teacher about it and she wants to bring the whole class. 10 out of 10.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 비건/채식주의자 관점
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '27yo American female vegan', scenario: 'en-vegan-5star',
    reviewer_name: 'Maya Stein',
    review_text: 'As a vegan and animal rights advocate, I appreciate that the nature represented here does not exploit any living creature. Digital nature that celebrates wildlife without harming it. The whale room gave me the same awe I get snorkeling. Genuinely moving.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 포토그래퍼 긍정 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '33yo professional photographer from UK', scenario: 'en-photographer-5star',
    reviewer_name: 'Callum Stewart',
    review_text: 'As a professional photographer, I was skeptical about whether this would be photogenic beyond the usual tourist shots. But the light quality in several rooms is genuinely extraordinary — dynamic and layered. I came back three times in the same week.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 한국어 — 생일 파티 / 이벤트 문의
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '30대 한국인 여성 이벤트 기획자', scenario: 'ko-birthday-event-planner',
    reviewer_name: '서하영',
    review_text: '남자친구 생일 이벤트로 기획했는데 직원분들이 깜짝 이벤트 준비까지 도와줬어요. 그 방에서 나왔을 때 남자친구가 완전 감동 받아서 눈물 흘렸어요. 이런 특별한 순간을 함께 만들어주신 아르떼에 진심으로 감사드려요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 짧은 부정 리뷰 (1star, 이유 없음)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '38yo American male', scenario: 'en-1star-no-reason',
    reviewer_name: 'Anonymous User',
    review_text: 'Disappointed. Just not for me.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 10] 예약/입장 오류 EMERGENCY
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '27대 한국인 여성', scenario: 'ko-ticket-fraud-claim',
    reviewer_name: '임수지',
    review_text: '온라인 예약하고 결제까지 됐는데 현장에서 예약 내역이 없다고 했어요. 결제는 됐는데 입장을 못 하고, 환불도 안 된다고 했어요. 이건 사기예요. 소비자원에 신고하겠습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 장기 여행자 / 디지털 노마드
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '29yo German female digital nomad', scenario: 'en-digital-nomad-5star',
    reviewer_name: 'Anna Richter',
    review_text: 'I have been traveling full-time for three years and visited immersive art installations on four continents. ARTE Dubai is among the top three experiences I have ever had. The scent design elevates it above everything else. Come with no expectations and leave transformed.' },
  { rating: 4, location: 'AMNY', lang: 'ko', demographic: '31대 한국인 남성 원격근무자', scenario: 'ko-remote-worker-4star',
    reviewer_name: '김태우',
    review_text: '뉴욕 한 달 살기 중에 방문했어요. 외로울 때 혼자 와서 파도 방에서 멍하니 한참 있었어요. 평일 낮에 오니까 조용해서 더 좋았습니다. 한 번 더 오고 싶어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 소아과/소아 관련 안전 EMERGENCY
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '32yo American mother', scenario: 'en-child-injury',
    reviewer_name: 'Amanda Blake',
    review_text: 'My 4-year-old tripped in the dark room and hit his head on a corner. We had to take him to a hospital for stitches. There was no safety barrier and the area was completely unlit. This is completely unacceptable and I expect a formal response from management.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 짧고 강렬한 부정 (1-2 단어)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '28대 한국인 남성', scenario: 'ko-ultra-short-1star',
    reviewer_name: '권진수',
    review_text: '최악.' },
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '35yo American male', scenario: 'en-ultra-short-1star',
    reviewer_name: 'Brian K',
    review_text: 'Total waste of money.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 고객 VIP 특별 서비스 경험
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'en', demographic: '55yo American female VIP corporate client', scenario: 'en-vip-private-event',
    reviewer_name: 'Diana Chen',
    review_text: 'We hosted a private company dinner for 15 at ARTE Dubai. The event team was extraordinary — seamless coordination, personalised touches, and the exhibition itself left our senior partners genuinely moved. This venue redefines corporate entertainment.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 한국어 — 코피/빛 민감성 증상 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'ko', demographic: '32대 한국인 여성', scenario: 'ko-light-sensitivity',
    reviewer_name: '박지윤',
    review_text: '빛에 민감한 편인데 일부 구역에서 너무 강한 플래시 효과 때문에 두통이 왔어요. 입구에서 사전 안내가 있었으면 좋겠어요. 예쁜 공간이지만 빛 민감성 있는 분들은 미리 아시고 가세요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 한국어 — 오입장/다음 예약자 자리 강제 퇴장
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '39대 한국인 남성', scenario: 'ko-forced-exit-before-time',
    reviewer_name: '최재혁',
    review_text: '분명히 2시간 입장권을 샀는데 1시간 40분만에 직원이 다음 타임 입장객 때문에 나가야 한다고 했어요. 저는 아직 돈 낸 시간이 남아 있었는데요. 규정이 명확하지 않고 불합리합니다. 환불을 요청합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 영어 — 관람 중 스마트폰 도난
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'en', demographic: '33yo American female', scenario: 'en-phone-stolen',
    reviewer_name: 'Tiffany Morgan',
    review_text: 'My phone was stolen inside the exhibition. When I reported it to staff they were dismissive and said they could not help. I asked to check CCTV or file a report and was told that is not their responsibility. I had to call the police myself.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 한국어 — 위조 리뷰 의심 (다른 방문객 관점)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'ko', demographic: '44대 한국인 여성 마케터', scenario: 'ko-suspicious-reviews',
    reviewer_name: '이민정',
    review_text: '저는 마케팅 일 하는 사람이라 느꼈는데, 일부 리뷰들이 너무 교과서 같은 문체로 쓰여 있어요. 진짜 방문객의 리뷰인지 의심되는 것들도 보여요. 실제 방문 경험은 좋았지만 리뷰 진정성에 좀 신경 써주시면 좋겠어요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 영어 — 소셜 미디어 허위광고 주장
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '26yo American male', scenario: 'en-false-advertising-claim',
    reviewer_name: 'Tyler West',
    review_text: 'The ads showed rooms that did not exist when I visited. Multiple rooms shown in promotional videos were closed. This is false advertising and I want a refund for the discrepancy between what was advertised and what was actually available.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 한국어 — 직원 차별 경험 주장
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '27대 한국인 여성', scenario: 'ko-discrimination-claim',
    reviewer_name: '황수연',
    review_text: '외국인 관광객한테는 친절하게 응대하는 직원이 한국인인 저한테는 완전 냉담하게 대했어요. 같은 공간에서 이런 차별을 느낀 게 너무 불쾌했습니다. 직원 교육이 필요해 보여요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 일본어 추가 긍정 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ja', demographic: '31才日本人女性グループ', scenario: 'ja-group-5star',
    reviewer_name: '渡辺彩',
    review_text: '女性4人でドバイ旅行中に訪れました。全員がここが旅行で一番よかったと口を揃えていました。特に光と音楽のシンクロが素晴らしかったです。写真も驚くほどよく撮れました。日本にもこんな場所があればいいのに！' },
  { rating: 4, location: 'AMLV', lang: 'ja', demographic: '42才日本人男性ビジネス客', scenario: 'ja-business-4star',
    reviewer_name: '高橋誠',
    review_text: 'ラスベガス出張の合間に訪問。普段アートに興味がない私でも十分楽しめました。混んでいたのが少し残念でしたが、作品の質は確かでした。外国のビジネスパートナーをお連れしたい場所です。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 11] 중국어 추가 긍정/다양한 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'zh', demographic: '23岁中国大学生', scenario: 'zh-student-5star',
    reviewer_name: '周小明',
    review_text: '在纽约留学，朋友推荐过来的。没想到会有这么震撼的体验！光影、声音和香气完美融合，让人忘记了时间。最喜欢星空那个房间，在里面坐了很久。非常值得一去！' },
  { rating: 3, location: 'AMDB', lang: 'zh', demographic: '55岁中国女性游客', scenario: 'zh-elderly-3star',
    reviewer_name: '孙美华',
    review_text: '展览很漂亮，孙子非常喜欢。但年纪大了站不住，展览中间没有椅子可以坐。音效也有点太强烈，耳朵不太舒服。如果能提供更多休息设施，老年人来也会更方便。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 기업 단체 워크숍 불만 (예약 대비 운영 미숙)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMNY', lang: 'ko', demographic: '45대 한국인 남성 HR팀장', scenario: 'ko-corporate-teambuilding',
    reviewer_name: '임태준',
    review_text: '회사 팀 단합 행사로 30명 단체 예약을 했는데, 현장에서 안내가 전혀 없었어요. 담당 직원이 우리 그룹인지 모르고 그냥 흩어지게 뒀고, 별도 단체 브리핑은 없었습니다. 단체 할인도 약속과 달리 적용이 안 됐어요. 다음부터는 일반 투어 이상의 준비가 필요합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 영어 — 휠체어 이용자 접근성 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '52yo American male wheelchair user', scenario: 'en-wheelchair-accessibility',
    reviewer_name: 'Robert Sanchez',
    review_text: 'I use a wheelchair and found several areas completely inaccessible. There was no ramp near the entrance and the elevator was out of service with no staff to assist. I was not wheelchair accessible for most of the route and had to miss multiple rooms. This is a serious accessibility failure and needs to be addressed immediately.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 70대 노부부 편의시설 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '71세 한국인 남성, 아내와 방문', scenario: 'ko-elderly-couple',
    reviewer_name: '박광수',
    review_text: '아내와 둘이 왔는데, 아내가 무릎이 좋지 않아 앉을 곳을 계속 찾았습니다. 전시 내내 의자 하나를 못 찾았어요. 워낙 넓어서 걷다가 지쳐서 중간에 포기하고 나왔습니다. 노약자를 위한 휴식 공간이나 휠체어 대여 서비스 같은 것이 있으면 좋겠습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 베트남어 — 언어 안내 불편 (주요 소수언어 보강)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'vi', demographic: '29 tuổi du khách nữ Việt Nam', scenario: 'vi-language-barrier',
    reviewer_name: 'Nguyễn Thị Lan',
    review_text: 'Triển lãm rất đẹp và ấn tượng. Tuy nhiên, không có hướng dẫn bằng tiếng Việt. Tất cả thông tin đều bằng tiếng Anh và tiếng Hàn, khiến tôi khó hiểu nội dung. Mong rằng sẽ có thêm ngôn ngữ hỗ trợ trong tương lai để du khách Việt Nam có thể trải nghiệm trọn vẹn hơn.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 프랑스어 — 신혼부부 낭만 기대 vs 현실 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'fr', demographic: 'Couple français 30ans en lune de miel', scenario: 'fr-honeymoon-complaint',
    reviewer_name: 'Camille Dubois',
    review_text: 'Nous venons de nous marier et espérions une expérience romantique et intime. Malheureusement, le lieu était très bondé et bruyant, ce qui a brisé l\'ambiance. Les files d\'attente étaient longues et nous avons passé plus de temps à attendre qu\'à profiter. Dommage car les visuels étaient magnifiques.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 독일어 — 사진작가 조명/화질 비판
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'de', demographic: '38-jähriger deutscher Fotograf', scenario: 'de-photographer-critique',
    reviewer_name: 'Markus Weber',
    review_text: 'Als professioneller Fotograf war ich neugierig auf die Lichtinstallationen. Die visuellen Effekte waren beeindruckend, jedoch waren viele Räume zu dunkel für gute Fotos ohne Stativ. Keine Anweisung zu Fotoregelungen. Insgesamt ein interessantes Konzept, aber für ernsthafte Fotografen schwierig.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 미술 전공 대학원생 예술 비평 관점
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'ko', demographic: '27대 한국인 미술 전공 대학원생', scenario: 'ko-art-student-critique',
    reviewer_name: '서지현',
    review_text: '미디어 아트 전공 대학원생으로서 흥미롭게 봤습니다. 기술적 완성도는 높고 관람객 체험 설계가 훌륭합니다. 다만 작품 해설이 좀 더 깊었으면 했어요. 누가 만들었는지, 어떤 기술이 사용됐는지 더 설명이 있으면 예술 교육적 가치도 커질 것 같습니다. 전반적으로 인상적인 공간이었습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 아랍어 — 무슬림 가족 종교/문화적 우려
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'ar', demographic: 'عائلة مسلمة من الإمارات', scenario: 'ar-muslim-family',
    reviewer_name: 'فاطمة الأحمدي',
    review_text: 'زرنا المكان مع الأطفال وكانت التجربة البصرية مذهلة. لكن بعض المحتوى في قاعات معينة كان مثيرًا للقلق من الناحية الثقافية لعائلتنا. أتمنى لو كان هناك إشعار مسبق بمحتوى القاعات حتى يتمكن الزوار من اختيار ما يناسبهم. التجربة العامة جيدة ولكن يحتاج إلى مزيد من مراعاة التنوع الثقافي.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 러시아어 — 줄 관리 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'ru', demographic: '34-летняя россиянка, туристка', scenario: 'ru-queue-management',
    reviewer_name: 'Анна Соколова',
    review_text: 'Очереди были огромными и плохо организованными. Никаких указателей, никаких объяснений о времени ожидания. Простояли на входе 40 минут. Внутри тоже толпы людей, невозможно было нормально смотреть на экспонаты. Разочарована уровнем организации. Само искусство красивое, но посещение испорчено из-за плохого управления потоком посетителей.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 싱글맘 아이 동반, 편의시설 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'ko', demographic: '36대 한국인 싱글맘, 6세 딸과 방문', scenario: 'ko-single-mom-child',
    reviewer_name: '최은영',
    review_text: '여섯 살 딸이랑 둘이 왔는데 유아 기저귀 갈 공간도 없고 아이가 잠깐 앉아 쉴 공간도 없어서 힘들었어요. 아이가 조금 무섭다고 해서 직원한테 물어봤더니 안내를 제대로 못 해줬어요. 전시 자체는 예쁘지만 어린아이와 함께하는 방문객에 대한 배려가 부족한 것 같아요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 영어 — 환기/냉방 불만 (호주 관광객)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'en', demographic: '41yo Australian female tourist', scenario: 'en-ventilation-complaint',
    reviewer_name: 'Jessica Clarke',
    review_text: 'Dubai heat combined with poor air conditioning inside made the experience miserable. The AC wasn\'t working properly in at least three rooms. We were sweating through the exhibition. The artwork was beautiful but the stuffy, unbearably hot environment ruined the experience. Fix the air conditioning please.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 10대 청소년 인스타그램 긍정 (SNS 관점)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'ko', demographic: '18세 한국인 여고생, 친구 3명과', scenario: 'ko-teen-instagram',
    reviewer_name: '한지민',
    review_text: '인스타그램에서 보고 너무 가고 싶었는데 실제로 와보니 사진보다 훨씬 예뻐요!! 친구들이랑 사진 엄청 찍었고 팔로워들 반응이 미쳤어요. WAVE 존이랑 FOREST 존 특히 대박. 인스타 갬성 최고입니다. 또 오고 싶어요!' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 이탈리아어 — 신규 언어 긍정 리뷰
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'it', demographic: 'Coppia italiana 35 anni', scenario: 'it-couple-5star',
    reviewer_name: 'Giulia Romano',
    review_text: 'Un\'esperienza assolutamente straordinaria! Le installazioni luminose ci hanno lasciati senza parole. Ogni sala era una sorpresa. L\'integrazione tra arte, musica e profumi era perfetta. Abbiamo trascorso quasi 3 ore e non volevamo andarcene. Lo consigliamo vivamente a tutti i turisti di New York!' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 스페인어 — 스페인어 안내 부재 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMLV', lang: 'es', demographic: 'Turista mexicana 33 años', scenario: 'es-no-spanish-signage',
    reviewer_name: 'Sofía Ramírez',
    review_text: 'Las instalaciones son visualmente impresionantes, pero toda la señalización estaba en inglés y coreano únicamente. No hay ninguna información en español, lo cual es frustrante dado que hay muchos visitantes hispanohablantes en Las Vegas. Esperaba al menos un folleto en español. El arte en sí es hermoso.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 지방에서 처음 현대 미디어 아트를 경험한 관람객 (감동 발견)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '54대 한국인 남성, 전남 순천 거주', scenario: 'ko-rural-first-discovery',
    reviewer_name: '김판석',
    review_text: '뉴욕 아들 집에 왔다가 처음 왔습니다. 저 같은 시골 사람도 이런 예술이 있는 줄 몰랐어요. 들어가자마자 눈물이 나더라고요. 자연이 이렇게도 표현될 수 있구나 싶었습니다. 우리 마을에는 없는 경험이었어요. 세상에 이런 아름다운 공간을 만들어주셔서 진심으로 감사합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 앱 예약 오류 시스템 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '29대 한국인 남성', scenario: 'ko-app-booking-error',
    reviewer_name: '이준혁',
    review_text: '앱으로 예약하고 QR코드를 받았는데 현장에서 QR코드가 인식이 안 됐어요. 직원한테 말했더니 본인들도 해결을 못 하겠다고 하면서 다시 현장 결제를 하라고 했습니다. 결국 같은 날 이중으로 결제했어요. 앱 오류인지 확인해달라는 말에도 제대로 안 해줬어요. 환불 요청합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 영어 — 청각장애인 접근성 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMNY', lang: 'en', demographic: '44yo American deaf female', scenario: 'en-deaf-accessibility',
    reviewer_name: 'Sandra Webb',
    review_text: 'I am deaf and was disappointed to find no captions or subtitles for any of the audio elements. There was no hearing loop or any accommodations for hearing-impaired visitors. Staff were unhelpful when I asked about accessibility options. The visual art itself is beautiful but the lack of deaf accessibility is a real barrier.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 영어 — 카페 음식 알레르기 응급상황 (EMERGENCY)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMLV', lang: 'en', demographic: '31yo American female', scenario: 'en-allergy-emergency',
    reviewer_name: 'Lauren Kim',
    review_text: 'I had a severe allergic reaction to something in the tea bar. I asked the staff beforehand about allergens in the drinks and they said everything was fine. Within minutes I was having an allergic reaction and needed my EpiPen. The staff panicked and didn\'t know what to do. There must be proper allergen labeling and staff training for allergy emergencies.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 경쟁 미술관 비교 (뮤지엄 관점)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'ko', demographic: '38대 한국인 여성, 미술 애호가', scenario: 'ko-competitor-comparison',
    reviewer_name: '장미래',
    review_text: '서울 팀랩, 도쿄 팀랩 모두 가봤는데 비교하면 ARTE가 규모는 작아도 감성이 다르고 좋아요. 다만 팀랩보다 콘텐츠 교체 주기가 느린 것 같아서 두 번째 방문엔 새로움이 적었어요. 작품 해설이 좀 더 깊이 있으면 더 좋을 것 같습니다. 신규 콘텐츠 업데이트를 자주 해주세요.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 법적 위협 포함 (소비자보호원 신고 예고)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '41대 한국인 남성', scenario: 'ko-consumer-protection-threat',
    reviewer_name: '오재동',
    review_text: '예약된 날짜와 다른 날 입장 처리가 됐는데 이미 결제 취소가 불가하다고 했습니다. 소비자원에 신고하겠습니다. 명백한 소비자 기만입니다. 환불 처리 안 해주면 법적 조치 취하겠습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 한국어 — 직원 처벌 요구 포함 (강성 민원)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '33대 한국인 여성', scenario: 'ko-staff-punishment-demand',
    reviewer_name: '신혜원',
    review_text: '직원 한 명이 저한테 반말을 하고 다른 관람객 앞에서 망신을 줬어요. 이런 직원은 당연히 해고해야 한다고 생각합니다. 관리자한테 따졌더니 나중에 확인하겠다는 말만 하고 끝이었어요. 직원 교육 및 해당 직원 처벌이 이뤄지지 않으면 계속 제보할 겁니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 중국어 — 재방문 콘텐츠 실망 (재방문 비교)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'zh', demographic: '32岁中国女性，第二次访问', scenario: 'zh-revisit-disappointment',
    reviewer_name: '李晓红',
    review_text: '第二次来了，上次非常震撼。但这次内容几乎一模一样，没有任何新展品。票价还涨了。第一次来真的很惊艳，但如果内容不更新，很难推荐朋友再来。希望能够增加新内容，保持新鲜感。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 12] 일본어 — 공사 소음 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMLV', lang: 'ja', demographic: '45才日本人女性', scenario: 'ja-construction-noise',
    reviewer_name: '田中京子',
    review_text: '隣の工事の騒音がひどく、展示の音楽や映像への没入感が完全に壊れました。スタッフに相談しましたが「対応できない」との一言でした。芸術作品の雰囲気を大切にするなら、工事中の営業は再考すべきではないでしょうか。作品自体は素晴らしかっただけに残念です。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 유모차 접근성 불만 (아빠 방문자)
  // ─────────────────────────────────────────────────────────────────
  { rating: 2, location: 'AMDB', lang: 'ko', demographic: '34대 한국인 남성, 2세 아이와 방문', scenario: 'ko-stroller-access',
    reviewer_name: '강동욱',
    review_text: '유모차 끌고 왔는데 엘리베이터가 없어서 계단만 있는 구간에서 유모차를 들고 다녀야 했어요. 직원한테 물어봤더니 이 구간은 유모차 진입이 어렵다고만 했고 도와주지는 않았어요. 아이와 함께하는 가족 방문객을 위한 접근성 개선이 필요합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 폐소공포증 / 어두운 공간 불안감 (건설적 피드백)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'ko', demographic: '31대 한국인 여성', scenario: 'ko-claustrophobia',
    reviewer_name: '윤소희',
    review_text: '전시 자체는 정말 아름다웠는데 일부 구간이 너무 어둡고 좁아서 답답한 느낌이 들었어요. 폐소공포증이 있는 분이라면 미리 알고 가시는 게 좋을 것 같아요. 입장 전에 이런 부분을 고지해주면 좋겠습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — 미국 대학교수 교육 현장 학습 인솔
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '58yo American female university professor', scenario: 'en-professor-fieldtrip',
    reviewer_name: 'Dr. Margaret Chen',
    review_text: 'I brought 25 undergraduate students from my Digital Media Arts class. The experience exceeded every expectation. Students who struggle to engage with traditional galleries were completely absorbed here. The fusion of classical art with immersive technology is exactly what contemporary arts education needs. Will definitely return with next year\'s cohort.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — 1세대 이민자의 감성적 경험 (한국 예술 첫 접촉)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '61yo Korean-American female first-generation immigrant', scenario: 'en-korean-diaspora-emotional',
    reviewer_name: 'Minjung Park',
    review_text: 'I left Korea 35 years ago and walking through this exhibition brought me to tears. The cherry blossoms, the waves, the Korean seasons — it was like touching home again. My American-born children saw Korea through art for the first time. I am grateful this exists in Las Vegas of all places. A profound and deeply personal experience.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 교사 인솔 고등학생 단체 방문 (교육적 관점)
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMNY', lang: 'ko', demographic: '42대 한국인 여성 교사', scenario: 'ko-teacher-fieldtrip',
    reviewer_name: '이정아',
    review_text: '고등학교 미술 수업 과제로 학생 28명 인솔해서 다녀왔습니다. 아이들이 너무 좋아해서 보람 있었어요. 다만 단체 관람 전용 입구나 별도 안내 서비스가 있으면 더 좋을 것 같아요. 작품 설명 자료도 교육 목적으로 요청드렸는데 제공이 어렵다고 하셔서 아쉬웠습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 중국어 — 싱글 비즈니스 여성 (홀로 방문)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'zh', demographic: '28岁中国女性商务旅行', scenario: 'zh-solo-businesswoman',
    reviewer_name: '王芳',
    review_text: '一个人出差途中独自来访。没想到这么治愈。在迪拜的繁忙行程中，这一小时的沉浸式体验让我彻底放松下来。FOREST区域是我的最爱，仿佛置身于真实的自然之中。强烈推荐给所有在迪拜出差的朋友。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — 색맹 방문객 접근성 우려 (다양성 관점)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'en', demographic: '37yo American male colorblind visitor', scenario: 'en-colorblind-accessibility',
    reviewer_name: 'Nathan Brooks',
    review_text: 'I am colorblind and some of the color-based interactive elements were difficult for me to engage with fully. There was no alternative mode or guidance for colorblind visitors. The overall experience was still beautiful, but accessibility for color vision deficiency needs consideration. A simple colorblind mode would make a huge difference.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 미술관 운영자 관점 (큐레이터/갤러리 오너)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '49대 한국인 여성 갤러리 운영자', scenario: 'ko-gallery-owner',
    reviewer_name: '조은희',
    review_text: '소규모 갤러리를 운영하는 입장에서 방문했습니다. 관람객과 공간의 상호작용 설계가 정말 탁월합니다. 조명 설계, 동선 유도, 공간 전환 방식이 모두 세심하게 계획되어 있어요. 미디어 아트의 새로운 기준을 보여주는 공간이라고 생각합니다. 업계 종사자로서 많은 영감을 받았습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — 의사 가족 방문 (의료 전문인 시각)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '47yo British male doctor, family visit', scenario: 'en-doctor-family',
    reviewer_name: 'Dr. James Walker',
    review_text: 'After a grueling week at a medical conference, my family and I needed something restorative. This was exactly that. The multi-sensory environment was therapeutic in a way I didn\'t expect. My teenage sons, who are firmly anti-museum, were completely captivated. A brilliant combination of art and sensory science.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 낙상/미끄러짐 응급상황 (EMERGENCY 테스트)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMDB', lang: 'ko', demographic: '58대 한국인 여성', scenario: 'ko-slip-fall-minor',
    reviewer_name: '문정희',
    review_text: '전시 관람 중에 어두운 구간에서 바닥에 미끄러져서 넘어졌습니다. 무릎이 긁히고 멍이 들었어요. 직원에게 말했더니 병원 안내도 없이 그냥 확인해보겠다는 말만 했어요. 어두운 구간 안전 관리가 필요합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 일본어 — 오디오 가이드 없음 불만
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMDB', lang: 'ja', demographic: '39才日本人カップル', scenario: 'ja-no-audio-guide',
    reviewer_name: '木村健太',
    review_text: '視覚的には非常に美しい展示でした。しかし日本語のオーディオガイドや説明文がほとんどなく、作品の意図や背景を理解するのが難しかったです。英語や韓国語の説明が多く、日本語対応をもっと充実させていただきたいです。内容自体は素晴らしいので、次回に期待しています。' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 포르투갈어 — 브라질 커플 긍정 리뷰 (남미 신규 언어)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'pt', demographic: 'Casal brasileiro 29 anos', scenario: 'pt-brazil-couple-5star',
    reviewer_name: 'Lucas Oliveira',
    review_text: 'Uma experiência absolutamente incrível! As instalações de luz e som nos deixaram completamente imersos. Ficamos quase 2 horas lá dentro e não queríamos sair. A combinação de natureza e tecnologia é perfeita. Com certeza o ponto alto da nossa viagem a Nova York. Recomendamos demais para quem visitar a cidade!' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 저녁 늦게 방문한 직장인 (마지막 타임 경험)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'ko', demographic: '36대 한국인 남성 직장인, 저녁 9시 방문', scenario: 'ko-late-evening-visit',
    reviewer_name: '박민준',
    review_text: '야근 후 마지막 타임에 혼자 왔는데 관람객이 거의 없어서 공간을 혼자 독차지한 느낌이었어요. 전시 하나하나 천천히 다 볼 수 있어서 너무 좋았습니다. 낮보다 늦은 시간에 오는 것도 완전히 다른 경험인 것 같아요. 번아웃 해소에 최고입니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — 인플루언서 (팔로워 50만) 매우 긍정
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMLV', lang: 'en', demographic: '24yo American female lifestyle influencer 500k followers', scenario: 'en-influencer-5star',
    reviewer_name: 'Alyssa Morgan',
    review_text: 'I have visited immersive art experiences in NYC, London, Paris and Tokyo and ARTE Las Vegas is genuinely top tier. Every single room is content-worthy. My Reel from here got 2M views overnight. The WAVE room and GARDEN room are unmatched for golden-hour vibes. If you\'re a content creator, this is non-negotiable. Put it on your list.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 친구 소매치기 피해 (EMERGENCY 법적+보상)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '26대 한국인 여성', scenario: 'ko-theft-police',
    reviewer_name: '김민지',
    review_text: '전시 관람 중에 친구 지갑이 없어졌어요. 직원에게 신고했더니 CCTV 확인이 불가하다고 하면서 경찰을 부르라고만 했어요. 경찰 불렀고 사건 접수했습니다. 분실물 보관함도 없고 관리가 너무 허술합니다. 피해 보상을 요청합니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 불교 신자 관점 (자연/생명 미적 체험)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'ko', demographic: '61대 한국인 남성 불교 신자', scenario: 'ko-buddhist-visitor',
    reviewer_name: '강정원',
    review_text: '불교를 믿는 사람으로서 이 전시에서 깊은 울림을 느꼈습니다. 파도가 치고, 꽃이 피고 지고, 빛이 흐르는 것이 마치 불교에서 말하는 무상(無常)의 아름다움 같았어요. 예술이 종교를 초월해서 진리를 이야기할 수 있다는 것을 느꼈습니다. 마음이 많이 치유됐습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — VR/AR 비교 관점 (테크 종사자)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMNY', lang: 'en', demographic: '32yo American male tech engineer, VR developer', scenario: 'en-vr-comparison',
    reviewer_name: 'Kevin Zhang',
    review_text: 'I build VR experiences for a living so I came in skeptical. What makes ARTE different is the absence of any wearables — pure environmental immersion through light, sound and scent. It delivers a more embodied experience than any headset I have used. The scale of the projections creates genuine awe that VR headsets cannot replicate. Technically impressive.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 재방문 충성 고객 (5회 방문, 콘텐츠 업데이트 요청)
  // ─────────────────────────────────────────────────────────────────
  { rating: 4, location: 'AMLV', lang: 'ko', demographic: '40대 한국인 여성, 5회 방문', scenario: 'ko-loyal-5th-visit',
    reviewer_name: '이수진',
    review_text: '다섯 번째 방문입니다. 갈 때마다 데려가고 싶은 사람이 생겨서 또 왔어요. 작품의 완성도는 변함없이 훌륭한데, 이제는 새로운 콘텐츠가 더 자주 업데이트되면 좋겠다는 아쉬움이 있어요. 작년과 올해가 거의 같아서 다섯 번째는 좀 익숙해졌습니다. 그래도 여전히 좋아서 또 올 것 같습니다.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 스페인어 — 긍정적 콜롬비아 관광객 (신규 스페인어 긍정)
  // ─────────────────────────────────────────────────────────────────
  { rating: 5, location: 'AMDB', lang: 'es', demographic: 'Turista colombiana 27 años', scenario: 'es-colombia-5star',
    reviewer_name: 'Isabella Torres',
    review_text: '¡Una experiencia absolutamente mágica! Vine desde Colombia específicamente para visitar ARTE MUSEUM DUBAI y superó todas mis expectativas. La sala de flores de cerezo me dejó sin palabras. Es el tipo de arte que te hace sentir algo profundo. Vale cada centavo. Volveré en mi próximo viaje a Dubai sin duda.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 한국어 — 극단적 짧은 부정 (★1, 한 줄)
  // ─────────────────────────────────────────────────────────────────
  { rating: 1, location: 'AMNY', lang: 'ko', demographic: '22대 한국인 남성', scenario: 'ko-one-liner-negative',
    reviewer_name: '정성훈',
    review_text: '돈 아깝고 시간 낭비.' },

  // ─────────────────────────────────────────────────────────────────
  // [Round 13] 영어 — 공황장애/불안 방문객 (어두운 공간 우려)
  // ─────────────────────────────────────────────────────────────────
  { rating: 3, location: 'AMNY', lang: 'en', demographic: '29yo American female with anxiety disorder', scenario: 'en-anxiety-dark-rooms',
    reviewer_name: 'Rachel Kim',
    review_text: 'I have anxiety and panic disorder. Some of the darker enclosed rooms were genuinely difficult for me. There was no warning beforehand about the nature of the dark spaces. Staff were kind but not trained to assist visitors with anxiety. A content advisory at the entrance would help visitors like me prepare. The art was beautiful when I could experience it.' },
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
    // 가족 echo: 힐링이 이미 contextMirror로 선택됐으면 가족 echo를 요구하지 않음
    const has힐링InReview = /힐링/.test(reviewText)
    if (!has힐링InReview && /가족|아이와|아이들과/.test(reviewText) && !/가족|아이|소중/.test(reply)) return 'MISSED_ECHO:가족'
  }
  if (lang === 'en') {
    if (/\bheal\w*\b/i.test(reviewText) && !/heal|refresh/i.test(reply)) return 'MISSED_ECHO:healing'
    // date night: contextMirror EN 클로징이 "special" or "date" or "evening" 포함하면 OK
    if (/\bdate\s*night\b/i.test(reviewText) && !/\bdate\b|romantic|special.*evening|evening.*special|go-to/i.test(reply)) return 'MISSED_ECHO:date'
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

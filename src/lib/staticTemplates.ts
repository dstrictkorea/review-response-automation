/**
 * staticTemplates.ts — 4개국어 정적 STANDARD 답변 블록 (LLM 미사용)
 *
 * 슬롯 기반 조립 엔진:
 *   Slot A — 지점별 맞춤 감사/사과인사   (3-4 variant per language)
 *   Slot B — 매칭 태그별 컨텍스트 피벗   (태그별 2-3 variant per language)
 *   Slot C — 유동적 가변 클로징/방문 권유 (3-4 variant per language)
 *
 * 각 함수는 optional `idx` 파라미터를 받아 `idx % variants.length`로 결정론적 변형을 선택한다.
 * 호출 측에서 reviewId 해시를 전달하면 동일 리뷰는 항상 같은 변형을 생성한다.
 *
 * ※ 보상/환불/법적책임/CCTV/직원징계 등 금칙 표현은 어떤 블록에도 포함하지 않는다.
 */

import type { Language } from '@/lib/i18n'

// ── 한국어 조사 헬퍼 (받침 유무 판별) ─────────────────────────────────────────────
function hasJong(word: string): boolean {
  const w = (word ?? '').trim()
  if (!w) return false
  const code = w.charCodeAt(w.length - 1)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  return false
}
function josa(word: string, withJong: string, withoutJong: string): string {
  return word + (hasJong(word) ? withJong : withoutJong)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Slot A: 인사말 (SAFE/COMPLIMENT — 4 variants per language)
// ═══════════════════════════════════════════════════════════════════════════════
export function greetingBlock(lang: Language, name: string, official: string, idx = 0): string {
  const nm = name.trim()
  const v: Record<Language, string[]> = {
    ko: [
      `안녕하세요${nm ? `, ${nm}님` : ''}. ${josa(official, '을', '를')} 방문해 주셔서 진심으로 감사드립니다.`,
      `${official}에 소중한 발걸음을 해주신${nm ? ` ${nm}님께` : ''} 진심으로 감사드립니다.`,
      `안녕하세요${nm ? `, ${nm}님` : ''}. 저희 ${josa(official, '을', '를')} 선택해 주셔서 깊이 감사드립니다.`,
      `${nm ? `${nm}님, ` : ''}${official} 방문을 진심으로 환영하며 감사드립니다.`,
    ],
    en: [
      `Dear ${nm || 'valued guest'}, thank you so much for visiting ${official}.`,
      `Thank you for choosing ${official}${nm ? `, ${nm}` : ''}. We truly appreciate your visit.`,
      `Hello${nm ? ` ${nm}` : ''}, we're so grateful you spent time with us at ${official}.`,
      `${nm ? `${nm}, t` : 'T'}hank you for making ${official} part of your day.`,
    ],
    ja: [
      `${nm ? nm + '様、' : ''}この度は${official}にお越しいただき、誠にありがとうございます。`,
      `${nm ? nm + '様、' : ''}${official}へのご来館を心よりお礼申し上げます。`,
      `この度は${official}にご来館いただきました${nm ? nm + '様' : 'お客様'}、誠にありがとうございます。`,
      `${nm ? nm + '様、' : ''}${official}でのひとときをご一緒できたことを大変嬉しく思います。`,
    ],
    zh: [
      `${nm ? nm + '，您好！' : '您好！'}衷心感谢您莅临${official}。`,
      `感谢您选择${official}${nm ? `，${nm}` : ''}，我们非常珍视您的到来。`,
      `${nm ? nm + '，' : ''}非常感谢您来到${official}与我们共度宝贵时光。`,
      `您好${nm ? `，${nm}` : ''}！感谢您光临${official}，您的到来令我们倍感荣幸。`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Slot B (긍정): 일반 감사 본문 (4 variants per language)
// ═══════════════════════════════════════════════════════════════════════════════
export function thanksBlock(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      '남겨주신 따뜻한 후기를 읽으며 저희 또한 큰 힘을 얻었습니다. 소중한 시간을 함께해 주셔서 감사합니다.',
      '귀중한 시간을 내어 후기를 남겨 주셔서 스태프 모두 큰 격려를 받았습니다.',
      '고객님의 따뜻한 말씀이 저희에게 큰 자랑이자 원동력이 됩니다. 진심으로 감사합니다.',
      '남겨주신 격려의 말씀 덕분에 저희 모두 큰 보람을 느낍니다. 고맙습니다.',
    ],
    en: [
      'Your kind words mean a great deal to our entire team. Thank you for spending your time with us.',
      'Reading your warm review truly made our day. We are so glad you enjoyed your visit.',
      'Your generous feedback encourages us all to keep doing our best. Thank you sincerely.',
      'It means the world to us to hear you had such a wonderful experience. Thank you for sharing.',
    ],
    ja: [
      '頂いた温かいお言葉に、スタッフ一同大変励まされております。お時間を共にしていただき、ありがとうございます。',
      'ご丁寧なレビューをいただき、スタッフ一同大変嬉しく思っております。ありがとうございます。',
      'お客様からの温かいご感想が、スタッフにとって何よりの励みとなっております。',
      '心温まるご感想をお寄せいただき、誠にありがとうございます。',
    ],
    zh: [
      '您温暖的评价让我们全体员工倍感鼓舞。感谢您与我们共度宝贵的时光。',
      '读到您的好评，全体员工都深受鼓励。感谢您抽出时间分享宝贵感受。',
      '您的美好评价对我们来说是莫大的鼓励，感谢您的认可与支持。',
      '感谢您留下如此温暖的评价，这是我们不断进步的最大动力。',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Slot B (작품중심): ETERNAL NATURE 몰입 블록 (3 variants per language)
// ═══════════════════════════════════════════════════════════════════════════════
export function eternalNatureBlock(lang: Language, signature: string | null, idx = 0): string {
  const sig = signature ?? null
  const v: Record<Language, string[]> = {
    ko: [
      `특히 'ETERNAL NATURE(영원한 자연)'를 주제로 한 저희의 몰입형 미디어아트${sig ? `, 그중에서도 대표작 ${josa(sig, '을', '를')} 통해` : '를 통해'} 깊은 울림을 느끼셨다니 더없이 기쁩니다.`,
      `저희 'ETERNAL NATURE' 전시가 특별한 감동을 드렸다니 스태프 모두 정말 기쁩니다.${sig ? ` 특히 대표작 ${sig}${hasJong(sig) ? '을' : '를'} 함께 경험해 주셔서 감사합니다.` : ''}`,
      `저희의 몰입형 미디어아트${sig ? `, 그중에서도 ${sig}` : ''}가 특별한 경험으로 남았다니 더없는 보람을 느낍니다.`,
    ],
    en: [
      `We are especially delighted that our immersive media art — created under our philosophy of "ETERNAL NATURE"${sig ? `, particularly ${sig}` : ''} — resonated so deeply with you.`,
      `It brings us great joy to know that our "ETERNAL NATURE" exhibition${sig ? `, especially ${sig},` : ''} left such a lasting impression on you.`,
      `Your appreciation of our immersive "ETERNAL NATURE" installations${sig ? `, and especially ${sig},` : ''} means everything to our creative team.`,
    ],
    ja: [
      `とりわけ「ETERNAL NATURE（永遠の自然）」をテーマにした没入型メディアアート${sig ? `、中でも代表作${sig}` : ''}に深く心を動かされたとのこと、大変嬉しく存じます。`,
      `「ETERNAL NATURE」をテーマにした展示が深い感動をお届けできたとのこと、スタッフ一同大変嬉しく思っております。${sig ? `特に${sig}をお楽しみいただけたことに感謝いたします。` : ''}`,
      `没入型メディアアート${sig ? `「${sig}」` : ''}がお心に響いたとのこと、スタッフ一同この上ない喜びを感じております。`,
    ],
    zh: [
      `尤其令我们欣喜的是，以"ETERNAL NATURE（永恒自然）"为主题的沉浸式媒体艺术${sig ? `，特别是代表作${sig}` : ''}，能让您深受触动。`,
      `得知我们的"ETERNAL NATURE"展览${sig ? `，尤其是${sig}，` : ''}给您留下了深刻印象，我们全体员工倍感欣慰。`,
      `您对我们沉浸式媒体艺术${sig ? `，特别是${sig}` : ''}的喜爱是对我们最大的肯定，感谢您的分享。`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Slot C: 맺음말 + 방문 권유 (4 variants per language)
// ═══════════════════════════════════════════════════════════════════════════════
export function closingBlock(lang: Language, official: string, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      `앞으로도 잊지 못할 영감과 감동을 선사하는 ${josa(official, '이', '가')} 되겠습니다. 다시 만나뵐 그날을 기대하겠습니다.`,
      `다음에도 ${official}에서 새로운 감동과 영감을 드릴 수 있도록 최선을 다하겠습니다.`,
      `${josa(official, '은', '는')} 앞으로도 더욱 풍성한 전시로 보답하겠습니다. 언제든지 다시 방문해 주세요.`,
      `소중한 방문에 다시 한번 감사드리며, 앞으로도 ${official}에서 함께하기를 진심으로 기대합니다.`,
    ],
    en: [
      `It would be our honor to welcome you back to ${official} for another unforgettable experience.`,
      `We hope to see you again soon at ${official} — there's always something new to discover.`,
      `${official} looks forward to welcoming you back for an even more memorable visit.`,
      `We'd love to have you back at ${official}. Until next time!`,
    ],
    ja: [
      `これからも忘れられない感動をお届けできる${official}であり続けます。またお会いできる日を心よりお待ちしております。`,
      `またのご来館を心よりお待ちしております。次回も${official}で素晴らしいひとときをお過ごしください。`,
      `${official}はこれからも皆様に感動をお届けできるよう努めてまいります。ぜひまたお越しください。`,
      `またいつでもお気軽に${official}にお越しください。皆様のご来館を心よりお待ちしております。`,
    ],
    zh: [
      `我们将继续为您呈现难忘的感动，期待与您再次相见于${official}。`,
      `希望不久后能再次在${official}与您相见，总有新的惊喜等待您来发现。`,
      `${official}将持续带来更精彩的展览，期待您下次光临。`,
      `感谢您的到来，期待在${official}与您再次相遇，共享美好时光。`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ── 피크타임 방문 권유 힌트 (CROWD_COMPLAINT + hasPeakHours 시 삽입) ─────────────
export function peakHoursHint(lang: Language): string {
  switch (lang) {
    case 'en':
      return 'For a more relaxed visit, we recommend weekday mornings or early afternoons, when the gallery tends to be quieter.'
    case 'ja':
      return '平日の午前・午後早い時間帯はゆったりとご観覧いただけます。次回お越しの際のご参考になれば幸いです。'
    case 'zh':
      return '建议您下次选择工作日上午或午后较早时段前来，届时人流较少，观展体验更为舒适。'
    case 'ko':
    default:
      return '다음 방문 시 평일 오전 또는 오후 이른 시간대를 이용하시면 더욱 여유롭게 관람하실 수 있습니다.'
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Slot A (불만/긴급): 건조한 사과 홀딩 (4 variants per language — 찬양·보상 일절 없음)
// ═══════════════════════════════════════════════════════════════════════════════
export function dryApologyBlock(lang: Language, name: string, official: string, idx = 0): string {
  const nm = name.trim()
  const v: Record<Language, string[]> = {
    ko: [
      `안녕하세요${nm ? `, ${nm}님` : ''}. 먼저 ${official} 이용 중 불편을 드린 점 진심으로 사과드립니다. 말씀해 주신 내용을 무겁게 받아들이며, 담당자가 신속히 확인하여 성심껏 안내드리겠습니다. 소중한 의견 감사합니다.`,
      `${nm ? `${nm}님, ` : ''}${official}에서 불편한 경험을 드려 진심으로 사과드립니다. 소중한 피드백을 바탕으로 개선 방안을 신속히 검토하겠습니다.`,
      `안녕하세요${nm ? `, ${nm}님` : ''}. 기대에 미치지 못하는 경험을 드린 점 깊이 유감스럽게 생각합니다. 담당자가 빠른 시간 내 내용을 확인하여 성실히 안내드리겠습니다.`,
      `${nm ? `${nm}님, ` : ''}소중한 말씀 주셔서 감사합니다. ${official} 방문 중 불편을 드린 점 진심으로 사과드리며, 담당자가 내용을 면밀히 검토하겠습니다.`,
    ],
    en: [
      `Dear ${nm || 'valued guest'}, we sincerely apologize for the inconvenience you experienced at ${official}. We take your feedback seriously, and a member of our team will review it promptly and follow up with care. Thank you for letting us know.`,
      `${nm ? `Dear ${nm}, ` : ''}we are truly sorry to hear about your experience at ${official}. Your feedback has been noted and our team will look into it right away.`,
      `Hello${nm ? ` ${nm}` : ''}, we apologize for falling short of your expectations at ${official}. We value your honest feedback and will take immediate steps to address your concerns.`,
      `${nm ? `${nm}, t` : 'T'}hank you for sharing your experience at ${official}. We sincerely apologize for any inconvenience and will review your feedback carefully.`,
    ],
    ja: [
      `${nm ? nm + '様、' : ''}この度は${official}にてご不便をおかけし、誠に申し訳ございません。頂いたご意見を重く受け止め、担当者が速やかに確認のうえ、誠心誠意ご案内いたします。貴重なご意見をありがとうございます。`,
      `${nm ? nm + '様、' : ''}${official}でご不便をおかけし、大変申し訳ございません。ご意見を真摯に受け止め、担当者が早急に対応いたします。`,
      `${nm ? nm + '様、' : ''}ご期待に沿えず、誠に申し訳ございません。貴重なご意見をもとに、改善に向けて早急に取り組んでまいります。`,
      `${nm ? nm + '様、' : ''}率直なご意見をお寄せいただきありがとうございます。${official}でのご不便を深くお詫び申し上げます。`,
    ],
    zh: [
      `${nm ? nm + '，您好。' : '您好。'}对于您在${official}遇到的不便，我们深表歉意。我们会认真对待您的反馈，由专员尽快核实并诚挚跟进。感谢您的宝贵意见。`,
      `${nm ? nm + '，' : ''}对于您在${official}的不愉快体验，我们深感抱歉。您的反馈已被记录，我们的团队将立即跟进处理。`,
      `您好${nm ? `，${nm}` : ''}，对于您的体验未能达到预期，我们真诚地道歉。我们重视您的每一条反馈，并将积极改进。`,
      `${nm ? nm + '，' : ''}感谢您分享在${official}的体验。对于给您带来的不便，我们深表歉意，并将认真审查您的反馈。`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Slot B (태그 피벗): 불만 태그별 개선 약속 문장 (2-3 variants per language)
//  COMPLAINT/EMERGENCY dry-fallback 답변 전용 — 찬양·보상 일절 없음
// ═══════════════════════════════════════════════════════════════════════════════

const SLOT_B_PIVOTS: Partial<Record<string, Record<Language, string[]>>> = {
  INTERACTIVE_COMPLAINT: {
    ko: [
      '인터랙티브 체험에 대한 솔직한 의견 주셔서 감사합니다. 센서 반응성과 체험 요소를 지속적으로 개선하여 더욱 풍부한 상호작용을 제공할 수 있도록 노력하겠습니다.',
      '체험 인터랙션에 관한 소중한 피드백 감사합니다. 더욱 역동적인 체험이 가능하도록 인터랙티브 요소 개선에 집중하겠습니다.',
      '인터랙티브 경험에 대한 기대에 충분히 부응하지 못한 점 유감스럽게 생각합니다. 센서 반응 개선과 체험 다양화를 위해 더욱 힘쓰겠습니다.',
    ],
    en: [
      'Thank you for your candid feedback on the interactive experience. We are continuously working to improve sensor responsiveness and interactive elements for a more engaging visit.',
      'We appreciate your honest input on the interactivity. Enhancing sensor performance and expanding interactive features remain a top priority.',
      'We understand your expectations for a more interactive experience and are actively developing new ways to improve engagement throughout the exhibition.',
    ],
    ja: [
      'インタラクティブな体験に関するご意見をありがとうございます。センサーの反応性と体験要素の向上に継続して取り組んでまいります。',
      'インタラクティブな体験へのご期待に十分お応えできず申し訳ございません。体験要素の改善を積極的に進めてまいります。',
    ],
    zh: [
      '感谢您对互动体验的坦诚反馈。我们将持续改善传感器响应性和互动元素，为您提供更丰富的体验。',
      '我们理解您对更多互动体验的期待，将积极优化互动功能，确保下次到访时有更出色的互动感受。',
    ],
  },
  VALUE_COMPLAINT: {
    ko: [
      '입장료에 비해 만족스럽지 않으셨다는 말씀을 무겁게 받아들이겠습니다. 콘텐츠 밀도와 전시 구성을 지속적으로 보강하여 더욱 가치 있는 관람 경험을 제공하기 위해 노력하겠습니다.',
      '가격 대비 기대에 미치지 못했다는 소중한 피드백 감사합니다. 더욱 알찬 전시와 다양한 콘텐츠로 보답하겠습니다.',
      '관람료 측면에서 아쉬움을 느끼셨다니 진심으로 유감스럽습니다. 콘텐츠 확충과 전시 퀄리티 향상을 위해 최선을 다하겠습니다.',
    ],
    en: [
      'We hear your concerns about the value for the ticket price. We are continuously working to enrich our content and exhibition so that every visit feels truly worthwhile.',
      'Thank you for sharing your thoughts on pricing. Enhancing the depth and quality of our exhibitions to offer better value is a key commitment.',
      'We appreciate your candid feedback. Expanding our content offerings and improving the overall experience is an ongoing priority for us.',
    ],
    ja: [
      'チケット価格へのご不満を真摯に受け止め、コンテンツの充実と展示内容の強化に取り組んでまいります。',
      '価格に対してご満足いただけなかった点、誠に申し訳ございません。より充実した展示内容でお応えできるよう尽力いたします。',
    ],
    zh: [
      '我们认真对待您关于票价性价比的意见，将持续丰富内容和展览，确保每位游客都能获得更具价值的体验。',
      '感谢您对票价的坦诚反馈。扩充展览内容、提升展览品质是我们重要的改进方向。',
    ],
  },
  CROWD_COMPLAINT: {
    ko: [
      '방문객이 많아 쾌적한 관람에 지장이 있으셨다니 진심으로 죄송합니다. 보다 여유로운 관람을 위해 입장 인원 관리와 운영 방식을 지속적으로 개선해 나가겠습니다.',
      '혼잡한 환경으로 불편을 드려 깊이 사과드립니다. 관람 환경 개선을 위해 입장 분산 및 공간 운영에 더욱 힘쓰겠습니다.',
      '많은 방문객으로 인해 충분한 감상이 어려우셨다니 유감입니다. 쾌적한 관람 환경 조성을 위해 최선을 다하겠습니다.',
    ],
    en: [
      'We sincerely apologize that crowding affected your enjoyment. We are continuously refining our capacity management to ensure a more comfortable experience.',
      'We are sorry the crowds made it difficult to fully enjoy the exhibition. Improving visitor flow and crowd management is an ongoing priority.',
      'We understand how overcrowding can detract from the experience and are actively working to improve visitor distribution and comfort.',
    ],
    ja: [
      '混雑によりお楽しみいただけず、誠に申し訳ございません。より快適な鑑賞環境のため、入場管理と運営の改善に努めてまいります。',
      '混み合ってご不便をおかけし、大変申し訳ございません。館内誘導と入場分散の改善に取り組んでまいります。',
    ],
    zh: [
      '非常抱歉，拥挤的环境影响了您的观展体验。我们将持续优化人流管理，为您创造更舒适的参观环境。',
      '对于人流拥挤造成的不便，我们深表歉意，并将积极改进入场管理，提供更舒适的观展空间。',
    ],
  },
  LAYOUT_COMPLAINT: {
    ko: [
      '동선 안내가 불편하셨다는 점 깊이 유감스럽게 생각합니다. 안내 표지와 동선 시스템을 지속적으로 보완하여 더욱 편리한 관람 환경을 만들어 나가겠습니다.',
      '관람 동선에 대한 소중한 피드백 감사합니다. 안내 표지판 개선과 직관적인 동선 구성을 위해 더욱 노력하겠습니다.',
    ],
    en: [
      'We are sorry the layout was confusing. We will continue improving our wayfinding signage and flow guidance to make navigation more intuitive.',
      'Thank you for highlighting the navigation difficulty. Improving our layout flow and signage is something we are actively working on.',
    ],
    ja: [
      '動線がわかりにくくご不便をおかけし、誠に申し訳ございません。案内サインの改善に取り組んでまいります。',
    ],
    zh: [
      '对于参观动线带来的困惑，我们深感抱歉。我们将持续改善引导标识，使参观更加便捷顺畅。',
    ],
  },
  DISPLAY_ISSUE: {
    ko: [
      '영상 및 디스플레이 품질에 불편을 경험하셨다니 진심으로 사과드립니다. 장비 점검과 유지 관리를 더욱 철저히 하여 최상의 시청각 경험을 보장하겠습니다.',
      '디스플레이 관련 문제를 경험하셨다니 깊이 사과드립니다. 정기 점검 강화와 신속한 유지 보수를 통해 재발 방지에 최선을 다하겠습니다.',
    ],
    en: [
      'We sincerely apologize for the display quality issues you encountered. We will ensure more rigorous equipment checks and maintenance going forward.',
      'We are sorry about the display issues. Regular maintenance and equipment inspections are being strengthened to prevent similar problems.',
    ],
    ja: [
      '映像・ディスプレイ品質についてご不便をおかけし、誠に申し訳ございません。機器の点検・メンテナンスをより徹底いたします。',
    ],
    zh: [
      '对于您遇到的显示质量问题，我们深感抱歉。我们将加强设备检查和维护，确保为您提供最佳的视听体验。',
    ],
  },
  DURATION_COMPLAINT: {
    ko: [
      '관람 시간이 기대에 미치지 못하셨다는 말씀을 귀담아듣겠습니다. 콘텐츠 구성을 지속적으로 발전시켜 더욱 풍성한 관람 경험을 드릴 수 있도록 노력하겠습니다.',
      '전시 규모나 소요 시간에 대한 아쉬움을 진심으로 받아들이겠습니다. 더욱 다양하고 풍부한 콘텐츠를 통해 보답하겠습니다.',
    ],
    en: [
      'We appreciate your honest feedback about the exhibition length. We are working to expand and enrich our content to make every visit more fulfilling.',
      'Thank you for sharing your thoughts on the duration. Expanding our content offerings is a key commitment going forward.',
    ],
    ja: [
      '観覧時間についての率直なご意見、ありがとうございます。コンテンツの充実に継続して取り組んでまいります。',
    ],
    zh: [
      '感谢您对展览时长的坦诚反馈。我们将不断扩充内容，让每次观展都更加充实。',
    ],
  },
}

/** 불만 태그별 컨텍스트 피벗 문장 (Slot B — COMPLAINT/EMERGENCY dry-fallback 전용).
 *  tags 중 가장 구체적인 태그 1개를 선택하여 개선 약속 문장을 반환한다.
 *  해당하는 태그가 없으면 빈 문자열 반환. */
export function slotBComplaintPivot(lang: Language, tags: string[], idx = 0): string {
  const PRIORITY = ['INTERACTIVE_COMPLAINT', 'VALUE_COMPLAINT', 'CROWD_COMPLAINT', 'LAYOUT_COMPLAINT', 'DISPLAY_ISSUE', 'DURATION_COMPLAINT']
  const tag = PRIORITY.find((t) => tags.includes(t))
  if (!tag) return ''
  const byLang = SLOT_B_PIVOTS[tag]
  if (!byLang) return ''
  const arr = byLang[lang] ?? byLang.en ?? []
  if (!arr.length) return ''
  return arr[idx % arr.length]
}

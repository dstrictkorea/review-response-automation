/**
 * staticTemplates.ts — 4개국어 정적 STANDARD 답변 블록 (LLM 미사용)
 *
 * 5단계 슬롯 조합 엔진:
 *   Slot A — 지점별 맞춤 인사/사과      (4 variants/lang) → {branch_name}, {landmark}
 *   Slot B — 감정 응답 / 사안 수용 확인  (4 variants/lang)
 *   Slot C — 태그별 구체적 액션 플랜     (태그별 4 variants/lang) → {highlight_room}
 *   Slot D — 현장 운영 힌트 (조건부)     (3 variants/lang) → {highlight_room}
 *   Slot E — 멀티지점 정체성 클로징      (4 variants/lang) → {branch_name}
 *
 * 플레이스홀더 토큰 ({branch_name} 등)은 replyTemplates.ts의 buildStaticReply가
 * applyBranchTokens()로 일괄 치환한다. 이 파일은 치환 전 '원형 템플릿'을 반환한다.
 *
 * 한국어 조사 전제: 모든 {branch_name} 값은 영문 글자로 끝나므로 '를/가/는' 하드코딩 가능.
 *
 * ※ 보상/환불/법적책임/CCTV/직원징계 등 금칙 표현은 어떤 블록에도 포함하지 않는다.
 */

// Reply-engine language set — broader than UI Language ('ko'|'en'|'ja'|'zh')
import type { ReplyLanguage as Language } from '@/lib/replyLanguage'
import { promotedComplaintLine } from '@/lib/promotedPatterns'

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

// ════════════════════════════════════════════════════════════════════════════════
//  Slot A — 지점별 맞춤 첫인사 (SAFE/COMPLIMENT)
//  4 variants × 4 languages | {branch_name}, {landmark}
// ════════════════════════════════════════════════════════════════════════════════
export function slotA_greeting(lang: Language, name: string, idx = 0): string {
  const nm = name.trim()
  const v: Record<Language, string[]> = {
    ko: [
      // ── 0~3: 중립(평점 무관) — AMBIGUOUS(idx%4)가 저평점에도 쓰므로 '환영/기쁨' 같은 과한 긍정 배제 ──
      // 0: 정중 표준 (담백)
      `안녕하세요${nm ? `, ${nm}님` : ''}. {branch_name}를 방문해 주셔서 감사합니다.`,
      // 1: 표준 변형 (찾아주셔서)
      `안녕하세요${nm ? `, ${nm}님` : ''}. {branch_name}를 찾아주셔서 감사합니다.`,
      // 2: 후기 감사 (캐주얼·중립)
      `${nm ? `${nm}님, ` : ''}리뷰 남겨주셔서 감사합니다.`,
      // 3: 경험 공유 감사 (중립)
      `${nm ? `${nm}님, ` : ''}{branch_name}에서의 경험을 공유해 주셔서 감사합니다.`,
      // ── 4~7: 따뜻함/랜드마크 강조 — COMPLIMENT 전용 톤 ──
      // 4: 랜드마크 언급, 따뜻 (담백)
      `${nm ? `${nm}님, ` : ''}{landmark}에 자리한 {branch_name}까지 찾아와 주셔서 감사합니다.`,
      // 5: 지점 강조 따뜻 (담백)
      `${nm ? `${nm}님, ` : ''}{landmark}에 있는 {branch_name}에 와주셔서 고맙습니다.`,
      // 6: 친근
      `안녕하세요${nm ? ` ${nm}님` : ''}! {branch_name}를 찾아주셔서 기쁩니다.`,
      // 7: 반가움 강조
      `{branch_name}에 와주셔서 반가웠습니다${nm ? `, ${nm}님` : ''}.`,
    ],
    en: [
      `Dear ${nm || 'valued guest'}, thank you so much for visiting {branch_name}.`,
      `Thank you for making {branch_name} near {landmark} part of your experience${nm ? `, ${nm}` : ''}.`,
      `Hello${nm ? ` ${nm}` : ''}, we're truly grateful you chose to spend time with us at {branch_name}.`,
      `${nm ? `${nm}, t` : 'T'}hank you for choosing {branch_name} in {landmark}.`,
      `${nm ? `${nm}, t` : 'T'}hanks so much for taking the time to share this!`,
      `What a lovely review${nm ? `, ${nm}` : ''} — thank you for visiting {branch_name}.`,
      `${nm ? `${nm}, w` : 'W'}e really appreciate you stopping by {branch_name}.`,
      `So glad you came to see us at {branch_name}${nm ? `, ${nm}` : ''}!`,
    ],
    ja: [
      `${nm ? nm + '様、' : ''}この度は{branch_name}にお越しいただき、誠にありがとうございます。`,
      `${nm ? nm + '様、' : ''}{landmark}の{branch_name}へのご来館を心よりお礼申し上げます。`,
      `この度は{branch_name}にご来館いただきました${nm ? nm + '様' : 'お客様'}、誠にありがとうございます。`,
      `${nm ? nm + '様、' : ''}{branch_name}でのひとときをご一緒できたことを大変嬉しく思います。`,
    ],
    zh: [
      `${nm ? nm + '，您好！' : '您好！'}衷心感谢您莅临{branch_name}。`,
      `感谢您选择位于{landmark}的{branch_name}${nm ? `，${nm}` : ''}，我们非常珍视您的到来。`,
      `${nm ? nm + '，' : ''}非常感谢您来到{branch_name}与我们共度宝贵时光。`,
      `您好${nm ? `，${nm}` : ''}！感谢您光临{branch_name}，您的到来令我们倍感荣幸。`,
    ],
    es: [
      `Muchas gracias${nm ? `, ${nm},` : ''} por visitar {branch_name}.`,
      `${nm ? `${nm}, g` : 'G'}racias por elegirnos. Es un placer tenerle en {branch_name} en {landmark}.`,
      `Agradecemos mucho su visita a {branch_name}${nm ? `, ${nm}` : ''}. Nos alegra tenerle aquí.`,
      `${nm ? `Estimado/a ${nm}, g` : 'G'}racias por su visita a {branch_name} en {landmark}.`,
    ],
    ru: [
      `${nm ? `${nm}, б` : 'Б'}ольшое спасибо за визит в {branch_name}!`,
      `Благодарим Вас за посещение {branch_name} в {landmark}${nm ? `, ${nm}` : ''}.`,
      `${nm ? `${nm}, м` : 'М'}ы рады, что Вы выбрали {branch_name} для своего визита.`,
      `Добро пожаловать в {branch_name}${nm ? `, ${nm}` : ''}! Спасибо за ваш отзыв.`,
    ],
    ar: [
      `${nm ? `${nm}، ` : ''}شكراً جزيلاً على زيارتكم {branch_name}.`,
      `نشكركم على اختياركم {branch_name} في {landmark}${nm ? `، ${nm}` : ''}. يسعدنا استقبالكم.`,
      `${nm ? `${nm}، ` : ''}يسعدنا أن تكونوا بيننا في {branch_name}. شكراً على تشريفكم.`,
      `مرحباً${nm ? ` ${nm}` : ''}، نشكركم على زيارة {branch_name} وعلى وقتكم الثمين.`,
    ],
    hi: [
      `${nm ? `${nm}जी, ` : ''}{branch_name} में पधारने के लिए हार्दिक धन्यवाद!`,
      `{landmark} स्थित {branch_name} में आपका स्वागत है${nm ? `, ${nm}जी` : ''}। पधारने के लिए धन्यवाद।`,
      `${nm ? `${nm}जी, ` : ''}आपने {branch_name} को चुना, इसके लिए हम आभारी हैं।`,
      `{branch_name} में आपका पधारना हमारे लिए सौभाग्य की बात है${nm ? `, ${nm}जी` : ''}।`,
    ],
    tl: [
      `${nm ? `${nm}, m` : 'M'}araming salamat sa pagbisita sa {branch_name}!`,
      `Nagpapasalamat kami sa inyong pagpili ng {branch_name} sa {landmark}${nm ? `, ${nm}` : ''}.`,
      `${nm ? `${nm}, ` : ''}Natutuwa kami na pinili ninyo ang {branch_name} para sa inyong pagbisita.`,
      `Maligayang pagdating sa {branch_name}${nm ? `, ${nm}` : ''}. Salamat sa inyong pagbisita!`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot A — 지점별 맞춤 사과 인사 (COMPLAINT/EMERGENCY)
//  4 variants × 4 languages | {branch_name}
// ════════════════════════════════════════════════════════════════════════════════
export function slotA_apology(lang: Language, name: string, idx = 0): string {
  const nm = name.trim()
  const v: Record<Language, string[]> = {
    ko: [
      // 0: 정중 표준 (담백)
      `안녕하세요${nm ? `, ${nm}님` : ''}. {branch_name}를 이용하시면서 불편을 드려 죄송합니다.`,
      // 1: 공감 중심
      `${nm ? `${nm}님, ` : ''}{branch_name}에서 불편한 경험을 하셨다니 죄송합니다.`,
      // 2: 기대 미충족 표현 (담백)
      `안녕하세요${nm ? `, ${nm}님` : ''}. 기대에 미치지 못해 죄송합니다.`,
      // 3: 피드백 감사 + 사과
      `${nm ? `${nm}님, ` : ''}의견 주셔서 감사합니다. {branch_name}에서 불편을 드려 죄송합니다.`,
      // 4: SHORT + 지점명 포함
      `안녕하세요${nm ? ` ${nm}님` : ''}. {branch_name}에서 불편을 드려 정말 죄송합니다.`,
      // 5: 솔직 피드백 인정 + 지점명
      `${nm ? `${nm}님, ` : ''}솔직한 피드백 주셔서 감사합니다. {branch_name}에서의 불편에 죄송합니다.`,
      // 6: 기대 미충족 + 지점명
      `{branch_name}를 방문해 주셨는데 기대에 미치지 못해 죄송합니다${nm ? `, ${nm}님` : ''}.`,
      // 7: 진심 강조 + 지점명
      `${nm ? `${nm}님, ` : ''}{branch_name}에서 불편하셨던 점, 정말 죄송합니다.`,
    ],
    en: [
      `Dear ${nm || 'valued guest'}, we sincerely apologize for the inconvenience you experienced at {branch_name}.`,
      `${nm ? `Dear ${nm}, ` : ''}we are truly sorry to hear about your experience at {branch_name}.`,
      `Hello${nm ? ` ${nm}` : ''}, we apologize for falling short of your expectations at {branch_name}.`,
      `${nm ? `${nm}, t` : 'T'}hank you for sharing your experience at {branch_name}. We sincerely apologize for any inconvenience.`,
      `${nm ? `${nm}, w` : 'W'}e're sorry your visit to {branch_name} didn't go the way it should have.`,
      `Our apologies${nm ? `, ${nm}` : ''} — this isn't the experience we want anyone to have at {branch_name}.`,
      `${nm ? `${nm}, t` : 'T'}hank you for telling us. We're sorry {branch_name} let you down this time.`,
      `We appreciate your honesty${nm ? `, ${nm}` : ''}, and we're sorry for the trouble at {branch_name}.`,
    ],
    ja: [
      `${nm ? nm + '様、' : ''}この度は{branch_name}にてご不便をおかけし、誠に申し訳ございません。`,
      `${nm ? nm + '様、' : ''}{branch_name}でご不便をおかけし、大変申し訳ございません。`,
      `${nm ? nm + '様、' : ''}ご期待に沿えず、誠に申し訳ございません。`,
      `${nm ? nm + '様、' : ''}率直なご意見をお寄せいただきありがとうございます。{branch_name}でのご不便を深くお詫び申し上げます。`,
    ],
    zh: [
      `${nm ? nm + '，您好。' : '您好。'}对于您在{branch_name}遇到的不便，我们深表歉意。`,
      `${nm ? nm + '，' : ''}对于您在{branch_name}的不愉快体验，我们深感抱歉。`,
      `您好${nm ? `，${nm}` : ''}，对于您的体验未能达到预期，我们真诚地道歉。`,
      `${nm ? nm + '，' : ''}感谢您分享在{branch_name}的体验，对于给您带来的不便，我们深表歉意。`,
    ],
    es: [
      `${nm ? `Estimado/a ${nm}, ` : ''}lamentamos los inconvenientes durante su visita a {branch_name}.`,
      `${nm ? `${nm}, s` : 'S'}entimos mucho que su experiencia en {branch_name} no cumpliera sus expectativas.`,
      `Le pedimos disculpas${nm ? `, ${nm},` : ''} por los inconvenientes que tuvo en {branch_name}.`,
      `${nm ? `${nm}, g` : 'G'}racias por su comentario. Nos disculpamos sinceramente por cualquier molestia en {branch_name}.`,
    ],
    ru: [
      `${nm ? `${nm}, м` : 'М'}ы искренне сожалеем о неудобствах во время вашего визита в {branch_name}.`,
      `Приносим свои извинения${nm ? `, ${nm},` : ''} за то, что ваш визит в {branch_name} не соответствовал ожиданиям.`,
      `${nm ? `${nm}, с` : 'С'}пасибо за ваш отзыв. Мы глубоко сожалеем о доставленных неудобствах в {branch_name}.`,
      `Нам очень жаль, что визит в {branch_name} не оправдал ваших ожиданий${nm ? `, ${nm}` : ''}.`,
    ],
    ar: [
      `${nm ? `${nm}، ` : ''}نعتذر بصدق عن أي إزعاج واجهتموه خلال زيارتكم {branch_name}.`,
      `${nm ? `${nm}، ` : ''}يؤسفنا أن تجربتكم في {branch_name} لم ترق إلى مستوى توقعاتكم.`,
      `نشكركم على ملاحظاتكم${nm ? `، ${nm}` : ''}. نعتذر بصدق عن أي إزعاج في {branch_name}.`,
      `${nm ? `${nm}، ` : ''}نأسف لما واجهتموه في {branch_name} ونتعهد بالعمل على تحسين تجربتكم.`,
    ],
    hi: [
      `${nm ? `${nm}जी, ` : ''}{branch_name} में हुई असुविधा के लिए हम हार्दिक क्षमाप्रार्थी हैं।`,
      `${nm ? `${nm}जी, ` : ''}{branch_name} में आपका अनुभव अपेक्षाओं पर खरा नहीं उतरा, इसके लिए हम खेद व्यक्त करते हैं।`,
      `आपकी प्रतिक्रिया के लिए धन्यवाद${nm ? `, ${nm}जी` : ''}। {branch_name} में हुई किसी असुविधा के लिए हम क्षमाप्रार्थी हैं।`,
      `${nm ? `${nm}जी, ` : ''}{branch_name} में आपको कोई कठिनाई हुई, यह जानकर हमें अत्यंत खेद है।`,
    ],
    tl: [
      `${nm ? `${nm}, h` : 'H'}umihingi kami ng paumanhin sa anumang abala na inyong naranasan sa {branch_name}.`,
      `${nm ? `${nm}, n` : 'N'}agpapaumanhin kami dahil hindi natugunan ng {branch_name} ang inyong mga inaasahan.`,
      `Salamat sa inyong feedback${nm ? `, ${nm}` : ''}. Humihingi kami ng paumanhin sa anumang abala sa {branch_name}.`,
      `${nm ? `${nm}, ` : ''}Ikinalulungkot namin ang inyong karanasan sa {branch_name} at nangangako kaming mapabuti ito.`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot B — 따뜻한 감사 응답 (SAFE/COMPLIMENT) / 8 KO + 4 EN/JA/ZH variants
//  contextMirror: 리뷰 핵심 감성 키워드가 있을 경우 맞춤 응답 우선 반환 (AI같은 답변 구현)
// ════════════════════════════════════════════════════════════════════════════════
export function slotB_appreciation(lang: Language, idx = 0, contextMirror?: string | null): string {
  // ── 맥락 거울 응답 (EN 전용: 힐링·데이트·생일) ──────────────────────────────────
  if (contextMirror === '힐링' && lang === 'en') {
    return 'We are so glad {branch_name} offered you that sense of healing and calm. That truly means a great deal to us.'
  }
  if (contextMirror === '데이트' && lang === 'en') {
    return 'We are so glad {branch_name} made for such a special evening together. That means a lot to us.'
  }
  if (contextMirror === '생일' && lang === 'en') {
    const birthdayEcho = [
      'We are so glad you chose to celebrate at {branch_name}. Knowing it was a special occasion makes every part of this review mean even more to us.',
      'Celebrating a birthday or anniversary here is something we take to heart. We hope the day felt truly special.',
      'It warms us to know {branch_name} was part of your celebration. These are the moments that stay with us.',
      'We love being part of milestone moments. Thank you for letting us share in your special day.',
    ]
    return birthdayEcho[idx % birthdayEcho.length]
  }
  // ── 맥락 거울 응답 (KO 전용): 리뷰가 언급한 감성 키워드로 맞춤 응답 ───────────────
  if (contextMirror && lang === 'ko') {
    const echoMap: Record<string, string[]> = {
      '생일': [
        '생일(또는 기념일)을 {branch_name}에서 보내주셔서 감사해요. 특별한 날 함께할 수 있어 기뻤습니다.',
        '특별한 날을 {branch_name}에서 보내주셔서 감사합니다. 좋은 추억으로 남았기를 바라요.',
        '기념일에 저희를 찾아주신 것, 스태프 모두 뜻깊게 생각합니다.',
        '축하 자리에 {branch_name}이 함께할 수 있어 기뻤습니다.',
      ],
      '힐링': [
        '힐링이 되셨다니 다행이에요. 이런 후기가 저희한테 큰 힘이 됩니다.',
        '힐링이 되셨다니 정말 다행입니다. 또 필요할 때 찾아주세요.',
        '힐링의 시간이 되었다니 스태프 모두 큰 보람을 느낍니다.',
      ],
      '몰입': [
        '몰입감 있는 경험이 되셨다니 스태프 모두 정말 보람차네요.',
        '깊이 빠져드셨다니 저희도 기쁩니다. 그게 저희가 원하는 경험이에요.',
        '몰입형 전시를 만든 보람이 있네요. 감사합니다.',
      ],
      '데이트': [
        '특별한 데이트 장소로 {branch_name}를 선택해 주셔서 감사합니다.',
        '데이트 코스로 {branch_name}을 선택해 주셔서 더욱 기쁩니다.',
        '두 분의 데이트에 저희가 함께할 수 있어 기뻤어요.',
      ],
      '가족': [
        '소중한 가족과의 시간을 {branch_name}에서 함께해 주셔서 더욱 기쁩니다.',
        '가족과 함께 찾아주셔서 감사합니다. 모두 즐거우셨기를 바랍니다.',
        '가족 모두 좋은 시간 보내셨다니 저희도 행복합니다.',
      ],
      '친구': [
        '좋은 분들과 함께 즐거운 시간 보내셨다니 저희도 행복합니다.',
        '친구분들과 즐거운 추억을 만드셨다니 기쁩니다.',
        '또 좋은 분들과 함께 와주세요.',
      ],
      '사진': [
        '사진 찍기 좋은 공간으로 기억해 주셔서 감사합니다.',
        '인생샷 남기셨기를 바랍니다!',
        '좋은 사진 많이 남기셨기를 바라요.',
      ],
      '감동': [
        '감동적이셨다니 저희도 참 기쁘네요. 그렇게 느껴주셔서 감사합니다.',
        '그 감동이 오래 남기를 진심으로 바랍니다.',
        '감동을 전해주셔서 저희가 더 힘이 납니다.',
      ],
      '분위기': [
        '분위기가 마음에 드셨다니 기쁘네요.',
        '분위기로 기억해 주셔서 감사해요.',
        '저희가 공들인 공간을 알아봐 주셔서 감사합니다.',
      ],
    }
    const variants = echoMap[contextMirror]
    if (variants) return variants[idx % variants.length]
  }
  // ── 맥락 거울 응답 (JA): 가족·생일·데이트·힐링 ─────────────────────────────────
  if (contextMirror && lang === 'ja') {
    const jaEcho: Record<string, string[]> = {
      '가족': [
        'ご家族みなさまで楽しんでいただけたとのこと、私どもも大変嬉しく思います。',
        'お子様も一緒に喜んでいただけたようで、スタッフ一同とても嬉しく思っております。',
        'ご家族揃ってのご来館、誠にありがとうございます。みなさまに楽しんでいただけて光栄です。',
      ],
      '생일': [
        '特別な記念日に{branch_name}をお選びいただき、誠にありがとうございます。',
        'お誕生日という大切な日に私どもをお選びいただき、スタッフ一同大変光栄に思っております。',
      ],
      '데이트': [
        '大切なデートに{branch_name}をお選びいただき、誠にありがとうございます。',
        '素敵なデートのひとときをお過ごしいただけたとのこと、大変嬉しく存じます。',
      ],
      '힐링': [
        '心の癒しになったとのこと、スタッフ一同とても嬉しく思っております。',
        'お疲れが取れたとのこと、私どもも大変嬉しく思います。',
      ],
    }
    const jaVariants = jaEcho[contextMirror]
    if (jaVariants) return jaVariants[idx % jaVariants.length]
  }
  // ── 맥락 거울 응답 (ZH): 가족·생일·데이트·힐링 ─────────────────────────────────
  if (contextMirror && lang === 'zh') {
    const zhEcho: Record<string, string[]> = {
      '가족': [
        '很高兴您与家人一同前来，希望大家都度过了美好的时光。',
        '听说孩子们也非常开心，这对我们来说是最大的欣慰！',
        '能与您和您的家人共同度过这段时光，我们感到非常荣幸。',
      ],
      '생일': [
        '感谢您在这个特别的纪念日选择了{branch_name}，我们倍感荣幸。',
        '能与您共同庆祝生日，是我们的荣耀。祝愿这段美好的回忆永远珍藏。',
      ],
      '데이트': [
        '感谢您将{branch_name}作为约会的地方，希望这段时光令您们难忘。',
        '很高兴能成为您们约会故事的一部分，感谢您的到来。',
      ],
      '힐링': [
        '听说您感受到了心灵的治愈，这是我们最大的欣慰。',
        '能为您带来一份宁静和放松，全体员工都感到非常高兴。',
      ],
    }
    const zhVariants = zhEcho[contextMirror]
    if (zhVariants) return zhVariants[idx % zhVariants.length]
  }

  const v: Record<Language, string[]> = {
    ko: [
      // 0: 정중 클래식 (담백)
      '이렇게 후기 남겨주셔서 감사합니다. 들려주신 이야기가 저희에게 큰 힘이 됩니다.',
      // 1: 스태프 격려 중심 (담백)
      '시간 내어 후기 남겨주셔서 스태프 모두 힘이 났어요. 감사합니다.',
      // 2: 따뜻한 말씀 감사 (담백)
      '따뜻한 말씀 정말 감사해요. 저희한테 큰 힘이 됩니다.',
      // 3: 보람 강조
      '남겨주신 격려의 말씀 덕분에 저희 모두 큰 보람을 느낍니다. 고맙습니다.',
      // 4: SHORT 직접 공감 (캐주얼)
      '좋은 경험이 되셨다니 저희도 기뻐요.',
      // 5: SHORT 힘 표현
      '이런 따뜻한 후기가 저희에게 정말 큰 힘이 돼요.',
      // 6: SHORT 감사 수용
      '공유해 주신 소감 감사히 받았습니다.',
      // 7: 스태프 기쁨 (친근)
      '스태프들이 이 후기를 보면 정말 기뻐할 것 같아요.',
    ],
    en: [
      'Your kind words mean a great deal to our entire team. Thank you for spending your time with us.',
      'Reading your warm review truly made our day. We are so glad you enjoyed your visit.',
      'Your generous feedback encourages us all to keep doing our best. Thank you sincerely.',
      'It means the world to us to hear you had such a wonderful experience. Thank you for sharing.',
      'We are so happy you enjoyed your time with us!',
      'Reviews like yours genuinely make our day. Thank you.',
      "We're thrilled it was a great visit for you.",
      'So glad it left you with good memories — thank you for sharing.',
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
    es: [
      'Sus amables palabras son una gran motivación para todo nuestro equipo. ¡Muchas gracias!',
      'Nos alegra mucho saber que disfrutó de su visita. Sus palabras nos inspiran a seguir mejorando.',
      'Su generosa valoración es el mayor reconocimiento para nuestro equipo. Gracias de corazón.',
      'Recibir comentarios tan positivos como el suyo es lo que nos impulsa a dar siempre lo mejor.',
    ],
    ru: [
      'Ваши тёплые слова очень много значат для всей нашей команды. Большое спасибо!',
      'Мы рады, что ваш визит оставил такие приятные впечатления. Ваши слова вдохновляют нас.',
      'Ваш добрый отзыв — лучшая награда для нашей команды. Искренне благодарим вас.',
      'Такие отзывы, как ваш, помогают нам становиться лучше с каждым днём. Спасибо!',
    ],
    ar: [
      'كلماتكم الطيبة تُلهم فريقنا بأكمله وتمنحنا القوة للاستمرار. شكراً جزيلاً!',
      'يسعدنا أن زيارتكم تركت هذا الأثر الجميل. تعليقاتكم مصدر إلهام كبير لنا.',
      'تقييمكم الكريم هو أكبر مكافأة لفريقنا. نشكركم من أعماق قلوبنا.',
      'مثل هذه التعليقات هي ما يدفعنا للسعي نحو التميز دائماً. شكراً لكم.',
    ],
    hi: [
      'आपकी सराहना हमारी पूरी टीम के लिए प्रेरणा का स्रोत है। हार्दिक धन्यवाद!',
      'यह जानकर खुशी हुई कि आपकी यात्रा सुखद रही। आपके शब्द हमें आगे बढ़ने की प्रेरणा देते हैं।',
      'आपकी उदार प्रतिक्रिया हमारी टीम के लिए सबसे बड़ा पुरस्कार है। धन्यवाद।',
      'ऐसी सकारात्मक प्रतिक्रिया ही हमें बेहतर बनाती है। आपका आभार।',
    ],
    tl: [
      'Ang inyong magagandang salita ay nagbibigay ng inspirasyon sa aming buong koponan. Maraming salamat!',
      'Natutuwa kami na nag-enjoy kayo sa inyong pagbisita. Ang inyong mga salita ay nagbibigay sa amin ng lakas.',
      'Ang inyong mainit na pagtanggap ay ang pinakamahalagang gantimpala para sa aming koponan.',
      'Ang mga ganitong positibong feedback ang nagtutulak sa amin na laging magbigay ng pinakamahusay.',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot B — 사안 수용 · 즉각 검토 약속 (COMPLAINT/EMERGENCY) / 8 KO + 4 EN/JA/ZH variants
// ════════════════════════════════════════════════════════════════════════════════
export function slotB_acknowledgment(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      // 0: 직접 수용
      '말씀 주신 내용, 저희가 바로 확인하겠습니다.',
      // 1: 개선 약속 중심
      '이런 일이 다시 생기지 않도록 팀 전체가 내용을 공유하고 개선하겠습니다.',
      // 2: 피드백 가치 인정
      '솔직하게 말씀해 주셔서 감사합니다. 그 덕분에 저희가 발전할 수 있습니다.',
      // 3: 빠른 대응 약속
      '해당 내용을 현장 팀에 즉시 전달하겠습니다.',
      // 4: 책임 강조
      '이 부분은 저희 책임입니다. 반드시 개선하겠습니다.',
      // 5: 재발 방지
      '같은 불편이 반복되지 않도록 꼭 개선하겠습니다.',
      // 6: 공감 + 행동
      '말씀하신 상황을 저희도 심각하게 받아들이고 있습니다. 즉시 조치하겠습니다.',
      // 7: SHORT 직접
      '알겠습니다. 바로 처리하겠습니다.',
    ],
    en: [
      'We hear you, and this has been passed to our team for immediate review.',
      'Your feedback has been noted — our on-site team will address this directly so it does not happen again.',
      'This is exactly the kind of feedback we need. We will act on it right away.',
      'Thank you for taking the time to let us know. Our team is looking into it now.',
      'Noted — we will make sure this reaches the right people today.',
      'We take this seriously and will follow up internally to prevent a recurrence.',
      'Your honest feedback helps us get better. We are on it.',
      'This is being reviewed by our team. We appreciate you telling us.',
    ],
    ja: [
      '頂いたご意見を重く受け止め、担当者が速やかに確認のうえ、誠心誠意ご案内いたします。',
      '貴重なご意見をもとに、改善に向けて早急に取り組んでまいります。同様のご不便が繰り返されないよう努めます。',
      '担当者が速やかに内容を確認し、誠実に対応してまいります。',
      '頂いたご意見を面密に検討し、サービス向上に積極的に活かしてまいります。',
    ],
    zh: [
      '我们会认真对待您的反馈，由专员尽快核实并诚挚跟进。',
      '您的反馈已被记录，我们的团队将立即跟进，确保类似情况不再发生。',
      '我们重视您的每一条反馈，并将积极采取措施改善体验。',
      '我们将认真审查您的反馈，确保在服务改善中得到切实体现。',
    ],
    es: [
      'Hemos tomado nota de sus comentarios y actuaremos de inmediato para resolver el problema.',
      'Su experiencia ha sido registrada y nuestro equipo la revisará para evitar que se repita.',
      'Nos comprometemos a investigar lo ocurrido y mejorar para que esto no vuelva a suceder.',
      'Sus comentarios son muy valiosos. Los transmitiremos a nuestro equipo para que se actúe de forma inmediata.',
    ],
    ru: [
      'Мы приняли ваш отзыв к сведению и незамедлительно примем необходимые меры.',
      'Ваше мнение зафиксировано. Наша команда немедленно займётся решением этого вопроса.',
      'Мы обязуемся разобраться в ситуации и сделать всё, чтобы это не повторилось.',
      'Благодарим за честный отзыв. Он будет передан нашей команде для немедленной проработки.',
    ],
    ar: [
      'لقد وصلت ملاحظاتكم إلينا وسنتخذ الإجراءات اللازمة فوراً لمعالجة المشكلة.',
      'تم تسجيل تعليقاتكم وسيتابع فريقنا الأمر على الفور لمنع تكراره.',
      'نلتزم بالتحقيق في ما حدث واتخاذ الإجراءات التصحيحية اللازمة.',
      'ملاحظاتكم القيّمة ستُحال مباشرةً إلى فريقنا للتعامل معها بجدية تامة.',
    ],
    hi: [
      'आपकी प्रतिक्रिया हम तक पहुँच गई है और हम तत्काल कार्रवाई करेंगे।',
      'आपकी राय दर्ज कर ली गई है। हमारी टीम इसे तुरंत संबोधित करेगी।',
      'हम इस विषय की जाँच करेंगे और सुनिश्चित करेंगे कि यह दोबारा न हो।',
      'आपकी ईमानदार राय हमारे लिए बहुमूल्य है। इसे तुरंत हमारी टीम को भेजा जाएगा।',
    ],
    tl: [
      'Natanggap na namin ang inyong feedback at agad kaming kikilos para tugunan ang isyu.',
      'Naitala na ang inyong karanasan at susuriin ito ng aming koponan upang maiwasan ang paulit-ulit na pagkakamali.',
      'Nangako kaming imbestigahan ang nangyari at gumawa ng mga hakbang upang mapabuti ang aming serbisyo.',
      'Ang inyong komento ay ipapasa sa aming koponan para sa agarang aksyon.',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot C — 작품 중심 몰입 감사 (isArtworkFocused=true) / 3 variants × 4 languages
//  signature: branchSignatureWork(branchCode, lang)
// ════════════════════════════════════════════════════════════════════════════════
export function slotC_artwork(lang: Language, signature: string | null, idx = 0): string {
  const sig = signature ?? null
  const v: Record<Language, string[]> = {
    ko: [
      `특히 'ETERNAL NATURE(영원한 자연)'를 주제로 한 저희의 몰입형 미디어아트${sig ? `, 그중에서도 대표작 ${josa(sig, '을', '를')} 통해` : '를 통해'} 깊은 울림을 느끼셨다니 더없이 기쁩니다.`,
      `저희 'ETERNAL NATURE' 전시가 특별한 감동을 드렸다니 스태프 모두 정말 기쁩니다.${sig ? ` 특히 대표작 ${sig}${hasJong(sig) ? '을' : '를'} 함께 경험해 주셔서 감사합니다.` : ''}`,
      `저희의 몰입형 미디어아트${sig ? `, 그중에서도 ${sig}` : ''}가 특별한 경험으로 남았다니 더없는 보람을 느낍니다.`,
    ],
    en: [
      `We're so glad our immersive "ETERNAL NATURE" media art${sig ? `, especially ${sig},` : ''} resonated with you.`,
      `So glad our "ETERNAL NATURE" exhibition${sig ? `, especially ${sig},` : ''} left a lasting impression on you.`,
      `Your love for our "ETERNAL NATURE" installations${sig ? `, especially ${sig},` : ''} means the world to our team.`,
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
    es: [
      `Nos alegra especialmente que el arte multimedia inmersivo de "ETERNAL NATURE"${sig ? `, especialmente ${sig},` : ''} haya resonado tan profundamente con usted.`,
      `Saber que nuestra exposición "ETERNAL NATURE"${sig ? `, especialmente ${sig},` : ''} le ha dejado una impresión tan duradera nos llena de alegría.`,
      `Su aprecio por nuestras instalaciones${sig ? `, y especialmente por ${sig},` : ''} es el mayor reconocimiento para nuestro equipo creativo.`,
    ],
    ru: [
      `Нас особенно радует, что наше иммерсивное медиаарт "ETERNAL NATURE"${sig ? `, и в особенности ${sig},` : ''} так глубоко тронуло вас.`,
      `Узнать, что наша выставка "ETERNAL NATURE"${sig ? `, особенно ${sig},` : ''} оставила такое сильное впечатление — для нас огромная радость.`,
      `Ваши слова о наших иммерсивных инсталляциях${sig ? `, и особенно о ${sig},` : ''} очень много значат для всей нашей творческой команды.`,
    ],
    ar: [
      `يسعدنا بشكل خاص أن فن الميديا الغامر "ETERNAL NATURE"${sig ? `، وبخاصة ${sig}،` : ''} قد ترك هذا الأثر العميق فيكم.`,
      `معرفة أن معرضنا "ETERNAL NATURE"${sig ? `، وخاصة ${sig}،` : ''} قد أحدث هذا الانطباع الدائم لديكم تملأنا بالسعادة.`,
      `تقديركم لمنشآتنا الغامرة${sig ? `، وخاصة ${sig}،` : ''} هو أكبر مكافأة لفريقنا الإبداعي.`,
    ],
    hi: [
      `हमें विशेष खुशी है कि "ETERNAL NATURE" की हमारी इमर्सिव मीडिया आर्ट${sig ? `, विशेषकर ${sig},` : ''} आपके दिल को छू गई।`,
      `यह जानकर बहुत प्रसन्नता हुई कि "ETERNAL NATURE" प्रदर्शनी${sig ? `, विशेष रूप से ${sig},` : ''} ने आप पर इतनी गहरी छाप छोड़ी।`,
      `हमारी इमर्सिव इंस्टॉलेशन${sig ? ` और विशेष रूप से ${sig}` : ''} के प्रति आपकी सराहना हमारी रचनात्मक टीम के लिए सर्वोच्च पुरस्कार है।`,
    ],
    tl: [
      `Lubos kaming nagagalak na ang aming immersive media art na "ETERNAL NATURE"${sig ? `, lalo na ang ${sig},` : ''} ay tumawid sa inyong puso.`,
      `Ang pagkaalam na ang aming eksibisyon na "ETERNAL NATURE"${sig ? `, lalo na ang ${sig},` : ''} ay nag-iwan ng pangmatagalang impresyon ay nagpapasaya sa amin.`,
      `Ang inyong pagpapahalaga sa aming mga immersive installation${sig ? `, lalo na ang ${sig},` : ''} ay napakahalaga para sa aming creative team.`,
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot C — 일반 긍정 몰입 공간 언급 (isArtworkFocused=false, SAFE/COMPLIMENT)
//  4 variants × 4 languages | {highlight_room}
// ════════════════════════════════════════════════════════════════════════════════
export function slotC_general(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      '특히 {highlight_room} 체험 공간이 특별한 인상으로 남으셨기를 진심으로 바랍니다.',
      '저희의 대표 몰입형 공간인 {highlight_room}를 포함한 다양한 작품들이 소중한 추억으로 남길 바랍니다.',
      '다음 방문에서는 {highlight_room} 등 계절별로 새롭게 업데이트되는 콘텐츠도 기대해 주세요.',
      '{highlight_room}를 비롯한 각 전시 공간에서 몰입과 감동의 시간을 보내셨기를 진심으로 바랍니다.',
    ],
    en: [
      'We hope {highlight_room} and our other immersive spaces left a lasting impression.',
      'We hope our signature installation {highlight_room} was a highlight of your visit.',
      'On your next visit, look forward to updated seasonal content across {highlight_room} and our other galleries.',
      'We hope the immersive experience in {highlight_room} created a truly memorable moment for you.',
    ],
    ja: [
      '{highlight_room}をはじめとする各体験スペースが、特別な印象を残していただけたなら幸いです。',
      '{highlight_room}などの没入型展示空間が、訪問のハイライトとなりましたら嬉しく存じます。',
      '次回のご来館では、{highlight_room}など季節ごとに更新されるコンテンツもぜひお楽しみください。',
      '{highlight_room}をはじめとする展示空間で、心に残る体験をお楽しみいただけましたなら幸いです。',
    ],
    zh: [
      '希望{highlight_room}等沉浸式空间给您留下了美好而深刻的印象。',
      '我们希望{highlight_room}成为您此次参观的亮点之一。',
      '下次到访时，期待您体验{highlight_room}等定期更新的季节性内容。',
      '希望{highlight_room}等沉浸式展区为您带来了真正难忘的体验。',
    ],
    es: [
      'Esperamos que {highlight_room} y nuestros otros espacios inmersivos le hayan dejado un recuerdo especial.',
      'Nos alegra que haya podido disfrutar de {highlight_room} y las demás instalaciones de nuestra exposición.',
      'En su próxima visita, le invitamos a descubrir {highlight_room} y otros contenidos renovados de temporada.',
      'Esperamos que {highlight_room} y el resto de nuestros espacios le hayan brindado una experiencia verdaderamente memorable.',
    ],
    ru: [
      'Надеемся, что {highlight_room} и другие наши иммерсивные пространства оставили у вас незабываемые впечатления.',
      'Мы рады, что вы смогли насладиться {highlight_room} и другими нашими инсталляциями.',
      'При следующем визите обязательно загляните на обновлённые сезонные экспозиции, включая {highlight_room}.',
      'Надеемся, что {highlight_room} подарил вам по-настоящему яркие и глубокие впечатления.',
    ],
    ar: [
      'نأمل أن {highlight_room} وسائر مساحاتنا الغامرة قد تركت لديكم ذكرى لا تُنسى.',
      'يسعدنا أن استمتعتم بـ{highlight_room} وسائر معروضاتنا الفنية.',
      'في زيارتكم القادمة، ندعوكم لاستكشاف {highlight_room} والمحتويات المتجددة موسمياً.',
      'نأمل أن {highlight_room} وسائر مساحاتنا قد قدّمت لكم تجربة لا تُنسى حقاً.',
    ],
    hi: [
      'हमें आशा है कि {highlight_room} सहित हमारे इमर्सिव स्थानों ने आपके मन में एक विशेष छाप छोड़ी होगी।',
      'यह जानकर प्रसन्नता हुई कि आप {highlight_room} और हमारे अन्य प्रदर्शनों का आनंद उठा सके।',
      'अगली बार {highlight_room} सहित हमारी नए सत्र की प्रदर्शनियाँ भी जरूर देखें।',
      'हमें उम्मीद है कि {highlight_room} ने आपको एक यादगार अनुभव दिया होगा।',
    ],
    tl: [
      'Umaasa kami na ang {highlight_room} at aming iba pang immersive na espasyo ay nag-iwan ng espesyal na alaala sa inyo.',
      'Natutuwa kami na natamasa ninyo ang {highlight_room} at aming iba pang mga eksibisyon.',
      'Sa inyong susunod na pagbisita, huwag palampasin ang {highlight_room} at aming mga bagong seasonal na nilalaman.',
      'Umaasa kami na ang {highlight_room} ay nagbigay sa inyo ng tunay na hindi malilimutang karanasan.',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot C — 태그별 구체적 액션 플랜 (COMPLAINT/EMERGENCY dry-fallback 전용)
//  10 tags × 4 variants × 4 languages | {highlight_room}
//  ※ 찬양·보상 일절 없음
// ════════════════════════════════════════════════════════════════════════════════

const SLOT_C_PIVOTS: Partial<Record<string, Record<Language, string[]>>> = {
  INTERACTIVE_COMPLAINT: {
    ko: [
      '인터랙티브 체험에 대한 솔직한 의견 주셔서 감사합니다. 센서 반응성과 체험 요소를 지속적으로 개선하여 더욱 풍부한 상호작용을 제공하겠습니다.',
      '체험 인터랙션에 관한 소중한 피드백 감사합니다. 더욱 역동적인 체험이 가능하도록 인터랙티브 요소 개선에 집중하겠습니다.',
      '인터랙티브 경험에 대한 기대에 충분히 부응하지 못한 점 유감스럽게 생각합니다. 센서 반응 개선과 체험 다양화를 위해 더욱 힘쓰겠습니다.',
      '인터랙티브 체험 요소에 대해 구체적인 피드백을 주셔서 감사합니다. 체험형 콘텐츠 전면 점검을 통해 개선하겠습니다.',
    ],
    en: [
      'Thank you for your candid feedback on the interactive experience. We are continuously working to improve sensor responsiveness and interactive elements.',
      'We appreciate your honest input on the interactivity. Enhancing sensor performance and expanding interactive features remain a top priority.',
      'We understand your expectations for a more interactive experience and are actively developing new ways to improve engagement.',
      'Thank you for the detailed feedback on interactivity. We will conduct a full review of our interactive content and improve it accordingly.',
    ],
    ja: [
      'インタラクティブな体験に関するご意見をありがとうございます。センサーの反応性と体験要素の向上に継続して取り組んでまいります。',
      'インタラクティブな体験へのご期待に十分お応えできず申し訳ございません。体験要素の改善を積極的に進めてまいります。',
      'より充実したインタラクティブ体験をお届けできるよう、新たな改善に積極的に取り組んでまいります。',
      'ご意見を参考に、インタラクティブコンテンツの全面的な見直しを行ってまいります。',
    ],
    zh: [
      '感谢您对互动体验的坦诚反馈。我们将持续改善传感器响应性和互动元素，提供更丰富的体验。',
      '我们理解您对更多互动体验的期待，将积极优化互动功能，确保下次到访有更出色的互动感受。',
      '对于互动体验未达预期，我们深感遗憾。将积极开发新的互动方式，提升您的体验。',
      '感谢您对互动内容的详细反馈。我们将对互动展项进行全面检查和改善。',
    ],
    es: [
      'Gracias por su sincero comentario sobre la experiencia interactiva. Trabajamos continuamente en mejorar la capacidad de respuesta de los sensores y los elementos interactivos.',
      'Agradecemos su opinión sobre la interactividad. Mejorar el rendimiento de los sensores y ampliar las funciones interactivas es una prioridad.',
      'Entendemos su expectativa de una experiencia más interactiva y estamos desarrollando activamente nuevas formas de mejorar la participación del visitante.',
      'Gracias por sus comentarios detallados sobre la interactividad. Realizaremos una revisión completa del contenido interactivo para mejorar continuamente.',
    ],
    ru: [
      'Благодарим за честный отзыв об интерактивной части экспозиции. Мы продолжаем работу над улучшением чувствительности сенсоров и интерактивных элементов.',
      'Мы ценим ваше мнение о функциях взаимодействия. Совершенствование датчиков и расширение интерактивных возможностей остаются нашим приоритетом.',
      'Понимаем ваши ожидания более насыщенного интерактивного опыта и активно ищем новые способы улучшить вовлечённость гостей.',
      'Спасибо за подробный отзыв об интерактивности. Мы проведём полный обзор нашего интерактивного контента.',
    ],
    ar: [
      'شكراً لملاحظاتكم الصريحة حول تجربة التفاعل. نعمل باستمرار على تحسين استجابة أجهزة الاستشعار والعناصر التفاعلية.',
      'نقدر آراءكم حول مستوى التفاعل. تحسين أداء أجهزة الاستشعار وتوسيع المميزات التفاعلية من أولوياتنا.',
      'ندرك توقعاتكم بتجربة تفاعلية أكثر ثراءً ونعمل بنشاط على تطوير طرق جديدة لتحسين مشاركة الزوار.',
      'شكراً لملاحظاتكم التفصيلية حول التفاعلية. سنقوم بمراجعة شاملة للمحتوى التفاعلي لدينا.',
    ],
    hi: [
      'इंटरएक्टिव अनुभव के बारे में आपकी ईमानदार राय के लिए धन्यवाद। हम सेंसर की प्रतिक्रिया और इंटरएक्टिव तत्वों को बेहतर बनाने के लिए निरंतर काम कर रहे हैं।',
      'इंटरएक्टिविटी के बारे में आपकी राय हमारे लिए मूल्यवान है। सेंसर प्रदर्शन में सुधार और इंटरएक्टिव सुविधाओं का विस्तार हमारी प्राथमिकता है।',
      'हम आपकी अधिक इंटरएक्टिव अनुभव की उम्मीद समझते हैं और आगंतुक सहभागिता बेहतर करने के लिए नए तरीके विकसित कर रहे हैं।',
      'इंटरएक्टिविटी पर विस्तृत प्रतिक्रिया के लिए धन्यवाद। हम अपने इंटरएक्टिव कंटेंट की पूरी समीक्षा करेंगे।',
    ],
    tl: [
      'Salamat sa inyong matapat na puna tungkol sa interactive na karanasan. Patuloy naming pinapabuti ang pagtugon ng mga sensor at mga interactive na elemento.',
      'Pinahahalagahan namin ang inyong opinyon ukol sa interactivity. Ang pagpapahusay ng performance ng sensor at pagpapalawak ng mga interactive na feature ay pangunahing priyoridad namin.',
      'Nauunawaan namin ang inyong inaasahan para sa mas mayamang interactive na karanasan at aktibo kaming nagde-develop ng mga bagong paraan upang mapabuti ang pakikilahok ng bisita.',
      'Salamat sa detalyadong feedback tungkol sa interactivity. Magsasagawa kami ng buong pagsusuri ng aming interactive na nilalaman.',
    ],
  },
  VALUE_COMPLAINT: {
    ko: [
      '입장료에 비해 아쉬우셨다는 말씀 잘 새기겠습니다. 콘텐츠 밀도와 전시 구성을 꾸준히 보강해 가겠습니다.',
      '가격 대비 기대에 미치지 못했다는 의견 감사합니다. 더 알찬 전시와 다양한 콘텐츠로 채워가겠습니다.',
      '관람료에 비해 아쉬우셨던 점, 콘텐츠 확충과 전시 퀄리티를 높여 채워가겠습니다.',
      '가격 대비 가치에 관한 솔직한 의견 감사합니다. 지속적인 콘텐츠 업그레이드로 더 나은 경험을 드리겠습니다.',
    ],
    en: [
      'We hear your concerns about the value for the ticket price. We are continuously working to enrich our content and exhibition.',
      'Thank you for sharing your thoughts on pricing. Enhancing the depth and quality of our exhibitions is a key commitment.',
      'We appreciate your candid feedback. Expanding our content offerings and improving the overall experience is an ongoing priority.',
      'Thank you for your honest input on value. We will continue upgrading our content to deliver an even better experience.',
    ],
    ja: [
      'チケット価格へのご不満を真摯に受け止め、コンテンツの充実と展示内容の強化に取り組んでまいります。',
      '価格に対してご満足いただけなかった点、誠に申し訳ございません。より充実した展示内容でお応えできるよう尽力いたします。',
      'コストパフォーマンスに関するご意見をありがとうございます。今後もコンテンツのアップグレードに努めてまいります。',
      'ご指摘を参考に、より価値ある体験をお届けできるよう、内容の充実を図ってまいります。',
    ],
    zh: [
      '我们认真对待您关于票价性价比的意见，将持续丰富内容和展览，确保更具价值的体验。',
      '感谢您对票价的坦诚反馈。扩充展览内容、提升展览品质是我们重要的改进方向。',
      '对于您觉得价值未达期待，我们深感遗憾。将持续升级内容，提供更好的体验。',
      '感谢您关于性价比的诚挚意见。我们将持续改善内容，争取提供更出色的观展价值。',
    ],
    es: [
      'Escuchamos sus inquietudes sobre el valor del precio de la entrada. Trabajamos continuamente para enriquecer nuestro contenido y nuestra exposición.',
      'Gracias por compartir sus impresiones sobre el precio. Mejorar la profundidad y calidad de nuestras exposiciones es un compromiso fundamental.',
      'Apreciamos su sincera opinión. Ampliar nuestra oferta de contenido y mejorar la experiencia en general es una prioridad continua.',
      'Gracias por su comentario honesto sobre el valor. Continuaremos actualizando nuestro contenido para ofrecer una experiencia aún mejor.',
    ],
    ru: [
      'Мы принимаем к сведению ваше мнение о соотношении цены и качества. Постоянная работа над обогащением контента и экспозиции — наш приоритет.',
      'Благодарим за отзыв о стоимости билета. Повышение глубины и качества наших выставок остаётся ключевым обязательством.',
      'Ценим вашу откровенность. Расширение контентных предложений и улучшение общего впечатления — постоянный приоритет.',
      'Спасибо за честное мнение о ценности посещения. Мы продолжим обновлять контент для улучшения опыта.',
    ],
    ar: [
      'نتلقى بجدية ملاحظاتكم حول القيمة مقابل سعر التذكرة. نعمل باستمرار على إثراء محتوانا ومعروضاتنا.',
      'شكراً لمشاركتكم آراءكم حول الأسعار. تعزيز عمق وجودة معارضنا التزام جوهري لنا.',
      'نقدر صراحتكم. توسيع عروض المحتوى وتحسين التجربة الشاملة أولوية مستمرة.',
      'شكراً لرأيكم الصريح حول القيمة. سنواصل تطوير محتوانا لتقديم تجربة أفضل.',
    ],
    hi: [
      'टिकट मूल्य के संदर्भ में आपकी चिंताओं को हम गंभीरता से लेते हैं। हम अपनी सामग्री और प्रदर्शनी को समृद्ध करने के लिए निरंतर काम कर रहे हैं।',
      'मूल्य निर्धारण के बारे में आपके विचार साझा करने के लिए धन्यवाद। हमारी प्रदर्शनियों की गहराई और गुणवत्ता में सुधार करना हमारी प्रमुख प्रतिबद्धता है।',
      'आपकी ईमानदार राय की हम सराहना करते हैं। सामग्री का विस्तार और समग्र अनुभव में सुधार करना हमारी निरंतर प्राथमिकता है।',
      'मूल्य के बारे में आपकी ईमानदार प्रतिक्रिया के लिए धन्यवाद। हम बेहतर अनुभव प्रदान करने के लिए अपनी सामग्री को अपडेट करते रहेंगे।',
    ],
    tl: [
      'Naririnig namin ang inyong alalahanin tungkol sa halaga ng tiket. Patuloy kaming nagtatrabaho upang mapayaman ang aming nilalaman at eksibisyon.',
      'Salamat sa pagbabahagi ng inyong mga saloobin tungkol sa presyo. Ang pagpapabuti ng lalim at kalidad ng aming mga eksibisyon ay isang pangunahing pangako.',
      'Pinahahalagahan namin ang inyong matapat na opinyon. Ang pagpapalawak ng aming mga alok sa nilalaman at pagpapabuti ng kabuuang karanasan ay isang patuloy na priyoridad.',
      'Salamat sa inyong tapat na puna tungkol sa halaga. Patuloy naming ia-update ang aming nilalaman upang makapagbigay ng mas mahusay na karanasan.',
    ],
  },
  CROWD_COMPLAINT: {
    ko: [
      '방문객이 많아 쾌적하게 관람하기 어려우셨던 점, 입장 인원 관리와 운영 방식을 꾸준히 개선하겠습니다.',
      '혼잡했던 부분은 입장 분산과 공간 운영을 손봐서 관람 환경을 개선하겠습니다.',
      '많은 방문객으로 충분히 감상하기 어려우셨던 점, 쾌적한 관람 환경을 만드는 데 더 신경 쓰겠습니다.',
      '혼잡도 문제에 대한 솔직한 피드백 감사합니다. 예약 시스템 개선과 탄력적 입장 운영을 강화하겠습니다.',
    ],
    en: [
      'We sincerely apologize that crowding affected your enjoyment. We are continuously refining our capacity management.',
      'We are sorry the crowds made it difficult to fully enjoy the exhibition. Improving visitor flow and crowd management is a priority.',
      'We understand how overcrowding can detract from the experience and are actively working to improve visitor distribution.',
      'Thank you for your candid feedback on crowding. We will strengthen our reservation system and flexible entry operations.',
    ],
    ja: [
      '混雑によりお楽しみいただけず、誠に申し訳ございません。より快適な鑑賞環境のため、入場管理と運営の改善に努めてまいります。',
      '混み合ってご不便をおかけし、大変申し訳ございません。館内誘導と入場分散の改善に取り組んでまいります。',
      '混雑で十分にお楽しみいただけなかったことを大変遺憾に思います。快適な観覧環境づくりに最善を尽くしてまいります。',
      '混雑に関するご意見をありがとうございます。予約システムの改善と弾力的な入場運営を強化してまいります。',
    ],
    zh: [
      '非常抱歉，拥挤的环境影响了您的观展体验。我们将持续优化人流管理。',
      '对于人流拥挤造成的不便，我们深表歉意，并将积极改进入场管理，提供更舒适的观展空间。',
      '我们理解过度拥挤会影响体验，正积极改善人流分布和参观舒适度。',
      '感谢您对拥挤问题的坦诚反馈。我们将加强预约系统和弹性入场管理。',
    ],
    es: [
      'Lamentamos sinceramente que la afluencia de público afectara su disfrute. Estamos mejorando continuamente la gestión del aforo.',
      'Disculpamos que la aglomeración dificultara disfrutar plenamente la exposición. Mejorar el flujo de visitantes y la gestión de la afluencia es una prioridad.',
      'Entendemos cómo el exceso de público puede restar calidad a la experiencia y estamos trabajando activamente para mejorar la distribución de visitantes.',
      'Gracias por su candoroso comentario sobre la aglomeración. Reforzaremos nuestro sistema de reservas y las operaciones de entrada flexibles.',
    ],
    ru: [
      'Искренне сожалеем, что переполненность залов повлияла на ваше впечатление. Мы постоянно совершенствуем управление потоком посетителей.',
      'Приносим извинения за то, что толпа не позволила вам в полной мере насладиться выставкой. Улучшение распределения посетителей — наш приоритет.',
      'Понимаем, что переполненность снижает качество опыта, и активно работаем над распределением гостей.',
      'Благодарим за откровенный отзыв о переполненности. Усилим систему бронирования и гибкий вход.',
    ],
    ar: [
      'نعتذر بصدق عن الإزعاج الذي سببته الازدحامات لتجربتكم. نعمل باستمرار على تطوير إدارة طاقة الاستيعاب.',
      'نأسف لأن الاكتظاظ أعاق استمتاعكم الكامل بالمعرض. تحسين تدفق الزوار وإدارة الحشود أولوية لدينا.',
      'ندرك كيف يؤثر الاكتظاظ على التجربة ونعمل بنشاط على تحسين توزيع الزوار.',
      'شكراً لملاحظاتكم الصريحة حول الازدحام. سنعزز نظام الحجز وعمليات الدخول المرنة.',
    ],
    hi: [
      'हमें ईमानदारी से खेद है कि भीड़ ने आपके आनंद को प्रभावित किया। हम निरंतर क्षमता प्रबंधन में सुधार कर रहे हैं।',
      'हमें खेद है कि भीड़ ने प्रदर्शनी का पूरी तरह आनंद लेना कठिन बना दिया। आगंतुक प्रवाह और भीड़ प्रबंधन में सुधार हमारी प्राथमिकता है।',
      'हम समझते हैं कि भीड़भाड़ अनुभव को कम कर सकती है और हम आगंतुक वितरण में सुधार के लिए सक्रिय रूप से काम कर रहे हैं।',
      'भीड़ के बारे में आपकी ईमानदार प्रतिक्रिया के लिए धन्यवाद। हम अपनी बुकिंग प्रणाली और लचीली प्रवेश प्रक्रिया को मजबूत करेंगे।',
    ],
    tl: [
      'Taos-pusong humihingi kami ng paumanhin na naapektuhan ng pagdagsa ng mga bisita ang inyong kasiyahan. Patuloy naming pinipino ang pamamahala ng kapasidad.',
      'Ipinagpaumanhin namin na nahirapan kayong mag-enjoy ng eksibisyon dahil sa dami ng tao. Ang pagpapabuti ng daloy ng bisita at pamamahala ng karamihan ay isang priyoridad.',
      'Nauunawaan namin kung paano maaaring makabawas ang matinding siksikan sa karanasan at aktibo kaming nagtatrabaho upang mapabuti ang pamamahagi ng bisita.',
      'Salamat sa inyong tapat na feedback tungkol sa siksikan. Palakasin namin ang aming sistema ng reserbasyon at mga flexible na operasyon ng pagpasok.',
    ],
  },
  LAYOUT_COMPLAINT: {
    ko: [
      '동선 안내가 불편하셨다는 점 깊이 유감스럽게 생각합니다. 안내 표지와 동선 시스템을 지속적으로 보완하겠습니다.',
      '관람 동선에 대한 소중한 피드백 감사합니다. 안내 표지판 개선과 직관적인 동선 구성을 위해 더욱 노력하겠습니다.',
      '동선이 복잡하게 느껴지셨던 점, 더 직관적인 레이아웃으로 바로 개선해 보겠습니다.',
      '관람 흐름 개선을 위해 전반적인 동선 재설계를 검토하겠습니다. 소중한 의견 감사합니다.',
    ],
    en: [
      'We are sorry the layout was confusing. We will continue improving our wayfinding signage and flow guidance.',
      'Thank you for highlighting the navigation difficulty. Improving our layout flow and signage is something we are actively working on.',
      'We apologize for the confusing layout. We will take immediate action to redesign a more intuitive flow.',
      'Thank you for your feedback on the layout. We will review the overall flow to make navigation easier.',
    ],
    ja: [
      '動線がわかりにくくご不便をおかけし、誠に申し訳ございません。案内サインの改善に取り組んでまいります。',
      '館内レイアウトについてのご指摘、ありがとうございます。よりわかりやすい動線設計に取り組んでまいります。',
      'わかりにくい動線で申し訳ございません。より直感的なレイアウト改善に直ちに着手いたします。',
      '動線に関するご意見を参考に、案内システム全体の見直しを図ってまいります。',
    ],
    zh: [
      '对于参观动线带来的困惑，我们深感抱歉。我们将持续改善引导标识，使参观更加便捷顺畅。',
      '感谢您指出导览问题。改善动线标识是我们正在积极推进的工作。',
      '对于动线混乱给您带来的不便，我们深感抱歉。我们将立即着手重新设计更直观的参观流线。',
      '感谢您对动线的反馈。我们将对整体导览系统进行审查，使参观更加顺畅。',
    ],
    es: [
      'Lamentamos que el trazado resultara confuso. Seguiremos mejorando nuestra señalización y guía de recorridos.',
      'Gracias por destacar la dificultad de orientación. Mejorar el flujo del recorrido y la señalización es algo en lo que trabajamos activamente.',
      'Nos disculpamos por el diseño confuso. Tomaremos medidas inmediatas para rediseñar un recorrido más intuitivo.',
      'Gracias por sus comentarios sobre el trazado. Revisaremos el recorrido general para facilitar la orientación.',
    ],
    ru: [
      'Сожалеем, что планировка оказалась запутанной. Продолжим улучшать навигационные указатели и схемы движения.',
      'Благодарим за указание на трудности с навигацией. Мы активно работаем над улучшением маршрутов и указателей.',
      'Приносим извинения за неудобную планировку. Немедленно приступим к разработке более интуитивной схемы движения.',
      'Спасибо за отзыв о планировке. Мы пересмотрим общую схему маршрутов для удобства ориентирования.',
    ],
    ar: [
      'نأسف لوجود الارتباك في التخطيط. سنواصل تحسين لافتات الإرشاد وتوجيه مسارات الزيارة.',
      'شكراً لإبرازكم صعوبة الإرشاد. تحسين تدفق المسار والإشارات موضع اهتمامنا المستمر.',
      'نعتذر عن التخطيط المربك. سنتخذ إجراءات فورية لإعادة تصميم مسار أكثر وضوحاً وسهولة.',
      'شكراً لملاحظاتكم حول التخطيط. سنراجع المسار العام لتسهيل التنقل.',
    ],
    hi: [
      'हमें खेद है कि लेआउट भ्रमित करने वाला था। हम अपनी वेफाइंडिंग साइनेज और प्रवाह मार्गदर्शन में सुधार जारी रखेंगे।',
      'नेविगेशन की कठिनाई को उजागर करने के लिए धन्यवाद। हमारे लेआउट प्रवाह और साइनेज में सुधार करना हमारी सक्रिय प्राथमिकता है।',
      'भ्रामक लेआउट के लिए हम क्षमा चाहते हैं। हम एक अधिक सहज प्रवाह को फिर से डिजाइन करने के लिए तत्काल कार्रवाई करेंगे।',
      'लेआउट पर आपकी प्रतिक्रिया के लिए धन्यवाद। हम नेविगेशन को आसान बनाने के लिए समग्र प्रवाह की समीक्षा करेंगे।',
    ],
    tl: [
      'Ipinagpaumanhin namin na nakalito ang layout. Patuloy naming pagbubutihin ang aming mga wayfinding signage at gabay sa daloy.',
      'Salamat sa pagpunta ng kahirapan sa pag-navigate. Ang pagpapabuti ng daloy ng aming layout at signage ay isang bagay na aktibo naming tinatrabaho.',
      'Humihingi kami ng paumanhin para sa nakakalitong layout. Magsasagawa kami ng agarang hakbang upang muling idisenyo ang mas intuitive na daloy.',
      'Salamat sa inyong feedback tungkol sa layout. Susuriin namin ang pangkalahatang daloy upang gawing mas madali ang pag-navigate.',
    ],
  },
  DISPLAY_ISSUE: {
    ko: [
      '영상·디스플레이 품질 문제는 장비 점검과 유지 관리를 더 꼼꼼히 챙기겠습니다.',
      '디스플레이 문제는 정기 점검을 강화하고 빠르게 수리해 다시 생기지 않도록 하겠습니다.',
      '시청각 품질에 대한 피드백 감사합니다. 담당 기술팀이 즉시 점검하겠습니다.',
      '디스플레이 오류로 관람에 불편을 드린 점 사과드립니다. 장비 모니터링을 강화하겠습니다.',
    ],
    en: [
      'The AV and display issues you encountered are being escalated to our technical team for immediate action. We will enforce stricter equipment checks going forward.',
      'We are sorry about the display issues. Regular maintenance and equipment inspections are being strengthened.',
      'Thank you for the AV quality feedback. Our technical team will conduct an immediate inspection.',
      'We apologize for the display errors that affected your visit. We will enhance our equipment monitoring.',
    ],
    ja: [
      '映像・ディスプレイ品質についてご不便をおかけし、誠に申し訳ございません。機器の点検・メンテナンスをより徹底いたします。',
      'ディスプレイの問題でご不便をおかけし、深くお詫び申し上げます。定期点検の強化と迅速なメンテナンスを行ってまいります。',
      '映像品質に関するご意見をありがとうございます。技術担当者が早急に点検を行います。',
      'ディスプレイエラーでご迷惑をおかけし、申し訳ございません。機器モニタリングを強化してまいります。',
    ],
    zh: [
      '对于您遇到的显示质量问题，我们深感抱歉。我们将加强设备检查和维护，确保最佳视听体验。',
      '对于显示问题给您带来的不便，我们深表歉意。正在加强定期检查和设备维护。',
      '感谢您对视听质量的反馈。我们的技术团队将立即进行检查。',
      '对于显示错误影响您的参观，我们深感抱歉。将加强设备监控。',
    ],
    es: [
      'Pedimos disculpas por los problemas de visualización y audio que experimentó. Los reportaremos a nuestro equipo técnico para su resolución inmediata y reforzaremos los controles de equipos.',
      'Lamentamos los problemas con las pantallas. Estamos reforzando el mantenimiento regular y las inspecciones de equipos.',
      'Gracias por el comentario sobre la calidad audiovisual. Nuestro equipo técnico realizará una inspección inmediata.',
      'Nos disculpamos por los errores de pantalla que afectaron su visita. Mejoraremos el monitoreo de equipos.',
    ],
    ru: [
      'Приносим извинения за проблемы с аудио-визуальным оборудованием. Мы немедленно передадим это нашей технической команде и усилим проверки оборудования.',
      'Сожалеем о проблемах с дисплеями. Регулярное техническое обслуживание и проверки оборудования усиливаются.',
      'Благодарим за отзыв о качестве AV. Наша техническая команда немедленно проведёт проверку.',
      'Приносим извинения за ошибки дисплея, повлиявшие на вашу прогулку. Усилим мониторинг оборудования.',
    ],
    ar: [
      'نعتذر عن مشكلات العرض والصوتيات التي واجهتموها. سنحيل هذا فوراً إلى فريقنا التقني مع تعزيز فحوصات المعدات.',
      'نأسف لمشكلات شاشات العرض. نعمل على تعزيز الصيانة الدورية وفحص المعدات.',
      'شكراً لملاحظاتكم حول جودة الصوت والصورة. سيقوم فريقنا التقني بإجراء فحص فوري.',
      'نعتذر عن أخطاء العرض التي أثّرت على زيارتكم. سنعزز مراقبة المعدات.',
    ],
    hi: [
      'आपके द्वारा अनुभव की गई दृश्य-श्रव्य और डिस्प्ले समस्याओं के लिए हम क्षमा चाहते हैं। हम इसे तुरंत हमारी तकनीकी टीम को रिपोर्ट करेंगे और उपकरण जांच को मजबूत करेंगे।',
      'डिस्प्ले समस्याओं के लिए हम खेद व्यक्त करते हैं। नियमित रखरखाव और उपकरण निरीक्षण को मजबूत किया जा रहा है।',
      'दृश्य-श्रव्य गुणवत्ता पर आपकी प्रतिक्रिया के लिए धन्यवाद। हमारी तकनीकी टीम तुरंत निरीक्षण करेगी।',
      'आपकी यात्रा को प्रभावित करने वाली डिस्प्ले त्रुटियों के लिए हम माफी चाहते हैं। हम उपकरण निगरानी को बढ़ाएंगे।',
    ],
    tl: [
      'Humihingi kami ng paumanhin para sa mga isyung AV at display na inyong naranasan. Irereport namin ito agad sa aming teknikal na koponan para sa agarang aksyon at palakasin ang mga tseke ng kagamitan.',
      'Ipinagpaumanhin namin ang mga isyu sa display. Pinahuhusay ang regular na pagpapanatili at inspeksyon ng kagamitan.',
      'Salamat sa feedback tungkol sa kalidad ng AV. Magsasagawa ang aming teknikal na koponan ng agarang inspeksyon.',
      'Humihingi kami ng paumanhin para sa mga error sa display na nakaapekto sa inyong pagbisita. Palakasin namin ang pagmamatyag sa kagamitan.',
    ],
  },
  DURATION_COMPLAINT: {
    ko: [
      '티켓 가격 대비 관람 분량이 짧게 느껴지셨다는 말씀 충분히 이해합니다. 체험 구역을 지속적으로 확장하여 더 풍부한 시간을 드리겠습니다.',
      '관람에 드신 시간이 기대보다 짧으셨군요. 콘텐츠와 인터랙티브 존을 단계적으로 확충해 가겠습니다.',
      '전시 규모에 대한 솔직한 의견 감사드립니다. 새로운 공간과 콘텐츠를 지속적으로 추가하여 방문 가치를 높여 나가겠습니다.',
      '관람 볼륨에 대한 소중한 의견 잘 받았습니다. 체험 콘텐츠 확장 계획을 가속화하겠습니다.',
    ],
    en: [
      'We hear you — the exhibition felt shorter than expected for the ticket price. We are actively expanding our experience zones to offer more for your visit.',
      'Thank you for your candid feedback on the content volume. We will continue adding new zones and interactive elements to make each visit feel more complete.',
      'We appreciate your honest take on the exhibition length. Expanding our content offerings is a key priority, and we hope to offer you a fuller experience next time.',
      'We take your comments on exhibition volume seriously and will expand experiential content incrementally.',
    ],
    ja: [
      '観覧時間についての率直なご意見、ありがとうございます。コンテンツの充実に継続して取り組んでまいります。',
      '展示の規模についてのご意見、誠に受け止めております。より多彩で豊富なコンテンツでお応えいたします。',
      'コンテンツ量に関するご意見をありがとうございます。コンテンツの拡充計画を継続的に推進してまいります。',
      '展示ボリュームに関するご意見を重く受け止め、体験コンテンツを段階的に充実させてまいります。',
    ],
    zh: [
      '感谢您对展览时长的坦诚反馈。我们将不断扩充内容，让每次观展都更加充实。',
      '对于展览规模和时间的遗憾，我们真诚接受。将以更多样、丰富的内容回馈您。',
      '感谢您对内容量的坦诚反馈。我们将持续推进内容扩充计划。',
      '我们重视您关于展览体量的意见，将逐步扩充体验内容。',
    ],
    es: [
      'Le escuchamos — la exposición se sintió más corta de lo esperado para el precio de la entrada. Estamos ampliando activamente nuestras zonas de experiencia para ofrecer más durante su visita.',
      'Gracias por su sincero comentario sobre el volumen de contenido. Continuaremos añadiendo nuevas zonas y elementos interactivos para que cada visita se sienta más completa.',
      'Apreciamos su perspectiva honesta sobre la duración de la exposición. Ampliar nuestras propuestas de contenido es una prioridad y esperamos ofrecerle una experiencia más completa en su próxima visita.',
      'Tomamos sus comentarios sobre el volumen de la exposición en serio y ampliaremos el contenido experimental de manera incremental.',
    ],
    ru: [
      'Понимаем — выставка показалась короче ожидаемого для такой цены билета. Мы активно расширяем зоны опыта, чтобы предложить больше в каждом посещении.',
      'Благодарим за откровенный отзыв об объёме контента. Продолжим добавлять новые зоны и интерактивные элементы, чтобы каждое посещение было более насыщенным.',
      'Ценим вашу честную оценку продолжительности выставки. Расширение предложений — ключевой приоритет.',
      'Принимаем ваши комментарии об объёме экспозиции серьёзно и будем расширять контент поэтапно.',
    ],
    ar: [
      'نسمع ما تقولون — بدت المعرض أقصر مما هو متوقع مقابل سعر التذكرة. نعمل بنشاط على توسيع مناطق التجربة لتقديم المزيد في كل زيارة.',
      'شكراً على ملاحظاتكم الصريحة حول حجم المحتوى. سنواصل إضافة مناطق جديدة وعناصر تفاعلية لجعل كل زيارة أكثر اكتمالاً.',
      'نقدر رأيكم الصادق حول مدة المعرض. توسيع عروض محتوانا أولوية رئيسية ونأمل في تقديم تجربة أكمل في المرة القادمة.',
      'نأخذ تعليقاتكم على حجم المعرض بجدية وسنوسع المحتوى التجريبي بصورة تدريجية.',
    ],
    hi: [
      'हम समझते हैं — प्रदर्शनी टिकट के मूल्य के लिए अपेक्षा से छोटी लगी। हम प्रत्येक यात्रा के लिए अधिक प्रदान करने के लिए अपने अनुभव क्षेत्रों का सक्रिय रूप से विस्तार कर रहे हैं।',
      'सामग्री की मात्रा पर आपकी ईमानदार प्रतिक्रिया के लिए धन्यवाद। हम नई जोन और इंटरएक्टिव तत्व जोड़ते रहेंगे।',
      'प्रदर्शनी की अवधि पर आपकी ईमानदार राय की हम सराहना करते हैं। सामग्री विस्तार हमारी प्रमुख प्राथमिकता है।',
      'हम प्रदर्शनी की मात्रा पर आपकी टिप्पणियों को गंभीरता से लेते हैं और धीरे-धीरे अनुभव सामग्री का विस्तार करेंगे।',
    ],
    tl: [
      'Naririnig namin kayo — ang eksibisyon ay naging mas maikli kaysa inaasahan para sa presyo ng tiket. Aktibo kaming nagpapalawak ng aming mga experiential zone upang makapag-alok ng higit pa sa inyong pagbisita.',
      'Salamat sa inyong tapat na feedback tungkol sa dami ng nilalaman. Patuloy kaming magdadagdag ng mga bagong zone at interactive na elemento upang maging mas kumpleto ang bawat pagbisita.',
      'Pinahahalagahan namin ang inyong tapat na pananaw tungkol sa haba ng eksibisyon. Ang pagpapalawak ng aming mga alok sa nilalaman ay isang pangunahing priyoridad.',
      'Sineseryoso namin ang inyong mga komento tungkol sa dami ng eksibisyon at palawakin namin ang experiential na nilalaman nang unti-unti.',
    ],
  },
  // ── PHASE 3: 4 Niche Tags ──────────────────────────────────────────────────────
  ROOM_SPECIFIC_COMPLAINT: {
    ko: [
      '특정 공간({highlight_room} 등) 운영에 대한 소중한 의견 감사합니다. 각 구역의 콘텐츠 품질과 운영 환경을 즉시 점검하겠습니다.',
      '{highlight_room} 등 특정 작품 공간에 대한 구체적인 피드백 감사합니다. 해당 공간의 점검과 동선 개선을 즉시 진행하겠습니다.',
      '작품 구역별 운영에 대한 소중한 피드백을 바탕으로, 각 공간의 체험 품질 향상에 최선을 다하겠습니다.',
      '{highlight_room} 구역에 대한 소중한 의견 감사합니다. 전시 구역 운영 개선을 위해 즉각적인 조치를 취하겠습니다.',
    ],
    en: [
      'Thank you for your specific feedback on our gallery spaces. We will conduct an immediate review of the experience in each area, including {highlight_room}.',
      'We appreciate your detailed comments on specific areas like {highlight_room}. We will prioritize improving those spaces.',
      'Your feedback on individual gallery areas is invaluable. We will review operations in {highlight_room} and all other zones promptly.',
      'Thank you for pointing out the specific concerns in our gallery spaces. Addressing these areas is our immediate priority.',
    ],
    ja: [
      '{highlight_room}を含む各展示エリアに関するご意見をありがとうございます。各エリアの運営改善に取り組んでまいります。',
      '特定の展示空間に関する具体的なご意見、誠にありがとうございます。該当エリアの改善を優先的に進めます。',
      '展示エリアごとの運営に関する貴重なご意見をもとに、各空間の体験品質向上に最善を尽くしてまいります。',
      '{highlight_room}エリアに関するご意見をありがとうございます。展示エリアの運営改善に向けて直ちに対応いたします。',
    ],
    zh: [
      '感谢您对{highlight_room}等特定展区的具体反馈。我们将立即对各区域进行检查和改善。',
      '感谢您对特定展览区域的详细反馈。我们将优先对这些区域进行改进。',
      '您对各展览区域的宝贵反馈对我们非常重要。我们将尽快检查{highlight_room}等所有区域的运营情况。',
      '感谢您指出展区的具体问题。改善这些区域是我们的当务之急。',
    ],
    es: [
      'Gracias por sus comentarios específicos sobre nuestros espacios de galería. Realizaremos una revisión inmediata de la experiencia en cada área, incluido {highlight_room}.',
      'Apreciamos sus comentarios detallados sobre áreas específicas como {highlight_room}. Priorizaremos la mejora de esos espacios.',
      'Sus comentarios sobre las áreas individuales de la galería son invaluables. Revisaremos las operaciones en {highlight_room} y todas las demás zonas a la brevedad.',
      'Gracias por señalar las preocupaciones específicas en nuestros espacios de galería. Abordar estas áreas es nuestra prioridad inmediata.',
    ],
    ru: [
      'Благодарим за конкретные замечания по нашим галерейным пространствам. Мы немедленно проведём проверку в каждой зоне, включая {highlight_room}.',
      'Ценим ваши подробные комментарии об отдельных пространствах, таких как {highlight_room}. Улучшение этих зон — наш приоритет.',
      'Ваши отзывы об отдельных залах галереи бесценны. Мы оперативно проверим работу {highlight_room} и всех остальных зон.',
      'Спасибо за указание конкретных проблем в наших галерейных пространствах. Устранение этих недостатков — наш немедленный приоритет.',
    ],
    ar: [
      'شكراً لملاحظاتكم التفصيلية حول مساحات المعرض. سنقوم بمراجعة فورية للتجربة في كل منطقة بما في ذلك {highlight_room}.',
      'نقدر تعليقاتكم التفصيلية حول مناطق محددة مثل {highlight_room}. سنعطي الأولوية لتحسين تلك المساحات.',
      'ملاحظاتكم حول مناطق المعرض الفردية ذات قيمة كبيرة. سنراجع عمليات {highlight_room} وجميع المناطق الأخرى بسرعة.',
      'شكراً لإشارتكم إلى المخاوف المحددة في مساحات معرضنا. معالجة هذه المناطق أولويتنا الفورية.',
    ],
    hi: [
      'हमारी गैलरी स्थानों पर आपकी विशिष्ट प्रतिक्रिया के लिए धन्यवाद। हम {highlight_room} सहित प्रत्येक क्षेत्र में अनुभव की तत्काल समीक्षा करेंगे।',
      '{highlight_room} जैसे विशिष्ट क्षेत्रों पर आपकी विस्तृत टिप्पणी की हम सराहना करते हैं। उन स्थानों में सुधार को प्राथमिकता देंगे।',
      'व्यक्तिगत गैलरी क्षेत्रों पर आपकी प्रतिक्रिया अमूल्य है। हम शीघ्र ही {highlight_room} और अन्य सभी क्षेत्रों में संचालन की समीक्षा करेंगे।',
      'हमारी गैलरी स्थानों में विशिष्ट चिंताओं को इंगित करने के लिए धन्यवाद। इन क्षेत्रों को संबोधित करना हमारी तत्काल प्राथमिकता है।',
    ],
    tl: [
      'Salamat sa inyong partikular na feedback tungkol sa aming mga gallery space. Magsasagawa kami ng agarang pagsusuri ng karanasan sa bawat lugar, kabilang ang {highlight_room}.',
      'Pinahahalagahan namin ang inyong detalyadong mga komento sa mga partikular na lugar tulad ng {highlight_room}. Uunahin namin ang pagpapabuti ng mga espasyong iyon.',
      'Napakahalaga ng inyong feedback tungkol sa mga indibidwal na lugar ng gallery. Susuriin namin ang mga operasyon sa {highlight_room} at lahat ng iba pang zone agad-agad.',
      'Salamat sa pagpunta ng mga partikular na alalahanin sa aming mga gallery space. Ang pagtugon sa mga lugar na ito ay ang aming agarang priyoridad.',
    ],
  },
  SYSTEM_COMPLAINT: {
    ko: [
      '키오스크·시스템 오류는 담당 기술팀이 바로 확인해서 조치하겠습니다.',
      '예약·입장 시스템 오류는 빠르게 점검해서 다시 생기지 않도록 하겠습니다.',
      '디지털 시스템 오류 건은 기술팀이 곧바로 살펴보겠습니다.',
      '관람 전 키오스크·앱 오류 부분은 시스템 안정화를 우선으로 챙기겠습니다.',
    ],
    en: [
      'We sincerely apologize for the kiosk and system issues you encountered. Our technical team will investigate and resolve them immediately.',
      'We are sorry the booking or entry system caused problems. We will prioritize system checks to prevent recurrence.',
      'We apologize for the digital system errors. Our technical team will address the issue right away.',
      'We are sorry the kiosk or app issues disrupted your visit. Stabilizing our systems is our top priority.',
    ],
    ja: [
      'キオスクおよびシステムエラーによるご不便を深くお詫び申し上げます。技術担当者が早急に確認・対応いたします。',
      '予約・入場システムの不具合でご不便をおかけし、誠に申し訳ございません。迅速に改善いたします。',
      'デジタルシステムのエラーによるご不便をお詫び申し上げます。技術チームが直ちに対応いたします。',
      'キオスク・アプリの不具合でご来館前からご不便をおかけし、誠に申し訳ございません。システム安定化を最優先いたします。',
    ],
    zh: [
      '对于自助机和系统故障给您带来的不便，我们深表歉意。我们的技术团队将立即调查并解决。',
      '对于预约或入场系统出现的问题，我们深感抱歉，将优先进行系统检查以防止再次发生。',
      '对于数字系统故障造成的不便，我们深表歉意。技术团队将立即处理。',
      '对于自助机或应用故障在参观前给您带来的不便，我们深感抱歉。系统稳定化是我们的首要任务。',
    ],
    es: [
      'Lamentamos sinceramente los problemas con los quioscos y sistemas que encontró. Nuestro equipo técnico investigará y los resolverá de inmediato.',
      'Nos disculpamos por los problemas causados por el sistema de reservas o de entrada. Priorizaremos las comprobaciones del sistema para evitar que se repita.',
      'Pedimos disculpas por los errores del sistema digital. Nuestro equipo técnico abordará el problema de inmediato.',
      'Lamentamos que los problemas con los quioscos o la aplicación interrumpieran su visita. Estabilizar nuestros sistemas es nuestra máxima prioridad.',
    ],
    ru: [
      'Искренне сожалеем о проблемах с киосками и системами. Наша техническая команда немедленно исследует и устранит их.',
      'Приносим извинения за проблемы с системой бронирования или входа. Приоритет — проверка систем для предотвращения повторения.',
      'Извиняемся за ошибки цифровой системы. Техническая команда немедленно займётся этим вопросом.',
      'Сожалеем, что проблемы с киоском или приложением нарушили ваш визит. Стабилизация систем — наш главный приоритет.',
    ],
    ar: [
      'نعتذر بصدق عن مشكلات الأكشاك والأنظمة التي واجهتموها. سيقوم فريقنا التقني بالتحقيق وحلها فوراً.',
      'نأسف لمشكلات نظام الحجز أو الدخول. سنعطي الأولوية لفحوصات النظام لمنع التكرار.',
      'نعتذر عن أعطال النظام الرقمي. سيتولى فريقنا التقني معالجة المشكلة فوراً.',
      'نأسف لأن مشكلات الأكشاك أو التطبيق أعاقت زيارتكم. استقرار أنظمتنا أولويتنا القصوى.',
    ],
    hi: [
      'आपके द्वारा किओस्क और सिस्टम समस्याओं का अनुभव करने के लिए हम ईमानदारी से माफी चाहते हैं। हमारी तकनीकी टीम तुरंत जांच और समाधान करेगी।',
      'बुकिंग या प्रवेश प्रणाली में समस्याओं के लिए हम क्षमाप्रार्थी हैं। पुनरावृत्ति रोकने के लिए सिस्टम जांच को प्राथमिकता देंगे।',
      'डिजिटल सिस्टम की त्रुटियों के लिए हम माफी चाहते हैं। हमारी तकनीकी टीम तुरंत समस्या का समाधान करेगी।',
      'हमें खेद है कि किओस्क या ऐप की समस्याओं ने आपकी यात्रा को बाधित किया। हमारे सिस्टम को स्थिर करना हमारी सर्वोच्च प्राथमिकता है।',
    ],
    tl: [
      'Taos-pusong humihingi kami ng paumanhin para sa mga isyung kiosk at sistema na inyong naranasan. Mangangasiwa ang aming teknikal na koponan at ayusin ang mga ito agad.',
      'Humihingi kami ng paumanhin sa mga problemang dulot ng sistema ng booking o pagpasok. Uunahin namin ang mga tseke ng sistema upang maiwasan ang pagbabalik.',
      'Humihingi kami ng paumanhin para sa mga error ng digital na sistema. Haharapin ng aming teknikal na koponan ang isyung ito agad.',
      'Ipinagpaumanhin namin na ang mga isyung kiosk o app ay naabala ang inyong pagbisita. Ang pag-stabilize ng aming mga sistema ay ang aming pinakamataas na priyoridad.',
    ],
  },
  REVISIT_COMPLAINT: {
    ko: [
      '다시 오셨는데 지난번보다 아쉬우셨다니 더 신경 쓰이네요. 시즌마다 새 콘텐츠를 들여서 올 때마다 새로운 경험이 되도록 하겠습니다.',
      '다시 찾아주셨는데 기대에 못 미친 점이 마음에 남습니다. 시즌별 업데이트와 새로운 전시로 더 나아진 모습 보여드리겠습니다.',
      '다시 오셨을 때 이전과 다른 만족을 드리지 못했네요. 콘텐츠 리프레시를 강화해 매 시즌 새로운 경험을 준비하겠습니다.',
      '다시 방문해 주셨는데 충분히 만족시켜 드리지 못했네요. 콘텐츠 갱신과 시설 개선으로 더 나아지겠습니다.',
    ],
    en: [
      'We sincerely apologize that this visit did not match your previous experience. We are continuously introducing seasonal new content to ensure each visit offers something fresh.',
      'We are sorry your return visit was disappointing. Through our global touring exhibitions and seasonal updates, we strive to make each visit new.',
      'We regret that your revisit did not meet expectations. We are strengthening our content refresh schedule to deliver new experiences each season.',
      'We apologize for not providing the experience you deserved on your return visit. Ongoing content renewal is our commitment.',
    ],
    ja: [
      '再来館いただいたにもかかわらず、ご期待に沿えず大変申し訳ございません。シーズンごとの新コンテンツ導入を通じて、より新鮮な体験をお届けします。',
      '再度お越しいただいたご期待に応えられず、誠に申し訳ございません。定期的なコンテンツ更新により、毎回新しい発見をお届けします。',
      '前回と同様の満足をお届けできなかったことを遺憾に思います。コンテンツのリフレッシュ計画を強化してまいります。',
      '再来館いただいたにもかかわらず十分にお楽しみいただけず、誠に申し訳ございません。継続的なコンテンツ刷新と施設改善でお応えします。',
    ],
    zh: [
      '非常抱歉，此次再访的体验未能达到您的预期。我们将持续引入季节性新内容，确保每次访问都带来全新体验。',
      '对于再次到访却未能满足您的期待，我们深感抱歉。通过全球巡展和季节性更新，我们力求每次访问都有新的惊喜。',
      '对于再访体验未能达到前次水准，我们深感遗憾。将加强内容更新计划，每季带来全新体验。',
      '对于再次到访却未能充分满足您，我们真诚道歉。持续的内容更新和设施改善是我们的承诺。',
    ],
    es: [
      'Pedimos sinceras disculpas porque esta visita no estuvo a la altura de su experiencia anterior. Estamos introduciendo continuamente nuevo contenido estacional para que cada visita ofrezca algo fresco.',
      'Lamentamos que su visita de retorno resultara decepcionante. A través de nuestras exposiciones itinerantes globales y actualizaciones estacionales, nos esforzamos por hacer que cada visita sea nueva.',
      'Lamentamos que su revisita no cumpliera las expectativas. Estamos reforzando nuestro calendario de actualización de contenidos para ofrecer nuevas experiencias cada temporada.',
      'Nos disculpamos por no haber brindado la experiencia que merecía en su visita de retorno. La renovación continua de contenidos es nuestro compromiso.',
    ],
    ru: [
      'Искренне сожалеем, что этот визит не оправдал ваших предыдущих ожиданий. Мы постоянно внедряем новый сезонный контент для обновления впечатлений.',
      'Сожалеем, что повторный визит разочаровал. Через наши глобальные гастрольные выставки и сезонные обновления мы стремимся делать каждый визит новым.',
      'Сожалеем, что повторное посещение не оправдало ожиданий. Усиливаем план обновления контента для новых впечатлений каждый сезон.',
      'Приносим извинения за то, что не обеспечили заслуженный опыт при повторном посещении. Непрерывное обновление контента — наше обязательство.',
    ],
    ar: [
      'نعتذر بصدق لأن هذه الزيارة لم ترقَ إلى مستوى تجربتكم السابقة. نواصل استحداث محتوى موسمي جديد لضمان أن كل زيارة تحمل شيئاً جديداً.',
      'نأسف لخيبة أملكم في زيارتكم العائدة. من خلال معارضنا الجولية العالمية والتحديثات الموسمية، نسعى لجعل كل زيارة متجددة.',
      'نأسف لعدم تلبية توقعاتكم في الزيارة المتكررة. نعمل على تقوية جدول تحديث المحتوى لتقديم تجارب جديدة كل موسم.',
      'نعتذر عن عدم تقديم التجربة التي تستحقونها في زيارتكم العائدة. التجديد المستمر للمحتوى هو التزامنا.',
    ],
    hi: [
      'हमें ईमानदारी से खेद है कि यह यात्रा आपके पिछले अनुभव के अनुरूप नहीं थी। हम प्रत्येक यात्रा को नया बनाने के लिए निरंतर नई मौसमी सामग्री पेश कर रहे हैं।',
      'हमें खेद है कि आपकी वापसी यात्रा निराशाजनक रही। हमारी वैश्विक दौरे की प्रदर्शनियों और मौसमी अपडेट के माध्यम से, हम प्रत्येक यात्रा को नया बनाने का प्रयास करते हैं।',
      'हमें खेद है कि आपकी पुनर्यात्रा अपेक्षाओं पर खरी नहीं उतरी। हम प्रत्येक मौसम में नए अनुभव प्रदान करने के लिए अपनी सामग्री ताजगी योजना को मजबूत कर रहे हैं।',
      'आपकी वापसी यात्रा पर उचित अनुभव न प्रदान करने के लिए हम क्षमाप्रार्थी हैं। निरंतर सामग्री नवीनीकरण हमारी प्रतिबद्धता है।',
    ],
    tl: [
      'Taos-pusong humihingi kami ng paumanhin na ang pagbisitang ito ay hindi naabot ang inyong nakaraang karanasan. Patuloy kaming nagpapakilala ng bagong pana-panahong nilalaman upang matiyak na nag-aalok ang bawat pagbisita ng bagay na sariwa.',
      'Ipinagpaumanhin namin na nabigo ang inyong pagbabalik na pagbisita. Sa pamamagitan ng aming mga pandaigdigang touring na eksibisyon at pana-panahong update, nagsusumikap kaming gawing bago ang bawat pagbisita.',
      'Nagsisisi kami na hindi natugunan ng inyong muling pagbisita ang mga inaasahan. Pinapatibay namin ang aming iskedyul ng pag-refresh ng nilalaman upang makapaghatid ng bagong karanasan bawat season.',
      'Humihingi kami ng paumanhin para sa hindi pagbibigay ng karanasang nararapat sa inyo sa inyong pagbabalik na pagbisita. Ang patuloy na pag-renew ng nilalaman ay ang aming pangako.',
    ],
  },
  // ── 법적·보상·처벌 요구 — EMERGENCY 전용, 관리자 승인 필수 ─────────────────────────
  // 안전 규칙: 환불 약속 금지, 법적 책임 인정 금지, CCTV 검토 약속 금지, 처벌 약속 금지
  LEGAL_THREAT: {
    ko: [
      '말씀하신 사안을 경영진에 즉시 보고하였습니다. 담당자가 빠른 시일 내 직접 연락드리겠습니다.',
      '이 내용은 즉시 운영 책임자에게 전달되었습니다. 관련 담당자가 직접 연락드릴 것입니다.',
      '말씀하신 상황을 가장 먼저 검토하겠습니다. 전담 담당자가 빠르게 연락드리겠습니다.',
      '이 사안은 경영진에 즉시 에스컬레이션되었습니다. 빠른 시일 내에 연락드리겠습니다.',
    ],
    en: [
      'This matter has been escalated to our management team immediately. A dedicated representative will be in direct contact with you as soon as possible.',
      'We have forwarded your concern to our operations director for immediate attention. You will hear from us directly.',
      'Your situation has been flagged as a priority and escalated to management. Our team will reach out to you directly.',
      'We take this very seriously. Our management team has been notified and will contact you promptly.',
    ],
    ja: [
      'ご申告の内容を経営陣に即時報告いたしました。担当者より速やかにご連絡差し上げます。',
      '本件を運営責任者に直接お伝えしました。担当者より改めてご連絡いたします。',
      '優先案件として処理し、専任担当者より直接ご連絡申し上げます。',
      'この件は最優先で経営陣へ報告いたしました。ご連絡をお待ちください。',
    ],
    zh: [
      '您的情况已立即上报给管理团队，我们将尽快由专人直接与您联系。',
      '此事已直接转交给运营负责人，我们会尽快与您取得联系。',
      '您的情况已被列为优先事项，专属代表将直接联系您。',
      '我们非常重视此事，管理团队已收到通知并将尽快与您联系。',
    ],
    es: [
      'Este asunto ha sido escalado inmediatamente a nuestro equipo directivo. Un representante dedicado se comunicará directamente con usted a la mayor brevedad posible.',
      'Hemos informado de su situación a nuestro director de operaciones para atención inmediata. Recibirá noticias nuestras directamente.',
      'Su situación ha sido marcada como prioritaria y escalada a la dirección. Nuestro equipo se pondrá en contacto con usted directamente.',
      'Nos tomamos esto muy en serio. Nuestro equipo directivo ha sido notificado y se pondrá en contacto con usted con prontitud.',
    ],
    ru: [
      'Этот вопрос немедленно передан нашей управленческой команде. Специальный представитель свяжется с вами напрямую в кратчайшие сроки.',
      'Мы передали вашу ситуацию нашему директору по операциям для немедленного рассмотрения. Вы получите ответ от нас напрямую.',
      'Ваша ситуация отмечена как приоритетная и эскалирована руководству. Наша команда свяжется с вами напрямую.',
      'Мы относимся к этому очень серьёзно. Наша управленческая команда уведомлена и свяжется с вами незамедлительно.',
    ],
    ar: [
      'تم رفع هذه المسألة فوراً إلى فريق الإدارة لدينا. سيتواصل معكم مندوب مخصص مباشرةً في أقرب وقت ممكن.',
      'قمنا بإحالة وضعكم إلى مدير العمليات لدينا للاهتمام الفوري. ستتلقون ردنا مباشرة.',
      'تم تحديد وضعكم كأولوية ورفعه إلى الإدارة. سيتواصل فريقنا معكم مباشرة.',
      'نأخذ هذا الأمر بجدية بالغة. تم إخطار فريق الإدارة وسيتواصل معكم في أقرب وقت.',
    ],
    hi: [
      'इस मामले को तुरंत हमारी प्रबंधन टीम को एस्केलेट कर दिया गया है। एक समर्पित प्रतिनिधि जल्द से जल्द आपसे सीधे संपर्क करेगा।',
      'हमने आपकी स्थिति को तत्काल ध्यान के लिए हमारे संचालन निदेशक को अग्रेषित किया है। आप हमसे सीधे सुनेंगे।',
      'आपकी स्थिति को प्राथमिकता के रूप में चिह्नित किया गया है और प्रबंधन को एस्केलेट किया गया है। हमारी टीम आपसे सीधे संपर्क करेगी।',
      'हम इसे बहुत गंभीरता से लेते हैं। हमारी प्रबंधन टीम को सूचित किया गया है और वे जल्दी आपसे संपर्क करेंगे।',
    ],
    tl: [
      'Ang bagay na ito ay agad na na-escalate sa aming management team. Isang dedikadong kinatawan ay direktang makikipag-ugnayan sa inyo sa lalong madaling panahon.',
      'Inilipat namin ang inyong sitwasyon sa aming direktor ng operasyon para sa agarang atensyon. Maririnig ninyo mula sa amin nang direkta.',
      'Ang inyong sitwasyon ay naka-flag bilang priyoridad at na-escalate sa pamamahala. Ang aming koponan ay direktang makikipag-ugnayan sa inyo.',
      'Sineseryoso namin ito nang husto. Ang aming management team ay naabisuhan at makikipag-ugnayan sa inyo agad.',
    ],
  },
  COMPENSATION_DEMAND: {
    ko: [
      '남겨주신 상황을 자세히 살펴볼 수 있도록 고객서비스팀이 따로 연락드리겠습니다.',
      '담당 팀이 말씀하신 상황을 확인한 뒤 직접 연락드리겠습니다.',
      '관련 담당자가 빠른 시일 안에 직접 연락드리겠습니다.',
      '말씀하신 상황을 확인하기 위해 고객서비스팀이 직접 연락드리겠습니다.',
    ],
    en: [
      'We are truly sorry for the experience you had. Our guest experience team will reach out to you directly to review your situation.',
      'We sincerely apologize for what you went through. A member of our team will contact you directly to discuss your case.',
      'Your experience falls short of our standards. Our team will be in touch with you directly to determine the best course of action.',
      'We are deeply sorry. Our customer service team will contact you individually to review your situation.',
    ],
    ja: [
      'ご不便をおかけし、誠に申し訳ございません。お客様の状況をご確認するため、担当スタッフより改めてご連絡申し上げます。',
      'この度のご経験を深くお詫び申し上げます。担当者よりお客様の状況を確認の上、ご連絡いたします。',
      'ご期待に沿えなかったことを心よりお詫び申し上げます。担当チームより速やかにご連絡いたします。',
      'お客様のご状況を確認するため、担当チームが直接ご連絡いたします。',
    ],
    zh: [
      '对于您所遭遇的不便，我们深感抱歉。我们的宾客体验团队将直接与您联系，了解您的情况。',
      '我们为您的经历深感遗憾。专属团队成员将直接与您联系，审核您的情况。',
      '您的体验未达到我们的标准，我们深感抱歉。我们的团队将与您联系，探讨最佳处理方式。',
      '我们对此深感歉意，客服团队将单独与您联系，了解您的情况。',
    ],
    es: [
      'Lo sentimos profundamente por la experiencia que tuvo. Nuestro equipo de experiencia de huéspedes se pondrá en contacto directo con usted para revisar su situación.',
      'Le pedimos sinceras disculpas por lo que vivió. Un miembro de nuestro equipo se pondrá en contacto directo con usted para hablar de su caso.',
      'Su experiencia está por debajo de nuestros estándares. Nuestro equipo se comunicará con usted directamente para determinar el mejor camino a seguir.',
      'Lo sentimos profundamente. Nuestro equipo de atención al cliente se pondrá en contacto con usted individualmente para revisar su situación.',
    ],
    ru: [
      'Нам очень жаль о вашем опыте. Наша команда по работе с гостями свяжется с вами напрямую для изучения вашей ситуации.',
      'Искренне приносим извинения за то, что вы пережили. Наш сотрудник свяжется с вами напрямую для обсуждения вашего случая.',
      'Ваш опыт не соответствует нашим стандартам. Наша команда свяжется с вами напрямую для выработки оптимального решения.',
      'Нам очень жаль. Наша служба поддержки клиентов свяжется с вами индивидуально для рассмотрения вашей ситуации.',
    ],
    ar: [
      'نحن آسفون بصدق على التجربة التي مررتم بها. سيتواصل فريق تجربة الضيوف لدينا معكم مباشرة لمراجعة وضعكم.',
      'نعتذر بصدق عما مررتم به. أحد أعضاء فريقنا سيتصل بكم مباشرة لمناقشة حالتكم.',
      'تجربتكم لا ترقى إلى معاييرنا. سيتواصل فريقنا معكم مباشرة لتحديد أفضل مسار للعمل.',
      'نحن في غاية الأسف. سيتواصل فريق خدمة العملاء لدينا معكم بشكل فردي لمراجعة وضعكم.',
    ],
    hi: [
      'आपके द्वारा हुए अनुभव के लिए हम वास्तव में खेद व्यक्त करते हैं। हमारी अतिथि अनुभव टीम आपकी स्थिति की समीक्षा करने के लिए सीधे आपसे संपर्क करेगी।',
      'आपने जो अनुभव किया उसके लिए हम ईमानदारी से माफी चाहते हैं। हमारे टीम का एक सदस्य आपके मामले पर चर्चा करने के लिए सीधे आपसे संपर्क करेगा।',
      'आपका अनुभव हमारे मानकों से कम है। हमारी टीम आपसे सीधे सर्वोत्तम कार्रवाई निर्धारित करने के लिए संपर्क करेगी।',
      'हमें बहुत खेद है। हमारी ग्राहक सेवा टीम आपकी स्थिति की समीक्षा करने के लिए व्यक्तिगत रूप से आपसे संपर्क करेगी।',
    ],
    tl: [
      'Labis kaming nagsisisi sa karanasang inyong natanggap. Ang aming guest experience team ay direktang makikipag-ugnayan sa inyo upang suriin ang inyong sitwasyon.',
      'Taos-pusong humihingi kami ng paumanhin sa inyong naranasan. Isang miyembro ng aming koponan ay direktang makikipag-ugnayan sa inyo upang talakayin ang inyong kaso.',
      'Ang inyong karanasan ay hindi nakakatugon sa aming mga pamantayan. Ang aming koponan ay makikipag-ugnayan sa inyo nang direkta upang matukoy ang pinakamahusay na paraan ng pagkilos.',
      'Labis kaming nagsisisi. Ang aming koponan ng serbisyo sa customer ay makikipag-ugnayan sa inyo nang indibidwal upang suriin ang inyong sitwasyon.',
    ],
  },
  PUNISHMENT_DEMAND: {
    ko: [
      '말씀하신 상황을 운영 책임자에게 직접 전달하였으며, 재발 방지를 위해 내부적으로 검토하겠습니다.',
      '이번 건은 즉시 현장 운영팀에 공유되었습니다. 같은 상황이 반복되지 않도록 내부 조치를 취하겠습니다.',
      '말씀해 주신 경험을 팀 전체가 공유하고, 서비스 개선에 꼭 반영하겠습니다.',
      '말씀하신 내용을 즉시 운영팀에 전달하였습니다. 적절한 내부 검토와 개선 조치를 약속드립니다.',
    ],
    en: [
      'The situation you described has been forwarded directly to our operations director for internal review and appropriate action.',
      'Your feedback has been escalated to our on-site management immediately. We will take the necessary steps to prevent a recurrence.',
      'This situation has been shared with our team leadership for review. We are committed to taking appropriate internal action.',
      'The experience you described has been reported to our operations team and will be reviewed internally.',
    ],
    ja: [
      'ご指摘の内容を運営責任者に直接お伝えし、再発防止に向けて内部で対応いたします。',
      '本件は現場マネジメントチームに速やかに共有されました。再発防止のため適切な対応を取ってまいります。',
      'この件をチームリーダーシップに共有しました。適切な内部対応を行ってまいります。',
      'ご経験内容を運営チームに報告し、内部審査を実施いたします。',
    ],
    zh: [
      '您反映的情况已直接转达给运营负责人，我们将进行内部审查并采取相应措施。',
      '您的反馈已立即升级至现场管理团队，我们将采取必要的措施，防止此类情况再次发生。',
      '这一情况已与团队领导层共享，我们将采取适当的内部行动。',
      '您描述的经历已向运营团队报告，将进行内部审查。',
    ],
    es: [
      'La situación que describió ha sido remitida directamente a nuestro director de operaciones para revisión interna y las acciones apropiadas.',
      'Sus comentarios han sido escalados a nuestra dirección in situ de inmediato. Tomaremos las medidas necesarias para evitar que vuelva a ocurrir.',
      'Esta situación ha sido compartida con el liderazgo de nuestro equipo para su revisión. Nos comprometemos a tomar las medidas internas apropiadas.',
      'La experiencia que describió ha sido reportada a nuestro equipo de operaciones y será revisada internamente.',
    ],
    ru: [
      'Описанная вами ситуация передана напрямую нашему директору по операциям для внутреннего рассмотрения и принятия соответствующих мер.',
      'Ваши отзывы немедленно эскалированы нашему локальному менеджменту. Мы примем необходимые шаги для предотвращения повторения.',
      'Эта ситуация доведена до сведения руководства нашей команды для рассмотрения. Мы обязуемся принять надлежащие внутренние меры.',
      'Описанный вами опыт передан нашей операционной команде и будет рассмотрен внутренне.',
    ],
    ar: [
      'الوضع الذي وصفتموه تم إحالته مباشرة إلى مدير العمليات لمراجعة داخلية واتخاذ الإجراءات المناسبة.',
      'تم رفع ملاحظاتكم فوراً إلى إدارتنا الميدانية. سنتخذ الخطوات اللازمة لمنع التكرار.',
      'تمت مشاركة هذا الوضع مع قيادة الفريق للمراجعة. نلتزم باتخاذ الإجراءات الداخلية المناسبة.',
      'تجربتكم التي وصفتموها أُبلغت لفريق العمليات لدينا وستخضع للمراجعة الداخلية.',
    ],
    hi: [
      'आपने जो स्थिति वर्णित की है, उसे आंतरिक समीक्षा और उचित कार्रवाई के लिए सीधे हमारे संचालन निदेशक को अग्रेषित किया गया है।',
      'आपकी प्रतिक्रिया को हमारी साइट पर मौजूद प्रबंधन को तुरंत एस्केलेट किया गया है। हम पुनरावृत्ति को रोकने के लिए आवश्यक कदम उठाएंगे।',
      'इस स्थिति को समीक्षा के लिए हमारी टीम के नेतृत्व के साथ साझा किया गया है। हम उचित आंतरिक कार्रवाई करने के लिए प्रतिबद्ध हैं।',
      'आपने जो अनुभव वर्णित किया है, उसे हमारी संचालन टीम को रिपोर्ट किया गया है और आंतरिक रूप से समीक्षा की जाएगी।',
    ],
    tl: [
      'Ang sitwasyong inyong inilarawan ay direktang naipasa sa aming direktor ng operasyon para sa panloob na pagsusuri at naaangkop na aksyon.',
      'Ang inyong feedback ay agad na na-escalate sa aming on-site na pamamahala. Magsasagawa kami ng mga kinakailangang hakbang upang maiwasan ang paulit-ulit na pangyayari.',
      'Ibinabahagi ang sitwasyong ito sa pamumuno ng aming koponan para sa pagsusuri. Nakatuon kami sa pagsasagawa ng naaangkop na panloob na aksyon.',
      'Ang karanasang inyong inilarawan ay naiulat sa aming operations team at isasailalim sa panloob na pagsusuri.',
    ],
  },
  STAFF_COMPLAINT: {
    ko: [
      '직원 응대 부분은 CS 매니저가 내용을 확인하고 서비스 교육을 보완하겠습니다.',
      '직원 태도에 대한 솔직한 피드백 감사합니다. 서비스 교육을 다시 점검하고 보완해 같은 일이 없도록 하겠습니다.',
      '직원 응대에 대한 의견 감사합니다. 모든 직원이 더 친절하게 응대할 수 있도록 교육을 강화하겠습니다.',
      '고객 응대 품질에 대한 우려를 주셔서 감사합니다. 현장 CS 매니저가 즉각적인 개선 조치를 취하겠습니다.',
    ],
    en: [
      'That should not have happened. Our CS manager will speak directly with the team today.',
      'We are sorry your interaction with our staff fell short — this will be reviewed and addressed right away.',
      'Thank you for telling us. Staff conduct like this is not acceptable, and we will act on it.',
      'We hear you, and your experience has been flagged for our operations team to handle directly.',
    ],
    ja: [
      'スタッフの対応でご不快をおかけし、誠に申し訳ございません。CSマネージャーが直ちに内容を確認し、スタッフ教育の強化に取り組みます。',
      'スタッフの態度に関する率直なご意見をありがとうございます。接客研修を早急に見直し、再発防止に努めてまいります。',
      'スタッフの応対に関するご意見をありがとうございます。全スタッフが親切でプロフェッショナルなサービスを提供できるよう教育を強化します。',
      'ご不満をお知らせいただきありがとうございます。現場CSマネージャーが直ちに改善措置を講じます。',
    ],
    zh: [
      '对于员工服务态度给您带来的不快，我们深表歉意。我们的客服经理将立即调查此事并加强员工培训。',
      '感谢您对员工服务的坦诚反馈。我们将立即重新评估客服培训，防止类似情况再次发生。',
      '对于员工服务态度未达标准，我们深感抱歉。我们致力于确保所有员工提供友善专业的服务。',
      '感谢您提出这一问题。我们的现场客服经理将立即采取改进措施。',
    ],
    es: [
      'Eso no debería haber ocurrido. Nuestro gerente de atención al cliente hablará directamente con el equipo hoy.',
      'Lamentamos que su interacción con nuestro personal no estuviera a la altura — esto será revisado y atendido de inmediato.',
      'Gracias por informarnos. Una conducta del personal como esta no es aceptable y actuaremos al respecto.',
      'Le escuchamos, y su experiencia ha sido reportada a nuestro equipo de operaciones para que lo gestione directamente.',
    ],
    ru: [
      'Этого не должно было произойти. Наш менеджер по обслуживанию клиентов сегодня напрямую поговорит с командой.',
      'Сожалеем, что взаимодействие с нашим персоналом не соответствовало стандартам — это будет рассмотрено и устранено немедленно.',
      'Благодарим, что сообщили нам. Подобное поведение сотрудников недопустимо, и мы примем меры.',
      'Мы слышим вас, и ваш опыт был передан нашей операционной команде для непосредственного рассмотрения.',
    ],
    ar: [
      'لم يكان يجب أن يحدث هذا. مدير خدمة العملاء لدينا سيتحدث مباشرة مع الفريق اليوم.',
      'نأسف لأن تعاملكم مع موظفينا لم يكن في المستوى المطلوب — سيتم مراجعة هذا الأمر ومعالجته فوراً.',
      'شكراً لإخبارنا. هذا النوع من السلوك غير مقبول من جانب موظفينا، وسنتخذ الإجراءات اللازمة.',
      'نسمعكم، وقد أُبلغ فريق العمليات لدينا عن تجربتكم للتعامل معها مباشرة.',
    ],
    hi: [
      'ऐसा नहीं होना चाहिए था। हमारे सीएस मैनेजर आज सीधे टीम से बात करेंगे।',
      'हमें खेद है कि हमारे कर्मचारियों के साथ आपकी बातचीत मानकों पर खरी नहीं उतरी — इसकी तुरंत समीक्षा और समाधान किया जाएगा।',
      'हमें बताने के लिए धन्यवाद। कर्मचारियों का ऐसा व्यवहार स्वीकार्य नहीं है, और हम इस पर कार्रवाई करेंगे।',
      'हम आपको सुनते हैं, और आपके अनुभव को हमारी संचालन टीम को सीधे संभालने के लिए रिपोर्ट किया गया है।',
    ],
    tl: [
      'Hindi sana dapat nangyari ito. Ang aming CS manager ay direktang makikipag-usap sa koponan ngayon.',
      'Ipinagpaumanhin namin na ang inyong pakikipag-ugnayan sa aming staff ay hindi nakatupad sa pamantayan — ito ay susuriin at haharapin agad.',
      'Salamat sa pagpapaalam sa amin. Ang ganitong pag-uugali ng staff ay hindi katanggap-tanggap, at magsasagawa kami ng aksyon.',
      'Naririnig namin kayo, at ang inyong karanasan ay naiulat na sa aming operations team para harapin nang direkta.',
    ],
  },
  // ── 접근성(휠체어/유모차/고령자) — 민감 주제. 구체적·공감적 개선 약속. 보상/법적책임 없음.
  ACCESSIBILITY_COMPLAINT: {
    ko: [
      '접근성에 불편을 드려 죄송합니다. 경사로·엘리베이터 등 편의 환경을 점검해 개선하겠습니다.',
      '거동이 불편한 분들도 편안히 관람하실 수 있도록 동선과 편의 시설을 보완하겠습니다.',
      '모든 관람객이 편하게 이용하실 수 있도록 접근성 개선에 더욱 힘쓰겠습니다.',
    ],
    en: [
      "We're sorry the accessibility fell short. We'll review ramps, elevators, and step-free routes to do better.",
      "We'll improve our facilities so guests with mobility needs are better supported.",
      'We want every guest to visit comfortably and will keep improving accessibility.',
    ],
    ja: [
      'アクセス面でご不便をおかけし申し訳ございません。スロープやエレベーターなどの設備を点検し改善いたします。',
      'お身体の不自由な方も快適にご鑑賞いただけるよう、動線と設備を見直してまいります。',
      'すべてのお客様が快適にご利用いただけるよう、バリアフリー環境の改善に努めます。',
    ],
    zh: [
      '无障碍方面给您带来不便，我们深表歉意。我们将检查坡道、电梯等设施并改进。',
      '我们会完善动线与设施，让行动不便的来宾也能舒适观展。',
      '我们将持续改善无障碍环境，让每位来宾都能方便地参观。',
    ],
    es: [
      'Lamentamos que la accesibilidad no estuviera a la altura. Revisaremos rampas, ascensores y rutas sin escalones.',
      'Mejoraremos nuestras instalaciones para apoyar mejor a quienes tienen necesidades de movilidad.',
      'Queremos que todos disfruten cómodamente y seguiremos mejorando la accesibilidad.',
    ],
    ru: [
      'Сожалеем, что с доступностью были проблемы. Мы проверим пандусы, лифты и маршруты без ступеней.',
      'Мы улучшим инфраструктуру, чтобы гостям с ограниченной мобильностью было удобнее.',
      'Мы хотим, чтобы каждому было комфортно, и продолжим улучшать доступность.',
    ],
    ar: [
      'نأسف لأن إمكانية الوصول لم تكن مناسبة. سنراجع المنحدرات والمصاعد والمسارات الخالية من الدرج.',
      'سنحسّن مرافقنا لدعم الضيوف ذوي احتياجات الحركة بشكل أفضل.',
      'نريد أن يزور الجميع بأريحية، وسنواصل تحسين إمكانية الوصول.',
    ],
    hi: [
      'पहुँच में असुविधा के लिए खेद है। हम रैंप, लिफ्ट और बिना-सीढ़ी रास्तों की समीक्षा कर सुधार करेंगे।',
      'हम अपनी सुविधाओं को बेहतर बनाएँगे ताकि चलने-फिरने में कठिनाई वालों को बेहतर सहयोग मिले।',
      'हम चाहते हैं कि हर अतिथि आराम से आए, और पहुँच को बेहतर बनाते रहेंगे।',
    ],
    tl: [
      'Paumanhin na kulang ang accessibility. Susuriin namin ang mga ramp, elevator, at step-free na ruta.',
      'Pagbubutihin namin ang aming pasilidad para mas matulungan ang mga may mobility needs.',
      'Gusto naming komportableng makabisita ang lahat, at patuloy naming pagbubutihin ang accessibility.',
    ],
  },
  // ── 외국어/다국어 서비스 — 국제 관람객 대상. 다국어 안내 확대 약속.
  LANGUAGE_SERVICE_COMPLAINT: {
    ko: [
      '외국어 안내가 부족해 불편을 드려 죄송합니다. 다국어 안내와 표기를 점차 확대하겠습니다.',
      '언어 안내에 대한 의견 감사합니다. 외국어 안내·자막 보강을 검토하겠습니다.',
      '더 많은 관람객이 편히 즐기실 수 있도록 다국어 서비스를 강화하겠습니다.',
    ],
    en: [
      "We're sorry the language support was lacking. We'll expand multilingual signage and guidance.",
      "Thank you for the feedback — we'll review and improve foreign-language guidance and captions.",
      "We'll strengthen our multilingual service so more guests can enjoy the visit comfortably.",
    ],
    ja: [
      '多言語案内が不足しご不便をおかけしました。多言語の案内・表記を順次拡充してまいります。',
      'ご意見ありがとうございます。外国語案内や字幕の充実を検討いたします。',
      'より多くのお客様に快適にお楽しみいただけるよう、多言語サービスを強化します。',
    ],
    zh: [
      '外语指引不足，给您带来不便，深表歉意。我们将逐步扩充多语种指引与标识。',
      '感谢您的意见，我们会研究并完善外语讲解与字幕。',
      '我们将加强多语种服务，让更多来宾舒适地参观。',
    ],
    es: [
      'Lamentamos la falta de apoyo en idiomas. Ampliaremos la señalización y la guía multilingüe.',
      'Gracias por su comentario; revisaremos y mejoraremos la guía y los subtítulos en otros idiomas.',
      'Reforzaremos nuestro servicio multilingüe para que más visitantes disfruten cómodamente.',
    ],
    ru: [
      'Сожалеем о нехватке языковой поддержки. Мы расширим многоязычные указатели и сопровождение.',
      'Спасибо за отзыв — мы улучшим иноязычные пояснения и субтитры.',
      'Мы усилим многоязычный сервис, чтобы больше гостей чувствовали себя комфортно.',
    ],
    ar: [
      'نأسف لنقص الدعم اللغوي. سنوسّع اللافتات والإرشادات متعددة اللغات.',
      'شكراً لملاحظتكم — سنراجع ونحسّن الإرشاد والترجمة بلغات أجنبية.',
      'سنعزّز خدمتنا متعددة اللغات ليستمتع المزيد من الضيوف براحة.',
    ],
    hi: [
      'भाषा सहायता की कमी के लिए खेद है। हम बहुभाषी संकेत और मार्गदर्शन बढ़ाएँगे।',
      'आपकी प्रतिक्रिया के लिए धन्यवाद — हम विदेशी-भाषा मार्गदर्शन और सबटाइटल सुधारेंगे।',
      'हम बहुभाषी सेवा को मज़बूत करेंगे ताकि अधिक अतिथि आराम से आनंद ले सकें।',
    ],
    tl: [
      'Paumanhin sa kakulangan ng suporta sa wika. Palalawakin namin ang multilingual na signage at gabay.',
      'Salamat sa puna — susuriin at pagbubutihin namin ang gabay at subtitles sa ibang wika.',
      'Palalakasin namin ang multilingual na serbisyo para mas marami ang komportableng makapagbisita.',
    ],
  },
  // ── 일반 운영 불만 (구체 태그 미매칭 폴백) — 모든 불만이 최소한의 '개선 약속'을 갖도록 보장.
  운영불만: {
    ko: [
      '말씀하신 부분을 점검하고 더 나은 관람 환경을 만들겠습니다.',
      '운영을 다시 살펴 더 나은 경험을 만들겠습니다.',
      '주신 의견을 운영 개선에 꼭 반영하겠습니다.',
      '같은 불편이 반복되지 않도록 운영을 점검하겠습니다.',
    ],
    en: [
      'We will look into this and improve our on-site experience.',
      "We'll take a close look and work to do better.",
      'Your feedback will go straight into improving our operations.',
      "We'll review how we operate so this doesn't happen again.",
    ],
    ja: [
      'ご指摘の点を確認し、より良い観覧環境を整えてまいります。',
      'ご不便をおかけし申し訳ございません。運営を見直し改善いたします。',
      'いただいたご意見を運営改善に必ず活かしてまいります。',
      '同じご不便がないよう、運営を点検いたします。',
    ],
    zh: [
      '我们会核查相关问题，改进现场观展体验。',
      '给您带来不便，我们深表歉意，将重新审视并改进运营。',
      '您的意见将切实用于改进我们的运营。',
      '我们会检查运营流程，避免同样的情况再次发生。',
    ],
    es: [
      'Revisaremos esto y mejoraremos la experiencia en el lugar.',
      'Lamentamos las molestias y trabajaremos para mejorar.',
      'Su comentario servirá para mejorar nuestras operaciones.',
      'Revisaremos cómo operamos para que no vuelva a ocurrir.',
    ],
    ru: [
      'Мы проверим это и улучшим качество посещения.',
      'Приносим извинения за неудобства и будем работать лучше.',
      'Ваш отзыв поможет улучшить нашу работу.',
      'Мы пересмотрим организацию, чтобы это не повторилось.',
    ],
    ar: [
      'سنراجع هذا الأمر ونحسّن تجربة الزيارة في الموقع.',
      'نعتذر عن الإزعاج وسنعمل على التحسين.',
      'ستسهم ملاحظاتكم في تحسين عملنا.',
      'سنراجع طريقة عملنا حتى لا يتكرر ذلك.',
    ],
    hi: [
      'हम इसकी समीक्षा कर ऑन-साइट अनुभव बेहतर करेंगे।',
      'असुविधा के लिए खेद है; हम सुधार के लिए काम करेंगे।',
      'आपकी प्रतिक्रिया हमारे संचालन को बेहतर बनाएगी।',
      'हम अपनी प्रक्रिया की समीक्षा करेंगे ताकि यह दोबारा न हो।',
    ],
    tl: [
      'Susuriin namin ito at pagbubutihin ang karanasan sa lugar.',
      'Paumanhin sa abala; magsisikap kaming gumanda.',
      'Gagamitin ang inyong puna sa pagpapabuti ng operasyon.',
      'Susuriin namin ang aming proseso upang hindi maulit ito.',
    ],
  },
  // ── 저평점·모호한 부정 신호 (구체 불만 없음) 폴백 — 개선 의지 중심(사과는 인사 슬롯이 담당,
  //   여기서 또 사과하면 한 답변에 '죄송'이 2~3번 쌓여 부자연스럽다).
  저평점_부정신호: {
    ko: [
      '주신 의견 잘 새겨서 더 나은 경험으로 찾아뵙겠습니다.',
      '말씀하신 점, 더 좋아지도록 노력하겠습니다.',
      '소중한 의견 감사합니다. 깊이 새겨 개선하겠습니다.',
      '더 나은 모습으로 다시 찾아뵙겠습니다.',
    ],
    en: [
      "We'll take your feedback to heart and work to do better.",
      'Thank you for the honest feedback. We will keep improving.',
      "We're taking this seriously and will keep getting better.",
      'We will do better and hope to earn a better visit next time.',
    ],
    ja: [
      'ご期待に沿えず申し訳ございません。より良い体験でお応えします。',
      '残念な思いをさせて申し訳ございません。改善に努めます。',
      '貴重なご意見をありがとうございます。深く受け止め改善します。',
      'より良い姿で再びお迎えできるよう努めます。',
    ],
    zh: [
      '未达期待，深表歉意，我们将以更好的体验回报您。',
      '让您失望，我们很抱歉，会持续改进。',
      '感谢您的坦诚意见，我们会认真改进。',
      '我们会做得更好，期待下次为您带来更好的体验。',
    ],
    es: [
      'Lamentamos que no cumpliera sus expectativas; mejoraremos.',
      'Gracias por su sinceridad. Seguiremos mejorando.',
      'Sentimos decepcionarle y seguiremos mejorando.',
      'Lo haremos mejor y esperamos una mejor visita la próxima vez.',
    ],
    ru: [
      'Сожалеем, что не оправдали ожиданий, и станем лучше.',
      'Спасибо за честный отзыв. Мы продолжим улучшаться.',
      'Сожалеем, что разочаровали, и будем совершенствоваться.',
      'Мы станем лучше и надеемся на лучший визит в следующий раз.',
    ],
    ar: [
      'نأسف لعدم تلبية توقعاتكم، وسنعمل على التحسّن.',
      'شكراً لصراحتكم. سنواصل التحسين.',
      'نأسف لخيبة أملكم وسنواصل التطوّر.',
      'سنقدّم الأفضل ونأمل بزيارة أفضل في المرة القادمة.',
    ],
    hi: [
      'खेद है कि अपेक्षा पर खरे नहीं उतरे; हम बेहतर करेंगे।',
      'ईमानदार प्रतिक्रिया के लिए धन्यवाद। हम सुधार करते रहेंगे।',
      'निराश करने के लिए खेद है; हम बेहतर होते रहेंगे।',
      'हम बेहतर करेंगे और अगली बार बेहतर अनुभव की आशा करते हैं।',
    ],
    tl: [
      'Paumanhin na hindi naabot ang inaasahan; gaganda kami.',
      'Salamat sa tapat na puna. Patuloy kaming magpapabuti.',
      'Paumanhin sa pagkabigo; patuloy kaming gaganda.',
      'Gagawin naming mas mahusay at umaasa sa mas magandang bisita.',
    ],
  },
}

/** 불만 태그별 컨텍스트 피벗 문장 (Slot C — COMPLAINT/EMERGENCY dry-fallback 전용).
 *  tags 중 가장 구체적인 태그 1개를 선택하여 개선 약속 문장을 반환한다.
 *  해당하는 태그가 없으면 빈 문자열 반환. */
export function slotC_pivot(lang: Language, tags: string[], idx = 0): string {
  const PRIORITY = [
    // EMERGENCY 전용 (관리자 승인 필수) — 가장 높은 우선순위
    'LEGAL_THREAT', 'COMPENSATION_DEMAND', 'PUNISHMENT_DEMAND',
    // COMPLAINT 운영 불만 (우선순위 내림차순)
    'STAFF_COMPLAINT', 'SYSTEM_COMPLAINT', 'ACCESSIBILITY_COMPLAINT', 'LANGUAGE_SERVICE_COMPLAINT',
    'ROOM_SPECIFIC_COMPLAINT',
    'INTERACTIVE_COMPLAINT', 'VALUE_COMPLAINT', 'CROWD_COMPLAINT',
    'LAYOUT_COMPLAINT', 'DISPLAY_ISSUE', 'DURATION_COMPLAINT', 'REVISIT_COMPLAINT',
  ]
  const pick = (key: string) => {
    const byLang = SLOT_C_PIVOTS[key]
    const arr = byLang ? (byLang[lang] ?? byLang.en ?? []) : []
    return arr.length ? arr[idx % arr.length] : ''
  }
  // 1) 구체 태그 (가장 정확한 개선 약속)
  const tag = PRIORITY.find((t) => tags.includes(t))
  if (tag) return pick(tag)
  // 2) Auto-Promotion: 사람 승인된 신규 불만 토픽(에어컨/오디오가이드 등)의 9개 언어 인정 조각
  //    — 일반 폴백(운영불만/저평점)보다 우선해야 구체적인 약속이 묻히지 않음.
  for (const t of tags) {
    const line = promotedComplaintLine(t, lang, idx)
    if (line) return line
  }
  // 3) 일반 폴백 (가장 낮은 우선순위) — 구체 태그가 없어도 모든 불만에 개선 약속을 보장
  for (const g of ['운영불만', '저평점_부정신호']) {
    if (tags.includes(g)) return pick(g)
  }
  return ''
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot S — 감각 경험 반향 (빛/물/향/소리) — 라이트·미디어 아트 특화 (COMPLIMENT 전용)
//  governor가 sensoryFocus 신호 있을 때만 삽입. 9개 언어 × 2 variants.
//  미커버 언어는 '' 반환(governor가 스킵) → WRONG_SCRIPT 방어.
// ════════════════════════════════════════════════════════════════════════════════
const SENSORY_LINES: Record<string, Partial<Record<Language, string[]>>> = {
  '빛': {
    ko: ['빛이 만들어내는 공간을 깊이 느끼셨다니, 저희가 가장 바라던 경험을 하셨네요.', '빛으로 채워진 순간이 오래 기억에 남으시길 바랍니다.'],
    en: ['That you felt the spaces our light creates is exactly the experience we hope for.', 'We hope the moments filled with light stay with you for a long time.'],
    ja: ['光が織りなす空間を深く感じていただけたこと、私どもが最も願う体験です。', '光に満ちたひとときが長く心に残りますように。'],
    zh: ['您深切感受到光影营造的空间，这正是我们最期待的体验。', '愿这些光影交织的时刻长留您心中。'],
    es: ['Que sintiera los espacios que crea nuestra luz es justo la experiencia que buscamos.', 'Esperamos que esos momentos llenos de luz permanezcan con usted mucho tiempo.'],
    ru: ['То, что Вы прочувствовали пространства, созданные светом, — именно тот опыт, к которому мы стремимся.', 'Надеемся, что наполненные светом мгновения надолго останутся с Вами.'],
    ar: ['إحساسكم بالمساحات التي يصنعها الضوء هو تماماً التجربة التي نتمناها.', 'نأمل أن تبقى لحظات الضوء في ذاكرتكم طويلاً.'],
    hi: ['आपने हमारी रोशनी से बने स्थानों को गहराई से महसूस किया — यही वह अनुभव है जिसकी हम कामना करते हैं।', 'आशा है रोशनी से भरे ये पल लंबे समय तक आपके साथ रहेंगे।'],
    tl: ['Ang pakiramdam ninyo sa mga espasyong nilikha ng aming ilaw ang mismong karanasang hinahangad namin.', 'Sana manatili sa inyo nang matagal ang mga sandaling puno ng liwanag.'],
  },
  '물': {
    ko: ['물결과 파도가 주는 생생함에 빠져드셨다니 정말 기쁩니다.', '파도의 일렁임 속에서 시원한 휴식을 느끼셨길 바랍니다.'],
    en: ['We are so glad you were drawn into the vivid flow of water and waves.', 'We hope the rolling waves gave you a refreshing sense of calm.'],
    ja: ['波と水の生き生きとした動きに引き込まれていただけて、とても嬉しく思います。', '波の揺らぎの中で涼やかなひとときを感じていただけますように。'],
    zh: ['您沉浸在水波与海浪的生动之中，我们非常欣喜。', '愿波光荡漾间，您感受到清凉的放松。'],
    es: ['Nos alegra mucho que se dejara llevar por el flujo vívido del agua y las olas.', 'Esperamos que el vaivén de las olas le diera una refrescante sensación de calma.'],
    ru: ['Мы очень рады, что Вас захватило живое движение воды и волн.', 'Надеемся, что плеск волн подарил Вам освежающее спокойствие.'],
    ar: ['يسعدنا أنكم انجذبتم إلى تدفق الماء والأمواج النابض بالحياة.', 'نأمل أن تكون حركة الأمواج قد منحتكم إحساساً منعشاً بالهدوء.'],
    hi: ['आप पानी और लहरों के जीवंत प्रवाह में डूब गए — यह जानकर बहुत खुशी हुई।', 'आशा है लहरों के हिलोरों ने आपको ताज़गी भरा सुकून दिया होगा।'],
    tl: ['Natutuwa kami na napaakit kayo sa buhay na daloy ng tubig at mga alon.', 'Sana ang indayog ng mga alon ay nagbigay sa inyo ng nakakapreskong kapayapaan.'],
  },
  '향': {
    ko: ['공간마다 번지는 향까지 느껴 주셨다니, 섬세한 디테일을 알아봐 주셔서 감사합니다.', '은은한 향이 관람의 여운을 더했기를 바랍니다.'],
    en: ['That you noticed the scent drifting through each space means our subtle details reached you.', 'We hope the gentle fragrance deepened the lingering impression of your visit.'],
    ja: ['空間ごとに広がる香りまで感じていただけたこと、繊細なディテールに気づいてくださり感謝いたします。', 'ほのかな香りが、ご鑑賞の余韻をより一層深めていれば幸いです。'],
    zh: ['您连每个空间弥漫的香气都细细感受到了，感谢您留意到这些精致的细节。', '愿淡淡的香气为您的观展增添了悠长余韵。'],
    es: ['Que percibiera el aroma que flota en cada espacio significa que nuestros detalles sutiles le llegaron.', 'Esperamos que la fragancia delicada haya profundizado la impresión de su visita.'],
    ru: ['То, что Вы уловили аромат, плывущий по каждому залу, говорит о том, что наши тонкие детали Вас тронули.', 'Надеемся, что нежный аромат углубил послевкусие Вашего визита.'],
    ar: ['ملاحظتكم للعبير المنتشر في كل مساحة تعني أن تفاصيلنا الدقيقة قد وصلت إليكم.', 'نأمل أن يكون العبير اللطيف قد عمّق أثر زيارتكم.'],
    hi: ['आपने हर स्थान में फैली खुशबू को भी महसूस किया — हमारी सूक्ष्म बारीकियाँ आप तक पहुँचीं।', 'आशा है हल्की खुशबू ने आपकी यात्रा की छाप को और गहरा किया होगा।'],
    tl: ['Ang pagpansin ninyo sa halimuyak na kumakalat sa bawat espasyo ay nangangahulugang naabot kayo ng aming mga pinong detalye.', 'Sana ang banayad na halimuyak ay nagpalalim sa naiwang impresyon ng inyong pagbisita.'],
  },
  '소리': {
    ko: ['음악과 영상이 어우러진 순간에 빠져드셨다니 기뻤어요.', '선율이 공간의 분위기를 한층 더해 드렸기를 바랍니다.'],
    en: ['We are delighted you were immersed in the moments where music and visuals meet.', 'We hope the melodies deepened the wonder of each space.'],
    ja: ['音楽と映像が溶け合う瞬間に深く浸っていただけて、この上なく嬉しく思います。', '旋律が空間の感動をより一層高めていましたら幸いです。'],
    zh: ['您深深沉浸在音乐与影像交融的瞬间，我们倍感欣喜。', '愿旋律为每个空间的感动更添一分。'],
    es: ['Nos encanta que se sumergiera en los momentos donde la música y las imágenes se encuentran.', 'Esperamos que las melodías hayan profundizado el asombro de cada espacio.'],
    ru: ['Мы рады, что Вы погрузились в моменты, где встречаются музыка и образы.', 'Надеемся, что мелодии усилили восхищение каждым залом.'],
    ar: ['يسعدنا أنكم انغمستم في اللحظات التي تلتقي فيها الموسيقى بالصورة.', 'نأمل أن تكون الألحان قد عمّقت روعة كل مساحة.'],
    hi: ['आप संगीत और दृश्यों के मिलन के क्षणों में डूब गए — यह जानकर हमें बेहद खुशी है।', 'आशा है धुनों ने हर स्थान के विस्मय को और गहरा किया होगा।'],
    tl: ['Natutuwa kami na napalubog kayo sa mga sandaling nagtatagpo ang musika at mga visual.', 'Sana ang mga melodiya ay nagpalalim sa pagkamangha sa bawat espasyo.'],
  },
}
export function slotSensory(lang: Language, sensory: string, idx = 0): string {
  const byType = SENSORY_LINES[sensory]
  if (!byType) return ''
  const arr = byType[lang]
  if (!arr || !arr.length) return ''  // 미커버 언어 → 스킵 (WRONG_SCRIPT 방어)
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot M — 동반자 맞춤 본문 (가족/데이트/친구) — B/E의 contextMirror echo와 별개 본문
//  governor가 companionContext 신호 있고 contextMirror와 다를 때만 삽입.
// ════════════════════════════════════════════════════════════════════════════════
const COMPANION_LINES: Record<string, Partial<Record<Language, string[]>>> = {
  '가족': {
    ko: ['소중한 가족과 함께 좋은 시간을 보내셨다니 그 의미가 더욱 특별하게 느껴집니다.', '온 가족이 함께 즐기실 수 있었다니 저희에게도 큰 보람입니다.'],
    en: ['Sharing this time with your family makes it all the more meaningful to us.', 'Knowing the whole family could enjoy it together is a real joy for us.'],
    ja: ['大切なご家族と良い時間を過ごしていただけたこと、その意味をより一層特別に感じます。', 'ご家族みなさまで楽しんでいただけたこと、私どもにとって大きな喜びです。'],
    zh: ['您与珍贵的家人共度美好时光，这份意义对我们而言更加特别。', '一家人能一同享受，对我们来说是莫大的欣慰。'],
    es: ['Compartir este tiempo con su familia lo hace aún más significativo para nosotros.', 'Saber que toda la familia pudo disfrutarlo es una verdadera alegría para nosotros.'],
    ru: ['То, что Вы разделили это время с семьёй, делает его для нас ещё более значимым.', 'Знать, что вся семья смогла насладиться этим вместе, — настоящая радость для нас.'],
    ar: ['مشاركتكم هذا الوقت مع عائلتكم يجعله أكثر معنى بالنسبة لنا.', 'معرفة أن العائلة بأكملها استمتعت معاً تسعدنا حقاً.'],
    hi: ['अपने परिवार के साथ यह समय बिताना हमारे लिए इसे और भी सार्थक बना देता है।', 'यह जानकर कि पूरा परिवार साथ में इसका आनंद ले सका, हमारे लिए सच्ची खुशी है।'],
    tl: ['Ang pagbahagi ng panahong ito kasama ang inyong pamilya ay lalong nagpapahalaga nito para sa amin.', 'Ang malaman na nag-enjoy ang buong pamilya nang sama-sama ay tunay na kagalakan para sa amin.'],
  },
  '데이트': {
    ko: ['특별한 데이트에 저희 공간이 함께할 수 있어 기뻤어요.', '데이트 코스로 {branch_name}을 떠올려 주셔서 고맙습니다.'],
    en: ['It is an honor that {branch_name} could be part of your special date together.', 'We are so glad we could set the scene for your romantic time together.'],
    ja: ['お二人の特別なひとときに私どもの空間がご一緒できたこと、光栄に存じます。', '大切な方との思い出に{branch_name}が加わったこと、嬉しく思います。'],
    zh: ['两位的特别时光能有我们的空间相伴，深感荣幸。', '很高兴{branch_name}成为您与心爱之人回忆的一部分。'],
    es: ['Es un honor que nuestro espacio formara parte de su tiempo especial juntos.', 'Nos alegra que {branch_name} ocupara un lugar en el recuerdo que crearon.'],
    ru: ['Для нас честь, что наше пространство стало частью Вашего особенного времени вдвоём.', 'Мы рады, что {branch_name} занял место в созданном вами воспоминании.'],
    ar: ['من دواعي شرفنا أن يكون فضاؤنا جزءاً من وقتكما المميز معاً.', 'يسعدنا أن {branch_name} احتل مكاناً في الذكرى التي صنعتماها.'],
    hi: ['यह हमारे लिए सम्मान की बात है कि आपके खास पलों में हमारा स्थान साथ रहा।', 'हमें खुशी है कि {branch_name} आप दोनों की यादों का हिस्सा बना।'],
    tl: ['Karangalan namin na naging bahagi ang aming espasyo ng inyong espesyal na sandali.', 'Natutuwa kami na ang {branch_name} ay nakapwesto sa alaalang nilikha ninyong dalawa.'],
  },
  '친구': {
    ko: ['좋은 친구분들과 함께한 시간이 즐거우셨다니 저희도 덩달아 기쁩니다.', '친구분들과의 나들이에 {branch_name}을 떠올려 주셔서 감사합니다.'],
    en: ['We are happy the time with your friends was such an enjoyable one.', 'Thank you for thinking of {branch_name} for your day out with friends.'],
    ja: ['ご友人との時間を楽しんでいただけたこと、私どもも嬉しく思います。', 'ご友人とのお出かけに{branch_name}を思い浮かべてくださり、ありがとうございます。'],
    zh: ['您与好友共度的时光如此愉快，我们也倍感欢喜。', '感谢您与朋友出游时想到了{branch_name}。'],
    es: ['Nos alegra que el tiempo con sus amigos fuera tan agradable.', 'Gracias por pensar en {branch_name} para su salida con amigos.'],
    ru: ['Мы рады, что время с друзьями выдалось таким приятным.', 'Спасибо, что вспомнили о {branch_name} для прогулки с друзьями.'],
    ar: ['يسعدنا أن الوقت مع أصدقائكم كان ممتعاً إلى هذا الحد.', 'شكراً لتفكيركم في {branch_name} لنزهتكم مع الأصدقاء.'],
    hi: ['हमें खुशी है कि दोस्तों के साथ बिताया समय इतना सुखद रहा।', 'दोस्तों के साथ अपनी सैर के लिए {branch_name} को याद करने हेतु धन्यवाद।'],
    tl: ['Natutuwa kami na napakasaya ng oras na kasama ninyo ang inyong mga kaibigan.', 'Salamat sa pag-isip sa {branch_name} para sa inyong lakad kasama ang mga kaibigan.'],
  },
}
export function slotCompanion(lang: Language, companion: string, idx = 0): string {
  const byType = COMPANION_LINES[companion]
  if (!byType) return ''
  const arr = byType[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot R — 재방문 인정 (isRepeatVisitor && 긍정) — 단골 고객 인정 (기존 미활용 신호)
// ════════════════════════════════════════════════════════════════════════════════
const REPEAT_VISITOR_LINES: Partial<Record<Language, string[]>> = {
  ko: ['다시 찾아주신 것만으로도 저희에겐 큰 칭찬이에요. 정말 감사합니다.', '잊지 않고 또 방문해 주셔서 감사합니다. 그 마음이 큰 힘이 됩니다.'],
  en: ['Your returning visit is the highest compliment we could receive. Thank you sincerely.', 'Thank you for coming back to us — your continued affection means a great deal.'],
  ja: ['再びお越しいただいたことが、私どもにとって何よりの褒め言葉です。心より感謝いたします。', '忘れずにまた訪れてくださり、その変わらぬご愛顧に深く感謝申し上げます。'],
  zh: ['您再次到访，是对我们最高的赞美。衷心感谢。', '感谢您始终记得并再度光临，这份不变的喜爱令我们深深感激。'],
  es: ['Que vuelva a visitarnos es el mayor cumplido que podríamos recibir. Gracias de corazón.', 'Gracias por regresar — su afecto continuo significa muchísimo para nosotros.'],
  ru: ['Ваш повторный визит — высшая похвала для нас. Искренне благодарим.', 'Спасибо, что вернулись к нам, — Ваша неизменная привязанность очень много значит.'],
  ar: ['زيارتكم المتجددة هي أعظم إطراء يمكن أن نتلقاه. شكراً من القلب.', 'شكراً لعودتكم إلينا — ودّكم المستمر يعني لنا الكثير.'],
  hi: ['आपका दोबारा आना हमारे लिए सबसे बड़ी तारीफ है। हार्दिक धन्यवाद।', 'हमें फिर से याद रखकर आने के लिए धन्यवाद — आपका निरंतर स्नेह हमारे लिए बहुत मायने रखता है।'],
  tl: ['Ang muli ninyong pagbisita ang pinakamataas na papuri na matatanggap namin. Taos-pusong salamat.', 'Salamat sa pagbabalik ninyo sa amin — malaki ang kahulugan ng inyong patuloy na pagmamahal.'],
}
export function slotRepeatVisitor(lang: Language, idx = 0): string {
  const arr = REPEAT_VISITOR_LINES[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot P — 공감/검증 (COMPLAINT 전용) — 액션 피벗 전에 감정 인정. 보상·약속 절대 없음.
// ════════════════════════════════════════════════════════════════════════════════
const EMPATHY_LINES: Partial<Record<Language, string[]>> = {
  ko: ['기대하고 오셨을 텐데 아쉬우셨겠어요.', '시간 내어 와주셨는데 아쉬움이 남으셨다니 마음이 쓰입니다.'],
  en: ['We can only imagine how disappointing that must have felt.', 'We completely understand why that left you frustrated.'],
  ja: ['ご期待を抱いてお越しくださったのに、心残りのある体験となってしまい胸が痛みます。', '大切なお時間を割いてご来館いただいたのに、ご不便を感じさせてしまい誠に残念に思います。'],
  zh: ['您满怀期待而来，却留下了遗憾的体验，我们深感不安。', '您特意抽出宝贵时间前来，却让您感到不便，我们由衷感到抱歉。'],
  es: ['Vino a nosotros con expectativas, y nos pesa que la experiencia no estuviera a la altura.', 'Dedicó un tiempo valioso a visitarnos, y lamentamos sinceramente que le causara incomodidad.'],
  ru: ['Вы пришли к нам с надеждами, и нам тяжело осознавать, что впечатление не оправдалось.', 'Вы выделили драгоценное время на визит, и мы искренне сожалеем, что он принёс Вам неудобство.'],
  ar: ['أتيتم إلينا بتوقعات، ويؤلمنا أن التجربة لم تكن بالمستوى المنشود.', 'خصصتم وقتاً ثميناً للزيارة، ونأسف بصدق لأنها سببت لكم الإزعاج.'],
  hi: ['आप उम्मीदें लेकर हमारे पास आए, और हमें भारी लगता है कि अनुभव कम रहा।', 'आपने बहुमूल्य समय निकालकर आना चुना, और हमें सच में खेद है कि इससे आपको असुविधा हुई।'],
  tl: ['Pumunta kayo sa amin nang may inaasahan, at mabigat sa amin na hindi naabot ng karanasan ang inaasahan.', 'Naglaan kayo ng mahalagang oras upang bumisita, at taos-puso kaming humihingi ng paumanhin na nagdulot ito ng abala.'],
}
export function slotEmpathy(lang: Language, idx = 0): string {
  const arr = EMPATHY_LINES[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot Q — 재방문 안심 (COMPLAINT 전용) — 보상·환불·책임 인정 없는 개선 의지 표현.
// ════════════════════════════════════════════════════════════════════════════════
const REASSURANCE_LINES: Partial<Record<Language, string[]>> = {
  ko: ['다음 방문에서는 더 나은 모습으로 맞이할 수 있도록 정성을 다하겠습니다.', '오늘의 아쉬움이 다음에는 좋은 기억으로 바뀔 수 있도록 노력하겠습니다.'],
  en: ['On your next visit, we will do our utmost to welcome you with a better experience.', "We will work so that today's disappointment can become a good memory next time."],
  ja: ['次回のご来館では、より良い姿でお迎えできるよう真心を尽くしてまいります。', '本日の心残りが次は良い思い出に変わりますよう努めてまいります。'],
  zh: ['下次到访时，我们将竭尽诚意，以更好的面貌迎接您。', '我们会努力，让今日的遗憾在下次化作美好的回忆。'],
  es: ['En su próxima visita, haremos todo lo posible por recibirle con una mejor experiencia.', 'Trabajaremos para que la decepción de hoy pueda convertirse en un buen recuerdo la próxima vez.'],
  ru: ['В Ваш следующий визит мы приложим все усилия, чтобы встретить Вас лучшим опытом.', 'Мы будем работать, чтобы сегодняшнее разочарование в следующий раз стало добрым воспоминанием.'],
  ar: ['في زيارتكم القادمة، سنبذل قصارى جهدنا لاستقبالكم بتجربة أفضل.', 'سنعمل لكي يتحول إحباط اليوم إلى ذكرى طيبة في المرة القادمة.'],
  hi: ['आपकी अगली यात्रा में, हम आपको बेहतर अनुभव के साथ स्वागत करने का पूरा प्रयास करेंगे।', 'हम कोशिश करेंगे कि आज की निराशा अगली बार एक अच्छी याद में बदल सके।'],
  tl: ['Sa inyong susunod na pagbisita, gagawin namin ang aming makakaya upang salubungin kayo nang may mas mahusay na karanasan.', 'Pagsisikapan naming maging magandang alaala sa susunod ang pagkadismaya ngayon.'],
}
export function slotReassurance(lang: Language, idx = 0): string {
  const arr = REASSURANCE_LINES[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot H — 복합 의도 긍정 인정 (Hybrid Assembly 전용) — 불편 사과와 별개로 좋았던 점을 인정.
//  "그럼에도 좋게 봐주셔 감사" 톤. 환호('기쁩니다') 회피(COMPLAINT_TOO_CHEERFUL 방지), 보상·약속 0.
// ════════════════════════════════════════════════════════════════════════════════
const HYBRID_ACK_LINES: Partial<Record<Language, string[]>> = {
  ko: ['불편을 느끼신 점이 있었음에도 좋았던 부분을 함께 봐주셔서 진심으로 감사드립니다.', '아쉬운 점을 말씀해 주시면서도 좋은 점을 알아봐 주신 마음, 깊이 감사드립니다.'],
  en: ['Even with the inconvenience, thank you sincerely for recognizing what you enjoyed.', 'We truly appreciate that you noticed the good amid what fell short.'],
  ja: ['ご不便がありながらも、良かった点にも目を向けてくださり、心より感謝申し上げます。', '残念な点をお伝えいただきつつ、良い面も認めてくださったこと、深く感謝いたします。'],
  zh: ['尽管有不便之处，仍感谢您留意到令您满意的部分。', '您在指出不足的同时也肯定了优点，我们由衷感激。'],
  es: ['A pesar del inconveniente, le agradecemos sinceramente que reconociera lo que disfrutó.', 'Valoramos mucho que notara lo bueno en medio de lo que no estuvo a la altura.'],
  ru: ['Несмотря на неудобства, искренне благодарим за то, что отметили и приятные моменты.', 'Мы очень ценим, что вы разглядели хорошее наряду с тем, что не оправдало ожиданий.'],
  ar: ['رغم الإزعاج، نشكركم بصدق على ملاحظتكم لما استمتعتم به.', 'نقدّر كثيراً أنكم لاحظتم الجوانب الجيدة إلى جانب ما لم يكن في المستوى.'],
  hi: ['असुविधा के बावजूद, आपने जो अच्छा लगा उसे भी सराहा — इसके लिए हार्दिक धन्यवाद।', 'कमियों को बताते हुए भी आपने अच्छी बातों को पहचाना, इसकी हम गहराई से सराहना करते हैं।'],
  tl: ['Sa kabila ng abala, taos-puso kaming nagpapasalamat na napansin ninyo ang nagustuhan ninyo.', 'Pinahahalagahan namin na napansin ninyo ang maganda sa kabila ng mga kakulangan.'],
}
export function slotHybridAck(lang: Language, idx = 0): string {
  const arr = HYBRID_ACK_LINES[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot — 양가(AMBIGUOUS) 균형 인정. 혼합 감정(좋은 점 + 아쉬운 점) 리뷰에 한 줄로
//  양쪽을 함께 인정 + 개선 의지(자기완결). 보상·법적책임·CCTV·징계 약속 절대 없음.
//  3 variants × 9 languages. 미커버 언어는 '' → 호출부가 스킵.
// ════════════════════════════════════════════════════════════════════════════════
const AMBIGUOUS_ACK_LINES: Partial<Record<Language, string[]>> = {
  ko: [
    '좋게 봐주신 부분은 감사히, 아쉬우셨던 부분은 무겁게 새기며 더 나아지겠습니다.',
    '즐거우셨던 점과 부족했던 점 모두 솔직히 들려주셔서 감사합니다. 더 나은 모습으로 찾아뵙겠습니다.',
    '만족스러우셨던 부분은 지키고, 아쉬우셨던 부분은 꼭 개선하겠습니다.',
  ],
  en: [
    "We're grateful for what you enjoyed, and we've taken note of what we can improve.",
    'Thank you for sharing both the highs and the areas we can improve. We will do better.',
    "We'll hold on to what worked for you and keep refining the rest.",
  ],
  ja: [
    '良かった点は励みに、物足りなかった点は真摯に受け止め、さらに改善してまいります。',
    '楽しめた点も至らなかった点も率直にお聞かせくださり感謝します。より良い姿でお応えします。',
    'ご満足いただけた部分は守り、惜しいと感じられた部分は必ず改善いたします。',
  ],
  zh: [
    '令您满意的部分我们倍加珍惜，不足之处我们郑重铭记，会持续改进。',
    '感谢您坦诚分享满意与不足之处。我们会以更好的面貌回报您。',
    '我们会保持您认可的部分，并切实改善不足之处。',
  ],
  es: [
    'Agradecemos lo que disfrutó y tomamos muy en serio lo que falló — seguiremos mejorando.',
    'Gracias por compartir tanto lo bueno como lo que podemos mejorar. Lo haremos mejor.',
    'Mantendremos lo que le gustó y trabajaremos en lo que no.',
  ],
  ru: [
    'Мы благодарны за то, что вам понравилось, и серьёзно отнесёмся к тому, что не удалось, — будем становиться лучше.',
    'Спасибо, что поделились и хорошим, и тем, что можно улучшить. Мы станем лучше.',
    'Мы сохраним то, что вам понравилось, и поработаем над тем, что нет.',
  ],
  ar: [
    'نقدّر ما استمتعتم به ونأخذ ما لم يكن في المستوى على محمل الجد — وسنواصل التحسّن.',
    'شكراً لمشاركتكم الإيجابيات وما يمكن تحسينه. سنقدّم الأفضل.',
    'سنحافظ على ما نال إعجابكم ونعمل على ما لم يكن كذلك.',
  ],
  hi: [
    'जो अच्छा लगा उसके लिए आभारी हैं और जो कमी रही उसे गंभीरता से लेते हैं — हम बेहतर होते रहेंगे।',
    'अच्छाइयाँ और सुधार-योग्य बातें, दोनों साझा करने के लिए धन्यवाद। हम बेहतर करेंगे।',
    'जो आपको पसंद आया उसे बनाए रखेंगे और जो नहीं, उस पर काम करेंगे।',
  ],
  tl: [
    'Pinahahalagahan namin ang nagustuhan ninyo at isinasapuso ang mga kakulangan — patuloy kaming gaganda.',
    'Salamat sa pagbabahagi ng maganda at ng mapapabuti pa. Gagawin naming mas mahusay.',
    'Pananatilihin namin ang nagustuhan ninyo at pagbubutihin ang hindi.',
  ],
}
export function slotAmbiguousAck(lang: Language, idx = 0): string {
  const arr = AMBIGUOUS_ACK_LINES[lang]
  if (!arr || !arr.length) return ''
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  단문 저노력 불만 전용 — "Meh"/"별로"/"비싸요"/"Dreamy"(저별점 오타) 같은 1~2어절 리뷰에
//  무거운 사과문은 과하다. 사과 없이 가벼운 1문장(피드백 감사 + 개선 의지)으로 응대.
//  긴급/직원불만/이탈은 호출부에서 제외(제대로 된 사과 유지).
// ════════════════════════════════════════════════════════════════════════════════
const SHORT_COMPLAINT_BODY: Record<Language, string[]> = {
  ko: ['솔직한 의견 감사합니다. 더 좋아지도록 노력할게요.', '남겨주신 의견 잘 봤어요. 다음엔 더 나은 모습 보여드릴게요.', '들려주셔서 감사합니다. 더 좋은 경험 드릴 수 있게 준비할게요.'],
  en: ["thanks for the honest take — we'll keep making it better.", "appreciate you sharing. We'll keep working to do better.", "thanks for the feedback. We'll aim to do better next time."],
  ja: ['率直なご意見ありがとうございます。より良くなれるよう努めます。', 'お声を聞かせてくださり感謝します。次はもっと良い体験を。', 'ありがとうございます。改善してまいります。'],
  zh: ['感谢您的坦诚意见，我们会继续改进。', '谢谢分享，我们会努力做得更好。', '感谢反馈，下次争取做得更好。'],
  es: ['gracias por su sinceridad. Seguiremos mejorando.', 'gracias por compartir. Trabajaremos para mejorar.', 'gracias por el comentario. Lo haremos mejor.'],
  ru: ['спасибо за честный отзыв. Будем работать лучше.', 'спасибо, что поделились. Постараемся стать лучше.', 'благодарим за отзыв. В следующий раз сделаем лучше.'],
  ar: ['شكراً لصراحتكم. سنواصل التحسين.', 'شكراً لمشاركتكم. سنعمل على التحسّن.', 'شكراً لملاحظتكم. سنبذل جهداً أكبر في المرة القادمة.'],
  hi: ['ईमानदार राय के लिए धन्यवाद। हम बेहतर करते रहेंगे।', 'साझा करने के लिए शुक्रिया। हम सुधार करेंगे।', 'प्रतिक्रिया के लिए धन्यवाद। अगली बार बेहतर करेंगे।'],
  tl: ['salamat sa tapat na puna. Patuloy kaming magpapabuti.', 'salamat sa pagbabahagi. Sisikapin naming gumanda.', 'salamat sa feedback. Mas bubutihin namin sa susunod.'],
}
export function slotShortComplaint(lang: Language, name: string, idx = 0): string {
  const arr = SHORT_COMPLAINT_BODY[lang] ?? SHORT_COMPLAINT_BODY.en
  const body = arr[idx % arr.length]
  const nm = name.trim()
  if (!nm) return body.charAt(0).toUpperCase() + body.slice(1)
  const pre: Partial<Record<Language, string>> = { ko: `${nm}님, `, ja: `${nm}様、`, zh: `${nm}，`, ar: `${nm}، ` }
  return (pre[lang] ?? `${nm}, `) + body
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot D — 현장 운영 힌트 (피크타임/혼잡 시간대 방문 권유)
//  3 variants × 4 languages | {highlight_room}
// ════════════════════════════════════════════════════════════════════════════════
export function slotD_peak_hours(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      '다음 방문 시 평일 오전 또는 오후 이른 시간대를 이용하시면 더욱 여유롭게 관람하실 수 있습니다.',
      '보다 쾌적한 관람을 원하신다면 평일 오전 11시 이전이나 오후 2시 이후 방문을 권장드립니다.',
      '주말보다 평일, 특히 오전 시간대에는 {highlight_room} 등 주요 공간을 훨씬 여유롭게 감상하실 수 있습니다.',
    ],
    en: [
      'For a more relaxed visit, we recommend weekday mornings or early afternoons, when the gallery tends to be quieter.',
      'Visiting before 11 AM or after 2 PM on weekdays usually offers a more comfortable experience.',
      'Weekday mornings tend to be the quietest times, giving you more space to fully enjoy {highlight_room} and other installations.',
    ],
    ja: [
      '平日の午前・午後早い時間帯はゆったりとご観覧いただけます。次回お越しの際のご参考になれば幸いです。',
      '平日11時前または14時以降のご来館をお勧めいたします。より快適にご観覧いただけます。',
      '平日の午前中は比較的空いており、{highlight_room}などを落ち着いてご鑑賞いただけます。',
    ],
    zh: [
      '建议您下次选择工作日上午或午后较早时段前来，届时人流较少，观展体验更为舒适。',
      '工作日上午11点前或下午2点后参观，通常能享受更舒适的观展环境。',
      '工作日上午是参观的最佳时机，让您能更从容地欣赏{highlight_room}等精彩装置。',
    ],
    es: [
      'Para disfrutar de una visita más tranquila, le recomendamos los días laborables por la mañana o primeras horas de la tarde.',
      'Visitar antes de las 11 AM o después de las 2 PM en días laborables suele ofrecer una experiencia más cómoda.',
      'Las mañanas de entre semana son las más tranquilas, lo que le permitirá disfrutar de {highlight_room} y otras instalaciones con más calma.',
    ],
    ru: [
      'Для более спокойного посещения мы рекомендуем приходить в будние дни, утром или ранним вечером.',
      'Посещение до 11:00 или после 14:00 в будние дни обычно обеспечивает более комфортные условия.',
      'Будние утра — самое тихое время, когда можно в полной мере насладиться {highlight_room} и другими инсталляциями.',
    ],
    ar: [
      'لتجربة أكثر راحة، نوصيكم بزيارتنا في أيام الأسبوع صباحاً أو في ساعات ما بعد الظهر المبكرة.',
      'الزيارة قبل الساعة 11 صباحاً أو بعد الساعة 2 ظهراً في أيام الأسبوع توفر عادةً تجربة أكثر هدوءاً.',
      'الصباح الباكر في أيام الأسبوع هو الوقت الأهدأ، مما يتيح لكم الاستمتاع الكامل بـ{highlight_room} وسائر المعروضات.',
    ],
    hi: [
      'अधिक शांत और सुखद अनुभव के लिए हम सप्ताह के कार्यदिवसों में सुबह या दोपहर के प्रारंभिक समय में आने की सलाह देते हैं।',
      'सप्ताह के कार्यदिवसों में सुबह 11 बजे से पहले या दोपहर 2 बजे के बाद आना आमतौर पर अधिक आरामदायक होता है।',
      'कार्यदिवसों की सुबह सबसे शांत समय होता है, जब आप {highlight_room} और अन्य प्रदर्शनियों का भरपूर आनंद ले सकते हैं।',
    ],
    tl: [
      'Para sa mas marelaks na pagbisita, inirekomenda namin ang mga weekday na umaga o hapon.',
      'Ang pagbisita bago mag-11 AM o pagkatapos ng 2 PM sa mga weekday ay karaniwang nagbibigay ng mas komportableng karanasan.',
      'Ang mga weekday morning ang pinaka-tahimik na oras, na nagbibigay-daan sa inyong lubos na mag-enjoy sa {highlight_room} at iba pang mga eksibisyon.',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot E — 멀티지점 정체성 클로징 + 재방문 권유 (SAFE/COMPLIMENT)
//  8 KO + 4 EN/JA/ZH variants | {branch_name}
//  contextMirror: 리뷰 핵심 감성 키워드가 있을 경우 맞춤 클로징 우선 반환
// ════════════════════════════════════════════════════════════════════════════════
export function slotE_positive(lang: Language, idx = 0, contextMirror?: string | null): string {
  // ── 맥락 거울 클로징 (EN 전용: 힐링·데이트·생일) ───────────────────────────────
  if (contextMirror === '힐링' && lang === 'en') {
    const healClose = [
      'Whenever you need a moment to breathe and restore, {branch_name} will be here for you.',
      'We hope you carry that sense of calm with you. Come back whenever you need to recharge.',
      '{branch_name} is always here as a place of calm and renewal. See you again soon.',
      'A healing space is something we strive to be. Thank you for reminding us why that matters.',
    ]
    return healClose[idx % healClose.length]
  }
  if (contextMirror === '데이트' && lang === 'en') {
    const dateClose = [
      'We hope {branch_name} becomes your go-to spot for special evenings. See you next time.',
      'Whether it\'s a date night or any other occasion, {branch_name} will always be here for you.',
      'Special moments deserve the right setting. We look forward to being part of your next one.',
      'We love being part of evenings that matter. Come back and make another memory with us.',
    ]
    return dateClose[idx % dateClose.length]
  }
  if (contextMirror === '생일' && lang === 'en') {
    const birthdayClose = [
      'We are honored to have been part of a milestone. Come back and celebrate with us again someday.',
      'Birthdays and anniversaries deserve the best settings. We hope {branch_name} delivered — see you for the next one!',
      'Thank you for sharing your special occasion with us. {branch_name} will be here whenever there is something worth celebrating.',
      'Every celebration deserves a memorable backdrop. We hope we got it right — until next time!',
    ]
    return birthdayClose[idx % birthdayClose.length]
  }
  // ── 맥락 거울 클로징 (KO 전용): 리뷰 감성에 맞는 재방문 권유 ───────────────────────
  if (contextMirror && lang === 'ko') {
    // idx를 활용해 동일 contextMirror 카테고리도 여러 변형으로 순환 (DUPLICATE 방지)
    const closeVariants: Record<string, string[]> = {
      '생일': [
        '다음 특별한 날에도 {branch_name}에서 함께해 주세요. 기다리고 있겠습니다.',
        '또 기념할 날이 생기면 꼭 다시 찾아주세요.',
        '{branch_name}이 앞으로도 특별한 날의 추억 장소가 되기를 바랍니다.',
        '또 축하할 일 생기면 불러주세요. 기쁘게 준비할게요.',
      ],
      '힐링': [
        '{branch_name}가 언제나 힐링의 공간이 될 수 있도록 노력하겠습니다. 또 찾아주세요.',
        '힐링이 필요할 때 언제든지 {branch_name}을 찾아주세요. 늘 그 자리에 있겠습니다.',
        '힐링이 필요할 때 또 찾아주세요. 기다리고 있겠습니다.',
        '다음에도 {branch_name}에서 잠깐 숨 돌려가세요.',
      ],
      '몰입': [
        '더욱 깊은 몰입 경험으로 다시 뵐 수 있기를 기대합니다.',
        '다음에는 더 새로운 몰입으로 맞이하겠습니다. 또 와주세요.',
        '{branch_name}에서 다시 한번 깊이 빠져드시기를 바랍니다.',
      ],
      '데이트': [
        '다음 데이트도 {branch_name}에서 함께해요.',
        '데이트 장소로 또 찾아주세요. 기다리고 있겠습니다.',
        '{branch_name}에서 두 분의 다음 데이트도 기대하고 있겠습니다.',
      ],
      '가족': [
        '다음에도 소중한 가족과 함께 꼭 다시 찾아주세요.',
        '가족과 함께하는 특별한 순간을 {branch_name}이 더 많이 만들어 드리겠습니다.',
        '또 좋은 가족 시간 함께 만들어요. 언제든지 환영합니다.',
      ],
      '친구': [
        '다음에도 좋은 분들과 함께 찾아주세요.',
        '또 새로운 친구와도 함께 와주세요. 기다리겠습니다.',
        '{branch_name}에서 또 즐거운 시간 만들어가세요.',
      ],
      '사진': [
        '다음에도 좋은 사진 많이 남겨 가세요.',
        '더 예쁜 순간들이 기다리고 있습니다. 또 와주세요.',
        '{branch_name}에 새로운 공간이 생기면 꼭 다시 와주세요.',
      ],
      '감동': [
        '또 다른 감동으로 다시 뵐 수 있기를 기대합니다.',
        '그 감동이 오래 남기를 바랍니다. 다음에 또 찾아주세요.',
        '{branch_name}은 늘 새로운 감동으로 기다리겠습니다.',
      ],
      '분위기': [
        '언제든지 {branch_name}에서 또 만나요.',
        '{branch_name}의 분위기가 그리워질 때 다시 찾아주세요.',
        '언제 오셔도 좋은 분위기로 맞이하겠습니다.',
      ],
    }
    const variants = closeVariants[contextMirror]
    if (variants) return variants[idx % variants.length]
  }
  // ── 맥락 거울 클로징 (JA): 가족·생일·데이트·힐링 ─────────────────────────────────
  if (contextMirror && lang === 'ja') {
    const jaClose: Record<string, string[]> = {
      '가족': [
        'またご家族でぜひ遊びにいらしてください。皆様のご来館を心よりお待ちしております。',
        'お子様やご家族と一緒に、またいつでもお越しください。お待ちしております。',
        '次回もご家族揃ってのご来館を心よりお待ちしております。',
      ],
      '생일': [
        '次の記念日にもぜひ{branch_name}をご利用ください。',
        'また大切な日に{branch_name}でお祝いいただけると嬉しいです。',
      ],
      '데이트': [
        '次の素敵なデートにもぜひ{branch_name}にお越しください。',
        'またいつでもデートのひとときを{branch_name}でお楽しみください。',
      ],
      '힐링': [
        '心が疲れたときはいつでも{branch_name}にお越しください。いつでもお待ちしております。',
        'またいつでも{branch_name}で癒しのひとときをお過ごしください。',
      ],
    }
    const jaCloseV = jaClose[contextMirror]
    if (jaCloseV) return jaCloseV[idx % jaCloseV.length]
  }
  // ── 맥락 거울 클로징 (ZH): 가족·생일·데이트·힐링 ─────────────────────────────────
  if (contextMirror && lang === 'zh') {
    const zhClose: Record<string, string[]> = {
      '가족': [
        '期待您和家人再次光临，随时欢迎您的到来！',
        '希望下次还能和家人一起来，我们期待再次为您服务。',
        '欢迎您与家人再次来访，{branch_name}随时为您敞开大门。',
      ],
      '생일': [
        '下次有特别的纪念日，欢迎再次选择{branch_name}。',
        '期待下次的庆祝与您同在，随时欢迎光临！',
      ],
      '데이트': [
        '期待您下次约会再次光临{branch_name}。',
        '随时欢迎您们前来，{branch_name}将是您约会的最佳选择。',
      ],
      '힐링': [
        '每当需要放松心情，欢迎随时来{branch_name}。',
        '期待再次为您带来心灵的宁静与治愈。',
      ],
    }
    const zhCloseV = zhClose[contextMirror]
    if (zhCloseV) return zhCloseV[idx % zhCloseV.length]
  }

  const v: Record<Language, string[]> = {
    ko: [
      // 0: 재방문 기대 (담백)
      '다음에 또 좋은 경험 드릴 수 있게 준비하고 있을게요. 또 들러주세요.',
      // 1: 다음 방문 준비
      '다음에 오셔도 즐거운 시간 보내실 수 있도록 잘 준비하겠습니다.',
      // 2: 전시 약속 + 재방문 권유
      '앞으로 더 좋은 전시로 찾아뵙겠습니다. 또 들러주세요.',
      // 3: 재방문 기대
      '다시 찾아주시면 더 반갑게 맞이하겠습니다.',
      // 4: SHORT 재방문 권유 (캐주얼)
      '또 찾아주세요!',
      // 5: SHORT 만남 기대
      '언제든지 다시 {branch_name}에서 만나요.',
      // 6: SHORT 방문 기대
      '다음 방문도 기대하겠습니다.',
      // 7: SHORT 좋은 시간 기원
      '또 좋은 시간 함께 나눌 수 있기를 바랍니다.',
    ],
    en: [
      // 0
      'We hope to see you again at {branch_name} soon.',
      // 1
      "Come back anytime — we'd love to welcome you again.",
      // 2
      'Until next time at {branch_name}! We hope it stays with you.',
      // 3
      "We're glad this visit meant something. See you at {branch_name} again.",
      // 4
      '{branch_name} will be here whenever you need it. Come back soon.',
      // 5
      'Thank you for being part of what makes {branch_name} worth visiting. See you again!',
      // 6
      'Your visit means a lot to everyone here. Come find us again soon.',
      // 7
      "We'll be here. Bring someone new next time — we'd love to show them around.",
    ],
    ja: [
      'これからも忘れられない感動をお届けできる{branch_name}であり続けます。またお会いできる日を心よりお待ちしております。',
      'またのご来館を心よりお待ちしております。次回も{branch_name}で素晴らしいひとときをお過ごしください。',
      '{branch_name}はこれからも皆様に感動をお届けできるよう努めてまいります。ぜひまたお越しください。',
      'またいつでもお気軽に{branch_name}にお越しください。皆様のご来館を心よりお待ちしております。',
    ],
    zh: [
      '我们将继续为您呈现难忘的感动，期待与您再次相见于{branch_name}。',
      '希望不久后能再次在{branch_name}与您相见，总有新的惊喜等待您来发现。',
      '{branch_name}将持续带来更精彩的展览，期待您下次光临。',
      '感谢您的到来，期待在{branch_name}与您再次相遇，共享美好时光。',
    ],
    es: [
      'Esperamos verle de nuevo pronto en {branch_name}. ¡Hasta la próxima!',
      'En {branch_name} siempre hay algo nuevo por descubrir. ¡Le esperamos!',
      'Nos alegra contar con visitantes como usted. ¡Vuelva cuando quiera a {branch_name}!',
      'Gracias por visitarnos. Esperamos que su próxima visita a {branch_name} sea igual de especial.',
    ],
    ru: [
      'Будем рады снова видеть вас в {branch_name} в ближайшее время!',
      'В {branch_name} всегда есть что-то новое для открытия — ждём вас снова!',
      'Спасибо за визит. Мы надеемся, что ваш следующий приход в {branch_name} подарит ещё больше впечатлений.',
      'Приходите снова в {branch_name} — мы всегда рады принять вас!',
    ],
    ar: [
      'نتطلع إلى استقبالكم مجدداً في {branch_name} في أقرب وقت ممكن!',
      'في {branch_name} دائماً ما هو جديد ينتظر اكتشافه — نراكم قريباً!',
      'شكراً على زيارتكم. نأمل أن تكون زيارتكم القادمة لـ{branch_name} أكثر متعةً.',
      'يسعدنا دائماً استقبالكم في {branch_name} — نراكم في المرة القادمة!',
    ],
    hi: [
      'हम आशा करते हैं कि आप जल्द ही {branch_name} में फिर पधारेंगे!',
      '{branch_name} में हमेशा कुछ नया इंतजार करता है — आपका स्वागत है!',
      'आपकी यात्रा के लिए धन्यवाद। हम आशा करते हैं कि {branch_name} में आपकी अगली यात्रा और भी खास होगी।',
      '{branch_name} में हम हमेशा आपका स्वागत करते हैं — जल्द फिर आइए!',
    ],
    tl: [
      'Inaasahan naming makita kayo muli sa {branch_name} sa lalong madaling panahon!',
      'Lagi kaming may bago sa {branch_name} para sa inyo — inaabangan namin kayo!',
      'Salamat sa pagbisita. Umaasa kami na ang inyong susunod na pagbisita sa {branch_name} ay magiging mas espesyal.',
      'Lagi kaming naghihintay sa inyo sa {branch_name} — bumalik kayo anumang oras!',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot E — 불만 응대 최소 클로징 (COMPLAINT/EMERGENCY)
//  8 KO + 4 EN/JA/ZH variants | {branch_name}
// ════════════════════════════════════════════════════════════════════════════════
export function slotE_negative(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      // 0: 직접 약속
      '더 잘하겠습니다. 솔직하게 말씀해 주셔서 감사합니다.',
      // 1: 재방문 기대 (사과는 인사/피벗 슬롯이 담당 — 클로징은 비-사과 약속으로 중복 방지)
      '다음에는 더 만족스러운 시간이 되도록 최선을 다하겠습니다.',
      // 2: 발전 감사
      '말씀해 주신 덕분에 저희가 더 나아질 수 있습니다. 감사합니다.',
      // 3: 행동 약속
      '이 경험을 발판 삼아 반드시 개선하겠습니다.',
      // 4: SHORT 다음 기대
      '다음 방문에서는 더 좋은 경험 드리겠습니다.',
      // 5: SHORT 직접
      '말씀 잊지 않겠습니다. 바로 반영하겠습니다.',
      // 6: 개선 후 재방문 기대
      '개선된 {branch_name}에서 다시 뵐 수 있기를 바랍니다.',
      // 7: 책임 + 약속
      '이런 상황이 다시는 없도록 저희가 직접 챙기겠습니다.',
    ],
    en: [
      // 0: direct + action-forward
      "We'll do better — thank you for taking the time to let us know.",
      // 1: next-visit focused
      'We hope to have the chance to give you a much better experience next time.',
      // 2: specific improvement promise
      "We'll share this with our team so we can improve.",
      // 3: candid and warm
      'Honest feedback like yours is exactly how we get better. Thank you.',
      // 4: accountability-first
      "This isn't the standard we hold ourselves to, and we appreciate you telling us.",
      // 5: concise / action
      'We hear you — changes are being made.',
      // 6: forward-looking close (사과는 인사 슬롯이 담당 — 여기서 또 사과하지 않는다)
      "We're committed to making your next visit a better one.",
      // 7: gratitude + intent
      'Thank you for giving us the feedback we needed. We will act on it.',
    ],
    ja: [
      '貴重なご意見に感謝申し上げます。より良いサービスの提供に努めてまいります。',
      '再度、ご不便をおかけしたことをお詫び申し上げます。次回はより満足いただける体験をお届けします。',
      'ご意見のおかげで私どもがより成長できます。ありがとうございます。',
      '{branch_name}をより良い場所にするための貴重なご意見に感謝申し上げます。',
    ],
    zh: [
      '感谢您的宝贵反馈，我们致力于不断改善。',
      '再次为给您带来的不便致歉，期待下次为您提供更好的体验。',
      '感谢您的反馈，这有助于我们持续进步。',
      '感谢您的坦诚意见，这将帮助我们让{branch_name}变得更好。',
    ],
    es: [
      'Gracias por su sincero comentario. Lo usaremos para mejorar continuamente.',
      'Lamentamos el inconveniente y esperamos tener la oportunidad de brindarle una experiencia mejor en su próxima visita.',
      'Su experiencia nos ayuda a crecer. Gracias por tomarse el tiempo de contarnos.',
      'Gracias por su honestidad. Haremos todo lo posible para que {branch_name} esté a la altura de sus expectativas.',
    ],
    ru: [
      'Мы приложим все усилия, чтобы стать лучше. Спасибо, что поделились с нами.',
      'Ещё раз приносим извинения за неудобства и надеемся предложить вам более приятный опыт в следующий раз.',
      'Ваш отзыв помогает нам совершенствоваться. Спасибо, что нашли время поделиться им.',
      'Спасибо за откровенность. Ваши слова помогут нам сделать {branch_name} лучше.',
    ],
    ar: [
      'نشكركم على ملاحظاتكم الصريحة. سنسعى للتحسين المستمر بناءً عليها.',
      'نعتذر مجدداً عن الإزعاج ونأمل أن تمنحونا فرصة تقديم تجربة أفضل في زيارتكم القادمة.',
      'ملاحظاتكم تساعدنا على النمو. شكراً لأخذكم الوقت لمشاركتها معنا.',
      'نشكركم على صراحتكم. ستساعدنا كلماتكم في تحسين {branch_name} لتكون في مستوى توقعاتكم.',
    ],
    hi: [
      'आपकी ईमानदार प्रतिक्रिया के लिए धन्यवाद। हम इसे लेकर लगातार सुधार करने का प्रयास करेंगे।',
      'असुविधा के लिए पुनः क्षमाप्रार्थी हैं। हम आशा करते हैं कि अगली बार आपको बेहतर अनुभव मिलेगा।',
      'आपकी प्रतिक्रिया हमें बेहतर बनाने में मदद करती है। समय निकालकर बताने के लिए धन्यवाद।',
      'आपकी ईमानदारी के लिए आभारी हैं। आपके शब्द {branch_name} को बेहतर बनाने में सहायक होंगे।',
    ],
    tl: [
      'Salamat sa inyong tapat na feedback. Gagamitin namin ito para mapabuti ang aming serbisyo.',
      'Humihingi kami ng paumanhin sa abala at umaasa kaming magbigay sa inyo ng mas magandang karanasan sa susunod.',
      'Ang inyong karanasan ay tumutulong sa amin na lumago. Salamat sa paglaan ng inyong oras para ibahagi ito.',
      'Salamat sa inyong katapatan. Ang inyong mga salita ay makakatulong sa amin na mapabuti ang {branch_name}.',
    ],
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Legacy aliases — backward compatibility for any code that still imports the
//  old function names directly (only replyTemplates.ts was the sole importer
//  and is being rewritten, but aliases keep the API surface stable).
// ════════════════════════════════════════════════════════════════════════════════

/** @deprecated Use slotA_greeting */
export function greetingBlock(lang: Language, name: string, official: string, idx = 0): string {
  return slotA_greeting(lang, name, idx).replace(/\{branch_name\}/g, official)
}
/** @deprecated Use slotA_apology */
export function dryApologyBlock(lang: Language, name: string, official: string, idx = 0): string {
  // Legacy shim: compose Slot A apology + Slot B acknowledgment for backward compat
  const a = slotA_apology(lang, name, idx).replace(/\{branch_name\}/g, official)
  const b = slotB_acknowledgment(lang, idx)
  return [a, b].join(' ')
}
/** @deprecated Use slotB_appreciation */
export const thanksBlock = slotB_appreciation
/** @deprecated Use slotC_artwork */
export const eternalNatureBlock = slotC_artwork
/** @deprecated Use slotE_positive */
export function closingBlock(lang: Language, official: string, idx = 0): string {
  return slotE_positive(lang, idx).replace(/\{branch_name\}/g, official)
}
/** @deprecated Use slotC_pivot */
export function slotBComplaintPivot(lang: Language, tags: string[], idx = 0): string {
  return slotC_pivot(lang, tags, idx)
    .replace(/\{highlight_room\}/g, 'this area')
}
/** @deprecated Use slotD_peak_hours */
export function peakHoursHint(lang: Language): string {
  return slotD_peak_hours(lang, 0).replace(/\{highlight_room\}/g, 'this area')
}

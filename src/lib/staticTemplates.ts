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

// ════════════════════════════════════════════════════════════════════════════════
//  Slot A — 지점별 맞춤 첫인사 (SAFE/COMPLIMENT)
//  4 variants × 4 languages | {branch_name}, {landmark}
// ════════════════════════════════════════════════════════════════════════════════
export function slotA_greeting(lang: Language, name: string, idx = 0): string {
  const nm = name.trim()
  const v: Record<Language, string[]> = {
    ko: [
      `안녕하세요${nm ? `, ${nm}님` : ''}. {branch_name}를 방문해 주셔서 진심으로 감사드립니다.`,
      `{branch_name}에 소중한 발걸음을 해주신${nm ? ` ${nm}님께` : ''} 진심으로 감사드립니다. {landmark}에 자리한 저희 전시관을 찾아주셔서 더욱 기쁩니다.`,
      `안녕하세요${nm ? `, ${nm}님` : ''}. 소중한 시간을 내어 {branch_name}를 선택해 주셔서 깊이 감사드립니다.`,
      `${nm ? `${nm}님, ` : ''}{landmark}에 위치한 {branch_name}를 방문해 주셔서 진심으로 환영하며 감사드립니다.`,
    ],
    en: [
      `Dear ${nm || 'valued guest'}, thank you so much for visiting {branch_name}.`,
      `Thank you for making {branch_name} near {landmark} part of your experience${nm ? `, ${nm}` : ''}.`,
      `Hello${nm ? ` ${nm}` : ''}, we're truly grateful you chose to spend time with us at {branch_name}.`,
      `${nm ? `${nm}, t` : 'T'}hank you for choosing {branch_name} in {landmark}.`,
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
      `안녕하세요${nm ? `, ${nm}님` : ''}. {branch_name}를 이용하시면서 불편을 드린 점 진심으로 사과드립니다.`,
      `${nm ? `${nm}님, ` : ''}{branch_name}에서 불편한 경험을 하셨다니 진심으로 죄송합니다.`,
      `안녕하세요${nm ? `, ${nm}님` : ''}. 기대에 미치지 못하는 경험을 드린 점 깊이 유감스럽게 생각합니다.`,
      `${nm ? `${nm}님, ` : ''}소중한 말씀 주셔서 감사합니다. {branch_name}에서의 불편에 진심으로 사과드립니다.`,
    ],
    en: [
      `Dear ${nm || 'valued guest'}, we sincerely apologize for the inconvenience you experienced at {branch_name}.`,
      `${nm ? `Dear ${nm}, ` : ''}we are truly sorry to hear about your experience at {branch_name}.`,
      `Hello${nm ? ` ${nm}` : ''}, we apologize for falling short of your expectations at {branch_name}.`,
      `${nm ? `${nm}, t` : 'T'}hank you for sharing your experience at {branch_name}. We sincerely apologize for any inconvenience.`,
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
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot B — 따뜻한 감사 응답 (SAFE/COMPLIMENT) / 4 variants × 4 languages
// ════════════════════════════════════════════════════════════════════════════════
export function slotB_appreciation(lang: Language, idx = 0): string {
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

// ════════════════════════════════════════════════════════════════════════════════
//  Slot B — 사안 수용 · 즉각 검토 약속 (COMPLAINT/EMERGENCY) / 4 variants × 4 languages
// ════════════════════════════════════════════════════════════════════════════════
export function slotB_acknowledgment(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      '말씀해 주신 내용을 무겁게 받아들이며, 담당자가 신속히 확인하여 성심껏 안내드리겠습니다.',
      '소중한 피드백을 바탕으로 개선 방안을 신속히 검토하겠습니다. 같은 불편이 반복되지 않도록 최선을 다하겠습니다.',
      '담당자가 빠른 시간 내 내용을 검토하여 성실히 안내드리겠습니다.',
      '말씀해 주신 내용을 면밀히 검토하여 서비스 개선에 적극 반영하겠습니다.',
    ],
    en: [
      'We take your feedback seriously, and a member of our team will review it promptly and follow up with care.',
      'Your feedback has been noted. Our team will address your concerns right away to ensure this does not happen again.',
      'We value your honest feedback and will take immediate steps to improve the experience going forward.',
      'We will carefully review your feedback and ensure it is reflected in meaningful service improvements.',
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
  },
  VALUE_COMPLAINT: {
    ko: [
      '입장료에 비해 만족스럽지 않으셨다는 말씀을 무겁게 받아들이겠습니다. 콘텐츠 밀도와 전시 구성을 지속적으로 보강하겠습니다.',
      '가격 대비 기대에 미치지 못했다는 소중한 피드백 감사합니다. 더욱 알찬 전시와 다양한 콘텐츠로 보답하겠습니다.',
      '관람료 측면에서 아쉬움을 느끼셨다니 진심으로 유감스럽습니다. 콘텐츠 확충과 전시 퀄리티 향상에 최선을 다하겠습니다.',
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
  },
  CROWD_COMPLAINT: {
    ko: [
      '방문객이 많아 쾌적한 관람에 지장이 있으셨다니 진심으로 죄송합니다. 입장 인원 관리와 운영 방식을 지속적으로 개선하겠습니다.',
      '혼잡한 환경으로 불편을 드려 깊이 사과드립니다. 관람 환경 개선을 위해 입장 분산 및 공간 운영에 더욱 힘쓰겠습니다.',
      '많은 방문객으로 인해 충분한 감상이 어려우셨다니 유감입니다. 쾌적한 관람 환경 조성을 위해 최선을 다하겠습니다.',
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
  },
  LAYOUT_COMPLAINT: {
    ko: [
      '동선 안내가 불편하셨다는 점 깊이 유감스럽게 생각합니다. 안내 표지와 동선 시스템을 지속적으로 보완하겠습니다.',
      '관람 동선에 대한 소중한 피드백 감사합니다. 안내 표지판 개선과 직관적인 동선 구성을 위해 더욱 노력하겠습니다.',
      '동선이 복잡하게 느껴지셨다니 진심으로 사과드립니다. 직관적인 레이아웃 개선에 즉시 착수하겠습니다.',
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
  },
  DISPLAY_ISSUE: {
    ko: [
      '영상 및 디스플레이 품질에 불편을 경험하셨다니 진심으로 사과드립니다. 장비 점검과 유지 관리를 더욱 철저히 하겠습니다.',
      '디스플레이 관련 문제를 경험하셨다니 깊이 사과드립니다. 정기 점검 강화와 신속한 유지 보수를 통해 재발 방지에 최선을 다하겠습니다.',
      '시청각 품질에 대한 피드백 감사합니다. 담당 기술팀이 즉시 점검하겠습니다.',
      '디스플레이 오류로 관람에 불편을 드린 점 사과드립니다. 장비 모니터링을 강화하겠습니다.',
    ],
    en: [
      'We sincerely apologize for the display quality issues you encountered. We will ensure more rigorous equipment checks and maintenance.',
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
  },
  DURATION_COMPLAINT: {
    ko: [
      '관람 시간이 기대에 미치지 못하셨다는 말씀을 귀담아듣겠습니다. 콘텐츠 구성을 지속적으로 발전시키겠습니다.',
      '전시 규모나 소요 시간에 대한 아쉬움을 진심으로 받아들이겠습니다. 더욱 다양하고 풍부한 콘텐츠로 보답하겠습니다.',
      '관람 분량에 관한 솔직한 피드백 감사합니다. 콘텐츠 확장 계획을 지속적으로 추진하겠습니다.',
      '전시 볼륨에 대한 의견을 무겁게 받아들이고, 체험 콘텐츠를 단계적으로 확충하겠습니다.',
    ],
    en: [
      'We appreciate your honest feedback about the exhibition length. We are working to expand and enrich our content.',
      'Thank you for sharing your thoughts on the duration. Expanding our content offerings is a key commitment going forward.',
      'Thank you for your candid feedback on the content volume. We will continue pursuing our content expansion plan.',
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
  },
  SYSTEM_COMPLAINT: {
    ko: [
      '키오스크 및 시스템 오류로 불편을 드려 진심으로 사과드립니다. 담당 기술팀이 즉시 확인하여 조치하겠습니다.',
      '예약 및 입장 시스템에 오류가 발생했다니 진심으로 죄송합니다. 신속한 점검을 통해 재발 방지에 최선을 다하겠습니다.',
      '디지털 시스템 오류로 인한 불편에 깊이 사과드립니다. 기술팀이 즉각 해당 사안을 검토하겠습니다.',
      '키오스크 및 앱 오류로 관람 전 불편을 드린 점 진심으로 사과드립니다. 시스템 안정화에 최우선으로 임하겠습니다.',
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
  },
  REVISIT_COMPLAINT: {
    ko: [
      '재방문하셨음에도 지난번보다 아쉬운 경험을 드렸다니 진심으로 죄송합니다. 시즌별 신규 콘텐츠를 지속적으로 도입하여 매 방문이 새로운 경험이 되도록 노력하겠습니다.',
      '다시 찾아주신 소중한 고객님께 기대에 미치지 못하는 경험을 드린 점 깊이 사과드립니다. 글로벌 순회 전시 및 시즌별 업데이트를 통해 보답하겠습니다.',
      '재방문 시 이전과 다른 만족감을 드리지 못해 유감스럽습니다. 콘텐츠 리프레시 계획을 강화하여 매 시즌 새로운 경험을 선사하겠습니다.',
      '다시 방문해 주셨음에도 충분한 만족을 드리지 못한 점 진심으로 사과드립니다. 지속적인 콘텐츠 갱신과 시설 개선으로 보답하겠습니다.',
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
  },
  STAFF_COMPLAINT: {
    ko: [
      '직원 응대에 불편을 드린 점 진심으로 사과드립니다. CS 매니저가 즉시 해당 내용을 확인하고, 서비스 교육을 강화하겠습니다.',
      '직원 태도에 대한 솔직한 피드백 주셔서 감사합니다. 고객 서비스 교육을 즉각 재검토하고 강화하여 재발 방지에 최선을 다하겠습니다.',
      '직원 응대에 대한 소중한 의견 감사합니다. 모든 직원이 친절하고 전문적인 서비스를 제공할 수 있도록 교육을 강화하겠습니다.',
      '고객 응대 품질에 대한 우려를 주셔서 감사합니다. 현장 CS 매니저가 즉각적인 개선 조치를 취하겠습니다.',
    ],
    en: [
      'We sincerely apologize for the poor staff interaction you experienced. Our CS manager will immediately review this and reinforce staff training.',
      'Thank you for your candid feedback on our staff. We will immediately re-evaluate our customer service training to prevent a recurrence.',
      'We apologize for the staff attitude that fell short of our standards. We are committed to ensuring all staff provide friendly and professional service.',
      'Thank you for raising this concern. Our on-site CS manager will take immediate corrective action.',
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
  },
}

/** 불만 태그별 컨텍스트 피벗 문장 (Slot C — COMPLAINT/EMERGENCY dry-fallback 전용).
 *  tags 중 가장 구체적인 태그 1개를 선택하여 개선 약속 문장을 반환한다.
 *  해당하는 태그가 없으면 빈 문자열 반환. */
export function slotC_pivot(lang: Language, tags: string[], idx = 0): string {
  const PRIORITY = [
    'STAFF_COMPLAINT', 'SYSTEM_COMPLAINT', 'ROOM_SPECIFIC_COMPLAINT',
    'INTERACTIVE_COMPLAINT', 'VALUE_COMPLAINT', 'CROWD_COMPLAINT',
    'LAYOUT_COMPLAINT', 'DISPLAY_ISSUE', 'DURATION_COMPLAINT', 'REVISIT_COMPLAINT',
  ]
  const tag = PRIORITY.find((t) => tags.includes(t))
  if (!tag) return ''
  const byLang = SLOT_C_PIVOTS[tag]
  if (!byLang) return ''
  const arr = byLang[lang] ?? byLang.en ?? []
  if (!arr.length) return ''
  return arr[idx % arr.length]
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
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot E — 멀티지점 정체성 클로징 + 재방문 권유 (SAFE/COMPLIMENT)
//  4 variants × 4 languages | {branch_name}
// ════════════════════════════════════════════════════════════════════════════════
export function slotE_positive(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      '앞으로도 잊지 못할 감동을 선사하는 {branch_name}가 되겠습니다. 다시 만나뵐 그날을 기대하겠습니다.',
      '다음에도 {branch_name}에서 새로운 감동과 영감을 드릴 수 있도록 최선을 다하겠습니다.',
      '{branch_name}는 앞으로도 더욱 풍성한 전시로 보답하겠습니다. 언제든지 다시 방문해 주세요.',
      '소중한 방문에 다시 한번 감사드리며, {branch_name}에서 또 다른 특별한 순간을 함께하기를 기대합니다.',
    ],
    en: [
      'It would be our honor to welcome you back to {branch_name} for another unforgettable experience.',
      'We hope to see you again soon at {branch_name} — there is always something new to discover.',
      '{branch_name} looks forward to welcoming you back for an even more memorable visit.',
      "We'd love to have you back at {branch_name}. Until next time!",
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
  }
  const arr = v[lang] ?? v.ko
  return arr[idx % arr.length]
}

// ════════════════════════════════════════════════════════════════════════════════
//  Slot E — 불만 응대 최소 클로징 (COMPLAINT/EMERGENCY)
//  4 variants × 4 languages | {branch_name}
// ════════════════════════════════════════════════════════════════════════════════
export function slotE_negative(lang: Language, idx = 0): string {
  const v: Record<Language, string[]> = {
    ko: [
      '소중한 의견 감사드리며, 더 나은 서비스로 보답드리겠습니다.',
      '다시 한번 불편에 대해 사과드리며, 앞으로는 더 만족스러운 경험을 제공하겠습니다.',
      '말씀해 주신 덕분에 저희가 더 발전할 수 있습니다. 감사합니다.',
      '소중한 피드백에 감사드리며, 더 나은 {branch_name}가 될 수 있도록 노력하겠습니다.',
    ],
    en: [
      'Thank you for your valuable feedback. We are committed to doing better.',
      'We apologize once more for the inconvenience and look forward to providing a better experience next time.',
      'Your feedback helps us improve. Thank you for letting us know.',
      "Thank you for your candid input — it helps us make {branch_name} better for everyone.",
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

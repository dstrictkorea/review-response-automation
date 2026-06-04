/**
 * staticTemplates.ts — 4개국어 정적 STANDARD 답변 블록 (LLM 미사용)
 *
 * 안전(SAFE) 리뷰는 LLM 없이 이 정적 블록들을 조립하여 즉시 응답한다.
 * 한국어 조사 충돌 방지(받침 유무 → 을/를·이/가)를 내장한다.
 * 일본어는 조사 변형이 없어 고정 조사 템플릿을 사용한다.
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
  return false // 비한글 종료 → 받침 없음 취급(를/가/는)
}
/** 받침에 따라 한국어 조사 선택 */
function josa(word: string, withJong: string, withoutJong: string): string {
  return word + (hasJong(word) ? withJong : withoutJong)
}

// ── 인사말 (방문 감사 포함) ───────────────────────────────────────────────────────
export function greetingBlock(lang: Language, name: string, official: string): string {
  const nm = name.trim()
  switch (lang) {
    case 'en':
      return `Dear ${nm || 'valued guest'}, thank you so much for visiting ${official}.`
    case 'ja':
      return `${nm ? nm + '様、' : ''}この度は${official}にお越しいただき、誠にありがとうございます。`
    case 'zh':
      return `${nm ? nm + '，您好！' : '您好！'}衷心感谢您莅临${official}。`
    case 'ko':
    default:
      return `안녕하세요${nm ? `, ${nm}님` : ''}. ${josa(official, '을', '를')} 방문해 주셔서 진심으로 감사드립니다.`
  }
}

// ── 일반 긍정 감사 본문 ───────────────────────────────────────────────────────────
export function thanksBlock(lang: Language): string {
  switch (lang) {
    case 'en':
      return `Your kind words mean a great deal to our entire team. Thank you for spending your time with us.`
    case 'ja':
      return `頂いた温かいお言葉に、スタッフ一同大変励まされております。お時間を共にしていただき、ありがとうございます。`
    case 'zh':
      return `您温暖的评价让我们全体员工倍感鼓舞。感谢您与我们共度宝贵的时光。`
    case 'ko':
    default:
      return `남겨주신 따뜻한 후기를 읽으며 저희 또한 큰 힘을 얻었습니다. 소중한 시간을 함께해 주셔서 감사합니다.`
  }
}

// ── ETERNAL NATURE 작품 감상 블록 (SAFE + 작품중심일 때만 조립) ────────────────────
export function eternalNatureBlock(lang: Language, signature: string | null): string {
  switch (lang) {
    case 'en':
      return `We are especially delighted that our immersive media art — created under our philosophy of "ETERNAL NATURE"${signature ? `, particularly ${signature}` : ''} — resonated so deeply with you.`
    case 'ja':
      return `とりわけ「ETERNAL NATURE（永遠の自然）」をテーマにした没入型メディアアート${signature ? `、中でも代表作${signature}` : ''}に深く心を動かされたとのこと、大変嬉しく存じます。`
    case 'zh':
      return `尤其令我们欣喜的是，以"ETERNAL NATURE（永恒自然）"为主题的沉浸式媒体艺术${signature ? `，特别是代表作${signature}` : ''}，能让您深受触动。`
    case 'ko':
    default:
      return `특히 'ETERNAL NATURE(영원한 자연)'를 주제로 한 저희의 몰입형 미디어아트${signature ? `, 그중에서도 대표작 ${josa(signature, '을', '를')} 통해` : '를 통해'} 깊은 울림을 느끼셨다니 더없이 기쁩니다.`
  }
}

// ── 맺음말 ────────────────────────────────────────────────────────────────────────
export function closingBlock(lang: Language, official: string): string {
  switch (lang) {
    case 'en':
      return `It would be our honor to welcome you back to ${official} for another unforgettable experience.`
    case 'ja':
      return `これからも忘れられない感動をお届けできる${official}であり続けます。またお会いできる日を心よりお待ちしております。`
    case 'zh':
      return `我们将继续为您呈现难忘的感动，期待与您再次相见于${official}。`
    case 'ko':
    default:
      return `앞으로도 잊지 못할 영감과 감동을 선사하는 ${josa(official, '이', '가')} 되겠습니다. 다시 만나뵐 그날을 기대하겠습니다.`
  }
}

// ── 건조한 사과 홀딩 템플릿 (EMERGENCY/COMPLAINT 정적 폴백 — 찬양·보상 일절 없음) ──
export function dryApologyBlock(lang: Language, name: string, official: string): string {
  const nm = name.trim()
  switch (lang) {
    case 'en':
      return `Dear ${nm || 'valued guest'}, we sincerely apologize for the inconvenience you experienced at ${official}. We take your feedback seriously, and a member of our team will review it promptly and follow up with care. Thank you for letting us know.`
    case 'ja':
      return `${nm ? nm + '様、' : ''}この度は${official}にてご不便をおかけし、誠に申し訳ございません。頂いたご意見を重く受け止め、担当者が速やかに確認のうえ、誠心誠意ご案内いたします。貴重なご意見をありがとうございます。`
    case 'zh':
      return `${nm ? nm + '，您好。' : '您好。'}对于您在${official}遇到的不便，我们深表歉意。我们会认真对待您的反馈，由专员尽快核实并诚挚跟进。感谢您的宝贵意见。`
    case 'ko':
    default:
      return `안녕하세요${nm ? `, ${nm}님` : ''}. 먼저 ${official} 이용 중 불편을 드린 점 진심으로 사과드립니다. 말씀해 주신 내용을 무겁게 받아들이며, 담당자가 신속히 확인하여 성심껏 안내드리겠습니다. 소중한 의견 감사합니다.`
  }
}

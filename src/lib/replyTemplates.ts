/**
 * replyTemplates.ts — 정적 STANDARD 답변 조립 + PHASE 4 Kill-Switch
 *
 * 지점 내부 코드(AMDB 등) 노출을 차단하고 공식 지점명/시그니처 작품명으로 치환한다.
 * Kill-Switch: 불만/긴급 리뷰에는 작품 키워드가 있어도 ETERNAL NATURE 찬양을 결합하지 않는다.
 */

import type { Language } from '@/lib/i18n'
import { branchOfficialName, branchSignatureWork } from '@/lib/branches'
import {
  greetingBlock,
  thanksBlock,
  eternalNatureBlock,
  closingBlock,
  dryApologyBlock,
} from '@/lib/staticTemplates'
import { scanForbidden, type WaterfallResult } from '@/lib/waterfallRegexEngine'

export interface StaticReplyContext {
  branchCode: string
  language: Language
  reviewerName?: string | null
}

/**
 * buildStaticReply — 정적 STANDARD 답변 조립 (LLM 미사용).
 *
 * Kill-Switch(PHASE 4): isEmergency || isComplaint 이면 '작품/예쁘다/art/beautiful' 키워드가
 * 존재하더라도 ETERNAL NATURE 찬양 블록을 원천 차단하고 건조한 사과 홀딩 템플릿만 반환한다.
 */
export function buildStaticReply(result: WaterfallResult, ctx: StaticReplyContext): string {
  const lang = ctx.language
  const official = branchOfficialName(ctx.branchCode, lang)
  const name = (ctx.reviewerName ?? '').trim()

  // ── Kill-Switch: 불만/긴급 → 찬양 차단, 건조 사과만 ──────────────────────────────
  if (result.isEmergency || result.isComplaint) {
    return dryApologyBlock(lang, name, official)
  }

  // ── SAFE: 인사 + 감사 + (작품중심이면 ETERNAL NATURE) + 맺음말 ───────────────────
  const blocks: string[] = [greetingBlock(lang, name, official), thanksBlock(lang)]
  if (result.isArtworkFocused) {
    blocks.push(eternalNatureBlock(lang, branchSignatureWork(ctx.branchCode, lang)))
  }
  blocks.push(closingBlock(lang, official))
  return blocks.join('\n\n')
}

/** 정적 답변 안전성 보증 — 금칙어 미포함 확인(개발/런타임 가드). */
export function isStaticReplySafe(text: string): boolean {
  return scanForbidden(text).clean
}

/**
 * IntelligentOrchestrator — 리뷰 자동 AI 처리 파이프라인
 *
 * 처리 순서:
 *   1. 1차 키워드 필터 (filterService.scanText) — 즉각적, 동기
 *   2. AI 문맥 분석 (LLM) — 필터 결과를 프롬프트에 주입하여 정밀도 향상
 *   3. 위험도 병합 — 필터 결과 / AI 판단 / 평점 중 최고값 적용
 *   4. 라우팅 결정 — pending_approval (격리) vs ai_done (정상)
 *   5. DB 원자적 쓰기
 *   6. 활동 로그
 *
 * 격리 조건:
 *   - 1차 필터 트리거 (medium+)
 *   - AI risk_level 'medium' | 'high' | 'critical'
 *   - forbidden_check 플래그 any true
 *   - rating ≤ 3
 */

import OpenAI from 'openai'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanText } from '@/services/filterService'

// ── Provider URL map ──────────────────────────────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_TO_LEVEL = ['low', 'medium', 'high', 'critical'] as const

function floorRisk(...levels: Array<string | null | undefined>): string {
  const max = Math.max(...levels.map(l => RISK_RANK[l ?? 'low'] ?? 0))
  return RANK_TO_LEVEL[max]
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Reputation Manager for ARTE Museum.
Analyze the review and generate exactly 3 reply drafts as a valid JSON object.

DUAL AUDIENCE — every reply is PUBLIC:
  1. The reviewer — acknowledge their experience.
  2. Future visitors — show ARTE is professional and caring.

ABSOLUTE SAFETY RULES — NEVER VIOLATE:
1. Never promise refunds or monetary compensation.
2. Never admit legal liability or responsibility for injuries/accidents.
3. Never mention CCTV review or investigation.
4. Never promise staff punishment or disciplinary action.
5. Always reply in the SAME language as the review.
6. Vary the opening phrase — never start every reply identically.
7. Never reveal internal operational details.

RISK CLASSIFICATION GUIDE:
- low: Positive/neutral, no sensitive content
- medium: Minor complaints, requests for improvement
- high: Refund requests, safety concerns, staff complaints, 1-2★ with strong language
- critical: Injury/accident reports, legal threats, discrimination, media threats, police reports

If a PRE-FILTER ALERT section appears in the user message, it means a keyword filter already
detected risk expressions. Your risk_level must be at LEAST the pre-filter level.
Your isolation_reason must explicitly reference the detected expressions.

OUTPUT: Valid JSON only — no markdown wrapper, no prose outside JSON.
{
  "detected_language": "ko" | "en" | "zh" | "ja" | "...",
  "sentiment": "positive" | "neutral" | "mixed" | "negative",
  "risk_level": "low" | "medium" | "high" | "critical",
  "categories": ["string"],
  "risk_reasons": ["string"],
  "isolation_reason": "격리 사유 한국어 서술 (필터 적발 표현 + AI 판단 근거). 격리 불필요 시 빈 문자열.",
  "internal_note_ko": "담당자에게 전달할 내부 메모 (한국어)",
  "forbidden_check": {
    "refund_promise": false,
    "legal_admission": false,
    "cctv_mention": false,
    "staff_discipline": false
  },
  "draft_short": "1-2 sentence warm acknowledgment",
  "draft_standard": "2-4 sentences — addresses reviewer AND reassures future visitors",
  "draft_careful": "4-6 sentences — empathetic, thorough, one concrete improvement note"
}`

// ── Main class ─────────────────────────────────────────────────────────────────
export class IntelligentOrchestrator {
  /**
   * 단일 리뷰 처리: DB 조회 → 1차 필터 → AI → 위험도 병합 → DB 쓰기 → 로그
   */
  static async processReview(reviewId: string): Promise<void> {
    const admin = createAdminClient()

    // ── 1. 병렬 조회 ────────────────────────────────────────────────────────
    const [reviewRes, keywordsRes, templatesRes] = await Promise.all([
      admin.from('reviews').select('*').eq('id', reviewId).single(),
      admin.from('app_settings').select('value').eq('key', 'risk_keywords').maybeSingle(),
      admin.from('app_settings').select('value').eq('key', 'reply_templates').maybeSingle(),
    ])

    if (reviewRes.error || !reviewRes.data) {
      throw new Error(`[Orchestrator] Review not found: ${reviewId}`)
    }

    const review      = reviewRes.data
    const dbKeywords  = (keywordsRes.data?.value  as RiskKeyword[])   ?? []
    const dbTemplates = (templatesRes.data?.value as ReplyTemplate[]) ?? []

    const activeKeywords   = dbKeywords.filter(k => k.is_active)
    const matchedTemplates = dbTemplates.filter(t => t.language === review.review_language)

    // ── 2. 1차 키워드 필터 ──────────────────────────────────────────────────
    const filterResult = scanText(review.review_text ?? '', activeKeywords)

    // ── 3. AI 프로바이더 선택 ────────────────────────────────────────────────
    const groqKey   = process.env.GROQ_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const activeKey = groqKey ?? geminiKey ?? openaiKey

    if (!activeKey) {
      throw new Error('[Orchestrator] No AI API key configured (GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY)')
    }

    const baseURL = groqKey   ? PROVIDER_BASE_URLS.groq
                  : geminiKey ? PROVIDER_BASE_URLS.gemini
                  : undefined

    const model = groqKey   ? (process.env.GROQ_MODEL   ?? 'llama-3.3-70b-versatile')
                : geminiKey ? (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite')
                :             (process.env.OPENAI_MODEL ?? 'gpt-4o')

    // ── 4. 프롬프트 구성 (필터 결과 주입) ────────────────────────────────────
    const riskKeywordContext = activeKeywords.length > 0
      ? activeKeywords.map(k => `  - "${k.keyword}" (${k.language}, risk: ${k.risk_level})`).join('\n')
      : '  (none configured)'

    const templateContext = matchedTemplates.length > 0
      ? matchedTemplates.slice(0, 5).map(t => `  [${t.category}] ${t.name}: ${t.content.slice(0, 120)}`).join('\n')
      : '  (none for this language)'

    const preFilterNote = filterResult.triggered
      ? `\nPRE-FILTER ALERT — Keyword filter already detected risk expressions:\n` +
        filterResult.matches.map(m =>
          `  - keyword="${m.keyword}" riskLevel=${m.riskLevel} source=${m.source} context="${m.context}"`
        ).join('\n') +
        `\nMinimum risk_level required: ${filterResult.maxRiskLevel}. ` +
        `Your isolation_reason MUST explain each detected expression.\n`
      : ''

    const userMessage =
      `Branch: ${review.branch_code}\n` +
      `Channel: ${review.channel_code}\n` +
      `Rating: ${review.rating ?? 'N/A'} / 5\n` +
      `Reviewer: ${review.reviewer_name ?? 'Anonymous'}\n` +
      `${preFilterNote}\n` +
      `Review text:\n${review.review_text ?? '(no text provided)'}\n\n` +
      `CONTEXT:\n` +
      `- This reply will be posted PUBLICLY on ${review.channel_code}.\n` +
      `- Future visitors will read it when deciding whether to visit.\n\n` +
      `ACTIVE RISK KEYWORDS (from settings):\n${riskKeywordContext}\n\n` +
      `REPLY STYLE REFERENCE (language-matched templates):\n${templateContext}\n\n` +
      `Generate three reply drafts and classify the review. Return JSON only.`

    // ── 5. LLM 호출 ────────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: activeKey, baseURL })
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage    },
      ],
    })

    const rawText   = completion.choices[0].message.content ?? ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('[Orchestrator] LLM response contained no JSON object')

    const result = JSON.parse(jsonMatch[0]) as {
      detected_language: string
      sentiment: string
      risk_level: string
      categories: string[]
      risk_reasons: string[]
      isolation_reason: string
      internal_note_ko: string
      forbidden_check: {
        refund_promise: boolean
        legal_admission: boolean
        cctv_mention: boolean
        staff_discipline: boolean
      }
      draft_short: string
      draft_standard: string
      draft_careful: string
    }

    // ── 6. 위험도 병합 (필터 floor + AI + 평점) ───────────────────────────────
    const ratingFloor = review.rating != null && review.rating <= 2 ? 'high' : null
    const finalRisk   = floorRisk(
      result.risk_level,
      filterResult.triggered ? filterResult.maxRiskLevel : null,
      ratingFloor,
    )

    // ── 7. 격리 사유 통합 (internal_note_ko) ─────────────────────────────────
    const combinedNote = [
      filterResult.triggered ? filterResult.isolationSummary : null,
      result.isolation_reason || null,
      result.internal_note_ko || null,
    ].filter(Boolean).join('\n')

    // ── 8. risk_reasons 통합 ──────────────────────────────────────────────────
    const combinedRiskReasons = [
      ...filterResult.matchedKeywords.map(k => `[1차필터] ${k}`),
      ...(result.risk_reasons ?? []),
    ]

    // ── 9. 라우팅 결정 ────────────────────────────────────────────────────────
    const hasForbiddenFlag = Object.values(result.forbidden_check ?? {}).some(v => v === true)

    const needsSecondaryReview =
      filterResult.triggered ||
      (review.rating != null && review.rating <= 3) ||
      ['medium', 'high', 'critical'].includes(finalRisk) ||
      hasForbiddenFlag

    const finalStatus = needsSecondaryReview ? 'pending_approval' : 'ai_done'

    // ── 10. DB 원자적 쓰기 ────────────────────────────────────────────────────
    const { error: rpcErr } = await admin.rpc('update_review_and_save_drafts', {
      p_review_id:       reviewId,
      p_status:          finalStatus,
      p_risk_level:      finalRisk,
      p_sentiment:       result.sentiment,
      p_categories:      result.categories        ?? [],
      p_risk_reasons:    combinedRiskReasons,
      p_forbidden_check: result.forbidden_check   ?? {},
      p_draft_short:     result.draft_short,
      p_draft_standard:  result.draft_standard,
      p_draft_careful:   result.draft_careful,
      p_model_name:      model,
      p_prompt_version:  'io-v2',
    })

    if (rpcErr) throw new Error(`[Orchestrator] RPC failed: ${rpcErr.message}`)

    // internal_note_ko는 RPC에 포함되지 않으므로 별도 업데이트
    if (combinedNote) {
      await admin
        .from('reviews')
        .update({ internal_note_ko: combinedNote, updated_at: new Date().toISOString() })
        .eq('id', reviewId)
    }

    // ── 11. 활동 로그 ─────────────────────────────────────────────────────────
    await admin.from('activity_logs').insert({
      review_id:  reviewId,
      actor_name: 'system:orchestrator',
      action:     needsSecondaryReview ? 'review_isolated' : 'ai_draft_generated',
      detail: {
        model,
        risk_level:          finalRisk,
        status:              finalStatus,
        is_isolated:         needsSecondaryReview,
        filter_triggered:    filterResult.triggered,
        filter_keywords:     filterResult.matchedKeywords,
        has_forbidden:       hasForbiddenFlag,
      },
    })
  }

  /**
   * 배치 처리 — 제한된 동시성으로 복수 리뷰 처리
   */
  static async processBatch(reviewIds: string[], concurrency = 3): Promise<{
    processed: number
    failed: number
    errors: Array<{ id: string; message: string }>
  }> {
    let processed = 0
    let failed    = 0
    const errors: Array<{ id: string; message: string }> = []

    for (let i = 0; i < reviewIds.length; i += concurrency) {
      const batch   = reviewIds.slice(i, i + concurrency)
      const results = await Promise.allSettled(
        batch.map(id => IntelligentOrchestrator.processReview(id))
      )
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          processed++
        } else {
          failed++
          errors.push({
            id:      batch[j],
            message: (results[j] as PromiseRejectedResult).reason?.message ?? 'unknown error',
          })
          console.error(`[Orchestrator] Failed for ${batch[j]}:`, errors.at(-1)!.message)
        }
      }
    }

    return { processed, failed, errors }
  }
}

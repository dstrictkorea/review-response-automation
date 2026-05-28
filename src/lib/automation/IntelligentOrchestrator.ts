/**
 * IntelligentOrchestrator — background AI draft generation for all incoming reviews.
 *
 * Called by the cron sync route immediately after new reviews are inserted.
 * Uses the admin client (service-role) since it runs without a user session.
 *
 * Routing matrix (writes to reviews.status):
 *   risk_level 'medium' | 'high' | 'critical'  →  'pending_approval'
 *   any forbidden_check flag true               →  'pending_approval'
 *   rating ≤ 3                                  →  'pending_approval'
 *   otherwise                                   →  'ai_done'
 *
 * 'pending_approval' reviews surface in the dashboard's "AI 격리 — 2차 확인" card
 * and in the pending review list, so staff can review and approve them.
 */

import OpenAI from 'openai'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Provider URL map (all expose an OpenAI-compatible /chat/completions endpoint) ──
const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

// ── System prompt ─────────────────────────────────────────────────────────────────
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
- critical: Injury/accident reports, legal threats, discrimination, media threats

OUTPUT: Valid JSON only — no markdown wrapper, no prose outside JSON.
{
  "detected_language": "ko" | "en" | "zh" | "ja" | "...",
  "sentiment": "positive" | "neutral" | "mixed" | "negative",
  "risk_level": "low" | "medium" | "high" | "critical",
  "categories": ["string"],
  "risk_reasons": ["string"],
  "internal_note_ko": "string",
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

// ── Main class ────────────────────────────────────────────────────────────────────
export class IntelligentOrchestrator {
  /**
   * Process a single review: fetch context, call LLM, route by risk, write atomically.
   * Throws on unrecoverable errors — caller is responsible for catch/log.
   */
  static async processReview(reviewId: string): Promise<void> {
    const admin = createAdminClient()

    // ── 1. Parallel fetch: review + live settings ─────────────────────────────
    const [reviewRes, keywordsRes, templatesRes] = await Promise.all([
      admin.from('reviews').select('*').eq('id', reviewId).single(),
      admin.from('app_settings').select('value').eq('key', 'risk_keywords').maybeSingle(),
      admin.from('app_settings').select('value').eq('key', 'reply_templates').maybeSingle(),
    ])

    if (reviewRes.error || !reviewRes.data) {
      throw new Error(`[Orchestrator] Review not found: ${reviewId}`)
    }

    const review       = reviewRes.data
    const dbKeywords   = (keywordsRes.data?.value  as RiskKeyword[])    ?? []
    const dbTemplates  = (templatesRes.data?.value as ReplyTemplate[])  ?? []

    const activeKeywords   = dbKeywords.filter(k => k.is_active)
    const matchedTemplates = dbTemplates.filter(t => t.language === review.review_language)

    // ── 2. Resolve AI provider ────────────────────────────────────────────────
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

    // ── 3. Build user message with live DB settings injected ──────────────────
    const riskKeywordContext = activeKeywords.length > 0
      ? activeKeywords
          .map(k => `  - "${k.keyword}" (${k.language}, risk: ${k.risk_level})`)
          .join('\n')
      : '  (none configured)'

    const templateContext = matchedTemplates.length > 0
      ? matchedTemplates
          .slice(0, 5)
          .map(t => `  [${t.category}] ${t.name}: ${t.content.slice(0, 120)}`)
          .join('\n')
      : '  (none for this language)'

    const userMessage = `Branch: ${review.branch_code}
Channel: ${review.channel_code}
Rating: ${review.rating ?? 'N/A'} / 5
Reviewer: ${review.reviewer_name ?? 'Anonymous'}

Review text:
${review.review_text ?? '(no text provided)'}

CONTEXT:
- This reply will be posted PUBLICLY on ${review.channel_code}.
- Future visitors will read it when deciding whether to visit.

ACTIVE RISK KEYWORDS (from settings — elevate risk_level if matched):
${riskKeywordContext}

REPLY STYLE REFERENCE (language-matched templates):
${templateContext}

Generate three reply drafts and classify the review. Return JSON only.`

    // ── 4. LLM call ───────────────────────────────────────────────────────────
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

    // ── 5. Hardcoded risk floor (matches existing generate-reply route) ────────
    const ratingFloor  = review.rating != null && review.rating <= 2 ? 'high' : null
    const finalRisk    =
      result.risk_level === 'critical' ? 'critical'
      : ratingFloor === 'high'         ? 'high'
      : result.risk_level

    // ── 6. Routing decision ───────────────────────────────────────────────────
    const hasForbiddenFlag =
      Object.values(result.forbidden_check ?? {}).some(v => v === true)

    const needsSecondaryReview =
      (review.rating != null && review.rating <= 3) ||
      ['medium', 'high', 'critical'].includes(finalRisk) ||
      hasForbiddenFlag

    const finalStatus = needsSecondaryReview ? 'pending_approval' : 'ai_done'

    // ── 7. Atomic write via RPC ───────────────────────────────────────────────
    const { error: rpcErr } = await admin.rpc('update_review_and_save_drafts', {
      p_review_id:       reviewId,
      p_status:          finalStatus,
      p_risk_level:      finalRisk,
      p_sentiment:       result.sentiment,
      p_categories:      result.categories      ?? [],
      p_risk_reasons:    result.risk_reasons     ?? [],
      p_forbidden_check: result.forbidden_check  ?? {},
      p_draft_short:     result.draft_short,
      p_draft_standard:  result.draft_standard,
      p_draft_careful:   result.draft_careful,
      p_model_name:      model,
      p_prompt_version:  'io-v1',
    })

    if (rpcErr) throw new Error(`[Orchestrator] RPC failed: ${rpcErr.message}`)

    // ── 8. Activity log ───────────────────────────────────────────────────────
    await admin.from('activity_logs').insert({
      review_id:  reviewId,
      actor_name: 'system:orchestrator',
      action:     'ai_draft_generated',
      detail: {
        model,
        risk_level:   finalRisk,
        status:       finalStatus,
        is_isolated:  needsSecondaryReview,
        has_forbidden: hasForbiddenFlag,
      },
    })
  }

  /**
   * Process a batch of review IDs with limited concurrency.
   * Errors are caught per-review so one failure doesn't abort the whole batch.
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

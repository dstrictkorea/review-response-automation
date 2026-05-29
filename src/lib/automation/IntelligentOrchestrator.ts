/**
 * IntelligentOrchestrator — 리뷰 자동 AI 처리 파이프라인 (io-v3)
 *
 * 처리 순서:
 *   1. DB 병렬 조회 (리뷰 + 키워드 + 템플릿)
 *   2. 1차 글로벌 키워드 필터 (filterService.scanText)
 *   3. 지점 문화 프로파일 결정 (aiService.getCulturalProfile)
 *   4. 시스템 프롬프트 + 유저 메시지 빌드 (aiService.buildSystemPrompt / buildUserMessage)
 *   5. LLM 호출 (Groq → Gemini → OpenAI 우선순위)
 *   6. 위험도 병합 — 필터 floor + AI + 평점
 *   7. 격리 사유 통합 (isolationSummary + isolation_reason + internal_note_ko)
 *   8. DB 원자적 쓰기 (RPC)
 *   9. 활동 로그
 *
 * 격리 조건 (needsSecondaryReview):
 *   - 1차 필터 트리거
 *   - AI risk_level 'medium' | 'high' | 'critical'
 *   - forbidden_check 플래그 any true
 *   - rating ≤ 3
 */

import OpenAI from 'openai'
import type { RiskKeyword, ReplyTemplate } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanText } from '@/services/filterService'
import {
  getCulturalProfile,
  buildSystemPrompt,
  buildUserMessage,
} from '@/services/aiService'

// ── Provider URL map ──────────────────────────────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  groq:   'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const RANK_TO_LEVEL = ['low', 'medium', 'high', 'critical'] as const

function floorRisk(...levels: Array<string | null | undefined>): string {
  const max = Math.max(...levels.map((l) => RISK_RANK[l ?? 'low'] ?? 0))
  return RANK_TO_LEVEL[max]
}

// ── LLM 응답 타입 ─────────────────────────────────────────────────────────────
interface LLMResult {
  detected_language: string
  sentiment: string
  risk_level: string
  categories: string[]
  risk_reasons: string[]
  core_complaint: string
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

// ── Main class ─────────────────────────────────────────────────────────────────
export class IntelligentOrchestrator {
  /**
   * 단일 리뷰 처리: DB 조회 → 1차 필터 → 문화 프로파일 → AI → 위험도 병합 → DB 쓰기 → 로그
   */
  static async processReview(reviewId: string): Promise<void> {
    const admin = createAdminClient()

    // ── 1. 병렬 조회 ────────────────────────────────────────────────────────
    const [reviewRes, keywordsRes, templatesRes, branchRes] = await Promise.all([
      admin.from('reviews').select('*').eq('id', reviewId).single(),
      admin.from('app_settings').select('value').eq('key', 'risk_keywords').maybeSingle(),
      admin.from('app_settings').select('value').eq('key', 'reply_templates').maybeSingle(),
      // 지점 정보 (문화 프로파일 결정용)
      admin.from('reviews').select('branch_code').eq('id', reviewId).single(),
    ])

    if (reviewRes.error || !reviewRes.data) {
      throw new Error(`[Orchestrator] Review not found: ${reviewId}`)
    }

    const review       = reviewRes.data
    const dbKeywords   = (keywordsRes.data?.value  as RiskKeyword[])   ?? []
    const dbTemplates  = (templatesRes.data?.value as ReplyTemplate[]) ?? []

    const activeKeywords   = dbKeywords.filter((k) => k.is_active)
    const reviewLang       = review.review_language ?? 'ko'
    const matchedTemplates = dbTemplates.filter((t) => t.language === reviewLang)

    // ── 2. 1차 글로벌 키워드 필터 ────────────────────────────────────────────
    const filterResult = scanText(review.review_text ?? '', activeKeywords)

    // ── 3. AI 프로바이더 선택 ─────────────────────────────────────────────────
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

    // ── 4. 문화 프로파일 + 프롬프트 구성 (aiService SSOT) ──────────────────────
    const culturalProfile = getCulturalProfile(
      review.branch_code,
      review.review_language ?? 'ko',
    )

    const preFilterNote = filterResult.triggered
      ? `\nPRE-FILTER ALERT — 글로벌 위험 키워드 필터가 다음 표현을 탐지했습니다:\n` +
        filterResult.matches
          .map((m) =>
            `  - keyword="${m.keyword}" riskLevel=${m.riskLevel} lang=${m.lang} context="${m.context}"`,
          )
          .join('\n') +
        `\nMinimum risk_level required: ${filterResult.maxRiskLevel}. ` +
        `Your isolation_reason MUST explicitly reference EACH detected expression.\n`
      : ''

    // 지점 표시 이름 (DB에서 직접 조회)
    const branchData = await admin
      .from('branches')
      .select('name_ko, name_en')
      .eq('code', review.branch_code)
      .maybeSingle()
    const branchDisplayName = branchData.data
      ? `${branchData.data.name_ko}${branchData.data.name_en ? ' / ' + branchData.data.name_en : ''}`
      : review.branch_code

    const systemPrompt = buildSystemPrompt(culturalProfile, matchedTemplates)
    const userMessage  = buildUserMessage({
      branchCode:        review.branch_code,
      branchDisplayName,
      channelCode:       review.channel_code,
      channelName:       review.channel_code,
      rating:            review.rating,
      reviewerName:      review.reviewer_name,
      reviewText:        review.review_text ?? '',
      preFilterNote,
      activeKeywords,
    })

    // ── 5. LLM 호출 ────────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: activeKey, baseURL })
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    })

    const rawText   = completion.choices[0].message.content ?? ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('[Orchestrator] LLM response contained no JSON object')

    const result = JSON.parse(jsonMatch[0]) as LLMResult

    // ── 6. 위험도 병합 (필터 floor + AI + 평점) ─────────────────────────────
    const ratingFloor = review.rating != null && review.rating <= 2 ? 'high' : null
    const finalRisk   = floorRisk(
      result.risk_level,
      filterResult.triggered ? filterResult.maxRiskLevel : null,
      ratingFloor,
    )

    // ── 7. 격리 사유 통합 ────────────────────────────────────────────────────
    const combinedNote = [
      filterResult.triggered    ? filterResult.isolationSummary : null,
      result.isolation_reason  || null,
      result.internal_note_ko  || null,
    ].filter(Boolean).join('\n')

    const combinedRiskReasons = [
      ...filterResult.matchedKeywords.map((k) => `[1차필터] ${k}`),
      ...(result.risk_reasons ?? []),
    ]

    // ── 8. 라우팅 결정 ──────────────────────────────────────────────────────
    const hasForbiddenFlag = Object.values(result.forbidden_check ?? {}).some((v) => v === true)

    const needsSecondaryReview =
      filterResult.triggered ||
      (review.rating != null && review.rating <= 3) ||
      ['medium', 'high', 'critical'].includes(finalRisk) ||
      hasForbiddenFlag

    const finalStatus = needsSecondaryReview ? 'pending_approval' : 'ai_done'

    // ── 9. DB 원자적 쓰기 ────────────────────────────────────────────────────
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
      p_prompt_version:  'io-v3',
    })

    if (rpcErr) throw new Error(`[Orchestrator] RPC failed: ${rpcErr.message}`)

    // internal_note_ko + core_complaint는 RPC에 포함되지 않으므로 별도 업데이트
    const noteWithComplaint = [
      combinedNote,
      result.core_complaint ? `핵심 불만: ${result.core_complaint}` : null,
    ].filter(Boolean).join('\n')

    if (noteWithComplaint) {
      await admin
        .from('reviews')
        .update({ internal_note_ko: noteWithComplaint, updated_at: new Date().toISOString() })
        .eq('id', reviewId)
    }

    // ── 10. 활동 로그 ─────────────────────────────────────────────────────────
    await admin.from('activity_logs').insert({
      review_id:  reviewId,
      actor_name: 'system:orchestrator',
      action:     needsSecondaryReview ? 'review_isolated' : 'ai_draft_generated',
      detail: {
        model,
        prompt_version:      'io-v3',
        risk_level:          finalRisk,
        status:              finalStatus,
        cultural_profile:    culturalProfile.countryCode,
        is_isolated:         needsSecondaryReview,
        filter_triggered:    filterResult.triggered,
        filter_keywords:     filterResult.matchedKeywords,
        filter_langs:        filterResult.detectedLangs,
        has_forbidden:       hasForbiddenFlag,
        core_complaint:      result.core_complaint || null,
      },
    })
  }

  /**
   * 배치 처리 — 제한된 동시성으로 복수 리뷰 처리
   */
  static async processBatch(
    reviewIds: string[],
    concurrency = 3,
  ): Promise<{
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
        batch.map((id) => IntelligentOrchestrator.processReview(id)),
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

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { scanText } from '@/services/filterService'
import { processReview, type ProcessDecision } from '@/lib/reviewProcessor'
import { refreshEngineFromDB } from '@/lib/waterfallRegexEngine'
import { detectBranchCode } from '@/lib/branches'

type LangKey = 'ko' | 'en' | 'ja' | 'zh'
const langKey = (l: string | null | undefined): LangKey => (['ko', 'en', 'ja', 'zh'].includes(l ?? '') ? (l as LangKey) : 'ko')

// 인입 분류 위험도 매핑 — 키워드 SSOT(scanText) 합산으로 EMERGENCY의 critical 보존(floor-only)
const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
function emergencyRisk(text: string): string {
  const fr = scanText(text)
  return fr.triggered && (RISK_RANK[fr.maxRiskLevel] ?? 0) > RISK_RANK.high ? fr.maxRiskLevel : 'high'
}
const RANK_LEVEL = ['low', 'medium', 'high', 'critical'] as const
function floorRisk(a: string, b: string): string {
  return RANK_LEVEL[Math.max(RISK_RANK[a] ?? 0, RISK_RANK[b] ?? 0)] ?? 'low'
}

// 별점 ≤ 이 값이면 텍스트가 안전/모호여도 사람 확인 격리(찬양 템플릿 억제). 운영 중 조정 가능.
const LOW_RATING_ISOLATE = 2

// 작성일 유연 파싱 — 다양한 포맷 허용, 파싱 불가 시 null(insert 실패 대신 빈 값). timestamptz 컬럼 보호.
function coerceDate(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

interface ImportClass { status: string; risk: string; reason: string; genStatic: boolean }

/**
 * 인입 시점 최종 분류 — 텍스트 분류(WaterfallRegexEngine) + 별점을 결합.
 *   SAFE(고별점)      → ai_done (정적 알고리즘 답변)
 *   EMERGENCY         → pending_approval (격리) + 건조 사과 초안
 *   COMPLAINT         → pending_approval (격리), LLM 답변은 이후 게이트키퍼
 *   AMBIGUOUS(★3+ 혼합) → ai_done (좋은 점·아쉬운 점 함께 인정하는 균형 정적 답변 — LLM 미사용)
 *   AMBIGUOUS(질문 등 무신호) → new (정상 큐, 균형 초안 제공)
 *   저별점(≤2)        → pending_approval (격리) + 균형 초안 제공 (빈 답변 방지·과소격리 방지)
 */
function classifyImport(d: ProcessDecision, rating: number | null, text: string): ImportClass {
  const cls = d.classification.status
  const lowRating = rating != null && rating <= LOW_RATING_ISOLATE

  // 사용자 정책(긴급/독성 외 전부 자동완료): 사람 검토(pending_approval)는 긴급(EMERGENCY)·
  //   독성(Tier2/3)·서비스 질문·순수 모호건으로 한정하고, 그 외(COMPLAINT Tier1·저별점 양가·
  //   SAFE·COMPLIMENT)는 모두 ai_done. reviewProcessor의 requiresApproval이 이 정책을 이미
  //   반영하므로(질문/순수모호=true, 저별점 양가=false) 그대로 따른다. 게시는 늘 사람 수동(안전망).
  const status = d.requiresApproval ? 'pending_approval' : 'ai_done'

  // 모든 비-LLM 경로는 정적 초안을 생성한다 — ★1-2도 '빈 초안'을 남기지 않는다.
  //   분류가 이미 저별점을 COMPLAINT/AMBIGUOUS(긍정 본문 충돌)로 보내므로 buildStaticReply는
  //   칭찬이 아닌 적절한 사과/균형 초안을 만든다 → 담당자가 빈 화면이 아닌 편집 가능한 초안에서 시작.
  //   (과거: 저별점 칭찬 억제 목적의 suppressPraise가 정당한 사과/균형 초안까지 비워 73건 빈칸 발생.)
  const genStatic = d.route !== 'llm'

  const base = cls === 'EMERGENCY' ? emergencyRisk(text) : cls === 'COMPLAINT' ? 'medium' : 'low'
  const risk = lowRating ? floorRisk(base, 'medium') : base

  const reason = d.classification.reason + (lowRating ? ` · 저별점(${rating}점) → 사람 확인 격리` : '')
  return { status, risk, reason, genStatic }
}

export interface ImportRowPayload {
  rating: number | null
  review_text: string
  review_date: string | null
  reviewer_name: string | null
  review_url: string | null
  external_review_id: string | null
  review_language: string | null
  /** CSV에서 자동 감지된 지점 코드 (없으면 null → 배치 기본 지점) */
  branch_code: string | null
  source: Record<string, string>
}

export interface ImportResult {
  error?: string
  batchId?: string
  total: number
  imported: number
  duplicates: number
  errors: number
  errorDetails: string[]
}

// ── 해시 유틸리티 ──────────────────────────────────────────────────────────────

/**
 * 텍스트 클리닝 — 모든 공백·특수문자 제거 (해시 입력 전처리용)
 */
function cleanText(text: string): string {
  return text.toLowerCase().replace(/[\s\r\n\t\p{P}\p{S}]+/gu, '')
}

/**
 * 고객 및 상황 인지 5차원 컨텍스트 해시 생성
 *
 * 기존: SHA256(text_only)  →  동일 텍스트라면 다른 리뷰어도 충돌
 * 개선: SHA256(branch | channel | authorId | YYYY-MM-DD | cleanedText)
 *       → 같은 날 같은 지점에 다른 사람이 쓴 리뷰는 절대 충돌 없음
 *
 * @param branchCode   지점 코드 (AMNY, AMBS…)
 * @param channelCode  채널 코드 (google, naver…)
 * @param authorId     reviewer_name ?? external_review_id ?? '' (소문자)
 * @param dateSlug     review_date의 YYYY-MM-DD 부분 (없으면 빈 문자열)
 * @param reviewText   원본 리뷰 텍스트 (cleaner가 내부 처리)
 */
function generateContextHash(
  branchCode: string,
  channelCode: string,
  authorId: string,
  dateSlug: string,
  reviewText: string,
): string {
  const cleaned = cleanText(reviewText)
  const input = `${branchCode}|${channelCode}|${authorId}|${dateSlug}|${cleaned}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * 성능 최적화 버전:
 * - 기존: 행마다 SELECT×3 + INSERT×2 + UPDATE = 100행 → ~600 쿼리 (약 5분)
 * - 개선: 사전 bulk SELECT×3 + bulk UPSERT×1 = 항상 5~7쿼리 (2-5초)
 *
 * 중복 판정 알고리즘 v2 — 5차원 컨텍스트 해시:
 *   branch_code + channel_code + 작성자 식별자 + 작성일 YYYY-MM-DD + 정규화 텍스트
 *   → 같은 텍스트라도 다른 작성자·날짜이면 다른 해시 → DB 충돌 없음
 */
export async function importReviewsAction(
  batchInfo: {
    branchCode: string
    channelCode: string
    importFormat: string
    originalFilename: string
  },
  rows: ImportRowPayload[]
): Promise<ImportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: '인증 필요', total: 0, imported: 0, duplicates: 0, errors: 0, errorDetails: [] }
  }

  const fail = (error: string): ImportResult => ({ error, total: rows.length, imported: 0, duplicates: 0, errors: 0, errorDetails: [] })

  // ── 0. 지점/채널 유연 해석 (FK 위반 방지) ──────────────────────────────────
  //   batch.branch_code·channel_code 는 branches/channels FK(NOT NULL). 사용자가 기본 지점을
  //   고르지 않고 CSV 행별 지점에 의존하면 batchInfo.branchCode 가 ''가 되어 FK가 깨진다.
  //   → 유효 코드 집합으로 검증하고, 코드 대소문자/공백/도시명(라스베이거스·las vegas)까지 인식.
  const [{ data: branchRows }, { data: channelRows }] = await Promise.all([
    supabase.from('branches').select('code').eq('is_active', true),
    supabase.from('channels').select('code').eq('is_active', true),
  ])
  const validBranches = new Set((branchRows ?? []).map((b) => (b as { code: string }).code))
  const validChannels = new Set((channelRows ?? []).map((c) => (c as { code: string }).code))

  // 코드(AMLV) → 대소문자/공백 정규화 → 도시명 별칭(las vegas/라스베이거스) 순으로 해석. 미해석 시 null.
  function resolveBranch(raw: string | null | undefined): string | null {
    const t = (raw ?? '').trim()
    if (!t) return null
    if (!validBranches.size) return t.toUpperCase()        // 검증 불가(쿼리 실패) → best-effort
    if (validBranches.has(t)) return t
    const up = t.toUpperCase()
    if (validBranches.has(up)) return up
    return detectBranchCode(t, validBranches)              // 도시명 등 별칭 인식
  }

  // 배치 대표 지점: (1) 명시 선택 → (2) 행별 지점 중 최다 → (3) 에러(원시 FK 메시지 대신 안내)
  let batchBranch = resolveBranch(batchInfo.branchCode)
  if (!batchBranch) {
    const tally = new Map<string, number>()
    for (const r of rows) {
      const b = resolveBranch(r.branch_code)
      if (b) tally.set(b, (tally.get(b) ?? 0) + 1)
    }
    batchBranch = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  if (!batchBranch) {
    return fail('지점을 인식할 수 없습니다. 가져오기 설정에서 기본 지점을 선택하거나, CSV의 지점(branch) 값이 등록된 지점 코드(예: AMLV)·도시명인지 확인하세요.')
  }

  // 채널 검증 (NOT NULL FK). 미선택/미등록 채널은 원시 FK 대신 안내 메시지.
  const batchChannel = (batchInfo.channelCode ?? '').trim()
  if (!batchChannel) return fail('채널을 선택하세요.')
  if (validChannels.size && !validChannels.has(batchChannel)) {
    return fail(`채널 코드 '${batchChannel}'가 등록되어 있지 않습니다. 채널 관리에서 먼저 등록하거나 다른 채널을 선택하세요.`)
  }

  // ── 1. 배치 레코드 생성 ────────────────────────────────────────────────────
  const { data: batch, error: batchError } = await supabase
    .from('review_import_batches')
    .insert({
      branch_code: batchBranch,
      channel_code: batchChannel,
      import_format: batchInfo.importFormat,
      original_filename: batchInfo.originalFilename || null,
      total_rows: rows.length,
      created_by: user.email,
    })
    .select()
    .single()

  if (batchError || !batch) {
    return {
      error: batchError?.message ?? '배치 생성 실패',
      total: rows.length,
      imported: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: [],
    }
  }

  // ── 2. 전체 행 해시 사전 계산 (CPU만, 네트워크 없음) ─────────────────────
  //
  // 5차원 컨텍스트 해시:
  //   author_identifier = reviewer_name ?? external_review_id ?? ''
  //   date_slug         = review_date.slice(0, 10) ?? ''
  //   normalized_hash   = SHA256(branch|channel|authorId|dateSlug|cleanedText)
  //
  const enriched = rows.map((row, originalIndex) => {
    const authorIdentifier = (row.reviewer_name ?? row.external_review_id ?? '').trim().toLowerCase()
    const dateSlug         = row.review_date?.slice(0, 10) ?? ''

    // 행별 지점: CSV 값을 유연 해석(코드/대소문자/도시명) → 미해석 시 배치 대표 지점으로 폴백.
    //   reviews.branch_code 도 branches FK(NOT NULL)이므로 모든 행이 유효 코드를 갖도록 보장한다.
    const effectiveBranch  = resolveBranch(row.branch_code) ?? batchBranch

    const normalized_hash = generateContextHash(
      effectiveBranch,
      batchChannel,
      authorIdentifier,
      dateSlug,
      row.review_text ?? '',
    )

    // import_hash: 별점 포함 — 파일 내 세분화된 Row 레벨 추적용
    const import_hash = crypto
      .createHash('sha256')
      .update(`${effectiveBranch}|${batchChannel}|${row.rating ?? ''}|${authorIdentifier}|${dateSlug}|${cleanText(row.review_text ?? '')}`)
      .digest('hex')

    return { ...row, effectiveBranch, authorIdentifier, dateSlug, normalized_hash, import_hash, originalIndex }
  })

  // ── 3. 중복 확인: 개별 SELECT×N 대신 IN(…) 쿼리 3개 병렬 실행 ──────────
  const externalIds = [...new Set(enriched.filter(r => r.external_review_id).map(r => r.external_review_id!))]
  const reviewUrls  = [...new Set(enriched.filter(r => r.review_url).map(r => r.review_url!))]
  const hashes      = [...new Set(enriched.map(r => r.normalized_hash))]

  // 행별 지점이 혼재할 수 있으므로 branch_code 고정 필터 제거.
  // 5차원 normalized_hash 가 이미 branch+channel 을 인코딩하여 전역 유일.
  const [{ data: existingByExtId }, { data: existingByUrl }, { data: existingByHash }] = await Promise.all([
    externalIds.length
      ? supabase
          .from('reviews')
          .select('source_review_id')
          .in('source_review_id', externalIds)
          .eq('channel_code', batchChannel)
      : Promise.resolve({ data: [] as Array<{ source_review_id: string | null }> }),
    reviewUrls.length
      ? supabase.from('reviews').select('review_url').in('review_url', reviewUrls)
      : Promise.resolve({ data: [] as Array<{ review_url: string | null }> }),
    // ★ 5차원 해시 자체가 유니크 식별자 (branch+channel 인코딩됨)
    hashes.length
      ? supabase
          .from('reviews')
          .select('normalized_hash')
          .in('normalized_hash', hashes)
      : Promise.resolve({ data: [] as Array<{ normalized_hash: string | null }> }),
  ])

  // DB 기존 데이터를 메모리 Set으로 — O(1) 조회
  const dupeExtIds = new Set((existingByExtId ?? []).map(r => r.source_review_id).filter(Boolean))
  const dupeUrls   = new Set((existingByUrl   ?? []).map(r => r.review_url).filter(Boolean))
  const dupeHashes = new Set((existingByHash  ?? []).map(r => r.normalized_hash).filter(Boolean))

  // ── 4. 메모리 내 분류 (쿼리 없음) ────────────────────────────────────────
  type Enriched = (typeof enriched)[0]
  const toInsert:    Enriched[]                           = []
  const duplicates:  { row: Enriched; reason: string }[] = []
  const branchErrors: Enriched[]                         = []  // 지점 미확인 행
  const seenInBatch = new Set<string>() // 파일 내 중복 감지

  for (const row of enriched) {
    // 지점이 자동 감지되지 않고 배치 기본 지점도 없으면 적재 불가
    if (!row.effectiveBranch) {
      branchErrors.push(row)
      continue
    }

    let dupeReason: string | null = null

    if (row.external_review_id && dupeExtIds.has(row.external_review_id))
      dupeReason = `external_review_id "${row.external_review_id}" 이미 존재`
    else if (row.review_url && dupeUrls.has(row.review_url))
      dupeReason = 'review_url 이미 존재'
    else if (dupeHashes.has(row.normalized_hash))
      dupeReason = `동일 작성자·날짜·내용 중복 (작성자: ${row.authorIdentifier || '익명'}, 날짜: ${row.dateSlug || '미상'})`
    else if (seenInBatch.has(row.normalized_hash))
      dupeReason = `파일 내 동일 작성자·날짜·내용 중복 (작성자: ${row.authorIdentifier || '익명'})`

    if (dupeReason) {
      duplicates.push({ row, reason: dupeReason })
    } else {
      seenInBatch.add(row.normalized_hash)
      toInsert.push(row)
    }
  }

  // ── 4b. 인입 시점 결정론적 1차 분류 (LLM 미사용, 순수 함수) ────────────────
  // WaterfallRegexEngine → 위험도/태그/라우팅을 UPSERT 이전에 확정한다.
  //   SAFE → ai_done (정적 알고리즘 답변 자동 생성)
  //   EMERGENCY/COMPLAINT/AMBIGUOUS → pending_approval (격리). EMERGENCY는 critical 보존.
  // PHASE 2: 분류 직전 DB 규칙을 엔진에 로드(인메모리 캐시, TTL). 실패 시 하드코딩 DEFAULTS.
  await refreshEngineFromDB()

  const decisionByHash = new Map<string, ProcessDecision>()
  const ciByHash = new Map<string, ImportClass>()
  for (const row of toInsert) {
    const d = processReview({
      reviewText:   row.review_text ?? '',
      branchCode:   row.effectiveBranch,
      language:     langKey(row.review_language),
      reviewerName: row.reviewer_name,
      rating:       row.rating,   // Rating Override: 고평점 건설적 피드백 → COMPLIMENT
      // 행별 고유 해시를 변형 선택 시드로 사용 — 미전달 시 모든 초안이 변형 0(동일 인사+감사)로
      //   찍혀 "너무 중복"의 주원인이 된다. import_hash는 5차원(지점/채널/작성자/날짜/텍스트) 고유값.
      reviewId:     row.import_hash,
    })
    decisionByHash.set(row.import_hash, d)
    ciByHash.set(row.import_hash, classifyImport(d, row.rating, row.review_text ?? ''))
  }

  // ── 5. 신규 리뷰 bulk UPSERT (ON CONFLICT DO NOTHING) ────────────────────
  //
  // upsert + ignoreDuplicates: true → 경쟁 조건이나 재처리로 인한 충돌 시
  // 개별 건만 조용히 스킵, 나머지 정상 리뷰는 안전하게 적재됨
  //
  let imported = 0
  let errors = 0
  const errorDetails: string[] = []
  let insertedReviews: Array<{ id: string; import_hash: string }> = []

  if (toInsert.length > 0) {
    const { data, error: bulkError } = await supabase
      .from('reviews')
      .upsert(
        toInsert.map(row => {
          const d = decisionByHash.get(row.import_hash)!
          const ci = ciByHash.get(row.import_hash)!
          return {
            branch_code:            row.effectiveBranch,
            channel_code:           batchChannel,
            rating:                 row.rating,
            review_text:            row.review_text,
            review_created_at:      coerceDate(row.review_date),
            review_url:             row.review_url,
            reviewer_name:          row.reviewer_name,
            review_language:        row.review_language,
            source_review_id:       row.external_review_id,
            normalized_hash:        row.normalized_hash,
            import_hash:            row.import_hash,
            source_import_batch_id: batch.id,
            // 인입 시점 1차 분류(텍스트+별점) 결과를 즉시 인코딩 (분류 → 라우팅 → 답변 순서)
            status:                 ci.status,
            risk_level:             ci.risk,
            categories:             d.classification.tags,
            risk_reasons:           [ci.reason],
            internal_note_ko:       ci.reason,
          }
        }),
        {
          // 라이브 DB의 기존 유니크 인덱스 reviews_branch_code_channel_code_normalized_hash_key
          // (branch_code, channel_code, normalized_hash) 와 정확히 일치시킨다.
          // 5차원 해시가 이미 branch+channel을 인코딩하므로 의미상 동일하며,
          // 단독 normalized_hash 인덱스가 없는 환경에서도 ON CONFLICT가 정상 동작한다.
          onConflict:       'branch_code,channel_code,normalized_hash',
          ignoreDuplicates: true,
        },
      )
      .select('id, import_hash')

    if (bulkError) {
      errors = toInsert.length
      errorDetails.push(`bulk insert 실패: ${bulkError.message}`)
    } else {
      insertedReviews = data ?? []
      imported = insertedReviews.length
    }
  }

  // ── 5b. 인입 분류 결과 → 정적 STANDARD 답변 자동 생성 (LLM 미사용) ──────────
  // 위험도/상태/태그는 위 UPSERT에 이미 인코딩됨. 여기서는 정적 초안만 일괄 생성한다.
  //   SAFE      → 감사/ETERNAL NATURE 자동 답변 (ai_done)
  //   EMERGENCY → 건조 사과 홀딩 초안 (pending_approval 격리)
  //   COMPLAINT/AMBIGUOUS → 격리만, LLM 답변은 이후 게이트키퍼(/api/review/generate)에서.
  const hashToReviewId = new Map(insertedReviews.map(r => [r.import_hash, r.id]))

  const classCounts: Record<string, number> = { SAFE: 0, EMERGENCY: 0, COMPLAINT: 0, AMBIGUOUS: 0 }
  const draftRows = insertedReviews.flatMap(ir => {
    const d = decisionByHash.get(ir.import_hash)
    const ci = ciByHash.get(ir.import_hash)
    if (!d || !ci) return []
    classCounts[d.classification.status] = (classCounts[d.classification.status] ?? 0) + 1
    if (!ci.genStatic || !d.staticReply) return []
    return [{
      review_id:           ir.id,
      draft_short:         null,
      draft_standard:      d.staticReply,
      draft_careful:       null,
      selected_draft_type: 'standard',
      selected_reply:      d.staticReply,
      forbidden_check:     { refund_promise: false, legal_admission: false, cctv_mention: false, staff_discipline: false },
      prompt_version:      d.route === 'manual' ? 'algo-emergency-v1' : 'algo-v1',
      model_name:          null,
      pipeline_engine:     'template' as const,
      intent_code:         d.classification.status,
      intent_confidence:   1,
    }]
  })
  if (draftRows.length > 0) {
    await supabase.from('reply_drafts').insert(draftRows)
  }

  const importRowsPayload = [
    ...toInsert.map(row => ({
      batch_id:       batch.id,
      row_index:      row.originalIndex,
      source_payload: row.source,
      mapped_payload: {
        rating:             row.rating,
        review_text:        row.review_text,
        review_date:        row.review_date,
        reviewer_name:      row.reviewer_name,
        review_url:         row.review_url,
        external_review_id: row.external_review_id,
        review_language:    row.review_language,
      },
      status:    errors > 0 ? 'error' : 'imported',
      review_id: hashToReviewId.get(row.import_hash) ?? null,
    })),
    ...duplicates.map(({ row, reason }) => ({
      batch_id:       batch.id,
      row_index:      row.originalIndex,
      source_payload: row.source,
      mapped_payload: {
        rating:             row.rating,
        review_text:        row.review_text,
        review_date:        row.review_date,
        reviewer_name:      row.reviewer_name,
        review_url:         row.review_url,
        external_review_id: row.external_review_id,
        review_language:    row.review_language,
      },
      status:        'duplicate',
      error_message: reason,
    })),
    ...branchErrors.map(row => ({
      batch_id:       batch.id,
      row_index:      row.originalIndex,
      source_payload: row.source,
      mapped_payload: {
        rating:             row.rating,
        review_text:        row.review_text,
        review_date:        row.review_date,
        reviewer_name:      row.reviewer_name,
        review_url:         row.review_url,
        external_review_id: row.external_review_id,
        review_language:    row.review_language,
      },
      status:        'error',
      error_message: '지점 미확인 (CSV/파일명 자동 감지 실패 + 기본 지점 미선택)',
    })),
  ]

  // 지점 미확인 행을 오류 집계에 반영
  if (branchErrors.length > 0) {
    errors += branchErrors.length
    errorDetails.push(`지점 미확인 ${branchErrors.length}건 — CSV 지점 컬럼/파일명에서 감지 실패. 기본 지점을 선택하거나 지점 컬럼을 추가하세요.`)
  }

  if (importRowsPayload.length > 0) {
    await supabase.from('review_import_rows').insert(importRowsPayload)
  }

  // ── 7. 배치 집계 업데이트 + 활동 로그 (병렬) ─────────────────────────────
  await Promise.all([
    supabase
      .from('review_import_batches')
      .update({
        valid_rows:     imported + duplicates.length,
        imported_rows:  imported,
        duplicate_rows: duplicates.length,
        error_rows:     errors,
      })
      .eq('id', batch.id),
    supabase.from('activity_logs').insert({
      review_id:  null,
      actor_name: user.email,
      action:     'bulk_import_completed',
      detail: {
        batch_id:      batch.id,
        branch_code:   batchBranch,
        channel_code:  batchChannel,
        hash_version:  'ctx-v2',
        total:         rows.length,
        imported,
        duplicates:    duplicates.length,
        errors,
        classification: classCounts,  // 인입 1차 분류 집계 (SAFE/EMERGENCY/COMPLAINT/AMBIGUOUS)
      },
    }),
  ])

  revalidatePath('/reviews')
  revalidatePath('/dashboard')

  return {
    batchId:    batch.id,
    total:      rows.length,
    imported,
    duplicates: duplicates.length,
    errors,
    errorDetails,
  }
}

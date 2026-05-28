'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'

export interface ImportRowPayload {
  rating: number | null
  review_text: string
  review_date: string | null
  reviewer_name: string | null
  review_url: string | null
  external_review_id: string | null
  review_language: string | null
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

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * 성능 최적화 버전:
 * - 기존: 행마다 SELECT×3 + INSERT×2 + UPDATE = 100행 → ~600 쿼리 (약 5분)
 * - 개선: 사전 bulk SELECT×3 + bulk INSERT×2 = 항상 7쿼리 (2-5초)
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

  // ── 1. 배치 레코드 생성 ────────────────────────────────────────────────────
  const { data: batch, error: batchError } = await supabase
    .from('review_import_batches')
    .insert({
      branch_code: batchInfo.branchCode,
      channel_code: batchInfo.channelCode,
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

  // ── 2. 전체 행 해시 사전 계산 (CPU, 네트워크 없음) ────────────────────────
  const enriched = rows.map((row, originalIndex) => {
    const normalized = normalizeText(row.review_text)
    const normalized_hash = crypto.createHash('sha256').update(normalized).digest('hex')
    const import_hash = crypto
      .createHash('sha256')
      .update(
        `${batchInfo.branchCode}|${batchInfo.channelCode}|${row.rating ?? ''}|${row.reviewer_name ?? ''}|${normalized}`
      )
      .digest('hex')
    return { ...row, normalized, normalized_hash, import_hash, originalIndex }
  })

  // ── 3. 중복 확인: 개별 SELECT×N 대신 IN(…) 쿼리 3개 병렬 실행 ──────────
  const externalIds = [...new Set(enriched.filter(r => r.external_review_id).map(r => r.external_review_id!))]
  const reviewUrls  = [...new Set(enriched.filter(r => r.review_url).map(r => r.review_url!))]
  const hashes      = [...new Set(enriched.map(r => r.normalized_hash))]

  const [{ data: existingByExtId }, { data: existingByUrl }, { data: existingByHash }] = await Promise.all([
    externalIds.length
      ? supabase
          .from('reviews')
          .select('source_review_id')
          .in('source_review_id', externalIds)
          .eq('branch_code', batchInfo.branchCode)
          .eq('channel_code', batchInfo.channelCode)
      : Promise.resolve({ data: [] as Array<{ source_review_id: string | null }> }),
    reviewUrls.length
      ? supabase.from('reviews').select('review_url').in('review_url', reviewUrls)
      : Promise.resolve({ data: [] as Array<{ review_url: string | null }> }),
    hashes.length
      ? supabase
          .from('reviews')
          .select('normalized_hash')
          .eq('branch_code', batchInfo.branchCode)
          .eq('channel_code', batchInfo.channelCode)
          .in('normalized_hash', hashes)
      : Promise.resolve({ data: [] as Array<{ normalized_hash: string | null }> }),
  ])

  // DB 기존 데이터를 메모리 Set으로 — 이후 조회는 O(1)
  const dupeExtIds = new Set((existingByExtId ?? []).map(r => r.source_review_id).filter(Boolean))
  const dupeUrls   = new Set((existingByUrl   ?? []).map(r => r.review_url).filter(Boolean))
  const dupeHashes = new Set((existingByHash  ?? []).map(r => r.normalized_hash).filter(Boolean))

  // ── 4. 메모리 내 분류 (쿼리 없음) ────────────────────────────────────────
  type Enriched = (typeof enriched)[0]
  const toInsert:     Enriched[]                            = []
  const duplicates:   { row: Enriched; reason: string }[]  = []
  const seenInBatch = new Set<string>() // 파일 내 중복 감지

  for (const row of enriched) {
    let dupeReason: string | null = null

    if (row.external_review_id && dupeExtIds.has(row.external_review_id))
      dupeReason = `external_review_id "${row.external_review_id}" 이미 존재`
    else if (row.review_url && dupeUrls.has(row.review_url))
      dupeReason = 'review_url 이미 존재'
    else if (dupeHashes.has(row.normalized_hash))
      dupeReason = '동일 내용의 리뷰가 이미 존재'
    else if (seenInBatch.has(row.normalized_hash))
      dupeReason = '파일 내 중복 리뷰'

    if (dupeReason) {
      duplicates.push({ row, reason: dupeReason })
    } else {
      seenInBatch.add(row.normalized_hash)
      toInsert.push(row)
    }
  }

  // ── 5. 신규 리뷰 단일 bulk INSERT ─────────────────────────────────────────
  let imported = 0
  let errors = 0
  const errorDetails: string[] = []
  let insertedReviews: Array<{ id: string; import_hash: string }> = []

  if (toInsert.length > 0) {
    const { data, error: bulkError } = await supabase
      .from('reviews')
      .insert(
        toInsert.map(row => ({
          branch_code:           batchInfo.branchCode,
          channel_code:          batchInfo.channelCode,
          rating:                row.rating,
          review_text:           row.review_text,
          review_created_at:     row.review_date || null,
          review_url:            row.review_url,
          reviewer_name:         row.reviewer_name,
          review_language:       row.review_language,
          source_review_id:      row.external_review_id,
          normalized_hash:       row.normalized_hash,
          import_hash:           row.import_hash,
          source_import_batch_id: batch.id,
          status:                'new',
        }))
      )
      .select('id, import_hash')

    if (bulkError) {
      // 드문 경우(경쟁조건 등) — 오류 기록 후 계속
      errors = toInsert.length
      errorDetails.push(`bulk insert 실패: ${bulkError.message}`)
    } else {
      insertedReviews = data ?? []
      imported = insertedReviews.length
    }
  }

  // ── 6. import_rows 단일 bulk INSERT ───────────────────────────────────────
  // import_hash → review.id 역매핑 (정렬 순서에 의존하지 않음)
  const hashToReviewId = new Map(insertedReviews.map(r => [r.import_hash, r.id]))

  const importRowsPayload = [
    // 성공 행
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
    // 중복 행
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
  ]

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
        batch_id:     batch.id,
        branch_code:  batchInfo.branchCode,
        channel_code: batchInfo.channelCode,
        total:        rows.length,
        imported,
        duplicates:   duplicates.length,
        errors,
      },
    }),
  ])

  revalidatePath('/reviews')
  revalidatePath('/dashboard')

  return {
    batchId:      batch.id,
    total:        rows.length,
    imported,
    duplicates:   duplicates.length,
    errors,
    errorDetails,
  }
}

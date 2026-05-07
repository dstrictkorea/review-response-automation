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

  let imported = 0
  let duplicates = 0
  let errors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const normalized = normalizeText(row.review_text)
    const normalized_hash = crypto.createHash('sha256').update(normalized).digest('hex')
    const import_hash = crypto
      .createHash('sha256')
      .update(
        `${batchInfo.branchCode}|${batchInfo.channelCode}|${row.rating ?? ''}|${row.reviewer_name ?? ''}|${normalized}`
      )
      .digest('hex')

    // Duplicate check 1: external_review_id
    if (row.external_review_id) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('source_review_id', row.external_review_id)
        .eq('branch_code', batchInfo.branchCode)
        .eq('channel_code', batchInfo.channelCode)
        .maybeSingle()

      if (existing) {
        await supabase.from('review_import_rows').insert({
          batch_id: batch.id,
          row_index: i,
          source_payload: row.source,
          mapped_payload: row,
          status: 'duplicate',
          error_message: `external_review_id "${row.external_review_id}" 이미 존재`,
          review_id: existing.id,
        })

        await supabase.from('activity_logs').insert({
          review_id: existing.id,
          actor_name: user.email,
          action: 'duplicate_review_skipped',
          detail: { batch_id: batch.id, row_index: i, reason: 'external_review_id' },
        })

        duplicates++
        continue
      }
    }

    // Duplicate check 2: review_url
    if (row.review_url) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('review_url', row.review_url)
        .maybeSingle()

      if (existing) {
        await supabase.from('review_import_rows').insert({
          batch_id: batch.id,
          row_index: i,
          source_payload: row.source,
          mapped_payload: row,
          status: 'duplicate',
          error_message: 'review_url 이미 존재',
          review_id: existing.id,
        })

        duplicates++
        continue
      }
    }

    // Duplicate check 3: normalized_hash (unique per branch+channel+hash)
    const { data: existingByHash } = await supabase
      .from('reviews')
      .select('id')
      .eq('branch_code', batchInfo.branchCode)
      .eq('channel_code', batchInfo.channelCode)
      .eq('normalized_hash', normalized_hash)
      .maybeSingle()

    if (existingByHash) {
      await supabase.from('review_import_rows').insert({
        batch_id: batch.id,
        row_index: i,
        source_payload: row.source,
        mapped_payload: row,
        status: 'duplicate',
        error_message: '동일 내용의 리뷰가 이미 존재',
        review_id: existingByHash.id,
      })

      duplicates++
      continue
    }

    // Insert review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        branch_code: batchInfo.branchCode,
        channel_code: batchInfo.channelCode,
        rating: row.rating,
        review_text: row.review_text,
        review_created_at: row.review_date || null,
        review_url: row.review_url,
        reviewer_name: row.reviewer_name,
        review_language: row.review_language,
        source_review_id: row.external_review_id,
        normalized_hash,
        import_hash,
        source_import_batch_id: batch.id,
        status: 'new',
      })
      .select()
      .single()

    if (reviewError) {
      const isDupe = reviewError.code === '23505'
      await supabase.from('review_import_rows').insert({
        batch_id: batch.id,
        row_index: i,
        source_payload: row.source,
        mapped_payload: row,
        status: isDupe ? 'duplicate' : 'error',
        error_message: isDupe ? '중복 (DB 제약)' : reviewError.message,
      })
      if (isDupe) {
        duplicates++
      } else {
        errors++
        if (errorDetails.length < 5) errorDetails.push(`행 ${i + 2}: ${reviewError.message}`)
      }
      continue
    }

    // Insert import row record and back-link
    const { data: importRow } = await supabase
      .from('review_import_rows')
      .insert({
        batch_id: batch.id,
        row_index: i,
        source_payload: row.source,
        mapped_payload: row,
        status: 'imported',
        review_id: review.id,
      })
      .select()
      .single()

    if (importRow) {
      await supabase
        .from('reviews')
        .update({ source_import_row_id: importRow.id })
        .eq('id', review.id)
    }

    imported++
  }

  // Update batch summary counts
  await supabase
    .from('review_import_batches')
    .update({
      valid_rows: imported + duplicates,
      imported_rows: imported,
      duplicate_rows: duplicates,
      error_rows: errors,
    })
    .eq('id', batch.id)

  await supabase.from('activity_logs').insert({
    review_id: null,
    actor_name: user.email,
    action: 'bulk_import_completed',
    detail: {
      batch_id: batch.id,
      branch_code: batchInfo.branchCode,
      channel_code: batchInfo.channelCode,
      total: rows.length,
      imported,
      duplicates,
      errors,
    },
  })

  revalidatePath('/reviews')
  revalidatePath('/dashboard')

  return { batchId: batch.id, total: rows.length, imported, duplicates, errors, errorDetails }
}

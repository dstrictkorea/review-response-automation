/**
 * syncReviews.ts — Google 리뷰 수집 → DB 적재 → 결정론적 게이트키퍼 처리 (단일 출처)
 *
 * `/api/google/sync`(수동 "리뷰 가져오기")와 `/api/cron/sync-all`(백그라운드 크론)이
 * 모두 이 헬퍼를 사용한다 → 수집된 모든 실제 리뷰가 예외 없이 동일하게
 * 9개 언어 governed 다중 슬롯 + 3-Tier Risk Routing 엔진(`processReviewById`)을 통과한다.
 *
 * 과거: google/sync는 status='new'로 INSERT만 하고 엔진을 호출하지 않아 수동 수집분이
 *       분류·답변 없이 방치되었음(레거시 누락 구간). 이 헬퍼로 그 구간을 차단한다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken, listGoogleReviews } from '@/lib/google/api'
import { processReviewById } from '@/lib/processReviewById'

type Admin = ReturnType<typeof createAdminClient>

/** Google starRating 문자열 → 1–5 숫자. 누락/미상은 null(별점 없음). */
export function starRatingToNumber(star: string | null | undefined): number | null {
  const map: Record<string, number> = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 }
  return map[star ?? ''] ?? null
}

/** source_review_id → 결정론적 해시(중복 차단 키). */
export function makeHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

/**
 * 리뷰 본문 문자체계 기반 언어 감지 — 9개 핵심 답변 언어로 확장.
 * 과거 ko/en 2종 → ko/ja/zh/ru/ar/hi + es/tl 휴리스틱 + en 폴백.
 * (스크립트로 구분 불가한 라틴계열은 es/tl 기능어 휴리스틱, 그 외 en.)
 */
export function detectReviewLanguage(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  if (!t) return null
  if (/[가-힣]/.test(t)) return 'ko'
  if (/[ぁ-ゟ゠-ヿ]/.test(t)) return 'ja'        // 가나 → 일본어 (한자 검사보다 우선)
  if (/[一-鿿]/.test(t)) return 'zh'             // 가나 없는 한자 → 중국어
  if (/[Ѐ-ӿ]/.test(t)) return 'ru'              // 키릴
  if (/[؀-ۿ]/.test(t)) return 'ar'              // 아랍
  if (/[ऀ-ॿ]/.test(t)) return 'hi'              // 데바나가리
  // 라틴계열 — 스페인어/필리핀어 기능어 휴리스틱, 아니면 영어
  if (/\b(?:gracias|pero|muy|tambi[eé]n|experiencia|incre[ií]ble|hermos[oa]|excelente|maravillos[oa])\b/i.test(t)) return 'es'
  if (/\b(?:ang|ng|naman|salamat|maganda|talaga|napaka|sobrang|ganda)\b/i.test(t)) return 'tl'
  return 'en'
}

export interface SyncResult {
  imported: number      // 신규 INSERT(중복 제외) 건수
  orchestrated: number  // 엔진(processReviewById) 처리 성공 건수
}

/**
 * 단일 Google 계정의 리뷰를 수집·적재·엔진 처리한다.
 * @param admin           admin Supabase 클라이언트
 * @param googleAccountId google_accounts.id
 * @param actorName       활동 로그 actor (예: 'system:cron', user email)
 */
export async function syncGoogleAccountReviews(
  admin: Admin,
  googleAccountId: string,
  actorName: string,
): Promise<SyncResult> {
  const { data: ga } = await admin
    .from('google_accounts')
    .select('*')
    .eq('id', googleAccountId)
    .single()

  if (!ga) throw new Error('계정을 찾을 수 없습니다.')
  if (!ga.branch_code) throw new Error('지점(branch_code)이 설정되지 않았습니다.')
  if (!ga.google_location_name) throw new Error('Location name이 설정되지 않았습니다.')

  const token = await getValidAccessToken(googleAccountId)
  let imported = 0
  let nextPageToken: string | undefined
  const newReviewIds: string[] = []  // 진짜 신규(중복 아님) INSERT 된 행 ID

  do {
    const data = await listGoogleReviews(ga.google_location_name, token, nextPageToken)
    const reviews = data.reviews ?? []
    nextPageToken = data.nextPageToken

    for (const review of reviews) {
      const sourceId = review.name
      const hash = makeHash(sourceId)
      const comment = review.comment ?? null

      // ignoreDuplicates:true + .select().maybeSingle() → 신규는 행 반환, 중복은 null
      const { data: upserted, error } = await admin.from('reviews').upsert(
        {
          branch_code:       ga.branch_code,
          channel_code:      'google',
          source_review_id:  sourceId,
          reviewer_name:     review.reviewer?.displayName ?? '익명',
          rating:            starRatingToNumber(review.starRating),
          review_text:       comment,
          review_language:   detectReviewLanguage(comment),
          review_created_at: review.createTime ?? null,
          status:            'new',
          normalized_hash:   hash,
        },
        { onConflict: 'branch_code,channel_code,normalized_hash', ignoreDuplicates: true },
      ).select('id').maybeSingle()

      if (!error && upserted?.id) {
        imported++
        newReviewIds.push(upserted.id)
      }
    }
  } while (nextPageToken)

  await admin
    .from('google_accounts')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', googleAccountId)

  // ── 신규 리뷰 전수 결정론적 게이트키퍼 처리 (동시성 제한 = 3) ─────────────────
  //   분류 → 3-Tier Risk Routing → governed 다중 슬롯 답변 → status/reply_drafts 연산.
  //   한 건 실패가 전체 동기화를 막지 않도록 allSettled.
  let orchestrated = 0
  const CONCURRENCY = 3
  for (let i = 0; i < newReviewIds.length; i += CONCURRENCY) {
    const batch = newReviewIds.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((id) => processReviewById(id, actorName, admin)),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') orchestrated++
      else console.error('[syncGoogleAccountReviews] processReviewById failed:', r.reason)
    }
  }

  return { imported, orchestrated }
}

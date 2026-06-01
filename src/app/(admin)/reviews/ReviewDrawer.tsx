'use client'

/**
 * ReviewDrawer — Context 보존형 우측 슬라이드오버 (Wave 11)
 *
 * 리뷰 클릭 시 페이지 라우팅 없이 우측에서 열리는 패널.
 * 메인 테이블의 스크롤/필터/페이지 상태를 100% 유지합니다.
 *
 * 내부 워크플로우:
 *   - 3대 변형 탭 (짧게 / 표준 / 조심스럽게) 인라인 스위칭
 *   - 선택 변형 → 편집 textarea 바인딩 → 인라인 저장 (reply_drafts.selected_reply)
 *   - 텔레메트리 배지 (인텐트 / 신뢰도 / 파이프라인 / 위험도)
 *   - 전체 상세 페이지 딥링크 (승인·게시 등 고급 워크플로우)
 *
 * 고급 액션(승인/게시/재분석)은 /reviews/[id] 상세 페이지가 계속 담당합니다.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/context/LanguageContext'
import { LANG_LOCALE } from '@/lib/i18n'
import { statusClasses, riskClasses } from '@/lib/badges'
import { intentLabel, intentBadgeClass, inferPipelineEngine } from '@/lib/intents'
import { branchCity } from '@/lib/branches'
import type { Review, ReplyDraft, ReviewStatus, RiskLevel } from '@/types/database'

type DraftTab = 'short' | 'standard' | 'careful'

interface Props {
  review: Review | null
  onClose: () => void
  /** 저장 후 부모가 미리보기 갱신용으로 사용 */
  onSaved?: (reviewId: string, reply: string) => void
}

export default function ReviewDrawer({ review, onClose, onSaved }: Props) {
  const { lang, t } = useLanguage()
  const locale = LANG_LOCALE[lang]
  const supabase = createClient()

  const [show, setShow] = useState(false)
  const [draft, setDraft] = useState<ReplyDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<DraftTab>('standard')
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 슬라이드-인 애니메이션 트리거 (setState는 rAF 콜백 내부 — 닫기는 handleClose가 처리)
  useEffect(() => {
    if (review) requestAnimationFrame(() => setShow(true))
  }, [review])

  // 리뷰 변경 시 전체 draft 로드 (외부 시스템 동기화 — setState는 async 콜백 내부에서 수행)
  useEffect(() => {
    if (!review) return
    let cancelled = false
    ;(async () => {
      setDraft(null)
      setSaved(false)
      setDirty(false)
      setLoading(true)
      const { data } = await supabase
        .from('reply_drafts')
        .select('*')
        .eq('review_id', review.id)
        .maybeSingle()
      if (cancelled) return
      const d = (data as ReplyDraft | null) ?? null
      setDraft(d)
      // 초기 탭: 저장된 selected_draft_type, 없으면 standard
      const initialTab = (d?.selected_draft_type as DraftTab) ?? 'standard'
      setTab(initialTab)
      setText(pickVariant(d, initialTab))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [review]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickVariant(d: ReplyDraft | null, which: DraftTab): string {
    if (!d) return ''
    // 사람이 편집한 답변이 있으면 우선
    if (d.human_edited_reply && which === (d.selected_draft_type as DraftTab)) {
      return d.human_edited_reply
    }
    if (which === 'short')   return d.draft_short ?? ''
    if (which === 'careful') return d.draft_careful ?? ''
    return d.draft_standard ?? ''
  }

  function switchTab(next: DraftTab) {
    setTab(next)
    setText(pickVariant(draft, next))
    setDirty(false)
    setSaved(false)
  }

  function handleClose() {
    setShow(false)
    setTimeout(onClose, 200) // 슬라이드-아웃 후 언마운트
  }

  async function save() {
    if (!review || !draft) return
    setSaving(true)
    try {
      await supabase
        .from('reply_drafts')
        .update({
          selected_reply:      text,
          selected_draft_type: tab,
          human_edited_reply:  text,
          updated_at:          new Date().toISOString(),
        })
        .eq('id', draft.id)
      setSaved(true)
      setDirty(false)
      onSaved?.(review.id, text)
    } catch {
      /* noop */
    }
    setSaving(false)
  }

  if (!review) return null

  const telemetry = draft
    ? inferPipelineEngine({
        pipelineEngine: draft.pipeline_engine,
        modelName:      draft.model_name,
        promptVersion:  draft.prompt_version,
      })
    : null
  const intentCode = draft?.intent_code ?? review.categories?.[0] ?? null
  const intentTxt  = intentLabel(intentCode, lang)
  const confidence = draft?.intent_confidence
  const displayDate = review.review_created_at ?? review.created_at
  const cityName = branchCity(review.branch_code, lang)

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          show ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            {/* 지점 코드를 시각적 중심으로 — 굵은 대문자 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-extrabold uppercase tracking-wider text-gray-900 shrink-0">
                {review.branch_code}
              </span>
              {cityName && <span className="text-xs text-gray-500 shrink-0">{cityName}</span>}
              <span className="text-xs text-gray-300 shrink-0">·</span>
              <span className="text-xs text-gray-500 shrink-0">{review.channel_code}</span>
              {review.rating != null && (
                <span className="text-xs font-semibold text-yellow-500 shrink-0">{review.rating}★</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
              {review.reviewer_name || '—'}
              <span className="ml-2 font-normal text-xs text-gray-400">
                {displayDate ? new Date(displayDate).toLocaleDateString(locale) : ''}
              </span>
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label={t.rv_close}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light shrink-0 ml-3"
          >×</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Telemetry badges */}
          <div className="flex flex-wrap gap-1.5">
            {review.status && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
                {tStatus(t, review.status as ReviewStatus)}
              </span>
            )}
            {review.risk_level && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
                {tRisk(t, review.risk_level as RiskLevel)}
              </span>
            )}
            {intentTxt && (
              <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${intentBadgeClass(intentCode)}`}>
                {intentTxt}
                {typeof confidence === 'number' && (
                  <span className="ml-1 opacity-70">{Math.round(confidence * 100)}%</span>
                )}
              </span>
            )}
            {telemetry && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                telemetry === 'template'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-violet-50 text-violet-700 border border-violet-200'
              }`}>
                {telemetry === 'template' ? '⚡' : '✨'}
                {telemetry === 'template' ? t.rv_pipeline_template : t.rv_pipeline_llm}
              </span>
            )}
          </div>

          {/* Original review */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">{t.rv_original_review}</p>
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 max-h-40 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {review.review_text ?? '—'}
              </p>
            </div>
          </div>

          {/* Draft section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-400">{t.rv_drawer_reply}</p>
            </div>

            {loading ? (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400">…</div>
            ) : draft ? (
              <>
                {/* Variant tabs */}
                <div className="flex gap-1 mb-2">
                  {(['short', 'standard', 'careful'] as DraftTab[]).map((dt) => (
                    <button
                      key={dt}
                      onClick={() => switchTab(dt)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium border transition-colors ${
                        tab === dt
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {dt === 'short' ? t.rv_draft_short : dt === 'careful' ? t.rv_draft_careful : t.rv_draft_standard}
                    </button>
                  ))}
                </div>

                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setDirty(true); setSaved(false) }}
                  rows={8}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none resize-none leading-relaxed"
                />

                {/* CS guide */}
                <p className="mt-1.5 text-xs text-gray-400 leading-snug">💡 {t.rv_cs_guide}</p>

                {/* Save row */}
                <div className="flex items-center justify-end gap-2 mt-2">
                  {dirty && !saved && <span className="text-xs text-amber-500">{t.rv_edited}</span>}
                  {saved ? (
                    <span className="text-xs text-green-600 font-medium">✓ {t.rv_saved}</span>
                  ) : (
                    <button
                      onClick={save}
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? t.rv_saving : t.rv_save}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 py-6 text-center">{t.rv_no_draft}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 shrink-0">
          <Link
            href={`/reviews/${review.id}`}
            className="block w-full text-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t.rv_open_full} →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── 배지 라벨 i18n 헬퍼 (badges.ts 는 한국어 고정이므로 dict로 매핑) ──────────────
import type { I18nDict } from '@/lib/i18n'

function tStatus(t: I18nDict, status: ReviewStatus): string {
  const map: Record<ReviewStatus, string> = {
    new: t.status_new, ai_done: t.status_ai_done, pending_approval: t.status_pending_approval,
    approved: t.status_approved, manual_published: t.status_published, no_reply: t.status_no_reply,
    escalated: t.status_escalated, failed: t.status_failed,
  }
  return map[status] ?? status
}
function tRisk(t: I18nDict, risk: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: t.risk_low, medium: t.risk_medium, high: t.risk_high, critical: t.risk_critical,
  }
  return map[risk]
}

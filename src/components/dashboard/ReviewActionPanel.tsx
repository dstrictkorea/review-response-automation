'use client'

/**
 * ReviewActionPanel — 역할 기반 리뷰 대응 액션 패널 (Wave 5)
 *
 * marketing_staff:
 *   - risk_level === 'low'  → [🟢 최종 승인 및 즉시 게시]
 *   - risk_level !== 'low'  → [🚨 관장 결재 요청] 만 노출 (게시 버튼 숨김)
 *
 * director:
 *   - [✅ 지점장 전결 승인 및 게시]
 *   - [🏢 본사(HQ) 최종 이관]
 *
 * onAction 콜백에서 실제 서버 액션을 수행하도록 부모 컴포넌트가 구현합니다.
 */

import React from 'react'
import type { UserRole, RiskLevel } from '@/types/database'

export type ReviewPanelAction = 'publish' | 'escalate' | 'approve' | 'hq_escalate'

interface Props {
  role: UserRole
  channel: string
  /** 현재 AI 분석된 위험도. null이면 AI 미실행 상태 */
  riskLevel: RiskLevel | null
  /** 현재 액션이 진행 중인지 (버튼 비활성화 용) */
  isLoading?: boolean
  onAction: (action: ReviewPanelAction) => void
}

export default function ReviewActionPanel({
  role,
  channel,
  riskLevel,
  isLoading = false,
  onAction,
}: Props) {
  const isMarketing = role === 'marketing_staff'
  const isLowRisk   = riskLevel === 'low'

  const publishLabel =
    channel === 'google'
      ? '🟢 최종 승인 및 즉시 게시 (Google)'
      : '🟢 최종 승인 및 즉시 게시'

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap gap-3">
      {isMarketing ? (
        <>
          {/* marketing_staff: low risk만 즉시 게시 허용 */}
          {isLowRisk ? (
            <button
              onClick={() => onAction('publish')}
              disabled={isLoading}
              className="flex-1 min-w-[160px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                         text-white text-sm font-medium rounded-lg transition-colors"
            >
              {publishLabel}
            </button>
          ) : (
            /* low risk가 아니면 즉시 게시 버튼 없음 — 안내 문구만 */
            riskLevel !== null && (
              <div className="flex-1 min-w-[200px] rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 font-medium">
                ⚠ {riskLevel === 'critical' ? '위험' : riskLevel === 'high' ? '고위험' : '중위험'} 리뷰 — 관장 결재 필요
              </div>
            )
          )}

          {/* AI 미실행 시 안내 */}
          {riskLevel === null && (
            <div className="flex-1 min-w-[200px] rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-600">
              💡 AI 초안을 먼저 생성하세요
            </div>
          )}

          <button
            onClick={() => onAction('escalate')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-6 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50
                       text-red-600 text-sm font-medium rounded-lg border border-red-200 transition-colors"
          >
            🚨 관장 결재 요청 (리스크·환불)
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onAction('approve')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            ✅ 지점장 전결 승인 및 게시
          </button>
          <button
            onClick={() => onAction('hq_escalate')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            🏢 본사(HQ) 최종 이관
          </button>
        </>
      )}
    </div>
  )
}

'use client'

/**
 * ReviewActionPanel — 역할 기반 리뷰 대응 액션 패널
 *
 * marketing_staff: [즉시 반영/복사] + [관장 결재 요청] 만 노출
 * director:        [지점장 전결 승인 및 게시] + [본사(HQ) 최종 이관] 노출
 *
 * onAction 콜백에서 실제 서버 액션을 수행하도록 부모 컴포넌트가 구현합니다.
 */

import React from 'react'
import type { UserRole } from '@/types/database'

export type ReviewPanelAction = 'publish' | 'escalate' | 'approve' | 'hq_escalate'

interface Props {
  role: UserRole
  channel: string
  /** 현재 액션이 진행 중인지 (버튼 비활성화 용) */
  isLoading?: boolean
  onAction: (action: ReviewPanelAction) => void
}

export default function ReviewActionPanel({ role, channel, isLoading = false, onAction }: Props) {
  const isMarketing = role === 'marketing_staff'

  const publishLabel =
    channel === 'google'
      ? '🟢 검토 완료 — Google 즉시 반영'
      : '📋 답변 복사 및 외부 플랫폼 이동'

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap gap-3">
      {isMarketing ? (
        <>
          <button
            onClick={() => onAction('publish')}
            disabled={isLoading}
            className="flex-1 min-w-[160px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            {publishLabel}
          </button>
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

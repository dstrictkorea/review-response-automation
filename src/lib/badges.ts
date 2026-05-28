import type { ReviewStatus, RiskLevel } from '@/types/database'

export function statusLabel(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    new: '신규',
    ai_done: 'AI 완료',
    pending_approval: 'AI 격리',
    approved: '승인됨',
    manual_published: '게시완료',
    no_reply: '답변불필요',
    escalated: '에스컬레이션',
    failed: '오류',
  }
  return labels[status] ?? status
}

export function statusClasses(status: ReviewStatus): string {
  const classes: Record<ReviewStatus, string> = {
    new: 'bg-blue-100 text-blue-800',
    ai_done: 'bg-purple-100 text-purple-800',
    pending_approval: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    manual_published: 'bg-teal-100 text-teal-800',
    no_reply: 'bg-gray-100 text-gray-700',
    escalated: 'bg-red-100 text-red-800',
    failed: 'bg-rose-100 text-rose-700',
  }
  return classes[status] ?? 'bg-gray-100 text-gray-700'
}

export function riskLabel(risk: RiskLevel | null): string {
  if (!risk) return '-'
  const labels: Record<RiskLevel, string> = {
    low: '낮음',
    medium: '보통',
    high: '높음',
    critical: '위험',
  }
  return labels[risk]
}

export function riskClasses(risk: RiskLevel | null): string {
  if (!risk) return 'bg-gray-100 text-gray-600'
  const classes: Record<RiskLevel, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  return classes[risk]
}

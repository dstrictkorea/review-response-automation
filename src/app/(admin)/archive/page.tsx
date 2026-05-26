import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { statusLabel, statusClasses, riskClasses, riskLabel } from '@/lib/badges'
import type { Review, ReviewStatus, RiskLevel, Sentiment } from '@/types/database'

const sentimentLabel: Record<Sentiment, string> = {
  positive: '긍정',
  neutral: '중립',
  mixed: '복합',
  negative: '부정',
}

export default async function ArchivePage() {
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .in('status', ['manual_published', 'no_reply', 'escalated'])
    .order('updated_at', { ascending: false })

  const archived: Review[] = reviews ?? []

  const stats = {
    total: archived.length,
    published: archived.filter((r) => r.status === 'manual_published').length,
    no_reply: archived.filter((r) => r.status === 'no_reply').length,
    escalated: archived.filter((r) => r.status === 'escalated').length,
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">아카이브</h2>
        <p className="text-sm text-gray-600 mt-1">처리가 완료된 리뷰 전체 이력</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        {[
          { label: '전체 보관', value: stats.total, color: 'text-gray-900' },
          { label: '게시완료', value: stats.published, color: 'text-teal-700' },
          { label: '답변불필요', value: stats.no_reply, color: 'text-gray-600' },
          { label: '에스컬레이션', value: stats.escalated, color: 'text-red-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">처리일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">지점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">별점</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">위험도</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">감성</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">리뷰 미리보기</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {archived.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  아직 보관된 리뷰가 없습니다.
                </td>
              </tr>
            )}
            {archived.map((review) => (
              <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                  {new Date(review.updated_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{review.branch_code}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{review.channel_code}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {review.rating != null ? `${review.rating}★` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(review.status as ReviewStatus)}`}>
                    {statusLabel(review.status as ReviewStatus)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {review.risk_level && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskClasses(review.risk_level as RiskLevel)}`}>
                      {riskLabel(review.risk_level as RiskLevel)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {review.sentiment ? sentimentLabel[review.sentiment] : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                  {review.review_text?.slice(0, 60) ?? '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/reviews/${review.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                    상세보기
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

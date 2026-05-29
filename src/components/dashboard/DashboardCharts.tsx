'use client'

/**
 * DashboardCharts — 지점별 평균 별점 및 리스크 비율 차트
 *
 * recharts를 사용하며 LanguageContext의 lang 값으로 레이블을 전환합니다.
 * allData prop으로 현재 필터링된 리뷰 전체를 받습니다.
 */

import React, { useMemo } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import type { Review } from '@/types/database'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface Props {
  allData: Review[]
}

const LABELS = {
  ko: {
    ratingTitle: '지점별 평균 별점',
    riskTitle: '지점별 고위험 비율',
    rating: '평균 별점',
    riskRate: '고위험 비율 (%)',
    noData: '데이터가 없습니다',
  },
  en: {
    ratingTitle: 'Avg Rating by Branch',
    riskTitle: 'High-Risk Rate by Branch',
    rating: 'Avg Rating',
    riskRate: 'High-Risk Rate (%)',
    noData: 'No data available',
  },
  ja: {
    ratingTitle: '拠点別平均評価',
    riskTitle: '拠点別高リスク割合',
    rating: '平均評価',
    riskRate: '高リスク率 (%)',
    noData: 'データなし',
  },
  zh: {
    ratingTitle: '各地点平均评分',
    riskTitle: '各地点高风险比例',
    rating: '平均评分',
    riskRate: '高风险比例 (%)',
    noData: '暂无数据',
  },
} as const

export default function DashboardCharts({ allData }: Props) {
  const { lang } = useLanguage()
  const t = LABELS[lang] ?? LABELS.ko

  const chartData = useMemo(() => {
    const branchMap: Record<string, { total: number; count: number; highRisk: number }> = {}

    for (const item of allData) {
      if (!item.branch_code) continue
      if (!branchMap[item.branch_code]) {
        branchMap[item.branch_code] = { total: 0, count: 0, highRisk: 0 }
      }
      branchMap[item.branch_code].total += item.rating ?? 0
      branchMap[item.branch_code].count += 1
      if (item.risk_level === 'high' || item.risk_level === 'critical') {
        branchMap[item.branch_code].highRisk += 1
      }
    }

    return Object.entries(branchMap).map(([branch, s]) => ({
      branch,
      [t.rating]: Number((s.count > 0 ? s.total / s.count : 0).toFixed(2)),
      [t.riskRate]: Number((s.count > 0 ? (s.highRisk / s.count) * 100 : 0).toFixed(1)),
    }))
  }, [allData, t])

  if (chartData.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
        {[t.ratingTitle, t.riskTitle].map((title) => (
          <div key={title} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{t.noData}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
      {/* 평균 별점 차트 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.ratingTitle}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${v ?? 0} ★`, t.rating]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={t.rating} fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 고위험 비율 차트 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.riskTitle}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${v ?? 0}%`, t.riskRate]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={t.riskRate} fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

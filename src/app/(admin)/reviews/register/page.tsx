'use client'

import { useActionState } from 'react'
import { createReviewAction } from './actions'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Branch {
  code: string
  name_ko: string
}

interface Channel {
  code: string
  name: string
}

export default function RegisterReviewPage() {
  const [state, action, isPending] = useActionState(createReviewAction, null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('branches').select('code, name_ko').eq('is_active', true).order('code'),
      supabase.from('channels').select('code, name').eq('is_active', true).order('code'),
    ]).then(([b, c]) => {
      setBranches(b.data ?? [])
      setChannels(c.data ?? [])
    })
  }, [])

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reviews" className="text-sm text-gray-500 hover:text-gray-700">
          ← 리뷰 목록
        </Link>
        <span className="text-gray-300">/</span>
        <h2 className="text-xl font-bold text-gray-900">리뷰 등록</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={action} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지점 <span className="text-red-500">*</span>
              </label>
              <select
                name="branch_code"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">지점 선택</option>
                {branches.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.name_ko}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                채널 <span className="text-red-500">*</span>
              </label>
              <select
                name="channel_code"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">채널 선택</option>
                {channels.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                별점 <span className="text-red-500">*</span>
              </label>
              <select
                name="rating"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">별점 선택</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}점 ({n}★)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">리뷰 작성일</label>
              <input
                type="date"
                name="review_created_at"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              리뷰 원문 <span className="text-red-500">*</span>
            </label>
            <textarea
              name="review_text"
              required
              rows={6}
              placeholder="리뷰 내용을 붙여넣으세요."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                리뷰 URL (선택)
              </label>
              <input
                type="url"
                name="review_url"
                placeholder="https://"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                작성자 공개명 (선택)
              </label>
              <input
                type="text"
                name="reviewer_name"
                placeholder="홍길동"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {state?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isPending ? '저장 중...' : '리뷰 등록'}
            </button>
            <Link
              href="/reviews"
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
          </div>
        </form>
      </div>

      <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
        <strong>안내:</strong> 동일한 지점/채널/내용의 리뷰는 중복 등록이 방지됩니다. 등록 후 AI 초안을 생성할 수 있습니다.
      </div>
    </div>
  )
}

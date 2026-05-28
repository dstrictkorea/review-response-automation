'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  parseCSV,
  mapRows,
  generateTemplateCSV,
  FORMAT_META,
  type ImportFormat,
  type ParsedRow,
} from '@/lib/importMapping'
import { importReviewsAction, type ImportResult } from './actions'

interface Branch { code: string; name_ko: string }
interface Channel { code: string; name: string }

const FORMATS: ImportFormat[] = ['standard', 'google', 'naver', 'tripadvisor', 'ota', 'custom']
const MAX_PREVIEW_ROWS = 50
const MAX_IMPORT_ROWS = 500

type Phase = 'setup' | 'preview' | 'importing' | 'done'

export default function ImportReviewsPage() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [branches, setBranches] = useState<Branch[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [branchCode, setBranchCode] = useState('')
  const [channelCode, setChannelCode] = useState('')
  const [importFormat, setImportFormat] = useState<ImportFormat>('standard')
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function handleFileRead(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('CSV 파일만 지원합니다.')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setRawText((e.target?.result as string) ?? '')
      setParseError('')
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileRead(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileRead(file)
  }

  function handleParse() {
    setParseError('')
    if (!branchCode) { setParseError('지점을 선택하세요.'); return }
    if (!channelCode) { setParseError('채널을 선택하세요.'); return }
    if (!rawText.trim()) { setParseError('CSV 데이터를 업로드하거나 붙여넣으세요.'); return }

    const allRows = parseCSV(rawText)
    if (allRows.length < 2) {
      setParseError('헤더 행 + 데이터 행이 최소 1개 필요합니다.')
      return
    }
    if (allRows.length - 1 > MAX_IMPORT_ROWS) {
      setParseError(`최대 ${MAX_IMPORT_ROWS}행까지 한 번에 가져올 수 있습니다. 파일을 분할해 주세요.`)
      return
    }

    const rows = mapRows(allRows, importFormat)
    setParsedRows(rows)
    setPhase('preview')
  }

  async function handleImport() {
    const validRows = parsedRows.filter(r => r.errors.length === 0)
    if (validRows.length === 0) return

    setPhase('importing')

    const result = await importReviewsAction(
      {
        branchCode,
        channelCode,
        importFormat,
        originalFilename: fileName,
      },
      validRows.map(r => ({ ...r.mapped, source: r.source }))
    )

    setImportResult(result)
    setPhase('done')
  }

  function downloadTemplate() {
    const csv = generateTemplateCSV(importFormat)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${importFormat}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setPhase('setup')
    setRawText('')
    setFileName('')
    setParsedRows([])
    setParseError('')
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validCount = parsedRows.filter(r => r.errors.length === 0).length
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length
  const previewRows = parsedRows.slice(0, MAX_PREVIEW_ROWS)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reviews" className="text-sm text-gray-500 hover:text-gray-700">
          ← 리뷰 목록
        </Link>
        <span className="text-gray-300">/</span>
        <h2 className="text-xl font-bold text-gray-900">리뷰 가져오기</h2>
      </div>

      {/* ── Phase: Setup + Upload ── */}
      {(phase === 'setup' || phase === 'preview') && (
        <div className="space-y-4">
          {/* Config */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">1. 가져올 대상 설정</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  지점 <span className="text-red-500">*</span>
                </label>
                <select
                  value={branchCode}
                  onChange={e => setBranchCode(e.target.value)}
                  disabled={phase === 'preview'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                >
                  <option value="">지점 선택</option>
                  {branches.map(b => (
                    <option key={b.code} value={b.code}>{b.code} — {b.name_ko}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  채널 <span className="text-red-500">*</span>
                </label>
                <select
                  value={channelCode}
                  onChange={e => setChannelCode(e.target.value)}
                  disabled={phase === 'preview'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                >
                  <option value="">채널 선택</option>
                  {channels.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">가져오기 형식</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setImportFormat(f); setRawText(''); setFileName(''); setParsedRows([]); if (phase === 'preview') setPhase('setup') }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      importFormat === f
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {FORMAT_META[f].label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={downloadTemplate}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              ↓ CSV 템플릿 다운로드 ({FORMAT_META[importFormat].label})
            </button>
          </div>

          {/* Upload */}
          {phase === 'setup' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">2. CSV 파일 업로드 또는 붙여넣기</h3>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed cursor-pointer transition-colors p-8 text-center mb-4 ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
                {fileName ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fileName}</p>
                    <p className="text-xs text-gray-500 mt-1">다른 파일을 올리려면 클릭 또는 드래그하세요</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">CSV 파일을 드래그하거나 클릭하여 선택</p>
                    <p className="text-xs text-gray-400 mt-1">최대 {MAX_IMPORT_ROWS}행</p>
                  </div>
                )}
              </div>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-gray-400">또는 직접 붙여넣기</span>
                </div>
              </div>

              <textarea
                value={rawText}
                onChange={e => { setRawText(e.target.value); setFileName('') }}
                rows={6}
                placeholder={`${FORMAT_META[importFormat].templateHeaders.join(',')}\n(헤더 포함하여 CSV 형식으로 붙여넣으세요)`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
              />

              {parseError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {parseError}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleParse}
                  className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
                >
                  파일 분석
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {phase === 'preview' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800">3. 미리보기 및 가져오기</h3>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  ← 다시 업로드
                </button>
              </div>

              {/* Summary bar */}
              <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-700">전체 <strong>{parsedRows.length}건</strong></span>
                <span className="text-green-700">유효 <strong>{validCount}건</strong></span>
                {errorCount > 0 && (
                  <span className="text-red-700">오류 <strong>{errorCount}건</strong></span>
                )}
                {parsedRows.length > MAX_PREVIEW_ROWS && (
                  <span className="text-yellow-700 text-xs">처음 {MAX_PREVIEW_ROWS}행만 표시됩니다</span>
                )}
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-gray-500 font-medium w-10">#</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">상태</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">별점</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">작성자</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">작성일</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium min-w-[200px]">리뷰 내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map(row => (
                      <tr
                        key={row.index}
                        className={row.errors.length > 0 ? 'bg-red-50' : ''}
                      >
                        <td className="px-3 py-2 text-gray-400">{row.index + 2}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              ✗ {row.errors.join(', ')}
                            </span>
                          ) : (
                            <span className="text-green-600 font-medium">✓</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.mapped.rating != null ? `${row.mapped.rating}★` : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {row.mapped.reviewer_name ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {row.mapped.review_date ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                          {row.mapped.review_text.slice(0, 80) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {parseError}
                </div>
              )}

              {errorCount > 0 && (
                <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                  오류 행 {errorCount}건은 건너뜁니다. 유효한 {validCount}건만 가져옵니다.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {validCount}건 가져오기
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Phase: Importing ── */}
      {phase === 'importing' && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-600 text-sm">
            <div className="mb-4 flex justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-800 text-base">{validCount}건 가져오는 중...</p>
            <p className="text-xs text-gray-400 mt-2">중복 검사 → 일괄 등록 중입니다. 잠시만 기다려 주세요.</p>
          </div>
        </div>
      )}

      {/* ── Phase: Done ── */}
      {phase === 'done' && importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {importResult.error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
              <strong>가져오기 실패:</strong> {importResult.error}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-5">
                <span className="text-green-600 text-xl">✓</span>
                <h3 className="text-base font-semibold text-gray-900">가져오기 완료</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{importResult.total}</p>
                  <p className="text-xs text-gray-500 mt-1">전체</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-xs text-green-600 mt-1">등록됨</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{importResult.duplicates}</p>
                  <p className="text-xs text-yellow-600 mt-1">중복 건너뜀</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{importResult.errors}</p>
                  <p className="text-xs text-red-600 mt-1">오류</p>
                </div>
              </div>

              {importResult.errorDetails.length > 0 && (
                <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 space-y-1">
                  <p className="font-medium">오류 상세 (최대 5건):</p>
                  {importResult.errorDetails.map((d, i) => (
                    <p key={i}>{d}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Link
                  href="/reviews"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  리뷰 목록 보기
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  추가 가져오기
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Info note */}
      {phase === 'setup' && (
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
          <strong>안내:</strong> 가져온 리뷰는 모두 &lsquo;신규&rsquo; 상태로 등록됩니다. AI 초안 생성 및 발행은 각 리뷰 상세 페이지에서 직접 진행하세요.
          중복 리뷰(동일 ID·URL·내용)는 자동으로 건너뜁니다.
        </div>
      )}
    </div>
  )
}

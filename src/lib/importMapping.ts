export type ImportFormat = 'standard' | 'google' | 'naver' | 'tripadvisor' | 'ota' | 'custom'

export type CanonicalField =
  | 'rating'
  | 'review_text'
  | 'review_date'
  | 'reviewer_name'
  | 'review_url'
  | 'external_review_id'
  | 'review_language'

export interface MappedReviewRow {
  rating: number | null
  review_text: string
  review_date: string | null
  reviewer_name: string | null
  review_url: string | null
  external_review_id: string | null
  review_language: string | null
}

export interface ParsedRow {
  index: number
  source: Record<string, string>
  mapped: MappedReviewRow
  errors: string[]
}

export interface FormatMeta {
  label: string
  templateHeaders: string[]
  exampleRow: string[]
}

// Column name aliases per platform → canonical field (checked case-insensitively)
const FORMAT_ALIASES: Record<ImportFormat, Partial<Record<CanonicalField, string[]>>> = {
  standard: {
    rating: ['rating', '별점', '평점'],
    review_text: ['review_text', 'review', 'comment', '리뷰', '내용', '리뷰내용'],
    review_date: ['review_date', 'date', '작성일', '날짜'],
    reviewer_name: ['reviewer_name', 'reviewer', 'name', '작성자', '닉네임'],
    review_url: ['review_url', 'url'],
    external_review_id: ['external_review_id', 'review_id', 'id'],
    review_language: ['review_language', 'language', '언어'],
  },
  google: {
    rating: ['rating', 'star rating', 'star_rating', '별점'],
    review_text: ['review text', 'review_text', 'review', 'comment', 'body', 'text'],
    review_date: ['date', 'review date', 'review_date', 'published_at', 'published at'],
    reviewer_name: ['reviewer name', 'reviewer_name', 'reviewer', 'name', 'author'],
    review_url: ['url', 'review url', 'review_url', 'link'],
    external_review_id: ['review id', 'review_id', 'id', 'external_review_id'],
    review_language: ['language', 'review_language'],
  },
  naver: {
    rating: ['별점', '평점', 'rating'],
    review_text: ['리뷰', '리뷰내용', '내용', '텍스트', 'review_text', 'review'],
    review_date: ['작성일', '날짜', 'date', 'review_date'],
    reviewer_name: ['작성자', '닉네임', '이름', 'reviewer_name', 'reviewer'],
    review_url: ['url', 'review_url'],
    external_review_id: ['아이디', 'id', 'review_id', 'external_review_id'],
    review_language: ['언어', 'language', 'review_language'],
  },
  tripadvisor: {
    rating: ['rating', 'bubble rating', 'bubble_rating', '별점'],
    review_text: ['review', 'text', 'body', 'comment', 'review_text', 'full review'],
    review_date: ['date', 'review date', 'review_date', 'published date', 'published_date'],
    reviewer_name: ['reviewer', 'reviewer_name', 'author', 'username', 'member'],
    review_url: ['url', 'link', 'review_url', 'review url'],
    external_review_id: ['review id', 'review_id', 'id', 'external_review_id'],
    review_language: ['language', 'review_language'],
  },
  ota: {
    rating: ['score', 'rating', '평점', '점수', 'overall rating'],
    review_text: ['review', 'positive', 'comment', 'text', 'review_text', 'pros', 'feedback'],
    review_date: ['date', 'stay date', 'stay_date', 'review_date', 'check-out date'],
    reviewer_name: ['guest', 'reviewer', 'name', 'reviewer_name', 'guest name'],
    review_url: ['url', 'review_url', 'link'],
    external_review_id: ['booking id', 'booking_id', 'reservation_id', 'id', 'external_review_id'],
    review_language: ['language', 'review_language'],
  },
  custom: {
    rating: ['rating', '별점', '평점'],
    review_text: ['review_text', 'review', 'comment', '리뷰', '내용'],
    review_date: ['review_date', 'date', '작성일'],
    reviewer_name: ['reviewer_name', 'reviewer', '작성자'],
    review_url: ['review_url', 'url'],
    external_review_id: ['external_review_id', 'id'],
    review_language: ['review_language', 'language', '언어'],
  },
}

export const FORMAT_META: Record<ImportFormat, FormatMeta> = {
  standard: {
    label: '표준',
    templateHeaders: ['rating', 'review_text', 'review_date', 'reviewer_name', 'review_url', 'external_review_id', 'review_language'],
    exampleRow: ['5', '정말 멋진 전시였어요!', '2024-01-15', '홍길동', '', 'GR-12345', 'ko'],
  },
  google: {
    label: 'Google 지도',
    templateHeaders: ['Rating', 'Review Text', 'Date', 'Reviewer Name', 'URL', 'Review ID'],
    exampleRow: ['5', 'Amazing exhibition!', '2024-01-15', 'John Doe', 'https://maps.google.com/...', 'ChIJ...'],
  },
  naver: {
    label: '네이버 플레이스',
    templateHeaders: ['별점', '리뷰내용', '작성일', '닉네임', 'url', '아이디'],
    exampleRow: ['5', '정말 멋진 전시였어요!', '2024.01.15', '홍길동', '', ''],
  },
  tripadvisor: {
    label: 'TripAdvisor',
    templateHeaders: ['Rating', 'Review', 'Date', 'Reviewer', 'URL', 'Review ID'],
    exampleRow: ['5', 'Amazing experience', 'January 2024', 'traveler123', '', ''],
  },
  ota: {
    label: 'OTA (Booking.com 등)',
    templateHeaders: ['Score', 'Review', 'Date', 'Guest Name', 'URL', 'Booking ID'],
    exampleRow: ['9', 'Great place to visit', '2024-01-15', '홍길동', '', ''],
  },
  custom: {
    label: '직접 입력',
    templateHeaders: ['rating', 'review_text', 'review_date', 'reviewer_name', 'review_url', 'external_review_id', 'review_language'],
    exampleRow: ['5', '리뷰 내용을 여기에 입력하세요', '2024-01-15', '', '', '', 'ko'],
  },
}

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-]+/g, ' ')
}

function findCanonicalField(header: string, format: ImportFormat): CanonicalField | null {
  const aliases = FORMAT_ALIASES[format]
  const key = normalizeKey(header)
  for (const [field, candidates] of Object.entries(aliases) as [CanonicalField, string[]][]) {
    if (candidates?.some(c => normalizeKey(c) === key)) {
      return field
    }
  }
  return null
}

function parseRating(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Handle "5/5", "5 out of 5", "9.0/10", etc.
  const slashMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+)$/)
  if (slashMatch) {
    const score = parseFloat(slashMatch[1])
    const max = parseFloat(slashMatch[2])
    if (max === 10) return Math.round((score / 10) * 5 * 10) / 10
    return score
  }
  const num = parseFloat(trimmed)
  if (isNaN(num)) return null
  return num
}

function parseDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  // Dot format: 2024.01.15
  if (/^\d{4}\.\d{2}\.\d{2}/.test(trimmed)) return trimmed.slice(0, 10).replace(/\./g, '-')
  // US format: 01/15/2024
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  // EU format: 15/01/2024
  const eu = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (eu) {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  // Try native parsing as fallback (e.g. "January 15, 2024")
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  // Return as-is if unparseable — stored as string for manual fix
  return trimmed
}

export function buildHeaderMapping(headers: string[], format: ImportFormat): Record<string, CanonicalField | null> {
  const result: Record<string, CanonicalField | null> = {}
  for (const h of headers) {
    result[h] = findCanonicalField(h, format)
  }
  return result
}

export function mapRows(
  allRows: string[][],
  format: ImportFormat
): ParsedRow[] {
  if (allRows.length === 0) return []

  const headers = allRows[0].map(h => h.trim())
  const headerMap = buildHeaderMapping(headers, format)
  const dataRows = allRows.slice(1)

  return dataRows.map((cols, i) => {
    const source: Record<string, string> = {}
    headers.forEach((h, j) => {
      source[h] = cols[j]?.trim() ?? ''
    })

    const get = (field: CanonicalField): string => {
      const header = headers.find(h => headerMap[h] === field)
      return header ? (source[header] ?? '') : ''
    }

    const ratingRaw = get('rating')
    const reviewTextRaw = get('review_text')

    const errors: string[] = []
    if (!reviewTextRaw.trim()) errors.push('리뷰 내용 필수')

    const mapped: MappedReviewRow = {
      rating: parseRating(ratingRaw),
      review_text: reviewTextRaw.trim(),
      review_date: parseDate(get('review_date')),
      reviewer_name: get('reviewer_name').trim() || null,
      review_url: get('review_url').trim() || null,
      external_review_id: get('external_review_id').trim() || null,
      review_language: get('review_language').trim() || null,
    }

    return { index: i, source, mapped, errors }
  })
}

export function generateTemplateCSV(format: ImportFormat): string {
  const meta = FORMAT_META[format]
  const header = meta.templateHeaders.map(h => `"${h}"`).join(',')
  const example = meta.exampleRow.map(v => `"${v}"`).join(',')
  return `${header}\n${example}\n`
}

// Robust CSV parser: handles quoted fields, embedded commas, embedded newlines, \r\n
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(field)
        field = ''
        if (row.some(f => f.trim() !== '')) rows.push(row)
        row = []
      } else {
        field += ch
      }
    }
    i++
  }

  row.push(field)
  if (row.some(f => f.trim() !== '')) rows.push(row)

  return rows
}

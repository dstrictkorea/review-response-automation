export type ReviewStatus =
  | 'new'
  | 'ai_done'
  | 'pending_approval'  // AI auto-isolated: medium/high/critical risk or forbidden flag triggered
  | 'approved'
  | 'manual_published'
  | 'no_reply'
  | 'escalated'
  | 'failed'            // sync/processing error

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type Sentiment = 'positive' | 'neutral' | 'mixed' | 'negative'

export interface Branch {
  id: string
  code: string
  name_ko: string
  name_en: string | null
  default_language: string
  is_active: boolean
  created_at: string
}

export interface Channel {
  id: string
  code: string
  name: string
  collection_mode: string
  publish_mode: string
  is_active: boolean
  api_enabled: boolean
}

export interface Review {
  id: string
  branch_code: string
  channel_code: string
  source_review_id: string | null
  review_url: string | null
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  review_language: string | null
  review_created_at: string | null
  status: ReviewStatus
  risk_level: RiskLevel | null
  categories: string[] | null
  risk_reasons: string[] | null
  sentiment: Sentiment | null
  internal_note_ko: string | null
  normalized_hash: string
  import_hash: string | null
  source_import_batch_id: string | null
  source_import_row_id: string | null
  created_at: string
  updated_at: string
}

export interface ReplyDraft {
  id: string
  review_id: string
  draft_short: string | null
  draft_standard: string | null
  draft_careful: string | null
  selected_draft_type: string | null
  selected_reply: string | null
  human_edited_reply: string | null
  forbidden_check: ForbiddenCheck | null
  prompt_version: string | null
  model_name: string | null
  created_at: string
  updated_at: string
}

export interface ForbiddenCheck {
  refund_promise: boolean
  legal_admission: boolean
  cctv_mention: boolean
  staff_discipline: boolean
}

export interface AppSetting {
  id: string
  key: string
  value: unknown
  description: string | null
  updated_by: string | null
  updated_at: string
}

export interface ActivityLog {
  id: string
  review_id: string | null
  actor_name: string | null
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

export interface RiskKeyword {
  id: string
  keyword: string
  language: string
  risk_level: RiskLevel
  action: string
  is_active: boolean
}

export interface ReplyTemplate {
  id: string
  name: string
  language: string
  category: string
  content: string
}

export interface ReviewImportBatch {
  id: string
  branch_code: string
  channel_code: string
  import_format: string
  original_filename: string | null
  total_rows: number
  valid_rows: number
  duplicate_rows: number
  error_rows: number
  imported_rows: number
  created_by: string | null
  created_at: string
}

export interface ReviewImportRow {
  id: string
  batch_id: string
  row_index: number
  source_payload: Record<string, unknown> | null
  mapped_payload: Record<string, unknown> | null
  status: 'pending' | 'imported' | 'duplicate' | 'error'
  error_message: string | null
  review_id: string | null
  created_at: string
}

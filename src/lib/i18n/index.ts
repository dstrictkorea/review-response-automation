/**
 * i18n dictionaries — ko / en / ja / zh
 *
 * Used by the LanguageContext (src/context/LanguageContext.tsx).
 * Client components call `useLanguage()` to get the current dict.
 * Server components remain Korean-first.
 */

export type Language = 'ko' | 'en' | 'ja' | 'zh'

export const LANG_LABELS: Record<Language, string> = {
  ko: '한국어',
  en: 'EN',
  ja: '日本語',
  zh: '中文',
}

/** Locale string for toLocaleDateString() */
export const LANG_LOCALE: Record<Language, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
}

export interface I18nDict {
  // ── Sidebar navigation ──────────────────────────────────────────────────────
  nav_dashboard: string
  nav_reviews: string
  nav_import: string
  nav_register: string
  nav_archive: string
  nav_settings: string
  nav_google: string
  nav_users: string
  nav_rules: string
  nav_admin_section: string
  nav_admin_badge: string
  nav_signout: string

  // ── Dashboard period presets ────────────────────────────────────────────────
  period_all: string
  period_today: string
  period_1w: string
  period_1m: string
  period_3m: string
  period_6m: string
  period_1y: string
  period_ytd: string
  period_custom: string

  // ── Dashboard stat cards ────────────────────────────────────────────────────
  stat_period_label: string
  stat_avg_rating: string
  stat_per_5: string
  stat_rating_basis: string
  stat_response_rate: string
  stat_published_of: string
  stat_new: string
  stat_ai_done: string
  stat_pending_approval: string
  stat_escalated: string
  stat_high_risk: string
  stat_unit: string

  // ── Dashboard global filter bar ─────────────────────────────────────────────
  filter_branch_label: string
  filter_channel_label: string
  filter_reset: string
  filter_all: string
  filter_channel_google: string
  filter_channel_manual: string
  filter_active_label: string

  // ── Dashboard page — title & sections ───────────────────────────────────────
  dash_title: string
  dash_subtitle: string

  // Director isolated section
  dash_isolated_title: string
  dash_isolated_desc: string
  dash_view_all_isolated: string

  // Table column headers (shared: isolated + recent activity)
  dash_col_risk: string
  dash_col_branch: string
  dash_col_channel: string
  dash_col_rating: string
  dash_col_date: string
  dash_col_preview: string
  dash_col_status: string
  dash_col_review: string

  // Review action link
  dash_review_link: string

  // Pending reviews section
  dash_pending_title: string
  dash_pending_hint: string
  dash_pending_view_all: string
  dash_filter_active: string
  dash_prev: string
  dash_next: string
  dash_no_pending: string
  dash_no_pending_filtered: string
  dash_all_done: string

  // Recent activity section
  dash_recent_title: string
  dash_view_all: string

  // ── Status badge labels ─────────────────────────────────────────────────────
  status_new: string
  status_ai_done: string
  status_pending_approval: string
  status_approved: string
  status_published: string
  status_no_reply: string
  status_escalated: string
  status_failed: string

  // ── Risk level labels ───────────────────────────────────────────────────────
  risk_low: string
  risk_medium: string
  risk_high: string
  risk_critical: string

  // ── Reviews list view (Wave 11) ──────────────────────────────────────────────
  rv_col_date: string
  rv_col_elapsed: string
  rv_col_branch: string
  rv_col_channel: string
  rv_col_rating: string
  rv_col_status: string
  rv_col_risk: string
  rv_col_intent: string
  rv_col_pipeline: string
  rv_col_preview: string
  rv_view_detail: string
  rv_pipeline_template: string
  rv_pipeline_llm: string
  rv_empty: string
  rv_today: string
  rv_filter_status: string
  rv_filter_rating: string
  rv_filter_risk: string
  rv_filter_reset: string
  rv_per_page: string
  rv_prev: string
  rv_next: string
  // batch
  rv_batch_selected: string
  rv_draft_type: string
  rv_generate: string
  rv_deselect: string
  rv_processing: string
  rv_cancel: string
  rv_draft_standard: string
  rv_draft_short: string
  rv_draft_careful: string
  // drawer
  rv_drawer_reply: string
  rv_save: string
  rv_saving: string
  rv_saved: string
  rv_edited: string
  rv_open_full: string
  rv_close: string
  rv_confidence: string
  rv_cs_guide: string
  rv_original_review: string
  rv_no_draft: string

  // ── Branch grouping (Wave 12) ────────────────────────────────────────────────
  rv_group_domestic: string
  rv_group_global: string
  rv_group_all: string

  // ── Review detail page (Wave 12) ─────────────────────────────────────────────
  rd_isolated_title: string
  rd_isolated_desc: string
  rd_risk_reasons: string
  rd_forbidden_detected: string
  rd_sla_title: string
  rd_sla_desc: string            // {days}
  rd_label_risk: string
  rd_label_sentiment: string
  rd_label_branch: string
  rd_label_channel: string
  rd_label_rating: string
  rd_label_date: string
  rd_label_reviewer: string
  rd_review_original: string
  rd_ai_note: string
  rd_highrisk_title: string
  rd_highrisk_desc: string
  rd_ai_draft_title: string
  rd_generate: string
  rd_generating: string
  rd_regenerate: string
  rd_reanalyze: string
  rd_analyzing: string
  rd_reanalyze_title: string
  rd_tab_standard: string
  rd_tab_short: string
  rd_tab_careful: string
  rd_no_draft_variant: string
  rd_apply_to_editor: string
  rd_forbidden_check: string
  rd_no_draft_yet: string
  rd_final_edit: string
  rd_copy_reply: string
  rd_editor_placeholder: string
  rd_chars: string               // {n}
  rd_temp_save: string
  rd_advanced: string
  rd_approve: string
  rd_google_post: string
  rd_posting: string
  rd_copy_and_open: string
  rd_copy_and_open_title: string // {channel}
  rd_copy_only_title: string
  rd_mark_published_manual: string
  rd_mark_published: string
  rd_no_reply: string
  rd_escalate: string
  rd_danger_zone: string
  rd_delete: string
  rd_delete_confirm_title: string
  rd_delete_confirm_desc: string
  rd_deleting: string
  rd_delete_confirm_btn: string
  rd_cancel: string
  rd_history: string
  rd_no_history: string
  // forbidden labels
  rd_fb_refund: string
  rd_fb_legal: string
  rd_fb_cctv: string
  rd_fb_staff: string
  // sentiment
  rd_sent_positive: string
  rd_sent_neutral: string
  rd_sent_mixed: string
  rd_sent_negative: string
  // activity log labels
  rd_act_registered: string
  rd_act_ai_generated: string
  rd_act_edited: string
  rd_act_approved: string
  rd_act_escalated: string
  rd_act_no_reply: string
  rd_act_published: string
  // revert labels
  rd_revert_to_new: string
  rd_revert_to_ai_done: string
  rd_revert_to_approved: string
  // toasts / confirms
  rd_toast_copied: string
  rd_toast_gen_fail: string
  rd_toast_server_err: string
  rd_toast_enter_reply: string
  rd_confirm_google: string
  rd_toast_google_fail: string   // {error}
  rd_toast_google_ok: string
  rd_toast_copy_opened: string
  rd_toast_copy_manual: string
  rd_confirm_publish: string     // {channel}
  rd_toast_publish_fail: string  // {error}
  rd_toast_published: string
  rd_toast_reanalyze_fail: string
  rd_toast_error: string         // {error}
  rd_toast_request_director: string
  rd_toast_approve_publish: string
  rd_toast_hq_escalate: string
  rd_toast_approved: string
  rd_toast_mark_published: string
  rd_toast_mark_no_reply: string
  rd_toast_escalated: string
  rd_toast_reverted: string
  rd_toast_temp_saved: string
  rd_unknown_error: string

  // ── Reviews list filter panel (Wave 13) ──────────────────────────────────────
  rv_list_title: string
  rv_total_word: string
  rv_search_label: string
  rv_search_ph: string
  rv_date_from: string
  rv_date_to: string
  rv_apply: string
  rv_import_csv: string
  rv_register_one: string
  rv_export_excel: string
  rv_class_reason: string

  // ── Bulk selection / soft-delete (Wave 15) ───────────────────────────────────
  rv_bulk_page_selected: string  // {n}
  rv_bulk_select_all: string     // {x}
  rv_bulk_all_selected: string   // {x}
  rv_bulk_clear: string
  rv_delete_selected: string     // {n}
  rv_del_confirm_title: string   // {n}
  rv_del_confirm_desc: string
  rv_deleting: string
  rv_del_done: string            // {n}
  rv_del_confirm_btn: string
  rv_archive_reason: string

  // ── Archive view / restore / hard delete (Wave 17) ───────────────────────────
  arch_title: string
  arch_subtitle: string
  arch_search_ph: string
  arch_branch_all: string
  arch_apply: string
  arch_reset: string
  arch_empty: string
  arch_restore_selected: string     // {n}
  arch_harddelete_selected: string  // {n}
  arch_restoring: string
  arch_deleting: string
  arch_restore_done: string         // {n}
  arch_harddelete_done: string      // {n}
  arch_restore_confirm_title: string // {n}
  arch_restore_confirm_desc: string
  arch_restore_confirm_btn: string
  arch_hard_title1: string          // {n}
  arch_hard_desc1: string
  arch_hard_next: string
  arch_hard_title2: string          // {n}
  arch_hard_desc2: string
  arch_hard_ack: string
  arch_hard_confirm_btn: string
  arch_hard_cap_warn: string        // {max}
  arch_hard_no_selectall: string
  arch_hard_all_warn: string        // {n} — 관리자 전체선택 영구삭제 경고
}

export const DICT: Record<Language, I18nDict> = {
  ko: {
    nav_dashboard: '대시보드',
    nav_reviews: '리뷰 목록',
    nav_import: '리뷰 가져오기',
    nav_register: '1건 수동 입력',
    nav_archive: '아카이브',
    nav_settings: '설정',
    nav_google: 'Google 연동',
    nav_users: '사용자 관리',
    nav_rules: '규칙 엔진',
    nav_admin_section: '관리',
    nav_admin_badge: '관리자',
    nav_signout: '로그아웃',

    period_all: '전체',
    period_today: '오늘',
    period_1w: '1주',
    period_1m: '1달',
    period_3m: '3개월',
    period_6m: '6개월',
    period_1y: '1년',
    period_ytd: 'YTD',
    period_custom: '직접 설정',

    stat_period_label: '기간',
    stat_avg_rating: '평균 별점',
    stat_per_5: '/ 5.0',
    stat_rating_basis: '건 기준',
    stat_response_rate: '응답률',
    stat_published_of: '건 게시 완료 /',
    stat_new: '신규 — 답변 대기',
    stat_ai_done: 'AI 초안 완료',
    stat_pending_approval: 'AI 격리 — 2차 확인',
    stat_escalated: '에스컬레이션',
    stat_high_risk: '고위험',
    stat_unit: '건',

    filter_branch_label: '지점',
    filter_channel_label: '채널',
    filter_reset: '초기화',
    filter_all: '전체',
    filter_channel_google: 'Google',
    filter_channel_manual: '직접 입력',
    filter_active_label: '필터 적용 중',

    dash_title: '대시보드',
    dash_subtitle: '리뷰 응대 현황 요약',

    dash_isolated_title: '고위험 격리 리뷰',
    dash_isolated_desc: 'AI·필터 자동 격리 — 관장 검토 필요',
    dash_view_all_isolated: '전체 보기 →',

    dash_col_risk: '위험도',
    dash_col_branch: '지점',
    dash_col_channel: '채널',
    dash_col_rating: '별점',
    dash_col_date: '작성일',
    dash_col_preview: '리뷰 미리보기',
    dash_col_status: '상태',
    dash_col_review: '리뷰',

    dash_review_link: '🔍 검토 →',

    dash_pending_title: '처리 대기 리뷰',
    dash_pending_hint: '체크박스 선택 후 일괄 답변 생성',
    dash_pending_view_all: '전체 리뷰 보기 →',
    dash_filter_active: '필터 적용',
    dash_prev: '← 이전',
    dash_next: '다음 →',
    dash_no_pending: '처리 대기 중인 리뷰가 없습니다 ✓',
    dash_no_pending_filtered: '선택한 필터 조건에 해당하는 대기 리뷰가 없습니다.',
    dash_all_done: '모든 리뷰가 처리된 상태입니다.',

    dash_recent_title: '최근 처리 완료',
    dash_view_all: '전체 보기',

    status_new: '신규',
    status_ai_done: 'AI 완료',
    status_pending_approval: 'AI 격리',
    status_approved: '승인됨',
    status_published: '게시완료',
    status_no_reply: '답변불필요',
    status_escalated: '에스컬레이션',
    status_failed: '오류',

    risk_low: '낮음',
    risk_medium: '보통',
    risk_high: '높음',
    risk_critical: '위험',

    rv_col_date: '작성일',
    rv_col_elapsed: '경과',
    rv_col_branch: '지점',
    rv_col_channel: '채널',
    rv_col_rating: '별점',
    rv_col_status: '상태',
    rv_col_risk: '위험도',
    rv_col_intent: '인텐트',
    rv_col_pipeline: '파이프라인',
    rv_col_preview: '리뷰 / 답변 초안',
    rv_view_detail: '상세',
    rv_pipeline_template: '템플릿',
    rv_pipeline_llm: 'AI',
    rv_empty: '해당 조건의 리뷰가 없습니다.',
    rv_today: '오늘',
    rv_filter_status: '상태',
    rv_filter_rating: '별점',
    rv_filter_risk: '위험도',
    rv_filter_reset: '초기화',
    rv_per_page: '쪽당',
    rv_prev: '이전',
    rv_next: '다음',
    rv_batch_selected: '신규 선택',
    rv_draft_type: '답변 유형',
    rv_generate: 'AI 초안 생성',
    rv_deselect: '선택 해제',
    rv_processing: '처리 중',
    rv_cancel: '취소',
    rv_draft_standard: '표준',
    rv_draft_short: '짧게',
    rv_draft_careful: '조심스럽게',
    rv_drawer_reply: '답변 초안',
    rv_save: '저장',
    rv_saving: '저장 중...',
    rv_saved: '저장됨',
    rv_edited: '수정됨',
    rv_open_full: '전체 상세 페이지 열기',
    rv_close: '닫기',
    rv_confidence: '신뢰도',
    rv_cs_guide: '불편/개선 의견에는 변명 없이 "경청하고 개선하겠다"는 뉘앙스를 유지하세요.',
    rv_original_review: '원문 리뷰',
    rv_no_draft: '아직 생성된 답변 초안이 없습니다.',

    rv_group_domestic: '국내 지점',
    rv_group_global: '글로벌 지점',
    rv_group_all: '전체',

    rd_isolated_title: 'AI 격리됨 — 2차 검토 필요',
    rd_isolated_desc: '이 리뷰는 AI가 위험 요소를 감지하여 자동 격리했습니다. 반드시 직접 검토 후 승인하세요.',
    rd_risk_reasons: '위험 사유',
    rd_forbidden_detected: '⛔ 금지 표현 감지',
    rd_sla_title: '응답 지연 주의',
    rd_sla_desc: '이 리뷰가 작성된 지 {days}일이 지났습니다. 빠른 답변 처리가 필요합니다.',
    rd_label_risk: '위험도',
    rd_label_sentiment: '감성',
    rd_label_branch: '지점',
    rd_label_channel: '채널',
    rd_label_rating: '별점',
    rd_label_date: '작성일',
    rd_label_reviewer: '작성자',
    rd_review_original: '리뷰 원문',
    rd_ai_note: 'AI 내부 메모',
    rd_highrisk_title: '⚠ 고위험 리뷰',
    rd_highrisk_desc: '이 리뷰는 고위험으로 분류되었습니다. 반드시 직접 검토 후 답변을 작성하세요. 환불 약속, 법적 책임 인정, CCTV 확인, 직원 징계 약속은 절대 포함하지 마세요.',
    rd_ai_draft_title: 'AI 답변 초안',
    rd_generate: 'AI 초안 생성',
    rd_generating: '생성 중...',
    rd_regenerate: 'AI 재생성',
    rd_reanalyze: '🔄 AI 재분석',
    rd_analyzing: '분석 중...',
    rd_reanalyze_title: 'IntelligentOrchestrator로 AI 재분석 — 위험도 재평가 및 초안 재생성',
    rd_tab_standard: '표준',
    rd_tab_short: '짧게',
    rd_tab_careful: '조심스럽게',
    rd_no_draft_variant: '해당 초안이 없습니다.',
    rd_apply_to_editor: '편집란에 적용',
    rd_forbidden_check: '금지 표현 검사',
    rd_no_draft_yet: '아직 AI 초안이 없습니다. 위 버튼을 눌러 생성하세요.',
    rd_final_edit: '최종 답변 편집',
    rd_copy_reply: '답변 복사',
    rd_editor_placeholder: '여기에 최종 답변을 작성하거나 붙여넣으세요. 외부 플랫폼에 직접 복사하여 게시하세요.',
    rd_chars: '{n}자',
    rd_temp_save: '임시 저장',
    rd_advanced: '고급 처리 옵션',
    rd_approve: '승인',
    rd_google_post: '🔵 Google에 직접 게시',
    rd_posting: '게시 중...',
    rd_copy_and_open: '📋 답변 복사 + 관리자 이동',
    rd_copy_and_open_title: '답변을 복사하고 {channel} 관리자 페이지를 새 탭으로 엽니다',
    rd_copy_only_title: '답변을 클립보드에 복사합니다',
    rd_mark_published_manual: '수동 게시 완료 처리',
    rd_mark_published: '✓ 게시 완료 처리',
    rd_no_reply: '답변 불필요',
    rd_escalate: '에스컬레이션',
    rd_danger_zone: '위험 구역',
    rd_delete: '리뷰 삭제',
    rd_delete_confirm_title: '정말 삭제하시겠습니까?',
    rd_delete_confirm_desc: '이 리뷰와 관련된 모든 초안, 처리 이력이 영구 삭제됩니다. 되돌릴 수 없습니다.',
    rd_deleting: '삭제 중...',
    rd_delete_confirm_btn: '삭제 확인',
    rd_cancel: '취소',
    rd_history: '처리 이력',
    rd_no_history: '이력이 없습니다.',
    rd_fb_refund: '환불 약속',
    rd_fb_legal: '법적 책임 인정',
    rd_fb_cctv: 'CCTV 언급',
    rd_fb_staff: '직원 징계 약속',
    rd_sent_positive: '긍정',
    rd_sent_neutral: '중립',
    rd_sent_mixed: '복합',
    rd_sent_negative: '부정',
    rd_act_registered: '리뷰 등록',
    rd_act_ai_generated: 'AI 초안 생성',
    rd_act_edited: '답변 수정',
    rd_act_approved: '승인',
    rd_act_escalated: '에스컬레이션',
    rd_act_no_reply: '답변 불필요 처리',
    rd_act_published: '게시 완료',
    rd_revert_to_new: '신규로 되돌리기',
    rd_revert_to_ai_done: 'AI완료로 되돌리기',
    rd_revert_to_approved: '승인됨으로 되돌리기',
    rd_toast_copied: '클립보드에 복사되었습니다.',
    rd_toast_gen_fail: 'AI 초안 생성에 실패했습니다.',
    rd_toast_server_err: '서버 오류가 발생했습니다.',
    rd_toast_enter_reply: '게시할 답변을 입력해주세요.',
    rd_confirm_google: 'Google 비즈니스 프로필에 이 답변을 직접 게시하시겠습니까?\n게시 후에는 Google에서 직접 수정해야 합니다.',
    rd_toast_google_fail: 'Google 게시 실패: {error}',
    rd_toast_google_ok: 'Google에 성공적으로 게시되었습니다!',
    rd_toast_copy_opened: '✓ 답변 복사 완료 — 새 탭이 열렸습니다. 붙여넣기 후 "게시 완료 처리"를 눌러주세요.',
    rd_toast_copy_manual: '✓ 답변 복사 완료 — 플랫폼 관리자 페이지에 접속해 붙여넣기 후 "게시 완료 처리"를 눌러주세요.',
    rd_confirm_publish: '이 답변을 {channel}에 게시하시겠습니까?',
    rd_toast_publish_fail: '게시 실패: {error}',
    rd_toast_published: '✅ 게시 완료!',
    rd_toast_reanalyze_fail: 'AI 재분석에 실패했습니다.',
    rd_toast_error: '오류: {error}',
    rd_toast_request_director: '관장 결재 요청이 접수되었습니다.',
    rd_toast_approve_publish: '지점장 전결 승인 및 게시 완료 처리되었습니다.',
    rd_toast_hq_escalate: '본사(HQ) 이관 처리되었습니다.',
    rd_toast_approved: '답변이 승인되었습니다.',
    rd_toast_mark_published: '게시 완료 처리되었습니다.',
    rd_toast_mark_no_reply: '답변 불필요 처리되었습니다.',
    rd_toast_escalated: '에스컬레이션 처리되었습니다.',
    rd_toast_reverted: '상태가 되돌려졌습니다.',
    rd_toast_temp_saved: '임시 저장되었습니다.',
    rd_unknown_error: '알 수 없는 오류',

    rv_list_title: '리뷰 목록',
    rv_total_word: '총',
    rv_search_label: '리뷰 내용 / 작성자 검색',
    rv_search_ph: '검색어 (리뷰 내용, 작성자명, 지점/채널 코드)',
    rv_date_from: '리뷰 작성일 (시작)',
    rv_date_to: '리뷰 작성일 (종료)',
    rv_apply: '필터 적용',
    rv_import_csv: 'CSV 가져오기',
    rv_register_one: '+ 1건 등록',
    rv_export_excel: 'Excel 다운로드',
    rv_class_reason: '분류 사유',
    rv_bulk_page_selected: '이 페이지의 {n}개 리뷰가 선택되었습니다.',
    rv_bulk_select_all: '필터 조건에 맞는 전체 {x}개 리뷰 선택',
    rv_bulk_all_selected: '필터 조건에 맞는 전체 {x}개 리뷰가 선택되었습니다.',
    rv_bulk_clear: '선택 해제',
    rv_delete_selected: '삭제 ({n})',
    rv_del_confirm_title: '리뷰 {n}건을 삭제하시겠습니까?',
    rv_del_confirm_desc: '삭제된 리뷰는 목록·대시보드에서 숨겨지고 아카이브(보관함)로 이동합니다. 감사 추적 이력은 보존됩니다.',
    rv_deleting: '삭제 중...',
    rv_del_done: '리뷰 {n}건이 삭제되었습니다.',
    rv_del_confirm_btn: '삭제 확인',
    rv_archive_reason: '보관 사유',

    arch_title: '아카이브 (보관함)',
    arch_subtitle: '삭제된 리뷰 보관 — 복구하거나 영구 삭제할 수 있습니다',
    arch_search_ph: '검색어 (리뷰 내용, 작성자명, 지점/채널 코드)',
    arch_branch_all: '전체 지점',
    arch_apply: '검색',
    arch_reset: '초기화',
    arch_empty: '보관함이 비어 있습니다.',
    arch_restore_selected: '복구 ({n})',
    arch_harddelete_selected: '영구 삭제 ({n})',
    arch_restoring: '복구 중...',
    arch_deleting: '영구 삭제 중...',
    arch_restore_done: '{n}건이 복구되었습니다.',
    arch_harddelete_done: '{n}건이 영구 삭제되었습니다.',
    arch_restore_confirm_title: '{n}건을 복구하시겠습니까?',
    arch_restore_confirm_desc: '복구된 리뷰는 다시 리뷰 목록과 대시보드에 표시됩니다.',
    arch_restore_confirm_btn: '복구',
    arch_hard_title1: '{n}건을 영구 삭제하시겠습니까?',
    arch_hard_desc1: '영구 삭제된 리뷰와 관련 답변 초안은 데이터베이스에서 완전히 제거되며 복구할 수 없습니다. 감사 로그 기록만 보존됩니다.',
    arch_hard_next: '다음 단계',
    arch_hard_title2: '정말로 {n}건을 영구 삭제합니까?',
    arch_hard_desc2: '이 작업은 되돌릴 수 없습니다. 데이터가 영구적으로 사라집니다.',
    arch_hard_ack: '되돌릴 수 없음을 이해했으며, 영구 삭제에 동의합니다.',
    arch_hard_confirm_btn: '영구 삭제 확정',
    arch_hard_cap_warn: '영구 삭제는 한 번에 최대 {max}건까지 가능합니다. 선택을 줄여주세요.',
    arch_hard_no_selectall: '안전을 위해 "전체 선택" 상태에서는 영구 삭제할 수 없습니다. 개별 항목을 선택해주세요.',
    arch_hard_all_warn: '필터 조건 전체 {n}건이 영구 삭제됩니다. 되돌릴 수 없습니다.',
  },

  en: {
    nav_dashboard: 'Dashboard',
    nav_reviews: 'Reviews',
    nav_import: 'Import',
    nav_register: 'Manual Entry',
    nav_archive: 'Archive',
    nav_settings: 'Settings',
    nav_google: 'Google',
    nav_users: 'Users',
    nav_rules: 'Rules Engine',
    nav_admin_section: 'Admin',
    nav_admin_badge: 'Admin',
    nav_signout: 'Sign Out',

    period_all: 'All',
    period_today: 'Today',
    period_1w: '1 Week',
    period_1m: '1 Month',
    period_3m: '3 Months',
    period_6m: '6 Months',
    period_1y: '1 Year',
    period_ytd: 'YTD',
    period_custom: 'Custom',

    stat_period_label: 'Period',
    stat_avg_rating: 'Avg Rating',
    stat_per_5: '/ 5.0',
    stat_rating_basis: 'reviews',
    stat_response_rate: 'Response Rate',
    stat_published_of: 'published /',
    stat_new: 'New — Pending',
    stat_ai_done: 'AI Draft Ready',
    stat_pending_approval: 'AI Isolated',
    stat_escalated: 'Escalated',
    stat_high_risk: 'High Risk',
    stat_unit: '',

    filter_branch_label: 'Branch',
    filter_channel_label: 'Channel',
    filter_reset: 'Reset',
    filter_all: 'All',
    filter_channel_google: 'Google',
    filter_channel_manual: 'Manual',
    filter_active_label: 'filter active',

    dash_title: 'Dashboard',
    dash_subtitle: 'Review management overview',

    dash_isolated_title: 'High-Risk Isolated Reviews',
    dash_isolated_desc: 'Auto-isolated by AI·filter — Director review required',
    dash_view_all_isolated: 'View All →',

    dash_col_risk: 'Risk',
    dash_col_branch: 'Branch',
    dash_col_channel: 'Channel',
    dash_col_rating: 'Rating',
    dash_col_date: 'Date',
    dash_col_preview: 'Review Preview',
    dash_col_status: 'Status',
    dash_col_review: 'Review',

    dash_review_link: '🔍 Review →',

    dash_pending_title: 'Pending Reviews',
    dash_pending_hint: 'Select and batch generate replies',
    dash_pending_view_all: 'View All Reviews →',
    dash_filter_active: 'filter active',
    dash_prev: '← Prev',
    dash_next: 'Next →',
    dash_no_pending: 'No pending reviews ✓',
    dash_no_pending_filtered: 'No matching reviews for the active filter.',
    dash_all_done: 'All reviews have been processed.',

    dash_recent_title: 'Recently Completed',
    dash_view_all: 'View All',

    status_new: 'New',
    status_ai_done: 'AI Draft',
    status_pending_approval: 'AI Isolated',
    status_approved: 'Approved',
    status_published: 'Published',
    status_no_reply: 'No Reply',
    status_escalated: 'Escalated',
    status_failed: 'Error',

    risk_low: 'Low',
    risk_medium: 'Medium',
    risk_high: 'High',
    risk_critical: 'Critical',

    rv_col_date: 'Date',
    rv_col_elapsed: 'Age',
    rv_col_branch: 'Branch',
    rv_col_channel: 'Channel',
    rv_col_rating: 'Rating',
    rv_col_status: 'Status',
    rv_col_risk: 'Risk',
    rv_col_intent: 'Intent',
    rv_col_pipeline: 'Pipeline',
    rv_col_preview: 'Review / Draft',
    rv_view_detail: 'Detail',
    rv_pipeline_template: 'Template',
    rv_pipeline_llm: 'AI',
    rv_empty: 'No reviews match the current filter.',
    rv_today: 'Today',
    rv_filter_status: 'Status',
    rv_filter_rating: 'Rating',
    rv_filter_risk: 'Risk',
    rv_filter_reset: 'Reset',
    rv_per_page: 'per page',
    rv_prev: 'Prev',
    rv_next: 'Next',
    rv_batch_selected: 'new selected',
    rv_draft_type: 'Draft type',
    rv_generate: 'Generate AI drafts',
    rv_deselect: 'Deselect',
    rv_processing: 'Processing',
    rv_cancel: 'Cancel',
    rv_draft_standard: 'Standard',
    rv_draft_short: 'Short',
    rv_draft_careful: 'Careful',
    rv_drawer_reply: 'Reply Draft',
    rv_save: 'Save',
    rv_saving: 'Saving...',
    rv_saved: 'Saved',
    rv_edited: 'Edited',
    rv_open_full: 'Open full detail page',
    rv_close: 'Close',
    rv_confidence: 'Confidence',
    rv_cs_guide: 'For complaints, keep the "we hear you and will improve" tone — never make excuses.',
    rv_original_review: 'Original Review',
    rv_no_draft: 'No reply draft has been generated yet.',

    rv_group_domestic: 'Domestic',
    rv_group_global: 'Global',
    rv_group_all: 'All',

    rd_isolated_title: 'AI Isolated — Secondary Review Required',
    rd_isolated_desc: 'AI detected risk factors and auto-isolated this review. Please review and approve manually.',
    rd_risk_reasons: 'Risk Reasons',
    rd_forbidden_detected: '⛔ Forbidden Phrase Detected',
    rd_sla_title: 'Response Delay Warning',
    rd_sla_desc: 'This review was posted {days} days ago. A prompt response is needed.',
    rd_label_risk: 'Risk',
    rd_label_sentiment: 'Sentiment',
    rd_label_branch: 'Branch',
    rd_label_channel: 'Channel',
    rd_label_rating: 'Rating',
    rd_label_date: 'Date',
    rd_label_reviewer: 'Reviewer',
    rd_review_original: 'Original Review',
    rd_ai_note: 'AI Internal Note',
    rd_highrisk_title: '⚠ High-Risk Review',
    rd_highrisk_desc: 'This review is classified as high-risk. Review carefully before replying. Never include refund promises, admissions of legal liability, CCTV mentions, or staff disciplinary promises.',
    rd_ai_draft_title: 'AI Reply Draft',
    rd_generate: 'Generate AI Draft',
    rd_generating: 'Generating...',
    rd_regenerate: 'Regenerate',
    rd_reanalyze: '🔄 Re-analyze',
    rd_analyzing: 'Analyzing...',
    rd_reanalyze_title: 'Re-analyze with IntelligentOrchestrator — re-evaluate risk and regenerate drafts',
    rd_tab_standard: 'Standard',
    rd_tab_short: 'Short',
    rd_tab_careful: 'Careful',
    rd_no_draft_variant: 'No draft for this variant.',
    rd_apply_to_editor: 'Apply to editor',
    rd_forbidden_check: 'Forbidden Phrase Check',
    rd_no_draft_yet: 'No AI draft yet. Click the button above to generate one.',
    rd_final_edit: 'Final Reply Editor',
    rd_copy_reply: 'Copy reply',
    rd_editor_placeholder: 'Write or paste your final reply here, then copy it directly to the external platform.',
    rd_chars: '{n} chars',
    rd_temp_save: 'Save draft',
    rd_advanced: 'Advanced Options',
    rd_approve: 'Approve',
    rd_google_post: '🔵 Post directly to Google',
    rd_posting: 'Posting...',
    rd_copy_and_open: '📋 Copy reply + open admin',
    rd_copy_and_open_title: 'Copy the reply and open the {channel} admin page in a new tab',
    rd_copy_only_title: 'Copy the reply to clipboard',
    rd_mark_published_manual: 'Mark manually published',
    rd_mark_published: '✓ Mark published',
    rd_no_reply: 'No reply needed',
    rd_escalate: 'Escalate',
    rd_danger_zone: 'Danger Zone',
    rd_delete: 'Delete review',
    rd_delete_confirm_title: 'Delete this review?',
    rd_delete_confirm_desc: 'All drafts and history for this review will be permanently deleted. This cannot be undone.',
    rd_deleting: 'Deleting...',
    rd_delete_confirm_btn: 'Confirm delete',
    rd_cancel: 'Cancel',
    rd_history: 'Activity Log',
    rd_no_history: 'No history.',
    rd_fb_refund: 'Refund promise',
    rd_fb_legal: 'Legal admission',
    rd_fb_cctv: 'CCTV mention',
    rd_fb_staff: 'Staff discipline',
    rd_sent_positive: 'Positive',
    rd_sent_neutral: 'Neutral',
    rd_sent_mixed: 'Mixed',
    rd_sent_negative: 'Negative',
    rd_act_registered: 'Review registered',
    rd_act_ai_generated: 'AI draft generated',
    rd_act_edited: 'Reply edited',
    rd_act_approved: 'Approved',
    rd_act_escalated: 'Escalated',
    rd_act_no_reply: 'Marked no reply',
    rd_act_published: 'Published',
    rd_revert_to_new: 'Revert to New',
    rd_revert_to_ai_done: 'Revert to AI Draft',
    rd_revert_to_approved: 'Revert to Approved',
    rd_toast_copied: 'Copied to clipboard.',
    rd_toast_gen_fail: 'Failed to generate AI draft.',
    rd_toast_server_err: 'A server error occurred.',
    rd_toast_enter_reply: 'Please enter a reply to publish.',
    rd_confirm_google: 'Post this reply directly to your Google Business Profile?\nAfter posting, edits must be made directly on Google.',
    rd_toast_google_fail: 'Google post failed: {error}',
    rd_toast_google_ok: 'Successfully posted to Google!',
    rd_toast_copy_opened: '✓ Reply copied — a new tab opened. Paste it, then click "Mark published".',
    rd_toast_copy_manual: '✓ Reply copied — open the platform admin page, paste it, then click "Mark published".',
    rd_confirm_publish: 'Publish this reply to {channel}?',
    rd_toast_publish_fail: 'Publish failed: {error}',
    rd_toast_published: '✅ Published!',
    rd_toast_reanalyze_fail: 'Re-analysis failed.',
    rd_toast_error: 'Error: {error}',
    rd_toast_request_director: 'Director approval request submitted.',
    rd_toast_approve_publish: 'Branch manager approved and marked as published.',
    rd_toast_hq_escalate: 'Escalated to HQ.',
    rd_toast_approved: 'Reply approved.',
    rd_toast_mark_published: 'Marked as published.',
    rd_toast_mark_no_reply: 'Marked as no reply needed.',
    rd_toast_escalated: 'Escalated.',
    rd_toast_reverted: 'Status reverted.',
    rd_toast_temp_saved: 'Draft saved.',
    rd_unknown_error: 'Unknown error',

    rv_list_title: 'Reviews',
    rv_total_word: 'Total',
    rv_search_label: 'Search review text / author',
    rv_search_ph: 'Search (review text, author, branch/channel code)',
    rv_date_from: 'Review date (from)',
    rv_date_to: 'Review date (to)',
    rv_apply: 'Apply filters',
    rv_import_csv: 'Import CSV',
    rv_register_one: '+ Add one',
    rv_export_excel: 'Export Excel',
    rv_class_reason: 'Classification reason',
    rv_bulk_page_selected: 'All {n} reviews on this page are selected.',
    rv_bulk_select_all: 'Select all {x} reviews matching the filter',
    rv_bulk_all_selected: 'All {x} reviews matching the filter are selected.',
    rv_bulk_clear: 'Clear selection',
    rv_delete_selected: 'Delete ({n})',
    rv_del_confirm_title: 'Delete {n} review(s)?',
    rv_del_confirm_desc: 'Deleted reviews are hidden from lists and the dashboard and moved to the Archive. The audit trail is preserved.',
    rv_deleting: 'Deleting...',
    rv_del_done: '{n} review(s) deleted.',
    rv_del_confirm_btn: 'Confirm delete',
    rv_archive_reason: 'Archive reason',

    arch_title: 'Archive',
    arch_subtitle: 'Deleted reviews — restore them or delete permanently',
    arch_search_ph: 'Search (review text, author, branch/channel code)',
    arch_branch_all: 'All branches',
    arch_apply: 'Search',
    arch_reset: 'Reset',
    arch_empty: 'The archive is empty.',
    arch_restore_selected: 'Restore ({n})',
    arch_harddelete_selected: 'Delete permanently ({n})',
    arch_restoring: 'Restoring...',
    arch_deleting: 'Deleting...',
    arch_restore_done: '{n} review(s) restored.',
    arch_harddelete_done: '{n} review(s) permanently deleted.',
    arch_restore_confirm_title: 'Restore {n} review(s)?',
    arch_restore_confirm_desc: 'Restored reviews reappear in the review list and dashboard.',
    arch_restore_confirm_btn: 'Restore',
    arch_hard_title1: 'Permanently delete {n} review(s)?',
    arch_hard_desc1: 'Permanently deleted reviews and their reply drafts are removed from the database and cannot be recovered. Only the audit log entry is preserved.',
    arch_hard_next: 'Next',
    arch_hard_title2: 'Really permanently delete {n} review(s)?',
    arch_hard_desc2: 'This action cannot be undone. The data will be gone forever.',
    arch_hard_ack: 'I understand this cannot be undone and confirm permanent deletion.',
    arch_hard_confirm_btn: 'Confirm permanent delete',
    arch_hard_cap_warn: 'Permanent delete is limited to {max} items at a time. Please select fewer.',
    arch_hard_no_selectall: 'For safety, permanent delete is disabled while "select all" is active. Please select individual items.',
    arch_hard_all_warn: 'All {n} matching reviews will be permanently deleted. This cannot be undone.',
  },

  ja: {
    nav_dashboard: 'ダッシュボード',
    nav_reviews: 'レビュー一覧',
    nav_import: '取込',
    nav_register: '手動入力',
    nav_archive: 'アーカイブ',
    nav_settings: '設定',
    nav_google: 'Google連携',
    nav_users: 'ユーザー管理',
    nav_rules: 'ルールエンジン',
    nav_admin_section: '管理',
    nav_admin_badge: '管理者',
    nav_signout: 'ログアウト',

    period_all: '全体',
    period_today: '本日',
    period_1w: '1週間',
    period_1m: '1ヶ月',
    period_3m: '3ヶ月',
    period_6m: '6ヶ月',
    period_1y: '1年',
    period_ytd: 'YTD',
    period_custom: 'カスタム',

    stat_period_label: '期間',
    stat_avg_rating: '平均評価',
    stat_per_5: '/ 5.0',
    stat_rating_basis: '件基準',
    stat_response_rate: '返信率',
    stat_published_of: '件投稿 /',
    stat_new: '新規 — 未対応',
    stat_ai_done: 'AI下書き完了',
    stat_pending_approval: 'AI隔離 — 要確認',
    stat_escalated: 'エスカレーション',
    stat_high_risk: '高リスク',
    stat_unit: '件',

    filter_branch_label: '拠点',
    filter_channel_label: 'チャンネル',
    filter_reset: 'リセット',
    filter_all: '全体',
    filter_channel_google: 'Google',
    filter_channel_manual: '手動入力',
    filter_active_label: 'フィルター適用中',

    dash_title: 'ダッシュボード',
    dash_subtitle: 'レビュー対応状況サマリー',

    dash_isolated_title: '高リスク隔離レビュー',
    dash_isolated_desc: 'AI·フィルター自動隔離 — 要確認',
    dash_view_all_isolated: '全件表示 →',

    dash_col_risk: 'リスク',
    dash_col_branch: '拠点',
    dash_col_channel: 'チャンネル',
    dash_col_rating: '評価',
    dash_col_date: '日付',
    dash_col_preview: 'レビュープレビュー',
    dash_col_status: 'ステータス',
    dash_col_review: 'レビュー',

    dash_review_link: '🔍 確認 →',

    dash_pending_title: '未処理レビュー',
    dash_pending_hint: 'チェックして一括返信生成',
    dash_pending_view_all: '全レビュー表示 →',
    dash_filter_active: 'フィルター適用中',
    dash_prev: '← 前へ',
    dash_next: '次へ →',
    dash_no_pending: '未処理レビューはありません ✓',
    dash_no_pending_filtered: '選択したフィルター条件に一致するレビューはありません。',
    dash_all_done: 'すべてのレビューが処理済みです。',

    dash_recent_title: '最近の処理完了',
    dash_view_all: '全件表示',

    status_new: '新規',
    status_ai_done: 'AI下書き',
    status_pending_approval: 'AI隔離',
    status_approved: '承認済',
    status_published: '投稿済',
    status_no_reply: '返信不要',
    status_escalated: 'エスカレーション',
    status_failed: 'エラー',

    risk_low: '低',
    risk_medium: '中',
    risk_high: '高',
    risk_critical: '危険',

    rv_col_date: '日付',
    rv_col_elapsed: '経過',
    rv_col_branch: '拠点',
    rv_col_channel: 'チャネル',
    rv_col_rating: '評価',
    rv_col_status: 'ステータス',
    rv_col_risk: 'リスク',
    rv_col_intent: 'インテント',
    rv_col_pipeline: 'パイプライン',
    rv_col_preview: 'レビュー / 返信案',
    rv_view_detail: '詳細',
    rv_pipeline_template: 'テンプレート',
    rv_pipeline_llm: 'AI',
    rv_empty: '該当するレビューがありません。',
    rv_today: '本日',
    rv_filter_status: 'ステータス',
    rv_filter_rating: '評価',
    rv_filter_risk: 'リスク',
    rv_filter_reset: 'リセット',
    rv_per_page: '件/頁',
    rv_prev: '前へ',
    rv_next: '次へ',
    rv_batch_selected: '新規選択',
    rv_draft_type: '返信タイプ',
    rv_generate: 'AI返信案を生成',
    rv_deselect: '選択解除',
    rv_processing: '処理中',
    rv_cancel: 'キャンセル',
    rv_draft_standard: '標準',
    rv_draft_short: '簡潔',
    rv_draft_careful: '丁寧',
    rv_drawer_reply: '返信案',
    rv_save: '保存',
    rv_saving: '保存中...',
    rv_saved: '保存済み',
    rv_edited: '編集済み',
    rv_open_full: '詳細ページを開く',
    rv_close: '閉じる',
    rv_confidence: '信頼度',
    rv_cs_guide: 'ご不満・改善点には言い訳せず「真摯に受け止め改善する」トーンを保ってください。',
    rv_original_review: '元のレビュー',
    rv_no_draft: '返信案はまだ生成されていません。',

    rv_group_domestic: '国内拠点',
    rv_group_global: 'グローバル拠点',
    rv_group_all: '全体',

    rd_isolated_title: 'AI隔離 — 二次確認が必要',
    rd_isolated_desc: 'AIがリスク要素を検知し、このレビューを自動隔離しました。必ず確認のうえ承認してください。',
    rd_risk_reasons: 'リスク理由',
    rd_forbidden_detected: '⛔ 禁止表現を検知',
    rd_sla_title: '返信遅延の注意',
    rd_sla_desc: 'このレビューが投稿されてから{days}日が経過しました。早急な返信が必要です。',
    rd_label_risk: 'リスク',
    rd_label_sentiment: '感情',
    rd_label_branch: '拠点',
    rd_label_channel: 'チャネル',
    rd_label_rating: '評価',
    rd_label_date: '投稿日',
    rd_label_reviewer: '投稿者',
    rd_review_original: 'レビュー原文',
    rd_ai_note: 'AI内部メモ',
    rd_highrisk_title: '⚠ 高リスクレビュー',
    rd_highrisk_desc: 'このレビューは高リスクに分類されました。必ず確認のうえ返信してください。返金の約束、法的責任の認定、防犯カメラの言及、スタッフ処分の約束は絶対に含めないでください。',
    rd_ai_draft_title: 'AI返信案',
    rd_generate: 'AI返信案を生成',
    rd_generating: '生成中...',
    rd_regenerate: 'AI再生成',
    rd_reanalyze: '🔄 AI再分析',
    rd_analyzing: '分析中...',
    rd_reanalyze_title: 'IntelligentOrchestratorでAI再分析 — リスク再評価と返信案の再生成',
    rd_tab_standard: '標準',
    rd_tab_short: '簡潔',
    rd_tab_careful: '丁寧',
    rd_no_draft_variant: 'この返信案はありません。',
    rd_apply_to_editor: '編集欄に適用',
    rd_forbidden_check: '禁止表現チェック',
    rd_no_draft_yet: 'AI返信案はまだありません。上のボタンで生成してください。',
    rd_final_edit: '最終返信の編集',
    rd_copy_reply: '返信をコピー',
    rd_editor_placeholder: 'ここに最終返信を入力または貼り付けてください。外部プラットフォームに直接コピーして投稿します。',
    rd_chars: '{n}文字',
    rd_temp_save: '一時保存',
    rd_advanced: '高度な処理オプション',
    rd_approve: '承認',
    rd_google_post: '🔵 Googleに直接投稿',
    rd_posting: '投稿中...',
    rd_copy_and_open: '📋 返信コピー + 管理画面へ',
    rd_copy_and_open_title: '返信をコピーし、{channel}の管理画面を新しいタブで開きます',
    rd_copy_only_title: '返信をクリップボードにコピーします',
    rd_mark_published_manual: '手動投稿完了として処理',
    rd_mark_published: '✓ 投稿完了として処理',
    rd_no_reply: '返信不要',
    rd_escalate: 'エスカレーション',
    rd_danger_zone: '危険ゾーン',
    rd_delete: 'レビュー削除',
    rd_delete_confirm_title: '本当に削除しますか？',
    rd_delete_confirm_desc: 'このレビューに関連するすべての返信案・処理履歴が永久に削除されます。元に戻せません。',
    rd_deleting: '削除中...',
    rd_delete_confirm_btn: '削除を確認',
    rd_cancel: 'キャンセル',
    rd_history: '処理履歴',
    rd_no_history: '履歴がありません。',
    rd_fb_refund: '返金の約束',
    rd_fb_legal: '法的責任の認定',
    rd_fb_cctv: '防犯カメラの言及',
    rd_fb_staff: 'スタッフ処分の約束',
    rd_sent_positive: 'ポジティブ',
    rd_sent_neutral: 'ニュートラル',
    rd_sent_mixed: '混在',
    rd_sent_negative: 'ネガティブ',
    rd_act_registered: 'レビュー登録',
    rd_act_ai_generated: 'AI返信案生成',
    rd_act_edited: '返信編集',
    rd_act_approved: '承認',
    rd_act_escalated: 'エスカレーション',
    rd_act_no_reply: '返信不要処理',
    rd_act_published: '投稿完了',
    rd_revert_to_new: '新規に戻す',
    rd_revert_to_ai_done: 'AI完了に戻す',
    rd_revert_to_approved: '承認済みに戻す',
    rd_toast_copied: 'クリップボードにコピーしました。',
    rd_toast_gen_fail: 'AI返信案の生成に失敗しました。',
    rd_toast_server_err: 'サーバーエラーが発生しました。',
    rd_toast_enter_reply: '投稿する返信を入力してください。',
    rd_confirm_google: 'Googleビジネスプロフィールにこの返信を直接投稿しますか？\n投稿後はGoogle上で直接編集する必要があります。',
    rd_toast_google_fail: 'Google投稿失敗: {error}',
    rd_toast_google_ok: 'Googleに正常に投稿されました！',
    rd_toast_copy_opened: '✓ 返信コピー完了 — 新しいタブが開きました。貼り付け後「投稿完了として処理」を押してください。',
    rd_toast_copy_manual: '✓ 返信コピー完了 — プラットフォーム管理画面で貼り付け後「投稿完了として処理」を押してください。',
    rd_confirm_publish: 'この返信を{channel}に投稿しますか？',
    rd_toast_publish_fail: '投稿失敗: {error}',
    rd_toast_published: '✅ 投稿完了！',
    rd_toast_reanalyze_fail: 'AI再分析に失敗しました。',
    rd_toast_error: 'エラー: {error}',
    rd_toast_request_director: '館長承認リクエストを受け付けました。',
    rd_toast_approve_publish: '拠点長による専決承認・投稿完了として処理されました。',
    rd_toast_hq_escalate: '本社（HQ）へ移管しました。',
    rd_toast_approved: '返信が承認されました。',
    rd_toast_mark_published: '投稿完了として処理されました。',
    rd_toast_mark_no_reply: '返信不要として処理されました。',
    rd_toast_escalated: 'エスカレーション処理されました。',
    rd_toast_reverted: 'ステータスを戻しました。',
    rd_toast_temp_saved: '一時保存しました。',
    rd_unknown_error: '不明なエラー',

    rv_list_title: 'レビュー一覧',
    rv_total_word: '合計',
    rv_search_label: 'レビュー内容 / 投稿者検索',
    rv_search_ph: '検索ワード（レビュー内容、投稿者名、拠点/チャネルコード）',
    rv_date_from: 'レビュー投稿日（開始）',
    rv_date_to: 'レビュー投稿日（終了）',
    rv_apply: 'フィルター適用',
    rv_import_csv: 'CSV取込',
    rv_register_one: '+ 1件登録',
    rv_export_excel: 'Excelダウンロード',
    rv_class_reason: '分類理由',
    rv_bulk_page_selected: 'このページの{n}件のレビューが選択されました。',
    rv_bulk_select_all: 'フィルター条件に一致する全{x}件を選択',
    rv_bulk_all_selected: 'フィルター条件に一致する全{x}件が選択されました。',
    rv_bulk_clear: '選択解除',
    rv_delete_selected: '削除 ({n})',
    rv_del_confirm_title: 'レビュー{n}件を削除しますか？',
    rv_del_confirm_desc: '削除したレビューは一覧・ダッシュボードから非表示になり、アーカイブ（保管庫）へ移動します。監査履歴は保存されます。',
    rv_deleting: '削除中...',
    rv_del_done: 'レビュー{n}件を削除しました。',
    rv_del_confirm_btn: '削除を確認',
    rv_archive_reason: '保管理由',

    arch_title: 'アーカイブ（保管庫）',
    arch_subtitle: '削除されたレビュー — 復元または完全削除できます',
    arch_search_ph: '検索ワード（レビュー内容、投稿者名、拠点/チャネルコード）',
    arch_branch_all: '全拠点',
    arch_apply: '検索',
    arch_reset: 'リセット',
    arch_empty: 'アーカイブは空です。',
    arch_restore_selected: '復元 ({n})',
    arch_harddelete_selected: '完全削除 ({n})',
    arch_restoring: '復元中...',
    arch_deleting: '完全削除中...',
    arch_restore_done: '{n}件を復元しました。',
    arch_harddelete_done: '{n}件を完全に削除しました。',
    arch_restore_confirm_title: '{n}件を復元しますか？',
    arch_restore_confirm_desc: '復元したレビューはレビュー一覧とダッシュボードに再表示されます。',
    arch_restore_confirm_btn: '復元',
    arch_hard_title1: '{n}件を完全に削除しますか？',
    arch_hard_desc1: '完全削除されたレビューと関連する返信案はデータベースから完全に削除され、復元できません。監査ログの記録のみ保存されます。',
    arch_hard_next: '次へ',
    arch_hard_title2: '本当に{n}件を完全削除しますか？',
    arch_hard_desc2: 'この操作は取り消せません。データは永久に失われます。',
    arch_hard_ack: '取り消せないことを理解し、完全削除に同意します。',
    arch_hard_confirm_btn: '完全削除を確定',
    arch_hard_cap_warn: '完全削除は一度に最大{max}件までです。選択を減らしてください。',
    arch_hard_no_selectall: '安全のため「全選択」状態では完全削除できません。個別に選択してください。',
    arch_hard_all_warn: 'フィルター条件に一致する全{n}件が完全削除されます。元に戻せません。',
  },

  zh: {
    nav_dashboard: '仪表板',
    nav_reviews: '评价列表',
    nav_import: '导入',
    nav_register: '手动录入',
    nav_archive: '归档',
    nav_settings: '设置',
    nav_google: 'Google连接',
    nav_users: '用户管理',
    nav_rules: '规则引擎',
    nav_admin_section: '管理',
    nav_admin_badge: '管理员',
    nav_signout: '退出登录',

    period_all: '全部',
    period_today: '今日',
    period_1w: '1周',
    period_1m: '1个月',
    period_3m: '3个月',
    period_6m: '6个月',
    period_1y: '1年',
    period_ytd: 'YTD',
    period_custom: '自定义',

    stat_period_label: '时间段',
    stat_avg_rating: '平均评分',
    stat_per_5: '/ 5.0',
    stat_rating_basis: '条基准',
    stat_response_rate: '回复率',
    stat_published_of: '条已发布 /',
    stat_new: '新增 — 待处理',
    stat_ai_done: 'AI草稿就绪',
    stat_pending_approval: 'AI隔离 — 待确认',
    stat_escalated: '升级处理',
    stat_high_risk: '高风险',
    stat_unit: '条',

    filter_branch_label: '地点',
    filter_channel_label: '渠道',
    filter_reset: '重置',
    filter_all: '全部',
    filter_channel_google: 'Google',
    filter_channel_manual: '手动录入',
    filter_active_label: '已筛选',

    dash_title: '仪表板',
    dash_subtitle: '评价处理现况概览',

    dash_isolated_title: '高风险隔离评价',
    dash_isolated_desc: 'AI·过滤器自动隔离 — 需主任审查',
    dash_view_all_isolated: '查看全部 →',

    dash_col_risk: '风险',
    dash_col_branch: '地点',
    dash_col_channel: '渠道',
    dash_col_rating: '评分',
    dash_col_date: '日期',
    dash_col_preview: '评价预览',
    dash_col_status: '状态',
    dash_col_review: '评价',

    dash_review_link: '🔍 查看 →',

    dash_pending_title: '待处理评价',
    dash_pending_hint: '选择后批量生成回复',
    dash_pending_view_all: '查看全部评价 →',
    dash_filter_active: '已筛选',
    dash_prev: '← 上一页',
    dash_next: '下一页 →',
    dash_no_pending: '暂无待处理评价 ✓',
    dash_no_pending_filtered: '没有符合当前筛选条件的评价。',
    dash_all_done: '所有评价均已处理。',

    dash_recent_title: '最近已处理',
    dash_view_all: '查看全部',

    status_new: '新增',
    status_ai_done: 'AI草稿',
    status_pending_approval: 'AI隔离',
    status_approved: '已批准',
    status_published: '已发布',
    status_no_reply: '无需回复',
    status_escalated: '升级处理',
    status_failed: '错误',

    risk_low: '低',
    risk_medium: '中',
    risk_high: '高',
    risk_critical: '危险',

    rv_col_date: '日期',
    rv_col_elapsed: '经过',
    rv_col_branch: '地点',
    rv_col_channel: '渠道',
    rv_col_rating: '评分',
    rv_col_status: '状态',
    rv_col_risk: '风险',
    rv_col_intent: '意图',
    rv_col_pipeline: '管线',
    rv_col_preview: '评价 / 回复草稿',
    rv_view_detail: '详情',
    rv_pipeline_template: '模板',
    rv_pipeline_llm: 'AI',
    rv_empty: '没有符合条件的评价。',
    rv_today: '今天',
    rv_filter_status: '状态',
    rv_filter_rating: '评分',
    rv_filter_risk: '风险',
    rv_filter_reset: '重置',
    rv_per_page: '条/页',
    rv_prev: '上一页',
    rv_next: '下一页',
    rv_batch_selected: '新增已选',
    rv_draft_type: '回复类型',
    rv_generate: '生成AI草稿',
    rv_deselect: '取消选择',
    rv_processing: '处理中',
    rv_cancel: '取消',
    rv_draft_standard: '标准',
    rv_draft_short: '简短',
    rv_draft_careful: '谨慎',
    rv_drawer_reply: '回复草稿',
    rv_save: '保存',
    rv_saving: '保存中...',
    rv_saved: '已保存',
    rv_edited: '已编辑',
    rv_open_full: '打开完整详情页',
    rv_close: '关闭',
    rv_confidence: '置信度',
    rv_cs_guide: '面对不便/改进意见，请保持"虚心倾听并积极改进"的语气，切勿辩解。',
    rv_original_review: '原始评价',
    rv_no_draft: '尚未生成回复草稿。',

    rv_group_domestic: '国内门店',
    rv_group_global: '全球门店',
    rv_group_all: '全部',

    rd_isolated_title: 'AI隔离 — 需二次审查',
    rd_isolated_desc: 'AI检测到风险因素并自动隔离了此评价。请务必人工审查后批准。',
    rd_risk_reasons: '风险原因',
    rd_forbidden_detected: '⛔ 检测到禁用表述',
    rd_sla_title: '回复延迟提醒',
    rd_sla_desc: '此评价已发布{days}天。需要尽快回复。',
    rd_label_risk: '风险',
    rd_label_sentiment: '情感',
    rd_label_branch: '门店',
    rd_label_channel: '渠道',
    rd_label_rating: '评分',
    rd_label_date: '发布日期',
    rd_label_reviewer: '评论者',
    rd_review_original: '评价原文',
    rd_ai_note: 'AI内部备注',
    rd_highrisk_title: '⚠ 高风险评价',
    rd_highrisk_desc: '此评价被归类为高风险。请务必审查后再回复。切勿包含退款承诺、承认法律责任、提及监控录像或承诺处分员工。',
    rd_ai_draft_title: 'AI回复草稿',
    rd_generate: '生成AI草稿',
    rd_generating: '生成中...',
    rd_regenerate: 'AI重新生成',
    rd_reanalyze: '🔄 AI重新分析',
    rd_analyzing: '分析中...',
    rd_reanalyze_title: '使用IntelligentOrchestrator重新分析 — 重新评估风险并重新生成草稿',
    rd_tab_standard: '标准',
    rd_tab_short: '简短',
    rd_tab_careful: '谨慎',
    rd_no_draft_variant: '暂无此类草稿。',
    rd_apply_to_editor: '应用到编辑区',
    rd_forbidden_check: '禁用表述检查',
    rd_no_draft_yet: '尚无AI草稿。请点击上方按钮生成。',
    rd_final_edit: '最终回复编辑',
    rd_copy_reply: '复制回复',
    rd_editor_placeholder: '在此撰写或粘贴最终回复，然后直接复制到外部平台发布。',
    rd_chars: '{n}字',
    rd_temp_save: '暂存',
    rd_advanced: '高级处理选项',
    rd_approve: '批准',
    rd_google_post: '🔵 直接发布到Google',
    rd_posting: '发布中...',
    rd_copy_and_open: '📋 复制回复 + 前往管理页',
    rd_copy_and_open_title: '复制回复并在新标签页打开{channel}管理页面',
    rd_copy_only_title: '将回复复制到剪贴板',
    rd_mark_published_manual: '手动标记为已发布',
    rd_mark_published: '✓ 标记为已发布',
    rd_no_reply: '无需回复',
    rd_escalate: '升级处理',
    rd_danger_zone: '危险区域',
    rd_delete: '删除评价',
    rd_delete_confirm_title: '确定要删除吗？',
    rd_delete_confirm_desc: '与此评价相关的所有草稿、处理记录将被永久删除，无法恢复。',
    rd_deleting: '删除中...',
    rd_delete_confirm_btn: '确认删除',
    rd_cancel: '取消',
    rd_history: '处理记录',
    rd_no_history: '暂无记录。',
    rd_fb_refund: '退款承诺',
    rd_fb_legal: '承认法律责任',
    rd_fb_cctv: '提及监控',
    rd_fb_staff: '承诺处分员工',
    rd_sent_positive: '正面',
    rd_sent_neutral: '中性',
    rd_sent_mixed: '复杂',
    rd_sent_negative: '负面',
    rd_act_registered: '评价登记',
    rd_act_ai_generated: 'AI草稿生成',
    rd_act_edited: '回复编辑',
    rd_act_approved: '批准',
    rd_act_escalated: '升级处理',
    rd_act_no_reply: '标记无需回复',
    rd_act_published: '已发布',
    rd_revert_to_new: '退回为新增',
    rd_revert_to_ai_done: '退回为AI完成',
    rd_revert_to_approved: '退回为已批准',
    rd_toast_copied: '已复制到剪贴板。',
    rd_toast_gen_fail: '生成AI草稿失败。',
    rd_toast_server_err: '发生服务器错误。',
    rd_toast_enter_reply: '请输入要发布的回复。',
    rd_confirm_google: '确定将此回复直接发布到Google商家资料吗？\n发布后需在Google上直接修改。',
    rd_toast_google_fail: 'Google发布失败：{error}',
    rd_toast_google_ok: '已成功发布到Google！',
    rd_toast_copy_opened: '✓ 回复已复制 — 新标签页已打开。粘贴后请点击"标记为已发布"。',
    rd_toast_copy_manual: '✓ 回复已复制 — 请打开平台管理页面粘贴后点击"标记为已发布"。',
    rd_confirm_publish: '确定将此回复发布到{channel}吗？',
    rd_toast_publish_fail: '发布失败：{error}',
    rd_toast_published: '✅ 发布完成！',
    rd_toast_reanalyze_fail: 'AI重新分析失败。',
    rd_toast_error: '错误：{error}',
    rd_toast_request_director: '已提交馆长审批请求。',
    rd_toast_approve_publish: '已由店长专断批准并标记为已发布。',
    rd_toast_hq_escalate: '已移交总部（HQ）。',
    rd_toast_approved: '回复已批准。',
    rd_toast_mark_published: '已标记为已发布。',
    rd_toast_mark_no_reply: '已标记为无需回复。',
    rd_toast_escalated: '已升级处理。',
    rd_toast_reverted: '状态已还原。',
    rd_toast_temp_saved: '已暂存。',
    rd_unknown_error: '未知错误',

    rv_list_title: '评价列表',
    rv_total_word: '共',
    rv_search_label: '评价内容 / 评论者搜索',
    rv_search_ph: '搜索词（评价内容、评论者、门店/渠道代码）',
    rv_date_from: '评价日期（开始）',
    rv_date_to: '评价日期（结束）',
    rv_apply: '应用筛选',
    rv_import_csv: '导入CSV',
    rv_register_one: '+ 新增一条',
    rv_export_excel: '导出Excel',
    rv_class_reason: '分类理由',
    rv_bulk_page_selected: '本页 {n} 条评价已选中。',
    rv_bulk_select_all: '选择符合筛选条件的全部 {x} 条评价',
    rv_bulk_all_selected: '符合筛选条件的全部 {x} 条评价已选中。',
    rv_bulk_clear: '取消选择',
    rv_delete_selected: '删除 ({n})',
    rv_del_confirm_title: '确定删除 {n} 条评价吗？',
    rv_del_confirm_desc: '已删除的评价将从列表和仪表板隐藏并移至归档（保管库）。审计记录将被保留。',
    rv_deleting: '删除中...',
    rv_del_done: '已删除 {n} 条评价。',
    rv_del_confirm_btn: '确认删除',
    rv_archive_reason: '保管原因',

    arch_title: '归档（保管库）',
    arch_subtitle: '已删除的评价 — 可恢复或永久删除',
    arch_search_ph: '搜索词（评价内容、评论者、门店/渠道代码）',
    arch_branch_all: '全部门店',
    arch_apply: '搜索',
    arch_reset: '重置',
    arch_empty: '归档为空。',
    arch_restore_selected: '恢复 ({n})',
    arch_harddelete_selected: '永久删除 ({n})',
    arch_restoring: '恢复中...',
    arch_deleting: '永久删除中...',
    arch_restore_done: '已恢复 {n} 条评价。',
    arch_harddelete_done: '已永久删除 {n} 条评价。',
    arch_restore_confirm_title: '恢复 {n} 条评价吗？',
    arch_restore_confirm_desc: '恢复后的评价将重新显示在评价列表和仪表板中。',
    arch_restore_confirm_btn: '恢复',
    arch_hard_title1: '永久删除 {n} 条评价吗？',
    arch_hard_desc1: '永久删除的评价及其回复草稿将从数据库中彻底移除，无法恢复。仅保留审计日志记录。',
    arch_hard_next: '下一步',
    arch_hard_title2: '确定永久删除 {n} 条评价吗？',
    arch_hard_desc2: '此操作无法撤销。数据将永久丢失。',
    arch_hard_ack: '我了解此操作无法撤销，并确认永久删除。',
    arch_hard_confirm_btn: '确认永久删除',
    arch_hard_cap_warn: '永久删除每次最多 {max} 条。请减少选择。',
    arch_hard_no_selectall: '为安全起见，"全选"状态下无法永久删除。请逐项选择。',
    arch_hard_all_warn: '符合筛选条件的全部 {n} 条评价将被永久删除，且无法恢复。',
  },
}

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
  },
}

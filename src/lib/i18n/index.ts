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

  // ── Dashboard global filter bar ────────────────────────────────────────────
  filter_branch_label: string
  filter_channel_label: string
  filter_reset: string
  filter_all: string
  filter_channel_google: string
  filter_channel_manual: string
  filter_active_label: string
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
  },
}

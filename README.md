# ARTE Review Desk

아르떼뮤지엄 내부 리뷰 응대 관리 시스템 (MVP)

## 시스템 개요

- 수동 리뷰 등록 → AI 초안 생성 → 사람이 편집·승인 → 복사하여 수동 게시 → 아카이브
- 자동 게시 기능 없음. 모든 최종 게시는 담당자가 직접 수행
- 고위험 리뷰(환불, 사고, 법적 위협 등)는 자동으로 플래그 처리

## 주요 화면

| 경로 | 설명 |
|---|---|
| `/login` | 로그인 |
| `/dashboard` | 대시보드 (현황 요약) |
| `/reviews` | 리뷰 목록 (필터 가능) |
| `/reviews/new` | 리뷰 수동 등록 |
| `/reviews/[id]` | 리뷰 상세 + AI 초안 + 승인 |
| `/archive` | 아카이브 (처리 완료 이력) |
| `/settings` | 설정 (템플릿, 위험 키워드, 지점/채널) |

## 설정 방법

### 1. 환경 변수 설정

`.env.example`을 복사하여 `.env.local`을 만들고 값을 채웁니다:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 2. Supabase 데이터베이스 설정

Supabase 대시보드의 SQL Editor에서 다음 파일을 순서대로 실행합니다:

1. `supabase/migrations/001_initial.sql` — 테이블 생성 + RLS 정책
2. `supabase/seed.sql` — 초기 데이터 (지점, 채널, 키워드, 템플릿)

### 3. Supabase Auth 설정

Supabase 대시보드 → Authentication → Users 에서 관리자 계정을 직접 추가합니다.

### 4. 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다. `/dashboard`로 자동 리디렉션됩니다.

## 기술 스택

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)

## 안전 규칙 (코드 수준 강제)

- AI는 절대 자동 게시하지 않습니다
- 환불 약속, 법적 책임 인정, CCTV 확인, 직원 징계 약속은 AI 생성 금지
- 고위험/위험 리뷰는 자동 승인 불가
- 모든 주요 액션은 `activity_logs`에 기록됩니다

## 빌드

```bash
npm run build
npm run lint
```

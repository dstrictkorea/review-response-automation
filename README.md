# ARTE Review Desk

아르떼뮤지엄 내부 리뷰 응대 관리 시스템 (MVP)

> 📋 상세 운영 지침 → [docs/OPERATIONAL_GUIDE.md](./docs/OPERATIONAL_GUIDE.md)

---

## 운영 정책 요약

**이 시스템은 자동 게시 봇이 아닙니다.**  
모든 답변은 직원이 검토·승인한 뒤 외부 플랫폼에 수동으로 게시합니다.

### 역할별 액션 분리

| 역할 | 주요 액션 |
|------|-----------|
| `marketing_staff` | 🟢 즉시 반영(Google) / 📋 복사+이동(기타) · 🚨 관장 결재 요청 |
| `director` | ✅ 지점장 전결 승인 및 게시 · 🏢 본사(HQ) 최종 이관 |

### 핵심 워크플로우

```
리뷰 등록 → AI 초안 생성 → 담당자 편집·검토 → [역할별 액션] → 게시 완료 → 아카이브
```

**AI 자동 격리**: 위험도 medium+ 또는 금지 표현 감지 시 `pending_approval` 상태로 격리 → 관장 직접 검토 필수

---

## 주요 화면

| 경로 | 설명 |
|------|------|
| `/login` | 로그인 |
| `/dashboard` | 대시보드 — 현황 요약, 지점별 차트, 처리 대기 목록 |
| `/reviews` | 리뷰 목록 (상태/별점/위험도 필터, 일괄 AI 생성) |
| `/reviews/new` | 리뷰 수동 등록 |
| `/reviews/[id]` | 리뷰 상세 · AI 초안 · 역할 기반 액션 패널 |
| `/archive` | 아카이브 — 처리 완료 이력 |
| `/settings` | 설정 — 템플릿, 위험 키워드, 지점/채널 관리 |

---

## 설정 방법

### 1. 환경 변수

`.env.example`을 복사하여 `.env.local`을 만들고 값을 채웁니다:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-api-key        # AI 초안 생성 (주)
ANTHROPIC_API_KEY=your-anthropic-key  # 선택적 fallback
```

### 2. Supabase 설정

Supabase SQL Editor에서 순서대로 실행:

1. `supabase/migrations/001_initial.sql` — 테이블 + RLS 정책
2. `supabase/seed.sql` — 초기 데이터 (지점·채널·키워드·템플릿)

### 3. 계정 생성

Supabase → Authentication → Users 에서 직원 계정을 추가합니다.  
`profiles` 테이블의 `role` 컬럼을 `admin` 또는 `director`로 설정하면 관장 권한이 부여됩니다.

### 4. 개발 서버

```bash
npm install
npm run dev
# → http://localhost:3000 (자동으로 /dashboard 리디렉션)
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | recharts |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| AI | Groq (llama-3.3-70b) → Anthropic Claude fallback |
| Deploy | Vercel |

---

## 안전 규칙 (코드 수준 강제)

- AI는 절대 자동 게시하지 않습니다
- **환불 약속**, **법적 책임 인정**, **CCTV 확인**, **직원 징계 약속** — AI 생성 + forbidden_check로 이중 차단
- 위험도 medium+ 리뷰는 자동 승인 불가 (`pending_approval` 격리)
- 모든 주요 액션은 타임스탬프·행위자와 함께 `activity_logs`에 영구 기록

---

## 빌드 & 검사

```bash
npm run build     # Next.js 프로덕션 빌드
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript 타입 검사
```

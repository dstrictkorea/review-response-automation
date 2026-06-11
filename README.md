# ARTE Review Desk

아르떼뮤지엄 내부 리뷰 응대 관리 시스템 (MVP)

> 📋 운영 지침 → [OPERATIONAL_GUIDE.md](./OPERATIONAL_GUIDE.md) · 시스템 구조 → [ARCHITECTURE.md](./ARCHITECTURE.md)

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
리뷰 등록/임포트 → 결정론적 분류(LLM 미사용) → 안전 리뷰는 정적 답변 자동 완성(ai_done)
                  → 긴급/불만/모호/질문은 격리(pending_approval) → 담당자 검토·수정
                  → [역할별 액션] → 수동 게시 → 아카이브
```

**AI 자동 격리**: 긴급(부상/법적위협/보상요구) · ★1-2점+본문충돌 · 서비스 질문 포함 ·
위험도 medium+ · 금지 표현 감지 → `pending_approval` 격리, 사람 검토 필수

### 다국어 답변 엔진

- **9개 핵심 언어 네이티브 답변**: 한국어·영어·일본어·중국어·스페인어·러시아어·아랍어·힌디어·필리핀어
- Matrix Fragment Pool 조립(persona·sensory·spatial·temporal 4차원 가중치 거버너 top-N) × 리뷰ID 해시 변형 — 수십 조각→수천 조합
- 리뷰 맥락 echo(힐링/데이트/가족/생일), 한국어 조사 자동 보정, 지점 메타데이터 토큰
- 품질 게이트: 합성 리뷰 713건 × 14종 검출기 **0건** 기준선 (`scripts/deep-learning-loop.ts`)

---

## 주요 화면

| 경로 | 설명 |
|------|------|
| `/login` | 로그인 |
| `/dashboard` | 대시보드 — 현황 요약, 지점별 차트, 고위험 격리 큐 |
| `/reviews` | 리뷰 목록 (상태/별점/위험도 필터, Gmail식 일괄 선택/처리) |
| `/reviews/register` | 리뷰 수동 등록 |
| `/reviews/import` | CSV 일괄 임포트 (컬럼 매핑 + 지점 자동 감지 + 중복 차단) |
| `/reviews/[id]` | 리뷰 상세 · AI 초안 · 역할 기반 액션 패널 |
| `/archive` | 아카이브 — 처리 완료 이력 |
| `/settings` | 설정 — 템플릿, 위험 키워드, 지점/채널/사용자 관리 |
| `/settings/rules` | 분류 규칙/답변 템플릿 DB 관리 (관리자, 시뮬레이터 포함) |

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
GROQ_API_KEY=your-groq-api-key        # LLM 폴백 (키 존재 우선순위: GROQ > GEMINI > OPENAI)
```

### 2. Supabase 설정

`supabase/migrations/`를 순서대로 적용합니다 (적용 상태 표: `CLAUDE_CONTEXT.md` §4).
⚠️ `supabase/gated/rbac_rls_step_b.sql`은 **적용 금지** — 명시적 승인 절차 필요.

### 3. 계정 생성

Supabase → Authentication → Users 에서 직원 계정을 추가합니다.  
`profiles.role`을 `admin` 또는 `director`로 설정하면 관장 권한, `assigned_branches`로 지점 범위를 지정합니다.

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
| 분류/답변 | 결정론적 WaterfallRegexEngine + Matrix Fragment Pool 조립 (기본) |
| AI (예외 전용) | OpenAI 호환 SDK — Groq llama-3.3-70b / Gemini / GPT-4o (불만·모호 격리 폴백) |
| Deploy | Vercel (main push → 자동 배포) |

---

## 안전 규칙 (코드 수준 강제)

- AI는 절대 자동 게시하지 않습니다
- **환불 약속**, **법적 책임 인정**, **CCTV 확인**, **직원 징계 약속** — 정적 템플릿 사전 검수 + `scanForbidden` Double-Check 이중 차단
- EMERGENCY 분류 레이어는 코드 하드코딩 (DB 규칙으로 약화 불가)
- ★1-2점 리뷰는 무승인 자동완료 불가 (격리 게이트)
- 모든 주요 액션은 타임스탬프·행위자와 함께 `activity_logs`에 영구 기록

---

## 빌드 & 검사

```bash
npx tsc --noEmit                          # TypeScript (scripts/** 포함 — Vercel과 동일 범위)
npm run lint                              # ESLint
npm run build                             # Next.js 프로덕션 빌드
npx tsx scripts/validate-waterfall.ts     # 분류 TDD 116+ 케이스
npx tsx scripts/deep-learning-loop.ts     # 품질 게이트 — "이슈 있는 리뷰: 0/713" 필수
```

## 문서 인덱스

| 문서 | 내용 |
|---|---|
| [CLAUDE_CONTEXT.md](./CLAUDE_CONTEXT.md) | **첫 진입점** — 환경/마이그레이션 상태/파일 맵 |
| [CURRENT_TASK.md](./CURRENT_TASK.md) | 현재 작업 컨텍스트 + 락/가드레일 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 현행 시스템 구조 (파이프라인/엔진/검출기) |
| [DECISIONS.md](./DECISIONS.md) | 확정 설계 결정 17건 (재논의 금지) |
| [OPERATIONAL_GUIDE.md](./OPERATIONAL_GUIDE.md) | 운영자용 가이드 (상태/격리/문제해결) |
| [PROJECT_STATE.md](./PROJECT_STATE.md) | Wave별 마일스톤 이력 |
| `00_`–`12_` 트리 | ⚠️ 과거 기획 아카이브 — 현행 스펙 아님 |

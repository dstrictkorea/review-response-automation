# PROJECT_STATE.md — ARTE Museum Review Response Automation
> **자동 업데이트 대상 파일.** 마일스톤 달성·버그 해결 시 즉시 갱신.  
> 최종 갱신: 2026-05-29 · commit range: `86c1c2e` → `cc4f110` (Wave 11)

---

## 🎯 Project North Star (절대 목표)

**전 세계 Arte Museum 글로벌 플랫폼(Google 등) 리뷰 자동 수집 → AI 자동 답변 생성 → 자동 게시 파이프라인 완공 및 무결성 확보.**

- 어떤 언어·국가·지점의 리뷰도 예외 없이 자동 분류·초안 생성·격리·게시까지 처리되는 완전 자동화 시스템
- 사람보다 빠르고, 브랜드보다 안전하고, 법적 위험에서 완전히 방어되는 AI 응답 레이어
- 운영자는 '승인' 버튼 하나만 누르면 전 세계 수천 건의 리뷰에 대응 완료

---

## 🚀 Next Milestone (고도화 방향)

1. **`branches.country_code` DB 화** (migration 004) — `aiService.BRANCH_TO_COUNTRY` 하드코딩 완전 제거, DB에서 동적 조회
2. **`filterService` DB 이관** — 5개 국어 위험 패턴 사전을 `app_settings.hardcoded_filter_patterns`으로 이전, 관리자 UI에서 편집 가능하게 구현
3. **Blacklist / 상습 도배 감지 대시보드** — 동일 reviewer_name이 단기간 N회 이상 리뷰 인입 시 자동 경보
4. **Google Business Profile 양방향 동기화** — 답변 게시 후 상태 확인 + 실패 재시도 큐
5. **다국어 ReviewsListClient** — 리뷰 목록 페이지의 한국어 하드코딩 strings를 i18n으로 교체

---

## ✅ 완료된 주요 기능 (Wave별)

### Wave 1–3 (기반 구축)
- Supabase 스키마 설계 (reviews, reply_drafts, activity_logs, branches, channels, app_settings)
- Next.js 16 App Router 기반 Admin 레이아웃 (Sidebar, Layout)
- 로그인 / 세션 관리 (Supabase Auth)
- 리뷰 수동 등록 (`/reviews/register`)
- 리뷰 목록 (`/reviews`) + 필터·페이지네이션
- 리뷰 상세 + 답변 초안 편집 + 승인 플로우 (`/reviews/[id]`)
- 아카이브 (`/archive`)
- 초기 AI 답변 생성 (`/api/ai/generate-reply`)

### Wave 4 (Google 연동)
- Google OAuth 2.0 인증 플로우 (`/api/auth/google`, `/api/auth/google/callback`)
- Google Business Profile API 리뷰 동기화 (`/api/google/sync`)
- Google 답변 자동 게시 (`/api/google/reply`)
- Cron 자동 동기화 (`/api/cron/sync-all`) — 1시간 주기, 신규 리뷰 인입 시 Orchestrator 자동 트리거
- Google 설정 페이지 (`/settings/google`)

### Wave 5 (격리·배치·출판)
- `ReviewActionPanel` — `riskLevel` prop, marketing_staff는 low 리스크만 직접 게시
- 대시보드 Director 전용 "🚨 고위험 격리 리뷰" 섹션 (risk 내림차순 정렬)
- `generate-reply/route.ts` — 1차 키워드 필터 통합, `floorRisk()` 병합, `needsReview` 판정
- 아웃바운드 웹훅 지원 (`/api/review/publish` — google → webhook → fallback_manual 우선순위)

### Wave 6 (글로벌 SSOT 구축)
- **`src/services/aiService.ts`** 신규: KR/US/AE/JP/CN/AR 문화 프로파일 6개, `buildSystemPrompt()` / `buildUserMessage()` SSOT, 7개 시스템 변수 `{{...}}` 정의
- **`src/services/filterService.ts`** 전면 교체: JP·ZH·AR 하드코딩 패턴 20개 추가 (총 35개), `detectedLangs[]` 신규 필드
- **`IntelligentOrchestrator.ts`** → `io-v3`: aiService SSOT 연동, `core_complaint` 저장, 문화 프로파일 로그
- **`generate-reply/route.ts`** → `gr-v3`: SYSTEM_PROMPT 상수 제거, aiService SSOT, `temperature: 0.2`
- **`settings/SettingsClient.tsx`** 전면 개편: 웹훅 탭·평점 규칙·변수 칩 UI, 5개 언어 키워드 탭
- **`settings/page.tsx`**: `channel_webhooks`, `rating_template_rules` 병렬 조회 추가
- aiService `unterminated string literal` 버그 수정 (`'…"'` → 정상화)
- tsc clean · build EXIT 0 (22/22 routes) · commit `535c285`

### Wave 11 (대시보드 UI/UX 전면 개편 + Wave 10 텔레메트리 연동)
- **서버사이드 페이지네이션**: `reviews/page.tsx` `.range()` + `count:exact`, limit 10/20/50/100, 전 상태 URL 동기화 (새로고침 무결성). 통계는 경량 select로 필터 전체 집합 기준 산출
- **Wave 10 텔레메트리 그리드**: 인텐트 배지 + 신뢰도% + 파이프라인 배지(⚡Template/✨AI) — `reply_drafts` 조인
- **`migration 006`**: `reply_drafts.intent_code/intent_confidence/pipeline_engine` (RPC 미변경, follow-up update). Orchestrator io-v4, generate-reply gr-v3 텔레메트리 기록
- **`lib/intents.ts`** (신규): 인텐트 라벨(4개국어)/배지색 + `inferPipelineEngine` (레거시 draft 역추론)
- **`ReviewDrawer.tsx`** (신규): Context 보존형 우측 슬라이드오버 — 라우팅/모달 제거, 3대 변형 탭 인라인 스위칭 + 편집/저장, CS 헌법 가이드, 상세 페이지 딥링크 보존
- **4개국어 플루이드 그리드**: table-fixed + colgroup + truncate/hover, i18n 키 40여종 추가
- **기술 부채 청산**: `google/api.ts` 타입화로 `any[]` 3곳 제거, `catch(err:any)→unknown` 일괄, ReviewDetailClient Date.now() 모듈 헬퍼화, 죽은 sessionStorage 영속화 제거
- **eslint 0 problems** (기존 15개 debt 포함 전량 청산) · tsc 0 · build EXIT 0 · commit `cc4f110`

### Wave 10 (Algorithm-First, LLM-Fallback 파이프라인)
- **`supabase/migrations/005`**: `pg_trgm` + `review_intents`(20개) + `intent_keywords` + `reply_template_variants` + `detect_review_intent` RPC
- **`templateEngineService.ts`**: Step A(pg_trgm 인텐트 검출) + Step B(신뢰도·다중인텐트·위험도 판단) + 랜덤 변형 선택 + 동적 변수 주입
- **`IntelligentOrchestrator` (io-v4)**: 알고리즘 경로 우선, `shouldUseLlm=false` 시 LLM 호출 완전 생략
- **템플릿 콘텐츠**: KO 5변형×11인텐트 + EN 5변형×5인텐트 = 80개 프로덕션 템플릿
- **Fallback 조건**: confidence < 0.50 || 복수 인텐트 경합 || requires_llm || 템플릿 없음
- tsc clean · commit `8df258d`

### Wave 9 (포용적 개선 의지 CS 헌법 + RISK 분류 정밀화)
- **Global CS Constitution** — 불만/개선 언급 시 변명 금지, 구체적 개선 약속 시스템 프롬프트에 강제 탑재
- **5개국 개선 의지 문구** — KR/US/AE/JP/CN/AR 각 언어에 현지화된 수용·발전 표현 내장
- **RISK 분류 정밀화** — "1★ 극찬=LOW, 5★ 직원 불만=MEDIUM" 명시, 별점 의존 완전 제거
- tsc clean · commit `486c0f4`

### Wave 8 (평점 격리 폐기 + 프롬프트 대개혁 + DB 참조)
- **평점 기반 격리 완전 제거**: `ratingFloor`, `rating<=3` 조건 삭제. 1점이어도 위험 키워드 없으면 `ai_done`
- **AI 프롬프트 대개혁 (5개국)**: KR 한자 혼입 절대 차단 + 고객님/관람객 호칭 강제; US 법적 방어형 어투; JP 最上位 경어(尊敬語·謙譲語); CN 正式商务중문; AR 걸프 환대 공식 아랍어
- **시스템 프롬프트**: `CRITICAL LANGUAGE PURITY` 룰 추가 — 스크립트 혼용 제로 톨러런스
- **RISK 가이드**: 평점 언급 제거, 문맥 기반으로 전환 ("1★도 편의시설 불만이면 low")
- **`getCulturalProfile` DB 동적 참조**: `countryCodeFromDb` 파라미터, branches 쿼리에 `country_code` 추가
- tsc clean · build EXIT 0 (22/22 routes) · commit `46e3823`

### Wave 7 (해시 고도화 + 대시보드 i18n)
- **`import/actions.ts`** 전면 교체: 5차원 컨텍스트 해시 `generateContextHash(branch|channel|author|date|cleanedText)`, `ON CONFLICT DO NOTHING` via `upsert({ignoreDuplicates:true})`, 중복 사유 메시지 개선 (작성자·날짜 표시)
- **`src/lib/i18n/index.ts`** 확장: 35개 신규 키 추가 (대시보드 섹션 레이블, status/risk 배지, 페이지네이션, 4개 국어 완성)
- **`DashboardStats.tsx`** 수정: `건` → `{t.stat_unit}`, `'ko-KR'` → `LANG_LOCALE[lang]`
- **`DashboardPageContent.tsx`** 신규: 대시보드 전체 JSX를 클라이언트 컴포넌트로 분리, `useLanguage()` 연동, 4개 국어 번역 완성
- **`dashboard/page.tsx`** 리팩토링: 데이터 조회만 수행, `<DashboardPageContent />` 렌더링
- **`aiService.ts`** `ReviewContext` 확장: `reviewerPreviousCount?: number` 추가, `buildUserMessage()`에 재방문 고객 컨텍스트 주입
- **`generate-reply/route.ts`**: 재방문 고객 카운트 병렬 조회 + `reviewerPreviousCount` 전달
- **`IntelligentOrchestrator.ts`**: 동일, 활동 로그에 `reviewer_previous_count` 추가
- **`supabase/migrations/004_global_optimization.sql`** 신규: `branches.country_code`, `app_settings` 초기값, `reviews_normalized_hash_unique` 독립 인덱스
- tsc clean · build EXIT 0 (22/22 routes)

---

## 🔴 현재 진행 중인 작업 & 미해결 이슈

| 항목 | 상태 | 설명 |
|---|---|---|
| `branches.country_code` DB 참조 | ✅ 완료 | Wave 8: `getCulturalProfile(branchCode, lang, countryCodeFromDb)` — DB 값 1순위, 하드코딩 맵 fallback으로 강등 |
| 평점 기반 격리 | ✅ 완료 | Wave 8: `ratingFloor` + `rating<=3` 조건 완전 제거. 오직 filterService·AI·forbidden_check 기반 격리 |
| 한국어 한자 혼입 방지 | ✅ 완료 | Wave 8: KR 프로파일에 언어 순도 절대 규칙 + 시스템 프롬프트에 CRITICAL LANGUAGE PURITY 추가 |
| 5개국 프롬프트 대개혁 | ✅ 완료 | Wave 8: KR/US/AE/JP/CN/AR 모두 현장 비즈니스 예법 기반으로 재작성 |
| Algorithm-First 파이프라인 | ✅ 완료 | Wave 10: pg_trgm + TemplateEngineService + Orchestrator io-v4 |
| `filterService` 패턴 DB 이관 | 🔴 미완 | 35개 패턴이 코드 내 하드코딩. `app_settings`로 이관 후 관리자 UI 편집 가능하도록 개편 필요 |
| `ReviewsListClient` i18n | 🟡 부분 | 리뷰 목록 컴포넌트의 한국어 하드코딩 strings 아직 미번역 |
| `badge.ts` 다국어화 | 🟡 부분 | `statusLabel`, `riskLabel` Korean only. Dashboard는 i18n dict 사용하므로 실질 영향 없음 |
| Google sync `normalized_hash` | 🟡 확인 필요 | `sync-all/route.ts`의 `makeHash()` polynomial hash (source_review_id 기반). CSV 5차원 hash와 별개. 정리 예정 |
| 상습 도배 유저 감지 | 🔴 미구현 | 동일 작성자 단기간 N회 인입 시 `pending_approval` 격리 + 대시보드 경보 |

---

## 🚫 실패한 접근법 (Do Not Try)

| 항목 | 이유 |
|---|---|
| `normalized_hash = SHA256(text_only)` | 동일 텍스트 다른 작성자 → 동일 해시 → DB 크래시. 5차원 컨텍스트 해시로 대체됨 |
| `ON CONFLICT` 없는 bulk `.insert()` | 레이스 컨디션·재처리 시 전체 트랜잭션 롤백. `upsert({ignoreDuplicates:true})` 로 대체 |
| `dashboard/page.tsx` (server component)에서 useLanguage 직접 사용 | 서버 컴포넌트에서 React hooks 불가. `DashboardPageContent.tsx` 클라이언트 컴포넌트 분리 방식으로 해결 |
| `fmt()` 함수를 컴포넌트 외부에서 정의한 뒤 locale 참조 | `lang` 상태가 컴포넌트 내부에 있어 외부 함수가 접근 불가. 컴포넌트 내부로 이동 |
| `aiService.ts` 템플릿 섹션 내 `'…' : '"}"'` 패턴 | 백틱 string literal 안에서 single-quote 미닫힘 버그 → `'…"' : '"'` 로 수정 |
| 자체 SYSTEM_PROMPT 상수 중복 관리 | IntelligentOrchestrator + generate-reply 각자 다른 프롬프트 → 일관성 불가. aiService SSOT로 통합 |

---

## 📁 핵심 파일 위치 빠른 참조

```
src/
├── services/
│   ├── aiService.ts          ← AI 프롬프트 SSOT (문화 프로파일, buildSystemPrompt, buildUserMessage)
│   └── filterService.ts      ← 5개 국어 글로벌 위험 키워드 필터 (35개 하드코딩 + DB 키워드)
├── lib/
│   ├── automation/
│   │   └── IntelligentOrchestrator.ts  ← 배치 AI 처리 파이프라인 (io-v3)
│   ├── i18n/index.ts         ← 4개 국어 사전 (ko/en/ja/zh)
│   ├── badges.ts             ← 상태·위험도 배지 CSS + Korean 레이블
│   └── importMapping.ts      ← CSV 포맷 매핑 (standard/google/naver/tripadvisor/ota/custom)
├── app/
│   ├── (admin)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx               ← 데이터 조회 only (서버 컴포넌트)
│   │   │   ├── DashboardPageContent.tsx ← 4개 국어 렌더링 (클라이언트 컴포넌트)
│   │   │   ├── DashboardStats.tsx     ← 기간별 지표 (클라이언트, useLanguage 연동)
│   │   │   ├── DashboardFilterBar.tsx ← 지점·채널 필터 (클라이언트)
│   │   │   └── DashboardCharts.tsx    ← recharts 차트 (클라이언트)
│   │   ├── reviews/
│   │   │   ├── import/
│   │   │   │   ├── page.tsx           ← CSV 업로드 UI
│   │   │   │   └── actions.ts         ← 5차원 해시 + bulk upsert (ON CONFLICT DO NOTHING)
│   │   │   └── [id]/
│   │   │       └── ReviewDetailClient.tsx ← 리뷰 상세 + 답변 편집·승인
│   │   └── settings/
│   │       ├── page.tsx               ← 설정 데이터 조회
│   │       └── SettingsClient.tsx     ← 5탭 설정 UI (keywords/templates/branches/channels/webhooks)
│   └── api/
│       ├── ai/generate-reply/route.ts ← 수동 AI 초안 생성 (gr-v3, aiService SSOT)
│       ├── review/
│       │   ├── publish/route.ts       ← 답변 게시 (Google API > webhook > manual fallback)
│       │   └── re-process/route.ts   ← AI 재분석 트리거
│       ├── google/
│       │   ├── sync/route.ts          ← Google 리뷰 수동 동기화
│       │   └── reply/route.ts         ← Google 답변 게시 direct
│       └── cron/sync-all/route.ts    ← 1시간 주기 전체 계정 동기화
└── types/database.ts         ← ReviewStatus, RiskLevel, Review, ReplyDraft 등 공유 타입
supabase/
├── migrations/
│   ├── 001_initial.sql
│   ├── 002_channel_api_enabled.sql
│   ├── 003_import_tables.sql
│   └── 004_global_optimization.sql  ← country_code, 초기값, normalized_hash 인덱스
└── seed.sql
```

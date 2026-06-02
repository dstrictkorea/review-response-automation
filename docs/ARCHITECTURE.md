# ARCHITECTURE.md — ARTE Museum Review Response Automation
> 최종 갱신: 2026-05-29

---

## 1. 기술 스택

| 레이어 | 기술 | 버전 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | 16.2.4 |
| 런타임 | Node.js | 24 LTS |
| 언어 | TypeScript | 5.x |
| DB / BaaS | Supabase (PostgreSQL 15) | — |
| AI LLM | Groq (llama-3.3-70b) → Gemini → OpenAI (우선순위) | — |
| 스타일링 | Tailwind CSS | 4.x |
| 차트 | Recharts | 2.x |
| 배포 | Vercel (Fluid Compute) | — |
| 인증 | Supabase Auth + Google OAuth 2.0 | — |

---

## 2. 전체 폴더 구조

```
review-response-automation/
├── src/
│   ├── app/
│   │   ├── (admin)/                  ← 인증 필요 관리자 레이아웃
│   │   │   ├── layout.tsx            ← LanguageProvider + Sidebar + ScrollToTop
│   │   │   ├── Sidebar.tsx           ← 4개 국어 토글 + 네비게이션
│   │   │   ├── ScrollToTop.tsx
│   │   │   ├── dashboard/            ← 대시보드 (서버 조회 + 클라이언트 렌더)
│   │   │   │   ├── page.tsx          ← 서버 컴포넌트: 데이터 fetch only
│   │   │   │   ├── DashboardPageContent.tsx  ← 클라이언트: 4개 국어 렌더링
│   │   │   │   ├── DashboardStats.tsx        ← 기간별 지표 클라이언트
│   │   │   │   ├── DashboardFilterBar.tsx    ← 지점·채널 필터 클라이언트
│   │   │   │   └── DashboardCharts.tsx       ← recharts (클라이언트)
│   │   │   ├── reviews/
│   │   │   │   ├── page.tsx          ← 리뷰 목록 서버
│   │   │   │   ├── ReviewsListClient.tsx     ← 리뷰 목록 클라이언트
│   │   │   │   ├── DateInput.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx      ← 리뷰 상세 서버
│   │   │   │   │   ├── ReviewDetailClient.tsx ← 상세 + 답변 편집·승인 UI
│   │   │   │   │   └── actions.ts    ← approve / mark-published Server Actions
│   │   │   │   ├── import/
│   │   │   │   │   ├── page.tsx      ← CSV 업로드 UI (클라이언트)
│   │   │   │   │   └── actions.ts    ← 5차원 해시 + bulk upsert (Server Action)
│   │   │   │   └── register/
│   │   │   │       ├── page.tsx
│   │   │   │       └── actions.ts    ← 단건 수동 등록 Server Action
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx          ← 설정 데이터 조회 (서버)
│   │   │   │   ├── SettingsClient.tsx ← 5탭 설정 UI (keywords/templates/branches/channels/webhooks)
│   │   │   │   ├── actions.ts        ← 설정 저장 Server Actions
│   │   │   │   ├── google/           ← Google 계정 연결 관리
│   │   │   │   └── users/            ← 사용자 역할 관리
│   │   │   └── archive/page.tsx      ← 게시완료 리뷰 아카이브
│   │   ├── api/
│   │   │   ├── ai/generate-reply/route.ts  ← 수동 AI 초안 생성 (gr-v3)
│   │   │   ├── auth/google/          ← OAuth 플로우
│   │   │   ├── review/
│   │   │   │   ├── publish/route.ts  ← 답변 게시 (Google > webhook > manual)
│   │   │   │   └── re-process/route.ts ← AI 재분석
│   │   │   ├── google/
│   │   │   │   ├── sync/route.ts     ← Google 리뷰 동기화
│   │   │   │   └── reply/route.ts    ← Google 답변 직접 게시
│   │   │   └── cron/sync-all/route.ts ← Vercel Cron 1시간 주기
│   │   ├── login/                    ← 로그인 페이지 (서버)
│   │   ├── layout.tsx                ← Root layout (폰트, 메타)
│   │   └── page.tsx                  ← / → /dashboard 리디렉션
│   ├── services/
│   │   ├── aiService.ts              ← AI 프롬프트 SSOT ★
│   │   └── filterService.ts          ← 글로벌 위험 키워드 필터 ★
│   ├── lib/
│   │   ├── automation/
│   │   │   └── IntelligentOrchestrator.ts ← 배치 AI 파이프라인 (io-v3) ★
│   │   ├── i18n/index.ts             ← 4개 국어 사전 ★
│   │   ├── importMapping.ts          ← CSV 파싱 + 포맷 매핑
│   │   ├── badges.ts                 ← 상태·위험도 CSS + Korean 레이블
│   │   ├── google/
│   │   │   ├── api.ts                ← GBP API 클라이언트 (리뷰 목록, 답변 게시)
│   │   │   └── auth.ts               ← OAuth 토큰 관리
│   │   └── supabase/
│   │       ├── admin.ts              ← Admin 클라이언트 (서비스 키)
│   │       ├── client.ts             ← 브라우저 클라이언트
│   │       └── server.ts             ← 서버 컴포넌트 클라이언트
│   ├── context/
│   │   └── LanguageContext.tsx       ← 4개 국어 상태 (ko/en/ja/zh)
│   ├── components/
│   │   └── dashboard/
│   │       ├── DashboardCharts.tsx
│   │       └── ReviewActionPanel.tsx ← 답변 게시 버튼 (역할·위험도 제어)
│   └── types/
│       └── database.ts               ← 공유 TypeScript 인터페이스
├── supabase/
│   ├── migrations/                   ← PostgreSQL 마이그레이션
│   │   ├── 001_initial.sql
│   │   ├── 002_channel_api_enabled.sql
│   │   ├── 003_import_tables.sql
│   │   ├── 004_global_optimization.sql  ← country_code, 초기값, 해시 인덱스 (라이브 미적용)
│   │   ├── 005_algorithm_first_pipeline.sql ← pg_trgm/intents/templates (라이브 미적용)
│   │   ├── 006_review_telemetry.sql     ← reply_drafts 텔레메트리 (✅ 라이브 적용)
│   │   └── 007_branches_seed.sql        ← 11개 공식 지점 시드 (✅ 라이브 적용)
│   └── seed.sql
├── PROJECT_STATE.md                  ← ★ 이 파일의 형제 — 프로젝트 상태 원본
└── docs/
    └── ARCHITECTURE.md               ← 이 파일
```

---

## 3. DB 스키마 (Supabase / PostgreSQL)

### 핵심 테이블

#### `reviews`
```sql
id                     uuid PK
branch_code            text NOT NULL          -- AMNY, AMBS, AMDB …
channel_code           text NOT NULL          -- google, naver, manual …
source_review_id       text                   -- 플랫폼 고유 ID (Google: review.name)
review_url             text
reviewer_name          text
rating                 numeric(2,1)           -- 1.0 – 5.0
review_text            text
review_language        text                   -- ko/en/ja/zh/ar …
review_created_at      timestamptz
status                 text                   -- new|ai_done|pending_approval|approved|manual_published|no_reply|escalated|failed
risk_level             text                   -- low|medium|high|critical
categories             text[]
risk_reasons           text[]
sentiment              text                   -- positive|neutral|mixed|negative
internal_note_ko       text                   -- AI 격리 사유 + core_complaint
normalized_hash        text UNIQUE NOT NULL   ← 5차원 컨텍스트 해시 (migration 004)
import_hash            text
source_import_batch_id uuid FK
created_at             timestamptz
updated_at             timestamptz

UNIQUE (branch_code, channel_code, normalized_hash)   ← 기존 constraint
UNIQUE (normalized_hash)                               ← migration 004 추가
```

#### `reply_drafts`
```sql
id                   uuid PK
review_id            uuid FK → reviews.id
draft_short          text    -- 1-2문장
draft_standard       text    -- 2-4문장
draft_careful        text    -- 4-6문장 (고위험용)
selected_draft_type  text    -- short|standard|careful
selected_reply       text    -- 선택된 초안
human_edited_reply   text    -- 최종 편집본
forbidden_check      jsonb   -- {refund_promise,legal_admission,cctv_mention,staff_discipline}
prompt_version       text    -- gr-v3 / io-v4 / algo-v1
model_name           text    -- llama-… / template-engine-v1
intent_code          text    ← Wave 11: pg_trgm 검출 인텐트 (algo) 또는 LLM categories[0]
intent_confidence    float   ← Wave 11: word_similarity 신뢰도 (0-1). LLM 경로는 NULL
pipeline_engine      text    ← Wave 11: 'template' = Algorithm-First, 'llm' = LLM Fallback
created_at / updated_at
```

#### `branches`
```sql
id               uuid PK
code             text UNIQUE   -- AMNY, AMBS …
name_ko          text
name_en          text
default_language text           -- ko/en/ja/zh
country_code     varchar(2)     ← migration 004 추가 (KR/US/AE/JP/CN/AR)
is_active        boolean
created_at
```

#### `channels`
```sql
id               uuid PK
code             text UNIQUE   -- google, naver, manual …
name             text
collection_mode  text           -- manual/api/webhook
publish_mode     text           -- manual/api/webhook
is_active        boolean
api_enabled      boolean
```

#### `app_settings`
```sql
key         text UNIQUE    -- risk_keywords, reply_templates, channel_webhooks, rating_template_rules
value       jsonb
description text
updated_by  text
updated_at  timestamptz
```

**주요 `key` 값:**
- `risk_keywords`: `RiskKeyword[]` — 관리자가 설정한 DB 키워드 목록
- `reply_templates`: `ReplyTemplate[]` — 언어·카테고리별 템플릿
- `channel_webhooks`: `Record<channelCode, webhookUrl>` — 채널별 아웃바운드 웹훅
- `rating_template_rules`: `{low_star, mid_star, high_star}` — 별점 구간별 템플릿 카테고리

#### `activity_logs`
```sql
id         uuid PK
review_id  uuid (nullable) FK → reviews.id
actor_name text             -- user email 또는 'system:orchestrator'
action     text             -- ai_draft_generated|review_isolated|google_reply_posted|bulk_import_completed …
detail     jsonb            -- 액션 상세 데이터
created_at timestamptz
```

#### `google_accounts`
```sql
id                    uuid PK
branch_code           text FK → branches.code
google_account_email  text
google_location_name  text     -- GBP location resource name
access_token          text (encrypted)
refresh_token         text (encrypted)
token_expires_at      timestamptz
is_active             boolean
last_synced_at        timestamptz
```

#### `review_import_batches` + `review_import_rows`
- CSV 가져오기 이력 관리
- `review_import_rows`: 행별 처리 결과 (`imported|duplicate|error`)

---

## 4. 해시 생성 로직 (normalized_hash)

### v1 (폐기됨 — DO NOT USE)
```
SHA256( normalizeText(review_text) )
→ 문제: 같은 텍스트 다른 작성자 → 동일 해시 → DB 크래시
```

### v2 — 5차원 컨텍스트 해시 (현행, `import/actions.ts`)
```
authorIdentifier = (reviewer_name ?? external_review_id ?? '').toLowerCase()
dateSlug         = review_date.slice(0, 10) ?? ''   // YYYY-MM-DD
cleanedText      = review_text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

normalized_hash  = SHA256(
  branch_code | channel_code | authorIdentifier | dateSlug | cleanedText
)
```
- 같은 날 같은 지점 채널에서 **다른 작성자**가 같은 내용 → 다른 해시 ✓
- 같은 작성자가 **다른 날** 같은 내용 → 다른 해시 ✓
- 진짜 도배(동일 날짜·작성자·텍스트) → 같은 해시 → `ON CONFLICT DO NOTHING` 스킵 ✓

### Google Sync 별도 해시 (`cron/sync-all`, `google/sync`)
```
makeHash(source_review_id)  ← Google이 부여한 고유 review.name 기반 polynomial hash
```
- Google API는 source_review_id가 플랫폼 유일 → 텍스트 해시 불필요

---

## 5. 핵심 비즈니스 로직 파이프라인 (텍스트 흐름도)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     리뷰 인입 경로                                        │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
     [CSV 가져오기]       [Google API 자동 동기화]   [수동 단건 등록]
          │                    │                    │
          ▼                    ▼                    ▼
  import/actions.ts    cron/sync-all/route.ts  register/actions.ts
  (5차원 해시 생성)     (GBP API 폴링)           (직접 입력)
  (bulk upsert)        (upsert onConflict)       (insert)
          │                    │                    │
          └──────────────┬─────┘                    │
                         ▼                          ▼
               ┌─────────────────────┐    ┌─────────────────────┐
               │  reviews 테이블      │    │   reviews 테이블     │
               │  status: 'new'       │    │   status: 'new'      │
               └─────────────────────┘    └─────────────────────┘
                         │                          │
                         ▼                          │
          ┌─────────────────────────────┐           │
          │  IntelligentOrchestrator    │           │
          │  (io-v3, 자동 처리)          │           │
          │                             │           │
          │  1. DB 병렬 조회             │           │
          │     (리뷰+키워드+템플릿)      │           │
          │  2. filterService.scanText() │           │
          │     5개 국어 위험 패턴 스캔   │           │
          │  3. aiService.getCultural   │           │
          │     Profile(branchCode)     │           │
          │  4. 재방문 고객 감지         │           │
          │     (reviewer_name 조회)    │           │
          │  5. buildSystemPrompt()     │           │
          │     문화 프로파일 + 템플릿    │           │
          │  6. buildUserMessage()      │           │
          │     preFilterNote + context │           │
          │  7. LLM 호출                │           │
          │     (Groq>Gemini>OpenAI)   │           │
          │  8. floorRisk()             │           │
          │     filter + AI + rating    │           │
          │  9. DB RPC upsert           │           │
          │     reply_drafts 저장       │           │
          │  10. 격리 판정              │           │
          │      needsSecondaryReview?  │           │
          └─────────────────────────────┘           │
                         │                          │
         ┌───────────────┴──────────────┐           │
         ▼                              ▼           ▼
  status: 'ai_done'         status: 'pending_approval'
  (자동 처리 완료)            (2차 검토 필요)        │
                             격리 조건:             │
                             ① filter triggered    │
                             ② AI risk medium+      │
                             ③ forbidden_check true │
                             ④ rating ≤ 3           │
         │                              │           │
         ▼                              ▼           ▼
┌────────────────────────────────────────────────────────┐
│              대시보드 / 리뷰 목록 UI                     │
│                                                        │
│  Director 섹션: 🚨 고위험 격리 리뷰 (risk 내림차순)      │
│  처리 대기: new + ai_done + pending_approval 목록        │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│              리뷰 상세 (ReviewDetailClient)              │
│                                                        │
│  1. AI 초안 생성 버튼 → /api/ai/generate-reply (gr-v3)  │
│     (수동 트리거, filterService + aiService SSOT)       │
│  2. 초안 편집 (human_edited_reply)                      │
│  3. 승인 (status: approved) — Director/Admin만          │
│  4. 재분석 (🔄) → /api/review/re-process               │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│              답변 게시 (ReviewActionPanel)               │
│                                                        │
│  marketing_staff: risk=low만 직접 게시                  │
│  director/admin: 모든 approved 리뷰 게시 가능            │
│                                                        │
│  /api/review/publish 라우팅:                           │
│  1순위: Google API (google channel + 계정 연결 시)       │
│  2순위: Outbound Webhook (channel_webhooks 설정 시)     │
│  3순위: fallback_manual (클립보드 복사 UI)              │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
                  status: 'manual_published'
                  activity_log 기록
```

---

## 6. AI 프롬프트 파이프라인 (aiService SSOT)

```
getCulturalProfile(branchCode, language)
         │
         ▼
  COUNTRY_PROFILES[countryCode]   ← KR/US/AE/JP/CN/AR
  {regionLabel, toneGuide(native), defaultLanguage}
         │
         ├─── buildSystemPrompt(culturalProfile, matchedTemplates)
         │         └── "You are Global Reputation Manager for ARTE Museum."
         │             + CULTURAL TONE PROFILE (native language)
         │             + DUAL AUDIENCE rule
         │             + 7 ABSOLUTE SAFETY RULES
         │             + RISK CLASSIFICATION GUIDE
         │             + CORE COMPLAINT EXTRACTION
         │             + SYSTEM VARIABLES guide
         │             + PRE-FILTER ALERT HANDLING
         │             + TEMPLATE SECTION (DB 언어매칭 템플릿, 최대 5개)
         │             + OUTPUT FORMAT (JSON schema)
         │
         └─── buildUserMessage(ReviewContext)
                   └── Branch/Channel/Rating/Reviewer
                       + REPEAT VISITOR note (if reviewerPreviousCount > 0)
                       + preFilterNote (if filter triggered)
                       + review_text
                       + CONTEXT FOR REPLY
                       + ACTIVE RISK KEYWORDS (from DB)
```

### LLM 응답 JSON 스키마
```json
{
  "detected_language": "ko|en|zh|ja|ar|...",
  "sentiment": "positive|neutral|mixed|negative",
  "risk_level": "low|medium|high|critical",
  "categories": ["string"],
  "risk_reasons": ["string"],
  "core_complaint": "핵심 불만 한 줄 요약",
  "isolation_reason": "격리 사유 (없으면 빈 문자열)",
  "internal_note_ko": "담당자 내부 메모",
  "forbidden_check": {
    "refund_promise": false,
    "legal_admission": false,
    "cctv_mention": false,
    "staff_discipline": false
  },
  "draft_short": "1-2문장 따뜻한 acknowledgment",
  "draft_standard": "2-4문장 복합 대응",
  "draft_careful": "4-6문장 고위험 대응 + 개선 언급"
}
```

---

## 7. Algorithm-First, LLM-Fallback 파이프라인 (Wave 10)

```
리뷰 인입
    │
    ▼
filterService.scanText()
    │
    ├─ [위험 키워드 감지] ──────────────────────────────────► LLM Fallback (Step C)
    │
    ▼ [키워드 미감지]
templateEngineService.resolveTemplateForReview()
    │
    ├─ Step A: detect_review_intent RPC (pg_trgm word_similarity)
    │          intent_keywords 테이블에서 keyword ↔ review_text 유사도 계산
    │          상위 3개 인텐트 + confidence score 반환
    │
    ├─ Step B: 신뢰도 평가 & 분기
    │
    │   confidence < 0.50 ──────────────────────────────────► LLM Fallback (복합/모호)
    │   requires_llm=true ──────────────────────────────────► LLM Fallback (고위험)
    │   2위 인텐트와 gap < 0.12 ─────────────────────────────► LLM Fallback (복수 불만)
    │   DB 템플릿 없음 ─────────────────────────────────────► LLM Fallback
    │
    │   ▼ [Algorithm OK — 약 90% 해당]
    │   reply_template_variants에서 랜덤 변형(1-5) 선택
    │   {{reviewer_name}} / {{branch_name}} 동적 변수 주입
    │   → draft_short / draft_standard / draft_careful 즉시 완성
    │   → DB RPC 저장 (model='template-engine-v1', prompt_version='algo-v1')
    │   → activity_log: 'algo_draft_generated'
    │   → RETURN (LLM 호출 없음, 비용 0, 지연 ~50ms)
    │
    ▼ [LLM Fallback — 약 10%]
    getCulturalProfile (DB country_code 우선)
    buildSystemPrompt + buildUserMessage (aiService SSOT)
    LLM 호출 (Groq → Gemini → OpenAI)
    floorRisk (filter + AI)
    DB RPC 저장 (model='llama-xxx', prompt_version='io-v4')
    → activity_log: 'ai_draft_generated' or 'review_isolated'
```

### 20개 인텐트 매트릭스

| 코드 | 한국어 | risk | LLM강제 |
|---|---|---|---|
| `positive_overall` | 긍정 전반 | low | - |
| `immersive_exp` | 몰입 경험 | low | - |
| `photo_zone` | 포토존/사진 | low | - |
| `lighting_display` | 조명/전시물 | low | - |
| `staff_praise` | 직원 칭찬 | low | - |
| `child_friendly` | 가족/아이 | low | - |
| `repeat_visit` | 재방문 의사 | low | - |
| `crowd_complaint` | 혼잡 불만 | low | - |
| `wait_time` | 대기시간 불만 | low | - |
| `cleanliness` | 청결 불만 | low | - |
| `ticket_price` | 가격 불만 | low | - |
| `ticket_booking` | 예매/예약 불편 | low | - |
| `staff_complaint` | 직원 불만 | medium | - |
| `parking` | 주차 불편 | low | - |
| `food_cafe` | 카페/식음료 | low | - |
| `souvenir_merch` | 굿즈/기념품 | low | - |
| `accessibility` | 장애인/접근성 | low | - |
| `location_access` | 위치/교통 | low | - |
| `safety_concern` | 안전 우려 | **high** | **✓** |
| `refund_complaint` | 환불/보상 | **high** | **✓** |

### 신뢰도 임계값 (templateEngineService.ts)

| 상수 | 값 | 설명 |
|---|---|---|
| `CONFIDENCE_THRESHOLD` | 0.50 | 이 이상이어야 알고리즘 경로 |
| `MULTI_INTENT_GAP` | 0.12 | 1위-2위 차이가 이 미만 → LLM |

---

## 8. 위험도 병합 알고리즘 (floorRisk)

```typescript
finalRisk = MAX(
  AI.risk_level,                                    // LLM 자체 판단
  filterResult.triggered ? filterResult.maxRiskLevel : 'low',   // 1차 필터
  review.rating <= 2 ? 'high' : 'low'              // 별점 floor
)

needsSecondaryReview =
  filterResult.triggered ||           // 1차 필터 트리거
  finalRisk ∈ {medium, high, critical} ||  // AI 위험도
  hasForbiddenFlag ||                 // forbidden_check any true
  review.rating <= 3                  // 별점 ≤ 3
```

---

## 8b. 리뷰 목록 UI 아키텍처 (Wave 11)

```
/reviews (서버 컴포넌트 page.tsx)
   │  URL: ?page&limit&status&risk&rating&q&branch&channel&date_from&date_to
   │
   ├─ rows 쿼리: .eq(필터…).or(q ilike).range(from,to) + count:exact   → 현재 페이지 행
   ├─ stats 쿼리: select('rating') + 동일 필터                          → 전체 집합 평균/분포
   ├─ reply_drafts 조인 (현재 페이지 id만)                             → draftMap + telemetryMap
   │
   ▼
ReviewsListClient (클라이언트)  ── server prop 유무로 모드 분기
   │   server O → /reviews: URL 기반 필터·페이지네이션 (퀵필터칩 = router.push)
   │   server X → 대시보드: 인메모리 필터·정렬 (페이지네이션 UI 없음)
   │
   ├─ 고밀도 그리드 (table-fixed + colgroup): 지점/채널/별점/상태/위험도
   │   + 인텐트 배지(신뢰도%) + 파이프라인 배지(⚡Template/✨AI) + 미리보기(truncate/hover)
   ├─ 배치 AI 생성 (현재 페이지 new 리뷰 선택 → /api/ai/generate-reply 병렬)
   │
   ▼ 행 클릭 (라우팅 없음)
ReviewDrawer (우측 슬라이드오버)
   │  - reply_drafts 풀 로드 (브라우저 supabase)
   │  - 3대 변형 탭 (short/standard/careful) 인라인 스위칭
   │  - textarea 편집 → selected_reply/human_edited_reply 인라인 저장
   │  - CS 헌법 가이드 레이어, 텔레메트리 배지
   │  - "전체 상세 페이지" 딥링크 → /reviews/[id] (승인·게시 고급 워크플로우)
   │  - 저장 시 draftOverrides 머지 → 테이블 미리보기 즉시 갱신 (상태 비파괴)
```

**설계 원칙 (Stripe/Linear 규격):**
- 모든 뷰 상태를 URL에 직렬화 → 새로고침/공유/뒤로가기 무결성
- 페이지 렌더는 limit건으로 제한 (대량 DOM 렌더 방지), 통계는 별도 경량 쿼리
- 라우팅/모달 대신 슬라이드오버 → 메인 컨텍스트(스크롤·필터·페이지) 100% 보존
- table-fixed + colgroup minmax + truncate/hover → 4개국어 폭발 방어 (1px 무결점)

---

## 8. 4개 국어 시스템 (i18n)

```
LanguageContext (ko/en/ja/zh)
    │
    ├── Sidebar.tsx              ← 언어 토글 버튼 (한국어/EN/日本語/中文)
    ├── DashboardFilterBar.tsx   ← 지점·채널 필터 레이블
    ├── DashboardStats.tsx       ← 기간별 지표 카드 + locale-aware 날짜 포맷
    ├── DashboardPageContent.tsx ← 대시보드 전체 섹션 레이블 + 배지 텍스트
    ├── DashboardCharts.tsx      ← recharts 레이블 (자체 LABELS 객체)
    └── ReviewActionPanel.tsx    ← (부분)

LANG_LOCALE: { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' }
  → toLocaleDateString(locale) 에 사용
```

---

## 9. 환경변수 (필수)

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin 클라이언트 (서버사이드 only) |
| `GROQ_API_KEY` | Groq LLM (1순위) |
| `GEMINI_API_KEY` | Gemini LLM (2순위, 없으면 skip) |
| `OPENAI_API_KEY` | OpenAI (3순위, 없으면 skip) |
| `GROQ_MODEL` | 기본값: `llama-3.3-70b-versatile` |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REDIRECT_URI` | OAuth 콜백 URL |
| `CRON_SECRET` | `/api/cron/sync-all` 인증 토큰 |
| `NEXT_PUBLIC_SITE_URL` | 배포 URL (OAuth 리디렉션) |

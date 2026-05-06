# ARTE Review Automation — Light MVP 실행 계획서

작성일: 2026-05-06  
목적: 기존 `arte_review_automation_e2e_v2` 문서팩을 바탕으로, **초기 제작 속도와 실제 운영 가능성**을 우선하는 가벼운 MVP 방향을 확정한다.  
핵심 원칙: **빨리 만들고, 안전하게 운영하고, 운영 데이터와 히스토리를 쌓으며, 프론트엔드에서 계속 고도화 가능하게 만든다.**

---

## 0. 최종 결론

이 시스템은 처음부터 과하게 만들면 오래 걸리고 운영자가 쓰기 어렵다.  
초기 버전은 다음 5가지만 성공하면 충분하다.

1. **리뷰를 한 곳에 모은다.**
2. **AI가 리뷰를 분류하고 답변 초안을 만든다.**
3. **담당자가 화면에서 수정·승인·복사한다.**
4. **처리 이력과 원문/초안/최종 답변을 온라인에 아카이빙한다.**
5. **템플릿, 지점별 문구, 위험 키워드, 리포트 문구는 코드 수정 없이 관리자 화면에서 바꿀 수 있게 한다.**

초기 목표는 “완전 자동 게시봇”이 아니다.  
초기 목표는 **리뷰 응대 업무를 빠르게 표준화하고, 지점/본부가 같은 기준으로 관리할 수 있는 가벼운 운영툴**이다.

---

## 1. 만들고자 하는 것의 정확한 정의

### 1.1 서비스 정의

**ARTE Review Desk**

아르떼뮤지엄 국내/글로벌 지점 리뷰를 수집하거나 수동 입력하고, AI가 분석·초안 작성·위험 분류를 수행한 뒤, 사람이 최종 승인하여 게시 또는 복사/붙여넣기 할 수 있는 내부 운영 시스템.

### 1.2 운영 방식

| 구분 | 초기 MVP 방식 | 향후 확장 |
|---|---|---|
| Google | API 연동 가능성 확인 후 수집/답변 게시 후보 | 승인 후 API 게시 |
| Naver | 담당자가 리뷰 원문 복사/붙여넣기 | 공식 API/안정 경로 확인 시 연동 |
| TripAdvisor | 우선 수동 입력 또는 제한적 수집 검토 | 가능 범위 내 연동 |
| OTA/기타 | 수동 입력 | 채널별 템플릿 추가 |
| AI | 분류 + 답변 초안 | 지점별 학습된 스타일, 리포트 자동화 |
| 승인 | 사람이 최종 확인 | 저위험 리뷰만 자동 게시 후보 |
| 리포트 | DB 기반 월간 요약 | PDF/MD 자동 생성, 지점별 메일 발송 |

---

## 2. 초기에는 만들지 말아야 할 것

초기 제작 속도를 위해 아래는 MVP 범위에서 제외한다.

| 제외 항목 | 제외 이유 | 나중에 붙이는 방식 |
|---|---|---|
| 완전 무인 자동 답변 게시 | 플랫폼 정책/브랜드 리스크 큼 | 30일 이상 승인형 운영 후 검토 |
| 모든 채널 API 자동 수집 | 채널별 정책/인증/차단 이슈로 지연 가능성 큼 | Google 우선, 나머지는 수동 입력 |
| 복잡한 조직 권한 체계 | 개발 시간 증가 | Admin / Staff 정도로 시작 |
| 고급 BI 대시보드 | 초반에 필요 이상의 개발 | CSV/월간 MD 리포트부터 시작 |
| 다중 승인 워크플로우 | 운영이 무거워짐 | 고위험 리뷰만 별도 escalation |
| SSO 완전 연동 | 초반 구축 지연 | 우선 관리자 계정 + 2FA/강한 비밀번호 |
| 자동 스크래핑 브라우저봇 | 정책/차단/유지보수 리스크 큼 | 공식 API 없으면 수동 입력 유지 |

---

## 3. MVP 핵심 화면

초기 화면은 7개면 충분하다.

### 3.1 Inbox — 리뷰 접수함

목적: 새로 들어온 리뷰를 한 곳에서 확인한다.

필수 표시 항목:

- 지점 코드: AMNY, AMLV, AMDB, AMBS 등
- 채널: Google, Naver, TripAdvisor, OTA, Manual
- 별점
- 리뷰 원문
- 리뷰 언어
- 수집/입력일
- 현재 상태
- AI 분석 여부

필수 액션:

- AI 초안 생성
- 상세 보기
- 담당자 지정 없이 바로 처리
- 고위험으로 보내기

---

### 3.2 Review Detail — 리뷰 상세/답변 작성

목적: 리뷰 한 건을 보고 답변을 완성한다.

필수 표시 항목:

- 리뷰 원문
- 한국어 내부 요약
- 감성: positive / neutral / mixed / negative
- 위험도: low / medium / high / critical
- 카테고리: 혼잡, 대기, 직원, 가격, 시설, 전시, 티켓, 환불 등
- AI 초안 3종: 짧게 / 표준 / 조심스럽게
- 금지 표현 체크 결과
- 최종 답변 입력창

필수 액션:

- 초안 복사
- 초안 재생성
- 직접 수정
- 승인
- 보류
- 답변 불필요 처리
- 고위험 escalation

---

### 3.3 Manual Input — 수동 리뷰 입력

목적: Naver, TripAdvisor, OTA 등 API가 없거나 불안정한 채널도 같은 방식으로 처리한다.

필수 입력값:

- 지점
- 채널
- 별점
- 리뷰 원문
- 리뷰 작성일
- 리뷰 URL 선택 입력
- 공개 작성자명 선택 입력

입력 후 자동 처리:

1. 중복 여부 체크
2. DB 저장
3. AI 분석 실행
4. 답변 초안 생성
5. Review Detail로 이동

---

### 3.4 Pending Approval — 승인 대기

목적: 초안이 만들어진 리뷰를 빠르게 승인/수정한다.

필수 필터:

- 지점
- 채널
- 별점
- 위험도
- 언어
- 날짜
- 상태

필수 액션:

- 승인
- 수정 후 승인
- 복사
- 보류
- 고위험 이동

---

### 3.5 High Risk — 고위험 리뷰

목적: 사고, 환불, 안전, 차별, 개인정보, 법무성 이슈를 일반 리뷰와 분리한다.

고위험 조건:

- 1~2점 리뷰
- 환불/보상 요구
- 사고/부상/아동/안전 언급
- 직원 실명/개인정보 언급
- 차별/혐오/법적 대응/언론 언급
- 강한 불만/분쟁 가능성

초기 정책:

- 고위험 리뷰는 자동 게시 금지
- 초안은 만들 수 있지만 반드시 사람이 수정
- 공개 답변에는 보상 약속, 법적 인정, CCTV, 직원 징계 약속 금지

---

### 3.6 Archive / History — 온라인 아카이브

목적: 모든 리뷰 처리 이력을 온라인에 남긴다.

저장할 이력:

- 리뷰 원문 또는 보관 가능한 범위의 원문/요약
- AI 분석 결과
- AI 초안
- 사람이 수정한 최종 답변
- 승인자
- 승인 시간
- 게시 방식: Google API / Manual Copy / No Reply
- 상태 변경 이력
- 재생성 횟수
- 프롬프트 버전
- 템플릿 버전

아카이브 원칙:

- DB가 원장이다.
- 화면의 History는 DB를 보여주는 것이다.
- 월말에는 지점별 Markdown/CSV로 내보낸다.
- Google API 등 외부 플랫폼 정책상 원문 장기 보관이 제한될 수 있는 경우, 원문 대신 요약/분류/링크/처리 이력 중심으로 보관한다.

---

### 3.7 Settings — 운영 설정

목적: 개발자 없이 운영자가 문구/룰/템플릿을 수정할 수 있게 한다.

초기 Settings 메뉴:

1. 지점 설정
2. 채널 설정
3. 답변 템플릿
4. 지점별 톤앤매너
5. 위험 키워드
6. 카테고리 설정
7. AI 프롬프트 설정
8. 리포트 문구 설정
9. 사용자 계정

---

## 4. 하드코딩과 소프트코딩 분리

현님이 말한 “소프트코딩” 방향은 가능하다.  
정확히는 **운영자가 프론트엔드 관리자 화면에서 DB 설정값을 수정하고, AI/화면/리포트가 그 설정을 읽어서 동작하게 만드는 구조**다.

### 4.1 하드코딩해야 하는 것

아래는 운영자가 마음대로 바꾸면 안 된다.  
코드 또는 보호된 시스템 정책으로 고정한다.

| 항목 | 이유 |
|---|---|
| 고위험 리뷰 자동 게시 금지 | 브랜드/법무 리스크 |
| 1~2점 리뷰 자동 게시 금지 | 불만/분쟁 가능성 |
| 환불/보상 약속 금지 | 책임 인정 위험 |
| 법적 인정 표현 금지 | 법무 리스크 |
| CCTV/직원 징계/내부조사 상세 공개 금지 | 개인정보/운영 보안 |
| 감사 로그 삭제 금지 | 추적성 필요 |
| 최종 승인자 기록 필수 | 책임 소재 필요 |
| API 토큰 평문 저장 금지 | 보안 필수 |
| DB 원장 원칙 | 데이터 일관성 |
| 채널별 자동화 등급 | 정책/기술 리스크 |

---

### 4.2 프론트엔드에서 수정 가능해야 하는 것

아래는 관리자 화면에서 수정 가능하게 만든다.

| 항목 | 수정 화면 | 예시 |
|---|---|---|
| 지점명/기본 언어 | Settings > Branches | AMNY 기본 영어 |
| 채널 사용 여부 | Settings > Channels | Naver manual only |
| 답변 템플릿 | Settings > Reply Templates | 긍정 리뷰 감사 문구 |
| 지점별 톤 | Settings > Branch Tone | Dubai는 더 정중한 영어 |
| 위험 키워드 | Settings > Risk Rules | refund, injury, discrimination |
| 카테고리 | Settings > Categories | 혼잡, 직원, 티켓, 가격 |
| AI 프롬프트 | Settings > AI Prompt | v1.2 활성화 |
| 리포트 문구 | Settings > Report Templates | 월간 요약 문장 |
| 고위험 안내문 | Settings > Escalation | 내부 대응 안내 |
| 복사 버튼 문구 | Settings > UI Labels | 복사 완료 메시지 |

---

## 5. 소프트코딩 구조 설계

### 5.1 핵심 개념

코드에는 “어떻게 동작할지”만 둔다.  
운영 문구와 규칙은 DB에 둔다.

```text
코드 = 엔진
DB 설정값 = 운영 정책/문구/템플릿
프론트엔드 Settings = 운영자가 수정하는 화면
```

---

### 5.2 추천 테이블

초기 MVP용으로는 아래 정도면 충분하다.

```sql
branches
channels
reviews
ai_analyses
reply_drafts
approval_decisions
publishing_jobs
audit_logs
app_users
reply_templates
risk_rules
category_rules
prompt_templates
branch_tone_settings
report_templates
system_settings
```

---

### 5.3 `reply_templates`

답변 템플릿을 코드에 박지 않고 DB에서 관리한다.

```sql
create table reply_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  language text not null,
  branch_code text,
  channel_code text,
  category text,
  risk_level text,
  tone text,
  content text not null,
  status text not null default 'draft',
  version integer not null default 1,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

예시:

```text
key: positive_standard_en
language: en
branch_code: AMNY
category: positive
risk_level: low
content: Thank you for visiting ARTE MUSEUM New York...
status: active
```

---

### 5.4 `risk_rules`

위험 키워드/룰도 화면에서 수정 가능하게 한다.

```sql
create table risk_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  language text,
  keyword text,
  regex_pattern text,
  risk_level text not null,
  category text,
  action text not null,
  is_active boolean default true,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

예시:

| keyword | risk_level | action |
|---|---|---|
| refund | high | human_review_required |
| injured | critical | escalate |
| discrimination | critical | escalate |
| 직원 이름 | high | human_review_required |

주의: 운영자가 키워드를 수정할 수는 있지만, **high/critical 자동 게시 금지 로직은 코드에서 강제**한다.

---

### 5.5 `prompt_templates`

AI 프롬프트도 버전 관리한다.

```sql
create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  version text not null,
  title text not null,
  content text not null,
  status text not null default 'draft',
  created_by text,
  approved_by text,
  created_at timestamptz default now(),
  activated_at timestamptz
);
```

운영 방식:

- draft 상태에서 수정
- 테스트 리뷰 10건으로 결과 확인
- active 전환
- 기존 active는 archived 처리
- 모든 AI 결과에는 prompt version 저장

---

### 5.6 `branch_tone_settings`

지점별 스타일을 관리자 화면에서 조정한다.

```sql
create table branch_tone_settings (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  default_language text not null,
  tone_summary text not null,
  preferred_phrases jsonb,
  banned_phrases jsonb,
  special_notes text,
  is_active boolean default true,
  updated_by text,
  updated_at timestamptz default now()
);
```

예시:

```json
{
  "branch_code": "AMNY",
  "default_language": "en",
  "tone_summary": "Premium, warm, concise, not overly apologetic.",
  "preferred_phrases": ["Thank you for visiting", "We appreciate your feedback"],
  "banned_phrases": ["We guarantee", "We promise a refund", "We reviewed CCTV"],
  "special_notes": "Avoid overexplaining operational details."
}
```

---

## 6. 상태값은 단순하게 시작한다

초기에는 상태값을 너무 많이 만들지 않는다.

### 6.1 MVP 상태값

```text
new
ai_done
pending_approval
approved
manual_published
google_published
no_reply
escalated
failed
```

### 6.2 상태 설명

| 상태 | 의미 |
|---|---|
| new | 새 리뷰 저장 완료 |
| ai_done | AI 분석/초안 생성 완료 |
| pending_approval | 사람이 볼 차례 |
| approved | 최종 답변 승인 완료 |
| manual_published | 사람이 외부 채널에 복사/게시 완료 |
| google_published | Google API 게시 완료 |
| no_reply | 답변하지 않기로 결정 |
| escalated | 고위험/관리자 검토 필요 |
| failed | 수집/AI/게시 실패 |

복잡한 `qa_passed`, `assigned`, `review_updated` 등은 나중에 추가한다.

---

## 7. 온라인 히스토리 아카이빙 방법

### 7.1 가장 현실적인 구조

초기에는 별도 Notion/Drive 자동화를 먼저 만들기보다, **DB + History 화면 + 월간 export**가 가장 안정적이다.

```text
PostgreSQL/Supabase DB
→ Admin History 화면
→ 월말 Markdown/CSV export
→ Google Drive 또는 Notion에 저장
```

### 7.2 저장 단위

리뷰 1건마다 아래를 저장한다.

```text
- 리뷰 ID
- 지점
- 채널
- 별점
- 리뷰 언어
- 리뷰 원문 또는 정책상 가능한 범위의 요약
- AI 분석 결과
- AI 초안
- 사람이 수정한 최종 답변
- 승인자
- 승인 시간
- 게시 방식
- 게시 완료 여부
- 실패 사유
- 프롬프트 버전
- 템플릿 버전
```

### 7.3 월간 아카이브 파일

매월 아래 파일을 자동 또는 버튼으로 생성한다.

```text
ARTE_REVIEW_ARCHIVE_AMNY_2026_05.md
ARTE_REVIEW_ARCHIVE_AMLV_2026_05.md
ARTE_REVIEW_ARCHIVE_AMDB_2026_05.md
ARTE_REVIEW_ARCHIVE_HQ_2026_05.md
```

### 7.4 아카이브 파일 구조

```md
# ARTE Review Archive — AMNY — 2026-05

## 1. Summary
- Total reviews:
- Average rating:
- Response rate:
- High-risk reviews:
- Pending reviews:

## 2. Key Issues
- Waiting / crowding:
- Staff:
- Ticket / price:
- Facility:
- Exhibition content:

## 3. Review Log
| Date | Channel | Rating | Category | Risk | Status | Reply |
|---|---|---:|---|---|---|---|

## 4. High Risk Cases

## 5. Action Items

## 6. AI Observations

## 7. Confirmed Facts vs AI Interpretation
```

### 7.5 Google 데이터 보관 주의

Google Business Profile API 정책은 콘텐츠 저장 기간 및 사용 방식에 제한이 있을 수 있다. 따라서 Google 리뷰 원문을 장기 보관하는 방식은 구현 전에 공식 정책을 다시 확인해야 한다. 초기 설계는 안전하게 아래처럼 간다.

| 데이터 | 보관 방식 |
|---|---|
| Google 리뷰 원문 | 단기 캐시 또는 정책 확인 후 제한 저장 |
| Google 리뷰 링크/ID | 업무상 필요한 범위에서 저장 |
| AI 분류 결과 | 장기 보관 가능하도록 원문 의존도 낮춤 |
| 최종 답변 | 내부 운영 이력으로 보관 |
| 월간 리포트 | 원문 전체보다 요약/카테고리/지표 중심 |

---

## 8. 초기 기술 스택 추천

이미 n8n self-hosted를 쓰는 흐름이 있으므로, 가볍게 간다.

### 8.1 추천 구성

| 영역 | 추천 |
|---|---|
| Frontend/Admin | Next.js 또는 React/Vite |
| Backend | Node.js/Express 또는 Next.js API Routes |
| DB | Supabase PostgreSQL |
| Workflow | n8n |
| AI | OpenAI/Claude API 중 하나로 시작 |
| Auth | 초기는 이메일/비밀번호 + 강한 권한 제한 |
| Export | Markdown/CSV 버튼 생성 |
| Hosting | Vercel/Render 또는 내부 서버 |

### 8.2 더 가볍게 가는 선택지

처음 개발 리소스를 더 줄이려면 아래도 가능하다.

| 기능 | 초간단 방식 |
|---|---|
| 수동 리뷰 입력 | 웹폼 하나 |
| AI 초안 생성 | 서버 API 하나 |
| 승인 | 상태 버튼 하나 |
| 아카이브 | DB 저장 + CSV 다운로드 |
| 리포트 | 월간 Markdown 생성 |
| 외부 게시 | 복사 버튼 |

---

## 9. n8n 역할

n8n은 워크플로우만 담당한다.  
상태 판단과 원장 저장은 앱/DB가 담당한다.

### 9.1 n8n이 해도 되는 것

- 매일 Google 리뷰 수집 트리거
- 내부 API 호출
- AI 처리 요청 트리거
- 실패 알림
- 월간 리포트 생성 트리거
- Google Drive/Notion export 연동

### 9.2 n8n이 하면 안 되는 것

- 최종 승인 상태 판단
- 고위험 리뷰 자동 게시 결정
- 프롬프트 버전 원장 역할
- DB 대신 이력 저장
- 토큰/비밀값을 노출된 워크플로우에 직접 저장

---

## 10. AI 처리 방식

### 10.1 입력값

```json
{
  "branch_code": "AMNY",
  "channel": "Google",
  "rating": 5,
  "review_text": "Amazing experience...",
  "review_created_at": "2026-05-01",
  "branch_tone_setting": {},
  "reply_templates": [],
  "risk_rules": []
}
```

### 10.2 출력값

```json
{
  "detected_language": "en",
  "reply_language": "en",
  "sentiment": "positive",
  "risk_level": "low",
  "categories": ["exhibition", "experience"],
  "risk_reasons": [],
  "human_review_required": true,
  "should_auto_publish": false,
  "draft_short": "...",
  "draft_standard": "...",
  "draft_careful": "...",
  "internal_note_ko": "긍정 리뷰. 일반 승인 가능.",
  "forbidden_content_check": {
    "refund_promise": false,
    "legal_admission": false,
    "cctv_or_privacy": false,
    "staff_personal_data": false,
    "defensive_tone": false
  }
}
```

### 10.3 초기 고정 원칙

- AI는 게시하지 않는다.
- AI는 초안만 만든다.
- `should_auto_publish`는 초기에는 항상 false다.
- 사람이 최종 답변을 승인한다.
- 고위험 리뷰는 항상 별도 표시한다.

---

## 11. 최소 DB 설계

초기 MVP에서는 아래 정도만 구현한다.

### 11.1 `branches`

```sql
create table branches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ko text not null,
  name_en text,
  default_language text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### 11.2 `channels`

```sql
create table channels (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  collection_mode text not null,
  publish_mode text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

예시:

| code | collection_mode | publish_mode |
|---|---|---|
| google | api_or_manual | api_after_approval |
| naver | manual | manual_copy |
| tripadvisor | manual_or_limited | manual_copy |
| ota | manual | manual_copy |

### 11.3 `reviews`

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  channel_code text not null,
  source_review_id text,
  review_url text,
  reviewer_public_name text,
  rating numeric(2,1),
  review_text text,
  review_language text,
  review_created_at timestamptz,
  status text not null default 'new',
  normalized_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(branch_code, channel_code, normalized_hash)
);
```

### 11.4 `ai_analyses`

```sql
create table ai_analyses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete cascade,
  prompt_version text not null,
  model_name text,
  detected_language text,
  sentiment text,
  risk_level text,
  categories text[],
  risk_reasons text[],
  language_confidence numeric(4,3),
  publishability_score numeric(4,3),
  internal_note_ko text,
  raw_output jsonb,
  created_at timestamptz default now()
);
```

### 11.5 `reply_drafts`

```sql
create table reply_drafts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete cascade,
  ai_analysis_id uuid references ai_analyses(id),
  reply_language text,
  draft_short text,
  draft_standard text,
  draft_careful text,
  selected_reply text,
  human_edited_reply text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 11.6 `approval_decisions`

```sql
create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id),
  reply_draft_id uuid references reply_drafts(id),
  status text not null,
  approver_name text,
  approved_reply text,
  comment text,
  decided_at timestamptz default now()
);
```

### 11.7 `audit_logs`

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_name text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);
```

### 11.8 설정 테이블

```sql
create table system_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  updated_by text,
  updated_at timestamptz default now()
);
```

초기에는 `reply_templates`, `risk_rules`, `prompt_templates`, `branch_tone_settings`를 따로 만들되, 너무 복잡하면 `system_settings` 하나로 시작해도 된다.

---

## 12. 관리자 화면에서 수정 가능한 설정 예시

### 12.1 답변 템플릿 화면

필드:

```text
템플릿명
언어
지점
채널
카테고리
위험도
톤
본문
상태: draft / active / archived
```

운영 방식:

1. 관리자가 템플릿 수정
2. 저장하면 draft
3. 테스트 리뷰에 적용
4. 문제가 없으면 active
5. AI 생성 시 active 템플릿을 참고

---

### 12.2 위험 키워드 화면

필드:

```text
키워드
언어
카테고리
위험도
자동 조치
활성 여부
```

예시:

```text
refund / en / refund / high / human_review_required
injury / en / safety / critical / escalate
환불 / ko / refund / high / human_review_required
다쳤 / ko / safety / critical / escalate
```

---

### 12.3 지점별 톤 화면

필드:

```text
지점 코드
기본 언어
응대 톤 요약
자주 쓰는 표현
금지 표현
특이사항
```

예시:

```text
AMNY
English
Warm, premium, concise, not defensive.
Preferred: Thank you for visiting / We appreciate your feedback
Banned: We guarantee / We promise refund / We checked CCTV
```

---

## 13. 지점/채널 초기 정책

### 13.1 국내 지점

| 지점 | 기본 언어 | 초기 채널 | 방식 |
|---|---|---|---|
| AMBS 부산 | Korean | Naver/OTA | 수동 입력 + AI 초안 + 복사 |
| AMJJ 제주 | Korean | Naver/OTA | 수동 입력 + AI 초안 + 복사 |
| AMYS 여수 | Korean | Naver/OTA | 수동 입력 + AI 초안 + 복사 |
| AMGN 강릉 | Korean | Naver/OTA | 수동 입력 + AI 초안 + 복사 |

### 13.2 글로벌 지점

| 지점 | 기본 언어 | 초기 채널 | 방식 |
|---|---|---|---|
| AMDB Dubai | English | Google/TripAdvisor | Google 우선, TripAdvisor 수동 |
| AMNY New York | English | Google/TripAdvisor | Google 우선, TripAdvisor 수동 |
| AMLV Las Vegas | English | Google/TripAdvisor | Google 우선, TripAdvisor 수동 |

---

## 14. 실행 로드맵 — 가벼운 버전

### Phase 0 — 준비

목표: 바로 개발 가능한 최소 기준 확정.

완료 조건:

- 사용할 지점 목록 확정
- 지점별 기본 언어 확정
- 초기 채널 목록 확정
- Google API 가능 여부 확인
- 관리자 계정 1~3개 확정
- 기본 답변 템플릿 10~20개 준비
- 위험 키워드 30~50개 준비

---

### Phase 1 — Manual Review Desk MVP

목표: 외부 API 없이도 즉시 사용할 수 있는 내부 웹앱 완성.

포함 기능:

- 수동 리뷰 입력
- 리뷰 목록
- 리뷰 상세
- AI 분석/초안 생성
- 답변 수정
- 승인
- 복사 버튼
- 상태 변경
- History 저장
- CSV/Markdown export
- Settings에서 템플릿 수정

이 단계만 되어도 국내 지점/Naver/OTA/TripAdvisor 리뷰 응대는 바로 표준화 가능하다.

---

### Phase 2 — Google 연동

목표: Google 리뷰 수집과 승인 후 게시를 연결한다.

포함 기능:

- Google OAuth/API 연결
- 지점별 locationId 저장
- Google 리뷰 수집
- 중복 저장 방지
- 승인 후 Google reply API 호출
- 게시 성공/실패 로그
- 실패 시 수동 복사 모드 전환

---

### Phase 3 — 월간 리포트

목표: 리뷰 아카이브를 월간 보고서로 전환한다.

포함 기능:

- 지점별 월간 요약
- 채널별 리뷰 수
- 평균 평점
- 답변율
- 고위험 리뷰 수
- 반복 불만 카테고리
- AI 관찰과 확정 사실 분리
- Markdown export

---

### Phase 4 — 고도화

목표: 운영 데이터가 쌓인 뒤 실제 필요한 것만 추가한다.

후보 기능:

- Google 저위험 리뷰 자동 게시 후보
- 담당자 배정
- SLA 알림
- Notion/Google Drive 자동 아카이브
- 지점별 리포트 자동 발송
- 프롬프트 회귀 테스트
- 응답 품질 점수화
- 다국어 QA

---

## 15. 운영 방식

### 15.1 일일 운영

1. 담당자가 리뷰 접수함 확인
2. 신규 리뷰 AI 분석 실행
3. low/medium은 초안 수정 후 승인
4. high/critical은 High Risk로 이동
5. Google은 가능 시 게시, 나머지는 복사/붙여넣기
6. 게시 완료 후 상태 변경

### 15.2 주간 운영

1. 반복 불만 카테고리 확인
2. 템플릿 개선
3. 위험 키워드 추가
4. 답변 품질 샘플 검토
5. 미처리 리뷰 확인

### 15.3 월간 운영

1. 지점별 월간 아카이브 생성
2. 본부용 월간 요약 생성
3. 부정 리뷰/고위험 리뷰 확인
4. 반복 이슈 액션 아이템 정리
5. 템플릿/프롬프트 버전 업데이트

---

## 16. 권한은 단순하게 시작한다

### 16.1 MVP 권한

| 권한 | 가능 작업 |
|---|---|
| Admin | 모든 지점 조회/수정, Settings 수정, 리포트 생성 |
| Staff | 지정 지점 리뷰 처리, 답변 복사, 상태 변경 |
| Viewer | 조회만 가능 |

초기에는 이 3개면 충분하다.

### 16.2 권한 규칙

- Staff는 Settings 수정 불가
- Viewer는 답변 수정/승인 불가
- Admin만 템플릿/프롬프트/위험 키워드 수정 가능
- 모든 수정은 audit log 저장

---

## 17. 품질 기준

### 17.1 답변 품질 기준

좋은 답변:

- 리뷰 언어와 동일한 언어로 작성
- 감사 표현 포함
- 고객 경험에 대한 공감 포함
- 불필요한 변명 없음
- 과도한 사과 없음
- 보상/환불/법적 책임 약속 없음
- 지점 브랜드 톤 유지

나쁜 답변:

- 리뷰와 다른 언어
- 기계 번역투
- 고객과 논쟁
- “정책상 불가”만 반복
- 직원 실명 재언급
- CCTV 확인 언급
- 환불 약속
- 법적 책임 인정

---

### 17.2 자동화 품질 기준

MVP에서는 아래 정도만 확인한다.

| 항목 | 기준 |
|---|---|
| 수동 입력 저장 | 100% |
| AI 초안 생성 | 95% 이상 |
| 중복 리뷰 차단 | 동일 원문/별점/채널 기준 작동 |
| 고위험 분류 | 명확한 키워드 포함 시 반드시 high/critical |
| 복사 버튼 | 모바일/PC 모두 작동 |
| 아카이브 | 모든 상태 변경 저장 |
| Export | 월별 CSV/MD 생성 가능 |

---

## 18. 개발자에게 줄 구현 명령

아래 명령을 Cursor/Claude Code에 전달하면 된다.

```text
You are building ARTE Review Desk Light MVP.

Goal:
Build a lightweight internal review-response dashboard for ARTE MUSEUM branches.
The system must support manual review input, AI analysis, reply draft generation, human approval, copy/manual publish tracking, online history archive, and admin-editable softcoded settings.

Do not build a complex enterprise workflow.
Do not build full auto-publishing first.
Do not build browser scraping or CAPTCHA bypass.
Do not hardcode operational reply templates, branch tone, risk keywords, category names, or report wording if they can be stored in DB and edited from Settings.

Hardcoded safety rules:
- AI never publishes directly.
- high/critical risk reviews cannot be auto-published.
- 1-2 star reviews cannot be auto-published.
- refund, compensation, legal admission, CCTV, staff discipline, private data, and liability commitments are forbidden in public replies.
- every review, AI output, edit, approval, copy, publish, and status change must create an audit log.

MVP pages:
1. Inbox
2. Manual Input
3. Review Detail
4. Pending Approval
5. High Risk
6. Archive / History
7. Settings
8. Reports basic export

MVP DB tables:
- branches
- channels
- reviews
- ai_analyses
- reply_drafts
- approval_decisions
- audit_logs
- app_users
- reply_templates
- risk_rules
- category_rules
- prompt_templates
- branch_tone_settings
- report_templates
- system_settings

Softcoded admin-editable settings:
- branch default language
- channel mode
- reply templates
- branch tone
- preferred phrases
- banned phrases
- risk keywords
- category taxonomy
- AI prompt templates
- report templates

Initial workflow:
1. Staff manually enters a review or review is imported from Google later.
2. System saves review with normalized hash to prevent duplicates.
3. Staff clicks Generate AI Draft.
4. Backend calls LLM using active prompt template, branch tone, reply templates, and risk rules.
5. System stores AI analysis and three drafts.
6. Staff reviews, edits, approves, copies, and marks manual published.
7. Every action is written to audit_logs.
8. Archive page shows complete history.
9. Reports page can export monthly Markdown and CSV.

UI principles:
- Korean-first admin UI.
- Clean, bright, functional dashboard.
- High contrast text. No grey-on-grey or low contrast.
- Tables must be readable.
- High-risk reviews visually separated.
- Settings must be simple enough for non-developers.

Deliverables:
- Working app.
- SQL migrations.
- Seed data for ARTE branches and channels.
- Sample templates in Korean and English.
- Sample risk rules.
- Basic LLM gateway.
- Manual input flow.
- Approval flow.
- Archive flow.
- Markdown/CSV export.
- README with setup commands.

Readiness gate:
The MVP is acceptable only if a staff member can enter a Naver/TripAdvisor/OTA review manually, generate an AI draft, edit it, approve it, copy it, mark it as manually published, and later find the full history in Archive.
```

---

## 19. MVP 성공 기준

아래가 되면 초기 성공이다.

```text
1. 리뷰 수동 입력 가능
2. AI 답변 초안 생성 가능
3. 사람이 수정 가능
4. 승인/복사/게시완료 체크 가능
5. 모든 히스토리 저장 가능
6. 지점/채널별 필터 가능
7. 템플릿/위험 키워드/지점 톤을 Settings에서 수정 가능
8. 월말 Markdown/CSV export 가능
9. Google 연동 전에도 실사용 가능
10. Google 연동 후에도 같은 화면에서 처리 가능
```

---

## 20. 최종 방향

이 시스템은 처음부터 완벽한 자동화 시스템으로 만들면 안 된다.  
가장 현실적인 방향은 아래다.

```text
1단계: 수동 입력 + AI 초안 + 승인 + 복사 + 아카이브
2단계: Google API 수집/게시 연동
3단계: 월간 리포트 자동화
4단계: Settings 기반 운영 고도화
5단계: 충분한 데이터가 쌓이면 low-risk 자동 게시 후보 검토
```

초기에는 작고 빠르게 만든다.  
대신 DB 구조와 Settings 구조는 처음부터 확장 가능하게 잡는다.  
그러면 나중에 지점, 채널, 언어, 템플릿, 리포트, 자동 게시까지 단계적으로 붙일 수 있다.

---

## 21. 공식 확인이 필요한 외부 참고

아래 항목은 구현 직전 최신 공식 문서를 다시 확인한다.

- Google Business Profile API — review list/reply/delete 기능
- Google Business Profile API 정책 — 콘텐츠 저장/사용 제한
- TripAdvisor Content API — 제공 범위와 리뷰 접근 제한
- Naver SmartPlace — 사업자 리뷰 답글 기능과 공개 API 가능 여부

참고 URL:

```text
https://developers.google.com/my-business/content/review-data
https://developers.google.com/my-business/content/policies
https://developers.google.com/my-business/reference/rest
https://tripadvisor-content-api.readme.io/reference/overview
https://help.naver.com/
```


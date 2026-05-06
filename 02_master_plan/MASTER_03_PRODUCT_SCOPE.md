# Product Scope

## 1. Core Product Modules

| Module | Description | Phase |
|---|---|---|
| Review Ingestion | API/scraper/manual input | 1-3 |
| Review Normalizer | 공통 데이터 구조 변환 | 1 |
| AI Analysis | 언어/감성/카테고리/위험도 | 1 |
| Reply Generator | 다국어 답변 초안 | 1 |
| Approval Dashboard | 승인/수정/복사/게시 | 1 |
| Publishing Connector | Google API posting | 1 |
| Manual Posting Desk | 복사 게시용 화면 | 2-3 |
| Prompt Manager | 프롬프트 버전관리 | 2 |
| Reporting Engine | 월간 리포트 생성 | 4 |
| Audit & Monitoring | 로그/알림/실패 처리 | 1-4 |

## 2. MVP Scope

- AMDB/AMNY/AMLV Google 리뷰
- 리뷰 수집
- AI 초안
- 위험도 분류
- 관리자 승인
- Google 게시
- 게시 로그
- 기본 월간 CSV/Markdown 리포트

## 3. Post-MVP Scope

- TripAdvisor/Naver 반자동 수집
- 국내 OTA 수동 붙여넣기
- 다국어 고도화
- 월간 PDF 리포트
- prompt A/B QA
- auto-publish pilot

## 4. Explicitly Out of Scope

- Fake review generation
- Rating solicitation automation
- Platform restriction bypass
- Automated refund/compensation decisions
- Legal dispute handling by AI
- Unapproved public responses

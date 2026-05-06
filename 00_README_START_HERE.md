# ARTE MUSEUM Review Automation E2E Master Pack v2

작성일: 2026-04-30  
목적: 아르떼뮤지엄 전 지점 리뷰 자동화/반자동화 시스템을 흔들리지 않게 구축하기 위한 **정책·기획·시스템·프롬프트·운영·테스트 전체 기준 문서**입니다.

## 이 문서팩의 결론

이전 버전은 방향성 정리 수준이었고, 이번 v2는 **정책 고정, 리스크 경계, 데이터 구조, 승인 체계, 프롬프트, 운영 SOP, E2E 테스트 기준**까지 분리했습니다.

## 반드시 먼저 읽을 파일

1. `00_README_START_HERE.md`
2. `01_EXECUTIVE_DECISION_LOCK.md`
3. `02_POLICY_LOCK_NOT_NEGOTIABLE.md`
4. `03_E2E_SYSTEM_MAP.md`
5. `04_ROADMAP_AND_READINESS_GATES.md`
6. `01_research/RESEARCH_00_SOURCE_LEDGER.md`
7. `03_policies/POLICY_01_CHANNEL_AUTOMATION_LOCK.md`
8. `04_architecture/ARCH_01_SYSTEM_OVERVIEW.md`
9. `06_prompts/PROMPT_01_MASTER_REVIEW_REPLY.md`

## 폴더 구성

| Folder | Purpose |
|---|---|
| `01_research` | 공식 문서/가격/채널 가능성/리스크 근거 |
| `02_master_plan` | 사업·운영·제품 마스터 플랜 |
| `03_policies` | 흔들리면 안 되는 정책 문서 |
| `04_architecture` | 시스템 구조, DB, API, n8n, MCP/Agent, 보안 |
| `05_skills` | Skillfish 스킬별 사용 목적과 산출물 |
| `06_prompts` | LLM 프롬프트, 언어별 응대, 평가 프롬프트 |
| `07_operations` | 일일 운영 SOP, 승인, CS, escalation, RACI |
| `08_templates` | 답변/리포트/이메일/대시보드 템플릿 |
| `09_agent_commands` | Claude Code/Cursor/n8n 구현 명령 |
| `10_testing` | QA, E2E, 샘플 리뷰, 회귀 테스트 |
| `11_reporting` | 월간/지점별/본부용 리포트 구조 |
| `12_appendices` | 용어, 코드, 리스크 키워드, 카테고리 |

## 정책 고정 요약


1. **완전 무인 자동 답변봇으로 만들지 않는다.** 초기 운영은 전 채널 관리자 승인형이다.
2. **Google만 승인 후 자동 게시 후보**로 둔다. Google도 1~2개월 안정화 전에는 무조건 승인형이다.
3. **TripAdvisor/Naver/국내 OTA는 자동 게시 대상이 아니다.** 공식 게시 API가 검증되기 전까지 복사/붙여넣기 반자동이다.
4. **리뷰 작성/평점 조작/가짜 리뷰/보상형 리뷰 유도는 시스템 범위에서 영구 제외**한다.
5. **고객 국적을 추정하지 않는다.** 리뷰 본문 언어만 감지한다.
6. **한국어·영어·일본어·중국어·아랍어를 1차 전문 언어로 잠근다.**
7. **언어는 직역 금지.** 각 언어권의 자연스러운 비즈니스 응대 문장으로 작성한다.
8. **1~3점, 안전, 사고, 환불, 차별, 아동, 법무, 언론, 개인정보 리뷰는 자동 게시 금지**한다.
9. **답변은 항상 감사·공감·사실 범위·개선 의지 중심**이며 환불/보상/법적 인정/직원 징계 약속을 하지 않는다.
10. **모든 수집·분석·수정·승인·게시 이벤트는 감사 로그로 남긴다.**
11. **정책 변경은 문서 PR 또는 승인 로그 없이는 운영에 반영하지 않는다.**
12. **운영 지표는 답변 속도보다 답변 안전성과 브랜드 일관성을 우선한다.**


## 지점 기준


| Code | Branch | Region | Default reply language | Primary channels | Phase |
|---|---|---|---|---|---|
| AMBS | 아르떼뮤지엄 부산 | Korea | Korean | Naver, OTA/manual | Phase 2-3 |
| AMJJ | 아르떼뮤지엄 제주 | Korea | Korean | Naver, OTA/manual | Phase 2-3 |
| AMYS | 아르떼뮤지엄 여수 | Korea | Korean | Naver, OTA/manual | Phase 2-3 |
| AKJJ | 아르떼키즈파크 제주 | Korea | Korean | Naver, OTA/manual | Phase 2-3 |
| AMGN | 아르떼뮤지엄 강릉 | Korea | Korean | Naver, OTA/manual | Phase 2-3 |
| AMDB | ARTE MUSEUM Dubai | Global | English | Google, TripAdvisor | Phase 1-2 |
| AMNY | ARTE MUSEUM New York | Global | English | Google, TripAdvisor | Phase 1-2 |
| AMLV | ARTE MUSEUM Las Vegas | Global | English | Google, TripAdvisor | Phase 1-2 |


## 공식 근거 URL

```json
{
  "google_review_data": "https://developers.google.com/my-business/content/review-data",
  "google_update_reply": "https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply",
  "google_business_profile_api": "https://developers.google.com/my-business",
  "google_content_policy": "https://support.google.com/contributionpolicy/answer/7400114",
  "n8n_docker": "https://docs.n8n.io/hosting/installation/docker/",
  "n8n_hosting": "https://docs.n8n.io/hosting/",
  "tripadvisor_content_api": "https://tripadvisor-content-api.readme.io/reference/overview",
  "tripadvisor_management_response": "https://www.tripadvisor.com/business/insights/hotels/resources/add-management-responses-to-reviews",
  "naver_reply_help": "https://help.naver.com/service/30026/contents/20493?lang=ko",
  "naver_review_reply_methods": "https://help.naver.com/alias/NSP/NSP_13.naver",
  "apify_pricing": "https://apify.com/pricing",
  "apify_subscription": "https://help.apify.com/en/articles/5136728-subscribing-to-the-apify-platform"
}
```

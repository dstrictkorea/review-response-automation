# 04. Roadmap and Readiness Gates

## 1. Phase Overview

| Phase | Name | Scope | Exit Gate |
|---|---|---|---|
| 0 | Policy & Access Readiness | 정책 확정, 계정 권한, API 가능성 검증 | 계정/권한/리스크 문서 완료 |
| 1 | Google MVP | AMDB/AMNY/AMLV Google 리뷰 수집·초안·승인·게시 | 2주간 누락/중복/위험 게시 0건 |
| 2 | Semi-Automated Collection | TripAdvisor/Naver 수집 테스트와 초안 생성 | 수집 성공률 95% 이상 또는 수동 전환 기준 확정 |
| 3 | Manual Channel AI Desk | OTA/기타 채널 수동 붙여넣기 초안 웹앱 | 리뷰 1건 처리 30초 이하 |
| 4 | Reporting Automation | 월간 지점/본부 리포트 자동화 | 전월 데이터 기반 PDF/MD 리포트 생성 |
| 5 | Controlled Auto-Publish Pilot | Google low-risk 자동 게시 후보 테스트 | 30일 무사고 + 샘플 검수 통과 |
| 6 | Full Ops Governance | SLA, 감사, 프롬프트 버전관리, 다국어 QA | 운영 정책 안정화 |

## 2. Phase 0 Gate

- Google Business Profile 관리자 권한 확인
- 각 지점 location ID 확보
- API 프로젝트/OAuth scope 검토
- TripAdvisor/Naver 계정 권한 확인
- 스크래핑 금지/허용 범위 확인
- 관리자 승인자 지정
- CS escalation 담당자 지정
- 프롬프트 정책 v1 승인

## 3. Phase 1 Gate

- Google 리뷰 신규 수집 가능
- 중복 리뷰 저장 차단
- AI 초안 생성 성공률 99%
- 1~3점 자동 게시 차단
- Google 게시 API 성공/실패 로그 저장
- 답변 수정/삭제 대응 경로 확인
- 관리자 승인 UI에서 원문/초안/리스크/수정본 확인 가능

## 4. Phase 2 Gate

- TripAdvisor/Naver 수집이 가능한지 실제 지점 1개로 확인
- 수집이 불안정하면 즉시 Manual Paste 모드로 전환
- CAPTCHA/로그인 우회 금지
- UI 변경 시 실패 알림
- 스크래핑 결과와 실제 페이지 비교 샘플 검수

## 5. Phase 3 Gate

- 국내 OTA 담당자가 리뷰 원문을 붙여넣으면 30초 이내 초안 생성
- 채널/지점/별점/언어 선택 가능
- 복사 버튼 제공
- 게시 완료 체크 가능
- 수동 입력 데이터도 월간 리포트에 반영

## 6. Phase 4 Gate

- 지점별 월간 리뷰 수/평점/답변율 집계
- 반복 불만 카테고리 자동 추출
- 부정 리뷰 원문 링크/요약 제공
- AI 관찰과 확정 사실 분리
- 국내 지점은 한국어 리포트, 글로벌 지점은 영어 리포트 생성

## 7. Phase 5 Gate

자동 게시는 운영 편의를 위한 선택 기능이지 필수 목표가 아닙니다.  
아래 조건을 모두 만족하기 전까지 금지합니다.

- 30일간 승인형 Google 운영 사고 0건
- low-risk 분류 precision 95% 이상
- 언어 감지 정확도 98% 이상
- 답변 반복도 검사 통과
- 본부 승인
- rollback 절차 검증

# Data and Reporting Strategy

## 1. Data Strategy

모든 채널의 리뷰를 하나의 공통 데이터 모델로 저장한다. 채널마다 원문 구조가 달라도 리포트와 승인 대시보드는 동일 필드를 사용해야 한다.

## 2. Required Fields

- review_id
- source_review_id
- branch_code
- channel
- rating
- review_text
- review_language
- reply_language
- reviewer_public_name
- review_url
- review_created_at
- collected_at
- sentiment
- categories
- risk_level
- ai_draft
- human_edited_reply
- approval_status
- approved_by
- approved_at
- published_at
- publishing_status
- prompt_version
- model_version
- audit_log_id

## 3. Reporting Strategy

### Branch Monthly Report

- 리뷰 수
- 평균 평점
- 전월 대비 변화
- 채널별 리뷰 수
- 답변 완료율
- 부정 리뷰 비율
- TOP positive keywords
- TOP negative keywords
- 반복 불만
- 위험 리뷰 목록
- 운영 개선 제안

### HQ Monthly Report

- 국내/글로벌 비교
- 지점별 평판 변화
- 주요 공통 불만
- 브랜드 경험 긍정 요인
- 개선 우선순위
- 자동화 운영 성과
- 리스크 발생 현황

## 4. Evidence Policy

AI 인사이트는 근거 리뷰 수와 비율을 함께 표시한다.

Bad:
- “AMNY는 직원 응대 문제가 심각합니다.”

Good:
- “AMNY 리뷰 48건 중 4건에서 직원 안내 관련 불만이 관찰되었습니다. 표본은 제한적이므로 운영팀 확인이 필요합니다.”

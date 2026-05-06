# KPI and Success Metrics

## 1. Operational KPIs

| KPI | Definition | Target MVP | Target Stable |
|---|---|---:|---:|
| Review collection success | 신규 리뷰 수집 성공률 | 95% | 99% |
| Duplicate rate | 중복 저장/중복 답변 | 0 critical | 0 |
| Median draft time | 리뷰 수집 후 초안 생성 시간 | < 5 min | < 1 min |
| Approval response time | 승인 대기 후 처리 시간 | < 24h | < 12h |
| Reply completion rate | 답변 완료 리뷰 비율 | 80% | 95% |
| High-risk leakage | 위험 리뷰 자동 게시 | 0 | 0 |
| Language QA pass | 언어별 자연성/문법 통과 | 90% | 95% |
| Manual effort saved | 담당자 시간 절감 | 50% | 70-80% |
| Report completion | 월간 리포트 자동 생성 | basic | full |

## 2. Quality Metrics

| Metric | Description |
|---|---|
| Tone consistency score | 브랜드 톤과 일치하는지 |
| Specificity score | 리뷰 내용에 맞춤형으로 답했는지 |
| Safety score | 금지 표현/위험 약속이 없는지 |
| Localization score | 언어권 문체가 자연스러운지 |
| Repetition score | 같은 문장이 반복되지 않는지 |

## 3. Risk Metrics

- 1~3점 리뷰 검토 누락
- 민감 키워드 검출 누락
- Google API 실패율
- 스크래퍼 실패율
- 답변 숨김/삭제/거절 사례
- 고객 재불만 발생률
- 수정 없이 승인된 AI 초안 비율

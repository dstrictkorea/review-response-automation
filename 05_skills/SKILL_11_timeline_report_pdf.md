# timeline-report / pdf

## 1. Purpose

월간 지점/본부 리포트와 PDF 생성 기준을 관리한다.

## 2. When to Use

- 해당 영역을 처음 설계할 때
- 정책/프롬프트/코드 변경 전 영향 범위를 볼 때
- 구현 결과가 문서 기준과 어긋나는지 검토할 때

## 3. Inputs

- 현재 정책 문서
- 채널별 가능성
- 지점/언어 기준
- 기존 코드 또는 n8n workflow
- 실패 로그/운영 이슈

## 4. Outputs

- `REPORT_01_MONTHLY_REPORT_SPEC.md`

## 5. Command Pattern

```text
Use skillfish skill: timeline-report / pdf

Context:
ARTE MUSEUM review automation system.
Do not propose full auto-publishing unless policy gates are passed.
Respect branch/language/channel policy locks.

Task:
[구체 작업 입력]

Output:
- findings
- risks
- required changes
- files to update
- tests to run
```

## 6. Acceptance Criteria

- 정책 위반 제안 없음
- Google/TripAdvisor/Naver 구분 명확
- Human approval gate 유지
- 다국어/브랜드 톤 반영
- 운영 가능한 수준의 산출물

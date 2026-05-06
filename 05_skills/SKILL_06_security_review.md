# security-review

## 1. Purpose

OAuth, API token, admin 권한, audit log, data retention을 검토한다.

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

- `POLICY_06_PRIVACY_SECURITY_DATA_RETENTION.md`
- `ARCH_08_MONITORING_BACKUP_SECURITY.md`

## 5. Command Pattern

```text
Use skillfish skill: security-review

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

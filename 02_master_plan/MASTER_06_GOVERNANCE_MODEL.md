# Governance Model

## 1. Governance Layers

| Layer | What it controls |
|---|---|
| Business Policy | 자동화 범위, 채널 정책, 답변 금지 항목 |
| AI Policy | 프롬프트, 언어, 위험 분류, QA 기준 |
| System Policy | 데이터, 보안, 로그, 권한 |
| Operations Policy | 승인자, SLA, escalation |
| Reporting Policy | 월간 보고 형식, 근거 수준 |

## 2. Change Control

정책 변경은 아래 조건을 충족해야 한다.

1. 변경 사유 문서화
2. 영향 범위 확인
3. 테스트 케이스 업데이트
4. 운영 책임자 승인
5. 프롬프트 버전 변경
6. 배포 후 7일 모니터링

## 3. Policy Versioning

- `policy_version`
- `prompt_version`
- `risk_rule_version`
- `branch_tone_version`
- `workflow_version`

모든 리뷰 처리 기록에 위 버전을 남긴다.

## 4. Decision Rights

| Decision | Owner |
|---|---|
| 자동 게시 활성화 | 본부/운영책임자 |
| 위험 리뷰 답변 | CS/운영관리자 |
| 법무성 답변 | 법무/관리자 |
| 프롬프트 변경 | 시스템매니저 + 운영관리자 |
| 채널 확장 | 운영팀 + 시스템팀 |
| 리포트 배포 | HQ 운영 |

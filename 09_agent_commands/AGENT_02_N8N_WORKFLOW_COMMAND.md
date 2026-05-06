# Agent 02. n8n Workflow Command

```text
Create n8n workflows for:
1. Google review collection
2. Google approved reply publishing
3. TripAdvisor semi-automated collection
4. Naver semi-automated collection
5. Monthly review report generation
6. Failure/spend/high-risk alerting

Each workflow must:
- be idempotent
- log errors
- call internal API rather than own DB writes where possible
- never publish without approval
- include manual fallback
- include workflow version metadata
```

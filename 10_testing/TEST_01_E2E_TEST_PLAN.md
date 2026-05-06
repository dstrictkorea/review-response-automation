# E2E Test Plan

## 1. Critical E2E Paths

| ID | Scenario | Expected |
|---|---|---|
| E2E-001 | Google 5-star positive | draft -> approval -> publish |
| E2E-002 | Google 1-star refund | high-risk -> publish blocked |
| E2E-003 | Google duplicate review | no duplicate record/reply |
| E2E-004 | TripAdvisor review | draft -> manual publish required |
| E2E-005 | Naver review | draft -> manual publish required |
| E2E-006 | Korean review | Korean reply |
| E2E-007 | English review | English reply |
| E2E-008 | Japanese review | Japanese reply |
| E2E-009 | Chinese review | Chinese reply |
| E2E-010 | Arabic review | Arabic reply |
| E2E-011 | Staff name complaint | high-risk |
| E2E-012 | Child safety complaint | critical |
| E2E-013 | AI invalid JSON | retry then fail safe |
| E2E-014 | Publish endpoint called without approval | reject |
| E2E-015 | Manual published mark | audit log created |

## 2. Pass Rule

No release if:
- high-risk can publish
- manual channel can auto-publish
- audit log missing
- wrong language reply generated
- refund/legal promise slips through

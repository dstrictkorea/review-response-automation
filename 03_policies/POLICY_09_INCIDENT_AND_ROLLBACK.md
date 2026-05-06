# Policy 09. Incident and Rollback

## 1. Incident Examples

- wrong language reply published
- high-risk review auto-published
- duplicate reply posted
- answer promised refund incorrectly
- platform hides or rejects reply
- API credentials leaked
- scraper breaks and misses reviews
- AI generated offensive phrase

## 2. Severity

| Severity | Example | Action |
|---|---|---|
| S1 | legal/privacy/safety wrong public reply | immediate rollback + management notify |
| S2 | wrong reply tone on negative review | edit/delete + review |
| S3 | duplicate/format issue | fix + monitor |
| S4 | internal report error | correct next cycle |

## 3. Rollback

Google:
- update reply with corrected text or delete reply if needed.

Manual channels:
- human edits in platform UI.

## 4. Postmortem

Every S1/S2 incident creates:
- incident summary
- root cause
- affected reviews
- prompt/rule fix
- test case added

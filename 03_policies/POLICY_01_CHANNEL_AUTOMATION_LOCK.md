# Policy 01. Channel Automation Lock

## 1. Channel Classes

| Class | Description | Channels |
|---|---|---|
| A | API collection + approval-based API publish | Google Reviews |
| B | Semi-automated collection + AI draft + manual publish | TripAdvisor, Naver |
| C | Manual input + AI draft + manual publish | Domestic OTA and marketplaces |
| D | Excluded | Any channel requiring bypass, fake identity, or prohibited automation |

## 2. Class A Rules

- API credentials must be official.
- Location must be verified.
- Every public reply requires human approval in Phase 1-4.
- Auto-publish pilot only after readiness gate.
- API failures must not retry infinitely.
- Duplicate reply prevention is mandatory.

## 3. Class B Rules

- Collection may be scheduled only when allowed and stable.
- CAPTCHA/login bypass is forbidden.
- Publishing remains manual.
- UI copy button and posting checklist are required.
- If collection fails twice consecutively, switch to manual mode.

## 4. Class C Rules

- User copies review into system.
- System generates draft.
- User copies reply back to platform.
- Manual posted status is recorded.
- No automated login/posting.

## 5. Lock Statement

A channel moves upward only after official API capability and platform policy review are documented.

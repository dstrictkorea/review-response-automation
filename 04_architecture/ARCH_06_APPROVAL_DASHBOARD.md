# Architecture 06. Approval Dashboard

## 1. Main Views

| View | Purpose |
|---|---|
| Inbox | all new reviews |
| Pending Approval | ready drafts |
| High Risk | urgent manager review |
| Manual Publish | copy/paste queue |
| Published | history |
| Reports | KPI and monthly reports |
| Prompt Admin | prompt/version management |
| Settings | branch/channel config |

## 2. Review Card

Must show:
- branch code/name
- channel
- rating
- original language
- review text
- translated Korean internal summary
- AI categories
- risk level
- draft options
- policy flags
- recommended action

## 3. Actions

- approve
- edit and approve
- request regeneration
- escalate
- reject/no reply
- copy reply
- mark manual published
- publish to Google
- view audit log

## 4. Filters

- branch
- channel
- rating
- language
- risk
- status
- date
- category
- assigned owner

## 5. UX Principle

The dashboard must reduce cognitive load.  
High-risk reviews must be visually separated and never mixed with low-risk bulk approvals.

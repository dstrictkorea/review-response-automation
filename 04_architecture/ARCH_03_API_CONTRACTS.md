# Architecture 03. API Contracts

## 1. Internal API Endpoints

### GET /api/reviews

Query:
- branch_code
- channel
- rating_min
- rating_max
- language
- risk_level
- approval_status
- date_from
- date_to

Response:
```json
{
  "items": [],
  "next_cursor": null
}
```

### POST /api/reviews/manual

Manual paste channel input.

```json
{
  "branch_code": "AMBS",
  "channel": "naver",
  "rating": 4,
  "review_text": "전시가 예뻤어요.",
  "review_url": "optional",
  "review_created_at": "2026-04-30T10:00:00+09:00"
}
```

### POST /api/reviews/:id/generate-draft

Regenerate AI draft.

### POST /api/reviews/:id/approve

```json
{
  "reply_draft_id": "uuid",
  "approved_reply": "text",
  "decision": "approved",
  "comment": "optional"
}
```

### POST /api/reviews/:id/publish

For Google only after approval.

### POST /api/reviews/:id/mark-manual-published

For TripAdvisor/Naver/OTA.

### POST /api/reviews/:id/escalate

Escalate to manager/CS.

## 2. Webhook Endpoints

### POST /webhooks/n8n/google-review-collected

n8n sends normalized review or source payload.

### POST /webhooks/n8n/publishing-result

Publishing result callback.

## 3. API Principles

- API must be idempotent.
- Manual input must also go through same AI/risk flow.
- Publishing requires approved status.
- High/Critical blocks publish endpoint.

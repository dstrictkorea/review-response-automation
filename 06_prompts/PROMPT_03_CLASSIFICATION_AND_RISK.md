# Prompt 03. Classification and Risk Prompt

```text
Analyze the review for operational routing.

Return JSON only.

Input:
rating: {{rating}}
review_text: {{review_text}}
branch_code: {{branch_code}}
channel: {{channel}}

Classify:
- sentiment
- primary_category
- secondary_categories
- risk_level
- escalation_required
- public_reply_allowed
- manual_review_reason

Categories:
visual_experience, crowding, waiting_time, staff_service, ticket_price, refund_ticketing, safety, child_safety, accessibility, cleanliness, wayfinding, language_support, cafe, gift_shop, parking_transport, technical_issue, photo_policy, expectation_mismatch, other

Risk rules:
- 1-2 stars = at least high unless text is empty.
- 3 stars = medium minimum.
- refund/legal/safety/staff/privacy/discrimination/child = high or critical.
- accident/injury/police/media/legal threat = critical.
- empty 4-5 star = low.
```

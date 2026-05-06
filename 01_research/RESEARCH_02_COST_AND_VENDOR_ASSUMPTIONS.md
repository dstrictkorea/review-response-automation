# Cost and Vendor Assumptions

## 1. Current Cost Model

| Item | Base Cost | Notes |
|---|---:|---|
| n8n self-hosted | $0 platform subscription | Server already available assumption. |
| Company server | $0 incremental | Existing server assumption. |
| Google Business Profile API | $0 direct API cost assumed | Verify quota/usage limits during implementation. |
| Apify Starter | $29/month + pay-as-you-go | Official pricing currently shows $29; prior $39 should be treated as old assumption. |
| LLM API | Variable | Claude/OpenAI/Gemini usage depends on volume and model. |
| Storage/DB | $0 incremental | Existing DB/server assumption. |
| SMS/Kakao/Slack/Email alerts | Variable | Depends on provider. |

## 2. Budget Policy

- Do not present Apify as fixed $39/month unless Finance verifies invoice.
- Keep a monthly spend cap for Apify.
- Set LLM monthly spend cap.
- Use cheaper model for classification and stronger model for high-risk draft generation.
- Cache translation and repeated prompt outputs where appropriate.

## 3. LLM Cost Control

| Task | Suggested Model Tier |
|---|---|
| Language detection | low-cost model or deterministic library |
| Sentiment/category/risk | low/mid-cost model |
| Reply draft | mid/high-quality model |
| High-risk rewrite | high-quality model |
| Monthly report insight | high-quality model |
| QA evaluator | low/mid-cost model with deterministic checks |

## 4. Hidden Costs

- API approval time
- OAuth setup
- Browser automation maintenance
- Scraper breakage
- Prompt QA
- Human review time
- Data retention and backup
- Monthly report verification

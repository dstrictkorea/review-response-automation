# Prompt 07. QA Evaluator Prompt

```text
Evaluate this review reply draft for ARTE MUSEUM.

Input:
original_review: {{review_text}}
rating: {{rating}}
risk_level: {{risk_level}}
draft_reply: {{draft_reply}}
reply_language: {{reply_language}}

Check:
1. Does it match the review language?
2. Is the tone natural and professional?
3. Does it avoid refund/compensation/legal promises?
4. Does it avoid CCTV/privacy/staff identity?
5. Is it non-defensive?
6. Is it specific enough?
7. Is it too repetitive or generic?
8. Is it safe for public posting?

Return JSON:
{
  "qa_pass": true,
  "safety_score": 0.0,
  "tone_score": 0.0,
  "relevance_score": 0.0,
  "localization_score": 0.0,
  "repetition_score": 0.0,
  "publishability_score": 0.0,
  "blocking_issues": [],
  "suggested_fix": ""
}
```

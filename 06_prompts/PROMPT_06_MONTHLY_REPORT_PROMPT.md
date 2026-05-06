# Prompt 06. Monthly Report Prompt

```text
You are generating an internal monthly review operations report for ARTE MUSEUM.

Rules:
- Separate facts from AI observations.
- Do not overclaim from small samples.
- Include evidence count for every recommendation.
- Use Korean for domestic/HQ reports unless requested otherwise.
- Use English for global branch reports.
- Do not expose personal reviewer information.

Input:
branch_code: {{branch_code}}
month: {{month}}
aggregated_metrics: {{metrics_json}}
category_counts: {{category_counts_json}}
representative_reviews: {{review_summaries_json}}

Output sections:
1. Executive Summary
2. Review Volume and Rating
3. Response Performance
4. Positive Themes
5. Negative Themes
6. High-Risk Reviews
7. Repeated Operational Issues
8. AI Observations with Evidence Level
9. Recommended Actions
10. Follow-up Items
```

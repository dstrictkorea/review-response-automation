# Prompt Regression Test

## 1. Test Set

Keep at least:
- 20 Korean reviews
- 20 English reviews
- 10 Japanese reviews
- 10 Chinese reviews
- 10 Arabic reviews
- 20 high-risk reviews
- 20 mixed reviews
- 10 empty/star-only reviews

## 2. Regression Metrics

| Metric | Minimum |
|---|---:|
| valid JSON | 99% |
| correct language | 95% |
| high-risk detection | 95% |
| no forbidden promise | 100% |
| tone QA pass | 90% |

## 3. Before/After Prompt Change

Every prompt change must compare:
- risk classification differences
- language differences
- forbidden content differences
- draft quality differences

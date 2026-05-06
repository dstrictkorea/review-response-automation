# n8n Failure Tests

| Failure | Expected |
|---|---|
| Google API 401 | alert + disable workflow |
| Google API 429 | backoff |
| Google API 500 | retry |
| Apify actor fails | manual fallback |
| internal API down | retry + alert |
| LLM timeout | mark AI_FAILED |
| DB duplicate | skip |
| publish duplicate | block |
| monthly report fails | alert and retry |

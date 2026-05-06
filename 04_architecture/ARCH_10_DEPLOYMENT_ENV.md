# Architecture 10. Deployment Environment

## 1. Recommended Stack

| Layer | Tool |
|---|---|
| Workflow | n8n self-hosted Docker |
| Backend | Node.js/NestJS or Express |
| Frontend | React/Next.js |
| Database | PostgreSQL |
| Queue | BullMQ/Redis or DB queue |
| LLM Gateway | internal service |
| Reports | HTML/CSS to PDF |
| Monitoring | Uptime + logs + alerting |
| Secrets | environment variables/secret manager |

## 2. Environments

| Env | Purpose |
|---|---|
| local | development |
| staging | test with fake/sample data |
| production | live reviews |

## 3. Deployment Rules

- never test posting on real review unless approved
- staging uses mock Google API
- production secrets never in repo
- migrations reviewed before apply
- workflow changes exported and versioned

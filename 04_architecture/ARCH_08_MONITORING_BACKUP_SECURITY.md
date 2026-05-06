# Architecture 08. Monitoring, Backup, and Security

## 1. Monitoring

| Signal | Alert |
|---|---|
| Google API failure | after 3 consecutive failures |
| n8n workflow failed | immediate |
| scraper failed | daily digest + manual fallback |
| LLM invalid JSON | after retry |
| high-risk review detected | immediate |
| spend threshold 80% | finance/system alert |
| duplicate publish attempt | immediate |
| approval SLA overdue | manager alert |

## 2. Backup

- DB daily backup
- weekly restore test in staging
- n8n workflow export backup
- prompt version backup
- secrets not stored in repo

## 3. Security

- TLS required
- admin dashboard behind SSO or VPN if possible
- role-based access
- audit log immutable
- API keys encrypted
- separate dev/prod
- no secrets in n8n notes or screenshots

## 4. Production Runbook

1. Check n8n health
2. Check DB health
3. Check LLM gateway
4. Check queue backlog
5. Check failed publishing jobs
6. Check high-risk queue
7. Check spend dashboard

# Policy 06. Privacy, Security, and Data Retention

## 1. Privacy Rules

Do not store unnecessary personal data. Review platforms already expose limited public names; do not enrich reviewer identities.

## 2. Sensitive Fields

- reviewer public name
- profile URL
- review text
- staff names mentioned by customer
- incident details

## 3. Retention

| Data | Retention |
|---|---|
| Review original | 3 years or company policy |
| AI draft | 3 years |
| Audit logs | 3 years |
| API tokens | encrypted, rotate regularly |
| Raw scraper snapshot | minimize; delete after normalized if possible |

## 4. Security

- encrypt secrets
- use least privilege
- separate dev/prod keys
- restrict admin dashboard access
- log access to high-risk reviews
- backup DB
- test restore quarterly

## 5. Public Reply Privacy

Never publicly mention:
- CCTV details
- internal investigation details
- personal staff information
- exact visitor path
- private reservation data

# Architecture 01. System Overview

## 1. Architecture

```mermaid
flowchart LR
    Google[Google Business Profile API] --> N8N[n8n Workflow Engine]
    TA[TripAdvisor / Browser Assist / Apify] --> N8N
    Naver[Naver / Browser Assist / Apify] --> N8N
    Manual[Manual Paste Desk] --> App[Admin Web App]
    N8N --> DB[(PostgreSQL)]
    App --> DB
    DB --> LLM[LLM Gateway]
    LLM --> DB
    DB --> Dashboard[Approval Dashboard]
    Dashboard --> Publish[Publishing Service]
    Publish --> Google
    Dashboard --> Copy[Manual Copy Publish]
    DB --> Reports[Reporting Engine]
    Reports --> PDF[Monthly Reports]
    N8N --> Alert[Email/Slack/Telegram/Teams Alert]
```

## 2. Components

| Component | Responsibility |
|---|---|
| n8n | scheduled collection, API calls, alerts |
| PostgreSQL | normalized review data and logs |
| Admin Web App | approval dashboard and manual input |
| LLM Gateway | prompt versioning, model routing, safety evaluation |
| Publishing Service | Google reply API and manual publish tracking |
| Reporting Engine | monthly report generation |
| Monitoring | workflow failure, API failure, spend alerts |

## 3. Design Principle

n8n handles workflows.  
The app/database handles state.  
LLM handles draft and analysis.  
Human handles approval and risk judgment.

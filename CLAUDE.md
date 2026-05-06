@AGENTS.md

# ARTE Museum — Review Response Automation MVP

## What This Is

An internal review operation ledger for ARTE Museum staff.
This is NOT a fully automated public reply bot.
Humans approve every reply before it goes public.

## Core Workflow (Build in This Order)

1. Manual review registration — staff paste in a review
2. AI reply draft generation — Claude suggests a response
3. Human edit and approval — staff edits the draft
4. Copy final reply — staff copies and pastes manually to the platform
5. Mark as published — staff marks the review as done
6. Archive — full history of reviews and replies is stored
7. Settings/templates — editable by staff from the frontend

## Do NOT Build (Out of Scope for MVP)

- Google Business Profile API integration
- Naver auto-posting
- TripAdvisor auto-posting
- Full enterprise permission system
- PDF report generation
- Slack or email automation
- Any automatic public posting of any kind

## Safety Rules (Non-Negotiable)

- Never promise refunds or compensation in generated replies
- Never admit legal responsibility
- Never promise CCTV review
- Never promise staff punishment
- High-risk reviews (legal threats, severe complaints) must be flagged and require explicit human approval
- Every important action (registration, approval, publish, archive) must be logged with timestamp and user

## Design

- Korean-first UI — all labels, buttons, and messages in Korean
- Clean, bright dashboard — no dark mode required for MVP
- High contrast text — no pale gray on light backgrounds
- Desktop-first layout, must also be usable on mobile
- Admin-facing only — no public-facing pages

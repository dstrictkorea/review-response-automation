# Architecture 04. n8n Workflows

## Workflow 1. Google Review Collection

Trigger:
- Cron every 1-3 hours

Nodes:
1. Cron
2. Get branch credentials/location IDs
3. Google Business Profile API list reviews
4. Normalize reviews
5. POST to internal `/webhooks/n8n/google-review-collected`
6. If new review, trigger AI analysis
7. Send alert if high/critical

Failure:
- retry 3 times
- notify system admin
- log workflow failure

## Workflow 2. Google Publish After Approval

Trigger:
- internal webhook after human approval

Nodes:
1. Webhook
2. Load approved reply
3. Check risk and channel
4. Call Google `updateReply`
5. Store result
6. Notify approver

Guard:
- only approved state
- only Google channel
- only verified location
- no high/critical unless special override

## Workflow 3. TripAdvisor Collection

Trigger:
- daily or 2x daily

Modes:
- Apify actor
- browser assist
- manual fallback

Output:
- normalized review
- no auto-publish

## Workflow 4. Naver Collection

Trigger:
- daily

Modes:
- Apify/browser assist if permitted and stable
- manual fallback

Output:
- normalized review
- no auto-publish

## Workflow 5. Monthly Report

Trigger:
- monthly, 1st day 09:00 KST

Nodes:
1. Load previous month reviews
2. Aggregate KPI
3. Generate insights
4. Generate branch reports
5. Generate HQ summary
6. Notify recipients
7. Archive output

## Workflow 6. Spend Monitor

Trigger:
- daily

Checks:
- LLM usage
- Apify usage
- API error volume
- workflow failure rate

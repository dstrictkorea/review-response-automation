# Source Ledger

## 1. Internal Source

| Source | What it supports |
|---|---|
| `review automation report_260407.pdf` | 기존 검토안: n8n 셀프호스팅, Google 우선, TripAdvisor/Naver 반자동, 국내 OTA AI 초안, 월간 리포트 자동화 |

## 2. Official/Public Sources Checked

| Area | Source | Finding | Lock Impact |
|---|---|---|---|
| Google review API | https://developers.google.com/my-business/content/review-data | Google Business Profile API supports listing/getting/replying/deleting review replies. | Google is the only confirmed API-first publishing candidate. |
| Google update reply | https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply | `updateReply` creates or updates a reply for verified locations with proper OAuth scopes. | Verified location and OAuth are mandatory gates. |
| Google Business Profile | https://developers.google.com/my-business | APIs help manage profiles at scale and receive alerts including reviews. | Use API for global branches first. |
| Google content policy | https://support.google.com/contributionpolicy/answer/7400114 | Fake engagement/rating manipulation is not allowed. | Never build fake review or incentivized review flows. |
| n8n Docker | https://docs.n8n.io/hosting/installation/docker/ | Official Docker installation is supported. | n8n self-hosting is viable. |
| n8n hosting | https://docs.n8n.io/hosting/ | Self-hosting requires technical knowledge and ops management. | Add backup/security/update SOP. |
| TripAdvisor Content API | https://tripadvisor-content-api.readme.io/reference/overview | Partner API provides content access for integration. | Do not assume management-response posting API. |
| TripAdvisor management response | https://www.tripadvisor.com/business/insights/hotels/resources/add-management-responses-to-reviews | Official flow shows writing/pasting responses in management UI. | Treat TripAdvisor as manual publish. |
| Naver SmartPlace reply | https://help.naver.com/service/30026/contents/20493?lang=ko | Business owner can write replies through SmartPlace. | Treat Naver as manual publish unless official API is verified. |
| Naver reply methods | https://help.naver.com/alias/NSP/NSP_13.naver | Owner/admin login sees reply icon and can create/edit/delete replies. | Supports human-in-loop copy/paste. |
| Apify pricing | https://apify.com/pricing | Starter shown as $29/month + pay as you go. | Prior $39 assumption must be treated as outdated/needs confirmation. |
| Apify subscription | https://help.apify.com/en/articles/5136728-subscribing-to-the-apify-platform | Starter covers pay-as-you-go resource model and platform limits. | Add spend cap and usage monitoring. |

## 3. Research Conclusions

1. Google is feasible for API-supported review reply automation after human approval.
2. TripAdvisor/Naver are not locked as API publish channels.
3. Apify may support collection, but price and Actor reliability must be tested with actual target pages.
4. Any automated browsing/scraping must avoid bypassing access controls, CAPTCHA, payment walls, or hidden/private data.
5. Current cost assumption must be versioned because Apify pricing can change.

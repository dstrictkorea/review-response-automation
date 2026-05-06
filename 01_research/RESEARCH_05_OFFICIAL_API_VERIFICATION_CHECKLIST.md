# Official API Verification Checklist

## 1. Google

- [ ] Google Cloud project exists
- [ ] Business Profile APIs enabled
- [ ] OAuth consent configured
- [ ] Required scopes confirmed
- [ ] Account has location access
- [ ] Locations are verified
- [ ] Location IDs mapped to branch codes
- [ ] Review list call succeeds
- [ ] Review reply update call succeeds in test
- [ ] Reply delete or update rollback tested

## 2. TripAdvisor

- [ ] Business listing ownership confirmed
- [ ] Management Center access confirmed
- [ ] Content API access checked
- [ ] Whether API includes owner reply posting checked
- [ ] If not confirmed, keep manual publish policy
- [ ] Copy/paste response workflow tested

## 3. Naver

- [ ] SmartPlace owner/admin access confirmed
- [ ] Branch accounts mapped
- [ ] Review reply UI access confirmed
- [ ] Public API availability checked
- [ ] If not confirmed, keep manual publish policy
- [ ] Reply hidden/rejected cases tested

## 4. Domestic OTA

For each OTA:
- [ ] Login access confirmed
- [ ] Review page location confirmed
- [ ] Reply UI existence checked
- [ ] Export/download availability checked
- [ ] Manual paste workflow tested
- [ ] Reply policy checked

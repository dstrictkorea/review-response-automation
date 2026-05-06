# Policy 07. Scraping and Browser Automation

## 1. Allowed

- Accessing publicly visible review pages where permitted
- Using scraping only for review collection
- Respecting robots/platform policies where applicable
- Rate limiting
- Manual fallback
- Monitoring failures

## 2. Forbidden

- bypassing CAPTCHA
- credential sharing
- circumventing access controls
- collecting private user data
- auto-posting where no official API exists
- hiding automation from internal audit

## 3. Browser-Assist Mode

When full automation is risky:
- agent opens page
- extracts visible review text
- creates draft
- human copies reply manually

## 4. Breakage Handling

If scraper fails:
1. mark workflow degraded
2. notify owner
3. switch channel to manual input
4. do not silently skip reviews

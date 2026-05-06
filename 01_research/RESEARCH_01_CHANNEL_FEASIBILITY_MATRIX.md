# Channel Feasibility Matrix

## 1. Summary

| Channel | Collection | AI Draft | Publish | Confidence | Notes |
|---|---:|---:|---:|---:|---|
| Google Reviews | API | Yes | API after approval | High | Official Google Business Profile API supports review operations. |
| TripAdvisor | Scraper/API content check | Yes | Manual | Medium | Content API is not equivalent to owner response API. |
| Naver SmartPlace | Scraper/browser-assist/manual | Yes | Manual | Medium | Owner reply UI exists; public publish API not verified. |
| MyRealTrip | Manual | Yes | Manual | Low | Login/channel restrictions likely. |
| Klook | Manual | Yes | Manual | Low | Marketplace restrictions likely. |
| KKDAY | Manual | Yes | Manual | Low | Marketplace restrictions likely. |
| 제주투어패스 | Manual | Yes | Manual | Low | Treat as manual until verified. |
| NOL | Manual | Yes | Manual | Low | Treat as manual until verified. |
| 탐나오 | Manual | Yes | Manual | Low | Treat as manual until verified. |
| WAUG | Manual | Yes | Manual | Low | Treat as manual until verified. |
| Coupang | Manual | Yes | Manual | Low | Treat as manual until verified. |
| Gmarket | Manual | Yes | Manual | Low | Treat as manual until verified. |
| 11번가 | Manual | Yes | Manual | Low | Treat as manual until verified. |

## 2. Policy

- “가능”과 “운영 가능”을 분리한다.
- 공식 API가 없는 채널은 무조건 Manual/Semi-auto로 분류한다.
- 스크래핑은 “자동 게시”가 아니라 “수집 보조”에만 사용한다.
- 로그인 필요한 채널은 자동 수집보다 “수동 붙여넣기 + AI 초안”이 운영 리스크가 낮다.

## 3. Evidence Strength

| Confidence | Meaning |
|---|---|
| High | Official API or documented owner feature supports the function. |
| Medium | Public UI or official help confirms manual feature; automation must be tested. |
| Low | No official automation path verified. Manual-only until proven otherwise. |

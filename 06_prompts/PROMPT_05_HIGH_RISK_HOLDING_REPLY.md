# Prompt 05. High-Risk Holding Reply

## Purpose

For high-risk reviews, AI should not generate a final aggressive/public commitment response. It should generate a conservative holding draft for manager review.

## Template Prompt

```text
Create a careful holding response for a high-risk review.

Rules:
- Do not admit legal liability.
- Do not promise refund/compensation.
- Do not mention CCTV.
- Do not mention staff discipline.
- Do not argue.
- Ask the customer to contact the official support channel with visit details if needed.
- Keep it short and respectful.
- Return JSON with draft and internal note.
```

## Korean Holding Example

```text
안녕하세요, 아르떼뮤지엄입니다.
방문 중 불편을 겪으셨다는 말씀을 무겁게 받아들이고 있습니다.
남겨주신 내용은 관련 부서와 함께 확인이 필요하여, 가능하시다면 방문 일시와 상세 내용을 공식 문의 채널로 전달 부탁드립니다.
보다 정확히 확인하고 안내드릴 수 있도록 하겠습니다.
```

## English Holding Example

```text
Thank you for sharing your experience with us.
We’re sorry to hear that your visit did not meet expectations, and we take your comments seriously.
To review this more carefully, please contact our official support channel with your visit details so our team can follow up appropriately.
```

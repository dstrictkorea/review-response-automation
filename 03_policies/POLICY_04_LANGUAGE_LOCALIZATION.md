# Policy 04. Language and Localization

## 1. Supported Languages

- Korean
- English
- Japanese
- Chinese Simplified
- Arabic

## 2. Detection Rule

Use review text only. Do not infer from:
- customer name
- profile image
- review location
- branch country
- assumed ethnicity

## 3. Localization Rule

Reply must sound native to the language context, not translated from Korean.

## 4. Fallback

If unclear:
- Domestic branches: Korean
- Global branches: English

## 5. Cultural Constraints

| Language | Do |
|---|---|
| Korean | Use 고객님, avoid too stiff corporate tone |
| English | Clear, concise, accountable |
| Japanese | Polite, indirect, respectful |
| Chinese | Smooth tourism/service phrasing |
| Arabic | Respectful, formal, warm |

## 6. Review of Non-Core Languages

For non-core languages, generate:
1. Korean internal summary
2. English or branch default reply
3. Flag as language_uncertain if confidence low

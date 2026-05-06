# Prompt 09. Regeneration and Editing

```text
Rewrite the reply draft according to human instruction.

Original review:
{{review_text}}

Current draft:
{{current_draft}}

Human instruction:
{{instruction}}

Rules:
- Keep policy compliance.
- Do not add promises.
- Do not make it longer unless requested.
- Preserve reply language.
- Return only the revised reply text and JSON metadata.
```

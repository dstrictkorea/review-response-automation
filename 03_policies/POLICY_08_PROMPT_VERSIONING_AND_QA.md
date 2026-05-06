# Policy 08. Prompt Versioning and QA

## 1. Versioning

Every AI output must store:
- prompt_id
- prompt_version
- model
- temperature
- language
- risk_rule_version
- branch_tone_version

## 2. QA Checks

- language match
- tone fit
- no forbidden promise
- no legal admission
- no staff name exposure
- no CCTV mention
- no hallucinated facts
- no repeated phrase overload
- specific enough to review

## 3. Evaluation

Each draft receives:
- safety_score
- tone_score
- relevance_score
- localization_score
- repetition_score
- publishability_score

## 4. Release

Prompt changes require regression test against sample review set.

# Policy 02. Human Approval and Auto-Publish

## 1. Default Mode

All replies are human-approved by default.

## 2. Approval States

| State | Meaning |
|---|---|
| draft_generated | AI draft exists |
| pending_approval | waiting for human |
| needs_revision | human requested changes |
| approved | ready to publish |
| published | posted to channel |
| manual_publish_required | copy/paste needed |
| escalated | high-risk human handling |
| rejected | do not reply or hold |

## 3. Approval Requirements

Approver must see:
- original review
- translated summary if needed
- rating
- branch/channel
- detected language
- risk level
- categories
- AI rationale
- draft options
- policy flags
- edit history

## 4. Auto-Publish Pilot

Auto-publish is not an MVP feature. It is an optimization after 30+ days of safe operations.

## 5. Auto-Publish Kill Switch

System must have:
- global kill switch
- branch kill switch
- channel kill switch
- language kill switch
- risk rule override

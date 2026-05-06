# Policy 11. Access Control and RACI

## 1. Roles

| Role | Permission |
|---|---|
| System Admin | system config, API keys, workflow deploy |
| HQ Ops Admin | all branch view, approve high risk |
| Branch Manager | own branch review approval |
| CS Manager | sensitive customer case handling |
| Viewer | read-only reports |
| Developer | dev environment only unless approved |

## 2. RACI

| Task | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Google API setup | System Admin | HQ Ops | Branch | HQ |
| Reply approval | Branch Manager | HQ Ops | CS | System |
| High-risk review | CS Manager | HQ Ops | Legal/Branch | System |
| Prompt change | System/Admin | HQ Ops | Branch | Users |
| Monthly report | System | HQ Ops | Branch | Leadership |

## 3. Least Privilege

No user receives more permissions than their operational need.

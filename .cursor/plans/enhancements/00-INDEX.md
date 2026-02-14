# Platform Enhancement Plans -- Master Index

**Created:** 2026-02-14
**Focus:** Gmail, Calendar, Drive, Slack as core onboarding entry points

## Priority Overview

| #   | Plan                                  | Priority               | Effort  | Status      | Dependencies                       |
| --- | ------------------------------------- | ---------------------- | ------- | ----------- | ---------------------------------- |
| 01  | Fix Relevancy Scorer                  | TIER 1 (Bug Fix)       | Medium  | NOT STARTED | None                               |
| 02  | Fix Budget System                     | TIER 1 (Bug Fix)       | Low     | NOT STARTED | None                               |
| 03  | Add Guardrails to Critical Agents     | TIER 1 (Safety)        | Low     | NOT STARTED | None                               |
| 04  | Daily Briefing Workflow               | TIER 2 (High Value)    | Medium  | NOT STARTED | Calendar + Drive activated by user |
| 05  | Calendar Assistant Agent              | TIER 2 (High Value)    | Low-Med | NOT STARTED | Calendar activated by user         |
| 06  | Meeting Follow-up Workflow            | TIER 2 (High Value)    | Medium  | NOT STARTED | None (Fathom already active)       |
| 07  | RAG Knowledge Ingestion               | TIER 3 (Foundation)    | Low     | NOT STARTED | None                               |
| 08  | Agent Fleet Dashboard Canvas          | TIER 3 (Visibility)    | Low-Med | NOT STARTED | None                               |
| 09  | Customer Operations Network           | TIER 4 (Orchestration) | Medium  | NOT STARTED | 05 (Calendar agent)                |
| 10  | Scheduled Triggers                    | TIER 4 (Automation)    | Low     | NOT STARTED | 04 (briefing workflow)             |
| 11  | Feedback Collection (Slack Reactions) | TIER 4 (Learning)      | Medium  | NOT STARTED | None                               |

## Dependency Graph

```
TIER 1 (Fix What's Broken)         TIER 2 (High-Value Builds)
┌──────────────────────┐           ┌─────────────────────────┐
│ 01 Fix Relevancy     │           │ 04 Daily Briefing WF    │
│ 02 Fix Budget System │           │ 05 Calendar Agent       │
│ 03 Add Guardrails    │           │ 06 Meeting Follow-up WF │
└──────────────────────┘           └────────────┬────────────┘
                                                │
                                                ▼
TIER 3 (Foundation)                TIER 4 (Orchestration)
┌──────────────────────┐           ┌─────────────────────────┐
│ 07 RAG Ingestion     │           │ 09 Customer Ops Network │◄── needs 05
│ 08 Fleet Dashboard   │           │ 10 Scheduled Triggers   │◄── needs 04
└──────────────────────┘           │ 11 Feedback Collection  │
                                   └─────────────────────────┘
```

## Removed Items (User Decision)

- ~~Activate Google Calendar~~ -- User-initiated action (frontend OAuth re-auth)
- ~~Activate Google Drive~~ -- User-initiated action (frontend OAuth re-auth)
- ~~Email Triage Test Cases~~ -- Deferred

## Notes

- Google Calendar and Drive activation is a prerequisite for plans 04 and 05 but is handled by the user through the onboarding/settings UI
- All plans include specific file paths, code references, and acceptance criteria
- Plans can be executed in parallel within the same tier

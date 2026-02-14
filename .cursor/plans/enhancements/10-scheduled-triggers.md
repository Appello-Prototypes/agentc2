# 10 -- Scheduled Triggers

**Priority:** TIER 4 (Automation)
**Effort:** Low (1-2 hours)
**Dependencies:** Plan 04 (Daily Briefing workflow), Plan 05 (Calendar Assistant)

## Problem Statement

Only 1 schedule exists (Gmail Watch Refresh, daily at 2am UTC). For a platform with 10 active integrations and 10 active agents, there should be automated triggers driving proactive value.

## Current Trigger Infrastructure

**Unified trigger system** supports:

- `scheduled` -- Cron-based triggers
- `event` -- Event-driven triggers (e.g., `gmail.message.received`)
- `webhook` -- Inbound webhook triggers

**API:** `agent_trigger_unified_create` MCP tool or:

```
POST /api/agents/{agentId}/triggers
```

**Existing triggers:**
| Name | Type | Agent | Cron | Status |
|------|------|-------|------|--------|
| Gmail Watch Refresh | scheduled | email-triage | `0 2 * * *` | Active |
| Gmail Inbox Monitor | event | email-triage | N/A (event) | Active |

## Proposed Scheduled Triggers

### Daily Triggers

| #   | Name                      | Agent              | Cron             | Timezone        | Description                                                                 |
| --- | ------------------------- | ------------------ | ---------------- | --------------- | --------------------------------------------------------------------------- |
| 1   | Morning Calendar Briefing | calendar-assistant | `0 7 * * 1-5`    | America/Toronto | Post today's schedule to Slack at 7am weekdays                              |
| 2   | Morning Email Summary     | assistant          | `0 7 30 * * 1-5` | America/Toronto | Summarize important unread emails at 7:30am                                 |
| 3   | End-of-Day Wrap-up        | assistant          | `0 17 * * 1-5`   | America/Toronto | Summary of today's activity: emails triaged, meetings held, tasks completed |

### Weekly Triggers

| #   | Name                            | Agent               | Cron         | Timezone        | Description                                                      |
| --- | ------------------------------- | ------------------- | ------------ | --------------- | ---------------------------------------------------------------- |
| 4   | Weekly Email Triage Report      | email-triage        | `0 9 * * 1`  | America/Toronto | Monday 9am: last week's email triage stats by category           |
| 5   | Weekly Cost Report              | workspace-concierge | `0 17 * * 5` | America/Toronto | Friday 5pm: agent cost breakdown for the week                    |
| 6   | Weekly Integration Health Check | workspace-concierge | `0 8 * * 1`  | America/Toronto | Monday 8am: verify all integrations are connected and responding |

### Hourly Triggers

| #   | Name                   | Agent     | Cron        | Description                                                       |
| --- | ---------------------- | --------- | ----------- | ----------------------------------------------------------------- |
| 7   | Meeting Followup Check | assistant | `0 * * * *` | Check for recently completed Fathom meetings (pairs with Plan 06) |

## Trigger Configurations

### 1. Morning Calendar Briefing

```json
{
    "agentId": "calendar-assistant",
    "type": "scheduled",
    "name": "Morning Calendar Briefing",
    "description": "Posts today's calendar overview to Slack at 7am weekdays",
    "isActive": true,
    "config": {
        "cronExpr": "0 7 * * 1-5",
        "timezone": "America/Toronto"
    },
    "input": "Post a brief overview of today's calendar to Slack #daily-briefing channel. List all events chronologically with time, title, duration, and attendees. Highlight any back-to-back meetings or conflicts."
}
```

### 2. Morning Email Summary

```json
{
    "agentId": "assistant",
    "type": "scheduled",
    "name": "Morning Email Summary",
    "description": "Summarizes important unread emails at 7:30am weekdays",
    "isActive": true,
    "config": {
        "cronExpr": "30 7 * * 1-5",
        "timezone": "America/Toronto"
    },
    "input": "Search Gmail for unread emails from the last 12 hours. Summarize the top 5 most important ones (prioritize by: known contacts > business emails > newsletters). Post the summary to Slack #daily-briefing channel."
}
```

### 3. End-of-Day Wrap-up

```json
{
    "agentId": "assistant",
    "type": "scheduled",
    "name": "End of Day Wrap-up",
    "description": "Daily activity summary at 5pm weekdays",
    "isActive": true,
    "config": {
        "cronExpr": "0 17 * * 1-5",
        "timezone": "America/Toronto"
    },
    "input": "Create an end-of-day summary and post to Slack #daily-briefing:\n- How many emails were triaged today?\n- What meetings happened today?\n- Any outstanding action items?\nKeep it brief -- 5-10 lines max."
}
```

### 4. Weekly Email Triage Report

```json
{
    "agentId": "workspace-concierge",
    "type": "scheduled",
    "name": "Weekly Email Triage Report",
    "description": "Monday 9am: email triage stats from last week",
    "isActive": true,
    "config": {
        "cronExpr": "0 9 * * 1",
        "timezone": "America/Toronto"
    },
    "input": "Get the email-triage agent's run stats for the last 7 days. Break down: total emails triaged, count by category (SALES, SUPPORT, INTERNAL, etc.), average processing time, any failures. Post to Slack #weekly-reports."
}
```

### 5. Weekly Cost Report

```json
{
    "agentId": "workspace-concierge",
    "type": "scheduled",
    "name": "Weekly Cost Report",
    "description": "Friday 5pm: weekly agent cost breakdown",
    "isActive": true,
    "config": {
        "cronExpr": "0 17 * * 5",
        "timezone": "America/Toronto"
    },
    "input": "Get cost data for all agents this week. Create a cost report showing: total spend, spend by agent, cost per run average, and any agents over budget. Post to Slack #weekly-reports."
}
```

### 6. Weekly Integration Health Check

```json
{
    "agentId": "workspace-concierge",
    "type": "scheduled",
    "name": "Weekly Integration Health Check",
    "description": "Monday 8am: verify all integrations are healthy",
    "isActive": true,
    "config": {
        "cronExpr": "0 8 * * 1",
        "timezone": "America/Toronto"
    },
    "input": "Check the status of all integration connections. For each one, verify it's active and note any missing fields or errors. Post a health report to Slack #ops-alerts with green/red status per integration."
}
```

## Implementation Steps

### Step 1: Create Slack channels (if needed)

- `#daily-briefing` -- Morning briefings and EOD wrap-ups
- `#weekly-reports` -- Weekly summaries
- `#ops-alerts` -- Integration health and system alerts

### Step 2: Create triggers via MCP tool

Use `agent_trigger_unified_create` for each trigger configuration above.

### Step 3: Test each trigger manually

Use `agent_trigger_execute` to fire each trigger manually and verify the output.

### Step 4: Monitor first week

Watch the trigger events via `trigger_events_list` to verify they fire correctly.

## Acceptance Criteria

- [ ] 7 scheduled triggers created and active
- [ ] Morning briefings fire at 7am and 7:30am weekdays
- [ ] EOD wrap-up fires at 5pm weekdays
- [ ] Weekly reports fire on Monday and Friday
- [ ] All triggers post to correct Slack channels
- [ ] Trigger events visible in platform monitoring

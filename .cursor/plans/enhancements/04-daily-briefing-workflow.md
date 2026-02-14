# 04 -- Daily Briefing Workflow

**Priority:** TIER 2 (High Value)
**Effort:** Medium (3-4 hours)
**Dependencies:** User must activate Google Calendar and Google Drive via onboarding UI

## Problem Statement

Zero workflows exist despite having all integrations connected. The Daily Briefing is the highest-impact first workflow because it:

1. Touches all four core integrations (Gmail, Calendar, Slack, optionally Drive)
2. Delivers immediate tangible value ("wake up, check Slack, AI already briefed you")
3. Demonstrates the workflow engine to users

## Workflow Design

**Name:** `daily-briefing`
**Trigger:** Scheduled (cron: `0 7 * * 1-5` -- 7am Mon-Fri, user's timezone)
**Output:** Posts a formatted briefing to a Slack channel

### Step-by-Step Flow

```
┌──────────────────────┐
│ 1. Fetch Unread      │  tool: gmail search_emails
│    Emails             │  query: "is:unread newer_than:12h"
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 2. Fetch Today's     │  tool: google-calendar list-events
│    Calendar Events    │  timeMin: today 00:00, timeMax: today 23:59
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 3. Summarize Emails  │  agent: assistant
│    (AI Step)          │  prompt: "Summarize these emails..."
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 4. Compile Briefing  │  transform step
│    Format for Slack   │  Combine email summary + calendar
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 5. Post to Slack     │  tool: slack_post_message
│    #daily-briefing    │  channel: configured channel
└──────────────────────┘
```

## Workflow Definition (JSON)

This will be created via the `workflow_create` MCP tool or the API.

```json
{
    "name": "Daily Briefing",
    "slug": "daily-briefing",
    "description": "Morning briefing combining unread emails and today's calendar, posted to Slack.",
    "isActive": true,
    "isPublished": true,
    "definitionJson": {
        "steps": [
            {
                "id": "fetch-emails",
                "type": "tool",
                "name": "Fetch Unread Emails",
                "config": {
                    "toolId": "gmail__search_emails",
                    "parameters": {
                        "query": "is:unread newer_than:12h",
                        "maxResults": 20
                    }
                }
            },
            {
                "id": "fetch-calendar",
                "type": "tool",
                "name": "Fetch Today's Calendar",
                "config": {
                    "toolId": "google-calendar__list-events",
                    "parameters": {
                        "calendarId": "primary",
                        "timeMin": "{{ new Date().toISOString().split('T')[0] }}T00:00:00",
                        "timeMax": "{{ new Date().toISOString().split('T')[0] }}T23:59:59"
                    }
                }
            },
            {
                "id": "summarize",
                "type": "agent",
                "name": "Summarize & Compile Briefing",
                "config": {
                    "agentSlug": "assistant",
                    "promptTemplate": "You are compiling a morning briefing. Format it for Slack using markdown.\n\n## Unread Emails ({{ steps.fetch-emails.result.length || 0 }} total)\n\nEmails:\n{{ JSON.stringify(steps['fetch-emails'].result) }}\n\nSummarize the top 5 most important emails with sender, subject, and one-line summary.\n\n## Today's Calendar\n\nEvents:\n{{ JSON.stringify(steps['fetch-calendar'].result) }}\n\nList today's meetings chronologically with time, title, and attendees.\n\n## Action Items\n\nBased on the emails and meetings, list the top 3-5 things to focus on today.",
                    "maxSteps": 3
                }
            },
            {
                "id": "post-to-slack",
                "type": "tool",
                "name": "Post Briefing to Slack",
                "config": {
                    "toolId": "slack__slack_post_message",
                    "parameters": {
                        "channel_id": "{{ env.SLACK_BRIEFING_CHANNEL || 'general' }}",
                        "text": "{{ steps.summarize.result }}"
                    }
                }
            }
        ]
    }
}
```

## Implementation Steps

### Step 1: Create the workflow via API/MCP

Use `workflow_create` MCP tool with the definition above. Alternatively use:

```
POST /api/workflows
Content-Type: application/json
```

### Step 2: Create the scheduled trigger

After the workflow is created, create a trigger that fires it daily:

Use `agent_trigger_unified_create` or create a schedule:

- Type: `scheduled`
- Cron: `0 7 * * 1-5` (7am weekdays)
- Timezone: `America/Toronto` (or user's timezone)

### Step 3: Test with manual execution

Execute the workflow manually first to verify all steps work:

```
POST /api/workflows/daily-briefing/execute
{ "input": {} }
```

### Step 4: Configure Slack channel

Either:

- Use an existing channel (e.g., `#general` or `#daily-updates`)
- Create a dedicated `#daily-briefing` channel

The channel ID needs to be passed as a parameter or set as an environment variable.

## Slack Output Format (Target)

```
:sunrise: *Daily Briefing -- Friday, Feb 14*

:email: *Unread Emails (12)*
1. *Ian Haase* -- Re: Q1 Budget Review -- Requesting final numbers by EOD
2. *Mia Burns* -- New Client Onboarding -- FirmBroker contract ready for review
3. *GitHub* -- CI/CD: 2 failed workflows on mastra-experiment
4. *HubSpot* -- Deal stage change: Acme Corp moved to Negotiation
5. *Stripe* -- Monthly invoice #INV-2026-02 ready

:calendar: *Today's Calendar*
- 9:00 AM -- Team Standup (15 min) -- Ian, Mia, Brady
- 11:00 AM -- Client Call: FirmBroker (30 min) -- Mia Burns
- 2:00 PM -- Sprint Planning (1 hr) -- Full team
- 4:00 PM -- 1:1 with Ian (30 min)

:dart: *Focus Today*
1. Review FirmBroker contract before 11am call
2. Finalize Q1 budget numbers (Ian needs by EOD)
3. Investigate CI/CD failures from overnight
```

## Acceptance Criteria

- [ ] Workflow created and visible in platform UI
- [ ] Manual execution successfully fetches emails + calendar + posts to Slack
- [ ] Scheduled trigger fires at 7am weekdays
- [ ] Slack message is well-formatted and useful
- [ ] Graceful handling when Calendar/Drive not yet activated (skip those steps)

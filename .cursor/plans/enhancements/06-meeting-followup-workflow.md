# 06 -- Meeting Follow-up Workflow

**Priority:** TIER 2 (High Value)
**Effort:** Medium (3-4 hours)
**Dependencies:** Fathom integration (already active)

## Problem Statement

Fathom is connected with 4 tools (list meetings, get summary, get transcript, get details) and has been recording meetings, but nothing processes the data. Meeting follow-up is one of the highest-value automations:

- Action items from meetings get lost
- Summary distribution is manual
- Jira ticket creation from action items is tedious

## Available Fathom Tools

| Tool                             | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `fathom__list_meetings`          | List meetings with optional date filter |
| `fathom__get_meeting_summary`    | Get AI-generated meeting summary        |
| `fathom__get_meeting_transcript` | Get full transcript                     |
| `fathom__get_meeting_details`    | Get metadata, attendees, summary        |

## Workflow Design

**Name:** `meeting-followup`
**Trigger:** Can be manual (for now) or scheduled to check for new meetings every hour
**Output:** Slack summary + Jira tickets for action items

### Flow

```
┌──────────────────────────┐
│ 1. Get Recent Meetings   │  tool: fathom list_meetings
│    (last 24 hours)        │  after: yesterday
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ 2. For Each Meeting:     │  foreach step
│    Get Summary + Details  │  tool: fathom get_meeting_summary
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ 3. Extract Action Items  │  agent step
│    Parse into structured  │  Extract: owner, description, priority
│    action items           │
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ 4. Create Jira Tickets   │  foreach step
│    For each action item   │  tool: jira_create_issue (or prepare)
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ 5. Post Summary to Slack │  tool: slack_post_message
│    Meeting recap + links  │  Include action items + Jira links
└──────────────────────────┘
```

## Workflow Definition

```json
{
    "name": "Meeting Follow-up Pipeline",
    "slug": "meeting-followup",
    "description": "Processes recent Fathom meetings: extracts action items, creates Jira tickets, and posts summaries to Slack.",
    "isActive": true,
    "isPublished": true,
    "definitionJson": {
        "steps": [
            {
                "id": "list-meetings",
                "type": "tool",
                "name": "List Recent Meetings",
                "config": {
                    "toolId": "fathom__list_meetings",
                    "parameters": {
                        "after": "{{ new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0] }}",
                        "limit": 10
                    }
                }
            },
            {
                "id": "process-meetings",
                "type": "foreach",
                "name": "Process Each Meeting",
                "config": {
                    "collectionPath": "steps.list-meetings.result.meetings",
                    "itemVar": "meeting",
                    "concurrency": 1,
                    "steps": [
                        {
                            "id": "get-summary",
                            "type": "tool",
                            "name": "Get Meeting Summary",
                            "config": {
                                "toolId": "fathom__get_meeting_summary",
                                "parameters": {
                                    "meeting_id": "{{ item.meeting.id }}"
                                }
                            }
                        },
                        {
                            "id": "extract-actions",
                            "type": "agent",
                            "name": "Extract Action Items",
                            "config": {
                                "agentSlug": "assistant",
                                "promptTemplate": "Extract action items from this meeting summary. For each action item, provide:\n- description: What needs to be done\n- owner: Who is responsible (name from attendees)\n- priority: High/Medium/Low\n- dueDate: Suggested due date if mentioned\n\nMeeting: {{ item.meeting.title }}\nSummary:\n{{ steps['get-summary'].result }}\n\nReturn a JSON array of action items. If no action items, return an empty array [].",
                                "outputFormat": "json",
                                "maxSteps": 1
                            }
                        },
                        {
                            "id": "post-meeting-slack",
                            "type": "agent",
                            "name": "Post Meeting Summary to Slack",
                            "config": {
                                "agentSlug": "slack-hello-world",
                                "promptTemplate": "Post the following meeting summary to the #meetings channel:\n\n:notebook_with_decorative_cover: *Meeting Recap: {{ item.meeting.title }}*\n:busts_in_silhouette: Attendees: {{ item.meeting.attendees }}\n:clock1: Duration: {{ item.meeting.duration }}\n\n*Summary:*\n{{ steps['get-summary'].result }}\n\n*Action Items:*\n{{ steps['extract-actions'].result }}",
                                "maxSteps": 3
                            }
                        }
                    ]
                }
            }
        ]
    }
}
```

## Slack Output Format (Target)

```
:notebook_with_decorative_cover: *Meeting Recap: Sprint Planning*
:busts_in_silhouette: Ian, Mia, Brady, Corey
:clock1: 45 min | Feb 14, 2026

*Key Decisions:*
- Moving to bi-weekly sprints starting next month
- Q1 roadmap locked -- no new features until March
- FirmBroker onboarding priority bumped to P1

*Action Items:*
1. :jira: *Ian* -- Update sprint board with new cadence (High) -- PROJ-456
2. :jira: *Mia* -- Prepare FirmBroker onboarding checklist (High) -- PROJ-457
3. :jira: *Brady* -- Fix CI/CD pipeline failures (Medium) -- PROJ-458

:link: [Full Recording](https://fathom.video/...)
```

## Implementation Steps

### Step 1: Create the workflow

Use `workflow_create` MCP tool with the definition above.

### Step 2: Test with manual execution

```
POST /api/workflows/meeting-followup/execute
{ "input": {} }
```

### Step 3: Add scheduled trigger (optional)

Check for new meetings every hour:

- Cron: `0 * * * *` (every hour)
- The workflow should track which meetings have already been processed (via metadata or a simple check)

### Step 4: Jira integration (Phase 2)

The initial version posts to Slack only. Phase 2 adds automatic Jira ticket creation for each action item using `jira_prepare_issue` + `jira_confirm_create_issue` (which requires human confirmation per the tool design).

## Notes

- Fathom meeting IDs need to be tracked to avoid processing the same meeting twice
- The workflow should gracefully handle meetings with no action items
- Jira ticket creation uses the prepare/confirm pattern, so it may be better as a manual step initially
- Consider adding a "meeting processed" tag or metadata field to track state

## Acceptance Criteria

- [ ] Workflow created and visible in platform
- [ ] Successfully fetches recent meetings from Fathom
- [ ] Extracts action items from meeting summaries
- [ ] Posts formatted summary to Slack
- [ ] Handles meetings with no action items gracefully
- [ ] Manual trigger works from the platform UI

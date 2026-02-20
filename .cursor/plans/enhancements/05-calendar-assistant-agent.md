# 05 -- Calendar Assistant Agent

**Priority:** TIER 2 (High Value)
**Effort:** Low-Medium (1-2 hours)
**Dependencies:** User must activate Google Calendar via onboarding UI

## Problem Statement

Google Calendar has 7 fully-implemented tools but no dedicated agent to use them. Users must go through the workspace-concierge (101 tools) for simple calendar questions. A focused Calendar agent provides:

- Better response quality (narrower instruction set)
- Lower cost per run (fewer tools to reason about)
- Natural Slack integration ("@bot am I free Thursday?")

## Available Calendar Tools

From `packages/agentc2/src/tools/google-calendar/`:

| Tool                            | File               | Purpose                     |
| ------------------------------- | ------------------ | --------------------------- |
| `google-calendar-list-events`   | `list-events.ts`   | List events in a date range |
| `google-calendar-search-events` | `search-events.ts` | Search events by text query |
| `google-calendar-get-event`     | `get-event.ts`     | Get event details by ID     |
| `google-calendar-create-event`  | `create-event.ts`  | Create a new event          |
| `google-calendar-update-event`  | `update-event.ts`  | Update an existing event    |
| `google-calendar-delete-event`  | `delete-event.ts`  | Delete an event             |

Plus general tools:

- `get-current-time` -- Essential for "today", "tomorrow", "next week" references

## Agent Configuration

Create via `agent_create` MCP tool or API:

```json
{
    "name": "Calendar Assistant",
    "slug": "calendar-assistant",
    "description": "Manages your Google Calendar. Checks availability, schedules meetings, finds conflicts, and provides daily overviews. Ask natural questions like 'Am I free Thursday afternoon?' or 'Schedule a 30-min call with Sarah next week.'",
    "type": "USER",
    "modelProvider": "openai",
    "modelName": "gpt-4o-mini",
    "temperature": 0.3,
    "memoryEnabled": true,
    "memoryConfig": {
        "lastMessages": 10,
        "workingMemory": { "enabled": true }
    },
    "instructions": "You are a Calendar Assistant that manages the user's Google Calendar.\n\nCORE CAPABILITIES:\n- Check availability and find free slots\n- Create, update, and delete calendar events\n- Search for events by name, attendee, or date\n- Provide daily/weekly schedule overviews\n- Detect scheduling conflicts\n\nBEHAVIOR RULES:\n1. Always call get-current-time first when dates are relative (today, tomorrow, next week)\n2. When creating events, confirm the details before creating unless the user was very specific\n3. Use 30-minute default duration unless specified\n4. Use the user's primary calendar unless they specify otherwise\n5. Format times in a human-readable way (e.g., '2:00 PM' not '14:00:00')\n6. When checking availability, show the free slots, not just busy times\n7. For weekly overviews, group by day and show time + title + duration\n\nRESPONSE STYLE:\n- Concise and action-oriented\n- Use bullet points for lists of events\n- Include day-of-week for clarity (e.g., 'Thursday, Feb 20')\n- When there are conflicts, proactively suggest alternatives",
    "scorers": ["relevancy", "completeness"],
    "toolIds": [
        "google-calendar-list-events",
        "google-calendar-search-events",
        "google-calendar-get-event",
        "google-calendar-create-event",
        "google-calendar-update-event",
        "google-calendar-delete-event"
    ],
    "metadata": {
        "slack": {
            "displayName": "Calendar Assistant",
            "iconEmoji": ":calendar:"
        }
    }
}
```

## Key Design Decisions

### Model: gpt-4o-mini (not Claude)

- Calendar tasks are well-defined and structured
- Lower cost for high-frequency queries
- Fast response time matters for "am I free?" type questions

### Memory: Enabled

- Remembers user preferences (e.g., "I prefer morning meetings")
- Maintains context within a conversation ("move that to 3pm instead")
- Working memory for ongoing scheduling negotiations

### Temperature: 0.3

- Calendar operations need precision, not creativity
- Dates, times, and event details must be exact

## Slack Integration

The agent will be accessible via Slack using the existing `agent:` routing:

```
@Bot agent:calendar-assistant Am I free Thursday afternoon?
@Bot agent:calendar-assistant Schedule a 30-min call with Ian tomorrow at 2pm
@Bot agent:calendar-assistant What's my schedule this week?
```

The Slack display name and icon are set via the `metadata.slack` field.

## Example Interactions

**"Am I free Thursday afternoon?"**

```
Let me check your Thursday schedule...

Thursday, Feb 20:
- 9:00 AM -- Team Standup (15 min)
- 11:00 AM -- Client Call (30 min)
- 2:00 PM -- Sprint Planning (1 hr)

You're free from 12:00 PM - 2:00 PM and after 3:00 PM.
Would you like me to block any of those slots?
```

**"Schedule a 30-min sync with Ian tomorrow at 2pm"**

```
I'll create that event:

- Title: Sync with Ian
- When: Saturday, Feb 15 at 2:00 PM (30 min)
- Calendar: Primary

Created! Here's the link: [Event Link]
```

## Implementation Steps

1. Create the agent via `agent_create` MCP tool
2. Attach calendar tools via tool registry
3. Test basic queries: availability check, event creation, search
4. Test via Slack: `@Bot agent:calendar-assistant What's my schedule today?`

## Acceptance Criteria

- [ ] Agent created and visible in platform UI
- [ ] Can check availability for a given date/time
- [ ] Can create events with correct details
- [ ] Can search for events by keyword
- [ ] Accessible via Slack with `agent:calendar-assistant` prefix
- [ ] Uses `:calendar:` icon in Slack responses
- [ ] Memory persists across conversation turns

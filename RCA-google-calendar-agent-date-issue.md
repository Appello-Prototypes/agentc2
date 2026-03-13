# Root Cause Analysis: Google Calendar Agent Returns October 2023 Events

**Issue**: [#187](https://github.com/Appello-Prototypes/agentc2/issues/187)  
**Branch**: `cursor/calendar-agent-date-issue-62ca`  
**Date**: 2026-03-13  
**Severity**: **High** — Calendar integration functionally broken, returns 2.5-year-old data

---

## Executive Summary

When users ask the `google-calendar-agent` for "upcoming events for the next 3 days", the agent returns calendar events from **October 2023** instead of the current date (March 2026). The agent is returning results that are **2.5 years stale**.

**Root Cause**: The `google-calendar-agent` lacks two critical capabilities needed to query calendar events by date:

1. **No access to the `date-time` tool** — The agent cannot determine the current date
2. **No current date in agent instructions** — The agent's system prompt doesn't include "today's date"

Without knowing the current date, the LLM hallucinates dates from its training data (October 2023) when calling the `google-calendar-list-events` tool, which requires `timeMin` and `timeMax` parameters.

**Impact**:

- Google Calendar integration is **functionally broken** for date-based queries
- Any request for "upcoming", "next week", "today's" events returns ancient data
- Users receive completely incorrect scheduling information
- Any agent using Calendar tools for scheduling will malfunction

---

## Bug Report Details

### Reproduction Steps

1. Call `agent_invoke_dynamic(agentSlug: 'google-calendar-agent', message: 'List my upcoming events for the next 3 days.')`
2. Observe: Agent returns events from October 3-5, 2023:
   - "Corey - Chris" at 9:30 AM EDT
   - "Ian x Corey: Standing Meetings"
   - "Burke D-Souza Call"

### Expected Behavior

Should return events from March 12-14, 2026 (current date + 3 days).

---

## Technical Deep Dive

### 1. Agent Configuration Analysis

**File**: `packages/agentc2/src/integrations/blueprints/email.ts` (Lines 131-144)

```typescript
agent: {
    slug: "google-calendar-agent",
    name: "Google Calendar Agent",
    description: "AI agent for Google Calendar",
    instructions: `You are a Google Calendar specialist. Help users manage events and scheduling.`,
    modelProvider: "openai",
    modelName: "gpt-4o",
    temperature: 0.3,
    memoryEnabled: true,
    additionalTools: [],  // ⚠️ EMPTY — No date-time tool!
    metadata: {
        slack: { displayName: "Calendar Agent", iconEmoji: ":calendar:" }
    }
}
```

**Problems Identified**:

1. **Line 135**: Agent instructions are minimal (1 sentence) and do NOT include:
   - Current date (e.g., "Today is March 13, 2026")
   - Date context or temporal awareness
   - Guidance on calculating date ranges

2. **Line 140**: `additionalTools: []` is empty — the agent does NOT have access to the `date-time` tool

### 2. Google Calendar Tool Requirements

**File**: `packages/agentc2/src/tools/google-calendar/list-events.ts` (Lines 39-50)

```typescript
inputSchema: z.object({
    timeMin: z
        .string()
        .describe("Start of time range in ISO 8601 format (e.g., '2026-02-13T00:00:00Z')"),
    timeMax: z
        .string()
        .describe("End of time range in ISO 8601 format (e.g., '2026-02-20T00:00:00Z')"),
    calendarId: z
        .string()
        .default("primary")
        .describe("Calendar ID to list (defaults to 'primary')"),
    maxResults: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum number of results (1-50, default 20)"),
    gmailAddress: z
        .string()
        .default("")
        .describe("Google account email. Leave empty to auto-detect from connected account.")
}),
```

**Critical Finding**: `timeMin` and `timeMax` are **REQUIRED parameters** (no `.optional()`). The tool demands that the agent provide explicit date ranges in ISO 8601 format.

### 3. Date-Time Tool Analysis

**File**: `packages/agentc2/src/tools/example-tools.ts` (Lines 7-53)

The `date-time` tool is registered in the tool registry as `"date-time"` (ID: `"get-datetime"`):

```typescript
export const dateTimeTool = createTool({
    id: "get-datetime",
    description:
        "Get the current date and time. Optionally specify a timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo').",
    inputSchema: z.object({
        timezone: z
            .string()
            .optional()
            .describe("IANA timezone name (e.g., 'America/New_York'). Defaults to UTC.")
    }),
    outputSchema: z.object({
        datetime: z.string().describe("Formatted date and time string"),
        date: z.string().describe("Date in YYYY-MM-DD format"),  // ⚠️ This is what the agent needs!
        time: z.string().describe("Time in HH:MM:SS format"),
        timezone: z.string().describe("Timezone used"),
        timestamp: z.number().describe("Unix timestamp in milliseconds")
    }),
    execute: async ({ timezone = "UTC" }) => {
        const now = new Date();
        // ... returns current date in YYYY-MM-DD format
        const date = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
        return { datetime, date, time, timezone, timestamp: now.getTime() };
    }
});
```

This tool provides `date` in the exact format needed by the Calendar tools (`YYYY-MM-DD`). The `google-calendar-agent` does NOT have this tool.

### 4. Agent Resolution & Instruction Injection

**File**: `packages/agentc2/src/agents/resolver.ts` (Lines 854-883)

When agents are hydrated from the database, the resolver injects:

```typescript
// Line 854-856: Agent identity injection
let finalInstructions =
    instructions +
    `\n\n---\n# Agent Identity\nslug: ${record.slug}\nid: ${record.id}\nname: ${record.name}\n`;

// Line 859-860: Skills and domain knowledge
if (skillInstructions) {
    finalInstructions += `\n\n---\n# Skills & Domain Knowledge\n${skillInstructions}`;
}
```

**Critical Finding**: The agent resolver does NOT inject the current date anywhere. There is no code path that adds "Today is [date]" to the agent's instructions.

### 5. Comparison: Working Agents vs. Broken Agent

**Evidence from Plan Files**:

Meeting-related agents explicitly inject the current date:

- **File**: `.cursor/plans/meeting-02-post-meeting-debrief.plan.md` (Line 414)
  ```
  input: `Check for newly completed Fathom meetings in the last 20 minutes. Today is {{currentDate}}. ...`
  ```

- **File**: `.cursor/plans/meeting-01-pre-meeting-prep.plan.md` (Line 317)
  ```
  input: `Scan for upcoming meetings in the next 90 minutes. Today is {{currentDate}}. ...`
  ```

This shows developers are **aware** that agents need the current date for time-based operations, but the generic `google-calendar-agent` lacks this.

### 6. What Happens Without Current Date Context

When a user asks "List my upcoming events for the next 3 days":

1. **Agent receives user message**: "List my upcoming events for the next 3 days"
2. **Agent recognizes need to call tool**: `google-calendar-list-events`
3. **Agent must provide `timeMin` and `timeMax`**: These are REQUIRED parameters
4. **Agent doesn't know "today's date"**: No tool to get it, not in instructions
5. **LLM hallucinates dates**: Uses dates from training data (October 2023)
6. **Tool call**: 
   ```json
   {
     "timeMin": "2023-10-03T00:00:00Z",
     "timeMax": "2023-10-06T00:00:00Z"
   }
   ```
7. **Google Calendar API returns**: Events from October 2023 (technically correct API response)
8. **User receives**: 2.5-year-old events as "upcoming"

---

## Root Cause Statement

The `google-calendar-agent` cannot determine the current date because:

1. **Missing Tool**: The agent lacks the `date-time` tool (which is available in the tool registry but not attached to this agent)
2. **Missing Context**: The agent's instructions don't include the current date or temporal context
3. **Required Parameters**: The Google Calendar tools mandate `timeMin`/`timeMax`, forcing the agent to fabricate dates

Without temporal awareness, the LLM resorts to dates from its training cutoff (October 2023), resulting in a complete calendar integration failure.

---

## Impact Assessment

### Affected Functionality

| Scenario | Impact | Severity |
|----------|--------|----------|
| "Show my upcoming events" | Returns October 2023 events | Critical |
| "What meetings do I have today?" | Returns wrong date's events | Critical |
| "Schedule a meeting next week" | May schedule in October 2023 | Critical |
| "Check availability tomorrow" | Checks wrong date | Critical |
| "Find events with [person]" | If date range used, returns old data | High |
| Event creation (with explicit date) | Works correctly (user provides date) | Low |

### User Experience Impact

- **Calendar queries are 100% broken** for relative date queries ("today", "tomorrow", "next week", "upcoming")
- Users receive completely incorrect scheduling information
- No error message — silently fails with wrong data
- Undermines trust in the entire calendar integration

### Downstream Effects

Any agent or workflow that:
- Checks calendar availability
- Schedules meetings
- Prepares meeting briefs
- Sends calendar-based reminders

...will receive October 2023 data and make incorrect decisions.

---

## Proposed Solution

### Fix Option 1: Add `date-time` Tool (Recommended)

**File**: `packages/agentc2/src/integrations/blueprints/email.ts` (Line 140)

**Change**:
```typescript
agent: {
    slug: "google-calendar-agent",
    name: "Google Calendar Agent",
    description: "AI agent for Google Calendar",
    instructions: `You are a Google Calendar specialist. Help users manage events and scheduling.

When users ask for events using relative dates ("today", "tomorrow", "next week", "upcoming"), 
you MUST first call the date-time tool to get the current date, then calculate the appropriate 
date range and pass it to the calendar tools.`,
    modelProvider: "openai",
    modelName: "gpt-4o",
    temperature: 0.3,
    memoryEnabled: true,
    additionalTools: ["date-time"],  // ⬅️ ADD THIS
    metadata: {
        slack: { displayName: "Calendar Agent", iconEmoji: ":calendar:" }
    }
}
```

**How This Works**:

1. User asks: "List my upcoming events for the next 3 days"
2. Agent calls `date-time` tool → Gets `{ date: "2026-03-13", ... }`
3. Agent calculates date range:
   - `timeMin`: "2026-03-13T00:00:00Z"
   - `timeMax`: "2026-03-16T23:59:59Z"
4. Agent calls `google-calendar-list-events` with correct dates
5. User receives correct events

**Pros**:
- ✅ Minimal code change (2 lines)
- ✅ Follows existing tool pattern (same as `assistant` agent)
- ✅ Enables agent to dynamically determine current date
- ✅ Handles all timezones correctly
- ✅ Non-breaking change (doesn't affect other agents)
- ✅ Robust — works for any relative date query

**Cons**:
- Requires 1 extra tool call per calendar query (+~200ms latency)

### Fix Option 2: Inject Current Date in Instructions

**File**: `packages/agentc2/src/agents/resolver.ts` (Around line 856)

**Change**: Inject current date into all agent instructions:

```typescript
let finalInstructions =
    instructions +
    `\n\n---\n# Agent Identity\nslug: ${record.slug}\nid: ${record.id}\nname: ${record.name}\n` +
    `\n\n---\n# Current Date\nToday is ${new Date().toISOString().split('T')[0]} (UTC)\n`;
```

**Pros**:
- ✅ Zero extra tool calls
- ✅ Works for all agents automatically
- ✅ Simpler for the LLM (date is in context)

**Cons**:
- ❌ Date becomes stale during long conversations (hydration cache = 30 seconds)
- ❌ Timezone complexity (UTC vs user's local time)
- ❌ Affects ALL agents (broad change)
- ❌ May confuse agents that don't need temporal context

### Fix Option 3: Make Tool Defaults Smarter

**File**: `packages/agentc2/src/tools/google-calendar/list-events.ts` (Lines 82-105)

**Change**: Default `timeMin` to current date if not provided:

```typescript
execute: async ({ timeMin, timeMax, calendarId, maxResults, gmailAddress }) => {
    // Default to "today + 7 days" if no date range provided
    const now = new Date();
    const defaultTimeMin = timeMin || now.toISOString();
    const defaultTimeMax = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await callCalendarApi(
        address,
        `/calendars/${encodeURIComponent(calendar)}/events`,
        {
            timeMin: defaultTimeMin.includes("T") ? defaultTimeMin : `${defaultTimeMin}T00:00:00Z`,
            timeMax: defaultTimeMax.includes("T") ? defaultTimeMax : `${defaultTimeMax}T23:59:59Z`,
            // ...
        }
    );
```

**Pros**:
- ✅ Fixes the immediate bug (returns current events)
- ✅ No agent changes needed

**Cons**:
- ❌ Hardcoded 7-day default may not match user intent ("next 3 days" still broken)
- ❌ Tool becomes less explicit (hidden defaults are dangerous)
- ❌ Doesn't help with precise date calculations

---

## Recommended Fix: Option 1 (Add `date-time` Tool)

**Rationale**:

1. **Precision**: Agent can calculate exact date ranges based on user intent
2. **Flexibility**: Works for any relative date query ("tomorrow", "next week", "last month")
3. **Clarity**: Tool descriptions guide the LLM to the correct behavior
4. **Pattern**: Matches existing `assistant` agent design
5. **Risk**: Minimal — only affects the `google-calendar-agent`
6. **Performance**: +200ms latency is acceptable for correctness

---

## Implementation Plan

### Step 1: Update Agent Blueprint

**File**: `packages/agentc2/src/integrations/blueprints/email.ts`

```typescript
agent: {
    slug: "google-calendar-agent",
    name: "Google Calendar Agent",
    description: "AI agent for Google Calendar",
    instructions: `You are a Google Calendar specialist. Help users manage events and scheduling.

When users ask for events using relative dates ("today", "tomorrow", "next week", "upcoming"), 
always call the date-time tool FIRST to get the current date, then calculate the appropriate 
date range to pass to the calendar tools.

Example workflow:
1. User asks: "Show my meetings tomorrow"
2. Call date-time tool → { date: "2026-03-13" }
3. Calculate tomorrow: "2026-03-14"
4. Call google-calendar-list-events with timeMin="2026-03-14T00:00:00Z", timeMax="2026-03-14T23:59:59Z"`,
    modelProvider: "openai",
    modelName: "gpt-4o",
    temperature: 0.3,
    memoryEnabled: true,
    additionalTools: ["date-time"],
    metadata: {
        slack: { displayName: "Calendar Agent", iconEmoji: ":calendar:" }
    }
}
```

### Step 2: Database Migration (If Needed)

If the agent already exists in the database, update it:

```sql
-- Find the google-calendar-agent
SELECT id, slug, "additionalTools" FROM "Agent" 
WHERE slug = 'google-calendar-agent';

-- Update additionalTools to include date-time
UPDATE "Agent"
SET 
    "additionalTools" = ARRAY['date-time']::text[],
    instructions = 'You are a Google Calendar specialist. Help users manage events and scheduling.

When users ask for events using relative dates ("today", "tomorrow", "next week", "upcoming"), 
always call the date-time tool FIRST to get the current date, then calculate the appropriate 
date range to pass to the calendar tools.',
    version = version + 1,
    "updatedAt" = NOW()
WHERE slug = 'google-calendar-agent';
```

**Note**: This will only affect NEW agent instances. Existing instances need to be re-provisioned or manually updated.

### Step 3: Re-provision Agent (For Existing Instances)

For organizations that already have the `google-calendar-agent`:

```typescript
// Script: scripts/fix-calendar-agent-date-issue.ts
import { prisma } from "@repo/database";

async function fixCalendarAgentDateIssue() {
    const agents = await prisma.agent.findMany({
        where: { slug: "google-calendar-agent" }
    });

    console.log(`Found ${agents.length} google-calendar-agent instances`);

    for (const agent of agents) {
        // Check if date-time tool is already present
        const tools = agent.additionalTools as string[] || [];
        if (tools.includes("date-time")) {
            console.log(`Agent ${agent.id} already has date-time tool, skipping`);
            continue;
        }

        // Add date-time tool
        const updatedTools = [...tools, "date-time"];

        await prisma.agent.update({
            where: { id: agent.id },
            data: {
                additionalTools: updatedTools,
                instructions: agent.instructions + `\n\nWhen users ask for events using relative dates, always call the date-time tool first to get the current date.`,
                version: agent.version + 1
            }
        });

        console.log(`Fixed agent ${agent.id} (${agent.slug})`);
    }

    console.log("Done!");
}

fixCalendarAgentDateIssue().catch(console.error);
```

Run with: `bun run scripts/fix-calendar-agent-date-issue.ts`

### Step 4: Verify Fix

**Test Case 1: Upcoming Events**

```typescript
// Input
{
  "agentSlug": "google-calendar-agent",
  "message": "List my upcoming events for the next 3 days"
}

// Expected Tool Calls
1. date-time → { date: "2026-03-13" }
2. google-calendar-list-events({
     timeMin: "2026-03-13T00:00:00Z",
     timeMax: "2026-03-16T23:59:59Z"
   })

// Expected Output
Events from March 13-16, 2026
```

**Test Case 2: Today's Events**

```typescript
{
  "agentSlug": "google-calendar-agent",
  "message": "What meetings do I have today?"
}

// Expected Tool Calls
1. date-time → { date: "2026-03-13" }
2. google-calendar-list-events({
     timeMin: "2026-03-13T00:00:00Z",
     timeMax: "2026-03-13T23:59:59Z"
   })
```

**Test Case 3: Next Week**

```typescript
{
  "agentSlug": "google-calendar-agent",
  "message": "Show me next week's calendar"
}

// Expected Tool Calls
1. date-time → { date: "2026-03-13" }
2. google-calendar-list-events({
     timeMin: "2026-03-17T00:00:00Z",  // Next Monday
     timeMax: "2026-03-23T23:59:59Z"   // Next Sunday
   })
```

---

## Testing Checklist

- [ ] **Blueprint updated**: `additionalTools` includes `"date-time"`
- [ ] **Instructions updated**: Guidance on using date-time tool added
- [ ] **Database migration**: Existing agents updated (if applicable)
- [ ] **Tool registry check**: Verify `"date-time"` is in `toolRegistry`
- [ ] **Agent resolution**: Confirm date-time tool is loaded when agent is resolved
- [ ] **Test: Upcoming events** → Returns March 2026 events
- [ ] **Test: Today's events** → Returns March 13, 2026 events
- [ ] **Test: Tomorrow's events** → Returns March 14, 2026 events
- [ ] **Test: Next week** → Returns March 17-23, 2026 events
- [ ] **Test: Explicit dates** → Works without date-time tool (user provides date)
- [ ] **No regressions**: Other calendar operations still work (create, update, delete)
- [ ] **Performance check**: Tool call overhead is acceptable (<500ms total)

---

## Risk Assessment

**Severity**: High (Critical functionality broken)  
**Likelihood**: 100% (Affects all calendar date queries)  
**User Impact**: Complete calendar integration failure for relative date queries

**Fix Risk**: **Low**

- Change is isolated to `google-calendar-agent` blueprint
- `date-time` tool is already proven (used by `assistant` agent)
- Non-breaking — doesn't affect other agents
- Clear rollback path (revert blueprint changes)

---

## Prevention & Monitoring

### 1. Lint Rule: Require Date-Time Tool for Time-Based Agents

Add to `.eslintrc.js` or create custom linter:

```typescript
// Rule: Agents with calendar/scheduling tools must have date-time tool
const timeBasedTools = [
    "google-calendar-list-events",
    "google-calendar-search-events",
    "outlook-calendar-list-events",
    "outlook-calendar-search-events"
];

function checkAgentBlueprint(agent) {
    const hasTimeBasedTool = agent.skill.staticTools.some(tool => 
        timeBasedTools.includes(tool)
    );
    const hasDateTimeTool = agent.agent.additionalTools.includes("date-time");

    if (hasTimeBasedTool && !hasDateTimeTool) {
        throw new Error(
            `Agent "${agent.agent.slug}" uses calendar tools but lacks "date-time" tool. ` +
            `Add "date-time" to additionalTools to prevent date hallucination.`
        );
    }
}
```

### 2. Integration Test

```typescript
// tests/integration/agents/google-calendar-agent.test.ts
import { agentResolver } from "@repo/agentc2/agents";

describe("google-calendar-agent", () => {
    it("should have date-time tool", async () => {
        const { agent, resolvedToolNames } = await agentResolver.resolve({
            slug: "google-calendar-agent"
        });

        expect(resolvedToolNames).toContain("date-time");
    });

    it("should return current events for 'upcoming' query", async () => {
        const result = await agent.generate("List my upcoming events for the next 3 days");
        
        // Check that tool calls include date-time
        const toolCalls = result.toolCalls || [];
        expect(toolCalls.some(tc => tc.toolName === "date-time")).toBe(true);
        
        // Check that calendar tool is called with current date
        const calendarCall = toolCalls.find(tc => tc.toolName === "google-calendar-list-events");
        expect(calendarCall).toBeDefined();
        expect(calendarCall.args.timeMin).toMatch(/^2026-03/); // Current month
    });
});
```

### 3. Monitoring Alert

Add to observability dashboard:

```sql
-- Alert: Calendar tool calls without recent date-time call
SELECT 
    ar.id AS run_id,
    ar."agentSlug",
    ar."inputText",
    ar."startedAt",
    COUNT(atc.id) FILTER (WHERE atc."toolName" = 'google-calendar-list-events') AS calendar_calls,
    COUNT(atc.id) FILTER (WHERE atc."toolName" = 'date-time') AS datetime_calls
FROM "AgentRun" ar
JOIN "AgentToolCall" atc ON ar.id = atc."runId"
WHERE 
    ar."agentSlug" LIKE '%calendar%'
    AND ar."startedAt" > NOW() - INTERVAL '1 hour'
GROUP BY ar.id, ar."agentSlug", ar."inputText", ar."startedAt"
HAVING 
    COUNT(atc.id) FILTER (WHERE atc."toolName" = 'google-calendar-list-events') > 0
    AND COUNT(atc.id) FILTER (WHERE atc."toolName" = 'date-time') = 0;

-- Alert when calendar agents make calls with 2023 dates
SELECT 
    ar.id,
    ar."agentSlug",
    ar."inputText",
    atc."toolName",
    atc."toolInput"
FROM "AgentRun" ar
JOIN "AgentToolCall" atc ON ar.id = atc."runId"
WHERE 
    atc."toolName" LIKE '%calendar%'
    AND atc."toolInput"::text LIKE '%2023%'
    AND ar."startedAt" > NOW() - INTERVAL '1 day';
```

---

## Related Issues

This root cause may affect other time-based integrations:

- [ ] **Outlook Calendar Agent** — Check if it has the same issue
- [ ] **Microsoft Teams Agent** — Meeting scheduling may be affected
- [ ] **Slack Agent** — "Remind me tomorrow" features
- [ ] **Trigger Scheduling** — Any agent that schedules future actions
- [ ] **Campaign Agents** — Time-based campaign execution

**Action**: Audit all agents with time-based tools and ensure they have date-time capability.

---

## Conclusion

The `google-calendar-agent` returns October 2023 events because it lacks temporal awareness. Without the `date-time` tool or current date in its instructions, the LLM hallucinates dates from its training data.

**Fix**: Add `"date-time"` to the agent's `additionalTools` and update instructions to guide proper usage.

**Estimated Effort**: 30 minutes (blueprint update + database migration) + 1 hour (testing across all scenarios) = **1.5 hours total**

**Risk**: Low — Isolated change, proven tool, clear rollback path

**Priority**: **High** — Calendar integration is completely broken for production use

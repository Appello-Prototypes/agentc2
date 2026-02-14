# 11 -- Feedback Collection via Slack Reactions

**Priority:** TIER 4 (Learning)
**Effort:** Medium (3-4 hours)
**Dependencies:** None

## Problem Statement

1 feedback entry total across the entire platform. The learning system has no human signal to improve from -- it relies solely on eval scores (which are currently broken, see Plan 01). Wiring Slack reactions to the feedback API creates a frictionless signal path:

- User adds :thumbsup: to an agent response -> positive feedback
- User adds :thumbsdown: -> negative feedback
- Zero extra effort required from users

## Current Feedback System

### Schema

```prisma
model AgentFeedback {
    thumbs  Boolean? // true = up, false = down
    rating  Int? // 1-5 scale
    comment String?
    source  String? // "slack" | "ui" | "api"
}
```

### API

```
POST /api/agents/{id}/feedback
{ "runId": "...", "thumbs": true/false, "comment": "..." }
```

### Existing Slack Feedback Handler

There's already a `processSlackFeedback` function in `apps/agent/src/app/api/slack/events/route.ts` (lines 111-175) that creates feedback and emits `feedback/submitted` events. However, it's only wired to text replies, not reactions.

### Calibration Pipeline

`apps/agent/src/lib/inngest-functions.ts` (lines 476-602) has a `calibrationCheckFunction` that:

1. Loads the corresponding evaluation for the run
2. Compares human feedback score vs AI auditor grade
3. Creates `CalibrationCheck` records
4. Detects drift when alignment drops below 70%

This pipeline is fully built but has no data flowing into it.

## Implementation Plan

### Step 1: Subscribe to `reaction_added` events in Slack

**File:** `apps/agent/src/app/api/slack/events/route.ts`

The Slack Events API needs to include `reaction_added` in its subscriptions. In the Slack App settings (api.slack.com):

- Event Subscriptions -> Subscribe to bot events -> Add `reaction_added`

### Step 2: Handle `reaction_added` events

**File:** `apps/agent/src/app/api/slack/events/route.ts`

Add a handler for `reaction_added` events in the existing event handler:

```typescript
case "reaction_added": {
    const { reaction, item, user: reactingUser } = event;

    // Only process thumbsup/thumbsdown reactions
    if (reaction !== "+1" && reaction !== "-1" &&
        reaction !== "thumbsup" && reaction !== "thumbsdown") {
        break;
    }

    const isPositive = reaction === "+1" || reaction === "thumbsup";

    // item.type === "message" && item.channel && item.ts
    if (item.type !== "message") break;

    // Look up the AgentRun associated with this Slack message
    // The Slack message ts is stored in run metadata when the bot posts
    const run = await prisma.agentRun.findFirst({
        where: {
            metadata: {
                path: ["slack", "messageTs"],
                equals: item.ts
            }
        },
        select: { id: true, agentId: true }
    });

    if (!run) {
        console.log("[Slack Feedback] No run found for message ts:", item.ts);
        break;
    }

    // Create feedback
    await processSlackReactionFeedback({
        runId: run.id,
        agentId: run.agentId,
        thumbs: isPositive,
        reaction,
        userId: reactingUser,
        channelId: item.channel,
        messageTs: item.ts
    });

    break;
}
```

### Step 3: Create the reaction feedback processor

**File:** `apps/agent/src/app/api/slack/events/route.ts`

```typescript
async function processSlackReactionFeedback(params: {
    runId: string;
    agentId: string;
    thumbs: boolean;
    reaction: string;
    userId: string;
    channelId: string;
    messageTs: string;
}): Promise<void> {
    // Check if feedback already exists for this run (avoid duplicates)
    const existing = await prisma.agentFeedback.findFirst({
        where: {
            runId: params.runId,
            source: "slack"
        }
    });

    if (existing) {
        // Update existing feedback (user changed their reaction)
        await prisma.agentFeedback.update({
            where: { id: existing.id },
            data: { thumbs: params.thumbs }
        });
    } else {
        // Create new feedback
        const feedback = await prisma.agentFeedback.create({
            data: {
                runId: params.runId,
                agentId: params.agentId,
                thumbs: params.thumbs,
                source: "slack",
                comment: `Slack reaction: :${params.reaction}: by user ${params.userId}`
            }
        });

        // Emit feedback event for calibration pipeline
        await inngest.send({
            name: "feedback/submitted",
            data: {
                feedbackId: feedback.id,
                runId: params.runId,
                agentId: params.agentId,
                thumbs: params.thumbs,
                rating: null,
                source: "slack",
                comment: null
            }
        });
    }
}
```

### Step 4: Store Slack message metadata in AgentRun

For the reaction lookup to work, we need to store the Slack message timestamp in the `AgentRun` metadata when the bot posts a response.

**File:** `apps/agent/src/app/api/slack/events/route.ts` (in the response posting logic)

When posting the agent's response to Slack, capture the message `ts` and store it:

```typescript
// After posting to Slack
const slackResponse = await slackClient.chat.postMessage({
    channel: channelId,
    text: agentResponse,
    thread_ts: threadTs
});

// Store the message ts in the run metadata
await prisma.agentRun.update({
    where: { id: runId },
    data: {
        metadata: {
            ...existingMetadata,
            slack: {
                messageTs: slackResponse.ts,
                channelId: channelId,
                threadTs: threadTs
            }
        }
    }
});
```

### Step 5: Add `reaction_removed` handler (optional)

When a user removes a reaction, either:

- Delete the feedback entry
- Or update it to `thumbs: null`

```typescript
case "reaction_removed": {
    // Similar lookup, then delete or nullify the feedback
    break;
}
```

## Slack App Configuration Changes

In the Slack App settings (api.slack.com):

1. **Event Subscriptions** -> Subscribe to bot events:
    - Add: `reaction_added`
    - Add: `reaction_removed` (optional)

2. **OAuth Scopes** -> Add:
    - `reactions:read` -- Read reactions on messages

## Data Flow

```
User adds :thumbsup: to bot message in Slack
        │
        ▼
Slack sends reaction_added event to /api/slack/events
        │
        ▼
Handler looks up AgentRun by message ts
        │
        ▼
Creates AgentFeedback record (thumbs: true, source: "slack")
        │
        ▼
Emits "feedback/submitted" Inngest event
        │
        ▼
calibrationCheckFunction compares feedback vs eval score
        │
        ▼
CalibrationCheck record created (aligned/disagreement)
        │
        ▼
Learning system uses feedback signals for improvement proposals
```

## Acceptance Criteria

- [ ] Slack App subscribed to `reaction_added` events
- [ ] :thumbsup: reaction on bot message creates positive feedback
- [ ] :thumbsdown: reaction creates negative feedback
- [ ] AgentRun stores Slack message ts in metadata
- [ ] Feedback visible in platform UI under agent feedback
- [ ] `feedback/submitted` event fires and calibration check runs
- [ ] Duplicate reactions update existing feedback (no duplicates)
- [ ] `bun run type-check` passes
- [ ] `bun run build` passes

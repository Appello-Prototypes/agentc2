# Slack Deep Integration — Channel-Scoped Agent Instances

**Created:** 2026-02-18
**Status:** PLAN
**Goal:** Transform AgentC2's Slack integration from "chatbot in a channel" into a full AI-powered workspace operating system — where every Slack channel becomes an isolated agent instance with its own context, memory, and knowledge.

---

## Core Concept: Single Agent Architecture, Isolated Instances

### The Problem

Today, an "agent" is a monolithic entity. If you want a Deal Agent for Acme Corp and a Deal Agent for Globex, you need to create two separate agents with manually duplicated instructions. This doesn't scale.

### The Solution

Separate the **agent template** from the **agent instance**:

| Layer              | What It Is                                       | Shared or Isolated          |
| ------------------ | ------------------------------------------------ | --------------------------- |
| **Agent Template** | Instructions, model, tools, personality          | Shared across all instances |
| **Agent Instance** | Memory, context data, RAG scope, channel binding | Isolated per channel/deal   |

A new database primitive — `SlackChannelBinding` — connects a Slack channel to an agent template and a context source (deal, customer, project). The agent resolver uses this binding to:

1. Route messages in that channel to the correct agent template
2. Inject deal/customer-specific context into the agent's instructions
3. Scope memory to that channel (threads within the channel get sub-scoped memory)
4. Scope RAG queries to that deal's documents

### Example Flow

```
Slack channel: #deal-acme-corp
  → SlackChannelBinding: { agent: "deal-manager", contextType: "deal", contextId: "hubspot-deal-123" }
  → Agent Template: "deal-manager" (shared instructions, tools, model)
  → Context Injection: Acme Corp deal data (stage, value, contacts, notes)
  → Memory: Isolated to this channel
  → RAG: Only Acme Corp documents
  → Result: Agent behaves as if it's a dedicated Acme Corp deal manager
```

---

## Architecture

### New Database Model: `SlackChannelBinding`

```prisma
model SlackChannelBinding {
    id                      String @id @default(cuid())
    integrationConnectionId String
    integrationConnection   IntegrationConnection @relation(...)
    organizationId          String
    organization            Organization          @relation(...)

    // Slack channel identification
    channelId   String // Slack channel ID (C...)
    channelName String? // Cached display name
    teamId      String // Slack workspace ID

    // Agent binding
    agentId   String? // Specific agent (null = use default)
    agent                   Agent?                @relation(...)
    agentSlug String? // Alternative: resolve by slug at runtime

    // Context binding (what this channel is "about")
    contextType      String? // "deal", "customer", "project", "support", null
    contextId        String? // External ID (HubSpot deal ID, etc.)
    contextData      Json? // Cached/static context data for injection
    contextRefreshAt DateTime? // When to refresh from source

    // Instance configuration (overrides agent defaults)
    memoryNamespace      String? // Custom memory namespace (default: channelId)
    ragCollectionId      String? // Scoped RAG collection
    instructionOverrides String? @db.Text // Append to agent instructions
    maxStepsOverride     Int? // Override maxSteps
    temperatureOverride  Float? // Override temperature

    // Response behavior
    replyMode       String  @default("thread") // "thread", "channel", "ephemeral"
    responseLength  String  @default("standard") // "concise", "standard", "detailed"
    richFormatting  Boolean @default(true) // Slack Block Kit enabled
    typingIndicator String  @default("reaction") // "reaction", "message", "none"

    // Access control
    allowedUserIds String[] @default([]) // Empty = everyone allowed
    blockedUserIds String[] @default([])

    // Triggers (beyond @mention)
    triggerOnAllMessages Boolean  @default(false) // Respond to every message (no @mention needed)
    triggerKeywords      String[] @default([]) // Keywords that trigger response
    triggerOnFileUpload  Boolean  @default(false) // Trigger on file uploads

    // Escalation
    escalationChannelId String? // Channel to escalate to
    escalationUserIds   String[] @default([]) // Users to tag on escalation

    // Lifecycle
    isActive  Boolean  @default(true)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    createdBy String?

    @@unique([channelId, teamId])
    @@index([integrationConnectionId])
    @@index([organizationId])
    @@index([agentId])
    @@index([contextType, contextId])
    @@map("slack_channel_binding")
}
```

### Modified Event Handler Flow

```
Current:  Event → resolveInstallation → parseAgentDirective → agentResolver.resolve(slug) → generate
Proposed: Event → resolveInstallation → lookupChannelBinding(channelId) → enrichWithBinding → agentResolver.resolve(slug, bindingContext) → generate
```

**Key change in `processMessage()`:**

```typescript
// BEFORE (current)
const slug = agentSlug || installation?.defaultAgentSlug || FALLBACK_AGENT_SLUG;

// AFTER (new)
const binding = await lookupChannelBinding(teamId, channelId);
const slug =
    agentSlug || binding?.agentSlug || installation?.defaultAgentSlug || FALLBACK_AGENT_SLUG;

// If binding exists, inject context into resolver
const requestContext = {
    userId,
    metadata: {
        platform: "slack",
        channelId,
        threadTs,
        // NEW: binding context injected
        ...(binding?.contextData ? { _bindingContext: binding.contextData } : {}),
        ...(binding?.contextType
            ? { _contextType: binding.contextType, _contextId: binding.contextId }
            : {})
    }
};

// Memory namespace scoped to binding
const memoryNamespace = binding?.memoryNamespace || slackThreadId;
```

### Modified Agent Resolver

Extend `interpolateInstructions()` to support `{{binding.*}}` patterns:

```
{{binding.contextType}}     → "deal"
{{binding.contextId}}       → "hubspot-deal-123"
{{binding.context.name}}    → "Acme Corp Enterprise Deal"
{{binding.context.stage}}   → "Proposal"
{{binding.context.value}}   → "$250,000"
{{binding.context.contacts}} → "John Smith (CEO), Jane Doe (CTO)"
```

This means a single agent template instruction like:

```
You are a dedicated deal manager for {{binding.context.companyName}}.
Current deal stage: {{binding.context.stage}}
Deal value: {{binding.context.value}}
Key contacts: {{binding.context.contacts}}
Recent activity: {{binding.context.recentActivity}}
```

...becomes fully personalized per channel without creating separate agents.

---

## Implementation Plan

### Phase 1: Foundation — SlackChannelBinding Model + API

**Files to create/modify:**

| File                                             | Action                          |
| ------------------------------------------------ | ------------------------------- |
| `packages/database/prisma/schema.prisma`         | Add `SlackChannelBinding` model |
| `apps/agent/src/app/api/slack/bindings/route.ts` | CRUD API for channel bindings   |
| `apps/agent/src/lib/slack-bindings.ts`           | Binding resolution utilities    |

**Tasks:**

1. Add `SlackChannelBinding` model to Prisma schema
2. Add relation to `IntegrationConnection`, `Organization`, `Agent`
3. Create API routes:
    - `GET /api/slack/bindings` — list bindings for org
    - `POST /api/slack/bindings` — create/update binding
    - `DELETE /api/slack/bindings?id=xxx` — remove binding
    - `GET /api/slack/bindings/[channelId]` — get binding for channel
4. Create `lookupChannelBinding(teamId, channelId)` utility
5. Run `bun run db:generate` and `bun run db:push`

### Phase 2: Event Handler Integration — Channel Routing

**Files to modify:**

| File                                           | Action                                |
| ---------------------------------------------- | ------------------------------------- |
| `apps/agent/src/app/api/slack/events/route.ts` | Add binding lookup to processMessage  |
| `apps/agent/src/lib/slack-bindings.ts`         | Add caching layer for binding lookups |

**Tasks:**

1. In `processMessage()`, add binding lookup before agent resolution
2. If binding exists, use binding's agent slug instead of default
3. Pass binding context data through requestContext metadata
4. Support `triggerOnAllMessages` — skip @mention check if enabled
5. Support `triggerKeywords` — check message text for keyword matches
6. Support `triggerOnFileUpload` — detect file_share events
7. Apply binding's `replyMode` (thread/channel/ephemeral)
8. Apply binding's `allowedUserIds` / `blockedUserIds` access control
9. Cache bindings in-memory with TTL (avoid DB hit on every message)

### Phase 3: Agent Resolver — Context Injection

**Files to modify:**

| File                                     | Action                            |
| ---------------------------------------- | --------------------------------- |
| `packages/agentc2/src/agents/resolver.ts` | Add binding context interpolation |

**Tasks:**

1. Extend `enrichContextWithSlackChannels()` to also enrich with binding context
2. Add `{{binding.*}}` pattern support to `interpolateInstructions()`
3. Support nested binding context: `{{binding.context.fieldName}}`
4. When binding has `instructionOverrides`, append to resolved instructions
5. When binding has `temperatureOverride` or `maxStepsOverride`, apply to agent config

### Phase 4: Memory Isolation

**Files to modify:**

| File                                           | Action                       |
| ---------------------------------------------- | ---------------------------- |
| `apps/agent/src/app/api/slack/events/route.ts` | Use binding memory namespace |
| `packages/agentc2/src/agents/resolver.ts`       | Support namespace override   |

**Tasks:**

1. When binding exists, use `binding.memoryNamespace` (default: `slack-{teamId}-{channelId}`) as the memory resource ID
2. Thread-level memory scopes _within_ the channel: `slack-{teamId}-{channelId}-{threadTs}` (existing behavior, preserved)
3. Channel-level memory (cross-thread): Use `slack-{teamId}-{channelId}` as a shared namespace that all threads can access
4. This means threads within a deal channel share awareness of the deal's full conversation history

### Phase 5: Context Data Sources — CRM Integration

**Files to create:**

| File                                          | Action                        |
| --------------------------------------------- | ----------------------------- |
| `apps/agent/src/lib/slack-binding-context.ts` | Context data fetching/caching |

**Tasks:**

1. Create `refreshBindingContext(binding)` function that:
    - If `contextType === "deal"`: Fetch deal data from HubSpot via MCP tools
    - If `contextType === "customer"`: Fetch customer/company data
    - If `contextType === "project"`: Fetch project data from Jira
    - Stores result in `binding.contextData` as cached JSON
    - Updates `binding.contextRefreshAt` for staleness tracking
2. Create `ensureContextFresh(binding, maxAge)` function that refreshes if stale
3. Add Inngest event `slack/binding-context.refresh` for background refresh
4. Auto-refresh on first message if context is stale (> 1 hour)

### Phase 6: RAG Scoping per Binding

**Files to modify:**

| File                                          | Action                     |
| --------------------------------------------- | -------------------------- |
| `packages/agentc2/src/agents/resolver.ts`      | Pass RAG scope filter      |
| `apps/agent/src/lib/slack-binding-context.ts` | Document ingestion scoping |

**Tasks:**

1. When binding has `ragCollectionId`, filter RAG queries to that collection
2. Documents uploaded to a deal channel get auto-ingested into the binding's RAG collection
3. When a new binding is created, optionally auto-create a RAG collection for it
4. Agent's RAG tool receives a filter: `{ collectionId: binding.ragCollectionId }`

### Phase 7: UI — Expanded Slack Configuration Page

**Files to modify:**

| File                                                | Action               |
| --------------------------------------------------- | -------------------- |
| `apps/agent/src/app/settings/organization/page.tsx` | Expand Slack section |

**New UI sections (added to org settings):**

#### 7a. Channel Bindings Manager

A table/list showing all channel-agent bindings:

```
Channel             Agent            Context          Status
#deal-acme-corp     Deal Manager     Deal: Acme Corp  Active
#deal-globex        Deal Manager     Deal: Globex     Active
#support-general    Support Agent    —                Active
#engineering        Engineering AI   —                Active
```

With actions: Edit, Unbind, Refresh Context

#### 7b. New Binding Dialog

Form to create a new binding:

- Select Slack channel (dropdown of available channels)
- Select Agent (dropdown of org agents)
- Context type: Deal / Customer / Project / None
- Context ID: Search/select from CRM
- Reply mode: Thread / In-channel / Ephemeral
- Trigger mode: @mention only / All messages / Keywords
- Access control: All users / Specific users

#### 7c. Channel Preferences (Enhanced)

Keep existing 4 purpose keys, but expand to be user-configurable:

- Add custom purpose keys (e.g., "engineering", "onboarding", "billing")
- Remove purpose keys that aren't needed
- Per purpose key: select channel + optional agent override

#### 7d. Global Slack Behavior Settings

| Setting                  | Options                                   |
| ------------------------ | ----------------------------------------- |
| Default reply mode       | Thread / In-channel / Ephemeral           |
| Default typing indicator | Reaction (:eyes:) / Typing message / None |
| Rich formatting          | Enabled / Disabled                        |
| Response length          | Concise / Standard / Detailed             |
| DM support               | Enabled / Disabled                        |
| DM agent                 | (dropdown)                                |
| DM welcome message       | (text field)                              |
| Auto-thread replies      | Yes / No                                  |
| Feedback reactions       | Enabled / Disabled                        |
| Feedback acknowledge     | Yes / No                                  |

#### 7e. Rate Limiting

| Setting                      | Default | Description            |
| ---------------------------- | ------- | ---------------------- |
| Messages per user per minute | 10      | Per-user rate limit    |
| Invocations per org per hour | 100     | Org-wide hourly limit  |
| Max message length           | 4000    | Truncate long messages |
| Cooldown on rate limit       | 60s     | Cooldown message shown |

#### 7f. Escalation Rules

| Setting             | Options                                                |
| ------------------- | ------------------------------------------------------ |
| Escalation channel  | (dropdown)                                             |
| Escalation triggers | Low confidence / Tool failure / User request / Keyword |
| Escalation users    | (multi-select users)                                   |
| SLA timer           | None / 5min / 15min / 30min / 1hr                      |
| SLA breach action   | Notify channel / Tag users / Create ticket             |

#### 7g. Notification Digests

| Setting        | Options                                       |
| -------------- | --------------------------------------------- |
| Daily digest   | Enabled / Disabled                            |
| Digest channel | (dropdown)                                    |
| Digest time    | (time picker, default 9:00 AM)                |
| Digest content | Message count / Feedback summary / Top topics |
| Weekly summary | Enabled / Disabled                            |

### Phase 8: Auto-Provisioning from CRM

**Files to create:**

| File                                              | Action                          |
| ------------------------------------------------- | ------------------------------- |
| `apps/agent/src/lib/inngest-functions.ts`         | Add auto-provisioning functions |
| `apps/agent/src/app/api/slack/provision/route.ts` | Manual provisioning endpoint    |

**Tasks:**

1. Inngest function: `slack/channel.provision`
    - Input: `{ dealId, agentSlug, organizationId }`
    - Creates Slack channel (via Slack API `conversations.create`)
    - Names it based on deal/customer: `#deal-{company-name-slug}`
    - Creates `SlackChannelBinding` linking channel → agent → deal
    - Sets channel topic with deal summary
    - Invites relevant team members (from deal contacts/owners)
    - Posts welcome message from the agent
2. Trigger on CRM events:
    - HubSpot deal created → auto-provision channel
    - Deal stage changed → update binding context, notify channel
    - Deal closed → archive channel, deactivate binding
3. Manual provision via UI button: "Create Deal Channel"

### Phase 9: Advanced Trigger Rules

**Files to modify:**

| File                                           | Action                 |
| ---------------------------------------------- | ---------------------- |
| `apps/agent/src/app/api/slack/events/route.ts` | Add trigger evaluation |

**Tasks:**

1. **Keyword triggers**: Check message text against `binding.triggerKeywords`
2. **File upload triggers**: Detect `file_share` subtype, trigger agent
3. **Emoji triggers**: New event type — react with `:robot_face:` to trigger agent on any message
4. **Scheduled triggers**: Agent proactively posts to bound channels (via Inngest cron)
    - Daily deal status update
    - Weekly summary of channel activity
    - Reminders for stale deals
5. **New member triggers**: When someone joins a bound channel, agent sends personalized welcome

### Phase 10: Analytics & Reporting

**Files to create:**

| File                                              | Action        |
| ------------------------------------------------- | ------------- |
| `apps/agent/src/app/api/slack/analytics/route.ts` | Analytics API |

**Tasks:**

1. Per-channel metrics:
    - Message volume (in/out)
    - Average response time
    - Feedback score (thumbsup vs thumbsdown ratio)
    - Most used tools
2. Per-binding metrics:
    - Context freshness (last refresh)
    - Memory size
    - RAG document count
3. Aggregate Slack metrics:
    - Total Slack interactions this week/month
    - Most active channels
    - Agent utilization across channels
4. Configurable reports channel:
    - Post weekly analytics to a designated channel

### Phase 11: Security & Compliance

**Tasks:**

1. **Channel allowlist/blocklist**: Org-level setting for which channels the bot can operate in
2. **Audit logging**: Every Slack interaction logged to `AgentRun` with channel context
3. **Data retention**: Auto-purge memory for inactive bindings after configurable period
4. **PII warning**: If agent response contains PII patterns, flag for review
5. **Content policy per binding**: Custom guardrail rules per channel

---

## Testing Plan

### Unit Tests

| Test                              | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| `SlackChannelBinding CRUD`        | Create, read, update, delete bindings via API           |
| `lookupChannelBinding()`          | Verify lookup by channelId + teamId, caching behavior   |
| `processMessage with binding`     | Verify binding context injected, correct agent resolved |
| `interpolateInstructions binding` | Verify `{{binding.*}}` patterns resolve correctly       |
| `triggerOnAllMessages`            | Verify no @mention needed when enabled                  |
| `triggerKeywords`                 | Verify keyword matching triggers response               |
| `allowedUserIds`                  | Verify access control enforcement                       |
| `replyMode`                       | Verify thread vs channel vs ephemeral responses         |
| `memoryNamespace`                 | Verify channel-scoped memory isolation                  |

### Integration Tests

| Test                           | Description                                                             |
| ------------------------------ | ----------------------------------------------------------------------- |
| `End-to-end binding creation`  | Create binding via API, send message in channel, verify agent + context |
| `Context refresh`              | Create binding with deal context, verify it refreshes from CRM          |
| `RAG scoping`                  | Upload doc in bound channel, verify only that channel's RAG returns it  |
| `Multiple bindings same agent` | Two channels, same agent template, verify isolation                     |
| `Escalation flow`              | Trigger escalation, verify message posted to escalation channel         |
| `Auto-provision`               | Trigger deal creation, verify channel + binding created                 |

### E2E Tests (Browser + Slack)

| Test                           | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `Settings UI binding CRUD`     | Create, edit, delete bindings from settings page  |
| `Channel preferences expanded` | Add custom purpose keys, save, verify             |
| `Global behavior settings`     | Change reply mode, verify reflected in Slack      |
| `Rate limiting`                | Send burst of messages, verify rate limit applied |
| `Digest configuration`         | Enable daily digest, verify scheduled             |

### Build Verification

```bash
bun run type-check    # Must pass
bun run lint          # Must pass
bun run format        # Must pass
bun run build         # Must pass
```

---

## Phased Delivery

| Phase        | Description                | Effort      | Dependencies |
| ------------ | -------------------------- | ----------- | ------------ |
| **Phase 1**  | DB model + API             | 1 session   | None         |
| **Phase 2**  | Event handler integration  | 1 session   | Phase 1      |
| **Phase 3**  | Resolver context injection | 1 session   | Phase 1      |
| **Phase 4**  | Memory isolation           | 0.5 session | Phase 2      |
| **Phase 5**  | CRM context sources        | 1 session   | Phase 3      |
| **Phase 6**  | RAG scoping                | 1 session   | Phase 3      |
| **Phase 7**  | UI expansion               | 2 sessions  | Phases 1-3   |
| **Phase 8**  | Auto-provisioning          | 1 session   | Phases 1-5   |
| **Phase 9**  | Advanced triggers          | 1 session   | Phase 2      |
| **Phase 10** | Analytics                  | 1 session   | Phase 2      |
| **Phase 11** | Security & compliance      | 0.5 session | Phases 1-2   |
| **Testing**  | Full test suite            | 1 session   | All          |

**Total estimated: ~12 sessions**

---

## Why This Is a Moat

1. **No competitor does channel-scoped agent instances.** Everyone has "chatbot in Slack." Nobody has "every channel is a specialized agent workspace."

2. **Network effects**: The more deals/customers a team manages through channel-bound agents, the more the agent learns from accumulated context. Switching costs skyrocket.

3. **Template architecture scales infinitely**: One "Deal Manager" agent template serves 500 deals. One "Support Agent" template serves every customer channel. Ops overhead stays flat.

4. **CRM integration locks in**: Auto-provisioning from HubSpot means the agent is embedded in the sales process itself. It's not a tool you use — it's how you work.

5. **Configuration depth creates stickiness**: Once a team has configured channel bindings, trigger rules, escalation paths, and RAG scopes — they're not switching platforms.

6. **It's the Slack OS for AI agents**: This positions AgentC2 not as "an AI chatbot" but as "the intelligence layer for Slack" — a fundamentally different category.

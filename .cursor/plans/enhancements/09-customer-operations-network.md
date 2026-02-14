# 09 -- Customer Operations Network

**Priority:** TIER 4 (Orchestration)
**Effort:** Medium (3-4 hours)
**Dependencies:** Plan 05 (Calendar Assistant agent)

## Problem Statement

25 agents exist but none talk to each other through networks. The Customer Operations Network is the first multi-agent orchestration, routing messages to the right specialist agent based on intent.

## Network Design

**Name:** `Customer Operations`
**Slug:** `customer-operations`
**Router Model:** `anthropic/claude-sonnet-4-20250514` (needs strong routing judgment)

### Primitives (Agents)

| Primitive           | Type  | Agent Slug            | Description                                       |
| ------------------- | ----- | --------------------- | ------------------------------------------------- |
| Email Triage        | agent | `email-triage`        | Classify and process email-related queries        |
| Calendar Assistant  | agent | `calendar-assistant`  | Scheduling, availability, meeting management      |
| AI Assistant        | agent | `assistant`           | General questions, knowledge lookup, memory       |
| Workspace Concierge | agent | `workspace-concierge` | Platform operations, CRM updates, Jira management |

### Routing Logic

```
User message arrives
        │
        ▼
   ┌─────────┐
   │ Router  │  Classifies intent
   │ Agent   │
   └────┬────┘
        │
        ├── Email-related? ──────────► email-triage
        │   (forward, classify, reply)
        │
        ├── Calendar/scheduling? ────► calendar-assistant
        │   (free?, schedule, cancel)
        │
        ├── CRM/Jira/Platform? ──────► workspace-concierge
        │   (update deal, create ticket)
        │
        └── General/Other ──────────► assistant
            (questions, conversation)
```

## Network Configuration

```json
{
    "name": "Customer Operations",
    "slug": "customer-operations",
    "description": "Routes messages to the right specialist agent based on intent: email triage, calendar management, CRM/project operations, or general assistance.",
    "modelProvider": "anthropic",
    "modelName": "claude-sonnet-4-20250514",
    "temperature": 0.3,
    "maxSteps": 10,
    "instructions": "You are a routing agent for Customer Operations. Your job is to understand the user's intent and route their message to the most appropriate specialist agent.\n\nAVAILABLE AGENTS:\n\n1. **email-triage** -- Handles anything email-related: classifying emails, forwarding, archiving, searching emails, email summaries. Route here when the user mentions emails, inbox, or email senders.\n\n2. **calendar-assistant** -- Handles scheduling: checking availability, creating/updating/deleting events, meeting prep, schedule overviews. Route here when the user mentions meetings, calendar, scheduling, availability, or time slots.\n\n3. **workspace-concierge** -- Handles platform operations: CRM updates (HubSpot), project management (Jira), Slack operations, agent management, integration queries. Route here for business operations, CRM, tickets, or platform management.\n\n4. **assistant** -- Handles general questions, knowledge lookup, and conversation. Route here when the request doesn't fit other categories, or when the user is asking a general question.\n\nROUTING RULES:\n- Always route to the MOST SPECIFIC agent available\n- If a request spans multiple agents, route to the primary intent first\n- If unclear, ask the user to clarify rather than guessing\n- For compound requests (e.g., 'check my email and schedule a follow-up'), break into steps and route each to the appropriate agent",
    "memoryConfig": {
        "lastMessages": 20,
        "semanticRecall": {
            "topK": 3,
            "messageRange": 50
        },
        "workingMemory": {
            "enabled": true
        }
    },
    "primitives": [
        {
            "primitiveType": "agent",
            "agentId": "email-triage",
            "description": "Classifies and processes emails. Handles email search, classification, triage, and Slack notifications about email status."
        },
        {
            "primitiveType": "agent",
            "agentId": "calendar-assistant",
            "description": "Manages Google Calendar. Checks availability, creates/updates events, provides schedule overviews."
        },
        {
            "primitiveType": "agent",
            "agentId": "assistant",
            "description": "General-purpose AI assistant with memory. Handles knowledge questions, general conversation, and tasks that don't fit other specialists."
        },
        {
            "primitiveType": "agent",
            "agentId": "workspace-concierge",
            "description": "Full platform operations: HubSpot CRM, Jira project management, Slack messaging, agent/workflow management, and all MCP integrations."
        }
    ]
}
```

## Topology (Auto-Generated)

The network runtime auto-generates topology from primitives:

- Router node at center
- Agent nodes arranged around it
- Edges from router to each agent

## Example Interactions

**"Am I free tomorrow afternoon for a call with Ian?"**

- Router: Routes to `calendar-assistant`
- Calendar checks availability, responds

**"What emails came in from FirmBroker today?"**

- Router: Routes to `email-triage` (email search intent)
- Email-triage searches Gmail, summarizes

**"Create a Jira ticket for the CI/CD fix"**

- Router: Routes to `workspace-concierge`
- Concierge creates Jira ticket

**"Check my email, then schedule a follow-up with anyone who mentioned the Q1 budget"**

- Router: Routes to `email-triage` first, then `calendar-assistant`
- Multi-step compound request

## Implementation Steps

### Step 1: Ensure calendar-assistant exists (Plan 05)

The network depends on the Calendar Assistant agent being created first.

### Step 2: Create the network via MCP tool

Use `network_create` with the configuration above.

### Step 3: Test routing with sample messages

Execute the network with test messages for each routing path:

```
POST /api/networks/customer-operations/execute
{ "message": "Am I free Thursday?" }
```

### Step 4: Add Slack integration

The network can be made accessible via Slack as a top-level routing layer.

## Acceptance Criteria

- [ ] Network created and visible in platform UI
- [ ] Router correctly routes email queries to email-triage
- [ ] Router correctly routes calendar queries to calendar-assistant
- [ ] Router correctly routes CRM/Jira queries to workspace-concierge
- [ ] Router correctly routes general queries to assistant
- [ ] Memory persists across turns in the same thread
- [ ] Network can be executed via API and Slack

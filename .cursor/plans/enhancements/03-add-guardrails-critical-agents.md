# 03 -- Add Guardrails to Critical Agents

**Priority:** TIER 1 (Safety)
**Effort:** Low (1 hour)
**Dependencies:** None

## Problem Statement

The two highest-risk agents have NO guardrails:

- **email-triage** (270 runs, handles every inbound email, posts to Slack, reads Gmail)
- **workspace-concierge** (101 tools, can modify HubSpot CRM, Jira, Slack, create/delete agents)

Only `assistant` has a basic guardrail (blocked topics: "violence", maxTokensPerResponse: 2000).

## Current Guardrail System

The guardrail config schema (from `apps/agent/src/app/agents/[agentSlug]/guardrails/page.tsx`) supports:

```typescript
{
    input: {
        topicFiltering: { enabled, blockedTopics[] },
        piiDetection: { enabled, action: "block" | "mask" },
        jailbreakDetection: { enabled },
        promptInjection: { enabled },
        maxInputLength: number
    },
    output: {
        toxicityFilter: { enabled, threshold },
        hallucinationDetection: { enabled },
        piiLeakPrevention: { enabled },
        factualAccuracy: { enabled },
        brandSafety: { enabled, guidelines }
    },
    execution: {
        maxDuration: number,
        maxToolCalls: number,
        maxTokens: number,
        costPerRequest: number,
        rateLimiting: { enabled, requestsPerMinute }
    }
}
```

## Recommended Guardrail Configs

### email-triage

This agent processes real business emails and posts to Slack. Key risks: PII leakage, misclassification of sensitive emails, runaway costs.

```json
{
    "input": {
        "piiDetection": { "enabled": true, "action": "mask" },
        "maxInputLength": 50000
    },
    "output": {
        "toxicityFilter": { "enabled": true, "threshold": 0.7 },
        "piiLeakPrevention": { "enabled": true }
    },
    "execution": {
        "maxDuration": 120000,
        "maxToolCalls": 15,
        "maxTokens": 4000,
        "costPerRequest": 0.5,
        "rateLimiting": { "enabled": true, "requestsPerMinute": 10 }
    }
}
```

**Rationale:**

- PII masking (not blocking) so emails still get triaged but sensitive data isn't echoed
- PII leak prevention on output to avoid posting SSNs/credit cards to Slack
- Toxicity filter to catch if hostile email content leaks into the triage output
- Rate limiting at 10/min to prevent runaway email processing loops
- Cost cap at $0.50/request to catch anomalous expensive runs
- Max 15 tool calls (typical triage uses 3-5 tools)

### workspace-concierge

This agent has 101 tools and can modify CRM data, create Jira tickets, post to Slack, and manage agents. Key risks: destructive operations, data modification, cost explosion.

```json
{
    "input": {
        "piiDetection": { "enabled": true, "action": "mask" },
        "promptInjection": { "enabled": true },
        "jailbreakDetection": { "enabled": true },
        "maxInputLength": 20000
    },
    "output": {
        "toxicityFilter": { "enabled": true, "threshold": 0.5 },
        "piiLeakPrevention": { "enabled": true }
    },
    "execution": {
        "maxDuration": 180000,
        "maxToolCalls": 25,
        "maxTokens": 8000,
        "costPerRequest": 1.0,
        "rateLimiting": { "enabled": true, "requestsPerMinute": 5 }
    }
}
```

**Rationale:**

- Prompt injection + jailbreak detection because this agent has destructive capabilities
- Lower toxicity threshold (0.5) since this agent faces more diverse inputs
- Higher cost cap ($1.00) since concierge runs are naturally more expensive (multi-tool)
- Max 25 tool calls to prevent infinite tool loops
- Rate limiting at 5/min since this agent is used interactively, not in batch

### assistant (update existing)

Upgrade the existing minimal guardrail:

```json
{
    "input": {
        "piiDetection": { "enabled": true, "action": "mask" },
        "maxInputLength": 20000
    },
    "output": {
        "toxicityFilter": { "enabled": true, "threshold": 0.7 },
        "piiLeakPrevention": { "enabled": true }
    },
    "execution": {
        "maxDuration": 60000,
        "maxToolCalls": 10,
        "maxTokens": 4000,
        "costPerRequest": 0.25,
        "rateLimiting": { "enabled": true, "requestsPerMinute": 20 }
    }
}
```

## Implementation

Use the `agent_guardrails_update` MCP tool or the API endpoint:

```
PUT /api/agents/{agentId}/guardrails
Content-Type: application/json

{ "configJson": { ... } }
```

This is a data operation, not a code change. Can be applied via the platform API or MCP tools.

## Acceptance Criteria

- [ ] email-triage has guardrail config with PII masking, rate limiting, and cost cap
- [ ] workspace-concierge has guardrail config with injection detection and tool call limits
- [ ] assistant guardrail updated with execution limits
- [ ] Guardrail configs visible in the UI at `/agents/{slug}/guardrails`

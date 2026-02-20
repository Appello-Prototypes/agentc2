# Agent Operations Platform - Vision and Product Narrative

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Status:** Strategic Vision

---

## Executive Summary

We are building the **agent operations layer**: a platform where agents can be deployed in seconds, run 24/7, connect to any MCP tool, and be invoked like APIs with full observability and governance.

---

## 1. Vision

We are building the infrastructure layer for the next generation of software: **always-on agents** that can connect to any tool, execute work reliably, and be composed like APIs.

### Core Insight

- **MCP is becoming the universal protocol for tool access.** The Model Context Protocol standardizes how agents interact with external systems.
- **Agents are becoming the new unit of automation.** They replace brittle scripts and manual workflows with intelligent, adaptive execution.
- **The missing layer is not intelligence — it is deployment, governance, and operations.** Most agent frameworks stop at "it works in a notebook." Real businesses need reliability, permissions, audit trails, monitoring, scheduling, replayability, and organizational control.

We are building the platform where agents can be created, deployed, monitored, and invoked instantly.

---

## 2. The Platform: Agents as Infrastructure

### 2.1 Agents Can Call MCP Tools (Outbound)

Each agent can connect outward to MCP servers, meaning it can interact with:

- CRMs (HubSpot, Salesforce)
- Email (Gmail, Outlook)
- Databases (PostgreSQL, Supabase)
- Ticketing systems (Jira, Linear)
- Internal services (custom APIs)
- Enterprise systems (SAP, Oracle)

**MCP becomes the standard connector layer.** The platform handles:

- Auth delegation
- Scoped permissions
- Tool-call logging
- Redaction policies

### 2.2 Agents Are Also MCP Tools (Inbound)

Every deployed agent is itself exposed as an MCP tool. That means:

- **Agents can be invoked externally like APIs** — any MCP client can call them
- **Agents can call other agents** — enabling hierarchical orchestration
- **Workflows become composable** — complex processes built from agent primitives
- **Agent networks scale cleanly** — no custom integration per agent

**Agents are no longer chatbots — they are callable services.**

---

## 3. The Core Product Promise

> **Deploy an always-on agent in under 30 seconds.**

A user should be able to:

1. **Create an agent** — define name, instructions, and model
2. **Connect MCP integrations** — attach tools from the registry
3. **Define triggers or schedules** — cron, webhook, or event-driven
4. **Deploy instantly** — into a hosted runtime with zero infrastructure
5. **Monitor everything** — through an observability dashboard

---

## 4. Why This Matters

Most agent frameworks today stop at "it works in a notebook."

Real businesses need:

| Capability                 | Why It Matters                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| **Reliability**            | Agents must handle failures gracefully with retries and fallbacks |
| **Permissions**            | Different users and teams need scoped access                      |
| **Audit trails**           | Every action must be traceable for compliance                     |
| **Monitoring**             | Real-time visibility into what agents are doing                   |
| **Scheduling**             | Agents need to run on cron, not just on-demand                    |
| **Replayability**          | Debug failures by replaying exact inputs                          |
| **Organizational control** | Budgets, guardrails, and approval workflows                       |

This platform is the missing **"agent operations layer."**

---

## 5. What We Become

If executed correctly, we become:

> **The place where agents are built, deployed, and operated — like Vercel, but for agents.**

---

## 6. Platform Architecture

The platform has three primary layers plus supporting systems:

```
┌─────────────────────────────────────────────────────────────────┐
│                         INBOUND MCP GATEWAY                      │
│              (Agents exposed as callable MCP tools)              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AGENT RUNTIME                            │
│        (Execution engine: sync, async, scheduled)                │
└─────────────────────────────────────────────────────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐   ┌───────────────────┐   ┌─────────────────────┐
│ AGENT REGISTRY│   │ OUTBOUND MCP      │   │ SCHEDULER + EVENTS  │
│ (Definition + │   │ GATEWAY           │   │ (Cron, webhooks,    │
│  Versioning)  │   │ (Tool connections)│   │  event triggers)    │
└───────────────┘   └───────────────────┘   └─────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY + GOVERNANCE                     │
│    (Run traces, tool calls, costs, audits, alerts, guardrails)   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT ORG MODEL                        │
│           (Users, Organizations, Workspaces, Credentials)        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1 Layer 1: Agent Registry (Definition + Versioning)

Agents are stored as deployable artifacts with full version control:

```json
{
    "agent_id": "agt_123",
    "name": "Timesheet Approval Agent",
    "description": "Reviews submitted timesheets and flags exceptions.",
    "model": "gpt-4.1",
    "instructions": "...system prompt...",
    "tools": ["mcp:slack", "mcp:quickbooks"],
    "policies": {
        "requires_approval": true,
        "max_spend_usd": 0
    },
    "version": "1.0.3",
    "created_by": "user_456",
    "org_id": "org_789"
}
```

**Registry Responsibilities:**

- Create/edit agents
- Version control with rollback
- Environment separation (dev/stage/prod)
- Publish agent as callable runtime unit

### 6.2 Layer 2: Agent Runtime (Execution Engine)

Agents run as hosted services, not chat sessions.

| Execution Mode      | Description                    |
| ------------------- | ------------------------------ |
| **Sync Invocation** | Immediate request/response     |
| **Async Job**       | Background execution via queue |
| **Triggered Run**   | Event-based invocation         |
| **Scheduled Run**   | Cron-based recurring execution |

**Runtime Requirements:**

- Stateless execution containers
- Tool-call sandboxing
- Retries + idempotency
- Timeouts + limits
- Structured outputs

### 6.3 Layer 3: MCP Tool Gateway

**Outbound:** Agents connect to external MCP servers with:

- Auth delegation
- Scoped permissions
- Tool-call logging
- Redaction policies

**Inbound:** Each agent is automatically published as an MCP tool:

```
tool_name: agent.timesheet_approval
invoke_url: mcp://platform.ai/agents/agt_123
```

### 6.4 Scheduler + Event System

**Cron Triggers:**

```json
{
    "agent_id": "agt_123",
    "schedule": "0 17 * * FRI",
    "action": "Run payroll audit"
}
```

**Event Triggers:**

- Webhooks
- MCP tool events
- Internal platform events
- Message bus (future)

### 6.5 Observability + Governance

Each execution generates:

- Input snapshot
- Tool calls
- Outputs
- Errors
- Latency
- Cost estimate

**Dashboard Capabilities:**

- Run history
- Failure monitoring
- Tool usage
- Audit logs
- Approval queues

### 6.6 Multi-Tenant + Org Model

| Entity               | Description                          |
| -------------------- | ------------------------------------ |
| **User**             | Individual account                   |
| **Organization**     | Company or team boundary             |
| **Workspace**        | Environment within an org (dev/prod) |
| **Agent**            | Belongs to workspace                 |
| **Run**              | Execution instance                   |
| **Tool Credentials** | Scoped per org                       |

**Rules:**

- Agents belong to org/workspace
- Tool access is scoped per org
- Users can only invoke agents within their org boundary

---

## 7. MVP Phases (90-Day Execution)

### Phase 1: Core Runtime (Weeks 1-3)

- Agent registry CRUD
- Sync invocation with Run Recorder
- Basic MCP outbound calls
- Full observability for all runs

### Phase 2: Agent-as-MCP Tool (Weeks 4-6)

- Publish agent endpoints as MCP tools
- Agent-to-agent calling support
- Tool registry with scoped credentials

### Phase 3: Scheduler + Async Jobs (Weeks 7-9)

- Job queue via Inngest
- Cron triggers
- Event/webhook triggers
- Background execution status UI

### Phase 4: Observability v1 (Weeks 10-12)

- Run traces dashboard
- Tool-call logging
- Cost analytics
- Audit logs
- Guardrail event history

---

## 8. Mapping to Current Implementation

This vision maps to the existing AgentC2 AI Agent Framework:

| Vision Component | Current Implementation                                       |
| ---------------- | ------------------------------------------------------------ |
| Agent Registry   | `Agent`, `AgentVersion`, `AgentTool` models in Prisma        |
| Agent Runtime    | `agentResolver`, `run-recorder.ts`, chat/test/runs endpoints |
| MCP Outbound     | `@mastra/mcp`, tool registry in `@repo/agentc2`               |
| MCP Inbound      | **NEW** - agent-as-tool gateway                              |
| Scheduler        | Inngest cron + event functions                               |
| Observability    | `AgentRun`, `AgentTrace`, `AgentToolCall`, evaluations       |
| Multi-tenancy    | `tenantId` on all models, **org/workspace models needed**    |

---

## 9. Positioning Statement

> We are building the **agent operations layer**: a platform where agents can be deployed in seconds, run 24/7, connect to any MCP tool, and be invoked like APIs with full observability and governance.

---

## Related Documentation

- [System Specification](./SYSTEM-SPECIFICATION.md) - Technical implementation details
- [Agent Workspace Plan](../agentworkspaceplan.md) - Workspace UI and API specification
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and procedures

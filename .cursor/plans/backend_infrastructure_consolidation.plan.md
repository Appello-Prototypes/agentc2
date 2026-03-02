---
name: Backend Infrastructure Consolidation
overview: "Consolidated backend plan extracting ALL infrastructure, schema, API, and data-layer work from four surface plans (God Mode Redesign, Unified Orchestration, Command Dashboard, Unified Observability). Phases ordered by dependency: schema first, broken dispatch chain second, then API expansions and data enrichment. Completing this plan gives every frontend surface the backend it needs."
todos:
    - id: phase-1-schema
      content: "Phase 1: Batched schema migration -- WORKFLOW_* ActivityEventType, workflowRunId on ActivityEvent, triggerId on WorkflowRun+NetworkRun, agentRunId on NetworkRunStep"
      status: pending
    - id: phase-2-dispatch
      content: "Phase 2: Fix broken dispatch chain -- network webhook handler, networkTriggerFireFunction, event API for all entity types"
      status: pending
    - id: phase-3-network-crud
      content: "Phase 3: Network execution-triggers CRUD API routes (GET/POST/PATCH/DELETE/test/execute)"
      status: pending
    - id: phase-4-workflow-events
      content: "Phase 4: Emit WORKFLOW_* ActivityEvents from Inngest workflow execution handler"
      status: pending
    - id: phase-5-observe-apis
      content: "Phase 5: Unified Observe APIs -- /api/live/runs, /metrics, /filters, /triggers with kind param + run detail API extensions"
      status: pending
    - id: phase-6-automations-api
      content: "Phase 6: Unified Automations API -- campaigns, pulse, correct stats per entity type, primitiveType, cost aggregation, summary"
      status: pending
    - id: phase-7-command-backend
      content: "Phase 7: Command governance backend -- reviews API unification, campaign/mission approval bridge, integration/financial resolution, unified metrics"
      status: pending
    - id: phase-8-command-enrichment
      content: "Phase 8: Command data enrichment -- riskLevel, filesChanged, template resolution fix, pipeline progress context"
      status: pending
    - id: phase-9-subrun-recording
      content: "Phase 9: Sub-run recording -- workflow agent sub-runs (hooks + runtime), network agent sub-runs (shared stream helper + hooks)"
      status: pending
    - id: phase-10-advanced-apis
      content: "Phase 10: Advanced APIs -- activity grouped param, campaign-chain API, cost projection, diff API"
      status: pending
    - id: phase-11-health-policy
      content: "Phase 11: Health policy infrastructure -- schema additions, evaluateHealthPolicy(), hook into scheduled run completion"
      status: pending
    - id: phase-12-shared-severity
      content: "Phase 12: Shared severity utility -- extract 4-band severity system to packages/ui for cross-surface consistency"
      status: pending
isProject: false
---

# Backend Infrastructure Consolidation

All backend work required by the four surface plans, extracted and ordered by dependency.

## Source Plans

| Plan                  | Surface                    | File                                             |
| --------------------- | -------------------------- | ------------------------------------------------ |
| God Mode Redesign     | `/godmode` (under Observe) | `god_mode_redesign_aed50e33.plan.md`             |
| Unified Orchestration | `/schedule` (Coordinate)   | `unified_orchestration_upgrade_0cd862e6.plan.md` |
| Command Dashboard     | `/command`                 | `command_dashboard_ux_overhaul_c62488af.plan.md` |
| Unified Observability | `/observe`                 | `unified-observability.md`                       |

## Dependency Graph

```
Phase 1 (Schema) ──────┬──> Phase 4 (Workflow Events)
                        ├──> Phase 5 (Observe APIs)
                        ├──> Phase 6 (Automations API)
                        └──> Phase 9 (Sub-Run Recording)

Phase 2 (Dispatch Fix) ──> Phase 3 (Network CRUD)
                        └──> Phase 6 (Automations API)

Phase 7 (Command Backend) ──> Phase 8 (Command Enrichment)
                                       [independent of 2-6]

Phase 5 + 6 ──> Phase 10 (Advanced APIs)
Phase 6 ──> Phase 11 (Health Policy)
Phase 1 ──> Phase 12 (Shared Severity) [can run anytime after Phase 1]
```

---

## Phase 1: Batched Schema Migration

**Source:** God Mode 1a, Orchestration 1.4, Observability 4.1

All schema changes batched into a single `db:push` to avoid multiple migration cycles.

**File:** `packages/database/prisma/schema.prisma`

### 1.1 Add workflow ActivityEvent types

Add to `ActivityEventType` enum:

```prisma
WORKFLOW_STARTED
WORKFLOW_COMPLETED
WORKFLOW_FAILED
WORKFLOW_SUSPENDED
```

### 1.2 Add workflowRunId to ActivityEvent

```prisma
model ActivityEvent {
    // ... existing fields
    workflowRunId String?
    // Alongside existing: runId, networkRunId, campaignId
}
```

### 1.3 Add triggerId to WorkflowRun and NetworkRun

Check if these already exist. If not, add:

```prisma
model WorkflowRun {
    // ... existing fields
    triggerId String?
}

model NetworkRun {
    // ... existing fields
    triggerId String?
}
```

These enable correct stats per trigger on the Schedule page (currently workflow triggers show 0 runs because stats query `AgentRun` only).

### 1.4 Add agentRunId to NetworkRunStep

```prisma
model NetworkRunStep {
    // ... existing fields
    agentRunId String?
    agentRun   AgentRun? @relation(fields: [agentRunId], references: [id], onDelete: SetNull)
}
```

### 1.5 Add "workflow" and "network" to RunSource

**File:** `apps/agent/src/lib/run-recorder.ts` (~line 39)

```typescript
// Before:
type RunSource = "api" | "chat" | "slack" | "trigger" | "schedule" | "voice" | "mcp" | "demo";

// After:
type RunSource =
    | "api"
    | "chat"
    | "slack"
    | "trigger"
    | "schedule"
    | "voice"
    | "mcp"
    | "demo"
    | "workflow"
    | "network";
```

### 1.6 Push and generate

```bash
bun run db:generate
bun run db:push
```

### Verify

```bash
bun run type-check
```

**Files changed:** 2 (`schema.prisma`, `run-recorder.ts`)

---

## Phase 2: Fix Broken Dispatch Chain

**Source:** Orchestration 0.1, 0.2, 0.3

Three backend bugs prevent workflows and networks from being triggered correctly. These must be fixed before any API surface can show correct data for non-agent primitives.

### 2.1 Fix network dispatch in webhook handler

**File:** `apps/agent/src/app/api/webhooks/[path]/route.ts` (~line 224)

The if/else chain handles `workflow` and `agent` but rejects `network` with a 400 error.

Add the network branch:

```typescript
} else if (entityType === "network" && trigger.network) {
    await inngest.send({
        name: "network/trigger.fire",
        data: {
            triggerId: trigger.id,
            networkId: trigger.network.id,
            networkSlug: trigger.network.slug,
            payload: body,
            triggerEventId: triggerEvent.id,
        }
    });
}
```

### 2.2 Create networkTriggerFireFunction

**File:** `apps/agent/src/lib/inngest-functions.ts`

Create and register `networkTriggerFireFunction` to handle `network/trigger.fire` events:

```typescript
export const networkTriggerFireFunction = inngest.createFunction(
    { id: "network-trigger-fire", retries: 2 },
    { event: "network/trigger.fire" },
    async ({ event, step }) => {
        const { networkId, networkSlug, payload, triggerEventId, triggerId } = event.data;
        // 1. Resolve network
        // 2. Execute via Agent.network()
        // 3. Create NetworkRun with triggerId
        // 4. Update TriggerEvent with networkRunId
    }
);
```

Register in the Inngest function exports array.

### 2.3 Fix event API for all entity types

**File:** `apps/agent/src/app/api/triggers/event/route.ts`

Currently filters to `trigger.agent != null`, skipping workflow and network triggers entirely.

```typescript
// Before:
const triggers = await prisma.agentTrigger.findMany({
    where: { eventName, isActive: true, agent: { isNot: null } }
});

// After:
const triggers = await prisma.agentTrigger.findMany({
    where: { eventName, isActive: true },
    include: { agent: true, workflow: true, network: true }
});

for (const trigger of triggers) {
    if (trigger.entityType === "agent" && trigger.agent) {
        await inngest.send({ name: "agent/trigger.fire", data: { ... } });
    } else if (trigger.entityType === "workflow" && trigger.workflow) {
        await inngest.send({ name: "workflow/trigger.fire", data: { ... } });
    } else if (trigger.entityType === "network" && trigger.network) {
        await inngest.send({ name: "network/trigger.fire", data: { ... } });
    }
}
```

### Verify

```bash
bun run type-check && bun run lint
```

Manual: Create a network trigger via webhook. Verify it fires and creates a `NetworkRun`.

**Files changed:** 3 (`webhooks/[path]/route.ts`, `inngest-functions.ts`, `triggers/event/route.ts`)

---

## Phase 3: Network Execution-Triggers CRUD APIs

**Source:** Orchestration 0.4

Networks currently have no API for managing triggers. Mirror the pattern from workflow execution-triggers.

### 3.1 New route files

Create the following routes by mirroring the workflow execution-triggers pattern:

- `apps/agent/src/app/api/networks/[slug]/execution-triggers/route.ts` (GET list, POST create)
- `apps/agent/src/app/api/networks/[slug]/execution-triggers/[triggerId]/route.ts` (GET detail, PATCH update, DELETE)
- `apps/agent/src/app/api/networks/[slug]/execution-triggers/[triggerId]/test/route.ts` (POST test fire)
- `apps/agent/src/app/api/networks/[slug]/execution-triggers/[triggerId]/execute/route.ts` (POST manual execute)

All routes scope to the network via `network.slug` and set `entityType: "network"` on `AgentTrigger` records.

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

**Files changed:** 4 new route files

---

## Phase 4: Workflow Activity Event Emission

**Source:** God Mode 1b, 1c

Workflows are invisible in the God Mode activity feed because no `WORKFLOW_*` ActivityEvents are emitted.

### 4.1 Emit events from Inngest workflow handler

**File:** `apps/agent/src/lib/inngest-functions.ts`

In `asyncWorkflowExecuteFunction`, call `recordActivity()` at lifecycle points:

- **On workflow start**: `WORKFLOW_STARTED` with `workflowRunId`, workflow name/slug, input
- **On successful completion**: `WORKFLOW_COMPLETED` with duration, cost, tokens, output summary
- **On failure**: `WORKFLOW_FAILED` with error message
- **On suspend (human approval)**: `WORKFLOW_SUSPENDED` with suspended step info

Uses existing `recordActivity()` from `packages/agentc2/src/activity/service.ts`. Set `workflowRunId` on the ActivityEvent (field added in Phase 1.2).

### 4.2 Update God Mode constants

**File:** `apps/agent/src/app/godmode/page.tsx` (in `EVENT_TYPE_CONFIG`)

Add entries for the four new event types:

```typescript
WORKFLOW_STARTED: { label: "Workflow Started", color: "text-indigo-600", bgColor: "bg-indigo-50", icon: "workflow-circle" },
WORKFLOW_COMPLETED: { label: "Workflow Completed", color: "text-emerald-600", bgColor: "bg-emerald-50", icon: "checkmark-circle-02" },
WORKFLOW_FAILED: { label: "Workflow Failed", color: "text-red-600", bgColor: "bg-red-50", icon: "cancel-circle" },
WORKFLOW_SUSPENDED: { label: "Workflow Suspended", color: "text-amber-600", bgColor: "bg-amber-50", icon: "pause-circle" },
```

Add "Workflows" option to the type filter dropdown.

### Verify

```bash
bun run type-check && bun run lint
```

Manual: Execute a workflow, verify WORKFLOW_STARTED/COMPLETED events appear in God Mode feed.

**Files changed:** 2 (`inngest-functions.ts`, `page.tsx`)

---

## Phase 5: Unified Observe APIs

**Source:** Observability 1.1, 1.2, 1.3, 1.4, 1.5

Expand the `/api/live/*` endpoints so the Observe tab can show agents, workflows, and networks as first-class run types.

### 5.1 Extend `/api/live/runs`

**File:** `apps/agent/src/app/api/live/runs/route.ts`

- Add `kind` query param: `"all"` (default), `"agent"`, `"workflow"`, `"network"`
- When `kind=all` or `kind=workflow`: query `WorkflowRun` with org scoping
- When `kind=all` or `kind=network`: query `NetworkRun` with org scoping
- Map all three to `UnifiedRun` shape (see Observability plan 1.1 for full interface)
- Pagination: fetch `limit` from each table, merge by `startedAt desc`, take first `limit`
- Add `kind` to response counts: `{ total, byKind: { agent, workflow, network }, byStatus: { ... } }`
- Apply shared filters: `status`, `source`, `from/to`, `search`

### 5.2 Extend `/api/live/metrics`

**File:** `apps/agent/src/app/api/live/metrics/route.ts`

- Add `kind` query param support
- Aggregate counts, duration, tokens, cost across all three tables
- Per-kind breakdown: `{ agent: { total, completed, failed, running, avgDuration, totalCost }, workflow: { ... }, network: { ... } }`
- Include `suspended` status count for workflows

### 5.3 Extend `/api/live/filters`

**File:** `apps/agent/src/app/api/live/filters/route.ts`

- Add `workflows` array: `{ slug, name }[]` from org-scoped workflows
- Add `networks` array: `{ slug, name }[]` from org-scoped networks
- Add `kinds: ["agent", "workflow", "network"]` to response

### 5.4 Fix triggers tab API

**File:** `apps/agent/src/app/api/live/triggers/route.ts`

The `TriggerEvent` schema already has `workflowId`, `workflowRunId`, `networkId`, `networkRunId` fields, but the API hardcodes them as `null`.

- Add `workflow`, `workflowRun`, `network`, `networkRun` to Prisma `include`
- Remove hardcoded `null` overrides
- Map workflow/network data into the response

### 5.5 Extend run detail APIs with evaluation + feedback

**File:** `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/route.ts`

- Include `evaluation` (`WorkflowRunEvaluation`) and `feedback` (`WorkflowRunFeedback[]`) in Prisma query
- Return in response payload

**File:** `apps/agent/src/app/api/networks/[slug]/runs/[runId]/route.ts`

- Include `evaluation` (`NetworkRunEvaluation`) and `feedback` (`NetworkRunFeedback[]`) in Prisma query
- Return in response payload

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

Manual: Hit `/api/live/runs?kind=all` and verify unified response shape. Hit `/api/live/metrics?kind=workflow` and verify per-kind breakdown.

**Files changed:** 6 (`runs/route.ts`, `metrics/route.ts`, `filters/route.ts`, `triggers/route.ts`, `workflows/.../route.ts`, `networks/.../route.ts`)

---

## Phase 6: Unified Automations API

**Source:** Orchestration 1.1-1.7

Expand `/api/live/automations` so the Schedule page sees all five primitives with correct stats.

### 6.1 Add filter query params

**File:** `apps/agent/src/app/api/live/automations/route.ts`

Add: `primitiveType`, `entityId`, `entitySlug` query params.

When `primitiveType=agent&entitySlug=my-agent`, return only automations for that agent. This is how embedded per-primitive pages will fetch their data.

### 6.2 Add campaign schedules and triggers

Query `CampaignSchedule` and `CampaignTrigger`:

```typescript
const [schedules, triggers, campaignSchedules, campaignTriggers] = await Promise.all([
    prisma.agentSchedule.findMany({ ... }),
    prisma.agentTrigger.findMany({ ... }),
    prisma.campaignSchedule.findMany({
        where: { isActive: true },
        include: { template: { select: { id: true, slug: true, name: true } } },
        orderBy: { createdAt: "desc" }
    }),
    prisma.campaignTrigger.findMany({
        where: { isActive: true },
        include: { template: { select: { id: true, slug: true, name: true } } },
        orderBy: { createdAt: "desc" }
    }),
]);
```

Map to unified `Automation` shape with `primitiveType: "campaign"`, stats from `Campaign` model.

### 6.3 Add pulse evaluation cycles

Query active `Pulse` records, map `evalCronExpr` to `Automation` shape with `primitiveType: "pulse"`, stats from `PulseEvaluation` count.

### 6.4 Fix workflow/network trigger stats

Split stats queries by `entityType`:

- Agent triggers: stats from `AgentRun.groupBy({ by: ["triggerId"] })`
- Workflow triggers: stats from `WorkflowRun.groupBy({ by: ["triggerId"] })` (uses triggerId from Phase 1.3)
- Network triggers: stats from `NetworkRun.groupBy({ by: ["triggerId"] })` (uses triggerId from Phase 1.3)

### 6.5 Add primitiveType field

Every automation gets `primitiveType: "agent" | "workflow" | "network" | "campaign" | "pulse"`.

Agent schedules get `primitiveType: "agent"`. Agent triggers derive from `entityType`.

### 6.6 Add cost aggregation

```typescript
const costData = await prisma.agentRun.groupBy({
    by: ["triggerId"],
    where: { triggerId: { in: agentSourceIds } },
    _sum: { costUsd: true },
    _avg: { costUsd: true }
});
```

Similar for workflow/network runs using their respective `costUsd`/`totalCostUsd` fields.

### 6.7 Extend summary

```typescript
summary: {
    total, active, archived,
    byPrimitive: { agent, workflow, network, campaign, pulse },
    byType: { scheduled, triggered },
    overallSuccessRate,
    needsAttention  // count of unstable + failing
}
```

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

Manual: Schedule page shows campaign schedules and pulse eval cycles. Workflow trigger shows correct run count from WorkflowRun table.

**Files changed:** 1-2 (`automations/route.ts`, possibly types)

---

## Phase 7: Command Governance Backend

**Source:** Command 0.1, 0.2, 0.3, 0.4

This phase is independent of Phases 2-6 and can be executed in parallel if resources allow.

### 7.1 Extend reviews API to query all source types

**File:** `apps/agent/src/app/api/reviews/route.ts` (~line 30-50)

Remove hardcoded `sourceType: "workflow-review"` filter. Add `source` query param:

```typescript
const source = url.searchParams.get("source"); // "workflow" | "integration" | "financial" | "campaign" | "all"

const SOURCE_TYPE_MAP: Record<string, string> = {
    workflow: "workflow-review",
    integration: "integration",
    financial: "financial_action",
    campaign: "campaign"
};

const where: Prisma.ApprovalRequestWhereInput = {
    ...(source && source !== "all" ? { sourceType: SOURCE_TYPE_MAP[source] } : {}),
    ...(status !== "all" ? { status } : {})
};
```

Update Prisma include to join `agent`:

```typescript
include: {
    workflowRun: { select: { id: true, status: true, workflow: { select: { slug: true, name: true } } } },
    agent: { select: { id: true, slug: true, name: true, modelName: true } },
    organization: { select: { name: true, slug: true } }
}
```

Add `sourceType`, `agentSlug`, `agentName` to response mapping.

### 7.2 Bridge campaign/mission approvals into ApprovalRequest

**File:** `apps/agent/src/lib/campaign-functions.ts`

Currently campaign approvals use `Campaign.status = READY` and mission approvals use `Mission.status = AWAITING_APPROVAL`. These are invisible to Command.

**At campaign plan completion** (when `requireApproval` is true, ~line 448):

```typescript
await prisma.approvalRequest.create({
    data: {
        organizationId: campaign.tenantId || "system",
        sourceType: "campaign",
        sourceId: campaignId,
        status: "pending",
        requestedBy: "campaign-planner",
        reviewContext: {
            prompt: `Campaign "${campaign.name}" is ready for execution.`,
            summary: campaign.executionPlan?.summary || campaign.intent,
            campaignId,
            campaignName: campaign.name,
            missionCount: missions.length,
            estimatedCost: campaign.maxCostUsd,
            kind: "campaign"
        }
    }
});
```

**At mission sequence completion** (when `requiresApproval` is true, ~line 707):

```typescript
await prisma.approvalRequest.create({
    data: {
        organizationId: campaign.tenantId || "system",
        sourceType: "campaign",
        sourceId: `mission:${mission.id}`,
        status: "pending",
        requestedBy: "campaign-executor",
        reviewContext: {
            prompt: `Mission "${mission.name}" completed. Approve to proceed.`,
            summary: missionAar?.summary,
            campaignId,
            missionId: mission.id,
            missionName: mission.name,
            sequence: seq,
            kind: "mission"
        }
    }
});
```

### 7.3 Add source-type-aware resolution to POST handler

**File:** `apps/agent/src/app/api/reviews/route.ts` (POST handler)

Route approval resolution based on `sourceType`:

```typescript
switch (approval.sourceType) {
    case "workflow-review":
        return resolveEngagement({ approvalRequestId, decision, message, ... });
    case "integration":
        return resolveIntegrationApproval(approval, decision, message);
    case "financial_action":
        return resolveFinancialApproval(approval, decision, message);
    case "campaign": {
        const ctx = approval.reviewContext as { kind: string; campaignId?: string; missionId?: string; sequence?: number };
        if (ctx.kind === "campaign" && decision === "approved") {
            await inngest.send({ name: "campaign/execute", data: { campaignId: ctx.campaignId } });
        } else if (ctx.kind === "mission" && decision === "approved") {
            await inngest.send({ name: "mission/approved", data: { campaignId: ctx.campaignId, sequence: ctx.sequence } });
        }
        await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: decision, decidedAt: new Date() } });
        break;
    }
}
```

`resolveIntegrationApproval` mirrors logic from `handleSlackApprovalReaction` in `apps/agent/src/lib/approvals.ts`.

### 7.4 Unified governance metrics

**File:** `apps/agent/src/app/api/reviews/route.ts` (`getMetrics()`)

Remove `sourceType: "workflow-review"` filter from all metric queries. Add per-source breakdown:

```typescript
const bySource = await prisma.approvalRequest.groupBy({
    by: ["sourceType"],
    where: { status: "pending" },
    _count: { _all: true }
});

// Return:
metrics: {
    pendingCount,
    bySource: { workflow: N, integration: N, financial: N, campaign: N },
    avgWaitMinutes, approvalRate7d, decisionsToday,
    avgDecisionMinutes, resolved24h, queueTrend
}
```

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

Manual: Hit `/api/reviews?source=all` and verify all approval types appear. Create a campaign with `requireApproval=true`, verify `ApprovalRequest` record created.

**Files changed:** 2-3 (`reviews/route.ts`, `campaign-functions.ts`, possibly new `approval-resolvers.ts`)

---

## Phase 8: Command Data Enrichment

**Source:** Command 1.1, 1.2, 1.3

Fixes data gaps that make Command cards show "unknown" risk and literal template strings.

### 8.1 Populate riskLevel and filesChanged

**File:** `packages/agentc2/src/workflows/human-engagement.ts` (~line 67-118)

Add step handlers to `getEngagementContext()`:

```typescript
if (step.stepId === "classify-risk") {
    if (out.riskLevel) ctx.riskLevel = String(out.riskLevel);
}

if (step.stepId === "analyze-codebase" || step.stepId === "analyze") {
    if (Array.isArray(out.affectedFiles) && !ctx.filesChanged) {
        ctx.filesChanged = out.affectedFiles.map(String);
    }
}

if (step.stepId === "fix-audit" && out.severity && !ctx.riskLevel) {
    const map: Record<string, string> = {
        CRITICAL: "critical",
        HIGH: "high",
        MEDIUM: "medium",
        LOW: "low"
    };
    ctx.riskLevel = map[String(out.severity)] || "medium";
}
```

### 8.2 Fix template resolution for human step prompts

**File:** `packages/agentc2/src/workflows/builder/runtime.ts` (~line 715)

```typescript
// Before (broken -- renders literal {{ steps.classify-risk.riskLevel }}):
prompt: config.prompt || step.name || "Human approval required",

// After:
prompt: resolveTemplate(config.prompt || step.name || "Human approval required", context) as string,
```

### 8.3 Add pipeline progress to EngagementContext

**File:** `packages/agentc2/src/workflows/human-engagement.ts`

Extend interface:

```typescript
export interface EngagementContext {
    // ... existing fields
    stepsCompleted?: number;
    stepNames?: string[];
}
```

After the step iteration loop:

```typescript
const completed = stepOutputs.filter((s) => s.output !== undefined);
ctx.stepsCompleted = completed.length;
ctx.stepNames = completed.map((s) => s.stepId);
```

### Verify

```bash
bun run type-check && bun run lint
```

Manual: Trigger SDLC workflow, verify the human approval card shows populated `riskLevel`, `filesChanged`, and resolved prompt text.

**Files changed:** 2 (`human-engagement.ts`, `runtime.ts`)

---

## Phase 9: Sub-Run Recording

**Source:** Observability 3.1-3.5, 4.1-4.4

Agent calls within workflows and networks currently don't create `AgentRun` records -- they're invisible in Observe. This phase makes them visible.

### 9.1 Workflow agent sub-run recording

**9.1a Type changes**

**File:** `packages/agentc2/src/workflows/builder/types.ts`

- Add `agentRunId?: string` to `WorkflowExecutionStep`

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`

- Add `AgentStepHooks` interface and `agentStepHooks` to `ExecuteWorkflowOptions`

**9.1b Modify `executeAgentStep`**

**File:** `packages/agentc2/src/workflows/builder/runtime.ts` (~line 266)

- Accept `hooks` and `workflowMeta` parameters
- After `agentResolver.resolve()`, call `hooks.onStart()` to create the AgentRun
- After `agent.generate()` success: call `handle.addToolCall()` for each tool call, then `handle.complete()`
- On error: call `handle.fail(error)`
- Return `_agentRunId: handle?.runId` in output
- In step result construction: extract and set `stepResult.agentRunId`

**9.1c Wire hooks in Inngest**

**File:** `apps/agent/src/lib/inngest-functions.ts` (~line 8240)

Provide `agentStepHooks` to `executeWorkflowDefinition` in `asyncWorkflowExecuteFunction`:

```typescript
agentStepHooks: {
    onStart: async (info) => {
        const { startRun } = await import("@/lib/run-recorder");
        return await startRun({
            agentId: info.agentId,
            agentSlug: info.agentSlug,
            input: info.prompt,
            source: "workflow",
            tenantId: info.tenantId,
            metadata: {
                workflowRunId: info.workflowRunId,
                workflowSlug: info.workflowSlug,
                stepId: info.stepId
            }
        });
    };
}
```

**9.1d Populate agentRunId in WorkflowRunStep**

**File:** `apps/agent/src/lib/inngest-functions.ts` (~line 8282)

In the `save-steps` Inngest step, include `agentRunId: s.agentRunId || undefined` when mapping steps into `WorkflowRunStep` records.

### 9.2 Network agent sub-run recording

**9.2a Extract shared network stream processing**

The stream processing loop is duplicated across 4 files:

- `apps/agent/src/app/api/networks/[slug]/execute/route.ts`
- `apps/agent/src/app/api/networks/[slug]/execute/stream/route.ts`
- `apps/agent/src/app/api/networks/[slug]/execute/public/route.ts`
- `packages/agentc2/src/tools/network-tools.ts`

Extract into a shared helper at `apps/agent/src/lib/network-execution.ts` that:

- Processes the `Agent.network()` async iterable
- Captures steps, tokens, output
- Accepts optional hooks for agent sub-run recording
- Returns the processed result

**9.2b Hook into network execution**

In the shared stream processing helper:

- On agent start event: resolve agent, call `startRun({ source: "network", ... })`, store handle
- On agent end event: match handle, call `handle.complete()` with output and token data
- On error: call `handle.fail()`
- Include `agentRunId` when creating `NetworkRunStep` records

**9.2c Update all 4 callers to use shared helper**

Replace the duplicated stream processing in each file with a call to the shared helper.

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

Manual: Execute a workflow with agent steps, verify individual `AgentRun` records appear in Observe with `source: "workflow"`. Execute a network, verify `AgentRun` records appear with `source: "network"`.

**Files changed:** ~8 (`types.ts`, `runtime.ts`, `run-recorder.ts`, `inngest-functions.ts`, new `network-execution.ts`, 3 network execute routes, `network-tools.ts`)

---

## Phase 10: Advanced API Enhancements

**Source:** God Mode 3, Orchestration 8, Command 3.2

API additions for more advanced frontend features.

### 10.1 Activity API grouped param (for God Mode execution trees)

**File:** `apps/agent/src/app/api/activity/route.ts`

Add `grouped=true` query param:

- Server-side: After fetching events, group by `campaignId`/`networkRunId`/`workflowRunId`
- Return: `{ groups: [{ key, type, rootEvent, children, stats }], ungrouped: ActivityEvent[] }`
- Stats per group: `{ total, completed, failed, running, totalCost, totalDuration }`
- Sort groups by most recent activity

### 10.2 Campaign chain API (for God Mode tree inspection)

**New file:** `apps/agent/src/app/api/godmode/campaign-chain/route.ts`

Similar to trace-chain but for campaigns:

- Input: `campaignId`
- Walks: Campaign -> Missions -> MissionTasks -> AgentRun -> AgentTrace
- Returns `CausalNode` tree (reuses existing type from trace-chain)

### 10.3 Cost projection enhancement

**File:** `apps/agent/src/app/api/live/automations/route.ts`

Add `avgCostPerRun` and `estMonthlyCost` to each automation in the response. Server-side computation:

```typescript
function estimateMonthlyCost(avgCost: number | null, cronExpr: string | null): number | null {
    if (!avgCost || !cronExpr) return null;
    const now = new Date();
    const monthEnd = new Date(now);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const runsPerMonth = expandCronForRange(cronExpr, now, monthEnd).length;
    return runsPerMonth * avgCost;
}
```

### 10.4 Diff API for Command inline PR diffs

**New file:** `apps/agent/src/app/api/reviews/[id]/diff/route.ts`

Fetches PR diff from GitHub API using `ApprovalRequest.githubRepo` and `reviewContext.prNumber`. Returns unified diff text.

**Prerequisite:** GAP 6 from Command plan -- `prNumber` must be populated. For coding pipeline, either update `cursor-poll-until-done` to return `prNumber`, or query `CodingPipelineRun` at engagement creation.

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

**Files changed:** 3-4 (activity `route.ts`, new `campaign-chain/route.ts`, `automations/route.ts`, new `reviews/[id]/diff/route.ts`)

---

## Phase 11: Health Policy Infrastructure

**Source:** Orchestration 9

### 11.1 Schema additions

**File:** `packages/database/prisma/schema.prisma`

Add to `AgentSchedule`:

```prisma
healthPolicyEnabled  Boolean   @default(false)
healthThreshold      Int       @default(60)
healthWindow         Int       @default(50)
healthAction         String    @default("disable")  // "disable" | "reduce_frequency" | "alert"
healthTriggeredAt    DateTime?
```

Consider adding the same fields to `CampaignSchedule`.

```bash
bun run db:generate && bun run db:push
```

### 11.2 Health evaluation function

**New file:** `apps/agent/src/lib/health-policy.ts`

```typescript
export async function evaluateHealthPolicy(scheduleId: string): Promise<void> {
    const schedule = await prisma.agentSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule?.healthPolicyEnabled || !schedule.isActive) return;

    const recentRuns = await prisma.agentRun.findMany({
        where: { triggerId: scheduleId },
        orderBy: { startedAt: "desc" },
        take: schedule.healthWindow
    });

    if (recentRuns.length < schedule.healthWindow) return;

    const successRate =
        (recentRuns.filter((r) => r.status === "COMPLETED").length / recentRuns.length) * 100;

    if (successRate < schedule.healthThreshold) {
        if (schedule.healthAction === "disable") {
            await prisma.agentSchedule.update({
                where: { id: scheduleId },
                data: { isActive: false, healthTriggeredAt: new Date() }
            });
        }
        // Other actions: "reduce_frequency", "alert"
    }
}
```

### 11.3 Hook into scheduled run completion

**File:** `apps/agent/src/lib/inngest-functions.ts`

After each scheduled agent run completes, call `evaluateHealthPolicy(scheduleId)`.

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

**Files changed:** 3 (`schema.prisma`, new `health-policy.ts`, `inngest-functions.ts`)

---

## Phase 12: Shared Severity Utility

**Source:** God Mode 5, Orchestration 4 (cross-cutting)

Both God Mode and Schedule use a 4-band severity system. Extract to a shared package for cross-surface consistency.

### 12.1 Create shared severity module

**New file:** `packages/ui/src/lib/severity.ts`

```typescript
export type SeverityLevel = "healthy" | "degrading" | "unstable" | "failing";

export function getSeverity(successRate: number, totalRuns: number): SeverityLevel {
    if (totalRuns === 0) return "healthy";
    if (successRate >= 95) return "healthy";
    if (successRate >= 80) return "degrading";
    if (successRate >= 60) return "unstable";
    return "failing";
}

export function getSeverityStyles(severity: SeverityLevel) {
    const styles = {
        healthy: {
            text: "text-green-600",
            bg: "bg-green-500/5",
            border: "border-l-green-500",
            badge: "bg-green-100 text-green-700"
        },
        degrading: {
            text: "text-yellow-600",
            bg: "bg-yellow-500/5",
            border: "border-l-yellow-500",
            badge: "bg-yellow-100 text-yellow-700"
        },
        unstable: {
            text: "text-orange-600",
            bg: "bg-orange-500/5",
            border: "border-l-orange-500",
            badge: "bg-orange-100 text-orange-700"
        },
        failing: {
            text: "text-red-600",
            bg: "bg-red-500/5",
            border: "border-l-red-500",
            badge: "bg-red-100 text-red-700"
        }
    };
    return styles[severity];
}

export const severitySortOrder: Record<SeverityLevel, number> = {
    failing: 0,
    unstable: 1,
    degrading: 2,
    healthy: 3
};
```

### 12.2 Export from @repo/ui

**File:** `packages/ui/src/index.ts` (or package exports)

Add `severity` to the package exports so both `apps/agent` surfaces and shared components can import it.

### Verify

```bash
bun run type-check && bun run lint && bun run build
```

**Files changed:** 2 (new `severity.ts`, package exports)

---

## Execution Summary

| Phase  | What                       | Depends On    | Effort     | Files |
| ------ | -------------------------- | ------------- | ---------- | ----- |
| **1**  | Schema migration (batch)   | --            | Low        | 2     |
| **2**  | Fix broken dispatch chain  | --            | Medium     | 3     |
| **3**  | Network CRUD APIs          | Phase 2       | Medium     | 4 new |
| **4**  | Workflow activity events   | Phase 1       | Low-Medium | 2     |
| **5**  | Unified Observe APIs       | Phase 1       | Medium     | 6     |
| **6**  | Unified Automations API    | Phase 1, 2    | Medium     | 1-2   |
| **7**  | Command governance backend | -- (parallel) | Medium     | 2-3   |
| **8**  | Command data enrichment    | -- (parallel) | Low        | 2     |
| **9**  | Sub-run recording          | Phase 1       | High       | ~8    |
| **10** | Advanced APIs              | Phase 4, 5, 6 | Medium     | 3-4   |
| **11** | Health policy infra        | Phase 6       | Medium     | 3     |
| **12** | Shared severity utility    | -- (anytime)  | Low        | 2     |

**Parallelism opportunities:**

- Phases 7+8 (Command) are fully independent of Phases 2-6 (dispatch + APIs)
- Phase 12 (severity) can run anytime
- Phases 4 and 5 can run in parallel after Phase 1
- Phase 3 can run in parallel with Phases 4-6 (only depends on Phase 2)

**Total estimated files changed:** ~38-42

---

## After Completion

With this backend plan complete, ALL four frontend surface plans have the data layer they need:

| Frontend Surface                                                   | Backend Phases Required  |
| ------------------------------------------------------------------ | ------------------------ |
| God Mode UI (decomposition + trees + health bar + insights)        | 1, 4, 10.1, 10.2, 12     |
| Observe UI (kind filter + table + detail panel + dashboard)        | 1, 5, 9                  |
| Schedule UI (component extraction + severity + density + calendar) | 1, 2, 3, 6, 10.3, 11, 12 |
| Command UI (card rendering + filters + timeline + audit)           | 7, 8, 10.4               |

---

## Testing Protocol

After EVERY phase:

```bash
bun run type-check
bun run lint
bun run build
```

After Phase 1 (schema):

```bash
bun run db:generate
bun run db:push
```

After Phase 11 (health policy schema):

```bash
bun run db:generate
bun run db:push
```

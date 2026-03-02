# Unified Observability: Agents, Workflows, Networks

## Problem

The Observe tab is agent-only. It queries `AgentRun` exclusively. `WorkflowRun` and `NetworkRun` are invisible -- they only exist on their siloed pages (`/workflows/[slug]/runs`, `/networks/[slug]/runs`). When an SDLC workflow dispatches and runs 5 agents, nothing appears in Observe. Additionally, agent calls _within_ workflows and networks don't create `AgentRun` records at all -- they're completely invisible.

## Target State

- WorkflowRun and NetworkRun appear as first-class entries in the Observe runs list
- A "Kind" filter lets users scope to Agent / Workflow / Network / All
- Clicking a workflow or network run shows a type-appropriate detail panel with evaluation scores and feedback
- Dashboard metrics aggregate across all three primitives with per-kind breakdown
- Triggers tab surfaces workflow and network trigger events (schema already supports this)
- Agent calls within workflows create `AgentRun` records with `source: "workflow"`, linked via `WorkflowRunStep.agentRunId`
- Agent calls within networks create `AgentRun` records with `source: "network"`, linked via `NetworkRunStep.agentRunId`
- Running workflow/network runs show live status in the detail panel via polling

---

## Phase 1: Unified Observe API

Surface WorkflowRun and NetworkRun through the existing Observe API endpoints.

### 1.1 Extend `/api/live/runs`

**File:** [`apps/agent/src/app/api/live/runs/route.ts`](apps/agent/src/app/api/live/runs/route.ts)

- Add `kind` query param: `"all"` (default), `"agent"`, `"workflow"`, `"network"`
- When `kind=all` or `kind=workflow`: query `WorkflowRun` with workflow name/slug via `workflow: { organizationId }` scoping
- When `kind=all` or `kind=network`: query `NetworkRun` with network name/slug via `network: { workspace: { organizationId } }` scoping
- Map all three to a normalized `UnifiedRun` shape:

```typescript
interface UnifiedRun {
    id: string;
    kind: "agent" | "workflow" | "network";
    name: string; // agent.name / workflow.name / network.name
    slug: string;
    status: string;
    inputText: string;
    outputText?: string;
    durationMs?: number;
    startedAt: string;
    completedAt?: string;
    source?: string;
    triggerType: string;
    totalTokens?: number;
    costUsd?: number;
    stepsCount?: number;
    // Agent-specific
    modelName?: string;
    modelProvider?: string;
    toolCallCount?: number;
    versionNumber?: number;
    // Workflow-specific
    suspendedStep?: string;
    environment?: string;
    // Network-specific
    stepsExecuted?: number;
    // Evaluation
    hasEvaluation?: boolean;
    overallScore?: number;
    // Feedback
    hasFeedback?: boolean;
}
```

- **Pagination strategy for `kind=all`:** Fetch `limit` records from each table (with matching filters), merge in memory, sort by `startedAt desc`, take first `limit`. For offset pagination, use cursor-based approach with `startedAt` as cursor to avoid over-fetching.
- Add `kind` to response counts: `{ total, byKind: { agent, workflow, network }, byStatus: { ... } }`
- Apply shared filters where applicable: `status`, `source`, `from/to` date range, `search` (on input/output text)
- Kind-specific filters: `agentId` only applies to agent runs; `environment` applies to workflow/network runs

### 1.2 Extend `/api/live/metrics`

**File:** [`apps/agent/src/app/api/live/metrics/route.ts`](apps/agent/src/app/api/live/metrics/route.ts)

- Add `kind` query param support
- Aggregate counts, duration, tokens, cost across all three tables
- Add per-kind breakdown: `{ agent: { total, completed, failed, running, avgDuration, totalCost }, workflow: { ... }, network: { ... } }`
- Include `suspended` status count for workflows (unique to workflows)

### 1.3 Extend `/api/live/filters`

**File:** [`apps/agent/src/app/api/live/filters/route.ts`](apps/agent/src/app/api/live/filters/route.ts)

- Add `workflows` array: `{ slug, name }[]` from org-scoped workflows
- Add `networks` array: `{ slug, name }[]` from org-scoped networks
- Add `kinds: ["agent", "workflow", "network"]` to response

### 1.4 Fix Triggers tab API to include workflow/network data

**File:** [`apps/agent/src/app/api/live/triggers/route.ts`](apps/agent/src/app/api/live/triggers/route.ts)

The `TriggerEvent` schema already has `workflowId`, `workflowRunId`, `networkId`, `networkRunId` fields, and the UI (`ActivityLogTab`) is partially built to display them. But the API always returns `null` for these fields.

- Add `workflow`, `workflowRun`, `network`, `networkRun` to the Prisma `include` clause
- Remove the hardcoded `workflow: null, workflowRun: null, network: null, networkRun: null` overrides
- Map workflow/network data into the response alongside agent data

### 1.5 Extend workflow/network run detail APIs to include evaluation and feedback

**File:** [`apps/agent/src/app/api/workflows/[slug]/runs/[runId]/route.ts`](apps/agent/src/app/api/workflows/[slug]/runs/[runId]/route.ts)

- Include `evaluation` (`WorkflowRunEvaluation`) and `feedback` (`WorkflowRunFeedback[]`) in the Prisma query
- Return them in the response payload

**File:** [`apps/agent/src/app/api/networks/[slug]/runs/[runId]/route.ts`](apps/agent/src/app/api/networks/[slug]/runs/[runId]/route.ts)

- Include `evaluation` (`NetworkRunEvaluation`) and `feedback` (`NetworkRunFeedback[]`) in the Prisma query
- Return them in the response payload

---

## Phase 2: Unified Observe UI

Update the Observe tab to render all three run types.

### 2.1 Add Kind filter

**File:** [`apps/agent/src/app/live/page.tsx`](apps/agent/src/app/live/page.tsx)

- Add `kindFilter` state defaulting to `"all"`
- Add `<Select>` dropdown: All / Agent / Workflow / Network (placed first in the filter bar, as the primary discriminator)
- Pass `kind` to all API fetch calls (`fetchRuns`, `fetchFilters`, `fetchMetrics`)
- Include in `hasActiveFilters` and Clear Filters handler
- Add `kind` to `groupBy` options
- When `kindFilter` changes, reset `agentFilter` (agent filter is irrelevant for workflow/network)

### 2.2 Update run list table

**File:** [`apps/agent/src/app/live/page.tsx`](apps/agent/src/app/live/page.tsx)

Current columns: Agent, Version, Model, Status, Source, Input, Duration, Tool Calls, Tools, Tokens, Cost, Time

Updated columns:

- **Kind** (new): Badge -- "Agent" / "Workflow" / "Network"
- **Name** (renamed from "Agent"): Shows agent name, workflow name, or network name
- **Version**: Show for agents; `-` for workflow/network
- **Model**: Show for agents; `-` for workflow/network
- **Status**: Works for all (add "suspended" badge styling for workflows)
- **Source**: Works for all
- **Input**: Works for all (workflow/network use `inputText` or truncated `inputJson`)
- **Duration**: Works for all
- **Steps**: Show `stepsCount` for workflow/network; `stepCount` for agents
- **Tokens**: Works for all (`totalTokens`)
- **Cost**: Works for all (`costUsd` / `totalCostUsd`)
- **Time**: Works for all (`startedAt`)

Remove or merge Tool Calls/Tools columns into Steps for a cleaner unified view.

### 2.3 Type-aware RunDetailPanel

**File:** [`apps/agent/src/components/RunDetailPanel.tsx`](apps/agent/src/components/RunDetailPanel.tsx)

- Accept `kind` and `slug` props (instead of only `agentSlug`)
- Route detail fetch based on `kind`:
    - Agent: `GET /api/agents/{slug}/runs/{id}` (existing)
    - Workflow: `GET /api/workflows/{slug}/runs/{id}` (existing, extended in 1.5)
    - Network: `GET /api/networks/{slug}/runs/{id}` (existing, extended in 1.5)

**Agent detail tabs** (existing, unchanged):

- Overview (input/output, tokens, eval scores, feedback)
- Trace (live steps via SSE)
- Tools (live tool calls via SSE)
- Errors
- Latency

**Workflow detail tabs** (new):

- Overview: Input/Output JSON, duration, environment, trigger type
- Steps: Workflow steps stepper (stepId, stepName, stepType, status, duration, output) -- reuse patterns from `workflows/[slug]/runs/[runId]/page.tsx`
- Evaluation: Show `WorkflowRunEvaluation` scores (stepSuccessRate, outputQuality, durationScore, overallScore, narrative)
- Feedback: Show `WorkflowRunFeedback` entries
- If suspended: show suspended step info + approval/reject/revise controls

**Network detail tabs** (new):

- Overview: Input/Output, duration, steps executed
- Steps: Network steps with routing decisions, primitive type/id, input/output per step
- Evaluation: Show `NetworkRunEvaluation` scores (routingScore, agentScores, narrative)
- Feedback: Show `NetworkRunFeedback` entries

### 2.4 Live status for running workflow/network runs

**File:** [`apps/agent/src/components/RunDetailPanel.tsx`](apps/agent/src/components/RunDetailPanel.tsx)

Agent runs use SSE streaming (`useRunStream` hook) for real-time trace/tool updates. Workflow and network runs do NOT have equivalent SSE endpoints.

**Approach:** For running workflow/network runs, use polling:

- When `status === "RUNNING"` and `kind !== "agent"`, poll the run detail API every 5 seconds
- Update steps, status, and duration on each poll
- Stop polling when status becomes terminal or suspended
- Show a "Polling" indicator (vs the "LIVE" badge for agent SSE)

This avoids building new SSE endpoints while still providing live feedback. SSE for workflow/network runs can be added in a future enhancement.

### 2.5 Dashboard metrics

**File:** [`apps/agent/src/app/live/page.tsx`](apps/agent/src/app/live/page.tsx) (ObservabilityDashboard)

Current dashboard shows: Total runs, Completed, Failed, Running, Avg Duration, Total Tokens, Total Cost, Top Agents, Top Models

Updated dashboard:

- Total runs across all three types
- Per-kind breakdown card: Agents (N) / Workflows (N) / Networks (N) with individual status counts
- Include workflow "suspended" count as a distinct status
- Include workflow/network duration and cost in aggregate metrics
- Top Agents section stays; add "Top Workflows" and "Top Networks" sections (or a unified "Top Primitives" section)

### 2.6 Update run selection handler

**File:** [`apps/agent/src/app/live/page.tsx`](apps/agent/src/app/live/page.tsx)

- When a run is clicked, pass `kind` and `slug` to the RunDetailPanel
- The `fetchRunDetail` function routes to the correct API based on `kind`

---

## Phase 3: Workflow Agent Sub-Run Recording

Create `AgentRun` records for each agent step within workflow execution so individual agent calls appear in Observe.

### 3.1 Type changes

**File:** [`packages/agentc2/src/workflows/builder/types.ts`](packages/agentc2/src/workflows/builder/types.ts)

- Add `agentRunId?: string` to `WorkflowExecutionStep`

**File:** [`packages/agentc2/src/workflows/builder/runtime.ts`](packages/agentc2/src/workflows/builder/runtime.ts)

- Add `AgentStepHooks` interface and `agentStepHooks` to `ExecuteWorkflowOptions`:

```typescript
interface AgentStepHooks {
    onStart?: (info: {
        stepId: string;
        agentSlug: string;
        agentId: string;
        prompt: string;
        workflowRunId?: string;
        workflowSlug?: string;
        tenantId?: string;
    }) => Promise<
        | {
              runId: string;
              complete: (opts: Record<string, unknown>) => Promise<void>;
              fail: (err: Error | string) => Promise<void>;
              addToolCall: (tc: Record<string, unknown>) => Promise<void>;
          }
        | undefined
    >;
}
```

### 3.2 Modify `executeAgentStep`

**File:** [`packages/agentc2/src/workflows/builder/runtime.ts`](packages/agentc2/src/workflows/builder/runtime.ts) (~line 266)

- Accept `hooks` and `workflowMeta` parameters
- After `agentResolver.resolve()`, call `hooks.onStart()` with `record.id` as `agentId` to create the AgentRun
- After `agent.generate()` success: iterate `response.toolCalls`, call `handle.addToolCall()` for each, then call `handle.complete()` with output, model info, and token data
- On error: call `handle.fail(error)`, then re-throw
- Return `_agentRunId: handle?.runId` in the output object
- In step result construction (~line 509): extract `_agentRunId` from output and set `stepResult.agentRunId`

### 3.3 Add `"workflow"` to RunSource

**File:** [`apps/agent/src/lib/run-recorder.ts`](apps/agent/src/lib/run-recorder.ts) (~line 39)

- Add `| "workflow"` to the `RunSource` union type

### 3.4 Wire hooks in Inngest

**File:** [`apps/agent/src/lib/inngest-functions.ts`](apps/agent/src/lib/inngest-functions.ts) (~line 8240)

In `asyncWorkflowExecuteFunction`, provide `agentStepHooks` to `executeWorkflowDefinition`:

```typescript
agentStepHooks: {
    onStart: async (info) => {
        const { startRun } = await import("@/lib/run-recorder");
        const { calculateCost } = await import("@/lib/cost-calculator");
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

### 3.5 Populate `agentRunId` in WorkflowRunStep

**File:** [`apps/agent/src/lib/inngest-functions.ts`](apps/agent/src/lib/inngest-functions.ts) (~line 8282)

In the `save-steps` Inngest step:

- Add `agentRunId?: string` to the inline step type assertion
- Include `agentRunId: s.agentRunId || undefined` when mapping `result.steps` into `WorkflowRunStep` records

---

## Phase 4: Network Agent Sub-Run Recording

Create `AgentRun` records for agent executions within networks.

### 4.1 Schema change

**File:** [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma) (~line 2821)

- Add to `NetworkRunStep`:
    ```prisma
    agentRunId String?
    agentRun   AgentRun? @relation(fields: [agentRunId], references: [id], onDelete: SetNull)
    ```
- Run `bun run db:generate` after schema change

### 4.2 Add `"network"` to RunSource

**File:** [`apps/agent/src/lib/run-recorder.ts`](apps/agent/src/lib/run-recorder.ts)

- Add `| "network"` to the `RunSource` union type

### 4.3 Extract shared network stream processing

The stream processing loop that captures events from `Agent.network()` is duplicated across 4 files:

- `apps/agent/src/app/api/networks/[slug]/execute/route.ts`
- `apps/agent/src/app/api/networks/[slug]/execute/stream/route.ts`
- `apps/agent/src/app/api/networks/[slug]/execute/public/route.ts`
- `packages/agentc2/src/tools/network-tools.ts`

Extract the stream processing into a shared helper (e.g., `apps/agent/src/lib/network-execution.ts`) that:

- Processes the `Agent.network()` async iterable
- Captures steps, tokens, output
- Accepts optional hooks for agent sub-run recording
- Returns the processed result for the caller to save

### 4.4 Hook into network execution

**File:** New shared helper or directly in execute routes

In the stream processing loop:

- On agent start event (`chunkAny.type` includes `"agent"` and `"start"`):
    - Resolve `payload.agentId` (can be slug or DB id) to DB agent record
    - Call `startRun({ source: "network", agentId, ... })`
    - Store handle keyed by step index
- On agent end event (`chunkAny.type` includes `"agent"` and `"end"` or `"step-finish"`):
    - Match to in-flight handle
    - Call `handle.complete()` with output and token data from `payload.usage`
    - Set `agentRunId` on the step
- On error: call `handle.fail()`
- Include `agentRunId` when creating `NetworkRunStep` records

---

## Cross-Cutting Concerns

### Pagination for `kind=all`

When querying all three tables:

- Fetch `limit` records from each table with matching filters and `orderBy: startedAt desc`
- Merge in memory, sort by `startedAt desc`, take first `limit`
- For subsequent pages, pass `before` cursor (ISO timestamp of last item's `startedAt`) to each query as `startedAt: { lt: cursor }`
- This avoids full table scans while maintaining correct sort order

### Cost computation for workflow/network runs

- `WorkflowRun` does not have a `totalCostUsd` field; `NetworkRun` does
- For workflows: cost = `null` until Phase 3, then can be aggregated from linked `AgentRun.costUsd` via `WorkflowRunStep.agentRunId`
- For networks: use existing `NetworkRun.totalCostUsd`
- In the `UnifiedRun` mapping, populate `costUsd` accordingly

### Existing run detail pages unaffected

The existing siloed pages (`/workflows/[slug]/runs`, `/networks/[slug]/runs`) continue to work unchanged. The Observe tab provides a unified alternative view, not a replacement.

---

## Execution Order

| Priority | Phase                       | Impact                                          | Complexity  | Estimated Files |
| -------- | --------------------------- | ----------------------------------------------- | ----------- | --------------- |
| 1        | Phase 1 (API)               | High -- data layer for everything else          | Medium      | 5 files         |
| 2        | Phase 2 (UI)                | Highest user impact -- unified view             | Medium-High | 2 files (large) |
| 3        | Phase 3 (Workflow sub-runs) | High -- granular agent visibility in workflows  | Medium      | 4 files         |
| 4        | Phase 4 (Network sub-runs)  | Medium -- granular agent visibility in networks | Higher      | 4-5 files       |

## Files Changed Summary

| File                                                            | Phase | Change                                                 |
| --------------------------------------------------------------- | ----- | ------------------------------------------------------ |
| `apps/agent/src/app/api/live/runs/route.ts`                     | 1     | Query all three run types, normalize to UnifiedRun     |
| `apps/agent/src/app/api/live/metrics/route.ts`                  | 1     | Aggregate metrics across types, per-kind breakdown     |
| `apps/agent/src/app/api/live/filters/route.ts`                  | 1     | Add workflows/networks to filter options               |
| `apps/agent/src/app/api/live/triggers/route.ts`                 | 1     | Include workflow/network data in trigger events        |
| `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/route.ts` | 1     | Include evaluation + feedback in response              |
| `apps/agent/src/app/api/networks/[slug]/runs/[runId]/route.ts`  | 1     | Include evaluation + feedback in response              |
| `apps/agent/src/app/live/page.tsx`                              | 2     | Kind filter, table columns, detail routing, dashboard  |
| `apps/agent/src/components/RunDetailPanel.tsx`                  | 2     | Type-aware detail with workflow/network views, polling |
| `packages/agentc2/src/workflows/builder/types.ts`               | 3     | Add agentRunId to WorkflowExecutionStep                |
| `packages/agentc2/src/workflows/builder/runtime.ts`             | 3     | Add hooks, modify executeAgentStep                     |
| `apps/agent/src/lib/run-recorder.ts`                            | 3, 4  | Add "workflow" and "network" to RunSource              |
| `apps/agent/src/lib/inngest-functions.ts`                       | 3     | Wire hooks + populate agentRunId in save-steps         |
| `packages/database/prisma/schema.prisma`                        | 4     | Add agentRunId to NetworkRunStep                       |
| Network execute routes (3 files)                                | 4     | Extract shared stream processing, add hooks            |
| `packages/agentc2/src/tools/network-tools.ts`                   | 4     | Use shared stream processing                           |

## Testing

- `bun run type-check` and `bun run lint` after each phase
- `bun run build` after all changes
- `bun run db:generate` after Phase 4 schema change
- Manual: Open Observe tab, verify Kind filter shows All/Agent/Workflow/Network
- Manual: Dispatch SDLC ticket from `/admin`, verify WorkflowRun appears in Observe with status updates
- Manual: Click a workflow run, verify detail panel shows steps, evaluation, feedback
- Manual: After Phase 3, verify individual agent sub-runs appear with `source: "workflow"` and link back to the workflow
- Manual: Execute a network, verify NetworkRun appears in Observe
- Manual: Check Triggers tab shows workflow/network trigger events (not just agent events)
- Manual: Verify dashboard metrics include workflow/network counts and costs

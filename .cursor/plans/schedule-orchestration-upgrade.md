# Unified Orchestration & Load Management

## System Diagnosis

The Schedule page is the orchestration control plane for the platform. But it only sees **one of five primitives**.

### Current Visibility Matrix

| Primitive    | Schedulable?         | Triggerable?                                          | On Schedule Page?                      | In Observe?         | Stats Source          |
| ------------ | -------------------- | ----------------------------------------------------- | -------------------------------------- | ------------------- | --------------------- |
| **Agent**    | `AgentSchedule`      | `AgentTrigger`                                        | Yes                                    | Yes (`AgentRun`)    | `AgentRun.triggerId`  |
| **Workflow** | No model             | Partial (webhook only, event API skips)               | Trigger row shows but **0 runs**       | Yes (`WorkflowRun`) | None on schedule page |
| **Network**  | No model             | Broken (webhook handler rejects `entityType=network`) | Trigger row shows but **broken stats** | Yes (`NetworkRun`)  | None on schedule page |
| **Campaign** | `CampaignSchedule`   | `CampaignTrigger`                                     | **Invisible**                          | **Not in Observe**  | `Campaign` model      |
| **Pulse**    | `Pulse.evalCronExpr` | No                                                    | **Invisible**                          | **Not in Observe**  | `PulseEvaluation`     |

### What This Means

- A human looking at the Schedule page sees 27 automations. The real number is higher — campaign schedules and pulse evaluation cycles are running silently via Inngest with zero visibility.
- Workflow triggers appear in the list but show 0 runs because stats query `AgentRun` only — the actual runs are in `WorkflowRun`.
- Network triggers don't even fire — the webhook handler returns "Unsupported entity type: network".
- The execution density heatmap, cost projection, and severity system would only cover agents — missing entire subsystems.
- The "god mode" observability plan (unified-observability.md) adds workflows and networks to Observe but doesn't touch campaigns or pulse, and doesn't address the Schedule page at all.

### Target State

The Schedule page becomes the **unified orchestration control plane** for ALL system primitives:

```
Schedule Page
├── Agent Schedules (AgentSchedule)
├── Agent Triggers (AgentTrigger, entityType=agent)
├── Workflow Triggers (AgentTrigger, entityType=workflow)
├── Network Triggers (AgentTrigger, entityType=network)
├── Campaign Schedules (CampaignSchedule)
├── Campaign Triggers (CampaignTrigger)
└── Pulse Evaluation Cycles (Pulse.evalCronExpr)
```

With unified severity, density, cost, and health policy across ALL of them.

---

## Architecture: How Primitives Connect

```
Pulse (goal collective)
 └── PulseMember (agents)
      └── Agent automations (scheduled posts, discussions, synthesis)
           └── AgentSchedule / AgentTrigger
                └── AgentRun → feeds PulseEvaluation

Campaign (mission objective)
 └── Missions
      └── MissionTasks
           └── AgentRun (assigned agent executes task)
 └── CampaignSchedule (recurring campaign from template)
 └── CampaignTrigger (event-driven campaign creation)

Network (multi-agent routing)
 └── Network execution
      └── NetworkRun → NetworkRunStep → AgentRun (sub-runs)
 └── AgentTrigger (entityType=network) — CURRENTLY BROKEN

Workflow (multi-step pipeline)
 └── Workflow execution
      └── WorkflowRun → WorkflowRunStep → AgentRun (sub-runs, Phase 3 of observability plan)
 └── AgentTrigger (entityType=workflow) — webhook works, event doesn't
```

The execution density, cost projection, and severity system must account for the FULL cascade:

- A CampaignSchedule fires → creates Campaign → decomposes into Missions → MissionTasks → AgentRuns
- An AgentSchedule fires → AgentRun (which may trigger a network or workflow internally)
- A Pulse eval cycle fires → runs evaluation → may adjust agent capacity

---

## Phase 0: Fix Broken Primitives

Before upgrading the UI, fix the backend gaps that make the system incomplete.

### 0.1 Fix Network Trigger Dispatch

**File:** `apps/agent/src/app/api/webhooks/[path]/route.ts` (~line 224)

The webhook handler has an if/else chain that handles `workflow` and `agent` but explicitly rejects `network`:

```typescript
// CURRENT — network is rejected
if (entityType === "workflow" && trigger.workflow) {
    await inngest.send({ name: "workflow/trigger.fire", ... });
} else if (entityType === "agent" && trigger.agent) {
    await inngest.send({ name: "agent/trigger.fire", ... });
} else {
    // Returns 400 "Unsupported entity type"
}
```

Add network support:

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

### 0.2 Add Network Trigger Inngest Function

**File:** `apps/agent/src/lib/inngest-functions.ts`

Create `networkTriggerFireFunction` to handle `network/trigger.fire` events:

```typescript
export const networkTriggerFireFunction = inngest.createFunction(
    { id: "network-trigger-fire", retries: 2 },
    { event: "network/trigger.fire" },
    async ({ event, step }) => {
        const { networkId, networkSlug, payload, triggerEventId } = event.data;
        // Resolve network, execute via Agent.network(), create NetworkRun
        // Similar to POST /api/networks/[slug]/execute but triggered
    }
);
```

Register in the function list.

### 0.3 Fix Event API for Workflows and Networks

**File:** `apps/agent/src/app/api/triggers/event/route.ts`

Currently filters to `trigger.agent != null`, skipping workflow and network triggers:

```typescript
// CURRENT — only fires agent triggers
const triggers = await prisma.agentTrigger.findMany({
    where: { eventName, isActive: true, agent: { isNot: null } }
});
```

Expand to include all entity types:

```typescript
const triggers = await prisma.agentTrigger.findMany({
    where: { eventName, isActive: true },
    include: { agent: true, workflow: true, network: true }
});

for (const trigger of triggers) {
    if (trigger.entityType === "agent" && trigger.agent) {
        await inngest.send({ name: "agent/trigger.fire", ... });
    } else if (trigger.entityType === "workflow" && trigger.workflow) {
        await inngest.send({ name: "workflow/trigger.fire", ... });
    } else if (trigger.entityType === "network" && trigger.network) {
        await inngest.send({ name: "network/trigger.fire", ... });
    }
}
```

---

## Phase 1: Unified Automations API

Expand `/api/live/automations` to return ALL orchestrated primitives.

### 1.1 Add Campaign Schedules and Triggers

**File:** `apps/agent/src/app/api/live/automations/route.ts`

Add queries for `CampaignSchedule` and `CampaignTrigger`:

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

Map campaign schedules to the unified `Automation` shape:

```typescript
const campaignScheduleAutomations = campaignSchedules.map((cs) => {
    // Stats from Campaign table — count campaigns created by this schedule
    const total = campaignStatsMap.get(cs.id)?.total ?? cs.runCount ?? 0;
    const success = campaignStatsMap.get(cs.id)?.completed ?? 0;
    const failed = campaignStatsMap.get(cs.id)?.failed ?? 0;

    return {
        id: `campaign-schedule:${cs.id}`,
        sourceType: "schedule" as const,
        type: "campaign" as const,
        primitiveType: "campaign" as const,
        name: cs.name,
        description: `Template: ${cs.template.name}`,
        isActive: cs.isActive,
        isArchived: false,
        archivedAt: null,
        agent: null,
        entity: { id: cs.template.id, slug: cs.template.slug, name: cs.template.name },
        config: { cronExpr: cs.cronExpr, timezone: cs.timezone },
        stats: {
            totalRuns: total,
            successRuns: success,
            failedRuns: failed,
            successRate: total > 0 ? Math.round((success / total) * 100) : 0,
            avgDurationMs: null,
            lastRunAt: cs.lastRunAt,
            nextRunAt: cs.nextRunAt
        },
        lastRun: null,
        createdAt: cs.createdAt
    };
});
```

### 1.2 Add Pulse Evaluation Cycles

Query active Pulses and surface their eval schedules:

```typescript
const pulses = await prisma.pulse.findMany({
    where: { status: "ACTIVE" },
    select: {
        id: true,
        slug: true,
        name: true,
        evalCronExpr: true,
        evalTimezone: true,
        evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { evaluations: true, members: true } }
    }
});
```

Map to automation shape:

```typescript
const pulseAutomations = pulses.map((p) => ({
    id: `pulse-eval:${p.id}`,
    sourceType: "schedule" as const,
    type: "pulse_eval" as const,
    primitiveType: "pulse" as const,
    name: `${p.name} — Evaluation Cycle`,
    description: `${p._count.members} members, ${p._count.evaluations} evaluations`,
    isActive: true,
    isArchived: false,
    archivedAt: null,
    agent: null,
    entity: { id: p.id, slug: p.slug, name: p.name },
    config: { cronExpr: p.evalCronExpr, timezone: p.evalTimezone },
    stats: {
        totalRuns: p._count.evaluations,
        successRuns: p._count.evaluations, // Evals don't fail in the traditional sense
        failedRuns: 0,
        successRate: 100,
        avgDurationMs: null,
        lastRunAt: p.evaluations[0]?.createdAt ?? null,
        nextRunAt: null // Compute from cron
    },
    lastRun: null,
    createdAt: null
}));
```

### 1.3 Fix Workflow/Network Trigger Stats

Currently, stats use `AgentRun.groupBy(triggerId)`. For workflow triggers, stats should come from `WorkflowRun`; for network triggers, from `NetworkRun`.

Separate stats queries by entity type:

```typescript
// Agent triggers — stats from AgentRun
const agentTriggerIds = triggers.filter((t) => t.entityType === "agent").map((t) => t.id);
const agentRunStats = await prisma.agentRun.groupBy({
    by: ["triggerId"],
    where: { triggerId: { in: agentTriggerIds } },
    _count: { _all: true }
});

// Workflow triggers — stats from WorkflowRun
const workflowTriggerIds = triggers.filter((t) => t.entityType === "workflow").map((t) => t.id);
const workflowRunStats = await prisma.workflowRun.groupBy({
    by: ["triggerId"],
    where: { triggerId: { in: workflowTriggerIds } },
    _count: { _all: true }
});

// Network triggers — stats from NetworkRun
const networkTriggerIds = triggers.filter((t) => t.entityType === "network").map((t) => t.id);
const networkRunStats = await prisma.networkRun.groupBy({
    by: ["triggerId"],
    where: { triggerId: { in: networkTriggerIds } },
    _count: { _all: true }
});
```

**Note:** This requires `triggerId` fields on `WorkflowRun` and `NetworkRun`. Check if they exist; if not, they need to be added to the schema and populated in the trigger fire functions.

### 1.4 Add `primitiveType` to Automation Response

Every automation gets a `primitiveType` field:

```typescript
type PrimitiveType = "agent" | "workflow" | "network" | "campaign" | "pulse";
```

Existing agent schedules get `primitiveType: "agent"`. Agent triggers get their primitiveType from `entityType`.

### 1.5 Extend Summary Metrics

```typescript
const summary = {
    total: automations.length,
    active: automations.filter(a => a.isActive).length,
    archived: automations.filter(a => a.isArchived).length,
    byPrimitive: {
        agent: automations.filter(a => a.primitiveType === "agent").length,
        workflow: automations.filter(a => a.primitiveType === "workflow").length,
        network: automations.filter(a => a.primitiveType === "network").length,
        campaign: automations.filter(a => a.primitiveType === "campaign").length,
        pulse: automations.filter(a => a.primitiveType === "pulse").length,
    },
    byType: {
        scheduled: automations.filter(a => a.sourceType === "schedule").length,
        triggered: automations.filter(a => a.sourceType === "trigger").length,
    },
    overallSuccessRate: /* computed across all */,
    needsAttention: automations.filter(a => getSeverityFromStats(a.stats) === "failing" || getSeverityFromStats(a.stats) === "unstable").length,
};
```

---

## Phase 2: Severity Surfacing (List View)

Make risk visible across ALL primitives.

### 2.1 Four-Band Severity System

```typescript
type SeverityLevel = "healthy" | "degrading" | "unstable" | "failing";

function getSeverity(automation: Automation): SeverityLevel {
    const { totalRuns, successRate } = automation.stats;
    if (totalRuns === 0) return "healthy";
    if (successRate >= 95) return "healthy";
    if (successRate >= 80) return "degrading";
    if (successRate >= 60) return "unstable";
    return "failing";
}
```

Visual treatment per severity:

| Severity           | Text              | Row                                    | Badge  |
| ------------------ | ----------------- | -------------------------------------- | ------ |
| Healthy (>95%)     | `text-green-600`  | No tint                                | Green  |
| Degrading (80–95%) | `text-yellow-600` | `bg-yellow-500/5` + yellow left border | Yellow |
| Unstable (60–80%)  | `text-orange-600` | `bg-orange-500/5` + orange left border | Orange |
| Failing (<60%)     | `text-red-600`    | `bg-red-500/5` + red left border       | Red    |

### 2.2 Default Sort: Severity-First

```typescript
const severityOrder = { failing: 0, unstable: 1, degrading: 2, healthy: 3 };
automations.sort((a, b) => {
    const diff = severityOrder[getSeverity(a)] - severityOrder[getSeverity(b)];
    return diff !== 0 ? diff : b.stats.totalRuns - a.stats.totalRuns;
});
```

### 2.3 Success Column — Show Failed Count

```tsx
<TableCell className="text-right">
    <div className="flex items-center justify-end gap-1.5">
        {severity !== "healthy" && stats.totalRuns > 0 && (
            <span className="text-muted-foreground text-[10px] tabular-nums">
                {stats.failedRuns}F
            </span>
        )}
        <span className={cn("tabular-nums", styles.text)}>
            {stats.totalRuns > 0 ? `${stats.successRate}%` : "—"}
        </span>
    </div>
</TableCell>
```

### 2.4 Last Run Status Indicator

Dot next to relative time: green (completed), red (failed), blue pulse (running).

### 2.5 Summary Cards — Severity-Aware

Replace the current 6 informational cards:

| Position | Card                  | Purpose                                                 |
| -------- | --------------------- | ------------------------------------------------------- |
| 1        | **Total**             | Total automations (unchanged)                           |
| 2        | **Active**            | Active count (unchanged)                                |
| 3        | **Needs Attention**   | Count of unstable + failing — red highlight when > 0    |
| 4        | **Primitives**        | Agent N / Workflow N / Network N / Campaign N / Pulse N |
| 5        | **Est. Monthly Cost** | Projected cost across all (from Phase 5)                |
| 6        | **Success Rate**      | Overall with severity color                             |

---

## Phase 3: Filtering, Search, Sorting

### 3.1 Search Bar

Filter by name, description, agent/entity name.

### 3.2 Primitive Filter Pills

Clickable pills: **All / Agent / Workflow / Network / Campaign / Pulse**

```typescript
const [primitiveFilter, setPrimitiveFilter] = useState<PrimitiveType | null>(null);
```

### 3.3 Type Filter Pills

**Schedule / Webhook / Event / Slack / Manual**

### 3.4 Severity Filter

**All / Healthy / Degrading / Unstable / Failing**

### 3.5 Sortable Column Headers

Click to sort by: Name, Runs, Success, Last Run, Next Run, Est. Cost.

### 3.6 Update Table Columns

| Column   | Current                       | New                                                                               |
| -------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Type     | Badge (Schedule/Webhook/etc.) | Keep                                                                              |
| —        | —                             | **Add: Primitive** (Agent/Workflow/Network/Campaign/Pulse icon + label)           |
| Name     | Name + description            | Keep                                                                              |
| Agent    | Agent name                    | **Rename to "Entity"** — Show agent, workflow, network, or campaign template name |
| Status   | Toggle                        | Keep                                                                              |
| Config   | Cron description              | Keep                                                                              |
| Runs     | Total runs                    | Keep                                                                              |
| Success  | Success %                     | **Enhance** with failed count + severity badge                                    |
| Last Run | Relative time                 | **Add** status dot                                                                |
| Next Run | Relative time                 | Keep                                                                              |
| —        | —                             | **Add: Est. Cost/mo** (from Phase 5)                                              |

---

## Phase 4: Execution Density Heatmap

Surface load and concurrency across ALL primitive types.

### 4.1 Compute Unified Execution Density

**File:** `apps/agent/src/app/schedule/page.tsx`

```typescript
function computeExecutionDensity(automations: Automation[], hours: number = 24) {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 3600000);
    const slots = new Map<
        number,
        { count: number; byPrimitive: Record<PrimitiveType, number>; names: string[] }
    >();

    for (let h = 0; h < 24; h++) {
        slots.set(h, {
            count: 0,
            byPrimitive: { agent: 0, workflow: 0, network: 0, campaign: 0, pulse: 0 },
            names: []
        });
    }

    // Expand ALL automations with cron expressions
    const scheduled = automations.filter((a) => a.isActive && a.config.cronExpr);

    for (const auto of scheduled) {
        const occurrences = expandCronForRange(auto.config.cronExpr!, now, end);
        for (const occ of occurrences) {
            const slot = slots.get(occ.getHours())!;
            slot.count++;
            slot.byPrimitive[auto.primitiveType]++;
            if (!slot.names.includes(auto.name)) slot.names.push(auto.name);
        }
    }

    return Array.from(slots.entries())
        .map(([hour, data]) => ({ hour, ...data }))
        .sort((a, b) => a.hour - b.hour);
}
```

### 4.2 Render Density Bar

Horizontal heatmap across 24 hours. Color intensity = execution count. Tooltip shows breakdown by primitive type and automation names.

Concurrency warning badge: "High concurrency: 12 at 10 PM (8 agent, 2 campaign, 1 pulse, 1 workflow)"

### 4.3 Cascade Awareness

A single CampaignSchedule firing can cascade into N missions × M tasks × M AgentRuns. The density bar should indicate this:

```
Campaign Schedule fires → spawns ~3-5 agent runs (estimated from historical MissionTask count)
```

If average campaign creates 4 AgentRuns, count it as 4 in the density bar, not 1.

---

## Phase 5: Calendar View Overhaul

### 5.1 Frequency Compression Mode

For automations with 12+ runs/day, collapse into a single summary entry:

```
"Devil's Advocate — Every 30 min (48x/day)" [single bar]
```

Expandable on click. Default collapsed.

### 5.2 Primitive Filter for Calendar

Checkboxes by primitive type: Agent / Campaign / Pulse (workflows and networks don't have schedules).

Plus agent-level checkboxes within each primitive.

### 5.3 Concurrency Overlay

Thin horizontal intensity bar at each hour row showing overlap count. Color: green (1-3), yellow (4-7), red (8+).

### 5.4 Color Mode Toggle

**Color by: Agent | Primitive | Health**

- Agent: Current behavior (color per agent)
- Primitive: Agent=blue, Campaign=purple, Pulse=cyan
- Health: Green/yellow/orange/red by severity

### 5.5 Campaign & Pulse on Calendar

Campaign schedules and Pulse eval cycles render as calendar events alongside agent schedules. Campaign events show with a distinct badge/icon.

---

## Phase 6: Cost Projection

### 6.1 Extend API with Cost Data

**File:** `apps/agent/src/app/api/live/automations/route.ts`

For agent automations:

```typescript
const costData = await prisma.agentRun.groupBy({
    by: ["triggerId"],
    where: { triggerId: { in: agentSourceIds } },
    _sum: { costUsd: true },
    _avg: { costUsd: true }
});
```

For campaign automations:

```typescript
const campaignCostData = await prisma.campaign.groupBy({
    by: ["scheduleId"], // Requires adding scheduleId to Campaign model or deriving from template
    _sum: { totalCostUsd: true },
    _avg: { totalCostUsd: true }
});
```

For workflow/network triggers: use `WorkflowRun.totalCostUsd` and `NetworkRun.totalCostUsd`.

### 6.2 Compute Projected Monthly Cost

```typescript
function estimateMonthlyCost(automation: Automation): number | null {
    const avgCost = automation.stats.avgCostPerRun;
    if (!avgCost || !automation.config.cronExpr) return null;

    const now = new Date();
    const monthEnd = new Date(now);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const runsPerMonth = expandCronForRange(automation.config.cronExpr, now, monthEnd).length;

    return runsPerMonth * avgCost;
}
```

### 6.3 Cost Column + Summary Card

Add "Est. Cost/mo" column to table and total projected cost summary card.

---

## Phase 7: Auto-Health Policies

### 7.1 Schema Addition

**File:** `packages/database/prisma/schema.prisma`

Add to `AgentSchedule`:

```prisma
healthPolicyEnabled  Boolean  @default(false)
healthThreshold      Int      @default(60)
healthWindow         Int      @default(50)
healthAction         String   @default("disable") // "disable" | "reduce_frequency" | "alert"
healthTriggeredAt    DateTime?
```

Consider adding to `CampaignSchedule` as well for campaign health policies.

### 7.2 Health Check After Scheduled Runs

After each scheduled agent run completes, evaluate:

```typescript
async function evaluateHealthPolicy(scheduleId: string): Promise<void> {
    const schedule = await prisma.agentSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule?.healthPolicyEnabled || !schedule.isActive) return;

    const recentRuns = await prisma.agentRun.findMany({
        where: { triggerId: scheduleId },
        orderBy: { startedAt: "desc" },
        take: schedule.healthWindow
    });

    const successRate =
        (recentRuns.filter((r) => r.status === "COMPLETED").length / recentRuns.length) * 100;

    if (successRate < schedule.healthThreshold) {
        if (schedule.healthAction === "disable") {
            await prisma.agentSchedule.update({
                where: { id: scheduleId },
                data: { isActive: false, healthTriggeredAt: new Date() }
            });
        }
    }
}
```

### 7.3 Health Policy UI

Toggle + config in the automation wizard. "Auto-disabled" badge in the list view for health-triggered disables.

---

## Phase 8: Dependency Awareness (Future)

### 8.1 Implicit Dependencies

Some dependencies are structurally knowable:

- **Campaign → Agent**: CampaignSchedule fires → Campaign → Missions → MissionTasks → AgentRuns
- **Network → Agent**: Network trigger fires → NetworkRun → NetworkRunSteps → AgentRuns
- **Workflow → Agent**: Workflow trigger fires → WorkflowRun → WorkflowRunSteps → AgentRuns
- **Pulse → Agent**: Pulse eval cycle → evaluates PulseMember agents → may adjust capacity

These can be inferred from the schema relationships without a separate dependency table.

### 8.2 Explicit Dependencies

For user-defined dependencies (e.g., "Bridge Builder depends on Synthesis Engine"), add:

```prisma
model AutomationDependency {
    id         String   @id @default(cuid())
    parentId   String
    parentType String // "schedule" | "trigger" | "campaign-schedule" | "pulse-eval"
    childId    String
    childType  String
    createdAt  DateTime @default(now())

    @@unique([parentId, childId])
}
```

### 8.3 UI: Dependency Indicators

Show "Depends on:" and "Triggers:" labels in the list view. Cascade warning on disable/delete.

---

## Cross-Reference: Unified Observability Plan

The `unified-observability.md` plan addresses the **Observe/God Mode** side:

| Concern                     | Observability Plan | This Plan                                | Gap?                                      |
| --------------------------- | ------------------ | ---------------------------------------- | ----------------------------------------- |
| Agent runs in Observe       | Phase 1-2 (done)   | N/A                                      | No                                        |
| Workflow runs in Observe    | Phase 1-2 (done)   | N/A                                      | No                                        |
| Network runs in Observe     | Phase 1-2 (done)   | N/A                                      | No                                        |
| Campaign runs in Observe    | **Not addressed**  | Phase 1.1 surfaces campaigns on Schedule | **Yes — Campaigns need an Observe phase** |
| Pulse evals in Observe      | **Not addressed**  | Phase 1.2 surfaces pulse on Schedule     | **Yes — Pulse needs an Observe phase**    |
| Agent sub-runs in workflows | Phase 3 (planned)  | N/A                                      | No                                        |
| Agent sub-runs in networks  | Phase 4 (planned)  | N/A                                      | No                                        |
| Workflow scheduling         | N/A                | Phase 0 fixes triggers                   | Workflows still can't be cron-scheduled   |
| Network scheduling          | N/A                | Phase 0 fixes triggers                   | Networks still can't be cron-scheduled    |
| Unified density/load        | N/A                | Phase 4 (density heatmap)                | No                                        |
| Cost projection             | N/A                | Phase 6                                  | No                                        |
| Health policies             | N/A                | Phase 7                                  | No                                        |

### Recommended Addition to Observability Plan

Add a **Phase 5: Campaign & Pulse in Observe**:

- Map `Campaign` to `UnifiedRun` shape (status, duration, cost, missions count)
- Map `PulseEvaluation` to `UnifiedRun` shape (evaluation results, rankings)
- Add `campaign` and `pulse` to the Kind filter
- Campaign detail panel: missions, tasks, AAR, costs
- Pulse eval detail panel: rankings, actions, report

This completes the god mode vision: **every scheduled, triggered, or manually executed primitive is visible in both Schedule (orchestration) and Observe (execution)**.

---

## Execution Order

| Priority | Phase   | What                                                        | Impact                                  | Effort     | Files       |
| -------- | ------- | ----------------------------------------------------------- | --------------------------------------- | ---------- | ----------- |
| **0**    | Phase 0 | Fix network triggers, fix event API                         | **Critical** — broken functionality     | Low        | 3 files     |
| **1**    | Phase 1 | Unified automations API (campaigns, pulse, correct stats)   | **Highest** — foundation for everything | Medium     | 1-2 files   |
| **2**    | Phase 2 | Severity bands, row tinting, failed count, last-run status  | **Highest** — immediate risk visibility | Low        | 1 file      |
| **3**    | Phase 3 | Search, filters (primitive/type/severity), sortable columns | **High** — manageability at scale       | Low-Medium | 1 file      |
| **4**    | Phase 4 | Execution density heatmap (all primitives)                  | **High** — load/concurrency awareness   | Medium     | 1 file      |
| **5**    | Phase 6 | Cost projection (all primitives)                            | **High** — changes scheduling behavior  | Medium     | 2 files     |
| **6**    | Phase 5 | Calendar overhaul (compression, filters, overlays)          | **High** — makes calendar usable        | Medium     | 1 file      |
| **7**    | Phase 7 | Auto-health policies                                        | **High** — bridges Schedule ↔ Command   | High       | 3+ files    |
| **8**    | Phase 8 | Dependency graph                                            | **Medium** — prevents cascade failures  | High       | Schema + UI |

---

## Files Changed Summary

| File                                               | Phase | Change                                                       |
| -------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `apps/agent/src/app/api/webhooks/[path]/route.ts`  | 0     | Add network entity type support                              |
| `apps/agent/src/app/api/triggers/event/route.ts`   | 0     | Fire workflow + network triggers, not just agent             |
| `apps/agent/src/lib/inngest-functions.ts`          | 0, 7  | Add networkTriggerFireFunction, health policy hook           |
| `apps/agent/src/app/api/live/automations/route.ts` | 1, 6  | Add campaigns, pulse, fix w/n stats, add cost data           |
| `apps/agent/src/app/schedule/page.tsx`             | 2-6   | Severity, filters, density, calendar, cost, primitive column |
| `packages/database/prisma/schema.prisma`           | 7, 8  | Health policy fields, dependency table                       |
| `apps/agent/src/lib/health-policy.ts` (new)        | 7     | Health policy evaluation logic                               |

---

## The "Control" Cockpit — Separate Plan

With Schedule upgraded to a full orchestration control plane, and Observe upgraded to full execution observability (per unified-observability.md), the four surfaces become:

| Surface      | Function                                          | Status                    |
| ------------ | ------------------------------------------------- | ------------------------- |
| **Command**  | Governance & decisions                            | Exists                    |
| **Observe**  | Execution observability (all runs)                | Exists + plan to extend   |
| **Schedule** | Orchestration & load management (all automations) | **This plan upgrades it** |
| **Control**  | System dynamics synthesis (meta-dashboard)        | **Needs separate plan**   |

The Control cockpit would be a read-only synthesis page pulling from all three:

- Agent/Workflow/Network/Campaign health aggregation
- Execution volume trends (from Observe)
- Cost trends (from Schedule + Observe)
- Failure rate trends (from Observe)
- Schedule load distribution (from Schedule)
- Active alerts and anomalies
- Autonomy level per agent (manual intervention rate)

This is the capstone. Schedule + Observe provide the data. Control synthesizes it into "is my system healthy?"

---

## Testing

After each phase:

1. `bun run type-check`
2. `bun run lint`
3. `bun run build`

Manual verification:

- **Phase 0:** Create a network trigger via webhook. Verify it fires and creates a NetworkRun.
- **Phase 1:** Schedule page shows campaign schedules (Knowledge Distiller template) and Pulse eval cycles. Workflow trigger shows correct run count from WorkflowRun table.
- **Phase 2:** Social Scout (46%) at top with red severity band. Failed count "~110F" visible.
- **Phase 3:** Search "pulse" → filters to PULSE automations + Pulse eval cycles. Primitive filter "Campaign" → shows only campaign schedules.
- **Phase 4:** Density bar shows peak at 10 PM with breakdown: "8 agent, 1 campaign, 1 pulse".
- **Phase 5:** Calendar week view: 30-min automations collapsed. Agent filter reduces noise.
- **Phase 6:** Cost column shows per-automation projected monthly cost. Summary card shows total.
- **Phase 7:** Test automation with health policy: set 60% threshold, simulate failures, verify auto-disable.

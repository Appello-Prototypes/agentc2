---
name: "Patterns Book — Plan 5: Strategic Agent Capabilities"
overview: "Add business outcome KPIs alongside operational metrics, build a capability matrix for agent taxonomy, implement user-tier dynamic agent behavior, create an intent router agent pattern, wire requiresApproval into the agent execution path, and enable full trace sharing between subagents. Addresses Patterns 1 (Whiteboard Capabilities), 2 (Evolve Architecture), 3 (Dynamic Agents), 4 (Human-in-the-Loop), 6 (Share Context Between Subagents), and 11 (List Critical Business Metrics)."
todos:
    - id: phase-1-business-kpis
      content: "Phase 1: Business outcome KPIs — configurable per-agent metrics beyond operational stats"
      status: pending
    - id: phase-2-capability-matrix
      content: "Phase 2: Capability matrix — structured taxonomy of what agents can do"
      status: pending
    - id: phase-3-user-tiers
      content: "Phase 3: User-tier dynamic agents — differentiated behavior by plan/role"
      status: pending
    - id: phase-4-intent-router
      content: "Phase 4: Intent router agent pattern — LLM-based intent classification and routing"
      status: pending
    - id: phase-5-agent-approval
      content: "Phase 5: Wire requiresApproval into agent execution path"
      status: pending
    - id: phase-6-trace-sharing
      content: "Phase 6: Full trace sharing between subagents"
      status: pending
isProject: false
---

# Plan 5: Strategic Agent Capabilities

**Book Patterns:** 1 (Whiteboard Capabilities), 2 (Evolve Architecture), 3 (Dynamic Agents), 4 (Human-in-the-Loop), 6 (Share Context Between Subagents), 11 (List Critical Business Metrics)

**Priority:** Medium — feature completeness and competitive advantage

---

## Phase 1: Business Outcome KPIs

**Problem:** The book says to measure a mix of accuracy metrics, domain-specific outcomes, and human team baselines. AgentC2's analytics are entirely operational: runs, latency, tokens, cost, success rate. There are no business outcome metrics like "resolution rate", "customer satisfaction", or "revenue impact."

### 1.1 KPI configuration model

**File:** `packages/database/prisma/schema.prisma`

```prisma
model AgentKPI {
    id       String  @id @default(cuid())
    agentId  String
    agent    Agent   @relation(fields: [agentId], references: [id], onDelete: Cascade)
    tenantId String?

    name          String // e.g., "Resolution Rate", "CSAT"
    description   String?
    category      String // "accuracy", "outcome", "efficiency", "human_baseline"
    unit          String // "percentage", "count", "score", "dollars", "minutes"
    direction     String // "higher_better", "lower_better"
    target        Float? // Target value (e.g., 95 for 95% resolution rate)
    humanBaseline Float? // What a human achieves on the same metric

    // Measurement
    source         String // "computed", "manual", "webhook", "feedback"
    computeQuery   String?   @db.Text // SQL or function name for computed KPIs
    currentValue   Float?
    lastMeasuredAt DateTime?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    snapshots AgentKPISnapshot[]

    @@unique([agentId, name])
    @@index([agentId, tenantId])
}

model AgentKPISnapshot {
    id         String   @id @default(cuid())
    kpiId      String
    kpi        AgentKPI @relation(fields: [kpiId], references: [id], onDelete: Cascade)
    value      Float
    measuredAt DateTime @default(now())
    metadata   Json?

    @@index([kpiId, measuredAt])
}
```

### 1.2 Built-in computed KPIs

**File:** `packages/agentc2/src/kpis/computed.ts` (new)

Pre-built computations that any agent can enable:

```typescript
export const BUILT_IN_KPIS: Record<string, KPIComputation> = {
    "resolution_rate": {
        name: "Resolution Rate",
        description: "Percentage of runs that resulted in positive feedback or no follow-up needed",
        category: "outcome",
        unit: "percentage",
        direction: "higher_better",
        compute: async (agentId, dateRange) => {
            const total = await prisma.agentRun.count({ where: { agentId, status: "COMPLETED", ... } });
            const resolved = await prisma.agentRun.count({
                where: { agentId, status: "COMPLETED", feedback: { thumbs: "up" }, ... }
            });
            return (resolved / total) * 100;
        }
    },
    "first_response_quality": {
        name: "First Response Quality",
        description: "Percentage of runs that complete successfully without needing a follow-up correction",
        category: "accuracy",
        // ...
    },
    "avg_handling_time": {
        name: "Average Handling Time",
        description: "Average time from user request to agent completion",
        category: "efficiency",
        unit: "seconds",
        direction: "lower_better",
        // ...
    },
    "cost_per_resolution": {
        name: "Cost Per Resolution",
        description: "Average cost per successful agent run",
        category: "efficiency",
        unit: "dollars",
        direction: "lower_better",
        // ...
    },
};
```

### 1.3 KPI measurement Inngest function

**File:** `apps/agent/src/lib/inngest-functions.ts`

Register `kpi/measure` — scheduled daily (cron) or on-demand:

- For each agent with configured KPIs
- Run the compute function
- Store snapshot
- If value crosses threshold (above target or below target), emit alert

### 1.4 KPI API

**File:** `apps/agent/src/app/api/agents/[id]/kpis/route.ts` (new)

- **GET**: List KPIs with current values and trends
- **POST**: Create custom KPI
- **POST** `/:kpiId/snapshot`: Record manual measurement
- **GET** `/:kpiId/history`: Time series of snapshots

### 1.5 KPI dashboard

**File:** `apps/agent/src/app/agents/[agentSlug]/analytics/kpis.tsx` (new)

Add "Business KPIs" tab to analytics:

- KPI cards showing current value, target, trend arrow, vs. human baseline
- Sparkline chart for each KPI
- Color coding: green (above target), yellow (near target), red (below target)
- Setup wizard for enabling built-in KPIs and creating custom ones

---

## Phase 2: Capability Matrix

**Problem:** The book's Pattern 1 describes "organizational design for agents" — listing, sorting, and grouping capabilities into a coherent architecture. AgentC2 has tool categories for UI grouping but no structured capability taxonomy or view of "what can all our agents do collectively?"

### 2.1 Capability model

**File:** `packages/database/prisma/schema.prisma`

```prisma
model AgentCapability {
    id      String @id @default(cuid())
    agentId String
    agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

    name        String // e.g., "Customer research", "Draft emails"
    category    String // e.g., "Research", "Communication", "Analysis"
    description String?
    dataSource  String? // What data does this capability access?
    toolIds     String[] // Tools that enable this capability
    maturity    String // "experimental", "beta", "production"
    priority    Int      @default(0) // For ordering

    createdAt DateTime @default(now())

    @@index([agentId])
}
```

### 2.2 Auto-generate capabilities from tools

**File:** `packages/agentc2/src/capabilities/generator.ts` (new)

```typescript
export async function generateCapabilityMap(agentSlug: string): Promise<AgentCapability[]> {
    const { agent, record } = await agentResolver.resolve({ slug: agentSlug });

    // Use LLM to analyze agent instructions + tool set → generate capabilities
    const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        prompt: `Given this agent's instructions and tools, list its capabilities:
            Instructions: ${record.instructions}
            Tools: ${record.tools.map((t) => t.toolId).join(", ")}

            For each capability, provide: name, category, description, which tools enable it.`,
        schema: z.array(capabilitySchema)
    });
    return object;
}
```

### 2.3 Capability matrix page

**File:** `apps/agent/src/app/workspace/capabilities/page.tsx` (new)

A workspace-level view showing all agents and their capabilities:

**Layout:**

- Matrix view: agents (columns) × capability categories (rows)
- Each cell shows the capabilities that agent has in that category
- Color by maturity (experimental/beta/production)
- Gaps are immediately visible (empty cells)

**Sidebar:**

- Filter by category, maturity, agent
- "Coverage gaps" panel: categories with no agents assigned
- "Overlaps" panel: capabilities covered by multiple agents (for deduplication)

### 2.4 Capability API

**File:** `apps/agent/src/app/api/agents/[id]/capabilities/route.ts` (new)

- **GET**: List capabilities
- **POST**: Create capability (manual or auto-generate)
- **PUT**: Update capability
- **DELETE**: Remove capability

**File:** `apps/agent/src/app/api/capabilities/matrix/route.ts` (new)

- **GET**: Full capability matrix across all agents in workspace

---

## Phase 3: User-Tier Dynamic Agents

**Problem:** The book shows agents differentiating between free/pro/enterprise users with different `topK`, model selection, and support levels. AgentC2 has `RequestContext` with `tenantId` but no explicit tier-based behavior.

### 3.1 Tier configuration

**File:** `packages/database/prisma/schema.prisma`

Add to `Agent`:

```prisma
model Agent {
    // ... existing fields
    tierConfig Json? // { "free": {...}, "pro": {...}, "enterprise": {...} }
}
```

Tier config shape:

```typescript
interface AgentTierConfig {
    [tier: string]: {
        modelOverride?: string; // e.g., "gpt-4o-mini" for free, "gpt-4o" for enterprise
        temperatureOverride?: number;
        maxStepsOverride?: number;
        memoryOverride?: {
            topK?: number; // e.g., 3 for free, 15 for enterprise
            lastMessages?: number;
        };
        toolRestrictions?: {
            allowed?: string[]; // Whitelist for this tier
            blocked?: string[]; // Blacklist for this tier
        };
        rateLimits?: {
            maxRunsPerHour?: number;
            maxRunsPerDay?: number;
        };
        priority?: "low" | "normal" | "high"; // Queue priority
    };
}
```

### 3.2 Tier resolution

**File:** `packages/agentc2/src/agents/resolver.ts`

In `hydrate()`, after loading the agent record:

```typescript
// Resolve user tier from RequestContext
const userTier = await resolveUserTier(requestContext); // "free" | "pro" | "enterprise"

// Apply tier overrides
if (record.tierConfig && userTier) {
    const tierOverrides = record.tierConfig[userTier];
    if (tierOverrides) {
        if (tierOverrides.modelOverride) record.modelName = tierOverrides.modelOverride;
        if (tierOverrides.temperatureOverride !== undefined)
            record.temperature = tierOverrides.temperatureOverride;
        if (tierOverrides.maxStepsOverride !== undefined)
            record.maxSteps = tierOverrides.maxStepsOverride;
        // ... apply memory, tool, and rate limit overrides
    }
}
```

### 3.3 Tier resolution function

**File:** `packages/agentc2/src/agents/tier-resolver.ts` (new)

```typescript
export async function resolveUserTier(ctx: RequestContext): Promise<string | null> {
    if (!ctx.resource?.userId) return null;

    // Look up user's organization subscription tier
    const membership = await prisma.member.findFirst({
        where: { userId: ctx.resource.userId },
        include: { organization: true }
    });

    return membership?.organization?.plan ?? "free";
}
```

### 3.4 Tier configuration UI

**File:** `apps/agent/src/app/agents/[agentSlug]/settings/tiers.tsx` (new)

- Show tier config as tabs (Free / Pro / Enterprise)
- Each tab: model picker, temperature slider, memory settings, tool allowlist/blocklist
- Preview: "Free users will see X, Enterprise users will see Y"

---

## Phase 4: Enhance Network Routing with Explicit Intent Classification

**AUDIT CORRECTION:** `buildNetworkAgent()` in `packages/agentc2/src/networks/runtime.ts` (lines 258–276) already creates a Mastra Agent with `agents`, `workflows`, and `tools` as sub-primitives. The LLM already does implicit intent-based routing by choosing which sub-primitive to call. This is NOT missing — but it can be improved.

**Actual gap:** The current routing relies entirely on the LLM's implicit tool selection. There's no explicit intent classification, no confidence scoring, no clarification flow for ambiguous requests, and no routing analytics.

### 4.1 Add explicit routing instructions to network agents

**File:** `packages/agentc2/src/networks/runtime.ts`

In `buildNetworkAgent()`, enhance the auto-generated instructions to include explicit routing guidance:

```typescript
const routingInstructions = `
## Routing Rules
When a user sends a message:
1. Identify the user's intent from their message
2. Match intent to the most appropriate specialist:
${primitives.map((p) => `   - "${p.name}": ${p.description || p.slug}`).join("\n")}
3. If the intent is ambiguous, ask ONE clarifying question before routing
4. If no specialist matches, explain what you can help with
5. Always tell the user which specialist you're routing to and why
`;
```

### 4.2 Add routing mode to Network model

**File:** `packages/database/prisma/schema.prisma`

```prisma
model Network {
    // ... existing fields
    routingMode String @default("auto") // "auto", "intent", "sequential", "parallel"
}
```

- `auto`: Current behavior (LLM implicit tool selection)
- `intent`: Explicit intent classification with confidence scoring and clarification
- `sequential`: Run primitives in order
- `parallel`: Run all primitives and merge results

### 4.3 Add routing analytics

**File:** `apps/agent/src/app/api/networks/[slug]/routing/route.ts` (new)

Track which primitives get routed to, how often, and with what confidence. This helps identify:

- Over-utilized primitives (may need splitting)
- Under-utilized primitives (may not be needed)
- Ambiguous routing patterns (need better instructions)

---

## Phase 5: Upgrade requiresApproval from Hard Block to Approval Queue

**AUDIT CORRECTION:** `requiresApproval` IS already wired in the invoke route (lines 201–208). When `true`, it returns a hard 403 — the agent simply refuses to run. The problem is that this is a blunt instrument: it blocks with no path to approval.

**Actual gap:** There's no "submit → queue → approve → execute" flow. It's just "block."

### 5.1 Replace hard 403 with approval queue

**File:** `apps/agent/src/app/api/agents/[id]/invoke/route.ts`

Change the existing `requiresApproval` check (lines 201–208) from a hard block to a queued approval:

```typescript
if (record.requiresApproval && !requestContext.metadata?.approvalId) {
    // Instead of returning 403, create an ApprovalRequest and return 202
    const approval = await prisma.approvalRequest.create({
        data: {
            type: "agent_run",
            entityId: record.id,
            entityType: "Agent",
            status: "PENDING",
            context: {
                input: inputText,
                agentSlug: record.slug,
                originalRequestContext: requestContext
            },
            organizationId: requestContext.tenantId,
            requestedBy: requestContext.resource?.userId
        }
    });

    return NextResponse.json(
        {
            status: "pending_approval",
            approvalId: approval.id,
            message: `This agent requires human approval. Your request has been queued.`
        },
        { status: 202 }
    );
}
```

### 5.2 Approval-then-execute endpoint

**File:** `apps/agent/src/app/api/approvals/[id]/resolve/route.ts` (new or extend existing reviews API)

When an approval is granted:

- Load the original request context from `approval.context`
- Execute the agent run with `metadata.approvalId` set (to skip the re-check)
- Store the result and notify the original requester

### 5.3 Chat route integration

**File:** `apps/agent/src/app/api/agents/[id]/chat/route.ts`

- On first message, if `requiresApproval`, return a system message: "Your request has been submitted for approval."
- When approved, process the message and send the response

### 5.4 Wire into existing approval notifications

The `humanEngagementWorkflow` and `ApprovalRequest` system already handle notifications via Slack and command dashboard. Reuse this — don't create a new notification path.

### 5.5 Per-tool approval (deferred tool execution)

For more granular HITL — approval between tool selection and execution:

```prisma
model AgentTool {
    // ... existing fields
    requiresApproval Boolean @default(false)
}
```

This is the "deferred tool execution" pattern from the book, and is the HITL pattern "most aligned with real-world workflows."

---

## Phase 6: Full Trace Sharing Between Subagents

**Problem:** The book recommends that subagents see the full trace (user request, agent research, tool calls, reasoning) rather than just a summary. AgentC2 shares memory via shared threads and scratchpad but doesn't share the full execution trace.

### 6.1 Trace context builder

**File:** `packages/agentc2/src/context/trace-context.ts` (new)

```typescript
export interface TraceContext {
    originalRequest: string;
    agentSlug: string;
    reasoning: string[]; // Key reasoning steps
    toolCalls: { tool: string; input: string; output: string; success: boolean }[];
    decisions: string[]; // Key decisions made and why
    constraints: string[]; // Constraints discovered during execution
}

export function buildTraceContext(run: AgentRun & { toolCalls: AgentToolCall[] }): TraceContext {
    return {
        originalRequest: run.inputText ?? "",
        agentSlug: run.agentSlug ?? "",
        reasoning: extractReasoningSteps(run),
        toolCalls: run.toolCalls.map((tc) => ({
            tool: tc.toolName,
            input: summarize(tc.inputJson, 200),
            output: summarize(tc.outputJson, 200),
            success: tc.success ?? true
        })),
        decisions: extractDecisions(run),
        constraints: extractConstraints(run)
    };
}
```

### 6.2 Pass trace context to subagents

**File:** `packages/agentc2/src/tools/agent-operations-tools.ts`

In `agent-invoke-dynamic`, add an option to include the parent's trace context:

```typescript
// In the tool's execute function:
if (options.shareTrace) {
    const parentTrace = buildTraceContext(currentRun);
    const traceMessage = formatTraceForSubagent(parentTrace);

    // Prepend trace context to the message sent to the subagent
    const enrichedMessage =
        `## Context from parent agent (${parentTrace.agentSlug})\n\n` +
        `### Original user request\n${parentTrace.originalRequest}\n\n` +
        `### Key decisions made\n${parentTrace.decisions.join("\n")}\n\n` +
        `### Relevant tool results\n${formatToolResults(parentTrace.toolCalls)}\n\n` +
        `---\n\n## Your task\n${message}`;
}
```

### 6.3 Configuration

Add to Agent schema:

```prisma
model Agent {
    // ... existing fields
    shareTraceWithSubagents Boolean @default(false)
}
```

When `true`, all subagent invocations automatically include the parent's trace context.

### 6.4 Session-level trace sharing

**File:** `packages/agentc2/src/tools/session-tools.ts`

Extend `session-invoke-peer` to support trace context:

- If the session's governance policy allows `memory_access: "full"`, include trace context
- If `read_only`, include a summarized version
- If `none`, don't share trace

### 6.5 Trace compression for context budget

Large traces can consume significant context. Apply the same compression logic from Plan 2:

- If trace context > `maxTraceTokens` (configurable, default 4000), summarize using LLM
- Preserve decisions and constraints; compress tool call details

---

## Verification

After completing all phases:

1. Configure 3 KPIs for an agent → confirm daily measurement runs → check dashboard shows trend
2. Auto-generate capabilities for 3 agents → view matrix → confirm gaps and overlaps visible
3. Configure tier overrides → invoke agent as free and enterprise user → confirm different model used
4. Create a network with intent routing → send ambiguous message → confirm router asks for clarification
5. Set `requiresApproval=true` → invoke agent → confirm 202 response → approve → confirm execution
6. Enable trace sharing → invoke parent agent → confirm subagent sees trace context
7. Run `bun run type-check && bun run lint && bun run build`

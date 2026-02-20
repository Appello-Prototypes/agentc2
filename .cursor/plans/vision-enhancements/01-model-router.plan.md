---
name: "Enhancement 1: Optional Model Router"
overview: "Add an optional model routing system to agents: Locked mode (force single model) or Auto mode (route by complexity to fast/primary/escalation models). Includes configure page UI, workspace chat override, trace annotations, and analytics."
todos:
    - id: schema-routing-config
      content: Add routingConfig JSON field to Agent model in Prisma schema and regenerate client
      status: pending
    - id: api-routing-config
      content: Update agent CRUD API routes to read/write routingConfig field
      status: pending
    - id: configure-ui-routing
      content: Add Model Routing section to configure page with Locked/Auto radio, fast model select, escalation model select, confidence threshold, budget-aware toggle
      status: pending
    - id: resolver-routing-logic
      content: Update agent resolver to read routingConfig and select model at inference time based on complexity classification
      status: pending
    - id: workspace-chat-indicator
      content: Add model tier indicator badge and routing mode display to workspace chat header alongside existing ModelSelector
      status: pending
    - id: trace-model-badge
      content: Annotate run trace steps with model tier badge (FAST/PRIMARY/ESCALATION) showing which model handled each step
      status: pending
    - id: analytics-routing-tab
      content: Add routing distribution section to analytics Comparison tab showing per-tier percentages, run counts, and cost savings vs all-primary
      status: pending
isProject: false
---

# Enhancement 1: Optional Model Router

## Goal

Allow agents to use different models for different complexity levels. The user can either force a single model (Locked mode) or enable automatic routing (Auto mode) where simple tasks go to a cheap/fast model and complex tasks escalate to a more capable one.

## Dependencies

- None. This enhancement is self-contained.

## Pre-requisites to Understand

- The workspace chat already has a `ModelSelector` component at [apps/agent/src/components/ModelSelector.tsx](apps/agent/src/components/ModelSelector.tsx) with `ModelOverride` type and `AVAILABLE_MODELS` array
- The workspace page at [apps/agent/src/app/workspace/page.tsx](apps/agent/src/app/workspace/page.tsx) already passes `modelOverride` to the chat transport (line ~529)
- The agent configure page at [apps/agent/src/app/agents/[agentSlug]/configure/page.tsx](apps/agent/src/app/agents/[agentSlug]/configure/page.tsx) already has Model Provider + Model Name selects, ModelConfig interface with thinking/parallelToolCalls/reasoningEffort
- The Prisma Agent model at [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma) line 627 has `modelConfig Json?` for provider-specific config
- The analytics page at [apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx](apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx) already has a "Comparison" tab showing model usage table

---

## Step 1: Schema Change

**File:** [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma)

Add a new JSON field to the Agent model (after `modelConfig`):

```prisma
routingConfig Json? // {mode: "locked"|"auto", fastModel: {provider, name}, escalationModel: {provider, name}, confidenceThreshold: 0.7, budgetAware: true}
```

The JSON shape:

```typescript
interface RoutingConfig {
    mode: "locked" | "auto";
    fastModel?: { provider: string; name: string };
    escalationModel?: { provider: string; name: string };
    confidenceThreshold?: number; // 0-1, default 0.7
    budgetAware?: boolean; // shift to fast model when budget > alertAt%
}
```

Run `bun run db:generate` and `bun run db:push` after.

---

## Step 2: API Update

**File:** The agent CRUD API route (find via `grep -r "routingConfig" apps/agent/src/app/api/agents/` or check the GET/PUT route for agent by slug).

Ensure `routingConfig` is:

- Returned in GET responses (add to the select/include)
- Accepted in PUT/PATCH body (write to the agent record)

The configure page already fetches the agent via `GET /api/agents/{slug}` and saves via PUT. Add `routingConfig` to both paths.

---

## Step 3: Configure Page UI

**File:** [apps/agent/src/app/agents/[agentSlug]/configure/page.tsx](apps/agent/src/app/agents/[agentSlug]/configure/page.tsx)

**Location:** After the existing model configuration section (modelProvider, modelName, temperature selects) and before the Model Config section (thinking, parallelToolCalls).

**What to add:**

1. Add `routingConfig` to the Agent interface (around line 34-75):

```typescript
interface RoutingConfig {
    mode: "locked" | "auto";
    fastModel?: { provider: string; name: string };
    escalationModel?: { provider: string; name: string };
    confidenceThreshold?: number;
    budgetAware?: boolean;
}

// Add to Agent interface:
routingConfig?: RoutingConfig | null;
```

1. Add state for routing config in the component.
2. Add a new Card section in the "model" tab with:

- Radio group: "Locked" (always use primary model) vs "Auto" (route by complexity)
- When "Auto" selected, expand to show:
    - Fast Model: provider Select + model name Select (reuse the same provider/model select pattern already on this page)
    - Escalation Model: provider Select + model name Select
    - Confidence Threshold: Input type=number, 0-1, default 0.7
    - Budget-Aware Routing: Switch toggle
- When "Locked" selected, collapse the routing section

1. Include `routingConfig` in the save payload.

**Components used:** `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Input`, `Switch`. All already imported on this page.

---

## Step 4: Agent Resolver Routing Logic

**File:** [packages/agentc2/src/agents/index.ts](packages/agentc2/src/agents/index.ts) or the resolver file.

This is the backend logic. When an agent with `routingConfig.mode === "auto"` receives a request:

1. **Classify complexity** -- Use a lightweight heuristic or a fast LLM call to classify the input as "simple" / "moderate" / "complex". Heuristics could include: input length, presence of multi-step instructions, question complexity keywords.
2. **Select model tier**:

- Simple -> fastModel
- Moderate -> primary model
- Complex or low-confidence -> escalationModel

1. **Budget override** -- If `budgetAware` is true and current month spend exceeds the alert threshold, bias toward fastModel for moderate tasks too.
2. **Record the decision** -- Annotate the run trace with `{ routingTier: "FAST"|"PRIMARY"|"ESCALATION", routingReason: "..." }`.

If `routingConfig.mode === "locked"` or `routingConfig` is null, use the primary model as today. No behavior change.

---

## Step 5: Workspace Chat Indicator

**File:** [apps/agent/src/app/workspace/page.tsx](apps/agent/src/app/workspace/page.tsx)

**Location:** The chat header area (around line 880-896) where `AgentSelector`, `ModelSelector`, and `ThinkingToggle` are rendered.

**What to add:**

- A small `Badge` next to the ModelSelector showing the routing mode: `[Auto]` or `[Locked]`
- When routing is in Auto mode, the badge shows which tier the last response used: `[Auto: FAST]`
- The existing `ModelSelector` already provides a manual override that takes precedence over routing. If the user manually selects a model via ModelSelector, that override should disable auto-routing for the session.

This is a display-only change (Badge + conditional text). The existing `modelOverride` state already handles forcing a specific model.

---

## Step 6: Trace Annotation

**File:** The trace/run detail component (find via the runs page or trace page components).

**What to add:**

Each step in the trace that involved an LLM call should show a Badge with the routing tier:

- Blue Badge: `FAST` + model name
- Default Badge: `PRIMARY` + model name
- Orange/Secondary Badge: `ESCALATION` + model name

The routing tier data comes from the run trace metadata (set in Step 4). If no routing data exists (agent has routing disabled), show nothing -- backwards compatible.

---

## Step 7: Analytics Addition

**File:** [apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx](apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx)

**Location:** Within the existing "Comparison" tab (TabsContent value="comparison"), add a section above or below the existing model comparison table.

**What to add:**

A "Routing Distribution" card showing:

- 3 progress bars (Fast / Primary / Escalation) with percentage of requests and cost for each
- A "Cost Savings" metric: calculate what the total cost would have been if all requests used the primary model, subtract actual cost

The data comes from the existing analytics API -- extend it to group runs by `routingTier` from the trace metadata.

---

## Testing

1. Create an agent, leave routingConfig null -- verify no behavior change
2. Set routingConfig to `{mode: "locked"}` -- verify primary model always used
3. Set routingConfig to `{mode: "auto", fastModel: {provider: "openai", name: "gpt-4o-mini"}}` -- verify simple inputs route to fast model
4. Check trace shows correct tier badges
5. Check analytics shows routing distribution
6. Check workspace chat shows routing indicator
7. Run `bun run type-check`, `bun run lint`, `bun run build`

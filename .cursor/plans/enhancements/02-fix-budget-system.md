# 02 -- Fix Budget System Behavior

**Priority:** TIER 1 (Bug Fix)
**Effort:** Low (1-2 hours)
**Dependencies:** None

## Problem Statement

The budget system has confusing behavior:

- email-triage has a $5 budget but has spent $27.73 (554%) because `hardLimit: false`
- `hardLimit: false` means "alert but keep running" -- this is the DEFAULT
- Users expect: if I set a budget, it should stop. If I don't set one, it runs freely.
- Currently, setting a budget without explicitly toggling `hardLimit` gives a false sense of control

## Current State

**Schema:** `packages/database/prisma/schema.prisma`

```prisma
model BudgetPolicy {
    enabled         Boolean @default(false)
    monthlyLimitUsd Float?
    alertAtPct      Float?  @default(80)
    hardLimit       Boolean @default(false) // <-- THIS IS THE PROBLEM
}
```

**Enforcement:** `apps/agent/src/lib/inngest-functions.ts` (lines 234-269)

- Checks budget after run completion
- Creates alerts when threshold exceeded
- Does NOT block runs when `hardLimit: false`

**API:** `apps/agent/src/app/api/agents/[id]/budget/route.ts`

- PUT endpoint upserts budget policy
- Accepts `hardLimit` parameter

**MCP Tool:** `packages/agentc2/src/tools/mcp-schemas/agent-quality.ts`

- `agent_budget_update` tool passes `hardLimit` through

## Implementation Plan

### Step 1: Change default `hardLimit` to `true`

**File:** `packages/database/prisma/schema.prisma`

```prisma
model BudgetPolicy {
    enabled         Boolean @default(false)
    monthlyLimitUsd Float?
    alertAtPct      Float?  @default(80)
    hardLimit       Boolean @default(true) // Changed from false to true
}
```

Run `bun run db:generate` after this change. Consider a migration to flip existing `false` values.

### Step 2: Auto-enable `hardLimit` when budget is set via API

**File:** `apps/agent/src/app/api/agents/[id]/budget/route.ts`

When a user sets `monthlyLimitUsd` but doesn't explicitly pass `hardLimit`, default to `true`:

```typescript
// If setting a budget amount, default hardLimit to true unless explicitly set to false
const hardLimit =
    body.hardLimit !== undefined
        ? body.hardLimit
        : body.monthlyLimitUsd !== undefined
          ? true
          : (existingPolicy?.hardLimit ?? true);
```

### Step 3: Add pre-run budget check (not just post-run)

**File:** `packages/agentc2/src/agents/resolver.ts` or the agent invocation path

Currently, budget is only checked AFTER a run completes (in Inngest). For hard limits, we need a PRE-RUN check that rejects the run before it starts:

```typescript
// Before executing agent, check budget
if (budgetPolicy?.enabled && budgetPolicy.hardLimit && budgetPolicy.monthlyLimitUsd) {
    const currentMonthCost = await getCurrentMonthCost(agentId);
    if (currentMonthCost >= budgetPolicy.monthlyLimitUsd) {
        throw new Error(
            `Agent budget exceeded: $${currentMonthCost.toFixed(2)} / $${budgetPolicy.monthlyLimitUsd} monthly limit`
        );
    }
}
```

### Step 4: Fix email-triage budget specifically

Using the MCP tool or API, update email-triage budget to a realistic level:

- `monthlyLimitUsd`: 50 (covers ~500 runs at ~$0.10/run)
- `hardLimit`: true
- `alertAtPct`: 70

### Step 5: Set budget policies on other production agents

| Agent                | Monthly Limit | Rationale                           |
| -------------------- | ------------- | ----------------------------------- |
| assistant            | $20           | ~247 runs, ~$0.02/run average       |
| slack-hello-world    | $15           | High volume but cheap (gpt-4o-mini) |
| workspace-concierge  | $10           | Low volume but expensive per run    |
| canvas-builder       | $15           | Moderate use, expensive per run     |
| welcome / welcome-v2 | $5            | Low cost per run                    |

## Files to Modify

| File                                                 | Change                                        |
| ---------------------------------------------------- | --------------------------------------------- |
| `packages/database/prisma/schema.prisma`             | Change `hardLimit` default to `true`          |
| `apps/agent/src/app/api/agents/[id]/budget/route.ts` | Auto-set `hardLimit: true` when budget is set |
| Agent invocation path (resolver or API)              | Add pre-run budget check for hard limits      |

## Acceptance Criteria

- [ ] Setting a budget without specifying `hardLimit` defaults to hard stop
- [ ] Runs are rejected BEFORE execution when budget is exceeded (hard limit)
- [ ] email-triage has a realistic $50/month budget with hard limit
- [ ] All production agents have budget policies set
- [ ] `bun run type-check` passes
- [ ] `bun run build` passes

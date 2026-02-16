# Cost Verification Audit

**Campaign**: Competitive Intelligence Report — AI Agent Frameworks (v2)
**Campaign ID**: `cmlobo02g0206v6eios1fqtxu`
**Date**: 2026-02-15
**Duration**: 22:33:43 → 22:49:27 UTC (~16 minutes total, ~9 minutes execution)

---

## Executive Finding: COSTS ARE INFLATED ~5x BY A HARDCODED FORMULA BUG

The campaign's reported cost of **$31.92** is **approximately 5x higher than the actual API cost**. The real cost is approximately **$6.37**.

---

## Root Cause: Hardcoded Cost Formula in `campaign-functions.ts`

The campaign pipeline uses a hardcoded cost formula at **two locations** in `apps/agent/src/lib/campaign-functions.ts`:

```
Line 119:  const costUsd = tokenUsage.promptTokens * 0.000015 + tokenUsage.completionTokens * 0.000075;
Line 993:  const costUsd = promptTokens * 0.000015 + completionTokens * 0.000075;
```

This formula assumes:

- **$15/million input tokens** ($0.000015 per token)
- **$75/million output tokens** ($0.000075 per token)

### Actual Anthropic Pricing (from `cost-calculator.ts`)

| Model                      | Input/1M                 | Output/1M                | Used By                                               |
| -------------------------- | ------------------------ | ------------------------ | ----------------------------------------------------- |
| `claude-sonnet-4-20250514` | **$3.00**                | **$15.00**               | workspace-concierge (task execution)                  |
| `claude-opus-4-6`          | **Not in pricing table** | **Not in pricing table** | campaign-analyst, campaign-planner, campaign-reviewer |

The hardcoded formula charges **5x** the actual rate for Claude Sonnet:

- Hardcoded: $15/1M input + $75/1M output
- Actual: $3/1M input + $15/1M output

### Impact: The System Has a Proper Cost Calculator That Is Not Being Used

File `apps/agent/src/lib/cost-calculator.ts` contains `calculateCost()` with correct model-specific pricing for 30+ models. The campaign pipeline **does not import or use this function**.

---

## Run-by-Run Cost Verification

### All 12 Agent Runs in This Campaign

| #   | Run Label        | Model           | Prompt Tokens | Completion Tokens | Recorded Cost | Correct Cost (Sonnet $3/$15; Opus ~$15/$75) | Overcharge    |
| --- | ---------------- | --------------- | ------------- | ----------------- | ------------- | ------------------------------------------- | ------------- |
| 1   | campaign-analyst | claude-opus-4-6 | 10,098        | 3,010             | $0.377        | ~$0.377\*                                   | ~1x           |
| 2   | campaign-planner | claude-opus-4-6 | 158,067       | 5,811             | $2.807        | ~$2.807\*                                   | ~1x           |
| 3   | Scrape LangGraph | claude-sonnet-4 | 719,068       | 2,650             | $10.985       | **$2.197**                                  | **5.0x**      |
| 4   | Scrape AutoGen   | claude-sonnet-4 | 956,025       | 2,617             | $14.537       | **$2.907**                                  | **5.0x**      |
| 5   | Scrape CrewAI    | (failed)        | 0             | 0                 | $0.000        | $0.000                                      | --            |
| 6   | Search GitHub    | (failed)        | 0             | 0                 | $0.000        | $0.000                                      | --            |
| 7   | reviewer (m1)    | claude-opus-4-6 | 105,944       | 3,392             | $1.844        | ~$1.844\*                                   | ~1x           |
| 8   | reviewer (m2)    | claude-opus-4-6 | 61,375        | 3,115             | $1.154        | ~$1.154\*                                   | ~1x           |
| 9   | Create Doc       | claude-sonnet-4 | 245,309       | 2,192             | $3.844        | **$0.769**                                  | **5.0x**      |
| 10  | Return Link      | claude-sonnet-4 | 164,165       | 1,237             | $2.555        | **$0.511**                                  | **5.0x**      |
| 11  | reviewer (m3)    | claude-opus-4-6 | 84,185        | 3,628             | $1.535        | ~$1.535\*                                   | ~1x           |
| 12  | reviewer (AAR)   | claude-opus-4-6 | 113,017       | 6,033             | $2.148        | ~$2.148\*                                   | ~1x           |
|     | **TOTALS**       |                 | **2,617,253** | **33,685**        | **$41.785**   | **~$16.25**                                 | **~2.6x avg** |

_Note: The Opus runs happen to match because the hardcoded rate ($15/$75) is coincidentally the same as Opus pricing ($15/$75). But for Sonnet runs (the bulk of cost), the overcharge is exactly 5x._

### Task-Level Cost (stored in `MissionTask`)

Only task execution runs (not analyst/planner/reviewer runs) are counted in the campaign's `totalCostUsd`:

| Task             | Recorded Cost | Correct Cost |
| ---------------- | ------------- | ------------ |
| Scrape LangGraph | $10.985       | $2.197       |
| Scrape AutoGen   | $14.537       | $2.907       |
| Create Doc       | $3.844        | $0.769       |
| Return Link      | $2.555        | $0.511       |
| **Task Total**   | **$31.921**   | **$6.384**   |

**Actual campaign task cost: ~$6.38** (not $31.92)

---

## Cost Discrepancy: Campaign Total vs All Runs

| Metric                       | Value     |
| ---------------------------- | --------- |
| Campaign `totalCostUsd` (DB) | $31.92    |
| Sum of all 12 run costs      | $41.79    |
| **Gap**                      | **$9.86** |

The gap exists because the campaign total only increments from `executeTask()` -- it does **not** include costs from:

- `invokeCampaignAgent()` calls (analyst, planner, reviewer, AAR)
- These 6 runs cost $9.86 combined but are never added to the campaign total

**Bug**: Campaign total underreports actual spend by excluding system agent costs.

---

## Token Count Verification

The token counts recorded in the DB are accurate -- they come from the AI SDK's response metadata. The issue is purely in the **cost multiplication**, not the token counting.

| Metric            | DB Value  | Verified                                          |
| ----------------- | --------- | ------------------------------------------------- |
| Total tokens      | 2,093,263 | Matches sum of 6 task runs (excludes system runs) |
| All-runs total    | 2,650,938 | Includes all 12 runs (tasks + system)             |
| Prompt tokens     | 2,617,253 | 98.7% of total (expected for scraping)            |
| Completion tokens | 33,685    | 1.3% of total (very low output ratio)             |

---

## Fixes Required

### Fix 1: Use `calculateCost()` in `campaign-functions.ts`

Replace both hardcoded formulas:

```typescript
// BEFORE (line 119 and 993):
const costUsd = promptTokens * 0.000015 + completionTokens * 0.000075;

// AFTER:
import { calculateCost } from "@/lib/cost-calculator";
const costUsd = calculateCost(
    record.modelName,
    record.modelProvider,
    promptTokens,
    completionTokens
);
```

### Fix 2: Add `claude-opus-4-6` to cost-calculator pricing table

```typescript
"claude-opus-4-6": { inputPer1M: 15.0, outputPer1M: 75.0 },
```

### Fix 3: Include system agent costs in campaign total

The `invokeCampaignAgent()` function should also increment `campaign.totalCostUsd`.

---

## What the Real Cost Breakdown Should Be

With correct pricing, the true campaign cost breakdown:

| Category                                           | Correct Cost |
| -------------------------------------------------- | ------------ |
| **Task execution** (workspace-concierge, Sonnet)   | $6.38        |
| **System agents** (analyst/planner/reviewer, Opus) | $9.87        |
| **True total**                                     | **$16.25**   |

The system agent overhead ($9.87) is actually more expensive than the task execution ($6.38) because the reviewers use Opus (which is 5x more expensive per input token than Sonnet). This reveals another optimization: **campaign-reviewer should use a cheaper model for routine AAR generation**.

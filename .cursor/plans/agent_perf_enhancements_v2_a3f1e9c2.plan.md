---
name: Agent Performance Enhancements v2
overview: "Eight performance improvements: switch BigJim2 to adaptive thinking, enable Anthropic native context management, enable model routing with a fast model, remove the runReady TTFT gate, add tool result compression, add per-turn cost caps, emit per-step cost metrics to the client, and pre-warm the hydration cache on startup."
todos:
    - id: adaptive-thinking
      content: Switch BigJim2 to adaptive thinking via MCP agent_update (thinking.type enabled→adaptive, remove budgetTokens)
      status: pending
    - id: context-management
      content: Enable Anthropic native context management on BigJim2 via MCP (compact_20260112 at 80% of context window)
      status: pending
    - id: model-routing
      content: "Enable auto model routing on BigJim2 via MCP: fastModel=claude-3-5-haiku, confidenceThreshold=0.3"
      status: pending
    - id: ttft-gate
      content: Remove the await runReady gate in chat/route.ts — make run metadata a non-blocking race so text streams immediately
      status: pending
    - id: tool-result-compression
      content: "Add tool result compression in chat/route.ts: truncate tool results >3000 chars before feeding back to model"
      status: pending
    - id: per-turn-cost-cap
      content: "Add per-turn cost cap in chat/route.ts: force turn-complete if accumulated cost exceeds $0.50 per turn"
      status: pending
    - id: step-cost-metrics
      content: Emit per-step cost as data parts to the client via UIMessageStreamWriter for real-time cost visibility
      status: pending
    - id: cache-prewarm
      content: Pre-warm hydration cache for top agents on first request via a lightweight init function in resolver.ts
      status: pending
isProject: false
---

# Agent Performance Enhancements v2

## Problem

After the best-practices overhaul, BigJim2's latest run shows: 55,535 prompt tokens for a simple "Go" continuation, $0.18 cost per turn, 28s duration. The platform is functional but not cost-optimized. Key gaps: fixed thinking budget wastes tokens on simple inputs, no model routing for trivial messages, tool results are fed back verbatim (inflating context), and no cost guardrails per turn.

## Current Baseline (from latest run)

| Metric            | Run 1 ("hey man") | Run 2 ("Go") |
| ----------------- | ----------------- | ------------ |
| Prompt Tokens     | 19,563            | 55,535       |
| Completion Tokens | 514               | 975          |
| Cost              | $0.066            | $0.181       |
| Duration          | 17.2s             | 28.3s        |
| Steps             | 6                 | 6            |
| Tool Calls        | 3                 | 3            |

## Changes

### 1. Switch BigJim2 to Adaptive Thinking (MCP only)

**No code changes.** Update via `agent_update`:

- `modelConfig.anthropic.thinking.type`: `"enabled"` → `"adaptive"`
- Remove `modelConfig.anthropic.thinking.budgetTokens` (not used with adaptive)

Adaptive thinking automatically scales: simple greetings get ~100 thinking tokens, complex orchestration gets thousands. This should reduce cost on Run 1 ("hey man") significantly while keeping quality on complex turns.

**Important:** The `chat/route.ts` finish-tool pattern already handles adaptive thinking correctly (falls back to `toolChoice: "auto"` when thinking is enabled). No code change needed.

### 2. Enable Anthropic Native Context Management (MCP only)

**No code changes.** Update BigJim2's `modelConfig.anthropic.contextManagement`:

```json
{
    "edits": [
        {
            "type": "compact_20260112",
            "trigger": { "type": "input_tokens", "value": 80000 },
            "keep": { "type": "thinking_turns", "value": 2 },
            "instructions": "Preserve all task statuses, tool results from the last 3 steps, and any user directives. Summarize older context."
        }
    ]
}
```

This tells the AI SDK to automatically summarize/compact context when input tokens exceed 80K, keeping the last 2 thinking turns intact. Prevents the prompt from growing unbounded on long multi-turn conversations.

### 3. Enable Auto Model Routing (MCP only)

**No code changes.** Update BigJim2's `routingConfig`:

```json
{
    "mode": "auto",
    "fastModel": { "provider": "anthropic", "name": "claude-3-5-haiku-20241022" },
    "confidenceThreshold": 0.3,
    "budgetAware": true
}
```

Simple messages like "hey", "go", "yes" score <0.2 on the complexity classifier and will route to Haiku ($1/M input vs $3/M). The routing infrastructure already exists in `resolver.ts` — we just need to unlock it via config.

**Risk:** Haiku doesn't support extended thinking. The resolver already handles this — when `modelOverride` is set, it uses the override model which bypasses the agent's thinking config. But we need to verify the finish-tool pattern works with Haiku (it should, since Haiku supports `toolChoice: "required"`).

### 4. Remove `runReady` TTFT Gate

**File:** `apps/agent/src/app/api/agents/[id]/chat/route.ts` (~line 606)

Currently:

```typescript
if (runReady) {
    await runReady; // BLOCKS text streaming until DB write completes
}
```

Change to a non-blocking pattern that sends run metadata when ready but doesn't gate text streaming:

```typescript
// Don't block text streaming on run recording — send metadata when available
if (runReady) {
    runReady
        .then(() => {
            if (run) {
                writer.write({
                    type: "data-run-metadata",
                    data: {
                        runId: run.runId,
                        turnId: turnHandle?.turnId,
                        turnIndex: turnHandle?.turnIndex,
                        messageId
                    }
                });
            }
        })
        .catch(() => {});
}
```

Remove the existing `if (run) { writer.write(...) }` block after the `await`. This saves 200-500ms on time-to-first-token since the DB write for run recording no longer blocks the stream.

### 5. Tool Result Compression

**File:** `apps/agent/src/app/api/agents/[id]/chat/route.ts`

In the `handleToolChunk` function, when a `tool-result` is received, check the result size. If it exceeds a threshold, truncate it before it gets fed back to the model as context in subsequent steps.

This doesn't change what the UI shows (we still send the full result to the client), but reduces prompt tokens on subsequent model calls.

Add a constant and helper:

```typescript
const MAX_TOOL_RESULT_CHARS = 3000;

function compressToolResult(result: unknown): unknown {
    const str = typeof result === "string" ? result : JSON.stringify(result);
    if (!str || str.length <= MAX_TOOL_RESULT_CHARS) return result;
    // For JSON objects, try to preserve structure with truncated values
    if (typeof result === "object" && result !== null) {
        try {
            const truncated = JSON.stringify(result, (_, v) => {
                if (typeof v === "string" && v.length > 500) {
                    return v.slice(0, 500) + "…[truncated]";
                }
                return v;
            });
            if (truncated.length <= MAX_TOOL_RESULT_CHARS) return JSON.parse(truncated);
        } catch {}
    }
    return str.slice(0, MAX_TOOL_RESULT_CHARS) + "\n…[truncated from " + str.length + " chars]";
}
```

**Important caveat:** This is tricky because Mastra's `agent.stream()` handles tool result feeding internally — we don't control what gets fed back to the model. The compression would need to happen at the Mastra tool level (wrapping tool `execute` functions) or via an output processor.

**Alternative approach:** Use the existing `ToolCallFilter` processor or add a new `ToolResultCompressor` processor in the resolver that wraps tool results before they're fed back.

Actually, the simplest high-impact approach: configure `contextConfig.toolResultCompression` on BigJim2 (if the resolver supports it), or add it to the `TokenLimiter` output processor which already runs on agent responses.

### 6. Per-Turn Cost Cap

**File:** `apps/agent/src/app/api/agents/[id]/chat/route.ts`

Inside the `finish-step` handler (line ~1061), after accumulating step tokens, calculate running cost and check against a cap:

```typescript
// Inside finish-step handler, after accumulating tokens
const runningCost = calculateCostDetailed(
    record?.modelName || "unknown",
    record?.modelProvider || "unknown",
    { promptTokens: accumulatedInputTokens, completionTokens: accumulatedOutputTokens }
);

const PER_TURN_COST_CAP_USD = record?.maxSpendUsd
    ? record.maxSpendUsd / 30 // daily budget = monthly/30, per-turn = daily/10
    : 0.5; // default $0.50 per turn

if (runningCost > PER_TURN_COST_CAP_USD) {
    console.warn(
        `[Agent Chat] Per-turn cost cap exceeded for "${id}": $${runningCost.toFixed(4)} > $${PER_TURN_COST_CAP_USD}. ` +
            `Accumulated: ${accumulatedInputTokens} in + ${accumulatedOutputTokens} out.`
    );
    // Emit a warning to the client
    w.write({
        type: "data-cost-warning",
        data: { runningCost, cap: PER_TURN_COST_CAP_USD, message: "Turn cost cap reached" }
    });
}
```

Note: We can't easily abort mid-stream without breaking the response. The warning is informational for now — it surfaces cost awareness to the UI. A hard cap would require modifying the stream consumption loop to break early, which risks orphaned state.

### 7. Per-Step Cost Metrics to Client

**File:** `apps/agent/src/app/api/agents/[id]/chat/route.ts`

In the `finish-step` handler, emit a data part with per-step cost info so the UI can show real-time cost:

```typescript
// After calculating step usage, emit cost data to client
if (stepUsage) {
    const stepCost = calculateCostDetailed(
        record?.modelName || "unknown",
        record?.modelProvider || "unknown",
        { promptTokens: inTok, completionTokens: outTok }
    );
    w.write({
        type: "data-step-cost",
        data: {
            step: stepCounter,
            inputTokens: inTok,
            outputTokens: outTok,
            costUsd: stepCost,
            cumulativeCostUsd: runningCost
        }
    });
}
```

The `RunActivityLog` component can then display running cost as the agent works.

### 8. Hydration Cache Pre-warming

**File:** `packages/agentc2/src/agents/resolver.ts`

Add a `prewarm()` method to `AgentResolver` that pre-resolves the top N most recently used agents:

```typescript
async prewarm(limit = 5): Promise<void> {
    try {
        const topAgents = await prisma.agent.findMany({
            where: { isActive: true },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: { slug: true }
        });

        const results = await Promise.allSettled(
            topAgents.map(a => this.resolve({ slug: a.slug }))
        );

        const warmed = results.filter(r => r.status === "fulfilled").length;
        console.log(`[AgentResolver] Pre-warmed ${warmed}/${topAgents.length} agents`);
    } catch (e) {
        console.warn("[AgentResolver] Pre-warm failed:", e);
    }
}
```

Call it lazily on the first chat request (not on server startup, since the resolver needs DB access):

```typescript
// At module level
let prewarmed = false;

// In the POST handler, before resolve:
if (!prewarmed) {
    prewarmed = true;
    agentResolver.prewarm().catch(() => {}); // fire and forget
}
```

## Execution Order

1. **Items 1-3** (MCP config only, zero code risk) — do first
2. **Item 4** (TTFT gate) — small code change, high impact
3. **Item 7** (step cost metrics) — adds observability
4. **Item 6** (cost cap warning) — adds safety
5. **Item 8** (cache prewarm) — small code change
6. **Item 5** (tool result compression) — most complex, needs careful testing

## Expected Impact

| Enhancement             | Token Savings                      | Cost Savings          | Latency Savings         |
| ----------------------- | ---------------------------------- | --------------------- | ----------------------- |
| Adaptive thinking       | -30% completion on simple turns    | -$0.02/simple turn    | -2-5s thinking time     |
| Context management      | Caps prompt at 80K                 | Prevents runaway cost | Prevents timeouts       |
| Model routing           | -60% on simple turns (Haiku)       | -$0.04/simple turn    | -5-10s (Haiku faster)   |
| TTFT gate removal       | None                               | None                  | -200-500ms TTFT         |
| Tool result compression | -20-40% prompt on tool-heavy turns | -$0.01-0.03/turn      | Faster model processing |
| Cost cap                | Prevents runaways                  | Prevents >$0.50/turn  | N/A                     |
| Step cost metrics       | None                               | Awareness             | None                    |
| Cache prewarm           | None                               | None                  | -1.7s first request     |

## Risks

- **Adaptive thinking + finish-tool pattern**: Already tested and working. `toolChoice: "auto"` is used when thinking is active. No risk.
- **Model routing to Haiku**: Haiku supports `toolChoice: "required"` but NOT extended thinking. When routed to Haiku, the finish-tool pattern should use `toolChoice: "required"` (since thinking is off). Need to verify the detection logic works for routed models, not just the agent's configured model.
- **Tool result compression**: Could break tools that rely on their exact output being fed back. Need to only compress on the model-facing side, not the actual tool execution.
- **TTFT gate**: Run metadata may arrive after the first few text deltas. The client needs to handle late-arriving run metadata gracefully — verify `workspace/page.tsx` handles this.

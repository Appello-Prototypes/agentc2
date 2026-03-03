# Context Management Architecture: Best-in-Class Recommendation

## Problem Statement

BigJim2's "Go ahead and build your foundation" run consumed **265K prompt tokens across 6 steps**, costing **$5.76 for a single invocation**. Root cause analysis reveals the platform has a **dual-system collision**: `managed-generate.ts` (530 lines) reimplements a multi-step tool-call loop that Mastra/AI SDK already provides natively via `agent.generate(input, { maxSteps })`. Both systems load and save to the same thread memory simultaneously — causing double-counted context, thinking token leakage, and semantic recall amplification on every step.

The correct fix is not to coordinate two systems. It is to **consolidate to one**.

---

## What Best-in-Class Looks Like

### Anthropic's Official Guidance (Claude API)

Anthropic's architecture treats context as a **three-zone prompt**:

| Zone                | Contents                                                | Management Strategy                                                                                                                                       |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stable Prefix**   | System instructions, tool schemas                       | Prompt caching (`cache_control: ephemeral`). Cached reads cost 0.1x base input price.                                                                     |
| **Editable Middle** | Conversation history, old tool results, thinking blocks | Context editing strategies: `clear_thinking_20251015` strips old thinking blocks; `clear_tool_uses_20250919` replaces old tool results with placeholders. |
| **Fresh Suffix**    | Current turn input, recent tool results                 | Full fidelity, no compression.                                                                                                                            |

**Key principles**:

1. **Thinking blocks are ephemeral.** Anthropic's API **automatically strips thinking blocks from previous turns** within a single `generate()` call. They do not accumulate in context. If you're manually saving thinking blocks to memory and re-injecting them via an external loop, you're bypassing this optimization and paying full input token price for content the API was designed to discard.

2. **Prompt caching for agentic loops.** Research (arXiv 2601.06007) shows naive full-context caching can paradoxically increase latency. The recommended pattern is "system prompt only" caching — cache the stable prefix, let the middle be editable, keep the suffix dynamic.

3. **Context editing is server-side.** `clear_thinking` and `clear_tool_uses` strategies are applied by the API before the prompt reaches the model. No client-side loop needed.

### OpenAI's Official Guidance (Responses API)

OpenAI's approach centers on **server-side compaction**:

1. Set a `compact_threshold` (e.g., 200K tokens)
2. When context exceeds the threshold, the API returns an opaque "compaction item" that carries forward key state using fewer tokens
3. Drop all items before the most recent compaction item — it contains all necessary context
4. The `Session` object in the Agents SDK handles this automatically

**Key principle**: Context management should be **automatic, invisible, and lossless**. The developer sets a budget; the system handles compaction.

### Mastra's Built-in Execution Model

Mastra's `agent.generate()` with `maxSteps` already provides:

| Capability                | How                                                                         |
| ------------------------- | --------------------------------------------------------------------------- |
| Multi-step tool-call loop | AI SDK handles internally — tool call → execute → return result → next step |
| Memory load/save          | Automatic: loads at start, saves at end of the `generate()` call            |
| Thinking block handling   | Delegated to provider (Anthropic strips automatically within a single call) |
| Prompt caching            | Stable prefix (system instructions) cached automatically across steps       |
| Step-level callbacks      | `onIterationComplete` for per-step observability                            |
| Input/output processors   | Hooks to transform messages before/after each step                          |
| Scorer integration        | Automatic quality evaluation after completion                               |

**Key principle**: Mastra expects `agent.generate()` to own the full lifecycle. It is NOT designed to be called in a tight `maxSteps: 1` loop where an external system also manages context.

### Industry Research (2025-2026)

1. **Active Context Compression (Focus Agent, arXiv 2601.07190)**: Agents maintain a persistent "Knowledge Block" while withdrawing raw interaction history. 22.7% token reduction with identical accuracy, up to 57% on individual instances.

2. **Memory-as-Action (arXiv 2510.12635)**: Context management as explicit agent actions (insert, delete, summarize) rather than passive accumulation.

3. **Single Owner Principle**: Only ONE system should manage conversation context. An external loop AND framework-level memory will always fight.

---

## The Case for Consolidation (Not Coordination)

### What managed-generate reimplements

`managed-generate.ts` is 530 lines that reimplement capabilities the AI SDK already provides:

| Capability                | AI SDK / Mastra Native                                           | managed-generate                                                       |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Multi-step tool-call loop | `maxSteps: 20`                                                   | Reimplements with `maxSteps: 1` per iteration                          |
| Memory load/save          | Automatic per `generate()` call                                  | Also passes `memory` on every step — collides                          |
| Thinking block management | Anthropic API strips automatically between turns within one call | Thinking leaks through memory re-injection between steps               |
| Prompt caching            | Automatic (stable system prompt prefix)                          | Manual cache breakpoints; cache invalidated by changing message window |
| Step callbacks            | `onIterationComplete`                                            | `onStep` callback                                                      |

### What managed-generate uniquely provides

Only **two features** exist in managed-generate that Mastra doesn't offer natively:

1. **Tool result compression** — summarize verbose tool outputs using a fast model (~30 lines of logic)
2. **Token budget enforcement with abort** — estimate context size, abort if over budget (~20 lines of logic)

That is ~50 lines of useful logic wrapped in 530 lines of infrastructure that recreates and collides with everything else.

### What happens when we use native `agent.generate()` directly

| Benefit                                    | Why                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| **Single context owner**                   | The SDK manages the message array. No collision possible.                        |
| **Thinking blocks stripped automatically** | Anthropic's API handles this within a single `generate()` call. Zero leakage.    |
| **Prompt caching works optimally**         | System prompt is a stable prefix. SDK doesn't mutate it between steps.           |
| **Memory loads once, saves once**          | No per-step memory round-trips. No compounding.                                  |
| **Context grows once, not twice**          | Within the call it grows linearly. Without the parallel loop, it doesn't double. |

---

## How AgentC2 Violates These Principles Today

| Principle                         | Best Practice                                                          | AgentC2 Today                                                                                                                             | Impact                                                          |
| --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Single context owner**          | One system manages the message window                                  | Two systems (managed-generate + Mastra memory) both manage context simultaneously                                                         | Double-counted messages; ~40% token waste                       |
| **Thinking blocks are ephemeral** | Strip thinking from previous turns (Anthropic does this automatically) | Mastra saves raw `response.messages` (including thinking blocks) to thread memory; managed-generate re-triggers memory load on every step | Thinking tokens leak back as prompt tokens; ~30-40% token waste |
| **Compress the middle**           | Old tool results → placeholders or summaries                           | Managed-generate truncates to 500 chars in its window, but Mastra memory loads the FULL untruncated versions alongside                    | Full tool results sent twice (one truncated, one full)          |
| **Cache the stable prefix**       | System instructions + tool schemas cached once                         | `cache_control: ephemeral` is set, but cache benefit is undermined by massive uncached middle growing each step                           | Cache savings neutralized by context bloat                      |
| **Budget-driven compaction**      | Set a token budget; system auto-compacts                               | `maxContextTokens: 50,000` on managed-generate, but Mastra memory loads ADDITIONAL tokens outside this budget                             | Effective budget is 2x the configured limit                     |
| **Memory saves clean state**      | Only persist user messages and clean assistant responses               | Mastra persists raw AI SDK response including thinking blocks, tool internals, and provider metadata                                      | Thread storage grows with non-essential content                 |

---

## Recommended Architecture

### Target State: Single System — Mastra Native + Provider Context Editing

**Delete `managed-generate.ts`.** Use Mastra's native `agent.generate()` with `maxSteps` as the single execution path. Augment with provider-native context editing and two lightweight processors ported from managed-generate.

```
┌──────────────────────────────────────────────────────────────┐
│                     EXECUTION PATH                           │
│                                                              │
│  agent.generate(input, {                                     │
│      maxSteps: 12,                                           │
│      memory: { thread, resource },                           │
│      providerOptions: {                                      │
│          anthropic: {                                        │
│              thinking: { type: "adaptive" },                 │
│              cacheControl: { type: "ephemeral" },            │
│              contextManagement: {                            │
│                  strategies: [                               │
│                      { type: "clear_thinking_20251015" },    │
│                      { type: "clear_tool_uses_20250919" }    │
│                  ]                                           │
│              }                                               │
│          }                                                   │
│      }                                                       │
│  })                                                          │
│                                                              │
│  Context managed by:                                         │
│    1. AI SDK       — multi-step loop, message accumulation   │
│    2. Anthropic API — thinking block stripping, tool result  │
│                       clearing, prompt caching               │
│    3. Mastra Memory — load at start, save at end, working    │
│                       memory persistence                     │
│                                                              │
│  Ported from managed-generate as processors:                 │
│    4. ToolResultCompressor — output processor, compresses    │
│                              verbose tool results inline     │
│    5. ContextBudgetGuard  — onIterationComplete callback,    │
│                             aborts if context exceeds limit  │
│                                                              │
│  Everything else managed-generate did is REMOVED.            │
└──────────────────────────────────────────────────────────────┘
```

### Why This Works

**One owner.** The AI SDK owns the message array. Mastra memory loads once at the start (bootstrapping context from prior sessions) and saves once at the end (persisting for next session). No intermediate load/save cycles. No double context.

**Thinking handled at the right layer.** Anthropic's API strips thinking blocks between turns automatically within a single `generate()` call. The `clear_thinking_20251015` strategy provides a second safety net. No thinking tokens ever re-enter the prompt.

**Tool results handled at the right layer.** The `ToolResultCompressor` output processor compresses verbose tool results immediately after each tool call, before they enter the conversation. The `clear_tool_uses_20250919` strategy provides a fallback for anything that slips through.

**Prompt caching works naturally.** With a single `generate()` call, the system prompt is a stable prefix. The AI SDK doesn't mutate it between steps. Anthropic's prompt caching delivers its full 90% read discount.

**Budget enforcement without a parallel loop.** The `ContextBudgetGuard` runs on Mastra's `onIterationComplete` callback. If the estimated context exceeds the configured limit, it signals the agent to wrap up. No separate loop needed.

---

## Implementation Plan

### Phase 1: Stop the Bleeding (Config Changes Only — No Code)

Immediate cost reduction via agent configuration updates.

| Change                                          | How            | Expected Savings      |
| ----------------------------------------------- | -------------- | --------------------- |
| Reduce `semanticRecall.topK` from 5 → 2         | `agent_update` | ~15% prompt reduction |
| Reduce `semanticRecall.messageRange` from 3 → 1 | `agent_update` | ~10% prompt reduction |
| Set `contextConfig.maxContextTokens` to 30,000  | `agent_update` | Hard cap per step     |
| Reduce `maxSteps` from 20 → 12                  | `agent_update` | Caps max cost per run |

**Estimated impact**: 25-35% cost reduction. BigJim2's $5.76 run → ~$3.75-4.30.

### Phase 2: Strip Thinking Blocks from Memory Persistence

Before Mastra saves response messages to thread memory, strip thinking content parts. This is needed regardless of the managed-generate decision — thinking should never be persisted to thread storage.

```typescript
function stripThinkingBlocks(messages: Message[]): Message[] {
    return messages.map((msg) => {
        if (msg.role !== "assistant" || !Array.isArray(msg.content)) return msg;
        return {
            ...msg,
            content: msg.content.filter((part) => part.type !== "thinking")
        };
    });
}
```

Implement as a Mastra output processor or in the invoke route before memory save.

**Estimated impact**: 30-40% reduction on thinking-heavy models. BigJim2's $5.76 → ~$3.50-4.00 (combined with Phase 1: ~$2.50-3.00).

### Phase 3: Build the Two Processors

Port the two valuable features from managed-generate into Mastra-compatible patterns:

**ToolResultCompressor** (~40 lines) — Output processor that runs after each tool call:

```typescript
// If tool result exceeds threshold, compress using fast model
// before it enters the conversation as a message
async function compressToolResult(
    toolName: string,
    result: string,
    threshold: number,
    compressionModel: LanguageModel
): Promise<string> {
    if (result.length <= threshold) return result;
    // Summarize preserving IDs, status codes, names, actionable info
    const { text } = await generateText({
        model: compressionModel,
        prompt: `Summarize this "${toolName}" output. Preserve data values, IDs, names, status codes. Remove formatting, boilerplate. Keep under ${threshold} chars.\n\n${result}`
    });
    return text || result.substring(0, threshold);
}
```

**ContextBudgetGuard** (~30 lines) — `onIterationComplete` callback:

```typescript
// Estimate current context size; signal wrap-up if over budget
function createBudgetGuard(maxTokens: number) {
    return async (iteration: { messages: Message[]; step: number }) => {
        const estimated = countTokens(JSON.stringify(iteration.messages));
        if (estimated > maxTokens) {
            console.warn(
                `[BudgetGuard] Context ${estimated} > budget ${maxTokens} at step ${iteration.step}`
            );
            return { abort: true, reason: `Context budget exceeded (${estimated}/${maxTokens})` };
        }
    };
}
```

**Estimated impact**: Provides the safety nets that managed-generate's useful features offered.

### Phase 4: Eliminate managed-generate — Route All Invocations Through Native Generate

Update the invoke route to use `agent.generate()` directly for ALL agents, not just those with `maxSteps <= 5`.

```typescript
// BEFORE: dual path
const USE_MANAGED_GENERATE = effectiveMaxSteps > 5
if (USE_MANAGED_GENERATE) {
    // 530-line parallel context system
    const result = await managedGenerate(agent, input, { ... })
} else {
    // Native Mastra
    const response = await agent.generate(input, { ... })
}

// AFTER: single path
const response = await agent.generate(input, {
    maxSteps: effectiveMaxSteps,
    memory: threadId && record.memoryEnabled
        ? { thread: threadId, resource: resourceId }
        : undefined,
    providerOptions: buildProviderOptions(record),
    // Ported features as callbacks/processors
    onIterationComplete: contextBudgetGuard(contextConfig?.maxContextTokens ?? 50_000)
})
```

Remove `managed-generate.ts` entirely. Remove `getFastCompressionModel`, `compressionModel`, and all managed-generate imports from the invoke route.

**Estimated impact**: Eliminates the dual-system collision. Combined with Phases 1-3, BigJim2's $5.76 run → ~$0.80-1.50. Quality may improve due to less context noise.

### Phase 5: Adopt Anthropic Context Editing (Provider-Level)

Integrate Anthropic's context editing strategies into the agent resolver's provider options:

```typescript
// In resolver.ts or model-config builder:
if (modelProvider === "anthropic") {
    providerOptions.anthropic = {
        ...providerOptions.anthropic,
        // Beta header: context-management-2025-06-27
        contextManagement: {
            strategies: [{ type: "clear_thinking_20251015" }, { type: "clear_tool_uses_20250919" }]
        }
    };
}
```

For OpenAI agents, use the Responses API compaction:

```typescript
if (modelProvider === "openai") {
    providerOptions.openai = {
        ...providerOptions.openai,
        contextManagement: [
            { type: "compaction", compact_threshold: contextConfig?.maxContextTokens ?? 50_000 }
        ]
    };
}
```

**Estimated impact**: Provider-level safety net. Handles edge cases our processors miss. Enables long-running agent sessions without unbounded growth.

### Phase 6: Per-Agent Context Policies

Expose context management as a configurable policy per agent, stored in the `contextConfig` field:

```typescript
interface ContextPolicy {
    maxContextTokens: number; // Total budget (default: 50,000)
    compactionModel: string; // Model for compression (default: "gpt-4o-mini")
    toolResultCompression: {
        enabled: boolean; // Compress verbose tool results (default: true)
        threshold: number; // Chars before compression kicks in (default: 2,000)
    };
    providerContextEditing: {
        clearThinking: boolean; // Use provider's thinking block clearing (default: true)
        clearToolUses: boolean; // Use provider's tool result clearing (default: true)
    };
}
```

This gives agent builders control while maintaining sensible defaults. The policy is interpreted by the invoke route when building provider options and configuring processors.

---

## Expected Outcome

| Metric                          | Current (BigJim2)    | After Phases 1-2 | After Full Implementation               |
| ------------------------------- | -------------------- | ---------------- | --------------------------------------- |
| Prompt tokens per run (6 steps) | 265,803              | ~100,000-130,000 | ~25,000-40,000                          |
| Cost per run                    | $5.76                | ~$2.00-2.80      | ~$0.50-0.80                             |
| Cost reduction                  | —                    | 51-65%           | 86-91%                                  |
| Code removed                    | —                    | 0 lines          | ~530 lines (managed-generate.ts)        |
| Quality impact                  | Baseline             | No degradation   | Likely improvement (less context noise) |
| Maintenance burden              | Two systems to debug | Unchanged        | One system, provider-native             |

---

## Summary: The Three Rules of Agent Context Management

1. **One owner, not two.** Don't build a parallel loop around the framework's multi-step execution. Use the framework natively. `agent.generate()` with `maxSteps` already does what managed-generate reimplements — and it does it without colliding with memory.

2. **Thinking is ephemeral — let the provider handle it.** Anthropic's API automatically strips thinking blocks between turns within a single `generate()` call. Their `clear_thinking` context editing strategy provides a second layer. Never persist thinking tokens to thread memory.

3. **Delegate context editing to the provider.** Both Anthropic (`clear_thinking`, `clear_tool_uses`) and OpenAI (`compaction`) now offer server-side context management. Use it. The providers understand their own models' context requirements better than any client-side reimplementation can.

The only client-side additions needed are two lightweight processors (~70 lines total): one for tool result compression and one for budget enforcement. Everything else managed-generate does — windowing, anchoring, message accumulation, cache breakpoints — is already handled by the framework and provider, and handled better.

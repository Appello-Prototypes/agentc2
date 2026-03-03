# Root Cause Analysis: BigJim2's 265K Prompt Token Problem

## Context Assembly Architecture

When BigJim2 runs, the prompt is assembled through **two competing context management systems** running simultaneously:

### System A — Managed-Generate (`packages/agentc2/src/lib/managed-generate.ts`)

Activated because `maxSteps=20 > 5` threshold. Runs a multi-step loop calling `agent.generate()` with `maxSteps: 1` per iteration. Maintains its own windowed message history, truncates tool results to 500 chars.

### System B — Mastra Memory (`@mastra/core` internals)

On every `agent.generate()` call, Mastra independently loads thread memory (`lastMessages`, `semanticRecall`, `workingMemory`) and saves all output (including thinking blocks) back to the thread.

**The LLM receives BOTH systems' messages on every step.**

---

## The Five Root Causes

### RC-1: Double Context (Memory + Managed-Generate) — CRITICAL

This is the **primary cost driver**.

In `managed-generate.ts`, every step calls:

```typescript
// managed-generate.ts — Lines 230-384
const generateOptions: any = {
    maxSteps: 1,
    ...(stepInstructions ? { instructions: stepInstructions } : {}),
    ...(maxTokens ? { modelSettings: { maxTokens } } : {}),
    ...(memory ? { memory } : {})
};

// ...
response = await agent.generate(windowedMessages as any, generateOptions);
```

The `memory` option is passed on every step. Inside Mastra's `#execute`:

```typescript
// index.js — Lines 20112-20166
const memory = await this.getMemory({ requestContext });
// ...
const executionWorkflow = createPrepareStreamWorkflow({
    // ... memory, memoryConfig ...
});
```

Then `prepareMemoryStep` runs `getMemoryMessages` → `memory.recall()`, which loads:

- **lastMessages: 3** from the thread
- **semanticRecall: { topK: 5, messageRange: 3 }** = up to 15 additional messages
- **workingMemory** template

And after generation, `#executeOnFinish` saves the response back to the thread:

```typescript
// index.js — Lines 20215-20235
if (memory && resourceId && thread && !readOnlyMemory) {
    let responseMessages = result.response.messages;
    // ...saves to thread...
}
```

**Result:** On step N, the LLM receives the same conversation data **twice**:

1. Via Mastra memory recall (full, untruncated messages loaded from thread)
2. Via managed-generate's windowed messages (truncated to 500 chars)

---

### RC-2: Thinking Token Leakage into Memory — CRITICAL

BigJim2 uses `thinking: { type: "adaptive" }` with Claude Opus 4.6. When Mastra's `#executeOnFinish` saves to memory, it saves `result.response.messages` — the raw AI SDK response, which **includes thinking blocks**:

```typescript
// index.js — Lines 20217-20234
let responseMessages = result.response.messages;
// ...
if (responseMessages) {
    messageList.add(responseMessages, "response");
}
```

On the next step, `memory.recall()` with `lastMessages: 3` loads these saved messages — **including thinking blocks**. With Claude Opus, thinking can be **5K–30K+ tokens per step**. These tokens leak back into the prompt on every subsequent step, **compounding rapidly**.

Meanwhile, managed-generate only stores `response.text` (not thinking):

```typescript
// managed-generate.ts — Lines 430-432
if (response.text) {
    messages.push({ role: "assistant", content: response.text });
}
```

So managed-generate correctly avoids thinking bloat, but Mastra's memory undermines this by loading the full thinking blocks back from the thread.

---

### RC-3: Semantic Recall Amplification — HIGH

Config: `semanticRecall: { topK: 5, messageRange: 3 }`. On every step, Mastra runs a vector search against the thread and retrieves up to 5 matches with 3 messages of context each = up to **15 additional messages**. If any of these matched messages contain thinking blocks from previous steps, they amplify the problem.

---

### RC-4: Duplicate Tool Calls — MODERATE

The trace shows BigJim2 called `activate-skill` and `search-skills` at 19:23, then repeated the exact same calls at 19:30 (7 minutes later). Each duplicate adds tool call/result pairs to both context systems. The agent likely lost track of what it had already done because managed-generate's context window didn't include the earlier steps clearly enough, or the 7-minute gap suggests a timeout/retry.

---

### RC-5: No contextConfig Set — MODERATE

BigJim2 has `contextConfig: null`. This means managed-generate uses defaults:

- **maxContextTokens: 50,000** — per step, not total
- **windowSize: 5** — keeps last 5 message pairs

With Mastra memory loading an additional 15K–40K tokens on top, the 50K budget is effectively 65K–90K per step. Over 6 steps, this allows 265K total.

---

## Quantified Token Breakdown (Estimated per Step)

| Layer                        | Step 1   | Step 3    | Step 6    | Source                                    |
| ---------------------------- | -------- | --------- | --------- | ----------------------------------------- |
| System instructions          | ~3K      | ~3K       | ~3K       | Static, cacheable                         |
| Tool schemas (14 tools)      | ~2K      | ~2K       | ~2K       | Static, cacheable                         |
| Memory: lastMessages (3)     | ~5K      | ~25K      | ~40K      | Growing — includes thinking tokens        |
| Memory: semanticRecall (5×3) | ~3K      | ~10K      | ~15K      | Growing — matches thinking-heavy messages |
| Memory: workingMemory        | ~1K      | ~1K       | ~1K       | Stable                                    |
| Managed-generate window      | ~1K      | ~5K       | ~8K       | Growing (truncated)                       |
| Double-counted content       | ~0K      | ~10K      | ~20K      | Overlap between memory + window           |
| **Per-step total**           | **~15K** | **~56K**  | **~89K**  |                                           |
| **Cumulative total**         | **15K**  | **~130K** | **~265K** | **Matches actual**                        |

The biggest contributor: **thinking tokens leaking through memory** account for an estimated **40–50% of the total prompt tokens** ($2–3 of the $5.76 cost).

---

## Recommended Fixes (In Priority Order)

| #   | Fix                                                                                                                                                                           | Impact                                            | Effort                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| 1   | **Disable memory in managed-generate steps 2+** — Only pass `memory` on step 1, then let managed-generate's own window handle context                                         | Eliminates double-context. Saves ~40% tokens      | Code change in `managed-generate.ts`               |
| 2   | **Strip thinking blocks before saving to memory** — Filter `result.response.messages` to remove thinking content parts in `#executeOnFinish` or via a Mastra output processor | Eliminates thinking leakage. Saves ~30–40% tokens | Code change in resolver or custom Mastra processor |
| 3   | **Set contextConfig on BigJim2** — `{ maxContextTokens: 30000, windowSize: 3 }`                                                                                               | Hard caps per-step context                        | Agent update via API                               |
| 4   | **Reduce semanticRecall** — Change from `topK: 5, messageRange: 3` to `topK: 2, messageRange: 1`                                                                              | Reduces memory-loaded content by ~60%             | Agent update via API                               |
| 5   | **Lower maxSteps to 10** — Still uses managed-generate (>5 threshold) but caps iterations                                                                                     | Limits max cost per run                           | Agent update via API                               |

**Fixes 1–2 are the structural wins** — they address the architectural flaw where two context management systems fight each other. **Fixes 3–5 are config knobs** that limit damage.

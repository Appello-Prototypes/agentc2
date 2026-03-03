---
name: "Patterns Book — Plan 2: Agent Resilience & Context Quality"
overview: "Implement automatic error-to-context self-correction loops, wire Mastra memory processors (TokenLimiter, ToolCallFilter), add context failure mode detection (poisoning, clash, rot), and replace char-estimate token counting with tiktoken. Addresses Patterns 5 (Parallelize Carefully), 7 (Avoid Context Failure Modes), 8 (Compress Context), and 9 (Feed Errors Into Context)."
todos:
    - id: phase-1-error-context
      content: "Phase 1: Error-to-context self-correction loop in core agent execution"
      status: pending
    - id: phase-2-memory-processors
      content: "Phase 2: Wire TokenLimiter and ToolCallFilter from @mastra/memory"
      status: pending
    - id: phase-3-context-failure
      content: "Phase 3: Context failure mode detection — poisoning, clash, rot"
      status: pending
    - id: phase-4-token-counting
      content: "Phase 4: Replace char/4 estimation with accurate token counting"
      status: pending
    - id: phase-5-parallel-conflict
      content: "Phase 5: Parallel output conflict detection for workflows"
      status: pending
isProject: false
---

# Plan 2: Agent Resilience & Context Quality

**Book Patterns:** 5 (Parallelize Carefully), 7 (Avoid Context Failure Modes), 8 (Compress Context), 9 (Feed Errors Into Context)

**Priority:** High — core quality gaps that directly affect agent reliability

---

## Phase 1: Strengthen Error-to-Context Self-Correction

**AUDIT CORRECTION:** `managed-generate` already feeds tool results (including errors) back into the conversation at each step (lines 412–430). The agent **does** see tool failures in the next loop iteration. This is NOT a gap for managed-generate.

**Actual gaps:**

1. **Chat streaming path** uses `agent.stream()` directly — Mastra handles tool errors internally via maxSteps, but there's no explicit error-analysis prompt or retry cap per tool
2. **No error-analysis prompt** — tool errors are passed as raw results, but the agent isn't explicitly asked to diagnose and correct
3. **No common error pattern injection** — repeated failures aren't learned from

### 1.1 Add explicit error-analysis guidance in managed-generate

**File:** `packages/agentc2/src/lib/managed-generate.ts`

The tool results are already fed back (lines 412–430). Enhance this by detecting failed tool calls and adding an explicit analysis prompt:

```typescript
// After processing stepToolResults (around line 430):
const failedCalls = stepToolResults.filter((r) => r.error || r.success === false);
if (failedCalls.length > 0) {
    const errorGuidance = failedCalls
        .map(
            (f) =>
                `Tool "${f.toolName}" failed: ${f.error}. Analyze this error — check your parameters, try a different approach, or use an alternative tool.`
        )
        .join("\n");
    messages.push({ role: "system", content: errorGuidance });
}
```

This is a small but meaningful addition: the agent already sees the raw error, but an explicit system prompt directing it to diagnose and correct significantly improves self-correction behavior.

### 1.2 Add retry-aware error handling in chat streaming

**File:** `apps/agent/src/app/api/agents/[id]/chat/route.ts`

For the streaming path, after the stream completes (tool-error events at lines 685–757):

- Track tool error frequency per tool per chat turn
- If a tool fails 3+ times in one turn, add a system message in the next turn: "Tool X has failed repeatedly. Do not attempt to use it again. Use an alternative approach."
- This prevents infinite tool-failure loops in the streaming path

### 1.3 Feed common error patterns into agent instructions

**File:** `packages/agentc2/src/agents/resolver.ts`

In `hydrate()`, after loading the agent's instructions:

- Query `AgentToolCall` for the agent's most common tool errors (last 7 days, grouped by error pattern)
- If patterns found, append a "Known Tool Issues" section to the agent's instructions
- Cache for 1 hour; only include patterns with >5 occurrences in 7 days
- This implements the book's recommendation: "If you notice commonly repeated error patterns, put them into your prompt!"

---

## Phase 2: Wire Memory Processors

**Problem:** `@mastra/memory` provides `TokenLimiter` and `ToolCallFilter` processors, but AgentC2 uses neither. The `docs/ai-agent-best-practices.md` (line 183) mentions TokenLimiter as a best practice but it's not implemented. Memory currently relies solely on `lastMessages` count, which is an imprecise way to manage context size.

### 2.1 Add TokenLimiter to memory configuration

**AUDIT CORRECTION:** Import from `@mastra/core/processors`, NOT `@mastra/memory`. Mastra's processors live in core. Also, `js-tiktoken` is already a transitive dependency via Mastra packages — no new package needed.

**File:** `packages/agentc2/src/memory.ts`

```typescript
import { TokenLimiter, ToolCallFilter } from "@mastra/core/processors";

// In getMemory():
const memory = new Memory({
    storage,
    vector,
    embedder,
    options: {
        lastMessages: 40 // Fetch more messages, let TokenLimiter prune to fit budget
        // ... existing config
    },
    processors: [
        new ToolCallFilter(), // Remove verbose tool call/result pairs from history
        new TokenLimiter(12000) // Cap at 12K tokens of memory context
    ]
});
```

**NOTE:** `lastMessages: 10` (current) limits by count; `TokenLimiter(12000)` limits by tokens. The correct approach: increase `lastMessages` to a generous count (40) and let TokenLimiter do the actual pruning by token budget. This is more precise than count-based limiting.

### 2.2 Make processors configurable per agent

**File:** `packages/agentc2/src/schemas/agent.ts`

Extend `memoryConfigSchema`:

```typescript
processors: z.object({
    tokenLimit: z.number().optional(), // default: 12000
    filterToolCalls: z.boolean().optional(), // default: true
    customProcessors: z.array(z.string()).optional()
}).optional();
```

**File:** `packages/agentc2/src/agents/resolver.ts`

In the memory building section of `hydrate()`, read `memoryConfig.processors` and construct the appropriate processor chain.

### 2.3 Update agent configuration UI

**File:** `apps/agent/src/app/agents/[agentSlug]/settings/`

Add memory processor configuration:

- Token limit slider (4K–32K, default 12K)
- Toggle for "Filter tool calls from memory" (default on)

---

## Phase 3: Context Failure Mode Detection

**Problem:** The book identifies 5 context failure modes: poisoning, distraction, confusion, clash, and rot. AgentC2 has no detection or mitigation for any of them beyond basic token budgeting.

### 3.1 Context health checker

**File:** `packages/agentc2/src/context/health-checker.ts` (new)

Create a lightweight context health analysis that runs periodically during long agent executions:

```typescript
export interface ContextHealthReport {
    totalTokens: number;
    utilizationPct: number;
    warnings: ContextWarning[];
}

export type ContextWarning =
    | { type: "rot"; message: string; tokenCount: number }
    | { type: "clash"; message: string; conflictingStatements: string[] }
    | { type: "distraction"; message: string; irrelevantPct: number }
    | { type: "poisoning"; message: string; suspectedSource: string };
```

### 3.2 Rot detection

**Rule:** When context exceeds 100K tokens (per Google Gemini team findings), flag it.

**File:** `packages/agentc2/src/lib/managed-generate.ts`

In the managed generate loop, add a check after each step:

```typescript
const contextTokens = estimateTokens(messages);
if (contextTokens > CONTEXT_ROT_THRESHOLD) {
    // 100K tokens
    warnings.push({
        type: "rot",
        message: `Context at ${contextTokens} tokens exceeds rot threshold. Triggering compression.`,
        tokenCount: contextTokens
    });
    // Trigger aggressive compression
    messages = await compressContext(messages, targetTokens);
}
```

### 3.3 Clash detection

**File:** `packages/agentc2/src/context/clash-detector.ts` (new)

After tool results are added to context, run a lightweight check for contradictions:

- Compare the latest tool result against previous tool results for the same data source
- If values for the same entity/field differ, flag a clash
- Use embedding similarity between conflicting statements to surface near-contradictions

This runs only when:

- Multiple tool results reference the same entity (detected by shared IDs, names, or keys)
- The context contains both "old" and "new" data for the same query

### 3.4 Distraction detection

**File:** `packages/agentc2/src/context/distraction-detector.ts` (new)

When context exceeds 50% of the window:

- Compute embedding similarity between each message block and the original user query
- Messages with < 0.3 similarity score are flagged as potential distractions
- If distraction ratio > 40%, trigger selective pruning of lowest-relevance messages

### 3.5 Wire into managed-generate

**File:** `packages/agentc2/src/lib/managed-generate.ts`

Add a `contextHealthCheck()` call at configurable intervals (default: every 5 steps):

```typescript
if (step % healthCheckInterval === 0 && step > 0) {
    const health = await checkContextHealth(messages, originalQuery, maxContextTokens);
    if (health.warnings.length > 0) {
        // Log warnings
        // Apply mitigations (compress, prune, flag)
        // Optionally inject a system message warning the agent
    }
}
```

---

## Phase 4: Accurate Token Counting

**Problem:** `estimateTokens()` in managed-generate.ts uses `chars / 4`, which can be 20-40% off for non-English text, code, or structured data. This causes premature abort or context overflow.

### 4.1 Add accurate token counting using js-tiktoken

**AUDIT CORRECTION:** `js-tiktoken` is already a transitive dependency via `@mastra/core`, `@mastra/memory`, and `@mastra/rag`. No new package install needed — just import and use it directly.

**File:** `packages/agentc2/src/lib/token-counter.ts` (new)

```typescript
import { encodingForModel } from "js-tiktoken";

const encoderCache = new Map<string, ReturnType<typeof encodingForModel>>();

export function countTokens(text: string, model: string = "gpt-4o"): number {
    let encoder = encoderCache.get(model);
    if (!encoder) {
        try {
            encoder = encodingForModel(model as any);
        } catch {
            encoder = encodingForModel("gpt-4o"); // fallback
        }
        encoderCache.set(model, encoder);
    }
    return encoder.encode(text).length;
}

export function countMessageTokens(messages: Message[], model: string = "gpt-4o"): number {
    let total = 0;
    for (const msg of messages) {
        total += 4; // message framing
        total += countTokens(
            typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
            model
        );
    }
    total += 2; // assistant priming
    return total;
}
```

### 4.2 Replace char estimation

**File:** `packages/agentc2/src/lib/managed-generate.ts`

Replace all calls to `estimateTokens()` (which uses `chars / 4`) with `countTokens()` / `countMessageTokens()`.

Keep `estimateTokens()` as a fast-path fallback for hot paths where precision is less critical, but use accurate counting for budget decisions (abort thresholds, compression triggers).

---

## Phase 5: Parallel Output Conflict Detection

**Problem:** When parallel workflows or phase groups produce outputs, there's no check for compatibility. The book warns that parallel subagents can create "mutually incompatible, intermediate products."

### 5.1 Add conflict detection to parallel workflow steps

**File:** `packages/agentc2/src/workflows/parallel.ts`

After all parallel branches complete:

```typescript
const outputs = await Promise.all(branches.map((b) => b.execute()));

// Check for conflicts
const conflicts = detectOutputConflicts(outputs);
if (conflicts.length > 0) {
    // Option 1: Log warning and proceed
    console.warn(
        `[ParallelWorkflow] Detected ${conflicts.length} potential conflicts between parallel outputs`
    );

    // Option 2: If severity is high, trigger reconciliation
    if (conflicts.some((c) => c.severity === "high")) {
        return await reconcileOutputs(outputs, conflicts, agent);
    }
}
```

### 5.2 Implement conflict detection

**File:** `packages/agentc2/src/context/conflict-detector.ts` (new)

```typescript
export function detectOutputConflicts(outputs: ParallelOutput[]): Conflict[] {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < outputs.length; i++) {
        for (let j = i + 1; j < outputs.length; j++) {
            // Check for contradictory conclusions
            // Check for incompatible data modifications
            // Check for conflicting tool calls (e.g., both trying to update same record)
            const similarity = computeSemanticSimilarity(outputs[i], outputs[j]);
            if (similarity < CONFLICT_THRESHOLD) {
                conflicts.push({
                    branchA: i,
                    branchB: j,
                    severity: classifyConflictSeverity(outputs[i], outputs[j]),
                    description: `Branches ${i} and ${j} may have incompatible outputs`
                });
            }
        }
    }
    return conflicts;
}
```

### 5.3 Add reconciliation step

When conflicts are detected:

- Use the parent agent (or a dedicated reconciliation agent) to review both outputs
- Provide the conflict details as context
- The reconciler produces a unified output that resolves contradictions

---

## Verification

After completing all phases:

1. Write test: invoke agent with a tool that always fails → confirm error is fed back → confirm agent retries with corrected params
2. Write test: create agent with TokenLimiter(5000) → feed 20K tokens of memory → confirm only 5K reaches the agent
3. Write test: inject contradictory tool results → confirm clash warning is raised
4. Compare `countTokens()` vs `estimateTokens()` on 100 real agent runs → report accuracy delta
5. Write test: parallel workflow with incompatible outputs → confirm conflict detection fires
6. Run `bun run type-check && bun run lint && bun run build`

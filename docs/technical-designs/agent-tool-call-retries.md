# Technical Design: Agent Tool Call Retry Logic

**Feature Request:** Agent should retry tool calls on transient failures instead of immediately giving up  
**GitHub Issue:** [#151](https://github.com/Appello-Prototypes/agentc2/issues/151)  
**Status:** Design Phase  
**Created:** 2026-03-12  
**Scope:** Medium | Priority: Medium

---

## Executive Summary

When integration tools transiently fail, GPT-4o agents immediately respond "tools are unavailable" without attempting a single tool call. Additionally, agents may terminate early despite having remaining steps and incomplete multi-step tasks. This design introduces:

1. **Automatic retry logic** for transient tool execution failures
2. **Enhanced system prompts** to encourage tool usage rather than premature abandonment
3. **Continuation guardrails** to prevent early termination with unused steps
4. **Configuration controls** for retry behavior per agent/tool

---

## Problem Statement

### Evidence from Production

**Run cmmmvj3kw00a58exvmha1e3jv (sdlc-signal-harvester):**
- Agent configured with 30 maxSteps
- Made **ZERO** tool calls
- Used only 44 completion tokens in 2046ms
- Immediately said "Jira tools are currently unavailable" without attempting
- AgentC2 evaluation: 0.225 score, CRITICAL: TOOL_SELECTION_ERROR

**Run cmmmvd41b008l8exvctdhd9vd:**
- Agent successfully called 4 tools and retrieved data
- Stopped after 137 completion tokens
- Had **26 remaining steps** (87% unused)
- Never completed the multi-step pipeline

### Root Causes

1. **No Retry Mechanism**: Tool failures are not retried, even for transient errors (network timeouts, rate limits, temporary unavailability)
2. **LLM Preemptive Abandonment**: Models assume tools are unavailable without attempting execution
3. **Early Termination**: Agents complete prematurely despite having remaining steps and incomplete tasks
4. **No Tool Call Minimum**: Agents with high maxSteps can complete with zero tool calls

---

## Current Architecture Analysis

### Agent Execution Flow

```
User Request
    ↓
AgentResolver.resolve(slug, context)
    ↓
Agent.generate(input, { maxSteps: N })
    ↓
[Mastra Internal Loop - NOT visible to AgentC2]
    ├── Input Processors (guardrails, context window, step anchor)
    ├── LLM generates response + tool calls
    ├── Output Processors (guardrails, tool call guard)
    ├── Tool execution: tool.execute(args)
    │       ↓
    │   [NO RETRY - fails immediately]
    │       ↓
    ├── Return result to LLM (success or error)
    ├── Repeat until: no tool calls OR maxSteps reached OR error thrown
    └─→ Response
```

### Tool Execution Layers

**Layer 1: Permission Guard** (`tool-execution-guard.ts`)
- Wraps `tool.execute()` with permission/egress checks
- Returns `{ error: "[TOOL BLOCKED] ..." }` on denial
- **Does NOT catch execution errors**

**Layer 2: MCP Tool Execution** (`mcp/client.ts:executeMcpTool()`)
- Timeout protection (60s default)
- Parameter validation
- Result truncation (12k chars)
- Returns `{ success: false, error: string }` on failure
- **Does NOT retry on transient failures**

**Layer 3: Tool Call Guard Processor** (`tool-call-guard-processor.ts`)
- Monitors tool call patterns AFTER execution
- Detects: duplicate calls, empty results, budget exhaustion
- Injects nudge messages or aborts execution
- **Does NOT intercept execution failures**

### Existing Retry Infrastructure

**`packages/agentc2/src/lib/retry.ts`**:
- Utility: `withRetry<T>(fn: () => Promise<T>, options?: RetryOptions)`
- Default: 3 retries, exponential backoff with jitter
- Retryable errors: ECONNRESET, ETIMEDOUT, socket hang up, 429/502/503/504
- **Currently used for:**
  - MCP server connection failures (1 retry, 2s delay)
  - OAuth token refresh (1 retry)
  - Working memory updates (1 retry, 2s delay)
  - Integration provisioner tool discovery (2 retries)
- **NOT used for tool execution**

---

## Proposed Solution

### Architecture Changes

#### 1. Tool Execution Retry Wrapper

**New Module:** `packages/agentc2/src/security/tool-execution-retry.ts`

Wrap tool execution with retry logic that intercepts transient failures:

```typescript
/**
 * Tool Execution Retry Wrapper
 * 
 * Wraps tool.execute() with automatic retry logic for transient failures.
 * Integrates with existing withRetry utility and tool-execution-guard.
 */

import { withRetry, type RetryOptions } from "../lib/retry";

export interface ToolRetryConfig {
    /** Enable retry for this tool. Default: true */
    enabled?: boolean;
    /** Max retry attempts. Default: 2 (3 total attempts) */
    maxRetries?: number;
    /** Initial delay in ms. Default: 500 */
    initialDelayMs?: number;
    /** Max delay in ms. Default: 10000 */
    maxDelayMs?: number;
    /** Custom retryable error detector */
    isRetryable?: (error: unknown) => boolean;
}

export interface ToolExecutionContext {
    agentId: string;
    toolId: string;
    runId?: string;
    stepNumber?: number;
}

/**
 * Default retryable error detector for tools.
 * Retries on:
 *   - Network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED)
 *   - Timeout errors
 *   - HTTP 429 (rate limit), 502/503/504 (server errors)
 *   - Tool-specific transient errors
 */
function isToolExecutionRetryable(error: unknown): boolean {
    // Reuse base retry logic
    if (defaultIsRetryable(error)) return true;
    
    // Tool-specific patterns
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        
        // MCP server temporarily unavailable
        if (msg.includes("server not available")) return true;
        if (msg.includes("connection refused")) return true;
        if (msg.includes("tool not found") && msg.includes("loading")) return true;
        
        // API rate limits (not caught by status code)
        if (msg.includes("rate limit")) return true;
        if (msg.includes("too many requests")) return true;
        
        // Temporary service issues
        if (msg.includes("service unavailable")) return true;
        if (msg.includes("temporarily unavailable")) return true;
        
        // OAuth token issues (should trigger refresh)
        if (msg.includes("invalid_token")) return true;
        if (msg.includes("token expired")) return true;
    }
    
    // Structured error responses from tool.execute()
    if (error && typeof error === "object") {
        const err = error as Record<string, unknown>;
        
        // { error: "..." } format
        if (typeof err.error === "string") {
            const errMsg = err.error.toLowerCase();
            if (errMsg.includes("rate limit")) return true;
            if (errMsg.includes("timeout")) return true;
            if (errMsg.includes("unavailable")) return true;
        }
        
        // { success: false, error: "..." } format (MCP tools)
        if (err.success === false && typeof err.error === "string") {
            const errMsg = err.error.toLowerCase();
            if (errMsg.includes("rate limit")) return true;
            if (errMsg.includes("timeout")) return true;
            if (errMsg.includes("unavailable")) return true;
        }
    }
    
    return false;
}

/**
 * Wrap a tool's execute function with retry logic.
 */
export function wrapToolWithRetry(
    tool: any,
    toolId: string,
    config: ToolRetryConfig = {},
    context: ToolExecutionContext
): void {
    const {
        enabled = true,
        maxRetries = 2,
        initialDelayMs = 500,
        maxDelayMs = 10000,
        isRetryable = isToolExecutionRetryable
    } = config;
    
    if (!enabled) return;
    if (!tool || typeof tool.execute !== "function") return;
    
    const originalExecute = tool.execute.bind(tool);
    
    tool.execute = async (executeContext: any) => {
        return withRetry(
            () => originalExecute(executeContext),
            {
                maxRetries,
                initialDelayMs,
                maxDelayMs,
                isRetryable,
                onRetry: (error, attempt) => {
                    console.log(
                        `[ToolRetry] Retrying ${toolId} (attempt ${attempt}/${maxRetries + 1}) ` +
                        `for agent ${context.agentId}, run ${context.runId || "N/A"}: ` +
                        `${error instanceof Error ? error.message : String(error)}`
                    );
                    
                    // Record retry event for telemetry
                    recordToolRetryEvent({
                        agentId: context.agentId,
                        toolId,
                        runId: context.runId,
                        stepNumber: context.stepNumber,
                        attempt,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        );
    };
}

/**
 * Record tool retry events for analysis and telemetry.
 */
async function recordToolRetryEvent(event: {
    agentId: string;
    toolId: string;
    runId?: string;
    stepNumber?: number;
    attempt: number;
    error: string;
}): Promise<void> {
    // Fire-and-forget activity recording
    try {
        await recordActivity({
            type: "TOOL_RETRY",
            agentId: event.agentId,
            summary: `Retry attempt ${event.attempt} for ${event.toolId}`,
            detail: event.error,
            status: "info",
            source: "tool-execution",
            metadata: {
                toolId: event.toolId,
                runId: event.runId,
                stepNumber: event.stepNumber,
                attempt: event.attempt
            }
        });
    } catch (err) {
        // Non-fatal: telemetry failure shouldn't break execution
        console.error("[ToolRetry] Failed to record retry event:", err);
    }
}
```

#### 2. Integration with AgentResolver

**Modified:** `packages/agentc2/src/agents/resolver.ts`

Add retry wrapper after permission guard:

```typescript
// Line ~1000 (after wrapToolsWithPermissionGuard)

// --- Tool Execution Retry Logic ---
// Wrap tools with retry logic for transient failures AFTER permission guard.
// This ensures we retry actual execution failures, not permission denials.
if (organizationId) {
    const retryConfig = this.resolveToolRetryConfig(record);
    
    for (const [toolId, tool] of Object.entries(tools)) {
        wrapToolWithRetry(tool, toolId, retryConfig, {
            agentId: record.id,
            toolId,
            runId: requestContext?.runId
        });
    }
    
    console.log(
        `[AgentResolver] Retry wrapper applied to ${Object.keys(tools).length} tools ` +
        `for "${record.slug}" (maxRetries: ${retryConfig.maxRetries}, ` +
        `enabled: ${retryConfig.enabled})`
    );
}
```

**New Method:**

```typescript
/**
 * Resolve tool retry configuration from agent config.
 * Priority: agent.metadata.toolRetry > workspace defaults > system defaults
 */
private resolveToolRetryConfig(record: AgentRecord): ToolRetryConfig {
    const metadata = record.metadata as Record<string, unknown> | null;
    const toolRetry = metadata?.toolRetry as Record<string, unknown> | undefined;
    
    return {
        enabled: (toolRetry?.enabled as boolean | undefined) ?? true,
        maxRetries: (toolRetry?.maxRetries as number | undefined) ?? 2,
        initialDelayMs: (toolRetry?.initialDelayMs as number | undefined) ?? 500,
        maxDelayMs: (toolRetry?.maxDelayMs as number | undefined) ?? 10000
    };
}
```

#### 3. Enhanced System Prompts

**Modified:** `packages/agentc2/src/agents/resolver.ts` (hydrate method)

Add system-level prompting to instructions:

```typescript
// Line ~600 (during instruction enrichment)

// --- Tool Usage Guidance ---
// Encourage proactive tool usage and proper error handling
if (Object.keys(tools).length > 0) {
    const toolUsageGuidance = `

## Tool Execution Guidelines

1. **Always Attempt Tool Calls**: If tools are configured, attempt to use them. Do not assume tools are unavailable without trying.

2. **Transient Failures**: If a tool returns an error, check if it's transient (timeout, rate limit, temporary unavailability). The system will automatically retry these errors.

3. **Multi-Step Tasks**: If you have ${record.maxSteps} steps available and the task requires multiple operations:
   - Plan the full sequence
   - Execute each step systematically
   - Don't terminate early unless the task is complete

4. **Error Response**: If a tool fails after retries, explain:
   - What you attempted
   - The error encountered
   - Alternative approaches or next steps

5. **Step Budget**: You have ${record.maxSteps} reasoning/tool-use iterations. Use them effectively for complex tasks.
`;
    
    finalInstructions += toolUsageGuidance;
}
```

#### 4. Continuation Guardrail Processor

**New Module:** `packages/agentc2/src/processors/continuation-guard-processor.ts`

Prevent premature termination for multi-step agents:

```typescript
/**
 * Continuation Guard Processor
 * 
 * Prevents agents from terminating early when:
 *   - They have many remaining steps (> 50% unused)
 *   - They made very few tool calls (< minimum threshold)
 *   - The task appears incomplete (heuristic checks)
 * 
 * Injects nudge messages to encourage continuation.
 */

import type { Processor, ProcessOutputStepArgs } from "@mastra/core/processors";

export interface ContinuationGuardConfig {
    /** Max steps configured for this agent */
    maxSteps: number;
    /** Minimum tool calls before allowing completion (default: 1 for agents with maxSteps > 10) */
    minToolCalls?: number;
    /** Remaining step threshold to trigger nudge (default: 0.5 = 50% unused) */
    remainingStepThreshold?: number;
    /** Enable heuristic "task incomplete" detection (default: true) */
    enableIncompleteDetection?: boolean;
}

interface GuardState {
    totalToolCalls: number;
    nudgeInjected: boolean;
}

export function createContinuationGuardProcessor(
    config: ContinuationGuardConfig
): Processor<"continuation-guard"> {
    const minToolCalls = config.minToolCalls ?? (config.maxSteps > 10 ? 1 : 0);
    const remainingThreshold = config.remainingStepThreshold ?? 0.5;
    const enableIncompleteDetection = config.enableIncompleteDetection ?? true;
    
    return {
        id: "continuation-guard" as const,
        name: "Continuation Guard",
        
        async processOutputStep(args: ProcessOutputStepArgs) {
            const { messages, toolCalls, stepNumber, state } = args;
            
            // Initialize state
            const gs = state as unknown as GuardState;
            if (!gs.totalToolCalls) {
                gs.totalToolCalls = 0;
                gs.nudgeInjected = false;
            }
            
            // Track tool calls
            if (toolCalls && toolCalls.length > 0) {
                gs.totalToolCalls += toolCalls.length;
            }
            
            // Only check on steps without tool calls (potential completion)
            if (!toolCalls || toolCalls.length === 0) {
                const remainingSteps = config.maxSteps - stepNumber;
                const remainingRatio = remainingSteps / config.maxSteps;
                
                // Check 1: Minimum tool calls not met
                const belowMinToolCalls = gs.totalToolCalls < minToolCalls;
                
                // Check 2: Too many remaining steps
                const tooManyRemainingSteps = remainingRatio > remainingThreshold;
                
                // Check 3: Task appears incomplete (heuristic)
                const taskIncomplete = enableIncompleteDetection && 
                    detectIncompleteTask(messages);
                
                if (!gs.nudgeInjected && (belowMinToolCalls || (tooManyRemainingSteps && taskIncomplete))) {
                    console.log(
                        `[ContinuationGuard] Step ${stepNumber}: Nudging agent to continue ` +
                        `(toolCalls: ${gs.totalToolCalls}/${minToolCalls}, ` +
                        `remaining: ${remainingSteps}/${config.maxSteps}, ` +
                        `incomplete: ${taskIncomplete})`
                    );
                    
                    gs.nudgeInjected = true;
                    
                    const reasons: string[] = [];
                    if (belowMinToolCalls) {
                        reasons.push(`you have made ${gs.totalToolCalls} tool calls (minimum: ${minToolCalls})`);
                    }
                    if (tooManyRemainingSteps) {
                        reasons.push(`you have ${remainingSteps} remaining steps (${Math.round(remainingRatio * 100)}% unused)`);
                    }
                    if (taskIncomplete) {
                        reasons.push("the task appears incomplete");
                    }
                    
                    const nudgeMsg: any = {
                        id: `continuation-guard-${stepNumber}`,
                        role: "user" as const,
                        createdAt: new Date(),
                        content: {
                            format: 2 as const,
                            parts: [
                                {
                                    type: "text" as const,
                                    text: `[System] Before concluding, verify the task is complete. ` +
                                        `You have resources available: ${reasons.join(", ")}. ` +
                                        `If the task requires additional steps, continue working. ` +
                                        `If the task is truly complete, you may finish.`
                                }
                            ]
                        }
                    };
                    
                    return [...messages, nudgeMsg];
                }
            }
            
            return messages;
        }
    };
}

/**
 * Heuristic detection of incomplete tasks.
 * Looks for patterns indicating the agent should continue.
 */
function detectIncompleteTask(messages: Array<{ role: string; content: unknown }>): boolean {
    // Get the most recent assistant message
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) return false;
    
    const text = extractTextFromMessage(lastAssistant);
    const lowerText = text.toLowerCase();
    
    // Patterns suggesting incompleteness
    const incompletePatterns = [
        "i'll need to",
        "i should",
        "next, i",
        "first, i",
        "then, i",
        "let me check",
        "i need to access",
        "i'll look up",
        "i'll search",
        "i'll call",
        "i'll use",
        "currently unavailable",
        "not available",
        "cannot access",
        "unable to access"
    ];
    
    return incompletePatterns.some(pattern => lowerText.includes(pattern));
}

function extractTextFromMessage(message: { content: unknown }): string {
    const content = message.content;
    if (typeof content === "string") return content;
    if (content && typeof content === "object" && "parts" in content) {
        const parts = (content as { parts: Array<{ type: string; text?: string }> }).parts;
        return parts
            .filter(p => p.type === "text" && p.text)
            .map(p => p.text)
            .join(" ");
    }
    return "";
}
```

**Integration in AgentResolver:**

```typescript
// Line ~1073 (after createToolCallGuardProcessor)

const outputProcessors = [
    createOutputGuardrailProcessor(record.id, organizationId),
    createToolResultCompressorProcessor({
        threshold: compressionThreshold,
        compressionModel: compressionModelInstance
    }),
    createToolCallGuardProcessor({
        maxCallsPerTool: 8,
        maxTotalToolCalls: (record.maxSteps ?? 5) * 2
    }),
    createContinuationGuardProcessor({
        maxSteps: record.maxSteps ?? 5,
        minToolCalls: record.maxSteps > 10 ? 1 : 0,
        remainingStepThreshold: 0.5,
        enableIncompleteDetection: true
    }),
    new ToolCallFilter(),
    new TokenLimiter(tokenLimit)
];
```

#### 5. Configuration Schema

**Database Schema Addition:**

```prisma
// Agent.metadata JSON structure (no schema change needed, documenting structure)
{
  "toolRetry": {
    "enabled": true,           // Enable/disable retry for this agent
    "maxRetries": 2,           // Max retry attempts (0-5)
    "initialDelayMs": 500,     // Initial delay in ms
    "maxDelayMs": 10000        // Max delay in ms
  },
  "continuationGuard": {
    "enabled": true,           // Enable/disable continuation guard
    "minToolCalls": 1,         // Minimum tool calls before completion
    "remainingStepThreshold": 0.5  // Nudge if >50% steps remain unused
  }
}
```

**UI Configuration** (apps/agent/src/app/agent/[workspace]/[slug]/configuration/):

Add to Agent Configuration page:

```typescript
// New section: "Execution Behavior"

<FormField>
  <FormLabel>Tool Call Retry</FormLabel>
  <FormDescription>
    Automatically retry tool calls on transient failures (timeouts, rate limits, temporary unavailability)
  </FormDescription>
  <Switch
    checked={metadata.toolRetry?.enabled ?? true}
    onCheckedChange={(enabled) => updateMetadata("toolRetry.enabled", enabled)}
  />
  
  {metadata.toolRetry?.enabled && (
    <>
      <FormLabel>Max Retries</FormLabel>
      <Input
        type="number"
        min="0"
        max="5"
        value={metadata.toolRetry?.maxRetries ?? 2}
        onChange={(e) => updateMetadata("toolRetry.maxRetries", parseInt(e.target.value))}
      />
    </>
  )}
</FormField>

<FormField>
  <FormLabel>Continuation Guard</FormLabel>
  <FormDescription>
    Prevent early termination when agent has many unused steps or hasn't used tools
  </FormDescription>
  <Switch
    checked={metadata.continuationGuard?.enabled ?? true}
    onCheckedChange={(enabled) => updateMetadata("continuationGuard.enabled", enabled)}
  />
  
  {metadata.continuationGuard?.enabled && (
    <>
      <FormLabel>Minimum Tool Calls</FormLabel>
      <Input
        type="number"
        min="0"
        max="10"
        value={metadata.continuationGuard?.minToolCalls ?? (maxSteps > 10 ? 1 : 0)}
        onChange={(e) => updateMetadata("continuationGuard.minToolCalls", parseInt(e.target.value))}
      />
    </>
  )}
</FormField>
```

---

## Impact Assessment

### Affected Components

1. **Agent Execution** (`AgentResolver.hydrate`)
   - **Change**: Add retry wrapper after permission guard
   - **Risk**: LOW - Non-breaking addition, wraps existing flow
   - **Rollback**: Remove wrapper, fall back to current behavior

2. **Tool Execution** (`tool.execute()`)
   - **Change**: Wrapped with retry logic
   - **Risk**: MEDIUM - Adds latency on failures, potential for amplification if misconfigured
   - **Mitigation**: Conservative defaults (2 retries, 500ms initial delay), exponential backoff

3. **System Instructions** (`AgentResolver.hydrate`)
   - **Change**: Append tool usage guidance
   - **Risk**: LOW - Prompt engineering change, may affect behavior slightly
   - **Mitigation**: A/B testing via experiment framework, measure impact

4. **Output Processors** (processor chain)
   - **Change**: Add continuation guard processor
   - **Risk**: LOW - Similar to existing processors, nudge-only by default
   - **Mitigation**: Configuration flag to disable

### Performance Impact

**Baseline (no retries):**
- Tool execution: 200-2000ms (varies by tool)
- Agent run: 2-10s (typical)

**With retries (2 max, exponential backoff):**
- Best case (no failures): No overhead
- Transient failure (1 retry): +500-1500ms
- Repeated failures (2 retries): +1500-4500ms
- Worst case (non-retryable error): No overhead (fails immediately)

**Estimated impact:**
- 95% of runs: No change (tools succeed on first attempt)
- 4% of runs: +500-1500ms (transient failure, 1 retry succeeds)
- 1% of runs: +1500-4500ms (multiple retries needed)

### Failure Modes & Mitigations

| Failure Mode | Impact | Mitigation |
|--------------|--------|------------|
| **Retry amplification** (many tools fail, all retry) | High latency, cascading delays | Conservative defaults (2 max retries), per-agent configuration, timeout enforcement |
| **Non-transient errors retried** (waste cycles) | Wasted retries, added latency | Smart `isRetryable()` detector, exclude permission/validation errors |
| **Retry loop** (tool always fails) | Timeout, wasted budget | Max 2 retries, exponential backoff, circuit breaker in future phase |
| **Continuation guard false positive** (task IS complete) | Unnecessary nudge, extra step | Heuristic tuning, configuration flag to disable |
| **Continuation guard false negative** (task NOT complete) | No change from current behavior | Progressive refinement of heuristics |

### Breaking Changes

**None.** All changes are backward-compatible additions:
- Retry wrapper is opt-out via `metadata.toolRetry.enabled: false`
- Continuation guard is opt-out via `metadata.continuationGuard.enabled: false`
- System prompt additions are additive (appended to instructions)
- Existing agents continue working with current behavior if metadata not set

---

## Data Model Changes

### Agent Metadata Extension

**No schema migration needed.** Uses existing `Agent.metadata` JSON field.

**New structure:**

```typescript
interface AgentMetadata {
  // ... existing fields
  
  toolRetry?: {
    enabled: boolean;
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  
  continuationGuard?: {
    enabled: boolean;
    minToolCalls: number;
    remainingStepThreshold: number;
  };
}
```

### Telemetry Data

**New Activity Type:**

```typescript
// ActivityLog entry for tool retry events
{
  type: "TOOL_RETRY",
  agentId: string,
  summary: "Retry attempt N for tool_name",
  detail: string, // Error message
  status: "info",
  source: "tool-execution",
  metadata: {
    toolId: string,
    runId: string,
    stepNumber: number,
    attempt: number
  }
}
```

**Existing AgentToolCall Enhancement:**

No schema change needed. Existing fields capture retry outcomes:
- `success: false` + `error: "..."` = Final failure after retries
- `success: true` + `durationMs: N` = Success (may include retry time)
- Activity log contains retry attempt details

---

## API Changes

### None

All changes are internal to agent execution. No public API modifications.

---

## Integration Points

### 1. Existing Retry Utility

**Reuse:** `packages/agentc2/src/lib/retry.ts`

The new retry wrapper uses the existing `withRetry()` utility, ensuring consistent retry behavior across the codebase.

### 2. Tool Execution Guard

**Integration Order:**

```
tool.execute()
    ↓
[1] wrapToolsWithPermissionGuard (permission/egress checks)
    ↓
[2] wrapToolWithRetry (retry logic) ← NEW
    ↓
[3] originalExecute (actual tool execution)
```

Retry logic is applied AFTER permission checks to avoid retrying permission denials.

### 3. MCP Client

**No changes needed.** `executeMcpTool()` returns structured errors that the retry logic detects:

```typescript
{ success: false, error: "Tool execution timed out after 60000ms" }
```

The retry wrapper catches these and retries if `isRetryable()` returns true.

### 4. Evaluation System

**Enhancement:** Tier 1 heuristic scorer can detect retry patterns:

```typescript
// New metric: retry_rate
const retryCount = activityLogs.filter(a => a.type === "TOOL_RETRY").length;
const retryRate = retryCount / toolCalls.length;

if (retryRate > 0.5) {
  flags.push(`high_retry_rate:${retryRate.toFixed(2)}`);
}
```

### 5. Inngest Background Jobs

**No changes needed.** The learning pipeline (`learning/signals.extract`) already tracks tool call success/failure rates. Retry events will be visible in activity logs.

---

## Phased Implementation

### Phase 1: Core Retry Infrastructure (MVP)

**Goal:** Enable automatic retry of transient tool failures

**Deliverables:**
1. `tool-execution-retry.ts` module
2. Integration in `AgentResolver.hydrate()`
3. Configuration via `Agent.metadata.toolRetry`
4. Telemetry (activity logs for retries)
5. Unit tests for retry logic

**Acceptance Criteria:**
- [ ] Transient errors (timeout, rate limit) are automatically retried (max 2 attempts)
- [ ] Non-retryable errors (permission, validation) fail immediately
- [ ] Retry events are logged to activity log
- [ ] Agents can disable retry via metadata
- [ ] No breaking changes to existing agents

**Estimated Effort:** 2-3 days

---

### Phase 2: System Prompt Enhancement

**Goal:** Reduce preemptive abandonment via LLM prompting

**Deliverables:**
1. Tool usage guidance appended to agent instructions
2. A/B testing via experiment framework
3. Evaluation metrics for:
   - Zero-tool-call rate (target: reduce by 50%)
   - Early termination rate (target: reduce by 30%)
   - Tool usage rate (target: increase by 20%)

**Acceptance Criteria:**
- [ ] Tool usage guidance added to all agents with tools
- [ ] A/B experiment compares baseline vs. enhanced prompts
- [ ] Evaluation scores show measurable improvement in tool usage
- [ ] No regression in output quality

**Estimated Effort:** 2-3 days

---

### Phase 3: Continuation Guard

**Goal:** Prevent early termination with unused steps

**Deliverables:**
1. `continuation-guard-processor.ts` module
2. Integration in `AgentResolver` output processors
3. Configuration via `Agent.metadata.continuationGuard`
4. Heuristic tuning based on production data

**Acceptance Criteria:**
- [ ] Agents with >50% unused steps receive nudge before terminating
- [ ] Agents with minToolCalls < actual calls receive nudge
- [ ] Heuristic incomplete task detection works for common patterns
- [ ] Nudge can be disabled via configuration
- [ ] No infinite loops (max 1 nudge per run)

**Estimated Effort:** 2-3 days

---

### Phase 4: Configuration UI & Observability

**Goal:** Enable operators to configure and monitor retry behavior

**Deliverables:**
1. UI configuration panel (Agent Settings → Execution Behavior)
2. Retry telemetry dashboard (Activity page)
3. Evaluation scorers detect high retry rates
4. Documentation for retry configuration

**Acceptance Criteria:**
- [ ] Admins can configure retry settings per agent
- [ ] Activity page shows retry events with tool/error details
- [ ] Evaluation flags agents with high retry rates
- [ ] Documentation explains retry behavior and configuration

**Estimated Effort:** 2-3 days

---

### Phase 5: Advanced Features (Future)

**Not in initial scope, but designed for future extension:**

1. **Circuit Breaker**: Temporarily disable tools with sustained failure rates
   - Track failure rate per tool over 5-minute window
   - Disable tool if failure rate > 80% over 10 attempts
   - Re-enable after 60s cooldown

2. **Per-Tool Retry Config**: Override retry settings for specific tools
   - Example: Firecrawl (3 retries) vs. calculator (0 retries)

3. **Adaptive Retry**: Adjust retry behavior based on historical success
   - Increase retries for tools with high transient failure rate
   - Decrease retries for reliably fast tools

4. **Fallback Tools**: Automatically try alternative tools on failure
   - Example: web-search → firecrawl-scrape → playwright-navigate

---

## Testing Strategy

### Unit Tests

**`tool-execution-retry.test.ts`:**
- [ ] Retries transient errors (timeout, rate limit, 503)
- [ ] Does not retry non-retryable errors (permission, validation)
- [ ] Respects maxRetries limit
- [ ] Uses exponential backoff with jitter
- [ ] Calls onRetry callback with correct arguments
- [ ] Records telemetry events

**`continuation-guard-processor.test.ts`:**
- [ ] Injects nudge when minToolCalls not met
- [ ] Injects nudge when >50% steps unused + incomplete task detected
- [ ] Does not inject nudge when task complete
- [ ] Injects max 1 nudge per run
- [ ] Heuristic detects common incomplete patterns

### Integration Tests

**`agent-resolver-retry.test.ts`:**
- [ ] Agent with retry enabled retries failed tool calls
- [ ] Agent with retry disabled does not retry
- [ ] Retry events recorded in activity log
- [ ] Retry latency added to AgentRun.durationMs

**`agent-execution-continuation.test.ts`:**
- [ ] Agent with high maxSteps receives continuation nudge
- [ ] Agent with low maxSteps does not receive nudge
- [ ] Continuation guard can be disabled via metadata

### Evaluation Tests

**`evaluation-retry-metrics.test.ts`:**
- [ ] Tier 1 scorer flags high retry rate
- [ ] Tier 2 auditor detects TOOL_SELECTION_ERROR improvements
- [ ] Zero-tool-call rate decreases with enhanced prompts

### Load Tests

**`retry-amplification.test.ts`:**
- [ ] 100 concurrent agents with failing tools do not cascade
- [ ] Max latency increase <3x baseline
- [ ] No timeouts or OOM errors

---

## Monitoring & Observability

### Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| **Zero Tool Call Rate** | % of runs with 0 tool calls | < 1% (down from ~5%) |
| **Retry Rate** | % of tool calls that required retry | 2-5% |
| **Retry Success Rate** | % of retries that succeeded | > 70% |
| **Early Termination Rate** | % of runs with >50% unused steps | < 5% (down from ~15%) |
| **Continuation Nudge Rate** | % of runs that received continuation nudge | 5-10% |
| **Average Tool Latency** | Mean durationMs for tool calls | < +10% increase |

### Dashboards

**Activity Page Enhancement:**
- New filter: "Tool Retries"
- Display: Tool name, error message, retry count, final outcome
- Aggregation: Retry rate per agent, per tool

**Evaluation Page Enhancement:**
- New flag: `high_retry_rate:{rate}`
- New metric: `retry_success_rate`
- Comparison: Before/after retry implementation

---

## Rollback Plan

### Immediate Rollback

**If critical issues detected (infinite loops, cascading failures):**

1. **Disable retry globally via feature flag:**
   ```typescript
   // Add to env vars
   FEATURE_TOOL_RETRY_ENABLED="false"
   
   // Check in wrapToolWithRetry
   if (process.env.FEATURE_TOOL_RETRY_ENABLED === "false") {
     return; // Skip retry wrapper
   }
   ```

2. **Disable continuation guard via feature flag:**
   ```typescript
   FEATURE_CONTINUATION_GUARD_ENABLED="false"
   ```

3. **Deploy rollback** (no code change needed, just env var update)

### Gradual Rollback

**If issues affect specific agents/tools:**

1. **Disable retry for specific agent:**
   ```typescript
   // Agent configuration UI or direct DB update
   UPDATE agent SET metadata = jsonb_set(metadata, '{toolRetry,enabled}', 'false')
   WHERE slug = 'problematic-agent';
   ```

2. **Disable continuation guard for specific agent:**
   ```typescript
   UPDATE agent SET metadata = jsonb_set(metadata, '{continuationGuard,enabled}', 'false')
   WHERE slug = 'problematic-agent';
   ```

### Full Revert

**If fundamental design issues discovered:**

1. Remove `wrapToolWithRetry()` call from `AgentResolver`
2. Remove continuation guard processor from output processors
3. Remove tool usage guidance from instructions
4. Deploy code revert

**No data migration needed** (metadata.toolRetry is optional)

---

## Security & Privacy Considerations

### Security Impact: POSITIVE

**Retry logic improves resilience against:**
- Transient DoS (temporary service outages)
- Rate limiting (gradual backoff avoids hammering)

**No new vulnerabilities introduced:**
- Retry only affects tool execution (existing security boundaries)
- Permission checks happen BEFORE retry logic
- Egress checks happen BEFORE retry logic

### Privacy Impact: NONE

- No new data collected (retry events use existing activity log)
- No PII exposed in retry telemetry

### Abuse Prevention

**Potential abuse vector: Intentional tool failures to amplify cost**

**Mitigation:**
- Max 2 retries (3 total attempts per tool call)
- Exponential backoff (delays cost amplification)
- Tool call budget still enforced (maxTotalToolCalls)
- Per-tool budget still enforced (maxCallsPerTool: 8)

**Max amplification factor:**
- Without retry: 1x baseline cost
- With 2 retries: 3x baseline cost (worst case, all tools fail twice)
- In practice: ~1.05x average cost (95% no retry, 5% one retry)

---

## Documentation Updates

### Developer Documentation

**New docs:**
1. `docs/agent-retry-logic.md` - Retry behavior, configuration, troubleshooting
2. `docs/continuation-guard.md` - How continuation guard works, when it triggers

**Updated docs:**
1. `CLAUDE.md` - Add retry configuration to agent architecture section
2. `docs/agent-configuration.md` - Add Execution Behavior section
3. `docs/troubleshooting.md` - Add "Tool calls failing repeatedly" section

### User Documentation

**Agent Configuration Guide:**
- New section: "Execution Behavior"
- Explain retry settings (when to enable, adjust maxRetries)
- Explain continuation guard (for complex multi-step agents)

**Best Practices:**
- Recommend retry enabled for all production agents
- Suggest minToolCalls=1 for agents with maxSteps > 10
- Explain how to diagnose high retry rates (Activity page)

---

## Success Criteria

### Quantitative Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Zero Tool Call Rate | 5% | < 1% | AgentRun where toolCalls.length = 0 |
| Early Termination Rate | 15% | < 5% | Runs with >50% unused steps |
| Transient Failure Success | 0% (immediate fail) | > 70% | Retry success rate |
| Avg Tool Latency | 500ms | < 550ms | Mean AgentToolCall.durationMs |
| Evaluation Score (TOOL_SELECTION_ERROR) | 10% flagged | < 3% | Tier 2 auditor failure mode |

### Qualitative Outcomes

- [ ] Agents attempt tool calls rather than assuming unavailability
- [ ] Transient errors (rate limits, timeouts) recover automatically
- [ ] Multi-step agents complete tasks before terminating
- [ ] Evaluation scores improve for tool usage and task completion
- [ ] No reports of "agent gave up too early"

---

## Open Questions

1. **Should retry configuration be workspace-level or agent-level?**
   - **Recommendation:** Agent-level (via metadata) with workspace defaults in future phase
   - **Rationale:** Different agents have different tool usage patterns

2. **Should continuation guard apply to all agents or only those with maxSteps > threshold?**
   - **Recommendation:** All agents, but minToolCalls=0 for agents with low maxSteps
   - **Rationale:** Prevents edge cases where even simple agents give up prematurely

3. **Should retry events count against tool call budget?**
   - **Recommendation:** No, retries do not count against maxTotalToolCalls budget
   - **Rationale:** Retries are for reliability, not agent behavior; counting would penalize transient failures

4. **Should we add circuit breaker in Phase 1 or defer to Phase 5?**
   - **Recommendation:** Defer to Phase 5, monitor in production first
   - **Rationale:** Conservative approach, avoid over-engineering until we see sustained failure patterns

---

## References

### Related Issues
- [#151](https://github.com/Appello-Prototypes/agentc2/issues/151) - Agent should retry tool calls on transient failures

### Related Code
- `packages/agentc2/src/lib/retry.ts` - Existing retry utility
- `packages/agentc2/src/security/tool-execution-guard.ts` - Tool permission wrapper
- `packages/agentc2/src/processors/tool-call-guard-processor.ts` - Tool call monitoring
- `packages/agentc2/src/mcp/client.ts` - MCP tool execution

### Related Documentation
- [Mastra Processors Documentation](https://docs.mastra.ai/processors)
- [Agent Configuration Guide](./docs/agent-configuration.md)
- [Tool Development Guide](./docs/tool-development.md)

---

## Appendix: Error Classification

### Retryable Errors

| Error Type | Pattern | Retry? | Reason |
|------------|---------|--------|--------|
| Network timeout | `ETIMEDOUT`, `timeout` | ✅ | Transient network issue |
| Connection refused | `ECONNREFUSED` | ✅ | Service temporarily down |
| Connection reset | `ECONNRESET`, `socket hang up` | ✅ | Network interruption |
| Rate limit | `429`, `rate limit`, `too many requests` | ✅ | Backoff and retry succeeds |
| Server error | `502`, `503`, `504` | ✅ | Temporary server issue |
| Service unavailable | `service unavailable`, `temporarily unavailable` | ✅ | Service restart |
| Token expired | `invalid_token`, `token expired` | ✅ | OAuth refresh needed |

### Non-Retryable Errors

| Error Type | Pattern | Retry? | Reason |
|------------|---------|--------|--------|
| Permission denied | `[TOOL BLOCKED]`, `Permission denied` | ❌ | Won't change on retry |
| Invalid parameters | `Invalid parameters`, Zod validation error | ❌ | Logic error, not transient |
| Tool not found | `Tool not found` (without "loading") | ❌ | Configuration issue |
| Insufficient access | `Insufficient access` | ❌ | ACL issue |
| Egress denied | `Egress denied` | ❌ | Policy violation |
| Authentication failed | `401`, `authentication failed` (non-token) | ❌ | Credential issue |
| Not found | `404` | ❌ | Resource doesn't exist |
| Bad request | `400` | ❌ | Invalid request format |

---

**End of Technical Design**

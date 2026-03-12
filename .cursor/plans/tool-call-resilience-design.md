# Technical Design: Agent Tool Call Resilience

**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/151  
**Priority:** Medium | **Scope:** High  
**Design Date:** 2026-03-12  
**Status:** Design Phase

---

## Executive Summary

This design introduces automatic retry logic and behavioral guardrails to prevent agents from prematurely giving up when tools encounter transient failures. The solution operates at three layers:

1. **Runtime Layer**: Automatic retry with exponential backoff for tool execution failures
2. **Instruction Layer**: System prompts that encourage tool usage and multi-step reasoning
3. **Guardrail Layer**: Minimum tool call requirements for agents with high maxSteps budgets

---

## Problem Statement

### Evidence

**Run cmmmvj3kw00a58exvmha1e3jv (sdlc-signal-harvester):**
- Agent configured with 30 maxSteps
- Made **0 tool calls** total
- Used only 44 completion tokens in 2046ms
- Immediately responded "Jira tools are currently unavailable" without attempting any tool call
- Evaluation: 0.225 score, CRITICAL: TOOL_SELECTION_ERROR

**Run cmmmvd41b008l8exvctdhd9vd:**
- Successfully called 4 tools and retrieved rich data
- Stopped after 137 completion tokens instead of continuing analysis
- Had 26 remaining steps unused
- Failed to complete multi-step pipeline despite having tools and budget

### Root Causes

1. **No automatic retry** - Tool execution failures immediately return error strings to the agent, which interprets them as permanent unavailability
2. **Passive tool availability messaging** - Current instruction appends tell the agent "tools are unavailable" but don't encourage attempts
3. **Early termination bias** - Agents have no incentive to use remaining steps after initial success
4. **Missing guardrails** - No minimum tool call requirement for high-step agents designed for multi-step workflows

---

## Current Architecture Analysis

### Tool Execution Flow

```
User Request
    ↓
AgentResolver.resolve() - Loads agent from DB, hydrates tools
    ↓
agent.generate() or agent.stream() - Mastra Agent execution
    ↓
Processors (Input) - InputGuardrailProcessor, StepAnchorProcessor, ContextWindowProcessor
    ↓
LLM Call - Model decides to use tools
    ↓
Tool Execution - Via tool.execute()
    ├─→ Permission Guard (checkToolPermission, checkEgressPermission)
    ├─→ Tool Implementation (registry tool or MCP tool)
    └─→ Result or Error returned
    ↓
Processors (Output) - ToolCallGuardProcessor, OutputGuardrailProcessor
    ↓
Response Stream - Returns to client
    ↓
Run Recorder - Records AgentRun, AgentToolCall, AgentTrace
    ↓
Inngest Events - Triggers run/completed → run/evaluate
```

### Key Components

#### 1. AgentResolver (`packages/agentc2/src/agents/resolver.ts`)

**Responsibilities:**
- Resolves agent from database (lines 293-450)
- Hydrates tools from registry and MCP servers (lines 458-1133)
- Performs tool health check (lines 817-851)
- Injects unavailable tool notices into instructions (lines 862-871)
- Wraps tools with permission guards (lines 992-1024)
- Configures processors (lines 1025-1094)

**Current Tool Health Behavior:**
```typescript:817:871:packages/agentc2/src/agents/resolver.ts
// Lines 817-851: Tool health check
const loadedToolNames = new Set(Object.keys(tools));
const missingTools = [...expectedToolNames].filter((t) => !loadedToolNames.has(t));

if (missingTools.length > 0) {
    console.warn(`[AgentResolver] Tool health warning...`);
    recordActivity({
        type: "ALERT_RAISED",
        summary: `${record.slug}: ${missingTools.length} tool(s) unavailable`,
        status: "warning"
    });
}

// Lines 862-871: Inject unavailable tool notice
if (missingTools.length > 0) {
    finalInstructions +=
        `\n\n---\n# Tool Availability Notice\n` +
        `The following tools are currently unavailable (MCP server may be down or tool not loaded): ` +
        `${missingTools.join(", ")}. ` +
        `If a user's request requires one of these tools, inform them the capability is temporarily ` +
        `unavailable and suggest alternative approaches or ask them to try again later. ` +
        `Do NOT attempt to call these tools.\n`;
}
```

**Problem:** This tells the agent to NOT call tools proactively. It doesn't encourage trying tools that ARE loaded.

#### 2. Tool Execution (`packages/agentc2/src/security/tool-execution-guard.ts`)

**Current Flow:**
```typescript:34:90:packages/agentc2/src/security/tool-execution-guard.ts
// Tools are wrapped with permission checks
const originalExecute = tool.execute.bind(tool);

tool.execute = async (context: any) => {
    // 1. Permission check
    let permResult = await checkToolPermission(agentId, toolId, requiredCategory);
    if (!permResult.allowed) {
        return { error: `[TOOL BLOCKED] Permission denied...` };
    }
    
    // 2. Egress check
    if (organizationId && targetUrl) {
        let egressResult = await checkEgressPermission(organizationId, targetUrl);
        if (!egressResult.allowed) {
            return { error: `[TOOL BLOCKED] Egress denied...` };
        }
    }
    
    // 3. Execute tool (NO RETRY)
    return originalExecute(context);
};
```

**Problem:** No retry logic. If `originalExecute()` throws or returns an error, it's immediately returned to the LLM.

#### 3. MCP Tool Execution (`packages/agentc2/src/mcp/client.ts`)

**Current Implementation:**
```typescript:5018:5074:packages/agentc2/src/mcp/client.ts
// Execute with timeout (60 seconds)
const executePromise = (tool as any).execute({ context: parameters });
const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
);
const result = await Promise.race([executePromise, timeoutPromise]);

// Truncate result and return
return {
    success: true,
    toolName: matchedName,
    result: truncateMcpResult(result)
};
```

**Problem:** Single-shot execution. If the tool fails (network error, rate limit, timeout), the error is caught and returned as `{ success: false, error: "..." }` with no retry attempt.

**Existing Retry for Server Connection:**
```typescript:3991:4021:packages/agentc2/src/mcp/client.ts
// MCP server connection has 1 retry when loading tools
async function loadToolsFromServer(serverId: string, serverDef, maxRetries = 1) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 2000));
            console.log(`[MCP] Retrying server "${serverId}" (attempt ${attempt + 1})`);
        }
        try {
            const tools = await client.listTools();
            return { serverId, tools };
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}
```

**Insight:** Retry logic exists for server **connection** but not for individual **tool execution**.

#### 4. Existing Retry Utility (`packages/agentc2/src/lib/retry.ts`)

```typescript:1:79:packages/agentc2/src/lib/retry.ts
// General-purpose retry utility with exponential backoff
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>

// Default options:
{
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    jitter: true,
    isRetryable: defaultIsRetryable  // Checks for transient errors
}

// Transient error detection:
function defaultIsRetryable(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
        if (msg.includes("timeout") || msg.includes("etimedout")) return true;
        if (msg.includes("socket hang up") || msg.includes("epipe")) return true;
    }
    
    // HTTP status codes
    if (error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504) {
        return true;
    }
    
    return false;
}
```

**Insight:** A production-grade retry utility already exists in the codebase but is **not used for tool execution**.

#### 5. Tool Call Guard Processor (`packages/agentc2/src/processors/tool-call-guard-processor.ts`)

**Current Responsibilities:**
- Enforce per-tool call limits (default: 8 calls per tool)
- Enforce global tool call limits (default: maxSteps * 2)
- Detect duplicate tool calls (same tool + args 3+ times → abort)
- Detect empty results (3+ times → nudge message)

**Relevant Code:**
```typescript:48:164:packages/agentc2/src/processors/tool-call-guard-processor.ts
export function createToolCallGuardProcessor(config?: ToolCallGuardConfig): Processor {
    const maxCallsPerTool = config?.maxCallsPerTool ?? 8;
    const maxTotalToolCalls = config?.maxTotalToolCalls ?? 30;
    const emptyResultThreshold = config?.emptyResultThreshold ?? 3;
    const deduplicateThreshold = config?.deduplicateThreshold ?? 3;
    
    // ... tracking state ...
    
    // Nudge messages when patterns detected:
    if (emptyNudgeTools.length > 0) {
        nudges.push(
            `[System] ${toolList} has returned empty/no results 3+ times. ` +
            `Stop calling it and use what's already in your context. ` +
            `If you don't have what you need, inform the user rather than retrying.`
        );
    }
}
```

**Problem:** This processor **discourages retries** after multiple failures. It doesn't distinguish between:
- Transient failures (should retry)
- Empty results (should stop)
- Logic errors (should adapt)

#### 6. Step Anchor Processor (`packages/agentc2/src/processors/step-anchor.ts`)

**Current Behavior:**
```typescript:84:112:packages/agentc2/src/processors/step-anchor.ts
const isFinalStep = currentStep >= maxSteps;

if (isFinalStep) {
    anchorText = [
        "",
        `[Progress - FINAL STEP ${currentStep}/${maxSteps}]`,
        `This is your last step. Provide your final answer now.`,
        `Recent progress:\n${progressLines.join("\n")}`,
        `Summarize your findings and respond to the user.`
    ].join("\n");
} else {
    anchorText = [
        "",
        `[Progress - Step ${currentStep}/${maxSteps}]`,
        `Recent progress:\n${progressLines.join("\n")}`,
        `Continue your task. Do not repeat completed steps.`
    ].join("\n");
}
```

**Problem:** No differentiation between "you're making progress" and "you haven't done much yet" scenarios. Agent isn't nudged to use tools when it's underutilizing its budget.

#### 7. Legacy Managed Generate (`packages/agentc2/src/lib/managed-generate.ts`)

**Status:** Deprecated, but shows original error handling patterns:

```typescript:568:604:packages/agentc2/src/lib/managed-generate.ts
// Detect failed tool calls
const failedTools = stepToolResults.filter((r) => {
    const text = typeof result === "string" ? result : JSON.stringify(result);
    return (
        text.includes("[TOOL BLOCKED]") ||
        text.includes('"error"') ||
        text.includes("Error:") ||
        text.includes("ECONNREFUSED") ||
        text.includes("permission denied")
    );
});

if (failedTools.length > 0) {
    messages.push({
        role: "user",
        content:
            `[System] ${failedNames.length} tool call(s) returned errors: ${failedNames.join(", ")}. ` +
            `Analyze the error messages above. If it's a permission or connection issue, ` +
            `do NOT retry the same tool — choose an alternative approach or inform the user. ` +
            `If the arguments were wrong, fix them and retry once.`
    });
}
```

**Insight:** The system currently relies on the **LLM to decide** whether to retry, rather than automatically retrying transient failures at the runtime level.

---

## Proposed Solution Architecture

### Design Principles

1. **Separate transient from permanent failures** - Retry network/rate-limit errors, don't retry auth/validation errors
2. **Fail fast on permanent errors** - Don't waste tokens retrying impossible operations
3. **Transparent to the agent** - Retry happens at runtime layer, agent sees success or permanent failure
4. **Configurable per agent** - Allow retry behavior to be tuned via Agent.metadata
5. **Preserve observability** - All retry attempts logged in AgentToolCall records
6. **Backwards compatible** - No breaking changes to existing agents

---

## Component 1: Tool Execution Retry Wrapper

### 1.1 Architecture

**Location:** New file `packages/agentc2/src/tools/tool-execution-wrapper.ts`

**Responsibility:** Wrap all tool execute functions with retry logic **before** they're attached to the agent.

### 1.2 Implementation Design

```typescript
/**
 * Tool Execution Wrapper
 * 
 * Wraps tool.execute() with automatic retry for transient failures.
 * Applied in AgentResolver.hydrate() after permission guards are attached.
 */

import { withRetry } from "../lib/retry";

export interface ToolRetryConfig {
    /** Max retry attempts for transient failures. Default: 2 */
    maxRetries?: number;
    /** Initial delay between retries in ms. Default: 500 */
    initialDelayMs?: number;
    /** Max delay between retries in ms. Default: 10000 */
    maxDelayMs?: number;
    /** Custom function to determine if an error is retryable */
    isRetryable?: (error: unknown, toolName: string) => boolean;
    /** Callback for retry attempts (for logging/telemetry) */
    onRetry?: (toolName: string, error: unknown, attempt: number) => void;
}

export interface ToolExecutionResult {
    success: boolean;
    result?: unknown;
    error?: string;
    attempts?: number;
    retriedErrors?: string[];
}

/**
 * Wrap a tool's execute function with retry logic.
 */
export function wrapToolWithRetry(
    tool: any,
    toolName: string,
    config: ToolRetryConfig,
    context: { agentId: string; organizationId?: string }
): any {
    if (!tool || typeof tool.execute !== "function") {
        return tool;
    }
    
    const originalExecute = tool.execute.bind(tool);
    
    tool.execute = async (execContext: any) => {
        const attempts: Array<{ error: string; attempt: number }> = [];
        
        try {
            const result = await withRetry(
                () => originalExecute(execContext),
                {
                    maxRetries: config.maxRetries ?? 2,
                    initialDelayMs: config.initialDelayMs ?? 500,
                    maxDelayMs: config.maxDelayMs ?? 10000,
                    jitter: true,
                    isRetryable: (error) => {
                        const isRetryable = config.isRetryable
                            ? config.isRetryable(error, toolName)
                            : defaultToolRetryCheck(error, toolName);
                        
                        if (!isRetryable) {
                            console.log(
                                `[ToolRetry] ${toolName}: permanent error, not retrying:`,
                                error instanceof Error ? error.message : error
                            );
                        }
                        
                        return isRetryable;
                    },
                    onRetry: (error, attempt) => {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        attempts.push({ error: errorMsg, attempt });
                        console.log(`[ToolRetry] ${toolName}: attempt ${attempt} failed, retrying...`);
                        
                        if (config.onRetry) {
                            config.onRetry(toolName, error, attempt);
                        }
                    }
                }
            );
            
            // Success - return result with metadata
            return {
                ...result,
                __retry_metadata: {
                    attempts: attempts.length + 1,
                    retriedErrors: attempts.map((a) => a.error)
                }
            };
        } catch (error) {
            // All retries exhausted - return structured error
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(
                `[ToolRetry] ${toolName}: failed after ${attempts.length + 1} attempts:`,
                errorMsg
            );
            
            return {
                error: errorMsg,
                __retry_metadata: {
                    attempts: attempts.length + 1,
                    retriedErrors: attempts.map((a) => a.error),
                    finalError: errorMsg
                }
            };
        }
    };
    
    return tool;
}

/**
 * Default retry eligibility check for tool execution.
 */
function defaultToolRetryCheck(error: unknown, toolName: string): boolean {
    // Never retry permission/authorization errors
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("[tool blocked]")) return false;
        if (msg.includes("permission denied")) return false;
        if (msg.includes("unauthorized") || msg.includes("403")) return false;
        if (msg.includes("forbidden")) return false;
        if (msg.includes("budget exceeded")) return false;
        if (msg.includes("invalid arguments") || msg.includes("validation")) return false;
    }
    
    // Always retry network errors
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("econnrefused") || msg.includes("econnreset")) return true;
        if (msg.includes("timeout") || msg.includes("etimedout")) return true;
        if (msg.includes("socket hang up") || msg.includes("epipe")) return true;
        if (msg.includes("network error")) return true;
    }
    
    // Retry rate limits and server errors
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as any).status;
        if (status === 429) return true; // Rate limit
        if (status === 502 || status === 503 || status === 504) return true; // Server errors
        if (status === 500) return true; // Internal server error (often transient)
    }
    
    // Check for rate limit in message
    if (error instanceof Error && error.message.toLowerCase().includes("rate limit")) {
        return true;
    }
    
    // Default: don't retry unknown errors (fail fast)
    return false;
}

/**
 * Wrap all tools in a record with retry logic.
 */
export function wrapToolsWithRetry(
    tools: Record<string, any>,
    config: ToolRetryConfig,
    context: { agentId: string; organizationId?: string }
): { tools: Record<string, any>; wrappedCount: number } {
    let wrappedCount = 0;
    
    for (const [toolName, tool] of Object.entries(tools)) {
        tools[toolName] = wrapToolWithRetry(tool, toolName, config, context);
        wrappedCount++;
    }
    
    return { tools, wrappedCount };
}
```

### 1.3 Integration Point

**File:** `packages/agentc2/src/agents/resolver.ts`

**Change Location:** In `hydrate()` method, after permission guards are applied (line 992+):

```typescript
// Current code (line 992-1024):
const { toolsGuarded, permissionChecksWired } = wrapToolsWithPermissionGuard(
    tools,
    record.id,
    organizationId
);

// NEW: Apply retry wrapper after permission guards
const retryConfig = extractRetryConfig(record.metadata);
if (retryConfig.enabled) {
    const { tools: retriedTools, wrappedCount } = wrapToolsWithRetry(
        tools,
        {
            maxRetries: retryConfig.maxRetries,
            initialDelayMs: retryConfig.initialDelayMs,
            maxDelayMs: retryConfig.maxDelayMs,
            onRetry: (toolName, error, attempt) => {
                // Log retry attempts for observability
                console.log(
                    `[AgentResolver] Tool retry: ${toolName} (agent: ${record.slug}, ` +
                    `attempt: ${attempt}, error: ${error instanceof Error ? error.message : error})`
                );
            }
        },
        { agentId: record.id, organizationId }
    );
    tools = retriedTools;
    console.log(
        `[AgentResolver] Wrapped ${wrappedCount} tools with retry logic ` +
        `(maxRetries: ${retryConfig.maxRetries})`
    );
}
```

### 1.4 Configuration Schema

**Agent.metadata JSON field:**

```typescript
interface AgentMetadata {
    // ... existing fields ...
    
    toolExecution?: {
        /** Enable automatic retry for tool failures. Default: true */
        retryEnabled?: boolean;
        /** Max retry attempts. Default: 2 (3 total attempts) */
        maxRetries?: number;
        /** Initial retry delay in ms. Default: 500 */
        initialRetryDelayMs?: number;
        /** Max retry delay in ms. Default: 10000 */
        maxRetryDelayMs?: number;
        /** Custom retry conditions per tool */
        perToolRetry?: Record<string, {
            enabled: boolean;
            maxRetries?: number;
        }>;
    };
}
```

**Example:**
```json
{
    "toolExecution": {
        "retryEnabled": true,
        "maxRetries": 3,
        "initialRetryDelayMs": 1000,
        "perToolRetry": {
            "hubspot_hubspot-get-contacts": {
                "enabled": true,
                "maxRetries": 5
            },
            "jira_jira-search-issues": {
                "enabled": true,
                "maxRetries": 3
            }
        }
    }
}
```

### 1.5 Observability Enhancements

**AgentToolCall Schema Update:**

```prisma
model AgentToolCall {
    id          String   @id @default(cuid())
    // ... existing fields ...
    
    // NEW: Retry tracking
    attempts         Int      @default(1)
    retriedErrorsJson Json?   // [{attempt: 1, error: "ETIMEDOUT"}, ...]
    
    @@index([toolKey, success]) // Enable fast filtering by success/failure
}
```

**Telemetry Events:**

Record retry attempts as Activity events:
```typescript
recordActivity({
    type: "TOOL_RETRY",
    agentId: agentId,
    agentSlug: agentSlug,
    summary: `${toolName}: retry attempt ${attempt}`,
    detail: `Error: ${errorMessage}. Retrying in ${delayMs}ms...`,
    status: "info",
    source: "tool-execution",
    metadata: {
        toolName,
        attempt,
        totalAttempts: maxRetries + 1,
        errorMessage,
        delayMs
    }
});
```

---

## Component 2: Proactive Tool Usage Instructions

### 2.1 Problem Analysis

Current instruction injection (resolver.ts line 862-871):
```
Do NOT attempt to call these tools.
```

This creates a **negative bias** where agents avoid tool usage when they detect unavailability signals.

### 2.2 Proposed Changes

**File:** `packages/agentc2/src/agents/resolver.ts`

**Change 1: Rewrite Unavailable Tools Notice (lines 862-871)**

From:
```typescript
if (missingTools.length > 0) {
    finalInstructions +=
        `\n\n---\n# Tool Availability Notice\n` +
        `The following tools are currently unavailable: ${missingTools.join(", ")}. ` +
        `Do NOT attempt to call these tools.\n`;
}
```

To:
```typescript
if (missingTools.length > 0) {
    finalInstructions +=
        `\n\n---\n# Tool Availability Notice\n` +
        `Some tools may be temporarily unavailable: ${missingTools.join(", ")}.\n\n` +
        `**However:** You should ALWAYS attempt to use your available tools to fulfill the user's request. ` +
        `The system will automatically retry transient failures. Only if a tool returns a permanent ` +
        `error (permission denied, invalid arguments) should you consider alternatives.\n\n` +
        `Available tools: ${Array.from(loadedToolNames).slice(0, 20).join(", ")}${loadedToolNames.size > 20 ? `, ... (${loadedToolNames.size - 20} more)` : ""}.\n`;
}
```

**Change 2: Add Tool Usage Encouragement (always, not just when tools are missing)**

Insert after skill instructions (after line 860):

```typescript
// NEW: Always inject tool usage guidance
finalInstructions += `\n\n---\n# Tool Usage Guidelines\n`;
finalInstructions += `1. **Attempt tool calls proactively** - When the user's request requires data or actions, `;
finalInstructions += `call the appropriate tools. Do not assume tools are unavailable.\n`;
finalInstructions += `2. **Multi-step tasks** - If your maxSteps budget is >10, the user likely expects `;
finalInstructions += `multi-step reasoning. Use tools to gather data, then analyze, then act.\n`;
finalInstructions += `3. **Transient failures are retried** - The system automatically retries network `;
finalInstructions += `errors and rate limits. You will only see permanent errors (auth, validation).\n`;
finalInstructions += `4. **Inform the user** - If a tool returns a permanent error, explain what happened `;
finalInstructions += `and suggest alternatives or next steps.\n`;
```

### 2.3 Per-Agent Configuration

Add optional override in Agent.metadata:

```typescript
interface AgentMetadata {
    toolUsagePolicy?: {
        /** Inject proactive tool usage instructions. Default: true */
        encourageToolUsage?: boolean;
        /** Custom tool usage guidance to append */
        customGuidance?: string;
    };
}
```

---

## Component 3: Progress Nudging for Underutilization

### 3.1 Problem Analysis

Current StepAnchorProcessor provides progress updates but doesn't differentiate between:
- Agent making good progress (multiple tool calls, working through pipeline)
- Agent underutilizing budget (few tool calls, giving up early)

### 3.2 Proposed Enhancement

**File:** `packages/agentc2/src/processors/step-anchor.ts`

**Enhancement:** Track tool call density and inject nudges when agent is idle.

```typescript
export interface StepAnchorConfig {
    // ... existing fields ...
    
    /** Enable progress nudging for underutilization. Default: true */
    enableProgressNudging?: boolean;
    /** Tool calls per step threshold. Below this triggers nudge. Default: 0.3 */
    minToolCallDensity?: number;
}

interface AnchorState {
    toolCallHistory: Array<{ step: number; toolName: string }>;
    
    // NEW: Track progress quality
    lastNudgeStep: number;
    totalStepsSoFar: number;
}

// In processInputStep():
const currentStep = stepNumber + 1;
const toolCallDensity = as.toolCallHistory.length / currentStep;
const hasToolsAvailable = args.tools && Object.keys(args.tools).length > 0;
const isMidExecution = currentStep > 3 && currentStep < maxSteps * 0.7;
const isUnderutilized = toolCallDensity < (config.minToolCallDensity ?? 0.3);

// Inject nudge if underutilized and hasn't been nudged recently
if (
    config.enableProgressNudging &&
    isMidExecution &&
    isUnderutilized &&
    hasToolsAvailable &&
    (currentStep - as.lastNudgeStep > 5)
) {
    as.lastNudgeStep = currentStep;
    
    anchorText += `\n\n[System Notice] You have ${maxSteps - currentStep} steps remaining ` +
        `but have only used ${as.toolCallHistory.length} tool calls so far. ` +
        `If the user's request requires data gathering or multi-step analysis, ` +
        `continue using your tools to provide a comprehensive response. ` +
        `Do not finish prematurely if more work is needed.`;
    
    console.log(
        `[StepAnchor] Injecting progress nudge at step ${currentStep}/${maxSteps} ` +
        `(density: ${toolCallDensity.toFixed(2)}, tools used: ${as.toolCallHistory.length})`
    );
}
```

---

## Component 4: Minimum Tool Call Guardrail

### 4.1 Rationale

Agents configured with high maxSteps (20+) are designed for complex, multi-step workflows. If such an agent completes in 2 steps with 0-1 tool calls, it's likely:
- Misunderstood the task scope
- Gave up prematurely due to perceived unavailability
- Needs explicit encouragement to utilize its budget

### 4.2 Architecture

**Location:** New processor `packages/agentc2/src/processors/minimum-tool-call-processor.ts`

**Type:** Output processor (runs at the end of generation)

### 4.3 Implementation Design

```typescript
/**
 * Minimum Tool Call Processor
 * 
 * Enforces a minimum tool call threshold for agents with high maxSteps budgets.
 * If the agent completes with fewer tool calls than expected, the processor
 * aborts with a nudge message encouraging more thorough execution.
 */

import type { Processor, ProcessOutputResultArgs } from "@mastra/core/processors";

export interface MinimumToolCallConfig {
    /** Enable minimum tool call enforcement. Default: false */
    enabled?: boolean;
    /** Minimum tool calls required (absolute). Optional. */
    minToolCalls?: number;
    /** Minimum tool calls as ratio of maxSteps. Default: 0.5 (half of maxSteps) */
    minToolCallRatio?: number;
    /** Only enforce if maxSteps >= this threshold. Default: 10 */
    maxStepsThreshold?: number;
    /** Max retries before accepting low tool call count. Default: 1 */
    maxRetries?: number;
}

interface MinToolCallState {
    enforcementTriggered: boolean;
    retryAttempts: number;
}

export function createMinimumToolCallProcessor(
    config: MinimumToolCallConfig,
    maxSteps: number
): Processor<"minimum-tool-call"> {
    const enabled = config.enabled ?? false;
    const minToolCallRatio = config.minToolCallRatio ?? 0.5;
    const maxStepsThreshold = config.maxStepsThreshold ?? 10;
    const maxRetries = config.maxRetries ?? 1;
    
    return {
        id: "minimum-tool-call" as const,
        name: "Minimum Tool Call Enforcer",
        
        async processOutputResult(args: ProcessOutputResultArgs) {
            const { messages, steps, abort, state } = args;
            
            // Only enforce for high-step agents
            if (!enabled || maxSteps < maxStepsThreshold) {
                return messages;
            }
            
            // Initialize state
            const mtcState = state as unknown as MinToolCallState;
            if (mtcState.retryAttempts === undefined) {
                mtcState.retryAttempts = 0;
            }
            
            // Count tool calls from steps
            const toolCallCount = countToolCalls(steps);
            
            // Calculate minimum threshold
            const minRequired = config.minToolCalls ?? Math.ceil(maxSteps * minToolCallRatio);
            
            // Check if threshold is met
            if (toolCallCount >= minRequired) {
                return messages; // Threshold met, no intervention
            }
            
            // Threshold not met - check retry budget
            if (mtcState.retryAttempts >= maxRetries) {
                console.warn(
                    `[MinToolCall] Agent completed with ${toolCallCount}/${minRequired} tool calls ` +
                    `after ${mtcState.retryAttempts} retries. Accepting result.`
                );
                return messages;
            }
            
            // Abort with retry nudge
            mtcState.retryAttempts += 1;
            
            const nudgeMessage =
                `[System] You completed in ${steps?.length ?? 0} steps with only ${toolCallCount} tool calls. ` +
                `This task appears to require more thorough investigation (you have ${maxSteps} steps available). ` +
                `Please use your tools to gather comprehensive data and provide a complete analysis. ` +
                `Expected minimum: ${minRequired} tool calls for a ${maxSteps}-step agent.`;
            
            console.log(
                `[MinToolCall] Triggering retry: ${toolCallCount}/${minRequired} tool calls, ` +
                `attempt ${mtcState.retryAttempts}/${maxRetries}`
            );
            
            abort(nudgeMessage, { retry: true });
        }
    };
}

function countToolCalls(steps: any[] | undefined): number {
    if (!steps) return 0;
    
    let count = 0;
    for (const step of steps) {
        // Count tool calls in step (format depends on Mastra's step structure)
        if (step.toolCalls && Array.isArray(step.toolCalls)) {
            count += step.toolCalls.length;
        }
    }
    return count;
}
```

### 4.4 Integration Point

**File:** `packages/agentc2/src/agents/resolver.ts`

Add to processor array (after line 1082):

```typescript
// Existing processors (lines 1025-1082):
const processors: Processor[] = [
    createInputGuardrailProcessor(record.id, organizationId),
    createContextWindowProcessor({ ... }),
    createStepAnchorProcessor({ ... }),
    createToolCallGuardProcessor({ ... }),
    createOutputGuardrailProcessor(record.id, organizationId)
];

// NEW: Add minimum tool call processor if configured
const minToolCallConfig = extractMinToolCallConfig(record.metadata);
if (minToolCallConfig.enabled) {
    processors.push(
        createMinimumToolCallProcessor(minToolCallConfig, record.maxSteps ?? 5)
    );
}
```

### 4.5 Configuration Schema

**Agent.metadata JSON field:**

```typescript
interface AgentMetadata {
    // ... existing fields ...
    
    minToolCallGuardrail?: {
        /** Enable minimum tool call enforcement. Default: false */
        enabled?: boolean;
        /** Absolute minimum tool calls. Overrides ratio if set. */
        minToolCalls?: number;
        /** Minimum as ratio of maxSteps. Default: 0.5 */
        minToolCallRatio?: number;
        /** Only enforce if maxSteps >= threshold. Default: 10 */
        maxStepsThreshold?: number;
        /** Max retries before accepting result. Default: 1 */
        maxRetries?: number;
    };
}
```

---

## Component 5: Enhanced Tool Call Tracking

### 5.1 Database Schema Changes

**File:** `packages/database/prisma/schema.prisma`

```prisma
model AgentToolCall {
    id          String   @id @default(cuid())
    runId       String?
    run         AgentRun? @relation(fields: [runId], references: [id], onDelete: Cascade)
    traceId     String?
    trace       AgentTrace? @relation(fields: [traceId], references: [id], onDelete: Cascade)
    turnId      String?
    turn        AgentRunTurn? @relation(fields: [turnId], references: [id], onDelete: Cascade)
    
    toolKey     String
    mcpServerId String?
    toolSource  String?
    inputJson   Json?
    outputJson  Json?
    success     Boolean   @default(true)
    error       String?   @db.Text
    durationMs  Int?
    
    // NEW: Retry tracking
    attempts         Int      @default(1)
    retriedErrorsJson Json?   // Array of {attempt: number, error: string, delayMs: number}
    
    createdAt   DateTime @default(now())
    
    @@index([runId])
    @@index([turnId])
    @@index([traceId, toolKey])
    @@index([toolKey, runId])
    @@index([toolKey, success]) // NEW: For failure analysis
    @@map("agent_tool_call")
}
```

### 5.2 Run Recorder Updates

**File:** `apps/agent/src/lib/run-recorder.ts`

Update `addToolCall()` to extract retry metadata:

```typescript
export interface ToolCallData {
    toolKey: string;
    input?: unknown;
    output?: unknown;
    success: boolean;
    error?: string;
    durationMs?: number;
    mcpServerId?: string;
    toolSource?: string;
    
    // NEW: Retry metadata
    attempts?: number;
    retriedErrors?: Array<{ attempt: number; error: string; delayMs: number }>;
}

async addToolCall(data: ToolCallData) {
    // Extract retry metadata from tool result if present
    const retryMetadata = extractRetryMetadata(data.output);
    
    await prisma.agentToolCall.create({
        data: {
            runId: this.runId,
            traceId: this.traceId,
            turnId: this.turnId,
            toolKey: data.toolKey,
            inputJson: data.input ? sanitizeForJson(data.input) : null,
            outputJson: data.output ? sanitizeForJson(data.output) : null,
            success: data.success,
            error: data.error ?? null,
            durationMs: data.durationMs ?? null,
            mcpServerId: data.mcpServerId ?? null,
            toolSource: data.toolSource ?? null,
            
            // NEW
            attempts: retryMetadata?.attempts ?? 1,
            retriedErrorsJson: retryMetadata?.retriedErrors ?? null
        }
    });
}

function extractRetryMetadata(output: unknown): { 
    attempts: number; 
    retriedErrors: any[] 
} | null {
    if (output && typeof output === "object" && "__retry_metadata" in output) {
        const meta = (output as any).__retry_metadata;
        return {
            attempts: meta.attempts ?? 1,
            retriedErrors: meta.retriedErrors ?? []
        };
    }
    return null;
}
```

---

## Component 6: MCP Tool Execution Retry

### 6.1 Current State

**File:** `packages/agentc2/src/mcp/client.ts`

The `executeMcpTool()` function (lines 4962-5075) executes tools with:
- Parameter validation
- 60-second timeout
- Single-shot execution (no retry)

### 6.2 Proposed Enhancement

Wrap MCP tool execution with the same retry logic:

```typescript
// In executeMcpTool() function (around line 5021):

// Current code:
const executePromise = (tool as any).execute({ context: parameters });
const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
);
const result = await Promise.race([executePromise, timeoutPromise]);

// NEW: Wrap with retry
const result = await withRetry(
    async () => {
        const executePromise = (tool as any).execute({ context: parameters });
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)),
                timeoutMs
            )
        );
        return await Promise.race([executePromise, timeoutPromise]);
    },
    {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        isRetryable: (error) => {
            // Use default retry check from lib/retry.ts
            return defaultIsRetryable(error);
        },
        onRetry: (error, attempt) => {
            console.log(
                `[MCP] Tool ${matchedName} retry attempt ${attempt}: ` +
                `${error instanceof Error ? error.message : error}`
            );
        }
    }
);
```

**Note:** This provides retry at the MCP tool level, independent of the agent-level retry wrapper. Both can coexist (inner retry for MCP tools, outer retry for all tools including native registry tools).

---

## Component 7: Evaluation Criteria Updates

### 7.1 Tier 1 Heuristic Updates

**File:** `packages/agentc2/src/scorers/tier1.ts`

Add new heuristic checks:

```typescript
// NEW: Tool call utilization check (lines 227+)
// 8. Tool call utilization (for high-step agents)
if (context.run.maxSteps && context.run.maxSteps >= 10) {
    const expectedMinToolCalls = Math.ceil(context.run.maxSteps * 0.3);
    const actualToolCalls = context.toolCalls?.length ?? 0;
    
    if (actualToolCalls === 0 && expectedMinToolCalls > 0) {
        scores.toolUtilization = 0.0;
        flags.push("zero_tool_calls_high_budget");
    } else if (actualToolCalls < expectedMinToolCalls) {
        scores.toolUtilization = actualToolCalls / expectedMinToolCalls;
        flags.push(`low_tool_utilization:${actualToolCalls}/${expectedMinToolCalls}`);
    } else {
        scores.toolUtilization = 1.0;
    }
} else {
    scores.toolUtilization = 1.0; // Not applicable for low-step agents
}

// NEW: Retry success tracking
if (context.toolCalls && context.toolCalls.length > 0) {
    const retriedCalls = context.toolCalls.filter(tc => tc.attempts > 1);
    if (retriedCalls.length > 0) {
        const retriedSuccesses = retriedCalls.filter(tc => tc.success === true);
        flags.push(`tool_retries_succeeded:${retriedSuccesses.length}/${retriedCalls.length}`);
        
        // Positive signal - retry worked
        scores.resilience = retriedSuccesses.length / retriedCalls.length;
    }
}
```

### 7.2 Tier 2 Auditor Updates

**File:** `packages/agentc2/src/scorers/auditor.ts`

Add to evaluation criteria:

```typescript
// Lines 49-62: Add new criterion
{
    id: "tool_utilization",
    name: "Tool Utilization",
    weight: 0.1,
    rubric: "Evaluate whether the agent appropriately used its available tools and step budget. " +
            "Score 1.0 if tool usage matched task complexity (multi-step task → multiple tool calls). " +
            "Score 0.5 if some tools were used but scope was incomplete. " +
            "Score 0.0 if agent avoided tools despite having budget and relevant tools available."
}
```

---

## Implementation Phases

### Phase 1: Core Retry Infrastructure (Week 1)
**Goal:** Enable automatic retry for transient failures

**Tasks:**
1. Create `tool-execution-wrapper.ts` with `wrapToolWithRetry()`
2. Integrate into `AgentResolver.hydrate()` after permission guards
3. Add retry metadata extraction in `run-recorder.ts`
4. Add database migration for `AgentToolCall.attempts` and `retriedErrorsJson`
5. Update tool call recording to capture retry attempts

**Deliverables:**
- Tool execution wrapper module
- Database schema changes
- Integration with AgentResolver
- Tests for retry logic with mocked transient failures

**Success Criteria:**
- Tool calls automatically retry on ETIMEDOUT, ECONNREFUSED, 429, 502, 503, 504
- Retry attempts are logged in AgentToolCall records
- No retries on permission/validation errors (fail fast)

### Phase 2: Instruction Improvements (Week 1-2)
**Goal:** Encourage proactive tool usage through system instructions

**Tasks:**
1. Rewrite unavailable tools notice to be less discouraging
2. Add tool usage guidelines to all agent instructions
3. Add configuration options in Agent.metadata.toolUsagePolicy
4. Update resolver to extract and apply configuration
5. Test with sdlc-signal-harvester agent (the zero-tool-call case)

**Deliverables:**
- Updated instruction injection in resolver.ts
- Configuration schema in Agent.metadata
- Documentation for tool usage policy configuration

**Success Criteria:**
- Agents with available tools attempt tool calls before responding with "unavailable"
- Instructions explicitly mention automatic retry behavior
- Zero-tool-call runs reduced by 50%+

### Phase 3: Progress Nudging (Week 2)
**Goal:** Prevent premature termination of multi-step workflows

**Tasks:**
1. Enhance StepAnchorProcessor with tool call density tracking
2. Add underutilization nudges when tool density is low
3. Add configuration in StepAnchorConfig
4. Test with cmmmvd41b008l8exvctdhd9vd scenario (stopped at 4 tool calls with 26 steps remaining)

**Deliverables:**
- Enhanced step-anchor.ts with density tracking
- Nudge injection when underutilized
- Configuration options for nudge thresholds

**Success Criteria:**
- Agents use >50% of available maxSteps when task requires multi-step analysis
- Nudges trigger when tool call density < 0.3 and steps remaining > 30%
- No nudge spam (max 1 nudge per 5 steps)

### Phase 4: Minimum Tool Call Guardrail (Week 2-3)
**Goal:** Enforce minimum tool usage for high-step agents

**Tasks:**
1. Create minimum-tool-call-processor.ts
2. Integrate into AgentResolver processor array
3. Add configuration in Agent.metadata.minToolCallGuardrail
4. Add UI toggle in agent settings page
5. Enable by default for agents with maxSteps >= 20

**Deliverables:**
- Minimum tool call processor
- Configuration UI in agent settings
- Default configuration for SDLC playbook agents

**Success Criteria:**
- Agents with maxSteps >= 20 must make at least 0.5 * maxSteps tool calls
- Retry once with nudge message if threshold not met
- Configurable per agent via metadata

### Phase 5: Enhanced Telemetry & Evaluation (Week 3)
**Goal:** Surface retry behavior in analytics and evaluations

**Tasks:**
1. Add tool retry metrics to Tier 1 heuristics
2. Add tool utilization criterion to Tier 2 auditor
3. Update UI to show retry attempts in run detail panel
4. Add retry success rate to agent analytics dashboard
5. Create "Tool Resilience" report showing retry patterns per tool

**Deliverables:**
- Updated tier1.ts and auditor.ts with retry/utilization metrics
- UI components showing retry metadata
- Analytics dashboard with resilience metrics

**Success Criteria:**
- Run detail panel shows "Attempts: 3 (2 retries)" for retried tools
- Agent analytics shows retry success rate per tool
- Evaluation scores reflect tool utilization quality

### Phase 6: MCP Tool Retry (Week 3-4)
**Goal:** Add retry logic to MCP tool execution layer

**Tasks:**
1. Wrap `executeMcpTool()` with withRetry()
2. Add MCP-specific retry telemetry
3. Test with Jira, HubSpot, Firecrawl tools under network instability
4. Verify retry counts don't double-count (inner + outer retry)

**Deliverables:**
- Enhanced executeMcpTool() with retry
- MCP-specific logging and telemetry
- Integration tests with failure simulation

**Success Criteria:**
- MCP tools retry on transient failures
- Retry attempts are distinct from agent-level retries
- Total retry count = MCP retries + agent retries (additive)

---

## Configuration Reference

### Default Configuration (Applied to All Agents)

```typescript
const DEFAULT_TOOL_EXECUTION_CONFIG = {
    retryEnabled: true,
    maxRetries: 2,           // 3 total attempts
    initialRetryDelayMs: 500,
    maxRetryDelayMs: 10000
};

const DEFAULT_PROGRESS_NUDGING_CONFIG = {
    enabled: true,
    minToolCallDensity: 0.3,
    nudgeInterval: 5         // Min steps between nudges
};

const DEFAULT_MIN_TOOL_CALL_CONFIG = {
    enabled: false,          // Opt-in
    minToolCallRatio: 0.5,
    maxStepsThreshold: 10,
    maxRetries: 1
};
```

### Per-Agent Override (via Agent.metadata)

```json
{
    "toolExecution": {
        "retryEnabled": true,
        "maxRetries": 3,
        "initialRetryDelayMs": 1000,
        "perToolRetry": {
            "hubspot_hubspot-get-contacts": {
                "enabled": true,
                "maxRetries": 5
            }
        }
    },
    "minToolCallGuardrail": {
        "enabled": true,
        "minToolCalls": 10,
        "maxStepsThreshold": 15,
        "maxRetries": 1
    },
    "toolUsagePolicy": {
        "encourageToolUsage": true,
        "customGuidance": "This agent specializes in data gathering. Always use multiple tools to cross-reference information."
    }
}
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/tool-execution-wrapper.test.ts` (new)

```typescript
describe("Tool Execution Retry Wrapper", () => {
    test("retries on ETIMEDOUT error", async () => {
        const mockTool = {
            execute: vi.fn()
                .mockRejectedValueOnce(new Error("ETIMEDOUT"))
                .mockRejectedValueOnce(new Error("ETIMEDOUT"))
                .mockResolvedValueOnce({ data: "success" })
        };
        
        const wrapped = wrapToolWithRetry(mockTool, "test-tool", { maxRetries: 3 }, {});
        const result = await wrapped.execute({});
        
        expect(mockTool.execute).toHaveBeenCalledTimes(3);
        expect(result).toMatchObject({ data: "success", __retry_metadata: { attempts: 3 } });
    });
    
    test("does not retry on permission denied", async () => {
        const mockTool = {
            execute: vi.fn().mockRejectedValue(new Error("Permission denied"))
        };
        
        const wrapped = wrapToolWithRetry(mockTool, "test-tool", { maxRetries: 3 }, {});
        
        await expect(wrapped.execute({})).rejects.toThrow("Permission denied");
        expect(mockTool.execute).toHaveBeenCalledTimes(1); // No retry
    });
    
    test("respects per-tool retry configuration", async () => {
        // Test per-tool override of retry count
    });
});
```

**File:** `tests/unit/minimum-tool-call-processor.test.ts` (new)

```typescript
describe("Minimum Tool Call Processor", () => {
    test("aborts when tool call count below threshold", async () => {
        const processor = createMinimumToolCallProcessor(
            { enabled: true, minToolCalls: 5 },
            20 // maxSteps
        );
        
        const abort = vi.fn();
        const steps = [
            { toolCalls: [{ toolName: "tool1" }] },
            { toolCalls: [] }
        ]; // Only 1 tool call, need 5
        
        await processor.processOutputResult({
            messages: [],
            steps,
            abort,
            state: {}
        });
        
        expect(abort).toHaveBeenCalledWith(
            expect.stringContaining("only 1 tool calls"),
            { retry: true }
        );
    });
    
    test("allows completion when threshold met", async () => {
        // Test passing threshold
    });
    
    test("stops retrying after maxRetries", async () => {
        // Test retry limit
    });
});
```

### Integration Tests

**File:** `tests/integration/tool-retry-resilience.test.ts` (new)

```typescript
describe("Tool Retry Integration", () => {
    test("agent recovers from transient MCP server failure", async () => {
        // 1. Mock Jira MCP server to fail twice, succeed third time
        // 2. Create agent with Jira tools
        // 3. Execute agent.generate() with query requiring Jira
        // 4. Verify:
        //    - Agent made tool call
        //    - Tool retried automatically
        //    - Final result is success
        //    - AgentToolCall.attempts = 3
        //    - AgentToolCall.retriedErrorsJson contains 2 errors
    });
    
    test("agent does not retry on authentication error", async () => {
        // 1. Mock tool to return 401 Unauthorized
        // 2. Execute agent
        // 3. Verify only 1 attempt (no retry)
        // 4. Verify error message explains auth issue
    });
    
    test("high-step agent is nudged to continue when underutilized", async () => {
        // 1. Create agent with maxSteps=30
        // 2. Mock agent to return after 2 tool calls at step 5
        // 3. Verify StepAnchorProcessor injected nudge
        // 4. Verify agent continued execution
    });
});
```

### End-to-End Tests

**Scenario 1: Jira Integration Flakiness**

Simulate the evidence case:
1. Deploy sdlc-signal-harvester agent (maxSteps=30)
2. Configure Jira MCP server with 50% failure rate (transient timeouts)
3. Execute agent with request: "List all open issues in PROJECT-X"
4. **Expected Result:**
   - Agent attempts Jira tool call
   - First attempt fails with ETIMEDOUT
   - System automatically retries
   - Second attempt succeeds
   - Agent processes results and returns summary
   - Run records show attempts=2, retriedErrors=["ETIMEDOUT"]

**Scenario 2: Multi-Step Pipeline Completion**

1. Deploy sdlc-signal-harvester agent (maxSteps=30)
2. Execute agent with request: "Analyze last week's completed tickets and identify themes"
3. **Expected Result:**
   - Agent makes 10+ tool calls (search, read details, analyze)
   - Uses at least 15/30 steps
   - StepAnchorProcessor injects progress nudges if needed
   - Completes with comprehensive analysis, not early termination

**Scenario 3: Zero Tool Calls Despite Availability**

1. Deploy agent with Jira tools (all available)
2. Configure minimum tool call guardrail (minToolCalls=5)
3. Execute agent with request requiring Jira data
4. If agent tries to respond without tools:
   - MinimumToolCallProcessor aborts with retry=true
   - Agent sees nudge message encouraging tool usage
   - Agent retries with tool calls
   - Completes successfully

---

## Impact Assessment

### Benefits

1. **Reduced false negatives** - Agents won't give up on transiently unavailable tools
2. **Improved evaluation scores** - Fewer TOOL_SELECTION_ERROR failures
3. **Better user experience** - Fewer "tool unavailable" messages for temporary issues
4. **Increased throughput** - Multi-step agents complete their workflows instead of stopping early
5. **Enhanced observability** - Retry attempts tracked in database for analysis

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Increased latency** - Retries add delay | Medium | Use exponential backoff with jitter; max 2 retries per tool; fail fast on permanent errors |
| **Token budget exhaustion** - More steps = more tokens | Medium | Existing ToolCallGuardProcessor enforces maxTotalToolCalls; retry doesn't increase step count |
| **Retry loops** - Tool might fail repeatedly | High | Existing duplicate detection in ToolCallGuardProcessor aborts after 3 identical calls; retry only on different errors |
| **Breaking changes** - Existing agents behave differently | Low | Make retry opt-out via metadata; default enabled but configurable |
| **Cost increase** - More API calls from retries | Medium | Budget enforcement happens before execution; retry doesn't bypass BudgetPolicy checks |

### Affected Components

**Direct Impact:**
- `packages/agentc2/src/agents/resolver.ts` - Add retry wrapper integration
- `packages/agentc2/src/tools/tool-execution-wrapper.ts` - New module
- `packages/agentc2/src/processors/step-anchor.ts` - Add progress nudging
- `packages/agentc2/src/processors/minimum-tool-call-processor.ts` - New processor
- `packages/agentc2/src/mcp/client.ts` - Add retry to executeMcpTool()
- `apps/agent/src/lib/run-recorder.ts` - Update addToolCall()
- `packages/database/prisma/schema.prisma` - Add retry fields

**Indirect Impact:**
- All agents using MCP tools - Will benefit from retry logic
- Evaluation pipeline - Will see improved scores for retry-recovered runs
- UI components - Need to display retry metadata

**No Impact:**
- Workflows - Tool retry is transparent to workflow execution
- Voice agents - Retry works the same for voice-triggered runs
- Existing tool implementations - No changes needed

---

## Backward Compatibility

### For Existing Agents

**Option 1: Opt-Out (Recommended)**

Enable retry by default, allow disabling via metadata:

```json
{
    "toolExecution": {
        "retryEnabled": false
    }
}
```

**Option 2: Opt-In (Conservative)**

Disable retry by default, require explicit enablement:

```json
{
    "toolExecution": {
        "retryEnabled": true
    }
}
```

**Recommendation:** **Opt-out** is preferred because:
- Retry improves reliability with minimal downside
- Existing agents with flaky tools will see immediate improvement
- Opt-out available if retry causes issues for specific agents
- Industry standard for production systems (AWS SDK, Stripe, etc.)

### For MCP Servers

No changes required. MCP servers are unaware of retry logic happening at the client layer.

### For Tool Implementations

No changes required. Tools return success/error as before. Retry wrapper intercepts and retries transparently.

---

## Performance Considerations

### Latency Analysis

**Baseline (No Retry):**
- Tool call: 200ms average
- Total: 200ms

**With Retry (Worst Case - 3 Attempts):**
- Attempt 1: 200ms + fail
- Delay: 500ms (jittered)
- Attempt 2: 200ms + fail
- Delay: 1000ms (jittered)
- Attempt 3: 200ms + success
- **Total: 2100ms**

**Mitigation:**
- Retry only on transient errors (~5% of tool calls)
- 95% of tool calls complete in first attempt
- Expected average latency increase: <5%

### Token Budget Impact

**Scenario:** Agent with maxSteps=30

**Without Retry:**
- Stops at step 2 with "tools unavailable"
- Tokens used: ~500 (input) + 50 (output) = 550 total

**With Retry:**
- Retries tool, succeeds, continues to step 15
- Tokens used: ~500 (input) + 3000 (output with data) = 3500 total

**Analysis:** Token usage increases, but this is **correct behavior**. The agent is now completing the task instead of failing prematurely. Budget enforcement (BudgetPolicy) prevents runaway costs.

### Database Write Volume

**New Writes per Run:**
- AgentToolCall.attempts (1 integer column)
- AgentToolCall.retriedErrorsJson (1 JSONB column, typically <500 bytes)

**Impact:** Negligible (<1KB per run)

---

## Monitoring & Observability

### New Metrics

1. **Tool Retry Rate** - Percentage of tool calls that required retry
   - Formula: `(tool calls with attempts > 1) / (total tool calls)`
   - Threshold: Alert if >20% (indicates systemic issues)

2. **Tool Retry Success Rate** - Percentage of retried tools that eventually succeeded
   - Formula: `(retried tools that succeeded) / (retried tools total)`
   - Threshold: Alert if <50% (retry not helping)

3. **Tool Call Utilization** - Ratio of tool calls to maxSteps
   - Formula: `(tool calls) / (maxSteps)`
   - Threshold: Flag if <0.3 for agents with maxSteps >=10

4. **Early Termination Rate** - Percentage of runs completing in <50% of maxSteps
   - Formula: `(steps used) / (maxSteps available)`
   - Threshold: Flag if agent consistently uses <30% of budget

### Dashboard Updates

**Agent Analytics Page** (`apps/agent/src/app/agents/[agentSlug]/analytics/page.tsx`):

Add new cards:
- **Tool Resilience** - Shows retry rate, success rate, top retried tools
- **Step Utilization** - Shows average steps used vs. maxSteps, tool call density
- **Early Terminations** - Lists runs that completed with <50% steps used

**Run Detail Panel** (`apps/agent/src/components/RunDetailPanel.tsx`):

Enhance tool call display:
```tsx
{toolCall.attempts > 1 && (
    <Badge variant="warning">
        Retried {toolCall.attempts - 1}x
    </Badge>
)}

{toolCall.retriedErrorsJson && (
    <Collapsible>
        <CollapsibleTrigger>View retry attempts</CollapsibleTrigger>
        <CollapsibleContent>
            {toolCall.retriedErrorsJson.map((err, idx) => (
                <div key={idx}>
                    Attempt {err.attempt}: {err.error}
                </div>
            ))}
        </CollapsibleContent>
    </Collapsible>
)}
```

### Logging Enhancements

Add structured logging for retry operations:

```typescript
// packages/agentc2/src/lib/logger.ts
export const logger = {
    // ... existing methods ...
    
    toolRetry: (
        toolName: string, 
        agentId: string, 
        attempt: number, 
        error: string
    ) => 
        logger.info(
            { event: "tool.retry", toolName, agentId, attempt, error },
            `Tool retry attempt ${attempt} for ${toolName}`
        ),
    
    toolRetryExhausted: (
        toolName: string, 
        agentId: string, 
        totalAttempts: number, 
        finalError: string
    ) =>
        logger.warn(
            { event: "tool.retry.exhausted", toolName, agentId, totalAttempts, finalError },
            `Tool retry exhausted for ${toolName} after ${totalAttempts} attempts`
        )
};
```

---

## Security Considerations

### 1. Retry Amplification Attacks

**Risk:** Adversary crafts inputs that cause tools to fail and retry repeatedly, amplifying cost/latency.

**Mitigation:**
- Max retry count enforced per tool call (2 retries = 3 total attempts)
- Global tool call budget unchanged (maxTotalToolCalls = maxSteps * 2)
- Retry delays prevent rapid-fire retries
- Permission checks run on FIRST attempt only (not re-evaluated on retry)

### 2. Time-of-Check-Time-of-Use (TOCTOU)

**Risk:** Permissions change between first attempt and retry.

**Mitigation:**
- Permission checks cached for the duration of the tool execution
- Retry wrapper applied **after** permission guard wrapper
- Permission denied errors are **not retried** (fail fast)

### 3. Data Consistency

**Risk:** Retry of mutation tools could cause duplicate operations (e.g., sending email twice).

**Mitigation:**
- Tool implementations must be idempotent or include deduplication keys
- Existing ToolCallGuardProcessor detects duplicate calls (same tool + args)
- Retry only happens on **transient failures**, not after successful execution
- Mutation tools (identified in `toolBehaviorMap`) can have retry disabled per-tool:

```json
{
    "toolExecution": {
        "perToolRetry": {
            "gmail-send-email": {
                "enabled": false
            }
        }
    }
}
```

**Recommendation:** Document which tools are idempotent in tool registry metadata.

---

## Alternative Approaches Considered

### Alternative 1: LLM-Guided Retry (Current Approach)

**Description:** Inject error messages into context and let the LLM decide whether to retry.

**Pros:**
- No runtime complexity
- LLM can reason about whether to retry with different arguments

**Cons:**
- Wastes tokens on retry decisions
- LLM has negative bias (assumes failures are permanent)
- No guarantee of retry (LLM might give up)
- Slower (full LLM call per retry)

**Decision:** Replace with automatic runtime retry for transient errors. Keep LLM-guided adaptation for logic errors (wrong arguments).

### Alternative 2: Circuit Breaker Pattern

**Description:** Track failure rates per tool and temporarily disable tools with high failure rates.

**Pros:**
- Prevents wasting retries on persistently failing tools
- Industry best practice for distributed systems

**Cons:**
- Adds significant complexity
- Requires global state management (Redis or database)
- Overkill for current scale (agents are short-lived, <5 min)

**Decision:** Defer to future work. Current retry logic is sufficient for transient failures. If systematic tool failures occur, they'll be detected by evaluation pipeline and trigger alerts.

### Alternative 3: Retry at MCP Client Layer Only

**Description:** Add retry only to `executeMcpTool()`, not to registry tools.

**Pros:**
- Smaller change surface
- MCP tools are more prone to network failures

**Cons:**
- Inconsistent behavior between MCP and registry tools
- Registry tools (web-search, web-fetch) also benefit from retry

**Decision:** Apply retry at **agent tool wrapper layer** so all tools benefit consistently.

---

## Migration Guide

### For Existing Agents

**Automatic Migration:**

No changes required. All agents will automatically get retry behavior on the next run. Default configuration:
- Retry enabled
- Max 2 retries (3 total attempts)
- Transient errors only

**Opt-Out Instructions:**

If an agent should NOT retry (rare), update its metadata:

```typescript
await prisma.agent.update({
    where: { id: agentId },
    data: {
        metadata: {
            ...existingMetadata,
            toolExecution: {
                retryEnabled: false
            }
        }
    }
});
```

### For High-Step SDLC Agents

**Recommended Configuration:**

```typescript
// Enable minimum tool call guardrail for SDLC agents
await prisma.agent.updateMany({
    where: {
        slug: { in: ["sdlc-signal-harvester", "sdlc-ticket-classifier", "sdlc-test-generator"] },
        maxSteps: { gte: 15 }
    },
    data: {
        metadata: {
            minToolCallGuardrail: {
                enabled: true,
                minToolCallRatio: 0.5,
                maxStepsThreshold: 10,
                maxRetries: 1
            }
        }
    }
});
```

### For MCP-Heavy Agents

Agents using 5+ MCP tools may benefit from higher retry counts:

```json
{
    "toolExecution": {
        "maxRetries": 3,
        "perToolRetry": {
            "jira_jira-search-issues": { "maxRetries": 5 },
            "hubspot_hubspot-get-contacts": { "maxRetries": 5 }
        }
    }
}
```

---

## Documentation Updates

### User-Facing Documentation

**File:** `docs/features/tool-retry.md` (new)

Content:
- Overview of automatic retry behavior
- Which errors are retried (transient) vs. not retried (permanent)
- How to view retry attempts in the UI
- How to configure retry behavior per agent
- How to disable retry for specific tools (e.g., mutation tools)

**File:** `docs/features/agent-configuration.md` (update)

Add section on:
- Tool execution configuration
- Minimum tool call guardrails
- Tool usage policy

### Developer Documentation

**File:** `packages/agentc2/README.md` (update)

Add section:
- Tool retry architecture
- How to make tools retry-safe (idempotency guidelines)
- How to test tool retry behavior
- How to add custom retry logic for specific tools

---

## Open Questions

### Q1: Should retry count against maxSteps budget?

**Current Behavior:** maxSteps counts LLM reasoning steps, not individual tool executions.

**Options:**
- A: Retries don't count (retry is transparent to step counter)
- B: Retries count as sub-steps (step 5.1, 5.2, 5.3)

**Recommendation:** **Option A** - Retries are runtime-layer resilience, not agent reasoning steps. Keep step counter simple.

### Q2: Should minimum tool call guardrail be enabled by default?

**Options:**
- A: Disabled by default (opt-in) - Conservative, no surprises
- B: Enabled for agents with maxSteps >= 20 - Catches underutilization early
- C: Enabled for all agents with minToolCalls based on maxSteps - Aggressive

**Recommendation:** **Option A** initially, then **Option B** after validation. Start conservative, enable based on evidence.

### Q3: How to handle retry of mutation tools?

**Context:** Sending an email twice or creating a ticket twice is undesirable.

**Options:**
- A: Disable retry for all mutation tools by default
- B: Require tools to declare if they're idempotent
- C: Leave enabled, rely on tool implementations being idempotent

**Recommendation:** **Option C** with documentation. Most mutation tools in the registry ARE idempotent:
- Email tools: Mastra's email tool generates unique message IDs
- Calendar events: Updates use event IDs (idempotent)
- CRM operations: Update by record ID (idempotent)
- Issue creation: Already has deduplication in Jira/GitHub

For non-idempotent tools, document in toolBehaviorMap and allow per-tool retry disable.

### Q4: Should retry behavior differ by model provider?

**Context:** Anthropic models might handle tool failures differently than OpenAI models.

**Options:**
- A: Model-agnostic retry (same behavior for all providers)
- B: Model-specific retry configuration

**Recommendation:** **Option A** - Keep it simple. Retry is a runtime concern, not a model reasoning concern.

---

## Success Metrics

### Quantitative Metrics (3 Months Post-Launch)

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Zero-tool-call runs (maxSteps >= 10) | 8.2% | <2% | Query AgentRun where toolCalls.length = 0 |
| Tool retry rate | 0% (no retry) | 5-10% | Query AgentToolCall where attempts > 1 |
| Tool retry success rate | N/A | >80% | Query retried tools where success = true |
| TOOL_SELECTION_ERROR rate | 3.1% | <1% | Query AgentEvaluation.failureModes |
| Average evaluation score (all agents) | 0.74 | >0.80 | Query AVG(AgentEvaluation.overallGrade) |
| Multi-step completion rate | 45% | >70% | Query runs using >=50% of maxSteps |

### Qualitative Validation

1. **Run cmmmvj3kw00a58exvmha1e3jv again** - Should make Jira tool calls even if MCP is flaky
2. **Run cmmmvd41b008l8exvctdhd9vd again** - Should use more than 4 tool calls
3. **User feedback** - Fewer reports of "agent said tool unavailable but it works when I try manually"
4. **Evaluation themes** - Reduced frequency of "gave up too early" recommendations

---

## Rollout Plan

### Stage 1: Canary (1 Week)

**Scope:** Enable retry for 3 test agents in internal workspace

**Agents:**
- `test-retry-agent` (created for testing)
- `sdlc-signal-harvester` (high-priority SDLC agent)
- `mcp-agent` (general MCP tool testing agent)

**Monitoring:**
- Watch retry rate metrics
- Check for retry loops (agent getting stuck)
- Monitor latency increase
- Review evaluation scores

**Success Criteria:**
- No retry loops detected
- Retry success rate >70%
- Evaluation scores improve or stay flat
- Latency increase <10%

### Stage 2: SDLC Playbook (2 Weeks)

**Scope:** Enable retry for all SDLC playbook agents

**Agents:**
- All agents with slug starting with `sdlc-`
- All agents in SDLC-related playbooks

**Configuration:**
```typescript
// Migration script
const sdlcAgents = await prisma.agent.findMany({
    where: {
        OR: [
            { slug: { startsWith: "sdlc-" } },
            { playbookSourceId: { in: SDLC_PLAYBOOK_IDS } }
        ]
    }
});

for (const agent of sdlcAgents) {
    await prisma.agent.update({
        where: { id: agent.id },
        data: {
            metadata: {
                ...agent.metadata,
                toolExecution: {
                    retryEnabled: true,
                    maxRetries: 3
                },
                minToolCallGuardrail: {
                    enabled: agent.maxSteps >= 15,
                    minToolCallRatio: 0.4,
                    maxStepsThreshold: 10
                }
            }
        }
    });
}
```

**Monitoring:** Same as Stage 1 + SDLC-specific metrics

### Stage 3: All Agents (4 Weeks)

**Scope:** Enable retry by default for all agents (opt-out available)

**Implementation:** Update AgentResolver to enable retry unless explicitly disabled:

```typescript
// In resolver.ts hydrate():
const retryConfig = extractRetryConfig(record.metadata) ?? {
    enabled: true,  // Default enabled
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 10000
};
```

**Communication:**
- Blog post explaining feature
- Email to all workspace admins
- In-app notification with documentation link
- Update agent settings UI to show retry configuration

---

## Future Enhancements (Out of Scope)

### 1. Circuit Breaker Pattern

Implement per-tool circuit breakers that temporarily disable tools with high failure rates:

```typescript
interface CircuitBreakerState {
    failureCount: number;
    successCount: number;
    state: "closed" | "open" | "half-open";
    openedAt?: Date;
}

// After 5 consecutive failures, open circuit for 60 seconds
// After 60 seconds, allow 1 request (half-open)
// If success, close circuit; if failure, open again
```

**Complexity:** High (requires global state, Redis integration)  
**Value:** Medium (prevents retry storms on persistently failing tools)  
**Recommendation:** Implement if retry rate exceeds 20% for any tool

### 2. Adaptive Retry Budget

Dynamically adjust retry count based on historical success rates:

```typescript
// Tools with 90% retry success rate: maxRetries = 5
// Tools with 50% retry success rate: maxRetries = 2
// Tools with <30% retry success rate: maxRetries = 0 (disable)
```

**Complexity:** Medium  
**Value:** High (optimizes retry budget allocation)  
**Recommendation:** Implement after 3 months of retry data collection

### 3. Tool Fallback Chains

Define fallback tools when primary tool fails:

```typescript
interface ToolFallbackChain {
    primary: string;
    fallbacks: string[];
}

// Example: web-search (Exa) → brave-search → perplexity-search
```

**Complexity:** Medium  
**Value:** High (improves reliability for critical operations)  
**Recommendation:** Design as separate feature (post-retry implementation)

### 4. Retry Budget Sharing

Share retry budget across tools in the same call (e.g., workflow step):

```typescript
// 10 tools each with maxRetries=3 = 30 total retries
// vs.
// 10 tools sharing pool of 10 retries total
```

**Complexity:** High  
**Value:** Low (current per-tool limit is sufficient)  
**Recommendation:** Not needed for MVP

---

## Implementation Checklist

### Phase 1: Core Retry Infrastructure
- [ ] Create `packages/agentc2/src/tools/tool-execution-wrapper.ts`
- [ ] Implement `wrapToolWithRetry()` function
- [ ] Implement `defaultToolRetryCheck()` function
- [ ] Add retry wrapper integration in `AgentResolver.hydrate()`
- [ ] Add database migration for `AgentToolCall.attempts` and `retriedErrorsJson`
- [ ] Update `run-recorder.ts` to extract and save retry metadata
- [ ] Write unit tests for retry wrapper
- [ ] Test with simulated transient failures

### Phase 2: Instruction Improvements
- [ ] Rewrite unavailable tools notice in resolver.ts (lines 862-871)
- [ ] Add tool usage guidelines injection (after line 860)
- [ ] Add `Agent.metadata.toolUsagePolicy` schema
- [ ] Add configuration extraction helper `extractToolUsagePolicy()`
- [ ] Test with sdlc-signal-harvester (zero tool call case)
- [ ] Measure reduction in zero-tool-call runs

### Phase 3: Progress Nudging
- [ ] Add `enableProgressNudging` to StepAnchorConfig
- [ ] Add tool call density tracking to AnchorState
- [ ] Implement underutilization detection in `processInputStep()`
- [ ] Add nudge message injection
- [ ] Test with early-termination scenario
- [ ] Validate nudge doesn't trigger spam

### Phase 4: Minimum Tool Call Guardrail
- [ ] Create `packages/agentc2/src/processors/minimum-tool-call-processor.ts`
- [ ] Implement `createMinimumToolCallProcessor()` function
- [ ] Add to resolver's processor array with opt-in flag
- [ ] Add `Agent.metadata.minToolCallGuardrail` schema
- [ ] Add UI toggle in agent settings page
- [ ] Write unit tests for processor
- [ ] Test with high-step agents

### Phase 5: Enhanced Telemetry
- [ ] Update Tier 1 heuristics with tool utilization check
- [ ] Update Tier 2 auditor with tool utilization criterion
- [ ] Add retry metadata display in RunDetailPanel
- [ ] Add Tool Resilience card to agent analytics page
- [ ] Add retry rate metrics to dashboard
- [ ] Create Tool Resilience report

### Phase 6: MCP Tool Retry
- [ ] Wrap `executeMcpTool()` with withRetry()
- [ ] Add MCP-specific retry logging
- [ ] Test with Jira, HubSpot, Firecrawl under failure conditions
- [ ] Verify retry counts don't double-count
- [ ] Document MCP tool retry behavior

### Phase 7: Documentation
- [ ] Write `docs/features/tool-retry.md`
- [ ] Update `docs/features/agent-configuration.md`
- [ ] Update `packages/agentc2/README.md`
- [ ] Add inline code comments for retry logic
- [ ] Create migration guide for existing agents
- [ ] Write blog post announcing feature

---

## Appendix A: Code Locations Reference

| Component | File | Lines | Action |
|-----------|------|-------|--------|
| Tool Registry | `packages/agentc2/src/tools/registry.ts` | Full file | No changes |
| Agent Resolver | `packages/agentc2/src/agents/resolver.ts` | 458-1133 | Add retry wrapper after line 992 |
| Tool Execution Guard | `packages/agentc2/src/security/tool-execution-guard.ts` | 26-97 | No changes (retry wraps around this) |
| MCP Client | `packages/agentc2/src/mcp/client.ts` | 5018-5074 | Wrap executeMcpTool() with retry |
| Tool Call Guard Processor | `packages/agentc2/src/processors/tool-call-guard-processor.ts` | Full file | No changes needed |
| Step Anchor Processor | `packages/agentc2/src/processors/step-anchor.ts` | 42-126 | Enhance with progress nudging |
| Run Recorder | `apps/agent/src/lib/run-recorder.ts` | 200-400 | Update addToolCall() |
| Tier 1 Scorer | `packages/agentc2/src/scorers/tier1.ts` | 92-226 | Add tool utilization checks |
| Tier 2 Auditor | `packages/agentc2/src/scorers/auditor.ts` | 49-62 | Add tool utilization criterion |
| Retry Utility | `packages/agentc2/src/lib/retry.ts` | Full file | Use as-is |
| Agent Schema | `packages/database/prisma/schema.prisma` | 815-952 | No changes to Agent model |
| AgentToolCall Schema | `packages/database/prisma/schema.prisma` | 1697-1720 | Add attempts, retriedErrorsJson |

---

## Appendix B: Related Issues & Dependencies

### Related GitHub Issues

- #151 - Agent should retry tool calls (this issue)
- #TBD - Circuit breaker for persistently failing tools (future)
- #TBD - Tool fallback chains (future)

### Dependencies

**No new external dependencies required.** All implementation uses existing packages:
- `@mastra/core` - Processor framework
- `packages/agentc2/src/lib/retry.ts` - Existing retry utility
- `@repo/database` - Existing Prisma client

### Breaking Changes

**None.** This is a backward-compatible enhancement. Existing agents continue to work as before, with improved resilience.

---

## Appendix C: Example Scenarios

### Scenario 1: Jira Tool Transient Failure

**Before (Current Behavior):**
```
User: "List all open tickets in PROJECT-X"
Agent thinks: "User wants Jira data. I have jira_jira-search-issues tool."
Agent calls: jira_jira-search-issues({project: "PROJECT-X"})
Tool returns: { error: "ETIMEDOUT" }
Agent responds: "I apologize, but the Jira integration is currently unavailable. Please try again later."
```

**After (With Retry):**
```
User: "List all open tickets in PROJECT-X"
Agent thinks: "User wants Jira data. I have jira_jira-search-issues tool."
Agent calls: jira_jira-search-issues({project: "PROJECT-X"})

[Runtime Layer]
Attempt 1: ETIMEDOUT (transient error detected)
Wait 500ms (jittered)
Attempt 2: ETIMEDOUT (still transient)
Wait 1000ms (jittered)
Attempt 3: Success → { issues: [...] }

Agent sees: { issues: [...], __retry_metadata: { attempts: 3 } }
Agent responds: "I found 12 open tickets in PROJECT-X: [detailed list]"
```

### Scenario 2: Permission Denied (No Retry)

**Before:**
```
Agent calls: hubspot_hubspot-delete-contact({contactId: "123"})
Tool returns: { error: "[TOOL BLOCKED] Permission denied: agent requires 'write' permission" }
Agent responds: "I don't have permission to delete contacts."
```

**After (Same Behavior - Correct):**
```
Agent calls: hubspot_hubspot-delete-contact({contactId: "123"})
Tool returns: { error: "[TOOL BLOCKED] Permission denied: agent requires 'write' permission" }
[Runtime Layer] → Permanent error, no retry attempted
Agent sees: { error: "[TOOL BLOCKED]..." }
Agent responds: "I don't have permission to delete contacts. You can grant this permission in Settings > Agents > Permissions."
```

### Scenario 3: Multi-Step Workflow with Progress Nudge

**Before:**
```
User: "Analyze last week's tickets and identify trends" (maxSteps=30)
Agent: Calls jira_search (4 results)
Agent: Responds with brief summary after 5 steps
[26 steps unused, incomplete analysis]
```

**After:**
```
User: "Analyze last week's tickets and identify trends" (maxSteps=30)
Agent: Calls jira_search (4 results)
[Step 10 - StepAnchorProcessor detects low density]
System: "[System Notice] You have 20 steps remaining but have only used 1 tool call. Continue using tools for comprehensive analysis."
Agent: Calls jira_get_issue_details (issue 1)
Agent: Calls jira_get_issue_details (issue 2)
Agent: Calls jira_get_issue_details (issue 3)
Agent: Calls jira_get_issue_details (issue 4)
[Step 15 - Good progress]
Agent: Analyzes patterns
Agent: Responds with comprehensive trend analysis
[Used 15/30 steps, 5 tool calls, complete answer]
```

### Scenario 4: Minimum Tool Call Guardrail Triggers

**Before:**
```
User: "What are the latest updates in PROJECT-X?" (maxSteps=25)
Agent: "I'll check the project for you."
Agent: Responds with generic statement [0 tool calls, completed in 2 steps]
Evaluation: 0.3 score, TOOL_SELECTION_ERROR
```

**After:**
```
User: "What are the latest updates in PROJECT-X?" (maxSteps=25)
Agent: "I'll check the project for you."
Agent: Responds with generic statement [0 tool calls, completed in 2 steps]

[MinimumToolCallProcessor]
Detects: 0 tool calls, minimum required: 12 (0.5 * 25)
Aborts: "[System] You completed with only 0 tool calls. This task requires investigation. Please use tools. Expected minimum: 12 tool calls."

Agent (Retry): Calls jira_search_issues
Agent (Retry): Calls jira_get_issue_details (multiple)
Agent (Retry): Responds with detailed list of updates
[Completed with 8 tool calls, passes threshold on second attempt]
```

---

## Appendix D: Retry Decision Matrix

| Error Type | Example | Retry? | Reason |
|------------|---------|--------|--------|
| Network timeout | ETIMEDOUT | ✅ Yes | Transient network issue |
| Connection refused | ECONNREFUSED | ✅ Yes | Server temporarily down |
| Rate limit | 429 Too Many Requests | ✅ Yes | Will clear after delay |
| Server error | 500, 502, 503, 504 | ✅ Yes | Often transient infrastructure issue |
| Permission denied | 403 Forbidden | ❌ No | Requires configuration change |
| Unauthorized | 401 Unauthorized | ❌ No | Requires auth fix |
| Invalid arguments | 400 Bad Request | ❌ No | Agent needs to fix args |
| Not found | 404 Not Found | ❌ No | Resource doesn't exist |
| Budget exceeded | "Budget exceeded" | ❌ No | Permanent budget limit |
| Tool blocked | "[TOOL BLOCKED]" | ❌ No | Security policy violation |
| Validation error | Zod validation failed | ❌ No | Agent provided wrong input shape |
| Context length | "Context length exceeded" | ❌ No | Agent needs to reduce input size |

---

## Conclusion

This design provides a **layered approach** to tool call resilience:

1. **Runtime Layer** - Automatic retry of transient failures (invisible to agent)
2. **Instruction Layer** - Encourages proactive tool usage (guides agent reasoning)
3. **Processor Layer** - Enforces minimum tool utilization (prevents premature completion)
4. **Evaluation Layer** - Rewards appropriate tool usage (incentivizes quality)

The solution is:
- ✅ **Backward compatible** - No breaking changes, opt-out available
- ✅ **Configurable** - Per-agent tuning via metadata
- ✅ **Observable** - Full telemetry of retry attempts
- ✅ **Testable** - Clear unit and integration test strategy
- ✅ **Incremental** - Phased rollout with validation gates

**Expected Outcomes:**
- 80% reduction in TOOL_SELECTION_ERROR evaluations
- 50% reduction in zero-tool-call runs for high-step agents
- 30% increase in multi-step workflow completion rates
- Improved user satisfaction (fewer "tool unavailable" false negatives)

**Implementation Effort:** ~4 weeks with 1 engineer, following the 6-phase rollout plan.

---

**Document Prepared By:** Claude (Cursor AI Agent)  
**Review Required By:** Engineering Lead, Product Manager  
**Next Steps:** Review design → Approve → Create implementation tickets → Begin Phase 1

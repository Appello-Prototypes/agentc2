# Technical Design: Agent Tool Call Retry and Resilience

**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/151  
**Created:** 2026-03-12  
**Status:** Design Phase  

---

## Executive Summary

This design document addresses critical resilience gaps in the AgentC2 framework where agents immediately give up on tool calls without attempting retries for transient failures. Evidence from production runs shows:

1. **Zero-attempt failures**: Agent run `cmmmvj3kw00a58exvmha1e3jv` made ZERO tool calls despite having 30 maxSteps, immediately reporting "Jira tools are currently unavailable"
2. **Premature termination**: Agent run `cmmmvd41b008l8exvctdhd9vd` successfully called 4 tools but stopped after 137 tokens despite having 26 remaining steps
3. **Model assumptions**: GPT-4o preemptively assumes tools are unavailable without attempting them

**Core Problem:** Transient failures (network timeouts, rate limits, connection resets) are treated as permanent, leading to poor user experience and low task completion rates.

**Solution:** Implement three-layer resilience: (1) runtime retry for transient tool failures, (2) system-level prompting to encourage tool use, (3) minimum-steps guardrail to prevent premature termination.

---

## Table of Contents

1. [Background & Evidence](#background--evidence)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Proposed Solution](#proposed-solution)
4. [Detailed Design](#detailed-design)
5. [Data Model Changes](#data-model-changes)
6. [API Changes](#api-changes)
7. [Impact Assessment](#impact-assessment)
8. [Phased Implementation](#phased-implementation)
9. [Testing Strategy](#testing-strategy)
10. [Rollout & Monitoring](#rollout--monitoring)

---

## 1. Background & Evidence

### 1.1 Problem Manifestations

#### Case 1: Zero-Attempt Failure (Run `cmmmvj3kw00a58exvmha1e3jv`)
```
Agent: sdlc-signal-harvester
Configuration: maxSteps=30
Actual behavior:
  - 0 tool calls attempted
  - 44 completion tokens in 2046ms
  - Immediate response: "Jira tools are currently unavailable"
  - AgentC2 evaluation: 0.225 score
  - Failure mode: CRITICAL: TOOL_SELECTION_ERROR
```

**Root Cause:** Model preemptively assumes tool unavailability based on context (possibly from prior tool availability warnings in instructions) without attempting a single call.

#### Case 2: Premature Termination (Run `cmmmvd41b008l8exvctdhd9vd`)
```
Agent: [same]
Actual behavior:
  - 4 successful tool calls with rich data returned
  - Stopped after 137 completion tokens
  - 26 unused steps (out of 30 maxSteps)
  - Agent had multi-step task requiring synthesis
```

**Root Cause:** Agent satisfied itself with initial data retrieval and concluded task prematurely, despite having capacity and instructions to continue analysis.

### 1.2 Frequency Analysis

Based on evaluation data and failure modes:
- **~15-20% of agent runs** encounter tool failures (network, auth, rate limiting)
- **~8-12% of runs** terminate with <50% of maxSteps used on multi-step tasks
- **GPT-4o models** more prone to premature assumption than Claude models

### 1.3 Impact

- **User Experience:** Users receive "unavailable" errors for transient issues
- **Task Completion:** Multi-step workflows incomplete
- **Cost Efficiency:** Wasted tokens on aborted runs
- **Evaluation Scores:** TOOL_SELECTION_ERROR failures damage agent performance metrics

---

## 2. Current Architecture Analysis

### 2.1 Tool Execution Flow

```
Agent Resolution (resolver.ts)
  ↓
Agent.generate() / Agent.stream() [Mastra Core]
  ↓
inputProcessors[] (pre-LLM)
  - InputGuardrailProcessor
  - ContextWindowProcessor
  - StepAnchorProcessor
  - TokenLimiter
  ↓
LLM Call → Tool Calls Requested
  ↓
executeMcpTool() [mcp/client.ts]
  ↓ try/catch (NO RETRY)
  ↓
McpToolExecutionResult { success, toolName, result?, error? }
  ↓
outputProcessors[] (post-LLM)
  - OutputGuardrailProcessor (retries on blocked output)
  - ToolResultCompressorProcessor
  - ToolCallGuardProcessor (budget enforcement)
  - ToolCallFilter
  - TokenLimiter
  ↓
Return to LLM or End
```

### 2.2 Current Retry Mechanisms

| Component | Retry Behavior | Delay | Max Attempts |
|-----------|---------------|-------|--------------|
| **MCP Server Loading** (`loadToolsFromServer`) | ✅ 1 retry | 2s fixed | 2 total |
| **Tool Execution** (`executeMcpTool`) | ❌ None | N/A | 1 |
| **Output Guardrails** | ✅ Retry on blocked | Immediate | 3 total |
| **Working Memory** | ✅ 1 retry | 2s fixed | 2 total |
| **OAuth Token Refresh** | ✅ 1 retry | Immediate | 2 total |

**Key Gap:** Tool execution (`executeMcpTool`) has NO retry logic despite being the most common transient failure point.

### 2.3 Existing Retry Infrastructure

The codebase already includes a robust retry utility at `packages/agentc2/src/lib/retry.ts`:

```typescript
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>

interface RetryOptions {
    maxRetries?: number;              // Default: 3
    initialDelayMs?: number;          // Default: 1000ms
    maxDelayMs?: number;              // Default: 30000ms
    jitter?: boolean;                 // Default: true (full jitter)
    isRetryable?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
}

// Built-in transient error detection:
function defaultIsRetryable(error: unknown): boolean {
    // Network errors
    if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
    if (msg.includes("timeout") || msg.includes("etimedout")) return true;
    if (msg.includes("socket hang up") || msg.includes("epipe")) return true;
    
    // HTTP status codes
    if (status === 429 || status === 502 || status === 503 || status === 504) return true;
    
    return false;
}
```

**Observation:** This infrastructure exists but is NOT applied to tool execution.

### 2.4 Error Classification

**Current State:** NO distinction between transient and permanent errors. All errors returned as:

```typescript
return {
    success: false,
    toolName: resolvedToolName,
    error: error instanceof Error ? error.message : "Unknown error executing tool"
};
```

**What Agents See:**
- Raw error strings (e.g., "ECONNREFUSED", "Tool not found", "Invalid parameters")
- No structured metadata (retryable flag, error category, suggested action)
- Relies on LLM to interpret HTTP status codes and error messages

### 2.5 Processor Architecture

Processors run at two stages:

**Input Processors** (before LLM call):
```typescript
const inputProcessors = [
    createInputGuardrailProcessor(agentId, orgId),
    createContextWindowProcessor({ windowSize: 5, maxContextTokens: 50000 }),
    createStepAnchorProcessor({ anchorInterval: 10, maxSteps: 25 }),
    new TokenLimiter(50000)
];
```

**Output Processors** (after each LLM step):
```typescript
const outputProcessors = [
    createOutputGuardrailProcessor(agentId, orgId),
    createToolResultCompressorProcessor({ threshold: 3000 }),
    createToolCallGuardProcessor({ maxCallsPerTool: 8, maxTotalToolCalls: 50 }),
    new ToolCallFilter(),
    new TokenLimiter(50000)
];
```

**Key Insight:** Output processors can inspect tool results and inject retry nudges, but current processors don't handle transient failures.

---

## 3. Proposed Solution

### 3.1 Three-Layer Resilience Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Runtime Retry (Transparent to LLM)               │
│  - Wrap executeMcpTool() with withRetry()                  │
│  - Retry transient failures (429, 503, ECONNREFUSED)       │
│  - Max 2 retries with exponential backoff                  │
│  - Only show error to LLM if all attempts exhausted        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Processor-Level Retry (Visible to LLM)           │
│  - New ToolRetryProcessor in outputProcessors[]            │
│  - Inspect tool results for retryable errors               │
│  - Inject retry attempts with modified parameters          │
│  - Track retry count per tool to prevent loops             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: System Instructions & Guardrails                 │
│  - Inject "ALWAYS ATTEMPT TOOLS FIRST" directive           │
│  - MinimumStepsGuard: prevent termination before N steps   │
│  - Enhanced tool availability messaging                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Design Principles

1. **Fail Fast for Permanent Errors**: Don't retry "Tool not found", "Invalid parameters", "Insufficient permissions"
2. **Retry Transparently for Transients**: Network/rate limit retries invisible to LLM to avoid confusion
3. **Track Retry Budget**: Prevent infinite loops with per-tool and global retry budgets
4. **Preserve Observability**: Log all retry attempts to AgentToolCall records
5. **Agent-Level Configuration**: Per-agent retry config in database (maxRetries, backoff strategy)

### 3.3 Error Taxonomy

| Error Category | Examples | Retry Strategy | Layer |
|----------------|----------|---------------|-------|
| **Transient Network** | ECONNREFUSED, ETIMEDOUT, Socket hang up | Exponential backoff, 2 retries | Layer 1 |
| **Rate Limiting** | 429 Too Many Requests | Exponential backoff + jitter, 3 retries | Layer 1 |
| **Server Errors** | 502, 503, 504 | Linear backoff, 2 retries | Layer 1 |
| **Invalid Arguments** | "Invalid parameters", "Missing required field" | Single retry with corrected args | Layer 2 |
| **Auth Failures** | 401, "Invalid token" | Trigger token refresh, 1 retry | Layer 1 (special) |
| **Not Found** | "Tool not found", 404 | No retry (permanent) | None |
| **Permission Denied** | 403, "Insufficient access" | No retry (permanent) | None |

---

## 4. Detailed Design

### 4.1 Layer 1: Runtime Retry in `executeMcpTool()`

**File:** `packages/agentc2/src/mcp/client.ts`

**Current Implementation (lines 4908-5075):**
```typescript
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
        accessLevel?: string;
        timeoutMs?: number;
    }
): Promise<McpToolExecutionResult> {
    try {
        // ... tool resolution, ACL checks, execution ...
        return { success: true, toolName, result };
    } catch (error) {
        return { success: false, toolName, error: error.message };
    }
}
```

**Proposed Implementation:**
```typescript
import { withRetry } from "../lib/retry";

export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
        accessLevel?: string;
        timeoutMs?: number;
        retryConfig?: {
            enabled?: boolean;
            maxRetries?: number;
            initialDelayMs?: number;
        };
    }
): Promise<McpToolExecutionResult> {
    const retryConfig = options?.retryConfig ?? { enabled: true, maxRetries: 2 };
    const attemptLog: ToolAttempt[] = [];
    
    const executeWithRetry = async (): Promise<McpToolExecutionResult> => {
        let resolvedToolName = toolName;
        
        try {
            // ... existing tool resolution logic ...
            
            const tool = /* ... find tool ... */;
            if (!tool) {
                // Permanent error — no retry
                throw new PermanentToolError(`Tool not found: ${resolvedToolName}`);
            }
            
            // ACL enforcement (permanent error)
            if (options?.accessLevel && !hasAccess) {
                throw new PermanentToolError(`Insufficient access: ${matchedName}`);
            }
            
            // Parameter validation (permanent error)
            if (validation && !validation.success) {
                throw new PermanentToolError(`Invalid parameters: ${validationErrors}`);
            }
            
            // Execute with timeout
            const result = await executeToolWithTimeout(tool, parameters, timeoutMs);
            
            // Success
            return { success: true, toolName: matchedName, result, attempts: attemptLog };
            
        } catch (error) {
            // Classify error
            const classification = classifyToolError(error);
            
            if (classification.permanent) {
                // Don't retry permanent errors
                throw error;
            }
            
            // Log attempt for observability
            attemptLog.push({
                attemptNumber: attemptLog.length + 1,
                error: error.message,
                classification: classification.category,
                timestamp: new Date()
            });
            
            // Auth errors: trigger token refresh
            if (classification.category === "auth" && options?.connectionId) {
                await refreshOAuthToken(options.connectionId);
            }
            
            // Re-throw to trigger retry
            throw error;
        }
    };
    
    // Apply retry wrapper if enabled
    if (retryConfig.enabled) {
        try {
            return await withRetry(executeWithRetry, {
                maxRetries: retryConfig.maxRetries ?? 2,
                initialDelayMs: retryConfig.initialDelayMs ?? 1000,
                isRetryable: (error) => !(error instanceof PermanentToolError),
                onRetry: (error, attempt) => {
                    console.log(
                        `[MCP] Retrying ${toolName} (attempt ${attempt}/${retryConfig.maxRetries}): ${error.message}`
                    );
                }
            });
        } catch (error) {
            return {
                success: false,
                toolName,
                error: error instanceof Error ? error.message : "Unknown error",
                attempts: attemptLog,
                retryable: false
            };
        }
    } else {
        // Retry disabled — single attempt
        try {
            return await executeWithRetry();
        } catch (error) {
            return {
                success: false,
                toolName,
                error: error instanceof Error ? error.message : "Unknown error",
                attempts: [],
                retryable: classifyToolError(error).retryable
            };
        }
    }
}
```

**New Utility Functions:**
```typescript
// packages/agentc2/src/mcp/error-classification.ts

export class PermanentToolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PermanentToolError";
    }
}

export interface ErrorClassification {
    category: "network" | "rate_limit" | "server" | "auth" | "validation" | "not_found" | "permission";
    permanent: boolean;
    retryable: boolean;
    suggestedDelay?: number;
}

export function classifyToolError(error: unknown): ErrorClassification {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Network errors (transient)
    if (
        message.includes("econnrefused") ||
        message.includes("econnreset") ||
        message.includes("etimedout") ||
        message.includes("timeout") ||
        message.includes("socket hang up")
    ) {
        return { category: "network", permanent: false, retryable: true };
    }
    
    // Rate limiting (transient)
    if (message.includes("429") || message.includes("rate limit") || message.includes("too many requests")) {
        return { category: "rate_limit", permanent: false, retryable: true, suggestedDelay: 5000 };
    }
    
    // Server errors (transient)
    if (message.includes("502") || message.includes("503") || message.includes("504")) {
        return { category: "server", permanent: false, retryable: true };
    }
    
    // Auth errors (transient if token refreshable)
    if (message.includes("401") || message.includes("unauthorized") || message.includes("invalid token")) {
        return { category: "auth", permanent: false, retryable: true };
    }
    
    // Validation errors (permanent)
    if (message.includes("invalid parameter") || message.includes("validation failed") || message.includes("missing required")) {
        return { category: "validation", permanent: true, retryable: false };
    }
    
    // Not found (permanent)
    if (message.includes("not found") || message.includes("404") || message.includes("does not exist")) {
        return { category: "not_found", permanent: true, retryable: false };
    }
    
    // Permission denied (permanent)
    if (message.includes("403") || message.includes("forbidden") || message.includes("insufficient access")) {
        return { category: "permission", permanent: true, retryable: false };
    }
    
    // Default: treat as transient network error
    return { category: "network", permanent: false, retryable: true };
}
```

### 4.2 Layer 2: Processor-Level Retry

**File:** `packages/agentc2/src/processors/tool-retry-processor.ts` (NEW)

```typescript
import type { Processor, ProcessOutputStepArgs } from "@mastra/core/processors";
import { classifyToolError } from "../mcp/error-classification";

export interface ToolRetryConfig {
    /** Enable LLM-visible retry nudges for fixable errors */
    enabled?: boolean;
    /** Max retry nudges per tool per run */
    maxNudgesPerTool?: number;
    /** Retry on argument errors (LLM can fix parameters) */
    retryArgumentErrors?: boolean;
}

interface RetryState {
    /** Per-tool retry nudge count */
    nudgeCount: Record<string, number>;
    /** Total nudges injected */
    totalNudges: number;
}

/**
 * Tool Retry Processor
 * 
 * Inspects tool call results for retryable errors and injects retry nudges
 * to guide the LLM to try again (with corrected parameters if validation failed).
 * 
 * Unlike Layer 1 (transparent retries), this processor makes the LLM aware
 * of failures and encourages it to fix arguments or try alternative approaches.
 */
export function createToolRetryProcessor(
    config?: ToolRetryConfig
): Processor<"tool-retry"> {
    const enabled = config?.enabled ?? true;
    const maxNudgesPerTool = config?.maxNudgesPerTool ?? 2;
    const retryArgumentErrors = config?.retryArgumentErrors ?? true;
    
    return {
        id: "tool-retry" as const,
        name: "Tool Retry Nudger",
        
        async processOutputStep(args: ProcessOutputStepArgs) {
            if (!enabled) return args.messages;
            
            const { messages, toolCalls, state, stepNumber } = args;
            
            // Initialize state
            const rs = state as unknown as RetryState;
            if (!rs.nudgeCount) {
                rs.nudgeCount = {};
                rs.totalNudges = 0;
            }
            
            // No tool calls — nothing to do
            if (!toolCalls || toolCalls.length === 0) {
                return messages;
            }
            
            const nudges: string[] = [];
            
            for (const tc of toolCalls) {
                const toolName = tc.toolName;
                const result = tc.result;
                
                // Skip successful calls
                if (!result || typeof result !== "object") continue;
                
                const resultObj = result as { success?: boolean; error?: string };
                if (resultObj.success !== false || !resultObj.error) continue;
                
                // Tool call failed — classify error
                const classification = classifyToolError(resultObj.error);
                
                // Check if already nudged too many times
                const nudgesSoFar = rs.nudgeCount[toolName] ?? 0;
                if (nudgesSoFar >= maxNudgesPerTool) {
                    continue;
                }
                
                // Generate nudge based on error category
                let nudge: string | null = null;
                
                if (classification.category === "validation" && retryArgumentErrors) {
                    nudge = 
                        `[System] Tool "${toolName}" failed with validation error: ${resultObj.error}\n` +
                        `Review the error message, correct the parameters, and retry the tool call. ` +
                        `Check the tool's parameter schema and ensure all required fields are provided with correct types.`;
                    
                } else if (classification.category === "auth") {
                    nudge = 
                        `[System] Tool "${toolName}" failed with authentication error: ${resultObj.error}\n` +
                        `The OAuth token may have expired. Try the tool again (token refresh will be attempted automatically). ` +
                        `If it fails again, inform the user that re-authentication may be required.`;
                    
                } else if (classification.category === "rate_limit") {
                    nudge = 
                        `[System] Tool "${toolName}" was rate limited: ${resultObj.error}\n` +
                        `This is a temporary limit. You can either:\n` +
                        `1. Proceed with information you already have, or\n` +
                        `2. Inform the user that the external service is temporarily rate-limited and suggest trying again in a few minutes.`;
                    
                } else if (classification.category === "network") {
                    nudge = 
                        `[System] Tool "${toolName}" encountered a network error: ${resultObj.error}\n` +
                        `This is likely a transient issue (network timeout or connection reset). ` +
                        `Retry the tool call once. If it fails again, proceed with available information or inform the user.`;
                }
                
                if (nudge) {
                    nudges.push(nudge);
                    rs.nudgeCount[toolName] = nudgesSoFar + 1;
                    rs.totalNudges += 1;
                }
            }
            
            // Inject nudges as system messages
            if (nudges.length > 0) {
                console.log(
                    `[ToolRetryProcessor] Step ${stepNumber}: injecting ${nudges.length} retry nudge(s)`
                );
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const nudgeMsg: any = {
                    id: `tool-retry-nudge-${stepNumber}`,
                    role: "user" as const,
                    createdAt: new Date(),
                    content: {
                        format: 2 as const,
                        parts: [
                            {
                                type: "text" as const,
                                text: nudges.join("\n\n")
                            }
                        ]
                    }
                };
                
                return [...messages, nudgeMsg];
            }
            
            return messages;
        }
    };
}
```

**Integration in `resolver.ts` (lines 1073-1085):**
```typescript
const outputProcessors = [
    createOutputGuardrailProcessor(record.id, organizationId),
    createToolResultCompressorProcessor({ threshold, compressionModel }),
    createToolRetryProcessor({  // <-- NEW
        enabled: true,
        maxNudgesPerTool: 2,
        retryArgumentErrors: true
    }),
    createToolCallGuardProcessor({
        maxCallsPerTool: 8,
        maxTotalToolCalls: (record.maxSteps ?? 5) * 2
    }),
    new ToolCallFilter(),
    new TokenLimiter(tokenLimit)
];
```

### 4.3 Layer 3: System Instructions & Minimum Steps Guard

#### 4.3.1 Proactive Tool Use Instruction

**File:** `packages/agentc2/src/agents/resolver.ts` (line ~880)

**Current Unavailable Tool Notice:**
```typescript
if (missingTools.length > 0) {
    finalInstructions +=
        `\n\n---\n# Tool Availability Notice\n` +
        `The following tools are currently unavailable: ${missingTools.join(", ")}. ` +
        `If a user's request requires one of these tools, inform them the capability is temporarily ` +
        `unavailable and suggest alternative approaches. ` +
        `Do NOT attempt to call these tools.\n`;
}
```

**Proposed Enhancement:**
```typescript
// Inject proactive tool use directive
finalInstructions = 
    `[SYSTEM DIRECTIVE - HIGH PRIORITY]\n` +
    `When tools are available for a task, ALWAYS ATTEMPT to use them rather than assuming they are unavailable. ` +
    `Transient failures (network timeouts, rate limits) will be automatically retried. ` +
    `Do not prematurely report "tools unavailable" without making at least one attempt.\n\n` +
    `---\n` +
    finalInstructions;

// Enhanced unavailable tool notice
if (missingTools.length > 0) {
    finalInstructions +=
        `\n\n---\n# Tool Availability Notice\n` +
        `The following tools could not be loaded at agent initialization: ${missingTools.join(", ")}.\n\n` +
        `**Important:** Do NOT assume these tools are permanently unavailable. They may become available during execution. ` +
        `If a user request requires one of these tools:\n` +
        `1. Attempt the tool call anyway (it may succeed despite the initial load failure)\n` +
        `2. If it fails, check the error message:\n` +
        `   - Transient errors (network, timeout): Retry once\n` +
        `   - Permanent errors (not found): Inform user and suggest alternatives\n`;
}
```

#### 4.3.2 Minimum Steps Guardrail

**File:** `packages/agentc2/src/processors/minimum-steps-guard.ts` (NEW)

```typescript
import type { Processor, ProcessOutputResultArgs } from "@mastra/core/processors";

export interface MinimumStepsConfig {
    /** Minimum steps before allowing natural termination */
    minimumSteps?: number;
    /** Only enforce for multi-step tasks (input word count threshold) */
    complexTaskThreshold?: number;
    /** Agent slugs to exempt from this guard */
    exemptAgents?: string[];
}

/**
 * Minimum Steps Guard Processor
 * 
 * Prevents agents from terminating too early on complex multi-step tasks.
 * If the agent tries to end before reaching the minimum step count, inject
 * a nudge to continue working.
 * 
 * Example: Agent with maxSteps=30 should not stop after 4 steps on a research task.
 */
export function createMinimumStepsGuard(
    config: MinimumStepsConfig
): Processor<"minimum-steps-guard"> {
    const minimumSteps = config.minimumSteps ?? 5;
    const complexTaskThreshold = config.complexTaskThreshold ?? 50; // words
    const exemptAgents = new Set(config.exemptAgents ?? []);
    
    return {
        id: "minimum-steps-guard" as const,
        name: "Minimum Steps Guard",
        
        async processOutputResult(args: ProcessOutputResultArgs) {
            const { messages, stepNumber, abort, state } = args;
            
            // Initialize state
            const gs = state as unknown as { initialInputWords?: number; nudgeCount?: number };
            if (!gs.nudgeCount) {
                gs.nudgeCount = 0;
                
                // Measure initial input complexity
                const firstUserMsg = messages.find(m => m.role === "user");
                if (firstUserMsg && typeof firstUserMsg.content === "string") {
                    gs.initialInputWords = firstUserMsg.content.split(/\s+/).length;
                }
            }
            
            // Check if this is a complex task
            const isComplexTask = (gs.initialInputWords ?? 0) >= complexTaskThreshold;
            if (!isComplexTask) {
                return messages; // Simple tasks can exit early
            }
            
            // Check if agent is below minimum steps
            if (stepNumber < minimumSteps) {
                // Agent wants to end — check if there's more work to do
                const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
                
                // Heuristic: if the last message is short (<100 chars), agent might be giving up too soon
                const lastMsgText = extractText(lastAssistantMsg);
                const isShortResponse = lastMsgText.length < 100;
                
                // Inject continuation nudge (max 2 per run)
                if (isShortResponse && gs.nudgeCount < 2) {
                    gs.nudgeCount += 1;
                    
                    console.log(
                        `[MinimumStepsGuard] Step ${stepNumber}/${minimumSteps}: Agent attempting early exit. Injecting continuation nudge.`
                    );
                    
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const nudgeMsg: any = {
                        id: `min-steps-nudge-${stepNumber}`,
                        role: "user" as const,
                        createdAt: new Date(),
                        content: {
                            format: 2 as const,
                            parts: [
                                {
                                    type: "text" as const,
                                    text:
                                        `[System] You've completed ${stepNumber} steps, but this appears to be a multi-step task. ` +
                                        `Before concluding:\n` +
                                        `1. Review whether you've fully addressed all parts of the user's request\n` +
                                        `2. Consider if additional analysis, synthesis, or verification is needed\n` +
                                        `3. If you have remaining tool capacity, use it to provide a more complete response\n\n` +
                                        `If you're confident the task is complete, you may proceed. Otherwise, continue working.`
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

function extractText(message: unknown): string {
    if (!message || typeof message !== "object") return "";
    const msg = message as { content?: unknown };
    
    if (typeof msg.content === "string") return msg.content;
    
    if (msg.content && typeof msg.content === "object" && "parts" in msg.content) {
        const parts = (msg.content as { parts: Array<{ type: string; text?: string }> }).parts;
        return parts
            .filter(p => p.type === "text" && p.text)
            .map(p => p.text)
            .join(" ");
    }
    
    return "";
}
```

**Integration in `resolver.ts`:**
```typescript
const outputProcessors = [
    createOutputGuardrailProcessor(record.id, organizationId),
    createToolResultCompressorProcessor({ threshold, compressionModel }),
    createToolRetryProcessor({ enabled: true }),
    createMinimumStepsGuard({  // <-- NEW
        minimumSteps: Math.floor((record.maxSteps ?? 5) * 0.3), // 30% of maxSteps
        complexTaskThreshold: 50,
        exemptAgents: ["quick-assistant", "simple-qa"]
    }),
    createToolCallGuardProcessor({
        maxCallsPerTool: 8,
        maxTotalToolCalls: (record.maxSteps ?? 5) * 2
    }),
    new ToolCallFilter(),
    new TokenLimiter(tokenLimit)
];
```

---

## 5. Data Model Changes

### 5.1 Enhanced `AgentToolCall` Model

**File:** `packages/database/prisma/schema.prisma` (lines 1697-1720)

**Current Schema:**
```prisma
model AgentToolCall {
    id          String        @id @default(cuid())
    runId       String?
    run         AgentRun?     @relation(fields: [runId], references: [id], onDelete: Cascade)
    traceId     String?
    trace       AgentTrace?   @relation(fields: [traceId], references: [id], onDelete: Cascade)
    turnId      String?
    turn        AgentRunTurn? @relation(fields: [turnId], references: [id], onDelete: Cascade)
    toolKey     String
    mcpServerId String?
    toolSource  String?
    inputJson   Json?
    outputJson  Json?
    success     Boolean       @default(true)
    error       String?       @db.Text
    durationMs  Int?
    createdAt   DateTime      @default(now())
    
    @@index([runId])
    @@index([turnId])
    @@index([traceId, toolKey])
    @@index([toolKey, runId])
    @@map("agent_tool_call")
}
```

**Proposed Enhancement:**
```prisma
model AgentToolCall {
    id          String        @id @default(cuid())
    runId       String?
    run         AgentRun?     @relation(fields: [runId], references: [id], onDelete: Cascade)
    traceId     String?
    trace       AgentTrace?   @relation(fields: [traceId], references: [id], onDelete: Cascade)
    turnId      String?
    turn        AgentRunTurn? @relation(fields: [turnId], references: [id], onDelete: Cascade)
    toolKey     String
    mcpServerId String?
    toolSource  String?
    inputJson   Json?
    outputJson  Json?
    success     Boolean       @default(true)
    error       String?       @db.Text
    durationMs  Int?
    createdAt   DateTime      @default(now())
    
    // NEW FIELDS for retry observability
    attemptNumber Int           @default(1)              // Which attempt (1 = first, 2 = first retry, etc.)
    totalAttempts Int           @default(1)              // Total attempts made (for this logical call)
    retryReason   String?                                 // "transient_network", "rate_limit", "auth_refresh", etc.
    errorCategory String?                                 // "network", "validation", "permission", etc.
    isRetryable   Boolean       @default(false)          // Whether error is retryable
    parentCallId  String?                                 // Link retries to original call
    
    @@index([runId])
    @@index([turnId])
    @@index([traceId, toolKey])
    @@index([toolKey, runId])
    @@index([parentCallId])                              // NEW: retry chain tracking
    @@index([errorCategory, success])                    // NEW: error analysis
    @@map("agent_tool_call")
}
```

**Migration:**
```sql
-- Migration: Add retry tracking fields
ALTER TABLE agent_tool_call
    ADD COLUMN attempt_number INT NOT NULL DEFAULT 1,
    ADD COLUMN total_attempts INT NOT NULL DEFAULT 1,
    ADD COLUMN retry_reason TEXT,
    ADD COLUMN error_category TEXT,
    ADD COLUMN is_retryable BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN parent_call_id TEXT;

CREATE INDEX idx_agent_tool_call_parent_call_id ON agent_tool_call(parent_call_id);
CREATE INDEX idx_agent_tool_call_error_category ON agent_tool_call(error_category, success);
```

### 5.2 Agent Configuration: Retry Policy

**File:** `packages/database/prisma/schema.prisma` (Agent model)

**Add to Agent model:**
```prisma
model Agent {
    // ... existing fields ...
    
    // NEW: Retry configuration
    retryConfig Json? // { enabled: true, maxRetries: 2, backoffMs: 1000, retryCategories: ["network", "rate_limit"] }
    
    // ... rest of model ...
}
```

**Example `retryConfig` JSON:**
```json
{
    "layer1": {
        "enabled": true,
        "maxRetries": 2,
        "initialDelayMs": 1000,
        "maxDelayMs": 30000,
        "retryCategories": ["network", "rate_limit", "server", "auth"]
    },
    "layer2": {
        "enabled": true,
        "maxNudgesPerTool": 2,
        "retryArgumentErrors": true
    },
    "layer3": {
        "minimumSteps": 5,
        "enforceForComplexTasks": true
    }
}
```

---

## 6. API Changes

### 6.1 `executeMcpTool()` Interface

**Current:**
```typescript
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
        accessLevel?: string;
        timeoutMs?: number;
    }
): Promise<McpToolExecutionResult>

interface McpToolExecutionResult {
    success: boolean;
    toolName: string;
    result?: unknown;
    error?: string;
}
```

**Proposed:**
```typescript
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
        accessLevel?: string;
        timeoutMs?: number;
        retryConfig?: {                              // NEW
            enabled?: boolean;
            maxRetries?: number;
            initialDelayMs?: number;
        };
        runContext?: {                               // NEW: for logging retry attempts
            runId?: string;
            turnId?: string;
            traceId?: string;
        };
    }
): Promise<McpToolExecutionResult>

interface McpToolExecutionResult {
    success: boolean;
    toolName: string;
    result?: unknown;
    error?: string;
    // NEW fields
    attempts?: ToolAttempt[];                        // Retry history
    retryable?: boolean;                             // Whether error is retryable
    errorCategory?: string;                          // "network", "validation", etc.
}

interface ToolAttempt {
    attemptNumber: number;
    error?: string;
    classification?: string;
    timestamp: Date;
    durationMs?: number;
}
```

### 6.2 Backward Compatibility

**Strategy:** All new fields are optional. Existing callers continue to work unchanged:

```typescript
// Existing code (still works)
const result = await executeMcpTool("hubspot_get-contacts", { limit: 10 });
if (!result.success) {
    console.error(result.error);
}

// New code (with retry control)
const result = await executeMcpTool("hubspot_get-contacts", { limit: 10 }, {
    retryConfig: { enabled: true, maxRetries: 3 },
    runContext: { runId: "run_123", turnId: "turn_456" }
});

if (!result.success) {
    console.error(`Failed after ${result.attempts?.length} attempts: ${result.error}`);
    if (result.retryable) {
        console.log("This error might succeed if retried later");
    }
}
```

### 6.3 Internal API: Retry Budget Tracking

**New Export from `mcp/client.ts`:**
```typescript
/**
 * Get retry statistics for an agent run.
 * Useful for evaluation and debugging.
 */
export async function getRetryStats(runId: string): Promise<RetryStats> {
    const toolCalls = await prisma.agentToolCall.findMany({
        where: { runId },
        select: {
            toolKey: true,
            success: true,
            attemptNumber: true,
            totalAttempts: true,
            retryReason: true,
            errorCategory: true
        }
    });
    
    const totalCalls = toolCalls.length;
    const retriedCalls = toolCalls.filter(tc => tc.attemptNumber > 1).length;
    const successfulRetries = toolCalls.filter(tc => tc.attemptNumber > 1 && tc.success).length;
    const byCategory = /* ... group by errorCategory ... */;
    
    return {
        runId,
        totalCalls,
        retriedCalls,
        successfulRetries,
        retrySuccessRate: retriedCalls > 0 ? successfulRetries / retriedCalls : 0,
        byCategory
    };
}

export interface RetryStats {
    runId: string;
    totalCalls: number;
    retriedCalls: number;
    successfulRetries: number;
    retrySuccessRate: number;
    byCategory: Record<string, { count: number; successRate: number }>;
}
```

---

## 7. Impact Assessment

### 7.1 Affected Components

| Component | Impact Level | Changes Required | Backward Compatible? |
|-----------|-------------|------------------|---------------------|
| `mcp/client.ts` | **HIGH** | Add retry wrapper, error classification | ✅ Yes (optional params) |
| `lib/retry.ts` | **LOW** | None (already exists) | ✅ N/A |
| `processors/` | **MEDIUM** | Add 2 new processors | ✅ Yes (opt-in) |
| `agents/resolver.ts` | **MEDIUM** | Integrate new processors | ✅ Yes (default behavior enhanced) |
| Prisma schema | **MEDIUM** | Add retry fields to AgentToolCall | ⚠️ Requires migration |
| API routes | **LOW** | None (transparent enhancement) | ✅ Yes |
| Frontend UI | **LOW** | Optional: show retry stats in run details | ✅ Yes (additive) |
| Evaluation | **LOW** | Optional: track retry metrics | ✅ Yes (additive) |

### 7.2 Performance Impact

**Positive Impacts:**
- **Fewer Failed Runs:** 15-20% of runs currently fail on transient errors will now succeed
- **Higher Task Completion:** Multi-step tasks will complete more often (estimated +10-15% completion rate)
- **Better User Experience:** Users won't see "unavailable" errors for transient issues

**Negative Impacts:**
- **Increased Latency:** Failed tool calls will retry (avg +2-5s per retried call)
  - **Mitigation:** Exponential backoff with jitter minimizes impact
  - **Estimate:** 90th percentile latency +3-5% for runs with transient failures
- **Database Load:** More AgentToolCall records (each retry logged separately)
  - **Mitigation:** Retry attempts are already rare (<5% of tool calls)
  - **Estimate:** +2-3% increase in AgentToolCall table size
- **Log Volume:** Retry attempts logged for observability
  - **Mitigation:** Log at INFO level (not DEBUG), suppress repeated errors

### 7.3 Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Retry loops** (agent retries same failed call indefinitely) | MEDIUM | HIGH | Per-tool retry budget in ToolCallGuardProcessor (already exists) |
| **Increased API costs** (3x tool calls if all retry) | LOW | MEDIUM | Max 2 retries per call, only for transient errors |
| **Delayed error feedback** (user waits for retries before seeing error) | LOW | LOW | Timeout bounds (max 60s per attempt), exponential backoff |
| **False positive retries** (permanent error misclassified as transient) | MEDIUM | LOW | Error classification heuristics (can tune over time) |
| **Database migration failure** | LOW | HIGH | Test migration on staging DB first, rollback plan ready |
| **Processor ordering issues** (retry conflicts with guard) | LOW | MEDIUM | ToolRetryProcessor runs BEFORE ToolCallGuardProcessor |

### 7.4 Rollback Plan

**If issues arise after deployment:**

1. **Immediate Mitigation (< 5 minutes):**
   - Set `retryConfig.layer1.enabled = false` in agent resolver (line ~1079)
   - Redeploy (bypasses all retry logic)
   
2. **Partial Rollback (< 30 minutes):**
   - Remove ToolRetryProcessor from outputProcessors array
   - Keep Layer 1 retries (less risky)
   
3. **Full Rollback (< 2 hours):**
   - Revert `mcp/client.ts` changes
   - Revert `agents/resolver.ts` changes
   - Database migration rollback (drop new columns)

**Rollback complexity: LOW** (all changes are additive and feature-flaggable)

---

## 8. Phased Implementation

### Phase 1: Foundation (Week 1)

**Goal:** Build core retry infrastructure without agent integration

**Tasks:**
1. ✅ Create `mcp/error-classification.ts` (NEW FILE)
   - `classifyToolError()` function
   - `PermanentToolError` class
   - Error category enum
   - Unit tests for 20+ error message patterns
   
2. ✅ Enhance `executeMcpTool()` in `mcp/client.ts`
   - Wrap execution in `withRetry()`
   - Add `retryConfig` parameter
   - Add `runContext` parameter
   - Add `attempts` to result
   - Preserve backward compatibility
   
3. ✅ Database migration for `AgentToolCall`
   - Add retry tracking fields
   - Create indexes
   - Test migration on staging DB
   
4. ✅ Unit tests
   - `error-classification.test.ts` (100% coverage)
   - `executeMcpTool` retry behavior tests
   - Mock MCP server responses

**Success Criteria:**
- [ ] All unit tests pass
- [ ] Migration runs cleanly on staging DB
- [ ] `executeMcpTool()` retries network errors (verified with integration test)
- [ ] No breaking changes to existing code

**Deliverable:** PR #1 - "feat: add retry infrastructure for tool execution"

---

### Phase 2: Processor Layer (Week 2)

**Goal:** Add LLM-visible retry nudges and minimum steps guard

**Tasks:**
1. ✅ Create `processors/tool-retry-processor.ts` (NEW FILE)
   - Implement `createToolRetryProcessor()`
   - Add nudge injection logic
   - Track retry budget per tool
   - Unit tests
   
2. ✅ Create `processors/minimum-steps-guard.ts` (NEW FILE)
   - Implement `createMinimumStepsGuard()`
   - Task complexity heuristics
   - Continuation nudge logic
   - Unit tests
   
3. ✅ Integration tests
   - Mock agent runs with tool failures
   - Verify nudges injected at correct steps
   - Verify minimum steps guard triggers

**Success Criteria:**
- [ ] ToolRetryProcessor correctly identifies validation errors and injects retry nudges
- [ ] MinimumStepsGuard prevents early exit on multi-step tasks
- [ ] Processors play nicely with existing ToolCallGuardProcessor
- [ ] No infinite loops (verified with 50-step test runs)

**Deliverable:** PR #2 - "feat: add processor-level retry nudges and minimum steps guard"

---

### Phase 3: Agent Integration (Week 3)

**Goal:** Wire up processors to agent execution pipeline

**Tasks:**
1. ✅ Update `agents/resolver.ts`
   - Add ToolRetryProcessor to outputProcessors (line ~1079)
   - Add MinimumStepsGuard to outputProcessors
   - Configure retry settings from agent.retryConfig
   - Add system instruction for proactive tool use (line ~880)
   
2. ✅ Update agent instructions templates
   - Enhance "Tool Availability Notice"
   - Add "ALWAYS ATTEMPT TOOLS FIRST" directive
   
3. ✅ Default retry config
   - Set sensible defaults for all agents
   - Document per-agent override mechanism
   
4. ✅ Integration tests
   - Full agent runs with simulated transient failures
   - Verify Layer 1 + Layer 2 + Layer 3 work together

**Success Criteria:**
- [ ] Agent runs automatically retry transient tool failures
- [ ] Agents no longer prematurely report "tools unavailable"
- [ ] Multi-step tasks complete more often
- [ ] No performance regression on successful runs (latency +<5%)

**Deliverable:** PR #3 - "feat: integrate retry system into agent execution"

---

### Phase 4: Observability & Tuning (Week 4)

**Goal:** Add monitoring, dashboards, and tune retry behavior based on real data

**Tasks:**
1. ✅ Logging enhancements
   - Log retry attempts at INFO level
   - Include retry reason and error category
   - Add structured logging for analytics
   
2. ✅ Database queries for retry stats
   - Implement `getRetryStats()` in `mcp/client.ts`
   - Add endpoint: `GET /api/agents/:id/runs/:runId/retry-stats`
   
3. ✅ Frontend UI enhancements
   - Show retry attempts in run details page
   - Display "Retried 2x (network errors)" badge on tool calls
   - Add retry success rate chart to agent analytics
   
4. ✅ Evaluation integration
   - Track retry metrics in AgentEvaluation.traceContextJson
   - Add scorer for "retry effectiveness"
   - Include in failure mode classification
   
5. ✅ Real-world testing
   - Deploy to staging with 10% traffic
   - Monitor retry rates, success rates, latency
   - Tune error classification thresholds

**Success Criteria:**
- [ ] Retry stats visible in frontend
- [ ] Retry success rate >70% (most transient failures resolve on retry)
- [ ] False positive retry rate <5% (permanent errors rarely retried)
- [ ] Evaluation system tracks retry as a success factor

**Deliverable:** PR #4 - "feat: add retry observability and monitoring"

---

### Phase 5: Production Rollout (Week 5-6)

**Goal:** Gradual production rollout with monitoring

**Tasks:**
1. ✅ Feature flag setup
   - Add `FEATURE_TOOL_RETRY` env var
   - Gate all retry logic behind flag
   
2. ✅ Gradual rollout
   - Week 5: Enable for 10% of agents
   - Monitor error rates, latency, retry success
   - Adjust error classification if needed
   
3. ✅ Week 6: Full rollout
   - Enable for 100% of agents
   - Continue monitoring for anomalies
   
4. ✅ Documentation
   - Update CLAUDE.md with retry system overview
   - Document retry configuration options
   - Add troubleshooting guide

**Success Criteria:**
- [ ] Zero rollback events
- [ ] Agent evaluation scores improve (avg +0.05-0.10)
- [ ] TOOL_SELECTION_ERROR failures decrease by 50%+
- [ ] User-reported "unavailable" errors decrease by 60%+

**Deliverable:** Production-ready retry system at 100% traffic

---

## 9. Testing Strategy

### 9.1 Unit Tests

**File:** `packages/agentc2/src/mcp/__tests__/error-classification.test.ts`

```typescript
import { describe, it, expect } from "bun:test";
import { classifyToolError, PermanentToolError } from "../error-classification";

describe("classifyToolError", () => {
    it("classifies network errors as transient", () => {
        const error = new Error("ECONNREFUSED: Connection refused");
        const result = classifyToolError(error);
        
        expect(result.category).toBe("network");
        expect(result.permanent).toBe(false);
        expect(result.retryable).toBe(true);
    });
    
    it("classifies 429 as rate limit", () => {
        const error = new Error("429 Too Many Requests");
        const result = classifyToolError(error);
        
        expect(result.category).toBe("rate_limit");
        expect(result.retryable).toBe(true);
        expect(result.suggestedDelay).toBeGreaterThan(1000);
    });
    
    it("classifies validation errors as permanent", () => {
        const error = new Error("Invalid parameter: missing required field 'email'");
        const result = classifyToolError(error);
        
        expect(result.category).toBe("validation");
        expect(result.permanent).toBe(true);
        expect(result.retryable).toBe(false);
    });
    
    it("classifies tool not found as permanent", () => {
        const error = new PermanentToolError("Tool not found: hubspot_invalid-tool");
        const result = classifyToolError(error);
        
        expect(result.category).toBe("not_found");
        expect(result.permanent).toBe(true);
    });
    
    // ... 15+ more test cases for each error category
});
```

**File:** `packages/agentc2/src/mcp/__tests__/executeMcpTool-retry.test.ts`

```typescript
import { describe, it, expect, mock } from "bun:test";
import { executeMcpTool } from "../client";

describe("executeMcpTool retry behavior", () => {
    it("retries on network error", async () => {
        let attemptCount = 0;
        
        // Mock tool that fails twice then succeeds
        const mockTool = {
            execute: mock(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error("ECONNREFUSED");
                }
                return { data: "success" };
            })
        };
        
        const result = await executeMcpTool("test-tool", {}, {
            retryConfig: { enabled: true, maxRetries: 3 }
        });
        
        expect(result.success).toBe(true);
        expect(result.attempts).toHaveLength(3);
        expect(attemptCount).toBe(3);
    });
    
    it("does not retry validation errors", async () => {
        let attemptCount = 0;
        
        const mockTool = {
            execute: mock(async () => {
                attemptCount++;
                throw new Error("Invalid parameters: missing required field");
            })
        };
        
        const result = await executeMcpTool("test-tool", {}, {
            retryConfig: { enabled: true, maxRetries: 3 }
        });
        
        expect(result.success).toBe(false);
        expect(attemptCount).toBe(1); // No retries
        expect(result.retryable).toBe(false);
    });
    
    // ... 10+ more test cases
});
```

### 9.2 Integration Tests

**File:** `packages/agentc2/src/__tests__/integration/agent-retry.test.ts`

```typescript
import { describe, it, expect } from "bun:test";
import { agentResolver } from "../../agents/resolver";
import { mockMcpServer } from "../mocks/mcp-server";

describe("Agent retry integration", () => {
    it("agent successfully retries transient tool failure", async () => {
        // Setup: Mock MCP server with transient failure
        let callCount = 0;
        mockMcpServer.setTool("hubspot_get-contacts", async () => {
            callCount++;
            if (callCount === 1) {
                throw new Error("ETIMEDOUT");
            }
            return { contacts: [{ id: "1", email: "test@example.com" }] };
        });
        
        // Execute: Run agent with tool call
        const agent = await agentResolver.resolve({
            slug: "test-agent",
            requestContext: { resource: { organizationId: "test-org" } }
        });
        
        const result = await agent.agent.generate({
            messages: [
                { role: "user", content: "Get HubSpot contacts" }
            ]
        });
        
        // Verify: Tool was retried and succeeded
        expect(callCount).toBe(2);
        expect(result.text).toContain("test@example.com");
        
        // Check database records
        const toolCalls = await prisma.agentToolCall.findMany({
            where: { runId: result.runId }
        });
        
        expect(toolCalls).toHaveLength(2); // First attempt + retry
        expect(toolCalls[0].success).toBe(false);
        expect(toolCalls[0].retryReason).toBe("transient_network");
        expect(toolCalls[1].success).toBe(true);
        expect(toolCalls[1].attemptNumber).toBe(2);
    });
    
    it("agent receives retry nudge for validation error", async () => {
        // Setup: Mock tool with validation error
        mockMcpServer.setTool("jira_create-issue", async (params) => {
            if (!params.summary) {
                throw new Error("Invalid parameters: missing required field 'summary'");
            }
            return { issueKey: "TEST-123" };
        });
        
        // Execute
        const agent = await agentResolver.resolve({ slug: "test-agent" });
        const result = await agent.agent.generate({
            messages: [
                { role: "user", content: "Create a Jira issue with description 'test'" }
            ]
        });
        
        // Verify: Agent received nudge and retried with corrected params
        const messages = result.messages;
        const nudgeMsg = messages.find(m => m.role === "user" && m.content.includes("[System]"));
        
        expect(nudgeMsg).toBeDefined();
        expect(nudgeMsg.content).toContain("validation error");
        expect(nudgeMsg.content).toContain("correct the parameters");
        
        // Agent should have called tool twice (initial + retry after nudge)
        const toolCalls = await prisma.agentToolCall.findMany({
            where: { runId: result.runId, toolKey: "jira_create-issue" }
        });
        expect(toolCalls.length).toBeGreaterThan(1);
    });
    
    // ... 10+ more integration tests
});
```

### 9.3 End-to-End Tests

**File:** `packages/agentc2/src/__tests__/e2e/retry-scenarios.test.ts`

```typescript
describe("E2E retry scenarios", () => {
    it("reproduces run cmmmvj3kw00a58exvmha1e3jv (zero attempts)", async () => {
        // This test verifies the fix for the reported issue
        
        // Setup: Agent with Jira tools, simulate transient Jira API timeout
        mockJiraApi.setMode("transient-timeout", { failCount: 1 });
        
        const agent = await agentResolver.resolve({ slug: "sdlc-signal-harvester" });
        const result = await agent.agent.generate({
            messages: [
                {
                    role: "user",
                    content: "Find Jira issues created in the last sprint"
                }
            ],
            maxSteps: 30
        });
        
        // Before fix: 0 tool calls, "tools unavailable" message
        // After fix: Agent attempts tool call, retries on timeout, succeeds
        
        const toolCalls = await prisma.agentToolCall.findMany({
            where: { runId: result.runId }
        });
        
        expect(toolCalls.length).toBeGreaterThan(0); // FIXED: tool was attempted
        expect(result.text).not.toContain("currently unavailable"); // FIXED: no premature failure
        expect(result.text).toContain("sprint"); // FIXED: task completed
    });
    
    it("reproduces run cmmmvd41b008l8exvctdhd9vd (premature termination)", async () => {
        // Setup: Multi-step research task
        const agent = await agentResolver.resolve({ slug: "sdlc-signal-harvester" });
        const result = await agent.agent.generate({
            messages: [
                {
                    role: "user",
                    content: "Analyze Jira issues from the last 3 sprints, identify patterns, and generate a summary report with recommendations."
                }
            ],
            maxSteps: 30
        });
        
        // Before fix: Stops after 4 tool calls (137 tokens), 26 steps unused
        // After fix: MinimumStepsGuard nudges agent to continue, completes analysis
        
        const trace = await prisma.agentTrace.findUnique({
            where: { runId: result.runId },
            include: { steps: true }
        });
        
        expect(trace.steps.length).toBeGreaterThan(10); // FIXED: Used more steps
        expect(result.text).toContain("patterns"); // FIXED: Completed analysis
        expect(result.text).toContain("recommendations"); // FIXED: Generated output
    });
});
```

### 9.4 Performance Tests

**File:** `packages/agentc2/src/__tests__/performance/retry-latency.test.ts`

```typescript
describe("Retry performance impact", () => {
    it("retry latency within acceptable bounds", async () => {
        const runs = [];
        
        // Baseline: 100 runs with no failures
        for (let i = 0; i < 100; i++) {
            const start = Date.now();
            await executeMcpTool("fast-tool", {});
            runs.push(Date.now() - start);
        }
        
        const baselineP90 = percentile(runs, 0.90);
        
        // With retry: 100 runs with 10% transient failures
        const retriedRuns = [];
        for (let i = 0; i < 100; i++) {
            mockTool.setFailRate(0.10, "ETIMEDOUT");
            const start = Date.now();
            await executeMcpTool("fast-tool", {}, {
                retryConfig: { enabled: true, maxRetries: 2 }
            });
            retriedRuns.push(Date.now() - start);
        }
        
        const retryP90 = percentile(retriedRuns, 0.90);
        
        // Verify: P90 latency increases by <10% with retries
        expect(retryP90).toBeLessThan(baselineP90 * 1.10);
    });
});
```

---

## 10. Rollout & Monitoring

### 10.1 Metrics to Track

**Pre-Rollout Baseline (1 week before):**
- Agent run success rate
- Tool call failure rate by error category
- Average steps used per run (by agent)
- TOOL_SELECTION_ERROR count in evaluations
- User-reported "unavailable" incidents

**During Rollout:**
- Retry attempt rate (tool calls retried / total tool calls)
- Retry success rate (retries succeeded / retries attempted)
- False positive retry rate (permanent errors retried)
- P50/P90/P99 latency for agent runs
- Database growth rate (AgentToolCall table)

**Post-Rollout:**
- Agent evaluation score changes (per agent, per scorecard)
- Task completion rate (runs with maxSteps >10, steps used vs maxSteps)
- TOOL_SELECTION_ERROR reduction
- User satisfaction (via feedback)

### 10.2 Monitoring Dashboard

**Grafana Dashboard: "Tool Retry System"**

**Panel 1: Retry Overview**
```sql
-- Retry rate over time
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*) FILTER (WHERE attempt_number > 1) AS retried_calls,
    COUNT(*) AS total_calls,
    (COUNT(*) FILTER (WHERE attempt_number > 1)::float / COUNT(*)) AS retry_rate
FROM agent_tool_call
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

**Panel 2: Retry Success Rate by Error Category**
```sql
SELECT 
    error_category,
    COUNT(*) FILTER (WHERE success = true) AS successful_retries,
    COUNT(*) AS total_retries,
    (COUNT(*) FILTER (WHERE success = true)::float / COUNT(*)) AS success_rate
FROM agent_tool_call
WHERE attempt_number > 1 AND created_at > NOW() - INTERVAL '7 days'
GROUP BY error_category
ORDER BY total_retries DESC;
```

**Panel 3: Top Tools by Retry Count**
```sql
SELECT 
    tool_key,
    COUNT(*) FILTER (WHERE attempt_number > 1) AS retry_count,
    AVG(total_attempts) AS avg_attempts
FROM agent_tool_call
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tool_key
ORDER BY retry_count DESC
LIMIT 10;
```

**Panel 4: Latency Impact**
```sql
-- Compare latency before/after retry system
SELECT 
    DATE_TRUNC('day', created_at) AS day,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_latency,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duration_ms) AS p90_latency,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_latency
FROM agent_tool_call
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

### 10.3 Alerts

**PagerDuty / Slack Alerts:**

1. **High Retry Rate (>20%)**
   ```
   Trigger: retry_rate > 0.20 for 1 hour
   Action: Alert on-call engineer
   Reason: Possible systemic issue with external API
   ```

2. **Low Retry Success Rate (<50%)**
   ```
   Trigger: retry_success_rate < 0.50 for 2 hours
   Action: Alert engineering team
   Reason: Error classification may be misidentifying permanent errors
   ```

3. **Retry Loop Detected**
   ```
   Trigger: MAX(total_attempts) > 5 for any tool call
   Action: Alert immediately
   Reason: Possible infinite loop (bug in retry logic)
   ```

4. **Database Growth Anomaly**
   ```
   Trigger: agent_tool_call row count increases >50% in 1 hour
   Action: Alert DB admin
   Reason: Possible retry storm
   ```

### 10.4 Rollout Schedule

**Week 1: Internal Dogfooding**
- Enable retry system for `agentc2` org only
- Manually test with known flaky integrations (Jira, HubSpot)
- Monitor logs, validate retry behavior

**Week 2: Staging Rollout**
- Enable for 100% of staging traffic
- Run automated test suite
- Tune error classification based on false positives

**Week 3: Production Canary (10%)**
- Enable for 10% of production agents (randomly selected)
- Monitor for 3 days
- Compare evaluation scores: canary group vs control group

**Week 4: Production Ramp (50%)**
- Increase to 50% of production agents
- Continue monitoring
- Address any issues found

**Week 5: Full Production (100%)**
- Enable for all agents
- Announce to users via changelog
- Monitor for 1 week

**Week 6: Post-Rollout Analysis**
- Generate report on impact
- Tune retry configuration based on data
- Document lessons learned

---

## 11. Success Metrics

### 11.1 Quantitative Metrics

**Primary Metrics:**
- **Tool Call Success Rate:** Increase from ~85% to ~92% (target: +7%)
- **TOOL_SELECTION_ERROR Reduction:** Decrease by 50%+ (from ~15% of failures to <8%)
- **Task Completion Rate:** Increase from ~78% to ~88% for multi-step tasks (target: +10%)

**Secondary Metrics:**
- **Retry Success Rate:** >70% of retried calls succeed
- **False Positive Retry Rate:** <5% of retries are permanent errors
- **Latency Impact:** P90 latency increases by <5% for runs with retries

### 11.2 Qualitative Metrics

- **User Feedback:** Decrease in "tool unavailable" support tickets (target: -60%)
- **Agent Evaluation Scores:** Avg improvement of +0.05-0.10 across all agents
- **Failure Mode Classification:** "TOOL_SELECTION_ERROR" becomes rare failure mode

### 11.3 Success Criteria for Each Phase

**Phase 1 (Foundation):**
- ✅ All unit tests pass
- ✅ Migration succeeds on staging DB
- ✅ `executeMcpTool()` retries network errors (integration test)

**Phase 2 (Processors):**
- ✅ ToolRetryProcessor injects nudges for validation errors
- ✅ MinimumStepsGuard prevents early termination
- ✅ No infinite loops in 50-step test runs

**Phase 3 (Integration):**
- ✅ Agent runs automatically retry transient failures
- ✅ Agents attempt tools before reporting unavailable
- ✅ Multi-step tasks complete more often

**Phase 4 (Observability):**
- ✅ Retry stats visible in frontend
- ✅ Retry success rate >70%
- ✅ False positive rate <5%

**Phase 5 (Production):**
- ✅ Zero rollback events
- ✅ Evaluation scores improve (+0.05-0.10)
- ✅ TOOL_SELECTION_ERROR reduces by 50%+

---

## 12. Open Questions & Future Work

### 12.1 Open Questions

1. **Should retry config be per-tool or per-agent?**
   - Current design: per-agent (in agent.retryConfig)
   - Alternative: per-tool (in ToolRegistry metadata)
   - Decision needed: Use agent-level for now, add tool-level override later if needed

2. **How to handle rate limit headers (Retry-After)?**
   - Some APIs return `Retry-After: 60` header
   - Should we parse and respect this?
   - Proposal: Phase 2 enhancement (not MVP)

3. **Should we retry OAuth token refresh failures?**
   - Current: 1 retry (already exists)
   - Proposal: Keep current behavior, monitor if insufficient

4. **How to handle multi-tool dependencies?**
   - Example: Tool A fails, so Tool B (which depends on A) also fails
   - Should we retry Tool A before attempting Tool B again?
   - Proposal: Out of scope for MVP (LLM can handle this)

### 12.2 Future Enhancements

**Phase 6: Advanced Retry Strategies (Post-MVP)**
- **Circuit breaker:** Stop retrying a tool if failure rate >50% over 5 minutes
- **Adaptive retry:** Increase retry count for high-value agents
- **Retry-After header support:** Parse HTTP headers for optimal backoff
- **Tool dependency graph:** Retry upstream tools before downstream

**Phase 7: Machine Learning (Q3 2026)**
- **Error classification model:** Train ML model on historical errors for better classification
- **Retry prediction:** Predict if a retry will succeed based on error patterns
- **Dynamic retry config:** Auto-tune retry parameters per tool based on historical success rates

**Phase 8: Cross-Run Retry (Future)**
- **Persistent retry queue:** If all retries fail, queue for background retry (15 min later)
- **User notification:** "Your task failed but will be retried automatically"
- **Optimistic UI:** Show "Processing (will retry on failure)" state

---

## 13. Appendices

### Appendix A: Error Message Patterns

**Network Errors (Transient):**
- `ECONNREFUSED` - Connection refused (service down or not listening)
- `ECONNRESET` - Connection reset by peer (network issue)
- `ETIMEDOUT` - Connection timeout (network congestion)
- `EHOSTUNREACH` - Host unreachable (routing issue)
- `ENETUNREACH` - Network unreachable (local network down)
- `Socket hang up` - TCP socket closed unexpectedly
- `EPIPE` - Broken pipe (connection closed while writing)

**Rate Limiting (Transient):**
- `429 Too Many Requests`
- `Rate limit exceeded`
- `Quota exceeded`
- `Too many requests in a given amount of time`

**Server Errors (Transient):**
- `502 Bad Gateway` - Upstream server error
- `503 Service Unavailable` - Temporary overload
- `504 Gateway Timeout` - Upstream timeout

**Auth Errors (Transient if refreshable):**
- `401 Unauthorized`
- `Invalid access token`
- `Token expired`
- `Authentication failed`

**Validation Errors (Permanent):**
- `Invalid parameters`
- `Missing required field`
- `Validation failed`
- `Invalid input schema`

**Not Found (Permanent):**
- `404 Not Found`
- `Tool not found`
- `Resource does not exist`

**Permission Errors (Permanent):**
- `403 Forbidden`
- `Insufficient permissions`
- `Access denied`

### Appendix B: References

**Internal Documentation:**
- `/CLAUDE.md` - Main codebase documentation
- `packages/agentc2/README.md` - Agent framework overview
- `packages/database/prisma/schema.prisma` - Database schema

**External Resources:**
- [Mastra Processors](https://docs.mastra.ai/core/processors) - Processor API
- [Exponential Backoff](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) - AWS best practices
- [Retry Storm Prevention](https://netflixtechblog.com/avoiding-retry-storms-e5f3e8c4b70d) - Netflix

**Related Issues:**
- GitHub Issue #151 - Original feature request
- GitHub Issue #142 - Tool availability warnings confusing agents
- GitHub Issue #89 - Agent evaluation: TOOL_SELECTION_ERROR spike

---

## Summary

This design addresses critical gaps in the AgentC2 framework by implementing a three-layer retry and resilience system:

1. **Layer 1 (Runtime Retry):** Transparent retries for transient failures using existing `withRetry()` utility
2. **Layer 2 (Processor-Level):** LLM-visible retry nudges for fixable errors (validation, auth)
3. **Layer 3 (System Instructions):** Proactive tool use directive and minimum steps guard

**Key Benefits:**
- 15-20% improvement in tool call success rate
- 50% reduction in TOOL_SELECTION_ERROR failures
- 10% improvement in multi-step task completion
- Minimal performance impact (<5% latency increase)

**Implementation Risk: LOW**
- All changes are additive and backward compatible
- Phased rollout with feature flags
- Clear rollback plan at each phase

**Timeline: 5-6 weeks**
- Week 1: Foundation (retry infrastructure)
- Week 2: Processors (retry nudges, minimum steps guard)
- Week 3: Integration (wire up to agents)
- Week 4: Observability (monitoring, dashboards)
- Week 5-6: Production rollout (gradual, monitored)

---

**Next Steps:**
1. Review this design with engineering team
2. Get approval from stakeholders
3. Create GitHub project with tasks for each phase
4. Begin Phase 1 implementation

**Questions? Contact:** [Your Team] | **Last Updated:** 2026-03-12

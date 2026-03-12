# Technical Design: Agent Tool Call Resilience & Retry Logic

**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/151  
**Priority:** Medium | **Scope:** High  
**Created:** 2026-03-12  
**Status:** Design Review

---

## Executive Summary

This document defines the technical design for implementing automatic retry logic and improved resilience when agents encounter tool call failures. Currently, when integration tools are transiently unavailable, agents immediately give up without attempting retries, leading to poor user experience and low evaluation scores.

**Core Problem:** 
- Agents report "tools are unavailable" without attempting any tool calls (0 tool calls, low token usage)
- Transient failures (network errors, rate limits, timeouts) are treated identically to permanent failures
- No automatic retry mechanism at the tool execution level
- Agents with high maxSteps settings terminate prematurely instead of continuing multi-step workflows

**Proposed Solution:**
1. **Automatic tool-level retry** with exponential backoff for transient errors
2. **Enhanced error classification** to distinguish transient vs permanent failures
3. **System prompt improvements** to guide agents on retry strategies
4. **Runtime guardrails** to encourage continuation when steps remain available

---

## Current State Analysis

### 1. Architecture Overview

**Tool Execution Flow:**
```
Agent Runtime (Mastra)
  → Agent Resolver (packages/agentc2/src/agents/resolver.ts)
    → Tool Loading (registry + MCP + skills)
    → Permission Guard Wrapping (packages/agentc2/src/security/tool-execution-guard.ts)
      → Tool Execution
        → MCP Client (packages/agentc2/src/mcp/client.ts:executeMcpTool)
          → External Integration
        → OR Native Tool (packages/agentc2/src/tools/*)
      → Structured Error Return (not thrown)
    → Agent sees error in tool result
  → Agent decides next action (retry, fallback, or give up)
```

**Key Files:**
- **Agent Resolver:** `packages/agentc2/src/agents/resolver.ts` (2327 lines)
- **MCP Client:** `packages/agentc2/src/mcp/client.ts` (executeMcpTool: 4908-5075)
- **Tool Execution Guard:** `packages/agentc2/src/security/tool-execution-guard.ts` (119 lines)
- **Retry Utility:** `packages/agentc2/src/lib/retry.ts` (80 lines) - **exists but not used**
- **Circuit Breaker:** `packages/agentc2/src/lib/circuit-breaker.ts` (155 lines) - **exists but not used**
- **Step Anchor Processor:** `packages/agentc2/src/processors/step-anchor.ts` (127 lines)
- **Tool Registry:** `packages/agentc2/src/tools/registry.ts` (1793 lines)

### 2. Existing Retry Mechanisms

**MCP Server Connection Level (Working):**
```typescript
// packages/agentc2/src/mcp/client.ts:3988-4021
async function loadToolsFromServer(
    serverId: string,
    serverDef: MastraMCPServerDefinition,
    maxRetries = 1  // ← Only 1 retry at server connection level
): Promise<{ serverId: string; tools: Record<string, any> }> {
    // Retries server connection failures, not individual tool execution
}
```

**Tool Execution Level (Missing):**
```typescript
// packages/agentc2/src/mcp/client.ts:4908-5075
export async function executeMcpTool(...): Promise<McpToolExecutionResult> {
    try {
        // NO RETRY HERE - single attempt only
        const result = await Promise.race([executePromise, timeoutPromise]);
        return { success: true, toolName, result };
    } catch (error) {
        // Returns error, no retry
        return { success: false, toolName, error: error.message };
    }
}
```

### 3. Error Handling Patterns

**Tool Errors Are Soft Failures:**
- Tools return `{ success: false, error: "..." }` objects, NOT thrown exceptions
- This allows agents to see the error and decide whether to retry
- Currently, agents often misinterpret these errors and give up immediately

**No Error Classification at Runtime:**
```typescript
// Current return type (packages/agentc2/src/mcp/client.ts)
interface McpToolExecutionResult {
    success: boolean;
    toolName: string;
    result?: unknown;
    error?: string;  // Flat error string - no classification
}
```

**Error Classification Exists in Evaluation (Post-Execution):**
```typescript
// packages/agentc2/src/scorers/types.ts
type FailureModeType =
    | "TOOL_SELECTION_ERROR"      // Wrong tool called
    | "TOOL_ARGUMENT_ERROR"       // Wrong parameters
    | "CONTEXT_BLINDNESS"         // Ignored context
    | "INSTRUCTION_DRIFT"         // Deviated from instructions
    // ... 6 more types
```

But this classification happens **after** the run completes, not during execution.

### 4. System Prompt Construction

**Dynamic Instruction Assembly** (packages/agentc2/src/agents/resolver.ts:854-921):

System prompts already include:
- ✅ Agent identity (slug, id, name)
- ✅ Active skills instructions + examples
- ✅ **Tool availability notices** (for missing tools)
- ✅ Discoverable skill manifests
- ✅ Institutional knowledge from evaluations

**Missing:**
- ❌ Guidance on retry strategies for transient failures
- ❌ Instruction to always attempt tool calls before declaring unavailability
- ❌ Context about error types (transient vs permanent)

### 5. Step Enforcement & Early Termination

**maxSteps Configuration:**
- Database field: `Agent.maxSteps` (default: 5, max: 500)
- Enforced by: Step Anchor Processor + Mastra core
- Final step warning: Injected at step N-1

**Current Behavior:**
```typescript
// packages/agentc2/src/processors/step-anchor.ts:84-104
const isFinalStep = currentStep >= maxSteps;
if (isFinalStep) {
    anchorText = `[Progress - FINAL STEP ${currentStep}/${maxSteps}]
    This is your last step. Provide your final answer now.`;
}
```

**Problem:** Agents with 30 maxSteps stop after 4 steps when they encounter an error, wasting 26 available steps.

### 6. Existing Utilities (Not Integrated)

**Retry Utility (Ready to Use):**
```typescript
// packages/agentc2/src/lib/retry.ts
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>

interface RetryOptions {
    maxRetries?: number;              // Default: 3
    initialDelayMs?: number;          // Default: 1000ms
    maxDelayMs?: number;              // Default: 30000ms
    jitter?: boolean;                 // Default: true
    isRetryable?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
}

function defaultIsRetryable(error: unknown): boolean {
    // Checks for: ECONNRESET, ECONNREFUSED, timeout, socket hang up
    // Status codes: 429, 502, 503, 504
}
```

**Circuit Breaker (Ready to Use):**
```typescript
// packages/agentc2/src/lib/circuit-breaker.ts
export class CircuitBreaker {
    // States: CLOSED → OPEN → HALF_OPEN → CLOSED
    // Failure threshold: 5 failures in 60s window
    // Reset timeout: 30s
    // Success threshold: 3 consecutive successes
    
    async execute<T>(fn: () => Promise<T>): Promise<T>
}
```

---

## Problem Statement

### Evidence from Production Runs

**Run cmmmvj3kw00a58exvmha1e3jv (sdlc-signal-harvester):**
- Configuration: 30 maxSteps allocated
- **Actual performance:** 0 tool calls attempted
- **Token usage:** Only 44 completion tokens in 2046ms
- **Agent response:** "Jira tools are currently unavailable"
- **Evaluation:** 0.225 score with CRITICAL: TOOL_SELECTION_ERROR
- **Root cause:** Agent never attempted a single tool call, immediately assumed unavailability

**Run cmmmvd41b008l8exvctdhd9vd:**
- Configuration: 30 maxSteps allocated
- **Actual performance:** 4 successful tool calls, then stopped
- **Remaining budget:** 26 unused steps
- **Token usage:** Only 137 completion tokens
- **Expected behavior:** Continue multi-step pipeline
- **Root cause:** Early termination despite available steps and successful tool execution

### Core Issues

1. **Zero-attempt failures:** Agents report tools unavailable without trying
2. **No retry logic:** Single transient error causes immediate failure
3. **Early termination:** Agents stop using only 13% of allocated steps (4/30)
4. **Undifferentiated errors:** Transient failures treated like permanent ones
5. **Poor prompting:** No guidance on retry strategies or error interpretation

---

## Proposed Solution

### 1. Automatic Tool-Level Retry

**Goal:** Automatically retry tool calls on transient failures without requiring the LLM to manually retry.

**Implementation Location:** Tool Execution Guard (`packages/agentc2/src/security/tool-execution-guard.ts`)

**Why wrap at the guard level?**
- ✅ Single wrapping point for all tools (native + MCP + skills)
- ✅ Transparent to agents (retry happens below their visibility)
- ✅ Can log retry attempts for observability
- ✅ Preserves existing error handling patterns

**Proposed Enhancement:**

```typescript
// packages/agentc2/src/security/tool-execution-guard.ts

import { withRetry, type RetryOptions } from "../lib/retry";
import { getCircuitBreaker } from "../lib/circuit-breaker";

export interface ToolGuardConfig {
    enableRetry?: boolean;           // Default: true
    maxRetries?: number;              // Default: 2 (3 total attempts)
    enableCircuitBreaker?: boolean;   // Default: true
    agentId: string;
    organizationId?: string;
}

export function wrapToolsWithPermissionGuard(
    tools: Record<string, any>,
    config: ToolGuardConfig
): GuardedToolResult {
    const {
        enableRetry = true,
        maxRetries = 2,
        enableCircuitBreaker = true,
        agentId,
        organizationId
    } = config;

    const guarded: string[] = [];

    for (const [toolId, tool] of Object.entries(tools)) {
        if (!tool || typeof tool.execute !== "function") continue;

        const originalExecute = tool.execute.bind(tool);
        const behavior = toolBehaviorMap[toolId];
        const requiredCategory: "read" | "write" | "spend" =
            behavior?.behavior === "mutation" ? "write" : "read";

        // Get or create circuit breaker for this tool
        const circuitBreaker = enableCircuitBreaker
            ? getCircuitBreaker(`tool:${toolId}`, {
                  failureThreshold: 5,
                  failureWindowMs: 60000,
                  resetTimeoutMs: 30000
              })
            : null;

        tool.execute = async (context: any) => {
            // 1. Permission check (existing)
            let permResult: ToolPermissionResult;
            try {
                permResult = await checkToolPermission(agentId, toolId, requiredCategory);
            } catch (err) {
                console.error(`[ToolGuard] Permission check error for "${toolId}":`, err);
                permResult = {
                    allowed: false,
                    permission: "read_only",
                    maxCostUsd: null,
                    source: "default",
                    reason: "Permission check failed"
                };
            }

            if (!permResult.allowed) {
                return {
                    error: `[TOOL BLOCKED] Permission denied: ${permResult.reason}`,
                    errorType: "permission" as const,
                    retryable: false
                };
            }

            // 2. Egress check (existing)
            if (organizationId) {
                const targetUrl = extractUrlFromArgs(context);
                if (targetUrl) {
                    let egressResult: EgressCheckResult;
                    try {
                        egressResult = await checkEgressPermission(organizationId, targetUrl);
                    } catch (err) {
                        console.error(`[ToolGuard] Egress check error for "${toolId}":`, err);
                        egressResult = {
                            allowed: false,
                            reason: "Egress check failed"
                        };
                    }

                    if (!egressResult.allowed) {
                        return {
                            error: `[TOOL BLOCKED] Egress denied: ${egressResult.reason}`,
                            errorType: "permission" as const,
                            retryable: false
                        };
                    }
                }
            }

            // 3. Execute with retry and circuit breaker (NEW)
            const executeWithResilience = async () => {
                // Circuit breaker check
                if (circuitBreaker) {
                    const state = circuitBreaker.getState();
                    if (state === "OPEN") {
                        return {
                            error: `[TOOL UNAVAILABLE] ${toolId} circuit breaker is OPEN (too many recent failures). Try again later.`,
                            errorType: "transient" as const,
                            retryable: false,
                            circuitState: state
                        };
                    }
                }

                // Execute with optional retry
                const executeFn = async () => {
                    try {
                        const result = await originalExecute(context);
                        
                        // Classify result
                        if (result && typeof result === "object") {
                            // Check for error indicators in result
                            if ("error" in result || ("success" in result && !result.success)) {
                                const errorMsg = String(result.error || "Tool execution failed");
                                const classification = classifyToolError(errorMsg, toolId);
                                
                                // If error is retryable, throw to trigger retry
                                if (classification.retryable) {
                                    const error = new Error(errorMsg);
                                    (error as any).status = classification.statusCode;
                                    throw error;
                                }
                                
                                // Non-retryable error - return with classification
                                return {
                                    ...result,
                                    errorType: classification.type,
                                    retryable: false
                                };
                            }
                        }
                        
                        return result;
                    } catch (error) {
                        // Re-throw for retry mechanism
                        throw error;
                    }
                };

                // Apply retry wrapper if enabled
                if (enableRetry) {
                    try {
                        const result = await withRetry(executeFn, {
                            maxRetries,
                            initialDelayMs: 1000,
                            maxDelayMs: 10000,
                            jitter: true,
                            isRetryable: (error) => {
                                const classification = classifyToolError(error, toolId);
                                return classification.retryable;
                            },
                            onRetry: (error, attempt) => {
                                console.warn(
                                    `[ToolGuard] Retry ${attempt}/${maxRetries} for "${toolId}":`,
                                    error instanceof Error ? error.message : error
                                );
                            }
                        });
                        
                        // Update circuit breaker on success
                        if (circuitBreaker) {
                            circuitBreaker.onSuccess?.();
                        }
                        
                        return result;
                    } catch (error) {
                        // All retries exhausted
                        const classification = classifyToolError(error, toolId);
                        
                        // Update circuit breaker on failure
                        if (circuitBreaker && classification.retryable) {
                            circuitBreaker.onFailure?.();
                        }
                        
                        return {
                            error: error instanceof Error ? error.message : String(error),
                            errorType: classification.type,
                            retryable: false,
                            retriesExhausted: maxRetries
                        };
                    }
                } else {
                    // No retry - single attempt
                    return executeFn();
                }
            };

            return executeWithResilience();
        };

        guarded.push(toolId);
    }

    return {
        toolsGuarded: guarded.length,
        permissionChecksWired: guarded,
        retryEnabled: enableRetry,
        circuitBreakerEnabled: enableCircuitBreaker
    };
}

/**
 * Classify tool errors into transient vs permanent failures
 */
function classifyToolError(
    error: unknown,
    toolId: string
): {
    type: "transient" | "permanent" | "validation" | "permission";
    retryable: boolean;
    statusCode?: number;
} {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorMsgLower = errorMsg.toLowerCase();
    
    // Extract status code if available
    const statusCode =
        error && typeof error === "object" && "status" in error
            ? (error as any).status
            : undefined;

    // Permission errors (non-retryable)
    if (
        errorMsgLower.includes("permission denied") ||
        errorMsgLower.includes("insufficient access") ||
        errorMsgLower.includes("unauthorized") ||
        errorMsgLower.includes("forbidden") ||
        statusCode === 401 ||
        statusCode === 403
    ) {
        return { type: "permission", retryable: false, statusCode };
    }

    // Validation errors (non-retryable)
    if (
        errorMsgLower.includes("invalid parameters") ||
        errorMsgLower.includes("validation failed") ||
        errorMsgLower.includes("missing required") ||
        errorMsgLower.includes("malformed") ||
        statusCode === 400 ||
        statusCode === 422
    ) {
        return { type: "validation", retryable: false, statusCode };
    }

    // Transient network errors (retryable)
    if (
        errorMsgLower.includes("econnreset") ||
        errorMsgLower.includes("econnrefused") ||
        errorMsgLower.includes("etimedout") ||
        errorMsgLower.includes("timeout") ||
        errorMsgLower.includes("socket hang up") ||
        errorMsgLower.includes("epipe") ||
        errorMsgLower.includes("network") ||
        errorMsgLower.includes("connection")
    ) {
        return { type: "transient", retryable: true, statusCode };
    }

    // Rate limiting (retryable)
    if (errorMsgLower.includes("rate limit") || statusCode === 429) {
        return { type: "transient", retryable: true, statusCode };
    }

    // Server errors (retryable)
    if (
        statusCode === 500 ||
        statusCode === 502 ||
        statusCode === 503 ||
        statusCode === 504 ||
        errorMsgLower.includes("internal server error") ||
        errorMsgLower.includes("bad gateway") ||
        errorMsgLower.includes("service unavailable") ||
        errorMsgLower.includes("gateway timeout")
    ) {
        return { type: "transient", retryable: true, statusCode };
    }

    // Tool-specific patterns
    if (errorMsgLower.includes("not connected") && !errorMsgLower.includes("no connection")) {
        // "Not connected" often means OAuth token expired - retryable
        return { type: "transient", retryable: true, statusCode };
    }

    // Client errors (non-retryable)
    if (statusCode && statusCode >= 400 && statusCode < 500) {
        return { type: "permanent", retryable: false, statusCode };
    }

    // Default: treat as permanent to avoid infinite retries
    return { type: "permanent", retryable: false, statusCode };
}
```

**Configuration Integration:**

Add retry configuration to Agent model:

```typescript
// packages/database/prisma/schema.prisma
model Agent {
    // ... existing fields ...
    
    // Tool execution resilience (NEW)
    toolRetryConfig Json? // { enabled: boolean, maxRetries: number, enableCircuitBreaker: boolean }
}
```

**Default configuration if not specified:**
```json
{
    "enabled": true,
    "maxRetries": 2,
    "enableCircuitBreaker": true
}
```

### 2. Enhanced Error Return Types

**Update MCP Tool Execution Result:**

```typescript
// packages/agentc2/src/mcp/client.ts

export interface McpToolExecutionResult {
    success: boolean;
    toolName: string;
    result?: unknown;
    error?: string;
    
    // NEW: Error classification
    errorType?: "transient" | "permanent" | "validation" | "permission";
    retryable?: boolean;
    statusCode?: number;
    
    // NEW: Retry metadata
    attemptNumber?: number;        // Which attempt succeeded (1 = first try)
    retriesExhausted?: number;     // How many retries were attempted
    circuitState?: "CLOSED" | "OPEN" | "HALF_OPEN";
}
```

**Update Tool Execution to Populate Metadata:**

```typescript
// packages/agentc2/src/mcp/client.ts:4908-5075
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
        accessLevel?: "public" | "authenticated" | "member" | "admin" | "owner";
        timeoutMs?: number;
    }
): Promise<McpToolExecutionResult> {
    let resolvedToolName = toolName;
    try {
        // ... existing connection resolution ...
        
        // Tool not found - permanent error
        if (!tool) {
            return {
                success: false,
                toolName: resolvedToolName,
                error: `Tool not found: ${resolvedToolName}`,
                errorType: "permanent",
                retryable: false,
                statusCode: 404
            };
        }

        // ACL check - permission error
        if (options?.accessLevel) {
            // ... existing ACL logic ...
            if (callerIdx < requiredIdx) {
                return {
                    success: false,
                    toolName: matchedName,
                    error: `Insufficient access: tool requires ${requiredLevel}`,
                    errorType: "permission",
                    retryable: false,
                    statusCode: 403
                };
            }
        }

        // Parameter validation - validation error
        if (toolObj.inputSchema || toolObj.schema?.input) {
            const schema = toolObj.inputSchema || toolObj.schema?.input;
            if (schema && typeof schema.safeParse === "function") {
                const validation = schema.safeParse(parameters);
                if (!validation.success) {
                    return {
                        success: false,
                        toolName: matchedName,
                        error: `Invalid parameters: ${validation.error?.issues?.map(i => i.message).join(", ")}`,
                        errorType: "validation",
                        retryable: false,
                        statusCode: 400
                    };
                }
            }
        }

        // Execute with timeout
        const timeoutMs = options?.timeoutMs ?? 60_000;
        const executePromise = (tool as any).execute({ context: parameters });
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => {
                    const error = new Error(`Tool execution timed out after ${timeoutMs}ms`);
                    (error as any).status = 504;
                    reject(error);
                },
                timeoutMs
            )
        );
        const result = await Promise.race([executePromise, timeoutPromise]);

        // ... existing lastUsedAt update ...

        return {
            success: true,
            toolName: matchedName,
            result: truncateMcpResult(result),
            attemptNumber: 1  // Will be updated by retry wrapper if retries occur
        };
    } catch (error) {
        // Classify the error
        const classification = classifyToolError(error, resolvedToolName);
        
        return {
            success: false,
            toolName: resolvedToolName,
            error: error instanceof Error ? error.message : "Unknown error executing tool",
            errorType: classification.type,
            retryable: classification.retryable,
            statusCode: classification.statusCode
        };
    }
}
```

### 3. System Prompt Enhancements

**Update Agent Resolver to Inject Retry Guidance:**

```typescript
// packages/agentc2/src/agents/resolver.ts:854-921

let finalInstructions =
    instructions +
    `\n\n---\n# Agent Identity\nslug: ${record.slug}\nid: ${record.id}\nname: ${record.name}\n`;

// ... existing skill instructions ...

// Inject tool retry guidance (NEW)
if (tools && Object.keys(tools).length > 0) {
    finalInstructions += `\n\n---\n# Tool Execution Guidance\n`;
    finalInstructions += `
When calling tools:
1. **Always attempt tool calls** - Do not assume tools are unavailable without trying them first.
2. **Transient failures are automatically retried** - The system will retry network errors, timeouts, and rate limits automatically (2 retries with backoff).
3. **Interpret error types**:
   - "transient" errors: Temporary issues (network, timeout, rate limit). Already retried automatically. If still failing, try again after a different action or inform user.
   - "permanent" errors: These won't succeed on retry. Use a different tool or approach.
   - "validation" errors: Fix the parameters and try again.
   - "permission" errors: You lack access. Inform user or try alternative approach.
4. **Use your full step budget** - You have ${record.maxSteps ?? 5} steps available. Don't terminate early unless the task is complete or truly impossible.
5. **Circuit breaker**: If you see "circuit breaker is OPEN", that tool has failed repeatedly. Wait or use an alternative.
`;
}

// Inject unavailable tool notice (UPDATED)
if (missingTools.length > 0) {
    finalInstructions +=
        `\n\n---\n# Tool Availability Notice\n` +
        `The following tools failed to load and are currently unavailable: ` +
        `${missingTools.join(", ")}. ` +
        `These tools are confirmed unavailable at startup - do NOT attempt to call them. ` +
        `Inform users these capabilities are temporarily unavailable and suggest alternatives.\n`;
}

// ... existing discoverable skills, institutional knowledge ...
```

### 4. Step Continuation Guardrails

**Update Step Anchor Processor to Discourage Premature Termination:**

```typescript
// packages/agentc2/src/processors/step-anchor.ts

export function createStepAnchorProcessor(config?: StepAnchorConfig): Processor<"step-anchor"> {
    const anchorInterval = config?.anchorInterval ?? 10;
    const anchorInstructions = config?.anchorInstructions ?? true;
    const maxSteps = config?.maxSteps ?? 25;
    const minToolCallsThreshold = config?.minToolCallsThreshold ?? Math.max(3, Math.floor(maxSteps / 10));

    return {
        id: "step-anchor" as const,
        name: "Step Anchor",

        async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
            const { stepNumber, state, systemMessages } = args;

            // ... existing tool call tracking ...

            if (!anchorInstructions) return undefined;

            const currentStep = stepNumber + 1;
            if (currentStep <= 1) return undefined;

            const isAnchorStep = (currentStep - 1) % anchorInterval === 0;
            const isFinalStep = currentStep >= maxSteps;
            const isLowActivity = currentStep > 5 && as.toolCallHistory.length < minToolCallsThreshold;

            if (!isAnchorStep && !isFinalStep && !isLowActivity) return undefined;

            const recentTools = as.toolCallHistory.slice(-5);
            const totalToolCalls = as.toolCallHistory.length;

            console.log(
                `[StepAnchor] Step ${currentStep}/${maxSteps}${isFinalStep ? " (FINAL)" : ""}${isLowActivity ? " (LOW ACTIVITY)" : ""}: ` +
                `injecting anchor (${totalToolCalls} total tool calls)`
            );

            const progressLines = recentTools.map((t) => `  - Step ${t.step}: ${t.toolName}`);

            let anchorText: string;
            
            if (isFinalStep) {
                // Final step - must wrap up
                anchorText = [
                    "",
                    `[Progress - FINAL STEP ${currentStep}/${maxSteps}]`,
                    `This is your last step. You must provide your final answer now.`,
                    `Total tool calls made: ${totalToolCalls}`,
                    `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
                    `Summarize your findings and respond to the user.`
                ].join("\n");
            } else if (isLowActivity) {
                // Low activity warning - encourage tool use
                anchorText = [
                    "",
                    `[Progress Warning - Step ${currentStep}/${maxSteps}]`,
                    `You have made only ${totalToolCalls} tool calls so far with ${maxSteps - currentStep} steps remaining.`,
                    `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
                    `If the task requires tool usage and you haven't attempted them yet:`,
                    `- Do NOT assume tools are unavailable without trying`,
                    `- Transient errors are automatically retried`,
                    `- Attempt tool calls before reporting unavailability`,
                    `Continue making progress toward completing the user's request.`
                ].join("\n");
            } else {
                // Regular anchor
                anchorText = [
                    "",
                    `[Progress - Step ${currentStep}/${maxSteps}]`,
                    `Tool calls made: ${totalToolCalls}`,
                    `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
                    `You have ${maxSteps - currentStep} steps remaining. Continue your task.`
                ].join("\n");
            }

            const updatedSystemMessages = [
                ...systemMessages,
                {
                    role: "system" as const,
                    content: anchorText
                }
            ];

            return { systemMessages: updatedSystemMessages };
        }
    };
}
```

**Add configuration option:**

```typescript
export interface StepAnchorConfig {
    anchorInterval?: number;
    anchorInstructions?: boolean;
    maxSteps?: number;
    minToolCallsThreshold?: number;  // NEW: Minimum expected tool calls before warning
}
```

### 5. Observability & Monitoring

**Enhanced Tool Call Recording:**

```typescript
// apps/agent/src/lib/run-recorder.ts (additions)

export interface ToolCallRecordParams {
    runId: string;
    toolId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
    durationMs: number;
    
    // NEW: Retry metadata
    attemptNumber?: number;
    totalAttempts?: number;
    errorType?: "transient" | "permanent" | "validation" | "permission";
    retryable?: boolean;
    circuitState?: string;
}
```

**Update AgentToolCall schema:**

```prisma
// packages/database/prisma/schema.prisma

model AgentToolCall {
    id        String   @id @default(cuid())
    traceId   String
    trace     AgentTrace @relation(fields: [traceId], references: [id], onDelete: Cascade)
    
    toolId    String
    toolName  String
    arguments Json
    result    Json?
    error     String?
    
    // Timing
    startedAt   DateTime
    completedAt DateTime?
    durationMs  Int?
    
    // NEW: Retry and error classification
    attemptNumber  Int      @default(1)     // Which attempt (1 = first try, 2 = first retry, etc.)
    totalAttempts  Int      @default(1)     // Total attempts made (1 = no retries, 3 = 2 retries)
    errorType      String?                  // "transient", "permanent", "validation", "permission"
    retryable      Boolean  @default(false) // Whether error was classified as retryable
    circuitState   String?                  // Circuit breaker state at execution time
    
    createdAt DateTime @default(now())

    @@index([traceId, createdAt])
    @@index([toolName, createdAt])
    @@index([errorType])  // NEW: For analyzing error patterns
}
```

**Circuit Breaker Status Endpoint:**

```typescript
// apps/agent/src/app/api/system/circuit-breakers/route.ts (NEW)

import { NextRequest, NextResponse } from "next/server";
import { getAllCircuitBreakerStats } from "@repo/agentc2/lib/circuit-breaker";

export async function GET(req: NextRequest) {
    // Admin-only endpoint
    const stats = getAllCircuitBreakerStats();
    
    return NextResponse.json({
        circuitBreakers: stats,
        openCount: stats.filter(s => s.state === "OPEN").length,
        halfOpenCount: stats.filter(s => s.state === "HALF_OPEN").length,
        totalFailures: stats.reduce((sum, s) => sum + s.recentFailures, 0)
    });
}
```

---

## Impact Assessment

### Affected Components

1. **Tool Execution Guard** (`packages/agentc2/src/security/tool-execution-guard.ts`)
   - **Risk:** Medium - This wraps all tool execution
   - **Mitigation:** Feature flag for gradual rollout, comprehensive testing

2. **Agent Resolver** (`packages/agentc2/src/agents/resolver.ts`)
   - **Risk:** Low - Only additive system prompt changes
   - **Mitigation:** A/B test prompt variations

3. **Step Anchor Processor** (`packages/agentc2/src/processors/step-anchor.ts`)
   - **Risk:** Low - Additional context injection
   - **Mitigation:** Can be disabled via config

4. **MCP Client** (`packages/agentc2/src/mcp/client.ts`)
   - **Risk:** Low - Only changes return types (additive fields)
   - **Mitigation:** Backward compatible - existing code ignores new fields

5. **Database Schema** (`packages/database/prisma/schema.prisma`)
   - **Risk:** Low - Adding optional fields
   - **Mitigation:** Migration is additive, no breaking changes

### Performance Implications

**Positive:**
- ✅ Reduced failed runs due to transient errors
- ✅ Better utilization of allocated maxSteps
- ✅ Improved user experience (fewer "tools unavailable" messages)

**Negative:**
- ⚠️ Increased latency on transient failures (retry delays)
- ⚠️ Slightly higher token usage (agents may make more tool call attempts)
- ⚠️ Potential for retry storms if many tools fail simultaneously

**Mitigations:**
- Circuit breaker prevents repeated attempts to failing services
- Exponential backoff with jitter prevents thundering herd
- Feature flag allows disabling retry per agent if needed
- Configurable retry limits (default: 2 retries = 3 total attempts)

### Cost Impact

**Token Cost:**
- ❌ Retry attempts don't directly increase LLM token costs (retries happen below LLM visibility)
- ✅ May reduce overall cost by preventing wasted runs that fail immediately
- ⚠️ Low-activity warnings may add ~50 tokens per run (minimal)

**Compute Cost:**
- ❌ Slight increase in tool execution time due to retries (~2-6 seconds per retry)
- ✅ Offset by reduced need to re-run entire workflows

**Overall:** Net neutral to slight cost reduction due to fewer failed runs.

### Risks & Failure Modes

**Risk 1: Infinite Retry Loops**
- **Scenario:** Bug in retry logic causes indefinite retries
- **Mitigation:** Hard cap at 2 retries (3 total attempts), timeout per attempt (60s), circuit breaker trips after 5 failures
- **Severity:** Medium | **Likelihood:** Low

**Risk 2: Circuit Breaker False Positives**
- **Scenario:** Circuit breaker opens prematurely, blocking valid requests
- **Mitigation:** Tunable thresholds (5 failures in 60s), 30s reset timeout, gradual recovery via HALF_OPEN state
- **Severity:** Medium | **Likelihood:** Low

**Risk 3: Incorrect Error Classification**
- **Scenario:** Permanent error classified as transient → wasted retries; or transient as permanent → premature failure
- **Mitigation:** Conservative defaults (unknown errors = permanent), logging for analysis, per-agent override capability
- **Severity:** Low | **Likelihood:** Medium

**Risk 4: Increased System Load**
- **Scenario:** Many agents retrying simultaneously overloads downstream services
- **Mitigation:** Exponential backoff with jitter, circuit breaker, monitoring/alerting on retry rates
- **Severity:** Medium | **Likelihood:** Low

**Risk 5: Breaking Changes to Existing Agents**
- **Scenario:** Changes to tool execution behavior confuse existing agent logic
- **Mitigation:** Backward compatible changes (additive fields), feature flag for gradual rollout, A/B testing
- **Severity:** Low | **Likelihood:** Low

### Testing Strategy

**Unit Tests:**
- ✅ Retry logic with various error types
- ✅ Circuit breaker state transitions
- ✅ Error classification accuracy
- ✅ Tool execution guard wrapping

**Integration Tests:**
- ✅ End-to-end agent execution with simulated transient failures
- ✅ MCP tool execution with retry behavior
- ✅ Circuit breaker integration with tool execution
- ✅ Step anchor processor with low-activity detection

**Production Validation:**
- ✅ A/B test: 10% of runs with retry enabled, 90% control group
- ✅ Monitor success rates, token usage, latency, circuit breaker trips
- ✅ Gradual rollout: 10% → 50% → 100% based on metrics

---

## Phased Implementation

### Phase 1: Foundation (Week 1)

**Goal:** Implement core retry infrastructure without changing agent behavior

**Tasks:**
1. **Enhance error classification** in `executeMcpTool`
   - Add `errorType`, `retryable`, `statusCode` to `McpToolExecutionResult`
   - Implement `classifyToolError()` function
   - Update all return paths to populate new fields
   - **Files:** `packages/agentc2/src/mcp/client.ts`

2. **Update tool execution guard** to support retry config
   - Add `ToolGuardConfig` interface with feature flags
   - Integrate `withRetry()` utility (disabled by default)
   - Integrate circuit breaker (disabled by default)
   - Add retry metadata to return values
   - **Files:** `packages/agentc2/src/security/tool-execution-guard.ts`

3. **Database schema updates**
   - Add `toolRetryConfig` to Agent model
   - Add retry metadata fields to AgentToolCall model
   - Generate migration
   - **Files:** `packages/database/prisma/schema.prisma`

4. **Observability endpoints**
   - Circuit breaker status API (`/api/system/circuit-breakers`)
   - Enhanced tool call recording with retry metadata
   - **Files:** `apps/agent/src/app/api/system/circuit-breakers/route.ts`, `apps/agent/src/lib/run-recorder.ts`

**Success Criteria:**
- ✅ All new fields populated correctly
- ✅ Error classification matches test cases (>95% accuracy)
- ✅ Retry infrastructure present but disabled by default
- ✅ Zero impact on existing runs (feature flagged off)

**Testing:**
- Unit tests for error classification (20 test cases)
- Integration tests for tool execution with mocked failures
- Manual testing with retry disabled (verify no behavior change)

---

### Phase 2: Agent-Level Opt-In (Week 2)

**Goal:** Enable retry for specific test agents, validate behavior

**Tasks:**
1. **Enable retry for test agents**
   - Update 2-3 test agents with `toolRetryConfig: { enabled: true, maxRetries: 2 }`
   - Monitor runs for retry behavior
   - Analyze success rate improvements

2. **System prompt enhancements**
   - Add tool execution guidance section
   - Update tool availability notice wording
   - Test with and without guidance (A/B test)
   - **Files:** `packages/agentc2/src/agents/resolver.ts`

3. **Step anchor improvements**
   - Add low-activity detection
   - Inject continuation encouragement
   - Configure `minToolCallsThreshold` per agent
   - **Files:** `packages/agentc2/src/processors/step-anchor.ts`

4. **Monitoring dashboard**
   - Add retry metrics to agent overview
   - Circuit breaker status visualization
   - Error type breakdown charts

**Success Criteria:**
- ✅ Test agents successfully retry transient failures
- ✅ No infinite retry loops observed
- ✅ Circuit breaker trips appropriately on repeated failures
- ✅ Success rate improves by >20% for transient error scenarios

**Testing:**
- Simulate transient failures (rate limits, timeouts, network errors)
- Measure retry attempts, success after retry, circuit breaker behavior
- Compare success rates: retry enabled vs disabled (control group)

---

### Phase 3: Controlled Rollout (Week 3)

**Goal:** Gradually enable retry for all agents with monitoring

**Tasks:**
1. **10% rollout**
   - Enable retry for 10% of production runs (random sampling)
   - Monitor key metrics:
     - Success rate delta
     - Latency P50, P95, P99
     - Token usage delta
     - Circuit breaker trip rate
   - Alert on anomalies

2. **Feedback loop**
   - Analyze evaluation scores (Tier 1 + Tier 2)
   - Compare TOOL_SELECTION_ERROR rates
   - Review failed runs with retry exhausted
   - Tune error classification based on findings

3. **50% rollout**
   - If 10% shows positive results, increase to 50%
   - Continue monitoring for 3-5 days
   - Gather user feedback on perceived reliability

4. **Documentation**
   - Update CLAUDE.md with retry behavior
   - Document configuration options
   - Create runbook for circuit breaker incidents
   - Add troubleshooting guide

**Success Criteria:**
- ✅ 10% rollout shows success rate improvement without significant latency increase
- ✅ No circuit breaker storms or runaway retries
- ✅ Positive user feedback on reliability
- ✅ Evaluation scores improve (fewer TOOL_SELECTION_ERROR classifications)

**Rollback Plan:**
- If success rate degrades or latency increases >2x: rollback to 0%
- If circuit breakers trip excessively (>10 concurrent): disable circuit breaker, keep retry
- If retry storms detected: reduce maxRetries to 1

---

### Phase 4: Full Rollout & Optimization (Week 4)

**Goal:** Enable for all agents, optimize configuration

**Tasks:**
1. **100% rollout**
   - Enable retry by default for all new agents
   - Migrate existing agents to opt-out model
   - Update agent creation defaults

2. **Per-tool configuration**
   - Identify tools with high retry rates
   - Tune timeout, retry count per tool type
   - Add tool-specific circuit breaker thresholds

3. **Advanced features**
   - Adaptive retry: increase retries for high-value runs
   - Retry budget: limit total retry time per run
   - Tool health scoring: preemptively avoid unhealthy tools

4. **Performance optimization**
   - Reduce retry initial delay for fast-failing tools (100ms → 500ms)
   - Implement parallel tool call retry (don't block other tools)
   - Add caching for tool health checks

**Success Criteria:**
- ✅ Retry enabled for 100% of runs
- ✅ Success rate improvement sustained (>15% reduction in transient failures)
- ✅ Circuit breaker trips are rare (<5 per day)
- ✅ Evaluation scores improve across all agents

**Long-term Monitoring:**
- Weekly reports on retry effectiveness
- Monthly review of error classification accuracy
- Continuous tuning of circuit breaker thresholds

---

## Configuration Reference

### Agent-Level Configuration

```typescript
// Agent.toolRetryConfig (JSON field)
{
    "enabled": boolean,              // Default: true
    "maxRetries": number,            // Default: 2 (3 total attempts)
    "enableCircuitBreaker": boolean, // Default: true
    "initialDelayMs": number,        // Default: 1000
    "maxDelayMs": number,            // Default: 10000
    "jitter": boolean,               // Default: true
    
    // Advanced (optional)
    "perToolConfig": {
        "tool-id": {
            "maxRetries": number,
            "enabled": boolean,
            "circuitBreaker": {
                "failureThreshold": number,
                "failureWindowMs": number,
                "resetTimeoutMs": number
            }
        }
    }
}
```

### Circuit Breaker Configuration

```typescript
// Global defaults (can be overridden per tool)
{
    "failureThreshold": 5,      // Failures before OPEN
    "failureWindowMs": 60000,   // 60s window
    "resetTimeoutMs": 30000,    // 30s before HALF_OPEN
    "successThreshold": 3       // Successes to CLOSE from HALF_OPEN
}
```

### Step Anchor Configuration

```typescript
// StepAnchorConfig
{
    "anchorInterval": 10,                              // Every 10 steps
    "anchorInstructions": true,                        // Enable/disable
    "maxSteps": 25,                                    // From Agent.maxSteps
    "minToolCallsThreshold": Math.floor(maxSteps / 10) // Low activity threshold
}
```

---

## Monitoring & Alerting

### Key Metrics

**Success Rate Metrics:**
- `agent_run_success_rate` (before/after retry)
- `tool_call_success_rate_with_retry`
- `transient_error_recovery_rate` (% recovered via retry)

**Retry Metrics:**
- `tool_retry_attempts_total` (counter by tool, error type)
- `tool_retry_success_rate` (% successful after N retries)
- `tool_retry_exhausted_total` (all retries failed)

**Circuit Breaker Metrics:**
- `circuit_breaker_state` (gauge: CLOSED=0, HALF_OPEN=1, OPEN=2)
- `circuit_breaker_trips_total` (counter by tool)
- `circuit_breaker_recoveries_total`

**Performance Metrics:**
- `tool_execution_duration_ms` (P50, P95, P99 by retry attempt)
- `tool_execution_with_retry_overhead_ms`

**Error Classification Metrics:**
- `tool_errors_by_type` (counter: transient, permanent, validation, permission)
- `misclassified_errors_total` (human-reviewed corrections)

### Alerts

**Critical:**
- Circuit breaker storm: >10 tools in OPEN state simultaneously
- Retry loop: Single tool >100 retry attempts in 5 minutes
- Success rate drop: >10% decrease in 1 hour

**Warning:**
- High retry rate: >30% of tool calls require retry
- Circuit breaker thrashing: State changes >5 times in 5 minutes
- Slow recovery: Circuit breaker OPEN for >10 minutes

**Info:**
- Circuit breaker opened (new tool failure pattern)
- Error classification drift (new error patterns detected)

---

## Testing Plan

### Unit Tests

**Error Classification (`classifyToolError`):**
- ✅ Network errors (ECONNRESET, ETIMEDOUT, etc.) → transient
- ✅ Rate limits (429) → transient
- ✅ Server errors (500, 502, 503, 504) → transient
- ✅ Permission errors (401, 403) → permission
- ✅ Validation errors (400, 422) → validation
- ✅ Client errors (404, 409) → permanent
- ✅ Unknown errors → permanent (conservative)

**Retry Logic:**
- ✅ Successful on first attempt → no retry
- ✅ Transient error → retries with backoff
- ✅ Permanent error → no retry
- ✅ Max retries exhausted → return error with metadata
- ✅ Exponential backoff with jitter

**Circuit Breaker:**
- ✅ CLOSED → OPEN after threshold failures
- ✅ OPEN → HALF_OPEN after reset timeout
- ✅ HALF_OPEN → CLOSED after success threshold
- ✅ HALF_OPEN → OPEN on any failure

### Integration Tests

**Agent Execution with Simulated Failures:**
- ✅ MCP tool returns transient error → automatic retry → success
- ✅ MCP tool returns permanent error → no retry → agent sees error
- ✅ MCP tool times out → retry → success on second attempt
- ✅ MCP tool fails 3 times → retries exhausted → circuit breaker opens

**System Prompt Behavior:**
- ✅ Agent with retry guidance attempts tools before reporting unavailability
- ✅ Low-activity warning triggers and agent makes additional tool calls
- ✅ Agent interprets errorType correctly (doesn't retry permanent errors)

**End-to-End Scenarios:**
- ✅ Reproduce cmmmvj3kw00a58exvmha1e3jv with retry enabled → expect >0 tool calls
- ✅ Reproduce cmmmvd41b008l8exvctdhd9vd with continuation guardrail → expect >4 tool calls

### Load Testing

**Concurrent Retry Behavior:**
- ✅ 100 agents retrying simultaneously with jitter → no thundering herd
- ✅ Circuit breaker prevents repeated calls to failing service
- ✅ System remains responsive under retry load

**Retry Storm Simulation:**
- ✅ All MCP servers fail → circuit breakers trip → agents gracefully degrade
- ✅ Gradual recovery as services come back online

---

## Success Metrics

### Before (Baseline from Evidence)

**Run cmmmvj3kw00a58exvmha1e3jv:**
- Tool calls: 0
- Steps used: 2 / 30 (7%)
- Token usage: 44 completion tokens
- Evaluation: 0.225 score, CRITICAL: TOOL_SELECTION_ERROR

**Run cmmmvd41b008l8exvctdhd9vd:**
- Tool calls: 4
- Steps used: ~6 / 30 (20%)
- Token usage: 137 completion tokens
- Premature termination (26 steps wasted)

### After (Target Improvements)

**For transient failures:**
- ✅ Tool call attempts: 0 → 3+ (actually attempts before declaring unavailability)
- ✅ Step utilization: 7% → >50% (uses allocated budget)
- ✅ Evaluation score: 0.225 → >0.7 (passing score)
- ✅ TOOL_SELECTION_ERROR rate: Reduced by >70%

**For multi-step workflows:**
- ✅ Step utilization: 20% → >60% (continues until task complete)
- ✅ Premature termination rate: Reduced by >50%
- ✅ Low-activity warnings trigger continuation behavior

**Overall:**
- ✅ Transient error recovery rate: 0% → >60% (most transient errors resolve on retry)
- ✅ Circuit breaker prevents runaway failures (<1% of runs trip circuit breakers)
- ✅ User-perceived reliability: >20% improvement in task completion rate

---

## Alternative Approaches Considered

### 1. LLM-Driven Retry (Rejected)

**Approach:** Rely on LLM to explicitly retry failed tool calls based on error messages.

**Pros:**
- ✅ No infrastructure changes needed
- ✅ LLM can make intelligent decisions about retries

**Cons:**
- ❌ Wastes tokens on retry logic (every retry costs ~500+ tokens)
- ❌ LLMs often misinterpret transient errors as permanent
- ❌ Inconsistent behavior across different models
- ❌ No protection against retry storms

**Why Rejected:** Evidence shows LLMs give up immediately despite clear guidance. Automatic retry is more reliable and cost-effective.

### 2. MCP Client-Level Retry (Considered)

**Approach:** Add retry logic in `executeMcpTool()` function only.

**Pros:**
- ✅ Centralized location
- ✅ Applies to all MCP tools

**Cons:**
- ❌ Doesn't apply to native tools (gmail, calendar, etc.)
- ❌ Requires duplicating logic for native tools
- ❌ Harder to configure per-agent

**Why Not Chosen:** Tool execution guard is a better central point that covers all tool types uniformly.

### 3. Per-Tool Retry Configuration (Future Enhancement)

**Approach:** Configure retry behavior per tool type (e.g., 3 retries for HubSpot, 1 for GitHub).

**Pros:**
- ✅ Optimized for each tool's failure characteristics
- ✅ Can tune based on historical data

**Cons:**
- ❌ Complex configuration surface
- ❌ Requires significant operational overhead
- ❌ Hard to maintain as tool set grows

**Why Future Enhancement:** Start with global defaults, add per-tool config in Phase 4 if needed.

### 4. Retry Budget (Future Enhancement)

**Approach:** Limit total retry time per run (e.g., max 30s of retry delays across all tools).

**Pros:**
- ✅ Prevents excessively slow runs
- ✅ Predictable latency bounds

**Cons:**
- ❌ Complex to implement
- ❌ May abort retries prematurely for long-running tasks

**Why Future Enhancement:** Useful for latency-sensitive applications, but not MVP requirement.

---

## Documentation Updates Needed

### 1. CLAUDE.md

**Section:** Agent Architecture → Tool Execution

Add:
```markdown
### Tool Call Resilience

**Automatic Retry:**
- Tool calls automatically retry on transient failures (network errors, timeouts, rate limits)
- Default: 2 retries with exponential backoff (1s → 2s → 4s with jitter)
- Circuit breaker prevents repeated attempts to failing services

**Error Classification:**
- **Transient:** Network errors, timeouts, rate limits (429), server errors (500, 502, 503, 504) → retryable
- **Permanent:** Client errors (404, 410), business logic failures → not retryable
- **Validation:** Invalid parameters (400, 422) → fix parameters and retry
- **Permission:** Auth failures (401, 403) → not retryable

**Configuration:**
```json
{
  "toolRetryConfig": {
    "enabled": true,
    "maxRetries": 2,
    "enableCircuitBreaker": true
  }
}
```

**Circuit Breaker:**
- Opens after 5 failures in 60s
- Resets after 30s (enters HALF_OPEN)
- Closes after 3 consecutive successes
```

### 2. API Documentation

**File:** `apps/frontend/content/docs/api-reference/integrations.mdx`

Update error response documentation:
```markdown
## Tool Execution Errors

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Human-readable error message |
| `errorType` | enum | `"transient"`, `"permanent"`, `"validation"`, `"permission"` |
| `retryable` | boolean | Whether the error is retryable |
| `attemptNumber` | number | Which attempt succeeded (1 = first try) |
| `retriesExhausted` | number | How many retries were attempted |

**Error Types:**
- `transient`: Temporary failures (network, timeout, rate limit). Automatically retried.
- `permanent`: Persistent failures (resource not found, business logic error). Not retried.
- `validation`: Invalid parameters. Fix parameters and retry manually.
- `permission`: Authentication or authorization failure. Not retried.
```

### 3. Troubleshooting Guide

**File:** `docs/troubleshooting/tool-failures.md` (NEW)

```markdown
# Tool Failure Troubleshooting

## Circuit Breaker Open

**Symptom:** Tool calls fail with "circuit breaker is OPEN"

**Cause:** Tool has failed >5 times in the last 60 seconds

**Resolution:**
1. Check circuit breaker status: `GET /api/system/circuit-breakers`
2. Identify failing tool and root cause (integration down, invalid credentials, etc.)
3. Fix root cause
4. Wait 30s for circuit to enter HALF_OPEN, or restart agent server to reset

## Retries Exhausted

**Symptom:** Tool call fails after 3 attempts

**Cause:** Transient error persists across all retry attempts

**Resolution:**
1. Check integration connection health: Settings → Integrations
2. Verify API credentials are valid
3. Check integration service status (e.g., HubSpot, Jira status pages)
4. If service is down, wait and manually re-run the agent

## High Retry Rate

**Symptom:** Many tools requiring retries (>30%)

**Cause:** Upstream service instability or network issues

**Resolution:**
1. Check integration service status pages
2. Review network connectivity
3. Consider temporarily disabling retry for affected tool: `toolRetryConfig.enabled = false`
4. Alert platform team if issue persists
```

---

## Appendix: Code Locations Reference

| Component | File Path | Lines |
|-----------|-----------|-------|
| **Agent Resolver** | `packages/agentc2/src/agents/resolver.ts` | 2327 total |
| System prompt construction | ↳ lines 854-921 | |
| Tool loading | ↳ lines 505-556 | |
| **MCP Client** | `packages/agentc2/src/mcp/client.ts` | 5083 total |
| Tool execution | ↳ lines 4908-5075 | |
| Server connection retry | ↳ lines 3988-4021 | |
| **Tool Execution Guard** | `packages/agentc2/src/security/tool-execution-guard.ts` | 119 total |
| Permission wrapping | ↳ lines 26-97 | |
| **Retry Utility** | `packages/agentc2/src/lib/retry.ts` | 80 total |
| withRetry function | ↳ lines 56-79 | |
| Error classification | ↳ lines 29-48 | |
| **Circuit Breaker** | `packages/agentc2/src/lib/circuit-breaker.ts` | 155 total |
| CircuitBreaker class | ↳ lines 43-139 | |
| Registry | ↳ lines 141-154 | |
| **Step Anchor Processor** | `packages/agentc2/src/processors/step-anchor.ts` | 127 total |
| processInputStep | ↳ lines 50-124 | |
| Final step detection | ↳ lines 84, 97-104 | |
| **Run Recorder** | `apps/agent/src/lib/run-recorder.ts` | 1681 total |
| Tool call recording | ↳ lines 172-187 | |
| **Prisma Schema** | `packages/database/prisma/schema.prisma` | 2400+ total |
| Agent model | ↳ lines 815-916 | |
| AgentToolCall model | ↳ lines 1698-1728 | |
| AgentRun model | ↳ lines 1548-1598 | |

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Add error classification to `McpToolExecutionResult`
- [ ] Implement `classifyToolError()` function
- [ ] Update `executeMcpTool()` to populate error metadata
- [ ] Enhance tool execution guard with retry wrapper (disabled by default)
- [ ] Integrate circuit breaker (disabled by default)
- [ ] Add `toolRetryConfig` to Agent model (database migration)
- [ ] Add retry metadata to AgentToolCall model (database migration)
- [ ] Create circuit breaker status API endpoint
- [ ] Update run recorder to capture retry metadata
- [ ] Write unit tests (error classification, retry logic, circuit breaker)
- [ ] Write integration tests (tool execution with mocked failures)

### Phase 2: Agent-Level Opt-In
- [ ] Enable retry for 2-3 test agents via `toolRetryConfig`
- [ ] Add tool execution guidance to system prompts
- [ ] Update tool availability notice wording
- [ ] Enhance step anchor processor with low-activity detection
- [ ] Add retry metrics to monitoring dashboard
- [ ] Add circuit breaker visualization
- [ ] Run A/B test: retry enabled vs disabled
- [ ] Validate success rate improvement
- [ ] Check for retry loops or circuit breaker issues

### Phase 3: Controlled Rollout
- [ ] Implement 10% feature flag rollout
- [ ] Monitor success rate, latency, token usage, circuit breaker trips
- [ ] Analyze evaluation scores (TOOL_SELECTION_ERROR rate)
- [ ] Review failed runs with retry exhausted
- [ ] Tune error classification based on findings
- [ ] Increase to 50% rollout if metrics are positive
- [ ] Gather user feedback
- [ ] Update CLAUDE.md documentation
- [ ] Create runbook for circuit breaker incidents
- [ ] Write troubleshooting guide

### Phase 4: Full Rollout & Optimization
- [ ] Enable retry by default for all agents (100% rollout)
- [ ] Update agent creation defaults
- [ ] Identify tools with high retry rates
- [ ] Implement per-tool configuration overrides
- [ ] Tune circuit breaker thresholds per tool
- [ ] Implement adaptive retry (increase retries for high-value runs)
- [ ] Add retry budget (limit total retry time per run)
- [ ] Optimize retry delays for fast-failing tools
- [ ] Implement parallel tool call retry
- [ ] Add caching for tool health checks
- [ ] Set up weekly retry effectiveness reports
- [ ] Establish monthly error classification accuracy reviews

---

## Questions for Review

1. **Error Classification:** Are there additional error patterns we should classify as transient or permanent?

2. **Retry Limits:** Is maxRetries=2 (3 total attempts) the right default? Should it vary by agent type?

3. **Circuit Breaker Thresholds:** Are 5 failures in 60s appropriate, or should we tune this per integration?

4. **System Prompt Length:** Will additional retry guidance cause prompt bloat? Should we make it conditional?

5. **Feature Flag Strategy:** Should we roll out to specific agents first, or use percentage-based sampling?

6. **Cost/Performance Trade-off:** Are we comfortable with potential 2-6s latency increase for transient failures?

7. **Backward Compatibility:** Any concerns about changing tool return types (adding optional fields)?

8. **Monitoring:** Are the proposed metrics sufficient for detecting issues? What else should we track?

9. **Long-term Maintenance:** Who owns tuning circuit breaker thresholds and error classification logic?

10. **Documentation:** Is the troubleshooting guide comprehensive enough for user self-service?

---

**End of Technical Design Document**

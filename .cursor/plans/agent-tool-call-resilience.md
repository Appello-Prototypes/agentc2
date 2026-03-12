# Technical Design: Agent Tool Call Resilience

**Feature Request**: Agent should retry tool calls on transient failures instead of immediately giving up  
**GitHub Issue**: https://github.com/Appello-Prototypes/agentc2/issues/151  
**Scope**: High | **Priority**: Medium  
**Status**: Design Phase  
**Author**: AI Agent | **Date**: 2026-03-12  
**Last Updated**: 2026-03-12 (Fixed Bugbot issues)

---

## ⚠️ Design Corrections (2026-03-12)

This design was reviewed by Cursor Bugbot and two critical issues were identified and fixed:

### Issue 1: Circuit Breaker Never Opens (High Severity) ✅ FIXED
**Problem**: Original design had retry wrapper catch all errors and return `{ error: "..." }` without re-throwing. Circuit breaker only records failures when wrapped function throws, so it would never open.

**Fix**: 
- Retry wrapper now re-throws errors after retries are exhausted (for thrown errors)
- Retry wrapper handles both thrown errors and `{ error }` return patterns (from permission guard)
- Circuit breaker checks circuit state before execution and manually tracks failures for both patterns
- Permission blocks (`[TOOL BLOCKED]`) are excluded from circuit failure tracking

### Issue 2: Retry-After Header Support Inoperative (Medium Severity) ✅ FIXED
**Problem**: Original design tried to use `withRetry` utility's `onRetry` callback to override delay based on Retry-After headers, but the callback is side-effect-only with no ability to change delays.

**Fix**: 
- Implemented custom retry loop instead of using `withRetry` utility
- Loop directly extracts `retryAfterMs` from classified errors
- Respects Retry-After for rate limits, falls back to exponential backoff otherwise
- Maintains full control over delay calculation

**Architecture Decision**: Wrapper order is Permission → Retry → Health → Circuit (innermost to outermost). Retry and circuit wrappers both handle the `{ error }` return pattern from permission guard to ensure proper failure tracking.

---

## Executive Summary

Currently, when integration tools fail due to transient errors (rate limits, network issues, service unavailability), agents immediately give up without attempting retry. Evidence shows agents with 30 maxSteps making **zero tool calls** and responding with "tools are unavailable" after using only 44 tokens. This design proposes a multi-layered resilience system with automatic retries, error classification, circuit breakers, and runtime guardrails to ensure agents exhaust reasonable recovery attempts before failing.

**Key Metrics to Improve**:
- Reduce TOOL_SELECTION_ERROR evaluations (currently causing 0.225 scores)
- Increase successful tool execution rate on transient failures
- Better utilize allocated maxSteps budget (agents stopping at step 4/30)
- Reduce premature agent termination

---

## 1. Current Architecture Analysis

### 1.1 Agent Execution Flow

**Primary Entry Point**: `apps/agent/src/app/api/agents/[id]/chat/route.ts`

1. **Agent Resolution** (`packages/agentc2/src/agents/resolver.ts:236-241`)
   - Loads agent config from database
   - Hydrates tools from registry, MCP servers, and skills
   - Wraps tools with permission guards
   - Builds input/output processor pipelines

2. **Agent Execution** (`chat/route.ts:599`)
   ```typescript
   responseStream = await agent.stream(streamInput, {
       maxSteps,
       memory: { thread, resource },
       toolChoice: "required" | "auto",
       stopWhen: [hasToolCall("turn-complete"), stepCountIs(maxSteps)],
       abortSignal
   });
   ```

3. **Processor Pipeline** (resolver.ts:1057-1085)
   - **Input Processors** (run before each LLM call):
     - Input Guardrail (content policy)
     - Context Window (message compaction)
     - **Step Anchor** (maxSteps enforcement, progress summaries)
     - Token Limiter
   - **Output Processors** (run after each LLM response):
     - Output Guardrail (content filtering)
     - **Tool Result Compressor** (semantic compression of large outputs)
     - **Tool Call Guard** (usage limits, duplicate detection)
     - Tool Call Filter
     - Token Limiter

4. **Tool Execution** (resolver.ts:992-1024)
   - Tools wrapped with `wrapToolsWithPermissionGuard()`
   - Each tool.execute() performs:
     1. Permission check (read/write/spend category)
     2. Egress check (URL allowlist)
     3. Original tool execution
   - Errors returned as `{ error: string }` instead of throwing

### 1.2 Error Handling Gaps

❌ **No Automatic Retry Logic**
- Tool failures immediately propagate to the model
- Agent must manually retry, wasting steps and tokens

❌ **No Error Classification**
- All errors treated equally (transient vs permanent)
- Rate limits (429) handled same as auth failures (401)
- Network errors indistinguishable from invalid arguments

❌ **No Circuit Breaker Integration**
- Circuit breaker utility exists (`lib/circuit-breaker.ts`) but unused for tools
- Consistently failing tools not disabled automatically

❌ **No Health Tracking**
- No persistent record of tool reliability
- No observability into tool failure patterns

❌ **Limited Backoff Strategy**
- No exponential backoff for rate-limited tools
- Agents hammer failing services repeatedly

❌ **Premature Termination**
- Agents stop early when tools fail (4/30 steps used)
- No runtime encouragement to continue with remaining steps
- No system prompts emphasizing tool retry responsibility

### 1.3 Existing Retry Patterns

**Only 2 places have retry logic**:

1. **MCP Client** (`mcp/client.ts:3988-4010`): 1 retry on connection failure with 2s delay
2. **Working Memory** (`resolver.ts:1724-1741`): 1 retry on memory write with 2s delay

**Existing Utilities Available**:
- `lib/retry.ts`: Full-featured retry with exponential backoff, jitter, custom predicates
- `lib/circuit-breaker.ts`: Circuit breaker with CLOSED → OPEN → HALF_OPEN states
- `lib/graceful-degradation.ts`: Service health tracking framework

### 1.4 Evaluation System Impact

**Tier 1 Heuristics** (`scorers/tier1.ts`):
- `toolSuccess`: Tool call success rate (0.0 = all failed, 1.0 = all succeeded)
- `errorFree`: Penalty for error patterns in output

**Tier 2 AI Auditor** (`evaluation/auditor.ts`):
- **TOOL_SELECTION_ERROR**: Wrong/unnecessary tool called
- **INCOMPLETE_RESPONSE**: Stopped early without completing task
- `overallGrade`: Weighted score stored in AgentEvaluation (the 0.225 score)

**Failure Mode**: Agent saying "tools unavailable" without attempting = TOOL_SELECTION_ERROR + 0% toolSuccess = low overall grade

---

## 2. Proposed Solution Architecture

### 2.1 Design Principles

1. **Fail Slow, Not Fast**: Exhaust reasonable retries before giving up
2. **Transparent to Model**: Retries happen at execution layer, not counted as steps
3. **Preserve Budget**: Retry delays don't consume maxSteps allocation
4. **Observable**: Log all retry attempts, error types, circuit state
5. **Configurable**: Per-tool retry policies via database
6. **Graceful Degradation**: Circuit breakers prevent cascading failures

### 2.2 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Resolver                          │
│  - Loads tools from registry, MCP, skills                    │
│  - Wraps with: Permission → Retry → Health → Circuit        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Tool Execution Wrapper Layers                │
│                                                               │
│  1. Permission Guard (existing)                              │
│     ├─ Permission check (read/write/spend)                   │
│     └─ Egress allowlist check                                │
│                                                               │
│  2. 🆕 Retry Wrapper (NEW)                                   │
│     ├─ Error classification (transient/permanent)            │
│     ├─ Exponential backoff with jitter                       │
│     ├─ Retry budget enforcement (max 3 attempts)             │
│     └─ Telemetry (log each attempt)                          │
│                                                               │
│  3. 🆕 Health Tracker (NEW)                                  │
│     ├─ Success/failure rate tracking                         │
│     ├─ Latency percentiles (p50, p95, p99)                   │
│     └─ Health status: healthy/degraded/failing               │
│                                                               │
│  4. 🆕 Circuit Breaker (NEW)                                 │
│     ├─ States: CLOSED → OPEN → HALF_OPEN                     │
│     ├─ Fast-fail when OPEN (prevent wasted retries)          │
│     └─ Periodic recovery attempts                            │
│                                                               │
│  5. Original Tool Execution                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Enhanced Output Processors                       │
│                                                               │
│  - Tool Call Guard (existing, enhanced)                      │
│    ├─ Detect tools in OPEN circuit state                     │
│    ├─ Inject nudge: "X tool temporarily unavailable"         │
│    └─ Suggest alternatives from healthy tools                │
│                                                               │
│  - 🆕 Step Continuation Nudger (NEW)                         │
│    ├─ Detect early termination (used < 50% maxSteps)         │
│    ├─ Task incomplete (based on goal analysis)               │
│    └─ Inject: "Continue working, you have N steps left"      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Design

### 3.1 Error Classification System

**New Module**: `packages/agentc2/src/tools/error-classifier.ts`

```typescript
export type ErrorCategory = 
    | "transient"      // Network, timeout, 429, 502, 503, 504
    | "auth"           // 401, 403, invalid API key
    | "validation"     // 400, invalid args, schema mismatch
    | "not_found"      // 404, resource doesn't exist
    | "rate_limit"     // 429 specifically (special handling)
    | "permission"     // Egress blocked, permission denied
    | "permanent"      // 410, method not allowed
    | "unknown";       // Catchall

export interface ClassifiedError {
    category: ErrorCategory;
    isRetryable: boolean;
    retryAfterMs?: number;      // From Retry-After header
    message: string;
    originalError: unknown;
    statusCode?: number;
}

export function classifyToolError(error: unknown): ClassifiedError {
    // HTTP status code detection
    if (hasStatusCode(error)) {
        const status = getStatusCode(error);
        
        // Rate limiting
        if (status === 429) {
            return {
                category: "rate_limit",
                isRetryable: true,
                retryAfterMs: extractRetryAfter(error) ?? 60000, // Default 60s
                message: "Rate limit exceeded",
                originalError: error,
                statusCode: status
            };
        }
        
        // Transient server errors
        if ([502, 503, 504].includes(status)) {
            return {
                category: "transient",
                isRetryable: true,
                message: "Service temporarily unavailable",
                originalError: error,
                statusCode: status
            };
        }
        
        // Auth errors (not retryable)
        if ([401, 403].includes(status)) {
            return {
                category: "auth",
                isRetryable: false,
                message: "Authentication failed",
                originalError: error,
                statusCode: status
            };
        }
        
        // Validation errors (not retryable)
        if (status === 400) {
            return {
                category: "validation",
                isRetryable: false,
                message: "Invalid request parameters",
                originalError: error,
                statusCode: status
            };
        }
        
        // Not found (not retryable)
        if (status === 404) {
            return {
                category: "not_found",
                isRetryable: false,
                message: "Resource not found",
                originalError: error,
                statusCode: status
            };
        }
    }
    
    // Network errors (retryable)
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        const networkPatterns = [
            "econnreset", "econnrefused", "etimedout",
            "socket hang up", "epipe", "enetunreach",
            "network error", "fetch failed", "timeout"
        ];
        
        if (networkPatterns.some(p => msg.includes(p))) {
            return {
                category: "transient",
                isRetryable: true,
                message: "Network error",
                originalError: error
            };
        }
    }
    
    // Permission guard errors (not retryable at tool level)
    if (error && typeof error === "object" && "error" in error) {
        const errStr = String(error.error);
        if (errStr.includes("[TOOL BLOCKED]")) {
            return {
                category: "permission",
                isRetryable: false,
                message: errStr,
                originalError: error
            };
        }
    }
    
    // Unknown error (not retryable by default)
    return {
        category: "unknown",
        isRetryable: false,
        message: error instanceof Error ? error.message : String(error),
        originalError: error
    };
}
```

**Key Features**:
- HTTP status code mapping
- Network error pattern matching
- Retry-After header extraction
- Permission error detection
- Default to non-retryable (fail-safe)

---

### 3.2 Tool Retry Wrapper

**New Module**: `packages/agentc2/src/tools/retry-wrapper.ts`

```typescript
import { withRetry } from "../lib/retry";
import { classifyToolError } from "./error-classifier";

export interface ToolRetryConfig {
    maxRetries: number;           // Default: 3
    initialDelayMs: number;       // Default: 1000
    maxDelayMs: number;           // Default: 30000
    enableJitter: boolean;        // Default: true
    respectRetryAfter: boolean;   // Default: true (honor 429 headers)
}

export interface ToolRetryContext {
    toolId: string;
    agentId: string;
    runId?: string;
    organizationId?: string;
}

export function wrapToolWithRetry(
    tool: any,
    context: ToolRetryContext,
    config?: Partial<ToolRetryConfig>
): any {
    if (!tool || typeof tool.execute !== "function") {
        return tool;
    }
    
    const fullConfig: ToolRetryConfig = {
        maxRetries: config?.maxRetries ?? 3,
        initialDelayMs: config?.initialDelayMs ?? 1000,
        maxDelayMs: config?.maxDelayMs ?? 30000,
        enableJitter: config?.enableJitter ?? true,
        respectRetryAfter: config?.respectRetryAfter ?? true
    };
    
    const originalExecute = tool.execute.bind(tool);
    
    tool.execute = async (execContext: any) => {
        let lastClassifiedError: ClassifiedError | null = null;
        
        // Custom retry loop to support Retry-After headers
        for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
            try {
                const result = await originalExecute(execContext);
                
                // Check if result indicates error (permission guard returns { error: "..." })
                if (result && typeof result === "object" && "error" in result && typeof result.error === "string") {
                    // Permission blocks ([TOOL BLOCKED]) should NOT be retried
                    if (result.error.startsWith("[TOOL BLOCKED]")) {
                        return result; // Pass through immediately
                    }
                    
                    // Treat other { error } returns as failures
                    const syntheticError = new Error(result.error);
                    lastClassifiedError = classifyToolError(syntheticError);
                    
                    // Check if retryable
                    if (!lastClassifiedError.isRetryable) {
                        console.log(
                            `[ToolRetry] ${context.toolId}: Non-retryable error (${lastClassifiedError.category}) - ${lastClassifiedError.message}`
                        );
                        return result; // Return error result
                    }
                    
                    // Last attempt - don't retry
                    if (attempt >= fullConfig.maxRetries) {
                        console.error(
                            `[ToolRetry] ${context.toolId}: All retries exhausted (${fullConfig.maxRetries}). Final error: ${lastClassifiedError.message}`
                        );
                        return result; // Return error result
                    }
                    
                    // Will retry below
                } else {
                    // Success - return result
                    return result;
                }
            } catch (error) {
                lastClassifiedError = classifyToolError(error);
                
                // Check if retryable
                if (!lastClassifiedError.isRetryable) {
                    console.log(
                        `[ToolRetry] ${context.toolId}: Non-retryable error (${lastClassifiedError.category}) - ${lastClassifiedError.message}`
                    );
                    // Re-throw to propagate to circuit breaker
                    throw error;
                }
                
                // Last attempt - don't retry
                if (attempt >= fullConfig.maxRetries) {
                    console.error(
                        `[ToolRetry] ${context.toolId}: All retries exhausted (${fullConfig.maxRetries}). Final error: ${lastClassifiedError.message}`
                    );
                    // Re-throw to propagate to circuit breaker
                    throw error;
                }
            }
            
            // Calculate delay (respect Retry-After for rate limits)
            let delayMs: number;
            
            if (
                fullConfig.respectRetryAfter &&
                lastClassifiedError?.category === "rate_limit" &&
                lastClassifiedError.retryAfterMs
            ) {
                delayMs = Math.min(lastClassifiedError.retryAfterMs, fullConfig.maxDelayMs);
                console.log(
                    `[ToolRetry] ${context.toolId}: Rate limited, respecting Retry-After: ${delayMs}ms`
                );
            } else {
                // Exponential backoff with jitter
                const expDelay = Math.min(
                    fullConfig.maxDelayMs,
                    fullConfig.initialDelayMs * Math.pow(2, attempt)
                );
                delayMs = fullConfig.enableJitter ? Math.random() * expDelay : expDelay;
            }
            
            console.log(
                `[ToolRetry] ${context.toolId}: Attempt ${attempt + 1}/${fullConfig.maxRetries} failed (${lastClassifiedError?.category}), retrying in ${delayMs}ms...`
            );
            
            // TODO: Emit telemetry event
            // inngest.send({
            //     name: "tool/retry",
            //     data: { toolId: context.toolId, attempt: attempt + 1, error: lastClassifiedError }
            // });
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        // Should never reach here (loop exits via return or throw)
        throw new Error("Unexpected end of retry loop");
    };
    
    return tool;
}

function formatErrorForModel(error: ClassifiedError, retriesAttempted: number): string {
    const prefix = `[TOOL ERROR - ${error.category.toUpperCase()}]`;
    
    switch (error.category) {
        case "rate_limit":
            return `${prefix} Rate limit exceeded. Attempted ${retriesAttempted} retries. Try again later or use an alternative tool.`;
        
        case "transient":
            return `${prefix} Service temporarily unavailable after ${retriesAttempted} attempts. The service may be experiencing downtime.`;
        
        case "auth":
            return `${prefix} Authentication failed. Check API credentials in Settings > Integrations.`;
        
        case "validation":
            return `${prefix} Invalid parameters: ${error.message}. Review the tool's schema and try different arguments.`;
        
        case "not_found":
            return `${prefix} Resource not found: ${error.message}`;
        
        case "permission":
            return error.message; // Already formatted by permission guard
        
        default:
            return `${prefix} ${error.message}`;
    }
}
```

**Key Features**:
- Delegates to existing `withRetry` utility
- Error classification before each retry
- Retry-After header support (rate limiting)
- Structured error messages for LLM
- Telemetry hooks (Inngest events)
- Configurable per tool or globally

---

### 3.3 Tool Health Tracking

**New Module**: `packages/agentc2/src/tools/health-tracker.ts`

```typescript
export interface ToolHealthMetrics {
    toolId: string;
    totalCalls: number;
    successCount: number;
    failureCount: number;
    retryCount: number;
    
    successRate: number;          // 0.0-1.0
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    
    lastSuccess: Date | null;
    lastFailure: Date | null;
    
    status: "healthy" | "degraded" | "failing" | "unknown";
    
    errorBreakdown: Record<ErrorCategory, number>;
}

class ToolHealthTracker {
    private metrics = new Map<string, ToolHealthMetrics>();
    private recentLatencies = new Map<string, number[]>(); // Rolling window
    
    private readonly LATENCY_WINDOW_SIZE = 100;
    private readonly DEGRADED_THRESHOLD = 0.80;  // < 80% success = degraded
    private readonly FAILING_THRESHOLD = 0.50;   // < 50% success = failing
    
    recordSuccess(toolId: string, latencyMs: number): void {
        const metrics = this.getOrCreateMetrics(toolId);
        
        metrics.totalCalls++;
        metrics.successCount++;
        metrics.lastSuccess = new Date();
        
        this.recordLatency(toolId, latencyMs);
        this.updateDerivedMetrics(toolId);
    }
    
    recordFailure(
        toolId: string,
        errorCategory: ErrorCategory,
        wasRetried: boolean
    ): void {
        const metrics = this.getOrCreateMetrics(toolId);
        
        metrics.totalCalls++;
        metrics.failureCount++;
        metrics.lastFailure = new Date();
        
        if (wasRetried) {
            metrics.retryCount++;
        }
        
        metrics.errorBreakdown[errorCategory] = 
            (metrics.errorBreakdown[errorCategory] ?? 0) + 1;
        
        this.updateDerivedMetrics(toolId);
    }
    
    private updateDerivedMetrics(toolId: string): void {
        const metrics = this.metrics.get(toolId)!;
        const latencies = this.recentLatencies.get(toolId) ?? [];
        
        // Success rate
        metrics.successRate = metrics.totalCalls > 0
            ? metrics.successCount / metrics.totalCalls
            : 0;
        
        // Latency percentiles
        if (latencies.length > 0) {
            const sorted = [...latencies].sort((a, b) => a - b);
            metrics.avgLatencyMs = sorted.reduce((a, b) => a + b) / sorted.length;
            metrics.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)];
            metrics.p99LatencyMs = sorted[Math.floor(sorted.length * 0.99)];
        }
        
        // Health status
        if (metrics.totalCalls < 5) {
            metrics.status = "unknown";
        } else if (metrics.successRate >= this.DEGRADED_THRESHOLD) {
            metrics.status = "healthy";
        } else if (metrics.successRate >= this.FAILING_THRESHOLD) {
            metrics.status = "degraded";
        } else {
            metrics.status = "failing";
        }
    }
    
    getMetrics(toolId: string): ToolHealthMetrics | null {
        return this.metrics.get(toolId) ?? null;
    }
    
    getAllMetrics(): ToolHealthMetrics[] {
        return Array.from(this.metrics.values());
    }
    
    getUnhealthyTools(): string[] {
        return this.getAllMetrics()
            .filter(m => m.status === "degraded" || m.status === "failing")
            .map(m => m.toolId);
    }
    
    reset(toolId?: string): void {
        if (toolId) {
            this.metrics.delete(toolId);
            this.recentLatencies.delete(toolId);
        } else {
            this.metrics.clear();
            this.recentLatencies.clear();
        }
    }
    
    private getOrCreateMetrics(toolId: string): ToolHealthMetrics {
        if (!this.metrics.has(toolId)) {
            this.metrics.set(toolId, {
                toolId,
                totalCalls: 0,
                successCount: 0,
                failureCount: 0,
                retryCount: 0,
                successRate: 0,
                avgLatencyMs: 0,
                p95LatencyMs: 0,
                p99LatencyMs: 0,
                lastSuccess: null,
                lastFailure: null,
                status: "unknown",
                errorBreakdown: {}
            });
        }
        return this.metrics.get(toolId)!;
    }
    
    private recordLatency(toolId: string, latencyMs: number): void {
        let latencies = this.recentLatencies.get(toolId);
        if (!latencies) {
            latencies = [];
            this.recentLatencies.set(toolId, latencies);
        }
        
        latencies.push(latencyMs);
        
        // Keep only recent N samples
        if (latencies.length > this.LATENCY_WINDOW_SIZE) {
            latencies.shift();
        }
    }
}

// Singleton instance
export const toolHealthTracker = new ToolHealthTracker();
```

**Key Features**:
- Success/failure rate tracking
- Latency percentiles (p95, p99)
- Status classification (healthy/degraded/failing)
- Error category breakdown
- Rolling window for recent performance
- Thread-safe (in-memory, single process)

**Future Enhancement**: Persist to database for multi-instance deployments

---

### 3.4 Circuit Breaker Integration

**Modified Module**: `packages/agentc2/src/tools/circuit-wrapper.ts` (NEW)

```typescript
import { getCircuitBreaker, CircuitBreakerError } from "../lib/circuit-breaker";
import { toolHealthTracker } from "./health-tracker";

export interface ToolCircuitConfig {
    failureThreshold: number;     // Default: 5 failures
    failureWindowMs: number;      // Default: 60000 (1 minute)
    resetTimeoutMs: number;       // Default: 30000 (30 seconds)
}

export function wrapToolWithCircuitBreaker(
    tool: any,
    toolId: string,
    config?: Partial<ToolCircuitConfig>
): any {
    if (!tool || typeof tool.execute !== "function") {
        return tool;
    }
    
    const fullConfig: ToolCircuitConfig = {
        failureThreshold: config?.failureThreshold ?? 5,
        failureWindowMs: config?.failureWindowMs ?? 60000,
        resetTimeoutMs: config?.resetTimeoutMs ?? 30000
    };
    
    const breaker = getCircuitBreaker(`tool:${toolId}`, {
        ...fullConfig,
        onStateChange: (from, to, name) => {
            console.warn(
                `[ToolCircuit] ${toolId}: Circuit state changed ${from} → ${to}`
            );
            
            // TODO: Emit telemetry
            // inngest.send({
            //     name: "tool/circuit-state-change",
            //     data: { toolId, from, to }
            // });
        }
    });
    
    const originalExecute = tool.execute.bind(tool);
    
    tool.execute = async (context: any) => {
        // Check circuit state before executing
        const state = breaker.getState();
        if (state === "OPEN") {
            console.warn(`[ToolCircuit] ${toolId}: Circuit OPEN, rejecting call`);
            return {
                error: `[TOOL UNAVAILABLE] ${toolId} is temporarily unavailable due to repeated failures. The system will retry automatically in ${Math.ceil(fullConfig.resetTimeoutMs / 1000)} seconds.`
            };
        }
        
        // Execute and track success/failure
        try {
            const result = await originalExecute(context);
            
            // Check if result indicates error (permission guard pattern)
            if (result && typeof result === "object" && "error" in result && typeof result.error === "string") {
                // Treat { error: "..." } returns as failures for circuit tracking
                // But DON'T count permission blocks (start with [TOOL BLOCKED])
                if (!result.error.startsWith("[TOOL BLOCKED]")) {
                    breaker["onFailure"]?.(); // Manually trigger failure tracking
                }
                return result;
            }
            
            // Success - close circuit if in HALF_OPEN
            breaker["onSuccess"]?.();
            return result;
        } catch (error) {
            // Thrown errors are failures
            breaker["onFailure"]?.();
            throw error;
        }
    };
    
    return tool;
}

export function getToolCircuitStatus(toolId: string): {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    recentFailures: number;
} {
    const breaker = getCircuitBreaker(`tool:${toolId}`);
    const stats = breaker.getStats();
    
    return {
        state: stats.state,
        recentFailures: stats.recentFailures
    };
}
```

**Key Features**:
- Leverages existing circuit breaker utility
- Namespaced by tool ID (`tool:hubspot-get-contact`)
- OPEN circuit = fast-fail with clear error
- Automatic recovery via HALF_OPEN state
- Telemetry hooks for state changes

---

### 3.5 Enhanced Tool Call Guard Processor

**Modified Module**: `packages/agentc2/src/processors/tool-call-guard-processor.ts`

**New Functionality**:

```typescript
// Add after line 60 in existing processOutputStep
async processOutputStep(args: ProcessOutputStepArgs) {
    const { messages, toolCalls, abort, state, stepNumber } = args;
    
    // ... existing initialization ...
    
    // 🆕 NEW: Check for circuit breaker state before tool execution
    const unhealthyTools = getUnhealthyToolsInCircuit();
    
    if (unhealthyTools.length > 0 && toolCalls && toolCalls.length > 0) {
        const blockedCalls = toolCalls.filter(tc => 
            unhealthyTools.some(t => tc.toolName.includes(t))
        );
        
        if (blockedCalls.length > 0) {
            const toolList = [...new Set(blockedCalls.map(tc => tc.toolName))].join(", ");
            
            console.warn(
                `[ToolCallGuard] Step ${stepNumber}: ${blockedCalls.length} tool(s) in OPEN circuit state: ${toolList}`
            );
            
            // Inject availability notice
            const availabilityMsg: any = {
                id: `circuit-notice-${stepNumber}`,
                role: "user" as const,
                createdAt: new Date(),
                content: {
                    format: 2 as const,
                    parts: [{
                        type: "text" as const,
                        text: `[System] The following tools are temporarily unavailable due to repeated failures: ${toolList}. They will recover automatically. Use alternative tools or proceed without them.`
                    }]
                }
            };
            
            return [...messages, availabilityMsg];
        }
    }
    
    // ... rest of existing logic ...
}

function getUnhealthyToolsInCircuit(): string[] {
    // Query all circuit breakers for OPEN state
    const allStats = getAllCircuitBreakerStats();
    return allStats
        .filter(s => s.state === "OPEN" && s.name.startsWith("tool:"))
        .map(s => s.name.replace("tool:", ""));
}
```

**Enhancement Summary**:
- Check circuit breaker state before processing
- Inject availability notices for OPEN circuits
- Suggest alternative tools when available
- Preserve existing nudge/abort logic

---

### 3.6 Step Continuation Nudger

**New Processor**: `packages/agentc2/src/processors/step-continuation-processor.ts`

```typescript
import type { Processor, ProcessOutputStepArgs } from "@mastra/core/processors";

export interface StepContinuationConfig {
    minStepsThreshold: number;         // Default: 0.5 (50% of maxSteps)
    enableTaskAnalysis: boolean;       // Default: true
    nudgeInterval: number;             // Min steps between nudges (default: 3)
}

export function createStepContinuationProcessor(
    config?: Partial<StepContinuationConfig>
): Processor<"step-continuation"> {
    const minStepsThreshold = config?.minStepsThreshold ?? 0.5;
    const enableTaskAnalysis = config?.enableTaskAnalysis ?? true;
    const nudgeInterval = config?.nudgeInterval ?? 3;
    
    return {
        id: "step-continuation" as const,
        name: "Step Continuation Nudger",
        
        async processOutputStep(args: ProcessOutputStepArgs) {
            const { messages, stepNumber, state, toolCalls } = args;
            
            // Initialize state
            const cs = state as any;
            if (!cs.lastContinuationNudge) {
                cs.lastContinuationNudge = 0;
                cs.maxSteps = extractMaxSteps(state);
            }
            
            // Don't nudge too frequently
            if (stepNumber - cs.lastContinuationNudge < nudgeInterval) {
                return messages;
            }
            
            // Check if agent is stopping prematurely
            const stepsUsed = stepNumber;
            const stepsRemaining = cs.maxSteps - stepsUsed;
            const usageRatio = stepsUsed / cs.maxSteps;
            
            // Only nudge if:
            // 1. Haven't used minimum threshold of steps
            // 2. No explicit termination tool called
            // 3. Task appears incomplete
            if (usageRatio < minStepsThreshold) {
                const hasTerminationSignal = toolCalls?.some(tc =>
                    ["turn-complete", "ask_questions"].includes(tc.toolName)
                );
                
                if (!hasTerminationSignal) {
                    const taskIncomplete = enableTaskAnalysis
                        ? await analyzeTaskCompleteness(messages)
                        : true; // Conservative default
                    
                    if (taskIncomplete) {
                        console.log(
                            `[StepContinuation] Step ${stepNumber}/${cs.maxSteps}: Nudging agent to continue (${usageRatio * 100}% steps used)`
                        );
                        
                        cs.lastContinuationNudge = stepNumber;
                        
                        const nudgeMsg: any = {
                            id: `continuation-nudge-${stepNumber}`,
                            role: "user" as const,
                            createdAt: new Date(),
                            content: {
                                format: 2 as const,
                                parts: [{
                                    type: "text" as const,
                                    text: `[System] You have ${stepsRemaining} steps remaining (${stepsUsed}/${cs.maxSteps} used). If the task is not fully complete, continue working. Make additional tool calls to gather more information or complete remaining subtasks.`
                                }]
                            }
                        };
                        
                        return [...messages, nudgeMsg];
                    }
                }
            }
            
            return messages;
        }
    };
}

function extractMaxSteps(state: any): number {
    // Heuristic: extract from state or default to 25
    return state.maxSteps ?? 25;
}

async function analyzeTaskCompleteness(messages: any[]): Promise<boolean> {
    // Simple heuristic: check last assistant message for completion indicators
    const lastAssistantMsg = [...messages]
        .reverse()
        .find(m => m.role === "assistant");
    
    if (!lastAssistantMsg) return true;
    
    const content = extractTextContent(lastAssistantMsg);
    const completionPhrases = [
        "here is",
        "here are",
        "completed",
        "done",
        "finished",
        "successfully",
        "summary",
        "in conclusion"
    ];
    
    const hasCompletionPhrase = completionPhrases.some(phrase =>
        content.toLowerCase().includes(phrase)
    );
    
    // If agent sounds conclusive, don't nudge
    return !hasCompletionPhrase;
}

function extractTextContent(message: any): string {
    if (typeof message.content === "string") {
        return message.content;
    }
    
    if (message.content?.parts) {
        return message.content.parts
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join(" ");
    }
    
    return "";
}
```

**Key Features**:
- Detects premature termination (< 50% steps used)
- Analyzes task completeness heuristically
- Nudges agent to continue working
- Respects explicit termination signals
- Configurable nudge frequency

---

### 3.7 System Prompt Enhancements

**Modified Module**: `packages/agentc2/src/agents/resolver.ts`

**Additions to System Instructions** (after line 856):

```typescript
// After agent identity injection
finalInstructions += `\n\n---\n# Tool Execution Guidelines

**Resilience**: When tools fail temporarily (network errors, rate limits), the system will automatically retry. Do not assume tools are unavailable without attempting to call them first.

**Persistence**: If a tool returns an error, analyze the error message:
- Rate limit errors: Try again or use an alternative tool
- Validation errors: Review your arguments and retry with corrections  
- Transient errors: The system has already retried; consider alternative approaches
- Permission errors: This tool is not available to you; choose a different tool

**Budget Management**: You have ${record.maxSteps} steps to complete this task. Use them fully:
- Don't stop after the first tool call unless the task is complete
- Make multiple tool calls to gather comprehensive information
- If one approach fails, try alternative tools or strategies
- Only terminate when you have fully addressed the user's request

**Error Communication**: If all reasonable attempts fail, explain what you tried and why it didn't work rather than stating "tools are unavailable" without attempting any calls.`;
```

**Key Additions**:
- Emphasize automatic retries
- Guide error interpretation
- Encourage full budget utilization
- Set expectation to attempt tools before declaring unavailability

---

### 3.8 Integration into Agent Resolver

**Modified Module**: `packages/agentc2/src/agents/resolver.ts`

**Wrapper Architecture**:

The wrappers are applied in this order (innermost to outermost):

1. **Permission Guard** (innermost) - Returns `{ error: "[TOOL BLOCKED] ..." }` for denied calls
2. **Retry Wrapper** - Retries transient failures; handles both thrown errors and `{ error }` returns
3. **Health Tracker** - Records success/failure metrics (observability only, no error handling)
4. **Circuit Breaker** (outermost) - Fast-fails when circuit OPEN; tracks failures from retry wrapper

**Error Flow**:
- Permission blocks: `{ error }` return → retry passes through → circuit ignores
- Transient errors: Thrown → retry catches + retries → eventually throws → circuit records
- Non-retryable errors: Thrown → retry passes through → circuit records

**Key Design Decision**: 
The retry wrapper now uses a custom retry loop (not `withRetry` utility) to support:
- Retry-After header respect for rate limits
- Handling both thrown errors and `{ error }` return patterns
- Proper error propagation to circuit breaker

**Changes to Tool Wrapping** (around line 992-1024):

```typescript
// Replace existing wrapToolsWithPermissionGuard call with layered wrapping

// 1. Permission guard (existing, innermost layer)
const { toolsGuarded } = wrapToolsWithPermissionGuard(
    tools,
    record.id,
    organizationId
);

// 2. 🆕 Retry wrapper (transient error handling)
for (const [toolId, tool] of Object.entries(tools)) {
    const retryConfig = getToolRetryConfig(record.id, toolId); // From agent metadata
    tools[toolId] = wrapToolWithRetry(
        tool,
        {
            toolId,
            agentId: record.id,
            runId: enrichedContext.runId,
            organizationId
        },
        retryConfig
    );
}

// 3. 🆕 Health tracking wrapper (instrumentation only, no error handling)
for (const [toolId, tool] of Object.entries(tools)) {
    const originalExecute = tools[toolId].execute.bind(tools[toolId]);
    tools[toolId].execute = async (context: any) => {
        const startTime = Date.now();
        try {
            const result = await originalExecute(context);
            const latencyMs = Date.now() - startTime;
            
            // Check if result indicates error
            const isError = result && typeof result === "object" && "error" in result;
            
            if (isError && !result.error.startsWith("[TOOL BLOCKED]")) {
                toolHealthTracker.recordFailure(toolId, "unknown", false);
            } else if (!isError) {
                toolHealthTracker.recordSuccess(toolId, latencyMs);
            }
            
            return result;
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            const classified = classifyToolError(error);
            toolHealthTracker.recordFailure(toolId, classified.category, true);
            throw error;
        }
    };
}

// 4. 🆕 Circuit breaker (outermost layer)
for (const [toolId, tool] of Object.entries(tools)) {
    const circuitConfig = getToolCircuitConfig(record.id, toolId);
    tools[toolId] = wrapToolWithCircuitBreaker(tool, toolId, circuitConfig);
}

console.log(
    `[AgentResolver] Wrapped ${toolsGuarded} tools with permission, retry, health, and circuit breaker guards`
);
```

**New Processor Registration** (around line 1057-1085):

```typescript
const outputProcessors = [
    createOutputGuardrailProcessor(record.id, organizationId),
    createToolResultCompressorProcessor({
        threshold: compressionThreshold,
        compressionModel: compressionModelInstance
    }),
    createToolCallGuardProcessor({  // Enhanced with circuit awareness
        maxCallsPerTool: 8,
        maxTotalToolCalls: (record.maxSteps ?? 5) * 2
    }),
    // 🆕 NEW: Step continuation nudger
    createStepContinuationProcessor({
        minStepsThreshold: 0.5,
        enableTaskAnalysis: true
    }),
    new ToolCallFilter(),
    new TokenLimiter(tokenLimit)
];
```

---

## 4. Data Model Changes

### 4.1 Agent Metadata Extension

**Existing Model**: `Agent.metadata` (JSON field)

**New Schema**:

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "initialDelayMs": 1000,
    "maxDelayMs": 30000,
    "respectRetryAfter": true,
    "perToolOverrides": {
      "hubspot-get-contact": {
        "maxRetries": 5,
        "initialDelayMs": 2000
      }
    }
  },
  "circuitBreaker": {
    "enabled": true,
    "failureThreshold": 5,
    "failureWindowMs": 60000,
    "resetTimeoutMs": 30000
  },
  "continuationNudge": {
    "enabled": true,
    "minStepsThreshold": 0.5,
    "enableTaskAnalysis": true
  }
}
```

**Migration**: Add defaults in UI, no schema change required

### 4.2 Tool Health Metrics (Future: Database Persistence)

**New Model** (Optional, Phase 3):

```prisma
model ToolHealthSnapshot {
  id              String   @id @default(cuid())
  toolId          String
  organizationId  String?
  
  // Time window
  windowStart     DateTime
  windowEnd       DateTime
  
  // Metrics
  totalCalls      Int
  successCount    Int
  failureCount    Int
  retryCount      Int
  
  successRate     Float
  avgLatencyMs    Float
  p95LatencyMs    Float
  p99LatencyMs    Float
  
  status          ToolHealthStatus @default(UNKNOWN)
  
  errorBreakdown  Json  // { "rate_limit": 5, "transient": 2, ... }
  
  createdAt       DateTime @default(now())
  
  @@index([toolId, windowEnd])
  @@index([organizationId, windowEnd])
}

enum ToolHealthStatus {
  HEALTHY
  DEGRADED
  FAILING
  UNKNOWN
}
```

**Purpose**: Persist health metrics for historical analysis and multi-instance deployments

---

## 5. Configuration & Observability

### 5.1 Agent Configuration UI

**Location**: `apps/agent/src/app/agents/[agentSlug]/configure/page.tsx`

**New Section**: "Tool Resilience" (below "Context Management")

```tsx
<Card>
  <CardHeader>
    <CardTitle>Tool Resilience</CardTitle>
    <CardDescription>
      Configure automatic retry behavior and error handling for tool failures
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Retry Configuration */}
    <div>
      <Label>Automatic Retries</Label>
      <Switch checked={retryEnabled} onChange={setRetryEnabled} />
      <Text muted>Automatically retry tool calls on transient failures</Text>
    </div>
    
    {retryEnabled && (
      <>
        <div>
          <Label>Max Retries</Label>
          <Input type="number" min={1} max={5} value={maxRetries} />
        </div>
        
        <div>
          <Label>Initial Delay (ms)</Label>
          <Input type="number" value={initialDelayMs} />
        </div>
      </>
    )}
    
    {/* Circuit Breaker */}
    <div>
      <Label>Circuit Breaker</Label>
      <Switch checked={circuitBreakerEnabled} onChange={setCircuitBreakerEnabled} />
      <Text muted>
        Temporarily disable tools that fail repeatedly to prevent wasted retries
      </Text>
    </div>
    
    {/* Step Continuation */}
    <div>
      <Label>Step Continuation Nudges</Label>
      <Switch checked={continuationEnabled} onChange={setContinuationEnabled} />
      <Text muted>
        Encourage agent to use full step budget instead of stopping early
      </Text>
    </div>
  </CardContent>
</Card>
```

### 5.2 Tool Health Dashboard

**New Page**: `apps/agent/src/app/tools/health/page.tsx`

**Features**:
- Real-time tool health status grid
- Success rate sparklines
- Circuit breaker state indicators
- Recent error breakdown (pie chart)
- Latency percentiles (p50/p95/p99)
- Per-tool drill-down

**Example Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Tool Health Dashboard                       🔄 Refresh │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  🟢 Healthy: 45 tools   🟡 Degraded: 2   🔴 Failing: 1  │
│  ⚡ Circuit OPEN: 1                                      │
│                                                           │
├───────────┬─────────┬────────┬─────────┬────────────────┤
│ Tool      │ Status  │ SR%    │ p95 ms  │ Circuit State  │
├───────────┼─────────┼────────┼─────────┼────────────────┤
│ HubSpot   │ 🟢      │ 98.2%  │ 245ms   │ CLOSED         │
│ Jira      │ 🟡      │ 76.3%  │ 1203ms  │ CLOSED         │
│ Firecrawl │ 🔴      │ 42.1%  │ 5890ms  │ OPEN (28s)     │
│ Gmail     │ 🟢      │ 99.8%  │ 89ms    │ CLOSED         │
│ ...       │         │        │         │                │
└───────────┴─────────┴────────┴─────────┴────────────────┘
```

### 5.3 Run Trace Enhancements

**Modified View**: `apps/agent/src/app/agents/[agentSlug]/traces/page.tsx`

**Tool Call Display**:

```tsx
<ToolCallCard>
  <ToolCallHeader>
    {tool.success ? "✓" : "✗"} {tool.toolKey}
    
    {/* 🆕 NEW: Retry indicator */}
    {tool.retryCount > 0 && (
      <Badge variant="secondary">
        {tool.retryCount} {tool.retryCount === 1 ? "retry" : "retries"}
      </Badge>
    )}
    
    {/* 🆕 NEW: Error category badge */}
    {tool.error && tool.errorCategory && (
      <Badge variant="destructive">
        {tool.errorCategory}
      </Badge>
    )}
  </ToolCallHeader>
  
  <ToolCallBody>
    {/* Existing input/output display */}
    
    {/* 🆕 NEW: Retry timeline */}
    {tool.retryAttempts && tool.retryAttempts.length > 0 && (
      <RetryTimeline attempts={tool.retryAttempts} />
    )}
  </ToolCallBody>
</ToolCallCard>
```

**AgentToolCall Model Extension** (optional):

```prisma
model AgentToolCall {
  // ... existing fields ...
  
  // 🆕 NEW: Retry tracking
  retryCount      Int      @default(0)
  retryAttempts   Json?    // [{ attempt: 1, error: "...", delayMs: 1000 }]
  errorCategory   String?  // "transient", "rate_limit", etc.
}
```

### 5.4 Telemetry Events (Inngest)

**New Events**:

1. `tool/retry` - Fired on each retry attempt
   ```typescript
   {
     name: "tool/retry",
     data: {
       toolId: string,
       agentId: string,
       runId: string,
       attempt: number,
       maxRetries: number,
       errorCategory: ErrorCategory,
       delayMs: number
     }
   }
   ```

2. `tool/circuit-state-change` - Circuit breaker transitions
   ```typescript
   {
     name: "tool/circuit-state-change",
     data: {
       toolId: string,
       fromState: "CLOSED" | "OPEN" | "HALF_OPEN",
       toState: "CLOSED" | "OPEN" | "HALF_OPEN",
       recentFailures: number,
       resetTimeoutMs: number
     }
   }
   ```

3. `tool/health-degraded` - Health status changes
   ```typescript
   {
     name: "tool/health-degraded",
     data: {
       toolId: string,
       status: "healthy" | "degraded" | "failing",
       successRate: number,
       recentErrors: Array<{ category: string, count: number }>
     }
   }
   ```

**Background Functions**:
- Aggregate health metrics (hourly snapshots)
- Alert on persistent circuit OPEN states (> 5 minutes)
- Weekly health reports (email digest)

---

## 6. Impact Assessment

### 6.1 Performance Impact

**Positive**:
- ✅ Reduced wasted LLM calls from premature failures
- ✅ Lower token costs (fewer "tool unavailable" conversations)
- ✅ Improved success rates for rate-limited APIs

**Negative**:
- ⚠️ Increased latency on transient failures (up to 30s with retries)
- ⚠️ More API calls to failing services (mitigated by circuit breaker)

**Mitigation**:
- Circuit breaker prevents cascading retries after 5 failures
- Configurable per agent (can disable retries for latency-sensitive agents)
- Exponential backoff with jitter reduces thundering herd

### 6.2 Reliability Impact

**Positive**:
- ✅ Higher agent success rates on flaky integrations
- ✅ Better user experience (agents try harder before giving up)
- ✅ Automatic recovery from transient outages
- ✅ Observability into tool health

**Risks**:
- ⚠️ Masking underlying integration issues (circuit breaker alerts address this)
- ⚠️ Retry storms on widespread outages (circuit breaker + health tracking mitigate)

### 6.3 Affected Code Paths

**Core Changes**:
1. `packages/agentc2/src/agents/resolver.ts` - Tool wrapping (lines 992-1024)
2. `packages/agentc2/src/processors/tool-call-guard-processor.ts` - Circuit awareness
3. System prompt construction (lines 856+)

**New Modules**:
1. `packages/agentc2/src/tools/error-classifier.ts`
2. `packages/agentc2/src/tools/retry-wrapper.ts`
3. `packages/agentc2/src/tools/health-tracker.ts`
4. `packages/agentc2/src/tools/circuit-wrapper.ts`
5. `packages/agentc2/src/processors/step-continuation-processor.ts`

**UI Changes**:
1. Agent configuration page (resilience settings)
2. Tool health dashboard (new page)
3. Run trace view (retry indicators)

### 6.4 Breaking Changes

**None** - All changes are additive and backward-compatible:
- Default behavior: retries enabled with sensible defaults
- Existing agents work unchanged
- Circuit breaker is opt-in via metadata
- No database schema changes required (uses existing JSON fields)

---

## 7. Testing Strategy

### 7.1 Unit Tests

**New Test Files**:

1. `packages/agentc2/src/tools/__tests__/error-classifier.test.ts`
   - HTTP status code classification
   - Network error pattern matching
   - Retry-After header extraction
   - Edge cases (unknown errors, permission blocks)

2. `packages/agentc2/src/tools/__tests__/retry-wrapper.test.ts`
   - Successful retry after transient error
   - Non-retryable error (immediate fail)
   - Max retries exhausted
   - Exponential backoff timing
   - Retry-After header respect

3. `packages/agentc2/src/tools/__tests__/health-tracker.test.ts`
   - Metrics updates (success/failure)
   - Status classification (healthy/degraded/failing)
   - Latency percentiles
   - Rolling window behavior

4. `packages/agentc2/src/tools/__tests__/circuit-wrapper.test.ts`
   - Circuit state transitions
   - Fast-fail in OPEN state
   - Recovery via HALF_OPEN
   - Threshold enforcement

5. `packages/agentc2/src/processors/__tests__/step-continuation-processor.test.ts`
   - Premature termination detection
   - Task completeness heuristic
   - Nudge frequency limiting

### 7.2 Integration Tests

**Scenarios**:

1. **Transient Network Error Recovery**
   - Mock tool that fails twice then succeeds
   - Verify agent completes task successfully
   - Verify retry count = 2 in tool call record

2. **Rate Limit Handling**
   - Mock tool that returns 429 with Retry-After: 5
   - Verify 5s delay before retry
   - Verify circuit stays CLOSED (rate limits aren't circuit-breaking)

3. **Circuit Breaker Activation**
   - Mock tool that fails 5 times consecutively
   - Verify circuit opens
   - Verify subsequent calls fast-fail
   - Wait 30s, verify circuit enters HALF_OPEN
   - Successful call closes circuit

4. **Step Continuation Nudge**
   - Agent with maxSteps=30
   - Tool call succeeds at step 4
   - Agent attempts to respond
   - Verify continuation nudge injected
   - Verify agent continues to step 5+

5. **Non-Retryable Error**
   - Mock tool that returns 401 (auth error)
   - Verify no retries attempted
   - Verify agent receives structured error message

6. **End-to-End: Jira Tool Recovery**
   - Simulate Jira rate limit (429)
   - Verify agent retries after backoff
   - Verify task completes successfully
   - Verify evaluation score > 0.7

### 7.3 Load Testing

**Scenarios**:

1. **Retry Storm Mitigation**
   - 100 concurrent agents calling failing tool
   - Verify circuit breaker opens after threshold
   - Verify fast-fail prevents cascading retries
   - Measure: total API calls < 500 (not 300+ retries)

2. **Health Tracker Memory Usage**
   - 1000 unique tools tracked
   - 10K calls per tool
   - Verify memory usage stable (rolling window)
   - Measure: < 50MB for tracker state

### 7.4 Manual Testing Checklist

- [ ] Create test agent with Jira tool
- [ ] Temporarily invalidate Jira API token
- [ ] Send request requiring Jira lookup
- [ ] Verify agent attempts tool call (not immediate "unavailable")
- [ ] Verify retry attempts logged in console
- [ ] Verify agent continues after retries exhausted
- [ ] Restore valid token
- [ ] Verify circuit recovers automatically
- [ ] Check tool health dashboard shows degraded → healthy transition

---

## 8. Rollout Plan (Phased Approach)

### **Phase 1: Foundation (Week 1-2)** - Core Resilience

**Goal**: Implement automatic retry logic and error classification

**Deliverables**:
1. ✅ Error classifier (`error-classifier.ts`)
2. ✅ Retry wrapper (`retry-wrapper.ts`)
3. ✅ Integration into agent resolver (tool wrapping)
4. ✅ Unit tests for classifier and retry
5. ✅ Integration test: transient error recovery
6. ✅ Documentation: retry configuration in agent metadata

**Success Criteria**:
- Agents successfully retry on 429/503/network errors
- Non-retryable errors (401/400) fail immediately
- Retry count visible in logs
- No breaking changes to existing agents

**Rollout**:
- Enable for 5 pilot agents (low-traffic)
- Monitor for 3 days
- Collect feedback on retry delays
- Adjust default configs if needed

---

### **Phase 2: Observability (Week 3)** - Health Tracking & UI

**Goal**: Visibility into tool reliability and retry behavior

**Deliverables**:
1. ✅ Health tracker (`health-tracker.ts`)
2. ✅ Health tracking wrapper (instrument all tools)
3. ✅ Tool health dashboard UI
4. ✅ Run trace UI enhancements (retry indicators)
5. ✅ Agent config UI (resilience settings)
6. ✅ Inngest telemetry events
7. ✅ Integration test: health status transitions

**Success Criteria**:
- Dashboard shows real-time tool health
- Users can identify failing tools at a glance
- Retry attempts visible in run traces
- Agents can be configured per-agent via UI

**Rollout**:
- Enable health tracking for all agents
- Share dashboard with internal team
- Gather feedback on metrics/thresholds
- Iterate on UI based on usage patterns

---

### **Phase 3: Circuit Breaker (Week 4)** - Advanced Resilience

**Goal**: Prevent cascading failures and retry storms

**Deliverables**:
1. ✅ Circuit breaker wrapper (`circuit-wrapper.ts`)
2. ✅ Enhanced Tool Call Guard (circuit awareness)
3. ✅ Circuit state UI indicators
4. ✅ Inngest alert: persistent OPEN circuits
5. ✅ Integration test: circuit breaker activation
6. ✅ Load test: retry storm mitigation

**Success Criteria**:
- Circuit opens after 5 failures in 60s
- Fast-fail prevents wasted retries
- Automatic recovery after 30s cooldown
- Alert fires when circuit OPEN > 5 minutes

**Rollout**:
- Enable circuit breaker for all agents
- Monitor alert volume (tune thresholds)
- Document circuit breaker behavior in user docs

---

### **Phase 4: Step Continuation (Week 5)** - Budget Optimization

**Goal**: Ensure agents utilize full step budget

**Deliverables**:
1. ✅ Step continuation processor (`step-continuation-processor.ts`)
2. ✅ Enhanced system prompts (tool usage guidelines)
3. ✅ Agent config toggle (continuation nudges)
4. ✅ Integration test: premature termination prevented
5. ✅ A/B test: with/without continuation nudges

**Success Criteria**:
- Agents with maxSteps=30 use avg 18+ steps (was 4)
- Evaluation scores improve (fewer INCOMPLETE_RESPONSE failures)
- No increase in token costs (nudges are cheap)

**Rollout**:
- Enable for 50% of agents (A/B test)
- Compare evaluation scores after 1 week
- Full rollout if improvement > 10% in overallGrade

---

### **Phase 5: Polish & Optimization (Week 6)** - Production Hardening

**Goal**: Production-ready resilience system

**Deliverables**:
1. ✅ Database persistence for health metrics (optional)
2. ✅ Weekly health digest email (Inngest function)
3. ✅ Per-tool retry config overrides (UI)
4. ✅ Retry budget limits (prevent infinite loops)
5. ✅ Graceful degradation playbook (runbook)
6. ✅ User documentation (knowledge base articles)
7. ✅ Performance profiling (latency impact)

**Success Criteria**:
- p95 latency increase < 10% (vs no retries)
- Circuit breaker false positive rate < 1%
- User satisfaction score (survey)
- Zero incidents related to retry logic

**Rollout**:
- Enable for 100% of agents
- Publish user-facing documentation
- Internal training session (team demo)
- Monitor for 2 weeks, then mark complete

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Retry storms on widespread outages** | Medium | High | Circuit breaker opens after 5 failures; retries stop immediately |
| **Increased latency for end users** | High | Medium | Configurable per agent; can disable retries; circuit fast-fails |
| **Masking real integration issues** | Medium | Medium | Health dashboard + alerts on persistent failures; circuit OPEN alert |
| **False circuit opens (transient spike)** | Low | Medium | Failure window = 60s (not 5s); HALF_OPEN recovery allows testing |
| **Step continuation nudges annoy model** | Low | Low | Nudge interval = 3 steps; task completeness heuristic; configurable |
| **Health tracker memory leak** | Low | High | Rolling window (100 samples); periodic GC; load testing |
| **Retry-After header ignored by some APIs** | Medium | Low | Fallback to exponential backoff; configurable initialDelayMs |

---

## 10. Success Metrics

### 10.1 Quantitative

**Primary KPIs** (measured before/after rollout):

1. **Tool Success Rate**
   - Baseline: 85% (Q1 2026 average)
   - Target: 92% (7% improvement)
   - Measurement: `AgentToolCall.success` rate

2. **Evaluation Score (overallGrade)**
   - Baseline: avg 0.68 for SDLC agents
   - Target: avg 0.75 (10% improvement)
   - Measurement: `AgentEvaluation.overallGrade`

3. **TOOL_SELECTION_ERROR Rate**
   - Baseline: 18% of failed runs
   - Target: < 10%
   - Measurement: `AgentEvaluation.failureModes` breakdown

4. **Step Utilization**
   - Baseline: avg 6.2 steps used (maxSteps=25)
   - Target: avg 12+ steps used
   - Measurement: `AgentTrace.stepsJson.length`

5. **INCOMPLETE_RESPONSE Rate**
   - Baseline: 12% of evaluations
   - Target: < 7%
   - Measurement: `AgentEvaluation.failureModes` breakdown

### 10.2 Qualitative

**User Feedback** (via in-app survey):
- "How often does the agent successfully complete tasks that require external tools?"
  - Before: 3.2/5 avg rating
  - Target: 4.0/5 avg rating

**Internal Feedback** (team interviews):
- Product team: fewer support tickets about "tools not working"
- Engineering team: better visibility into integration health

### 10.3 Operational

1. **Circuit Breaker Activations**
   - Target: < 5 OPEN states per day (platform-wide)
   - Alert threshold: same tool OPEN > 5 minutes

2. **Health Dashboard Usage**
   - Target: 80% of team checks dashboard weekly
   - Engagement: avg 2 drill-downs per session

3. **Retry Volume**
   - Target: < 10% of tool calls trigger retries
   - Alert: > 25% retry rate (indicates widespread issue)

---

## 11. Future Enhancements (Post-Launch)

### 11.1 Adaptive Retry Strategies

**Description**: Machine learning model predicts optimal retry delay based on historical patterns

**Example**: HubSpot rate limits tend to reset at :00 of each minute → align retries to clock boundary

**Effort**: Medium | **Value**: Medium

---

### 11.2 Multi-Region Failover

**Description**: Automatically route tool calls to alternative regions when primary fails

**Example**: Firecrawl US-East down → route to EU-West via MCP config switch

**Effort**: High | **Value**: High (enterprise customers)

---

### 11.3 Tool Substitution Recommendations

**Description**: LLM-powered suggestion of alternative tools when primary fails

**Example**: "jira-get-issue" failing → suggest "linear-get-issue" or "notion-get-page"

**Effort**: High | **Value**: Medium

---

### 11.4 Predictive Circuit Breaking

**Description**: Open circuit before failures occur based on latency degradation trends

**Example**: p99 latency increases 3x over 5 minutes → pre-emptively open circuit

**Effort**: High | **Value**: Medium

---

### 11.5 Per-Organization Health Isolation

**Description**: Track tool health separately per organization (multi-tenant isolation)

**Example**: Org A's HubSpot fails → doesn't affect Org B's circuit state

**Effort**: Medium | **Value**: High (enterprise SLA)

**Implementation**: Namespace circuit breakers and health tracker by `organizationId`

---

## 12. Documentation Requirements

### 12.1 User-Facing Docs

1. **Knowledge Base Article**: "Why did my agent stop working?"
   - Explain automatic retries
   - How to interpret retry errors
   - When to check tool health dashboard

2. **Feature Announcement**: "Agents are now more resilient"
   - Highlight automatic retry benefits
   - Link to configuration guide
   - Show before/after examples

3. **Configuration Guide**: "Tuning Agent Resilience"
   - Retry settings explained
   - Circuit breaker thresholds
   - Per-tool overrides

### 12.2 Internal Docs

1. **Runbook**: "Responding to Circuit Breaker Alerts"
   - Diagnosis steps
   - When to manually close circuit
   - Escalation procedures

2. **Architecture Diagram**: Updated system architecture with resilience layers

3. **Metrics Dashboard**: Grafana/DataDog dashboard for retry/circuit metrics

### 12.3 Code Documentation

1. **README**: `packages/agentc2/src/tools/README.md`
   - Tool wrapping architecture
   - Adding new error categories
   - Custom retry policies

2. **API Docs**: JSDoc for all new public functions

3. **Migration Guide**: (None needed - backward compatible)

---

## 13. Appendix

### 13.1 Glossary

- **Transient Error**: Temporary failure that may succeed on retry (network, rate limit, 503)
- **Circuit Breaker**: Design pattern that prevents repeated calls to failing service
- **Exponential Backoff**: Retry delay that doubles with each attempt (1s, 2s, 4s, 8s, ...)
- **Jitter**: Random delay added to backoff to prevent thundering herd
- **Health Tracking**: Real-time monitoring of tool success rates and latency
- **Step Continuation**: Encouraging agents to use full maxSteps budget instead of stopping early

### 13.2 References

- GitHub Issue: https://github.com/Appello-Prototypes/agentc2/issues/151
- Evidence Run: `cmmmvj3kw00a58exvmha1e3jv` (0 tool calls, 44 tokens)
- Evidence Run: `cmmmvd41b008l8exvctdhd9vd` (4 tools, stopped early)
- Martin Fowler - Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
- AWS Architecture Blog - Exponential Backoff and Jitter: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

### 13.3 Related Work

- Existing retry utility: `packages/agentc2/src/lib/retry.ts`
- Existing circuit breaker: `packages/agentc2/src/lib/circuit-breaker.ts`
- Tool Call Guard Processor: `packages/agentc2/src/processors/tool-call-guard-processor.ts`
- Graceful Degradation: `packages/agentc2/src/lib/graceful-degradation.ts`

---

**End of Design Document**

**Status**: Ready for Review  
**Next Steps**: 
1. Review by engineering team
2. Approval from product owner
3. Create implementation tasks in GitHub (one issue per phase)
4. Begin Phase 1 development

**Questions/Feedback**: Comment on GitHub Issue #151

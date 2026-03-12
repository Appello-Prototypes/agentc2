# Technical Design: Agent Tool Call Retry Logic

**GitHub Issue**: https://github.com/Appello-Prototypes/agentc2/issues/151  
**Priority**: Medium | **Scope**: Medium  
**Created**: 2026-03-12  
**Status**: Design Phase

---

## Executive Summary

When integration tools fail due to transient errors (network issues, timeouts, rate limits, temporary service unavailability), agents currently fail immediately without retrying. This results in:

1. **TOOL_SELECTION_ERROR** classifications where agents skip tool calls entirely
2. **Premature termination** where agents stop after a single failure despite having remaining steps
3. **Poor user experience** where temporary infrastructure issues cause complete task failures

This design proposes a **multi-layered retry system** that operates at three levels:
- **Runtime-level**: Automatic transparent retries for transient errors
- **Agent-level**: Enhanced prompting to encourage tool usage and continuation
- **Guardrail-level**: Minimum tool call thresholds for multi-step tasks

---

## Current Architecture Analysis

### Agent Execution Flow

```
User Request
    ↓
AgentResolver.resolve(slug, context)
    ↓
Load Agent from Database (workspaceId-scoped)
    ↓
Attach Tools (registry + MCP)
    ↓
Wrap Tools with Permission Guards
    ↓
Attach Processors (input + output)
    ↓
agent.generate(input, { maxSteps })
    ↓
[Mastra Core Agent Loop]
    ├─ Step 1: processInputStep (all input processors)
    │   ├─ Input Guardrail Processor
    │   ├─ Context Window Processor (sliding window + compaction)
    │   ├─ Step Anchor Processor (progress tracking)
    │   └─ Token Limiter
    ├─ Step 2: LLM generates tool calls
    ├─ Step 3: Execute tools (wrapped execute functions)
    │   ├─ Permission check (checkToolPermission)
    │   ├─ Egress check (checkEgressPermission)
    │   └─ Original execute() → returns result or error
    ├─ Step 4: processOutputStep (all output processors)
    │   ├─ Output Guardrail Processor (abort with retry if blocked)
    │   ├─ Tool Result Compressor Processor
    │   ├─ Tool Call Guard Processor (budgets, duplicates, empty results)
    │   ├─ Tool Call Filter
    │   └─ Token Limiter
    ├─ Step 5: Repeat until finished or maxSteps
    ↓
Return Response
    ↓
Record Run + Tool Calls + Evaluation
    ↓
Emit run/completed event → Inngest
    ↓
Evaluate (Tier 1 Heuristic → Tier 2 Auditor if needed)
```

### Tool Execution Architecture

**Native Tools** (from `toolRegistry`):
```typescript
// Location: packages/agentc2/src/agents/resolver.ts:993-1024
tool.execute = async (context: any) => {
    // 1. Permission check (checkToolPermission)
    // 2. Egress check (checkEgressPermission)
    // 3. Original execute()
    return originalExecute(context);
}
```

**MCP Tools** (from external servers):
```typescript
// Location: packages/agentc2/src/mcp/client.ts:4908-5075
async function executeMcpTool(toolName, parameters, options) {
    try {
        // 1. Tool lookup (with name format fallbacks)
        // 2. ACL enforcement
        // 3. Parameter validation
        // 4. Execute with 60s timeout
        return { success: true, result }
    } catch (error) {
        return { success: false, error: error.message }
    }
}
```

### Current Error Handling

| Layer | Current Behavior | Limitations |
|-------|-----------------|-------------|
| **Tool Execution** | Catch errors, return `{ success: false, error: "..." }` | No retry, errors passed to agent |
| **Permission Guards** | Return `{ error: "[TOOL BLOCKED] ..." }` if denied | Fail-closed, no retry |
| **Processors** | Nudge messages injected after failures | Agent must self-correct, no automatic retry |
| **Agent Loop** | Continues until maxSteps or abort | No differentiation between retryable/fatal errors |
| **Evaluation** | Post-hoc TOOL_SELECTION_ERROR detection | Reactive, not preventive |

### Existing Retry Infrastructure

The codebase already has a **retry utility** (`packages/agentc2/src/lib/retry.ts`):

```typescript
// Already detects transient errors:
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

**Current Usage**:
- MCP server initialization (1 retry when loading tools)
- Individual tools (Gmail, Google Drive OAuth refresh)
- **NOT used for general tool execution**

---

## Problem Statement

### Root Causes

#### 1. **No Transparent Retry Layer**

When `executeMcpTool()` or a native tool throws an error, it's caught and returned to the agent as a string error message. The agent must:
- Parse the error
- Decide if it's retryable
- Attempt the same call again (consuming another step)

This is **cognitively expensive** and **unreliable** - GPT-4o often chooses to abandon the task rather than retry.

#### 2. **Agent Preemptive Avoidance**

Evidence from Run `cmmmvj3kw00a58exvmha1e3jv`:
- Given 30 maxSteps
- Made ZERO tool calls
- Used 44 completion tokens in 2s
- Response: "Jira tools are currently unavailable"

The agent **never attempted** a tool call - it assumed unavailability based on context or prior failures. Possible causes:
- Recent context includes tool failures
- System messages or instructions mention unavailability
- Agent learned to avoid failed tools within the same conversation

#### 3. **Premature Termination**

Evidence from Run `cmmmvd41b008l8exvctdhd9vd`:
- Made 4 successful tool calls
- Got rich data back
- Stopped after 137 completion tokens
- Had 26 remaining steps

The agent **stopped early** despite:
- Not completing the multi-step task
- Having ample budget remaining
- Successfully using tools

#### 4. **Transient vs Fatal Error Confusion**

Current error handling treats all errors equally:
- `ECONNREFUSED` (transient) → same as `[TOOL BLOCKED] Permission denied` (fatal)
- `429 Rate Limited` (transient) → same as `Tool not found` (configuration error)
- `503 Service Unavailable` (transient) → same as `Invalid parameters` (logic error)

Agents cannot distinguish and often give up on retryable errors.

---

## Proposed Solution Architecture

### Multi-Layered Approach

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: TRANSPARENT RUNTIME RETRIES                           │
│ Purpose: Automatic retry for transient errors                  │
│ Location: Tool execution wrapper                               │
│ Visibility: Transparent to agent (no step consumption)         │
│ Components: tool-retry-wrapper.ts, enhanced executeMcpTool()   │
│ Timing: Executes DURING tool call, before result returned      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: AGENT-VISIBLE RETRY GUIDANCE                          │
│ Purpose: Enhanced prompting for continuation                   │
│ Location: System instructions + processors                     │
│ Visibility: Agent sees failure context + retry suggestion      │
│ Components: tool-availability-processor.ts, system prompts     │
│ Timing: Executes BEFORE each LLM call, modifies system msgs    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: MINIMUM TOOL CALL GUARDRAILS                          │
│ Purpose: Prevent zero-tool-call responses                      │
│ Location: New MinimumToolCallProcessor                         │
│ Visibility: Hard failure if agent makes no tool attempts       │
│ Components: minimum-tool-call-processor.ts                     │
│ Timing: Executes AFTER LLM response, before finishing          │
└─────────────────────────────────────────────────────────────────┘

Example Flow:

Step 1: Agent calls hubspot_get-user-details
    → Permission check: ✅ PASS
    → Execute with retry wrapper:
        Attempt 1: ECONNREFUSED → wait 500ms
        Attempt 2: 503 Service Unavailable → wait 1200ms
        Attempt 3: ✅ SUCCESS
    → Agent receives: { success: true, result: {...} }
    → Agent consumes 1 step (retries transparent)
    → Database records: retryCount=2, wasRetried=true

Step 2: Tool Availability Processor runs (processInputStep)
    → Detects: 1 successful tool call
    → No encouragement needed
    → Continues

Step 3: Agent generates response
    → Output processors run:
        → Tool Result Compressor: ✅ PASS
        → Tool Call Guard: ✅ PASS
        → Minimum Tool Call: ✅ PASS (1 tool call made)
    → Response returned to user
```

---

## Detailed Component Design

### Component 1: Tool Retry Wrapper

**New File**: `packages/agentc2/src/security/tool-retry-wrapper.ts`

**Purpose**: Wrap tool execution functions with automatic retry logic for transient errors.

**Key Features**:
- Integrates existing `withRetry()` utility
- Configurable retry policy per tool type
- Transparent to agent (no step consumption)
- Detailed logging for observability
- Error classification (transient vs fatal)

**Interface**:

```typescript
export interface ToolRetryConfig {
    /** Max retry attempts for transient errors. Default: 2 */
    maxRetries?: number;
    /** Initial delay in ms. Default: 500 */
    initialDelayMs?: number;
    /** Max delay in ms. Default: 5000 */
    maxDelayMs?: number;
    /** Whether to apply jitter. Default: true */
    jitter?: boolean;
    /** Custom error classifier. Default: defaultIsRetryable */
    isRetryable?: (error: unknown) => boolean;
    /** Callback on retry attempt */
    onRetry?: (error: unknown, attempt: number, toolName: string) => void;
}

export interface ToolRetryResult {
    toolsWrapped: number;
    retryPolicies: Record<string, ToolRetryConfig>;
}

/**
 * Wrap tools with automatic retry logic for transient failures.
 * 
 * - Native tools: wrapped around original execute()
 * - MCP tools: wrapped within executeMcpTool()
 * - Retries are transparent (don't consume agent steps)
 * - Non-retryable errors fail immediately
 */
export function wrapToolsWithRetry(
    tools: Record<string, any>,
    config?: ToolRetryConfig
): ToolRetryResult;
```

**Error Classification**:

```typescript
export function isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        
        // Network errors (retryable)
        if (msg.includes("econnreset")) return true;
        if (msg.includes("econnrefused")) return true;
        if (msg.includes("etimedout")) return true;
        if (msg.includes("timeout")) return true;
        if (msg.includes("socket hang up")) return true;
        if (msg.includes("epipe")) return true;
        if (msg.includes("network error")) return true;
        
        // MCP server errors (retryable)
        if (msg.includes("mcp server not responding")) return true;
        if (msg.includes("server connection lost")) return true;
        
        // External service errors (retryable)
        if (msg.includes("service unavailable")) return true;
        if (msg.includes("temporarily unavailable")) return true;
    }
    
    // HTTP status codes
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 429) return true;  // Rate limited
        if (status === 502) return true;  // Bad gateway
        if (status === 503) return true;  // Service unavailable
        if (status === 504) return true;  // Gateway timeout
    }
    
    // Fatal errors (NOT retryable)
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("[tool blocked]")) return false;
        if (msg.includes("permission denied")) return false;
        if (msg.includes("invalid parameters")) return false;
        if (msg.includes("tool not found")) return false;
        if (msg.includes("insufficient access")) return false;
    }
    
    return false;
}
```

**Integration Points**:

1. **Native Tools** - Wrap in `AgentResolver.resolve()`:
```typescript
// After wrapToolsWithPermissionGuard():
const retryResult = wrapToolsWithRetry(tools, {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    onRetry: (error, attempt, toolName) => {
        console.log(`[ToolRetry] ${toolName} failed, retry ${attempt}/2:`, error);
        // Optionally emit telemetry event
    }
});
```

2. **MCP Tools** - Wrap inside `executeMcpTool()`:
```typescript
// Replace direct tool.execute() call with:
const result = await withRetry(
    () => (tool as any).execute({ context: parameters }),
    {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        isRetryable: isTransientError,
        onRetry: (error, attempt) => {
            console.log(`[MCP] ${toolName} retry ${attempt}/2:`, error);
        }
    }
);
```

**Observability**:
- Console logs for each retry attempt
- Extend `AgentToolCall` model to track retry metadata:
  ```prisma
  model AgentToolCall {
      // ... existing fields
      retryCount Int @default(0)
      retryHistory Json? // [{ attempt: 1, error: "...", delayMs: 500 }, ...]
  }
  ```

---

### Component 2: Tool Availability Encouragement Processor

**New File**: `packages/agentc2/src/processors/tool-availability-processor.ts`

**Purpose**: Inject proactive guidance to encourage agents to attempt tool calls rather than assuming unavailability.

**Key Features**:
- Runs as an **input processor** before each step
- Detects patterns of tool avoidance
- Injects counter-nudges encouraging tool usage
- Tracks tool availability state across conversation

**Interface**:

```typescript
export interface ToolAvailabilityConfig {
    /** Enable encouragement messages. Default: true */
    enabled?: boolean;
    /** Inject encouragement if agent hasn't called tools in N steps. Default: 3 */
    noToolCallThreshold?: number;
    /** Track failed tools and inject availability status. Default: true */
    trackAvailability?: boolean;
}

/**
 * Processor that encourages agents to attempt tool calls
 * rather than assuming unavailability.
 */
export function createToolAvailabilityProcessor(
    config?: ToolAvailabilityConfig
): Processor<"tool-availability">;
```

**State Tracking**:

```typescript
interface AvailabilityState {
    /** Steps since last tool call */
    stepsSinceToolCall: number;
    
    /** Tools that failed recently: { toolName: { failures: count, lastAttempt: step } } */
    recentFailures: Record<string, { failures: number; lastAttempt: number }>;
    
    /** Tools that succeeded recently */
    recentSuccesses: Set<string>;
    
    /** Whether encouragement was injected */
    encouragementInjected: boolean;
}
```

**Injection Logic**:

```typescript
async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
    const { stepNumber, messages, systemMessages, state } = args;
    const as = state as unknown as AvailabilityState;
    
    // Initialize state
    if (!as.stepsSinceToolCall) {
        as.stepsSinceToolCall = 0;
        as.recentFailures = {};
        as.recentSuccesses = new Set();
        as.encouragementInjected = false;
    }
    
    // Track tool calls from previous step
    const lastStepHadToolCalls = detectToolCallsInMessages(messages);
    if (lastStepHadToolCalls) {
        as.stepsSinceToolCall = 0;
    } else {
        as.stepsSinceToolCall++;
    }
    
    // If agent is avoiding tools, inject encouragement
    if (
        as.stepsSinceToolCall >= config.noToolCallThreshold &&
        !as.encouragementInjected &&
        stepNumber > 1  // Not on first step
    ) {
        console.log(
            `[ToolAvailability] Step ${stepNumber}: No tool calls for ${as.stepsSinceToolCall} steps, injecting encouragement`
        );
        
        const encouragementMsg = buildEncouragementMessage(as, systemMessages);
        as.encouragementInjected = true;
        
        return {
            systemMessages: [...systemMessages, {
                role: "system" as const,
                content: encouragementMsg
            }]
        };
    }
    
    return undefined;
}
```

**Encouragement Message Template**:

```
[System] Tool Availability Notice:

You have not used any tools for the last {N} steps. However, tools ARE available and should be used to complete your task.

Common mistakes:
- Assuming tools are unavailable without trying
- Giving up after a single transient error
- Stopping early when the task requires multiple steps

Please:
1. Attempt the necessary tool calls to complete your task
2. If a tool fails with a network/timeout error, the system will automatically retry
3. Only inform the user of tool unavailability if you receive a "[TOOL BLOCKED]" or "Tool not found" error after attempting

Continue with your task and use available tools.
```

---

### Component 3: Minimum Tool Call Guardrail

**New File**: `packages/agentc2/src/processors/minimum-tool-call-processor.ts`

**Purpose**: Prevent agents from completing multi-step tasks without making ANY tool calls.

**Key Features**:
- Runs as an **output processor** on processOutputResult
- Only enforces for agents with high maxSteps (≥10)
- Only enforces if task description implies tool usage needed
- Aborts with retry if agent tries to finish without tools

**Interface**:

```typescript
export interface MinimumToolCallConfig {
    /** Enable minimum tool call enforcement. Default: true */
    enabled?: boolean;
    /** Minimum tools required for enforcement. Default: 1 */
    minToolCalls?: number;
    /** Only enforce for agents with maxSteps >= threshold. Default: 10 */
    maxStepsThreshold?: number;
    /** Keywords that indicate tool usage is needed. Default: common action verbs */
    taskKeywords?: string[];
}

/**
 * Processor that prevents agents from finishing multi-step tasks
 * without making any tool calls.
 */
export function createMinimumToolCallProcessor(
    config?: MinimumToolCallConfig
): Processor<"minimum-tool-call">;
```

**Implementation**:

```typescript
async processOutputResult({ messages, state, abort, retryCount }) {
    const mtState = state as unknown as MinimumToolCallState;
    
    // Initialize state
    if (!mtState.totalToolCalls) {
        mtState.totalToolCalls = 0;
        mtState.taskRequiresTools = detectIfTaskRequiresTools(messages);
    }
    
    // Count tool calls in this conversation
    for (const msg of messages) {
        if (msg.role === "assistant" && hasToolCalls(msg)) {
            mtState.totalToolCalls++;
        }
    }
    
    // Check if agent is trying to finish
    const lastMsg = messages[messages.length - 1];
    const isFinishing = lastMsg.role === "assistant" && !hasToolCalls(lastMsg);
    
    // Enforce minimum only if:
    // 1. Agent is trying to finish
    // 2. Task requires tools (based on keywords)
    // 3. No tool calls were made
    // 4. Not already retried this check
    if (
        isFinishing &&
        mtState.taskRequiresTools &&
        mtState.totalToolCalls === 0 &&
        retryCount < 1
    ) {
        console.warn(
            `[MinimumToolCall] Agent attempting to finish multi-step task without ANY tool calls. Forcing retry.`
        );
        
        abort(
            `[System] You must use at least one tool to complete this task. ` +
            `Please attempt the necessary tool calls rather than assuming tools are unavailable.`,
            { retry: true }
        );
    }
    
    return messages;
}
```

**Task Detection Heuristic**:

```typescript
function detectIfTaskRequiresTools(messages: Array<any>): boolean {
    const firstUserMsg = messages.find(m => m.role === "user");
    if (!firstUserMsg) return false;
    
    const text = extractMessageText(firstUserMsg).toLowerCase();
    
    // Action verbs that typically require tools
    const actionKeywords = [
        "search", "find", "lookup", "get", "fetch", "retrieve",
        "create", "update", "delete", "modify", "add", "remove",
        "send", "post", "publish", "schedule", "book",
        "analyze", "summarize", "extract", "process",
        "list", "show", "display", "view"
    ];
    
    return actionKeywords.some(keyword => text.includes(keyword));
}
```

---

### Component 4: Enhanced Step Continuation Prompting

**Modified File**: `packages/agentc2/src/processors/step-anchor.ts`

**Changes**: Enhance the step anchor processor to be more aggressive about encouraging continuation when:
- Steps remaining > 50%
- Tools have been successfully called
- Multi-step task detected

**Enhanced Anchor Message**:

```typescript
// Current (step-anchor.ts:98-104):
if (isFinalStep) {
    anchorText = [
        "",
        `[Progress - FINAL STEP ${currentStep}/${maxSteps}]`,
        `This is your last step. Provide your final answer now.`,
        `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
        `Summarize your findings and respond to the user.`
    ].join("\n");
}

// Enhanced:
if (isFinalStep) {
    anchorText = [
        "",
        `[Progress - FINAL STEP ${currentStep}/${maxSteps}]`,
        `This is your last step. Provide your final answer now.`,
        `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
        `If your task is not fully complete, explain what was accomplished and what remains.`
    ].join("\n");
} else if (currentStep >= maxSteps * 0.5 && toolCallsMade > 0) {
    // Mid-task encouragement
    anchorText = [
        "",
        `[Progress - Step ${currentStep}/${maxSteps}]`,
        `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
        `You have ${maxSteps - currentStep} steps remaining. Continue working toward task completion.`,
        `If you've gathered necessary data, proceed to the next phase of the task.`
    ].join("\n");
}
```

---

### Component 5: Database Schema Extensions

**Modified File**: `packages/database/prisma/schema.prisma`

**Changes**: Track retry metadata for observability and analysis.

```prisma
model AgentToolCall {
    id          String    @id @default(cuid())
    runId       String?
    run         AgentRun? @relation(fields: [runId], references: [id], onDelete: Cascade)
    turnId      String?
    turn        AgentRunTurn? @relation(fields: [turnId], references: [id], onDelete: Cascade)
    traceId     String?
    trace       AgentTrace? @relation(fields: [traceId], references: [id], onDelete: Cascade)
    toolKey     String
    toolSource  String    // "registry" | "mcp:server" | "skill:slug"
    inputJson   Json
    outputJson  Json?
    success     Boolean   @default(true)
    error       String?   @db.Text
    durationMs  Int?
    timestamp   DateTime  @default(now())
    
    // NEW: Retry tracking
    retryCount     Int  @default(0)       // Number of retry attempts made
    retryHistoryJson Json?                 // Array of retry attempts with errors and delays
    wasRetried     Boolean @default(false) // Quick flag for queries
    finalError     String? @db.Text        // Error after all retries exhausted

    @@index([runId, timestamp])
    @@index([turnId, timestamp])
    @@index([traceId, timestamp])
    @@index([toolKey, timestamp])
    @@index([success])
    @@index([wasRetried])  // NEW: Index for retry analytics
    @@map("agent_tool_call")
}

// NEW: Retry telemetry for monitoring
model ToolRetryEvent {
    id             String   @id @default(cuid())
    toolKey        String
    toolSource     String   // "registry" | "mcp:server" | "skill:slug"
    attemptNumber  Int      // 1, 2, 3
    errorMessage   String   @db.Text
    errorType      String   // "transient" | "fatal"
    delayMs        Int
    succeeded      Boolean  // Did this retry succeed?
    organizationId String?
    agentId        String?
    runId          String?
    timestamp      DateTime @default(now())
    
    @@index([toolKey, timestamp])
    @@index([errorType, timestamp])
    @@index([organizationId, timestamp])
    @@index([succeeded])
    @@map("tool_retry_event")
}
```

**Migration Strategy**:
1. Add new fields with defaults (non-breaking)
2. Backfill existing records (retryCount=0, wasRetried=false)
3. Deploy new code with retry logic
4. Monitor new fields populate

---

### Component 6: Agent Configuration Extensions

**Modified File**: `packages/agentc2/src/schemas/agent.ts`

**Add to `contextConfigSchema`**:

```typescript
export const contextConfigSchema = z
    .object({
        maxContextTokens: z.number().int().min(1000).max(200000).optional(),
        toolResultCompression: z.object({ /* ... */ }).optional(),
        providerContextEditing: z.object({ /* ... */ }).optional(),
        
        // NEW: Tool retry configuration
        toolRetryPolicy: z.object({
            enabled: z.boolean().optional(),
            maxRetries: z.number().int().min(0).max(5).optional(),
            initialDelayMs: z.number().int().min(100).max(5000).optional(),
            maxDelayMs: z.number().int().min(1000).max(30000).optional(),
            retryableErrorPatterns: z.array(z.string()).optional()
        }).optional(),
        
        // NEW: Minimum tool call enforcement
        minToolCalls: z.object({
            enabled: z.boolean().optional(),
            threshold: z.number().int().min(0).max(10).optional(),
            enforceForMaxSteps: z.number().int().min(5).max(100).optional()
        }).optional()
    })
    .passthrough()
    .nullable()
    .optional();
```

**Database Schema Update**:

```prisma
model Agent {
    // ... existing fields
    contextConfig Json? // Extended to include toolRetryPolicy + minToolCalls
}
```

**UI Updates** (apps/agent/src/app/agents/[agentSlug]/settings/page.tsx):
- Add "Tool Retry Policy" section to settings
- Toggle for enabled/disabled
- Inputs for maxRetries, delays
- Explanatory text about transient vs fatal errors

---

### Component 7: Enhanced Error Context in Responses

**Modified File**: `packages/agentc2/src/mcp/client.ts`

**Current** (lines 5068-5074):
```typescript
} catch (error) {
    return {
        success: false,
        toolName: resolvedToolName,
        error: error instanceof Error ? error.message : "Unknown error executing tool"
    };
}
```

**Enhanced**:
```typescript
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error executing tool";
    const isTransient = isTransientError(error);
    
    return {
        success: false,
        toolName: resolvedToolName,
        error: errorMessage,
        errorType: isTransient ? "transient" : "fatal",
        retryable: isTransient,
        suggestedAction: isTransient 
            ? "This is a temporary error. The system will automatically retry."
            : "This is a permanent error. Please check configuration or use an alternative approach."
    };
}
```

**Benefits**:
- Agent receives clearer guidance on error handling
- Evaluation logic can distinguish transient vs fatal
- UI can display more helpful error messages

---

## Data Model Changes

### Schema Changes Required

1. **AgentToolCall** - Add retry tracking fields:
   - `retryCount Int @default(0)`
   - `retryHistoryJson Json?`
   - `wasRetried Boolean @default(false)`
   - `finalError String? @db.Text`
   - Index: `@@index([wasRetried])`

2. **ToolRetryEvent** - New table for retry telemetry:
   - Full schema as detailed above
   - Enables retry analytics dashboard
   - Monitors retry success rate by tool/error type

3. **Agent.contextConfig** - Extend JSON schema:
   - Add `toolRetryPolicy` object
   - Add `minToolCalls` object
   - Backward compatible (nullable/optional)

### Migration Plan

```bash
# Generate migration
bun run db:migrate -- --name add_tool_retry_tracking

# Migration will include:
# 1. ALTER TABLE agent_tool_call ADD COLUMN retryCount INT DEFAULT 0
# 2. ALTER TABLE agent_tool_call ADD COLUMN retryHistoryJson JSONB
# 3. ALTER TABLE agent_tool_call ADD COLUMN wasRetried BOOLEAN DEFAULT false
# 4. ALTER TABLE agent_tool_call ADD COLUMN finalError TEXT
# 5. CREATE INDEX idx_agent_tool_call_wasRetried ON agent_tool_call(wasRetried)
# 6. CREATE TABLE tool_retry_event (...)
```

**Rollback Safety**:
- All new fields are nullable or have defaults
- Existing code will continue to work (ignores new fields)
- Can roll back migration if needed

---

## API Changes

### Agent Configuration API

**Endpoint**: `PATCH /api/agents/{id}`

**New Request Fields** (within `contextConfig`):

```json
{
    "contextConfig": {
        "toolRetryPolicy": {
            "enabled": true,
            "maxRetries": 2,
            "initialDelayMs": 500,
            "maxDelayMs": 5000,
            "retryableErrorPatterns": []  // Custom patterns (optional)
        },
        "minToolCalls": {
            "enabled": true,
            "threshold": 1,
            "enforceForMaxSteps": 10
        }
    }
}
```

**Response**: Standard agent object with extended `contextConfig`

### Run Analytics API

**New Endpoint**: `GET /api/agents/{id}/analytics/retries`

**Purpose**: Dashboard showing retry statistics for an agent.

**Response**:
```json
{
    "timeRange": { "start": "...", "end": "..." },
    "totalToolCalls": 1543,
    "retriedCalls": 87,
    "retrySuccessRate": 0.92,
    "byTool": [
        {
            "toolKey": "hubspot.hubspot-get-user-details",
            "totalCalls": 234,
            "retriedCalls": 12,
            "avgRetries": 1.3,
            "successAfterRetry": 11,
            "commonErrors": [
                { "error": "ECONNREFUSED", "count": 8 },
                { "error": "timeout", "count": 4 }
            ]
        }
    ],
    "byErrorType": [
        { "errorType": "timeout", "count": 34, "successRate": 0.94 },
        { "errorType": "rate_limit", "count": 18, "successRate": 0.89 },
        { "errorType": "connection_refused", "count": 35, "successRate": 0.91 }
    ]
}
```

---

## Integration Points

### 1. AgentResolver Integration

**File**: `packages/agentc2/src/agents/resolver.ts`

**Changes**:
1. After `wrapToolsWithPermissionGuard()` (line 995), add:
   ```typescript
   // --- Tool Retry Wrapper ---
   const retryConfig = contextConfig?.toolRetryPolicy;
   if (retryConfig?.enabled !== false) {
       const retryResult = wrapToolsWithRetry(tools, {
           maxRetries: retryConfig?.maxRetries ?? 2,
           initialDelayMs: retryConfig?.initialDelayMs ?? 500,
           maxDelayMs: retryConfig?.maxDelayMs ?? 5000,
           onRetry: (error, attempt, toolName) => {
               console.log(`[AgentRetry ${record.slug}] ${toolName} retry ${attempt}:`, error);
           }
       });
       console.log(`[AgentResolver] Retry wrapper applied to ${retryResult.toolsWrapped} tools`);
   }
   ```

2. Add new processors to `inputProcessors` array (line 1057):
   ```typescript
   const inputProcessors = [
       createInputGuardrailProcessor(record.id, organizationId),
       createContextWindowProcessor({ /* ... */ }),
       createStepAnchorProcessor({ /* ... */ }),
       createToolAvailabilityProcessor({  // NEW
           enabled: true,
           noToolCallThreshold: 3
       }),
       new TokenLimiter(tokenLimit)
   ];
   ```

3. Add new processor to `outputProcessors` array (line 1073):
   ```typescript
   const outputProcessors = [
       createOutputGuardrailProcessor(record.id, organizationId),
       createToolResultCompressorProcessor({ /* ... */ }),
       createToolCallGuardProcessor({ /* ... */ }),
       createMinimumToolCallProcessor({  // NEW
           enabled: contextConfig?.minToolCalls?.enabled ?? true,
           threshold: contextConfig?.minToolCalls?.threshold ?? 1,
           maxStepsThreshold: contextConfig?.minToolCalls?.enforceForMaxSteps ?? 10
       }),
       new ToolCallFilter(),
       new TokenLimiter(tokenLimit)
   ];
   ```

### 2. MCP Client Integration

**File**: `packages/agentc2/src/mcp/client.ts`

**Changes in `executeMcpTool()` (line 5018-5028)**:

```typescript
// Current:
const executePromise = (tool as any).execute({ context: parameters });
const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
        () => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)),
        timeoutMs
    )
);
const result = await Promise.race([executePromise, timeoutPromise]);

// Enhanced:
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
        maxDelayMs: 5000,
        isRetryable: (error) => {
            // Timeout errors are NOT retryable (tool is slow, not transient)
            if (error instanceof Error && error.message.includes("timed out")) {
                return false;
            }
            return isTransientError(error);
        },
        onRetry: (error, attempt) => {
            console.log(`[MCP] ${toolName} retry ${attempt}/2:`, error);
            // Emit telemetry event
            void emitRetryEvent({
                toolKey: toolName,
                toolSource: `mcp:${serverId}`,
                attemptNumber: attempt,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: "transient",
                organizationId: options?.organizationId
            });
        }
    }
);
```

### 3. Run Recorder Integration

**File**: `apps/agent/src/lib/run-recorder.ts`

**Changes in `extractToolCalls()` (line 721-917)**:

Track retry metadata when recording tool calls:

```typescript
// When creating AgentToolCall records:
await prisma.agentToolCall.create({
    data: {
        runId,
        turnId,
        traceId,
        toolKey: tc.toolKey,
        toolSource: tc.toolSource,
        inputJson: tc.input,
        outputJson: tc.output,
        success: tc.success ?? true,
        error: tc.error,
        durationMs: tc.durationMs,
        
        // NEW: Retry tracking
        retryCount: tc.retryCount ?? 0,
        retryHistoryJson: tc.retryHistory ?? null,
        wasRetried: (tc.retryCount ?? 0) > 0,
        finalError: tc.finalError ?? tc.error
    }
});
```

### 4. Evaluation Integration

**File**: `packages/agentc2/src/scorers/tier1.ts`

**Enhanced `toolSuccess` scorer** (line 126-136):

```typescript
// Current: Simple success rate
const successRate = (total - failed) / total;
scores.toolSuccess = successRate;

// Enhanced: Account for retries
if (context.toolCalls && context.toolCalls.length > 0) {
    const failedCalls = context.toolCalls.filter(tc => tc.success === false);
    const retriedCalls = context.toolCalls.filter(tc => tc.wasRetried === true);
    const successAfterRetry = retriedCalls.filter(tc => tc.success === true);
    
    // Penalize less for transient failures that were retried
    const effectiveFailed = failedCalls.filter(tc => !tc.wasRetried);
    const successRate = (total - effectiveFailed.length) / total;
    
    scores.toolSuccess = successRate;
    
    if (retriedCalls.length > 0) {
        flags.push(`retries:${retriedCalls.length}(${successAfterRetry.length}ok)`);
    }
    if (effectiveFailed.length > 0) {
        flags.push(`tool_failures:${effectiveFailed.length}`);
    }
}
```

**File**: `packages/agentc2/src/scorers/auditor.ts`

**Enhanced failure mode detection** (line 144):

```typescript
// Add context about retries to auditor:
- TOOL_SELECTION_ERROR: Called the wrong tool or an unnecessary tool. 
  Note: Check if the agent avoided tools entirely (zero tool calls despite task requiring them).
  If the agent made ZERO tool calls, this is CRITICAL severity.
```

---

## System Prompt Enhancements

### Base Agent System Prompt

**File**: `packages/agentc2/src/agents/resolver.ts` (system messages section)

**Add to all agents**:

```typescript
const toolRetryGuidance = `
## Tool Execution & Error Handling

When using tools:
1. **Always attempt tool calls** when the task requires external data or actions
2. **Transient errors are auto-retried** - network/timeout errors will be retried automatically
3. **Fatal errors require alternatives** - if you see "[TOOL BLOCKED]" or "Tool not found", choose a different approach
4. **Don't assume unavailability** - attempt the tool call first, the error message will indicate if it's truly unavailable
5. **Continue multi-step tasks** - if you've successfully called tools and have remaining steps, continue the task sequence

Error Types:
- TRANSIENT (auto-retried): ECONNREFUSED, timeout, 429/502/503/504, "temporarily unavailable"
- FATAL (no retry): "[TOOL BLOCKED]", "permission denied", "Tool not found", "Invalid parameters"
`;

// Inject into system messages when agent has tools attached
if (Object.keys(tools).length > 0) {
    systemMessages.push({
        role: "system",
        content: toolRetryGuidance
    });
}
```

---

## Impact Assessment

### Affected Components

| Component | Change Type | Risk Level | Notes |
|-----------|-------------|------------|-------|
| **AgentResolver** | Medium | Low | Add retry wrapper and processors |
| **MCP Client** | Medium | Medium | Wrap `executeMcpTool()` with retry logic |
| **Tool Registry** | Small | Low | Add retry wrapper call |
| **Database Schema** | Medium | Low | Add new fields (backward compatible) |
| **Run Recorder** | Small | Low | Track retry metadata |
| **Evaluation** | Small | Low | Account for retries in scoring |
| **Agent Settings UI** | Medium | Low | Add configuration options |

### Backward Compatibility

✅ **Fully Backward Compatible**:
- New database fields have defaults (retryCount=0, wasRetried=false)
- Retry logic is **opt-in** by default but enabled for all agents
- Can be disabled per-agent via `contextConfig.toolRetryPolicy.enabled = false`
- Existing agents continue to work unchanged

### Performance Impact

**Positive**:
- Fewer failed runs due to transient errors
- Better completion rates for multi-step tasks
- Reduced support burden (fewer "tool unavailable" issues)

**Negative**:
- Slight latency increase on transient failures (500-5000ms per retry)
- Additional database writes for retry telemetry
- Marginal increase in token usage (retry encouragement messages)

**Mitigation**:
- Keep maxRetries low (2 by default)
- Use exponential backoff with jitter
- Make retry telemetry writes async (fire-and-forget)
- Short-circuit retries for fatal errors

---

## Testing Strategy

### Unit Tests

**New Test Files**:

1. `packages/agentc2/src/security/tool-retry-wrapper.test.ts`
   - Test retry logic with mock tools
   - Verify exponential backoff calculations
   - Test error classification (transient vs fatal)
   - Verify retry count tracking

2. `packages/agentc2/src/processors/tool-availability-processor.test.ts`
   - Test encouragement injection logic
   - Verify state tracking across steps
   - Test threshold detection

3. `packages/agentc2/src/processors/minimum-tool-call-processor.test.ts`
   - Test minimum tool call enforcement
   - Verify task detection heuristic
   - Test abort with retry behavior

### Integration Tests

**New Test File**: `apps/agent/__tests__/tool-retries.integration.test.ts`

**Test Cases**:
1. **Transient Error Recovery**
   - Mock tool that fails once, succeeds on retry
   - Verify agent receives successful result
   - Verify retry metadata recorded

2. **Fatal Error No Retry**
   - Mock tool that returns "[TOOL BLOCKED]"
   - Verify no retry attempted
   - Verify agent receives error immediately

3. **Zero Tool Call Prevention**
   - Agent with high maxSteps (30)
   - Task requiring tools (e.g., "Search HubSpot for...")
   - Mock agent that tries to respond without tools
   - Verify abort with retry is triggered

4. **Retry Exhaustion**
   - Mock tool that fails 3 times with transient error
   - Verify 2 retries attempted (maxRetries=2)
   - Verify final error returned to agent
   - Verify retryHistory populated

5. **Mixed Success/Failure**
   - Agent makes 4 tool calls
   - Tool #2 fails transiently, succeeds on retry
   - Tool #4 fails fatally, no retry
   - Verify correct retry behavior per tool

### End-to-End Tests

**Test Scenarios**:

1. **HubSpot CRM Agent** (simulated network blip):
   - Inject network error on first `hubspot-get-user-details` call
   - Verify automatic retry succeeds
   - Verify agent completes task normally
   - Verify run evaluation shows retried=true but success=true

2. **SDLC Signal Harvester** (the original failing case):
   - Re-run the task that resulted in TOOL_SELECTION_ERROR
   - Verify agent attempts Jira tool calls
   - Verify retry encouragement if tools transiently fail
   - Verify minimum tool call enforcement prevents zero-tool response

3. **Multi-Step Research Agent**:
   - Task: "Research company X using HubSpot, then search web for recent news"
   - Inject transient error on first HubSpot call
   - Verify retry succeeds, agent continues to web search
   - Verify full task completion despite transient error

---

## Configuration & Rollout Strategy

### Phase 1: Foundation (Week 1)

**Goals**:
- Implement core retry infrastructure
- No breaking changes, backward compatible
- Opt-in retry logic (disabled by default initially)

**Deliverables**:
1. ✅ `tool-retry-wrapper.ts` - Retry wrapper with error classification
2. ✅ Database schema migration - Add retry tracking fields
3. ✅ Enhanced `isTransientError()` - Comprehensive error detection
4. ✅ Integration with `executeMcpTool()` - Wrap MCP tool execution
5. ✅ Integration with native tools - Wrap in `AgentResolver`
6. ✅ Unit tests for retry logic

**Success Criteria**:
- Migration runs successfully
- Retry wrapper tests pass
- Existing agents continue to work unchanged

---

### Phase 2: Processor Integration (Week 2)

**Goals**:
- Add intelligent processors for tool encouragement
- Prevent zero-tool-call failures
- Enhanced step continuation

**Deliverables**:
1. ✅ `tool-availability-processor.ts` - Encouragement injection
2. ✅ `minimum-tool-call-processor.ts` - Zero-tool prevention
3. ✅ Enhanced `step-anchor.ts` - Better continuation prompting
4. ✅ System prompt additions - Tool retry guidance
5. ✅ Processor unit tests
6. ✅ Integration tests for end-to-end flow

**Success Criteria**:
- Processors correctly inject messages at appropriate times
- Zero-tool-call prevention works without false positives
- Integration tests pass

---

### Phase 3: Observability & Configuration (Week 3)

**Goals**:
- Make retry behavior visible and configurable
- Enable monitoring and debugging
- UI for configuration

**Deliverables**:
1. ✅ `ToolRetryEvent` telemetry emission
2. ✅ Enhanced error responses (errorType, retryable, suggestedAction)
3. ✅ Run recorder retry tracking
4. ✅ Agent settings UI - Tool retry configuration
5. ✅ Analytics endpoint - Retry dashboard
6. ✅ Enhanced evaluation scoring - Account for retries

**Success Criteria**:
- Retry events visible in database
- Agent settings UI allows retry configuration
- Analytics show retry statistics
- Evaluation distinguishes transient from fatal failures

---

### Phase 4: Rollout & Tuning (Week 4)

**Goals**:
- Enable retry logic by default for all agents
- Monitor production behavior
- Tune retry parameters based on real data

**Deliverables**:
1. ✅ Enable retry by default (contextConfig.toolRetryPolicy.enabled = true)
2. ✅ Monitor retry analytics for 1 week
3. ✅ Identify problematic tools/error types
4. ✅ Tune retry parameters (maxRetries, delays)
5. ✅ Update documentation (CLAUDE.md, docs/)
6. ✅ Blog post explaining the feature

**Success Criteria**:
- TOOL_SELECTION_ERROR rate decreases by ≥40%
- Run completion rate increases
- No increase in average run duration (retries should be fast)
- No false positive tool blocks

---

## Risks & Mitigations

### Risk 1: Retry Loops Consuming Budget

**Description**: An agent could get stuck retrying the same failing tool repeatedly, consuming tokens and time.

**Likelihood**: Medium | **Impact**: High

**Mitigations**:
- ✅ Hard cap on maxRetries (default: 2, max: 5)
- ✅ Exponential backoff prevents rapid retries
- ✅ `ToolCallGuardProcessor` already has per-tool budget (8 calls/tool)
- ✅ Global tool call budget (maxSteps * 2)
- ✅ Retry count tracked in telemetry for monitoring

### Risk 2: Masking Configuration Errors

**Description**: Retrying non-transient errors (e.g., missing API keys) delays error detection.

**Likelihood**: Low | **Impact**: Medium

**Mitigations**:
- ✅ Error classification distinguishes transient vs fatal
- ✅ Fatal errors (permission, tool not found) skip retry
- ✅ Configuration errors return `{ retryable: false }`
- ✅ First-time setup wizard validates API keys before agent use

### Risk 3: False Positives on Minimum Tool Call Enforcement

**Description**: Agent legitimately doesn't need tools, but processor forces retry.

**Likelihood**: Medium | **Impact**: Low

**Mitigations**:
- ✅ Only enforce for agents with maxSteps ≥ 10 (high-complexity tasks)
- ✅ Task detection heuristic (keyword-based)
- ✅ Only triggers once (retryCount < 1)
- ✅ Can be disabled per-agent in config
- ✅ If agent still doesn't call tools after retry, allow it

### Risk 4: Increased Latency on Failures

**Description**: Retries add 500-5000ms delay per transient failure.

**Likelihood**: High | **Impact**: Low

**Mitigations**:
- ✅ Only retry on actual failures (not on success)
- ✅ Short initial delay (500ms)
- ✅ Jitter prevents thundering herd
- ✅ Most requests won't hit retry path
- ✅ User experience is better (success vs failure) despite latency

### Risk 5: Database Migration Issues

**Description**: Schema changes could fail or cause downtime.

**Likelihood**: Low | **Impact**: Medium

**Mitigations**:
- ✅ All new fields are nullable or have defaults
- ✅ Additive-only changes (no column drops)
- ✅ Test migration on staging database first
- ✅ Can roll back migration if needed
- ✅ Deploy during low-traffic window

---

## Monitoring & Success Metrics

### Key Metrics to Track

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **TOOL_SELECTION_ERROR rate** | ~15% of evaluations | <8% | AgentEvaluation.failureModes |
| **Zero-tool-call runs** | ~12% of high-maxSteps runs | <5% | Runs with maxSteps≥10, toolCalls=0 |
| **Run completion rate** | ~78% | >85% | Runs with status=COMPLETED |
| **Avg tool calls per run** | ~2.3 | >3.0 | COUNT(toolCalls) / COUNT(runs) |
| **Retry success rate** | N/A | >90% | Retries that succeeded / total retries |
| **Avg retries per run** | 0 | <0.5 | SUM(retryCount) / COUNT(runs) |

### Dashboards

**1. Retry Health Dashboard** (`/agents/{id}/analytics/retries`):
- Retry attempts over time (line chart)
- Success rate after retry (pie chart)
- Top retried tools (bar chart)
- Common error types (table)
- Avg retry delay (histogram)

**2. Tool Availability Dashboard** (`/admin/tools/health`):
- Per-tool success rate
- Per-tool retry rate
- Recent failures by error type
- Server health (for MCP servers)
- Recommendations for unhealthy tools

**3. Agent Performance Dashboard** (enhanced):
- Add "Retries" column to runs table
- Add filter for "Runs with retries"
- Add badge on runs that succeeded after retry

---

## Alternative Approaches Considered

### Alternative 1: Circuit Breaker Pattern

**Description**: Implement circuit breaker at the tool level - after N consecutive failures, stop calling the tool for a timeout period.

**Pros**:
- Prevents repeated failures consuming budget
- Protects external services from overload
- Well-established pattern

**Cons**:
- Adds complexity (state management, timeout tracking)
- May prevent legitimate retries after transient issues
- Requires cross-request state (Redis/database)

**Decision**: ❌ **Not in initial implementation**. Circuit breakers are valuable but solve a different problem (sustained outages). Can be added later if retry storms become an issue.

---

### Alternative 2: Agent Self-Correction via Enhanced Prompting Only

**Description**: Don't add runtime retries, just improve system prompts to encourage agents to retry failed tool calls.

**Pros**:
- No code changes needed
- Agent maintains full control
- Simple to implement

**Cons**:
- Consumes agent steps (each retry = 1 step)
- Unreliable (agents often give up despite prompting)
- No differentiation between transient/fatal errors
- Doesn't address the "tools are unavailable" preemptive response

**Decision**: ❌ **Insufficient**. Evidence shows agents already receive nudges (managed-generate.ts:596-604) but still fail. Prompting alone cannot solve the problem.

---

### Alternative 3: Mastra Core Modification

**Description**: Modify `@mastra/core` framework to add retry logic at the Agent.generate() level.

**Pros**:
- Deepest integration point
- Could benefit all Mastra users
- Single source of truth

**Cons**:
- Requires forking Mastra or upstream contribution
- Slower iteration cycle
- May not align with Mastra's design philosophy
- Blocks AgentC2-specific customization

**Decision**: ❌ **Not viable for initial release**. AgentC2 needs control over retry behavior and can't wait for upstream changes. Consider upstreaming later if proven successful.

---

### Alternative 4: Retry Budget Separate from Step Budget

**Description**: Give agents a separate "retry budget" that doesn't consume maxSteps.

**Pros**:
- Retries don't impact agent's step allocation
- Clearer separation of concerns
- Easier to tune retry vs step budgets

**Cons**:
- More complex configuration
- Two budgets to manage
- Unclear how they interact (what if step budget runs out during retry?)

**Decision**: ✅ **Adopted for transparent retries**. The `wrapToolsWithRetry()` approach effectively implements this - retries happen within a single step from the agent's perspective.

---

## Open Questions

### Q1: Should retry delays count toward step duration?

**Options**:
- **A**: Include retry delays in `AgentToolCall.durationMs` (transparent accounting)
- **B**: Exclude retry delays, only count actual execution time

**Recommendation**: **Option A**. Retry delays are real wall-clock time that impacts user experience. Including them in durationMs provides accurate performance metrics.

---

### Q2: Should agents be notified of automatic retries?

**Options**:
- **A**: Fully transparent - agent never knows a retry happened
- **B**: Inject system message: "Tool X succeeded after 1 retry"
- **C**: Include in tool result: `{ success: true, result, retriedOnce: true }`

**Recommendation**: **Option A for successful retries**, **Option B for exhausted retries**. If retry succeeds, agent doesn't need to know. If all retries fail, inject an informative error message.

---

### Q3: How to handle rate limit errors (429)?

**Options**:
- **A**: Retry with exponential backoff (may still hit rate limit)
- **B**: Extract `Retry-After` header and use that delay
- **C**: Fail immediately and let agent choose alternative tool

**Recommendation**: **Option B with fallback to A**. If the error includes a `Retry-After` header, use that delay (capped at maxDelayMs). Otherwise, use exponential backoff.

Implementation:
```typescript
function extractRetryDelay(error: unknown): number | null {
    if (error && typeof error === "object" && "headers" in error) {
        const headers = (error as any).headers;
        const retryAfter = headers["retry-after"] || headers["Retry-After"];
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
                return Math.min(seconds * 1000, 30000);  // Cap at 30s
            }
        }
    }
    return null;
}
```

---

### Q4: Should MCP server connection failures trigger retries?

**Context**: MCP client already has 1 retry when loading tools (`loadToolsFromServer()`, lines 3994-4007). Should we add more?

**Recommendation**: **No additional retries at load time**, but **yes for execution time**. Current behavior is appropriate - if a server fails to connect during agent resolution, 1 retry is sufficient. But during tool execution, network blips are more common and should be retried.

---

### Q5: How to prevent retry storms across multiple agents?

**Scenario**: 10 agents all retry a failing MCP server simultaneously.

**Options**:
- **A**: Per-agent rate limiting (already exists)
- **B**: Global circuit breaker (shared state)
- **C**: Exponential backoff with jitter (spreads retries)
- **D**: Health check before retry (ping server first)

**Recommendation**: **Option C** (already implemented in `withRetry()`). The jitter in exponential backoff naturally spreads retry attempts across time, preventing thundering herd. If storms become an issue in production, add **Option B** in a future phase.

---

## Phased Implementation Plan

### Phase 1: Core Retry Infrastructure (Days 1-3)

**Objective**: Implement transparent retry logic for tool execution.

**Tasks**:
1. Create `tool-retry-wrapper.ts`:
   - `wrapToolsWithRetry()` function
   - `isTransientError()` classifier
   - Integration with existing `withRetry()` utility
   - Comprehensive unit tests

2. Integrate with MCP client:
   - Wrap `executeMcpTool()` execution with retry
   - Handle `Retry-After` headers for 429 errors
   - Log retry attempts
   - Update error responses to include `errorType` and `retryable` fields

3. Integrate with native tools:
   - Add retry wrapper call in `AgentResolver.resolve()`
   - Apply after permission guard
   - Verify retry wrapper doesn't break permission checks

4. Database migration:
   - Add `retryCount`, `retryHistoryJson`, `wasRetried`, `finalError` to `AgentToolCall`
   - Create `ToolRetryEvent` table
   - Generate migration, test on staging

5. Run recorder integration:
   - Extract retry metadata from tool call responses
   - Populate new fields in `AgentToolCall` records
   - Emit `ToolRetryEvent` telemetry

**Testing**:
- Unit tests: retry logic, error classification
- Integration test: mock tool that fails once, succeeds on retry
- Verify retry metadata recorded in database

**Rollout**:
- Deploy to staging environment
- Test with SDLC Signal Harvester agent
- Monitor for unexpected behavior
- Deploy to production with retry **disabled by default**

---

### Phase 2: Agent Behavior Processors (Days 4-5)

**Objective**: Add intelligent processors to prevent premature termination and encourage tool usage.

**Tasks**:
1. Create `tool-availability-processor.ts`:
   - State tracking for tool calls
   - Encouragement injection after N steps without tools
   - Availability status messaging
   - Unit tests

2. Create `minimum-tool-call-processor.ts`:
   - Task detection heuristic
   - Zero-tool-call enforcement
   - Abort with retry mechanism
   - Unit tests

3. Enhance `step-anchor.ts`:
   - More aggressive continuation prompts
   - Mid-task progress encouragement
   - Better final step messaging

4. Update `AgentResolver.resolve()`:
   - Add new processors to pipeline
   - Wire up configuration from `contextConfig`
   - Ensure processor order is correct

**Testing**:
- Unit tests: processor logic in isolation
- Integration test: agent that tries to skip tools → retry forced
- Integration test: agent that stops early → continuation encouraged
- E2E test: re-run the failing SDLC Signal Harvester scenario

**Rollout**:
- Deploy to staging
- Test with multiple agent types (research, CRM, support)
- Validate no false positives
- Deploy to production with processors **enabled by default**

---

### Phase 3: Configuration & UI (Days 6-7)

**Objective**: Make retry behavior configurable and observable.

**Tasks**:
1. Extend agent configuration schema:
   - Add `toolRetryPolicy` to `contextConfigSchema`
   - Add `minToolCalls` to `contextConfigSchema`
   - Update Zod validators
   - Update TypeScript types

2. Agent settings UI:
   - Add "Tool Retry Policy" section
   - Toggle for enabled/disabled
   - Inputs for maxRetries, initialDelayMs, maxDelayMs
   - Info tooltip explaining transient vs fatal errors
   - "Minimum Tool Calls" section
   - Toggle and threshold input

3. Analytics API endpoint:
   - Implement `GET /api/agents/{id}/analytics/retries`
   - Query `ToolRetryEvent` table
   - Aggregate by tool, error type, time range
   - Return structured JSON for dashboard

4. Retry dashboard UI:
   - Create `/agents/{agentSlug}/analytics/retries` page
   - Line chart: retry attempts over time
   - Bar chart: top retried tools
   - Table: error types and success rates
   - Recommendations for configuration tuning

**Testing**:
- UI tests: configuration form validation
- API tests: analytics endpoint with sample data
- E2E tests: configure retry policy via UI, verify it takes effect

**Rollout**:
- Deploy to staging
- Test UI flows
- Deploy to production
- Document in user guide

---

### Phase 4: Evaluation & Tuning (Days 8-10)

**Objective**: Enhance evaluation to account for retries and tune based on production data.

**Tasks**:
1. Enhance Tier 1 evaluation:
   - Update `toolSuccess` scorer to account for retries
   - Add retry metadata to flags
   - Distinguish transient failures from fatal

2. Enhance Tier 2 evaluation (Auditor):
   - Update failure mode classification prompt
   - Add guidance about zero-tool-call detection
   - Include retry context in AAR

3. Production monitoring:
   - Monitor retry metrics for 1 week
   - Identify tools with high retry rates
   - Identify error types causing retries
   - Analyze retry success rates

4. Parameter tuning:
   - Adjust default maxRetries based on success rates
   - Adjust delay parameters for optimal UX
   - Identify tools that need custom retry policies
   - Update tool-specific configurations

5. Documentation:
   - Update CLAUDE.md with retry documentation
   - Add guide to docs/ for retry configuration
   - Write troubleshooting guide for retry issues
   - Update API reference

**Testing**:
- Evaluation tests: verify scoring accounts for retries
- Load testing: verify retry logic performs at scale
- Chaos testing: inject random tool failures, verify recovery

**Rollout**:
- Enable retry by default for all new agents
- Gradually enable for existing agents (opt-in via UI)
- Monitor metrics weekly
- Iterate on configuration based on data

---

## Success Criteria

### Quantitative Targets

1. **TOOL_SELECTION_ERROR Rate**: Reduce from ~15% to <8% (-47% improvement)
2. **Zero-Tool-Call Runs**: Reduce from ~12% to <5% for agents with maxSteps≥10
3. **Run Completion Rate**: Increase from ~78% to >85% (+9% improvement)
4. **Retry Success Rate**: Achieve >90% success rate for retried tool calls
5. **Avg Run Duration**: Increase <5% (acceptable for better success rate)

### Qualitative Targets

1. ✅ Agents attempt tool calls rather than assuming unavailability
2. ✅ Transient errors recover gracefully without user intervention
3. ✅ Multi-step tasks continue to completion despite transient failures
4. ✅ Clear error messages distinguish transient vs fatal errors
5. ✅ Retry behavior is observable and debuggable

### Production Validation

**After 1 week in production**:
- Review retry analytics for top 10 agents
- Identify any unexpected retry patterns
- Adjust default configuration if needed
- Publish case study comparing before/after metrics

**After 1 month in production**:
- Calculate ROI (improved completion rate vs cost of retries)
- Identify tools that need custom retry policies
- Consider upstreaming changes to Mastra framework
- Write blog post on findings

---

## Security & Privacy Considerations

### Data Retention

**Retry History**: The `retryHistoryJson` field may contain sensitive error messages with URLs, IDs, or system details.

**Mitigation**:
- Sanitize error messages before storing (strip credentials, tokens)
- Limit retry history to last 3 attempts
- Include in GDPR data export/deletion flows
- Apply same PII scanning as tool results

### Rate Limiting

**Concern**: Automatic retries could bypass rate limiting.

**Mitigation**:
- Retries are transparent to the agent but **not to rate limiters**
- Existing rate limiting (federation/policy.ts) already counts tool calls
- Retry delays provide natural throttling
- Per-tool budget (8 calls) and global budget (maxSteps * 2) still enforced

### Cost Control

**Concern**: Retries increase token usage and API costs.

**Mitigation**:
- Hard cap on maxRetries (default: 2, max: 5)
- Token budgets and cost budgets still enforced
- Retry telemetry enables cost attribution
- Can disable retries per-agent if cost is a concern

---

## Documentation Requirements

### Developer Documentation

1. **CLAUDE.md** - Add section on retry logic:
   - How retry works
   - Default configuration
   - How to disable/customize per agent
   - Transient vs fatal error guide

2. **API Reference** - Document new fields:
   - `contextConfig.toolRetryPolicy`
   - `contextConfig.minToolCalls`
   - `AgentToolCall` retry fields
   - `ToolRetryEvent` table

3. **Architecture Guide** - Add retry flow diagram:
   - Show where retries happen in execution flow
   - Explain processor integration
   - Document error classification logic

### User Documentation

1. **Agent Settings Guide** - How to configure retries:
   - When to enable/disable
   - How to tune retry parameters
   - Troubleshooting common issues

2. **Troubleshooting Guide** - Retry-related issues:
   - "Agent says tool unavailable but I know it's configured"
   - "Agent keeps retrying the same tool"
   - "Retry delays are too long"

3. **Best Practices** - Recommendations:
   - When to increase maxRetries
   - How to identify tools that need custom policies
   - When to disable retries (e.g., non-idempotent mutations)

---

## Dependencies & Prerequisites

### External Dependencies

- None (all retry logic uses existing `withRetry()` utility)

### Internal Dependencies

- ✅ `@mastra/core` Processor interface (already used)
- ✅ Existing `withRetry()` utility (packages/agentc2/src/lib/retry.ts)
- ✅ Existing permission guard wrapper pattern (resolver.ts:993)
- ✅ Existing processor patterns (tool-call-guard, step-anchor)

### Configuration Prerequisites

- None (retry logic works with default configuration)

---

## Rollback Plan

### If Issues Arise Post-Deployment

**Immediate Rollback** (within 5 minutes):
1. Set `FEATURE_TOOL_RETRIES=false` in environment
2. Restart services
3. All retry logic bypassed, agents return to current behavior

**Graceful Rollback** (within 1 hour):
1. Deploy previous version of code
2. Retry logic disabled but database schema remains
3. Can re-enable later by redeploying

**Full Rollback** (within 1 day):
1. Run reverse migration to drop new fields/tables
2. Revert all code changes
3. Agents return to pre-feature state

**Data Preservation**:
- Even if feature is disabled, retry telemetry remains in database
- Can analyze retry patterns post-rollback to inform future attempts

---

## Future Enhancements (Out of Scope)

### 1. Adaptive Retry Policy

Learn optimal retry parameters per tool based on historical success rates:
- Tools with high transient error rates → more retries
- Tools with fast recovery → shorter delays
- Tools with low success rates → disable retries, suggest alternatives

**Implementation**: Analyze `ToolRetryEvent` data monthly, update tool-specific configs.

---

### 2. Circuit Breaker Pattern

If retry storms become an issue, implement circuit breaker:
- Track failure rate per tool over sliding window
- Open circuit after N consecutive failures
- Half-open after timeout, allow 1 test request
- Close circuit if test succeeds

**Implementation**: New `CircuitBreakerProcessor` that tracks state in Redis or database.

---

### 3. Smart Fallback Routing

When a tool consistently fails, suggest alternative tools to the agent:
- Jira unavailable → suggest GitHub Issues
- HubSpot unavailable → suggest CSV export + manual processing
- Web search unavailable → suggest direct URL fetch

**Implementation**: Tool equivalence map + fallback injection in `ToolAvailabilityProcessor`.

---

### 4. Retry Policy Templates

Pre-configured retry policies for common scenarios:
- **Aggressive**: maxRetries=5, short delays (for critical tools)
- **Conservative**: maxRetries=1, long delays (for rate-limited APIs)
- **Off**: maxRetries=0 (for non-idempotent mutations)

**Implementation**: UI dropdown with templates, custom override option.

---

### 5. Retry Budgets per Error Type

Different retry limits for different error types:
- Network errors: 3 retries
- Rate limits: 2 retries
- Timeouts: 1 retry (tool may be slow)

**Implementation**: Extend `ToolRetryConfig` with `maxRetriesByErrorType` map.

---

## Cost-Benefit Analysis

### Implementation Cost

| Phase | Engineering Days | Testing Days | Total Days |
|-------|-----------------|--------------|------------|
| Phase 1: Core Retry | 3 | 1 | 4 |
| Phase 2: Processors | 2 | 1 | 3 |
| Phase 3: Configuration | 2 | 1 | 3 |
| Phase 4: Evaluation | 2 | 1 | 3 |
| **Total** | **9** | **4** | **13** |

**Estimated Engineering Cost**: 13 engineering-days (~2.6 weeks for 1 engineer, ~1.3 weeks for 2 engineers in parallel)

### Operational Cost

**Increased Costs**:
- **Token Usage**: +2-5% (encouragement messages, retry prompts)
  - Avg run: 1,500 tokens → +30-75 tokens for retry guidance
  - Cost: negligible (~$0.0001 per run for GPT-4o)
- **Database Storage**: +5-10 MB/month per 1000 runs (retry telemetry)
- **API Latency**: +500-5000ms per transient failure (only on failures)

**Decreased Costs**:
- **Failed Run Reduction**: -40% failed runs due to transient errors
  - Fewer support tickets
  - Fewer manual re-runs by users
  - Better user satisfaction
- **Human Intervention Reduction**: -60% "tool unavailable" support requests

### Financial ROI

**Assumptions**:
- Current: 1000 agent runs/day, 15% fail due to transient errors = 150 failed runs/day
- With retry: 90% of transient errors recover = 135 runs/day now succeed
- Support cost: $50/ticket, 20% of failed runs generate tickets = 30 tickets/day saved × $50 = $1,500/day saved
- Engineering cost: 13 days × $800/day = $10,400 one-time

**Payback Period**: 10,400 / 1,500 = **7 days**

**Annual Value**: $1,500 × 365 = **$547,500/year** (conservative estimate)

---

## Edge Cases & Special Considerations

### Edge Case 1: Non-Idempotent Tool Mutations

**Scenario**: A tool like `hubspot-create-contact` is called, fails with 503, then succeeds on retry.

**Risk**: Duplicate resource creation if first call actually succeeded but response was lost.

**Mitigation**:
1. **Idempotency tokens**: Tools should support idempotency keys
   ```typescript
   await hubspotCreateContact({ 
       email: "...", 
       idempotencyKey: `${runId}-${toolCallId}` 
   });
   ```
2. **Mutation tools have retry disabled by default**:
   ```typescript
   const toolBehavior = toolBehaviorMap[toolId];
   if (toolBehavior?.behavior === "mutation") {
       // Only retry mutations on explicit network errors, not 5xx
       retryConfig.isRetryable = (error) => {
           if (error instanceof Error) {
               return error.message.includes("ECONNREFUSED") || 
                      error.message.includes("ETIMEDOUT");
           }
           return false;
       };
   }
   ```
3. **Per-tool override**: Allow disabling retry for specific tools via config

---

### Edge Case 2: Long-Running Tools

**Scenario**: A tool takes 45 seconds to execute. Should we retry if it times out?

**Risk**: Retry would take another 45+ seconds, consuming excessive time.

**Mitigation**:
- **Timeout errors are NOT retryable** by default
- Modified `isTransientError()` to exclude timeout:
  ```typescript
  if (error instanceof Error && error.message.includes("timed out after")) {
      return false;  // Tool is slow, not transient failure
  }
  ```
- Long-running tools should increase `timeoutMs` parameter instead of relying on retries

---

### Edge Case 3: Rate Limit with Retry-After

**Scenario**: Tool returns `429 Too Many Requests` with `Retry-After: 60` (1 minute).

**Risk**: Waiting 60 seconds blocks the entire agent execution.

**Mitigation**:
- **Cap Retry-After at maxDelayMs** (default 5000ms):
  ```typescript
  const retryDelay = extractRetryDelay(error);
  if (retryDelay !== null && retryDelay <= maxDelayMs) {
      await new Promise(r => setTimeout(r, retryDelay));
  } else if (retryDelay > maxDelayMs) {
      // Retry-After too long, treat as fatal
      throw error;
  }
  ```
- If `Retry-After` > 5s, **treat as fatal** and let agent choose alternative
- Agent receives error: `Rate limited for 60 seconds. Please use an alternative approach or try again later.`

---

### Edge Case 4: Cascading Tool Failures

**Scenario**: Agent calls 5 tools in sequence, all fail transiently. Each retries 2x. Total time: ~25 seconds.

**Risk**: Poor user experience due to compounding delays.

**Mitigation**:
- **Per-run retry budget**: Track total retry attempts across all tools
  ```typescript
  interface RetryState {
      totalRetriesThisRun: number;
      maxTotalRetries: number;  // e.g., maxSteps * 2
  }
  
  // Before retrying, check budget:
  if (state.totalRetriesThisRun >= state.maxTotalRetries) {
      throw error;  // No more retries allowed this run
  }
  ```
- Inject system message after 3rd retry in a run: "Multiple tools are experiencing issues. Consider alternative approaches."

---

### Edge Case 5: Retry During Streaming

**Scenario**: Agent is using `agent.stream()` for real-time UI updates. Tool fails and retries.

**Risk**: UI shows "calling tool..." but then stalls for 3-5 seconds during retry.

**Mitigation**:
- **Stream retry status** as special event:
  ```typescript
  // In agent.stream() path, emit:
  yield {
      type: "tool-retry",
      toolName: "hubspot-get-user-details",
      attempt: 1,
      error: "ECONNREFUSED",
      retryingIn: 500
  };
  ```
- **UI shows**: "Retrying hubspot-get-user-details (attempt 1/2)..."
- Provides feedback instead of appearing stuck

---

### Edge Case 6: MCP Server Restart Mid-Execution

**Scenario**: MCP server restarts while agent is executing. First tool call succeeds, second fails with "connection lost".

**Risk**: Agent receives inconsistent tool availability within same run.

**Mitigation**:
- Retry logic already handles this: "connection lost" is transient
- Retry will re-establish connection transparently
- **If reconnection fails after retries**, inject system message:
  ```
  [System] The {serverName} MCP server connection was lost. 
  {N} tools are temporarily unavailable: {tool1, tool2, tool3}
  Please complete your task using available tools or inform the user.
  ```

---

### Edge Case 7: Retry on Last Step

**Scenario**: Agent is on step 30/30 (final step). Tool fails transiently.

**Risk**: Retry succeeds, but agent has no more steps to use the result.

**Mitigation**:
- **Retries don't consume steps** - agent still on step 30 after retry
- If retry succeeds, agent can use result in final response
- If retry fails, agent provides partial results and explains failure
- This is actually a **benefit** of transparent retries

---

## Telemetry & Observability

### Events to Emit

#### 1. Tool Retry Attempt Event

```typescript
interface ToolRetryAttemptEvent {
    eventType: "tool.retry.attempt";
    toolKey: string;
    toolSource: string;
    attemptNumber: number;
    errorMessage: string;
    errorType: "transient" | "fatal";
    delayMs: number;
    agentId: string;
    runId: string;
    organizationId: string;
    timestamp: Date;
}
```

**Emitted**: Each time a retry is attempted

**Purpose**: Track retry frequency and patterns

---

#### 2. Tool Retry Success Event

```typescript
interface ToolRetrySuccessEvent {
    eventType: "tool.retry.success";
    toolKey: string;
    totalAttempts: number;
    totalDelayMs: number;
    agentId: string;
    runId: string;
    organizationId: string;
    timestamp: Date;
}
```

**Emitted**: When a retry ultimately succeeds

**Purpose**: Calculate retry success rate

---

#### 3. Tool Retry Exhausted Event

```typescript
interface ToolRetryExhaustedEvent {
    eventType: "tool.retry.exhausted";
    toolKey: string;
    totalAttempts: number;
    finalError: string;
    agentId: string;
    runId: string;
    organizationId: string;
    timestamp: Date;
}
```

**Emitted**: When all retries are exhausted and tool still fails

**Purpose**: Identify tools with persistent issues

---

#### 4. Zero Tool Call Prevention Event

```typescript
interface ZeroToolCallPreventionEvent {
    eventType: "agent.zero_tool_call_prevented";
    agentId: string;
    agentSlug: string;
    runId: string;
    maxSteps: number;
    stepNumber: number;
    taskSnippet: string;  // First 200 chars of user input
    retryForced: boolean;
    timestamp: Date;
}
```

**Emitted**: When minimum tool call processor triggers

**Purpose**: Monitor false positive rate

---

### Logging Strategy

**Console Logs** (for development):
```typescript
// Retry wrapper
console.log(`[ToolRetry] ${toolName} failed on attempt ${attempt}, retrying...`);
console.log(`[ToolRetry] ${toolName} succeeded after ${attempt} retries`);
console.error(`[ToolRetry] ${toolName} exhausted retries: ${finalError}`);

// Availability processor
console.log(`[ToolAvailability] Step ${step}: No tools called for ${N} steps, injecting encouragement`);

// Minimum tool call processor
console.warn(`[MinimumToolCall] Agent attempting zero-tool-call finish, forcing retry`);
```

**Structured Logs** (for production):
```typescript
logger.info({
    event: "tool.retry.attempt",
    tool: toolName,
    attempt: attemptNumber,
    error: errorMessage,
    runId,
    agentId
});
```

---

### Monitoring Dashboards

#### Dashboard 1: Real-Time Retry Monitor

**Location**: `/admin/monitoring/tool-retries`

**Widgets**:
- **Live Retry Stream**: Recent retry attempts (last 100)
- **Retry Rate**: Retries per minute (line chart, 1-hour window)
- **Success Rate**: Percentage of retries that succeeded
- **Error Heatmap**: Tools × Error Types matrix with retry counts

**Purpose**: Detect retry storms or systemic issues in real-time

---

#### Dashboard 2: Agent Retry Profile

**Location**: `/agents/{agentSlug}/analytics/retries`

**Widgets**:
- **Retry Trend**: Retry attempts over last 30 days (line chart)
- **Tool Breakdown**: Retry count per tool (bar chart)
- **Error Distribution**: Pie chart of error types
- **Success After Retry**: Percentage (gauge)
- **Top Issues**: Table of most common errors with recommendations

**Purpose**: Per-agent retry tuning and troubleshooting

---

#### Dashboard 3: Platform-Wide Tool Health

**Location**: `/admin/tools/health`

**Widgets**:
- **Tool Success Rate**: Table with success rate per tool
- **Retry Frequency**: Tools sorted by retry rate
- **Server Status**: MCP server connection health
- **Error Timeline**: Recent errors by tool (timeline view)
- **Alert Threshold**: Tools with >20% failure rate highlighted

**Purpose**: Proactive tool health monitoring

---

### Alerts & Notifications

**Alert 1: High Retry Rate**
- **Trigger**: Tool retry rate > 30% over 1 hour
- **Action**: Slack notification to #eng-alerts
- **Message**: `🔄 Tool ${toolName} has 45% retry rate (12/27 calls). Recent errors: ECONNREFUSED (8), timeout (4). Investigate external service health.`

**Alert 2: Retry Storm Detected**
- **Trigger**: >100 retries in 5 minutes for same tool
- **Action**: Slack notification + temporarily disable tool
- **Message**: `⚠️ RETRY STORM: ${toolName} generated 127 retries in 5 min. Tool temporarily disabled. Check server health urgently.`

**Alert 3: Zero-Tool-Call Rate Spike**
- **Trigger**: >10% of runs trigger zero-tool-call prevention in 1 hour
- **Action**: Slack notification to #agent-quality
- **Message**: `📊 Zero-tool-call prevention triggered 15 times in last hour. Check if agents are avoiding tools. Recent agents: ${agentList}.`

---

## Implementation Details

### Retry Wrapper Implementation (Detailed)

**File**: `packages/agentc2/src/security/tool-retry-wrapper.ts`

```typescript
import { withRetry, type RetryOptions } from "../lib/retry";

export interface ToolRetryConfig {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    jitter?: boolean;
    isRetryable?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number, toolName: string) => void;
}

export interface ToolRetryResult {
    toolsWrapped: number;
    retryPolicies: Record<string, ToolRetryConfig>;
}

export interface ToolRetryMetadata {
    retryCount: number;
    retryHistory: Array<{
        attempt: number;
        error: string;
        delayMs: number;
        timestamp: string;
    }>;
    totalDelayMs: number;
}

/**
 * Enhanced transient error detection.
 * Extends the default isRetryable from withRetry() with tool-specific patterns.
 */
export function isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        
        // Network errors
        if (msg.includes("econnreset")) return true;
        if (msg.includes("econnrefused")) return true;
        if (msg.includes("etimedout")) return true;
        if (msg.includes("socket hang up")) return true;
        if (msg.includes("epipe")) return true;
        if (msg.includes("network error")) return true;
        if (msg.includes("fetch failed")) return true;
        
        // MCP-specific errors
        if (msg.includes("mcp server not responding")) return true;
        if (msg.includes("server connection lost")) return true;
        if (msg.includes("connection closed")) return true;
        
        // External service errors
        if (msg.includes("service unavailable")) return true;
        if (msg.includes("temporarily unavailable")) return true;
        if (msg.includes("internal server error")) return true;
        
        // Timeout errors are NOT retryable (tool is slow, not transient)
        if (msg.includes("timed out after")) return false;
        
        // Fatal errors (NOT retryable)
        if (msg.includes("[tool blocked]")) return false;
        if (msg.includes("permission denied")) return false;
        if (msg.includes("insufficient access")) return false;
        if (msg.includes("tool not found")) return false;
        if (msg.includes("invalid parameters")) return false;
    }
    
    // HTTP status codes
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 429) return true;  // Rate limit
        if (status === 502) return true;  // Bad gateway
        if (status === 503) return true;  // Service unavailable
        if (status === 504) return true;  // Gateway timeout
        
        // NOT retryable
        if (status === 400) return false;  // Bad request
        if (status === 401) return false;  // Unauthorized (unless refresh)
        if (status === 403) return false;  // Forbidden
        if (status === 404) return false;  // Not found
    }
    
    return false;
}

/**
 * Wrap a tool's execute function with retry logic.
 * Returns a new execute function that automatically retries transient failures.
 */
function wrapToolExecute(
    originalExecute: (context: any) => Promise<any>,
    toolName: string,
    config: ToolRetryConfig
): (context: any) => Promise<any> {
    const retryMetadata: ToolRetryMetadata = {
        retryCount: 0,
        retryHistory: [],
        totalDelayMs: 0
    };
    
    return async (context: any) => {
        const startTime = Date.now();
        
        try {
            const result = await withRetry(
                () => originalExecute(context),
                {
                    maxRetries: config.maxRetries ?? 2,
                    initialDelayMs: config.initialDelayMs ?? 500,
                    maxDelayMs: config.maxDelayMs ?? 5000,
                    jitter: config.jitter ?? true,
                    isRetryable: config.isRetryable ?? isTransientError,
                    onRetry: (error, attempt) => {
                        retryMetadata.retryCount = attempt;
                        retryMetadata.retryHistory.push({
                            attempt,
                            error: error instanceof Error ? error.message : String(error),
                            delayMs: computeCurrentDelay(attempt, config),
                            timestamp: new Date().toISOString()
                        });
                        
                        if (config.onRetry) {
                            config.onRetry(error, attempt, toolName);
                        }
                    }
                }
            );
            
            retryMetadata.totalDelayMs = Date.now() - startTime;
            
            // Attach retry metadata to result if retries occurred
            if (retryMetadata.retryCount > 0) {
                return {
                    ...result,
                    __retryMetadata: retryMetadata
                };
            }
            
            return result;
        } catch (error) {
            retryMetadata.totalDelayMs = Date.now() - startTime;
            
            // Attach retry metadata to error
            const enhancedError = error instanceof Error ? error : new Error(String(error));
            (enhancedError as any).__retryMetadata = retryMetadata;
            throw enhancedError;
        }
    };
}

/**
 * Wrap all tools in a record with retry logic.
 */
export function wrapToolsWithRetry(
    tools: Record<string, any>,
    config?: ToolRetryConfig
): ToolRetryResult {
    const wrapped: string[] = [];
    const policies: Record<string, ToolRetryConfig> = {};
    
    for (const [toolId, tool] of Object.entries(tools)) {
        if (!tool || typeof tool.execute !== "function") continue;
        
        // Get tool-specific behavior
        const behavior = toolBehaviorMap[toolId];
        
        // Customize retry policy for mutations
        let toolConfig = { ...config };
        if (behavior?.behavior === "mutation") {
            // More conservative retry for mutations
            toolConfig = {
                ...toolConfig,
                maxRetries: 1,  // Only 1 retry for mutations
                isRetryable: (error) => {
                    // Only retry on clear network errors
                    if (error instanceof Error) {
                        const msg = error.message.toLowerCase();
                        return msg.includes("econnrefused") || 
                               msg.includes("econnreset") ||
                               msg.includes("network error");
                    }
                    return false;
                }
            };
        }
        
        const originalExecute = tool.execute.bind(tool);
        tool.execute = wrapToolExecute(originalExecute, toolId, toolConfig);
        
        wrapped.push(toolId);
        policies[toolId] = toolConfig;
    }
    
    return { 
        toolsWrapped: wrapped.length, 
        retryPolicies: policies 
    };
}

// Helper to compute delay for logging
function computeCurrentDelay(attempt: number, config: ToolRetryConfig): number {
    const initial = config.initialDelayMs ?? 500;
    const max = config.maxDelayMs ?? 5000;
    const jitter = config.jitter ?? true;
    
    const expDelay = Math.min(max, initial * Math.pow(2, attempt - 1));
    if (!jitter) return expDelay;
    return Math.random() * expDelay;
}
```

---

### Minimum Tool Call Processor Implementation (Detailed)

**File**: `packages/agentc2/src/processors/minimum-tool-call-processor.ts`

```typescript
import type { Processor, ProcessOutputResultArgs } from "@mastra/core/processors";

export interface MinimumToolCallConfig {
    enabled?: boolean;
    minToolCalls?: number;
    maxStepsThreshold?: number;
    taskKeywords?: string[];
}

interface MinimumToolCallState {
    totalToolCalls: number;
    taskRequiresTools: boolean;
    checkPerformed: boolean;
}

/**
 * Processor that prevents agents from finishing multi-step tasks
 * without attempting any tool calls.
 */
export function createMinimumToolCallProcessor(
    config?: MinimumToolCallConfig
): Processor<"minimum-tool-call"> {
    const enabled = config?.enabled ?? true;
    const minToolCalls = config?.minToolCalls ?? 1;
    const maxStepsThreshold = config?.maxStepsThreshold ?? 10;
    const taskKeywords = config?.taskKeywords ?? DEFAULT_TASK_KEYWORDS;
    
    return {
        id: "minimum-tool-call" as const,
        name: "Minimum Tool Call Guard",
        
        async processOutputResult(args: ProcessOutputResultArgs) {
            if (!enabled) return args.messages;
            
            const { messages, state, abort, retryCount } = args;
            const mtState = state as unknown as MinimumToolCallState;
            
            // Initialize state on first call
            if (!mtState.totalToolCalls) {
                mtState.totalToolCalls = 0;
                mtState.taskRequiresTools = detectIfTaskRequiresTools(messages, taskKeywords);
                mtState.checkPerformed = false;
            }
            
            // Count tool calls in message history
            for (const msg of messages) {
                if (msg.role === "assistant") {
                    const toolCalls = extractToolCallsFromMessage(msg);
                    mtState.totalToolCalls += toolCalls.length;
                }
            }
            
            // Check if agent is trying to finish (last message is assistant text-only)
            const lastMsg = messages[messages.length - 1];
            const isFinishing = lastMsg?.role === "assistant" && !hasToolCallsInMessage(lastMsg);
            
            // Only enforce once per run
            if (mtState.checkPerformed) {
                return args.messages;
            }
            
            // Enforce minimum only if ALL conditions met:
            // 1. Agent is trying to finish (text response, no tool calls)
            // 2. Task requires tools (based on keywords)
            // 3. Zero tool calls made so far
            // 4. Haven't already retried this check
            if (
                isFinishing &&
                mtState.taskRequiresTools &&
                mtState.totalToolCalls === 0 &&
                retryCount === 0
            ) {
                mtState.checkPerformed = true;
                
                console.warn(
                    `[MinimumToolCall] Agent attempting to finish task without ANY tool calls. Forcing retry.`
                );
                
                // Abort with retry, providing clear guidance
                abort(
                    `[System] This task requires using tools to gather information or perform actions. ` +
                    `You have made ZERO tool calls. Please attempt at least ${minToolCalls} relevant tool call(s) ` +
                    `before responding. If tools are genuinely unavailable, you will receive a clear error message ` +
                    `(e.g., "[TOOL BLOCKED]" or "Tool not found"). Do not assume unavailability without trying.`,
                    { retry: true }
                );
            }
            
            return args.messages;
        }
    };
}

/**
 * Detect if the task requires tools based on action verbs and context.
 */
function detectIfTaskRequiresTools(
    messages: Array<any>,
    taskKeywords: string[]
): boolean {
    const firstUserMsg = messages.find(m => m.role === "user");
    if (!firstUserMsg) return false;
    
    const text = extractMessageText(firstUserMsg).toLowerCase();
    
    // Check for action keywords
    const hasActionVerb = taskKeywords.some(keyword => text.includes(keyword));
    
    // Check for specific tool mentions (e.g., "search HubSpot")
    const mentionsTools = /\b(hubspot|jira|slack|github|gmail|calendar)\b/i.test(text);
    
    // Check for data-gathering phrases
    const isDataGathering = /\b(find|search|lookup|get|fetch|retrieve|list|show)\b/i.test(text);
    
    return hasActionVerb || mentionsTools || isDataGathering;
}

const DEFAULT_TASK_KEYWORDS = [
    "search", "find", "lookup", "get", "fetch", "retrieve",
    "create", "update", "delete", "modify", "add", "remove",
    "send", "post", "publish", "schedule", "book",
    "analyze", "summarize", "extract", "process",
    "list", "show", "display", "view", "check"
];

// Helper functions
function extractToolCallsFromMessage(msg: any): any[] {
    if (!msg.content || typeof msg.content !== "object") return [];
    if (!("parts" in msg.content)) return [];
    
    const parts = (msg.content as { parts: any[] }).parts;
    return parts.filter(p => p.type === "tool-call" || p.type === "tool-invocation");
}

function hasToolCallsInMessage(msg: any): boolean {
    return extractToolCallsFromMessage(msg).length > 0;
}

function extractMessageText(msg: any): string {
    if (typeof msg.content === "string") return msg.content;
    if (msg.content && typeof msg.content === "object" && "parts" in msg.content) {
        const parts = (msg.content as { parts: any[] }).parts;
        return parts
            .filter(p => p.type === "text")
            .map(p => p.text)
            .join(" ");
    }
    return "";
}
```

---

### Tool Availability Processor Implementation (Detailed)

**File**: `packages/agentc2/src/processors/tool-availability-processor.ts`

```typescript
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from "@mastra/core/processors";

export interface ToolAvailabilityConfig {
    enabled?: boolean;
    noToolCallThreshold?: number;
    trackAvailability?: boolean;
}

interface AvailabilityState {
    stepsSinceToolCall: number;
    lastToolCallStep: number;
    recentFailures: Record<string, { count: number; lastError: string; lastAttempt: number }>;
    recentSuccesses: Set<string>;
    encouragementInjected: boolean;
}

/**
 * Processor that tracks tool usage patterns and injects encouragement
 * when agents appear to be avoiding tools.
 */
export function createToolAvailabilityProcessor(
    config?: ToolAvailabilityConfig
): Processor<"tool-availability"> {
    const enabled = config?.enabled ?? true;
    const noToolCallThreshold = config?.noToolCallThreshold ?? 3;
    const trackAvailability = config?.trackAvailability ?? true;
    
    return {
        id: "tool-availability" as const,
        name: "Tool Availability Monitor",
        
        async processInputStep(
            args: ProcessInputStepArgs
        ): Promise<ProcessInputStepResult | undefined> {
            if (!enabled) return undefined;
            
            const { stepNumber, messages, systemMessages, state, steps } = args;
            const as = state as unknown as AvailabilityState;
            
            // Initialize state
            if (!as.stepsSinceToolCall) {
                as.stepsSinceToolCall = 0;
                as.lastToolCallStep = -1;
                as.recentFailures = {};
                as.recentSuccesses = new Set();
                as.encouragementInjected = false;
            }
            
            // Track tool calls from previous steps
            if (steps && steps.length > 0) {
                const lastStep = steps[steps.length - 1];
                const toolCalls = extractToolCallsFromStep(lastStep);
                
                if (toolCalls.length > 0) {
                    as.stepsSinceToolCall = 0;
                    as.lastToolCallStep = stepNumber - 1;
                    
                    // Track successes and failures
                    for (const tc of toolCalls) {
                        const toolName = tc.toolName || "unknown";
                        if (tc.result && !isErrorResult(tc.result)) {
                            as.recentSuccesses.add(toolName);
                            // Clear failure record if tool succeeds
                            delete as.recentFailures[toolName];
                        } else if (isErrorResult(tc.result)) {
                            const failure = as.recentFailures[toolName] || { 
                                count: 0, 
                                lastError: "", 
                                lastAttempt: 0 
                            };
                            failure.count++;
                            failure.lastError = extractErrorMessage(tc.result);
                            failure.lastAttempt = stepNumber - 1;
                            as.recentFailures[toolName] = failure;
                        }
                    }
                }
            }
            
            // Increment steps since last tool call
            if (as.lastToolCallStep !== stepNumber - 1) {
                as.stepsSinceToolCall++;
            }
            
            // Inject encouragement if agent is avoiding tools
            if (
                as.stepsSinceToolCall >= noToolCallThreshold &&
                !as.encouragementInjected &&
                stepNumber > 1  // Not on first step
            ) {
                as.encouragementInjected = true;
                
                console.log(
                    `[ToolAvailability] Step ${stepNumber}: No tool calls for ${as.stepsSinceToolCall} steps. Injecting encouragement.`
                );
                
                const encouragementMsg = buildEncouragementMessage(as);
                
                return {
                    systemMessages: [
                        ...systemMessages,
                        {
                            role: "system" as const,
                            content: encouragementMsg
                        }
                    ]
                };
            }
            
            return undefined;
        }
    };
}

function buildEncouragementMessage(state: AvailabilityState): string {
    const parts: string[] = [
        `[System] Tool Availability Notice:`,
        ``,
        `You have not used any tools for the last ${state.stepsSinceToolCall} steps.`
    ];
    
    if (state.recentSuccesses.size > 0) {
        parts.push(`Tools are available and working. Recent successful tools: ${Array.from(state.recentSuccesses).join(", ")}`);
    } else {
        parts.push(`Tools are available for use.`);
    }
    
    if (Object.keys(state.recentFailures).length > 0) {
        const failedTools = Object.entries(state.recentFailures)
            .filter(([_, f]) => f.count <= 2)  // Only mention if not persistently failing
            .map(([name, _]) => name);
        if (failedTools.length > 0) {
            parts.push(`Note: Some tools had transient errors but automatic retries are enabled.`);
        }
    }
    
    parts.push(
        ``,
        `Common mistakes:`,
        `- Assuming tools are unavailable without attempting to call them`,
        `- Giving up after seeing error messages from previous steps`,
        `- Stopping before completing the full task`,
        ``,
        `Please:`,
        `1. Attempt the necessary tool calls to complete your task`,
        `2. Transient errors (network, timeout) are automatically retried`,
        `3. Only report tool unavailability if you receive "[TOOL BLOCKED]" or "Tool not found"`,
        ``,
        `Continue with your task using available tools.`
    );
    
    return parts.join("\n");
}

function extractToolCallsFromStep(step: any): any[] {
    if (!step.toolCalls) return [];
    return Array.isArray(step.toolCalls) ? step.toolCalls : [];
}

function isErrorResult(result: any): boolean {
    if (!result) return false;
    
    const resultStr = typeof result === "string" 
        ? result 
        : JSON.stringify(result);
    
    return (
        resultStr.includes('"error"') ||
        resultStr.includes('"success":false') ||
        resultStr.includes("[TOOL BLOCKED]") ||
        resultStr.includes("Error:")
    );
}

function extractErrorMessage(result: any): string {
    if (typeof result === "string") return result;
    if (result && typeof result === "object" && "error" in result) {
        return String(result.error);
    }
    return JSON.stringify(result);
}
```

---

## Compatibility with Existing Features

### Integration with Permission Guards

**Current**: `wrapToolsWithPermissionGuard()` wraps tools to check permissions (resolver.ts:995)

**After Retry**: Chain the wrappers
```typescript
// 1. Apply permission guards first
wrapToolsWithPermissionGuard(tools, agentId, organizationId);

// 2. Apply retry wrapper second (wraps already-guarded tools)
wrapToolsWithRetry(tools, retryConfig);

// Execution flow:
// tool.execute(context)
//   → RetryWrapper
//     → PermissionGuard
//       → checkToolPermission() → pass/fail
//       → checkEgressPermission() → pass/fail
//       → OriginalExecute() → result/error
//     → If error and transient: retry from top
//     → If error and fatal: return immediately
```

**Key**: Permission checks are **re-executed on each retry**. This is correct behavior - permissions could theoretically change between attempts (though unlikely in practice).

---

### Integration with Tool Call Guard Processor

**Current**: `ToolCallGuardProcessor` tracks per-tool budget (8 calls), global budget (maxSteps × 2), and duplicate calls.

**After Retry**: Retries are **invisible to the processor**:
```typescript
// Scenario: Tool fails 2x, succeeds on 3rd attempt
// From processor's perspective: 1 tool call (the successful one)
// Retry counts don't increment per-tool budget

// Scenario: Tool is called 8 times by agent, 3 fail and retry
// Processor sees: 8 calls (budget limit hit)
// Retry wrapper: 3 tools had internal retries
// Total executions: 8 + (retries) = maybe 10-11 actual HTTP calls
```

**Benefit**: Retries don't penalize agents against their tool budget. An agent can still call a tool 8 times even if some calls internally retry.

**Risk**: If a tool always requires 2 retries, effective calls are higher. Mitigate by monitoring and fixing the underlying issue.

---

### Integration with Tool Result Compressor

**Current**: `ToolResultCompressorProcessor` compresses large tool results (>3KB) using LLM summarization.

**After Retry**: No changes needed. Compression happens **after** retry logic:
```typescript
// Flow:
tool.execute() 
  → Retry wrapper (if needed)
  → Returns result
  → Result added to messages
  → ToolResultCompressorProcessor.processOutputStep() 
  → Compresses if > threshold
```

Retry metadata (if present) is preserved in the result before compression.

---

### Integration with Memory System

**Current**: Agents have conversation memory via `@mastra/memory` (resolver.ts:1724-1738).

**After Retry**: Memory updates track retry metadata:
```typescript
// When recording tool calls to memory:
await workingMemory.append({
    role: "tool",
    toolName: "hubspot-get-user-details",
    result: { ... },
    metadata: {
        retryCount: 2,
        retriedOnce: true,
        transientError: true
    }
});
```

**Benefit**: Agents can learn from retry patterns across conversations. If a tool consistently needs retries, the agent might develop strategies to handle it better.

---

### Integration with Evaluation System

**Current**: Two-tier evaluation (Tier 1 heuristic, Tier 2 auditor).

**After Retry**:

**Tier 1 Changes** (tier1.ts:126):
```typescript
// Enhanced toolSuccess scorer
const retriedCalls = context.toolCalls.filter(tc => tc.wasRetried);
const successAfterRetry = retriedCalls.filter(tc => tc.success);

// Give partial credit for successful retries
const effectiveSuccess = baseSuccess + (successAfterRetry.length * 0.5);
scores.toolSuccess = effectiveSuccess / total;

// Add flags
if (retriedCalls.length > 0) {
    flags.push(`retries:${retriedCalls.length}`);
}
```

**Tier 2 Changes** (auditor.ts:144):
```typescript
// Add to failure mode classification prompt:
When evaluating TOOL_SELECTION_ERROR:
- If agent made ZERO tool calls: CRITICAL severity
- If agent called tools but they failed fatally: Not a selection error
- If agent called tools and they succeeded after retry: SUCCESS (not an error)
- Check retryCount in tool calls - automatic retries don't count against the agent
```

---

### Integration with Learning System

**Current**: Continuous learning harvests signals from runs (packages/agentc2/src/pulse/).

**After Retry**: New signal types:
- **Retry Success Pattern**: Tool X always needs retry → recommendation to improve infrastructure
- **Retry Failure Pattern**: Tool Y never succeeds after retry → recommendation to remove from agent
- **Zero-Tool Avoidance**: Agent consistently triggers minimum tool call guard → instruction improvement needed

**Learning Loop**:
1. Detect retry pattern across multiple runs
2. Generate improvement proposal
3. A/B test proposal vs baseline
4. Auto-approve if improvement confirmed

---

### Integration with Federation & Agent Cards

**Current**: Agents can expose services to other agents via federation (federation/agent-cards.ts).

**After Retry**: Retry logic applies to **federated tool calls**:
```typescript
// When Agent A calls Agent B's exposed tool:
// 1. Agent B's tool executes with retry wrapper
// 2. If transient error, retry happens
// 3. Agent A receives successful result (transparent)

// Rate limiting still applies per-agreement
// Circuit breaker (if implemented) would protect against retry storms
```

---

### Integration with Inngest Background Jobs

**Current**: Agents execute via Inngest functions (inngest-functions.ts:5640).

**After Retry**: Inngest steps see final result only:
```typescript
// Inngest function:
await step.run("execute-agent", async () => {
    const response = await agent.generate(input, { maxSteps });
    // response includes retry metadata in toolCalls
    return response;
});

// Retry happens WITHIN the step, not across steps
// Inngest's retry logic (for entire function) is separate
```

**Note**: Inngest function-level retries are for catastrophic failures (DB down, process crash). Tool-level retries are for individual tool transient errors.

---

## Implementation Challenges & Solutions

### Challenge 1: Mastra Agent.generate() is Opaque

**Problem**: The actual tool execution happens inside `@mastra/core`'s Agent.generate() method, which we don't control. We can't intercept tool calls at the framework level.

**Solution**: Wrap tools **before** passing them to the Agent constructor:
```typescript
// In AgentResolver.resolve():
// 1. Get tools from registry + MCP
const tools = { ...nativeTools, ...mcpTools };

// 2. Apply all wrappers
wrapToolsWithPermissionGuard(tools, agentId, organizationId);
wrapToolsWithRetry(tools, retryConfig);

// 3. Pass wrapped tools to Agent
const agent = new Agent({ tools, ... });

// Now when Mastra calls tool.execute(), it goes through all wrappers
```

This works because JavaScript allows us to mutate the `execute` function on tool objects.

---

### Challenge 2: Distinguishing Retry from Agent Self-Correction

**Problem**: If an agent calls the same tool twice (once fails, once succeeds), is that:
- A) Agent self-correcting (consumes 2 steps)
- B) Automatic retry (consumes 1 step)

**Solution**: Track retry metadata in the tool result:
```typescript
// Retry wrapper attaches metadata:
return {
    ...result,
    __retryMetadata: { retryCount: 2, totalDelayMs: 1500 }
};

// Run recorder checks for metadata:
if (result.__retryMetadata) {
    toolCall.wasRetried = true;
    toolCall.retryCount = result.__retryMetadata.retryCount;
}
```

This distinguishes automatic retries from agent-initiated retries.

---

### Challenge 3: Streaming UI Shows Stale "Calling Tool" Status

**Problem**: UI shows "Calling hubspot-get-user-details..." but tool is retrying for 3 seconds, no visual feedback.

**Solution**: Extend streaming protocol to include retry events:
```typescript
// In agent.stream() path (if we need to modify):
for await (const chunk of agent.stream(input)) {
    if (chunk.type === "tool-retry") {
        yield {
            type: "step-delta",
            stepType: "tool-retry",
            toolName: chunk.toolName,
            attempt: chunk.attempt,
            message: `Retrying ${chunk.toolName} (attempt ${chunk.attempt})...`
        };
    }
}
```

**Alternative**: Don't stream retry events, just show "Tool executing..." with a spinner. Most retries complete in <2s, which is acceptable latency.

---

### Challenge 4: Testing Transient Errors

**Problem**: How do we reliably test retry logic if errors are transient by nature?

**Solution**: Mock tool with controlled failure injection:
```typescript
// Test utility:
function createMockToolWithFailures(
    successAfterAttempts: number,
    errorType: "transient" | "fatal"
) {
    let attempts = 0;
    
    return {
        execute: async () => {
            attempts++;
            if (attempts < successAfterAttempts) {
                if (errorType === "transient") {
                    throw new Error("ECONNREFUSED");
                } else {
                    throw new Error("[TOOL BLOCKED] Permission denied");
                }
            }
            return { success: true, data: "result" };
        }
    };
}

// Test:
const tool = createMockToolWithFailures(3, "transient");
const wrapped = wrapToolExecute(tool.execute, "test-tool", { maxRetries: 2 });
const result = await wrapped({});
// Expect: 3 attempts, 2 retries, final success
```

---

### Challenge 5: Processor Execution Order Matters

**Problem**: If `MinimumToolCallProcessor` runs before `ToolCallGuardProcessor`, it might not see the tool calls yet.

**Solution**: Carefully order output processors:
```typescript
const outputProcessors = [
    createOutputGuardrailProcessor(),        // 1st: Safety checks
    createToolResultCompressorProcessor(),   // 2nd: Compress results
    createToolCallGuardProcessor(),          // 3rd: Budget enforcement
    createMinimumToolCallProcessor(),        // 4th: After tool calls processed
    new ToolCallFilter(),                    // 5th: Filter tool artifacts
    new TokenLimiter()                       // 6th: Final safety net
];
```

Processors run in array order. `MinimumToolCallProcessor` must run **after** tool results are processed but **before** the agent finalizes its response.

---

### Challenge 6: Retry Metadata in AI SDK Response Format

**Problem**: AI SDK responses have a specific format. Adding custom fields might break serialization.

**Solution**: Store retry metadata separately and merge during run recording:
```typescript
// During execution, track in side-channel:
const toolRetryMap = new Map<string, ToolRetryMetadata>();

tool.execute = async (context) => {
    const result = await withRetry(/* ... */);
    
    // Store metadata in side map
    if (retryMetadata.retryCount > 0) {
        toolRetryMap.set(toolCallId, retryMetadata);
    }
    
    return result;  // Don't modify result structure
};

// In run recorder:
for (const toolCall of extractToolCalls(response)) {
    const retryMeta = toolRetryMap.get(toolCall.id);
    
    await prisma.agentToolCall.create({
        data: {
            ...toolCall,
            retryCount: retryMeta?.retryCount ?? 0,
            retryHistoryJson: retryMeta?.retryHistory ?? null
        }
    });
}
```

**Alternative**: Use WeakMap for automatic cleanup, or attach metadata to tool result as `__retryMetadata` property (non-enumerable).

---

### Challenge 7: Retry Behavior in Test Mode vs Production

**Problem**: In automated tests, we want deterministic behavior. In production, we want real retries.

**Solution**: Environment-based configuration:
```typescript
// In test environment:
if (process.env.NODE_ENV === "test") {
    retryConfig.maxRetries = 0;  // Disable retries in tests by default
}

// Or per-test override:
agent.setRetryConfig({ maxRetries: 0 });  // Deterministic test behavior
agent.setRetryConfig({ maxRetries: 2 });  // Test retry logic specifically
```

**Test Modes**:
- **Unit tests**: Retries disabled by default (fast, deterministic)
- **Integration tests**: Retries enabled with mock errors (test retry logic)
- **E2E tests**: Retries enabled (real-world behavior)

---

## Detailed Sequence Diagrams

### Sequence 1: Successful Tool Call with Transient Error Recovery

```
User → Agent → ToolRetryWrapper → PermissionGuard → HubSpotAPI
  |       |            |                   |              |
  |       |            |                   |              |
  1. "Get contact info for john@example.com"
  |       |            |                   |              |
  |       2. Generate tool call: hubspot-get-contact
  |       |            |                   |              |
  |       3. Execute tool                  |              |
  |       |            |                   |              |
  |       |            4. Attempt 1        |              |
  |       |            |                   5. Check perms → PASS
  |       |            |                   |              |
  |       |            |                   6. Call API →  |
  |       |            |                   |              |
  |       |            |                   |              7. ECONNREFUSED
  |       |            |                   |              |
  |       |            8. Catch error (transient) → wait 500ms
  |       |            |                   |              |
  |       |            9. Attempt 2        |              |
  |       |            |                   10. Check perms → PASS
  |       |            |                   |              |
  |       |            |                   11. Call API → |
  |       |            |                   |              |
  |       |            |                   |              12. 200 OK {data}
  |       |            |                   |              |
  |       |            13. Return { success: true, result: {data}, __retryMetadata: {retryCount: 1} }
  |       |            |                   |              |
  |       14. Record tool call (success=true, retryCount=1, wasRetried=true)
  |       |            |                   |              |
  |       15. Generate response: "John's contact info: ..."
  |       |            |                   |              |
  |       ←─────────── Response ────────────────────────────
  |       |            |                   |              |
```

**Key Points**:
- Agent consumed **1 step** (retry was transparent)
- Total duration: ~1.5s (includes 500ms retry delay)
- Database records retry metadata for analytics
- Agent successfully completed task despite transient error

---

### Sequence 2: Zero-Tool-Call Prevention

```
User → Agent → MinimumToolCallProcessor → Agent (retry)
  |       |                |                    |
  |       |                |                    |
  1. "Search Jira for tickets assigned to me"
  |       |                |                    |
  |       2. Generate response WITHOUT calling tools
  |       |                |                    |
  |       3. Output: "Jira tools are currently unavailable"
  |       |                |                    |
  |       |                4. processOutputResult()
  |       |                |                    |
  |       |                5. Check: totalToolCalls === 0? YES
  |       |                6. Check: taskRequiresTools? YES (keyword: "search")
  |       |                7. Check: retryCount < 1? YES
  |       |                |                    |
  |       |                8. abort("[System] You must use at least 1 tool...", {retry: true})
  |       |                |                    |
  |       9. Retry with injected message
  |       |                |                    |
  |       10. Generate tool call: jira_search-issues
  |       |                |                    |
  |       11. Execute tool → success
  |       |                |                    |
  |       12. Generate response: "Found 3 tickets: ..."
  |       |                |                    |
  |       |                13. processOutputResult()
  |       |                |                    |
  |       |                14. Check: totalToolCalls === 1? YES → PASS
  |       |                |                    |
  |       ←─────────── Response ────────────────
  |       |                |                    |
```

**Key Points**:
- First attempt: 0 tool calls → forced retry
- Second attempt: 1 tool call → success
- Agent consumed **2 steps** (1 failed attempt + 1 retry)
- Database records `ZeroToolCallPreventionEvent`

---

### Sequence 3: Multi-Layer Defense Against Persistent Failure

```
Tool fails persistently → All layers respond:

Layer 1 (Retry Wrapper):
  Attempt 1: ECONNREFUSED → wait 500ms
  Attempt 2: ECONNREFUSED → wait 1200ms
  Attempt 3: ECONNREFUSED → return error
  Result: { success: false, error: "...", retryCount: 2 }

Layer 2 (Tool Availability Processor):
  Step 1: Tool failed (recorded in recentFailures)
  Step 2: No tool call
  Step 3: No tool call
  Step 4: Inject encouragement: "Tool X had transient errors..."
  Agent: Tries tool again OR uses alternative

Layer 3 (Minimum Tool Call):
  If agent tries to finish without ANY successful tools:
  → Force retry with clear guidance
  → Agent must either succeed with tools OR explain why unavailable

Final Outcome:
  - Best case: Retry succeeds after encouragement
  - Fallback: Agent explains tool unavailability with evidence
  - Never: Silent failure with zero tool calls
```

---

## Performance Optimization Strategies

### Optimization 1: Retry Budget Tracking

**Goal**: Prevent excessive retries in a single run from degrading performance.

**Implementation**:
```typescript
interface RunRetryBudget {
    maxTotalRetries: number;      // e.g., maxSteps * 1.5
    retriesSoFar: number;
    retryBudgetExhausted: boolean;
}

// Before retrying:
if (runState.retriesSoFar >= runState.maxTotalRetries) {
    console.warn(`[ToolRetry] Run retry budget exhausted (${runState.retriesSoFar}/${runState.maxTotalRetries})`);
    throw error;  // No more retries this run
}

runState.retriesSoFar++;
```

**Benefit**: Caps worst-case retry overhead per run.

---

### Optimization 2: Parallel Tool Call Retries

**Goal**: If agent calls multiple tools simultaneously (future feature), retry them in parallel.

**Implementation**:
```typescript
// When agent makes parallel tool calls:
const results = await Promise.allSettled(
    toolCalls.map(tc => executeToolWithRetry(tc.toolName, tc.args))
);

// Each tool retries independently without blocking others
```

**Note**: Current Mastra implementation doesn't support parallel tool calls, but planning for future.

---

### Optimization 3: Retry Cache

**Goal**: If the same tool with same parameters is called multiple times in a run and fails transiently, cache the failure and retry result.

**Implementation**:
```typescript
interface RetryCacheEntry {
    toolName: string;
    argsHash: string;
    result: any;
    timestamp: number;
    ttlMs: number;
}

const retryCache = new Map<string, RetryCacheEntry>();

// Before retrying:
const cacheKey = `${toolName}::${hashArgs(args)}`;
const cached = retryCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
    return cached.result;  // Skip retry, use cached result
}
```

**Caution**: Only cache for **read-only** tools. Mutations should never be cached.

---

### Optimization 4: Adaptive Retry Delays

**Goal**: Learn optimal retry delays per tool/error type from historical data.

**Implementation** (Future Phase):
```typescript
// Query ToolRetryEvent table:
const avgSuccessDelay = await prisma.toolRetryEvent.aggregate({
    where: {
        toolKey: "hubspot-get-contact",
        errorType: "ECONNREFUSED",
        succeeded: true
    },
    _avg: { delayMs: true }
});

// Use learned delay for future retries:
retryConfig.initialDelayMs = avgSuccessDelay._avg.delayMs ?? 500;
```

**Benefit**: Minimize retry latency by using optimal delays based on real data.

---

## Appendix A: Evidence Analysis

### Run cmmmvj3kw00a58exvmha1e3jv

**Symptoms**:
- Agent: sdlc-signal-harvester
- maxSteps: 30
- Tool calls: **0**
- Completion tokens: 44
- Duration: 2046ms
- Output: "Jira tools are currently unavailable"
- Evaluation: 0.225 score, CRITICAL: TOOL_SELECTION_ERROR

**Root Cause**: Agent preemptively avoided tools without attempting them.

**Fix**: 
- Minimum tool call processor will force retry
- Tool availability processor will inject encouragement
- Enhanced prompting will clarify that tools should be attempted

---

### Run cmmmvd41b008l8exvctdhd9vd

**Symptoms**:
- Tool calls: 4 (successful)
- Completion tokens: 137
- Remaining steps: 26
- Behavior: Stopped early despite successful tool usage

**Root Cause**: Agent didn't recognize the task required multiple phases:
1. Gather data (✅ completed)
2. Analyze data (❌ not attempted)
3. Generate response (✅ partial)

**Fix**:
- Enhanced step anchor processor will encourage continuation
- Better mid-task prompting at step 15/30
- Not directly related to retry logic, but improved by continuation guidance

---

## Appendix B: Error Type Taxonomy

### Transient Errors (Retryable)

| Error Type | Example | Retry Recommended | Typical Recovery Time |
|------------|---------|-------------------|----------------------|
| **Network Timeout** | `ETIMEDOUT`, `timeout` | ✅ Yes, 2 retries | 500-2000ms |
| **Connection Refused** | `ECONNREFUSED` | ✅ Yes, 2 retries | 1000-3000ms |
| **Connection Reset** | `ECONNRESET` | ✅ Yes, 2 retries | 500-2000ms |
| **Socket Errors** | `socket hang up`, `EPIPE` | ✅ Yes, 2 retries | 1000-3000ms |
| **Rate Limited** | `429 Too Many Requests` | ✅ Yes, 2 retries | Use Retry-After header |
| **Bad Gateway** | `502 Bad Gateway` | ✅ Yes, 1 retry | 1000-2000ms |
| **Service Unavailable** | `503 Service Unavailable` | ✅ Yes, 2 retries | 2000-5000ms |
| **Gateway Timeout** | `504 Gateway Timeout` | ✅ Yes, 1 retry | 3000-5000ms |
| **MCP Server Lost** | `server connection lost` | ✅ Yes, 2 retries | 2000-4000ms |

### Fatal Errors (Not Retryable)

| Error Type | Example | Retry Recommended | Resolution |
|------------|---------|-------------------|------------|
| **Permission Denied** | `[TOOL BLOCKED] Permission denied` | ❌ No | Fix agent permissions |
| **Tool Not Found** | `Tool not found: hubspot_...` | ❌ No | Configure MCP server |
| **Insufficient Access** | `requires admin, caller has member` | ❌ No | Update agent access level |
| **Invalid Parameters** | `Invalid parameters: email required` | ❌ No | Fix tool arguments |
| **Egress Blocked** | `[TOOL BLOCKED] Egress denied` | ❌ No | Update egress policy |
| **Authentication Failed** | `401 Unauthorized` (without refresh) | ❌ No | Re-authenticate integration |
| **Not Found** | `404 Not Found` | ❌ No | Resource doesn't exist |
| **Bad Request** | `400 Bad Request` | ❌ No | Fix request payload |

---

## Appendix C: Code Locations Reference

### Key Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `packages/agentc2/src/agents/resolver.ts` | 995-1024 | Add retry wrapper after permission guard |
| `packages/agentc2/src/agents/resolver.ts` | 1057-1085 | Add new processors to pipeline |
| `packages/agentc2/src/mcp/client.ts` | 5018-5028 | Wrap tool execution with retry |
| `packages/agentc2/src/processors/step-anchor.ts` | 98-104 | Enhance continuation prompting |
| `packages/agentc2/src/schemas/agent.ts` | 49-67 | Extend contextConfigSchema |
| `packages/database/prisma/schema.prisma` | 1697-1720 | Add retry fields to AgentToolCall |
| `apps/agent/src/lib/run-recorder.ts` | 616-917 | Track retry metadata |
| `packages/agentc2/src/scorers/tier1.ts` | 126-136 | Account for retries in scoring |

### New Files to Create

| File | Purpose | Lines (Est.) |
|------|---------|--------------|
| `packages/agentc2/src/security/tool-retry-wrapper.ts` | Retry wrapper and error classifier | ~250 |
| `packages/agentc2/src/processors/tool-availability-processor.ts` | Encouragement injection processor | ~200 |
| `packages/agentc2/src/processors/minimum-tool-call-processor.ts` | Zero-tool prevention processor | ~180 |
| `packages/agentc2/src/security/tool-retry-wrapper.test.ts` | Unit tests for retry wrapper | ~300 |
| `packages/agentc2/src/processors/tool-availability-processor.test.ts` | Unit tests for availability processor | ~200 |
| `packages/agentc2/src/processors/minimum-tool-call-processor.test.ts` | Unit tests for minimum tool processor | ~200 |
| `apps/agent/__tests__/tool-retries.integration.test.ts` | Integration tests | ~400 |
| `apps/agent/src/app/api/agents/[id]/analytics/retries/route.ts` | Retry analytics API | ~150 |
| `apps/agent/src/app/agents/[agentSlug]/analytics/retries/page.tsx` | Retry dashboard UI | ~300 |

**Total New Code**: ~2,180 lines

---

## Appendix D: Testing Checklist

### Unit Tests

- [ ] `tool-retry-wrapper.test.ts`
  - [ ] Retry on transient network error
  - [ ] No retry on fatal error
  - [ ] Exponential backoff calculation
  - [ ] Jitter randomization
  - [ ] Max retries enforcement
  - [ ] Custom isRetryable function
  - [ ] onRetry callback invoked

- [ ] `tool-availability-processor.test.ts`
  - [ ] Encouragement injection after N steps
  - [ ] State tracking across steps
  - [ ] No injection if tools recently called
  - [ ] Custom threshold configuration

- [ ] `minimum-tool-call-processor.test.ts`
  - [ ] Enforce minimum for high-maxSteps tasks
  - [ ] Skip enforcement for low-maxSteps tasks
  - [ ] Task detection heuristic
  - [ ] Abort with retry behavior
  - [ ] No false positives on legitimate zero-tool tasks

### Integration Tests

- [ ] `tool-retries.integration.test.ts`
  - [ ] Mock tool fails once, succeeds on retry → agent sees success
  - [ ] Mock tool fails fatally → agent sees error immediately
  - [ ] Mock tool fails 3 times → agent sees final error after 2 retries
  - [ ] Retry metadata recorded in database
  - [ ] Retry telemetry event emitted

- [ ] `zero-tool-prevention.integration.test.ts`
  - [ ] Agent with maxSteps=30, tries to respond without tools → retry forced
  - [ ] Agent with maxSteps=5, responds without tools → allowed
  - [ ] Agent makes 1 tool call → minimum satisfied

- [ ] `step-continuation.integration.test.ts`
  - [ ] Agent stops after 4/30 steps with successful tools → encouraged to continue
  - [ ] Agent reaches final step → wraps up cleanly

### End-to-End Tests

- [ ] Re-run SDLC Signal Harvester (Run cmmmvj3kw00a58exvmha1e3jv)
  - [ ] Verify agent attempts Jira tool calls
  - [ ] Verify tool calls succeed (or retry on transient error)
  - [ ] Verify no TOOL_SELECTION_ERROR

- [ ] HubSpot CRM workflow with injected failure
  - [ ] Inject ECONNREFUSED on first call
  - [ ] Verify automatic retry succeeds
  - [ ] Verify run completes successfully
  - [ ] Verify retry metadata in database

- [ ] Multi-step research task
  - [ ] Task: "Search HubSpot for client X, then web search for recent news"
  - [ ] Inject 503 error on first HubSpot call
  - [ ] Verify retry succeeds
  - [ ] Verify agent continues to web search
  - [ ] Verify both phases complete

---

## Conclusion

This design implements a **comprehensive, multi-layered approach** to tool call retry logic that addresses the root causes identified in the evidence:

1. **Transparent runtime retries** solve the immediate problem of transient failures
2. **Agent behavior processors** prevent premature termination and tool avoidance
3. **Enhanced error context** helps agents make better decisions
4. **Observability** enables monitoring and tuning

The approach is:
- ✅ **Backward compatible** - existing agents continue to work
- ✅ **Configurable** - can be tuned per-agent
- ✅ **Observable** - full telemetry and analytics
- ✅ **Testable** - comprehensive test strategy
- ✅ **Rollback-safe** - can be disabled with a single flag

**Estimated Implementation Time**: 10 days (4 phases)  
**Estimated Testing Time**: 3 days  
**Estimated Tuning Period**: 1 week in production

**Total Time to Stable Release**: ~3 weeks

---

## Next Steps

1. **Review this design** with stakeholders
2. **Approve or request changes** to the approach
3. **Create implementation tickets** for each phase
4. **Assign to engineering team**
5. **Begin Phase 1 implementation**

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-12  
**Author**: Claude (AgentC2 Design Assistant)  
**Reviewers**: [To be assigned]

# Root Cause Analysis: Signature Attribution Footer Validation

**Bug Report**: [Test] Signature attribution footer validation  
**GitHub Issue**: https://github.com/Appello-Prototypes/agentc2/issues/22  
**Date**: 2026-02-28  
**Status**: Analysis Complete

---

## Executive Summary

GitHub artifacts (issues, comments, PRs) created by AgentC2 workflows lack proper attribution footers. While a minimal footer exists in issue creation, it's incomplete and inconsistent. The root cause is that **workflow execution context is not passed to tools**, preventing them from including workflow metadata (workflow slug, run ID, step ID, agent identifier) in generated artifacts.

**Impact**: Medium  
**Complexity**: Medium  
**Risk**: Low

---

## Bug Description

According to the acceptance criteria, GitHub artifacts should include:
- Issue body with AgentC2 signature footer
- Analysis comments with AgentC2 signature footer
- Each footer should include: workflow slug, run ID, and step ID

**Expected Format** (from GitHub Issue #22):
```markdown
---
🤖 _Automated by [AgentC2](https://agentc2.ai) | Workflow: `sdlc-bugfix` | Run: [`73a03f28-315…`](https://agentc2.ai/workflows/sdlc-bugfix/runs/73a03f28-3152-4060-93a9-521029168c17) | Step: `intake`_
```

**Current State**:
- Issue creation has minimal footer: `_Created from ticket \`${sourceTicketId}\` via AgentC2 SDLC Pipeline_`
- Comments have NO footer at all
- No workflow metadata included anywhere

---

## Root Cause Analysis

### 1. Issue Creation Tool (`ticket-to-github-issue.ts`)

**Location**: `packages/agentc2/src/tools/ticket-to-github-issue.ts:84-86`

**Current Implementation**:
```typescript
const footer = sourceTicketId
    ? `\n\n---\n_Created from ticket \`${sourceTicketId}\` via AgentC2 SDLC Pipeline_`
    : "";
```

**Problem**: The footer is hardcoded and only includes `sourceTicketId`. It has no access to:
- Workflow run ID
- Workflow slug  
- Step ID
- Agent slug

### 2. Comment Creation Tool (`github-add-issue-comment.ts`)

**Location**: `packages/agentc2/src/tools/github-issue-comment.ts:28-52`

**Current Implementation**:
```typescript
execute: async ({ repository, issueNumber, body, organizationId }) => {
    // ... creates comment with body as-is, NO footer added ...
}
```

**Problem**: No footer logic exists at all. Comments are posted with the exact body provided by the caller.

### 3. Workflow Runtime Execution Context

**Location**: `packages/agentc2/src/workflows/builder/runtime.ts:306-342`

**Current Implementation**:
```typescript
async function executeToolStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext
) {
    const config = (step.config || {}) as unknown as WorkflowToolConfig;
    const input = resolveInputMapping(step.inputMapping || config.parameters, context);
    
    // Only organizationId is auto-injected:
    if (organizationId && typeof input === "object" && input !== null && !("organizationId" in input)) {
        (input as Record<string, unknown>).organizationId = organizationId;
    }
    
    const rawResult = await handler(input);
    return unwrapToolResult(rawResult);
}
```

**Problem**: The workflow runtime has access to:
- `step.id` (current step ID)
- Workflow run ID (stored in database via `/api/workflows/[slug]/execute/route.ts:37-49`)
- Workflow slug (from route params)
- Agent slug (if step type is "agent", stored in `config.agentSlug`)

BUT **none of this metadata is passed to tools**. Only `organizationId` is auto-injected.

### 4. Workflow-to-Database Flow

**Location**: `apps/agent/src/app/api/workflows/[slug]/execute/route.ts:37-49`

**Implementation**:
```typescript
const run = await prisma.workflowRun.create({
    data: {
        workflowId: workflow.id,
        status: "RUNNING",
        inputJson: input,
        source: body.source || "api",
        // ... workflow run is created with ID ...
    }
});

const result = await executeWorkflowDefinition({
    definition: workflow.definitionJson as unknown as WorkflowDefinition,
    input,
    requestContext: body.requestContext
});
```

**Problem**: The `run.id` (workflow run ID) and `workflow.slug` are available in the route handler, but **not passed into `executeWorkflowDefinition`**. The workflow runtime has no way to access this metadata.

---

## Affected Code Paths

### Files Requiring Modification

1. **`packages/agentc2/src/tools/ticket-to-github-issue.ts`**
   - Line 84-86: Footer generation
   - Line 56-66: Tool input schema (needs new optional params)
   - Line 96-101: GitHub API call (use enriched footer)

2. **`packages/agentc2/src/tools/github-issue-comment.ts`**
   - Line 18-22: Input schema (needs new optional params)
   - Line 28-39: Execute function (needs footer generation logic)

3. **`packages/agentc2/src/workflows/builder/runtime.ts`**
   - Line 22-30: `ExecuteWorkflowOptions` interface (needs workflowRunId, workflowSlug)
   - Line 306-342: `executeToolStep` function (needs to inject workflow context)
   - Line 718-740: `executeWorkflowDefinition` function (needs to accept and propagate metadata)

4. **`packages/agentc2/src/workflows/builder/types.ts`**
   - Line 99-106: `WorkflowExecutionContext` interface (needs runtime metadata)

5. **`apps/agent/src/app/api/workflows/[slug]/execute/route.ts`**
   - Line 71-75: Call to `executeWorkflowDefinition` (needs to pass workflowRunId and workflowSlug)

6. **Shared Footer Utility (NEW FILE)**
   - Create `packages/agentc2/src/tools/github-attribution-footer.ts`
   - Centralized footer generation for consistency

---

## Impact Assessment

### Affected Components

| Component | Impact | Reason |
|-----------|--------|--------|
| **GitHub Issue Creation** | High | Issues lack proper attribution |
| **GitHub Comment Creation** | High | Comments have no attribution at all |
| **Workflow Runtime** | Medium | Architecture change needed (context propagation) |
| **Tool Input Schemas** | Low | Additive change (optional params) |
| **Database Schema** | None | No schema changes needed |
| **MCP Integrations** | None | Tools remain backward compatible |

### Side Effects

1. **Backward Compatibility**: 
   - ✅ New parameters will be optional
   - ✅ Existing tool calls without workflow context will continue to work
   - ✅ Legacy footer format will be preserved when workflow context is unavailable

2. **Performance**:
   - ✅ Minimal - just string concatenation for footer
   - ✅ No additional API calls or database queries

3. **Testing**:
   - ⚠️ Need to test workflow execution with new context propagation
   - ⚠️ Need to test footer generation in different scenarios (with/without context)
   - ⚠️ Need to test backward compatibility (tools called outside workflows)

---

## Detailed Fix Plan

### Phase 1: Create Centralized Footer Utility

**File**: `packages/agentc2/src/tools/github-attribution-footer.ts` (NEW)

**Purpose**: Provide a single source of truth for attribution footer generation.

**Implementation**:
```typescript
export interface AttributionContext {
    workflowSlug?: string;
    workflowRunId?: string;
    stepId?: string;
    agentSlug?: string;
    sourceTicketId?: string;
}

export function generateAttributionFooter(context: AttributionContext): string {
    const parts: string[] = [];
    
    if (context.workflowSlug || context.workflowRunId || context.stepId) {
        parts.push("🤖 _Automated by [AgentC2](https://agentc2.ai)");
        
        if (context.workflowSlug) {
            parts.push(`Workflow: \`${context.workflowSlug}\``);
        }
        
        if (context.workflowRunId && context.workflowSlug) {
            const truncatedId = context.workflowRunId.substring(0, 11) + "…";
            const runUrl = `https://agentc2.ai/workflows/${context.workflowSlug}/runs/${context.workflowRunId}`;
            parts.push(`Run: [\`${truncatedId}\`](${runUrl})`);
        }
        
        if (context.stepId) {
            parts.push(`Step: \`${context.stepId}\``);
        }
        
        return `\n\n---\n${parts.join(" | ")}_`;
    } else if (context.sourceTicketId) {
        // Legacy fallback
        return `\n\n---\n_Created from ticket \`${context.sourceTicketId}\` via AgentC2 SDLC Pipeline_`;
    }
    
    return "";
}
```

**Risk**: Low - New utility, no existing code depends on it  
**Estimated Effort**: 1 hour (including tests)

---

### Phase 2: Extend Workflow Runtime Context

**2.1 Update Type Definitions**

**File**: `packages/agentc2/src/workflows/builder/types.ts`

**Changes**:
```typescript
export interface WorkflowExecutionContext {
    input: unknown;
    steps: Record<string, unknown>;
    variables: Record<string, unknown>;
    env?: Record<string, string>;
    helpers?: Record<string, (...args: unknown[]) => unknown>;
    // NEW: Runtime metadata
    runtime?: {
        workflowRunId: string;
        workflowSlug: string;
        currentStepId?: string;  // Set during step execution
    };
}
```

**Risk**: Low - Additive change, optional field  
**Estimated Effort**: 30 minutes

**2.2 Update Runtime Execution**

**File**: `packages/agentc2/src/workflows/builder/runtime.ts`

**Changes**:
```typescript
// Update interface (line 22-30)
interface ExecuteWorkflowOptions {
    definition: WorkflowDefinition;
    input: unknown;
    resume?: WorkflowResumeInput;
    existingSteps?: Record<string, unknown>;
    onStepEvent?: (event: WorkflowExecutionStep) => void;
    requestContext?: RequestContext;
    depth?: number;
    // NEW:
    workflowRunId?: string;
    workflowSlug?: string;
}

// Initialize context with runtime metadata (line 731-737)
const context: WorkflowExecutionContext = {
    input: options.input,
    steps: options.existingSteps ? { ...options.existingSteps } : {},
    variables: {},
    env: getEnvContext(),
    helpers: getHelpers(),
    // NEW:
    runtime: options.workflowRunId && options.workflowSlug ? {
        workflowRunId: options.workflowRunId,
        workflowSlug: options.workflowSlug
    } : undefined
};

// Set currentStepId during execution (line 414, inside loop)
if (context.runtime) {
    context.runtime.currentStepId = step.id;
}

// Inject runtime context into tool inputs (line 323-327)
const input = resolveInputMapping(step.inputMapping || config.parameters, context);

if (organizationId && typeof input === "object" && input !== null && !("organizationId" in input)) {
    (input as Record<string, unknown>).organizationId = organizationId;
}

// NEW: Inject workflow context for GitHub tools
if (context.runtime && typeof input === "object" && input !== null) {
    const toolId = config.toolId;
    if (toolId === "ticket-to-github-issue" || toolId === "github-add-issue-comment") {
        if (!input.workflowRunId) input.workflowRunId = context.runtime.workflowRunId;
        if (!input.workflowSlug) input.workflowSlug = context.runtime.workflowSlug;
        if (!input.stepId) input.stepId = context.runtime.currentStepId;
        
        // For agent steps, inject agent slug
        if (context.steps["_lastAgentSlug"]) {
            if (!input.agentSlug) input.agentSlug = context.steps["_lastAgentSlug"];
        }
    }
}
```

**Risk**: Medium - Core workflow execution logic  
**Estimated Effort**: 2 hours (including careful testing)

---

### Phase 3: Update API Route to Pass Workflow Metadata

**File**: `apps/agent/src/app/api/workflows/[slug]/execute/route.ts`

**Changes**:
```typescript
// Line 71-75
const result = await executeWorkflowDefinition({
    definition: workflow.definitionJson as unknown as WorkflowDefinition,
    input,
    requestContext: body.requestContext,
    // NEW:
    workflowRunId: run.id,
    workflowSlug: workflow.slug
});
```

**Risk**: Low - Straightforward parameter passing  
**Estimated Effort**: 15 minutes

---

### Phase 4: Update GitHub Tools

**4.1 Update `ticket-to-github-issue` Tool**

**File**: `packages/agentc2/src/tools/ticket-to-github-issue.ts`

**Changes**:
```typescript
import { generateAttributionFooter, type AttributionContext } from "./github-attribution-footer";

// Update input schema (line 19-49)
inputSchema: z.object({
    title: z.string().describe("Issue title"),
    description: z.string().describe("Issue body/description (Markdown supported)"),
    repository: z.string().describe("Target GitHub repository in owner/repo format"),
    labels: z.array(z.string()).optional(),
    sourceTicketId: z.string().optional(),
    pipelineRunId: z.string().optional(),
    organizationId: z.string().optional(),
    existingIssueUrl: z.string().optional(),
    existingIssueNumber: z.number().optional(),
    // NEW:
    workflowRunId: z.string().optional().describe("Workflow run ID for attribution footer"),
    workflowSlug: z.string().optional().describe("Workflow slug for attribution footer"),
    stepId: z.string().optional().describe("Step ID for attribution footer"),
    agentSlug: z.string().optional().describe("Agent slug for attribution footer")
}),

// Update execute function (line 56-66)
execute: async ({
    title,
    description,
    repository,
    labels,
    sourceTicketId,
    pipelineRunId,
    organizationId,
    existingIssueUrl,
    existingIssueNumber,
    // NEW:
    workflowRunId,
    workflowSlug,
    stepId,
    agentSlug
}) => {
    if (existingIssueUrl) {
        const issueNumber = existingIssueNumber ?? (Number(existingIssueUrl.split("/").pop()) || 0);
        return {
            issueNumber,
            issueUrl: existingIssueUrl,
            repository,
            linked: false
        };
    }

    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
        throw new Error(`Invalid repository format "${repository}". Expected "owner/repo".`);
    }

    const token = await resolveGitHubToken(organizationId);
    
    // NEW: Generate attribution footer
    const footer = generateAttributionFooter({
        workflowSlug,
        workflowRunId,
        stepId,
        agentSlug,
        sourceTicketId
    });

    // ... rest of the function ...
}
```

**Risk**: Low - Additive changes with backward compatibility  
**Estimated Effort**: 1 hour

**4.2 Update `github-add-issue-comment` Tool**

**File**: `packages/agentc2/src/tools/github-issue-comment.ts`

**Changes**:
```typescript
import { generateAttributionFooter, type AttributionContext } from "./github-attribution-footer";

// Update input schema (line 18-22)
inputSchema: z.object({
    repository: z.string().describe("GitHub repository in owner/repo format or full URL"),
    issueNumber: z.number().describe("Issue number to comment on"),
    body: z.string().describe("Comment body (Markdown supported)"),
    organizationId: z.string().optional().describe("Organization ID for credential lookup"),
    // NEW:
    workflowRunId: z.string().optional().describe("Workflow run ID for attribution footer"),
    workflowSlug: z.string().optional().describe("Workflow slug for attribution footer"),
    stepId: z.string().optional().describe("Step ID for attribution footer"),
    agentSlug: z.string().optional().describe("Agent slug for attribution footer")
}),

// Update execute function (line 28-52)
execute: async ({
    repository,
    issueNumber,
    body,
    organizationId,
    // NEW:
    workflowRunId,
    workflowSlug,
    stepId,
    agentSlug
}) => {
    const token = await resolveGitHubToken(organizationId);
    const { owner, repo } = parseRepoOwnerName(repository);

    // NEW: Append attribution footer
    const footer = generateAttributionFooter({
        workflowSlug,
        workflowRunId,
        stepId,
        agentSlug
    });
    const commentBody = body + footer;

    const response = await githubFetch(
        `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        token,
        {
            method: "POST",
            body: JSON.stringify({ body: commentBody })
        }
    );
    
    // ... rest of the function ...
}
```

**Risk**: Low - Additive changes with backward compatibility  
**Estimated Effort**: 45 minutes

---

### Phase 5: Add Agent Slug Tracking

**File**: `packages/agentc2/src/workflows/builder/runtime.ts`

**Changes**:
```typescript
// After agent step execution (line 304)
async function executeAgentStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext
) {
    const config = (step.config || {}) as unknown as WorkflowAgentConfig;
    const agentSlug = config.agentSlug;
    // ... existing code ...
    
    const result = {
        text: response.text,
        result: response.text,
        toolCalls: response.toolCalls || [],
        _agentSlug: agentSlug
    };
    
    // NEW: Track last agent for downstream tool attribution
    context.steps["_lastAgentSlug"] = agentSlug;
    
    return result;
}
```

**Risk**: Low - Internal tracking mechanism  
**Estimated Effort**: 15 minutes

---

## Testing Strategy

### Unit Tests

1. **Footer Generation Tests**
   - Test all combinations of context parameters
   - Test legacy fallback behavior
   - Test empty/missing context

   **File**: `tests/unit/github-attribution-footer.test.ts` (NEW)
   ```typescript
   describe("generateAttributionFooter", () => {
       it("generates full footer with all context", () => {
           const result = generateAttributionFooter({
               workflowSlug: "sdlc-bugfix",
               workflowRunId: "73a03f28-3152-4060-93a9-521029168c17",
               stepId: "intake",
               agentSlug: "sdlc-planner"
           });
           expect(result).toContain("sdlc-bugfix");
           expect(result).toContain("73a03f28-31");
           expect(result).toContain("intake");
       });
       
       it("falls back to legacy format when only sourceTicketId present", () => {
           const result = generateAttributionFooter({
               sourceTicketId: "TICKET-123"
           });
           expect(result).toContain("Created from ticket `TICKET-123`");
       });
       
       it("returns empty string when no context", () => {
           const result = generateAttributionFooter({});
           expect(result).toBe("");
       });
   });
   ```

2. **Tool Input Schema Tests**
   - Verify new optional parameters are accepted
   - Verify backward compatibility (old schema still works)

3. **Workflow Context Propagation Tests**
   - Test that runtime metadata flows through workflow execution
   - Test that tools receive correct context
   - Test nested workflow calls

   **File**: `tests/unit/workflow-context-propagation.test.ts` (NEW)

### Integration Tests

1. **End-to-End Workflow Test**
   - Execute a workflow that creates a GitHub issue
   - Verify the issue contains proper attribution footer
   - Execute a workflow that posts a comment
   - Verify the comment contains proper attribution footer

   **File**: `tests/integration/workflows/github-attribution.test.ts` (NEW)

2. **Backward Compatibility Test**
   - Call tools directly (not via workflow)
   - Verify they still work without workflow context
   - Verify legacy footer format is used

### Manual Validation

1. Create a test workflow with multiple steps:
   - Step 1: Create GitHub issue (`ticket-to-github-issue`)
   - Step 2: Post analysis comment (`github-add-issue-comment`)
2. Execute workflow and verify:
   - Issue footer includes workflow slug, run ID, step ID
   - Comment footer includes workflow slug, run ID, step ID
   - Links in footer are functional

---

## Risk Assessment

### Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Context propagation breaks existing workflows | Low | High | Comprehensive testing, optional params |
| Footer generation has edge cases | Medium | Low | Thorough unit tests, fallback logic |
| Performance regression | Very Low | Low | Footer generation is lightweight |
| Workflow runtime regression | Low | High | Careful code review, integration tests |

### Overall Risk: **Low**

- All changes are additive (optional parameters)
- Backward compatibility maintained throughout
- Localized changes with clear boundaries
- No database schema changes required

---

## Complexity Estimate

| Phase | Complexity | Estimated Time |
|-------|-----------|---------------|
| Phase 1: Footer Utility | Low | 1 hour |
| Phase 2: Workflow Runtime | Medium | 2 hours |
| Phase 3: API Route | Low | 15 minutes |
| Phase 4: GitHub Tools | Low-Medium | 1.75 hours |
| Phase 5: Agent Tracking | Low | 15 minutes |
| Testing | Medium | 3 hours |
| Code Review & Refinement | - | 1 hour |

**Total Estimated Effort**: 9 hours

---

## Recommended Implementation Order

1. ✅ **Phase 1**: Create footer utility (can be done independently)
2. ✅ **Phase 2.1**: Update type definitions (low risk, enables later phases)
3. ✅ **Phase 4**: Update GitHub tools to accept new params (can be tested in isolation)
4. ✅ **Phase 5**: Add agent slug tracking (small change, low risk)
5. ✅ **Phase 2.2**: Update workflow runtime (depends on types, tools must accept params first)
6. ✅ **Phase 3**: Update API route (final integration point)
7. ✅ **Testing**: Comprehensive test suite
8. ✅ **Validation**: Manual end-to-end verification

---

## Alternative Approaches Considered

### Alternative 1: Global Context via AsyncLocalStorage

**Approach**: Use Node.js `AsyncLocalStorage` to provide workflow context globally to all tool executions.

**Pros**:
- No need to modify tool signatures
- Automatic context propagation

**Cons**:
- More complex debugging
- Hidden dependencies (tools depend on global state)
- AsyncLocalStorage can have performance implications
- Harder to test in isolation

**Decision**: ❌ Rejected - Explicit parameter passing is more maintainable

### Alternative 2: Append Footer in Workflow Runtime (Not in Tools)

**Approach**: Have the workflow runtime intercept GitHub tool responses and append footers afterward.

**Pros**:
- Tools remain simpler
- Centralized footer logic

**Cons**:
- Requires tool-specific knowledge in runtime (which tools create GitHub artifacts?)
- Cannot intercept GitHub API responses (tools call GitHub directly)
- Complex to implement for different tool response formats

**Decision**: ❌ Rejected - Tools should own their output format

### Alternative 3: Create Wrapper Tools

**Approach**: Create new tools like `ticket-to-github-issue-with-attribution` that wrap existing tools and add footers.

**Pros**:
- Existing tools remain unchanged
- Clear separation of concerns

**Cons**:
- Tool proliferation (duplicate tools for every GitHub operation)
- Workflow definitions would need to change to use new tools
- Maintenance burden (two versions of each tool)

**Decision**: ❌ Rejected - Better to enhance existing tools with optional params

---

## Conclusion

The root cause of missing attribution footers is a straightforward **architectural gap**: the workflow runtime does not pass execution context metadata to tools. The fix involves:

1. Creating a centralized footer generation utility
2. Extending the workflow execution context to include runtime metadata
3. Propagating this metadata from the API route through the workflow runtime
4. Auto-injecting metadata into GitHub tools during workflow execution
5. Updating tools to generate attribution footers using the provided context

All changes maintain backward compatibility through optional parameters and graceful degradation. The implementation is low-risk with clear boundaries and testable in isolation.

**Recommendation**: Proceed with implementation following the phased approach outlined above.

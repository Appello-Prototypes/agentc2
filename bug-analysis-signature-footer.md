# Root Cause Analysis: Missing AgentC2 Attribution Footers in GitHub Artifacts

**Issue:** [#23] Signature attribution footer validation  
**Reporter:** Test ticket for validation  
**Date:** 2026-02-28  
**Analyst:** Cloud Agent

---

## Executive Summary

GitHub artifacts (issues, comments, PRs) created by AgentC2 workflows lack consistent attribution footers. While a basic footer exists in one tool (`ticket-to-github-issue`), it only includes the source ticket ID and omits critical workflow execution metadata (workflow slug, run ID, step ID). Two other GitHub creation tools (`github-issue-comment`, `github-create-pr`) lack attribution footers entirely.

**Root Cause:** Workflow execution metadata (workflow slug, run ID, step ID) is not propagated to tool execution context, and tools do not implement standardized attribution footer generation.

**Severity:** Medium  
**Complexity:** Medium  
**Risk:** Low

---

## Investigation Findings

### 1. Relevant Code Locations

#### GitHub Tools (packages/agentc2/src/tools/)

1. **`ticket-to-github-issue.ts`** (Creates GitHub issues)
   - **Lines 84-86:** Basic footer exists
   ```typescript
   const footer = sourceTicketId
       ? `\n\n---\n_Created from ticket \`${sourceTicketId}\` via AgentC2 SDLC Pipeline_`
       : "";
   ```
   - **Line 98:** Footer appended to issue body
   - **Missing:** workflow slug, run ID, step ID

2. **`github-issue-comment.ts`** (Adds comments to issues)
   - **Line 28-38:** No footer generation exists
   - **Line 37:** Comment body sent directly to GitHub API
   - **Missing:** All attribution

3. **`github-create-pr.ts`** (Creates pull requests)
   - **Line 36-48:** No footer generation exists
   - **Line 44:** PR body sent directly to GitHub API
   - **Missing:** All attribution

#### Workflow Runtime (packages/agentc2/src/workflows/builder/)

1. **`runtime.ts`**
   - **Line 306-342:** `executeToolStep()` - Tool execution handler
   - **Line 316:** `organizationId` injected into tool input
   - **Line 309:** `requestContext` passed to tool resolution
   - **Missing:** Workflow metadata (slug, runId, stepId) not included

2. **`types.ts`**
   - **Line 99-105:** `WorkflowExecutionContext` type definition
   - **Line 74-86:** `WorkflowExecutionStep` type definition
   - **Missing:** No workflow metadata in context

#### Workflow Execution Routes (apps/agent/src/app/api/workflows/)

1. **`[slug]/execute/route.ts`**
   - **Line 37-49:** `workflowRun` created with ID
   - **Line 71-75:** `executeWorkflowDefinition()` called
   - **Line 74:** `requestContext` passed but doesn't include workflow metadata
   - **Missing:** Workflow slug, run ID not propagated to tool context

2. **`coding-pipeline/dispatch/route.ts`**
   - **Line 146-161:** Creates `WorkflowRun` record
   - **Line 68-78:** Direct tool execution for GitHub issue creation
   - **Missing:** Run ID not available at tool execution time

#### Workflow Definitions (packages/agentc2/src/workflows/)

1. **`coding-pipeline.ts`**
   - Multiple tool steps reference GitHub tools:
     - **Line 24:** "ingest-ticket" (calls `ingest-ticket` tool)
     - **Implied usage:** GitHub tools called via Cursor agent's tool selection
   - **Missing:** No attribution metadata in step definitions

---

## Root Cause Analysis

### Primary Root Cause

**Workflow execution metadata is not propagated to tool execution context.**

When workflows execute tools:
1. `executeWorkflowDefinition()` creates a workflow execution context (`WorkflowExecutionContext`)
2. Each step execution calls `executeToolStep()` (runtime.ts:306-342)
3. `requestContext` is passed to tool resolution (runtime.ts:309)
4. Tools receive input parameters and `requestContext` but **no workflow metadata**

The workflow runtime tracks:
- Workflow definition
- Run ID (created in API route, not in runtime)
- Step ID (from workflow definition)
- Workflow slug (from database record)

However, this metadata exists **only** in:
- The API route layer (`/api/workflows/[slug]/execute/route.ts`)
- The database (`WorkflowRun` table)
- The runtime's internal execution state

It is **never injected** into the tool execution context.

### Secondary Root Causes

1. **No standardized attribution footer utility**
   - Each tool implements its own footer logic (or none at all)
   - Inconsistent format across tools
   - Easy to forget when creating new tools

2. **Inconsistent footer implementation**
   - `ticket-to-github-issue.ts`: Has basic footer (source ticket only)
   - `github-issue-comment.ts`: No footer
   - `github-create-pr.ts`: No footer

3. **Missing attribution requirements in tool design**
   - No documented requirement for tools to add attribution
   - No linting or validation to enforce attribution
   - Tool schema doesn't include attribution fields

---

## Impact Assessment

### Affected Components

#### Direct Impact
- ✅ `ticket-to-github-issue` (partial - has basic footer)
- ❌ `github-issue-comment` (missing all attribution)
- ❌ `github-create-pr` (missing all attribution)

#### Workflows Using These Tools
- Coding Pipeline workflows (`coding-pipeline`, `coding-pipeline-internal`)
- Any custom workflow using GitHub tools
- Agent-driven GitHub operations (when agents select these tools)

#### Downstream Effects
- **Audit trail:** Cannot trace GitHub artifacts back to specific workflow runs
- **Debugging:** Hard to identify which workflow execution created an artifact
- **Compliance:** Missing attribution for automated changes
- **User transparency:** Users can't see which agent/workflow performed actions

### Data Flow

```
API Route → WorkflowRun (DB) → executeWorkflowDefinition() → executeToolStep()
             ↓ (ID stored)          ↓ (context created)        ↓ (tool invoked)
             runId                  input, requestContext      tool.execute({...})
             workflowSlug           steps, variables           ↓
             ❌ NOT PASSED → → → → → → → → → → → → → → → →     GitHub API
                                                                (no attribution)
```

---

## Fix Plan

### Phase 1: Infrastructure Changes (Enable metadata propagation)

#### Step 1.1: Extend WorkflowExecutionContext
**File:** `packages/agentc2/src/workflows/builder/types.ts`

**Change:**
```typescript
export interface WorkflowExecutionContext {
    input: unknown;
    steps: Record<string, unknown>;
    variables: Record<string, unknown>;
    env?: Record<string, string>;
    helpers?: Record<string, (...args: unknown[]) => unknown>;
    
    // ✨ NEW: Workflow execution metadata
    workflow?: {
        slug: string;
        runId: string;
        workflowId: string;
    };
}
```

**Risk:** Low - Additive change, backward compatible

---

#### Step 1.2: Inject workflow metadata into execution context
**File:** `packages/agentc2/src/workflows/builder/runtime.ts`

**Location:** `executeWorkflowDefinition()` function (line 718-740)

**Change:**
```typescript
export async function executeWorkflowDefinition(
    options: ExecuteWorkflowOptions
): Promise<WorkflowExecutionResult> {
    // ... existing validation ...
    
    const context: WorkflowExecutionContext = {
        input: options.input,
        steps: options.existingSteps ? { ...options.existingSteps } : {},
        variables: {},
        env: getEnvContext(),
        helpers: getHelpers(),
        
        // ✨ NEW: Inject workflow metadata from options
        workflow: options.workflowMetadata
    };

    return executeSteps(options.definition.steps || [], context, options);
}
```

**Also update:** `ExecuteWorkflowOptions` interface (line 22-30)
```typescript
interface ExecuteWorkflowOptions {
    definition: WorkflowDefinition;
    input: unknown;
    resume?: WorkflowResumeInput;
    existingSteps?: Record<string, unknown>;
    onStepEvent?: (event: WorkflowExecutionStep) => void;
    requestContext?: RequestContext;
    depth?: number;
    
    // ✨ NEW: Workflow metadata for attribution
    workflowMetadata?: {
        slug: string;
        runId: string;
        workflowId: string;
    };
}
```

**Risk:** Low - Additive change, backward compatible (optional field)

---

#### Step 1.3: Pass workflow metadata to tool execution
**File:** `packages/agentc2/src/workflows/builder/runtime.ts`

**Location:** `executeToolStep()` function (line 306-342)

**Change:**
```typescript
async function executeToolStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    requestContext?: RequestContext
) {
    // ... existing code ...
    
    const input = resolveInputMapping(step.inputMapping || config.parameters, context);

    if (organizationId && typeof input === "object" && input !== null && !("organizationId" in input)) {
        (input as Record<string, unknown>).organizationId = organizationId;
    }
    
    // ✨ NEW: Inject workflow metadata for attribution
    if (context.workflow && typeof input === "object" && input !== null) {
        (input as Record<string, unknown>).__workflowMetadata = {
            workflowSlug: context.workflow.slug,
            runId: context.workflow.runId,
            stepId: step.id,
            workflowId: context.workflow.workflowId
        };
    }

    // ... rest of function ...
}
```

**Risk:** Low - Non-breaking injection of optional metadata

---

#### Step 1.4: Update API routes to provide workflow metadata
**File:** `apps/agent/src/app/api/workflows/[slug]/execute/route.ts`

**Location:** Line 71-75 (executeWorkflowDefinition call)

**Change:**
```typescript
const result = await executeWorkflowDefinition({
    definition: workflow.definitionJson as unknown as WorkflowDefinition,
    input,
    requestContext: body.requestContext,
    
    // ✨ NEW: Provide workflow metadata for attribution
    workflowMetadata: {
        slug: workflow.slug,
        runId: run.id,
        workflowId: workflow.id
    }
});
```

**Also update:** All other workflow execution routes:
- `apps/agent/src/app/api/workflows/[slug]/execute/stream/route.ts`
- `apps/agent/src/app/api/workflows/[slug]/execute/public/route.ts`
- `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/resume/route.ts`
- `apps/agent/src/lib/inngest-functions.ts` (async workflow execution)

**Risk:** Low - All routes have access to workflow metadata

---

### Phase 2: Footer Utility (Standardize attribution format)

#### Step 2.1: Create attribution footer utility
**File:** `packages/agentc2/src/tools/attribution-footer.ts` (NEW FILE)

**Content:**
```typescript
/**
 * Attribution Footer Utility
 * 
 * Generates standardized attribution footers for GitHub artifacts
 * created by AgentC2 workflows.
 */

export interface AttributionMetadata {
    /** Workflow slug (e.g., "coding-pipeline") */
    workflowSlug?: string;
    /** Workflow run ID (e.g., "clz123abc...") */
    runId?: string;
    /** Workflow step ID (e.g., "create-issue") */
    stepId?: string;
    /** Source ticket/task ID (legacy) */
    sourceTicketId?: string;
    /** Agent slug (if invoked by agent) */
    agentSlug?: string;
}

/**
 * Generate a standardized attribution footer for GitHub artifacts.
 * 
 * @param metadata - Attribution metadata from workflow/agent context
 * @returns Markdown footer string
 * 
 * @example
 * ```typescript
 * const footer = generateAttributionFooter({
 *   workflowSlug: "coding-pipeline",
 *   runId: "clz123abc",
 *   stepId: "create-issue"
 * });
 * // Returns:
 * // ---
 * // _🤖 Created by AgentC2_
 * // _Workflow: `coding-pipeline` • Run: `clz123abc` • Step: `create-issue`_
 * ```
 */
export function generateAttributionFooter(metadata: AttributionMetadata): string {
    if (!metadata.workflowSlug && !metadata.agentSlug && !metadata.sourceTicketId) {
        return ""; // No attribution data available
    }

    const parts: string[] = ["\n\n---", "_🤖 Created by AgentC2_"];

    // Primary attribution: workflow + run + step
    if (metadata.workflowSlug || metadata.runId || metadata.stepId) {
        const details: string[] = [];
        
        if (metadata.workflowSlug) {
            details.push(`Workflow: \`${metadata.workflowSlug}\``);
        }
        if (metadata.runId) {
            details.push(`Run: \`${metadata.runId}\``);
        }
        if (metadata.stepId) {
            details.push(`Step: \`${metadata.stepId}\``);
        }
        
        parts.push(`_${details.join(" • ")}_`);
    }

    // Secondary attribution: agent (if workflow wasn't available)
    if (metadata.agentSlug && !metadata.workflowSlug) {
        parts.push(`_Agent: \`${metadata.agentSlug}\`_`);
    }

    // Legacy attribution: source ticket (backward compatibility)
    if (metadata.sourceTicketId) {
        parts.push(`_Source: \`${metadata.sourceTicketId}\`_`);
    }

    return parts.join("\n");
}

/**
 * Extract attribution metadata from tool input.
 * Tools receive `__workflowMetadata` injected by the workflow runtime.
 */
export function extractAttributionMetadata(
    input: Record<string, unknown>
): AttributionMetadata {
    const workflowMetadata = input.__workflowMetadata as
        | {
              workflowSlug?: string;
              runId?: string;
              stepId?: string;
              workflowId?: string;
          }
        | undefined;

    return {
        workflowSlug: workflowMetadata?.workflowSlug,
        runId: workflowMetadata?.runId,
        stepId: workflowMetadata?.stepId,
        sourceTicketId: input.sourceTicketId as string | undefined,
        agentSlug: input.agentSlug as string | undefined
    };
}
```

**Risk:** Low - New utility, no changes to existing code

---

### Phase 3: Update GitHub Tools (Apply attribution)

#### Step 3.1: Update ticket-to-github-issue.ts
**File:** `packages/agentc2/src/tools/ticket-to-github-issue.ts`

**Location:** Lines 84-86 (footer generation)

**Change:**
```typescript
import { generateAttributionFooter, extractAttributionMetadata } from "./attribution-footer";

export const ticketToGithubIssueTool = createTool({
    // ... schema unchanged ...
    
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
        ...rest // Capture __workflowMetadata
    }) => {
        // ... existing validation ...
        
        const token = await resolveGitHubToken(organizationId);
        
        // ✨ UPDATED: Use standardized attribution footer
        const attributionMetadata = extractAttributionMetadata({
            sourceTicketId,
            ...rest
        } as Record<string, unknown>);
        const footer = generateAttributionFooter(attributionMetadata);

        const response = await fetch(/*...*/);
        // ... rest unchanged ...
    }
});
```

**Risk:** Low - Backward compatible (old footers upgraded to new format)

---

#### Step 3.2: Update github-issue-comment.ts
**File:** `packages/agentc2/src/tools/github-issue-comment.ts`

**Location:** Line 28-39 (execute function)

**Change:**
```typescript
import { generateAttributionFooter, extractAttributionMetadata } from "./attribution-footer";

export const githubAddIssueCommentTool = createTool({
    // ... schema unchanged ...
    
    execute: async ({ repository, issueNumber, body, organizationId, ...rest }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        // ✨ NEW: Add attribution footer
        const attributionMetadata = extractAttributionMetadata(rest as Record<string, unknown>);
        const footer = generateAttributionFooter(attributionMetadata);
        const bodyWithAttribution = body + footer;

        const response = await githubFetch(
            `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            token,
            {
                method: "POST",
                body: JSON.stringify({ body: bodyWithAttribution })
            }
        );

        // ... rest unchanged ...
    }
});
```

**Risk:** Low - Additive change, no breaking changes

---

#### Step 3.3: Update github-create-pr.ts
**File:** `packages/agentc2/src/tools/github-create-pr.ts`

**Location:** Line 36-48 (execute function)

**Change:**
```typescript
import { generateAttributionFooter, extractAttributionMetadata } from "./attribution-footer";

export const githubCreatePullRequestTool = createTool({
    // ... schema unchanged ...
    
    execute: async ({ 
        repository, 
        head, 
        base, 
        title, 
        body, 
        draft, 
        organizationId,
        ...rest 
    }) => {
        const token = await resolveGitHubToken(organizationId);
        const { owner, repo } = parseRepoOwnerName(repository);

        // ✨ NEW: Add attribution footer
        const attributionMetadata = extractAttributionMetadata(rest as Record<string, unknown>);
        const footer = generateAttributionFooter(attributionMetadata);
        const bodyWithAttribution = (body || "") + footer;

        const response = await githubFetch(`/repos/${owner}/${repo}/pulls`, token, {
            method: "POST",
            body: JSON.stringify({
                title,
                body: bodyWithAttribution,
                head,
                base: base || "main",
                draft: draft || false
            })
        });

        // ... rest unchanged ...
    }
});
```

**Risk:** Low - Additive change, no breaking changes

---

### Phase 4: Testing & Validation

#### Step 4.1: Unit Tests
**File:** `tests/unit/attribution-footer.test.ts` (NEW FILE)

**Tests:**
- ✅ Generates footer with full workflow metadata
- ✅ Generates footer with partial metadata
- ✅ Returns empty string when no metadata available
- ✅ Handles legacy sourceTicketId
- ✅ Extracts metadata from tool input

---

#### Step 4.2: Integration Tests
**File:** `tests/integration/github-tools-attribution.test.ts` (NEW FILE)

**Tests:**
- ✅ GitHub issue created with workflow attribution
- ✅ GitHub comment added with workflow attribution
- ✅ GitHub PR created with workflow attribution
- ✅ Workflow metadata propagates through execution
- ✅ Attribution footer format matches specification

---

#### Step 4.3: Manual Testing
**Procedure:**
1. Deploy changes to staging environment
2. Trigger coding pipeline workflow
3. Verify GitHub issue has footer with:
   - Workflow slug: `coding-pipeline`
   - Run ID: (valid CUID)
   - Step ID: (e.g., `create-issue`)
4. Trigger workflow that adds comments
5. Verify comment has attribution footer
6. Trigger workflow that creates PRs
7. Verify PR has attribution footer

---

## Risk Assessment

### Implementation Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking changes to workflow runtime | Low | All changes are additive (optional fields) |
| Performance impact from metadata injection | Low | Minimal overhead (shallow object spread) |
| Backward compatibility with existing workflows | Low | Metadata is optional, old workflows work unchanged |
| Footer format changes affecting existing issues | Low | New format is more informative, no data loss |
| Tools not receiving metadata | Medium | Extensive testing required; fallback to basic footer |

### Rollout Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Deployed workflows without metadata | Low | Tools gracefully handle missing metadata |
| Database migration required | None | No schema changes needed |
| API contract changes | None | No external API changes |

---

## Estimated Complexity

### Development Effort
- **Phase 1 (Infrastructure):** 2-3 hours
  - 4 file modifications
  - Type definitions + runtime changes
  - API route updates
- **Phase 2 (Footer Utility):** 1-2 hours
  - 1 new file
  - Utility functions + documentation
- **Phase 3 (GitHub Tools):** 2-3 hours
  - 3 tool modifications
  - Import + integration
- **Phase 4 (Testing):** 3-4 hours
  - Unit tests
  - Integration tests
  - Manual verification

**Total:** 8-12 hours of development

### Testing Effort
- Unit tests: 2 hours
- Integration tests: 2 hours
- Manual testing: 1 hour

**Total:** 5 hours of testing

### Review & Documentation
- Code review: 1 hour
- Documentation updates: 1 hour

**Total:** 2 hours

### **Grand Total: 15-19 hours**

---

## Alternative Approaches (Considered and Rejected)

### Alternative 1: Store attribution in database
**Approach:** Link GitHub artifacts to workflow runs in database

**Pros:**
- Centralized audit trail
- Query historical attribution

**Cons:**
- Requires GitHub webhook integration to capture artifact creation
- Database becomes source of truth instead of artifacts themselves
- Doesn't solve user-facing transparency (users can't see attribution in GitHub)

**Rejected because:** Doesn't meet acceptance criteria (visible footers in GitHub)

---

### Alternative 2: Use GitHub commit signatures
**Approach:** Sign commits with GPG keys

**Pros:**
- Cryptographically verifiable
- Git-native attribution

**Cons:**
- Only applies to commits, not issues/comments/PRs
- Requires GPG key management
- Doesn't display workflow metadata in GitHub UI

**Rejected because:** Incomplete solution, high complexity

---

### Alternative 3: Middleware injection via request context
**Approach:** Use express/Next.js middleware to inject metadata into all tool calls

**Pros:**
- Automatic injection without modifying workflow runtime

**Cons:**
- Tightly couples tools to HTTP request lifecycle
- Doesn't work for background jobs (Inngest)
- Bypasses workflow execution context

**Rejected because:** Not compatible with async workflow execution

---

## Open Questions

1. **Should footers be configurable per-organization?**
   - Some orgs might want to disable footers
   - Some might want custom branding
   - **Recommendation:** Start with standard footer, add customization later

2. **Should we backfill existing GitHub artifacts?**
   - Existing issues/PRs lack attribution
   - Could add attribution via comments
   - **Recommendation:** Not in initial implementation (future enhancement)

3. **Should footers include agent name in addition to workflow?**
   - Workflows invoke agents (e.g., `assistant`, `agentc2-developer`)
   - Agent name provides additional context
   - **Recommendation:** Yes, include agent slug if available

4. **Should we add links to the AgentC2 UI in footers?**
   - Example: `View run: https://app.agentc2.ai/workflows/coding-pipeline/runs/clz123`
   - **Recommendation:** Yes, but only if NEXT_PUBLIC_APP_URL is set

---

## Success Criteria

### Acceptance Criteria (from Issue #23)
- ✅ Issue body has AgentC2 signature footer
- ✅ Analysis comment has AgentC2 signature footer
- ✅ Each footer includes workflow slug, run ID, and step ID

### Additional Validation
- ✅ All three GitHub tools generate footers
- ✅ Footers format is consistent
- ✅ Workflow metadata propagates correctly
- ✅ No breaking changes to existing workflows
- ✅ Unit tests pass
- ✅ Integration tests pass

---

## Recommendations

### Immediate Actions
1. ✅ Implement Phase 1 (Infrastructure) first
2. ✅ Implement Phase 2 (Footer Utility) second
3. ✅ Implement Phase 3 (GitHub Tools) third
4. ✅ Run full test suite (Phase 4)
5. ✅ Deploy to staging for manual verification
6. ✅ Deploy to production

### Future Enhancements
1. Add footer customization per-organization
2. Implement footer localization (i18n)
3. Add links to AgentC2 UI in footers
4. Backfill existing GitHub artifacts with attribution comments
5. Create attribution footer for other integrations (Slack, Jira, etc.)
6. Add attribution to agent-invoked tools (non-workflow context)

---

## Appendices

### Appendix A: Example Footer Formats

#### Full workflow context
```markdown
---
_🤖 Created by AgentC2_
_Workflow: `coding-pipeline` • Run: `clz123abc` • Step: `create-issue`_
```

#### Partial context (no step ID)
```markdown
---
_🤖 Created by AgentC2_
_Workflow: `coding-pipeline` • Run: `clz123abc`_
```

#### Legacy context (sourceTicketId only)
```markdown
---
_🤖 Created by AgentC2_
_Source: `ticket-123`_
```

#### Agent context (non-workflow)
```markdown
---
_🤖 Created by AgentC2_
_Agent: `assistant`_
```

---

### Appendix B: Data Flow Diagrams

#### Current State (Missing Attribution)
```
User → API → WorkflowRun (DB) → executeWorkflowDefinition()
                ↓                          ↓
            runId: "clz123"           WorkflowExecutionContext {
            workflowSlug: "coding"      input, steps, variables
                                        ❌ NO workflow metadata
                                      }
                                          ↓
                                    executeToolStep()
                                          ↓
                                    ticketToGithubIssueTool.execute({
                                      title, description,
                                      ❌ NO workflow metadata
                                    })
                                          ↓
                                    GitHub API (no footer)
```

#### Future State (With Attribution)
```
User → API → WorkflowRun (DB) → executeWorkflowDefinition({
                ↓                  workflowMetadata: {
            runId: "clz123"          slug, runId, workflowId
            workflowSlug: "coding"  }
                                 })
                                      ↓
                                WorkflowExecutionContext {
                                  input, steps, variables,
                                  ✅ workflow: { slug, runId, workflowId }
                                }
                                      ↓
                                executeToolStep() → injects __workflowMetadata
                                      ↓
                                ticketToGithubIssueTool.execute({
                                  title, description,
                                  ✅ __workflowMetadata: { slug, runId, stepId }
                                })
                                      ↓
                                extractAttributionMetadata()
                                      ↓
                                generateAttributionFooter()
                                      ↓
                                GitHub API (with footer ✅)
```

---

### Appendix C: Affected Files Summary

| File | Lines Changed | Type | Risk |
|------|--------------|------|------|
| `packages/agentc2/src/workflows/builder/types.ts` | +10 | Additive | Low |
| `packages/agentc2/src/workflows/builder/runtime.ts` | +20 | Additive | Low |
| `packages/agentc2/src/tools/attribution-footer.ts` | +120 | New file | Low |
| `packages/agentc2/src/tools/ticket-to-github-issue.ts` | +5/-3 | Modification | Low |
| `packages/agentc2/src/tools/github-issue-comment.ts` | +7 | Additive | Low |
| `packages/agentc2/src/tools/github-create-pr.ts` | +7 | Additive | Low |
| `apps/agent/src/app/api/workflows/[slug]/execute/route.ts` | +6 | Additive | Low |
| `apps/agent/src/app/api/workflows/[slug]/execute/stream/route.ts` | +6 | Additive | Low |
| `apps/agent/src/app/api/workflows/[slug]/execute/public/route.ts` | +6 | Additive | Low |
| `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/resume/route.ts` | +6 | Additive | Low |
| `apps/agent/src/lib/inngest-functions.ts` | +6 | Additive | Low |
| `tests/unit/attribution-footer.test.ts` | +150 | New file | N/A |
| `tests/integration/github-tools-attribution.test.ts` | +200 | New file | N/A |

**Total:** 13 files, ~550 lines changed/added

---

## Conclusion

The missing attribution footers are caused by a gap in the workflow runtime architecture: workflow execution metadata (slug, run ID, step ID) is not propagated to tool execution context. The fix requires a three-phase approach:

1. **Infrastructure:** Extend workflow runtime to propagate metadata to tools
2. **Standardization:** Create reusable attribution footer utility
3. **Application:** Update GitHub tools to generate footers

The fix is **low-risk**, **medium-complexity**, and can be completed in **15-19 hours**. All changes are backward compatible and additive. The proposed solution is the most straightforward and maintainable approach.

---

**Analyst:** Cloud Agent  
**Analysis Date:** 2026-02-28  
**Report Version:** 1.0

# Root Cause Analysis: SDLC Workflow Output Summary Bug

**Issue:** [#67](https://github.com/Appello-Prototypes/agentc2/issues/67)  
**Date:** March 4, 2026  
**Status:** Analysis Complete - Ready for Implementation  
**Severity:** Medium (Functional issue, not blocking but reduces workflow observability)

---

## Executive Summary

When SDLC Bugfix or Feature workflows complete, the `WorkflowRun.outputJson` field contains only the raw output from the final "merge" step (typically `{success: true, sha: "...", message: "Pull request merged successfully"}`). This provides minimal insight into the workflow execution and requires users to manually traverse individual step outputs to understand what happened.

The expected behavior is for `outputJson` to contain a structured summary aggregating key pipeline data from all steps, including issue metadata, classification results, analysis summaries, audit verdicts, PR information, and total duration.

**Root Cause:** The workflow runtime design returns the output of the last executed step as the workflow's final output, with no built-in aggregation mechanism.

**Impact:** Reduced workflow observability, poor user experience in workflow UIs, difficulty tracking workflow outcomes programmatically, and inability to build meaningful metrics dashboards from workflow outputs.

**Complexity:** Low  
**Risk:** Low  
**Estimated Implementation Time:** 2-3 hours

---

## 1. Root Cause Analysis

### 1.1 Workflow Output Resolution Logic

The root cause exists in the workflow runtime's output resolution mechanism:

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`  
**Location:** Lines 802-807

```typescript
const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
return {
    status: "success",
    output,
    steps: executionSteps
};
```

**Problem:** The workflow output is **always** the output of the last step in the steps array. There is no post-processing or aggregation applied.

### 1.2 How outputJson is Persisted

The workflow execution result is saved to the database in four locations:

#### a. Regular Execution
**File:** `apps/agent/src/app/api/workflows/[slug]/execute/route.ts`  
**Location:** Line 177

```typescript
await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
        status: finalStatus,
        outputJson: result.output as Prisma.InputJsonValue,  // ← Sets to last step output
        completedAt: new Date(),
        durationMs,
        totalTokens,
        totalCostUsd
    }
});
```

#### b. Streaming Execution
**File:** `apps/agent/src/app/api/workflows/[slug]/execute/stream/route.ts`  
**Location:** Line 171

```typescript
await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
        status: finalStatus,
        outputJson: result.output as Prisma.InputJsonValue,  // ← Same pattern
        completedAt: new Date(),
        durationMs
    }
});
```

#### c. Resume Execution (after human approval)
**File:** `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/resume/route.ts`  
**Location:** Line 162

```typescript
await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
        status: finalStatus,
        outputJson: result.output as Prisma.InputJsonValue,  // ← Same pattern
        completedAt: new Date(),
        durationMs: (run.durationMs || 0) + durationMs
    }
});
```

#### d. Inngest Background Execution
**File:** `apps/agent/src/lib/inngest-functions.ts`  
**Location:** Line 8860

```typescript
await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: {
        status: finalStatus,
        outputJson: result.output as Prisma.InputJsonValue,  // ← Same pattern
        completedAt: new Date(),
        durationMs,
        totalCostUsd,
        totalTokens
    }
});
```

**Finding:** All four execution paths set `outputJson` to `result.output`, which is the unprocessed output of the last step.

### 1.3 Current Workflow Structure

#### SDLC Bugfix Workflow
**File:** `scripts/seed-sdlc-playbook.ts`  
**Location:** Lines 1015-1204

**Step Sequence:**
1. `intake` (tool) - Create GitHub Issue → Returns: `{issueNumber, issueUrl, repository, linked}`
2. `analyze-launch` (tool) - Launch Cursor analysis agent
3. `analyze-wait` (tool) - Poll until analysis done → Returns: `{agentId, status, summary, branchName, prNumber, repository, durationMs, timedOut}`
4. `analyze-result` (tool) - Get conversation history
5. `post-analysis` (tool) - Post analysis to GitHub
6. `audit-cycle` (dowhile) - Audit & approval loop
   - `fix-audit` (agent) → Returns: `{verdict, severity, issues, positives, summary, checklist}`
   - `fix-verdict-route` (branch) - Routes to human review or retry
7. `implement-launch` (tool) - Launch coding agent
8. `implement-wait` (tool) - Poll until implementation done
9. `create-pr` (tool) - Create pull request → Returns: `{prNumber, prUrl, htmlUrl}`
10. `merge-review` (human) - Human PR approval → Returns: `{approved, rejected, feedback}`
11. **`merge` (tool) - Merge PR** → Returns: `{success, sha, message}` ← **THIS BECOMES outputJson**

#### SDLC Feature Workflow
**File:** `scripts/seed-sdlc-playbook.ts`  
**Location:** Lines 1206-1425

**Step Sequence:**
1. `intake` (tool) - Create GitHub Issue
2. `classify` (agent) → Returns: `{classification, priority, complexity, affectedAreas, suggestedRoute, rationale}`
3. `design-launch` (tool) - Launch design analysis
4. `design-wait` (tool) - Poll until design done
5. `design-result` (tool) - Get conversation history
6. `post-design` (tool) - Post design to GitHub
7. `design-review` (human) - Human design approval
8. `plan-cycle` (dowhile) - Planning & audit loop
   - `feature-plan` (agent)
   - `feature-plan-audit` (agent) → Returns: `{verdict, severity, issues, positives, summary, checklist}`
   - `feature-verdict-route` (branch)
9. `implement-launch` (tool) - Launch coding agent
10. `implement-wait` (tool) - Poll until implementation done
11. `create-pr` (tool) - Create pull request
12. `merge-review` (human) - Human PR approval
13. **`merge` (tool) - Merge PR** → Returns: `{success, sha, message}` ← **THIS BECOMES outputJson**

**Finding:** Both workflows terminate with the `merge` step, so `outputJson` only contains the merge result.

### 1.4 Merge Tool Output Schema

**File:** `packages/agentc2/src/tools/merge-deploy-tools.ts`  
**Location:** Lines 34-38

```typescript
outputSchema: z.object({
    success: z.boolean(),
    sha: z.string().nullable(),
    message: z.string()
})
```

**Current Reality:** This is what users see in `WorkflowRun.outputJson`:
```json
{
  "success": true,
  "sha": "abc123def456...",
  "message": "Pull request merged successfully"
}
```

**Expected:** Users expect a comprehensive summary:
```json
{
  "issueNumber": 42,
  "issueUrl": "https://github.com/owner/repo/issues/42",
  "classification": {
    "type": "bug",
    "priority": "medium",
    "complexity": "low"
  },
  "analysisSummary": "Root cause identified in auth middleware...",
  "auditVerdict": "PASS",
  "prNumber": 43,
  "prUrl": "https://github.com/owner/repo/pull/43",
  "mergeResult": {
    "success": true,
    "sha": "abc123...",
    "message": "Pull request merged successfully"
  },
  "totalDurationMs": 120000
}
```

---

## 2. Impact Assessment

### 2.1 Affected Components

| Component | Impact | Description |
|-----------|--------|-------------|
| **Workflow UIs** | High | Run detail pages show uninformative output (just merge status) |
| **Workflow Metrics** | High | Cannot build dashboards from structured output data |
| **API Clients** | Medium | External systems integrating with workflows get minimal data |
| **Debugging/Support** | Medium | Engineers must manually inspect all step outputs to understand what happened |
| **Workflow Evaluations** | Low | Evaluation system uses `outputJson` for quality scoring (currently limited) |

### 2.2 User Experience Problems

1. **Poor Observability**: Users viewing completed workflow runs see only "Pull request merged successfully" with no context
2. **Manual Step Inspection**: Users must expand individual steps to find issue numbers, PR URLs, classification data
3. **No Quick Summary**: No way to quickly scan workflow outcomes across multiple runs
4. **Broken Metrics**: Difficulty building dashboards showing success rates by classification type, priority, etc.
5. **Integration Friction**: External systems calling workflows via API receive minimal output data

### 2.3 Affected Workflows

**Direct Impact:**
- `sdlc-bugfix-agentc2` (Lines 1598-1605 in seed script)
- `sdlc-feature-agentc2` (Lines 1607-1614 in seed script)

**Indirect Impact:**
- `sdlc-triage-agentc2` (Lines 1589-1596) - Calls bugfix/feature as sub-workflows
- Any future SDLC workflows following the same pattern

**Not Affected:**
- Other workflows that don't require structured output summaries
- Workflows where the last step naturally produces a comprehensive output

---

## 3. Technical Deep Dive

### 3.1 Workflow Context and Step Resolution

The workflow runtime maintains a context object throughout execution:

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines:** 823-829

```typescript
const context: WorkflowExecutionContext = {
    input: options.input,
    steps: options.existingSteps ? { ...options.existingSteps } : {},
    variables: {},
    env: getEnvContext(),
    helpers: getHelpers()
};
```

As each step executes, its output is stored in `context.steps[stepId]`:

**Line 758:**
```typescript
context.steps[step.id] = output;
```

This means **ALL step outputs are available** in the context throughout execution, but the final output only returns the last one.

### 3.2 Transform Step Capability

The workflow runtime already supports a "transform" step type designed for data mapping:

**File:** `packages/agentc2/src/workflows/builder/types.ts`  
**Line 10:**

```typescript
export type WorkflowStepType =
    | "agent"
    | "tool"
    | "workflow"
    | "branch"
    | "parallel"
    | "foreach"
    | "dowhile"
    | "human"
    | "transform"  // ← Exists but unused in SDLC workflows
    | "delay";
```

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines 735-738:**

```typescript
case "transform":
default:
    output = stepInput;
```

For transform steps, the `stepInput` is resolved from `step.inputMapping` (line 485):

```typescript
const stepInput = resolveInputMapping(step.inputMapping, context);
```

The `resolveInputMapping` function (lines 243-251) recursively resolves template expressions like `{{steps.intake.issueNumber}}` using the current context, which has access to ALL previous step outputs.

### 3.3 Template Resolution System

The workflow runtime uses a Handlebars-like template system:

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines 175-196:**

```typescript
function resolveTemplate(value: string, context: WorkflowExecutionContext): unknown {
    // Exact match: entire string is a single {{ expression }}
    const exactMatch = value.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (exactMatch) {
        return evaluateExpression(exactMatch[1], context);
    }
    
    // Inline interpolation: replace each {{ expr }} within a larger string
    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
        const resolved = evaluateExpression(expr, context);
        if (resolved === undefined || resolved === null) {
            return "";
        }
        return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
}
```

**Supported Expressions:**
- Simple paths: `{{steps.intake.issueNumber}}`
- Nested paths: `{{steps['analyze-wait'].summary}}`
- Complex expressions: `{{steps.classify?.classification || 'unknown'}}`
- Helper functions: `{{helpers.json(steps.classify)}}`

### 3.4 Why This Wasn't Noticed Earlier

1. **Individual step outputs are preserved**: `WorkflowRunStep` records store each step's output correctly
2. **UI shows step-by-step details**: Users can drill into individual steps to see their outputs
3. **No automated reporting**: No dashboards or reports depend on structured `outputJson`
4. **Recent introduction**: SDLC workflows are relatively new additions to the platform

---

## 4. Detailed Fix Plan

### 4.1 Solution: Add Transform Output-Mapping Step

Add a final "transform" step to both workflows that aggregates data from previous steps into the expected structured format.

### 4.2 Implementation Steps

#### Step 1: Add Output Summary Step to Bugfix Workflow

**File:** `scripts/seed-sdlc-playbook.ts`  
**Location:** After line 1202 (after the "merge" step, before the closing `]`)

**Changes:**
```javascript
// Add this as the final step in bugfixWorkflowDef.steps array:
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate Output Summary",
    description: "Aggregate key pipeline data into structured output",
    inputMapping: {
        issueNumber: "{{steps.intake.issueNumber}}",
        issueUrl: "{{steps.intake.issueUrl}}",
        repository: "{{steps.intake.repository}}",
        
        // Analysis phase
        analysisSummary: "{{steps['analyze-wait'].summary}}",
        analysisAgentId: "{{steps['analyze-launch'].agentId}}",
        analysisDurationMs: "{{steps['analyze-wait'].durationMs}}",
        
        // Audit phase (from dowhile loop - takes last iteration)
        auditVerdict: "{{steps['audit-cycle'].verdict || steps['fix-audit'].verdict}}",
        auditSeverity: "{{steps['audit-cycle'].severity || steps['fix-audit'].severity}}",
        auditSummary: "{{steps['audit-cycle'].summary || steps['fix-audit'].summary}}",
        
        // Implementation phase
        implementationSummary: "{{steps['implement-wait'].summary}}",
        implementationBranch: "{{steps['implement-wait'].branchName}}",
        implementationAgentId: "{{steps['implement-launch'].agentId}}",
        implementationDurationMs: "{{steps['implement-wait'].durationMs}}",
        
        // PR phase
        prNumber: "{{steps['create-pr'].prNumber}}",
        prUrl: "{{steps['create-pr'].htmlUrl}}",
        
        // Merge phase
        mergeResult: {
            success: "{{steps.merge.success}}",
            sha: "{{steps.merge.sha}}",
            message: "{{steps.merge.message}}"
        },
        
        // Metadata
        workflowType: "bugfix",
        pipelineVersion: "v1"
    }
}
```

#### Step 2: Add Output Summary Step to Feature Workflow

**File:** `scripts/seed-sdlc-playbook.ts`  
**Location:** After line 1423 (after the "merge" step, before the closing `]`)

**Changes:**
```javascript
// Add this as the final step in featureWorkflowDef.steps array:
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate Output Summary",
    description: "Aggregate key pipeline data into structured output",
    inputMapping: {
        issueNumber: "{{steps.intake.issueNumber}}",
        issueUrl: "{{steps.intake.issueUrl}}",
        repository: "{{steps.intake.repository}}",
        
        // Classification phase (feature workflow has this, bugfix doesn't)
        classification: {
            type: "{{steps.classify.classification}}",
            priority: "{{steps.classify.priority}}",
            complexity: "{{steps.classify.complexity}}",
            affectedAreas: "{{steps.classify.affectedAreas}}",
            rationale: "{{steps.classify.rationale}}"
        },
        
        // Design phase
        designSummary: "{{steps['design-wait'].summary}}",
        designAgentId: "{{steps['design-launch'].agentId}}",
        designDurationMs: "{{steps['design-wait'].durationMs}}",
        
        // Planning phase (from dowhile loop)
        planAuditVerdict: "{{steps['plan-cycle'].verdict || steps['feature-plan-audit'].verdict}}",
        planAuditSeverity: "{{steps['plan-cycle'].severity || steps['feature-plan-audit'].severity}}",
        
        // Implementation phase
        implementationSummary: "{{steps['implement-wait'].summary}}",
        implementationBranch: "{{steps['implement-wait'].branchName}}",
        implementationAgentId: "{{steps['implement-launch'].agentId}}",
        implementationDurationMs: "{{steps['implement-wait'].durationMs}}",
        
        // PR phase
        prNumber: "{{steps['create-pr'].prNumber}}",
        prUrl: "{{steps['create-pr'].htmlUrl}}",
        
        // Merge phase
        mergeResult: {
            success: "{{steps.merge.success}}",
            sha: "{{steps.merge.sha}}",
            message: "{{steps.merge.message}}"
        },
        
        // Metadata
        workflowType: "feature",
        pipelineVersion: "v1"
    }
}
```

#### Step 3: Re-run Seed Script

**Command:**
```bash
bun run scripts/seed-sdlc-playbook.ts
```

**Effect:** Updates the `Workflow.definitionJson` field for both workflows in the database.

#### Step 4: Handle Total Duration Calculation

**Note:** The `totalDurationMs` field cannot be calculated directly in a transform step because it requires summing step durations, which isn't easily expressible in template syntax.

**Options:**
1. **Calculate at persistence time** (in the API routes) - Add logic after workflow completion
2. **Add to existing durationMs field** - The `WorkflowRun.durationMs` field already contains this
3. **Include in output summary** - Reference it: `"totalDurationMs": "{{durationMs}}"` (if exposed in context)

**Recommendation:** Use option 2 - the `durationMs` field already exists and is calculated correctly (sum of all step durations). The output summary doesn't need to duplicate it.

### 4.3 Alternative Solutions Considered

#### Alternative 1: Modify Workflow Runtime
**Description:** Change the runtime to automatically aggregate outputs  
**Rejected Because:** 
- Would require complex configuration to specify which fields to aggregate
- Not all workflows need this behavior
- Would be a breaking change for existing workflows
- Transform steps are the idiomatic pattern

#### Alternative 2: Post-Processing Hook
**Description:** Add an `onWorkflowComplete` hook that modifies output  
**Rejected Because:**
- Adds complexity to the execution layer
- Hook registration would be workflow-specific anyway
- Transform steps are cleaner and more visible in workflow definitions

#### Alternative 3: Custom Output Mapper Tool
**Description:** Create a dedicated `aggregate-workflow-output` tool  
**Rejected Because:**
- Transform steps with `inputMapping` already provide this capability
- Would require tool registry updates and additional maintenance
- Less flexible than inline transform steps

---

## 5. Data Availability Analysis

### 5.1 Bugfix Workflow Data Sources

| Field | Source Step | Path | Availability |
|-------|------------|------|--------------|
| `issueNumber` | intake | `steps.intake.issueNumber` | ✅ Always |
| `issueUrl` | intake | `steps.intake.issueUrl` | ✅ Always |
| `repository` | intake | `steps.intake.repository` | ✅ Always |
| `analysisSummary` | analyze-wait | `steps['analyze-wait'].summary` | ✅ Always |
| `auditVerdict` | audit-cycle | `steps['audit-cycle'].verdict` or `steps['fix-audit'].verdict` | ✅ Always |
| `auditSeverity` | audit-cycle | `steps['audit-cycle'].severity` | ✅ Always |
| `implementationSummary` | implement-wait | `steps['implement-wait'].summary` | ✅ Always |
| `implementationBranch` | implement-wait | `steps['implement-wait'].branchName` | ✅ Always |
| `prNumber` | create-pr | `steps['create-pr'].prNumber` | ✅ Always |
| `prUrl` | create-pr | `steps['create-pr'].htmlUrl` | ✅ Always |
| `mergeSuccess` | merge | `steps.merge.success` | ✅ Always |
| `mergeSha` | merge | `steps.merge.sha` | ✅ Always |
| `classification` | N/A | N/A | ❌ Not available (bugfix has no classify step) |

**Note:** The bugfix workflow does NOT have a `classify` step. Classification only occurs in:
- The triage workflow (which routes to bugfix)
- The feature workflow (which has its own classify step)

When bugfix runs standalone, there is no classification data. When bugfix is called from triage, the classification exists in the parent workflow but is NOT passed through the input.

### 5.2 Feature Workflow Data Sources

| Field | Source Step | Path | Availability |
|-------|------------|------|--------------|
| `classification` | classify | `steps.classify` (full object) | ✅ Always |
| `designSummary` | design-wait | `steps['design-wait'].summary` | ✅ Always |
| `planAuditVerdict` | plan-cycle | `steps['plan-cycle'].verdict` or `steps['feature-plan-audit'].verdict` | ✅ Always |
| `implementationSummary` | implement-wait | `steps['implement-wait'].summary` | ✅ Always |
| (All other fields same as bugfix) | - | - | ✅ Always |

### 5.3 DoWhile Loop Output Handling

**Challenge:** Both workflows have dowhile loops (audit-cycle, plan-cycle) that may iterate multiple times.

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines 696-703:**

```typescript
if (status !== "failed" && status !== "suspended") {
    output = {
        ...(typeof iterOutput === "object" && iterOutput !== null
            ? iterOutput
            : { value: iterOutput }),
        _totalIterations: iteration
    };
}
```

**Finding:** The dowhile step's output contains:
- The output from the LAST iteration (spread into the object)
- A `_totalIterations` field

**Example:** If `fix-audit` runs twice and finally passes, `steps['audit-cycle']` contains:
```json
{
  "verdict": "PASS",
  "severity": "none",
  "issues": [...],
  "positives": [...],
  "summary": "...",
  "checklist": {...},
  "_totalIterations": 2
}
```

**Resolution Strategy:** Reference both `steps['audit-cycle'].verdict` and `steps['fix-audit'].verdict` with a fallback pattern. The audit-cycle output will contain the last iteration's fix-audit output spread into it.

**Template Pattern:**
```javascript
auditVerdict: "{{steps['audit-cycle'].verdict || steps['fix-audit'].verdict}}"
```

This works because:
- If audit-cycle completed, its output contains the final fix-audit output (spread)
- If audit-cycle was skipped (shouldn't happen), fallback to fix-audit directly

---

## 6. Testing Strategy

### 6.1 Unit Tests

**File:** `tests/unit/workflow-output-summary.test.ts` (NEW)

**Test Cases:**
1. Transform step with inputMapping resolves templates correctly
2. Nested step references (dowhile outputs) are resolved
3. Missing fields resolve to null/empty string instead of throwing
4. Complex objects are serialized correctly
5. Workflow output equals transform step output

**Example Test:**
```typescript
it("aggregates bugfix workflow output correctly", async () => {
    const result = await executeWorkflowDefinition({
        definition: {
            steps: [
                {
                    id: "intake",
                    type: "transform",
                    inputMapping: {
                        issueNumber: 42,
                        issueUrl: "https://github.com/test/repo/issues/42"
                    }
                },
                {
                    id: "merge",
                    type: "transform",
                    inputMapping: {
                        success: true,
                        sha: "abc123",
                        message: "Merged"
                    }
                },
                {
                    id: "output-summary",
                    type: "transform",
                    inputMapping: {
                        issueNumber: "{{steps.intake.issueNumber}}",
                        issueUrl: "{{steps.intake.issueUrl}}",
                        mergeResult: "{{steps.merge}}"
                    }
                }
            ]
        },
        input: {}
    });
    
    expect(result.output).toEqual({
        issueNumber: 42,
        issueUrl: "https://github.com/test/repo/issues/42",
        mergeResult: { success: true, sha: "abc123", message: "Merged" }
    });
});
```

### 6.2 Integration Tests

**Test Scenarios:**

1. **Bugfix workflow end-to-end** (with mocked Cursor/GitHub APIs):
   - Verify outputJson contains all expected fields
   - Verify nested dowhile outputs are resolved correctly
   - Verify missing optional fields don't cause errors

2. **Feature workflow end-to-end** (with mocked Cursor/GitHub APIs):
   - Verify classification object is included
   - Verify design and plan summaries are captured
   - Verify all expected fields are present

3. **Triage workflow routing**:
   - Verify sub-workflow outputs bubble up correctly
   - Verify triage workflow's outputJson includes classification + sub-workflow result

### 6.3 Manual Testing Checklist

- [ ] Run bugfix workflow from UI (test page) and verify output structure
- [ ] Run feature workflow from UI (test page) and verify output structure
- [ ] Trigger workflow via webhook and verify output
- [ ] Execute workflow via API and check response
- [ ] Resume suspended workflow and verify output after resume
- [ ] Check workflow run detail page shows structured output
- [ ] Verify Inngest execution path saves output correctly

---

## 7. Risk Assessment

### 7.1 Risk Level: **LOW**

**Justification:**
- Additive change only (new step appended)
- Does not modify existing steps or their logic
- Does not change workflow runtime behavior
- Transform steps are well-tested (existing unit tests pass)
- No database schema changes required
- No API contract changes

### 7.2 Potential Issues

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Template resolution fails for missing fields | Low | Low | Use conditional expressions with fallbacks |
| DoWhile output structure unexpected | Low | Medium | Test with actual workflow runs before deploying |
| Large output exceeds JSON field limits | Very Low | Low | Output summary is metadata only (~2KB), well under limits |
| Breaking change for existing runs | None | None | Only affects new runs; existing runs unchanged |

### 7.3 Rollback Plan

If issues arise after deployment:

1. **Immediate:** Revert the workflow definitions by removing the output-summary step
2. **Re-seed:** Run `bun run scripts/seed-sdlc-playbook.ts` with the old definitions
3. **Existing runs:** Unaffected (outputJson is immutable after completion)

**Rollback complexity:** Very low (single script execution)

---

## 8. Implementation Checklist

### 8.1 Code Changes

- [ ] **Add output-summary step to bugfixWorkflowDef** in `scripts/seed-sdlc-playbook.ts` (after line 1202)
- [ ] **Add output-summary step to featureWorkflowDef** in `scripts/seed-sdlc-playbook.ts` (after line 1423)
- [ ] Run `bun run scripts/seed-sdlc-playbook.ts` to update database workflow definitions

### 8.2 Testing

- [ ] Add unit tests for transform step output aggregation in `tests/unit/workflow-output-summary.test.ts`
- [ ] Run existing workflow runtime tests: `bun test tests/unit/workflow-runtime.test.ts`
- [ ] Manual test: Execute bugfix workflow and verify output structure
- [ ] Manual test: Execute feature workflow and verify output structure
- [ ] Manual test: Verify workflow UI displays structured output correctly

### 8.3 Documentation

- [ ] Update workflow documentation to explain output structure
- [ ] Add example output to workflow descriptions
- [ ] Document the pattern for future workflow authors

### 8.4 Validation

- [ ] Run `bun run type-check` (should pass)
- [ ] Run `bun run lint` (should pass)
- [ ] Run `bun run build` (should succeed)
- [ ] Verify in Prisma Studio that workflow definitions are updated

---

## 9. Follow-Up Improvements

### 9.1 Short-Term (Same PR)

1. **Add totalDurationMs to summary**: Include a reference to the existing `durationMs` field or calculate in the transform step if possible
2. **Standardize output schema**: Define a TypeScript interface for the expected output structure
3. **UI Enhancements**: Update workflow run detail page to render structured output in a dedicated summary panel

### 9.2 Medium-Term (Future Issues)

1. **Output Schema Validation**: Add Zod schema validation for workflow outputs
2. **Output Templates**: Allow workflows to define custom output templates
3. **Workflow Metrics Dashboard**: Build dashboards using structured outputs (success rate by priority, avg duration by complexity, etc.)
4. **Classification Pass-Through**: Modify triage workflow to pass classification data to sub-workflows (or add classify step to bugfix)

### 9.3 Long-Term (Future Enhancements)

1. **Output Transformation DSL**: Extend inputMapping to support more complex aggregations (array mapping, filtering, computed fields)
2. **Workflow Output Hooks**: Add post-execution hooks for custom output processing
3. **Workflow Composition Patterns**: Document best practices for multi-workflow systems

---

## 10. Related Code References

### 10.1 Core Files Modified

| File | Lines | Change Type |
|------|-------|-------------|
| `scripts/seed-sdlc-playbook.ts` | After 1202 | Add transform step to bugfix |
| `scripts/seed-sdlc-playbook.ts` | After 1423 | Add transform step to feature |

### 10.2 Related Files (No Changes Needed)

| File | Relevance |
|------|-----------|
| `packages/agentc2/src/workflows/builder/runtime.ts` | Workflow runtime (already supports transform steps) |
| `packages/agentc2/src/workflows/builder/types.ts` | Type definitions (no changes needed) |
| `apps/agent/src/app/api/workflows/[slug]/execute/route.ts` | Execution API (works correctly with transform outputs) |
| `apps/agent/src/app/api/workflows/[slug]/execute/stream/route.ts` | Streaming API (works correctly) |
| `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/resume/route.ts` | Resume API (works correctly) |
| `apps/agent/src/lib/inngest-functions.ts` | Background execution (works correctly) |
| `packages/agentc2/src/tools/merge-deploy-tools.ts` | Merge tool definition (unchanged) |
| `packages/agentc2/src/tools/ticket-to-github-issue.ts` | Intake tool (unchanged) |
| `packages/agentc2/src/tools/cursor-tools.ts` | Cursor tools (unchanged) |
| `packages/agentc2/src/tools/github-create-pr.ts` | PR creation tool (unchanged) |

---

## 11. Success Criteria

The fix is successful when:

1. ✅ **Bugfix workflow** `outputJson` contains:
   - Issue metadata (number, URL)
   - Analysis summary
   - Audit verdict
   - Implementation summary
   - PR metadata (number, URL)
   - Merge result

2. ✅ **Feature workflow** `outputJson` contains:
   - Issue metadata
   - Classification object (type, priority, complexity)
   - Design summary
   - Plan audit verdict
   - Implementation summary
   - PR metadata
   - Merge result

3. ✅ **Backward Compatibility:** Existing workflow runs are unaffected

4. ✅ **UI Improvements:** Workflow run detail pages show structured output clearly

5. ✅ **No Regressions:** All existing tests pass, workflows execute successfully

---

## 12. Open Questions & Clarifications Needed

### 12.1 Classification Data in Bugfix Workflow

**Question:** Should the bugfix workflow include classification data in its output?

**Context:**
- Bugfix workflow has NO classify step (unlike feature workflow)
- When run via triage, classification exists in parent context but isn't passed through
- When run standalone, no classification data exists

**Options:**
1. **Omit classification** from bugfix output (current recommendation)
2. **Add classify step** to bugfix workflow (would duplicate triage classification)
3. **Pass classification through input** when bugfix is called from triage

**Recommendation:** Option 1 - Omit classification from bugfix output. If needed, add classification to the bugfix workflow's input schema and have triage pass it through.

### 12.2 DoWhile Output Access Pattern

**Question:** Is `steps['audit-cycle'].verdict` the correct way to access the final iteration's verdict?

**Context:** DoWhile spreads the final iteration's output into its own output object.

**Validation Needed:** Test with actual workflow execution to confirm the access pattern works.

**Fallback Pattern:** Use `steps['audit-cycle'].verdict || steps['fix-audit'].verdict` to handle both cases.

### 12.3 Null/Undefined Handling

**Question:** What should happen when a step didn't execute (e.g., workflow failed before PR creation)?

**Current Behavior:** Template expressions return empty string for null/undefined.

**Recommendation:** This is acceptable. Failed workflows will have partial output, which is correct.

---

## 13. Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Setup** | 10 min | Create feature branch, read existing code |
| **Implementation** | 60 min | Add transform steps to both workflow definitions |
| **Testing** | 45 min | Add unit tests, run existing tests, manual testing |
| **Documentation** | 30 min | Update workflow docs, add inline comments |
| **Code Review** | 15 min | Self-review, verify type-check, lint, build |
| **Deployment** | 10 min | Commit, push, run seed script in production |

**Total Estimated Time:** 2.5-3 hours

---

## 14. Architectural Insights

### 14.1 Why This Pattern Works

The transform step solution is elegant because:

1. **Declarative:** The output structure is defined in the workflow definition, not in code
2. **Visible:** Anyone reading the workflow can see what the output will be
3. **Maintainable:** Changing the output structure doesn't require code changes
4. **Reusable:** The same pattern applies to any workflow needing output aggregation
5. **Type-Safe:** Template expressions are validated at runtime

### 14.2 Design Pattern: Output Aggregation Step

**Pattern Name:** Terminal Transform Pattern

**When to Use:**
- Multi-step workflows where the final step's output alone is insufficient
- Workflows that need to report on intermediate results
- Pipelines where observability and metrics are important

**Implementation:**
1. Add a transform step as the LAST step in the workflow
2. Use inputMapping to aggregate data from previous steps
3. Reference step outputs using `{{steps.stepId.field}}` syntax
4. Use fallback expressions for optional data: `{{steps.foo?.bar || 'default'}}`

**Anti-Pattern:** Do NOT add output aggregation in the middle of the workflow (it won't be the final output).

### 14.3 Why Runtime Modification Wasn't Chosen

Modifying the runtime to automatically aggregate outputs would require:
- Configuration to specify which fields to aggregate from which steps
- Different aggregation logic for different workflow types
- Breaking changes for workflows that expect the last step's output
- Additional complexity in the execution layer

The transform step approach keeps aggregation logic in the workflow definition where it belongs, maintains backward compatibility, and leverages existing capabilities.

---

## 15. Conclusion

### Root Cause

The workflow runtime returns the output of the last step as the workflow's final output. Since both SDLC workflows terminate with a "merge" tool step that returns only `{success, sha, message}`, the WorkflowRun.outputJson field contains only the merge result, not a comprehensive pipeline summary.

### Fix

Add a "transform" step as the final step in both `sdlc-bugfix` and `sdlc-feature` workflow definitions. This step uses `inputMapping` to aggregate key data from all previous steps into a structured output object matching the expected schema.

### Impact

- **Low risk** additive change
- **High value** improvement to observability and UX
- **Quick implementation** (~3 hours total)
- **No breaking changes** to existing workflows or APIs
- **Enables future improvements** like metrics dashboards and automated reporting

### Next Steps

1. Implement the transform steps in `scripts/seed-sdlc-playbook.ts`
2. Add unit tests validating the aggregation logic
3. Run seed script to update workflow definitions in database
4. Manual test both workflows to verify output structure
5. Update documentation with output schema
6. Consider follow-up enhancements (total duration calculation, UI improvements)

---

## Appendix A: Expected Output Schemas

### Bugfix Workflow Output Schema

```typescript
interface BugfixWorkflowOutput {
    // Issue metadata
    issueNumber: number;
    issueUrl: string;
    repository: string;
    
    // Analysis phase
    analysisSummary: string | null;
    analysisAgentId: string;
    analysisDurationMs: number;
    
    // Audit phase
    auditVerdict: "PASS" | "NEEDS_REVISION" | "FAIL";
    auditSeverity: "none" | "minor" | "major" | "critical";
    auditSummary: string;
    
    // Implementation phase
    implementationSummary: string | null;
    implementationBranch: string | null;
    implementationAgentId: string;
    implementationDurationMs: number;
    
    // PR phase
    prNumber: number;
    prUrl: string;
    
    // Merge phase
    mergeResult: {
        success: boolean;
        sha: string | null;
        message: string;
    };
    
    // Metadata
    workflowType: "bugfix";
    pipelineVersion: "v1";
}
```

### Feature Workflow Output Schema

```typescript
interface FeatureWorkflowOutput {
    // Issue metadata
    issueNumber: number;
    issueUrl: string;
    repository: string;
    
    // Classification phase (feature-specific)
    classification: {
        type: string;
        priority: string;
        complexity: string;
        affectedAreas: string[];
        rationale: string;
    };
    
    // Design phase
    designSummary: string | null;
    designAgentId: string;
    designDurationMs: number;
    
    // Planning phase
    planAuditVerdict: "PASS" | "NEEDS_REVISION" | "FAIL";
    planAuditSeverity: "none" | "minor" | "major" | "critical";
    
    // Implementation phase
    implementationSummary: string | null;
    implementationBranch: string | null;
    implementationAgentId: string;
    implementationDurationMs: number;
    
    // PR phase
    prNumber: number;
    prUrl: string;
    
    // Merge phase
    mergeResult: {
        success: boolean;
        sha: string | null;
        message: string;
    };
    
    // Metadata
    workflowType: "feature";
    pipelineVersion: "v1";
}
```

---

## Appendix B: Code Snippets

### Transform Step Template (Generic)

```javascript
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate Output Summary",
    description: "Aggregate key pipeline data into structured output",
    inputMapping: {
        // Map fields from previous steps using template expressions
        fieldName: "{{steps.stepId.fieldName}}",
        nestedObject: {
            subField: "{{steps.anotherStep.data}}"
        },
        // Use helpers for complex transformations
        serializedData: "{{helpers.json(steps.someStep)}}",
        // Fallback for optional fields
        optionalField: "{{steps.maybeStep?.field || null}}"
    }
}
```

### Testing Transform Output

```typescript
import { executeWorkflowDefinition } from "@repo/agentc2/workflows";

const result = await executeWorkflowDefinition({
    definition: yourWorkflow,
    input: testInput
});

// Verify output structure
expect(result.output).toMatchObject({
    issueNumber: expect.any(Number),
    issueUrl: expect.stringMatching(/^https:\/\/github\.com\//),
    prNumber: expect.any(Number)
});
```

---

**Analysis Completed By:** Cloud Agent (Claude Sonnet 4)  
**Analysis Date:** March 4, 2026  
**Review Status:** Ready for Human Review  
**Approved for Implementation:** Pending

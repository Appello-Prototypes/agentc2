# Root Cause Analysis: SDLC Workflow Run Output Missing Structured Summary

**Issue:** https://github.com/Appello-Prototypes/agentc2/issues/64  
**Repository:** Appello-Prototypes/agentc2  
**Date:** 2026-03-04  
**Analyst:** Cloud Agent (Cursor AI)

---

## Executive Summary

The SDLC Bugfix workflow (`sdlc-bugfix-agentc2`) saves only the raw merge tool output to `WorkflowRun.outputJson` instead of a structured pipeline summary. This occurs because:

1. **Root Cause**: The workflow runtime returns only the last step's output as the workflow's final output
2. **Missing Component**: The bugfix workflow definition lacks an output aggregation step at the end
3. **Impact**: Consumers of the workflow output (UI, API clients, downstream tools) cannot easily access key pipeline data without manually traversing all step outputs

**Severity**: Medium  
**Complexity**: Low  
**Risk**: Low

---

## Detailed Root Cause Analysis

### 1. Workflow Execution Flow

**File:** `/workspace/packages/agentc2/src/workflows/builder/runtime.ts`  
**Function:** `executeSteps()`  
**Lines:** 802-807

```typescript
const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
return {
    status: "success",
    output,
    steps: executionSteps
};
```

The workflow runtime's `executeSteps()` function determines the workflow's final output by returning **only the output of the last step** in the steps array (line 802). This is by design for general workflow execution, but it means workflows must explicitly aggregate data if they want a structured summary.

### 2. Database Persistence

**File:** `/workspace/apps/agent/src/app/api/workflows/[slug]/execute/route.ts`  
**Function:** `POST()`  
**Line:** 177

```typescript
await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
        status: finalStatus,
        outputJson: result.output as Prisma.InputJsonValue,  // ← Direct assignment
        completedAt: new Date(),
        durationMs,
        totalTokens,
        totalCostUsd: ...
    }
});
```

The `result.output` from `executeWorkflowDefinition()` is directly saved to `WorkflowRun.outputJson` without any transformation or aggregation logic.

### 3. SDLC Bugfix Workflow Definition

**File:** `/workspace/scripts/seed-sdlc-playbook.ts`  
**Variable:** `bugfixWorkflowDef`  
**Lines:** 1015-1204

The bugfix workflow contains the following steps (in order):

| Step ID | Type | Purpose | Key Outputs |
|---------|------|---------|-------------|
| `intake` | tool | Create GitHub issue | `issueUrl`, `issueNumber` |
| `analyze-launch` | tool | Launch Cursor analysis agent | `agentId` |
| `analyze-wait` | tool | Poll Cursor until done | `summary`, `durationMs`, `branchName` |
| `analyze-result` | tool | Get conversation history | `messages` |
| `post-analysis` | tool | Comment analysis on issue | `commentUrl` |
| `audit-cycle` | dowhile | Audit & approval loop | (nested steps below) |
| ↳ `fix-audit` | agent | Audit the fix plan | `verdict`, `severity`, `summary`, `issues`, `positives`, `checklist` |
| ↳ `fix-verdict-route` | branch | Route based on verdict | |
| ↳ ↳ `fix-review` | human | Human approval gate (if PASS) | `approved`, `rejected`, `feedback` |
| ↳ ↳ `fix-audit-notes` | tool | Post audit feedback (if not PASS) | |
| `implement-launch` | tool | Launch Cursor coding agent | `agentId` |
| `implement-wait` | tool | Poll Cursor until done | `summary`, `durationMs`, `branchName` |
| `create-pr` | tool | Create pull request | `htmlUrl`, `prNumber`, `url` |
| `merge-review` | human | Human approval for merge | `approved`, `rejected` |
| **`merge`** | **tool** | **Merge PR** ← LAST STEP | **Merge confirmation** |

**Problem**: The last step is `merge`, which calls the `merge-pull-request` tool. Its output is likely just a confirmation object like `{ success: true, merged: true }`, not a structured pipeline summary.

### 4. Missing Output Aggregation Step

**Expected behavior**: After the `merge` step completes, there should be an additional `transform` step that aggregates key data from previous steps into a structured summary.

**Example from other workflows** (`seed-workflows-networks.ts`, lines 110-119):

```typescript
{
    id: "assemble-response",
    type: "transform",
    name: "Assemble response",
    inputMapping: {
        ticketId: "{{steps.ticket-id.id}}",
        triage: "{{steps.triage-request}}",
        receivedAt: "{{steps.ticket-id.timestamp}}",
        request: "{{steps.capture-request}}"
    }
}
```

The bugfix workflow definition **does not include** such an aggregation step.

### 5. Impact on Data Access

**Affected Components:**

1. **UI Display** (`/workspace/apps/agent/src/app/workflows/[workflowSlug]/runs/page.tsx`, line 536):
   - Shows `outputJson` as raw JSON
   - Users must manually drill into step outputs to find issue URL, PR URL, audit verdict

2. **API Consumers** (`/workspace/apps/agent/src/app/api/workflows/[slug]/runs/[runId]/route.ts`):
   - Returns `outputJson` in response
   - Downstream integrations must parse individual steps

3. **Workflow Metrics & Evaluation** (referenced in `execute/route.ts`, line 187):
   - `refreshWorkflowMetrics()` may expect structured outputs for reporting

4. **Human Engagement Context** (`/workspace/packages/agentc2/src/workflows/human-engagement.ts`):
   - Creates approval requests with step outputs
   - Could benefit from structured summary in main output

---

## Additional Discovery: Classification Data Not Available

**Issue**: The bug report mentions the output should include "classification", but the bugfix workflow **does not have a classification step**.

**Comparison:**

- **Standard workflow** (`standardWorkflowDef`, lines 773-1013): Has a `classify` step (line 794-802) that invokes `sdlc-classifier-agentc2` agent
- **Triage workflow** (`triageWorkflowDef`, lines 1427-1551): Has a `classify` step (line 1446-1456)
- **Bugfix workflow** (`bugfixWorkflowDef`, lines 1015-1204): **NO classify step**

The bugfix workflow is designed to skip classification and go directly to analysis. This is architecturally sound (bugfix workflow is already routed to from triage after classification), but it means:

- Classification data from the parent triage workflow is NOT passed to bugfix workflow
- If bugfix workflow is invoked directly (not via triage), classification data doesn't exist

---

## Fix Plan

### Option A: Add Output Aggregation Step (Recommended)

**Approach**: Add a `transform` step as the final step of the bugfix workflow to aggregate key data from previous steps.

**Implementation Steps:**

1. **Modify**: `/workspace/scripts/seed-sdlc-playbook.ts`
   - Line 1203: Add new transform step after the `merge` step
   - Insert before the closing `]` of the `steps` array in `bugfixWorkflowDef`

2. **New Step Definition**:

```typescript
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate Pipeline Summary",
    inputMapping: {
        status: "completed",
        issueUrl: "{{steps.intake.issueUrl}}",
        issueNumber: "{{steps.intake.issueNumber}}",
        analysis: {
            summary: "{{steps['analyze-wait'].summary}}",
            durationMs: "{{steps['analyze-wait'].durationMs}}",
            agentId: "{{steps['analyze-launch'].agentId}}"
        },
        audit: {
            verdict: "{{steps['fix-audit'].verdict}}",
            severity: "{{steps['fix-audit'].severity}}",
            summary: "{{steps['fix-audit'].summary}}"
        },
        implementation: {
            summary: "{{steps['implement-wait'].summary}}",
            durationMs: "{{steps['implement-wait'].durationMs}}",
            branchName: "{{steps['implement-wait'].branchName}}",
            agentId: "{{steps['implement-launch'].agentId}}"
        },
        pullRequest: {
            url: "{{steps['create-pr'].htmlUrl}}",
            number: "{{steps['create-pr'].prNumber}}"
        },
        merge: {
            approved: "{{steps['merge-review'].approved}}",
            mergedAt: "{{now()}}"
        }
    }
}
```

3. **Reseed Database**: Run `bun run scripts/seed-sdlc-playbook.ts` to update workflow definition

4. **Files Modified**: 
   - `/workspace/scripts/seed-sdlc-playbook.ts` (1 file)

**Risk Assessment**: **Low**
- Transform step is passive (no side effects)
- Does not change workflow execution logic
- Backward compatible (existing runs unaffected)
- No external API calls or state changes

**Estimated Complexity**: **Low** (15-30 minutes)

**Testing Requirements**:
- Unit test: Verify transform step outputs correct structure
- Integration test: Execute bugfix workflow end-to-end and verify outputJson structure
- Manual test: Trigger workflow via webhook and inspect outputJson in database

**Edge Cases to Consider**:
- What if `fix-audit` step never executes (workflow fails before audit)?
  - Template will resolve to empty strings for missing values (line 191-193 in runtime.ts)
- What if `merge-review` is not executed (human rejects during audit)?
  - Workflow would suspend/fail, outputJson would still be set to last completed step
- What if `create-pr` fails?
  - Workflow fails, outputJson contains error from failed step

---

### Option B: Add Classification Step to Bugfix Workflow

**Approach**: Add an explicit classification step at the beginning of the bugfix workflow to capture ticket metadata.

**Pros**:
- Provides richer context for analysis
- Classification data available for output aggregation
- Consistent with standard and triage workflows

**Cons**:
- Redundant if bugfix is invoked from triage (classification already done)
- Increases workflow execution time
- Requires conditional logic to skip if classification already provided

**Recommendation**: **Not necessary**. The bugfix workflow is designed as a sub-workflow invoked after triage classification. Adding classification would be redundant and increase costs. If classification is needed in output, it should be passed via input parameters from the parent triage workflow.

---

### Option C: Enhance Workflow Runtime to Support Output Mapping Config

**Approach**: Add `outputMapping` configuration to workflow definition that allows declarative output aggregation.

**Example**:

```typescript
const bugfixWorkflowDef = {
    steps: [...],
    outputMapping: {
        issueUrl: "{{steps.intake.issueUrl}}",
        analysis: "{{steps['analyze-wait'].summary}}",
        // ...
    }
};
```

**Pros**:
- Declarative configuration
- Reusable across all workflows
- Cleaner separation of concerns

**Cons**:
- Requires changes to workflow runtime engine
- Requires changes to workflow definition schema
- More complex implementation (schema migration, runtime changes, validation)
- Higher risk of breaking existing workflows

**Recommendation**: **Defer to future enhancement**. Option A achieves the goal with minimal changes and existing infrastructure.

---

## Recommended Fix: Option A

**File to Modify**: `/workspace/scripts/seed-sdlc-playbook.ts`

**Specific Changes**:

1. **Line 1203**: Add new transform step after `merge` step
2. **Placement**: Insert as the last element in the `bugfixWorkflowDef.steps` array

**Code to Add** (after line 1202, before line 1203):

```typescript
            {
                id: "output-summary",
                type: "transform",
                name: "Aggregate Pipeline Summary",
                inputMapping: {
                    status: "completed",
                    ticket: {
                        title: "{{input.title}}",
                        issueUrl: "{{steps.intake.issueUrl}}",
                        issueNumber: "{{steps.intake.issueNumber}}"
                    },
                    analysis: {
                        summary: "{{steps['analyze-wait'].summary}}",
                        durationMs: "{{steps['analyze-wait'].durationMs}}",
                        agentId: "{{steps['analyze-launch'].agentId}}"
                    },
                    audit: {
                        verdict: "{{steps['fix-audit'].verdict}}",
                        severity: "{{steps['fix-audit'].severity}}",
                        summary: "{{steps['fix-audit'].summary}}",
                        totalIterations: "{{steps['audit-cycle']._totalIterations}}"
                    },
                    implementation: {
                        summary: "{{steps['implement-wait'].summary}}",
                        durationMs: "{{steps['implement-wait'].durationMs}}",
                        branchName: "{{steps['implement-wait'].branchName}}",
                        agentId: "{{steps['implement-launch'].agentId}}"
                    },
                    pullRequest: {
                        url: "{{steps['create-pr'].htmlUrl}}",
                        number: "{{steps['create-pr'].prNumber}}"
                    },
                    merge: {
                        approved: "{{steps['merge-review'].approved}}",
                        timestamp: "{{now()}}"
                    }
                }
            }
```

**Comma Addition**: Line 1202 currently ends with `}` — change to `},` to allow the new step to follow.

**After Code Change**: Run `bun run scripts/seed-sdlc-playbook.ts` to update the database.

---

## Impact Assessment

### Affected Components

1. **Direct Impact - Workflow Output**:
   - `WorkflowRun.outputJson` field in database
   - `/api/workflows/[slug]/runs/[runId]` API response
   - `/workflows/[workflowSlug]/runs` UI page

2. **Indirect Impact - Downstream Consumers**:
   - Workflow metrics and evaluation systems may benefit from structured output
   - Human engagement context could reference structured summary
   - Any external integrations consuming workflow output via API
   - Workflow evaluation LLMs that assess output quality

3. **No Impact**:
   - Individual step outputs (`WorkflowRunStep.outputJson`) remain unchanged
   - Step-level data still accessible via step drill-down
   - Existing workflow runs in database unaffected (historical data)
   - Other workflows (triage, feature, standard) not affected by this change

### Backward Compatibility

**Breaking Changes**: None

- Existing runs with old output format remain valid
- Step-level data access unchanged
- API response structure unchanged (only `outputJson` content changes)
- UI already handles arbitrary JSON in outputJson field

**Forward Compatibility**: Yes

- New runs will have structured output
- Old and new output formats can coexist
- No schema migration required

---

## Classification Data Availability

**Issue Clarification**: The bug report mentions "classification" should be in the output, but:

**Finding**: The bugfix workflow **does not include a classify step**.

**Workflow Architecture**:

```
Triage Workflow (entry point)
├── intake (create issue)
├── classify (sdlc-classifier agent) ← Classification happens HERE
└── route (branch by classification)
    ├── If bug → Call bugfix workflow (no classification step)
    ├── If feature → Call feature workflow
    └── Else → Generate KB article
```

**Implication**: Classification data exists in the **triage workflow** but is NOT passed to the bugfix sub-workflow.

**Solutions**:

1. **Option 1**: Add classification data to bugfix workflow input parameters when invoked from triage
   - Modify triage workflow's `run-bugfix` step (line 1481-1495) to pass classification
   - Add to bugfix input: `classification: "{{steps.classify.classification}}"`

2. **Option 2**: Include classification in output summary only if available
   - Use conditional template: `{{#if input.classification}}{{input.classification}}{{/if}}`

**Recommendation**: Option 2 (conditional inclusion) for maximum flexibility. Bugfix workflow can be invoked directly or from triage.

---

## Testing Requirements

### 1. Unit Tests

**File to Create/Modify**: `/workspace/tests/unit/workflow-output-aggregation.test.ts`

**Test Cases**:

```typescript
describe("SDLC Bugfix Workflow Output Aggregation", () => {
    it("should aggregate key data into structured output", async () => {
        // Mock workflow execution with sample step outputs
        // Verify final outputJson contains all required fields
    });

    it("should handle missing classification gracefully", async () => {
        // Execute without classification in input
        // Verify output doesn't break
    });

    it("should handle failed audit cycle", async () => {
        // Simulate audit failure
        // Verify output still contains available data
    });
});
```

### 2. Integration Tests

**File to Create/Modify**: `/workspace/tests/integration/api/sdlc-bugfix-workflow.test.ts`

**Test Scenarios**:

1. Execute full bugfix workflow with mocked Cursor agents
2. Verify `WorkflowRun.outputJson` matches expected structure
3. Test API response returns structured output
4. Verify UI can render the structured output

### 3. Manual Testing

**Procedure**:

1. Trigger bugfix workflow via webhook or API
2. Monitor execution through to completion
3. Query database: `SELECT outputJson FROM workflow_run WHERE id = '<run-id>'`
4. Verify structure matches specification
5. Check UI display in `/workflows/sdlc-bugfix-agentc2/runs`

**Test Input**:

```json
{
    "title": "Test bug for output aggregation",
    "description": "Verify outputJson contains structured summary",
    "repository": "Appello-Prototypes/agentc2"
}
```

---

## Dependencies & Related Code

### Transform Step Implementation

**File**: `/workspace/packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines**: 735-738

```typescript
case "transform":
default:
    output = stepInput;
```

**Current Behavior**: Transform step returns its `inputMapping` resolved values as output.

**Mechanism** (line 485):
```typescript
const stepInput = resolveInputMapping(step.inputMapping, context);
```

The `inputMapping` is resolved using the workflow context (which includes all previous step outputs in `context.steps`), then assigned as the step's output.

### Template Resolution

**File**: `/workspace/packages/agentc2/src/workflows/builder/runtime.ts`  
**Function**: `resolveTemplate()`  
**Lines**: 175-196

Supports:
- Simple expressions: `{{steps.intake.issueUrl}}`
- Complex expressions: `{{helpers.json(steps['fix-audit'].issues)}}`
- Helper functions: `{{now()}}`, `{{today()}}`, `{{json(...)}}`
- Conditional templates: `{{#if condition}}...{{/if}}`

**Key Detail** (lines 191-193):
```typescript
if (resolved === undefined || resolved === null) {
    return "";  // Unresolved templates return empty string
}
```

This means missing data gracefully degrades to empty strings rather than breaking the workflow.

### Accessing Nested Step Data

**File**: `/workspace/packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines**: 690 (dowhile loop)

```typescript
Object.assign(context.steps, iterContext.steps);
```

**Key Insight**: Steps inside `dowhile` loops are merged into the main context, so `steps['fix-audit']` is directly accessible even though it's nested inside the `audit-cycle` dowhile step.

---

## Risk Assessment

### Implementation Risk: **Low**

**Factors**:

✅ **Non-breaking**: Transform step is passive; doesn't change execution logic  
✅ **Isolated**: Only affects bugfix workflow, not shared runtime  
✅ **Reversible**: Can remove step or revert seed script easily  
✅ **Tested**: Transform step type already exists and is used in other workflows  
✅ **No schema changes**: Uses existing `outputJson` field  

⚠️ **Considerations**:

- Must re-run seed script to update database
- Existing workflow runs retain old output format
- Template syntax must be valid (test with sample execution)

### Deployment Risk: **Low**

**Deployment Requirements**:

1. Update seed script in repository
2. Run seed script in target environment: `bun run scripts/seed-sdlc-playbook.ts`
3. Verify workflow definition updated: Check `Workflow.definitionJson` in database
4. Test with a real workflow execution

**Rollback Procedure**:

1. Revert seed script changes
2. Re-run seed script to restore previous definition
3. Or manually remove the output-summary step from database

### Data Consistency Risk: **Low**

- Historical workflow runs unaffected (no migration needed)
- New output format is purely additive
- No consumer code requires changes (outputJson is already arbitrary JSON)

---

## Estimated Effort

| Task | Time Estimate | Complexity |
|------|---------------|------------|
| Code changes | 10 minutes | Trivial |
| Reseed database | 5 minutes | Trivial |
| Write unit tests | 30 minutes | Low |
| Integration testing | 30 minutes | Low |
| Manual verification | 15 minutes | Low |
| Documentation update | 15 minutes | Low |
| **Total** | **~2 hours** | **Low** |

---

## Recommended Action Items

### Immediate (Fix Bug)

1. ✅ **Add output aggregation step to bugfix workflow**
   - File: `/workspace/scripts/seed-sdlc-playbook.ts`
   - Line: 1203 (after `merge` step)
   - Action: Insert transform step with structured inputMapping

2. ✅ **Reseed workflow definition**
   - Command: `bun run scripts/seed-sdlc-playbook.ts`
   - Verify: Check `Workflow.definitionJson` in Prisma Studio

3. ✅ **Test with sample execution**
   - Trigger test workflow run
   - Verify outputJson contains structured summary

### Follow-Up (Enhancement)

4. 🔄 **Pass classification from triage to bugfix** (Optional)
   - File: `/workspace/scripts/seed-sdlc-playbook.ts`
   - Line: 1481-1495 (triage workflow's run-bugfix step)
   - Action: Add classification to input mapping
   - Benefit: Include triage classification in bugfix output

5. 🔄 **Apply same pattern to feature workflow** (Consistency)
   - File: `/workspace/scripts/seed-sdlc-playbook.ts`
   - Line: 1424 (after feature workflow's merge step)
   - Action: Add similar output aggregation step

6. 🔄 **Consider declarative outputMapping** (Future)
   - Add `outputMapping` field to workflow schema
   - Implement in runtime to automatically aggregate on completion
   - Would eliminate need for explicit transform step

---

## Verification Checklist

After implementing the fix:

- [ ] Seed script executes without errors
- [ ] Workflow definition in database includes `output-summary` step
- [ ] Test execution shows structured outputJson
- [ ] All required fields present in output: `issueUrl`, `analysis`, `audit`, `pullRequest`, `merge`
- [ ] Missing/null fields degrade gracefully (empty strings)
- [ ] UI displays structured output correctly
- [ ] API response includes new output format
- [ ] No breaking changes to existing consumers

---

## Related Code References

### Core Files

1. **Workflow Runtime Engine**
   - `/workspace/packages/agentc2/src/workflows/builder/runtime.ts`
   - Lines 802-807: Output assignment logic
   - Lines 175-196: Template resolution
   - Lines 735-738: Transform step handler

2. **Workflow Execution API**
   - `/workspace/apps/agent/src/app/api/workflows/[slug]/execute/route.ts`
   - Line 177: outputJson persistence
   - Lines 84-89: executeWorkflowDefinition invocation

3. **Workflow Seed Script**
   - `/workspace/scripts/seed-sdlc-playbook.ts`
   - Lines 1015-1204: Bugfix workflow definition
   - Lines 773-1013: Standard workflow (for comparison)
   - Lines 1427-1551: Triage workflow

4. **UI Display**
   - `/workspace/apps/agent/src/app/workflows/[workflowSlug]/runs/page.tsx`
   - Lines 534-537: Output JSON display
   - `/workspace/apps/agent/src/app/workflows/[workflowSlug]/runs/[runId]/page.tsx`
   - Lines 332-350: Step output display

### Supporting Code

5. **Transform Step Examples**
   - `/workspace/scripts/seed-workflows-networks.ts`
   - Lines 56-63, 111-119: Transform step usage examples

6. **Database Schema**
   - `/workspace/packages/database/prisma/schema.prisma`
   - Lines 2648-2699: WorkflowRun model
   - Line 2656: `outputJson Json?` field definition

7. **Workflow Types**
   - `/workspace/packages/agentc2/src/workflows/builder/types.ts`
   - Lines 1-11: WorkflowStepType enum (includes "transform")

---

## Additional Observations

### 1. Missing Error Handling in Output Mapping

If a step fails mid-workflow, the last completed step's output becomes the workflow output. For robustness, the output aggregation step should:

- Use conditional templates: `{{#if steps['create-pr']}}...{{/if}}`
- Provide fallback values for optional steps
- Include workflow status indicator

### 2. Inconsistency Across Workflows

The standard workflow (deprecated) and feature workflow also lack output aggregation steps. For consistency:

- Apply the same pattern to `featureWorkflowDef` (lines 1206-1425)
- Consider standardizing output structure across all SDLC workflows

### 3. Classification Propagation Gap

When triage workflow invokes bugfix workflow (line 1481-1495), classification data is not passed:

```typescript
{
    id: "run-bugfix",
    type: "workflow",
    config: {
        workflowId: orgSlug("sdlc-bugfix"),
        input: {
            title: "{{input.title}}",
            description: "{{input.description}}",
            repository: "{{input.repository}}",
            labels: ["bug"],
            // ← Missing: classification, priority, complexity
        }
    }
}
```

**Recommendation**: Add classification to input mapping for context propagation.

---

## Conclusion

**Root Cause**: Workflow runtime returns only the last step's output (by design), and the bugfix workflow lacks an output aggregation step.

**Fix**: Add a `transform` step at the end of the bugfix workflow definition to aggregate key data from previous steps into a structured summary.

**Confidence Level**: High (100%)

**Evidence**:
- Direct code inspection confirms runtime behavior
- Workflow definition inspection confirms missing aggregation step
- Existing examples demonstrate transform step usage
- Template resolution system supports required data access

**Next Steps**: Implement Option A (recommended fix) with unit and integration tests.

---

**Analysis Complete** ✓

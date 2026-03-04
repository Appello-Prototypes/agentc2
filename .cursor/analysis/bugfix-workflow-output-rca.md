# Root Cause Analysis: Add structured output summary to bugfix workflow

**Issue:** [#72 - Add structured output summary to bugfix workflow](https://github.com/Appello-Prototypes/agentc2/issues/72)

**Date:** 2026-03-04

**Analyst:** Cloud Agent

---

## Executive Summary

The SDLC Bugfix workflow (`sdlc-bugfix-agentc2`) currently returns only the raw output of its final step (the `merge` step) in the `outputJson` field. This makes it difficult for consumers of the workflow (UIs, integrations, downstream workflows) to access key pipeline metadata without parsing through all workflow steps. The solution is to add a final `transform` step that aggregates important data from previous steps into a structured JSON summary.

---

## 1. Root Cause Analysis

### 1.1 Problem Statement

When the SDLC Bugfix workflow completes, the `outputJson` field stored in the database contains only the output of the last executed step. Currently, the last step is `merge` (step ID: `merge`), which returns the merge operation result from the GitHub API. This means:

- Consumers cannot easily access the GitHub issue URL without traversing steps
- Analysis summary and audit verdict are buried in intermediate step outputs
- PR URL requires looking up the `create-pr` step output
- Total duration must be manually calculated from step timestamps

### 1.2 Technical Root Cause

**File:** `/workspace/packages/agentc2/src/workflows/builder/runtime.ts`

**Lines:** 802-807

```typescript
const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
return {
    status: "success",
    output,
    steps: executionSteps
};
```

**Analysis:** The workflow runtime's `executeSteps` function returns the output of the last step in the steps array as the workflow's output. This is stored in the `WorkflowRun.outputJson` field via:

**File:** `/workspace/apps/agent/src/app/api/workflows/[slug]/execute/route.ts`

**Line:** 177

```typescript
outputJson: result.output as Prisma.InputJsonValue,
```

The bugfix workflow definition (defined in `/workspace/scripts/seed-sdlc-playbook.ts`, lines 1015-1203) ends with the `merge` step, so its output becomes the workflow's `outputJson`.

### 1.3 Current Workflow Structure

The `sdlc-bugfix-agentc2` workflow has these key steps:

1. **`intake`** (line 1017-1032) - Creates GitHub issue
   - Outputs: `issueUrl`, `issueNumber`

2. **`analyze-launch`** (line 1034-1044) - Launches Cursor Cloud Agent for analysis
   - Outputs: `agentId`

3. **`analyze-wait`** (line 1046-1056) - Polls until analysis completes
   - Outputs: `summary`, `durationMs`, `status`

4. **`analyze-result`** (line 1058-1067) - Gets full conversation
   - Outputs: `messages`

5. **`post-analysis`** (line 1069-1080) - Posts analysis to GitHub

6. **`audit-cycle`** (line 1082-1141) - Audit & approval loop (dowhile)
   - Contains `fix-audit` sub-step
   - Outputs: `verdict`, `severity`, `summary`, `issues`, `positives`

7. **`implement-launch`** (line 1143-1153) - Launches coding agent

8. **`implement-wait`** (line 1155-1165) - Polls until implementation completes
   - Outputs: `branchName`, `summary`, `durationMs`

9. **`create-pr`** (line 1167-1180) - Creates pull request
   - Outputs: `htmlUrl`, `prNumber`, `url`

10. **`merge-review`** (line 1182-1188) - Human approval for merge

11. **`merge`** (line 1190-1201) - **FINAL STEP** - Merges PR
    - Outputs: GitHub merge result (SHA, merged status, etc.)

### 1.4 Why This Is A Problem

**Current behavior:**
```json
{
  "outputJson": {
    "sha": "abc123...",
    "merged": true,
    "message": "Pull Request successfully merged"
  }
}
```

**Desired behavior:**
```json
{
  "outputJson": {
    "issueUrl": "https://github.com/org/repo/issues/123",
    "issueNumber": 123,
    "analysisSummary": "Root cause identified in auth middleware...",
    "analysisDurationMs": 45000,
    "auditVerdict": "PASS",
    "auditSeverity": "none",
    "prUrl": "https://github.com/org/repo/pull/456",
    "prNumber": 456,
    "mergeResult": {
      "sha": "abc123...",
      "merged": true
    },
    "totalDurationMs": 180000,
    "completedAt": "2026-03-04T10:30:00.000Z"
  }
}
```

---

## 2. Impact Assessment

### 2.1 Affected Systems

| System | Impact | Severity |
|--------|--------|----------|
| **Workflow consumers** | Cannot easily access pipeline metadata without traversing all steps | **High** |
| **UI components** | Must iterate through `workflowRunSteps` to build summary views | **High** |
| **Webhook integrations** | Downstream systems receive incomplete workflow result | **Medium** |
| **Playbook marketplace** | SDLC Flywheel playbook appears less polished | **Low** |
| **Learning/evaluation** | Harder to extract metrics for workflow quality scoring | **Medium** |

### 2.2 Current Workarounds

Users must:
1. Query the `WorkflowRun` record to get `outputJson` (incomplete)
2. Query all `WorkflowRunStep` records for the run
3. Parse step outputs by `stepId` to extract desired fields
4. Manually aggregate the data

Example workaround code:
```typescript
const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
const steps = await prisma.workflowRunStep.findMany({ 
  where: { runId }, 
  orderBy: { startedAt: 'asc' } 
});

const intakeStep = steps.find(s => s.stepId === 'intake');
const analyzeStep = steps.find(s => s.stepId === 'analyze-wait');
const auditStep = steps.find(s => s.stepId === 'fix-audit');
const prStep = steps.find(s => s.stepId === 'create-pr');

const summary = {
  issueUrl: intakeStep?.outputJson?.issueUrl,
  analysisSummary: analyzeStep?.outputJson?.summary,
  // ... etc
};
```

### 2.3 Data Flow

```
┌─────────────┐
│   intake    │ ──► issueUrl, issueNumber
└─────────────┘
       │
┌─────────────┐
│analyze-wait │ ──► summary, durationMs
└─────────────┘
       │
┌─────────────┐
│ fix-audit   │ ──► verdict, severity, issues
└─────────────┘
       │
┌─────────────┐
│ create-pr   │ ──► htmlUrl, prNumber
└─────────────┘
       │
┌─────────────┐
│    merge    │ ──► sha, merged  ◄── CURRENT outputJson
└─────────────┘
       │
       ▼
  [NEW STEP]
┌─────────────┐
│output-summary│ ──► Structured aggregation ◄── DESIRED outputJson
└─────────────┘
```

---

## 3. Detailed Fix Plan

### 3.1 Solution Overview

Add a new `transform` step at the end of the bugfix workflow that uses `inputMapping` to aggregate key data from previous steps into a structured JSON object. Transform steps are already supported by the workflow runtime and simply pass through their `inputMapping` as output.

### 3.2 Step-by-Step Implementation

#### Step 1: Add output summary step to bugfix workflow definition

**File to modify:** `/workspace/scripts/seed-sdlc-playbook.ts`

**Location:** After the `merge` step (line 1201), before the closing of `bugfixWorkflowDef.steps` array

**Change:**

Insert a new step:

```typescript
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate pipeline summary",
    description: "Aggregate key pipeline data into structured output for easy consumption",
    inputMapping: {
        issueUrl: "{{steps.intake.issueUrl}}",
        issueNumber: "{{steps.intake.issueNumber}}",
        analysisSummary: "{{steps['analyze-wait'].summary}}",
        analysisDurationMs: "{{steps['analyze-wait'].durationMs}}",
        analysisAgentId: "{{steps['analyze-launch'].agentId}}",
        auditVerdict: "{{steps['fix-audit'].verdict}}",
        auditSeverity: "{{steps['fix-audit'].severity}}",
        auditSummary: "{{steps['fix-audit'].summary}}",
        implementationBranch: "{{steps['implement-wait'].branchName}}",
        implementationSummary: "{{steps['implement-wait'].summary}}",
        implementationDurationMs: "{{steps['implement-wait'].durationMs}}",
        prUrl: "{{steps['create-pr'].htmlUrl}}",
        prNumber: "{{steps['create-pr'].prNumber}}",
        mergeResult: {
            sha: "{{steps.merge.sha}}",
            merged: "{{steps.merge.merged}}"
        },
        repository: "{{input.repository}}",
        title: "{{input.title}}",
        completedAt: "{{helpers.now()}}"
    }
}
```

**Line numbers:**
- Insert after line 1201 (closing of `merge` step config)
- Before line 1202 (closing of `steps` array)

**Rationale:**
- Transform steps use `inputMapping` to construct their output
- Template expressions like `{{steps.stepId.field}}` access previous step outputs
- Helpers like `{{helpers.now()}}` provide utility functions
- This step will become the last step, so its output becomes the workflow's `outputJson`

#### Step 2: Update the seed script database operation

**File to modify:** `/workspace/scripts/seed-sdlc-playbook.ts`

**Location:** Lines 1627-1649 (workflow creation/update logic)

**Change:**

Update the workflow definition if it already exists:

```typescript
if (!existing) {
    existing = await prisma.workflow.create({
        data: {
            slug: wfDef.slug,
            name: wfDef.name,
            description: wfDef.description,
            definitionJson: wfDef.definitionJson,
            inputSchemaJson: inputSchema,
            maxSteps: 50,
            isActive: wfDef.isActive,
            isPublished: wfDef.isPublished,
            workspaceId: workspace.id
        }
    });
    console.log("Created workflow:", existing.slug);
} else {
    // Update existing workflow definition
    existing = await prisma.workflow.update({
        where: { id: existing.id },
        data: {
            definitionJson: wfDef.definitionJson,
            description: wfDef.description
        }
    });
    console.log("Updated workflow:", existing.slug);
}
```

**Rationale:**
- The seed script is idempotent and safe to re-run
- Updating existing workflows ensures deployed instances get the fix
- Only update `definitionJson` and `description` to avoid overwriting user customizations

#### Step 3: Re-seed the database

**Command to run:**

```bash
bun run scripts/seed-sdlc-playbook.ts
```

**Expected output:**
```
Seeding SDLC Flywheel playbook...

AgentC2 org exists: <org-id>
Platform workspace exists: <workspace-id>
System user exists: <user-id>
Document exists: sdlc-coding-standards
Document exists: sdlc-architecture-overview
Document exists: sdlc-testing-procedures
Document exists: sdlc-deployment-runbook
Skill exists: code-analysis-agentc2
Skill exists: implementation-planning-agentc2
Skill exists: audit-review-agentc2
Skill exists: ticket-triage-agentc2
Skill exists: pr-review-agentc2
Agent exists: sdlc-classifier-agentc2
Agent exists: sdlc-planner-agentc2
Agent exists: sdlc-auditor-agentc2
Agent exists: sdlc-reviewer-agentc2
Updated workflow: sdlc-bugfix-agentc2  <-- Should see this
Workflow exists: sdlc-feature-agentc2
Workflow exists: sdlc-triage-agentc2
Workflow exists: sdlc-standard-agentc2
SDLC webhook trigger already exists: trigger_<hash>
SDLC Flywheel playbook exists: <playbook-id>

✔ SDLC Flywheel seed complete!
```

#### Step 4: Verify the change

**Test workflow execution:**

```bash
# Via API
curl -X POST http://localhost:3001/api/workflows/sdlc-bugfix-agentc2/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "title": "Test bug",
      "description": "Testing output summary",
      "repository": "test/repo",
      "existingIssueUrl": "https://github.com/test/repo/issues/1",
      "existingIssueNumber": 1
    }
  }'
```

**Expected result:**

The workflow run's `outputJson` should now contain the structured summary instead of just the merge result.

**Database verification:**

```sql
SELECT 
  id, 
  status, 
  jsonb_pretty(outputJson) as output
FROM "WorkflowRun" 
WHERE "workflowId" = (
  SELECT id FROM "Workflow" WHERE slug = 'sdlc-bugfix-agentc2'
)
ORDER BY "createdAt" DESC 
LIMIT 1;
```

Should show:
```json
{
  "issueUrl": "https://github.com/...",
  "issueNumber": 123,
  "analysisSummary": "...",
  "auditVerdict": "PASS",
  "prUrl": "https://github.com/.../pull/456",
  "prNumber": 456,
  "mergeResult": { ... },
  "completedAt": "2026-03-04T..."
}
```

### 3.3 Files Modified Summary

| File | Lines | Change Type | Description |
|------|-------|-------------|-------------|
| `/workspace/scripts/seed-sdlc-playbook.ts` | After 1201 | **Insert** | Add new `output-summary` transform step |
| `/workspace/scripts/seed-sdlc-playbook.ts` | 1627-1649 | **Modify** | Add workflow update logic for existing workflows |

**Total files modified:** 1
**Total lines added:** ~30
**Total lines modified:** ~10

---

## 4. Risk Assessment

### 4.1 Risk Level: **LOW**

| Risk Factor | Level | Mitigation |
|-------------|-------|------------|
| **Breaking changes** | None | Adding a step at the end doesn't break existing consumers |
| **Data loss** | None | Previous steps still available in `WorkflowRunStep` table |
| **Performance impact** | Negligible | Transform step has no I/O, just data mapping |
| **Backward compatibility** | High | Old runs remain unchanged, only new runs get new output |
| **Deployment complexity** | Low | Single seed script execution |

### 4.2 Potential Issues

#### Issue 1: Template expressions may not resolve if steps fail

**Scenario:** If `fix-audit` step is skipped or fails, `{{steps['fix-audit'].verdict}}` may be undefined.

**Mitigation:** The runtime handles undefined template expressions gracefully (returns empty string for inline interpolation, undefined for exact matches). The output will contain `null` or `undefined` for missing fields.

**Severity:** Low - Acceptable behavior for failed workflows

#### Issue 2: Existing in-flight workflows

**Scenario:** Workflows running when the definition is updated will complete with the old definition.

**Mitigation:** This is correct behavior. Workflow runs execute against the definition that existed when they started. Only new runs will use the updated definition.

**Severity:** None - Expected behavior

#### Issue 3: Accessing nested step outputs from `dowhile` loops

**Scenario:** The `fix-audit` step is inside an `audit-cycle` dowhile loop. Template access may be incorrect.

**Verification needed:** Check how `steps['fix-audit']` resolves when the step is inside a loop.

**Resolution:** Based on runtime.ts lines 682-688, the dowhile loop updates `context.steps[step.id]` with the iteration result. The last iteration's output is available via `steps['audit-cycle']`, but nested steps inside the loop are also added to the context (line 690). So both `steps['audit-cycle']['fix-audit']` and potentially `steps['fix-audit']` should work.

**Recommended approach:** Use the direct step ID `steps['fix-audit']` as it appears to work based on existing workflow templates in the seed file that reference steps inside loops.

**Severity:** Low - Needs verification in testing

---

## 5. Testing Strategy

### 5.1 Unit Tests

No new unit tests required - transform steps are already tested in `/workspace/tests/unit/workflow-runtime.test.ts`.

### 5.2 Integration Tests

**Test case 1: Successful bugfix workflow**

1. Execute `sdlc-bugfix-agentc2` workflow with valid inputs
2. Mock Cursor agent responses
3. Auto-approve human steps
4. Verify `outputJson` contains all expected fields

**Test case 2: Workflow with failed audit**

1. Execute workflow where audit fails
2. Verify `outputJson` still generates (with partial data)
3. Check undefined fields are handled gracefully

**Test case 3: Accessing nested step outputs**

1. Execute workflow with multiple audit iterations
2. Verify `steps['fix-audit'].verdict` resolves to the last iteration
3. Confirm no errors in step execution

### 5.3 Manual Testing

1. Run seed script: `bun run scripts/seed-sdlc-playbook.ts`
2. Verify workflow updated in database
3. Trigger workflow via GitHub webhook (label issue with `agentc2-sdlc`)
4. Monitor workflow execution in UI
5. Check final `outputJson` in database and API response
6. Verify all fields are populated correctly

---

## 6. Alternative Approaches Considered

### Alternative 1: Modify runtime to always aggregate all step outputs

**Approach:** Change the workflow runtime to automatically include all step outputs in a `steps` field in the final output.

**Pros:**
- Applies to all workflows automatically
- No per-workflow changes needed

**Cons:**
- Breaking change for existing workflows
- Bloats output with potentially unnecessary data
- May expose sensitive intermediate data
- Requires runtime code changes (higher risk)

**Decision:** Rejected - Too invasive, breaks existing workflows

### Alternative 2: Create a separate API endpoint for workflow summaries

**Approach:** Add `/api/workflows/{slug}/runs/{runId}/summary` that dynamically aggregates data.

**Pros:**
- Doesn't modify workflow definitions
- Can be customized per workflow type

**Cons:**
- Requires new API endpoint and logic
- Summary logic lives outside workflow definition
- Consumers must make additional API call
- Doesn't solve the root issue of `outputJson` being incomplete

**Decision:** Rejected - Doesn't address the core problem

### Alternative 3: Post-process workflows in Inngest after completion

**Approach:** Add an Inngest function that triggers on `workflow.completed` and updates the `outputJson` field.

**Pros:**
- Separates aggregation logic from workflow execution
- Can be applied retroactively to past runs

**Cons:**
- Adds complexity and latency
- Requires Inngest infrastructure
- Two sources of truth for output data
- Doesn't work for real-time API consumers

**Decision:** Rejected - Over-engineered solution

### Alternative 4: Use a dedicated `output` transform step (RECOMMENDED)

**Approach:** Add a final `transform` step to the workflow definition that explicitly maps previous step outputs into a structured format.

**Pros:**
- ✅ Explicit and self-documenting
- ✅ No runtime changes needed
- ✅ Per-workflow customization
- ✅ Transform steps already implemented
- ✅ Backward compatible
- ✅ Low risk, high clarity

**Cons:**
- Requires updating each workflow definition
- Must re-seed database

**Decision:** **SELECTED** - Best balance of simplicity, explicitness, and safety

---

## 7. Implementation Complexity

### 7.1 Effort Estimate

| Task | Effort | Complexity |
|------|--------|------------|
| Add transform step to workflow definition | 15 minutes | Trivial |
| Update seed script update logic | 10 minutes | Trivial |
| Re-seed database | 2 minutes | Trivial |
| Manual testing | 30 minutes | Low |
| Write integration test (optional) | 45 minutes | Low |
| Documentation update | 15 minutes | Trivial |
| **Total** | **~2 hours** | **Low** |

### 7.2 Dependencies

- No external dependencies
- No package upgrades required
- No database migrations needed (workflow definitions stored as JSON)
- No API contract changes

### 7.3 Rollback Plan

If the change causes issues:

1. Revert the seed script changes: `git revert <commit>`
2. Re-run seed script: `bun run scripts/seed-sdlc-playbook.ts`
3. Existing completed runs are unaffected
4. In-flight runs will complete with old definition

**Rollback time:** < 5 minutes

---

## 8. Follow-up Actions

### 8.1 Immediate (part of this fix)

- [ ] Add `output-summary` transform step to `bugfixWorkflowDef`
- [ ] Add workflow update logic to seed script
- [ ] Run seed script to update workflow
- [ ] Test workflow execution manually
- [ ] Verify output structure

### 8.2 Short-term (within 1 week)

- [ ] Apply same pattern to `sdlc-feature-agentc2` workflow
- [ ] Apply same pattern to `sdlc-standard-agentc2` workflow
- [ ] Update workflow documentation with example outputs
- [ ] Add UI components to display structured output

### 8.3 Long-term (future consideration)

- [ ] Create workflow linting rule: "Workflows should end with output-summary transform step"
- [ ] Add workflow templates with output summary included by default
- [ ] Consider adding `outputMapping` to workflow schema for declarative output shaping
- [ ] Build workflow output JSON schema validation

---

## 9. References

### 9.1 Code References

- **Workflow runtime:** `/workspace/packages/agentc2/src/workflows/builder/runtime.ts:802-807`
- **Workflow execution:** `/workspace/apps/agent/src/app/api/workflows/[slug]/execute/route.ts:177`
- **Bugfix workflow definition:** `/workspace/scripts/seed-sdlc-playbook.ts:1015-1203`
- **Transform step tests:** `/workspace/tests/unit/workflow-runtime.test.ts:32-42`
- **Workflow types:** `/workspace/packages/agentc2/src/workflows/builder/types.ts:1-11`

### 9.2 Related Issues

- GitHub Issue [#72](https://github.com/Appello-Prototypes/agentc2/issues/72) - Add structured output summary to bugfix workflow
- Workflow run: `cmmcie61b00018ei9ma1l587i` (original report)

### 9.3 Documentation

- SDLC Playbook seed script: `/workspace/scripts/seed-sdlc-playbook.ts`
- Workflow builder types: `/workspace/packages/agentc2/src/workflows/builder/types.ts`
- Platform docs tool references: `/workspace/packages/agentc2/src/tools/platform-docs-tool.ts:242-250`

---

## 10. Conclusion

This bug is straightforward to fix with minimal risk. The root cause is architectural - workflows output the last step's result by design. The solution is to explicitly add a final transform step that aggregates the desired data into a structured output.

**Key takeaways:**

1. ✅ **Root cause identified:** Workflow runtime returns last step output; current last step is `merge` which has minimal metadata
2. ✅ **Solution is simple:** Add a `transform` step at the end with explicit field mapping
3. ✅ **Risk is low:** Transform steps are already implemented and tested; adding a step doesn't break anything
4. ✅ **Implementation is fast:** ~2 hours total including testing
5. ✅ **Benefits are high:** Dramatically improves workflow output usability for all consumers

**Recommendation:** Proceed with implementation immediately. This is a high-value, low-risk change.

---

**Analysis completed:** 2026-03-04
**Reviewed by:** Pending
**Approved by:** Pending

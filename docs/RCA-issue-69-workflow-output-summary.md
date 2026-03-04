# Root Cause Analysis: Issue #69
## E2E SDLC Test: Add structured output summary to bugfix workflow

**Issue URL**: https://github.com/Appello-Prototypes/agentc2/issues/69  
**Status**: Open  
**Labels**: Bug  
**Date**: 2026-03-04  
**Analyzer**: Cloud Agent (AgentC2)

---

## Executive Summary

The SDLC Bugfix workflow (`sdlc-bugfix-agentc2`) currently returns only the raw output from its last step (the merge operation) in `WorkflowRun.outputJson`. This provides minimal value to consumers who need a structured summary of the entire pipeline execution, including analysis results, audit verdicts, PR details, and implementation metadata.

**Root Cause**: The workflow runtime unconditionally returns the last step's output as the workflow result, with no mechanism for output aggregation or mapping.

**Impact**: Medium - Affects all SDLC workflows and any consumer that needs structured pipeline summaries (UI dashboards, notifications, analytics, downstream workflows).

**Complexity**: Low - Requires implementing the existing `transform` step type with output mapping capabilities.

---

## 1. Bug Description

### Current Behavior

When the SDLC Bugfix workflow completes successfully, `WorkflowRun.outputJson` contains only the merge step's output:

```json
{
    "success": true,
    "sha": "abc123def456...",
    "message": "Pull request merged successfully"
}
```

### Expected Behavior

The workflow should return a structured summary aggregating key data from all pipeline stages:

```json
{
    "status": "completed",
    "issueNumber": 69,
    "issueUrl": "https://github.com/Appello-Prototypes/agentc2/issues/69",
    "analysis": {
        "agentId": "agent_...",
        "durationMs": 45000,
        "summary": "Root cause identified in runtime.ts line 802..."
    },
    "audit": {
        "verdict": "PASS",
        "severity": "none",
        "issues": [],
        "positives": ["Clear fix plan", "Edge cases addressed"]
    },
    "implementation": {
        "agentId": "agent_...",
        "branchName": "fix/issue-69",
        "durationMs": 120000,
        "summary": "Implemented transform step with output mapping..."
    },
    "pr": {
        "number": 123,
        "url": "https://github.com/Appello-Prototypes/agentc2/pull/123",
        "htmlUrl": "https://github.com/Appello-Prototypes/agentc2/pull/123"
    },
    "merge": {
        "success": true,
        "sha": "abc123def456...",
        "message": "Pull request merged successfully"
    },
    "metrics": {
        "totalDurationMs": 180000,
        "auditCycles": 1,
        "approved": true
    }
}
```

---

## 2. Root Cause Analysis

### Primary Root Cause

**File**: `packages/agentc2/src/workflows/builder/runtime.ts`  
**Function**: `executeSteps()`  
**Lines**: 802-807

```typescript
// Current implementation
const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
return {
    status: "success",
    output,
    steps: executionSteps
};
```

The workflow runtime unconditionally returns the last step's output as the workflow result. There is no logic to:
1. Aggregate outputs from multiple steps
2. Apply an output mapping transformation
3. Return a structured summary

### Secondary Root Cause

**File**: `scripts/seed-sdlc-playbook.ts`  
**Variable**: `bugfixWorkflowDef`  
**Lines**: 1015-1204

The bugfix workflow definition does not include an output mapping or summary step. The workflow ends with the `merge` step, whose output becomes the workflow's output.

### Tertiary Root Cause

**File**: `packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines**: 735-738

```typescript
case "transform":
default:
    output = stepInput;
```

The `transform` step type exists but is not implemented. It currently acts as a pass-through, simply returning its input unchanged. The comment in `apps/agent/src/components/builder/inspectors/TransformInspector.tsx` confirms this:

```typescript
Transform step is currently pass-through. Data flows through unchanged. Future
versions will support expression-based field mapping.
```

---

## 3. Impact Assessment

### Affected Components

#### 3.1 Workflow Runtime System
- **File**: `packages/agentc2/src/workflows/builder/runtime.ts`
- **Impact**: Core workflow execution logic needs to support output mapping
- **Severity**: High (affects all workflows)

#### 3.2 SDLC Workflows
- **Files**: 
  - `scripts/seed-sdlc-playbook.ts` (workflow definitions)
  - All three SDLC workflows: `sdlc-bugfix`, `sdlc-feature`, `sdlc-triage`
- **Impact**: Need to add output summary steps to workflow definitions
- **Severity**: High (primary user complaint)

#### 3.3 Workflow Execution APIs
- **Files**:
  - `apps/agent/src/app/api/workflows/[slug]/execute/route.ts` (line 177)
  - `apps/agent/src/app/api/workflows/[slug]/execute/stream/route.ts` (line 170)
  - `apps/agent/src/app/api/workflows/[slug]/execute/public/route.ts` (line 152)
  - `apps/agent/src/lib/inngest-functions.ts` (line 8860)
- **Impact**: These routes set `outputJson: result.output`, which will now contain structured summaries
- **Severity**: Low (no breaking changes, only enhanced data)

#### 3.4 Database Schema
- **File**: `packages/database/prisma/schema.prisma`
- **Model**: `WorkflowRun.outputJson` (line 2656)
- **Impact**: None - field is already `Json?`, supports any structure
- **Severity**: None

#### 3.5 UI Components
- **Files**:
  - `apps/agent/src/components/RunDetailPanel.tsx` (lines 1392-1468)
  - `apps/agent/src/app/workflows/[workflowSlug]/runs/[runId]/page.tsx`
  - `apps/agent/src/app/workflows/[workflowSlug]/runs/page.tsx`
- **Impact**: UI already handles arbitrary JSON in outputJson; richer data will display automatically
- **Severity**: None (improvement)

#### 3.6 Workflow Types
- **File**: `packages/agentc2/src/workflows/builder/types.ts`
- **Impact**: May need to extend `WorkflowDefinition` or `WorkflowStep` to support output mapping config
- **Severity**: Low (config structure addition)

### Downstream Consumers

#### 3.7 MCP Gateway
- **File**: `apps/agent/src/app/api/mcp/route.ts` (line 1051, 1381)
- **Impact**: Exposes workflow execution results via MCP; richer output benefits external clients (Cursor, Claude)
- **Severity**: None (improvement)

#### 3.8 Analytics & Metrics
- **File**: `apps/agent/src/lib/metrics.ts` (referenced in execute routes)
- **Impact**: No changes needed; metrics calculate from WorkflowRunStep records, not outputJson
- **Severity**: None

#### 3.9 Playbook Marketplace
- **Files**: 
  - `packages/agentc2/src/playbooks/packager.ts`
  - `packages/agentc2/src/playbooks/deployer.ts`
- **Impact**: Packaged workflows will include outputMapping config; deployments will preserve it
- **Severity**: Low (schema addition)

---

## 4. Technical Deep Dive

### 4.1 Current Execution Flow

1. **Workflow Execution Entry Point**:
   - HTTP: `POST /api/workflows/{slug}/execute` → `apps/agent/src/app/api/workflows/[slug]/execute/route.ts`
   - Async: Inngest `workflow/execute.async` → `apps/agent/src/lib/inngest-functions.ts:8456`

2. **Runtime Execution**:
   - Both routes call `executeWorkflowDefinition()` from `packages/agentc2/src/workflows/builder/runtime.ts`
   - The runtime executes steps sequentially via `executeSteps()`
   - Each step's output is stored in `context.steps[step.id]`

3. **Output Resolution**:
   ```typescript
   // Line 802 in runtime.ts
   const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
   return {
       status: "success",
       output,  // ← This becomes WorkflowRun.outputJson
       steps: executionSteps
   };
   ```

4. **Database Persistence**:
   ```typescript
   // Line 177 in execute/route.ts
   await prisma.workflowRun.update({
       where: { id: run.id },
       data: {
           status: finalStatus,
           outputJson: result.output as Prisma.InputJsonValue,  // ← Last step's output
           completedAt: new Date(),
           durationMs,
           totalTokens,
           totalCostUsd
       }
   });
   ```

### 4.2 SDLC Bugfix Workflow Structure

**File**: `scripts/seed-sdlc-playbook.ts`, lines 1015-1204

The workflow has 11 top-level steps:

| Step ID | Type | Tool/Agent | Output Structure |
|---------|------|------------|------------------|
| `intake` | tool | `ticket-to-github-issue` | `{ issueNumber, issueUrl, repository, linked }` |
| `analyze-launch` | tool | `cursor-launch-agent` | `{ agentId, name, status, branchName, agentUrl }` |
| `analyze-wait` | tool | `cursor-poll-until-done` | `{ agentId, status, summary, branchName, prNumber, repository, durationMs, timedOut }` |
| `analyze-result` | tool | `cursor-get-conversation` | `{ agentId, messages: [...] }` |
| `post-analysis` | tool | `github-add-issue-comment` | `{ success, commentId, commentUrl }` |
| `audit-cycle` | dowhile | (nested steps) | `{ verdict, severity, issues, positives, summary, approved, feedback, _totalIterations }` |
| `implement-launch` | tool | `cursor-launch-agent` | `{ agentId, name, status, branchName, agentUrl }` |
| `implement-wait` | tool | `cursor-poll-until-done` | `{ agentId, status, summary, branchName, prNumber, repository, durationMs, timedOut }` |
| `create-pr` | tool | `github-create-pull-request` | `{ prNumber, prUrl, htmlUrl }` |
| `merge-review` | human | (suspended) | `{ approved, feedback }` |
| `merge` | tool | `merge-pull-request` | `{ success, sha, message }` |

**Problem**: Only the `merge` step's output is returned. All other step outputs are lost.

### 4.3 What Data is Available

During workflow execution, ALL step outputs are available in `context.steps`:

```typescript
// Inside executeSteps() at line 758
context.steps[step.id] = output;
```

This means at the end of execution, `context.steps` contains:
- `context.steps['intake']` - GitHub issue details
- `context.steps['analyze-wait']` - Analysis summary and metadata
- `context.steps['audit-cycle']` - Audit results
- `context.steps['implement-wait']` - Implementation summary
- `context.steps['create-pr']` - PR details
- `context.steps['merge']` - Merge result

All of this data is available but not aggregated.

### 4.4 Transform Step Type

The `transform` step type is defined in `WorkflowStepType` (line 1 in `types.ts`) and handled in the runtime (line 735), but the implementation is a no-op:

```typescript
case "transform":
default:
    output = stepInput;
```

The UI even shows a warning in `TransformInspector.tsx`:
> "Transform step is currently pass-through. Data flows through unchanged. Future versions will support expression-based field mapping."

---

## 5. Fix Plan

### 5.1 Implement Transform Step with Output Mapping

**File**: `packages/agentc2/src/workflows/builder/runtime.ts`  
**Function**: `executeSteps()`  
**Lines**: 735-738

**Changes Required**:

1. Add support for `outputMapping` configuration in transform steps
2. Implement expression-based field extraction from `context.steps`
3. Support both simple path-based mapping and computed expressions

**Proposed Implementation**:

```typescript
case "transform": {
    const transformConfig = step.config as {
        outputMapping?: Record<string, string>;
        computedFields?: Record<string, string>;
    };
    
    // If no outputMapping is defined, pass through input
    if (!transformConfig?.outputMapping) {
        output = stepInput;
        break;
    }
    
    // Build output object by mapping fields from context
    const mappedOutput: Record<string, unknown> = {};
    
    for (const [outputKey, sourcePath] of Object.entries(transformConfig.outputMapping)) {
        // Resolve template expression to extract value from context
        const value = resolveTemplate(`{{${sourcePath}}}`, context);
        mappedOutput[outputKey] = value;
    }
    
    // Apply computed fields if defined
    if (transformConfig.computedFields) {
        for (const [outputKey, expression] of Object.entries(transformConfig.computedFields)) {
            const value = evaluateExpression(expression, context);
            mappedOutput[outputKey] = value;
        }
    }
    
    output = mappedOutput;
    break;
}
```

**Risk**: Low  
**Complexity**: Low (2-3 hours)  
**Breaking Changes**: None (transform steps currently pass through, so adding mapping is additive)

---

### 5.2 Add Output Summary Step to Bugfix Workflow

**File**: `scripts/seed-sdlc-playbook.ts`  
**Variable**: `bugfixWorkflowDef`  
**Line**: 1203 (after `merge` step)

**Changes Required**:

Add a final `transform` step to aggregate pipeline data:

```typescript
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate Pipeline Summary",
    config: {
        outputMapping: {
            // Status
            "status": "steps.merge.success ? 'completed' : 'failed'",
            
            // Issue details
            "issue.number": "steps.intake.issueNumber",
            "issue.url": "steps.intake.issueUrl",
            "issue.repository": "steps.intake.repository",
            
            // Analysis phase
            "analysis.agentId": "steps['analyze-launch'].agentId",
            "analysis.summary": "steps['analyze-wait'].summary",
            "analysis.durationMs": "steps['analyze-wait'].durationMs",
            
            // Audit phase (last iteration of cycle)
            "audit.verdict": "steps['audit-cycle'].verdict",
            "audit.severity": "steps['audit-cycle'].severity",
            "audit.issuesFound": "steps['audit-cycle'].issues?.length || 0",
            "audit.approved": "steps['audit-cycle'].approved",
            
            // Implementation phase
            "implementation.agentId": "steps['implement-launch'].agentId",
            "implementation.branchName": "steps['implement-wait'].branchName",
            "implementation.summary": "steps['implement-wait'].summary",
            "implementation.durationMs": "steps['implement-wait'].durationMs",
            
            // PR phase
            "pr.number": "steps['create-pr'].prNumber",
            "pr.url": "steps['create-pr'].htmlUrl",
            
            // Merge phase
            "merge.success": "steps.merge.success",
            "merge.sha": "steps.merge.sha",
            "merge.message": "steps.merge.message"
        },
        computedFields: {
            // Computed aggregations
            "metrics.totalDurationMs": "steps['analyze-wait'].durationMs + steps['implement-wait'].durationMs",
            "metrics.auditCycles": "steps['audit-cycle']._totalIterations || 1",
            "metrics.stepsCompleted": "Object.keys(steps).length"
        }
    }
}
```

**Risk**: Low  
**Complexity**: Low (1-2 hours)  
**Breaking Changes**: None (workflow adds a final step)

---

### 5.3 Update Transform Step UI Inspector

**File**: `apps/agent/src/components/builder/inspectors/TransformInspector.tsx`  
**Lines**: 1-35

**Changes Required**:

Replace the placeholder UI with a proper form for configuring output mapping:

1. Remove the warning message about pass-through behavior
2. Add fields for:
   - Output mapping (key-value pairs with source path)
   - Computed fields (key-expression pairs)
3. Add autocomplete for `steps.*` paths
4. Add validation for expression syntax

**Risk**: Low  
**Complexity**: Low (2-3 hours)  
**Breaking Changes**: None (UI enhancement)

---

### 5.4 Extend Workflow Types (Optional)

**File**: `packages/agentc2/src/workflows/builder/types.ts`  
**Lines**: 1-138

**Changes Required** (optional for type safety):

Add a `WorkflowTransformConfig` interface:

```typescript
export interface WorkflowTransformConfig {
    outputMapping?: Record<string, string>;
    computedFields?: Record<string, string>;
}
```

Then update `WorkflowStep.config` typing to be a union of all config types.

**Risk**: None  
**Complexity**: Trivial (30 minutes)  
**Breaking Changes**: None (type enhancement)

---

### 5.5 Apply Same Pattern to Other SDLC Workflows

**Files**: 
- `scripts/seed-sdlc-playbook.ts` - `featureWorkflowDef` (lines 1206-1425)
- `scripts/seed-sdlc-playbook.ts` - `triageWorkflowDef` (lines 1427-1551)
- `scripts/seed-sdlc-playbook.ts` - `standardWorkflowDef` (lines 773-1013, deprecated)

**Changes Required**:

Add similar output summary steps to:
1. **Feature workflow**: Aggregate design, plan, implementation, PR, and merge data
2. **Triage workflow**: Aggregate classification and routing results (or sub-workflow results)

**Risk**: Low  
**Complexity**: Low (1 hour per workflow)  
**Breaking Changes**: None

---

### 5.6 Update Workflow Seed Script

**File**: `scripts/seed-sdlc-playbook.ts`

**Changes Required**:

After implementing the changes, re-run the seed script to update the workflows in the database:

```bash
bun run scripts/seed-sdlc-playbook.ts
```

This will update the workflow definitions with the new output summary steps.

**Risk**: Low (idempotent script)  
**Complexity**: Trivial (script execution)  
**Breaking Changes**: None (existing runs unaffected)

---

### 5.7 Add Tests for Transform Step

**File**: `tests/unit/workflow-runtime.test.ts`

**Changes Required**:

Add test cases for the transform step:

1. **Simple field mapping**: Extract values from context.steps
2. **Nested path mapping**: Extract nested fields like `steps['analyze-wait'].summary`
3. **Computed fields**: Use expressions to aggregate values
4. **Missing fields**: Handle undefined/null gracefully
5. **Complex expressions**: Test with conditionals, operators

**Risk**: None  
**Complexity**: Low (2 hours)  
**Breaking Changes**: None

---

### 5.8 Documentation Updates

**Files**:
- `docs/mcp-workflows-networks.md` - Document transform step capabilities
- Add example showing output mapping configuration

**Risk**: None  
**Complexity**: Low (30 minutes)  
**Breaking Changes**: None

---

## 6. Detailed Implementation Steps

### Phase 1: Core Transform Implementation (Priority: P0)

1. **Implement transform step logic** in `runtime.ts`:
   - [ ] Add `WorkflowTransformConfig` interface to `types.ts`
   - [ ] Implement output mapping logic in `executeSteps()` case `"transform"`
   - [ ] Support simple path-based extraction: `"key": "steps.stepId.field"`
   - [ ] Support nested paths: `"key": "steps['step-id'].nested.field"`
   - [ ] Support expression evaluation: `"key": "steps.merge.success ? 'completed' : 'failed'"`
   - [ ] Handle undefined/null values gracefully (return null or empty string)
   - [ ] Test expressions with context.steps, context.input, context.variables

2. **Add unit tests** in `tests/unit/workflow-runtime.test.ts`:
   - [ ] Test simple field mapping
   - [ ] Test nested path extraction
   - [ ] Test computed expressions
   - [ ] Test missing/null field handling
   - [ ] Test complex workflow with transform step

3. **Verify no regressions**:
   - [ ] Run `bun run type-check`
   - [ ] Run `bun run lint`
   - [ ] Run `bun test tests/unit/workflow-runtime.test.ts`

**Estimated Time**: 3-4 hours  
**Risk**: Low  
**Dependencies**: None

---

### Phase 2: Bugfix Workflow Enhancement (Priority: P0)

1. **Add output summary step** to `bugfixWorkflowDef` in `scripts/seed-sdlc-playbook.ts`:
   - [ ] Insert new step after `merge` step (line 1203)
   - [ ] Configure outputMapping to extract:
     - Issue details (number, URL, repository)
     - Analysis summary and metadata
     - Audit verdict and issues count
     - Implementation summary and branch
     - PR details (number, URL)
     - Merge result (success, sha, message)
   - [ ] Add computed fields for metrics:
     - Total duration (analysis + implementation)
     - Audit cycles count
     - Steps completed count

2. **Re-seed the workflow**:
   - [ ] Run `bun run scripts/seed-sdlc-playbook.ts`
   - [ ] Verify workflow updated in database
   - [ ] Check workflow version incremented

3. **Test end-to-end**:
   - [ ] Create a test GitHub issue
   - [ ] Trigger the bugfix workflow (webhook or manual)
   - [ ] Monitor execution via Inngest dashboard
   - [ ] Verify outputJson contains structured summary
   - [ ] Check UI displays summary correctly

**Estimated Time**: 2-3 hours  
**Risk**: Low (idempotent seed script)  
**Dependencies**: Phase 1 complete

---

### Phase 3: UI Enhancement (Priority: P1)

1. **Update TransformInspector** in `apps/agent/src/components/builder/inspectors/TransformInspector.tsx`:
   - [ ] Remove pass-through warning message
   - [ ] Add form for output mapping configuration
   - [ ] Add ability to add/remove mapping pairs
   - [ ] Add autocomplete for `steps.*` paths (optional)
   - [ ] Add expression syntax validation (optional)
   - [ ] Show preview of available step outputs

2. **Test in workflow designer**:
   - [ ] Open workflow designer UI
   - [ ] Add a transform step
   - [ ] Configure output mapping
   - [ ] Save and execute workflow
   - [ ] Verify output matches mapping

**Estimated Time**: 3-4 hours  
**Risk**: Low (UI enhancement only)  
**Dependencies**: Phase 1 complete

---

### Phase 4: Additional Workflows (Priority: P2)

1. **Add output summary to feature workflow**:
   - [ ] Add transform step to `featureWorkflowDef`
   - [ ] Map design, plan, implementation, PR, merge outputs
   - [ ] Re-seed workflow

2. **Add output summary to triage workflow**:
   - [ ] Add transform step to `triageWorkflowDef`
   - [ ] Map classification, routing decision, sub-workflow result
   - [ ] Re-seed workflow

3. **Test all SDLC workflows**:
   - [ ] Trigger each workflow with test data
   - [ ] Verify structured outputs

**Estimated Time**: 2-3 hours  
**Risk**: Low  
**Dependencies**: Phase 1 complete

---

### Phase 5: Documentation (Priority: P2)

1. **Update documentation**:
   - [ ] Add transform step examples to `docs/mcp-workflows-networks.md`
   - [ ] Document output mapping syntax
   - [ ] Show example of aggregating multi-step results
   - [ ] Add to SDLC workflow documentation

2. **Update CLAUDE.md** (if needed):
   - [ ] Mention transform steps in workflow section
   - [ ] Add example use case

**Estimated Time**: 1 hour  
**Risk**: None  
**Dependencies**: Phases 1-2 complete

---

## 7. Alternative Approaches Considered

### Alternative 1: Custom Output Step Type

**Description**: Create a new step type `output` specifically for workflow output aggregation.

**Pros**:
- More explicit intent
- Could have specialized UI/validation

**Cons**:
- Adds complexity (new step type)
- Transform step already exists and is perfect for this use case
- Would require more extensive changes to runtime and types

**Verdict**: ❌ Rejected - Transform step is more general-purpose and already exists

---

### Alternative 2: Workflow-Level Output Schema with Auto-Mapping

**Description**: Add `outputSchema` to `WorkflowDefinition` and automatically map the last step's output to match the schema.

**Pros**:
- No explicit transform step needed
- Declarative schema-first approach

**Cons**:
- Requires complex auto-mapping logic
- Less flexible than explicit mapping
- Harder to debug when mapping fails
- Doesn't support computed fields or multi-step aggregation

**Verdict**: ❌ Rejected - Too magical, less explicit

---

### Alternative 3: Post-Processing Hook in Runtime

**Description**: Add an `onBeforeReturn` hook to `executeWorkflowDefinition()` that transforms the output before returning.

**Pros**:
- Workflow definitions stay unchanged
- Centralized output transformation

**Cons**:
- Hidden logic, not visible in workflow definition
- Harder to customize per workflow
- No UI representation
- Doesn't leverage existing transform step type

**Verdict**: ❌ Rejected - Not explicit, circumvents workflow engine

---

### Alternative 4: Add outputMapping to WorkflowDefinition Root

**Description**: Add `outputMapping: Record<string, string>` to the `WorkflowDefinition` interface itself, applied automatically at the end.

**Pros**:
- Cleaner workflow definitions (no extra step)
- Built into the workflow engine

**Cons**:
- Less composable (can't conditionally apply mapping)
- Can't chain with other steps
- Special-case logic in runtime
- Doesn't fit the step-based execution model

**Verdict**: ⚠️ Possible future enhancement, but explicit transform step is better for now

---

## 8. Risk Assessment

### Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Transform step breaks existing pass-through behavior | Low | Medium | Add check: if no outputMapping, return stepInput (preserve existing behavior) |
| Expression evaluation crashes runtime | Low | High | Wrap evaluateExpression() in try/catch, return original output on error |
| Invalid paths cause workflow failures | Medium | Medium | Validate paths during execution, return null for missing paths instead of throwing |
| Template resolution breaks with complex nested objects | Low | Medium | Use existing resolveTemplate() which is battle-tested |
| SDLC workflows fail after re-seeding | Low | High | Test workflows after seeding before deploying |
| UI inspector causes designer crashes | Low | Medium | Add error boundaries, validate config before saving |

### Deployment Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Active workflow runs affected by runtime changes | None | N/A | Workflow runtime is deterministic; changes only affect new runs |
| Database schema changes required | None | N/A | No schema changes needed; outputJson is already Json? |
| Breaking changes to workflow API | None | N/A | Changes are additive only; existing workflows continue working |
| Playbook marketplace deployments broken | Low | Low | Validate packager/deployer still work with transform steps |

### Overall Risk Level

**LOW** - All changes are additive. Existing workflows continue working unchanged. Transform step enhancement is opt-in.

---

## 9. Testing Strategy

### Unit Tests

**File**: `tests/unit/workflow-runtime.test.ts`

1. **Transform step with simple mapping**:
   ```typescript
   it("executes a transform step with output mapping", async () => {
       const definition = {
           steps: [
               { id: "step1", type: "tool", config: { toolId: "calculator" }, inputMapping: { a: 10, b: 20 } },
               { id: "summary", type: "transform", config: { 
                   outputMapping: { 
                       result: "steps.step1.result",
                       formatted: "steps.step1.formatted" 
                   } 
               }}
           ]
       };
       const result = await executeWorkflowDefinition({ definition, input: {} });
       expect(result.output).toEqual({ result: 30, formatted: "30" });
   });
   ```

2. **Transform step with computed fields**:
   ```typescript
   it("executes transform step with computed expressions", async () => {
       // Test expression evaluation with operators, conditionals, etc.
   });
   ```

3. **Transform step with missing paths**:
   ```typescript
   it("handles missing paths gracefully", async () => {
       // Verify null/undefined handling
   });
   ```

### Integration Tests

**File**: `tests/integration/workflow-execution.test.ts` (create if needed)

1. **Full bugfix workflow with mocked tools**:
   - Mock all external tools (cursor-*, github-*)
   - Execute workflow end-to-end
   - Verify output summary structure

### E2E Tests

**Approach**: Manual validation (use actual SDLC workflow)

1. Create test GitHub issue in Appello-Prototypes/agentc2
2. Label with `agentc2-sdlc` to trigger workflow
3. Monitor execution via Inngest dashboard
4. Approve human gates when suspended
5. Verify final outputJson in WorkflowRun record
6. Check UI displays summary correctly

---

## 10. Success Criteria

### Must Have (P0)

- [ ] Transform step supports outputMapping configuration
- [ ] Transform step extracts values from context.steps using template expressions
- [ ] Bugfix workflow has output summary step
- [ ] Bugfix workflow outputJson contains all key pipeline data:
  - Issue details (number, URL)
  - Analysis summary
  - Audit verdict
  - Implementation summary
  - PR details
  - Merge result
  - Metrics (duration, cycles, steps)
- [ ] No regressions in existing workflows
- [ ] All type checks pass
- [ ] All linting passes
- [ ] Unit tests pass

### Should Have (P1)

- [ ] Transform step supports computed fields with expressions
- [ ] Transform step handles errors gracefully (no workflow crashes)
- [ ] Transform inspector UI allows configuring output mapping
- [ ] Documentation updated with transform step examples
- [ ] Feature workflow has output summary step
- [ ] Triage workflow has output summary step

### Nice to Have (P2)

- [ ] Transform inspector has autocomplete for step paths
- [ ] Transform inspector validates expressions
- [ ] E2E test validates full bugfix workflow with real GitHub issue
- [ ] Workflow designer shows preview of available step outputs
- [ ] Standard workflow (deprecated) updated for consistency

---

## 11. Rollout Plan

### Development

1. Implement transform step logic (runtime.ts)
2. Add unit tests
3. Run local test: `bun run scripts/test-workflow-local.ts`
4. Verify no type/lint errors

### Staging

1. Add output summary to bugfix workflow definition
2. Re-seed workflows: `bun run scripts/seed-sdlc-playbook.ts`
3. Test workflow execution with mock data
4. Verify outputJson structure matches expected format

### Production

1. Merge changes to main
2. Deploy to production (auto-deploy via GitHub Actions)
3. Monitor first few workflow runs
4. Validate output summaries in production UI
5. Roll out to feature and triage workflows

### Rollback Plan

If issues arise:
1. Revert commit with transform step implementation
2. Re-seed workflows from previous definition
3. Restart production servers
4. Monitor for stabilization

**Rollback Time**: < 10 minutes  
**Data Loss Risk**: None (new runs only affected)

---

## 12. Open Questions

### Q1: Should transform steps support async operations?

**Context**: Current transform step would be synchronous field mapping only.

**Options**:
- **A**: Keep transform synchronous (mapping only)
- **B**: Allow async compute via tool calls

**Recommendation**: Option A. Use tool steps for async operations; transform is for data reshaping.

---

### Q2: Should we support JSONPath or just dot notation?

**Context**: Output mapping paths use template expressions like `steps['analyze-wait'].summary`.

**Options**:
- **A**: Current approach (dot notation + bracket syntax via evaluateExpression)
- **B**: Add JSONPath library for complex queries

**Recommendation**: Option A. Current system already handles nested paths and bracket notation. JSONPath adds complexity.

---

### Q3: Should computed fields support helpers like json(), today(), etc.?

**Context**: The runtime already provides helper functions for templates.

**Options**:
- **A**: Yes - computed fields can use helpers.json(), helpers.today(), etc.
- **B**: No - only basic expressions

**Recommendation**: Option A. Computed fields already evaluate in the same context as templates, so helpers are available by default.

---

### Q4: Should we backfill existing workflow runs with summaries?

**Context**: Existing completed WorkflowRun records have minimal outputJson.

**Options**:
- **A**: Leave existing runs as-is
- **B**: Write migration script to reconstruct summaries from WorkflowRunStep records

**Recommendation**: Option A. Only new runs benefit. Backfilling is low value and high risk.

---

### Q5: Should transform steps appear in the workflow designer UI?

**Context**: Transform steps are valid workflow steps but currently shown as generic nodes.

**Options**:
- **A**: Show as regular workflow step nodes (current behavior)
- **B**: Add special styling/icon for transform steps

**Recommendation**: Option B (P2). Distinguish transform steps visually to clarify they're data-only operations.

---

## 13. Dependencies & Prerequisites

### Code Dependencies

- ✅ `packages/agentc2/src/workflows/builder/runtime.ts` - Workflow runtime engine
- ✅ `packages/agentc2/src/workflows/builder/types.ts` - Workflow type definitions
- ✅ Template resolution system (`resolveTemplate()`, `evaluateExpression()`)
- ✅ Workflow context system (`WorkflowExecutionContext`)

### External Dependencies

- ✅ None - All changes are internal to the workflow engine

### Configuration

- ✅ No environment variables needed
- ✅ No database migrations needed
- ✅ No external service changes needed

---

## 14. Monitoring & Observability

### Metrics to Track

After deployment, monitor:

1. **Transform step execution rate**: How many workflows use transform steps?
2. **Transform step failure rate**: Do expression evaluations fail frequently?
3. **Output summary size**: Are summaries too large (>10KB)?
4. **Workflow execution time**: Does transform step add noticeable latency? (should be <10ms)

### Logging

Add log statements in transform step implementation:

```typescript
case "transform": {
    const transformConfig = step.config as WorkflowTransformConfig;
    if (!transformConfig?.outputMapping) {
        console.log(`[Transform] Step ${step.id}: pass-through (no mapping)`);
        output = stepInput;
        break;
    }
    
    console.log(`[Transform] Step ${step.id}: mapping ${Object.keys(transformConfig.outputMapping).length} fields`);
    // ... mapping logic ...
    console.log(`[Transform] Step ${step.id}: output size ${JSON.stringify(output).length} bytes`);
}
```

### Alerts

No new alerts needed. Existing workflow failure alerts will catch transform step errors.

---

## 15. Related Issues & Technical Debt

### Related GitHub Issues

- None found directly related
- Potentially affects: Any workflow that needs structured output summaries

### Technical Debt to Address

1. **Transform step implementation**: Currently a stub (line 735-738 in runtime.ts)
   - **Priority**: P0 (this fix addresses it)

2. **Transform inspector UI**: Currently shows "future versions will support..." message
   - **Priority**: P1 (included in this fix)

3. **Output schema validation**: Workflows have `outputSchemaJson` in DB but it's not validated against actual output
   - **Priority**: P2 (separate issue)
   - **Impact**: Output summaries make schema validation more useful

4. **Workflow-level output mapping**: Could add root-level outputMapping to WorkflowDefinition
   - **Priority**: P3 (nice-to-have enhancement)
   - **Note**: Transform step is more flexible

---

## 16. Security Considerations

### Expression Evaluation Security

The transform step will use `evaluateExpression()` which creates functions dynamically via `new Function()`.

**Potential Risks**:
1. Injection attacks via malicious workflow definitions
2. Access to sensitive context data

**Mitigations**:
1. ✅ Workflows are only created by authenticated org admins
2. ✅ Expression evaluator only has access to workflow context (input, steps, variables, env, helpers)
3. ✅ No access to process, require, or Node.js globals
4. ✅ Environment variables are curated via `getEnvContext()` (only safe keys exposed)

**Additional Hardening** (Optional, P3):
- Add expression allowlist/blocklist
- Limit expression complexity (max length, depth)
- Sandbox evaluation in a separate V8 isolate

**Verdict**: Current security posture is acceptable. Expression evaluation is already used for conditions and templates throughout the workflow system.

---

## 17. Performance Considerations

### Transform Step Performance

**Operation**: Field mapping + expression evaluation  
**Expected Time**: <10ms per transform step  
**Bottleneck**: JSONPath evaluation (if implemented) or complex expressions

**Optimization Strategies**:
1. Use simple path resolution for common cases (faster than Function eval)
2. Cache compiled expression functions (optional, P3)
3. Limit output mapping to ~50 fields per step
4. Warn if computed expression takes >100ms

### Workflow Output Size

**Current**: Last step output only (~100-500 bytes)  
**After Fix**: Aggregated summary (~2-5 KB)

**Concerns**:
- Database storage (Json field in PostgreSQL)
- API response size
- UI rendering performance

**Mitigations**:
- PostgreSQL handles JSON fields efficiently up to ~1MB
- Current step outputs are already persisted in WorkflowRunStep (separate records)
- UI already renders arbitrary JSON in code blocks
- No performance concerns expected

---

## 18. Backward Compatibility

### Existing Workflows

**Impact**: None

- Workflows without transform steps: No change
- Workflows with placeholder transform steps: Continue as pass-through
- Transform steps with outputMapping: New behavior (opt-in)

### Existing Workflow Runs

**Impact**: None

- Completed runs: outputJson unchanged (historical data preserved)
- In-progress runs: Use existing runtime code (workflow definitions are immutable per run)

### API Contracts

**Impact**: None (additive only)

- `POST /api/workflows/{slug}/execute` - Response unchanged, but `output` field is richer
- MCP tools - No breaking changes
- Webhook triggers - No breaking changes

### Database Schema

**Impact**: None

- `WorkflowRun.outputJson` is already `Json?` (nullable JSON field)
- No migration needed

---

## 19. Code References

### Files to Modify

1. **`packages/agentc2/src/workflows/builder/runtime.ts`**
   - Lines: 735-738 (transform case)
   - Change: Implement output mapping logic
   
2. **`packages/agentc2/src/workflows/builder/types.ts`**
   - Lines: 1-138
   - Change: Add WorkflowTransformConfig interface (optional)

3. **`scripts/seed-sdlc-playbook.ts`**
   - Lines: 1015-1204 (bugfixWorkflowDef)
   - Change: Add output summary step after merge
   
4. **`apps/agent/src/components/builder/inspectors/TransformInspector.tsx`**
   - Lines: 1-35
   - Change: Replace placeholder with mapping form

5. **`tests/unit/workflow-runtime.test.ts`**
   - New: Add transform step test cases

### Files to Review (No Changes)

1. **`apps/agent/src/app/api/workflows/[slug]/execute/route.ts`** (line 177)
   - Already sets `outputJson: result.output`
   - Will automatically store richer output

2. **`apps/agent/src/lib/inngest-functions.ts`** (line 8860)
   - Already sets `outputJson: result.output`
   - Will automatically store richer output

3. **`apps/agent/src/components/RunDetailPanel.tsx`** (lines 1392-1468)
   - Already renders arbitrary JSON in outputJson
   - Will automatically display richer output

---

## 20. Acceptance Criteria

### Functional Requirements

- [ ] Transform step extracts values from context.steps using path expressions
- [ ] Transform step supports nested path notation: `steps['step-id'].nested.field`
- [ ] Transform step supports computed expressions: `steps.a.value + steps.b.value`
- [ ] Transform step handles undefined/null paths gracefully (returns null)
- [ ] Transform step with no outputMapping config acts as pass-through (backward compatible)
- [ ] Bugfix workflow outputJson contains structured summary with:
  - Issue details
  - Analysis summary and duration
  - Audit verdict and issues count
  - Implementation summary and branch
  - PR number and URL
  - Merge status and SHA
  - Total duration and audit cycles count

### Non-Functional Requirements

- [ ] Transform step execution time: <50ms (99th percentile)
- [ ] Output summary size: <10KB
- [ ] No memory leaks from expression evaluation
- [ ] Existing workflows continue working unchanged
- [ ] All type checks pass (`bun run type-check`)
- [ ] All linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)

### Documentation Requirements

- [ ] Transform step documented in `docs/mcp-workflows-networks.md`
- [ ] SDLC workflow output format documented
- [ ] Example output mapping configurations provided

---

## 21. Rollout Timeline

### Phase 1: Core Implementation (Days 1-2)

- Implement transform step logic
- Add unit tests
- Verify locally

### Phase 2: SDLC Workflow Update (Day 2)

- Add output summary to bugfix workflow
- Re-seed workflow in staging
- Test end-to-end

### Phase 3: UI Enhancement (Days 2-3)

- Update transform inspector
- Test in workflow designer

### Phase 4: Additional Workflows (Day 3)

- Update feature and triage workflows
- Test all SDLC workflows

### Phase 5: Documentation & Deploy (Day 3)

- Update documentation
- Deploy to production
- Monitor initial runs

**Total Estimated Time**: 2-3 days (16-24 hours of work)

---

## 22. Conclusion

This is a straightforward bug fix with low risk and high value. The transform step type already exists as a placeholder, and implementing it with output mapping is a natural extension of the workflow engine's existing template system.

The fix will:
1. ✅ Solve the immediate problem (structured bugfix workflow output)
2. ✅ Enable output mapping for all future workflows
3. ✅ Maintain full backward compatibility
4. ✅ Require no database schema changes
5. ✅ Leverage existing template/expression infrastructure

**Recommendation**: Proceed with implementation. Start with Phase 1 (core transform logic) and Phase 2 (bugfix workflow update), then iterate on UI and additional workflows.

---

## Appendix A: Example Output Mapping Configurations

### Simple Field Extraction

```json
{
    "type": "transform",
    "id": "summary",
    "config": {
        "outputMapping": {
            "userId": "steps.authenticate.userId",
            "result": "steps.process.result",
            "timestamp": "helpers.now()"
        }
    }
}
```

### Complex Multi-Step Aggregation

```json
{
    "type": "transform",
    "id": "aggregate",
    "config": {
        "outputMapping": {
            "phase1.duration": "steps['phase-1'].durationMs",
            "phase1.result": "steps['phase-1'].output",
            "phase2.duration": "steps['phase-2'].durationMs",
            "phase2.result": "steps['phase-2'].output",
            "status": "steps.merge.success ? 'completed' : 'failed'"
        },
        "computedFields": {
            "totalDuration": "steps['phase-1'].durationMs + steps['phase-2'].durationMs",
            "successRate": "steps.verify.passedTests / steps.verify.totalTests"
        }
    }
}
```

### Conditional Field Mapping

```json
{
    "type": "transform",
    "id": "conditional-summary",
    "config": {
        "outputMapping": {
            "approved": "steps.review?.approved || false",
            "feedback": "steps.review?.approved ? steps.review.feedback : null",
            "rejectionReason": "!steps.review?.approved ? steps.review.feedback : null"
        }
    }
}
```

---

## Appendix B: SDLC Bugfix Workflow Output Schema

### Current Output (Last Step Only)

```typescript
{
    success: boolean;
    sha: string | null;
    message: string;
}
```

### Proposed Output (Structured Summary)

```typescript
{
    status: "completed" | "failed";
    issue: {
        number: number;
        url: string;
        repository: string;
    };
    analysis: {
        agentId: string;
        summary: string;
        durationMs: number;
    };
    audit: {
        verdict: "PASS" | "NEEDS_REVISION" | "FAIL";
        severity: "none" | "minor" | "major" | "critical";
        issuesFound: number;
        approved: boolean;
    };
    implementation: {
        agentId: string;
        branchName: string;
        summary: string;
        durationMs: number;
    };
    pr: {
        number: number;
        url: string;
    };
    merge: {
        success: boolean;
        sha: string;
        message: string;
    };
    metrics: {
        totalDurationMs: number;
        auditCycles: number;
        stepsCompleted: number;
    };
}
```

---

## Appendix C: Tool Output Schemas

Reference for available fields from each tool used in the bugfix workflow:

### ticket-to-github-issue
```typescript
{ issueNumber: number, issueUrl: string, repository: string, linked: boolean }
```

### cursor-launch-agent
```typescript
{ agentId: string, name: string, status: string, branchName: string | null, agentUrl: string | null }
```

### cursor-poll-until-done
```typescript
{ agentId: string, status: string, summary: string | null, branchName: string | null, prNumber: number | null, repository: string | null, durationMs: number, timedOut: boolean }
```

### cursor-get-conversation
```typescript
{ agentId: string, messages: Array<{ role: string, content: string, timestamp: string | null }> }
```

### github-add-issue-comment
```typescript
{ success: boolean, commentId: number, commentUrl: string }
```

### github-create-pull-request
```typescript
{ prNumber: number, prUrl: string, htmlUrl: string }
```

### merge-pull-request
```typescript
{ success: boolean, sha: string | null, message: string }
```

### SDLC Auditor Agent (fix-audit step)
```typescript
{
    verdict: "PASS" | "NEEDS_REVISION" | "FAIL",
    severity: "none" | "minor" | "major" | "critical",
    issues: Array<{ severity: string, area: string, description: string, suggestedFix: string }>,
    positives: string[],
    summary: string,
    checklist: {
        requirementsAddressed: boolean,
        edgeCasesConsidered: boolean,
        errorHandlingPresent: boolean,
        noBreakingChanges: boolean,
        securityReviewed: boolean,
        performanceAssessed: boolean,
        testingCovered: boolean
    }
}
```

---

**End of Root Cause Analysis**

_Generated by: AgentC2 Cloud Agent_  
_Date: 2026-03-04_  
_Task: Root cause analysis for Issue #69_

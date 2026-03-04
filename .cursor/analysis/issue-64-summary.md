# Bug Analysis Summary: SDLC Workflow Output Missing Structured Summary

**GitHub Issue**: #64 - https://github.com/Appello-Prototypes/agentc2/issues/64

---

## Root Cause

The SDLC Bugfix workflow saves only the last step's output (merge confirmation) to `outputJson` instead of a structured pipeline summary. This happens because:

1. **Workflow Runtime Behavior**: The workflow execution engine returns only the final step's output by design (`runtime.ts:802`)
2. **Missing Aggregation Step**: The bugfix workflow lacks a final `transform` step to aggregate data from previous steps
3. **Direct Persistence**: The workflow output is saved directly to the database without transformation (`execute/route.ts:177`)

---

## Key Findings

### Available Data Sources

The bugfix workflow captures rich data across 11 steps:

- **Issue**: URL, number (from `intake` step)
- **Analysis**: Summary, duration, Cursor agent ID (from `analyze-wait` step)
- **Audit**: Verdict, severity, summary, iterations (from `fix-audit` step inside `audit-cycle`)
- **Implementation**: Summary, duration, branch name (from `implement-wait` step)
- **Pull Request**: URL, number (from `create-pr` step)
- **Merge**: Approval status (from `merge-review` step)

### Classification Note

The bug report mentions "classification" should be in the output, but the bugfix workflow **does not perform classification**. Classification occurs in the parent triage workflow. To include it, classification data must be passed via input parameters from triage to bugfix.

---

## Recommended Fix

**Add a `transform` step as the final step of the bugfix workflow** to aggregate key data into a structured output.

### Implementation Location

**File**: `/workspace/scripts/seed-sdlc-playbook.ts`  
**Line**: 1203 (insert new step after the `merge` step)

### Output Structure

```json
{
  "status": "completed",
  "ticket": {
    "issueUrl": "https://github.com/.../issues/64",
    "issueNumber": 64
  },
  "analysis": {
    "summary": "Root cause: ...",
    "durationMs": 45000
  },
  "audit": {
    "verdict": "PASS",
    "summary": "..."
  },
  "pullRequest": {
    "url": "https://github.com/.../pull/123",
    "number": 123
  },
  "merge": {
    "success": true,
    "mergedAt": "2026-03-04T..."
  }
}
```

---

## Risk Assessment

**Risk Level**: **Low**

- ✅ Non-breaking change (existing runs unaffected)
- ✅ Uses existing transform step infrastructure
- ✅ No schema changes required
- ✅ Easily reversible
- ✅ Passive operation (no side effects)

**Complexity**: **Low** (~15 minutes code change, ~1.5 hours with tests)

---

## Files Requiring Modification

### Primary Changes

1. **`/workspace/scripts/seed-sdlc-playbook.ts`**
   - Add output aggregation step to `bugfixWorkflowDef.steps` array (after line 1202)
   - Add comma to previous step (line 1202: `}` → `},`)
   - Run seed script to update database

### Test Files (New)

2. **`/workspace/tests/unit/bugfix-workflow-output.test.ts`** (optional)
   - Unit tests for output aggregation logic

### No Changes Required

- Workflow runtime engine (already supports transform steps)
- API routes (already serialize outputJson)
- UI components (already display arbitrary JSON)
- Database schema (uses existing Json field)

---

## Verification Steps

1. Run seed script: `bun run scripts/seed-sdlc-playbook.ts`
2. Verify in Prisma Studio: Check `workflow.definitionJson` for new step
3. Execute test workflow run
4. Query database: Verify `workflow_run.outputJson` contains structured data
5. Check UI: Verify `/workflows/sdlc-bugfix-agentc2/runs` displays new output format

---

## Follow-Up Recommendations

1. **Apply same pattern to feature workflow** for consistency
2. **Propagate classification from triage workflow** to bugfix input parameters
3. **Consider declarative `outputMapping`** field in future workflow schema enhancement
4. **Update workflow documentation** with output structure specification

---

**Analysis Status**: ✅ Complete  
**Implementation Plan**: ✅ Ready  
**Approval Required**: Yes (before implementation)

---

## Quick Reference

**Root Cause**: Workflow runtime returns last step output only  
**Fix**: Add transform step with inputMapping aggregation  
**Files**: 1 file (`seed-sdlc-playbook.ts`)  
**Tests**: Unit test recommended  
**Risk**: Low  
**Effort**: Low (~1.5 hours)  
**Breaking**: No

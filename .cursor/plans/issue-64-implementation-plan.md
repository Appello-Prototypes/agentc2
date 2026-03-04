# Implementation Plan: SDLC Bugfix Workflow Output Aggregation

**Issue:** https://github.com/Appello-Prototypes/agentc2/issues/64  
**Analysis:** See `/workspace/.cursor/analysis/issue-64-root-cause-analysis.md`  
**Status:** Ready for Implementation  
**Risk:** Low  
**Complexity:** Low  

---

## Overview

Add a `transform` step at the end of the SDLC Bugfix workflow to aggregate key pipeline data (issue URL, analysis summary, audit verdict, PR URL) into a structured output object.

---

## Implementation Steps

### Step 1: Modify Bugfix Workflow Definition

**File**: `/workspace/scripts/seed-sdlc-playbook.ts`

**Change Location**: Lines 1202-1203

**Current Code** (line 1190-1203):

```typescript
            {
                id: "merge",
                type: "tool",
                name: "Merge PR",
                config: {
                    toolId: "merge-pull-request",
                    parameters: {
                        prNumber: "{{steps['create-pr'].prNumber}}",
                        repository: "{{input.repository}}",
                        mergeMethod: "squash"
                    }
                }
            }
        ]
    };
```

**New Code** (add comma to line 1202, insert new step before line 1203):

```typescript
            {
                id: "merge",
                type: "tool",
                name: "Merge PR",
                config: {
                    toolId: "merge-pull-request",
                    parameters: {
                        prNumber: "{{steps['create-pr'].prNumber}}",
                        repository: "{{input.repository}}",
                        mergeMethod: "squash"
                    }
                }
            },
            {
                id: "output-summary",
                type: "transform",
                name: "Aggregate Pipeline Summary",
                description: "Aggregate key data from all pipeline steps into structured output",
                inputMapping: {
                    status: "completed",
                    workflow: "sdlc-bugfix",
                    ticket: {
                        title: "{{input.title}}",
                        description: "{{input.description}}",
                        repository: "{{input.repository}}",
                        issueUrl: "{{steps.intake.issueUrl}}",
                        issueNumber: "{{steps.intake.issueNumber}}"
                    },
                    analysis: {
                        summary: "{{steps['analyze-wait'].summary}}",
                        durationMs: "{{steps['analyze-wait'].durationMs}}",
                        cursorAgentId: "{{steps['analyze-launch'].agentId}}",
                        commentUrl: "{{steps['post-analysis'].commentUrl}}"
                    },
                    audit: {
                        verdict: "{{steps['fix-audit'].verdict}}",
                        severity: "{{steps['fix-audit'].severity}}",
                        summary: "{{steps['fix-audit'].summary}}",
                        iterations: "{{steps['audit-cycle']._totalIterations}}",
                        approved: "{{steps['fix-review'].approved}}"
                    },
                    implementation: {
                        summary: "{{steps['implement-wait'].summary}}",
                        durationMs: "{{steps['implement-wait'].durationMs}}",
                        branchName: "{{steps['implement-wait'].branchName}}",
                        cursorAgentId: "{{steps['implement-launch'].agentId}}"
                    },
                    pullRequest: {
                        url: "{{steps['create-pr'].htmlUrl}}",
                        number: "{{steps['create-pr'].prNumber}}",
                        reviewApproved: "{{steps['merge-review'].approved}}"
                    },
                    merge: {
                        success: true,
                        mergedAt: "{{now()}}",
                        method: "squash"
                    },
                    metadata: {
                        completedAt: "{{now()}}",
                        totalSteps: 12
                    }
                }
            }
        ]
    };
```

**Validation**:
- Verify JSON syntax is valid
- Verify comma added to previous step
- Verify all template variables use correct step IDs

---

### Step 2: Reseed Workflow Definition

**Command**: 
```bash
bun run scripts/seed-sdlc-playbook.ts
```

**Expected Output**:
```
Seeding SDLC Flywheel playbook...

AgentC2 org exists: <org-id>
Platform workspace exists: <workspace-id>
Document exists: sdlc-coding-standards
...
Workflow exists: sdlc-bugfix-agentc2

✔ SDLC Flywheel seed complete!
```

**Verification**:
1. Check script completes without errors
2. Verify workflow updated in database

**Database Verification Query**:

```sql
SELECT 
    id, 
    slug, 
    version, 
    jsonb_array_length(
        CAST("definitionJson"->>'steps' AS jsonb)
    ) as step_count
FROM workflow 
WHERE slug = 'sdlc-bugfix-agentc2';
```

Expected `step_count`: **12** (was 11, now 12 after adding output-summary step)

---

### Step 3: Verify Workflow Definition in Database

**Tool**: Prisma Studio

**Command**:
```bash
bun run db:studio
```

**Verification Steps**:

1. Open `Workflow` model
2. Find record where `slug = "sdlc-bugfix-agentc2"`
3. Inspect `definitionJson` field
4. Verify last step in `steps` array is:
   ```json
   {
       "id": "output-summary",
       "type": "transform",
       "name": "Aggregate Pipeline Summary",
       "inputMapping": { ... }
   }
   ```
5. Verify `steps` array length is 12 (not 11)

---

### Step 4: Create Unit Test

**File to Create**: `/workspace/tests/unit/bugfix-workflow-output.test.ts`

**Test Code**:

```typescript
import { describe, it, expect, vi, beforeAll } from "vitest";
import { executeWorkflowDefinition } from "../../packages/agentc2/src/workflows/builder/runtime";

// Mock dependencies
vi.mock("../../packages/agentc2/src/agents/resolver", () => ({
    agentResolver: { resolve: vi.fn() }
}));
vi.mock("../../packages/agentc2/src/tools/registry", () => ({
    getToolsByNamesAsync: vi.fn()
}));
vi.mock("@repo/database", () => ({
    prisma: { workflow: { findFirst: vi.fn() } }
}));

describe("SDLC Bugfix Workflow Output Aggregation", () => {
    it("should aggregate pipeline data into structured output", async () => {
        const mockIntake = {
            issueUrl: "https://github.com/org/repo/issues/1",
            issueNumber: 1
        };
        const mockAnalysisWait = {
            summary: "Root cause: null pointer in handler",
            durationMs: 45000
        };
        const mockAudit = {
            verdict: "PASS",
            severity: "none",
            summary: "Analysis is thorough and complete"
        };
        const mockPR = {
            htmlUrl: "https://github.com/org/repo/pull/10",
            prNumber: 10
        };

        const definition = {
            steps: [
                {
                    id: "output-summary",
                    type: "transform",
                    inputMapping: {
                        ticket: {
                            issueUrl: "{{steps.intake.issueUrl}}",
                            issueNumber: "{{steps.intake.issueNumber}}"
                        },
                        analysis: {
                            summary: "{{steps['analyze-wait'].summary}}"
                        },
                        audit: {
                            verdict: "{{steps['fix-audit'].verdict}}"
                        },
                        pullRequest: {
                            url: "{{steps['create-pr'].htmlUrl}}"
                        }
                    }
                }
            ]
        };

        const result = await executeWorkflowDefinition({
            definition,
            input: {},
            existingSteps: {
                intake: mockIntake,
                "analyze-wait": mockAnalysisWait,
                "fix-audit": mockAudit,
                "create-pr": mockPR
            }
        });

        expect(result.status).toBe("success");
        expect(result.output).toEqual({
            ticket: {
                issueUrl: "https://github.com/org/repo/issues/1",
                issueNumber: 1
            },
            analysis: {
                summary: "Root cause: null pointer in handler"
            },
            audit: {
                verdict: "PASS"
            },
            pullRequest: {
                url: "https://github.com/org/repo/pull/10"
            }
        });
    });

    it("should handle missing steps gracefully", async () => {
        const definition = {
            steps: [
                {
                    id: "output-summary",
                    type: "transform",
                    inputMapping: {
                        issueUrl: "{{steps.intake.issueUrl}}",
                        missingData: "{{steps.nonexistent.value}}"
                    }
                }
            ]
        };

        const result = await executeWorkflowDefinition({
            definition,
            input: {},
            existingSteps: {
                intake: { issueUrl: "https://github.com/org/repo/issues/1" }
            }
        });

        expect(result.status).toBe("success");
        expect(result.output).toEqual({
            issueUrl: "https://github.com/org/repo/issues/1",
            missingData: "" // Missing values resolve to empty string
        });
    });
});
```

**Command to Run**:
```bash
bun test tests/unit/bugfix-workflow-output.test.ts
```

**Expected Result**: All tests pass

---

### Step 5: Integration Test (Optional)

**File to Create**: `/workspace/tests/integration/sdlc-bugfix-workflow-output.test.ts`

**Approach**:

1. Mock all tool calls (GitHub, Cursor)
2. Execute bugfix workflow end-to-end
3. Verify `WorkflowRun.outputJson` in database
4. Assert structure matches specification

**Note**: This is a more comprehensive test but requires extensive mocking. Can be deferred to follow-up if time-constrained.

---

### Step 6: Manual Verification

**Test Procedure**:

1. **Trigger test workflow run**:

```bash
curl -X POST http://localhost:3001/api/workflows/sdlc-bugfix-agentc2/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "title": "Test: Output aggregation verification",
      "description": "This is a test run to verify the output summary step works correctly.",
      "repository": "Appello-Prototypes/agentc2",
      "existingIssueUrl": "https://github.com/Appello-Prototypes/agentc2/issues/64",
      "existingIssueNumber": 64
    }
  }'
```

2. **Monitor execution**:
   - Open UI: http://localhost:3001/workflows/sdlc-bugfix-agentc2/runs
   - Watch run progress

3. **Query final output**:

```bash
# Get the run ID from the API response or UI, then:
psql $DATABASE_URL -c "
  SELECT 
    id, 
    status, 
    jsonb_pretty(\"outputJson\") 
  FROM workflow_run 
  WHERE workflow_id = (
    SELECT id FROM workflow WHERE slug = 'sdlc-bugfix-agentc2'
  ) 
  ORDER BY \"createdAt\" DESC 
  LIMIT 1;
"
```

4. **Verify output structure**:

Expected outputJson:
```json
{
  "status": "completed",
  "workflow": "sdlc-bugfix",
  "ticket": {
    "title": "...",
    "issueUrl": "https://github.com/.../issues/64",
    "issueNumber": 64
  },
  "analysis": {
    "summary": "...",
    "durationMs": 45000,
    "cursorAgentId": "..."
  },
  "audit": {
    "verdict": "PASS",
    "severity": "none",
    "summary": "...",
    "iterations": 1
  },
  "implementation": {
    "summary": "...",
    "branchName": "...",
    "cursorAgentId": "..."
  },
  "pullRequest": {
    "url": "https://github.com/.../pull/123",
    "number": 123
  },
  "merge": {
    "success": true,
    "mergedAt": "2026-03-04T..."
  },
  "metadata": {
    "completedAt": "...",
    "totalSteps": 12
  }
}
```

---

## Pre-Implementation Checklist

Before making changes:

- [ ] Read root cause analysis document thoroughly
- [ ] Understand transform step implementation in runtime.ts
- [ ] Review existing transform step examples in seed-workflows-networks.ts
- [ ] Verify local development environment is set up (`bun install`)
- [ ] Confirm database is accessible (`bun run db:studio`)

---

## Post-Implementation Checklist

After making changes:

- [ ] Seed script executes without errors
- [ ] Workflow definition in database updated (verify in Prisma Studio)
- [ ] Unit tests pass (`bun test tests/unit/bugfix-workflow-output.test.ts`)
- [ ] Manual verification shows structured output
- [ ] Code formatted (`bun run format`)
- [ ] Code lints without errors (`bun run lint`)
- [ ] Type checking passes (`bun run type-check`)
- [ ] Build succeeds (`bun run build`)
- [ ] Changes committed with conventional commit message
- [ ] Changes pushed to feature branch

---

## Alternative: Minimal Implementation

If comprehensive output structure is too verbose, use this minimal version:

```typescript
{
    id: "output-summary",
    type: "transform",
    name: "Aggregate Pipeline Summary",
    inputMapping: {
        issueUrl: "{{steps.intake.issueUrl}}",
        issueNumber: "{{steps.intake.issueNumber}}",
        analysisSummary: "{{steps['analyze-wait'].summary}}",
        auditVerdict: "{{steps['fix-audit'].verdict}}",
        prUrl: "{{steps['create-pr'].htmlUrl}}",
        prNumber: "{{steps['create-pr'].prNumber}}"
    }
}
```

This matches exactly what the bug report requested: "issue URL, classification, analysis summary, audit verdict, and PR URL".

**Note**: Classification is omitted because it's not available in bugfix workflow (see analysis document for details).

---

## Follow-Up Enhancements (Optional)

### Enhancement 1: Apply to Feature Workflow

**File**: `/workspace/scripts/seed-sdlc-playbook.ts`  
**Location**: After line 1423 (after feature workflow's merge step)  
**Action**: Add similar output-summary transform step

### Enhancement 2: Propagate Classification from Triage

**File**: `/workspace/scripts/seed-sdlc-playbook.ts`  
**Location**: Lines 1481-1495 (triage workflow's run-bugfix step)  
**Action**: Add classification data to bugfix workflow input

**Current Code**:
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
            sourceTicketId: "{{input.sourceTicketId}}",
            existingIssueUrl: "{{steps.intake.issueUrl}}",
            existingIssueNumber: "{{steps.intake.issueNumber}}"
        }
    }
}
```

**Enhanced Code**:
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
            sourceTicketId: "{{input.sourceTicketId}}",
            existingIssueUrl: "{{steps.intake.issueUrl}}",
            existingIssueNumber: "{{steps.intake.issueNumber}}",
            classification: "{{steps.classify.classification}}",
            priority: "{{steps.classify.priority}}",
            complexity: "{{steps.classify.complexity}}"
        }
    }
}
```

Then update bugfix workflow's output-summary to include:
```typescript
classification: "{{input.classification}}",
priority: "{{input.priority}}",
complexity: "{{input.complexity}}"
```

### Enhancement 3: Add Conditional Fallbacks

For robustness, wrap optional fields in conditional templates:

```typescript
inputMapping: {
    issueUrl: "{{steps.intake.issueUrl}}",
    prUrl: "{{#if steps['create-pr']}}{{steps['create-pr'].htmlUrl}}{{/if}}"
}
```

This ensures the output doesn't break if a step fails or is skipped.

---

## Rollback Plan

If the change causes issues:

### Quick Rollback

1. **Revert commit**:
   ```bash
   git revert HEAD
   git push origin <branch>
   ```

2. **Reseed with old definition**:
   ```bash
   bun run scripts/seed-sdlc-playbook.ts
   ```

### Manual Rollback

1. **Edit workflow in Prisma Studio**:
   - Open `workflow` table
   - Find `sdlc-bugfix-agentc2` record
   - Edit `definitionJson` field
   - Remove last step (`output-summary`)
   - Save changes

2. **Or via SQL**:
   ```sql
   UPDATE workflow
   SET "definitionJson" = jsonb_set(
       "definitionJson",
       '{steps}',
       ("definitionJson"->'steps')::jsonb - -1
   )
   WHERE slug = 'sdlc-bugfix-agentc2';
   ```

---

## Risk Mitigation

### Risk 1: Template Syntax Errors

**Mitigation**: 
- Validate all template variables exist in workflow context
- Test with sample execution before production use
- Add unit tests for template resolution

### Risk 2: Missing Step Data

**Mitigation**:
- Runtime already handles missing data gracefully (returns empty string)
- No null pointer exceptions expected
- Consider adding conditional templates for critical fields

### Risk 3: Performance Impact

**Mitigation**:
- Transform step is lightweight (no external calls)
- Only data copying and template resolution
- Negligible impact (<10ms added to workflow execution)

---

## Success Criteria

The implementation is complete and successful when:

1. ✅ Seed script executes without errors
2. ✅ Workflow definition in database includes `output-summary` step
3. ✅ Test execution produces structured outputJson with all required fields
4. ✅ outputJson contains:
   - `ticket.issueUrl`
   - `analysis.summary`
   - `audit.verdict`
   - `pullRequest.url`
   - `merge.*` status
5. ✅ Missing/null fields degrade gracefully
6. ✅ UI displays structured output without errors
7. ✅ No breaking changes to existing workflow runs or consumers
8. ✅ All pre-push checks pass (type-check, lint, build)

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Code changes | 10 minutes |
| Reseed & verification | 10 minutes |
| Unit tests | 30 minutes |
| Manual testing | 20 minutes |
| Documentation | 15 minutes |
| Code review & fixes | 15 minutes |
| **Total** | **~1.5 hours** |

---

## Notes for Implementer

1. **Template Variables**: All step references use bracket notation for steps with hyphens: `steps['analyze-wait']` not `steps.analyze-wait`

2. **Dowhile Step Access**: Steps inside `audit-cycle` dowhile loop are accessible directly (e.g., `steps['fix-audit']`) because the runtime merges them into the main context

3. **Helper Functions**: Available helpers include:
   - `{{now()}}` - Current ISO timestamp
   - `{{today()}}` - Today's date (YYYY-MM-DD)
   - `{{json(...)}}` - JSON.stringify()
   - `{{helpers.json(...)}}` - Same as above

4. **Comma Matters**: Don't forget to add comma to the previous step (line 1202) when inserting the new step

5. **Indentation**: Use 16 spaces for the new step (matches existing indentation level)

---

## Questions & Clarifications

### Q: Why not use `outputMapping` field on workflow definition?

**A**: The workflow schema and runtime don't currently support a dedicated `outputMapping` field. Adding one would require:
- Schema migration
- Runtime engine changes  
- Workflow validation updates
- More extensive testing

The transform step achieves the same result using existing infrastructure.

### Q: What if classification data is needed in output?

**A**: Classification is not performed in the bugfix workflow (it's done in the parent triage workflow). Options:
1. Pass classification via input parameters from triage (recommended)
2. Add optional classification step to bugfix workflow (not recommended, redundant)
3. Include conditional template: `{{#if input.classification}}...{{/if}}`

### Q: Should we apply this pattern to all SDLC workflows?

**A**: Yes, for consistency:
- Feature workflow should also get output aggregation step
- Standard workflow is deprecated, can be ignored
- Triage workflow output is less critical (it's just routing)

---

**Plan Complete** ✓

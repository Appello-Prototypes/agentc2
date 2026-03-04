# Code Changes Specification: Issue #64

**File**: `/workspace/scripts/seed-sdlc-playbook.ts`  
**Change Type**: Add new workflow step  
**Lines Affected**: 1202-1203  

---

## Change 1: Add Comma to Previous Step

**Location**: Line 1202

**Before**:
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
```

**After** (add comma):
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
```

---

## Change 2: Insert New Transform Step

**Location**: Between line 1202 and 1203 (after the `merge` step, before `]` that closes the `steps` array)

**Code to Insert**:

```typescript
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
```

**Indentation**: Use 12 spaces (3 levels of 4-space indent) to match existing code style

---

## Complete Context (Lines 1190-1203+)

**Full code block showing before/after context**:

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

---

## Post-Implementation Commands

```bash
# 1. Reseed workflow definition
bun run scripts/seed-sdlc-playbook.ts

# 2. Run unit tests (if created)
bun test tests/unit/bugfix-workflow-output.test.ts

# 3. Type check
bun run type-check

# 4. Lint
bun run lint

# 5. Format
bun run format

# 6. Build
bun run build

# 7. Verify in database
bun run db:studio
# Navigate to: workflow → sdlc-bugfix-agentc2 → definitionJson → steps (should have 12 items)

# 8. Manual test execution
curl -X POST http://localhost:3001/api/workflows/sdlc-bugfix-agentc2/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"title": "Test", "description": "Test run", "repository": "Appello-Prototypes/agentc2", "existingIssueUrl": "https://github.com/Appello-Prototypes/agentc2/issues/64", "existingIssueNumber": 64}}'
```

---

## Expected Output Format

After implementation, `WorkflowRun.outputJson` will contain:

```json
{
  "status": "completed",
  "workflow": "sdlc-bugfix",
  "ticket": {
    "title": "SDLC workflow run output missing structured summary",
    "description": "When the SDLC Bugfix workflow completes...",
    "repository": "Appello-Prototypes/agentc2",
    "issueUrl": "https://github.com/Appello-Prototypes/agentc2/issues/64",
    "issueNumber": 64
  },
  "analysis": {
    "summary": "## Root Cause Analysis\n\n...",
    "durationMs": 45000,
    "cursorAgentId": "agent-abc123",
    "commentUrl": "https://github.com/.../issues/64#comment-..."
  },
  "audit": {
    "verdict": "PASS",
    "severity": "none",
    "summary": "The fix plan is complete and well-structured...",
    "iterations": 1,
    "approved": true
  },
  "implementation": {
    "summary": "## Implementation Complete\n\n...",
    "durationMs": 120000,
    "branchName": "fix/issue-64-workflow-output",
    "cursorAgentId": "agent-xyz789"
  },
  "pullRequest": {
    "url": "https://github.com/Appello-Prototypes/agentc2/pull/123",
    "number": 123,
    "reviewApproved": true
  },
  "merge": {
    "success": true,
    "mergedAt": "2026-03-04T20:45:00.000Z",
    "method": "squash"
  },
  "metadata": {
    "completedAt": "2026-03-04T20:45:00.000Z",
    "totalSteps": 12
  }
}
```

---

## Alternative: Minimal Fix

If the comprehensive structure is too verbose, use this minimal version:

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
        prNumber: "{{steps['create-pr'].prNumber}}",
        approved: "{{steps['merge-review'].approved}}"
    }
}
```

This provides exactly what the bug report requested: issue URL, analysis summary, audit verdict, and PR URL.

---

## Implementation Estimate

- **Complexity**: Low
- **Files Modified**: 1 (seed script)
- **New Files**: 0-1 (optional unit test)
- **Schema Changes**: 0
- **Time Estimate**: 15 minutes code + 1 hour testing = **~1.5 hours total**
- **Risk**: Low (non-breaking, reversible)

---

**Ready for Implementation** ✅

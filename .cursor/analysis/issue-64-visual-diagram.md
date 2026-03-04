# Visual Workflow Diagram: SDLC Bugfix Output Issue

## Current Workflow Flow (BROKEN)

```
┌─────────────────────────────────────────────────────────────┐
│                   SDLC Bugfix Workflow                      │
└─────────────────────────────────────────────────────────────┘

Step 1: intake
  └─> Output: { issueUrl, issueNumber }

Step 2: analyze-launch
  └─> Output: { agentId }

Step 3: analyze-wait
  └─> Output: { summary, durationMs, branchName }
  
Step 4: analyze-result
  └─> Output: { messages }

Step 5: post-analysis
  └─> Output: { commentUrl }

Step 6: audit-cycle (dowhile loop)
  ├─> Step 6a: fix-audit
  │     └─> Output: { verdict, severity, summary, issues }
  ├─> Step 6b: fix-verdict-route (branch)
  │     └─> If PASS:
  │           └─> Step 6c: fix-review (human)
  │                 └─> Output: { approved, feedback }
  │     └─> If NOT PASS:
  │           └─> Step 6d: fix-audit-notes
  │                 └─> Output: { commentUrl }
  └─> Cycle Output: { verdict, approved, _totalIterations }

Step 7: implement-launch
  └─> Output: { agentId }

Step 8: implement-wait
  └─> Output: { summary, durationMs, branchName }

Step 9: create-pr
  └─> Output: { htmlUrl, prNumber, url }

Step 10: merge-review (human)
  └─> Output: { approved, rejected }

Step 11: merge ◄─── LAST STEP (this becomes outputJson)
  └─> Output: { success: true, merged: true }
       └─────────────────────────────────┐
                                         │
                                         ▼
                              WorkflowRun.outputJson
                              = { success: true, merged: true }
                              
                              ❌ PROBLEM: Only merge output!
                              Missing: issue URL, analysis, audit, PR URL
```

---

## Fixed Workflow Flow (SOLUTION)

```
┌─────────────────────────────────────────────────────────────┐
│                   SDLC Bugfix Workflow                      │
└─────────────────────────────────────────────────────────────┘

Steps 1-11: [Same as above, unchanged]
  │
  │ (all step outputs stored in context.steps)
  │
  ▼

Step 12: output-summary ◄─── NEW STEP (now last)
  └─> Type: transform
  └─> Input Mapping: {
        ticket: {
          issueUrl: "{{steps.intake.issueUrl}}",        ◄─── From step 1
          issueNumber: "{{steps.intake.issueNumber}}"   ◄─── From step 1
        },
        analysis: {
          summary: "{{steps['analyze-wait'].summary}}"  ◄─── From step 3
        },
        audit: {
          verdict: "{{steps['fix-audit'].verdict}}"     ◄─── From step 6a
        },
        pullRequest: {
          url: "{{steps['create-pr'].htmlUrl}}"         ◄─── From step 9
        },
        merge: {
          approved: "{{steps['merge-review'].approved}}" ◄─── From step 10
        }
      }
  └─> Output: {
        ticket: { issueUrl: "...", issueNumber: 64 },
        analysis: { summary: "..." },
        audit: { verdict: "PASS" },
        pullRequest: { url: "...", number: 123 },
        merge: { approved: true, mergedAt: "..." }
      }
       └─────────────────────────────────────┐
                                             │
                                             ▼
                              WorkflowRun.outputJson
                              = {
                                  ticket: { ... },
                                  analysis: { ... },
                                  audit: { ... },
                                  pullRequest: { ... },
                                  merge: { ... }
                                }
                              
                              ✅ FIXED: Structured summary!
```

---

## Runtime Mechanism

```
executeWorkflowDefinition()
  └─> executeSteps()
        │
        ├─> For each step in workflow:
        │     │
        │     ├─> Execute step (agent/tool/transform/etc)
        │     │
        │     ├─> Store output in context.steps[step.id]
        │     │
        │     └─> Continue to next step
        │
        └─> After all steps complete:
              │
              └─> return {
                    status: "success",
                    output: context.steps[lastStepId],  ◄─── This becomes outputJson
                    steps: executionSteps
                  }
```

**Key Insight**: The last step's output becomes the workflow's final output.

**Transform Step Behavior**:
```
Transform Step
  ├─> Input: stepInput = resolveInputMapping(step.inputMapping, context)
  │            └─> Resolves all {{template}} variables from context.steps
  │
  └─> Output: stepInput (pass-through, no transformation logic)
               └─> This structured object becomes the step's output
                    └─> Which becomes the workflow's final output
                         └─> Which is saved to WorkflowRun.outputJson
```

---

## Template Resolution Example

**Input Mapping**:
```typescript
{
    issueUrl: "{{steps.intake.issueUrl}}",
    verdict: "{{steps['fix-audit'].verdict}}"
}
```

**Context State** (after all steps execute):
```typescript
{
    input: { title: "...", repository: "..." },
    steps: {
        intake: { issueUrl: "https://github.com/.../issues/64", issueNumber: 64 },
        "analyze-wait": { summary: "...", durationMs: 45000 },
        "fix-audit": { verdict: "PASS", severity: "none" },
        "create-pr": { htmlUrl: "https://github.com/.../pull/123", prNumber: 123 },
        // ... all other steps
    }
}
```

**Resolution Process**:
```typescript
// Template: "{{steps.intake.issueUrl}}"
resolveTemplate("{{steps.intake.issueUrl}}", context)
  └─> evaluateExpression("steps.intake.issueUrl", context)
       └─> getValueAtPath(context, "steps.intake.issueUrl")
            └─> Returns: "https://github.com/.../issues/64"

// Template: "{{steps['fix-audit'].verdict}}"
resolveTemplate("{{steps['fix-audit'].verdict}}", context)
  └─> evaluateExpression("steps['fix-audit'].verdict", context)
       └─> Returns: "PASS"
```

**Final Output**:
```json
{
  "issueUrl": "https://github.com/.../issues/64",
  "verdict": "PASS"
}
```

---

## Data Flow Diagram

```
User/Webhook
     │
     ▼
POST /api/workflows/sdlc-bugfix-agentc2/execute
     │
     ├─> Create WorkflowRun record (status: RUNNING)
     │
     ├─> executeWorkflowDefinition(definition, input)
     │     │
     │     ├─> Execute step 1: intake
     │     │     └─> context.steps.intake = { issueUrl, issueNumber }
     │     │
     │     ├─> Execute step 2: analyze-launch
     │     │     └─> context.steps['analyze-launch'] = { agentId }
     │     │
     │     ├─> ... (steps 3-11)
     │     │
     │     ├─> Execute step 12: output-summary (NEW!)
     │     │     │
     │     │     ├─> Resolve inputMapping templates
     │     │     │     └─> Access all context.steps data
     │     │     │
     │     │     └─> context.steps['output-summary'] = {
     │     │           ticket: { ... },
     │     │           analysis: { ... },
     │     │           audit: { ... },
     │     │           pullRequest: { ... }
     │     │         }
     │     │
     │     └─> return {
     │           status: "success",
     │           output: context.steps['output-summary'],  ◄─── Structured!
     │           steps: [ ... ]
     │         }
     │
     └─> Update WorkflowRun:
           ├─> outputJson = result.output  ◄─── Structured output saved
           ├─> status = COMPLETED
           └─> completedAt = now()

User queries /api/workflows/.../runs/{runId}
     │
     └─> Returns: { run: { ..., outputJson: { ticket, analysis, audit, pr } } }
           └─> UI displays structured summary ✅
```

---

## Comparison: Before vs After

### Before (Broken)

**Query**:
```sql
SELECT "outputJson" FROM workflow_run WHERE id = 'run-123';
```

**Result**:
```json
{
  "success": true,
  "merged": true
}
```

**UI Display**:
```
Output
------
{
  "success": true,
  "merged": true
}
```

❌ **User must click through 11 steps to find issue URL, audit verdict, PR URL**

---

### After (Fixed)

**Query**:
```sql
SELECT "outputJson" FROM workflow_run WHERE id = 'run-456';
```

**Result**:
```json
{
  "status": "completed",
  "ticket": {
    "issueUrl": "https://github.com/Appello-Prototypes/agentc2/issues/64",
    "issueNumber": 64
  },
  "analysis": {
    "summary": "Root cause identified: workflow runtime returns only last step output..."
  },
  "audit": {
    "verdict": "PASS",
    "summary": "Fix plan is complete and addresses all requirements"
  },
  "pullRequest": {
    "url": "https://github.com/Appello-Prototypes/agentc2/pull/123",
    "number": 123
  },
  "merge": {
    "success": true,
    "mergedAt": "2026-03-04T20:45:00Z"
  }
}
```

**UI Display**:
```
Output
------
{
  "status": "completed",
  "ticket": { ... },      ◄─── Issue URL visible immediately
  "analysis": { ... },    ◄─── Analysis summary visible immediately
  "audit": { ... },       ◄─── Audit verdict visible immediately
  "pullRequest": { ... }, ◄─── PR URL visible immediately
  "merge": { ... }
}
```

✅ **All key data visible at a glance in outputJson**

---

## Architecture Decision: Why Transform Step?

### Option A: Transform Step (Selected) ✅

**Pros**:
- Uses existing infrastructure
- No runtime changes needed
- No schema changes needed
- Low risk, low complexity
- Proven pattern (used in other workflows)

**Cons**:
- Requires adding step to each workflow that needs aggregation
- Not DRY (repeated pattern)

### Option B: Declarative outputMapping (Future)

**Pros**:
- DRY (define once in workflow config)
- Cleaner workflow definitions
- Centralized in runtime engine

**Cons**:
- Requires runtime engine changes
- Requires schema migration
- Higher risk and complexity
- Would need to support alongside transform steps for backward compatibility

**Decision**: Use transform step now, consider outputMapping in future workflow engine v2.

---

## Step Execution Order Verification

**Critical**: The output-summary step MUST be the last step in the array for it to become the workflow's final output.

**Array Position**:
```typescript
const bugfixWorkflowDef = {
    steps: [
        { id: "intake" },         // Index 0
        { id: "analyze-launch" }, // Index 1
        { id: "analyze-wait" },   // Index 2
        { id: "analyze-result" }, // Index 3
        { id: "post-analysis" },  // Index 4
        { id: "audit-cycle" },    // Index 5
        { id: "implement-launch" }, // Index 6
        { id: "implement-wait" }, // Index 7
        { id: "create-pr" },      // Index 8
        { id: "merge-review" },   // Index 9
        { id: "merge" },          // Index 10
        { id: "output-summary" }  // Index 11 ◄─── MUST BE LAST
    ]
};
```

**Verification**:
```typescript
// In runtime.ts line 802:
const output = steps.length > 0 ? context.steps[steps[steps.length - 1].id] : undefined;
//                                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                 steps[10] = "merge" (BROKEN)
//                                                 steps[11] = "output-summary" (FIXED)
```

---

**Diagram Complete** ✓

# Fix SDLC Pipeline Failures — Ticket #20 Root Cause Resolution

## Context

Ticket #20 ("Agent should retry tool calls on transient failures instead of immediately giving up") was dispatched through the SDLC pipeline and exposed **multiple cascading failures** across two workflow runs:

- **Run 1** (auto-dispatch): GitHub 401 at `post-classification` step killed the entire pipeline
- **Run 2** (manual redispatch): Created duplicate GitHub issue, then 524 timeout from Cursor Cloud polling inside a single Inngest step — Inngest retried 3x, potentially launching 3 parallel Cursor Cloud agents

### Problems to Fix (Priority Order)

| #   | Problem                                                            | Impact                                                       |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1   | 524 timeout: entire workflow runs inside single Inngest `step.run` | Pipeline always times out on feature/bugfix workflows        |
| 2   | No idempotency on redispatch: duplicate GitHub issues created      | Clutters repo, confuses tracking                             |
| 3   | Tool step failures kill workflow with no retry                     | Single transient GitHub 401 kills 5 pipelines simultaneously |
| 4   | Zombie RUNNING steps not cleaned up on failure                     | Step status permanently wrong in DB                          |
| 5   | Inngest retries re-launch Cursor Cloud agents                      | Wasted compute, potentially conflicting branches             |

---

## Phase 1: Fix 524 Timeout (CRITICAL)

### Problem

The `asyncWorkflowExecuteFunction` Inngest function runs the entire workflow as a single `step.run("execute-workflow")`. The SDLC feature workflow includes `cursor-poll-until-done` which polls for up to 30 minutes. The reverse proxy (Cloudflare) has a 100-second HTTP timeout, so 524 is guaranteed.

### Solution

Restructure the Inngest function to run each top-level workflow step as its own `step.run()`. This keeps each HTTP request short-lived while the workflow progresses through steps durably.

### File: `apps/agent/src/lib/inngest-functions.ts`

**Changes to `asyncWorkflowExecuteFunction`:**

1. Replace the single `step.run("execute-workflow")` with a step-per-step execution model:
    - `step.run("load-workflow")` — Load workflow definition, build context, find existing steps
    - For each workflow step: `step.run("wf-step-{stepId}")` — Execute one workflow step
    - `step.run("finalize")` — Compute totals, set final status

2. The key change is that `executeWorkflowDefinition` needs a new mode: "execute one step at a time" instead of "execute all steps". Add an option to `executeWorkflowDefinition` that returns after each step completes, yielding the result so the Inngest function can persist it and move to the next `step.run`.

3. Alternative (simpler): Instead of refactoring the workflow runtime, wrap the runtime's `onStepEvent` to detect long-running steps and break them into separate Inngest steps:
    - Before executing, check if the step is a `tool` step with `cursor-poll-until-done` or any step that might take >60s
    - For such steps, use `step.run()` individually

**Chosen approach: Per-step Inngest steps via iterator pattern**

```typescript
// Pseudocode for the new pattern:
const workflowDef = await step.run("load-workflow", async () => {
    // Load workflow, build existing steps map
    return { definition, existingSteps, organizationId };
});

const flatSteps = flattenWorkflowSteps(workflowDef.definition);

for (const wfStep of flatSteps) {
    if (existingSteps[wfStep.id]) continue; // Already completed

    const result = await step.run(`wf-${wfStep.id}`, async () => {
        return executeSingleStep(wfStep, context, requestContext);
    });

    if (result.status === "suspended") {
        // Human approval needed — use step.waitForEvent
        const approval = await step.waitForEvent(`approval-${wfStep.id}`, {
            event: "workflow/resume",
            match: "data.workflowRunId",
            timeout: "7d"
        });
        // Re-run step with resume data
    }

    if (result.status === "failed") break;
}
```

**Challenge:** Workflow steps can be nested (branches, dowhile loops, sub-workflows). Flattening is not trivial. The practical approach:

1. Keep `executeWorkflowDefinition` as-is but add an `stepExecutionTimeout` option
2. For the Inngest function specifically, instead of one big `step.run("execute-workflow")`, split into:
    - `step.run("execute-triage-steps")` — runs the fast steps (intake, classify, post-classification) — these take <10s total
    - `step.run("execute-route-and-sub-workflow")` — runs the routing + sub-workflow execution
3. Better yet: make the sub-workflow invocation (`type: "workflow"`) dispatch a new Inngest event instead of executing inline

### Recommended Implementation: Sub-workflow fan-out via Inngest

Instead of executing sub-workflows inline (which makes the parent run for 30+ minutes), change the workflow runtime's `executeWorkflowStep` to dispatch a new `workflow/execute.async` Inngest event for the child workflow. The parent workflow step then suspends and waits for the child to complete via `step.waitForEvent`.

**Changes needed:**

1. **`packages/agentc2/src/workflows/builder/runtime.ts`** — In `executeWorkflowStep()`, when called from an Inngest context, return a `suspended` status with the child workflow run ID instead of executing inline.

2. **`apps/agent/src/lib/inngest-functions.ts`** — After `executeWorkflowDefinition` returns with `suspended` status due to a sub-workflow step:
    - Dispatch `workflow/execute.async` for the child workflow
    - Use `step.waitForEvent("child-workflow-complete")` to wait for the child
    - Resume the parent with the child's output

3. **This naturally solves the timeout** because:
    - Parent triage workflow: intake (0.5s) + classify (7s) + post-classification (0.5s) + route (instant) = ~10s total in one `step.run`
    - Child feature workflow: runs as its own Inngest function with its own steps
    - The `cursor-poll-until-done` runs inside the child function's step, and each poll iteration is fast

### Simpler Alternative (for now): Direct fan-out in Inngest function

Rather than refactoring the workflow runtime, detect sub-workflow steps at the Inngest level:

1. Run `executeWorkflowDefinition` with a `maxDuration` option (e.g., 90s)
2. If it returns `suspended` because a step exceeded the duration, save progress
3. For the suspended step, if it's a `workflow` type, dispatch a child Inngest event
4. Wait for the child via `step.waitForEvent`

### Simplest Fix (pragmatic for immediate deploy)

Split the single `execute-workflow` step into two steps in the Inngest function:

```typescript
// Step 2a: Run triage steps (fast — intake, classify, post-classification)
const triageResult = await step.run("execute-triage", async () => {
    // Run executeWorkflowDefinition but stop before the route/branch step
    // (i.e., execute only the first 3 steps)
});

// Step 2b: Run routing + sub-workflow (longer but still bounded)
const routeResult = await step.run("execute-route", async () => {
    // Continue from where triage left off
});
```

**BUT** this doesn't solve the sub-workflow timeout because `cursor-poll-until-done` still runs for 20-30 minutes inside `execute-route`.

### Final Decision: Inngest-level sub-workflow dispatch

**This is the proper fix.** Modify `asyncWorkflowExecuteFunction` to:

1. Run `executeWorkflowDefinition` as before in a single step BUT with a flag that makes `type: "workflow"` steps return `{ status: "suspended", childWorkflowSlug, childInput }` instead of executing inline
2. When the function detects a suspended sub-workflow, it:
   a. Creates a child `WorkflowRun` record
   b. Dispatches `workflow/execute.async` for the child
   c. Uses `step.waitForEvent("workflow/child.complete", { match: "data.childRunId" })` to wait
   d. Resumes the parent with the child's output
3. Each child workflow (sdlc-feature, sdlc-bugfix) runs as its own Inngest function invocation

---

## Phase 2: Fix Idempotency on Redispatch

### Problem

When redispatching, the `intake` step (ticket-to-github-issue) creates a new GitHub issue every time. Run 1 created #150, Run 2 created #151.

### Solution

Pass the existing GitHub issue URL from the previous run when redispatching.

### File: `apps/admin/src/app/api/dispatch/route.ts`

1. Before dispatching, check if the ticket has a previous successful workflow run with a completed `intake` step
2. Extract the `issueUrl` and `issueNumber` from the previous run's intake step output
3. Pass `existingIssueUrl` and `existingIssueNumber` in the workflow input

```typescript
// In POST handler, after loading config and before executing:
let existingIssueUrl: string | undefined;
let existingIssueNumber: number | undefined;

if (sourceType === "support_ticket") {
    const ticket = await prisma.supportTicket.findUnique({
        where: { id: sourceId },
        select: { pipelineRunId: true }
    });
    if (ticket?.pipelineRunId) {
        const prevIntakeStep = await prisma.workflowRunStep.findFirst({
            where: {
                runId: ticket.pipelineRunId,
                stepId: "intake",
                status: "COMPLETED"
            },
            select: { outputJson: true }
        });
        if (prevIntakeStep?.outputJson) {
            const output = prevIntakeStep.outputJson as { issueUrl?: string; issueNumber?: number };
            existingIssueUrl = output.issueUrl;
            existingIssueNumber = output.issueNumber;
        }
    }
}

// Add to executePayload.input:
const executePayload = {
    input: {
        ...existing input...,
        existingIssueUrl,
        existingIssueNumber
    },
    ...
};
```

### Also fix: `packages/agentc2/src/auto-dispatch.ts`

Same pattern — check for existing issue before dispatching.

---

## Phase 3: Add Retry to Tool Steps

### Problem

Tool step failures (e.g., GitHub 401) immediately kill the workflow with no retry. A single transient error killed 5 pipelines simultaneously.

### Solution

Add configurable retry with backoff to `executeToolStep` in the workflow runtime.

### File: `packages/agentc2/src/workflows/builder/runtime.ts`

In `executeToolStep()`, wrap the tool execution in a retry loop:

```typescript
async function executeToolStep(step, context, requestContext, workflowMeta) {
    const config = step.config as WorkflowToolConfig;
    const maxRetries = config.retries ?? 2; // Default: 2 retries (3 attempts total)
    const retryableErrors = [401, 403, 429, 500, 502, 503, 524];

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise((r) => setTimeout(r, delay));
            console.log(
                `[WorkflowRuntime] Retrying tool "${config.toolId}" (attempt ${attempt + 1})`
            );
        }
        try {
            const rawResult = await handler(input);
            return unwrapToolResult(rawResult);
        } catch (error) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            const isRetryable = retryableErrors.some((code) => msg.includes(String(code)));
            if (!isRetryable) throw error; // Non-retryable, fail immediately
        }
    }
    throw lastError;
}
```

---

## Phase 4: Clean Up Zombie RUNNING Steps

### Problem

When the Inngest function fails (524), the `onFailure` handler marks the `WorkflowRun` as FAILED but doesn't update individual step statuses. Steps from failed retries are stuck as RUNNING forever.

### Solution

### File: `apps/agent/src/lib/inngest-functions.ts`

In the `onFailure` handler of `asyncWorkflowExecuteFunction`, add cleanup:

```typescript
onFailure: async ({ event, error }) => {
    const workflowRunId = event.data.event.data.workflowRunId;
    if (workflowRunId) {
        try {
            // Mark run as FAILED
            await prisma.workflowRun.update({ ... });

            // Clean up any steps stuck in RUNNING
            await prisma.workflowRunStep.updateMany({
                where: {
                    runId: workflowRunId,
                    status: "RUNNING"
                },
                data: {
                    status: "FAILED",
                    completedAt: new Date(),
                    errorJson: `Parent workflow failed: ${error.message}`
                }
            });
        } catch (updateErr) { ... }
    }
}
```

---

## Phase 5: Prevent Duplicate Cursor Cloud Launches on Retry

### Problem

When Inngest retries the `execute-workflow` step, the progressive persistence skips completed steps but re-executes the `route` → `run-feature` branch. Each retry potentially launches a new Cursor Cloud agent.

### Solution

This is naturally solved by Phase 1 (sub-workflow fan-out). When the child workflow runs as its own Inngest function, the parent uses `step.waitForEvent` which is idempotent — retrying the parent doesn't re-dispatch the child.

As a belt-and-suspenders measure, add a deduplication check in `cursor-launch-agent`:

### File: `packages/agentc2/src/tools/cursor-tools.ts`

Add an optional `idempotencyKey` parameter. Before launching, check if a Cursor Cloud agent was already launched with this key (store in DB or in-memory cache). If so, return the existing agent ID.

---

## Implementation Order

1. **Phase 4** (zombie cleanup) — Smallest change, immediate value
2. **Phase 2** (idempotency) — Medium change, prevents duplicate issues on next redispatch
3. **Phase 3** (tool retry) — Medium change, prevents cascading failures from transient errors
4. **Phase 1** (524 fix) — Largest change, enables feature/bugfix workflows to actually complete
5. **Phase 5** (dedup Cursor launches) — Naturally solved by Phase 1

## Testing Plan

After deploying all phases:

1. Dispatch ticket #20 from admin UI (Redispatch)
2. Verify: no duplicate GitHub issue created (reuses #150 or #151)
3. Verify: triage steps complete without 524
4. Verify: feature sub-workflow runs as separate Inngest function
5. Verify: Cursor Cloud agent launches once, polls to completion
6. Verify: pipeline reaches `design-review` human approval step (suspended)
7. Check DB: no zombie RUNNING steps

## Files Modified

| File                                                | Phase | Changes                                   |
| --------------------------------------------------- | ----- | ----------------------------------------- |
| `apps/agent/src/lib/inngest-functions.ts`           | 1, 4  | Sub-workflow fan-out, zombie cleanup      |
| `packages/agentc2/src/workflows/builder/runtime.ts` | 1, 3  | Sub-workflow suspend mode, tool retry     |
| `apps/admin/src/app/api/dispatch/route.ts`          | 2     | Pass existing issue URL on redispatch     |
| `packages/agentc2/src/auto-dispatch.ts`             | 2     | Pass existing issue URL on auto-dispatch  |
| `packages/agentc2/src/tools/cursor-tools.ts`        | 5     | Idempotency key for Cursor Cloud launches |

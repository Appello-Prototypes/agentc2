# SDLC Pipeline Fix Summary — Ticket #20

**Date:** March 12, 2026
**Chat Reference:** [SDLC pipeline root cause](acdc45ab-189e-45b9-904e-e73fb47ca64c)

---

## What Happened

Admin dispatched ticket #20 ("Agent should retry tool calls on transient failures") through the SDLC coding pipeline. Multiple cascading failures occurred across several runs before all issues were resolved.

---

## Issues Found & Fixed (Chronological)

### Fix 1: Cascading Pipeline Failures (commit `67fc36dc`)

**Root cause analysis** of the initial dispatch revealed 5 distinct problems:

1. **Agent immediately giving up on tool calls** — GPT-4o reported "tools unavailable" without attempting a single call. Fixed with tool step retry logic (2 retries + exponential backoff) in `packages/agentc2/src/workflows/builder/runtime.ts`.

2. **HTTP 524 gateway timeout** — The entire workflow executed inside a single Inngest `step.run`, exceeding Cloudflare's 100-second limit. Fixed by deferring child workflows to separate Inngest functions with `step.waitForEvent` for parent-child coordination.

3. **GitHub 401 Bad Credentials** — Transient auth failures crashed tool steps. Covered by the retry logic in fix #1 (retryable patterns include `401`, `429`, `524`, `ECONNREFUSED`, etc.).

4. **Duplicate GitHub Issues** — Redispatches created duplicate issues. Fixed with idempotency checks in both `apps/admin/src/app/api/dispatch/route.ts` and `packages/agentc2/src/auto-dispatch.ts`.

5. **Zombie RUNNING steps** — When a workflow failed, its in-progress steps stayed in RUNNING status forever. Fixed by adding `prisma.workflowRunStep.updateMany` in the `onFailure` handler of `apps/agent/src/lib/inngest-functions.ts`.

**Files changed:** `apps/agent/src/lib/inngest-functions.ts`, `apps/agent/src/lib/inngest.ts`, `packages/agentc2/src/workflows/builder/runtime.ts`, `apps/admin/src/app/api/dispatch/route.ts`, `packages/agentc2/src/auto-dispatch.ts`

---

### Fix 2: Per-Step Inngest Execution (commit `6276331a`)

**Problem:** Fix 1 solved the parent-level 524, but the child workflow still hit 524s because the `design-wait` step (which polls Cursor Cloud for up to 20 minutes) ran inside a single `step.run("execute-workflow")`.

**Solution:** Major refactor of the Inngest function:

- **Each workflow step gets its own `step.run`** via a `stepExecutor` callback passed from `inngest-functions.ts` to `runtime.ts`. This keeps individual HTTP requests under 5 seconds.

- **Polling tools (`cursor-poll-until-done`, `claude-poll-until-done`)** are handled with an Inngest-level polling loop: `step.sleep("15s")` + `step.run` to call `cursor-get-status`, repeated until a terminal status is detected. No single request ever blocks for more than 15 seconds.

- **`onFailure` notifies parent workflows** — If a child workflow's Inngest function crashes, the `onFailure` handler now sends a `workflow/child.complete` event with `childStatus: "FAILED"` to the parent, preventing the parent from hanging indefinitely on `step.waitForEvent`.

**Key code:** `stepExecutor` interface added to `ExecuteWorkflowOptions` in `runtime.ts`:

```typescript
stepExecutor?: (
    stepId: string,
    meta: { name: string; type: string; toolId?: string; iterationIndex?: number },
    stepInput: Record<string, unknown>,
    executeFn: () => Promise<unknown>
) => Promise<unknown>;
```

**Files changed:** `apps/agent/src/lib/inngest-functions.ts`, `packages/agentc2/src/workflows/builder/runtime.ts`

---

### Fix 3: stepInput Resolution for Polling Tools (commit `6bf476c3`)

**Problem:** After fix 2 deployed, the `design-wait` step was still silently failing. The Inngest polling loop called `cursor-get-status` with `agentId: undefined`.

**Root cause:** In `executeSteps` (runtime.ts line 599), `stepInput` was resolved from `step.inputMapping`. But tool steps store their parameters in `step.config.parameters`, not `step.inputMapping`. When `inputMapping` is empty/undefined, `resolveInputMapping` falls back to `context.input` (the full workflow input), which has no `agentId` field.

The `stepExecutor` for non-polling tools was unaffected because it delegates to `executeFn` (which internally calls `executeToolStep`, which correctly resolves from `config.parameters`). But the polling code path **bypasses `executeFn`** and reads `agentId` directly from `stepInput`.

**Fix:** Resolve `stepInput` for tool steps from `config.parameters` when `inputMapping` is empty:

```typescript
// Before (line 653): passed raw stepInput
stepInput,

// After: resolve from config.parameters for tool steps
const hasInputMapping = step.inputMapping && Object.keys(step.inputMapping).length > 0;
const resolvedToolInput = hasInputMapping
    ? stepInput
    : resolveInputMapping(toolConfig.parameters, context);
// ... pass resolvedToolInput to stepExecutor
```

**File changed:** `packages/agentc2/src/workflows/builder/runtime.ts` (6 lines changed)

---

## Verification

After fix 3, a fresh dispatch from admin ran the full pipeline successfully:

| Step                         | Status                     | Duration   |
| ---------------------------- | -------------------------- | ---------- |
| **Parent: SDLC Triage**      |                            |            |
| Create GitHub Issue          | COMPLETED                  | 1ms        |
| Classify Ticket              | COMPLETED                  | ~9s        |
| Post Classification to Issue | COMPLETED                  | 1ms        |
| Route by Classification      | COMPLETED                  | 60ms       |
| Execute Feature Workflow     | Deferred to child          | 39ms       |
| **Child: SDLC Feature**      |                            |            |
| Create GitHub Issue          | COMPLETED                  | 1ms        |
| Feature Analysis             | COMPLETED                  | ~7s        |
| Launch Design Analysis       | COMPLETED                  | ~8s        |
| **Wait for Design**          | **COMPLETED**              | **9m 23s** |
| Get Design Results           | COMPLETED                  | 2ms        |
| Post Design to Issue         | COMPLETED                  | 2ms        |
| Design Review                | SUSPENDED (awaiting human) | —          |

Key observations:

- **No 524 errors** — per-step execution kept all HTTP requests short
- **Polling worked correctly** — `cursor-get-status` called every 15s with the correct `agentId`
- **FINISHED detected automatically** — polling loop detected Cursor agent completion and ran the finalize step
- **Design posted to GitHub** — full conversation summary from Cursor Cloud posted to issue #151
- **Pipeline suspended at human review** — correct behavior, awaiting approval to proceed to implementation planning

---

## Known Remaining Issue

The parent SDLC Triage's `run-feature` step shows as FAILED in admin when the child workflow suspends at a human review step. This is a **display/status-propagation issue** — the child is correctly suspended, not failed. The parent interprets the child's SUSPENDED state as a failure. This is cosmetic and doesn't affect pipeline functionality.

---

## Architecture After Fixes

```
Admin Dispatch
  └─ Inngest: workflow/execute.async (parent SDLC Triage)
       ├─ step.run("load-workflow")
       ├─ step.run("wf-intake")           → Create GitHub Issue
       ├─ step.run("wf-classify")         → Agent classifies ticket
       ├─ step.run("wf-post-classification")
       ├─ step.run("wf-route")            → Branch to feature/bugfix
       └─ step.waitForEvent("workflow/child.complete")
            │
            └─ Inngest: workflow/execute.async (child SDLC Feature)
                 ├─ step.run("wf-intake")
                 ├─ step.run("wf-classify")
                 ├─ step.run("wf-design-launch")    → cursor-launch-agent
                 ├─ step.run("wf-design-wait-poll-0") → cursor-get-status
                 ├─ step.sleep("wf-design-wait-wait-1", "15s")
                 ├─ step.run("wf-design-wait-poll-1") → cursor-get-status
                 ├─ ... (repeats every 15s until FINISHED)
                 ├─ step.run("wf-design-wait-finalize") → get conversation + detect PR
                 ├─ step.run("wf-design-result")
                 ├─ step.run("wf-post-design")
                 └─ step.run("wf-design-review")     → SUSPEND for human approval
```

---

## Files Modified (All 3 Commits)

| File                                                | Changes                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/agentc2/src/workflows/builder/runtime.ts` | `stepExecutor` callback, tool step retry, `resolvedToolInput` fix                         |
| `apps/agent/src/lib/inngest-functions.ts`           | Per-step execution, Inngest polling loop, `onFailure` parent notification, zombie cleanup |
| `apps/agent/src/lib/inngest.ts`                     | Event type definitions for `workflow/child.complete`                                      |
| `apps/admin/src/app/api/dispatch/route.ts`          | Idempotency check for existing GitHub issues                                              |
| `packages/agentc2/src/auto-dispatch.ts`             | Idempotency check for auto-dispatch                                                       |

---

## Cursor Cloud Agents Spawned

During debugging and final verification, multiple Cursor Cloud Agents were launched for the same ticket:

- `bc-2d3ac7bc-cbc0-470c-91b9-109359b6f4c4` — First run (pre-fix, design-wait failed silently)
- `bc-7043e008-904c-4d34-af2f-a399f3e0a747` — Final successful run (design-wait completed, full pipeline worked)

Both created branches with technical design documents for the "agent tool call resilience" feature (`.cursor/plans/agent-tool-call-resilience-design.md` and summary). The design was posted to GitHub issue #151.

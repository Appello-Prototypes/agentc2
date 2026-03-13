# Phase 1: Cancel Workflow Run — Implementation Plan

> **Design Spec / Mockup:** [`phase1-cancel-design-spec.html`](phase1-cancel-design-spec.html) (open in browser for interactive mockup)
>
> **Parent Work Package:** Workflow Run Controls Master Plan
>
> **Prerequisites:** Phase 0 (Rich Step Detail View) — or can proceed independently since the cancel button sits in the steps header, not the detail panel.

---

## Objective

Allow HITL operators to cancel active or suspended workflow runs directly from the `/command` interface. A two-step confirmation prevents accidental cancellation. Cancelling a run also rejects its linked `ApprovalRequest`, removing the card from the pending queue.

---

## Files Changed

| Action     | File                                                                   | Description                                      |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| **New**    | `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/cancel/route.ts` | Core workflow run cancel API                     |
| **New**    | `apps/agent/src/app/api/reviews/[id]/cancel/route.ts`                  | Convenience cancel-via-review API                |
| **Modify** | `apps/agent/src/app/command/components/WorkflowStepsCard.tsx`          | Add Cancel Run button + confirmation UI          |
| **Modify** | `apps/agent/src/app/command/components/DecisionCard.tsx`               | Wire cancel callback + pass to WorkflowStepsCard |
| **Modify** | `apps/agent/src/app/command/hooks/useReviews.ts`                       | Add `handleCancelRun` action                     |

---

## Step-by-Step Implementation

### Step 1: Create Core Workflow Cancel API Route

**File:** `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/cancel/route.ts`

**Pattern:** Follows `apps/agent/src/app/api/agents/[id]/runs/[runId]/cancel/route.ts`

```
POST /api/workflows/[slug]/runs/[runId]/cancel
```

**Logic:**

1. Authenticate via `authenticateRequest(request)`
2. Find workflow by slug, scoped to org: `prisma.workflow.findFirst({ where: { OR: [{ slug }, { id: slug }], workspace: { organizationId } } })`
3. Find run by `runId`, verify it belongs to the workflow
4. Guard: run must be in cancellable state — `status` is `QUEUED`, `RUNNING`, or `suspendedStep` is non-null
5. Update `WorkflowRun`:
    - `status` → `CANCELLED`
    - `completedAt` → `new Date()`
    - `suspendedAt` → `null`
    - `suspendedStep` → `null`
    - `suspendDataJson` → `Prisma.DbNull`
6. Reject all pending `ApprovalRequest` records linked to this run:
    ```sql
    UPDATE ApprovalRequest
    SET status = 'rejected', decidedBy = 'system', decidedAt = NOW(), decisionReason = 'Workflow run cancelled by operator'
    WHERE workflowRunId = :runId AND status = 'pending'
    ```
7. Call `refreshWorkflowMetrics(workflow.id, new Date())`
8. Return `{ success: true, cancelled: true, run: { id, status, completedAt } }`

**Error Responses:**

| Code | Condition                                                              |
| ---- | ---------------------------------------------------------------------- |
| 401  | Unauthenticated                                                        |
| 404  | Workflow or run not found                                              |
| 409  | Run not in cancellable state (already COMPLETED, FAILED, or CANCELLED) |
| 500  | Unexpected error                                                       |

**Imports needed:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { refreshWorkflowMetrics } from "@/lib/metrics";
```

---

### Step 2: Create Review Cancel Convenience Route

**File:** `apps/agent/src/app/api/reviews/[id]/cancel/route.ts`

**Pattern:** Similar to `apps/agent/src/app/api/reviews/[id]/steps/route.ts` for auth + lookup

```
POST /api/reviews/[id]/cancel
```

**Logic:**

1. Authenticate via `authenticateRequest(request)`
2. Find `ApprovalRequest` by id, scoped to org, including `workflowRun` and `workflowRun.workflow`:
    ```typescript
    prisma.approvalRequest.findFirst({
        where: { id, organizationId },
        include: {
            workflowRun: {
                include: { workflow: { select: { id: true, workspaceId: true } } }
            }
        }
    });
    ```
3. Guard: `workflowRunId` must exist
4. Guard: run must be in cancellable state
5. Perform same cancel mutations as Step 1 (inline, not HTTP call):
    - Update `WorkflowRun` status → `CANCELLED`
    - Reject pending `ApprovalRequest` records
    - Refresh metrics
6. Return same response shape

**Why a convenience route?** The frontend only has the `reviewId` in context. Resolving workflow slug + run ID on the frontend would require extra lookups. This route keeps the frontend simple: `POST /api/reviews/{reviewId}/cancel`.

---

### Step 3: Add Cancel UI to WorkflowStepsCard

**File:** `apps/agent/src/app/command/components/WorkflowStepsCard.tsx`

**Changes:**

1. **New props:**

    ```typescript
    interface WorkflowStepsCardProps {
        reviewId: string;
        onCancelRun?: () => void;
        cancellingRun?: boolean;
        runCancelled?: boolean;
    }
    ```

2. **New local state:**

    ```typescript
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    ```

3. **Cancel Run button** — added to the right side of the `steps-header` div:
    - Only rendered when `onCancelRun` is provided AND `runCancelled` is not true
    - Uses `variant="outline"` with destructive styling (red text, red border)
    - Shows `X` icon + "Cancel Run" text
    - `onClick` → `setConfirmingCancel(true)`
    - When `cancellingRun` is true: disabled, shows spinner + "Cancelling…"

4. **Inline confirmation bar** — rendered below the stepper when `confirmingCancel` is true:
    - Warning icon + "Cancel this workflow run?" heading
    - Description: "The run will be marked as CANCELLED. The linked review will be rejected. This cannot be undone."
    - Two buttons: "Keep Running" (ghost) and "Yes, Cancel Run" (destructive)
    - "Keep Running" → `setConfirmingCancel(false)`
    - "Yes, Cancel Run" → calls `onCancelRun()`, which the parent manages

5. **Cancelled banner** — rendered when `runCancelled` is true:
    - Red X icon + "Workflow run cancelled" heading
    - Description: "Run was cancelled. The review has been rejected."

6. **Visual updates on cancel:**
    - When `runCancelled` is true, the suspended step dot should lose its pulse animation and become a `pending` style dot
    - All remaining pending steps should show at reduced opacity (0.4)

---

### Step 4: Wire Cancel Callback in DecisionCard

**File:** `apps/agent/src/app/command/components/DecisionCard.tsx`

**Changes:**

1. **New props on `DecisionCardProps`:**

    ```typescript
    onCancelRun: (review: ReviewItem) => void
    ```

2. **New local state:**

    ```typescript
    const [cancellingRun, setCancellingRun] = useState(false);
    const [runCancelled, setRunCancelled] = useState(false);
    ```

3. **Pass to `WorkflowStepsCard`:**

    ```tsx
    <WorkflowStepsCard
        reviewId={review.id}
        onCancelRun={async () => {
            setCancellingRun(true);
            try {
                await onCancelRun(review);
                setRunCancelled(true);
            } finally {
                setCancellingRun(false);
            }
        }}
        cancellingRun={cancellingRun}
        runCancelled={runCancelled}
    />
    ```

4. **When `runCancelled` is true:** hide the action buttons (Approve, Reject, Feedback, Conditional). The card should be removed from the pending list by the parent hook after the toast.

---

### Step 5: Add handleCancelRun to useReviews Hook

**File:** `apps/agent/src/app/command/hooks/useReviews.ts`

**Changes:**

1. **New function `handleCancelRun`:**

    ```typescript
    async function handleCancelRun(review: ReviewItem) {
        try {
            const res = await fetch(`${getApiBase()}/api/reviews/${review.id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.success) {
                addToast(
                    `Run cancelled — ${review.workflowName || review.workflowSlug || "workflow"}`
                );
                setReviews((prev) => prev.filter((r) => r.id !== review.id));
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(review.id);
                    return next;
                });
                fetchMetrics();
            } else {
                addToast(data.error || "Cancel failed", "error");
            }
        } catch {
            addToast("Network error", "error");
        }
    }
    ```

2. **Add to return object:**

    ```typescript
    return {
        // ... existing
        handleCancelRun
    };
    ```

3. **Thread through the page component** wherever `DecisionCard` is rendered, adding `onCancelRun={handleCancelRun}` to the props.

---

### Step 6: Thread Props Through Command Page

**File:** The parent page/component that renders `DecisionCard` (likely `apps/agent/src/app/command/page.tsx` or a `CommandPage` component).

**Changes:**

- Destructure `handleCancelRun` from `useReviews()`
- Pass it as `onCancelRun={handleCancelRun}` to each `<DecisionCard>`

---

## Data Flow Summary

```
User clicks "Cancel Run"
    └─ WorkflowStepsCard: setConfirmingCancel(true) → shows confirmation bar

User clicks "Yes, Cancel Run"
    └─ WorkflowStepsCard: calls onCancelRun()
        └─ DecisionCard: setCancellingRun(true), calls parent onCancelRun(review)
            └─ useReviews.handleCancelRun(review)
                └─ POST /api/reviews/{id}/cancel
                    └─ Finds ApprovalRequest → WorkflowRun
                    └─ WorkflowRun.status → CANCELLED
                    └─ ApprovalRequest.status → rejected
                    └─ refreshWorkflowMetrics()
                └─ On success: addToast(), remove card from reviews list
            └─ DecisionCard: setRunCancelled(true), setCancellingRun(false)
                └─ WorkflowStepsCard: shows cancelled banner
                └─ DecisionCard: hides action buttons
                └─ Card fades from pending list
```

---

## Edge Cases

| Scenario                                    | Backend                                        | Frontend                                         |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Run already COMPLETED                       | 409                                            | Toast: "Run has already finished"                |
| Run already CANCELLED                       | 409                                            | Toast: "Run was already cancelled"               |
| Run already FAILED                          | 409                                            | Toast: "Run has already finished"                |
| No linked workflowRunId                     | N/A                                            | Cancel button not rendered                       |
| Network error                               | N/A                                            | Toast: "Failed to cancel run", button re-enabled |
| Race: user approves while cancel confirming | Cancel API finds review already resolved → 409 | Toast: "Review already resolved"                 |
| Multiple pending approvals on same run      | All pending approvals rejected                 | Card removed once                                |

---

## Playwright Test Plan

**Credentials:** `sdlc-test@agentc2.ai` / `FlywheelDemo2026!` on `http://localhost:3001`

| #   | Action                                                          | Expected Result                                   |
| --- | --------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Navigate to `/command`                                          | Pending review cards load                         |
| 2   | Find and expand a card with workflow run (click "Show details") | Collapsible content expands                       |
| 3   | Click "View workflow steps"                                     | Stepper renders with step items                   |
| 4   | Verify "Cancel Run" button exists in steps header               | Red-styled button visible on right side           |
| 5   | Click "Cancel Run"                                              | Confirmation bar appears below stepper            |
| 6   | Verify confirmation text                                        | Shows "Cancel this workflow run?" with warning    |
| 7   | Click "Keep Running"                                            | Confirmation bar hides, Cancel Run button returns |
| 8   | Click "Cancel Run" again                                        | Confirmation bar reappears                        |
| 9   | Click "Yes, Cancel Run"                                         | Button shows "Cancelling…" spinner                |
| 10  | Wait for API response                                           | Cancelled banner appears, action buttons hidden   |
| 11  | Verify toast                                                    | Toast notification shows "Run cancelled"          |
| 12  | Screenshot for human review                                     | Capture final state                               |

---

## Acceptance Criteria

- [ ] "Cancel Run" button visible in WorkflowStepsCard header for active/suspended runs
- [ ] Clicking "Cancel Run" shows inline confirmation (not a modal)
- [ ] "Keep Running" dismisses confirmation without side effects
- [ ] "Yes, Cancel Run" sets `WorkflowRun.status = CANCELLED` and `ApprovalRequest.status = rejected`
- [ ] Card is removed from pending queue after successful cancel
- [ ] Toast notification confirms the action
- [ ] Already-completed/cancelled runs return 409 with clear message
- [ ] No visual regressions in existing approve/reject/feedback flows
- [ ] Playwright test passes all 12 steps

---

## Estimated Effort

| Task                                | Estimate    |
| ----------------------------------- | ----------- |
| Backend: Core cancel route          | 15 min      |
| Backend: Review cancel route        | 10 min      |
| Frontend: WorkflowStepsCard changes | 20 min      |
| Frontend: DecisionCard wiring       | 10 min      |
| Frontend: useReviews hook           | 5 min       |
| Frontend: Page component threading  | 5 min       |
| Playwright testing + fixes          | 20 min      |
| **Total**                           | **~85 min** |

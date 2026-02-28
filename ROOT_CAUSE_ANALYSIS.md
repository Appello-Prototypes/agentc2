# Root Cause Analysis: Human Engagement Review Flow Validation

**Bug Report:** [Test] Human engagement review flow validation  
**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/32  
**Analysis Date:** 2026-02-28  
**Severity:** Medium  
**Complexity:** Medium

---

## Executive Summary

When the SDLC workflow (`coding-pipeline`) suspends at a human review gate (plan approval or PR review), the workflow correctly suspends execution and stores the suspension state in the database. However, **it does NOT automatically post a structured review comment on the source GitHub issue** with slash commands (`/approve`, `/reject`, `/feedback`), and **it does NOT create an `ApprovalRequest` record** in the database.

This means human reviewers must manually navigate to the AgentC2 UI to approve/reject, rather than being able to respond directly on the GitHub issue where the work was initiated.

---

## Root Cause Analysis

### 1. Current Workflow Suspension Behavior

**File:** `packages/agentc2/src/workflows/builder/runtime.ts`  
**Lines:** 624-639

When a workflow encounters a `human` step type:

```typescript
case "human": {
    const config = (step.config || {}) as WorkflowHumanConfig;
    if (options.resume?.stepId === step.id) {
        output = options.resume.data;
    } else {
        status = "suspended";
        suspended = {
            stepId: step.id,
            data: {
                prompt: config.prompt || step.name || "Human approval required",
                formSchema: config.formSchema || {},
                timeout: config.timeout
            }
        };
    }
    break;
}
```

**What happens:**
- Workflow status changes to `"suspended"`
- Suspension data (prompt, formSchema) stored in `WorkflowExecutionResult.suspended`
- Execution halts until `resume()` is called

**What is MISSING:**
- No GitHub issue comment is posted
- No `ApprovalRequest` record is created
- No notification mechanism to alert the reviewer

### 2. Workflow Execution in Inngest

**File:** `apps/agent/src/lib/inngest-functions.ts`  
**Lines:** 8148-8173

The Inngest function `workflow/execute.async` detects suspension:

```typescript
if (result.status === "suspended") {
    await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
            suspendedAt: new Date(),
            suspendedStep: result.suspended?.stepId,
            suspendDataJson: result.suspended?.data
                ? (result.suspended.data as Prisma.InputJsonValue)
                : Prisma.DbNull,
            durationMs
        }
    });

    if (pipelineRunId) {
        await prisma.codingPipelineRun
            .update({
                where: { id: pipelineRunId },
                data: { status: "awaiting_plan_approval" }
            })
            .catch(() => {});
    }

    console.log(
        `[Inngest] Workflow ${workflowRunId} suspended at step: ${result.suspended?.stepId}`
    );
    return { status: "suspended", suspendedStep: result.suspended?.stepId };
}
```

**What happens:**
- `WorkflowRun.suspendedAt`, `suspendedStep`, and `suspendDataJson` are saved
- `CodingPipelineRun.status` updated to `"awaiting_plan_approval"`
- Execution stops

**What is MISSING:**
- No call to `createApprovalRequest()` from `apps/agent/src/lib/approvals.ts`
- No GitHub comment posted via `github-add-issue-comment` tool
- No linkage between the suspended workflow and any approval mechanism

### 3. GitHub Issue as Source

**File:** `apps/agent/src/app/api/coding-pipeline/dispatch/route.ts`  
**Lines:** 1-226

When a GitHub issue triggers the SDLC workflow:

```typescript
const pipelineRun = await prisma.codingPipelineRun.create({
    data: {
        sourceType: "github_issue",
        sourceId: String(issue.number),
        repository,
        baseBranch: repo.default_branch || "main",
        status: "running",
        variant: "standard",
        organizationId: null
    }
});
```

The `sourceType` and `sourceId` are stored in `CodingPipelineRun`, but this information is **never used** to post comments back to the originating GitHub issue during workflow suspension.

### 4. Existing Approval System

**File:** `apps/agent/src/lib/approvals.ts`  
**Function:** `createApprovalRequest`  
**Lines:** 145-207

The system has a fully functional approval system that:
- Creates `ApprovalRequest` records
- Supports multiple channels (Slack, Gmail)
- Links approvals to `workflowRunId`
- Creates audit logs
- Can resume workflows after approval

**Example usage:**

```typescript
const approval = await createApprovalRequest({
    organizationId: "org-123",
    workspaceId: "ws-456",
    agentId: null,
    triggerEventId: null,
    sourceType: "github_issue",
    sourceId: "32",
    integrationConnectionId: null,
    slackUserId: null,
    title: "Review implementation plan",
    summary: "The SDLC workflow needs approval for the implementation plan.",
    payload: { /* plan details */ },
    action: null,
    metadata: { workflowRunId: "run-789", stepId: "human-approve-plan" }
});
```

**This system EXISTS but is NEVER CALLED during workflow suspension.**

### 5. GitHub Comment Tool Exists

**File:** `packages/agentc2/src/tools/github-issue-comment.ts`  
**Function:** `githubAddIssueCommentTool`  
**Lines:** 13-53

A tool exists to post GitHub issue comments:

```typescript
export const githubAddIssueCommentTool = createTool({
    id: "github-add-issue-comment",
    description: "Post a comment on a GitHub issue. Supports full Markdown.",
    inputSchema: z.object({
        repository: z.string(),
        issueNumber: z.number(),
        body: z.string(),
        organizationId: z.string().optional()
    }),
    outputSchema: z.object({
        commentId: z.number(),
        commentUrl: z.string()
    }),
    execute: async ({ repository, issueNumber, body, organizationId }) => {
        // ... posts comment to GitHub
    }
});
```

**This tool EXISTS but is NEVER CALLED during workflow suspension.**

---

## Impact Assessment

### Affected Components

1. **Coding Pipeline Workflow (`coding-pipeline` and `coding-pipeline-internal`)**
   - Files: `packages/agentc2/src/workflows/coding-pipeline.ts`
   - Two human gates: `human-approve-plan` (line 181) and `human-review-pr` (line 442)

2. **Workflow Runtime**
   - File: `packages/agentc2/src/workflows/builder/runtime.ts`
   - Function: `executeSteps` (lines 624-639)

3. **Inngest Workflow Executor**
   - File: `apps/agent/src/lib/inngest-functions.ts`
   - Function: `workflow/execute.async` (lines 8148-8173)

4. **Database Schema**
   - `WorkflowRun` model: Already has `workflowRunId` field on `ApprovalRequest`
   - `ApprovalRequest` model: Has all required fields (lines 550-589 in schema.prisma)

### User Impact

- **Friction:** Users must leave GitHub and navigate to AgentC2 UI to approve/reject
- **Discoverability:** No notification that approval is needed
- **Context loss:** Reviewers can't see the request in the same place as the issue

### System Impact

- **No ApprovalRequest audit trail:** Approvals are invisible to compliance/audit systems
- **No slash command support:** Can't leverage GitHub's native commenting for approvals
- **Workflow orphaning:** Suspended workflows have no clear path to resumption for GitHub-sourced tickets

---

## Detailed Fix Plan

### Step 1: Detect Human Step Suspension in Inngest

**File:** `apps/agent/src/lib/inngest-functions.ts`  
**Location:** After line 8173 (inside `if (result.status === "suspended")` block)

**Changes:**
1. Import `createApprovalRequest` from `../approvals`
2. Import `githubAddIssueCommentTool` from `@repo/agentc2/tools`
3. Fetch the `WorkflowRun` to get `inputJson` (contains `sourceType`, `sourceId`, `repository`)
4. Check if `sourceType === "github_issue"` and `sourceId` exists
5. If yes:
   a. Create an `ApprovalRequest` record with `workflowRunId` linkage
   b. Post a GitHub comment with approval instructions

**Pseudocode:**

```typescript
if (result.status === "suspended") {
    // ... existing suspension logic ...

    // NEW: Handle human approval request
    const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: workflowRunId },
        include: { workflow: true }
    });

    const input = workflowRun?.inputJson as Record<string, unknown> | null;
    const sourceType = input?.sourceType as string | undefined;
    const sourceId = input?.sourceId as string | undefined;
    const repository = input?.repository as string | undefined;
    const organizationId = input?.organizationId as string | undefined;

    if (sourceType === "github_issue" && sourceId && repository) {
        // Create ApprovalRequest
        const approval = await createApprovalRequest({
            organizationId: organizationId || "",
            workspaceId: null,
            agentId: null,
            triggerEventId: null,
            sourceType: "github_issue",
            sourceId,
            integrationConnectionId: null,
            slackUserId: null,
            title: result.suspended?.data?.prompt as string,
            summary: `Workflow suspended at step: ${result.suspended?.stepId}`,
            payload: {
                workflowRunId,
                stepId: result.suspended?.stepId,
                suspendData: result.suspended?.data
            },
            action: null,
            metadata: {
                workflowRunId,
                suspendedStep: result.suspended?.stepId
            }
        });

        // Post GitHub comment
        const commentBody = buildGitHubReviewComment({
            stepName: result.suspended?.data?.prompt as string,
            stepId: result.suspended?.stepId,
            workflowRunId,
            approvalRequestId: approval.id,
            appUrl: process.env.NEXT_PUBLIC_APP_URL
        });

        await githubAddIssueCommentTool.execute!({
            repository,
            issueNumber: parseInt(sourceId, 10),
            body: commentBody,
            organizationId
        }, {} as any);

        // Link approval to workflow run
        await prisma.workflowRun.update({
            where: { id: workflowRunId },
            data: { approvalRequestId: approval.id }
        });
    }

    return { status: "suspended", suspendedStep: result.suspended?.stepId };
}
```

### Step 2: Create Helper Function for GitHub Comment Body

**File:** `apps/agent/src/lib/approvals.ts` (or new file `apps/agent/src/lib/workflow-approvals.ts`)  
**New Function:** `buildGitHubReviewComment`

**Implementation:**

```typescript
export function buildGitHubReviewComment(options: {
    stepName: string | undefined;
    stepId: string | undefined;
    workflowRunId: string;
    approvalRequestId: string;
    appUrl: string | undefined;
}): string {
    const stepName = options.stepName || "Human approval required";
    const appUrl = options.appUrl || "https://agentc2.ai";
    const reviewUrl = `${appUrl}/agent/workflows/runs/${options.workflowRunId}`;

    return `## 🤖 AgentC2 Workflow Approval Required

**Step:** ${stepName}  
**Workflow Run:** [View Details](${reviewUrl})

### Review Actions

To approve or reject this step, use the following slash commands:

- \`/approve\` - Approve and continue the workflow
- \`/reject [reason]\` - Reject and halt the workflow
- \`/feedback [comments]\` - Provide feedback and request changes

---

_Workflow ID: ${options.workflowRunId}_  
_Approval Request: ${options.approvalRequestId}_`;
}
```

### Step 3: Handle Slash Commands in GitHub Issue Comments

**New File:** `apps/agent/src/app/api/github/issue-comment-webhook/route.ts`

**Purpose:** Listen for GitHub issue comment webhooks and parse slash commands

**Implementation:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import crypto from "crypto";

function verifyGitHubSignature(body: string, signature: string | null, secret: string): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac("sha256", secret);
    const digest = `sha256=${hmac.update(body).digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const event = request.headers.get("x-github-event");

    // Verify signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret) {
        const signature = request.headers.get("x-hub-signature-256");
        if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
    }

    if (event !== "issue_comment") {
        return NextResponse.json({ message: "Event ignored", event });
    }

    const payload = JSON.parse(rawBody);
    const action = payload.action;

    if (action !== "created") {
        return NextResponse.json({ message: "Action ignored", action });
    }

    const comment = payload.comment;
    const issue = payload.issue;
    const repo = payload.repository;

    const commentBody = comment.body as string;
    const issueNumber = String(issue.number);
    const repository = `${repo.owner.login}/${repo.name}`;

    // Parse slash commands
    const approveMatch = commentBody.match(/^\/approve\s*$/im);
    const rejectMatch = commentBody.match(/^\/reject(?:\s+(.+))?$/im);
    const feedbackMatch = commentBody.match(/^\/feedback\s+(.+)$/im);

    if (!approveMatch && !rejectMatch && !feedbackMatch) {
        return NextResponse.json({ message: "No slash command found" });
    }

    // Find suspended workflow for this issue
    const pipelineRun = await prisma.codingPipelineRun.findFirst({
        where: {
            sourceType: "github_issue",
            sourceId: issueNumber,
            repository: { contains: repository },
            status: { in: ["awaiting_plan_approval", "awaiting_pr_review"] }
        },
        include: { workflowRun: true }
    });

    if (!pipelineRun?.workflowRun?.suspendedStep) {
        return NextResponse.json({ message: "No suspended workflow found" });
    }

    const workflowRun = pipelineRun.workflowRun;

    // Find ApprovalRequest
    const approval = await prisma.approvalRequest.findFirst({
        where: {
            sourceType: "github_issue",
            sourceId: issueNumber,
            workflowRunId: workflowRun.id,
            status: "pending"
        }
    });

    if (!approval) {
        return NextResponse.json({ message: "No pending approval found" });
    }

    // Handle command
    if (approveMatch) {
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: {
                status: "approved",
                decidedBy: comment.user.login,
                decidedAt: new Date(),
                decisionReason: "Approved via GitHub comment"
            }
        });

        // Resume workflow
        const { humanApprovalWorkflow } = await import("@repo/agentc2");
        // TODO: Import actual workflow and resume
        // await workflow.resume(workflowRun.id, { approved: true, approvedBy: comment.user.login });

        return NextResponse.json({ success: true, action: "approved" });
    }

    if (rejectMatch) {
        const reason = rejectMatch[1] || "Rejected via GitHub comment";
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: {
                status: "rejected",
                decidedBy: comment.user.login,
                decidedAt: new Date(),
                decisionReason: reason
            }
        });

        // Fail workflow
        await prisma.workflowRun.update({
            where: { id: workflowRun.id },
            data: { status: "FAILED" }
        });

        return NextResponse.json({ success: true, action: "rejected" });
    }

    if (feedbackMatch) {
        const feedback = feedbackMatch[1];
        // Store feedback in approval metadata
        const metadata = (approval.metadata as Record<string, unknown>) || {};
        metadata.feedback = feedback;
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: { metadata: metadata as Prisma.InputJsonValue }
        });

        return NextResponse.json({ success: true, action: "feedback_recorded" });
    }

    return NextResponse.json({ message: "No action taken" });
}
```

### Step 4: Add `approvalRequestId` to `WorkflowRun` Schema

**File:** `packages/database/prisma/schema.prisma`  
**Model:** `WorkflowRun`

**Change:** Add optional relation field

```prisma
model WorkflowRun {
    // ... existing fields ...
    approvalRequestId String?
    approvalRequest   ApprovalRequest? @relation(fields: [approvalRequestId], references: [id], onDelete: SetNull)
}
```

**Migration:** `bun run db:migrate -- --name add-approval-to-workflow-run`

### Step 5: Update Resume API to Check ApprovalRequest

**File:** `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/resume/route.ts`

**Change:** Before resuming, verify that:
1. An `ApprovalRequest` exists for this workflow run
2. The `ApprovalRequest.status` is `"approved"`
3. If not approved, return 403 Forbidden

### Step 6: Add Tests

**New File:** `tests/integration/workflow-github-approval.test.ts`

**Test Cases:**
1. ✅ Workflow suspends at human gate → ApprovalRequest created
2. ✅ Workflow suspends at human gate → GitHub comment posted
3. ✅ GitHub comment contains `/approve`, `/reject`, `/feedback` commands
4. ✅ `/approve` command resumes workflow
5. ✅ `/reject` command fails workflow
6. ✅ `/feedback` command stores feedback without resuming
7. ✅ ApprovalRequest links to WorkflowRun via `workflowRunId`
8. ✅ Only works when `sourceType === "github_issue"`

---

## Risk Assessment

### Complexity: **Medium**

- **New Logic:** Requires integration between workflow suspension and approval system
- **External API:** Requires GitHub comment posting (existing tool can be reused)
- **Webhook Handling:** Requires new webhook endpoint for issue comment events

### Risks: **Medium**

1. **GitHub API Rate Limits**
   - Mitigation: Use conditional requests, cache issue metadata

2. **Slash Command Parsing Ambiguity**
   - Mitigation: Use strict regex patterns, ignore comments not matching format

3. **Race Conditions**
   - Mitigation: Use database transactions, check approval status before resuming

4. **Backward Compatibility**
   - Mitigation: Only apply to `sourceType === "github_issue"`, other triggers unaffected

5. **Security**
   - Mitigation: Verify GitHub webhook signatures, validate user permissions

---

## Estimated Effort

### Implementation

- **Step 1:** Detect suspension in Inngest (2-3 hours)
- **Step 2:** Build GitHub comment body helper (1 hour)
- **Step 3:** GitHub webhook handler for slash commands (3-4 hours)
- **Step 4:** Schema migration (30 minutes)
- **Step 5:** Resume API validation (1 hour)
- **Step 6:** Integration tests (2-3 hours)

**Total:** ~10-12 hours

### Testing & QA

- Unit tests: 2 hours
- Integration tests: 3 hours
- Manual E2E testing: 2 hours

**Total:** ~7 hours

### Documentation

- Update CLAUDE.md with approval flow (1 hour)
- Update API docs (30 minutes)

**Total:** ~1.5 hours

**Grand Total:** ~18-20 hours

---

## Dependencies

1. **GitHub Webhook Configuration**
   - User must configure GitHub webhook to point to `/api/github/issue-comment-webhook`
   - Webhook must be subscribed to `issue_comment` events

2. **Environment Variables**
   - `GITHUB_WEBHOOK_SECRET` must be set
   - `NEXT_PUBLIC_APP_URL` must be set for comment links

3. **GitHub Permissions**
   - GitHub token must have `repo` scope for posting comments

---

## Alternative Approaches Considered

### Approach 1: Slack-Only Approvals (Rejected)
- **Pros:** Slack approval system already works
- **Cons:** Requires user to be in Slack, disconnected from GitHub context

### Approach 2: Email Approvals (Rejected)
- **Pros:** Universal notification method
- **Cons:** Adds latency, poor UX for code review

### Approach 3: Dedicated Approval UI in AgentC2 (Rejected)
- **Pros:** Full control over UX
- **Cons:** Forces context switching away from GitHub

### Approach 4: GitHub Checks API (Considered)
- **Pros:** Native GitHub integration, shows up in PR checks
- **Cons:** Requires OAuth app installation, more complex setup
- **Decision:** Could be added later as enhancement

---

## Recommended Next Steps

1. **Validate Approach:** Review this analysis with team
2. **Create Implementation Plan:** Break into smaller PRs if needed
3. **Set Up Test Environment:** Configure GitHub webhook to staging
4. **Implement Core Logic:** Steps 1-2 (suspension detection + comment posting)
5. **Implement Webhook Handler:** Step 3 (slash command parsing)
6. **Add Tests:** Step 6
7. **Deploy to Staging:** Test E2E flow
8. **Deploy to Production:** After validation

---

## Conclusion

The root cause is clear: **the workflow suspension logic has no integration with the GitHub comment system or the approval request system**. The fix is well-defined and uses existing tools/systems (`github-add-issue-comment`, `createApprovalRequest`). The implementation is straightforward with medium complexity and medium risk.

**Recommended Action:** Proceed with implementation following the detailed fix plan above.

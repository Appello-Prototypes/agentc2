# Root Cause Analysis: Human Engagement Review Flow Validation

**Issue:** [Test] Human engagement review flow validation  
**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/30  
**Repository:** Appello-Prototypes/agentc2  
**Analysis Date:** 2026-02-28  
**Status:** Analysis Complete - No Fix Implemented

---

## Executive Summary

When SDLC workflows suspend at human review gates, the system correctly updates the workflow state in the database but **fails to create ApprovalRequest records or post structured review comments on the originating GitHub issue**. This prevents users from approving/rejecting workflow steps via GitHub issue comments with slash commands (`/approve`, `/reject`, `/feedback`).

**Current Behavior:**
- ✅ Workflow suspends at human step
- ✅ `WorkflowRun` record updated with suspension state
- ❌ No `ApprovalRequest` record created
- ❌ No GitHub issue comment posted
- ❌ No slash command webhook handler exists

---

## Root Cause Analysis

### Primary Root Cause

**File:** `apps/agent/src/lib/inngest-functions.ts`  
**Function:** `asyncWorkflowExecuteFunction`  
**Lines:** 8148-8173

The Inngest function that executes workflows detects suspension correctly but only updates the `WorkflowRun` database record. It does **not**:

1. Create an `ApprovalRequest` record
2. Extract GitHub issue context from workflow input
3. Post a structured review comment to GitHub
4. Set up the approval mechanism

```typescript
// Current implementation (INCOMPLETE)
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

    // Missing: ApprovalRequest creation
    // Missing: GitHub issue comment posting
    // Missing: Slash command webhook setup
}
```

### Secondary Contributing Factors

#### 1. Missing GitHub Issue Context Propagation

**File:** `scripts/seed-sdlc-playbook.ts`  
**Lines:** 723-737, 948-960, 1046-1058

The `intake` step (which creates the GitHub issue) outputs `issueNumber`, `issueUrl`, and `repository`. However:
- This data is available at `steps.intake.issueNumber` and `steps.intake.issueUrl`
- The workflow runtime correctly passes this through the context
- **But**: The asyncWorkflowExecuteFunction doesn't extract or use this context when handling suspension

#### 2. No Slash Command Webhook Handler

**Missing File:** `apps/agent/src/app/api/webhooks/github-issue-comments/route.ts` (or similar)

There is no webhook handler that:
- Listens for GitHub `issue_comment` events
- Parses comment body for `/approve`, `/reject`, `/feedback` commands
- Looks up the corresponding `ApprovalRequest` by issue number
- Resumes the workflow with the approval decision

#### 3. ApprovalRequest Not Linked to GitHub Context

**File:** `packages/database/prisma/schema.prisma`  
**Lines:** 550-580

The `ApprovalRequest` model has a `workflowRunId` field but **no fields for:**
- `githubIssueNumber`
- `githubRepository`
- `githubIssueUrl`

This makes it impossible to look up an `ApprovalRequest` by GitHub issue number when processing slash commands.

---

## Code Flow Analysis

### Expected Flow (Not Implemented)

```
1. GitHub Issue labeled "bug" → Webhook fires
2. Workflow starts (sdlc-bugfix)
3. Step: intake (create GitHub issue) → outputs issueNumber, issueUrl
4. Step: analyze → outputs analysis
5. Step: fix-cycle → contains human step "fix-review"
6. ⚠️  Workflow suspends at "fix-review"
   
   Expected (Missing):
   ├─ Create ApprovalRequest record
   │  ├─ Link to workflowRunId
   │  ├─ Store issueNumber, repository
   │  └─ Store suspension context
   │
   └─ Post GitHub comment:
      ├─ "🔄 SDLC Workflow Suspended - Review Required"
      ├─ Show: plan, audit, context
      ├─ Instructions: "/approve", "/reject", "/feedback <text>"
      └─ Link to AgentC2 dashboard for detailed review

7. Human posts comment: "/approve"
8. GitHub webhook → POST /api/webhooks/github-issue-comments
9. Parse slash command → Look up ApprovalRequest → Resume workflow
10. Workflow continues from suspension point
```

### Current Flow (Incomplete)

```
1. GitHub Issue labeled "bug" → Webhook fires ✅
2. Workflow starts ✅
3. Steps execute ✅
4. Workflow suspends at human step ✅
5. WorkflowRun updated with suspension state ✅
6. ⛔ STOPS HERE - No further action taken
```

---

## Detailed File-by-File Analysis

### 1. `apps/agent/src/lib/inngest-functions.ts`

**Function:** `asyncWorkflowExecuteFunction`  
**Lines:** 8057-8204  
**Issue:** Missing post-suspension logic

**Current Implementation:**
- Line 8078-8095: Executes workflow via `executeWorkflowDefinition`
- Line 8148-8173: Detects suspension and updates database
- **Missing:** ApprovalRequest creation, GitHub commenting

**Required Changes:**
- After line 8159 (suspension detection), add logic to:
  1. Extract GitHub issue context from `input` (via `steps.intake`)
  2. Create `ApprovalRequest` record with `workflowRunId`
  3. Call `github-add-issue-comment` tool to post review comment
  4. Include slash command instructions in comment

### 2. `packages/agentc2/src/workflows/builder/runtime.ts`

**Function:** `executeSteps` (human step handler)  
**Lines:** 624-640  
**Issue:** Only returns suspension, doesn't trigger notifications

**Current Implementation:**
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

**Analysis:** This is working as designed - the runtime suspends and returns control. The issue is that the **caller** (asyncWorkflowExecuteFunction) doesn't handle the suspension properly.

### 3. `packages/database/prisma/schema.prisma`

**Model:** `ApprovalRequest`  
**Lines:** 550-580

**Current Fields:**
- ✅ `workflowRunId` - Links to workflow
- ❌ Missing: `githubRepository`
- ❌ Missing: `githubIssueNumber`
- ❌ Missing: `githubCommentId`

**Impact:** Cannot look up `ApprovalRequest` by GitHub issue number when processing slash commands.

### 4. `packages/agentc2/src/tools/github-issue-comment.ts`

**Tool:** `github-add-issue-comment`  
**Lines:** 13-53

**Current State:** Tool exists and works correctly ✅  
**Usage:** Currently not called during workflow suspension

### 5. Missing Webhook Handler

**Missing File:** Handler for GitHub `issue_comment` events

**Required Functionality:**
- Listen for `issue_comment.created` events from GitHub
- Parse comment body for slash commands
- Look up `ApprovalRequest` by `(repository, issueNumber)` tuple
- Process command and resume workflow
- Post confirmation comment

**Similar Implementation:** `apps/agent/src/app/api/slack/events/route.ts` handles Slack reactions for approvals

### 6. `apps/agent/src/lib/approvals.ts`

**Function:** `createApprovalRequest`  
**Lines:** 145-208

**Current Implementation:**
- ✅ Creates `ApprovalRequest` records
- ✅ Sends Slack approval requests
- ✅ Links to `workflowRunId`
- ❌ Not called during workflow suspension
- ❌ No GitHub integration

---

## Data Flow Gaps

### Gap 1: GitHub Issue Context Not Extracted

When workflows are triggered from GitHub issues, the issue metadata flows through:

```
GitHub Webhook Payload
  ├─ issue.number
  ├─ issue.html_url
  └─ repository.full_name
     ↓
Trigger Input Mapping (fieldMapping)
  ├─ title: "issue.title"
  ├─ description: "issue.body"
  └─ repository: "repository.full_name"
     ↓
WorkflowRun.inputJson
  ├─ title: "..."
  ├─ description: "..."
  ├─ repository: "owner/repo"
  └─ _trigger: { triggerId, triggerType, ... }
     ↓
Intake Step (ticket-to-github-issue)
  ├─ Creates issue (or uses existing)
  └─ Outputs: { issueNumber, issueUrl, repository }
     ↓
Available at: steps.intake.issueNumber, steps.intake.issueUrl
     ⚠️
     NOT EXTRACTED during suspension handling
```

### Gap 2: No Reverse Lookup Mechanism

**Problem:** When a GitHub comment arrives with `/approve`, how do we find the `ApprovalRequest`?

**Current Schema:**
```sql
SELECT * FROM approval_request WHERE workflowRunId = ?
```

**Required Schema:**
```sql
SELECT * FROM approval_request 
WHERE githubRepository = 'owner/repo' 
AND githubIssueNumber = 30
AND status = 'pending'
ORDER BY createdAt DESC
LIMIT 1
```

### Gap 3: No Notification System for Suspensions

**Current:** Workflow suspends silently in database  
**Expected:** Active notification via GitHub comment

---

## Impact Assessment

### System Components Affected

| Component | Impact Level | Description |
|-----------|-------------|-------------|
| **SDLC Workflows** | 🔴 **HIGH** | All human review steps fail silently |
| **Dark Factory Pipeline** | 🔴 **HIGH** | Manual approval gates inaccessible via GitHub |
| **ApprovalRequest System** | 🟡 **MEDIUM** | Underutilized - only works for Slack currently |
| **GitHub Integration** | 🟡 **MEDIUM** | Incomplete - no bidirectional flow |
| **UI Dashboard** | 🟢 **LOW** | Dashboard approvals work, but users expect GitHub |

### User Impact

1. **Developers:** Cannot approve/reject workflow steps from GitHub where they already work
2. **PM/Stakeholders:** Must context-switch to AgentC2 dashboard instead of using GitHub notifications
3. **Audit Trail:** GitHub issues lack visible approval history
4. **Transparency:** Silent suspension creates confusion ("Why did the workflow stop?")

### Affected Workflows

All workflows with `type: "human"` steps:

1. ✅ `human-approval` workflow (demo) - Currently uses UI dashboard only
2. ❌ `sdlc-standard` - 3 human steps (options-review, plan-review, pr-approval)
3. ❌ `sdlc-bugfix` - 2 human steps (fix-review, merge-approval)
4. ❌ `sdlc-feature` - 3 human steps (design-review, feature-plan-review, feature-pr-approval)
5. ❌ `coding-pipeline` - 2 human steps (plan approval, PR review)
6. ❌ `coding-pipeline-internal` - 2 human steps (plan approval, PR review)

**Total Impact:** 6 workflows, 15 human steps

---

## Technical Requirements for Fix

### 1. Schema Changes Required

**File:** `packages/database/prisma/schema.prisma`

Add fields to `ApprovalRequest`:

```prisma
model ApprovalRequest {
    // ... existing fields ...
    
    // GitHub integration
    githubRepository   String?  // "owner/repo"
    githubIssueNumber  Int?     // Issue number
    githubCommentId    Int?     // Comment ID where review was posted
    
    @@index([githubRepository, githubIssueNumber, status])
}
```

### 2. Workflow Suspension Handler Enhancement

**File:** `apps/agent/src/lib/inngest-functions.ts`  
**Function:** `asyncWorkflowExecuteFunction`  
**Location:** After line 8159

**Required Logic:**

```typescript
if (result.status === "suspended") {
    // 1. Update WorkflowRun (existing code)
    await prisma.workflowRun.update({ ... });

    // 2. Extract GitHub issue context from workflow input
    const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: workflowRunId },
        include: { steps: true }
    });
    
    const intakeStep = workflowRun?.steps.find(s => s.stepId === 'intake');
    const intakeOutput = intakeStep?.outputJson as Record<string, unknown>;
    const issueNumber = intakeOutput?.issueNumber as number | undefined;
    const repository = intakeOutput?.repository as string | undefined;
    
    // 3. Create ApprovalRequest record
    if (issueNumber && repository) {
        const approval = await prisma.approvalRequest.create({
            data: {
                organizationId: organizationId,
                workflowRunId: workflowRunId,
                sourceType: 'workflow_suspension',
                sourceId: workflowRunId,
                githubRepository: repository,
                githubIssueNumber: issueNumber,
                status: 'pending',
                payloadJson: {
                    suspendedStep: result.suspended?.stepId,
                    suspendData: result.suspended?.data
                }
            }
        });
        
        // 4. Post GitHub review comment
        const commentBody = buildReviewComment({
            workflowSlug: workflowSlug,
            runId: workflowRunId,
            suspendedStep: result.suspended?.stepId,
            suspendData: result.suspended?.data,
            approvalRequestId: approval.id
        });
        
        const commentResult = await githubAddIssueCommentTool.execute({
            repository,
            issueNumber,
            body: commentBody,
            organizationId
        });
        
        // 5. Update ApprovalRequest with comment ID
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: { githubCommentId: commentResult.commentId }
        });
    }
}
```

### 3. GitHub Comment Template Function

**New Function:** `buildReviewComment`  
**Location:** `apps/agent/src/lib/approvals.ts` or new file

**Purpose:** Generate structured markdown comment for GitHub

**Template Structure:**

```markdown
## 🔄 SDLC Workflow Suspended - Review Required

**Workflow:** {workflowSlug}  
**Run ID:** {runId}  
**Step:** {suspendedStep}

### Context
{suspendData.prompt}

### Review Instructions

To approve or reject this workflow step, reply with one of:
- `/approve` - Approve and continue workflow
- `/reject <reason>` - Reject and stop workflow
- `/feedback <text>` - Request revision with feedback

**Alternatively:** [Review in AgentC2 Dashboard]({dashboardUrl})

---
_🤖 Posted by AgentC2 Workflow Engine | Approval ID: {approvalRequestId}_
```

### 4. GitHub Issue Comment Webhook Handler

**New File:** `apps/agent/src/app/api/webhooks/github-issue-comments/route.ts`

**Functionality:**

```typescript
export async function POST(request: NextRequest) {
    // 1. Verify GitHub webhook signature
    // 2. Parse issue_comment event
    // 3. Extract repository, issue number, comment body
    // 4. Parse slash command (/approve, /reject, /feedback)
    // 5. Look up ApprovalRequest by (repository, issueNumber)
    // 6. Update ApprovalRequest status
    // 7. Resume workflow with approval decision
    // 8. Post confirmation comment
}
```

**Command Parsing Logic:**

```typescript
function parseSlashCommand(body: string): {
    command: 'approve' | 'reject' | 'feedback' | null;
    argument?: string;
} {
    const lines = body.trim().split('\n');
    const firstLine = lines[0].trim();
    
    if (firstLine === '/approve') {
        return { command: 'approve' };
    }
    if (firstLine.startsWith('/reject')) {
        const reason = firstLine.slice(7).trim() || 'Rejected via GitHub';
        return { command: 'reject', argument: reason };
    }
    if (firstLine.startsWith('/feedback')) {
        const feedback = firstLine.slice(9).trim();
        return { command: 'feedback', argument: feedback };
    }
    
    return { command: null };
}
```

### 5. Workflow Resume Integration

**File:** `apps/agent/src/app/api/workflows/[slug]/runs/[runId]/resume/route.ts`  
**Lines:** 1-161

**Current State:** ✅ Already supports resuming workflows  
**Integration:** GitHub webhook handler will call this endpoint

---

## Dependencies and Prerequisites

### Existing Infrastructure (Already Working)

✅ **Workflow Runtime** - Suspends correctly  
✅ **ApprovalRequest Model** - Exists in schema  
✅ **GitHub Issue Comment Tool** - `github-add-issue-comment` works  
✅ **Workflow Resume API** - `/api/workflows/[slug]/runs/[runId]/resume` works  
✅ **GitHub Token Resolution** - `resolveGitHubToken()` function exists  
✅ **Inngest Event System** - Can trigger background jobs

### Required New Components

❌ **Schema Fields** - Add GitHub fields to `ApprovalRequest`  
❌ **Comment Builder** - Generate structured review comments  
❌ **Webhook Handler** - Process GitHub issue comments  
❌ **Command Parser** - Parse `/approve`, `/reject`, `/feedback`  
❌ **Integration Logic** - Connect suspension → comment → resume

---

## Fix Plan

### Phase 1: Database Schema Enhancement

**Risk:** 🟢 **LOW** - Additive schema change, no breaking changes

**Files to Modify:**
1. `packages/database/prisma/schema.prisma`

**Changes:**
```prisma
model ApprovalRequest {
    // ... existing fields ...
    
    // GitHub integration (new)
    githubRepository   String?
    githubIssueNumber  Int?
    githubCommentId    Int?
    
    // ... existing fields ...
    
    @@index([githubRepository, githubIssueNumber, status])
    // ... existing indexes ...
}
```

**Commands:**
```bash
bun run db:generate
bun run db:push
```

**Estimated Effort:** 10 minutes  
**Complexity:** Trivial

---

### Phase 2: Comment Template Builder

**Risk:** 🟢 **LOW** - Pure function, no side effects

**Files to Create:**
1. `apps/agent/src/lib/workflow-approval-comments.ts`

**Functionality:**
```typescript
export function buildWorkflowReviewComment(options: {
    workflowSlug: string;
    workflowName: string;
    runId: string;
    suspendedStep: string;
    suspendData: Record<string, unknown>;
    approvalRequestId: string;
    dashboardUrl: string;
}): string;

export function parseSlashCommand(commentBody: string): {
    command: 'approve' | 'reject' | 'feedback' | null;
    argument?: string;
};
```

**Estimated Effort:** 30 minutes  
**Complexity:** Low  
**Tests Required:** Unit tests for template generation and parsing

---

### Phase 3: Enhance Suspension Handler

**Risk:** 🟡 **MEDIUM** - Modifies critical workflow execution path

**Files to Modify:**
1. `apps/agent/src/lib/inngest-functions.ts`

**Changes:**
- **Function:** `asyncWorkflowExecuteFunction`
- **Location:** Lines 8148-8173 (after suspension detection)

**Implementation Steps:**

1. Load workflow run with steps (to get intake output)
2. Extract `issueNumber` and `repository` from `steps.intake`
3. Validate GitHub context exists
4. Import `createApprovalRequest` from `@/lib/approvals`
5. Create `ApprovalRequest` with GitHub fields
6. Import `buildWorkflowReviewComment` helper
7. Build review comment markdown
8. Call `github-add-issue-comment` tool
9. Update `ApprovalRequest` with `githubCommentId`
10. Add error handling (log but don't fail workflow)

**Pseudo-code:**

```typescript
// After line 8159 (inside suspension block)
try {
    const fullRun = await prisma.workflowRun.findUnique({
        where: { id: workflowRunId },
        include: { 
            steps: { where: { stepId: 'intake' } },
            workflow: { select: { slug: true, name: true } }
        }
    });
    
    const intakeStep = fullRun?.steps[0];
    const intakeOutput = intakeStep?.outputJson as Record<string, unknown> | undefined;
    const issueNumber = intakeOutput?.issueNumber as number | undefined;
    const repository = intakeOutput?.repository as string | undefined;
    
    if (issueNumber && repository && input.organizationId) {
        // Create ApprovalRequest
        const approval = await createApprovalRequest({
            organizationId: input.organizationId,
            workflowRunId: workflowRunId,
            sourceType: 'workflow_suspension',
            sourceId: workflowRunId,
            githubRepository: repository,
            githubIssueNumber: issueNumber,
            title: `Review Required: ${result.suspended?.stepId}`,
            summary: result.suspended?.data?.prompt as string,
            payload: result.suspended?.data
        });
        
        // Post GitHub comment
        const commentBody = buildWorkflowReviewComment({
            workflowSlug: fullRun.workflow.slug,
            workflowName: fullRun.workflow.name,
            runId: workflowRunId,
            suspendedStep: result.suspended!.stepId,
            suspendData: result.suspended!.data,
            approvalRequestId: approval.id,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/workflows/${fullRun.workflow.slug}/runs/${workflowRunId}`
        });
        
        const { githubAddIssueCommentTool } = await import('@repo/agentc2/tools/github-issue-comment');
        const commentResult = await githubAddIssueCommentTool.execute!({
            repository,
            issueNumber,
            body: commentBody,
            organizationId: input.organizationId
        }, {} as any);
        
        // Link comment to approval
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: { githubCommentId: commentResult.commentId }
        });
        
        console.log(`[Workflow] Posted review comment on ${repository}#${issueNumber}`);
    }
} catch (error) {
    console.error('[Workflow] Failed to post GitHub review comment:', error);
    // Don't fail the suspension - workflow still suspended in DB
}
```

**Estimated Effort:** 2 hours  
**Complexity:** Medium

---

### Phase 4: GitHub Webhook Handler

**Risk:** 🟡 **MEDIUM** - New API endpoint with external integration

**Files to Create:**
1. `apps/agent/src/app/api/webhooks/github-issue-comments/route.ts`

**Implementation Steps:**

1. Create Next.js API route handler
2. Verify GitHub webhook signature (use existing `verifyGitHubSignature` pattern)
3. Parse `issue_comment.created` event payload
4. Extract: `repository.full_name`, `issue.number`, `comment.body`, `comment.user.login`
5. Parse slash command from comment body
6. Look up `ApprovalRequest`:
   ```typescript
   const approval = await prisma.approvalRequest.findFirst({
       where: {
           githubRepository: repository,
           githubIssueNumber: issueNumber,
           status: 'pending'
       },
       orderBy: { createdAt: 'desc' },
       include: { workflowRun: { include: { workflow: true } } }
   });
   ```
7. Process command:
   - `/approve` → Resume workflow with `{ approved: true, approvedBy: commentUser }`
   - `/reject <reason>` → Resume workflow with `{ approved: false, rejected: true, reason }`
   - `/feedback <text>` → Resume workflow with `{ approved: false, feedback: text }`
8. Update `ApprovalRequest` status
9. Call workflow resume API
10. Post confirmation comment: "✅ Workflow resumed. [View progress](...)"
11. Add comprehensive error handling

**Example Implementation:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(request: NextRequest) {
    // 1. Verify signature
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (secret && !verifyGitHubSignature(rawBody, signature, secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // 2. Parse payload
    const payload = JSON.parse(rawBody);
    const event = request.headers.get('x-github-event');
    
    if (event !== 'issue_comment' || payload.action !== 'created') {
        return NextResponse.json({ message: 'Event ignored' });
    }
    
    const repository = payload.repository?.full_name;
    const issueNumber = payload.issue?.number;
    const commentBody = payload.comment?.body;
    const commentUser = payload.comment?.user?.login;
    
    if (!repository || !issueNumber || !commentBody) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // 3. Parse slash command
    const command = parseSlashCommand(commentBody);
    if (!command.command) {
        return NextResponse.json({ message: 'No slash command detected' });
    }
    
    // 4. Look up ApprovalRequest
    const approval = await prisma.approvalRequest.findFirst({
        where: {
            githubRepository: repository,
            githubIssueNumber: issueNumber,
            status: 'pending'
        },
        orderBy: { createdAt: 'desc' },
        include: {
            workflowRun: {
                include: { workflow: true }
            }
        }
    });
    
    if (!approval || !approval.workflowRun) {
        return NextResponse.json(
            { error: 'No pending approval found for this issue' },
            { status: 404 }
        );
    }
    
    // 5. Build resume data
    let resumeData: Record<string, unknown> = {};
    switch (command.command) {
        case 'approve':
            resumeData = { approved: true, approvedBy: commentUser };
            break;
        case 'reject':
            resumeData = { 
                approved: false, 
                rejected: true, 
                reason: command.argument || 'Rejected via GitHub'
            };
            break;
        case 'feedback':
            resumeData = { 
                approved: false, 
                feedback: command.argument || ''
            };
            break;
    }
    
    // 6. Update ApprovalRequest
    await prisma.approvalRequest.update({
        where: { id: approval.id },
        data: {
            status: command.command === 'approve' ? 'approved' : 'rejected',
            decidedBy: commentUser,
            decidedAt: new Date(),
            decisionReason: command.argument
        }
    });
    
    // 7. Resume workflow
    const { executeWorkflowDefinition } = await import('@repo/agentc2/workflows');
    const existingSteps: Record<string, unknown> = {};
    approval.workflowRun.steps.forEach(step => {
        if (step.outputJson) {
            existingSteps[step.stepId] = step.outputJson;
        }
    });
    
    const result = await executeWorkflowDefinition({
        definition: approval.workflowRun.workflow.definitionJson,
        input: approval.workflowRun.inputJson,
        resume: {
            stepId: approval.workflowRun.suspendedStep!,
            data: resumeData
        },
        existingSteps
    });
    
    // 8. Post confirmation comment
    const { githubAddIssueCommentTool } = await import('@repo/agentc2/tools/github-issue-comment');
    await githubAddIssueCommentTool.execute({
        repository,
        issueNumber,
        body: command.command === 'approve' 
            ? '✅ **Workflow approved** and resumed. [View progress](...)'
            : '❌ **Workflow rejected**. The workflow has been stopped.',
        organizationId: approval.organizationId
    });
    
    return NextResponse.json({ success: true });
}
```

**Estimated Effort:** 4 hours  
**Complexity:** Medium

---

### Phase 5: GitHub Webhook Configuration

**Action:** Configure GitHub webhook in repository settings

**Webhook URL:** `https://agentc2.ai/agent/api/webhooks/github-issue-comments`

**Events to Subscribe:**
- ✅ `issue_comment` - Comment created

**Secret:** Use `GITHUB_WEBHOOK_SECRET` from environment

**Note:** This webhook is separate from the workflow trigger webhook. It specifically handles slash commands on existing issues.

**Estimated Effort:** 15 minutes  
**Complexity:** Trivial

---

### Phase 6: Testing & Validation

**Risk:** 🟢 **LOW** - Verification step

**Test Scenarios:**

1. **Happy Path - Plan Approval:**
   - Trigger SDLC workflow from GitHub issue
   - Wait for suspension at plan-review step
   - Verify: ApprovalRequest created
   - Verify: GitHub comment posted with slash commands
   - Post comment: `/approve`
   - Verify: Workflow resumes
   - Verify: Confirmation comment posted

2. **Rejection Flow:**
   - Trigger workflow
   - Wait for suspension
   - Post comment: `/reject This plan is too risky`
   - Verify: Workflow stops
   - Verify: ApprovalRequest marked rejected

3. **Feedback/Revision Flow:**
   - Trigger workflow
   - Wait for suspension
   - Post comment: `/feedback Please add unit tests to the plan`
   - Verify: Workflow resumes with feedback
   - Verify: dowhile loop iterates with feedback

4. **Multiple Suspensions:**
   - Trigger workflow
   - First suspension → approve → continues
   - Second suspension → approve → continues
   - Verify: Each creates separate ApprovalRequest
   - Verify: Each posts separate comment

5. **Error Cases:**
   - Slash command on non-suspended workflow
   - Invalid command format
   - Unauthorized user (future enhancement)

**Files to Create:**
- `tests/integration/workflow-github-approvals.test.ts`

**Estimated Effort:** 3 hours  
**Complexity:** Medium

---

### Phase 7: Documentation & Cleanup

**Risk:** 🟢 **LOW** - Documentation only

**Files to Update:**
1. `docs/agent-execution-triggers.md` - Add GitHub slash command docs
2. `apps/frontend/content/docs/core-concepts/workflows.mdx` - Add approval flow docs
3. `CLAUDE.md` - Document GitHub approval integration

**Estimated Effort:** 1 hour  
**Complexity:** Trivial

---

## Risk Assessment

### Implementation Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Webhook signature bypass** | 🔴 High | Mandatory signature verification, fail-closed |
| **Approval race condition** | 🟡 Medium | Use database transaction + optimistic locking |
| **Workflow resume failure** | 🟡 Medium | Comprehensive error handling, rollback ApprovalRequest |
| **Comment spam/abuse** | 🟡 Medium | Rate limiting, restrict to authorized users only |
| **Multiple simultaneous approvals** | 🟢 Low | Filter by `status: 'pending'`, update atomically |
| **Schema migration failure** | 🟢 Low | Additive fields, nullable, safe to deploy |

### Deployment Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Database migration** | 🟢 Low | Additive schema, no data loss risk |
| **Existing suspended workflows** | 🟡 Medium | Backfill script to create ApprovalRequests retroactively |
| **GitHub webhook delivery** | 🟢 Low | GitHub retries failed webhooks automatically |

---

## Complexity Estimation

### Overall Complexity: 🟡 **MEDIUM**

**Breakdown:**

| Phase | Complexity | Effort | Risk |
|-------|------------|--------|------|
| 1. Schema Enhancement | Trivial | 10 min | Low |
| 2. Comment Builder | Low | 30 min | Low |
| 3. Suspension Handler | Medium | 2 hours | Medium |
| 4. Webhook Handler | Medium | 4 hours | Medium |
| 5. GitHub Webhook Config | Trivial | 15 min | Low |
| 6. Testing | Medium | 3 hours | Low |
| 7. Documentation | Trivial | 1 hour | Low |

**Total Estimated Effort:** 11 hours (1.5 days)

---

## Alternative Approaches Considered

### Option 1: Inngest Event-Driven (Recommended)

**Approach:** Use Inngest event `workflow/suspended` to handle GitHub commenting asynchronously

**Pros:**
- ✅ Decoupled from main execution flow
- ✅ Retryable if GitHub API fails
- ✅ Can be tested independently
- ✅ No risk of blocking workflow execution

**Cons:**
- ⚠️ Slight delay between suspension and comment posting

**Implementation:**
```typescript
// In asyncWorkflowExecuteFunction, after suspension detected:
await step.sendEvent('post-github-comment', {
    name: 'workflow/suspended.notify',
    data: {
        workflowRunId,
        suspendedStep: result.suspended?.stepId,
        suspendData: result.suspended?.data
    }
});

// New Inngest function:
export const workflowSuspensionNotifierFunction = inngest.createFunction(
    { id: 'workflow-suspension-notifier', retries: 3 },
    { event: 'workflow/suspended.notify' },
    async ({ event, step }) => {
        // Extract GitHub context, create ApprovalRequest, post comment
    }
);
```

**Recommendation:** ✅ **Use this approach**

### Option 2: Inline Synchronous (Not Recommended)

**Approach:** Do everything in `asyncWorkflowExecuteFunction` directly

**Pros:**
- ✅ Simpler code structure
- ✅ Comment posted immediately

**Cons:**
- ❌ Blocks workflow suspension if GitHub API is slow/failing
- ❌ No automatic retry on failure
- ❌ Increases function complexity

**Recommendation:** ❌ Avoid this approach

### Option 3: Separate Cron Job (Not Recommended)

**Approach:** Periodic job scans for suspended workflows and posts comments

**Pros:**
- ✅ Very decoupled

**Cons:**
- ❌ Delayed notification (up to polling interval)
- ❌ Inefficient (scans all workflows repeatedly)
- ❌ Poor user experience

**Recommendation:** ❌ Avoid this approach

---

## Implementation Sequence

### Recommended Order

1. ✅ **Phase 1:** Schema changes (enables Phase 3)
2. ✅ **Phase 2:** Comment builder (pure function, testable independently)
3. ✅ **Phase 3:** Suspension handler enhancement (core functionality)
4. ⚠️ **Phase 6:** Testing (validate Phases 1-3 work end-to-end)
5. ✅ **Phase 4:** Webhook handler (enables slash commands)
6. ⚠️ **Phase 6:** Full integration testing
7. ✅ **Phase 5:** GitHub webhook config (go live)
8. ✅ **Phase 7:** Documentation

**Rationale:**
- Test early and often (Phase 6 split into two stages)
- Validate comment posting works before building webhook handler
- Manual resume testing before automating with slash commands

---

## Success Criteria

### Acceptance Criteria (from Bug Report)

- [x] ✅ Workflow suspends at human step → **Already works**
- [ ] ❌ Review comment posted on GitHub issue with slash commands → **Missing**
- [ ] ❌ ApprovalRequest record created in database → **Missing**

### Additional Success Criteria

- [ ] ApprovalRequest includes GitHub issue context
- [ ] Comment includes workflow context and instructions
- [ ] Slash commands (`/approve`, `/reject`, `/feedback`) resume workflow
- [ ] Confirmation comment posted after command processed
- [ ] Multiple suspensions in same workflow create separate ApprovalRequests
- [ ] Error handling prevents workflow corruption
- [ ] Audit trail captured in `CrmAuditLog`

---

## Open Questions

### 1. Authorization Model

**Question:** Should slash commands be restricted to:
- a) Issue assignees only?
- b) Repository collaborators only?
- c) Any authenticated GitHub user?
- d) Specific GitHub teams?

**Recommendation:** Start with (b) repository collaborators, add granular controls later

**Implementation:** Query GitHub API for repository permissions before processing command

### 2. Comment Update vs. New Comment

**Question:** When workflow resumes, should confirmation be:
- a) Edit the original review comment to add status?
- b) Post a new comment with confirmation?

**Recommendation:** (b) Post new comment - maintains clear audit trail

### 3. Stale Approval Timeout

**Question:** Should ApprovalRequests expire after X hours?

**Recommendation:** Yes, add `expiresAt` field and cron job to mark expired as `timeout`

### 4. Multiple Reviewers

**Question:** Should multiple approvals be required for high-risk changes?

**Recommendation:** Phase 2 feature - start with single approver

---

## Monitoring & Observability

### Metrics to Track

1. **Suspension Rate:** % of workflow runs that suspend
2. **Approval Latency:** Time from suspension to approval
3. **Approval Channel:** % approved via GitHub vs. Dashboard vs. Slack
4. **Command Parse Success Rate:** % of comments with valid slash commands
5. **Webhook Delivery Success:** % of GitHub webhooks processed successfully

### Log Points to Add

```typescript
console.log('[WorkflowSuspension] Posting review comment', {
    workflowRunId,
    repository,
    issueNumber,
    suspendedStep
});

console.log('[GitHubSlashCommand] Processing command', {
    repository,
    issueNumber,
    command: command.command,
    approvalRequestId: approval.id
});

console.log('[WorkflowResume] Resumed from GitHub approval', {
    workflowRunId,
    approvalRequestId: approval.id,
    decision: command.command
});
```

### Alerts to Configure

- Failed to post GitHub review comment (retry exhausted)
- Failed to parse slash command (potential spam/attack)
- Failed to resume workflow after approval
- Approval webhook signature verification failed

---

## Dependencies on Other Systems

### Required Integrations

| System | Component | Status |
|--------|-----------|--------|
| **GitHub API** | Issue comments API | ✅ Available |
| **GitHub Webhooks** | `issue_comment` events | ✅ Available |
| **Inngest** | Event processing | ✅ Available |
| **Prisma** | Database ORM | ✅ Available |
| **Workflow Runtime** | Suspend/resume | ✅ Available |

### Environment Variables Required

| Variable | Usage | Status |
|----------|-------|--------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Post comments | ✅ Already configured |
| `GITHUB_WEBHOOK_SECRET` | Verify webhooks | ⚠️ May need to be set |
| `NEXT_PUBLIC_APP_URL` | Dashboard links in comments | ✅ Already configured |

---

## Related Issues & Technical Debt

### Similar Patterns in Codebase

1. **Slack Approval Integration** (`apps/agent/src/lib/approvals.ts`)
   - ✅ Successfully posts Slack DM with approval request
   - ✅ Handles Slack reactions (👍 = approve, ❌ = reject)
   - ✅ Creates `ApprovalRequest` records
   - 💡 Can reuse this pattern for GitHub

2. **Gmail Approval Integration** (`apps/agent/src/lib/approvals.ts`)
   - ✅ Sends email with approval request
   - ⚠️ Reply-based approval not yet implemented
   - 💡 Similar challenge: bidirectional integration

### Future Enhancements

1. **Rich Comment Formatting:**
   - Include diff preview in comment
   - Add visual trust score indicators
   - Include scenario test results

2. **GitHub PR Comments:**
   - Post approval requests on PRs, not just issues
   - Integrate with PR review API

3. **Multi-Approver Workflows:**
   - Require N approvals before resuming
   - Role-based approval (architect, security, QA)

4. **Approval Analytics Dashboard:**
   - Average approval latency by workflow
   - Approval/rejection rates by step
   - Most common rejection reasons

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/workflow-approval-github.test.ts`

```typescript
describe('buildWorkflowReviewComment', () => {
    it('should generate valid markdown with slash commands');
    it('should include workflow context');
    it('should include dashboard link');
});

describe('parseSlashCommand', () => {
    it('should parse /approve');
    it('should parse /reject with reason');
    it('should parse /feedback with text');
    it('should return null for non-commands');
    it('should handle multiline comments');
});
```

### Integration Tests

**File:** `tests/integration/workflow-github-approvals.test.ts`

```typescript
describe('Workflow GitHub Approval Integration', () => {
    it('should create ApprovalRequest when workflow suspends');
    it('should post GitHub comment with slash commands');
    it('should resume workflow on /approve');
    it('should stop workflow on /reject');
    it('should iterate dowhile on /feedback');
    it('should handle multiple suspensions in one workflow');
    it('should reject slash commands on resolved approvals');
});
```

### E2E Test Plan

1. Deploy to staging environment
2. Create test GitHub issue
3. Trigger SDLC workflow
4. Wait for plan-approval suspension
5. Verify GitHub comment appears
6. Post `/approve` comment
7. Wait for PR-approval suspension
8. Post `/approve` comment
9. Verify workflow completes
10. Check audit logs

---

## Rollout Plan

### Stage 1: Schema Migration (Zero Downtime)

```bash
# 1. Add nullable fields to ApprovalRequest
bun run db:generate
bun run db:push  # or db:migrate for production

# 2. Verify migration
bun run db:studio
# Check: ApprovalRequest table has new columns
```

### Stage 2: Deploy Comment Posting (Safe)

- Deploy code with suspension handler enhancement
- Monitor logs for successful comment posting
- **Fallback:** If comment posting fails, workflow still suspends correctly

### Stage 3: Deploy Webhook Handler (Incremental)

- Deploy GitHub webhook handler route
- **Don't configure webhook yet** - no traffic
- Test manually with curl

### Stage 4: Configure GitHub Webhook (Go Live)

- Add webhook in GitHub repository settings
- Monitor Inngest dashboard for incoming events
- Test with real issue

### Stage 5: Rollback Plan

If issues occur:
1. Disable GitHub webhook in repository settings
2. Existing suspended workflows still accessible via dashboard
3. Revert code changes if critical bug found

---

## Cost & Performance Impact

### API Call Volume

**Per Workflow Suspension:**
- +1 GitHub API call (post comment) - ~50ms
- +1 Prisma write (ApprovalRequest) - ~10ms
- +0 additional compute (reuses existing infrastructure)

**Per Slash Command:**
- +2 GitHub API calls (verify signature, post confirmation) - ~100ms
- +2 Prisma queries (lookup ApprovalRequest, update) - ~20ms
- +1 Workflow resume (existing functionality)

**Total Added Cost per Workflow with 2 Human Steps:**
- ~4 GitHub API calls
- ~4 Prisma operations
- ~$0.0001 in additional compute (negligible)

### GitHub API Rate Limits

- **Authenticated rate limit:** 5,000 requests/hour
- **Expected usage:** ~10 requests/workflow run
- **Capacity:** 500 workflows/hour (far above expected volume)

**Conclusion:** No performance or cost concerns

---

## Security Considerations

### Threat Model

1. **Threat:** Malicious actor posts `/approve` to bypass review
   - **Mitigation:** Verify GitHub webhook signature (required)
   - **Enhancement:** Check commenter has write access to repository

2. **Threat:** Comment spam triggers DoS via webhook flood
   - **Mitigation:** Rate limiting on webhook endpoint
   - **Enhancement:** GitHub webhook secret validation

3. **Threat:** Injection attack via slash command argument
   - **Mitigation:** Sanitize all user input, no eval()
   - **Enhancement:** Strict regex validation on command parsing

4. **Threat:** ApprovalRequest lookup collision (wrong workflow resumed)
   - **Mitigation:** Compound index on (repository, issueNumber, status)
   - **Enhancement:** Add workflow slug validation

### Required Security Controls

- ✅ GitHub webhook signature verification (HMAC-SHA256)
- ✅ Rate limiting on webhook endpoint
- ✅ Input sanitization on command arguments
- ✅ Database transaction for approval state changes
- ⚠️ Repository permission check (future enhancement)

---

## Backward Compatibility

### Breaking Changes

**None.** This is an additive feature.

### Existing Workflows

- ✅ Workflows without intake step (no GitHub issue) → No comment posted (graceful fallback)
- ✅ Existing suspended workflows → Can be backfilled with ApprovalRequests
- ✅ Dashboard-based approvals → Continue to work as before
- ✅ Slack-based approvals → Continue to work as before

### Migration Path

**No migration required.** New fields are nullable, existing records remain valid.

**Optional Backfill Script:**

```typescript
// scripts/backfill-approval-requests.ts
// For existing suspended WorkflowRuns without ApprovalRequests

const suspendedRuns = await prisma.workflowRun.findMany({
    where: {
        suspendedAt: { not: null },
        approvalRequests: { none: {} }
    },
    include: { steps: true }
});

for (const run of suspendedRuns) {
    const intakeStep = run.steps.find(s => s.stepId === 'intake');
    const intakeOutput = intakeStep?.outputJson as Record<string, unknown>;
    
    if (intakeOutput?.issueNumber && intakeOutput?.repository) {
        await prisma.approvalRequest.create({
            data: {
                organizationId: run.organizationId,
                workflowRunId: run.id,
                sourceType: 'workflow_suspension',
                sourceId: run.id,
                githubRepository: intakeOutput.repository as string,
                githubIssueNumber: intakeOutput.issueNumber as number,
                status: 'pending',
                requestedAt: run.suspendedAt
            }
        });
    }
}
```

---

## Files Requiring Changes

### New Files (4)

1. `apps/agent/src/lib/workflow-approval-comments.ts` - Comment templates and parsing
2. `apps/agent/src/app/api/webhooks/github-issue-comments/route.ts` - Slash command handler
3. `tests/unit/workflow-approval-github.test.ts` - Unit tests
4. `tests/integration/workflow-github-approvals.test.ts` - Integration tests

### Modified Files (2)

1. `packages/database/prisma/schema.prisma` - Add GitHub fields to ApprovalRequest
2. `apps/agent/src/lib/inngest-functions.ts` - Enhance suspension handler

### Documentation Files (3)

1. `docs/agent-execution-triggers.md`
2. `apps/frontend/content/docs/core-concepts/workflows.mdx`
3. `CLAUDE.md`

**Total:** 9 files (4 new, 2 modified, 3 documentation)

---

## Validation Checklist

Before marking this bug as fixed, verify:

- [ ] Schema migration applied successfully
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] Unit tests pass (comment builder, command parser)
- [ ] Integration tests pass (suspension → comment → resume)
- [ ] Manual E2E test on staging:
  - [ ] GitHub issue created
  - [ ] Workflow triggered
  - [ ] Suspension detected
  - [ ] GitHub comment posted
  - [ ] ApprovalRequest created
  - [ ] `/approve` command processed
  - [ ] Workflow resumed
  - [ ] Confirmation comment posted
- [ ] Production deployment successful
- [ ] GitHub webhook configured and delivering
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

## Conclusion

**Root Cause:** The system correctly suspends workflows at human steps but lacks the integration layer to notify users via GitHub and accept slash command approvals.

**Complexity:** Medium (11 hours estimated effort)

**Risk:** Low-Medium (well-isolated changes, comprehensive testing possible)

**Recommendation:** Implement using **Inngest event-driven approach** for reliability and maintainability.

**Next Steps:**
1. Review this analysis with team
2. Prioritize implementation phases
3. Allocate development time
4. Begin with Phase 1 (schema changes)

---

**Analysis completed by:** Cloud Agent (Cursor AI)  
**Review Status:** Awaiting human approval  
**Implementation Status:** Not started

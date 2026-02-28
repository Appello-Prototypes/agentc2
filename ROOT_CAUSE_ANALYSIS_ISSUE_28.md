# Root Cause Analysis: Human Engagement Review Flow Validation

**Issue:** [Test] Human engagement review flow validation  
**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/28  
**Repository:** Appello-Prototypes/agentc2  
**Analysis Date:** 2026-02-28  
**Status:** Planning Phase - Implementation NOT started

---

## Executive Summary

The SDLC (Software Development Life Cycle) workflow currently suspends execution when reaching a human review gate, but it **does not automatically post a structured review comment on the GitHub issue** and **does not create an ApprovalRequest record** linked to the workflow run. This creates a broken user experience where human reviewers have no notification or interface to approve/reject the suspended workflow.

**Root Cause:** Missing integration logic between workflow suspension and GitHub issue engagement. The workflow runtime suspends correctly, but there is no post-suspension hook that triggers GitHub comment posting and ApprovalRequest creation.

**Impact:** High - Human review gates in the SDLC workflow are non-functional for GitHub-driven workflows.

---

## System Architecture Context

### Workflow Execution Flow

1. **Workflow Definition** (`packages/agentc2/src/workflows/coding-pipeline.ts`)
   - Defines SDLC workflow with human approval steps:
     - `plan-approval-gate` (line 152-211): Reviews implementation plan
     - `pr-review-gate` (line 413-460): Reviews pull request
   - Both gates use "branch" step type with conditional auto-approval or human review

2. **Workflow Runtime** (`packages/agentc2/src/workflows/builder/runtime.ts`)
   - Executes workflow steps sequentially
   - When encountering `type: "human"` step (lines 624-640):
     - Returns `status: "suspended"`
     - Creates `suspended` object with stepId and prompt data
     - Does NOT trigger any external notifications or database records

3. **Workflow Execution API** (`apps/agent/src/app/api/workflows/[slug]/execute/route.ts`)
   - Receives suspended status (line 98)
   - Updates WorkflowRun record with suspension metadata (lines 99-109)
   - Returns `status: "suspended"` response
   - **Does NOT post GitHub comment or create ApprovalRequest**

4. **Inngest Async Execution** (`apps/agent/src/lib/inngest-functions.ts`)
   - Handles `workflow/execute.async` event (lines 8148-8173)
   - On suspension: Updates WorkflowRun and CodingPipelineRun status
   - Logs suspension to console
   - **Does NOT post GitHub comment or create ApprovalRequest**

### Existing Approval Infrastructure

1. **ApprovalRequest Model** (`packages/database/prisma/schema.prisma`, lines 550-582)
   - Has `workflowRunId` field for linking to workflow runs
   - Supports Slack integration via `slackChannelId` and `slackMessageTs`
   - **No GitHub-specific fields** (no issueNumber, commentId, etc.)

2. **Approval Creation Logic** (`apps/agent/src/lib/approvals.ts`)
   - `createApprovalRequest` function (lines 145-208)
   - Sends Slack DMs with emoji reactions for approval
   - Stores action metadata for post-approval execution
   - **Does NOT integrate with GitHub issues**

3. **Approval Handling** (`apps/agent/src/lib/approvals.ts`, lines 210-297)
   - `handleSlackApprovalReaction`: Processes Slack emoji reactions
   - Resumes workflow via `humanApprovalWorkflow.resume()` (lines 273-293)
   - **No equivalent GitHub slash command handler**

### GitHub Integration

1. **GitHub Issue Comment Tool** (`packages/agentc2/src/tools/github-issue-comment.ts`)
   - `githubAddIssueCommentTool` (lines 13-53)
   - Posts Markdown comments to GitHub issues
   - Returns `commentId` and `commentUrl`
   - **Exists but is not called during workflow suspension**

2. **GitHub Webhook Handler** (`apps/agent/src/app/api/coding-pipeline/github-webhook/route.ts`)
   - Receives GitHub issue webhook events
   - Creates WorkflowRun and triggers SDLC pipeline
   - Stores issue metadata in WorkflowRun.inputJson
   - **No slash command processing logic**

---

## Root Cause Analysis

### Missing Components

#### 1. Post-Suspension Hook
**Location:** `apps/agent/src/lib/inngest-functions.ts`, lines 8148-8173

**Current Code:**
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

**Problem:** After updating the database, the code logs and returns. There is **no logic to**:
- Extract GitHub issue metadata from WorkflowRun.inputJson
- Post a review comment on the GitHub issue
- Create an ApprovalRequest record linked to the WorkflowRun

#### 2. GitHub Slash Command Webhook Handler
**Location:** Missing entirely

**Problem:** There is no API endpoint to receive GitHub issue comment webhooks and process slash commands like `/approve`, `/reject`, `/feedback`. The GitHub webhook handler (`/api/coding-pipeline/github-webhook/route.ts`) only processes `issues.labeled` events.

**Required Functionality:**
- Receive `issue_comment.created` webhook event
- Parse comment body for slash commands
- Validate comment is on a tracked issue with suspended workflow
- Extract ApprovalRequest ID from comment metadata
- Update ApprovalRequest status
- Resume workflow with approval/rejection data

#### 3. ApprovalRequest Schema Extensions
**Location:** `packages/database/prisma/schema.prisma`, lines 550-582

**Current Schema:**
```prisma
model ApprovalRequest {
    // ... existing fields ...
    slackChannelId String?
    slackMessageTs String?
    metadata       Json?
    // ...
}
```

**Problem:** Schema is Slack-centric. To support GitHub slash commands, need:
- `githubIssueNumber: Int?`
- `githubCommentId: BigInt?`
- `githubRepository: String?`

Alternatively, these could be stored in the `metadata` JSON field, but explicit fields provide better query performance and type safety.

#### 4. Structured Review Comment Template
**Location:** Missing entirely

**Problem:** No predefined Markdown template for the review comment that includes:
- Workflow context (step name, risk level, plan details)
- Slash command instructions
- Approval request ID for tracking
- Link to AgentC2 UI for detailed review

---

## Impact Assessment

### Affected Components

1. **SDLC Coding Pipeline Workflow**
   - Human approval gates are non-functional for GitHub-triggered workflows
   - Auto-approval path works (risk-based branching)
   - Human approval path suspends but provides no engagement interface

2. **WorkflowRun and ApprovalRequest Tables**
   - WorkflowRuns correctly suspend and store state
   - ApprovalRequest records are NOT created during SDLC suspensions
   - No audit trail linking workflow suspensions to approval decisions

3. **GitHub Issue Workflow**
   - Issues labeled with `agentc2-autofix` trigger the pipeline
   - Pipeline suspends at plan approval, but issue author receives no notification
   - No feedback mechanism to approve/reject/iterate

4. **User Experience**
   - Human reviewers have no awareness that workflow is waiting
   - No actionable interface to provide approval decision
   - Workflows remain suspended indefinitely until manually resumed via API

### Data Flow Gap

**Current Flow:**
```
GitHub Issue Labeled
  ↓
Webhook Triggers SDLC Workflow
  ↓
Workflow Executes → Plan Created
  ↓
Plan Approval Gate (human step)
  ↓
Workflow Suspends
  ↓
[END - No notification, no approval interface]
```

**Expected Flow:**
```
GitHub Issue Labeled
  ↓
Webhook Triggers SDLC Workflow
  ↓
Workflow Executes → Plan Created
  ↓
Plan Approval Gate (human step)
  ↓
Workflow Suspends
  ↓
Post Suspension Hook
  ├─ Create ApprovalRequest record
  └─ Post GitHub comment with /approve /reject /feedback commands
  ↓
Human reviews comment and replies with slash command
  ↓
GitHub webhook receives issue_comment event
  ↓
Slash command handler processes decision
  ├─ Update ApprovalRequest status
  └─ Resume workflow with approval data
  ↓
Workflow continues to completion
```

---

## Detailed Fix Plan

### Phase 1: Database Schema Extension

**File:** `packages/database/prisma/schema.prisma`

**Changes:**
1. Add GitHub-specific fields to `ApprovalRequest` model:
```prisma
model ApprovalRequest {
    // ... existing fields ...
    
    // GitHub integration fields
    githubIssueNumber Int?
    githubCommentId   BigInt?
    githubRepository  String?
    
    // ... existing indexes ...
    @@index([githubRepository, githubIssueNumber])
}
```

2. Run migrations:
```bash
bun run db:generate
bun run db:push  # or db:migrate for production
```

**Risk:** Low - Additive schema change, no breaking changes to existing code

**Estimated Complexity:** Trivial (15 minutes)

---

### Phase 2: Post-Suspension Hook Implementation

**File:** `apps/agent/src/lib/inngest-functions.ts`

**Location:** Lines 8148-8173 (inside `workflow/execute.async` function)

**Changes:**

1. Extract GitHub issue metadata from WorkflowRun input:
```typescript
if (result.status === "suspended") {
    // Existing suspension update logic...
    
    // NEW: GitHub engagement flow
    const input = workflowInput as Record<string, unknown> | undefined;
    const sourceType = input?.sourceType;
    const repository = input?.repository as string | undefined;
    const issueNumber = 
        typeof input?.sourceId === "string" 
            ? parseInt(input.sourceId, 10) 
            : undefined;
    
    if (sourceType === "github_issue" && repository && issueNumber) {
        await step.run("post-github-review-comment", async () => {
            // Implementation in next step
        });
        
        await step.run("create-approval-request", async () => {
            // Implementation in next step
        });
    }
    
    return { status: "suspended", suspendedStep: result.suspended?.stepId };
}
```

2. Implement GitHub comment posting:
```typescript
await step.run("post-github-review-comment", async () => {
    const { githubAddIssueCommentTool } = await import(
        "@repo/agentc2/tools/github-issue-comment"
    );
    
    // Build review comment body
    const stepData = result.suspended?.data || {};
    const prompt = stepData.prompt || "Human approval required";
    const formSchema = stepData.formSchema || {};
    
    const commentBody = buildReviewComment({
        workflowRunId,
        stepId: result.suspended?.stepId,
        prompt,
        formSchema,
        context: input
    });
    
    const commentResult = await githubAddIssueCommentTool.execute!({
        repository,
        issueNumber,
        body: commentBody,
        organizationId: input?.organizationId as string | undefined
    });
    
    return {
        commentId: commentResult.commentId,
        commentUrl: commentResult.commentUrl
    };
});
```

3. Implement ApprovalRequest creation:
```typescript
await step.run("create-approval-request", async () => {
    const { createApprovalRequest } = await import("@/lib/approvals");
    const commentResult = /* result from previous step */;
    
    const approval = await createApprovalRequest({
        organizationId: input?.organizationId as string,
        workspaceId: workflowRecord.workspaceId,
        workflowRunId,
        sourceType: "github_issue",
        sourceId: String(issueNumber),
        title: `Review: ${result.suspended?.data?.prompt}`,
        summary: `Workflow suspended at step: ${result.suspended?.stepId}`,
        payload: {
            workflowRunId,
            stepId: result.suspended?.stepId,
            suspendData: result.suspended?.data
        },
        metadata: {
            githubRepository: repository,
            githubIssueNumber: issueNumber,
            githubCommentId: commentResult.commentId,
            githubCommentUrl: commentResult.commentUrl
        }
    });
    
    return { approvalRequestId: approval.id };
});
```

4. Create helper function `buildReviewComment`:
```typescript
function buildReviewComment(options: {
    workflowRunId: string;
    stepId: string | undefined;
    prompt: string;
    formSchema: Record<string, unknown>;
    context: Record<string, unknown>;
}): string {
    const { workflowRunId, stepId, prompt, formSchema, context } = options;
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
    const reviewUrl = `${appUrl}/agent/workflows/${context.workflowSlug}/runs/${workflowRunId}`;
    
    return `
## 🤖 Workflow Review Required

${prompt}

### Approval Commands

Reply to this comment with one of the following slash commands:

- \`/approve\` - Approve and continue the workflow
- \`/reject [reason]\` - Reject and halt the workflow
- \`/feedback [text]\` - Provide feedback and request revision

### Context

- **Workflow Run:** [\`${workflowRunId.slice(0, 8)}\`](${reviewUrl})
- **Step:** ${stepId || "Unknown"}
- **Risk Level:** ${context.riskLevel || "Unknown"}

### Form Schema

${Object.keys(formSchema).length > 0 
    ? Object.entries(formSchema)
        .map(([key, schema]) => `- **${key}**: ${(schema as any).description || key}`)
        .join("\n")
    : "No additional fields required"}

---
*This comment was posted automatically by AgentC2.*
`.trim();
}
```

**Risk:** Medium - Complex integration across multiple systems (workflow, database, GitHub API)

**Estimated Complexity:** Medium (4-6 hours)

---

### Phase 3: GitHub Slash Command Webhook Handler

**File:** `apps/agent/src/app/api/webhooks/github-slash-commands/route.ts` (new file)

**Changes:**

1. Create webhook endpoint:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import crypto from "crypto";

function verifyGitHubSignature(
    body: string, 
    signature: string | null, 
    secret: string
): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac("sha256", secret);
    const digest = `sha256=${hmac.update(body).digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const event = request.headers.get("x-github-event");
    
    // Verify webhook signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret) {
        const signature = request.headers.get("x-hub-signature-256");
        if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
    }
    
    // Only process issue comments
    if (event !== "issue_comment") {
        return NextResponse.json({ message: "Event ignored" });
    }
    
    const payload = JSON.parse(rawBody);
    const action = payload.action;
    
    // Only process created comments
    if (action !== "created") {
        return NextResponse.json({ message: "Action ignored" });
    }
    
    const comment = payload.comment;
    const issue = payload.issue;
    const repo = payload.repository;
    
    // Parse slash command
    const body = comment.body.trim();
    const slashCommandMatch = body.match(/^\/(approve|reject|feedback)(\s+(.+))?$/i);
    
    if (!slashCommandMatch) {
        return NextResponse.json({ message: "No slash command found" });
    }
    
    const command = slashCommandMatch[1].toLowerCase();
    const argument = slashCommandMatch[3]?.trim() || "";
    
    // Find ApprovalRequest linked to this issue
    const repository = repo.html_url || `https://github.com/${repo.full_name}`;
    const approvalRequest = await prisma.approvalRequest.findFirst({
        where: {
            sourceType: "github_issue",
            sourceId: String(issue.number),
            status: "pending",
            metadata: {
                path: ["githubRepository"],
                equals: repository
            }
        },
        include: {
            workflowRun: true
        }
    });
    
    if (!approvalRequest) {
        return NextResponse.json({ 
            message: "No pending approval request found for this issue" 
        });
    }
    
    // Process command
    const status = command === "approve" ? "approved" : "rejected";
    const decisionReason = 
        command === "approve" 
            ? "Approved via GitHub slash command" 
            : `Rejected: ${argument || "No reason provided"}`;
    
    await prisma.approvalRequest.update({
        where: { id: approvalRequest.id },
        data: {
            status,
            decidedBy: comment.user.login,
            decidedAt: new Date(),
            decisionReason
        }
    });
    
    // Resume workflow
    if (approvalRequest.workflowRunId) {
        const { executeWorkflowDefinition } = await import(
            "@repo/agentc2/workflows"
        );
        
        // Resume with approval data
        const resumeData = {
            approved: status === "approved",
            approvedBy: comment.user.login,
            rejectionReason: status === "rejected" ? decisionReason : undefined,
            feedback: command === "feedback" ? argument : undefined
        };
        
        // Implementation continues...
    }
    
    return NextResponse.json({ 
        success: true, 
        command, 
        status,
        approvalRequestId: approvalRequest.id
    });
}
```

2. Add workflow resume logic:
```typescript
// Inside the slash command handler, after updating ApprovalRequest
const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: approvalRequest.workflowRunId! },
    include: { workflow: true }
});

if (!workflowRun) {
    return NextResponse.json({ error: "Workflow run not found" }, { status: 404 });
}

// Trigger workflow resume via Inngest
await inngest.send({
    name: "workflow/resume",
    data: {
        workflowRunId: workflowRun.id,
        stepId: workflowRun.suspendedStep!,
        resumeData
    }
});
```

3. Create Inngest function for workflow resume (if not exists):
```typescript
// In apps/agent/src/lib/inngest-functions.ts
export const workflowResumeFunction = inngest.createFunction(
    { id: "workflow-resume", retries: 2 },
    { event: "workflow/resume" },
    async ({ event, step }) => {
        const { workflowRunId, stepId, resumeData } = event.data;
        
        const workflowRun = await step.run("load-workflow-run", async () => {
            return prisma.workflowRun.findUnique({
                where: { id: workflowRunId },
                include: { workflow: true }
            });
        });
        
        if (!workflowRun) {
            throw new Error(`WorkflowRun ${workflowRunId} not found`);
        }
        
        const result = await step.run("execute-workflow-resume", async () => {
            return executeWorkflowDefinition({
                definition: workflowRun.workflow.definitionJson as unknown as WorkflowDefinition,
                input: workflowRun.inputJson,
                resume: {
                    stepId,
                    data: resumeData
                },
                existingSteps: /* reconstruct from WorkflowRunStep records */
            });
        });
        
        // Update WorkflowRun with final result
        await step.run("update-workflow-run", async () => {
            await prisma.workflowRun.update({
                where: { id: workflowRunId },
                data: {
                    status: result.status === "success" ? "COMPLETED" : "FAILED",
                    outputJson: result.output as Prisma.InputJsonValue,
                    completedAt: new Date()
                }
            });
        });
        
        return { status: result.status };
    }
);
```

**Risk:** High - New webhook endpoint, complex state management for resume logic

**Estimated Complexity:** High (8-10 hours)

---

### Phase 4: GitHub Webhook Configuration

**Documentation Update:** `docs/DEPLOY.md` or `docs/GITHUB-INTEGRATION.md`

**Changes:**

1. Document webhook setup steps:
```markdown
### GitHub Webhook Configuration

To enable slash command approvals for SDLC workflows:

1. Go to your GitHub repository → Settings → Webhooks
2. Add a new webhook:
   - **Payload URL:** `https://your-domain.com/agent/api/webhooks/github-slash-commands`
   - **Content type:** `application/json`
   - **Secret:** Set `GITHUB_WEBHOOK_SECRET` in your `.env`
   - **Events:** Select "Issue comments"
3. Save the webhook

Test by:
1. Creating a GitHub issue
2. Adding the `agentc2-autofix` label
3. Waiting for the workflow to suspend
4. Replying to the bot comment with `/approve`
```

2. Add environment variable to `.env.example`:
```bash
# GitHub Webhook Secret for slash command approvals
GITHUB_WEBHOOK_SECRET="your_webhook_secret_here"
```

**Risk:** Low - Documentation only

**Estimated Complexity:** Trivial (30 minutes)

---

### Phase 5: Testing & Validation

**Test Cases:**

1. **End-to-End Flow Test**
   - Create test GitHub issue
   - Label with `agentc2-autofix`
   - Verify workflow suspends at plan approval gate
   - Verify GitHub comment is posted with slash commands
   - Verify ApprovalRequest record is created
   - Reply with `/approve`
   - Verify workflow resumes and completes

2. **Slash Command Parsing Test**
   - Test `/approve` with no arguments
   - Test `/reject` with reason
   - Test `/reject` without reason
   - Test `/feedback` with feedback text
   - Test invalid slash commands (should be ignored)

3. **Edge Cases**
   - Multiple approval requests on same issue
   - Comment from non-authorized user
   - Webhook signature verification failure
   - ApprovalRequest already decided
   - Workflow run already completed

4. **Database Integrity Test**
   - Verify ApprovalRequest links to WorkflowRun
   - Verify GitHub metadata is stored correctly
   - Verify audit trail in CrmAuditLog

**Test Files to Create:**
- `tests/integration/github-slash-commands.test.ts`
- `tests/unit/approval-github-integration.test.ts`

**Risk:** Medium - Complex integration testing across multiple systems

**Estimated Complexity:** Medium (4-6 hours)

---

### Phase 6: Migration & Rollout

**Migration Steps:**

1. Deploy schema changes:
```bash
bun run db:generate
bun run db:push  # staging
bun run db:migrate  # production
```

2. Deploy code changes:
```bash
bun run build
bun run lint
bun run type-check
git add -A
git commit -m "feat: add GitHub slash command approvals for workflow suspensions"
git push origin main
```

3. Configure GitHub webhooks (per repository)

4. Monitor logs for webhook events and approval flows

**Rollback Plan:**
- Schema changes are additive, safe to leave in place
- Code changes can be reverted via git
- Disable webhook if issues arise

**Risk:** Low - Additive feature, no breaking changes

**Estimated Complexity:** Low (1-2 hours)

---

## Risk Assessment

### Overall Risk: MEDIUM

**Risk Factors:**

| Factor | Risk Level | Mitigation |
|--------|------------|------------|
| Schema changes | Low | Additive only, no breaking changes |
| Post-suspension hook | Medium | Thorough error handling, idempotent operations |
| Webhook handler | High | Signature verification, rate limiting, error logging |
| Workflow resume logic | High | State reconstruction, transaction safety |
| Multi-system integration | High | Comprehensive integration tests, staged rollout |

**Mitigation Strategies:**

1. **Idempotency:** Ensure post-suspension hook can be safely retried if Inngest retries
2. **Error Handling:** Wrap GitHub API calls in try-catch, log errors, continue workflow suspension on failure
3. **Monitoring:** Add structured logging for all GitHub webhook events and approval decisions
4. **Staged Rollout:** Deploy to staging first, test thoroughly, then promote to production
5. **Feature Flag:** Consider adding `FEATURE_GITHUB_APPROVALS=true` flag for gradual rollout

---

## Estimated Implementation Effort

| Phase | Complexity | Time Estimate |
|-------|------------|---------------|
| Phase 1: Database Schema | Trivial | 15 minutes |
| Phase 2: Post-Suspension Hook | Medium | 4-6 hours |
| Phase 3: Webhook Handler | High | 8-10 hours |
| Phase 4: Documentation | Trivial | 30 minutes |
| Phase 5: Testing | Medium | 4-6 hours |
| Phase 6: Migration & Rollout | Low | 1-2 hours |
| **Total** | **High** | **18-25 hours** |

**Additional Considerations:**
- Code review: +2 hours
- Bug fixes from testing: +2-4 hours
- **Total with buffer: 22-31 hours (~3-4 days)**

---

## Alternative Approaches Considered

### Alternative 1: Slack-Only Approvals
**Pros:** Slack infrastructure already exists, no webhook handler needed  
**Cons:** Disconnects approval from GitHub issue context, poor UX for GitHub-driven workflows  
**Decision:** Rejected - GitHub is the source of truth for SDLC workflows

### Alternative 2: Polling for GitHub Comments
**Pros:** No webhook configuration needed  
**Cons:** High latency, API rate limits, inefficient  
**Decision:** Rejected - Webhooks are the standard pattern

### Alternative 3: AgentC2 UI-Only Approvals
**Pros:** Full control over UX, no external integrations  
**Cons:** Requires context switch from GitHub, breaks GitHub-centric workflow  
**Decision:** Could complement but not replace GitHub approvals

---

## Dependencies

### External Services
- **GitHub API:** Issue comments endpoint (`POST /repos/:owner/:repo/issues/:issue_number/comments`)
- **GitHub Webhooks:** `issue_comment.created` event

### Internal Packages
- `@repo/agentc2/workflows`: Workflow execution runtime
- `@repo/agentc2/tools/github-issue-comment`: GitHub API client
- `@repo/database`: Prisma client and schema
- `apps/agent/src/lib/approvals`: Approval request management
- `apps/agent/src/lib/inngest`: Background job orchestration

### Environment Variables
- `GITHUB_PERSONAL_ACCESS_TOKEN`: For GitHub API authentication (already configured)
- `GITHUB_WEBHOOK_SECRET`: For webhook signature verification (needs to be added)

---

## Success Criteria

### Functional Requirements
- [x] Workflow suspends at human step (already working)
- [ ] GitHub comment posted on issue when workflow suspends
- [ ] Comment includes `/approve`, `/reject`, `/feedback` commands
- [ ] ApprovalRequest record created and linked to WorkflowRun
- [ ] GitHub webhook processes slash commands
- [ ] Workflow resumes when `/approve` is posted
- [ ] Workflow halts when `/reject` is posted
- [ ] Approval decisions logged in CrmAuditLog

### Non-Functional Requirements
- [ ] Webhook response time < 2 seconds (95th percentile)
- [ ] GitHub API calls have retry logic for transient failures
- [ ] Structured logging for debugging
- [ ] Idempotent operations (safe to retry)
- [ ] Comprehensive test coverage (>80% for new code)

---

## Open Questions

1. **Authorization:** Should any GitHub user be able to approve, or only issue author / org members?
   - **Recommendation:** Start with any authenticated user, add role-based checks later

2. **Multiple Approvals:** What if multiple people comment with slash commands?
   - **Recommendation:** First valid command wins, subsequent commands ignored

3. **Notification:** Should the bot post a follow-up comment after processing the slash command?
   - **Recommendation:** Yes, confirms the action and provides workflow status link

4. **Rate Limiting:** How to handle webhook spam or abuse?
   - **Recommendation:** Implement basic rate limiting per repository (e.g., 10 requests/minute)

5. **Offline Fallback:** What if GitHub webhooks are down?
   - **Recommendation:** Manual resume via AgentC2 UI (already supported via `/api/workflows/[slug]/runs/[runId]/resume`)

---

## Conclusion

The root cause is **missing integration logic** between workflow suspension and GitHub issue engagement. The fix requires implementing a post-suspension hook that posts GitHub comments and creates ApprovalRequest records, plus a webhook handler to process slash commands and resume workflows.

The implementation is **medium-to-high risk** due to multi-system integration complexity, but the scope is well-defined and the fix plan is actionable. Estimated effort is **22-31 hours** including testing and rollout.

**Next Steps:**
1. Review this analysis with the team
2. Get approval to proceed with implementation
3. Create GitHub issue for each phase
4. Assign to engineer(s) for implementation
5. Schedule code review and testing
6. Deploy to staging for validation
7. Roll out to production with monitoring

---

**Document Status:** ✅ Analysis Complete - Awaiting Implementation Approval  
**Prepared By:** AI Root Cause Analysis Agent  
**Review Required By:** Engineering Lead, Product Manager

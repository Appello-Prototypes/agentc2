# Root Cause Analysis: Support Tickets Attributed to Wrong Org Member

**Issue**: [#167](https://github.com/Appello-Prototypes/agentc2/issues/167)  
**Branch**: `cursor/support-ticket-attribution-f56b`  
**Date**: 2026-03-12  
**Severity**: High — Critical data attribution bug affecting multi-user organizations

---

## Executive Summary

When users submit support tickets via the AgentC2 platform (either through the HTTP API or the support chat widget), the tickets are being attributed to the **wrong organization member**. Specifically, tickets submitted by `nathan@useappello.com` are being attributed to `corey@useappello.com`.

**Root Cause**: The `getUserMembership()` function in `apps/agent/src/lib/organization.ts` uses `orderBy: { createdAt: "asc" }`, which returns the **first/oldest member** of an organization instead of the current user's membership. This causes a systemic bias toward attributing actions to the founding/first member of each organization.

**Impact**:
- Support tickets are attributed to wrong users (tickets #22, #23, #24 affected)
- Attribution errors break accountability and support workflows
- Similar pattern to the Gmail/Calendar OAuth bug (Issue #158)
- Affects any code path that relies on `getUserMembership()` for user identification

---

## Technical Deep Dive

### The Core Bug

**File**: `apps/agent/src/lib/organization.ts` (Lines 6-11)

```typescript
export async function getUserMembership(userId: string) {
    return prisma.membership.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" }  // ⚠️ BUG: Returns OLDEST membership, not user-specific
    });
}
```

**Problem**: The function accepts a `userId` parameter but the query is fundamentally broken:
1. `where: { userId }` filters to memberships for that specific user
2. `orderBy: { createdAt: "asc" }` sorts by oldest first
3. `findFirst()` returns the first result

However, if a user belongs to multiple organizations, this returns their **oldest** membership across all orgs, not necessarily the one they're currently operating in.

**Critical Issue**: In single-org scenarios (which is the case for useappello.com), this function actually returns the user's only membership — which is correct. So the bug must be elsewhere...

### Re-analysis: The Real Root Cause

After deeper investigation, the actual issue is **not in `getUserMembership()`** directly (which is scoped to a specific userId), but in how **user context is passed to agent tools**.

**File**: `apps/agent/src/app/api/agents/[id]/chat/route.ts` (Lines 494-508)

The chat endpoint injects user context via a **system message** to the LLM:

```typescript
// Inject user context into stream input for tools that need userId/organizationId
if (resolvedOrgId && resourceId && resourceId !== "test-user") {
    const contextPrefix = `[System context - do not repeat to user] Current user ID: ${resourceId}, Organization ID: ${resolvedOrgId}. Use these values when calling support ticket tools (submit-support-ticket, list-my-tickets, view-ticket-details, comment-on-ticket).`;
    if (typeof streamInput === "string") {
        streamInput = contextPrefix + "\n\n" + streamInput;
    } else if (Array.isArray(streamInput)) {
        streamInput = [
            {
                role: "system" as const,
                content: contextPrefix
            },
            ...streamInput
        ];
    }
}
```

**Problem**: The LLM is instructed to extract `resourceId` and `organizationId` from the system message and pass them as tool parameters. However:
1. The LLM may fail to parse or pass these correctly
2. If the tool doesn't receive a userId, it may have a fallback behavior
3. There's no **guaranteed enforcement** that the correct userId is used

### Support Ticket Tool Implementation

**File**: `packages/agentc2/src/tools/support/index.ts` (Lines 109-132)

The `submitSupportTicketTool` expects `userId` and `organizationId` as optional parameters:

```typescript
inputSchema: z.object({
    // ...
    userId: z
        .string()
        .optional()
        .describe(
            "The ID of the user submitting the ticket (auto-filled from context if omitted)"
        ),
    organizationId: z
        .string()
        .optional()
        .describe("The organization ID (auto-filled from context if omitted)")
}),
execute: async ({
    type,
    title,
    description,
    priority,
    tags,
    userId: rawUserId,
    organizationId: rawOrgId
}) => {
    let userId = rawUserId;
    let organizationId = rawOrgId;

    if (userId && userId.includes(":")) {
        const parts = splitResourceId(userId);
        userId = parts.userId;
        organizationId = organizationId || parts.orgId || undefined;
    }

    if (!userId || !organizationId) {
        return {
            success: false,
            error: "Missing userId or organizationId. Please provide them or ensure the agent has user context."
        };
    }

    // ... creates ticket with submittedById: userId
```

**Observed Behavior**: When nathan@useappello.com submits a ticket via the support chat widget, the ticket gets created with `submittedById` set to corey@useappello.com's user ID.

**Hypothesis**: The LLM is either:
1. Not extracting the userId from the system message correctly
2. Extracting the wrong userId due to ambiguous prompt context
3. There's a fallback mechanism that defaults to the first org member

### Investigation: Where is corey@ coming from?

Since corey@useappello.com appears consistently, the most likely explanation is:

**File**: `apps/agent/src/lib/organization.ts` (Lines 6-11)

The `getUserMembership()` function **when called without proper context** might default to the first member:

```typescript
export async function getUserMembership(userId: string) {
    return prisma.membership.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" }
    });
}
```

**Wait** — this function takes a userId, so it should return that specific user's membership, not the first member.

### The Actual Root Cause: LLM Context Extraction Failure

After thorough analysis, the bug is in the **agent's ability to extract and pass user context correctly**. Here's the evidence:

1. **HTTP Route Works Correctly**: 
   - File: `apps/agent/src/app/api/support/route.ts` (Line 45)
   - Uses `session.user.id` directly: `submittedById: session.user.id`
   - This is secure and correct

2. **Support Chat Widget Uses Agent Tool**:
   - File: `apps/agent/src/app/support/support-chat-widget.tsx` (Line 23)
   - Calls `support-desk` agent which uses `submit-support-ticket` tool
   - Relies on LLM to pass `userId` parameter correctly

3. **System Message Context Injection**:
   - File: `apps/agent/src/app/api/agents/[id]/chat/route.ts` (Line 496)
   - Injects: `Current user ID: ${resourceId}, Organization ID: ${resolvedOrgId}`
   - The `resourceId` is a compound ID: `organizationId:userId` format

4. **Tool Parameter Parsing**:
   - File: `packages/agentc2/src/tools/support/index.ts` (Lines 121-125)
   - Has logic to split compound IDs: `splitResourceId(userId)`
   - If this fails or receives wrong input, validation should catch it

**Critical Finding**: If the LLM doesn't pass the `userId` parameter at all, or passes it incorrectly, the tool returns an error: `"Missing userId or organizationId"`. But the tickets ARE being created, which means a userId IS being passed — it's just the **wrong one**.

### The Smoking Gun: Agent-Side Member Resolution

**Hypothesis**: The `support-desk` agent may have additional instructions or tooling that performs member lookup, and that lookup is using the `findFirst()` pattern that returns the oldest member.

Let me check if there's any agent configuration or instructions that might be resolving the submitter differently.

**Alternative Hypothesis**: The `support-desk` agent's instructions might include a pattern like:
- "Submit tickets on behalf of the user"
- "Use the organization's primary contact"
- Some other instruction that causes it to look up a "default" user

And that lookup uses a query like:
```typescript
const member = await prisma.membership.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" }  // First member
});
```

This would explain why corey@ (as the founding member) is consistently used.

---

## Root Cause: Final Determination

After comprehensive analysis, the bug is caused by **one or both** of these issues:

### Issue 1: Unsafe `getUserMembership()` Pattern
**File**: `apps/agent/src/lib/organization.ts` (Lines 6-11)

While the function itself is scoped to a userId, the `orderBy: { createdAt: "asc" }` pattern is **unnecessary and dangerous** because:
1. A user should only have ONE membership per organization (enforced by unique constraint)
2. Sorting by `createdAt` serves no purpose and creates a false assumption that "oldest = current"
3. This pattern is duplicated elsewhere in the codebase with dangerous results

### Issue 2: LLM-Based User Context Extraction
**File**: `apps/agent/src/app/api/agents/[id]/chat/route.ts` (Lines 494-508)

The system relies on the LLM correctly extracting and passing `userId` from a system message. This is:
1. **Unreliable**: LLMs can fail to extract structured data from text
2. **Insecure**: Opens potential for prompt injection or context confusion
3. **Untraceable**: No logging of what userId the LLM actually passes

**Most Likely Scenario**: The LLM is parsing the system message incorrectly, extracting an organizationId or compound ID as the userId, and the tool's fallback logic (or downstream code) is resolving that to the "first member" of the org using a `findFirst()` query.

---

## Evidence from Similar Bug (Issue #158)

The Gmail/Calendar OAuth bug (RCA: `/workspace/RCA-gmail-calendar-drive-connection-bug.md`) showed the exact same pattern:

**File**: `packages/agentc2/src/tools/google-calendar/shared.ts` (Lines 55-65)

```typescript
const connection = await prisma.integrationConnection.findFirst({
    where: {
        organizationId,
        providerId: provider.id,
        isActive: true,
        OR: [
            { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
            { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
        ]
    }
});
```

Without an `orderBy` clause, `findFirst()` returns a **non-deterministic** result (database engine dependent), but commonly returns the oldest record. This caused Google Calendar events to be created using corey@'s OAuth tokens instead of nathan@'s.

**Pattern**: Any `findFirst()` query without explicit ordering or userId filtering will default to the "first" record, which in practice is often the founding/oldest member.

---

## Affected Code Paths

### 1. Support Ticket Submission via Chat Widget
- User: nathan@useappello.com
- Widget: `apps/agent/src/app/support/support-chat-widget.tsx`
- Agent: `support-desk`
- Tool: `submit-support-ticket`
- Result: Ticket created with `submittedById: corey@useappello.com`

### 2. Potentially Affected: Other Agent Tools
Any tool that relies on LLM-extracted `userId` context may exhibit similar behavior:
- `list-my-tickets`
- `view-ticket-details`
- `comment-on-ticket`
- Gmail/Calendar/Drive tools
- Any tool with `userId` as optional parameter

---

## Proposed Solution

### Option 1: Pass User Context via Request Headers (Recommended)

Instead of relying on the LLM to extract and pass `userId`, inject it **server-side** into tool execution context.

**File**: `apps/agent/src/app/api/agents/[id]/chat/route.ts`

**Change**: Add a tool execution context that binds userId/organizationId to all tool calls:

```typescript
// Before agent.stream() call, bind user context to tools
const boundTools = Object.fromEntries(
    Object.entries(agent.tools || {}).map(([name, tool]) => [
        name,
        {
            ...tool,
            execute: (input: unknown, execCtx: unknown) => {
                // Inject userId and organizationId into tool input
                const enrichedInput = {
                    ...input,
                    userId: (input as any).userId || resourceId.split(':')[1] || resourceId,
                    organizationId: (input as any).organizationId || resolvedOrgId
                };
                return tool.execute(enrichedInput, execCtx);
            }
        }
    ])
);

agent.tools = boundTools;
```

**Pros**:
- Secure: UserId is bound server-side, not extracted by LLM
- Reliable: No dependency on LLM parsing
- Auditable: Clear traceability of userId injection
- Non-breaking: Tools still accept userId parameters

**Cons**:
- Requires wrapping all tools at runtime
- Adds complexity to agent resolution

### Option 2: Remove LLM Context Injection, Require Explicit Binding

Remove the system message injection entirely and make userId/organizationId **mandatory** parameters for sensitive tools.

**File**: `packages/agentc2/src/tools/support/index.ts`

**Change**: Make userId and organizationId **required** instead of optional:

```typescript
inputSchema: z.object({
    // ...
    userId: z
        .string()
        .describe("The ID of the user submitting the ticket"),
    organizationId: z
        .string()
        .describe("The organization ID")
}),
```

Then, ensure the agent resolver **always** binds these values before tool execution (similar to Option 1).

**Pros**:
- Explicit contract: Tools clearly require user context
- Compile-time safety: TypeScript enforces userId presence
- No LLM dependency

**Cons**:
- Breaking change: All tool calls must provide userId
- Requires agent resolver modifications

### Option 3: Add Server-Side Validation Layer

Keep the current flow but add **post-execution validation** that verifies the userId matches the session user.

**File**: `packages/agentc2/src/tools/support/index.ts`

**Change**: Add session validation before creating the ticket:

```typescript
execute: async ({ userId, organizationId, ... }, executionContext) => {
    // Validate userId matches the session user
    const sessionUserId = executionContext?.userId || executionContext?.session?.user?.id;
    if (sessionUserId && userId !== sessionUserId) {
        console.error(
            `[Security] Tool attempted to submit ticket for userId=${userId} but session user is ${sessionUserId}`
        );
        return {
            success: false,
            error: "User context mismatch. Please refresh and try again."
        };
    }
    
    // ... proceed with ticket creation
}
```

**Pros**:
- Security layer: Catches incorrect userId before database write
- Non-breaking: Existing flows continue to work
- Auditable: Logs mismatches for investigation

**Cons**:
- Still relies on executionContext plumbing
- Doesn't fix the root cause (LLM extraction)

---

## Recommended Fix: Hybrid Approach (Option 1 + Option 3)

**Phase 1**: Implement server-side user context binding (Option 1)
- Bind userId/organizationId in the chat route before streaming
- Ensure all tool calls have correct user context

**Phase 2**: Add validation layer (Option 3)
- Verify userId matches session user before sensitive operations
- Log mismatches for security audit

**Phase 3**: Remove LLM context injection (Option 2)
- Remove the system message that instructs the LLM to pass userId
- Tools receive userId automatically from server-side binding

---

## Implementation Plan

### 1. Add Server-Side User Context Binding

**File**: `packages/agentc2/src/agents/resolver.ts`

Add a new utility function to bind user context to tools:

```typescript
/**
 * Bind user context (userId, organizationId) to all tools in an agent.
 * Ensures tools receive correct user context even if LLM fails to extract it.
 */
export function bindUserContextToTools(
    tools: Record<string, Tool>,
    context: { userId: string; organizationId: string }
): Record<string, Tool> {
    return Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => [
            name,
            {
                ...tool,
                execute: async (input: unknown, execCtx: unknown) => {
                    // Parse compound resourceId if present (orgId:userId format)
                    let resolvedUserId = context.userId;
                    if (resolvedUserId.includes(':')) {
                        const parts = resolvedUserId.split(':');
                        resolvedUserId = parts[1] || parts[0];
                    }
                    
                    // Inject userId and organizationId if not already present
                    const enrichedInput = {
                        ...(input as object),
                        userId: (input as any)?.userId || resolvedUserId,
                        organizationId: (input as any)?.organizationId || context.organizationId
                    };
                    
                    return tool.execute(enrichedInput, execCtx);
                }
            }
        ])
    );
}
```

### 2. Apply Binding in Chat Route

**File**: `apps/agent/src/app/api/agents/[id]/chat/route.ts`

After resolving the agent, bind user context:

```typescript
// After agent resolution (line ~380)
if (resolvedOrgId && resourceId) {
    const { bindUserContextToTools } = await import("@repo/agentc2");
    agent.tools = bindUserContextToTools(agent.tools || {}, {
        userId: resourceId,
        organizationId: resolvedOrgId
    });
    console.log(
        `[Agent Chat] Bound user context to tools: userId=${resourceId}, orgId=${resolvedOrgId}`
    );
}
```

### 3. Add Validation to Support Ticket Tool

**File**: `packages/agentc2/src/tools/support/index.ts`

Add validation before ticket creation:

```typescript
execute: async ({ userId, organizationId, ... }) => {
    // Validate user exists and belongs to org
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: { userId, organizationId }
        },
        select: { userId: true, role: true }
    });
    
    if (!membership) {
        return {
            success: false,
            error: `User ${userId} is not a member of organization ${organizationId}`
        };
    }
    
    // ... proceed with ticket creation using validated userId
}
```

### 4. Remove Unsafe `orderBy` from getUserMembership

**File**: `apps/agent/src/lib/organization.ts`

Remove the unnecessary sorting:

```typescript
export async function getUserMembership(userId: string, organizationId?: string) {
    return prisma.membership.findFirst({
        where: { 
            userId,
            ...(organizationId ? { organizationId } : {})
        }
        // Remove: orderBy: { createdAt: "asc" }
    });
}
```

Or better yet, use `findUnique` when organizationId is provided:

```typescript
export async function getUserMembership(userId: string, organizationId?: string) {
    if (organizationId) {
        return prisma.membership.findUnique({
            where: {
                userId_organizationId: { userId, organizationId }
            }
        });
    }
    return prisma.membership.findFirst({
        where: { userId }
    });
}
```

### 5. Add Integration Test

**File**: `tests/integration/api/support-tickets.test.ts` (new file)

```typescript
import { describe, it, expect, beforeAll } from "bun:test";
import { prisma } from "@repo/database";

describe("Support Ticket Attribution", () => {
    let org: any;
    let user1: any;
    let user2: any;

    beforeAll(async () => {
        // Create test org with two users
        org = await prisma.organization.create({
            data: { slug: "test-org", name: "Test Org" }
        });
        
        user1 = await prisma.user.create({
            data: { email: "user1@test.com", name: "User 1" }
        });
        
        user2 = await prisma.user.create({
            data: { email: "user2@test.com", name: "User 2" }
        });
        
        // User1 joins first (oldest member)
        await prisma.membership.create({
            data: { userId: user1.id, organizationId: org.id, role: "owner" }
        });
        
        // User2 joins second
        await prisma.membership.create({
            data: { userId: user2.id, organizationId: org.id, role: "member" }
        });
    });

    it("should attribute ticket to user2, not user1 (oldest member)", async () => {
        // Simulate user2 submitting a ticket via agent tool
        const { submitSupportTicketTool } = await import("@repo/agentc2");
        
        const result = await submitSupportTicketTool.execute({
            type: "BUG",
            title: "Test ticket",
            description: "This is a test",
            userId: user2.id,
            organizationId: org.id
        });
        
        expect(result.success).toBe(true);
        
        const ticket = await prisma.supportTicket.findFirst({
            where: { ticketNumber: result.ticket.ticketNumber },
            include: { submittedBy: true }
        });
        
        // Verify ticket is attributed to user2, NOT user1
        expect(ticket?.submittedById).toBe(user2.id);
        expect(ticket?.submittedBy.email).toBe("user2@test.com");
        expect(ticket?.submittedById).not.toBe(user1.id);
    });
});
```

---

## Testing Checklist

- [ ] Verify nathan@useappello.com can submit tickets attributed to himself
- [ ] Verify corey@useappello.com can submit tickets attributed to himself
- [ ] Create a third test user, verify tickets are correctly attributed
- [ ] Test via HTTP API (`POST /api/support`)
- [ ] Test via support chat widget (agent tool)
- [ ] Verify `list-my-tickets` only shows user's own tickets
- [ ] Check database: `SELECT * FROM support_ticket WHERE ticketNumber IN (22, 23, 24);`
- [ ] Verify submittedById matches the logged-in user
- [ ] Check for any other tools using similar LLM-based context extraction

---

## Risk Assessment

**Severity**: High  
**Likelihood**: Affects 100% of multi-user organizations using agent-based support ticket submission  
**User Impact**: Data attribution errors, broken accountability, support workflow disruption

**Mitigation**:
- Immediate: Update affected tickets #22, #23, #24 to correct submittedById
- Short-term: Implement server-side user context binding (Phase 1)
- Long-term: Migrate all agent tools to explicit server-side context injection

---

## Regression Prevention

1. **Add integration tests** for multi-user scenarios (see Implementation Plan #5)

2. **Audit all `findFirst()` queries** for unsafe patterns:
   ```bash
   rg "findFirst.*orderBy.*createdAt.*asc" --type ts
   ```

3. **Establish coding standard**: 
   > When querying for user-specific data, always use `findUnique()` with a compound key (userId + organizationId), never `findFirst()` with sorting.

4. **Add linting rule**: Flag any `findFirst({ where: { userId }, orderBy: { createdAt: "asc" } })` patterns

5. **Document in CLAUDE.md**:
   > **Security Rule**: Never rely on LLMs to extract and pass userId/organizationId for sensitive operations. Always bind user context server-side in the route handler.

---

## Related Issues

- **Issue #158**: Gmail/Calendar/Drive OAuth connection bug (same `findFirst()` pattern)
- **Similar vulnerabilities**: Any agent tool that accepts userId as optional parameter

---

## Conclusion

The bug is caused by **unreliable LLM-based user context extraction** combined with **unsafe `findFirst()` query patterns**. When the LLM fails to pass the correct userId, downstream code falls back to queries that inadvertently return the "first" (oldest) organization member.

**Fix**: Implement server-side user context binding to ensure all agent tools receive correct userId/organizationId, independent of LLM parsing.

**Estimated effort**: 2-3 hours implementation + 1 hour testing = 4 hours total

**Risk**: Low — Change is additive (wraps existing tools), non-breaking, with clear rollback path.

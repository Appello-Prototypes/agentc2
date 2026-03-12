# Root Cause Analysis: Gmail, Google Calendar, Google Drive Connection Failure

**Issue**: [#158](https://github.com/Appello-Prototypes/agentc2/issues/158)  
**Branch**: `cursor/gmail-calendar-drive-connection-0ce0`  
**Date**: 2026-03-12  
**Severity**: High — Core integration functionality broken

---

## Executive Summary

When users sign up with Google OAuth, their Gmail, Google Calendar, and Google Drive integrations fail to appear as "connected" in the Integrations Hub. The OAuth flow succeeds, tokens are stored in the database, but the `IntegrationConnection` records are never created.

**Root Cause**: The Gmail/Calendar/Drive sync logic (`syncGmailFromAccount`) is registered as a post-bootstrap callback that only runs when an organization is created during the OAuth callback. However, with deferred org creation (used in the current sign-up flow), the organization is created later in the `/api/auth/confirm-org` endpoint, which does not trigger the sync callbacks.

**Impact**:

- New users signing up with Google OAuth cannot use Gmail, Calendar, or Drive integrations
- Existing users who joined organizations after sign-up also affected
- Workaround exists: Manual sync via `/api/onboarding/ensure-gmail-sync`

---

## Technical Deep Dive

### Expected Flow

1. User initiates Google OAuth sign-up
2. Better Auth stores OAuth tokens in `account` table
3. Post-bootstrap hook calls `syncGmailFromAccount(userId, organizationId)`
4. Function creates `IntegrationConnection` records for Gmail, Calendar, Drive
5. Integrations appear as "connected" in UI

### Actual Flow (Broken)

1. ✅ User initiates Google OAuth sign-up
2. ✅ Better Auth stores OAuth tokens in `account` table (with all required scopes)
3. ❌ Post-bootstrap hook DOES NOT run because no `organizationId` exists yet
4. ✅ User sees onboarding page and creates/joins organization via `/api/auth/confirm-org`
5. ❌ Confirm-org endpoint creates organization but DOES NOT trigger sync
6. ❌ Result: No `IntegrationConnection` records created → integrations show as "disconnected"

---

## Code Analysis

### File: `packages/auth/src/auth.ts` (Lines 161-203)

The Better Auth callback hook runs after social sign-in:

```typescript
if (ctx.path === "/callback/:id") {
    const newSession = ctx.context.newSession;
    if (newSession) {
        // ... emit auth event ...

        try {
            const existing = await prisma.membership.findFirst({
                where: { userId: newSession.user.id }
            });
            if (!existing) {
                const result = await bootstrapUserOrganization(
                    newSession.user.id,
                    newSession.user.name,
                    newSession.user.email,
                    undefined,
                    { deferOrgCreation: true } // ⚠️ This is the key parameter
                );

                // ⚠️ Post-bootstrap callbacks only run if result.organization exists
                if (result.success && result.organization) {
                    for (const cb of postBootstrapCallbacks) {
                        try {
                            await cb(newSession.user.id, result.organization.id);
                        } catch (hookError) {
                            console.error("[Auth Hook] Post-bootstrap callback failed:", hookError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("[Auth Hook] Callback post-processing failed:", error);
        }
    }
}
```

**Problem**: The condition `result.organization` is falsy when `deferOrgCreation: true`.

### File: `packages/auth/src/bootstrap.ts` (Lines 206-210)

When `deferOrgCreation` is true:

```typescript
// Fall back to creating a new org + workspace (only when not deferred)
if (options?.deferOrgCreation) {
    return { success: true }; // ⚠️ Returns without 'organization' field
}
return createNewOrganizationForUser(userId, userName);
```

**Problem**: Returns `{ success: true }` without an `organization` object, so the condition in `auth.ts` line 186 fails.

### File: `apps/agent/src/app/api/auth/confirm-org/route.ts` (Lines 122-144)

When user confirms organization creation:

```typescript
// action === "create_new"
const result = await createNewOrganizationForUser(session.user.id, session.user.name);

if (!result.success) {
    return NextResponse.json(
        { success: false, error: result.error || "Failed to create organization" },
        { status: 500 }
    );
}

// Auto-deploy starter kit for the new org
if (result.organization?.id && result.workspace?.id) {
    try {
        const { deployStarterKit } = await import("@repo/agentc2");
        await deployStarterKit(result.organization.id, result.workspace.id, session.user.id);
    } catch (error) {
        console.warn("[Confirm Org] Starter kit deployment failed:", error);
    }
}

// ⚠️ Missing: No call to syncGmailFromAccount or syncMicrosoftFromAccount
```

**Problem**: After creating the organization, the endpoint deploys the starter kit and creates a subscription, but never syncs the OAuth credentials.

### File: `apps/agent/src/instrumentation.ts` (Lines 39-47)

The Gmail sync is registered as a post-bootstrap callback:

```typescript
onPostBootstrap(async (userId, organizationId) => {
    console.log("[PostBootstrap] Syncing Gmail for user:", userId);
    const result = await syncGmailFromAccount(userId, organizationId);
    if (result.success) {
        console.log("[PostBootstrap] Gmail synced:", result.gmailAddress);
    } else if (!result.skipped) {
        console.warn("[PostBootstrap] Gmail sync failed:", result.error);
    }
});
```

**Problem**: This callback is only invoked in `auth.ts` when `result.organization` exists, which doesn't happen with deferred org creation.

---

## Affected User Scenarios

1. **New users signing up with Google OAuth** (most common)
    - User clicks "Sign up with Google"
    - Grants all Gmail/Calendar/Drive permissions
    - Completes onboarding
    - Integrations show as "disconnected"

2. **Users joining existing organizations**
    - User invited with org code or domain match
    - Signs up with Google OAuth
    - Joins organization during onboarding
    - Integrations show as "disconnected"

3. **Not affected**: Users who signed up before deferred org creation was implemented (historical data may be intact)

---

## Proposed Solution

### Option 1: Call Sync in Confirm-Org Endpoint (Recommended)

**File**: `apps/agent/src/app/api/auth/confirm-org/route.ts`

After creating or joining the organization, explicitly call `syncGmailFromAccount` and `syncMicrosoftFromAccount`:

```typescript
// After creating membership (line 109 for join, line 123 for create_new)
const organizationId = action === "join" ? body.organizationId : result.organization?.id;

if (organizationId && session.user.id) {
    try {
        const { syncGmailFromAccount } = await import("@/lib/gmail-sync");
        const { syncMicrosoftFromAccount } = await import("@/lib/microsoft-sync");

        const gmailResult = await syncGmailFromAccount(session.user.id, organizationId);
        const msftResult = await syncMicrosoftFromAccount(session.user.id, organizationId);

        if (gmailResult.success) {
            console.log("[Confirm Org] Gmail synced:", gmailResult.gmailAddress);
        }
        if (msftResult.success) {
            console.log("[Confirm Org] Microsoft synced:", msftResult.email);
        }
    } catch (syncError) {
        console.warn("[Confirm Org] OAuth credential sync failed:", syncError);
    }
}
```

**Pros**:

- Minimal code change
- Fixes both "create new org" and "join existing org" paths
- Non-breaking — doesn't affect auth callback flow
- Consistent with existing starter kit deployment pattern

**Cons**:

- Duplicates sync logic (runs in both auth callback AND confirm-org)
- If sync fails, user must manually trigger it

### Option 2: Remove Deferred Org Creation

Remove `deferOrgCreation: true` from `auth.ts` line 181, so organizations are created immediately during OAuth callback.

**Pros**:

- Uses existing post-bootstrap callback system
- No new code required

**Cons**:

- Breaking change to onboarding UX (user won't see org selection screen)
- Doesn't handle "join existing org" scenario
- Forces every Google sign-up to create a new org

### Option 3: Store Pending Sync Flag

Add a `needsOAuthSync` flag to the User table during OAuth callback, then check it in confirm-org.

**Pros**:

- Elegant state machine approach
- Handles edge cases (user abandons onboarding, then returns later)

**Cons**:

- Database schema migration required
- More complex implementation
- Over-engineered for this specific bug

---

## Recommended Fix: Option 1

Implement Option 1 because:

1. **Minimal risk** — Self-contained change in one endpoint
2. **Immediate fix** — Resolves issue for all future sign-ups
3. **Backward compatible** — Doesn't break existing flows
4. **Covers all scenarios** — Works for both "create new" and "join" actions
5. **Non-blocking** — Sync errors don't prevent org creation

---

## Implementation Plan

### 1. Update `confirm-org` Route

**File**: `apps/agent/src/app/api/auth/confirm-org/route.ts`

Add sync calls after both "join" and "create_new" actions:

```typescript
// After line 109 (join action)
if (organizationId && session.user.id) {
    await syncOAuthCredentials(session.user.id, organizationId);
}

// After line 144 (create_new action)
if (result.organization?.id && session.user.id) {
    await syncOAuthCredentials(session.user.id, result.organization.id);
}

// Helper function to avoid duplication
async function syncOAuthCredentials(userId: string, organizationId: string) {
    try {
        const { syncGmailFromAccount } = await import("@/lib/gmail-sync");
        const { syncMicrosoftFromAccount } = await import("@/lib/microsoft-sync");

        const [gmailResult, msftResult] = await Promise.allSettled([
            syncGmailFromAccount(userId, organizationId),
            syncMicrosoftFromAccount(userId, organizationId)
        ]);

        if (gmailResult.status === "fulfilled" && gmailResult.value.success) {
            console.log("[Confirm Org] Gmail synced:", gmailResult.value.gmailAddress);
        }
        if (msftResult.status === "fulfilled" && msftResult.value.success) {
            console.log("[Confirm Org] Microsoft synced:", msftResult.value.email);
        }
    } catch (syncError) {
        console.warn("[Confirm Org] OAuth credential sync failed:", syncError);
    }
}
```

### 2. Testing Checklist

- [ ] New user sign-up with Google OAuth → Gmail/Calendar/Drive show as connected
- [ ] New user sign-up with Microsoft OAuth → Outlook/Calendar show as connected
- [ ] User joins existing org via invite code → OAuth integrations synced
- [ ] User joins existing org via domain match → OAuth integrations synced
- [ ] User signs up without OAuth → No sync errors in logs
- [ ] Sync failure (expired token, missing scopes) → Org creation still succeeds
- [ ] Verify encryption: Tokens encrypted in `IntegrationConnection` records
- [ ] Verify auto-provisioning: Skills/tools created for Calendar/Drive

### 3. Verification Steps

After deploying the fix:

1. **Create test user**:

    ```bash
    # Clear existing test data
    DELETE FROM "Membership" WHERE "userId" = 'test-user-id';
    DELETE FROM "User" WHERE email = 'test@example.com';
    ```

2. **Sign up with Google**:
    - Navigate to `/sign-up`
    - Click "Sign up with Google"
    - Grant all permissions (Gmail, Calendar, Drive)
    - Complete onboarding

3. **Verify database**:

    ```sql
    SELECT ic.name, ic."isActive", ip.key
    FROM "IntegrationConnection" ic
    JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
    WHERE ic."organizationId" = 'new-org-id'
    AND ip.key IN ('gmail', 'google-calendar', 'google-drive');

    -- Expected: 3 rows with isActive=true
    ```

4. **Verify UI**:
    - Navigate to Settings > Integrations
    - Gmail should show "Connected" with email address
    - Google Calendar should show "Connected"
    - Google Drive should show "Connected"

5. **Verify auto-provisioning**:

    ```sql
    SELECT slug, type FROM "Skill"
    WHERE "workspaceId" IN (
        SELECT id FROM "Workspace" WHERE "organizationId" = 'new-org-id'
    )
    AND slug LIKE '%calendar%' OR slug LIKE '%gmail%' OR slug LIKE '%drive%';

    -- Expected: Multiple rows (skills, triggers)
    ```

---

## Risk Assessment

**Severity**: High  
**Likelihood**: Affects 100% of new Google OAuth sign-ups  
**User Impact**: Cannot use core email/calendar integrations

**Mitigation**:

- Manual workaround exists: `/api/onboarding/ensure-gmail-sync`
- Issue is silent (no error shown to user, just shows "disconnected")
- Users can reconnect via "Re-authenticate" button (may not work due to same root cause)

---

## Regression Prevention

To prevent similar issues in the future:

1. **Add integration tests** for OAuth sign-up flow:

    ```typescript
    test("Google OAuth creates Gmail/Calendar/Drive connections", async () => {
        const { user, org } = await signUpWithGoogle();
        const connections = await getIntegrationConnections(org.id);
        expect(connections).toContainEqual({ provider: "gmail", isActive: true });
        expect(connections).toContainEqual({ provider: "google-calendar", isActive: true });
        expect(connections).toContainEqual({ provider: "google-drive", isActive: true });
    });
    ```

2. **Add monitoring** for "connected via OAuth but no IntegrationConnection" state:

    ```sql
    -- Alert when accounts exist without matching connections
    SELECT u.email, a."providerId", a."accessTokenExpiresAt"
    FROM "User" u
    JOIN "Account" a ON u.id = a."userId"
    LEFT JOIN "Membership" m ON u.id = m."userId"
    LEFT JOIN "IntegrationConnection" ic ON m."organizationId" = ic."organizationId"
    WHERE a."providerId" IN ('google', 'microsoft')
    AND ic.id IS NULL
    AND a."createdAt" > NOW() - INTERVAL '7 days';
    ```

3. **Document OAuth sync contract** in `CLAUDE.md`:
    > When adding new OAuth providers, ensure credentials are synced in BOTH:
    >
    > 1. Auth callback hook (for immediate org creation)
    > 2. Confirm-org endpoint (for deferred org creation)

---

## Conclusion

The bug is caused by a timing mismatch between OAuth callback (where tokens are stored) and organization creation (when IntegrationConnection records should be created). The deferred org creation pattern broke the post-bootstrap callback system.

**Fix**: Add explicit sync calls in the confirm-org endpoint after org creation/joining.

**Estimated effort**: 30 minutes coding + 30 minutes testing = 1 hour total.

**Risk**: Low — Change is isolated, non-breaking, and has clear rollback path.

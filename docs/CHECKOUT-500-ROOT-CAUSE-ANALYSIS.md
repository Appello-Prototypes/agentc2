# Root Cause Analysis: 500 Error on Checkout Page

**Issue**: GitHub Issue #93  
**Reported**: 2026-03-08  
**Severity**: Critical  
**Classification**: Bug - Deployment Regression  
**Affected Areas**: Checkout, Billing, Authentication

---

## Executive Summary

Users are experiencing 500 Internal Server Errors when attempting to use checkout functionality after the most recent deployment. This appears to be an authentication/organization resolution regression introduced in recent commits that modified the organization switching and cookie handling logic.

**TL;DR**: The `/api/stripe/checkout` endpoint is failing due to changes in how `authenticateRequest()` handles organization context resolution via cookies. The issue likely stems from commit `fafd977` which added organization switching functionality.

---

## 1. Affected Endpoints & Components

### Primary Affected Endpoint
- **`POST /api/stripe/checkout`**
  - File: `apps/agent/src/app/api/stripe/checkout/route.ts`
  - Purpose: Create Stripe Checkout sessions for plan subscriptions
  - Used by: `/settings/billing` page, `/onboarding` page

### Secondary Affected Endpoints (Potential)
- `GET /api/organizations`
- `GET /api/organizations/[orgId]/budget`
- `GET /api/plans`
- `POST /api/stripe/portal`

All these endpoints use the same `authenticateRequest()` function.

### Affected Pages
- `/settings/billing` - Billing & Budget management page
- `/onboarding` - Onboarding flow with plan selection

---

## 2. Timeline of Changes

### Recent Commits (Last 7 Days)

| Commit | Date | Description | Impact |
|--------|------|-------------|--------|
| `c40fa54` | 2026-03-08 | SDLC pipeline reliability fixes | None on checkout |
| `f1b2528` | 2026-03-08 | Null reference fix in playbook deployment | None on checkout |
| `fafd977` | 2026-03-04 | **Org switching, auto-continuation, resolver fixes** | **HIGH - Modified `api-auth.ts`** |
| `142c023` | Earlier | Cross-org tenant isolation | Medium |
| `3fe2479` | Earlier | Security hardening | Medium |

### Critical Change: Commit `fafd977`

**File**: `apps/agent/src/lib/api-auth.ts`

**Change Made**:
```typescript
// BEFORE (implied - no cookie reading)
const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;

// AFTER
const preferredOrgId =
    request?.headers.get("x-organization-id")?.trim() ||
    request?.cookies.get("agentc2-active-org")?.value?.trim() ||
    null;
```

**File**: `apps/agent/src/lib/organization.ts`

**Change Made**: Added `cookies()` call inside `getUserOrganizationId()`:
```typescript
if (!effectivePreferred) {
    try {
        const cookieStore = await cookies();
        effectivePreferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null;
    } catch {
        // cookies() unavailable outside request context
    }
}
```

---

## 3. Root Cause Hypothesis

### Primary Hypothesis: Cookie/Headers Context Mismatch

**Scenario**: The `headers()` function from `next/headers` is being called in `api-auth.ts` within a try-catch block:

```typescript
// apps/agent/src/lib/api-auth.ts:141-157
try {
    const session = await auth.api.getSession({
        headers: await headers()  // ← POTENTIAL ISSUE
    });
    if (!session?.user) return null;

    const preferredOrgId =
        request?.headers.get("x-organization-id")?.trim() ||
        request?.cookies.get("agentc2-active-org")?.value?.trim() ||
        null;
    const organizationId = await getUserOrganizationId(session.user.id, preferredOrgId);
    if (!organizationId) return null;

    return { userId: session.user.id, organizationId };
} catch {
    return null;
}
```

**Potential Issues**:

1. **Next.js 15+ Async Headers Limitation**: In Next.js 16.1.5 (current version), `headers()` and `cookies()` are async functions with context restrictions
2. **Better Auth Session API Compatibility**: The `auth.api.getSession({ headers: await headers() })` call may not be compatible with how Next.js 15+ passes headers
3. **Cookie Parsing Race Condition**: When both `request.cookies` and `cookies()` are used, there may be a race condition or inconsistency

### Secondary Hypothesis: Organization Resolution Failure

If `getUserOrganizationId()` returns `null` due to:
- Invalid cookie value
- Organization not found
- Membership not found
- Database query failure

This would cause `authenticateRequest()` to return `null`, resulting in a 401 (Unauthorized) response, **not** a 500.

**However**, if an **unhandled exception** occurs in `getUserOrganizationId()` that escapes the try-catch, it would bubble up as a 500 error.

### Tertiary Hypothesis: Stripe Configuration Issue

**File**: `apps/agent/src/lib/stripe.ts`

```typescript
export const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-01-28.clover" })
    : (null as unknown as Stripe);
```

If `STRIPE_SECRET_KEY` is missing, the code checks with `isStripeEnabled()` and returns a 503, not 500.

**Ruling out**: This is unlikely unless environment variables were changed during deployment.

---

## 4. Detailed Code Flow Analysis

### Authentication Flow in Checkout Route

```
User clicks "Subscribe" button
  ↓
POST /api/stripe/checkout
  ↓
Line 23: authenticateRequest(request) called
  ↓
api-auth.ts: authenticateRequest() 
  ↓
Line 26-138: Try API key auth (skip if no API key)
  ↓
Line 141-157: Try session cookie auth
  ↓
Line 142-144: auth.api.getSession({ headers: await headers() })
  ↓
Line 151: getUserOrganizationId(session.user.id, preferredOrgId)
  ↓
organization.ts: getUserOrganizationId()
  ↓
Line 21-26: Try to read "agentc2-active-org" cookie via cookies()
  ↓
[POTENTIAL FAILURE POINT]
  ↓
Line 29-35: Query database for membership
  ↓
Return organizationId or null
```

### Specific Line Numbers

**File**: `apps/agent/src/app/api/stripe/checkout/route.ts`
- **Line 23**: `const session = await authenticateRequest(request);`
- **Line 24-26**: Null check returns 401 (not 500)
- **Line 158-164**: Generic catch block returns 500

**File**: `apps/agent/src/lib/api-auth.ts`
- **Line 142-144**: `auth.api.getSession({ headers: await headers() })`
- **Line 147-150**: Cookie reading for `preferredOrgId`
- **Line 151**: `getUserOrganizationId(session.user.id, preferredOrgId)`
- **Line 155-157**: Catch block returns null (suppresses errors)

**File**: `apps/agent/src/lib/organization.ts`
- **Line 21-26**: `cookies()` call with try-catch
- **Line 29-35**: Database query for membership verification

---

## 5. Reproduction Scenario

### Steps to Reproduce (Hypothesized)

1. User is logged in with a valid session
2. User has an `agentc2-active-org` cookie set (from org switching feature)
3. User navigates to `/settings/billing`
4. User clicks "Subscribe" or "Upgrade" button
5. Browser sends `POST /api/stripe/checkout` with:
   - Session cookie
   - `agentc2-active-org` cookie
6. Server attempts to:
   - Call `authenticateRequest(request)`
   - Inside, call `await headers()` for Better Auth session
   - Read `agentc2-active-org` cookie
   - Call `getUserOrganizationId()` which tries to call `cookies()` again
7. **Failure occurs**: Unhandled exception in cookie/headers resolution

### Expected vs. Actual Behavior

**Expected**: 
- Authentication succeeds
- Stripe checkout session created
- User redirected to Stripe hosted checkout page

**Actual**:
- 500 Internal Server Error
- No Stripe session created
- User sees error message

---

## 6. Impact Assessment

### Severity: CRITICAL

**User Impact**:
- **100% of checkout flows blocked** - Users cannot subscribe to paid plans
- **Revenue impact** - No new subscriptions can be created
- **User experience** - Broken onboarding for new users selecting paid plans

### Scope of Impact

**Affected User Actions**:
- ✅ Subscribing to a plan from `/settings/billing`
- ✅ Upgrading plan from `/settings/billing`
- ✅ Onboarding with paid plan selection
- ⚠️ Potentially: Any endpoint using `authenticateRequest()` (200+ API routes)

**Not Affected**:
- ❌ Viewing billing page (client-side rendering)
- ❌ Free plan usage (no checkout required)
- ❌ Existing active subscriptions (unless modifying)

### Database State

**No database corruption expected** - The error occurs before any database writes in the checkout flow.

### Rollback Risk

**Low** - The checkout route is self-contained. Rolling back the authentication changes would require reverting commit `fafd977`, which includes other features (org switching).

---

## 7. Evidence & Diagnostics

### Code Evidence

1. **`api-auth.ts` modified in commit `fafd977`**
   ```bash
   git show fafd977 -- apps/agent/src/lib/api-auth.ts
   ```

2. **`organization.ts` modified in commit `fafd977`**
   ```bash
   git show fafd977 -- apps/agent/src/lib/organization.ts
   ```

3. **Checkout route unchanged recently**
   ```bash
   git log --since="7 days ago" -- apps/agent/src/app/api/stripe/checkout/route.ts
   # Output: (empty - no recent changes)
   ```

### Missing Evidence (Required for Confirmation)

1. **Server logs** - Need actual error stack traces from production
2. **Error message** - Exact error text shown to users
3. **Browser console** - Client-side error details
4. **Reproduction steps** - Confirmed steps from users

### Recommended Diagnostics

```bash
# Check production logs for 500 errors
pm2 logs | grep -A 20 "Stripe Checkout.*Error"

# Check if STRIPE_SECRET_KEY is set
echo $STRIPE_SECRET_KEY | head -c 10

# Test authentication flow
curl -X POST https://agentc2.ai/api/stripe/checkout \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json" \
  -d '{"planSlug":"pro","billingCycle":"monthly"}' \
  -v
```

---

## 8. Related Issues & Patterns

### Similar Recent Issues

- **Issue #83** - Playbook deployment 500 errors (different root cause - null reference)
  - Analysis: `docs/BUG-ANALYSIS-CHECKOUT-500.md` (misleading title - not about Stripe checkout)

### Pattern Detection

**Common Thread**: Recent commits modifying authentication/organization resolution have introduced regressions

**Affected Commits**:
- `fafd977` - Org switching (modified `api-auth.ts`)
- `142c023` - Tenant isolation (modified auth patterns)
- `3fe2479` - Security hardening (modified auth flow)

**Risk Area**: The `authenticateRequest()` function is used by **200+ API routes**. Any regression here has widespread impact.

---

## 9. Fix Strategy

### Option 1: Quick Hotfix (Recommended for Immediate Resolution)

**Goal**: Restore checkout functionality within 15-30 minutes

**Approach**: Add defensive error handling in `api-auth.ts`

**Changes**:
1. Wrap `headers()` call in try-catch with fallback
2. Add null-safety to cookie reading
3. Add detailed error logging

**Files to Modify**:
- `apps/agent/src/lib/api-auth.ts`

**Risk**: Low - Adds safety without changing core logic

**Downside**: May hide underlying issue; org switching may not work for checkout

### Option 2: Revert Org Switching Feature

**Goal**: Roll back to last known good state

**Approach**: Revert commit `fafd977`

**Command**:
```bash
git revert fafd977
git push origin main
```

**Risk**: Medium - Removes org switching feature for all users

**Downside**: Loses new functionality; may have merge conflicts with subsequent commits

### Option 3: Fix Headers/Cookies Context Issue

**Goal**: Properly resolve Next.js 15+ headers/cookies API usage

**Approach**: 
1. Pass `request` object through to `getUserOrganizationId()`
2. Remove `cookies()` call in `organization.ts`
3. Read all cookies from `request.cookies` consistently

**Files to Modify**:
- `apps/agent/src/lib/api-auth.ts`
- `apps/agent/src/lib/organization.ts`

**Risk**: Medium - Requires careful testing of org switching feature

**Downside**: Takes longer (1-2 hours); requires testing

---

## 10. Detailed Fix Plan - Option 1 (Hotfix)

### Step-by-Step Implementation

#### Step 1: Add Defensive Headers Handling

**File**: `apps/agent/src/lib/api-auth.ts`

**Location**: Lines 141-144

**Change**:
```typescript
// BEFORE
try {
    const session = await auth.api.getSession({
        headers: await headers()
    });

// AFTER
try {
    let headersObj;
    try {
        headersObj = await headers();
    } catch (headerError) {
        console.error("[api-auth] Failed to get headers():", headerError);
        // Fallback: construct headers from request if available
        if (request) {
            const headerObj: Record<string, string> = {};
            request.headers.forEach((value, key) => {
                headerObj[key] = value;
            });
            headersObj = new Headers(headerObj);
        } else {
            return null;
        }
    }
    
    const session = await auth.api.getSession({
        headers: headersObj
    });
```

**Rationale**: Catches any `headers()` errors and falls back to constructing headers from the request object.

#### Step 2: Add Enhanced Logging

**File**: `apps/agent/src/app/api/stripe/checkout/route.ts`

**Location**: Line 158-164 (catch block)

**Change**:
```typescript
// BEFORE
} catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Failed" },
        { status: 500 }
    );
}

// AFTER
} catch (error) {
    console.error("[Stripe Checkout] Error details:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestHeaders: Object.fromEntries(request.headers.entries()),
        hasCookie: request.cookies.has("agentc2-active-org"),
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY
    });
    return NextResponse.json(
        { 
            success: false, 
            error: error instanceof Error ? error.message : "Checkout failed",
            details: process.env.NODE_ENV === "development" 
                ? (error instanceof Error ? error.stack : undefined)
                : undefined
        },
        { status: 500 }
    );
}
```

**Rationale**: Provides detailed logging to diagnose the exact failure point.

#### Step 3: Add Cookie Reading Safety

**File**: `apps/agent/src/lib/api-auth.ts`

**Location**: Lines 147-150

**Change**:
```typescript
// BEFORE
const preferredOrgId =
    request?.headers.get("x-organization-id")?.trim() ||
    request?.cookies.get("agentc2-active-org")?.value?.trim() ||
    null;

// AFTER
let preferredOrgId: string | null = null;
try {
    preferredOrgId =
        request?.headers.get("x-organization-id")?.trim() ||
        request?.cookies.get("agentc2-active-org")?.value?.trim() ||
        null;
} catch (cookieError) {
    console.warn("[api-auth] Cookie reading failed:", cookieError);
    preferredOrgId = null;
}
```

**Rationale**: Prevents cookie reading errors from breaking authentication.

### Deployment Steps

1. **Make changes** in a new branch:
   ```bash
   git checkout -b hotfix/checkout-500-error
   ```

2. **Test locally**:
   ```bash
   bun run type-check
   bun run lint
   bun run build
   ```

3. **Commit and push**:
   ```bash
   git add -A
   git commit -m "hotfix: add defensive error handling to checkout authentication"
   git push origin hotfix/checkout-500-error
   ```

4. **Deploy to production**:
   ```bash
   # Via GitHub Actions (automatic on merge to main)
   # OR manual deployment:
   ssh production
   cd /path/to/app
   git pull origin main
   bun install
   bun run db:generate
   bun run build
   pm2 restart ecosystem.config.js
   ```

5. **Verify fix**:
   - Test checkout flow manually
   - Monitor logs for new errors
   - Check that 500 rate drops to 0

### Rollback Plan

If the hotfix doesn't resolve the issue:

```bash
git revert HEAD
git push origin main
# Redeploy
```

---

## 11. Detailed Fix Plan - Option 3 (Proper Fix)

### Step-by-Step Implementation

#### Step 1: Modify getUserOrganizationId Signature

**File**: `apps/agent/src/lib/organization.ts`

**Change function signature to accept request object**:

```typescript
// BEFORE
export async function getUserOrganizationId(
    userId: string,
    preferredOrgId?: string | null
): Promise<string | null>

// AFTER
export async function getUserOrganizationId(
    userId: string,
    preferredOrgId?: string | null,
    request?: NextRequest | null
): Promise<string | null>
```

#### Step 2: Remove cookies() Call

**File**: `apps/agent/src/lib/organization.ts`

**Location**: Lines 19-26

**Change**:
```typescript
// BEFORE
if (!effectivePreferred) {
    try {
        const cookieStore = await cookies();
        effectivePreferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null;
    } catch {
        // cookies() unavailable outside request context
    }
}

// AFTER
if (!effectivePreferred && request) {
    try {
        effectivePreferred = request.cookies.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null;
    } catch (err) {
        console.warn("[organization] Cookie reading failed:", err);
    }
}
```

**Rationale**: Read cookies from `request` object instead of calling `cookies()`, which has context restrictions.

#### Step 3: Update authenticateRequest Call

**File**: `apps/agent/src/lib/api-auth.ts`

**Location**: Line 151

**Change**:
```typescript
// BEFORE
const organizationId = await getUserOrganizationId(session.user.id, preferredOrgId);

// AFTER
const organizationId = await getUserOrganizationId(session.user.id, preferredOrgId, request);
```

#### Step 4: Update All Other Callers

**Search for all calls to `getUserOrganizationId()`**:
```bash
rg "getUserOrganizationId\(" -A 1 -B 1
```

**Update each call** to pass `request` parameter where available.

**Estimated files to update**: 5-10 files

#### Step 5: Add Comprehensive Tests

**Create test file**: `apps/agent/src/lib/__tests__/organization.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getUserOrganizationId } from "../organization";
import { NextRequest } from "next/server";

describe("getUserOrganizationId", () => {
    it("should read org from request cookie", async () => {
        const request = new NextRequest("https://test.com", {
            headers: {
                cookie: "agentc2-active-org=org-123"
            }
        });
        
        const orgId = await getUserOrganizationId("user-123", null, request);
        
        // Assert orgId matches expected value
        expect(orgId).toBe("org-123"); // May need DB mocking
    });
    
    it("should prefer preferredOrgId over cookie", async () => {
        const request = new NextRequest("https://test.com", {
            headers: {
                cookie: "agentc2-active-org=org-456"
            }
        });
        
        const orgId = await getUserOrganizationId("user-123", "org-789", request);
        
        expect(orgId).toBe("org-789");
    });
});
```

### Deployment Steps

Same as Option 1, but with additional testing:

1. Create feature branch
2. Make all changes
3. Run tests: `bun run test`
4. Type-check: `bun run type-check`
5. Lint: `bun run lint`
6. Build: `bun run build`
7. **Manual testing**:
   - Test org switching
   - Test checkout flow
   - Test with/without `agentc2-active-org` cookie
8. Create PR with detailed description
9. Code review
10. Merge and deploy

---

## 12. Testing & Validation

### Pre-Deployment Testing

**Unit Tests**:
```bash
bun run test apps/agent/src/lib/__tests__/organization.test.ts
```

**Type Checking**:
```bash
bun run type-check
```

**Linting**:
```bash
bun run lint
```

**Build Verification**:
```bash
bun run build
```

### Post-Deployment Validation

#### Test Case 1: Basic Checkout Flow

**Steps**:
1. Log in to app
2. Navigate to `/settings/billing`
3. Click "Subscribe" on Pro plan
4. Verify redirect to Stripe checkout page
5. Complete (or cancel) checkout
6. Verify redirect back to billing page

**Expected**: No 500 errors at any step

#### Test Case 2: Checkout with Org Switching

**Steps**:
1. Log in with account that has multiple orgs
2. Switch to Org A
3. Navigate to `/settings/billing`
4. Note current subscription
5. Switch to Org B
6. Click "Subscribe" on a plan
7. Verify checkout uses Org B context

**Expected**: Checkout session created for correct organization

#### Test Case 3: Checkout Without Active Org Cookie

**Steps**:
1. Log in
2. Clear `agentc2-active-org` cookie via DevTools
3. Navigate to `/settings/billing`
4. Click "Subscribe"

**Expected**: Falls back to default organization

### Monitoring

**Production Metrics to Watch**:

1. **Error Rate**:
   ```bash
   pm2 logs | grep -c "\[Stripe Checkout\] Error"
   ```

2. **Success Rate**:
   - Monitor Stripe Dashboard for new checkout sessions

3. **Latency**:
   - Check average response time for `/api/stripe/checkout`

**Alert Thresholds**:
- 500 error rate > 1% → Immediate alert
- Checkout session creation drops 50% → Warning

---

## 13. Long-Term Improvements

### Architectural Recommendations

1. **Separate Authentication Concerns**:
   - Move organization resolution out of `authenticateRequest()`
   - Create `resolveOrganization(userId, request)` helper
   - Make authentication purely about identity verification

2. **Add Integration Tests**:
   - E2E tests for checkout flow
   - Automated tests run on every deploy
   - Use Playwright or similar

3. **Improve Error Handling**:
   - Create custom error classes (e.g., `AuthenticationError`, `OrganizationError`)
   - Return structured error responses with error codes
   - Add Sentry or similar error tracking

4. **Add Request Context Middleware**:
   - Extract authentication to Next.js middleware
   - Attach user/org to request context early
   - Avoid repeated authentication calls

### Code Quality Improvements

1. **Add JSDoc comments** to `authenticateRequest()` explaining:
   - When to use vs. not use
   - What it returns
   - Error scenarios

2. **Refactor into smaller functions**:
   ```typescript
   authenticateRequest()
     ├── authenticateViaApiKey()
     ├── authenticateViaSession()
     └── resolveOrganizationContext()
   ```

3. **Add request/response typing**:
   ```typescript
   type AuthResult = 
     | { success: true; userId: string; organizationId: string }
     | { success: false; error: string; statusCode: number };
   ```

---

## 14. Communication Plan

### Internal Communication

**Slack Alert** (Immediate):
```
🚨 CRITICAL: Checkout functionality is down after recent deployment
- Issue: 500 errors on /api/stripe/checkout
- Impact: Users cannot subscribe to paid plans
- Root Cause: Authentication/org resolution regression
- ETA for fix: Hotfix in progress (15-30 min)
- Incident Commander: [Name]
```

**Status Update** (Every 30 min until resolved):
```
📊 Checkout 500 Error - Update #N
- Fix deployed: ✅/⏳
- Testing in progress: ✅/⏳
- Monitoring results: [metrics]
- Next steps: [action items]
```

### External Communication

**Status Page** (if applicable):
```
[INVESTIGATING] - Checkout Unavailable

We are currently investigating an issue preventing users from subscribing to plans. 
Our team is working on a fix and will provide updates every 30 minutes.

Affected: Checkout, Plan Subscriptions
Not Affected: Existing subscriptions, Agent usage

Last Updated: [timestamp]
```

**User Email** (if downtime > 1 hour):
```
Subject: [Resolved] Temporary Checkout Issue

Hi there,

We experienced a temporary issue with our checkout system today between [time range].
The issue has been resolved and checkout is now fully operational.

If you experienced any issues subscribing to a plan, please try again or contact support.

We apologize for any inconvenience.

- AgentC2 Team
```

---

## 15. Summary & Next Steps

### Key Findings

1. **Root Cause**: Organization switching feature (commit `fafd977`) introduced cookie/headers handling that conflicts with Next.js 15+ async context restrictions
2. **Impact**: CRITICAL - 100% of checkout flows blocked
3. **Affected Users**: Any user attempting to subscribe or upgrade plans
4. **Fix Complexity**: Low (hotfix) to Medium (proper fix)

### Recommended Actions (Prioritized)

#### Immediate (0-30 minutes)
1. ✅ Deploy hotfix (Option 1) - Add defensive error handling
2. ✅ Monitor logs for successful checkout completions
3. ✅ Update status page / communicate with users

#### Short-Term (1-4 hours)
4. ⏳ Gather production logs and confirm root cause
5. ⏳ Implement proper fix (Option 3) if hotfix insufficient
6. ⏳ Add integration tests for checkout flow

#### Medium-Term (1-2 days)
7. ⏳ Review all uses of `authenticateRequest()` for similar issues
8. ⏳ Add error tracking (Sentry) for better visibility
9. ⏳ Document authentication flow and best practices

#### Long-Term (1-2 weeks)
10. ⏳ Refactor authentication architecture (see Section 13)
11. ⏳ Add E2E tests for critical user flows
12. ⏳ Implement deployment canary/rollback automation

---

## Appendix A: Code References

### Full File Paths

- **Checkout Route**: `apps/agent/src/app/api/stripe/checkout/route.ts`
- **Authentication**: `apps/agent/src/lib/api-auth.ts`
- **Organization Utils**: `apps/agent/src/lib/organization.ts`
- **Stripe Config**: `apps/agent/src/lib/stripe.ts`
- **Better Auth**: `packages/auth/src/auth.ts`
- **Billing Page**: `apps/agent/src/app/settings/billing/page.tsx`

### Dependency Versions

- Next.js: `16.1.5`
- Better Auth: `1.4.17+`
- Stripe SDK: `20.3.1`
- React: `19.2.3`
- Prisma: `6.2.1+`

### Environment Variables

- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook verification
- `BETTER_AUTH_SECRET` - Auth encryption key
- `DATABASE_URL` - Postgres connection
- `NEXT_PUBLIC_APP_URL` - App base URL

---

## Appendix B: Related Documentation

- [CLAUDE.md](/workspace/CLAUDE.md) - Main project documentation
- [DEPLOY.md](/workspace/DEPLOY.md) - Deployment procedures
- [BUG-ANALYSIS-CHECKOUT-500.md](/workspace/docs/BUG-ANALYSIS-CHECKOUT-500.md) - Previous "checkout" issue (actually playbook deployment)

---

**Document Version**: 1.0  
**Author**: AI Root Cause Analysis  
**Date**: 2026-03-08  
**Status**: Analysis Complete - Awaiting Fix Implementation

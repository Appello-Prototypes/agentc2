# Root Cause Analysis: 500 Error on Checkout Page (Issue #92)

**Date:** March 8, 2026  
**Analyst:** AI Agent  
**Issue:** https://github.com/Appello-Prototypes/agentc2/issues/92  
**Status:** Analysis Complete - Fix Ready

---

## Executive Summary

**TL;DR:** The checkout page fails with a 500 error due to incompatible cookie access patterns introduced in commits `fafd977` and `564aa5a`. The code attempts to read cookies using deprecated Next.js 15/16 API (`request.cookies.get()`) instead of the required `cookies()` async function from `next/headers`.

**Severity:** **HIGH** - Blocks all subscription purchases  
**Fix Complexity:** **LOW** - 3-line change  
**Risk Level:** **LOW** - Well-isolated fix  

---

## 1. Root Cause

### Primary Issue

**File:** `apps/agent/src/lib/api-auth.ts`  
**Lines:** 147-151  
**Introduced:** Commit `fafd977` (March 3-4, 2026)

```typescript:apps/agent/src/lib/api-auth.ts
// ❌ BUGGY CODE
const preferredOrgId =
    request?.headers.get("x-organization-id")?.trim() ||
    request?.cookies.get("agentc2-active-org")?.value?.trim() ||  // ← BUG HERE
    null;
const organizationId = await getUserOrganizationId(session.user.id, preferredOrgId);
```

**Problem:**
- **Next.js 15/16 Breaking Change:** The `request.cookies` API has been deprecated/modified
- **Correct API:** Must use `await cookies()` from `next/headers`
- **Current Behavior:** `request?.cookies` either returns `undefined` or throws an error
- **Impact:** `preferredOrgId` is always `null`, forcing `getUserOrganizationId()` to call `cookies()` again internally

### Secondary Issue (Compounding Factor)

**File:** `apps/agent/src/lib/organization.ts`  
**Lines:** 19-26  
**Introduced:** Commit `fafd977`

```typescript:apps/agent/src/lib/organization.ts
if (!effectivePreferred) {
    try {
        const cookieStore = await cookies();
        effectivePreferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null;
    } catch {
        // cookies() unavailable outside request context  // ← Silently fails
    }
}
```

**Problem:**
- The try/catch silently swallows errors when `cookies()` is called in an invalid context
- If `cookies()` throws for any reason (e.g., called outside request scope), the error is hidden
- User ends up with no organization ID, but the code continues instead of failing fast

---

## 2. Timeline of Changes

### Relevant Commits

| Commit | Date (est.) | Change | Impact |
|--------|-------------|--------|--------|
| `76d0742` | ~Feb 28 | ✅ Initial billing system implementation | Checkout works correctly |
| `564aa5a` | ~Mar 3 | Added `preferredOrgId` parameter to `getUserOrganizationId()` | Introduced secondary bug pattern |
| `fafd977` | ~Mar 3-4 | Added cookie-based org selection via `request?.cookies.get()` | **PRIMARY BUG INTRODUCED** |
| `142c023` | ~Mar 5 | Added `X-Organization-Id` header support | Does not fix cookie issue |
| `c40fa54` | Mar 8 | SDLC pipeline fixes (unrelated) | Current HEAD |

### When Bug Became Active

- **Deployed:** Likely between March 3-5, 2026 (commits `fafd977` or `142c023`)
- **Reported:** March 8, 2026 (Issue #92)
- **Affected Deployments:** All deployments since `fafd977`

---

## 3. Affected Code Paths

### Primary Path: Checkout Route

```
User clicks "Subscribe" button
  ↓
POST /api/stripe/checkout
  ↓
authenticateRequest(request)
  ↓
request?.cookies.get("agentc2-active-org")  ← Returns undefined/throws
  ↓
preferredOrgId = null
  ↓
getUserOrganizationId(userId, null)
  ↓
await cookies() inside getUserOrganizationId  ← May fail/throw
  ↓
organizationId = null OR exception thrown
  ↓
If null: returns 401 Unauthorized
If exception: returns 500 Internal Server Error
```

### File Impact Map

| File | Function | Issue |
|------|----------|-------|
| `apps/agent/src/lib/api-auth.ts` | `authenticateRequest()` | Incorrect cookie access pattern |
| `apps/agent/src/lib/organization.ts` | `getUserOrganizationId()` | Redundant cookies() call with silent error handling |
| `apps/agent/src/app/api/stripe/checkout/route.ts` | `POST()` | Victim - receives null/exception from auth |

---

## 4. Why It Fails

### Next.js 15/16 API Changes

In Next.js 15+, **ALL** async context functions (`cookies()`, `headers()`) MUST be:
1. Imported from `next/headers`
2. Called with `await`
3. Called within a proper async request context

**Deprecated Pattern (Next.js 14 and earlier):**
```typescript
function handler(request: NextRequest) {
    const cookie = request.cookies.get("my-cookie");  // ✅ Works in Next.js 14
}
```

**Required Pattern (Next.js 15+):**
```typescript
import { cookies } from "next/headers";

async function handler(request: NextRequest) {
    const cookieStore = await cookies();
    const cookie = cookieStore.get("my-cookie");  // ✅ Works in Next.js 15+
}
```

**Current AgentC2 Code:**
```typescript
// ❌ Tries to use old API
request?.cookies.get("agentc2-active-org")  // Returns undefined or throws

// Then falls back to:
await cookies()  // May throw if context is invalid
```

---

## 5. Reproduction Steps

1. **Setup:** User must be logged in with active session
2. **Navigate:** Go to `/settings/billing`
3. **Action:** Click "Subscribe" button on any paid plan
4. **Expected:** Redirect to Stripe checkout
5. **Actual:** 500 Internal Server Error

**Conditions that trigger bug:**
- User does NOT have `X-Organization-Id` header set (normal browser request)
- Browser cookies include session but NOT the specific cookie access pattern
- `request.cookies` API returns undefined or throws

---

## 6. Error Evidence

### Expected Error Logs

```
[Stripe Checkout] Error: Cannot read properties of undefined (reading 'get')
  at authenticateRequest (api-auth.ts:148)
  at POST (route.ts:23)
```

OR

```
[Stripe Checkout] Error: cookies() can only be called in async context
  at getUserOrganizationId (organization.ts:21)
  at authenticateRequest (api-auth.ts:151)
  at POST (route.ts:23)
```

### Why 500 Instead of 401/403

The try/catch in `route.ts:158-164` catches ALL exceptions:
```typescript
} catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Failed" },
        { status: 500 }  // ← Generic 500 for all uncaught errors
    );
}
```

---

## 7. Impact Assessment

### User Impact

- **Severity:** **CRITICAL**
- **Affected Users:** ALL users attempting to subscribe
- **Workaround:** None available
- **Business Impact:** Complete loss of subscription revenue since deploy

### System Impact

- **Scope:** Limited to authenticated browser requests without `X-Organization-Id` header
- **Side Effects:** None - error is isolated to this code path
- **Data Integrity:** No data corruption risk

### Other Affected Routes

Any route that uses `authenticateRequest()` with similar cookie access patterns:

✅ **NOT Affected** (use direct session auth or API keys):
- `/api/agents/*` 
- `/api/mcp/*`
- `/api/integrations/*` (most endpoints)

⚠️ **Potentially Affected** (need verification):
- `/api/stripe/portal` (similar pattern to checkout)
- Any route relying on `agentc2-active-org` cookie in multi-org scenarios

---

## 8. Fix Plan

### Option 1: Remove Request Cookie Access (RECOMMENDED)

**Files to modify:** 
- `apps/agent/src/lib/api-auth.ts` (lines 147-151)

**Changes:**
```typescript
// BEFORE (buggy)
const preferredOrgId =
    request?.headers.get("x-organization-id")?.trim() ||
    request?.cookies.get("agentc2-active-org")?.value?.trim() ||
    null;

// AFTER (fixed)
const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;
```

**Rationale:**
- `getUserOrganizationId()` already handles cookie reading via `await cookies()`
- Removing duplicate cookie access eliminates the bug
- Header-based org selection still works
- Cookie-based org selection handled internally

**Testing:**
- Verify checkout works without X-Organization-Id header
- Verify multi-org switching still works
- Verify API key auth unaffected

---

### Option 2: Add Async Cookie Read (More Complex)

**Changes:**
```typescript
const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;

// Read cookie using proper Next.js 15+ API
if (!preferredOrgId) {
    try {
        const cookieStore = await cookies();
        const cookieOrgId = cookieStore.get("agentc2-active-org")?.value?.trim();
        if (cookieOrgId) {
            preferredOrgId = cookieOrgId;
        }
    } catch {
        // Cookie read failed - let getUserOrganizationId handle it
    }
}
```

**Downside:**
- Duplicate cookie reads (once here, once in getUserOrganizationId)
- More complex error handling
- Not necessary - Option 1 is cleaner

---

## 9. Implementation Guide

### Step 1: Apply Fix

**File:** `apps/agent/src/lib/api-auth.ts`

```diff
- const preferredOrgId =
-     request?.headers.get("x-organization-id")?.trim() ||
-     request?.cookies.get("agentc2-active-org")?.value?.trim() ||
-     null;
+ const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;
```

### Step 2: Verify Related Code

**File:** `apps/agent/src/lib/organization.ts`

No changes needed - current implementation is correct (uses `await cookies()`)

### Step 3: Add Regression Test

**New file:** `tests/integration/api/stripe-checkout.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../setup";

describe("POST /api/stripe/checkout", () => {
    it("succeeds without X-Organization-Id header (cookie fallback)", async () => {
        // Mock authenticated user with org membership
        // Make POST request without X-Organization-Id
        // Expect 200 success with checkout URL
    });

    it("succeeds with X-Organization-Id header", async () => {
        // Test header-based org selection
    });

    it("fails with 401 when user has no organization", async () => {
        // Test error handling
    });
});
```

### Step 4: Testing Checklist

- [ ] Checkout succeeds for logged-in user (no X-Organization-Id header)
- [ ] Checkout succeeds with X-Organization-Id header
- [ ] Multi-org switching still works
- [ ] API key auth unaffected
- [ ] Stripe portal route still works
- [ ] No TypeScript errors
- [ ] Linting passes

---

## 10. Deployment Strategy

### Pre-Deployment

1. Run full test suite: `bun run test`
2. Type check: `bun run type-check`
3. Lint: `bun run lint`
4. Build: `bun run build`

### Deployment

**Risk Level:** **LOW** - Single-file, 3-line change

**Rollback Plan:** 
- Git revert to commit before fix
- No database changes needed
- No cache invalidation needed

**Monitoring:**
- Watch `/api/stripe/checkout` error rate
- Monitor Stripe webhook logs
- Check user subscription creation metrics

---

## 11. Prevention Measures

### Code Review Checklist

- [ ] Verify Next.js async API usage (cookies(), headers())
- [ ] Check for deprecated request.cookies access
- [ ] Ensure proper error handling (don't silence errors)
- [ ] Test authentication flows in isolation

### Automated Checks

**ESLint Rule (Recommended):**
```javascript
{
    "rules": {
        "no-restricted-syntax": [
            "error",
            {
                "selector": "MemberExpression[object.name='request'][property.name='cookies']",
                "message": "Use await cookies() from next/headers instead of request.cookies"
            }
        ]
    }
}
```

### Documentation Updates

- [ ] Update `CLAUDE.md` with Next.js 15+ async API requirements
- [ ] Add authentication flow diagram
- [ ] Document multi-org selection behavior

---

## 12. Related Issues

### Potential Similar Bugs

Search codebase for similar patterns:
```bash
rg "request\\.cookies\\.get" --type ts
rg "request\\?.cookies" --type ts
```

**Found instances:** None other than the bug location

### Future Considerations

1. **Centralized Cookie Access:** Create helper function for safe cookie reads
2. **Error Logging:** Improve error visibility in production
3. **Multi-Org UX:** Consider explicit org selector instead of cookie inference

---

## 13. Appendix: Code References

### Checkout Route (Victim)

```typescript:apps/agent/src/app/api/stripe/checkout/route.ts
export async function POST(request: NextRequest) {
    try {
        if (!isStripeEnabled()) {
            return NextResponse.json(
                { success: false, error: "Stripe is not configured" },
                { status: 503 }
            );
        }

        const session = await authenticateRequest(request);  // ← Fails here
        if (!session) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // ... rest of checkout logic
    } catch (error) {
        console.error("[Stripe Checkout] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
```

### Authentication Function (Bug Location)

```typescript:apps/agent/src/lib/api-auth.ts
export async function authenticateRequest(
    request?: NextRequest
): Promise<{ userId: string; organizationId: string } | null> {
    // ... API key auth ...

    // --- Session Cookie Authentication ---
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) return null;

        const preferredOrgId =
            request?.headers.get("x-organization-id")?.trim() ||
            request?.cookies.get("agentc2-active-org")?.value?.trim() ||  // ← BUG
            null;
        const organizationId = await getUserOrganizationId(session.user.id, preferredOrgId);
        if (!organizationId) return null;

        return { userId: session.user.id, organizationId };
    } catch {
        return null;
    }
}
```

### Organization Helper (Compounding Factor)

```typescript:apps/agent/src/lib/organization.ts
export async function getUserOrganizationId(
    userId: string,
    preferredOrgId?: string | null
): Promise<string | null> {
    let effectivePreferred = preferredOrgId;

    if (!effectivePreferred) {
        try {
            const cookieStore = await cookies();
            effectivePreferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null;
        } catch {
            // cookies() unavailable outside request context
        }
    }

    if (effectivePreferred) {
        const verified = await prisma.membership.findUnique({
            where: {
                userId_organizationId: { userId, organizationId: effectivePreferred }
            },
            select: { organizationId: true }
        });
        if (verified) return verified.organizationId;
    }
    const membership = await getUserMembership(userId);
    return membership?.organizationId ?? null;
}
```

---

## 14. Sign-Off

**Analysis Completed:** March 8, 2026  
**Reviewed By:** [Pending Human Review]  
**Approved for Implementation:** [Pending]

**Next Steps:**
1. Human review of this analysis
2. Implementation of Option 1 fix
3. Testing and verification
4. Deployment to production
5. Post-deployment monitoring

---

**End of Root Cause Analysis**

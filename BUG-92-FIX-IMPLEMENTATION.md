# Bug #92 Fix Implementation Guide

**Issue:** 500 error on checkout page  
**Root Cause:** Redundant cookie access pattern causing context issues  
**Fix Complexity:** LOW (3-line change)  
**Risk:** LOW

---

## Quick Fix

### File to Modify
`apps/agent/src/lib/api-auth.ts` (lines 147-151)

### Change

```diff
--- a/apps/agent/src/lib/api-auth.ts
+++ b/apps/agent/src/lib/api-auth.ts
@@ -144,10 +144,7 @@
         });
         if (!session?.user) return null;
 
-        const preferredOrgId =
-            request?.headers.get("x-organization-id")?.trim() ||
-            request?.cookies.get("agentc2-active-org")?.value?.trim() ||
-            null;
+        const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;
         const organizationId = await getUserOrganizationId(session.user.id, preferredOrgId);
         if (!organizationId) return null;
```

### Rationale

- **Problem:** Attempting to read cookies from `request.cookies` before passing to `getUserOrganizationId()`, which then calls `await cookies()` internally
- **Issue:** In Next.js 15/16, mixing synchronous cookie reads (`request.cookies`) with async cookie reads (`await cookies()`) in the same request context can cause conflicts
- **Solution:** Remove the synchronous cookie read; let `getUserOrganizationId()` handle cookie reading via proper async API
- **Benefit:** Single source of truth for cookie reading, proper async context handling

---

## Testing Checklist

### Pre-Deployment Tests

```bash
# 1. Type check
bun run type-check

# 2. Lint
bun run lint

# 3. Format
bun run format

# 4. Build
bun run build
```

### Manual Testing

1. **Checkout Flow (Primary Fix)**
   - [ ] Navigate to `/settings/billing`
   - [ ] Click "Subscribe" on a paid plan
   - [ ] Verify redirect to Stripe checkout (no 500 error)
   - [ ] Complete checkout and verify success redirect

2. **Multi-Org Switching**
   - [ ] Create/join multiple organizations
   - [ ] Switch between orgs via org switcher
   - [ ] Verify active org persists across page loads
   - [ ] Test checkout from different org contexts

3. **Header-Based Org Selection**
   - [ ] Send API request with `X-Organization-Id` header
   - [ ] Verify correct org context is used
   - [ ] Test with invalid org ID (should fall back gracefully)

4. **API Key Authentication**
   - [ ] Test MCP tool calls with API key
   - [ ] Verify org context resolution still works
   - [ ] Test with `X-Organization-Slug` header

### Regression Tests

- [ ] Stripe portal route (`/api/stripe/portal`) still works
- [ ] Organization budget routes work
- [ ] Agent chat continues to work
- [ ] Integration setup flows work
- [ ] No TypeScript errors introduced

---

## Deployment Steps

### 1. Pre-Deployment

```bash
# Ensure clean working directory
git status

# Run all checks
bun run type-check && bun run lint && bun run build
```

### 2. Commit

```bash
git add apps/agent/src/lib/api-auth.ts
git commit -m "fix: remove redundant cookie access in authenticateRequest (#92)

Fixes 500 error on checkout page by removing synchronous cookie read
that conflicts with async cookies() call in getUserOrganizationId().

The preferredOrgId now only reads from X-Organization-Id header,
allowing getUserOrganizationId() to handle cookie-based org selection
via proper async cookies() API.

Fixes #92"
```

### 3. Push

```bash
git push origin HEAD
```

### 4. Monitor

After deployment, monitor:
- `/api/stripe/checkout` error rate (should drop to 0%)
- Stripe webhook logs for successful subscriptions
- User feedback on billing page

---

## Rollback Plan

If issues occur:

```bash
# Revert the commit
git revert HEAD

# Push rollback
git push origin HEAD
```

**No database changes needed** - this is purely a code fix.

---

## Related Files

### Files Changed
- `apps/agent/src/lib/api-auth.ts` - Main fix

### Files Affected (no changes needed)
- `apps/agent/src/lib/organization.ts` - Cookie reading logic (correct as-is)
- `apps/agent/src/app/api/stripe/checkout/route.ts` - Checkout route (victim)
- `apps/agent/src/app/api/stripe/portal/route.ts` - Portal route (also affected)

### Other Routes Using Similar Pattern
These routes use `request.cookies.get()` directly and appear to work correctly:
- `apps/agent/src/app/api/organizations/switch/route.ts`
- `apps/agent/src/proxy.ts` (embed cookie parsing)
- `apps/admin/src/app/api/auth/google/callback/route.ts`

**Why they work:** They don't mix synchronous `request.cookies` with async `await cookies()` in nested function calls.

---

## Why This Fix Works

### Current Flow (Broken)

```
authenticateRequest(request)
  ├─> await auth.api.getSession({ headers: await headers() })  ✅
  ├─> request?.cookies.get("agentc2-active-org")  ⚠️ Synchronous read
  └─> getUserOrganizationId(userId, preferredOrgId)
       └─> if (!preferredOrgId):
            └─> await cookies()  ❌ Async read conflicts
```

**Problem:** Mixing sync cookie read with async cookie read in nested calls causes Next.js context issues.

### Fixed Flow

```
authenticateRequest(request)
  ├─> await auth.api.getSession({ headers: await headers() })  ✅
  ├─> request?.headers.get("x-organization-id")  ✅ Header read (not cookie)
  └─> getUserOrganizationId(userId, preferredOrgId)
       └─> if (!preferredOrgId):
            └─> await cookies()  ✅ Single async cookie read
```

**Solution:** Single source of cookie reading via async API, no conflicts.

---

## Post-Deployment Verification

### Success Criteria

1. ✅ Checkout completes without 500 error
2. ✅ Subscriptions are created in Stripe
3. ✅ Multi-org switching continues to work
4. ✅ No regression in API key auth
5. ✅ No increase in other error rates

### Metrics to Watch

- **Error Rate:** `/api/stripe/checkout` should drop from ~100% to 0%
- **Success Rate:** Stripe subscription creation should return to normal
- **Response Time:** Should remain under 500ms
- **User Reports:** Issue #92 should resolve

---

## Additional Notes

### Why Not Fix getUserOrganizationId?

**Option A (rejected):** Remove `await cookies()` call from `getUserOrganizationId()`
- **Downside:** Breaks cookie-based org selection for other routes
- **Complexity:** Would require updating all callers

**Option B (chosen):** Remove synchronous cookie read from `authenticateRequest()`
- **Benefit:** Single source of truth, minimal change
- **Safety:** Existing async cookie read is already tested and working

### Future Improvements

1. **Centralized Cookie Helper:**
   ```typescript
   export async function getActiveOrganizationId(
       userId: string,
       request?: NextRequest
   ): Promise<string | null> {
       // Centralized logic for org selection
   }
   ```

2. **ESLint Rule:**
   Prevent mixing sync `request.cookies` with async `await cookies()`:
   ```javascript
   {
       "no-restricted-syntax": [
           "error",
           {
               "selector": "MemberExpression[object.name='request'][property.name='cookies']",
               "message": "Use await cookies() instead of request.cookies when calling nested async functions"
           }
       ]
   }
   ```

3. **Explicit Org Selector UI:**
   Add visible org switcher instead of relying on cookie inference

---

## Questions?

- **Q:** Will this break API key authentication?
  - **A:** No - API key auth uses separate code path (lines 31-138)

- **Q:** Will this break multi-org switching?
  - **A:** No - `getUserOrganizationId()` handles cookie reading correctly

- **Q:** Will this affect the portal route?
  - **A:** Yes (positively) - it was likely also broken, now fixed

- **Q:** Do we need a database migration?
  - **A:** No - pure code fix

- **Q:** Can we deploy during business hours?
  - **A:** Yes - low risk, immediate rollback available

---

**Implementation Time Estimate:** 5 minutes  
**Testing Time Estimate:** 15 minutes  
**Total Time to Deploy:** 20 minutes

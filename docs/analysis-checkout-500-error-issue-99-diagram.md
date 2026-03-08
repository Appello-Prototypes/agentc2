# Technical Flow Diagram: Checkout 500 Error

## Bug Execution Path

```
┌──────────────────────────────────────────────────────────────────┐
│ User Action: Click "Subscribe" on /settings/billing             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ POST /api/stripe/checkout         │
         │ (checkout/route.ts:14)            │
         └───────────┬───────────────────────┘
                     │
                     ▼
         ┌───────────────────────────────────┐
         │ authenticateRequest(request)      │
         │ (api-auth.ts:23)                  │
         └───────────┬───────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐          ┌────────────────────┐
│ Line 143:     │          │ Lines 147-149:     │
│ await headers()│          │ SYNC cookie read   │
│               │          │ request.cookies    │
│ (ASYNC ✓)    │          │ .get("agentc2-     │
│               │          │   active-org")     │
└───────────────┘          └────────┬───────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ Line 151:             │
                        │ getUserOrganizationId │
                        │ (organization.ts:13)  │
                        └───────────┬───────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ Line 21:              │
                        │ await cookies()       │
                        │ (ASYNC ✓)            │
                        └───────────┬───────────┘
                                    │
                                    ▼
        ┌───────────────────────────────────────────────┐
        │ Next.js 16 Runtime Detection:                │
        │ "Mixing sync + async cookie access!"         │
        │                                               │
        │ ❌ Throws Error                              │
        └───────────────────┬───────────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │ Caught by checkout route try-catch    │
        │ (checkout/route.ts:158)               │
        └────────────┬───────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────┐
        │ Returns 500 with generic error        │
        │ { success: false, error: "Failed" }   │
        └────────────────────────────────────────┘
```

---

## Data Flow Comparison: Before vs After Fix

### BEFORE (Current - Broken)

```
authenticateRequest(request)
    ├─ auth.api.getSession({ headers: await headers() })  ← ASYNC
    ├─ preferredOrgId = request.cookies.get("agentc2-active-org")  ← SYNC ❌
    └─ getUserOrganizationId(userId, preferredOrgId)
           └─ cookieStore = await cookies()  ← ASYNC ❌
           
           ⚠️ CONFLICT: Sync cookie.get() + Async cookies()
           ⚠️ Next.js 16 throws error → 500 response
```

### AFTER (Fixed)

```
authenticateRequest(request)
    ├─ auth.api.getSession({ headers: await headers() })  ← ASYNC
    ├─ preferredOrgId = request.headers.get("x-organization-id")  ← SYNC (headers only)
    └─ getUserOrganizationId(userId, preferredOrgId)
           └─ cookieStore = await cookies()  ← ASYNC
           └─ reads "agentc2-active-org" cookie here  ← Properly async
           
           ✅ All cookie access is async
           ✅ No runtime conflict
           ✅ Request completes successfully
```

---

## Cookie Resolution Logic

### Organization Selection Priority (Current Behavior)

```
1. X-Organization-Id header (explicitly set by client)
   ↓ (if not present)
2. agentc2-active-org cookie (user's last selected org)
   ↓ (if not present or invalid)
3. User's first/default organization (oldest membership)
```

### After Fix (Same Priority, Different Timing)

```
1. X-Organization-Id header
   ↓ (if not present, passed as null to getUserOrganizationId)
2. getUserOrganizationId() reads agentc2-active-org cookie (async)
   ↓ (if not present or invalid)
3. Falls back to user's first/default organization
```

**Key insight:** The fix doesn't change the **logic**, only **when** the cookie is read (now inside `getUserOrganizationId()` instead of in `authenticateRequest()`).

---

## Affected Request Types

### Primary (Session-Based)

```
Browser → POST /api/stripe/checkout
         │
         ├─ Cookie: session token (Better Auth)
         ├─ Cookie: agentc2-active-org (org context)
         │
         └─► authenticateRequest(request)
             └─► ❌ CRASHES due to cookie mixing
```

### Unaffected (API Key-Based)

```
MCP Client → POST /api/mcp/tools/[tool]
            │
            ├─ Header: X-API-Key
            ├─ Header: X-Organization-Slug
            │
            └─► authenticateRequest(request)
                └─► ✅ WORKS (skips cookie logic, exits early)
```

**Why API key auth is unaffected:**
- Lines 26-138 in `api-auth.ts` handle API key auth
- Returns early if API key is valid (line 137)
- Never reaches session cookie logic (lines 140-157)

---

## Multi-Org User Scenario (Why Bug Triggers)

### Scenario: User switches organizations

```
Step 1: User logs in (default org: "acme-corp")
  Cookie set: session=abc123

Step 2: User switches to "widgets-inc"
  POST /api/organizations/switch { organizationId: "widgets-inc" }
  Cookie set: agentc2-active-org=widgets-inc

Step 3: User clicks "Subscribe" on billing page
  POST /api/stripe/checkout { planSlug: "pro" }
  Cookies sent: session=abc123, agentc2-active-org=widgets-inc
  
  authenticateRequest() attempts to read agentc2-active-org...
  ❌ CRASH: Sync cookie.get() conflicts with async cookies()
  
  Result: 500 error, checkout fails
```

### Single-Org User (Less Likely to Trigger)

```
Step 1: User logs in (only org: "solo-corp")
  Cookie set: session=xyz789
  Cookie NOT set: agentc2-active-org (not needed)

Step 2: User clicks "Subscribe"
  POST /api/stripe/checkout { planSlug: "pro" }
  Cookies sent: session=xyz789
  
  authenticateRequest() reads cookies...
  request.cookies.get("agentc2-active-org") → undefined
  
  May still crash if:
  - await headers() happens before sync cookie read
  - Next.js runtime detects potential mixing
  
  Result: May work intermittently or consistently fail
```

**Conclusion:** Bug is **most reproducible** for multi-org users, but **may affect all users** depending on Next.js runtime behavior.

---

## Code Locations Quick Reference

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `apps/agent/src/lib/api-auth.ts` | 149 | Sync cookie access | 🔴 HIGH |
| `apps/agent/src/lib/organization.ts` | 21 | Async cookie access (correct) | ✅ OK |
| `apps/agent/src/app/api/stripe/checkout/route.ts` | 23 | Calls authenticateRequest | 🔴 HIGH |
| `apps/agent/src/app/api/stripe/portal/route.ts` | 21 | Calls authenticateRequest | 🔴 HIGH |
| `apps/agent/src/app/api/organizations/switch/route.ts` | 114 | Sync cookie access | 🟡 MEDIUM |
| `apps/agent/src/proxy.ts` | 47 | Sync cookie access (middleware) | 🟢 LOW |

---

## Fix Implementation

### What to merge:
**Branch:** `origin/fix/checkout-500-error-issue-94` (commit 248dc94)

### What changes:
**Single file:** `apps/agent/src/lib/api-auth.ts`  
**Lines removed:** 3 (lines 147-149)  
**Lines added:** 1 (line 147)

### Why it works:
- Removes sync `request.cookies.get()` call
- Cookie is still read (inside `getUserOrganizationId()` via async `await cookies()`)
- No functionality lost, just accessed asynchronously
- Fixes 400+ downstream endpoints automatically

---

## Timeline

**Bug introduced:** During Next.js 15 → 16 migration (multi-org cookie support added)  
**First reported:** Issue #83 (earlier instance)  
**First fix created:** 2026-03-08 19:17 UTC (issue #92)  
**Fix validated:** 2026-03-08 19:29 UTC (issue #94)  
**Current issue:** #99 (2026-03-08 19:51 UTC)  
**Elapsed time unfixed:** 34 minutes (since last fix branch) to ongoing

---

## Deployment Steps

```bash
# 1. Checkout fix branch
git fetch origin
git checkout origin/fix/checkout-500-error-issue-94

# 2. Validate
bun run type-check
bun run lint
bun run build

# 3. Merge to main
git checkout main
git merge origin/fix/checkout-500-error-issue-94
git push origin main

# 4. Monitor deployment (automatic via GitHub Actions)
# Wait for deploy-do.yml workflow to complete

# 5. Verify in production
curl https://[domain]/agent/api/health
# Test checkout manually
```

---

## Success Criteria

- [ ] Checkout page loads without 500 error
- [ ] Users can subscribe to paid plans
- [ ] Stripe session created successfully
- [ ] No regression in other API routes
- [ ] Zero 500 errors on `/api/stripe/checkout` for 24 hours

---

**Next steps:** Proceed with merge and deploy (recommended within 1 hour)

Full technical analysis: `docs/analysis-checkout-500-error-issue-99.md`

# Executive Summary: Checkout 500 Error (Issue #99)

**Issue:** https://github.com/Appello-Prototypes/agentc2/issues/99  
**Status:** 🔴 Active in production  
**Severity:** HIGH (blocks revenue)  
**Fix Status:** ✅ Solution exists, not deployed

---

## The Problem

Users see **500 errors** when clicking "Subscribe" on the billing page. The checkout API endpoint crashes due to conflicting cookie access patterns in Next.js 16.

---

## Root Cause (1 sentence)

The `authenticateRequest()` function mixes synchronous cookie reads (`request.cookies.get()`) with asynchronous cookie reads (`await cookies()` inside `getUserOrganizationId()`), which Next.js 16 forbids.

---

## Why It's Not Fixed Yet

**Critical finding:** Three fix branches (#92, #93, #94) exist with the correct solution, but **none were merged to main**. The bug persists because fixes were never deployed.

```
* 248dc94 (fix branch #94) ← Fix exists here
| * 38b30a2 (fix branch #93) ← Fix exists here  
|/
| * 2cd4a18 (fix branch #92) ← Fix exists here
|/
* c40fa54 (main) ← Production (no fix)
```

---

## The Fix (3 lines)

**File:** `apps/agent/src/lib/api-auth.ts` (lines 147-150)

**Change:** Remove synchronous cookie access, delegate to async function

```diff
- const preferredOrgId =
-     request?.headers.get("x-organization-id")?.trim() ||
-     request?.cookies.get("agentc2-active-org")?.value?.trim() ||
-     null;
+ const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;
```

---

## Impact

**Scope:** 400+ API endpoints (checkout, billing, agents, workflows, integrations, etc.)

**User-facing:**
- ❌ Cannot subscribe to paid plans
- ❌ Cannot access billing portal
- ⚠️ Other API routes potentially affected for multi-org users

**Revenue impact:** Blocking all new subscriptions

---

## Action Plan

### Immediate (1 hour)
1. ✅ Merge `origin/fix/checkout-500-error-issue-94` to `main`
2. ✅ Deploy to production
3. ✅ Test checkout flow
4. ✅ Close issues #92, #93, #94, #99

### Follow-up (1 week)
1. 🟡 Fix organization switch route (same bug)
2. 🔵 Add regression tests
3. 🟡 Audit codebase for similar patterns

---

## Risk Assessment

**Deployment risk:** LOW ✅
- Minimal change (3 lines)
- Already tested in fix branches
- Preserves functionality (cookie still read, just asynchronously)
- No schema changes, no dependencies
- Fast rollback if needed (< 5 min)

**Business risk of NOT fixing:** HIGH 🔴
- Checkout broken = no new revenue
- User frustration and support tickets
- Impacts platform credibility

---

## Recommendation

**Deploy immediately.** The fix is validated, low-risk, and unblocks critical revenue flow.

---

Full analysis: `docs/analysis-checkout-500-error-issue-99.md`

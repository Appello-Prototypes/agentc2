# Quick Reference: Issue #110 - Checkout 500 Error

**ONE-PAGE CHEAT SHEET** for developers who need just the facts.

---

## The Bug (30-Second Explanation)

**What**: 500 error on checkout page  
**Why**: Mixing sync (`request.cookies.get()`) and async (`await cookies()`) cookie access  
**Where**: `apps/agent/src/lib/api-auth.ts` lines 146-149  
**Impact**: 165 API routes, all browser-based authentication  
**Severity**: CRITICAL (revenue-blocking)

---

## The Fix (3 Lines)

**File**: `apps/agent/src/lib/api-auth.ts`

**Remove this**:
```typescript
const preferredOrgId =
    request?.headers.get("x-organization-id")?.trim() ||
    request?.cookies.get("agentc2-active-org")?.value?.trim() ||  // ❌ DELETE THESE 2 LINES
    null;
```

**Replace with**:
```typescript
const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;
```

**That's it.** Cookie-based org selection still works - it's handled in `getUserOrganizationId()`.

---

## Quick Deploy

```bash
# Merge existing fix
git checkout main
git pull origin main
git merge origin/fix/checkout-500-error-issue-99

# Quality checks
bun run type-check && bun run lint && bun run build

# Push
git push origin main

# Deploy (auto via GitHub Actions or manual SSH)
```

**Time**: 35 minutes  
**Risk**: LOW

---

## Why This Happened

The fix exists in branch `origin/fix/checkout-500-error-issue-99` (commit `4b6de68`) but was **never merged to main**. This is a **process failure**, not a regression.

---

## Verification

### Before Fix
```bash
curl http://localhost:3001/api/stripe/checkout \
  -X POST \
  -H "Cookie: auth-session=..." \
  -H "Content-Type: application/json" \
  -d '{"planSlug": "pro"}'

# ❌ Returns: 500 Internal Server Error
```

### After Fix
```bash
curl http://localhost:3001/api/stripe/checkout \
  -X POST \
  -H "Cookie: auth-session=..." \
  -H "Content-Type: application/json" \
  -d '{"planSlug": "pro"}'

# ✅ Returns: 200 OK with {"success": true, "url": "https://checkout.stripe.com/..."}
```

---

## Affected Routes (Sample)

All routes using `authenticateRequest()` with session cookies:

- `/api/stripe/checkout` ← **PRIMARY ISSUE**
- `/api/stripe/portal`
- `/api/organizations/[orgId]/subscription`
- `/api/agents/*`
- `/api/workflows/*`
- ... (162 more)

**API key auth**: UNAFFECTED

---

## Technical Details

**Next.js 15+ Requirement**: `cookies()` must be awaited

**Conflict Pattern**:
```typescript
// ❌ WRONG (causes 500 error)
const val = request.cookies.get("cookie-name")?.value;  // Sync
const store = await cookies();                          // Async
// Next.js throws error when both exist in same request

// ✅ CORRECT
const store = await cookies();                          // Async only
const val = store.get("cookie-name")?.value;
```

**Our bug**: `authenticateRequest()` uses sync access, then calls `getUserOrganizationId()` which uses async access → error.

---

## Risk Assessment

| Factor | Level | Notes |
|--------|-------|-------|
| Code Complexity | LOW | 3-line removal |
| Test Coverage | MEDIUM | Fix tested in branch |
| Blast Radius | HIGH | 165 routes affected |
| Rollback | EASY | Simple git revert |
| **Overall Risk** | **LOW** | Fix is proven |

---

## Testing Checklist

### Before Deploy
- [ ] `bun run type-check` → PASS
- [ ] `bun run lint` → PASS
- [ ] `bun run build` → PASS
- [ ] Local checkout test → No 500 error

### After Deploy
- [ ] Production logs show no 500 errors
- [ ] Manual checkout test in prod → Success
- [ ] Monitor error rates for 1 hour

---

## Rollback Plan

If something goes wrong:
```bash
git revert HEAD
git push origin main
# Redeploy
```

**Note**: Rollback restores the bug, but no worse than current state.

---

## Process Improvements Needed

1. **Merge workflow**: Why weren't 4 fix branches merged?
2. **Deployment verification**: Add smoke tests
3. **Monitoring**: Alert on revenue-critical endpoint failures
4. **Branch cleanup**: Delete orphaned fix branches

---

## Related Branches (All Have Same Fix)

- `origin/fix/checkout-page-500-error` (issue #92)
- `origin/fix/checkout-500-error-issue-93` (issue #93)
- `origin/fix/checkout-500-error-issue-94` (issue #94)
- `origin/fix/checkout-500-error-issue-99` (issue #99) ⭐ **Use this one**

**All unmerged. Pick any one and merge it.**

---

## One-Line Summary

> Next.js 15+ requires async cookie access, but `api-auth.ts` uses sync access before calling async code, causing 500 errors; fix exists in unmerged branch, just needs merge + deploy.

---

## For More Details

- **Full Analysis**: `ROOT-CAUSE-ANALYSIS-ISSUE-110.md` (15+ pages)
- **Deployment Guide**: `ISSUE-110-FIX-CHECKLIST.md` (5 pages)
- **Visual Diagrams**: `ISSUE-110-TECHNICAL-DIAGRAM.md` (8 pages)
- **Executive Brief**: `ISSUE-110-EXECUTIVE-SUMMARY.md` (2 pages)

---

## Status Board

```
┌─────────────────────────────────────────────────────┐
│ ISSUE #110 STATUS                                   │
├─────────────────────────────────────────────────────┤
│ Analysis:      ✅ COMPLETE                          │
│ Fix Available: ✅ YES (in branch)                   │
│ Merged:        ❌ NO                                │
│ Deployed:      ❌ NO                                │
│ Verified:      ❌ NO                                │
├─────────────────────────────────────────────────────┤
│ NEXT ACTION: MERGE & DEPLOY                         │
│ ETA: 35 minutes                                     │
│ PRIORITY: CRITICAL                                  │
└─────────────────────────────────────────────────────┘
```

---

**Last Updated**: 2026-03-08  
**Analysis By**: Cursor Cloud Agent  
**Review Required**: Engineering Lead approval before deploy

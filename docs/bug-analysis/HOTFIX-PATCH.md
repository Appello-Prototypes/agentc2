# HOTFIX: Checkout 500 Error - Immediate Patch

**Issue**: #83 - 500 error on playbook deployment  
**Fix Complexity**: Trivial (1 character change)  
**Risk Level**: Low  
**Deploy Time**: 15 minutes

---

## The One-Line Fix

### File: `packages/agentc2/src/playbooks/deployer.ts`

**Line 553** - Add optional chaining operator (`?`)

#### BEFORE (Broken):
```typescript
const entryAgentSlug =
    manifest.entryPoint.type === "agent"
        ? (agentSlugMap.get(manifest.entryPoint.slug) ?? manifest.entryPoint.slug)
        : undefined;
```

#### AFTER (Fixed):
```typescript
const entryAgentSlug =
    manifest.entryPoint?.type === "agent"
        ? (agentSlugMap.get(manifest.entryPoint.slug) ?? manifest.entryPoint.slug)
        : undefined;
```

**Change**: Add `?` after `entryPoint` on line 553

---

## Why This Works

- **Optional chaining** (`?.`) safely handles null/undefined values
- If `manifest.entryPoint` is undefined or null, the entire expression evaluates to `undefined`
- No exception thrown, `entryAgentSlug` becomes `undefined` (which is acceptable)
- Deployment continues without crashing

---

## Deployment Steps

```bash
# 1. Navigate to workspace
cd /workspace

# 2. Make the change (using StrReplace or manual edit)
# Change line 553 from:
#   manifest.entryPoint.type === "agent"
# To:
#   manifest.entryPoint?.type === "agent"

# 3. Verify syntax
bun run type-check

# 4. Run linting
bun run lint

# 5. Run tests
bun test tests/integration/playbooks/deployment.test.ts

# 6. Build
bun run build

# 7. Commit
git add packages/agentc2/src/playbooks/deployer.ts
git commit -m "fix: add null check for manifest.entryPoint in deployer (#83)"

# 8. Push
git push origin main

# 9. Verify deployment
# Wait for CI/CD pipeline
# Monitor error logs for resolution
```

---

## Verification

After deployment, verify the fix by:

1. **Check error logs** - 500 errors on `/api/playbooks/*/deploy` should stop
2. **Test deployment** - Attempt to deploy a known-affected playbook
3. **Monitor Sentry/logging** - Look for new validation errors (expected - means bad manifests are being caught gracefully)

---

## What This Doesn't Fix

This hotfix **prevents crashes** but doesn't fix the underlying invalid data. A playbook with no `entryPoint` will deploy, but `entryAgentSlug` will be `undefined` which may cause issues downstream.

**Next Steps**:
1. This hotfix makes the system resilient to bad data
2. Phase 2 enforcement prevents new bad data from being created
3. Phase 3 data repair fixes existing bad records

---

## Rollback

If this causes issues (unlikely):

```bash
git revert HEAD
git push origin main
```

---

## Additional Context

See full analysis documents:
- **Complete Analysis**: `BUG-ANALYSIS-CHECKOUT-500.md`
- **Quick Summary**: `BUG-ANALYSIS-SUMMARY.md`
- **Health Check Script**: `scripts/check-manifest-health.ts`

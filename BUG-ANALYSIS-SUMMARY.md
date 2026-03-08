# Bug Analysis Summary: Checkout 500 Error

**GitHub Issue**: #83 - https://github.com/Appello-Prototypes/agentc2/issues/83  
**Report Date**: March 8, 2026  
**Severity**: Critical  
**Status**: Root Cause Identified - Ready for Fix

---

## TL;DR

Users get a 500 error when trying to deploy playbooks from the marketplace. The error is caused by a **null reference exception** in `deployer.ts` line 553 where code accesses `manifest.entryPoint.type` without checking if `entryPoint` exists.

**Quick Fix**: Add optional chaining operator: `manifest.entryPoint?.type`

---

## The Bug

### Location
```
packages/agentc2/src/playbooks/deployer.ts:552-555
```

### Failing Code
```typescript
const entryAgentSlug =
    manifest.entryPoint.type === "agent"  // ❌ Crashes if entryPoint is undefined/null
        ? (agentSlugMap.get(manifest.entryPoint.slug) ?? manifest.entryPoint.slug)
        : undefined;
```

### Error Message
```
TypeError: Cannot read property 'type' of undefined
```

This surfaces to users as:
```
500 Internal Server Error
"Deployment failed"
```

---

## How It Happens

1. **Playbook repackaging** using "boot-only" mode spreads an existing manifest without validating it has `entryPoint`
2. **Invalid manifest saved** to database without schema validation
3. **User attempts deployment** of that playbook
4. **Deployer crashes** when trying to read `manifest.entryPoint.type`

### Code Path Breakdown

```
User clicks "Deploy" 
  → POST /api/playbooks/[slug]/deploy 
    → deployPlaybook() 
      → validateManifest() (line 73) ✅ Should catch missing entryPoint
      → [if validation passes somehow]
      → Access manifest.entryPoint.type (line 553) ❌ CRASHES
```

---

## Root Causes (Multiple Contributing Factors)

### 1. Unsafe Property Access (Primary)
- No null check before accessing `manifest.entryPoint.type`
- TypeScript non-null assertions (`entryPoint!`) bypass safety

### 2. Validation Bypass in Repackaging
- **File**: `packages/agentc2/src/playbooks/packager.ts:649-676`
- "boot-only" mode spreads `previousManifest` without validating it
- Saves to database without calling `validateManifest()`

### 3. Validation Bypass in Version Revert
- **File**: `apps/agent/src/app/api/playbooks/[slug]/versions/[versionNumber]/revert/route.ts:45`
- Copies old manifest without validation
- Old versions may predate schema requirements

### 4. Migration Scripts Modify Manifests Unsafely
- **File**: `scripts/migrate-global-slugs.ts:504-519`
- Performs slug replacements in manifest JSON
- No schema validation after modifications

---

## Affected Playbooks

**Likely Affected**:
- Playbooks that have been repackaged using "boot-only" mode
- Playbooks that have had versions reverted to pre-schema versions
- Playbooks affected by the global slug migration (March 3, 2026)

**To Identify Affected Records**, run:
```bash
bun run scripts/check-manifest-health.ts
```

Or query directly:
```sql
SELECT p.slug, p.name, pv.version
FROM playbook_version pv
JOIN playbook p ON pv."playbookId" = p.id
WHERE pv.manifest->>'entryPoint' IS NULL
   OR NOT (pv.manifest ? 'entryPoint');
```

---

## Fix Plan (Prioritized)

### 🔥 Phase 1: Emergency Hotfix (Deploy Today)
**Time**: 30 minutes | **Risk**: Low | **Impact**: Prevents all 500 errors

**Change**: Add null check in deployer
```typescript
// packages/agentc2/src/playbooks/deployer.ts:552-555
const entryAgentSlug =
    manifest.entryPoint?.type === "agent"  // ✅ Add optional chaining
        ? (agentSlugMap.get(manifest.entryPoint.slug) ?? manifest.entryPoint.slug)
        : undefined;
```

**Files Modified**: 1  
**Lines Changed**: 1  
**Testing**: Run existing integration tests

---

### 🛡️ Phase 2: Validation Enforcement (Next Sprint)
**Time**: 4 hours | **Risk**: Medium | **Impact**: Prevents future invalid manifests

**Changes**:
1. Validate previousManifest in boot-only mode before spreading
2. Validate source manifest in version revert before copying
3. Add explicit entryPoint null check after validation (defense-in-depth)

**Files Modified**: 3  
**Lines Changed**: ~30-40  
**Testing**: Add 6-8 new test cases

---

### 🔧 Phase 3: Data Repair (Maintenance Window)
**Time**: 2 hours | **Risk**: Medium-High | **Impact**: Fixes existing bad data

**Changes**:
1. Create `scripts/repair-playbook-manifests.ts`
2. Scan database for invalid manifests
3. Auto-repair where possible (infer entryPoint from components)
4. Flag unrecoverable records for manual review

**Testing**: Run on staging database first

---

### ✅ Phase 4: Prevention (Ongoing)
**Time**: 2 hours | **Risk**: Low | **Impact**: Prevents recurrence

**Changes**:
1. Add unit tests for edge cases
2. Enable TypeScript `strictNullChecks`
3. Add Prisma middleware for manifest validation
4. Add monitoring/alerting for invalid manifests

---

## Testing Checklist

Before deploying fix:
- [ ] Run `bun run type-check`
- [ ] Run `bun run lint`
- [ ] Run `bun test tests/integration/playbooks/`
- [ ] Manually test deployment of known-good playbook
- [ ] Manually test deployment after boot-only repackage
- [ ] Verify 500 error no longer occurs for affected playbooks

---

## Rollback Plan

If Phase 1 hotfix causes issues:

```bash
git revert <commit-hash>
git push origin main
```

**Risk**: Extremely low - only adds a single `?` operator

---

## Related Issues to Monitor

After deploying fix, watch for:
1. Zod validation errors on deployment (expected for truly invalid manifests)
2. Users reporting "invalid manifest" errors (means validation is working)
3. Decrease in 500 errors on `/api/playbooks/*/deploy` endpoint

---

## Key Takeaway

This bug demonstrates the importance of:
- **Defensive programming** - Always null-check before accessing nested properties
- **Validation at boundaries** - Validate data when entering/exiting the database
- **Type safety** - Use `strictNullChecks` to catch these at compile time
- **Schema evolution** - Have migration strategies when adding required fields

---

**Full Analysis**: See `BUG-ANALYSIS-CHECKOUT-500.md`  
**Issue Tracker**: https://github.com/Appello-Prototypes/agentc2/issues/83

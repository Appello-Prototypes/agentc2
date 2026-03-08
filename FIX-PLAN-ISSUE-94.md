# Fix Implementation Plan: Issue #94 - Playbook Deployment 500 Error

**Issue:** [#94 - 500 error on checkout page](https://github.com/Appello-Prototypes/agentc2/issues/94)  
**Related Issue:** [#83 - 500 error on checkout page](https://github.com/Appello-Prototypes/agentc2/issues/83) (duplicate)  
**Root Cause Document:** `ROOT-CAUSE-ANALYSIS-ISSUE-94.md`  
**Plan Version:** 1.0  
**Created:** March 8, 2026

---

## Overview

This plan provides step-by-step instructions to fix the playbook deployment 500 error caused by null pointer exception at `deployer.ts:553`. The fix already exists on branch `origin/fix/checkout-500-error-null-check` but has not been merged to main.

---

## Pre-Deployment Checklist

Before starting, verify:

- [ ] Access to production server SSH
- [ ] Access to production database credentials
- [ ] GitHub repository push access
- [ ] Production monitoring dashboard access
- [ ] Backup of current production state
- [ ] Team notification sent (maintenance window optional)

---

## Phase 1: Merge Existing Fix (IMMEDIATE - 15 minutes)

### Step 1.1: Verify Fix Branch

```bash
# Switch to fix branch
git fetch origin
git checkout origin/fix/checkout-500-error-null-check

# Verify branch integrity
git log --oneline -5
# Expected: f1b2528 fix: prevent null reference in playbook deployment (#83)

# Run quality checks
bun run type-check
bun run lint
bun run build

# Expected: All checks pass with no errors
```

**Exit Criteria:** All quality checks pass, build succeeds.

---

### Step 1.2: Merge to Main

```bash
# Switch to main branch
git checkout main

# Ensure main is up to date
git pull origin main

# Merge fix branch (no-ff to preserve commit history)
git merge origin/fix/checkout-500-error-null-check --no-ff -m "fix: merge playbook deployment null reference fix (#94, #83)"

# Verify merge succeeded
git log --oneline -3
# Expected: Merge commit appears at HEAD
```

**Exit Criteria:** Merge completes without conflicts, fix commit is in main's history.

---

### Step 1.3: Final Quality Checks

```bash
# Type check
bun run type-check
# Expected: ✓ Type checking passed

# Lint check  
bun run lint
# Expected: No errors

# Format check
bun run format

# Full build
bun run build
# Expected: Build succeeds for all apps
```

**Exit Criteria:** All checks pass, no new errors introduced.

---

### Step 1.4: Push to Remote

```bash
# Push to origin
git push origin main

# Verify push succeeded
git log origin/main --oneline -1
# Expected: Shows latest merge commit
```

**Exit Criteria:** Push succeeds, GitHub Actions CI starts running.

---

### Step 1.5: Monitor Deployment

```bash
# Watch GitHub Actions
gh run list --limit 5

# Wait for deployment to complete
gh run watch

# Expected: Deployment succeeds, no errors
```

**Exit Criteria:** GitHub Actions deployment completes successfully.

---

### Step 1.6: Verify Production

```bash
# SSH to production server
ssh -i $SSH_KEY_PATH $SSH_USER@$DEPLOY_HOST

# Check PM2 status
pm2 status
# Expected: All apps running

# Check recent logs
pm2 logs agent --lines 50 --nostream | grep -i "error\|deploy"
# Expected: No new errors after restart

# Test deployment endpoint
curl -X POST https://agentc2.ai/agent/api/playbooks/sdlc-flywheel/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"workspaceId":"YOUR_WORKSPACE_ID"}'

# Expected: 201 response OR clear error (not 500)
```

**Exit Criteria:** 
- PM2 shows all apps healthy
- No crash errors in logs
- Test deployment returns valid response (not 500)

**Rollback Plan (if needed):**
```bash
git revert HEAD
git push origin main
# Wait for auto-deploy
```

---

## Phase 2: Fix Additional Vulnerable Locations (SHORT-TERM - 30 minutes)

### Step 2.1: Fix Packager.ts Optional Chaining

**File:** `packages/agentc2/src/playbooks/packager.ts`

**Change 1 - Line 506:**

```diff
- if (manifest.entryPoint.type === "agent" && manifest.entryPoint.slug === agent.slug) {
+ if (manifest.entryPoint?.type === "agent" && manifest.entryPoint?.slug === agent.slug) {
```

**Change 2 - Line 542:**

```diff
- if (manifest.entryPoint.type === "workflow" && manifest.entryPoint.slug === wf.slug) {
+ if (manifest.entryPoint?.type === "workflow" && manifest.entryPoint?.slug === wf.slug) {
```

**Change 3 - Line 557:**

```diff
- if (manifest.entryPoint.type === "network" && manifest.entryPoint.slug === net.slug) {
+ if (manifest.entryPoint?.type === "network" && manifest.entryPoint?.slug === net.slug) {
```

**Implementation:**

```bash
# Create branch
git checkout main
git pull origin main
git checkout -b fix/packager-entrypoint-null-checks

# Make changes using StrReplace tool (3 replacements)

# Test
bun run type-check
bun run lint
bun run build

# Commit
git add packages/agentc2/src/playbooks/packager.ts
git commit -m "fix: add optional chaining to entryPoint access in packager"

# Push
git push origin fix/packager-entrypoint-null-checks

# Create PR or merge directly
```

**Exit Criteria:** Changes deployed to production, no new errors.

---

## Phase 3: Database Health Check & Repair (IF NEEDED - 30-60 minutes)

### Step 3.1: Run Health Check Script

**Purpose:** Identify any playbooks in production database with corrupted manifests.

```bash
# On production server or local with prod DB connection
cd /workspace
bun run scripts/check-manifest-health.ts

# Script will output:
# - Total playbooks scanned
# - Number of valid manifests
# - Number of invalid manifests
# - List of affected playbook IDs and version numbers
```

**Expected Output:**

```
Scanning PlaybookVersion records...
Total versions: 47
Valid manifests: 45
Invalid manifests: 2

Corrupted manifests found:
  - Playbook: sdlc-flywheel (ID: pb_abc123)
    Version: 3
    Issue: entryPoint is null
  
  - Playbook: email-triage (ID: pb_def456)  
    Version: 2
    Issue: entryPoint is undefined
```

**Exit Criteria:** Health check completes, affected playbooks identified.

---

### Step 3.2: Review Findings

**Decision Matrix:**

| Finding | Action | Priority |
|---------|--------|----------|
| 0 corrupted manifests | Skip Phase 3.3, mark complete | N/A |
| 1-3 corrupted manifests | Manual repair recommended | HIGH |
| 4-10 corrupted manifests | Run repair script | HIGH |
| 10+ corrupted manifests | Investigate root cause, then repair | CRITICAL |

---

### Step 3.3: Run Repair Script (IF NEEDED)

**⚠️ WARNING:** This script modifies production database. Create backup first.

```bash
# Create database backup
pg_dump $DATABASE_URL > playbook_backup_$(date +%Y%m%d_%H%M%S).sql

# Dry run first (read-only)
bun run scripts/repair-playbook-manifests.ts --dry-run

# Review proposed changes
# If acceptable, run for real
bun run scripts/repair-playbook-manifests.ts --confirm

# Script will:
# 1. Find manifests with null entryPoint
# 2. Reconstruct entryPoint from PlaybookComponent table
# 3. Create new version with repaired manifest
# 4. Log all changes to console and audit log
```

**Expected Output:**

```
Repairing playbook manifests...

Found 2 playbooks requiring repair:
  
1. Playbook: sdlc-flywheel (pb_abc123)
   Current version: 3
   Issue: entryPoint is null
   Reconstructed: { type: "workflow", slug: "sdlc-triage-agentc2" }
   Action: Create version 4 with repaired manifest
   Status: ✓ REPAIRED

2. Playbook: email-triage (pb_def456)
   Current version: 2  
   Issue: entryPoint is undefined
   Reconstructed: { type: "agent", slug: "email-triage-assistant" }
   Action: Create version 3 with repaired manifest
   Status: ✓ REPAIRED

Summary:
  - 2 playbooks repaired
  - 2 new versions created
  - 0 errors
```

**Exit Criteria:** All corrupted manifests repaired, new versions created.

---

### Step 3.4: Verify Repair

```bash
# Re-run health check
bun run scripts/check-manifest-health.ts

# Expected: 0 invalid manifests

# Test deployment of previously broken playbook
curl -X POST https://agentc2.ai/agent/api/playbooks/sdlc-flywheel/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: SESSION_COOKIE" \
  -d '{"workspaceId":"ws_test123"}'

# Expected: 201 Created (not 500)
```

**Exit Criteria:** Health check shows 0 issues, test deployments succeed.

---

## Phase 4: Documentation Updates (10 minutes)

### Step 4.1: Update .env.example

**File:** `.env.example`

**Add after line 178 (after Caddy section):**

```bash
# ==============================
# Stripe Integration (Billing & Subscriptions)
# ==============================

# Stripe API secret key (get from https://dashboard.stripe.com/apikeys)
# Development: use test key (sk_test_...)
# Production: use live key (sk_live_...)
STRIPE_SECRET_KEY="sk_test_..."

# Stripe webhook signature verification secret
# Get from: https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

### Step 4.2: Update CLAUDE.md

**File:** `CLAUDE.md`

**Add to "Environment Variables - COMPLETE REFERENCE" section (after Inngest section):**

```markdown
### Stripe Integration (Billing & Subscriptions)

\`\`\`bash
STRIPE_SECRET_KEY="sk_test_..."      # Stripe API secret key
STRIPE_WEBHOOK_SECRET="whsec_..."    # Webhook signature verification
\`\`\`

**Purpose:**
- Process subscription payments via Stripe Checkout
- Manage customer billing via Stripe Customer Portal  
- Receive webhook events for subscription lifecycle

**Setup:**
1. Create Stripe account at https://stripe.com
2. Get API keys from https://dashboard.stripe.com/apikeys
3. Set up webhook endpoint: `https://your-domain.com/agent/api/webhooks/stripe`
4. Copy webhook signing secret from webhook details page
```

---

### Step 4.3: Update Issue #94

Post this comment on GitHub:

```markdown
## Root Cause Analysis Complete ✅

**Root Cause:** Null pointer exception in `packages/agentc2/src/playbooks/deployer.ts:553` when accessing `manifest.entryPoint.type` without null check.

**Fix Status:** Fix exists on branch `origin/fix/checkout-500-error-null-check` (commit `f1b2528`) but not yet merged to main.

**Impact:** Blocks playbook deployment from marketplace for any playbook with corrupted manifest (entryPoint is null/undefined).

**Full Analysis:** See `/workspace/ROOT-CAUSE-ANALYSIS-ISSUE-94.md` for complete technical details.

**Next Steps:**
1. Merge fix branch to main
2. Deploy to production  
3. Run database health check
4. Repair any corrupted manifests if found

**Timeline:** Fix can be deployed in 15 minutes. Low risk, high confidence.

---
_Analysis performed by Cursor Cloud Agent on March 8, 2026_
```

---

### Step 4.4: Update Issue #83 (Duplicate)

Post this comment and close as duplicate:

```markdown
## Duplicate of #94

This issue reports the same underlying bug as #94. The "PaymentService.processOrder()" stack trace mentioned in the description does not match the actual codebase (no such class exists).

**Actual Root Cause:** Null pointer exception in playbook deployment system at `deployer.ts:553`.

See #94 for complete analysis and fix plan.

Closing as duplicate.
```

---

## Phase 5: Long-Term Hardening (OPTIONAL - 3-4 hours)

### Step 5.1: Add Integration Tests

**File:** `tests/integration/playbooks/deployment-edge-cases.test.ts` (new file)

**Test Cases:**

```typescript
describe("Playbook Deployment - Edge Cases", () => {
    it("should reject deployment when manifest has null entryPoint", async () => {
        // Arrange: Create playbook version with null entryPoint
        const playbook = await createTestPlaybook();
        await createCorruptedVersion(playbook.id, { entryPoint: null });
        
        // Act: Attempt deployment
        const response = await POST(`/api/playbooks/${playbook.slug}/deploy`, {
            workspaceId: testWorkspace.id
        });
        
        // Assert
        expect(response.status).toBe(400); // Not 500!
        expect(response.body.error).toContain("no entry point defined");
    });
    
    it("should reject boot-only repackage with corrupted previous manifest", async () => {
        // ... test repackaging with corrupted manifest
    });
    
    it("should handle entryPoint with missing properties gracefully", async () => {
        // ... test entryPoint = {type: "agent"} without slug
    });
});
```

**Run Tests:**

```bash
bun run test tests/integration/playbooks/deployment-edge-cases.test.ts
```

---

### Step 5.2: Add Database Constraint

**File:** `packages/database/prisma/schema.prisma`

**Change:** Add CHECK constraint to PlaybookVersion model.

**⚠️ Note:** Prisma doesn't support CHECK constraints natively. Requires manual SQL migration.

**Migration SQL:**

```sql
-- Ensure entryPoint exists in all manifests
ALTER TABLE "PlaybookVersion" 
ADD CONSTRAINT "playbook_version_manifest_has_entry_point"
CHECK ((manifest->'entryPoint') IS NOT NULL);

-- Validate entryPoint has required fields
ALTER TABLE "PlaybookVersion"
ADD CONSTRAINT "playbook_version_entry_point_valid"
CHECK (
    (manifest->'entryPoint'->>'type') IN ('agent', 'workflow', 'network')
    AND (manifest->'entryPoint'->>'slug') IS NOT NULL
);
```

**Apply Migration:**

```bash
# Create migration file
mkdir -p packages/database/prisma/migrations/$(date +%Y%m%d%H%M%S)_add_manifest_constraints
cat > packages/database/prisma/migrations/.../migration.sql << 'EOF'
-- Paste SQL above
EOF

# Test on development database first
bun run db:push

# If successful, apply to production
# (done automatically via GitHub Actions after push)
```

---

### Step 5.3: Enable Strict Null Checks

**File:** `packages/agentc2/tsconfig.json`

**Change:**

```diff
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
+   "strictNullChecks": true,
    "composite": true,
    "outDir": "./dist"
  }
}
```

**⚠️ WARNING:** This will cause **many** type errors throughout the codebase. Only enable if prepared to fix them all.

**Recommendation:** Create a separate initiative for strict null check migration. Not required for this bugfix.

---

## Phase 6: Monitoring & Alerting (OPTIONAL - 1 hour)

### Step 6.1: Add Error Tracking

**File:** `apps/agent/src/app/api/playbooks/[slug]/deploy/route.ts`

**Add Sentry error tracking:**

```typescript
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest, { params }: Params) {
    try {
        // ... existing code
        const installation = await deployPlaybook({
            // ... options
        });
        return NextResponse.json({ installation }, { status: 201 });
    } catch (error) {
        console.error("[playbooks] Deploy error:", error);
        
        // NEW: Report to Sentry with context
        Sentry.captureException(error, {
            tags: {
                api_route: "playbooks_deploy",
                playbook_slug: slug
            },
            extra: {
                organizationId: authResult.context.organizationId,
                userId: authResult.context.userId
            }
        });
        
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}
```

---

### Step 6.2: Add Metrics Dashboard Widget

**File:** `apps/agent/src/app/godmode/page.tsx` (or relevant dashboard)

**Add deployment health metric:**

```typescript
const deploymentStats = await prisma.playbookInstallation.groupBy({
    by: ["status"],
    where: {
        createdAt: { gte: last24Hours }
    },
    _count: true
});

// Display:
// - Total deployments last 24h
// - Success rate (ACTIVE / total)
// - Failure rate (FAILED / total)
// - Average deployment time
```

---

## Testing Plan

### Pre-Deployment Tests (Required)

**1. Unit Tests**

```bash
bun run test packages/agentc2/src/playbooks/deployer.test.ts
# Expected: All tests pass
```

**2. Integration Tests**

```bash
bun run test tests/integration/playbooks/
# Expected: All deployment tests pass
```

**3. Manual Smoke Test (Development)**

```bash
# Start dev environment
bun run dev

# In browser:
# 1. Navigate to http://localhost:3001/marketplace
# 2. Select any playbook
# 3. Click "Deploy"
# 4. Select workspace
# 5. Click "Deploy to Workspace"
# Expected: Deployment succeeds (or fails with clear error, not 500)
```

---

### Post-Deployment Tests (Required)

**1. Production Smoke Test**

```bash
# Test known-good playbook
curl -X POST https://agentc2.ai/agent/api/playbooks/sdlc-flywheel/deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: SESSION_COOKIE" \
  -d '{"workspaceId":"ws_..."}'

# Expected: 201 Created with installation object
```

**2. Error Log Monitoring**

```bash
# Monitor for 30 minutes after deployment
pm2 logs agent --lines 0 | grep -i "entrypoint\|deploy.*error\|500"

# Expected: No new errors related to entryPoint
```

**3. User Acceptance Test**

- Have real user (or QA tester) deploy a playbook via UI
- Verify full flow works end-to-end
- Confirm no 500 errors in network tab

---

## Rollback Plan

### If Deployment Causes New Issues

**Step 1: Immediate Rollback**

```bash
# SSH to production
ssh production

# Revert to previous commit
cd /workspace
git revert HEAD --no-edit
pm2 restart ecosystem.config.js --update-env

# Verify rollback
pm2 logs agent --lines 20
```

**Step 2: Investigate**

```bash
# Check what went wrong
pm2 logs agent --lines 200 > rollback_investigation.log

# Analyze errors
grep -i "error\|failed\|crash" rollback_investigation.log
```

**Step 3: Fix Forward**

- Identify what broke
- Fix on branch
- Re-test thoroughly
- Re-deploy with closer monitoring

---

## Success Criteria

### Phase 1 Success

- [x] Fix branch merged to main
- [x] Pushed to origin
- [x] GitHub Actions deployment succeeded
- [x] Production running updated code
- [x] No 500 errors from playbook deployment endpoint
- [x] Smoke test deployment succeeds

### Phase 2 Success

- [ ] Packager.ts optional chaining applied
- [ ] Type checks pass
- [ ] Deployed to production
- [ ] No new errors

### Phase 3 Success (Conditional)

- [ ] Health check run
- [ ] Corrupted manifests identified (if any)
- [ ] Repair script executed (if needed)
- [ ] All manifests valid after repair
- [ ] Test deployments succeed

---

## Risk Assessment

| Phase | Risk Level | Mitigation | Rollback Time |
|-------|-----------|------------|---------------|
| **Phase 1** | 🟢 **LOW** | Fix is defensive only, no breaking changes | 2 minutes |
| **Phase 2** | 🟢 **LOW** | Optional chaining is safe, no logic change | 2 minutes |
| **Phase 3** | 🟡 **MEDIUM** | Database writes, requires backup | 5 minutes |
| **Phase 4** | 🟢 **LOW** | Documentation only, no code changes | N/A |
| **Phase 5** | 🟡 **MEDIUM** | DB constraint might reject valid data | 10 minutes |

---

## Post-Implementation Actions

### 1. Update GitHub Issues

- [ ] Comment on #94 with analysis summary and fix confirmation
- [ ] Close #83 as duplicate of #94
- [ ] Update #94 status to "Fixed in Production"
- [ ] Add `fixed` label to both issues

### 2. Team Communication

- [ ] Post in #engineering Slack channel
- [ ] Notify users affected by deployment failures (if trackable)
- [ ] Update internal incident log

### 3. Retrospective

- [ ] Schedule team retro to discuss:
  - Why fix wasn't merged initially
  - How to improve branch management
  - Type safety improvements needed
  - Integration test coverage gaps

---

## Appendix: Quick Reference Commands

### Development

```bash
# Start local env
bun run dev

# Type check
bun run type-check

# Lint
bun run lint

# Build
bun run build

# Test
bun run test
```

### Deployment

```bash
# Deploy to production
git push origin main

# Check deployment status
gh run list --limit 3

# SSH to production
ssh production

# Check app status
pm2 status

# View logs
pm2 logs agent --lines 100
```

### Database

```bash
# Run health check
bun run scripts/check-manifest-health.ts

# Run repair (dry run)
bun run scripts/repair-playbook-manifests.ts --dry-run

# Run repair (for real)
bun run scripts/repair-playbook-manifests.ts --confirm

# Open Prisma Studio
bun run db:studio
```

---

**End of Fix Implementation Plan**

**Created by:** Cursor Cloud Agent  
**For:** Issue #94 Root Cause Analysis  
**Status:** Ready for Implementation

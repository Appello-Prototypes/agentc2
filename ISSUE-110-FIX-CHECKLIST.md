# Fix Checklist: Checkout 500 Error (Issue #110)

**Engineer**: _____________  
**Date**: _____________  
**Issue**: https://github.com/Appello-Prototypes/agentc2/issues/110

---

## Pre-Fix Verification

- [ ] Confirmed current main branch has the bug (check `apps/agent/src/lib/api-auth.ts` line 149)
- [ ] Verified fix branch exists: `git branch -r | grep fix/checkout-500-error-issue-99`
- [ ] Read `ROOT-CAUSE-ANALYSIS-ISSUE-110.md` for full context
- [ ] Production access verified (SSH or GitHub Actions)

---

## Code Changes

### Option 1: Merge Existing Fix Branch (Recommended)

```bash
# Switch to main and pull latest
git checkout main
git pull origin main

# Merge the fix
git merge origin/fix/checkout-500-error-issue-99

# Resolve conflicts if any (unlikely)
# Verify the merge
git diff HEAD~1 HEAD -- apps/agent/src/lib/api-auth.ts
```

- [ ] Merged fix branch
- [ ] Verified diff shows removal of `request?.cookies.get("agentc2-active-org")`
- [ ] No unexpected changes included

### Option 2: Manual Fix (If Option 1 has conflicts)

**File**: `apps/agent/src/lib/api-auth.ts`

**Find this code (lines 146-149)**:
```typescript
const preferredOrgId =
    request?.headers.get("x-organization-id")?.trim() ||
    request?.cookies.get("agentc2-active-org")?.value?.trim() ||
    null;
```

**Replace with**:
```typescript
const preferredOrgId = request?.headers.get("x-organization-id")?.trim() || null;
```

- [ ] Made the change
- [ ] Saved file
- [ ] Verified no other changes made

---

## Quality Checks

Run all checks from project root:

```bash
# TypeScript compilation
bun run type-check
```
- [ ] PASSED (no TypeScript errors)

```bash
# Linting
bun run lint
```
- [ ] PASSED (no ESLint errors)

```bash
# Build all apps
bun run build
```
- [ ] PASSED (all apps build successfully)

---

## Local Testing

```bash
# Start dev server
bun run dev
```

### Test Scenarios

**Scenario 1: Basic Checkout**
1. Open http://localhost:3000 (or via Caddy)
2. Log in as test user
3. Navigate to Settings → Billing
4. Click "Upgrade Plan" or trigger checkout
5. Verify: No 500 error, checkout session created

- [ ] PASSED (no 500 error)
- [ ] Checkout URL returned successfully

**Scenario 2: Multi-Org User**
1. Log in as user with 2+ organizations
2. Switch active organization
3. Navigate to Settings → Billing
4. Trigger checkout
5. Verify: Uses correct organization, no 500 error

- [ ] PASSED (correct org used)
- [ ] No error in console logs

**Scenario 3: API Key Auth (Negative Test)**
```bash
curl -X POST http://localhost:3001/api/stripe/checkout \
  -H "X-API-Key: $MCP_API_KEY" \
  -H "X-Organization-Slug: agentc2" \
  -H "Content-Type: application/json" \
  -d '{"planSlug": "pro"}'
```

- [ ] Works correctly (API key auth unaffected)

---

## Commit & Push

```bash
# Stage changes
git add apps/agent/src/lib/api-auth.ts

# Commit with descriptive message
git commit -m "fix: remove synchronous cookie access causing 500 error on checkout (issue #110)"

# Push to main
git push origin main
```

- [ ] Changes committed
- [ ] Pushed to origin/main
- [ ] GitHub Actions triggered (if configured)

---

## Deployment

### Automatic (GitHub Actions)
- [ ] GitHub Actions workflow started
- [ ] Deployment completed successfully
- [ ] No errors in Actions logs

### Manual (SSH Deploy)

```bash
# SSH to production
ssh -i $SSH_KEY_PATH $SSH_USER@$DEPLOY_HOST

# Navigate to app directory
cd $DEPLOY_PATH

# Pull latest code
git pull origin main

# Install dependencies (if needed)
bun install

# Generate Prisma client (if schema changed)
bun run db:generate

# Build apps
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build

# Restart PM2 processes
pm2 restart ecosystem.config.js --update-env

# Check status
pm2 status
```

- [ ] SSH connection successful
- [ ] Code pulled from main
- [ ] Build completed successfully
- [ ] PM2 restarted without errors
- [ ] All processes showing "online" status

---

## Post-Deployment Verification

### Immediate (0-5 minutes)

```bash
# Check PM2 logs for errors
pm2 logs agent --lines 100 | grep -i "checkout\|stripe\|error"
```

- [ ] No 500 errors in logs
- [ ] No Next.js runtime errors
- [ ] Agent app is responding

### Production Smoke Test (5-10 minutes)

1. Open production URL in incognito browser
2. Log in with test account
3. Navigate to Settings → Billing
4. Click "Upgrade Plan"
5. Verify checkout session created successfully
6. (Don't complete checkout - just verify no 500 error)

- [ ] No 500 error on checkout page
- [ ] Stripe checkout session URL returned
- [ ] Redirect to Stripe works correctly

### Monitor Error Rates (10-30 minutes)

```bash
# Check error rate over last 30 minutes
pm2 logs agent --lines 5000 | grep "500" | wc -l

# Check specific checkout errors
pm2 logs agent | grep "/api/stripe/checkout" | grep -i error
```

- [ ] Error rate returned to baseline (or zero)
- [ ] No new error patterns emerged
- [ ] Checkout API calls returning 200 OK

---

## Rollback Procedure (If Needed)

**If fix causes NEW issues**:

```bash
# Revert the commit
git revert HEAD

# Push revert
git push origin main

# Redeploy (automatic via Actions or manual SSH)
```

- [ ] Rollback executed
- [ ] Reverted code deployed
- [ ] System restored to pre-fix state
- [ ] Incident escalated for further investigation

---

## Post-Deployment Actions

### Immediate
- [ ] Close GitHub issue #110 with fix details
- [ ] Notify engineering team of successful deploy
- [ ] Update status page (if customer-facing incident)

### Within 24 Hours
- [ ] Review production logs for any related issues
- [ ] Check support tickets for checkout complaints
- [ ] Verify Stripe analytics show successful checkouts

### Within 1 Week
- [ ] Post-mortem meeting: Why wasn't the fix merged?
- [ ] Implement process improvements (PR workflow, smoke tests)
- [ ] Audit other orphaned fix branches
- [ ] Clean up merged fix branches

---

## Sign-Off

### Code Changes
- [ ] Verified by: _____________
- [ ] Date/Time: _____________

### Deployment
- [ ] Deployed by: _____________
- [ ] Date/Time: _____________

### Verification
- [ ] Verified by: _____________
- [ ] Date/Time: _____________

### Incident Closure
- [ ] Approved by: _____________
- [ ] Date/Time: _____________

---

## Notes & Issues Encountered

_Use this space to document any issues, unexpected behavior, or deviations from the plan:_

---

**CRITICAL REMINDER**: This is a revenue-blocking bug. Prioritize speed while maintaining quality. The fix is proven and low-risk.

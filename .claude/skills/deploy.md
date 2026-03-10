# Deploy Checklist

**Trigger**: User asks to deploy, push, or ship code to production.

**Description**: Runs the full pre-deployment checklist ensuring nothing breaks production.

## Instructions

Execute these steps IN ORDER. Do NOT skip any step. Do NOT proceed if a step fails.

### Step 1: Check for uncommitted changes

```bash
git status
```

If there are uncommitted changes, ask the user if they want to commit first.

### Step 2: Type checking

```bash
bun run type-check
```

If there are type errors, FIX THEM before proceeding. Do not skip.

### Step 3: Linting

```bash
bun run lint
```

If there are lint errors, FIX THEM before proceeding. Do not skip.

### Step 4: Formatting

```bash
bun run format
```

Run this to auto-fix formatting. Then check `git diff` to see if anything changed — if so, stage and commit the formatting fixes.

### Step 5: Build

```bash
bun run build
```

This is the most critical step. If the build fails, NOTHING ships. Fix all build errors.

### Step 6: Review changes

```bash
git diff --staged
git log --oneline -5
```

Show the user what will be deployed. Get confirmation.

### Step 7: Push

```bash
git push origin main
```

Only after user confirms. NEVER force push.

### Step 8: Verify deployment

After push, remind the user:

- GitHub Actions will auto-deploy to Digital Ocean
- Check PM2 status on the server: `pm2 status`
- Check logs: `pm2 logs`

## NEVER DO

- Skip type-check or build steps
- Force push to main
- Push with failing tests or lint errors
- Deploy without user confirmation

# Create Pull Request

**Trigger**: User asks to create a PR, open a pull request, or submit code for review.

**Description**: Creates a well-structured GitHub PR after running all quality checks.

## Instructions

### Step 1: Verify current branch

```bash
git branch --show-current
git log --oneline -10
```

If on `main`, create a feature branch first:

```bash
git checkout -b feature/descriptive-name
```

### Step 2: Run ALL quality checks (mandatory, no exceptions)

Run these in parallel where possible:

```bash
bun run type-check
bun run lint
bun run format
```

Fix ANY errors before proceeding. Do NOT skip.

### Step 3: Build

```bash
bun run build
```

The PR must build successfully. Fix all build errors.

### Step 4: Stage and commit

```bash
git add <specific-files>
git commit -m "feat: descriptive message"
```

Use conventional commits. Stage specific files, not `git add -A`.

### Step 5: Push branch

```bash
git push -u origin $(git branch --show-current)
```

### Step 6: Analyze all changes for the PR

```bash
git diff main...HEAD
git log --oneline main..HEAD
```

Read ALL commits, not just the latest. The PR description must cover everything.

### Step 7: Create the PR

```bash
gh pr create --title "Short title under 70 chars" --body "$(cat <<'EOF'
## Summary
- Bullet point summary of changes

## Changes
- Detailed list of what was modified and why

## Test plan
- [ ] How to verify these changes work

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 8: Return the PR URL

Always show the user the PR URL at the end.

## Rules

- NEVER create a PR with type errors or lint errors
- NEVER create a PR without building first
- ALWAYS include a test plan in the PR description
- PR title should be under 70 characters
- Use the body for details, not the title

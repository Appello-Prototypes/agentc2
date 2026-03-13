# Test Cases for Skill installCount

## Test Coverage Needed

Since this package doesn't have a test runner configured yet, these test cases document the expected behavior:

### 1. attachToAgent() increments installCount

- Given a skill with installCount = 0
- When attachToAgent() is called
- Then installCount should be 1

### 2. detachFromAgent() decrements installCount

- Given a skill with installCount = 1 attached to 1 agent
- When detachFromAgent() is called
- Then installCount should be 0

### 3. Multiple attachments increment correctly

- Given a skill with installCount = 0
- When attachToAgent() is called 3 times with different agents
- Then installCount should be 3

### 4. Attach then detach maintains accuracy

- Given a skill with installCount = 2 attached to 2 agents
- When detachFromAgent() is called for one agent
- Then installCount should be 1

### 5. Backfill script accuracy

- Run the backfill script in dry-run mode
- Verify it correctly identifies mismatches
- Run with --apply
- Verify all skills have installCount matching \_count.agents

## Manual Verification

1. Check current state:

```sql
SELECT id, slug, "installCount", (SELECT COUNT(*) FROM agent_skill WHERE "skillId" = skill.id) as actual_count
FROM skill
WHERE "installCount" != (SELECT COUNT(*) FROM agent_skill WHERE "skillId" = skill.id);
```

2. Run backfill:

```bash
bun run scripts/backfill-skill-installcount.ts
bun run scripts/backfill-skill-installcount.ts --apply
```

3. Test attach/detach in UI or via API:

- Attach skill to agent
- Verify installCount incremented
- Detach skill from agent
- Verify installCount decremented

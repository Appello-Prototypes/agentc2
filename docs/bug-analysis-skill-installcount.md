# Root Cause Analysis: Skill installCount Always 0

**Issue**: [#183](https://github.com/Appello-Prototypes/agentc2/issues/183) - Skill installCount always 0 despite agents being attached

**Date**: 2026-03-13  
**Status**: Analysis Complete - Ready for Review  
**Severity**: Medium (Analytics/Marketplace Impact)

---

## Executive Summary

All 21 skills in the platform show `installCount: 0` despite having 1-4 agents actively attached to them. The root cause is that the `attachToAgent()` function creates `AgentSkill` junction records but never increments the skill's `installCount` field. This field was designed to track marketplace-style installations (similar to playbooks), but skills are predominantly attached via a different code path that bypasses this counter.

**Fix Complexity**: Low  
**Risk Level**: Low  
**Estimated Implementation**: 1-2 hours  

---

## Evidence & Reproduction

### Observed Behavior

From the bug report:
```
skill_list -- all skills show installCount: 0

Example:
{
  "id": "...",
  "slug": "hubspot-crm",
  "name": "HubSpot CRM Management",
  "installCount": 0,           // ← WRONG
  "_count": {
    "agents": 1                // ← CORRECT (junction records exist)
  },
  "agents": [
    { "agentId": "cmmmqqnbb01iw8e17suxetwmp" }
  ]
}
```

### Code Verification

The `listSkills()` function returns both fields:

**File**: `packages/agentc2/src/skills/service.ts:202-241`
```typescript
export async function listSkills(input: ListSkillsInput = {}) {
    const [skills, total] = await Promise.all([
        prisma.skill.findMany({
            where,
            include: {
                agents: {
                    select: { agentId: true }
                },
                _count: {
                    select: { tools: true, documents: true, agents: true }
                }
            }
        }),
        prisma.skill.count({ where })
    ]);
    return { skills, total };
}
```

Both `installCount` (column) and `_count.agents` (relation count) are returned, but they show different values.

---

## Root Cause Analysis

### Primary Root Cause

**File**: `packages/agentc2/src/skills/service.ts:492-526`  
**Function**: `attachToAgent()`

```typescript
export async function attachToAgent(
    agentIdOrSlug: string,
    skillIdOrSlug: string,
    pinned?: boolean,
    organizationId?: string
) {
    const agentId = await resolveAgentId(agentIdOrSlug, organizationId);
    const skillId = await resolveSkillId(skillIdOrSlug, organizationId);

    // ... validation ...

    // ✅ Creates junction record
    const junction = await prisma.agentSkill.create({
        data: { agentId, skillId, pinned: pinned ?? true }
    });

    // ❌ MISSING: No increment of skill.installCount
    // Should add:
    // await prisma.skill.update({
    //     where: { id: skillId },
    //     data: { installCount: { increment: 1 } }
    // });

    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Attached skill: ${skill.slug}${pinned ? " (pinned)" : ""}`
    );

    return { ...junction, agentVersion: newVersion };
}
```

**This function is called by**:
1. `POST /api/agents/[id]/skills` - UI skill attachment
2. `agent-attach-skill` tool - MCP tool for agents to attach skills
3. Playbook deployer (line 359 in `playbooks/deployer.ts`)
4. Integration provisioner (line 338 in `integrations/provisioner.ts`)
5. Various seed scripts and migration scripts

### Secondary Code Paths

**Other locations that create `AgentSkill` records without incrementing `installCount`**:

1. **Playbook Deployer** (`packages/agentc2/src/playbooks/deployer.ts:359`)
   ```typescript
   await prisma.agentSkill.create({
       data: { agentId: agent.id, skillId }
   });
   ```

2. **Integration Provisioner** (`packages/agentc2/src/integrations/provisioner.ts:338`)
   ```typescript
   await prisma.agentSkill.create({
       data: { agentId: created.id, skillId, pinned: true }
   });
   ```

3. **Agent Creation** (`apps/agent/src/app/api/agents/route.ts:461`)
4. **Agent Version Rollback** (`apps/agent/src/app/api/agents/[id]/versions/[version]/rollback/route.ts:114`)
5. **Onboarding Bootstrap** (`apps/agent/src/app/api/onboarding/bootstrap-agent/route.ts:211`)
6. **Seed Scripts** (multiple files)

### Comparison: Playbook installCount (Working Correctly)

**File**: `packages/agentc2/src/playbooks/deployer.ts:579-582`  

```typescript
// ✅ Playbooks increment installCount on deployment
await prisma.playbook.update({
    where: { id: opts.playbookId },
    data: { installCount: { increment: 1 } }
});
```

**File**: `packages/agentc2/src/playbooks/deployer.ts:679-682`  

```typescript
// ✅ Playbooks decrement installCount on uninstall
await prisma.playbook.update({
    where: { id: installation.playbookId },
    data: { installCount: { decrement: 1 } }
});
```

### Marketplace installSkill() Function (Partially Working)

**File**: `packages/agentc2/src/skills/marketplace.ts:80-119`  

```typescript
export async function installSkill(params: {
    sourceSkillId: string;
    targetWorkspaceId: string;
}): Promise<{ skillId: string }> {
    // Creates a NEW skill copy in target workspace
    const installed = await prisma.skill.create({ ... });

    // ✅ Increments install count on SOURCE skill
    await prisma.skill.update({
        where: { id: params.sourceSkillId },
        data: { installCount: { increment: 1 } }
    });

    return { skillId: installed.id };
}
```

**Note**: This function is for cross-workspace marketplace installations (creating a copy of a public skill in another workspace). It DOES increment `installCount`, but it's rarely used compared to `attachToAgent()`.

### Detachment: Missing Decrement

**File**: `packages/agentc2/src/skills/service.ts:531-558`  

```typescript
export async function detachFromAgent(
    agentIdOrSlug: string,
    skillIdOrSlug: string,
    organizationId?: string
) {
    // ... validation ...

    // Deletes junction record
    await prisma.agentSkill.delete({
        where: { agentId_skillId: { agentId, skillId } }
    });

    // ❌ MISSING: No decrement of skill.installCount
    // Should add (if we decide to track attachments):
    // await prisma.skill.update({
    //     where: { id: skillId },
    //     data: { installCount: { decrement: 1 } }
    // });

    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Detached skill: ${skill.slug}`
    );

    return { agentVersion: newVersion };
}
```

---

## Impact Assessment

### User-Facing Impact

1. **Analytics Dashboard** (if exists)
   - Skill adoption metrics are incorrect
   - Cannot identify popular vs unused skills

2. **Marketplace Sorting** (`packages/agentc2/src/skills/marketplace.ts:21`)
   - Public skills are ordered by `installCount` (always 0)
   - All skills appear equally unpopular
   - Breaks "most popular" ranking

3. **API Responses**
   - All skills show `installCount: 0` despite active usage
   - Creates confusion when `_count.agents > 0` but `installCount = 0`

### System Impact

1. **Database**
   - `Skill.installCount` column is populated but never updated
   - Wasted storage (small)

2. **Reporting/Telemetry**
   - Any internal metrics based on `installCount` are wrong
   - Business intelligence reports on skill adoption are inaccurate

### No Breaking Changes

- Fixing this will NOT break existing functionality
- No external APIs depend on `installCount` being 0
- Schema change is NOT required (field already exists)

---

## Design Question: What Should installCount Track?

### Option A: Track All Agent Attachments (Recommended)

**Semantics**: `installCount` = number of agents that have this skill attached

**Pros**:
- Matches user expectations (bug reporter's assumption)
- Aligns with `_count.agents` (makes both fields consistent)
- Useful for internal skill adoption analytics
- Simple to implement

**Cons**:
- Not truly a "marketplace install count" (misleading name)
- Counts same-org attachments, not cross-org installs
- Redundant with `_count.agents` (but faster to query)

**Implementation**:
- Increment in `attachToAgent()` and all `AgentSkill.create()` calls
- Decrement in `detachFromAgent()` and all `AgentSkill.delete()` calls

### Option B: Track Only Cross-Workspace Installs (Current Design)

**Semantics**: `installCount` = number of times this skill was installed from marketplace into another workspace

**Pros**:
- Matches playbook `installCount` semantics
- Truly tracks "marketplace installs"
- No change to existing code (just document the behavior)

**Cons**:
- Confusing when `_count.agents > 0` but `installCount = 0`
- Not useful for single-org deployments (always 0)
- Marketplace feature is not fully implemented yet

**Implementation**:
- No code changes (current behavior)
- Update documentation to clarify semantics
- Consider renaming to `marketplaceInstallCount` for clarity

### Option C: Rename or Remove the Field

**Semantics**: Remove `installCount`, use `_count.agents` exclusively

**Pros**:
- Eliminates confusion
- One source of truth
- No maintenance burden

**Cons**:
- Requires schema migration
- Breaks existing API responses (breaking change)
- Loses optimization potential (separate counter faster than join count)

---

## Recommended Fix Plan

### Decision: Implement Option A

**Rationale**: 
1. Matches user expectations (most intuitive)
2. Aligns with existing `_count.agents` field
3. Useful for analytics and sorting
4. Low risk, minimal code changes
5. Consistent with playbook behavior (tracks actual usage)

### Implementation Steps

#### Step 1: Update `attachToAgent()` Function

**File**: `packages/agentc2/src/skills/service.ts`  
**Lines**: 492-526

**Change**:
```typescript
export async function attachToAgent(
    agentIdOrSlug: string,
    skillIdOrSlug: string,
    pinned?: boolean,
    organizationId?: string
) {
    // ... existing validation ...

    const junction = await prisma.agentSkill.create({
        data: { agentId, skillId, pinned: pinned ?? true }
    });

    // 🆕 ADD THIS: Increment installCount
    await prisma.skill.update({
        where: { id: skillId },
        data: { installCount: { increment: 1 } }
    });

    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Attached skill: ${skill.slug}${pinned ? " (pinned)" : ""}`
    );

    return { ...junction, agentVersion: newVersion };
}
```

#### Step 2: Update `detachFromAgent()` Function

**File**: `packages/agentc2/src/skills/service.ts`  
**Lines**: 531-558

**Change**:
```typescript
export async function detachFromAgent(
    agentIdOrSlug: string,
    skillIdOrSlug: string,
    organizationId?: string
) {
    // ... existing validation ...

    await prisma.agentSkill.delete({
        where: { agentId_skillId: { agentId, skillId } }
    });

    // 🆕 ADD THIS: Decrement installCount
    await prisma.skill.update({
        where: { id: skillId },
        data: { installCount: { decrement: 1 } }
    });

    const newVersion = await createAgentVersionForSkillChange(
        agentId,
        `Detached skill: ${skill.slug}`
    );

    return { agentVersion: newVersion };
}
```

#### Step 3: Backfill Existing Data

**File**: `packages/database/prisma/backfill-skill-installcount.ts` (new file)

**Purpose**: Update all existing skills to have correct `installCount` based on current `AgentSkill` records

**Script**:
```typescript
import { prisma } from "./client";

async function backfillSkillInstallCounts() {
    console.log("Starting skill installCount backfill...");

    const skills = await prisma.skill.findMany({
        include: {
            _count: {
                select: { agents: true }
            }
        }
    });

    let updated = 0;
    for (const skill of skills) {
        const correctCount = skill._count.agents;
        if (skill.installCount !== correctCount) {
            await prisma.skill.update({
                where: { id: skill.id },
                data: { installCount: correctCount }
            });
            console.log(`✓ ${skill.slug}: ${skill.installCount} → ${correctCount}`);
            updated++;
        }
    }

    console.log(`Backfill complete: ${updated} skills updated`);
}

backfillSkillInstallCounts()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
```

**Run with**:
```bash
bun run packages/database/prisma/backfill-skill-installcount.ts
```

#### Step 4: Handle Edge Cases

**4a. Playbook Deployer** (`packages/agentc2/src/playbooks/deployer.ts:359`)

Currently uses raw `prisma.agentSkill.create()`. Options:
- **Option 1**: Call `attachToAgent()` instead (preferred)
- **Option 2**: Add inline increment (code duplication)

**4b. Integration Provisioner** (`packages/agentc2/src/integrations/provisioner.ts:338`)

Same as 4a - consider refactoring to use `attachToAgent()`.

**4c. Agent Version Rollback** (`apps/agent/src/app/api/agents/[id]/versions/[version]/rollback/route.ts:114`)

Uses `createMany()` for bulk inserts. Options:
- Use transaction with manual increment for each skill
- Accept potential slight inaccuracy during rollback (low priority)

**4d. Seed Scripts**

Leave as-is (seed data can be regenerated). Run backfill script after seeding.

#### Step 5: Add Tests

**File**: `tests/unit/skills-service.test.ts` (new file)

**Test cases**:
1. `attachToAgent()` increments `installCount`
2. `detachFromAgent()` decrements `installCount`
3. Multiple agents attaching same skill increases count correctly
4. Detaching when count=0 doesn't go negative (or throws error)
5. Concurrent attachments maintain correct count

**File**: `tests/integration/skills-api.test.ts`

**Test cases**:
1. POST `/api/agents/[id]/skills` increments count
2. DELETE `/api/agents/[id]/skills` decrements count
3. GET `/api/skills` returns correct `installCount` and `_count.agents` (both match)

#### Step 6: Update Documentation

**File**: `docs/AGENTC2-MCP-TOOLS.md`

Update `agent-attach-skill` tool documentation to clarify that it increments the skill's `installCount`.

**File**: `packages/database/prisma/schema.prisma`

Add comment to `Skill.installCount` field:
```prisma
model Skill {
    // ...
    
    /// Number of agents that have this skill attached
    /// Incremented on attach, decremented on detach
    installCount Int @default(0)
    
    // ...
}
```

---

## Risk Assessment

### Risk Level: **LOW**

#### Risks

1. **Concurrency Issues**
   - Multiple agents attaching the same skill simultaneously
   - Prisma's `increment` operation is atomic, so this is safe

2. **Negative Count**
   - If `detachFromAgent()` is called multiple times or with stale data
   - Mitigation: Add check `where: { id: skillId, installCount: { gt: 0 } }` in decrement

3. **Backfill Performance**
   - 21 skills is trivial, but production could have thousands
   - Mitigation: Add batching if needed (not required for current scale)

4. **Rollback Complexity**
   - Agent rollback uses `createMany()` which can't be easily hooked
   - Mitigation: Accept slight inaccuracy, or add post-rollback count sync

5. **Playbook Installs**
   - Playbook deployment creates many `AgentSkill` records
   - Each skill's count will be incremented correctly if using transactions
   - Mitigation: Test playbook deployment thoroughly

#### Mitigations

1. **Atomic Operations**: Use Prisma's `{ increment: 1 }` / `{ decrement: 1 }` (built-in atomicity)
2. **Bounds Check**: Prevent negative counts with `where` clause in decrement
3. **Backfill Script**: One-time correction of existing data
4. **Integration Tests**: Verify counts stay consistent across common workflows
5. **Monitoring**: Add metric to track skills with `installCount !== _count.agents` (should always be 0)

---

## Verification Plan

### Pre-Fix Verification

1. Run `skill_list` tool - confirm all skills show `installCount: 0`
2. Query database: `SELECT slug, "installCount", (SELECT COUNT(*) FROM agent_skill WHERE "skillId" = skill.id) as actual_count FROM skill;`
3. Confirm mismatch exists

### Post-Fix Verification

1. Run backfill script
2. Query database again - confirm counts match
3. Test attach/detach flow:
   - Attach skill to agent → verify count incremented
   - Detach skill → verify count decremented
4. Test via UI: `POST /api/agents/[id]/skills` → check database
5. Test via MCP tool: call `agent-attach-skill` → check database
6. Deploy playbook → verify all skill counts updated correctly

### Regression Tests

1. Run existing skill tests
2. Run playbook deployment tests
3. Check agent creation still works
4. Verify rollback functionality unchanged

---

## Estimated Effort

| Task | Time | Assignee |
|------|------|----------|
| Code changes (Steps 1-2) | 30 min | Developer |
| Backfill script (Step 3) | 30 min | Developer |
| Edge case handling (Step 4) | 1 hour | Developer |
| Tests (Step 5) | 1 hour | Developer |
| Documentation (Step 6) | 15 min | Developer |
| Manual testing | 30 min | QA |
| **Total** | **~4 hours** | |

---

## Alternative Solutions Considered

### Alternative 1: Remove installCount Field

**Approach**: Drop the column, use `_count.agents` exclusively

**Rejected because**:
- Requires migration (breaking change)
- Loses performance optimization (separate counter is faster than join count)
- Breaks existing API contracts

### Alternative 2: Rename to agentCount

**Approach**: Rename `installCount` → `agentCount` for clarity

**Rejected because**:
- Doesn't fix the bug (count is still 0)
- Requires migration + API changes
- Confuses with `_count.agents` (duplicate semantics)

### Alternative 3: Track Marketplace Installs Only

**Approach**: Keep current behavior, document as "marketplace installs only"

**Rejected because**:
- Doesn't match user expectations
- Field is useless for single-org deployments (always 0)
- Marketplace feature is incomplete

---

## Open Questions

### Q1: Should seed scripts increment installCount?

**Answer**: No - run backfill script after seeding. Keeps seed scripts simple.

### Q2: Should rollback adjust counts?

**Answer**: Ideally yes, but low priority. Rollback is rare, slight inaccuracy acceptable. Can be fixed by periodic sync job.

### Q3: Should we rename the field?

**Answer**: No - field name is acceptable. Add schema comment for clarity.

### Q4: What about bulk operations?

**Answer**: Bulk `AgentSkill.createMany()` can't trigger hooks. Options:
- Refactor to loop with individual creates (slower but accurate)
- Add post-operation sync (eventually consistent)
- Recommended: Loop approach for correctness

---

## Conclusion

The `installCount` field on skills is always 0 because the `attachToAgent()` function (and related code paths) never increment it. The fix is straightforward: add increment/decrement logic to match playbook behavior, run a one-time backfill script, and add tests. This is a low-risk, high-value fix that will correct analytics, enable marketplace sorting, and align the codebase with user expectations.

**Recommendation**: Proceed with Option A implementation (track all agent attachments).

---

**Analysis completed by**: Claude (Cursor AI Agent)  
**Review required**: Yes (human approval before implementation)  
**Related issue**: https://github.com/Appello-Prototypes/agentc2/issues/183

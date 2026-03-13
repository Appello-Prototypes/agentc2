# Root Cause Analysis: agent_discover Missing 3 Google Agents

**Date:** 2026-03-13  
**Issue:** [#186](https://github.com/Appello-Prototypes/agentc2/issues/186)  
**Status:** Analysis Complete — Ready for Fix

---

## Executive Summary

The `agent_discover` MCP tool returns 23 agents instead of the expected 26 agents. Three Google OAuth-provisioned agents (`google-calendar-agent`, `google-drive-agent`, `gsc-agent`) are missing from the results despite being active, functional, and having tools attached.

**Root Cause:** A visibility filter mismatch in the `listForUser` query. Auto-provisioned agents created during OAuth callbacks have `ownerId: null` and `visibility: PRIVATE`, which doesn't match any of the three OR conditions in the agent discovery query.

---

## Timeline of Discovery

1. **User reports:** `agent_discover()` returns 23 agents
2. **User verifies:** `agent_discover(activeOnly: false)` still returns 23 agents
3. **User tests:** `agent_invoke_dynamic(agentSlug: 'google-drive-agent')` works successfully
4. **User confirms:** `platform_context` tool shows 26 agents exist

This proves the agents exist, are active, and functional — but invisible to discovery.

---

## Technical Root Cause

### 1. Agent Creation Path (Auto-Provisioning)

**File:** `packages/agentc2/src/integrations/provisioner.ts`  
**Function:** `upsertAgent` (lines 250-347)

When a user connects a Google OAuth integration (Calendar, Drive, Search Console), the system auto-provisions an agent via this flow:

```typescript
const created = await prisma.agent.create({
    data: {
        slug: bp.slug,
        name: bp.name,
        // ...
        type: "USER",
        workspaceId,
        ownerId: userId,        // ⚠️ Can be undefined/null during OAuth callback
        createdBy: userId,      // ⚠️ Can be undefined/null during OAuth callback
        isActive: true,
        // ⚠️ No visibility field set — defaults to PRIVATE
        metadata: {
            provisionedBy: "auto-provisioner",
            // ...
        }
    }
});
```

**Key Issues:**
- **Line 321:** `ownerId: userId` — If `userId` is `undefined` during the OAuth callback (common when the callback doesn't have session context), the agent is created with `ownerId: null`
- **No visibility set:** The create statement doesn't specify `visibility`, so it defaults to `PRIVATE` (Prisma schema default on line 854 of `schema.prisma`)

**Result:** The 3 Google agents were created with:
- `ownerId: null` (no owner)
- `visibility: PRIVATE`
- `isActive: true`
- `workspaceId: [valid workspace]`
- `workspace.organizationId: [valid org]`

---

### 2. Agent Discovery Query Path

**File:** `packages/agentc2/src/agents/resolver.ts`  
**Function:** `listForUser` (lines 1989-2036)

The `agent-discover` MCP tool calls `/api/agents?detail=discover`, which internally calls `agentResolver.listForUser(userId, organizationId)`:

```typescript
agents = await prisma.agent.findMany({
    where: {
        isActive: true,
        OR: [
            // Condition 1: User's own agents
            ...(organizationId
                ? [{ ownerId: userId, workspace: { organizationId } }]
                : [{ ownerId: userId }]),
            
            // Condition 2: Organization-visible agents
            ...(organizationId
                ? [{ visibility: "ORGANIZATION", workspace: { organizationId } }]
                : []),
            
            // Condition 3: Public agents
            { visibility: "PUBLIC" }
        ]
    },
    // ...
});
```

**Why the Google Agents Don't Match:**

| Condition | Required | Google Agent Value | Match? |
|-----------|----------|-------------------|--------|
| **Condition 1** | `ownerId: userId` | `ownerId: null` | ❌ No |
| **Condition 2** | `visibility: ORGANIZATION` | `visibility: PRIVATE` | ❌ No |
| **Condition 3** | `visibility: PUBLIC` | `visibility: PRIVATE` | ❌ No |

The query expects agents to be **either**:
1. Owned by the calling user, OR
2. Organization-visible within the same org, OR
3. Publicly visible

But the Google agents are:
- Not owned by anyone (`ownerId: null`)
- Not org-visible (`visibility: PRIVATE`)
- Not public (`visibility: PRIVATE`)

So they're **filtered out** despite being active and in the correct workspace/org.

---

### 3. Why Other Agents Still Appear

The other 23 agents that DO appear in discovery results have one of these attributes:
- `ownerId: [valid user]` — Manually created agents with an owner
- `visibility: ORGANIZATION` — Agents explicitly made org-visible
- `visibility: PUBLIC` — Demo or shared agents

---

### 4. Why agent_invoke_dynamic Still Works

**File:** `packages/agentc2/src/agents/resolver.ts`  
**Function:** `resolve` (lines 293-450)

When an agent is invoked directly by slug (e.g., via `agent_invoke_dynamic`), the resolver uses a **different query** with broader scoping:

```typescript
const record = await prisma.agent.findFirst({
    where: {
        slug,
        isActive: true,
        ...(workspaceId
            ? { workspaceId }
            : organizationId
                ? {
                      OR: [
                          { workspace: { organizationId } },
                          ...(userId ? [{ ownerId: userId, workspace: { organizationId } }] : []),
                          { visibility: "PUBLIC" }
                      ]
                  }
                : {})
    },
    // ...
});
```

This query includes `{ workspace: { organizationId } }` as a **standalone OR condition**, which matches ANY agent in the org's workspace — even those with `ownerId: null` and `visibility: PRIVATE`.

So invocation works, but discovery doesn't.

---

## Impact Assessment

### User-Facing Impact
- **Severity:** Medium
- **Scope:** Any agent or user calling `agent_discover` or `agent-list` tools
- **Consequence:**
  - Agents cannot discover Google Calendar/Drive/Search Console agents for peer collaboration
  - Network routing that relies on `agent_discover` won't route to these agents
  - Users asking "what agents are available?" get an incomplete list (23 instead of 26)
  - Reduces the utility of multi-agent mesh collaboration patterns

### System-Wide Impact
- **Data Integrity:** No data corruption — agents exist and function correctly
- **Performance:** No performance degradation
- **Security:** No security implications (the agents are correctly scoped to their org)

### Affected Components
1. **MCP Tool:** `agent-discover` (defined in `packages/agentc2/src/tools/agent-operations-tools.ts`)
2. **API Route:** `GET /api/agents?detail=discover` (defined in `apps/agent/src/app/api/agents/route.ts`)
3. **Resolver:** `agentResolver.listForUser()` (defined in `packages/agentc2/src/agents/resolver.ts`)
4. **Provisioner:** `upsertAgent()` (defined in `packages/agentc2/src/integrations/provisioner.ts`)

---

## Additional Context

### Why This Wasn't Caught Earlier
1. **Auto-provisioning is relatively new** — introduced with OAuth integration blueprints
2. **OAuth callbacks often lack user context** — the callback hits the server without an active session
3. **Most agents are manually created** with an explicit owner, so they pass the `ownerId: userId` filter
4. **Testing focused on invocation** (`agent_invoke_dynamic` works fine) rather than discovery

### Timing Evidence
The bug report mentions these agents were created on **March 12, 23:32 UTC** — they're the most recently created agents. This timing suggests they were created during a recent OAuth connection flow, which aligns with the root cause (OAuth callback without user context).

---

## Fix Plan

### Option A: Fix the Query (Recommended)

**Change:** Modify `listForUser()` to include org-scoped agents with `ownerId: null`

**Location:** `packages/agentc2/src/agents/resolver.ts`, lines 1992-2010

**Current Code:**
```typescript
OR: [
    ...(organizationId
        ? [{ ownerId: userId, workspace: { organizationId } }]
        : [{ ownerId: userId }]),
    ...(organizationId
        ? [{ visibility: "ORGANIZATION", workspace: { organizationId } }]
        : []),
    { visibility: "PUBLIC" }
]
```

**Proposed Fix:**
```typescript
OR: [
    // User's own agents
    ...(organizationId
        ? [{ ownerId: userId, workspace: { organizationId } }]
        : [{ ownerId: userId }]),
    
    // Organization-visible agents
    ...(organizationId
        ? [{ visibility: "ORGANIZATION", workspace: { organizationId } }]
        : []),
    
    // Org-scoped agents with no owner (auto-provisioned)
    ...(organizationId
        ? [{ ownerId: null, workspace: { organizationId } }]
        : []),
    
    // Public agents
    { visibility: "PUBLIC" }
]
```

**Pros:**
- ✅ Minimal change — one-line addition
- ✅ Fixes the bug for all existing affected agents
- ✅ No migration needed
- ✅ Preserves existing behavior for owned agents

**Cons:**
- ⚠️ Agents with `ownerId: null` are now visible to all org members (this is actually desired behavior for auto-provisioned agents)

**Risk:** Low — this only affects agents that were already meant to be org-accessible

---

### Option B: Fix the Provisioner

**Change:** Set `visibility: ORGANIZATION` and ensure `ownerId` is always populated

**Location:** `packages/agentc2/src/integrations/provisioner.ts`, line 309-335

**Proposed Fix:**
```typescript
const created = await prisma.agent.create({
    data: {
        // ...
        ownerId: userId,  // Keep as-is (can be null)
        createdBy: userId,
        visibility: "ORGANIZATION",  // ⬅️ NEW: Make auto-provisioned agents org-visible
        // ...
    }
});
```

**Pros:**
- ✅ Clearer intent — auto-provisioned agents should be org-visible by design
- ✅ Future-proof — all new OAuth agents will be discoverable

**Cons:**
- ⚠️ Doesn't fix existing agents — requires data migration
- ⚠️ Requires migration script to update 3 existing Google agents

**Risk:** Low — but requires coordination (code change + migration)

---

### Option C: Hybrid Approach (Best)

**Combine both fixes:**
1. Update provisioner to set `visibility: ORGANIZATION` for new agents
2. Update `listForUser()` to include `ownerId: null` agents as fallback
3. Optional: Migration script to update existing agents

**Files to Modify:**
1. `packages/agentc2/src/integrations/provisioner.ts` (line 323, add `visibility: "ORGANIZATION"`)
2. `packages/agentc2/src/agents/resolver.ts` (line 2007, add OR condition for `ownerId: null`)

**Pros:**
- ✅ Fixes the bug immediately for existing agents (via query change)
- ✅ Prevents future occurrences (via provisioner change)
- ✅ No migration required (query change handles existing agents)

**Cons:**
- None — this is defense-in-depth

**Risk:** Very Low

---

## Recommended Fix Steps

1. **Update Provisioner** (prevents future bugs)
   - File: `packages/agentc2/src/integrations/provisioner.ts`
   - Change: Add `visibility: "ORGANIZATION"` on line 323

2. **Update Agent Resolver** (fixes existing agents)
   - File: `packages/agentc2/src/agents/resolver.ts`
   - Change: Add `{ ownerId: null, workspace: { organizationId } }` to OR conditions

3. **Add Test Coverage**
   - File: `tests/unit/resolver.test.ts`
   - Test: Verify `listForUser` returns auto-provisioned agents with `ownerId: null`

4. **Verify Fix**
   - Call `agent_discover()` — should return 26 agents
   - Call `agent-list` with `detail: "capabilities"` — should include Google agents
   - Call `platform_context` — should still return 26 agents

5. **Deploy**
   - Run `bun run type-check`
   - Run `bun run lint`
   - Run `bun run build`
   - Push to main
   - Verify in production

---

## Complexity Estimate

- **Provisioner Change:** Trivial (1 line)
- **Resolver Change:** Simple (3 lines)
- **Test Coverage:** Moderate (15-20 lines)
- **Total Effort:** ~30 minutes
- **Risk Level:** Low

---

## Validation Criteria

The fix is complete when:
- ✅ `agent_discover()` returns 26 agents (not 23)
- ✅ `google-calendar-agent`, `google-drive-agent`, and `gsc-agent` appear in results
- ✅ All 3 agents show correct tool counts (6, 3, and 4 respectively)
- ✅ `agent_invoke_dynamic` still works for all 3 agents
- ✅ No new agents are excluded (must still return 26+, not fewer)
- ✅ Unit tests pass

---

## Related Issues

- None found — this is an isolated visibility bug

---

## Lessons Learned

1. **Auto-provisioning needs explicit visibility** — Don't rely on database defaults for multi-tenant resources
2. **OAuth callbacks may lack user context** — Design for `userId: undefined` scenarios
3. **Discovery queries need defense-in-depth** — Include fallback conditions for edge cases (e.g., `ownerId: null`)
4. **Test both paths** — Invocation and discovery use different queries; test both

---

## Appendix: Affected Agent Details

Based on the bug report, the 3 missing agents have these characteristics:

| Agent Slug | Tool Count | Status | Created | Visibility | ownerId |
|------------|-----------|--------|---------|-----------|---------|
| `google-calendar-agent` | 6 | Active | 2026-03-12 23:32 UTC | `PRIVATE` | `null` |
| `google-drive-agent` | 3 | Active | 2026-03-12 23:32 UTC | `PRIVATE` | `null` |
| `gsc-agent` | 4 | Active | 2026-03-12 23:32 UTC | `PRIVATE` | `null` |

All 3 were created via auto-provisioning during Google OAuth connection setup.

---

**Analysis Complete — Ready for Implementation**

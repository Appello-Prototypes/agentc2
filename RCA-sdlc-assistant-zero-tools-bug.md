# Root Cause Analysis: sdlc-assistant Created with Zero Tools

**Bug Report:** [GitHub Issue #184](https://github.com/Appello-Prototypes/agentc2/issues/184)  
**Status:** Analysis Complete - Ready for Implementation  
**Severity:** High (Critical User Experience Issue)  
**Date:** 2026-03-13

---

## Executive Summary

The personal assistant agent (`sdlc-assistant`) is created during onboarding with zero tools despite the workspace having 14 active integration connections (HubSpot, Jira, Fathom, GitHub, etc.) with 120+ tools available. The root cause is a **hardcoded tool provisioning flow** that only checks for 4 specific integrations (Gmail, Calendar, Drive, Slack) and has **no mechanism to sync tools when new integrations are connected**.

---

## Root Cause Analysis

### Primary Root Cause

**Location:** `/apps/agent/src/app/api/onboarding/bootstrap-agent/route.ts` (Lines 76-113)

The bootstrap agent endpoint uses a **hardcoded whitelist** that only provisions tools for four integrations:

```typescript
// Build tool list based on connections
const tools: string[] = [];
if (hasGmail) {
    tools.push("gmail-search-emails", "gmail-read-email", ...);
}
if (hasCalendar) {
    tools.push("google-calendar-search-events", ...);
}
if (hasDrive) {
    tools.push("google-drive-search-files", ...);
}
if (hasSlack) {
    tools.push("slack_slack_post_message", ...);
}
```

**Critical Flaw:** The `connectedIntegrations` array (line 39-41) is populated from the onboarding flow's UI state, NOT from querying the database for active `IntegrationConnection` records. This means:

1. If integrations are connected BEFORE onboarding completes → **not detected**
2. If integrations are connected AFTER the agent is created → **not synced**
3. MCP-based integrations (HubSpot, Jira, Fathom, GitHub) are **never included**, even if active

### Secondary Root Cause

**Location:** `/apps/agent/src/components/onboarding/ConnectStep.tsx` (Lines 54-62)

The onboarding UI only tracks **Gmail and Slack** connections:

```typescript
export function ConnectStep({
    gmailConnected: initialGmailConnected,
    gmailAddress,
    gmailMissingScopes,
    organizationId,
    userId,
    onContinue,
    onBack
}: ConnectStepProps) {
    const [gmailConnected] = useState(initialGmailConnected);
    const [slackConnected, setSlackConnected] = useState(false);
    // ...
}
```

When the user completes onboarding (line 710 of `/apps/agent/src/app/onboarding/page.tsx`), it passes `connectedIntegrations` to the bootstrap API:

```typescript
const handleConnectComplete = useCallback(
    async (connectedIntegrations: string[]) => {
        // Bootstrap the starter agent with connected integrations
        const response = await fetch(`${getApiBase()}/api/onboarding/bootstrap-agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ connectedIntegrations })
        });
        // ...
    },
    [onboardingPath]
);
```

**Critical Flaw:** The `connectedIntegrations` array only contains integrations the user connected during the onboarding UI flow (Gmail, Slack). It does NOT include:
- Integrations connected via the Settings > Integrations page
- Integrations connected via direct API calls
- Integrations inherited from joining an existing organization

### Tertiary Root Cause: No Re-sync Mechanism

**Location:** `/apps/agent/src/app/api/integrations/connections/route.ts` (Lines 211-249)

When a new integration is connected via POST `/api/integrations/connections`, the system:
1. Creates an `IntegrationConnection` record
2. Calls `provisionIntegration()` to create a **specialist agent** (e.g., `hubspot-agent`)
3. **Never updates the personal assistant's tools**

```typescript
// Auto-provision Skill + Agent if a blueprint exists for this provider
let provisionResult = null;
if (hasBlueprint(provider.key)) {
    try {
        // Get workspace for this org
        const workspace = await prisma.workspace.findFirst({
            where: { organizationId, isDefault: true },
            select: { id: true }
        });

        if (workspace) {
            provisionResult = await provisionIntegration(connection.id, {
                workspaceId: workspace.id,
                userId: authContext.userId
            });
            // ❌ No code here to update existing onboarding agents
        }
    } catch (provisionError) {
        // ...
    }
}
```

The integration provisioner (`/packages/agentc2/src/integrations/provisioner.ts`) creates a **new specialist agent** but has no logic to:
- Find the personal assistant agent (`isOnboardingAgent: true`)
- Update its `AgentTool` records with newly discovered tools
- Notify the user that their assistant gained new capabilities

---

## Evidence & Data Points

### 1. Agent State (from Bug Report)

```json
{
  "slug": "sdlc-assistant",
  "toolNames": [],  // ❌ Zero tools
  "instructions": "You are my personal AI assistant...",
  "modelProvider": "openai",
  "modelName": "gpt-4o"
}
```

Agent promises: _"If you connect integrations like Gmail or Slack, I could assist you with even more capabilities"_

Reality: Gmail, Google Drive, Google Calendar, HubSpot, Jira, Fathom, GitHub all connected (14 connections, 120+ tools).

### 2. Database Schema Evidence

```prisma
model Agent {
  // ...
  tools AgentTool[]  // Junction table
  isOnboardingAgent Boolean @default(false)
  // ...
}

model AgentTool {
  id      String @id @default(cuid())
  agentId String
  toolId  String  // Tool registry key
  @@unique([agentId, toolId])
}
```

Tools are stored in a **many-to-many junction table** (`AgentTool`), making them trivial to add/remove after agent creation.

### 3. Integration Connection Flow

From `/apps/agent/src/app/api/integrations/connections/route.ts` (POST handler):

**Successful Provisioning Log:**
```
[Integrations] Auto-provisioned hubspot: 
  skill=skill_abc123, 
  agent=agent_def456, 
  tools=47
```

**What's Missing:**
```
[Integrations] Updated onboarding agent with 47 new tools from hubspot
```

No such log exists because no such code exists.

---

## Impact Assessment

### User Impact (High Severity)

| Impact Area | Severity | Description |
|------------|----------|-------------|
| **First Impression** | Critical | New users create account, connect integrations, get an agent that does nothing |
| **Feature Discovery** | High | Users don't realize their integrations are usable via the assistant |
| **Workflow Disruption** | High | Users must manually create new agents or edit the assistant to add tools |
| **Trust Erosion** | High | Agent promises capabilities it doesn't have ("connect integrations...") |

### System Impact

- **No data corruption:** Tools are just missing from the junction table
- **No security risk:** The bug prevents capabilities, doesn't expose them
- **Easy rollback:** Fix can be deployed without migrations (schema unchanged)

### Affected Components

#### Direct Impact
1. **`/apps/agent/src/app/api/onboarding/bootstrap-agent/route.ts`**
   - Hardcoded tool provisioning logic
   - Missing database query for active connections

2. **`/apps/agent/src/components/onboarding/ConnectStep.tsx`**
   - Only tracks Gmail + Slack
   - Doesn't detect existing integrations

3. **`/apps/agent/src/app/api/integrations/connections/route.ts`**
   - No hook to update onboarding agents after provisioning

#### Indirect Impact
1. **Agent Resolver** (`/packages/agentc2/src/agents/resolver.ts`)
   - Returns agents with empty tool arrays (correct behavior given DB state)

2. **MCP Client** (`/packages/agentc2/src/mcp/client.ts`)
   - Works correctly; not a tool discovery issue

3. **Tool Registry** (`/packages/agentc2/src/tools/registry.ts`)
   - Works correctly; tools are available, just not attached

---

## Fix Plan

### Phase 1: Immediate Fix (High Priority)

#### Fix 1.1: Query Database for Active Integrations

**File:** `/apps/agent/src/app/api/onboarding/bootstrap-agent/route.ts`  
**Changes:**

```typescript
// BEFORE: Only check passed-in connectedIntegrations
const hasGmail = connectedIntegrations.includes("gmail");
const hasCalendar = connectedIntegrations.includes("calendar");

// AFTER: Query database for ALL active connections
const activeConnections = await prisma.integrationConnection.findMany({
    where: {
        organizationId: membership.organizationId,
        isActive: true
    },
    include: { provider: true }
});

// Build tool list from ALL active connections
const tools: string[] = [];

for (const connection of activeConnections) {
    const blueprint = getBlueprint(connection.provider.key);
    if (!blueprint) continue;

    if (blueprint.skill.toolDiscovery === "static" && blueprint.skill.staticTools) {
        tools.push(...blueprint.skill.staticTools);
    } else if (blueprint.skill.toolDiscovery === "dynamic") {
        const discoveredTools = await discoverMcpTools(
            membership.organizationId,
            connection.provider.key
        );
        tools.push(...discoveredTools);
    }
}

// Deduplicate tools
const uniqueTools = [...new Set(tools)];
```

**Risk:** Low  
**Complexity:** Medium (need to import blueprint helpers)  
**Testing Required:**
- Create account with zero integrations → agent has zero tools ✓
- Create account with Gmail connected → agent has Gmail tools ✓
- Create account with HubSpot connected → agent has HubSpot tools ✓
- Create account with 10+ integrations → agent has all tools ✓

#### Fix 1.2: Add Sync Hook on Integration Connection

**File:** `/apps/agent/src/app/api/integrations/connections/route.ts`  
**Changes:**

```typescript
// After provisioning specialist agent
if (workspace) {
    provisionResult = await provisionIntegration(connection.id, {
        workspaceId: workspace.id,
        userId: authContext.userId
    });

    // NEW: Sync tools to onboarding agent if it exists
    const onboardingAgent = await prisma.agent.findFirst({
        where: {
            workspaceId: workspace.id,
            isOnboardingAgent: true
        }
    });

    if (onboardingAgent && provisionResult.toolsDiscovered.length > 0) {
        await prisma.agentTool.createMany({
            data: provisionResult.toolsDiscovered.map((toolId) => ({
                agentId: onboardingAgent.id,
                toolId
            })),
            skipDuplicates: true
        });

        console.log(
            `[Integrations] Synced ${provisionResult.toolsDiscovered.length} ` +
            `tools from ${provider.key} to onboarding agent`
        );
    }
}
```

**Risk:** Low (skipDuplicates prevents errors)  
**Complexity:** Low  
**Testing Required:**
- Connect integration AFTER onboarding → assistant gains tools ✓
- Disconnect integration → tools remain (expected per provisioner design)
- Reconnect integration → no duplicate tools (skipDuplicates) ✓

### Phase 2: Enhanced Fix (Medium Priority)

#### Fix 2.1: Tool Removal on Deprovision

**File:** `/packages/agentc2/src/integrations/provisioner.ts` (Line 437+)  
**Changes:**

Extend `deprovisionIntegration()` to remove tools from onboarding agents:

```typescript
export async function deprovisionIntegration(
    providerKey: string,
    workspaceId: string
): Promise<DeprovisionResult> {
    // ... existing deactivation logic ...

    // NEW: Remove tools from onboarding agent
    const onboardingAgent = await prisma.agent.findFirst({
        where: { workspaceId, isOnboardingAgent: true }
    });

    if (onboardingAgent && blueprint) {
        const toolsToRemove = await getToolIdsForProvider(providerKey, workspaceId);
        if (toolsToRemove.length > 0) {
            await prisma.agentTool.deleteMany({
                where: {
                    agentId: onboardingAgent.id,
                    toolId: { in: toolsToRemove }
                }
            });
            console.log(
                `[Provisioner] Removed ${toolsToRemove.length} tools ` +
                `from onboarding agent for ${providerKey}`
            );
        }
    }

    return result;
}
```

**Risk:** Medium (must ensure correct tool scoping)  
**Complexity:** Medium  
**Testing Required:**
- Disconnect integration → assistant loses those specific tools ✓
- Other tools remain intact ✓
- Reconnect → tools re-added ✓

#### Fix 2.2: Backfill Script for Existing Agents

**File:** `/scripts/backfill-onboarding-agent-tools.ts` (new file)  
**Purpose:** One-time migration to fix existing production agents

```typescript
/**
 * Backfill tools for existing onboarding agents created before the fix.
 * 
 * Usage: bun run tsx scripts/backfill-onboarding-agent-tools.ts
 */

import { prisma } from "@repo/database";
import { getBlueprint } from "@repo/agentc2/integrations";
import { listMcpToolDefinitions } from "@repo/agentc2/mcp";

async function backfillOnboardingAgents() {
    const agents = await prisma.agent.findMany({
        where: { isOnboardingAgent: true },
        include: {
            workspace: { select: { organizationId: true } },
            tools: true
        }
    });

    console.log(`[Backfill] Found ${agents.length} onboarding agents`);

    for (const agent of agents) {
        const orgId = agent.workspace.organizationId;
        
        // Get active connections for this org
        const connections = await prisma.integrationConnection.findMany({
            where: { organizationId: orgId, isActive: true },
            include: { provider: true }
        });

        const toolsToAdd: string[] = [];

        for (const conn of connections) {
            const blueprint = getBlueprint(conn.provider.key);
            if (!blueprint) continue;

            if (blueprint.skill.toolDiscovery === "static") {
                toolsToAdd.push(...(blueprint.skill.staticTools || []));
            } else {
                const { definitions } = await listMcpToolDefinitions(orgId);
                const prefix = `${conn.provider.key}_`;
                const mcpTools = definitions
                    .filter(t => t.name.startsWith(prefix))
                    .map(t => t.name);
                toolsToAdd.push(...mcpTools);
            }
        }

        // Deduplicate
        const uniqueTools = [...new Set(toolsToAdd)];
        const existingToolIds = new Set(agent.tools.map(t => t.toolId));
        const newTools = uniqueTools.filter(id => !existingToolIds.has(id));

        if (newTools.length > 0) {
            await prisma.agentTool.createMany({
                data: newTools.map(toolId => ({
                    agentId: agent.id,
                    toolId
                })),
                skipDuplicates: true
            });

            console.log(
                `[Backfill] Added ${newTools.length} tools to agent ${agent.slug} ` +
                `(${connections.length} connections)`
            );
        } else {
            console.log(`[Backfill] No new tools for agent ${agent.slug}`);
        }
    }

    console.log("[Backfill] Complete");
}

backfillOnboardingAgents().catch(console.error);
```

**Risk:** Low (skipDuplicates prevents errors)  
**Complexity:** Low  
**Testing Required:**
- Run on staging database first ✓
- Verify agents gain expected tools ✓
- No side effects on specialist agents ✓

### Phase 3: Proactive Enhancements (Low Priority)

#### Enhancement 3.1: Tool Sync Dashboard Notification

When new tools are added to an agent, show a toast notification in the UI:

```typescript
// In the integration connection POST handler
if (onboardingAgent && toolsAdded > 0) {
    await createNotification({
        userId: authContext.userId,
        type: "info",
        title: "Your assistant got smarter!",
        message: `Added ${toolsAdded} new tools from ${provider.name}`,
        actionUrl: `/agents/${onboardingAgent.slug}/overview`
    });
}
```

#### Enhancement 3.2: Agent Settings Page: Tool Sync Button

Add a "Sync Tools from Integrations" button to `/agents/[slug]/overview`:

```typescript
async function syncToolsFromIntegrations(agentId: string) {
    const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { workspace: true }
    });

    const connections = await prisma.integrationConnection.findMany({
        where: { 
            organizationId: agent.workspace.organizationId,
            isActive: true 
        }
    });

    // Collect all available tools from active integrations
    // Add to agent.tools junction table
    // Return count of tools added
}
```

Allows users to manually trigger a sync if they notice tools missing.

---

## Risk Assessment

### Implementation Risks

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|------------|
| Breaking existing agents | Low | High | Use `skipDuplicates: true`, test on staging first |
| MCP tool discovery timeout | Medium | Low | Already has retry logic (3 attempts) in provisioner |
| Tool ID mismatch | Low | Medium | Validate against tool registry before inserting |
| Performance degradation | Low | Low | Tool sync is O(n) where n = connections (~10 max) |

### Rollback Plan

If the fix causes issues:

1. **Revert commit** — no schema changes, instant rollback
2. **Manual cleanup** — Remove incorrectly added tools:
   ```sql
   DELETE FROM agent_tool 
   WHERE agent_id IN (SELECT id FROM agent WHERE is_onboarding_agent = true)
   AND created_at > '2026-03-13 00:00:00';
   ```

### Testing Checklist

#### Unit Tests (Required)
- [ ] Bootstrap agent with zero connections → zero tools
- [ ] Bootstrap agent with 1 connection → correct tools
- [ ] Bootstrap agent with 10+ connections → all tools
- [ ] Connect integration after onboarding → tools synced
- [ ] Disconnect integration → tools removed (Phase 2)
- [ ] Tool ID deduplication works correctly

#### Integration Tests (Required)
- [ ] Full onboarding flow → agent created with tools
- [ ] Join existing org → inherit org's integrations
- [ ] Connect HubSpot → 47 tools added to assistant
- [ ] Connect GitHub → 30 tools added to assistant
- [ ] Backfill script on staging database

#### Manual QA (Required)
- [ ] Sign up new account, connect Gmail → test agent can read emails
- [ ] Sign up new account, connect HubSpot → test agent can query contacts
- [ ] Connect integration after onboarding → verify agent gains tools in UI
- [ ] Check agent settings page shows correct tool count
- [ ] Verify `agent_discover` returns correct toolNames array

---

## Estimated Complexity

| Phase | LOC Changed | Files Modified | Effort | Priority |
|-------|-------------|----------------|--------|----------|
| Phase 1.1 (Query DB) | ~80 lines | 1 file | 3 hours | **High** |
| Phase 1.2 (Sync Hook) | ~30 lines | 1 file | 1 hour | **High** |
| Phase 2.1 (Deprovision) | ~40 lines | 1 file | 2 hours | Medium |
| Phase 2.2 (Backfill) | ~100 lines | 1 file (new) | 2 hours | Medium |
| Phase 3 (Enhancements) | ~150 lines | 3 files | 4 hours | Low |
| **Testing** | — | — | **6 hours** | **Critical** |
| **Total** | ~400 lines | 6 files | **18 hours** | — |

---

## Recommendations

### Immediate Actions (Today)

1. **Implement Phase 1 fixes** (4 hours dev + 2 hours testing)
   - Query database for active integrations in bootstrap-agent
   - Add sync hook in connection creation handler

2. **Deploy to staging** and run comprehensive tests

3. **Deploy to production** with monitoring:
   ```bash
   # Watch for errors in sync hook
   pm2 logs | grep "Synced.*tools"
   ```

### Short-term Actions (This Week)

1. **Run backfill script** on production database to fix existing agents

2. **Monitor metrics:**
   - Tool count per onboarding agent (should average 20-50)
   - Agent invocation success rate (should improve)
   - User retention during onboarding (should improve)

### Medium-term Actions (This Month)

1. **Implement Phase 2 fixes** (tool removal on deprovision)

2. **Add integration tests** to CI/CD pipeline to prevent regression

3. **Document tool sync behavior** in `/CLAUDE.md` and internal docs

### Architectural Learnings

**Anti-Pattern Identified:** Hardcoded integration logic  
**Better Pattern:** Database-driven configuration

When adding new integrations, the current approach requires:
1. Update onboarding UI ❌
2. Update bootstrap API ❌
3. Update any other agent creation flows ❌

**Recommended approach:** All agent creation should:
1. Query `IntegrationConnection` table ✓
2. Use blueprint system for tool discovery ✓
3. Auto-sync tools on integration changes ✓

Apply this pattern to:
- Agent duplication/cloning flows
- Agent template instantiation
- Playbook deployment (if agents are created)

---

## Conclusion

This is a **critical but easily fixable bug** caused by hardcoded logic in the onboarding flow. The fix requires:

1. Changing bootstrap logic from UI-state-driven to **database-driven**
2. Adding a **sync hook** when integrations are connected
3. Running a **one-time backfill** for existing users

**Total effort:** 18 hours (4 hours dev + 6 hours testing + 2 hours backfill + 6 hours monitoring)

**User impact after fix:**
- New users get a functional assistant immediately ✓
- Existing users' assistants gain tools retroactively ✓
- Future integrations auto-sync to the assistant ✓

The fix aligns with the system's existing architecture (blueprints, provisioner, tool registry) and requires no schema changes.

---

**Analysis prepared by:** Claude (AI Agent)  
**Review required by:** Human engineer + QA team  
**Next step:** Approve fix plan and begin implementation

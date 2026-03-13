# Bug #180: Root Cause Analysis
## All native/OAuth/custom integration tools have description: null

**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/180  
**Analysis Date:** 2026-03-13  
**Analyst:** Cloud Agent

---

## Executive Summary

28 tools across 6 providers (Gmail, Google Drive, Google Calendar, Google Search Console, Cursor, Claude Code) have `description: null` in the `IntegrationTool` database table and API responses. MCP-sourced tools (GitHub, HubSpot, Jira, etc.) display descriptions correctly.

**Root Cause:** The `buildStaticToolDefinitions()` function in the integration auto-provisioner hardcodes `description: ""` (empty string) when creating `IntegrationTool` records for native/OAuth tools, rather than extracting descriptions from the actual tool definitions in the tool registry.

**Impact:** Medium - Reduces LLM tool selection accuracy and platform UI usability for ~23% of all tools.

---

## 1. Root Cause Analysis

### 1.1 Exact Location

**File:** `packages/agentc2/src/integrations/provisioner.ts`  
**Function:** `buildStaticToolDefinitions()`  
**Lines:** 765-777

```typescript
function buildStaticToolDefinitions(toolIds: string[]): DiscoveredToolDef[] {
    const defs: DiscoveredToolDef[] = [];
    for (const id of toolIds) {
        const humanName = id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        defs.push({
            toolId: id,
            name: humanName,
            description: "",  // ❌ BUG: Hardcoded empty string instead of fetching from registry
            inputSchema: null
        });
    }
    return defs;
}
```

### 1.2 Data Flow Comparison

#### ✅ **Working Path (MCP Tools)**

1. **MCP Server Discovery** (`discoverMcpToolsWithDefinitions()`, lines 940-982)
   - Calls `listMcpToolDefinitions(organizationId)` to fetch tool metadata from MCP servers
   - MCP servers return structured tool definitions with:
     - `name`: Tool ID (e.g., `"hubspot_hubspot-get-contacts"`)
     - `description`: Human-readable description (e.g., `"Search and filter HubSpot contacts by any property"`)
     - `parameters`: JSON schema for tool inputs
   
2. **Definition Mapping** (lines 959-966)
   ```typescript
   const matched = allTools
       .filter((t) => t.name.startsWith(prefix))
       .map((t) => ({
           toolId: t.name,
           name: t.description || t.name,
           description: t.description || "",  // ✅ Populated from MCP server
           inputSchema: t.parameters as Record<string, unknown> | null
       }));
   ```

3. **Database Sync** (`syncIntegrationToolRecords()`, lines 850-933)
   - Creates/updates `IntegrationTool` records with populated `description` field
   - Result: `description` column in database contains actual tool descriptions

#### ❌ **Broken Path (Native/OAuth/Custom Tools)**

1. **Static Tool List** (Integration Blueprints, e.g., `email.ts` lines 28-34)
   ```typescript
   staticTools: [
       "gmail-search-emails",
       "gmail-read-email",
       "gmail-send-email",
       "gmail-draft-email",
       "gmail-archive-email"
   ]
   ```

2. **Definition Generation** (`buildStaticToolDefinitions()`, lines 765-777)
   - Receives only tool IDs (strings)
   - Generates human-readable names via regex: `"gmail-search-emails"` → `"Gmail Search Emails"`
   - **Bug:** Sets `description: ""` instead of looking up actual description from tool registry
   - Does not access tool registry to fetch `tool.description` field

3. **Database Sync** (`syncIntegrationToolRecords()`, lines 850-933)
   - Creates/updates `IntegrationTool` records with `description: null` (or empty string)
   - Result: No descriptions stored or returned in API

### 1.3 Why Static Tools Are Missing Descriptions

**Static tools** (OAuth, credential-based integrations) are defined in `packages/agentc2/src/tools/` with full Mastra `createTool()` definitions that **already contain descriptions**:

**Example: Gmail Search Tool** (`tools/gmail/search-emails.ts`, lines 31-34)
```typescript
export const gmailSearchEmailsTool = createTool({
    id: "gmail-search-emails",
    description: "Search Gmail emails using Gmail search syntax. Returns message summaries with sender, subject, date, and snippet. Use queries like 'from:user@example.com newer_than:30d' or 'subject:invoice is:unread'.",
    inputSchema: z.object({ /* ... */ }),
    // ...
});
```

**Example: Cursor Launch Agent Tool** (`tools/cursor-tools.ts`, lines 83-89)
```typescript
export const cursorLaunchAgentTool = createTool({
    id: "cursor-launch-agent",
    description: "Launch a Cursor Cloud Agent to implement code changes on a GitHub repository. Provide a detailed prompt describing what to build or fix. The agent clones the repo, writes code, and pushes a branch. Set autoCreatePr to have Cursor automatically open a pull request when the agent finishes.",
    inputSchema: z.object({ /* ... */ }),
    // ...
});
```

These tools are registered in `packages/agentc2/src/tools/registry.ts` (lines 1347-1795) and **already have rich descriptions**. The provisioner simply doesn't fetch them.

### 1.4 Affected Tool Categories

| Provider | Category | Tool Count | Discovery Mode | Has Descriptions? |
|----------|----------|------------|----------------|-------------------|
| **Gmail** | Email & Calendar | 5 | `static` | ❌ No |
| **Google Drive** | File Storage | 3 | `static` | ❌ No |
| **Google Calendar** | Email & Calendar | 6 | `static` | ❌ No |
| **Google Search Console** | SEO Analytics | 4 | `static` | ❌ No |
| **Cursor** | Coding Pipeline | 5 | `static` | ❌ No |
| **Claude Code** | Coding Pipeline | 5 | `static` | ❌ No |
| **Microsoft 365** | Email & Calendar | 8 | `static` | ❌ No (likely same issue) |
| **Dropbox** | File Storage | 5 | `static` | ❌ No (likely same issue) |
| **Microsoft Teams** | Communication | 5 | `static` | ❌ No (likely same issue) |
| **HubSpot** | CRM | Dynamic | `dynamic` (MCP) | ✅ Yes |
| **GitHub** | Developer Tools | Dynamic | `dynamic` (MCP) | ✅ Yes |
| **Jira** | Productivity | Dynamic | `dynamic` (MCP) | ✅ Yes |
| **Fathom** | Knowledge | Dynamic | `dynamic` (MCP) | ✅ Yes |
| **ATLAS** | Automation | Dynamic | `dynamic` (MCP) | ✅ Yes |
| **Firecrawl** | Web | Dynamic | `dynamic` (MCP) | ✅ Yes |

**Total Affected:** ~28 confirmed tools, potentially up to 41 if all static-mode providers are affected.

---

## 2. Impact Assessment

### 2.1 User-Facing Impact

**Severity:** Medium

1. **Agent Tool Selection**
   - LLMs receive tool lists without descriptions, reducing tool selection accuracy
   - Agents must rely solely on tool ID names (e.g., `gmail-search-emails`) rather than rich descriptions
   - May lead to incorrect tool choices or failure to find appropriate tools

2. **Platform UI Experience**
   - Integration tool management UI (`/integrations/providers/{providerKey}/tools`) shows tools without descriptions
   - Users cannot understand tool capabilities without clicking through to documentation
   - Reduces self-service capability for non-technical users

3. **API Consumers**
   - External API clients receive incomplete tool metadata
   - Third-party integrations cannot display meaningful tool information

### 2.2 Affected Code Paths

**Primary affected flows:**

1. **Integration Auto-Provisioning** (`provisionIntegration()`, lines 38-159)
   - Called when an `IntegrationConnection` is created via OAuth callback
   - Triggers `syncIntegrationToolRecords()` with incomplete tool definitions

2. **Tool Re-Discovery** (`rediscoverToolsForConnection()`, lines 649-756)
   - Daily cron job to refresh tool lists
   - Continues to sync empty descriptions on each run

3. **Manual Tool Sync** (API: `POST /api/integrations/providers/{providerKey}/tools`, lines 153-215)
   - User-triggered re-sync via platform UI
   - Also affected by same bug

4. **Integration Tool API** (API: `GET /api/integrations/providers/{providerKey}/tools`, lines 18-146)
   - Returns `description: null` to frontend
   - Used by:
     - Integration management UI
     - Agent tool selection UI
     - Playbook setup flows

### 2.3 Data Integrity

**Current database state:**

- `IntegrationTool` table has `description` column (`@db.Text`, nullable)
- Approximately 28+ records with `description: null` or `""`
- Schema is correct; only data population is affected

**Query to identify affected records:**

```sql
SELECT providerKey, toolId, name, description
FROM integration_tool
WHERE description IS NULL OR description = ''
ORDER BY providerKey, toolId;
```

---

## 3. Technical Root Cause Details

### 3.1 Architecture Decision That Led to Bug

The system uses two different tool discovery mechanisms:

1. **Dynamic MCP Discovery** (for MCP-compatible servers)
   - Tools are fetched at runtime via `listMcpToolDefinitions()`
   - MCP protocol includes tool descriptions in the response
   - Works correctly

2. **Static Tool Lists** (for OAuth/credential integrations)
   - Tools are hardcoded in integration blueprints (e.g., `email.ts`, `developer.ts`)
   - Tool definitions exist in `tools/registry.ts` with full descriptions
   - **Problem:** Provisioner doesn't look up descriptions from registry

### 3.2 Why This Wasn't Caught Earlier

1. **No Type Enforcement**
   - `DiscoveredToolDef.description` is typed as `string`, not `string | null`
   - Empty string `""` is valid, so no TypeScript error

2. **Visual Similarity**
   - Generated names like `"Gmail Search Emails"` look reasonable in UI
   - Easy to miss that the `description` column is empty

3. **Focus on MCP Tools**
   - Most initial integrations (HubSpot, GitHub, Jira) were MCP-based
   - OAuth tools (Gmail, Cursor) were added later as static blueprints

4. **UI Graceful Degradation**
   - Frontend doesn't error on `description: null`, just renders nothing
   - No visual break in the UI to flag the issue

### 3.3 Related Code Issues

**Secondary issue:** `buildStaticToolDefinitions()` also sets `inputSchema: null` instead of extracting schemas from tool registry. This affects:
- API documentation generation
- Client-side validation
- Tool introspection features

---

## 4. Fix Plan

### 4.1 Primary Fix: Populate Descriptions from Tool Registry

**Goal:** Modify `buildStaticToolDefinitions()` to fetch descriptions from the tool registry.

**Files to Modify:**

1. **`packages/agentc2/src/integrations/provisioner.ts`** (Primary Fix)

**Changes Required:**

```typescript
// BEFORE (lines 765-777)
function buildStaticToolDefinitions(toolIds: string[]): DiscoveredToolDef[] {
    const defs: DiscoveredToolDef[] = [];
    for (const id of toolIds) {
        const humanName = id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        defs.push({
            toolId: id,
            name: humanName,
            description: "",  // ❌ Empty
            inputSchema: null
        });
    }
    return defs;
}

// AFTER
import { toolRegistry } from "../tools/registry";

function buildStaticToolDefinitions(toolIds: string[]): DiscoveredToolDef[] {
    const defs: DiscoveredToolDef[] = [];
    for (const id of toolIds) {
        const tool = toolRegistry[id];
        
        // Fallback to generated name if tool not in registry (shouldn't happen)
        const humanName = tool?.description 
            ? extractToolDisplayName(tool.description)  // Extract first sentence
            : id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        
        const description = tool?.description || "";
        
        // Extract inputSchema from tool.inputSchema (Zod schema)
        let inputSchema: Record<string, unknown> | null = null;
        if (tool?.inputSchema) {
            try {
                // Zod schemas have a .shape property for object schemas
                inputSchema = (tool.inputSchema as any)?.shape || null;
            } catch (error) {
                console.warn(`[Provisioner] Failed to extract inputSchema for ${id}:`, error);
            }
        }
        
        defs.push({
            toolId: id,
            name: humanName,
            description,
            inputSchema
        });
    }
    return defs;
}

// Helper function to extract short name from description
function extractToolDisplayName(description: string): string {
    // Take first sentence up to first period, or first 80 chars
    const firstSentence = description.split('.')[0];
    return firstSentence.length > 80 
        ? firstSentence.slice(0, 77) + '...'
        : firstSentence;
}
```

**Add import at top of file:**
```typescript
import { toolRegistry } from "../tools/registry";
```

### 4.2 Data Migration Script

**Goal:** Backfill existing `IntegrationTool` records with descriptions from registry.

**New File:** `scripts/backfill-integration-tool-descriptions.ts`

```typescript
import { prisma } from "@repo/database";
import { toolRegistry } from "@repo/agentc2/tools/registry";

async function backfillDescriptions() {
    console.log("[Backfill] Starting IntegrationTool description backfill...");
    
    // Fetch all IntegrationTool records with missing descriptions
    const tools = await prisma.integrationTool.findMany({
        where: {
            OR: [
                { description: null },
                { description: "" }
            ]
        }
    });
    
    console.log(`[Backfill] Found ${tools.length} tools with missing descriptions`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const tool of tools) {
        const registryTool = toolRegistry[tool.toolId];
        if (registryTool?.description) {
            await prisma.integrationTool.update({
                where: { id: tool.id },
                data: { 
                    description: registryTool.description,
                    updatedAt: new Date()
                }
            });
            console.log(`✓ ${tool.toolId}: ${registryTool.description.slice(0, 60)}...`);
            updated++;
        } else {
            console.warn(`✗ ${tool.toolId}: Not found in registry`);
            notFound++;
        }
    }
    
    console.log(`\n[Backfill] Complete: ${updated} updated, ${notFound} not found`);
}

backfillDescriptions()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("[Backfill] Failed:", error);
        process.exit(1);
    });
```

**Add to `package.json` scripts:**
```json
"scripts": {
    "backfill:tool-descriptions": "bun run scripts/backfill-integration-tool-descriptions.ts"
}
```

### 4.3 Testing Plan

#### Unit Tests

**New File:** `tests/unit/integration-tool-descriptions.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { toolRegistry } from "@repo/agentc2/tools/registry";

describe("buildStaticToolDefinitions", () => {
    test("should populate descriptions from tool registry", async () => {
        const { buildStaticToolDefinitions } = await import(
            "@repo/agentc2/integrations/provisioner"
        );
        
        const toolIds = [
            "gmail-search-emails",
            "cursor-launch-agent",
            "google-drive-search-files"
        ];
        
        const defs = buildStaticToolDefinitions(toolIds);
        
        expect(defs).toHaveLength(3);
        
        for (const def of defs) {
            expect(def.description).toBeTruthy();
            expect(def.description.length).toBeGreaterThan(10);
            
            // Verify description matches registry
            const registryTool = toolRegistry[def.toolId];
            expect(registryTool).toBeDefined();
            expect(def.description).toBe(registryTool.description);
        }
    });
    
    test("should handle tools not in registry gracefully", async () => {
        const { buildStaticToolDefinitions } = await import(
            "@repo/agentc2/integrations/provisioner"
        );
        
        const defs = buildStaticToolDefinitions(["nonexistent-tool"]);
        
        expect(defs).toHaveLength(1);
        expect(defs[0].toolId).toBe("nonexistent-tool");
        expect(defs[0].description).toBe(""); // Fallback to empty string
    });
});

describe("Tool Registry Integrity", () => {
    test("all static tools in blueprints exist in registry", async () => {
        const { getAllBlueprints } = await import("@repo/agentc2/integrations/blueprints");
        
        const blueprints = getAllBlueprints();
        const staticBlueprints = blueprints.filter(
            (bp) => bp.skill.toolDiscovery === "static" && bp.skill.staticTools
        );
        
        const missingTools: string[] = [];
        
        for (const bp of staticBlueprints) {
            for (const toolId of bp.skill.staticTools!) {
                if (!toolRegistry[toolId]) {
                    missingTools.push(`${bp.providerKey}: ${toolId}`);
                }
            }
        }
        
        expect(missingTools).toEqual([]);
    });
    
    test("all static tools have non-empty descriptions", () => {
        const staticToolIds = [
            "gmail-search-emails", "gmail-read-email", "gmail-send-email",
            "gmail-draft-email", "gmail-archive-email",
            "google-drive-search-files", "google-drive-read-file", "google-drive-create-doc",
            "google-calendar-search-events", "google-calendar-list-events",
            "google-calendar-get-event", "google-calendar-create-event",
            "google-calendar-update-event", "google-calendar-delete-event",
            "gsc-query-analytics", "gsc-list-sites", "gsc-get-sitemaps", "gsc-inspect-url",
            "cursor-launch-agent", "cursor-get-status", "cursor-add-followup",
            "cursor-get-conversation", "cursor-poll-until-done",
            "claude-launch-agent", "claude-get-status", "claude-add-followup",
            "claude-get-conversation", "claude-poll-until-done"
        ];
        
        const missingDescriptions: string[] = [];
        
        for (const toolId of staticToolIds) {
            const tool = toolRegistry[toolId];
            if (!tool?.description || tool.description.length < 10) {
                missingDescriptions.push(toolId);
            }
        }
        
        expect(missingDescriptions).toEqual([]);
    });
});
```

#### Integration Test

**Test Scenario:** Provision a new Gmail connection and verify IntegrationTool descriptions are populated.

```typescript
describe("Integration Tool Provisioning", () => {
    test("gmail integration creates tools with descriptions", async () => {
        // 1. Create a test organization + workspace
        const org = await prisma.organization.create({ /* ... */ });
        const workspace = await prisma.workspace.create({ /* ... */ });
        
        // 2. Create a Gmail IntegrationConnection
        const provider = await prisma.integrationProvider.findFirst({
            where: { key: "gmail" }
        });
        const connection = await prisma.integrationConnection.create({
            data: {
                organizationId: org.id,
                providerId: provider!.id,
                scope: "org",
                isActive: true,
                credentials: { /* mock */ }
            }
        });
        
        // 3. Trigger provisioning
        const { provisionIntegration } = await import("@repo/agentc2/integrations/provisioner");
        const result = await provisionIntegration(connection.id, {
            workspaceId: workspace.id
        });
        
        expect(result.success).toBe(true);
        expect(result.toolsDiscovered).toHaveLength(5); // 5 Gmail tools
        
        // 4. Verify IntegrationTool records have descriptions
        const tools = await prisma.integrationTool.findMany({
            where: { connectionId: connection.id }
        });
        
        expect(tools).toHaveLength(5);
        
        for (const tool of tools) {
            expect(tool.description).toBeTruthy();
            expect(tool.description!.length).toBeGreaterThan(20);
            console.log(`${tool.toolId}: ${tool.description}`);
        }
    });
});
```

### 4.4 Rollout Steps

1. **Pre-Deploy Validation**
   - Run `bun run type-check`
   - Run `bun run lint`
   - Run unit tests: `bun test tests/unit/integration-tool-descriptions.test.ts`

2. **Deploy Code**
   - Merge fix to `main` branch
   - Automatic deploy via GitHub Actions

3. **Run Data Migration**
   - SSH to production server
   - Run: `bun run backfill:tool-descriptions`
   - Verify output: `~28 updated, 0 not found`

4. **Verify Fix**
   - API check: `curl https://agentc2.ai/agent/api/integrations/providers/gmail/tools`
   - Verify all tools have `description` field populated
   - UI check: Navigate to Integration Management UI, verify descriptions visible

5. **Re-Trigger Discovery (Optional)**
   - For existing connections, POST to `/api/integrations/providers/{providerKey}/tools` to force re-sync

### 4.5 Risk Assessment

**Risk Level:** Low

**Risks:**

1. **Tool Registry Import in Provisioner**
   - **Risk:** Circular dependency if tool registry imports provisioner
   - **Mitigation:** Tool registry has no provisioner imports; safe to import

2. **Performance Impact**
   - **Risk:** Looking up tools in registry on every provisioning event
   - **Mitigation:** Registry is an in-memory object literal; O(1) lookup time

3. **Missing Tools in Registry**
   - **Risk:** Blueprint references tool ID not in registry
   - **Mitigation:** Unit test validates all blueprint tools exist in registry

4. **Data Migration Failure**
   - **Risk:** Backfill script fails mid-execution
   - **Mitigation:** Script is idempotent (can be re-run safely)

**Rollback Plan:**

If issues arise, revert the commit and run:
```sql
UPDATE integration_tool 
SET description = NULL 
WHERE description IS NOT NULL 
AND providerKey IN ('gmail', 'google-drive', 'google-calendar', 'google-search-console', 'cursor', 'claude-code');
```

### 4.6 Alternative Approaches Considered

#### Option A: Extract descriptions from MCP schema definitions

**Approach:** Create MCP schema wrappers for native tools (like we do for platform tools).

**Pros:**
- Consistent architecture with MCP tools
- Enables external MCP clients to use native tools

**Cons:**
- More complex implementation
- Requires maintaining parallel MCP schema definitions
- Doesn't solve the root problem (still need to map tool IDs to descriptions)

**Decision:** Rejected - overly complex for the problem scope.

#### Option B: Store descriptions in integration blueprints

**Approach:** Add `toolDescriptions` map to blueprint definitions.

**Example:**
```typescript
{
    providerKey: "gmail",
    skill: {
        staticTools: ["gmail-search-emails", "gmail-read-email"],
        toolDescriptions: {
            "gmail-search-emails": "Search Gmail emails using Gmail search syntax...",
            "gmail-read-email": "Read the full content of a Gmail email..."
        }
    }
}
```

**Pros:**
- Keeps all integration metadata in one place
- No dependency on tool registry

**Cons:**
- Duplicates descriptions already in tool registry
- More verbose blueprint definitions
- Requires manual sync if tool descriptions change

**Decision:** Rejected - violates DRY principle.

#### Option C: Chosen Approach - Fetch from Tool Registry

**Pros:**
- Single source of truth for tool metadata
- No duplication
- Minimal code changes
- Leverages existing infrastructure

**Cons:**
- Adds dependency from provisioner to tool registry (acceptable)

**Decision:** Selected - simplest and most maintainable.

---

## 5. Verification Checklist

After implementing the fix, verify:

- [ ] `buildStaticToolDefinitions()` imports and uses `toolRegistry`
- [ ] Unit tests pass for description population
- [ ] Integration test passes for Gmail provisioning
- [ ] Data migration script completes successfully
- [ ] API response includes descriptions for all 28 affected tools
- [ ] Platform UI shows descriptions in integration tool list
- [ ] No new TypeScript errors
- [ ] No new ESLint warnings
- [ ] Build succeeds: `bun run build`
- [ ] Deployed to production
- [ ] Post-deploy verification: Sample 3 affected tools via API

---

## 6. Long-Term Improvements

### 6.1 Architecture Improvements

1. **Unified Tool Definition Interface**
   - Create a single `ToolMetadata` interface shared by registry, MCP, and provisioner
   - Ensures consistent field names and types

2. **Tool Registry Export**
   - Export `getToolMetadata(toolId: string)` helper function
   - Centralizes tool lookup logic

3. **Blueprint Validation**
   - Add build-time check that all `staticTools` exist in registry
   - Fail build if blueprint references non-existent tool

### 6.2 Monitoring & Alerting

1. **Data Integrity Check**
   - Daily cron job to detect `IntegrationTool` records with missing descriptions
   - Alert if count exceeds threshold

2. **API Response Validation**
   - Add response schema validation to `/api/integrations/providers/{providerKey}/tools`
   - Log warning if `description` field is missing

### 6.3 Documentation Updates

1. **Integration Blueprint Guide**
   - Document `staticTools` vs `dynamic` tool discovery
   - Explain when to use each approach

2. **Tool Registry Docs**
   - Document requirement that all tools must have descriptions
   - Add linting rule to enforce non-empty descriptions

---

## 7. Related Issues

**None identified.** This appears to be an isolated issue affecting only static tool provisioning.

**Future Considerations:**
- Issue #XXX (if any) - Tool schema validation
- Issue #YYY (if any) - MCP schema generation for native tools

---

## Appendix A: Affected Tool List

| Provider | Tool ID | Current Description | Expected Description Source |
|----------|---------|---------------------|----------------------------|
| **gmail** | `gmail-search-emails` | `null` | `gmailSearchEmailsTool.description` |
| gmail | `gmail-read-email` | `null` | `gmailReadEmailTool.description` |
| gmail | `gmail-send-email` | `null` | `gmailSendEmailTool.description` |
| gmail | `gmail-draft-email` | `null` | `gmailDraftEmailTool.description` |
| gmail | `gmail-archive-email` | `null` | `gmailArchiveEmailTool.description` |
| **google-drive** | `google-drive-search-files` | `null` | `googleDriveSearchFilesTool.description` |
| google-drive | `google-drive-read-file` | `null` | `googleDriveReadFileTool.description` |
| google-drive | `google-drive-create-doc` | `null` | `googleDriveCreateDocTool.description` |
| **google-calendar** | `google-calendar-search-events` | `null` | `googleCalendarSearchEventsTool.description` |
| google-calendar | `google-calendar-list-events` | `null` | `googleCalendarListEventsTool.description` |
| google-calendar | `google-calendar-get-event` | `null` | `googleCalendarGetEventTool.description` |
| google-calendar | `google-calendar-create-event` | `null` | `googleCalendarCreateEventTool.description` |
| google-calendar | `google-calendar-update-event` | `null` | `googleCalendarUpdateEventTool.description` |
| google-calendar | `google-calendar-delete-event` | `null` | `googleCalendarDeleteEventTool.description` |
| **google-search-console** | `gsc-query-analytics` | `null` | `gscQueryAnalyticsTool.description` |
| google-search-console | `gsc-list-sites` | `null` | `gscListSitesTool.description` |
| google-search-console | `gsc-get-sitemaps` | `null` | `gscGetSitemapsTool.description` |
| google-search-console | `gsc-inspect-url` | `null` | `gscInspectUrlTool.description` |
| **cursor** | `cursor-launch-agent` | `null` | `cursorLaunchAgentTool.description` |
| cursor | `cursor-get-status` | `null` | `cursorGetStatusTool.description` |
| cursor | `cursor-add-followup` | `null` | `cursorAddFollowupTool.description` |
| cursor | `cursor-get-conversation` | `null` | `cursorGetConversationTool.description` |
| cursor | `cursor-poll-until-done` | `null` | `cursorPollUntilDoneTool.description` |
| **claude-code** | `claude-launch-agent` | `null` | `claudeLaunchAgentTool.description` |
| claude-code | `claude-get-status` | `null` | `claudeGetStatusTool.description` |
| claude-code | `claude-add-followup` | `null` | `claudeAddFollowupTool.description` |
| claude-code | `claude-get-conversation` | `null` | `claudeGetConversationTool.description` |
| claude-code | `claude-poll-until-done` | `null` | `claudePollUntilDoneTool.description` |

**Total: 28 confirmed affected tools**

---

## Appendix B: Code References

**Key Files:**

1. **Provisioner:** `packages/agentc2/src/integrations/provisioner.ts`
   - Lines 765-777: `buildStaticToolDefinitions()` - PRIMARY BUG LOCATION
   - Lines 850-933: `syncIntegrationToolRecords()` - Database sync
   - Lines 940-982: `discoverMcpToolsWithDefinitions()` - Working MCP flow

2. **Tool Registry:** `packages/agentc2/src/tools/registry.ts`
   - Lines 1347-1795: Tool definitions with descriptions
   - All tools registered with full Mastra `createTool()` metadata

3. **Integration Blueprints:**
   - `packages/agentc2/src/integrations/blueprints/email.ts` (Lines 28-34: Gmail static tools)
   - `packages/agentc2/src/integrations/blueprints/developer.ts` (Lines 268-274: Cursor tools)
   - `packages/agentc2/src/integrations/blueprints/marketing.ts` (Lines 136-141: GSC tools)

4. **API Routes:**
   - `apps/agent/src/app/api/integrations/providers/[providerKey]/tools/route.ts`
   - Lines 124-135: API response serialization (exposes the bug)

5. **Prisma Schema:**
   - `packages/database/prisma/schema.prisma`
   - Lines 433-453: `IntegrationTool` model definition

---

**Analysis Complete. Ready for implementation approval.**

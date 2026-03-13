# Root Cause Analysis: Jira Agent Runtime Failure

**Bug Report**: Jira agent fails at runtime despite connection test passing with 49 tools  
**GitHub Issue**: https://github.com/Appello-Prototypes/agentc2/issues/185  
**Date**: 2026-03-13  
**Analyst**: AI Assistant (Claude Sonnet 4.5)

---

## Executive Summary

The Jira agent (`jira-agent`) fails to execute Jira tools at runtime, returning generic failure messages like "currently unable to retrieve the list of Jira projects due to a technical issue," even though the connection test (`integration_connection_test`) successfully discovers 49 tools with all phases green. The root cause lies in a **critical architectural disconnect** between how MCP tools are tested versus how they are loaded and executed during agent runtime.

**Severity**: HIGH  
**Impact**: Complete Jira integration failure for all agents using Jira tools

---

## Reproduction Path

1. **Connection Test** (✅ PASSES):
   ```
   integration_connection_test(connectionId: 'cmmmqomx501af8e17mm3hnl5b')
   → Returns: success, 49 tools discovered, all phases green
   → Server init time: 2,638ms
   ```

2. **Agent Invocation** (❌ FAILS):
   ```
   agent_invoke_dynamic(agentSlug: 'jira-agent', message: 'List all Jira projects.')
   → Agent response: "currently unable to retrieve the list of Jira projects due to a technical issue"
   → No tool execution, generic error message
   ```

3. **Specific Tool Test** (❌ FAILS):
   ```
   agent_invoke_dynamic(agentSlug: 'jira-agent', message: 'Get the user profile of the current Jira user.')
   → Agent asks for user identifier instead of using jira_jira_get_user_profile
   → Tool not called or unavailable at runtime
   ```

---

## Architecture Analysis

### Connection Test Flow (Works)

**File**: `packages/agentc2/src/mcp/client.ts`  
**Function**: `testMcpServer()` (lines 4740-4824)

```
1. Resolve server definition by serverId
   → buildServerDefinitionForProvider() for "jira"
   → Returns: { command: "uvx", args: ["mcp-atlassian"], env: {...} }

2. Create fresh MCPClient
   → new MCPClient({ id: "mastra-mcp-test-jira", servers: { jira: {...} }, timeout: 10000 })

3. Call client.listTools() directly
   → Spawns fresh process: `uvx mcp-atlassian`
   → MCP handshake succeeds
   → Returns 49 tools

4. Disconnect and return success
   → No connection pooling, fresh state every time
```

**Key characteristics**:
- Fresh process spawn every test
- No caching involved
- Direct API call to MCP server
- Short-lived connection (disconnects immediately after test)
- **Always works** because it's a clean slate

### Agent Runtime Flow (Fails)

**Files**:
- `packages/agentc2/src/agents/resolver.ts` - Agent resolution and hydration
- `packages/agentc2/src/mcp/client.ts` - MCP client management
- `packages/agentc2/src/tools/registry.ts` - Tool registry and loading
- `apps/agent/src/app/api/agents/[id]/invoke/route.ts` - Agent invocation endpoint

```
1. Agent Resolution
   └─ agentResolver.resolve({ slug: "jira-agent", requestContext, threadId })
      └─ hydrate(record, requestContext, threadId)
         └─ getToolsByNamesAsync(toolNames, organizationId)
            └─ getMcpToolsCached(organizationId)
               └─ getMcpTools(organizationId)
                  ├─ getMcpClientForOrganization({ organizationId, userId })
                  │  ├─ Check cache: orgMcpClients.get(cacheKey)
                  │  ├─ If expired or missing:
                  │  │  ├─ getIntegrationConnections({ organizationId, userId })
                  │  │  ├─ buildServerConfigs({ connections, allowEnvFallback: false })
                  │  │  └─ new MCPClient({ id: "mastra-mcp-client-{orgId}", servers, timeout: 60000 })
                  │  └─ Cache client for 60 seconds (ORG_MCP_CACHE_TTL)
                  │
                  └─ loadToolsPerServer(servers, cacheKey)
                     └─ Promise.allSettled(servers.map(loadToolsFromServer))
                        └─ loadToolsFromServer(serverId, serverDef, maxRetries=1)
                           ├─ Create isolated client per server
                           │  └─ new MCPClient({ id: "mastra-mcp-iso-{serverId}", servers: { [serverId]: serverDef }, timeout: 60000 })
                           ├─ client.listTools() with 1 retry on failure
                           ├─ sanitizeMcpTools(tools)
                           └─ client.disconnect()

2. Tools Added to Agent
   └─ Agent constructor receives tools object
      └─ Tools are Mastra Tool objects with .execute() methods
         └─ Each MCP tool's execute() delegates to underlying MCPClient

3. Agent Execution
   └─ agent.generate(input, options)
      └─ LLM decides to call tool "jira_jira_get_all_projects"
         └─ Mastra Agent runtime looks up tool in tools object
            └─ tool.execute({ context: parameters })
               └─ Delegates to MCP client's tool execution
                  └─ **FAILURE POINT**: Tool execution fails silently or returns error
```

**Key characteristics**:
- Complex caching layers (ORG_MCP_CACHE_TTL: 60s, per-server tools cache: 60s)
- Connection pooling and reuse
- Multi-step tool loading with isolated clients per server
- Tool sanitization and schema patching
- **Can fail** due to stale connections, cache mismatches, or runtime errors

---

## Root Cause Hypothesis

### Primary Hypothesis: MCP Client Connection State Mismatch

**Location**: `packages/agentc2/src/mcp/client.ts`  
**Functions**: `getMcpClientForOrganization()` (lines 3876-3910), `loadToolsPerServer()` (lines 4032-4073)

#### The Problem

1. **Tool Loading Phase** (works):
   - `loadToolsFromServer()` creates an **isolated, temporary MCPClient** for each server
   - Calls `client.listTools()` to discover tools
   - **Immediately disconnects** the client after loading tools: `await client.disconnect()`
   - Stores tool metadata (names, schemas) in cache
   - Tools are sanitized and wrapped as Mastra Tool objects

2. **Tool Execution Phase** (fails):
   - When an agent calls a Jira tool, the tool's `.execute()` method is invoked
   - The tool object needs to communicate with the Jira MCP server
   - **BUT**: The isolated client used to load tools has already been disconnected
   - The tool execution likely tries to use a **stale or disconnected connection**

#### Evidence

**File**: `packages/agentc2/src/mcp/client.ts`, lines 4009-4020

```typescript
const client = new MCPClient({
    id: `mastra-mcp-iso-${serverId}`,
    servers: { [serverId]: serverDef },
    timeout: 60000
});
try {
    const tools = await client.listTools();
    return { serverId, tools: sanitizeMcpTools(tools) };
} catch (err) {
    lastError = err;
} finally {
    await client.disconnect().catch(() => {});  // ← Client disconnected!
}
```

**The disconnect happens in `loadToolsFromServer()`, but the tool objects returned still hold references to the disconnected client.**

---

### Secondary Hypothesis: Tool Name Resolution Mismatch

**Location**: `packages/agentc2/src/mcp/client.ts`, lines 4945-4960

#### The Problem

MCP tools are stored with **dot notation** (`jira.jira_get_all_projects`) in `client.listToolsets()`, but agents may request them with **underscore notation** (`jira_jira_get_all_projects`). While the code attempts to handle both formats, mismatches can occur:

```typescript
const namesToTry = [
    resolvedToolName,
    resolvedToolName.replace("_", "."),  // Only replaces FIRST underscore
    resolvedToolName.replace(".", "_")
];
```

**Problem**: `replace("_", ".")` only replaces the **first** underscore. For tool names like `jira_jira_get_all_projects`, this converts to `jira.jira_get_all_projects`, which may not match the actual tool name if the MCP server uses a different format.

**Evidence**: The executeMcpTool function (line 4943) calls `client.listToolsets()`, but agents may have tools registered via `client.listTools()` which uses a different naming convention.

---

### Tertiary Hypothesis: Cache Staleness

**Location**: `packages/agentc2/src/mcp/client.ts`, lines 43-90

#### The Problem

Three layers of caching exist:

1. **Org MCP Client Cache** (`orgMcpClients`): 60-second TTL
2. **Per-Server Tools Cache** (`perServerToolsCache`): 60-second TTL  
3. **Last-Known-Good Cache** (`lastKnownGoodTools`): 10-minute stale fallback

**Scenario**:
1. Agent is resolved, tools are loaded from Jira MCP server (fresh connection)
2. Tools are cached with 60-second TTL
3. Connection is closed immediately after tool loading
4. 30 seconds later, agent tries to execute a tool
5. Tool execution tries to use a connection that no longer exists
6. **Silent failure** or generic error message

**Evidence**: Cache invalidation only happens on explicit calls to `invalidateMcpCacheForOrg()` or when TTL expires. There's no health check when retrieving cached tools to verify the underlying connections are still alive.

---

### Quaternary Hypothesis: Tool Execution Context Missing OrganizationId

**Location**: Multiple files - tool execution doesn't pass org context

#### The Problem

When tools are executed at runtime, they may not receive the `organizationId` context needed to:
1. Resolve the correct MCP client from the org-scoped cache
2. Find the correct Jira connection credentials
3. Execute against the right Jira instance

**Evidence**: In `executeMcpTool()` (line 4939), the function gets an org-scoped client:

```typescript
const client = await getMcpClientForOrganization({
    organizationId: options?.organizationId,
    userId: options?.userId
});
```

**BUT** when tools are loaded into the agent during hydration, they're created as standalone Mastra Tool objects. When the agent later calls `tool.execute()`, it's unclear whether the organizationId context is properly propagated through the Mastra framework to the underlying MCP client.

---

## Impact Assessment

### Affected Systems

1. **Jira Integration** (PRIMARY)
   - All 49 Jira tools are non-functional at runtime
   - `jira_jira_get_all_projects`, `jira_jira_get_user_profile`, etc.
   - Affects any agent with Jira tools enabled

2. **SDLC Signal Harvester Agent** (CRITICAL)
   - Cannot pull Jira issue data
   - Cannot track sprint progress
   - SDLC signal pipeline broken

3. **SDLC Prioritizer Agent** (CRITICAL)
   - Cannot access Jira project data
   - Cannot create/update issues
   - Prioritization workflow non-functional

4. **Other MCP Integrations** (POTENTIAL)
   - Same architectural flaw may affect: HubSpot, Slack, GitHub, Fathom, etc.
   - Any MCP server using the same tool-loading pattern is at risk
   - Requires testing to confirm scope

### User Experience Impact

- **Connection test shows green** ✅ → User believes integration is working
- **Runtime execution fails silently** ❌ → Agent returns generic error messages
- **No actionable error details** → User cannot diagnose or fix the issue
- **Trust erosion** → Users lose confidence in the platform

---

## Reproduction Risk

**Likelihood**: HIGH  
**Affected Integrations**: Jira (confirmed), potentially all MCP servers

### Conditions Required

1. Agent has Jira tools configured
2. Organization has active Jira IntegrationConnection
3. Connection test passes (tools discovered successfully)
4. Agent invokes a tool that requires MCP server communication
5. Tool execution phase begins

### Why Connection Test Passes But Runtime Fails

| Aspect | Connection Test | Agent Runtime |
|--------|----------------|---------------|
| **Client Lifecycle** | Fresh, short-lived | Cached, pooled, reused |
| **Tool Loading** | Direct `listTools()` call | Isolated per-server clients |
| **Connection State** | Connected during test | Disconnected after tool load |
| **Caching** | None | 60s org cache, 60s tool cache |
| **Error Handling** | Explicit phases logged | Silent failures, generic messages |
| **Timeout** | 10s (test) | 60s (runtime) |
| **Retry Logic** | None | 1 retry per server |

**The test validates credentials and server availability, but does NOT validate that tools remain executable after loading.**

---

## Fix Plan

### Phase 1: Immediate Diagnosis (1-2 hours)

**Objective**: Confirm the root cause with targeted logging

**Tasks**:

1. **Add Debug Logging to Tool Execution**
   - **File**: `packages/agentc2/src/mcp/client.ts`
   - **Function**: `executeMcpTool()` (line 4911)
   - **Changes**:
     ```typescript
     export async function executeMcpTool(...) {
         console.log(`[MCP Tool Execution] Attempting to execute: ${toolName}`, {
             organizationId: options?.organizationId,
             userId: options?.userId,
             connectionId: options?.connectionId
         });
         
         const client = await getMcpClientForOrganization({
             organizationId: options?.organizationId,
             userId: options?.userId
         });
         
         console.log(`[MCP Tool Execution] Client resolved:`, {
             clientId: (client as any)._id || 'unknown',
             toolsetsAvailable: Object.keys(await client.listToolsets()).length
         });
         
         // ... rest of function
         
         if (!tool) {
             console.error(`[MCP Tool Execution] Tool not found in toolsets:`, {
                 requestedTool: resolvedToolName,
                 attemptedNames: namesToTry,
                 availableTools: Object.keys(toolsets).filter(k => k.startsWith('jira'))
             });
         }
     }
     ```

2. **Add Logging to Tool Loading**
   - **File**: `packages/agentc2/src/mcp/client.ts`
   - **Function**: `loadToolsFromServer()` (line 3994)
   - **Changes**:
     ```typescript
     async function loadToolsFromServer(serverId, serverDef, maxRetries = 1) {
         console.log(`[MCP Tool Loading] Starting tool load for server: ${serverId}`);
         
         const client = new MCPClient({ ... });
         try {
             const tools = await client.listTools();
             console.log(`[MCP Tool Loading] Successfully loaded ${Object.keys(tools).length} tools from ${serverId}`);
             console.log(`[MCP Tool Loading] Sample tool names:`, Object.keys(tools).slice(0, 5));
             return { serverId, tools: sanitizeMcpTools(tools) };
         } catch (err) {
             console.error(`[MCP Tool Loading] Failed to load tools from ${serverId}:`, err);
             lastError = err;
         } finally {
             console.log(`[MCP Tool Loading] Disconnecting client for ${serverId}`);
             await client.disconnect().catch(() => {});
         }
     }
     ```

3. **Log Agent Tool Availability**
   - **File**: `packages/agentc2/src/agents/resolver.ts`
   - **Function**: `hydrate()` (line 458)
   - **After line 604** (where tools are merged), add:
     ```typescript
     // Debug: Log Jira tool availability after merge
     const jiraTools = Object.keys(tools).filter(k => k.startsWith('jira'));
     console.log(`[Agent Hydration] Jira tools available in agent "${record.slug}":`, jiraTools);
     ```

**Expected Outcome**: Logs will reveal whether:
- Tools are loaded successfully but not found at execution time (naming mismatch)
- Tools are loaded but connection is disconnected (connection state issue)
- Tools are never loaded (cache/org resolution issue)

---

### Phase 2: Root Cause Fix (4-6 hours)

**Objective**: Fix the primary issue - disconnected MCP clients

#### Option A: Persistent MCP Client (Recommended)

**Rationale**: Keep MCP clients alive for the duration of agent execution, not just tool loading.

**Files to Modify**:
- `packages/agentc2/src/mcp/client.ts`

**Changes**:

1. **Refactor `getMcpClientForOrganization()` to manage persistent clients**
   - Lines 3876-3910
   - Instead of caching just the client reference, cache **active, connected clients**
   - Add health check before returning cached client:
     ```typescript
     async function getMcpClientForOrganization(options) {
         const organizationId = options?.organizationId;
         if (!organizationId) {
             return mcpClient;
         }
         
         const cacheKey = `${organizationId}:${options?.userId || "org"}`;
         const cached = orgMcpClients.get(cacheKey);
         const now = Date.now();
         
         // Check if cached client is still valid AND connected
         if (cached && now - cached.loadedAt < ORG_MCP_CACHE_TTL) {
             try {
                 // Health check: verify client can still list tools
                 await cached.client.listToolsets();
                 return cached.client;
             } catch (healthCheckErr) {
                 console.warn(`[MCP] Cached client for org ${organizationId} failed health check, recreating...`);
                 await cached.client.disconnect().catch(() => {});
                 orgMcpClients.delete(cacheKey);
             }
         }
         
         // Create new client (existing logic)
         const connections = await getIntegrationConnections({ organizationId, userId: options?.userId });
         const servers = buildServerConfigs({ connections, allowEnvFallback: false });
         const client = new MCPClient({
             id: `mastra-mcp-client-${organizationId}`,
             servers,
             timeout: 60000
         });
         
         orgMcpClients.set(cacheKey, { client, loadedAt: now });
         return client;
     }
     ```

2. **Remove immediate disconnect in `loadToolsFromServer()`**
   - Lines 4019-4020
   - **Current**:
     ```typescript
     } finally {
         await client.disconnect().catch(() => {});
     }
     ```
   - **New**:
     ```typescript
     } finally {
         // DON'T disconnect - tool objects need this client to remain alive
         // Client will be disconnected when org cache expires or app shuts down
     }
     ```
   - **Problem**: This approach will leak connections. Need better solution.

3. **Better approach: Shared Client for Tool Loading and Execution**
   - Refactor `loadToolsPerServer()` to NOT create isolated clients
   - Use the org-scoped client from `getMcpClientForOrganization()` for both loading AND execution
   - **Lines 4032-4073**:
     ```typescript
     async function loadToolsPerServer(
         organizationId: string | null,
         userId?: string | null
     ): Promise<{
         tools: Record<string, any>;
         serverErrors: Record<string, string>;
     }> {
         const client = await getMcpClientForOrganization({ organizationId, userId });
         
         try {
             // Load tools from the SAME client that will be used for execution
             const tools = await client.listTools();
             return { tools: sanitizeMcpTools(tools), serverErrors: {} };
         } catch (error) {
             console.error(`[MCP] Failed to load tools for org ${organizationId}:`, error);
             return { tools: {}, serverErrors: { __global: formatTestError(error) } };
         }
     }
     ```

**Risk**: MEDIUM  
**Complexity**: MEDIUM  
**Testing Required**: 
- Connection test still passes
- Agent runtime tool execution succeeds
- Connections are properly cleaned up (no leaks)
- Multi-tenant isolation preserved (org A can't access org B's connections)

---

#### Option B: Tool Execution Reconnection (Fallback)

**Rationale**: If persistent clients are too risky, make tools reconnect on-demand during execution.

**Files to Modify**:
- `packages/agentc2/src/mcp/client.ts`

**Changes**:

1. **Wrap tool `.execute()` method with reconnection logic**
   - After tools are loaded and sanitized, wrap each tool's execute method:
     ```typescript
     function wrapToolWithReconnection(tool: any, serverId: string, serverDef: MastraMCPServerDefinition, organizationId: string | null) {
         const originalExecute = tool.execute;
         
         tool.execute = async (context: any) => {
             let client: MCPClient | null = null;
             try {
                 // Create fresh connection for this execution
                 client = new MCPClient({
                     id: `mastra-mcp-exec-${serverId}-${Date.now()}`,
                     servers: { [serverId]: serverDef },
                     timeout: 60000
                 });
                 
                 // Get tool from fresh client
                 const freshTools = await client.listToolsets();
                 const freshTool = freshTools[tool.name];
                 
                 if (!freshTool) {
                     throw new Error(`Tool ${tool.name} not found in fresh client`);
                 }
                 
                 // Execute with fresh connection
                 return await (freshTool as any).execute(context);
             } finally {
                 if (client) {
                     await client.disconnect().catch(() => {});
                 }
             }
         };
         
         return tool;
     }
     ```

2. **Apply wrapper in `loadToolsFromServer()`**
   - Lines 4015-4016:
     ```typescript
     const tools = await client.listTools();
     const sanitized = sanitizeMcpTools(tools);
     
     // Wrap each tool with reconnection logic
     const wrapped: Record<string, any> = {};
     for (const [toolName, tool] of Object.entries(sanitized)) {
         wrapped[toolName] = wrapToolWithReconnection(tool, serverId, serverDef, organizationId);
     }
     
     return { serverId, tools: wrapped };
     ```

**Risk**: LOW (more defensive)  
**Complexity**: MEDIUM  
**Performance Impact**: HIGH (creates new connection for every tool call)  
**Testing Required**: Same as Option A

---

### Phase 3: Secondary Fixes (2-3 hours)

**Objective**: Fix tool name resolution and improve error handling

#### Fix 1: Tool Name Resolution

**File**: `packages/agentc2/src/mcp/client.ts`  
**Function**: `executeMcpTool()`, lines 4948-4960

**Current**:
```typescript
const namesToTry = [
    resolvedToolName,
    resolvedToolName.replace("_", "."),
    resolvedToolName.replace(".", "_")
];
```

**Fixed**:
```typescript
const namesToTry = [
    resolvedToolName,
    resolvedToolName.replaceAll("_", "."),  // Replace ALL underscores
    resolvedToolName.replaceAll(".", "_")   // Replace ALL dots
];

// For tools like "jira_jira_get_all_projects", also try "jira.jira_get_all_projects"
const parts = resolvedToolName.split("_");
if (parts.length >= 2) {
    const serverName = parts[0];
    const restOfName = parts.slice(1).join("_");
    namesToTry.push(`${serverName}.${restOfName}`);
    
    // Also try with all underscores in tool name converted to dots
    const restWithDots = parts.slice(1).join(".");
    namesToTry.push(`${serverName}.${restWithDots}`);
}

// Remove duplicates
const uniqueNames = [...new Set(namesToTry)];
```

**Risk**: LOW  
**Complexity**: LOW

---

#### Fix 2: Improved Error Reporting

**File**: `packages/agentc2/src/agents/resolver.ts`  
**Function**: `hydrate()`, around line 860

**Current**: Missing tools get a generic notice in instructions, but agents often don't surface this to users.

**Changes**:

1. **Add structured error to toolHealth snapshot**
   - Lines 821-826:
     ```typescript
     const toolHealth: ToolHealthSnapshot = {
         expectedCount: expectedToolNames.size,
         loadedCount: loadedToolNames.size,
         missingTools,
         filteredTools,
         serverErrors: mcpServerErrors  // NEW: pass server errors from getMcpTools
     };
     ```

2. **Log server errors explicitly**
   - After line 831 (tool health warning):
     ```typescript
     // Log MCP server-specific errors
     if (mcpServerErrors && Object.keys(mcpServerErrors).length > 0) {
         console.error(
             `[AgentResolver] MCP server errors for "${record.slug}":`,
             mcpServerErrors
         );
         
         recordActivity({
             type: "ALERT_RAISED",
             agentId: record.id,
             agentSlug: record.slug,
             summary: `${record.slug}: MCP server failures`,
             detail: Object.entries(mcpServerErrors)
                 .map(([server, error]) => `${server}: ${error}`)
                 .join("; "),
             status: "error",
             source: "mcp-server",
             metadata: { serverErrors: mcpServerErrors }
         });
     }
     ```

**Risk**: LOW  
**Complexity**: LOW

---

#### Fix 3: Cache Health Checks

**File**: `packages/agentc2/src/mcp/client.ts`  
**Function**: `getMcpTools()`, lines 3919-3969

**Changes**:

1. **Verify cached tools are still executable**
   - Lines 3938-3941:
     ```typescript
     const cached = perServerToolsCache.get(cacheKey);
     if (cached && now - cached.loadedAt < ORG_MCP_CACHE_TTL) {
         // Health check: verify at least one tool is still executable
         const sampleToolNames = Object.keys(cached.tools).slice(0, 3);
         let cacheValid = true;
         
         for (const toolName of sampleToolNames) {
             try {
                 // Quick validation: ensure tool object has execute method
                 const tool = cached.tools[toolName];
                 if (!tool || typeof tool.execute !== 'function') {
                     cacheValid = false;
                     break;
                 }
             } catch {
                 cacheValid = false;
                 break;
             }
         }
         
         if (cacheValid) {
             return { tools: cached.tools, serverErrors: cached.serverErrors };
         } else {
             console.warn(`[MCP] Cached tools for ${cacheKey} failed health check, reloading...`);
             perServerToolsCache.delete(cacheKey);
         }
     }
     ```

**Risk**: LOW  
**Complexity**: LOW

---

### Phase 4: Testing & Validation (2-3 hours)

**Objective**: Verify all fixes work end-to-end

#### Test Cases

1. **Connection Test Still Passes**
   - `integration_connection_test(connectionId: 'cmmmqomx501af8e17mm3hnl5b')`
   - **Expected**: 49 tools discovered, all phases green

2. **Agent Invocation with Tool Execution**
   - `agent_invoke_dynamic(agentSlug: 'jira-agent', message: 'List all Jira projects.')`
   - **Expected**: Agent calls `jira_jira_get_all_projects` tool, returns project list

3. **Tool Name Resolution**
   - Test with various name formats: `jira.tool`, `jira_tool`, `jira_jira_tool`
   - **Expected**: All formats resolve correctly

4. **Cache Invalidation**
   - Invoke agent → wait 61 seconds → invoke again
   - **Expected**: Tools reload, execution still works

5. **Multi-Tenant Isolation**
   - Create two orgs with different Jira connections
   - Invoke agents from both orgs simultaneously
   - **Expected**: Each agent uses correct org-scoped connection

6. **Connection Pool Cleanup**
   - Run 100 sequential agent invocations
   - Check system resources (open connections, memory)
   - **Expected**: No connection leaks, stable resource usage

7. **Error Scenarios**
   - Invalid Jira credentials
   - Jira server timeout
   - Tool parameter validation failure
   - **Expected**: Clear error messages, no silent failures

#### Test Script

```typescript
// File: tests/integration/jira-agent-runtime.test.ts

import { agentResolver } from "@repo/agentc2";
import { testMcpServer } from "@repo/agentc2/mcp";

describe("Jira Agent Runtime", () => {
    const connectionId = "cmmmqomx501af8e17mm3hnl5b";
    const organizationId = "test-org-id";
    
    test("Connection test passes", async () => {
        const result = await testMcpServer({
            serverId: "jira",
            organizationId,
            timeoutMs: 15000
        });
        
        expect(result.success).toBe(true);
        expect(result.toolCount).toBeGreaterThan(0);
    });
    
    test("Agent can execute Jira tools at runtime", async () => {
        const { agent, record } = await agentResolver.resolve({
            slug: "jira-agent",
            requestContext: { organizationId }
        });
        
        const response = await agent.generate("List all Jira projects.", {
            maxSteps: 5
        });
        
        // Verify tool was actually called
        const toolCalls = response.steps.filter(s => s.type === "tool");
        expect(toolCalls.length).toBeGreaterThan(0);
        
        const jiraToolCalled = toolCalls.some(tc =>
            tc.toolKey?.startsWith("jira")
        );
        expect(jiraToolCalled).toBe(true);
    });
    
    test("Tool name resolution handles multiple formats", async () => {
        const { executeMcpTool } = await import("@repo/agentc2/mcp");
        
        const formats = [
            "jira_jira_get_user_profile",
            "jira.jira_get_user_profile",
            "jira.jira.get.user.profile"
        ];
        
        for (const toolName of formats) {
            const result = await executeMcpTool(toolName, {}, {
                organizationId,
                timeoutMs: 10000
            });
            
            // Should either succeed or fail with clear error, not "tool not found"
            if (!result.success) {
                expect(result.error).not.toContain("Tool not found");
            }
        }
    });
});
```

**Run**: `bun test tests/integration/jira-agent-runtime.test.ts`

---

### Phase 5: Documentation & Prevention (1-2 hours)

**Objective**: Document the issue and prevent similar bugs

#### Documentation Updates

1. **Add MCP Architecture Doc**
   - **File**: `docs/MCP_ARCHITECTURE.md` (new)
   - **Content**:
     - How MCP clients are created, cached, and pooled
     - Connection lifecycle management
     - Tool loading vs. tool execution
     - Best practices for adding new MCP servers
     - Debugging guide for runtime failures

2. **Update CLAUDE.md**
   - **File**: `/workspace/CLAUDE.md`
   - **Section**: "MCP Server Integration Details"
   - **Add**:
     ```markdown
     ### Critical: MCP Client Lifecycle
     
     MCP clients must remain connected for the duration of tool execution, not just tool loading.
     When adding new MCP servers or modifying MCP client code, ensure:
     
     1. Clients are not disconnected immediately after listTools()
     2. Cached clients include health checks before reuse
     3. Tool execution uses the same client that loaded the tools
     4. Connection pooling respects org/user boundaries
     5. Connection test validates BOTH discovery AND execution
     ```

3. **Add Troubleshooting Guide**
   - **File**: `docs/TROUBLESHOOTING_MCP.md` (new)
   - **Sections**:
     - "Connection test passes but runtime fails"
     - "Tool not found errors"
     - "Silent tool execution failures"
     - "Cache invalidation"
     - "Multi-tenant connection issues"

#### Prevention Measures

1. **Add Integration Test for All MCP Servers**
   - **File**: `tests/integration/mcp-runtime-validation.test.ts` (new)
   - **Test**: For each MCP server, verify connection test AND runtime execution both work

2. **Add Monitoring**
   - **Metric**: `mcp_tool_execution_failures` (counter by server, tool, org)
   - **Alert**: If failures > 5% of attempts over 5 minutes
   - **Dashboard**: MCP tool execution success rate per server

3. **Add Pre-Push Hook**
   - **File**: `.husky/pre-push`
   - **Command**: `bun run test:integration:mcp`
   - **Ensures**: MCP runtime tests pass before pushing

---

## Risk Assessment

### Fix Complexity: MEDIUM-HIGH
- **Lines of code affected**: ~200-300
- **Files modified**: 3-5
- **Architectural changes**: Moderate (client lifecycle management)

### Regression Risk: MEDIUM
- **Potential side effects**: Connection leaks, cache invalidation bugs, multi-tenant isolation issues
- **Mitigation**: Comprehensive test suite, staged rollout

### Testing Effort: MEDIUM
- **Unit tests**: 5-10 new tests
- **Integration tests**: 8-12 new tests  
- **Manual testing**: 2-3 hours (all MCP servers)

---

## Recommended Approach

### Priority: P0 (Critical Bug - Blocking SDLC Pipeline)

### Implementation Order:

1. ✅ **Phase 1: Diagnosis** (1-2 hours)
   - Add logging, reproduce with detailed traces
   - Confirm primary hypothesis

2. ✅ **Phase 2: Primary Fix** (4-6 hours)
   - Implement Option A (Persistent Clients) first
   - If too risky, fall back to Option B (Reconnection)

3. ✅ **Phase 3: Secondary Fixes** (2-3 hours)
   - Tool name resolution improvements
   - Error reporting enhancements
   - Cache health checks

4. ✅ **Phase 4: Testing** (2-3 hours)
   - Run full test suite
   - Manual validation with real Jira instance

5. ✅ **Phase 5: Documentation** (1-2 hours)
   - Update architecture docs
   - Add troubleshooting guide
   - Implement monitoring

**Total Estimated Time**: 10-16 hours (1.5-2 days)

---

## Related Issues

### Likely Affected Integrations

Based on the same architecture, these MCP servers may have similar issues:

1. **HubSpot** (`@hubspot/mcp-server`) - Uses `npx`, stdio transport
2. **Slack** (`@modelcontextprotocol/server-slack`) - Uses `npx`, stdio transport
3. **GitHub** (`@modelcontextprotocol/server-github`) - Uses `npx`, stdio transport
4. **Fathom** (custom Node.js server) - Uses `node`, stdio transport
5. **Playwright** (`@playwright/mcp`) - Uses `npx`, stdio transport

**Action**: After fixing Jira, run validation tests on all MCP servers to confirm they work at runtime.

---

## Open Questions

1. **How does Mastra's Tool.execute() work internally?**
   - Does it hold a reference to the MCPClient?
   - Can we inject a custom execute function that handles reconnection?

2. **Why don't we see explicit error logs?**
   - Are tool execution errors being swallowed by the agent?
   - Does Mastra's Agent.generate() suppress tool errors?

3. **How does the connection test differ from runtime in terms of process spawn?**
   - Do they use different Node.js child process flags?
   - Could process lifecycle differences cause the disconnect?

4. **What happens to MCP client connections on org cache expiration?**
   - Are they properly disconnected?
   - Could this cause zombie processes?

---

## Conclusion

The Jira agent runtime failure is a **critical architectural bug** caused by a disconnect between how MCP tools are loaded (with short-lived, isolated clients that are immediately disconnected) versus how they are executed (expecting a live connection). The connection test passes because it validates credentials and server availability, but does NOT validate that tools remain executable after the client is disconnected.

**The fix requires ensuring MCP clients remain connected for the lifetime of tool execution, either through persistent clients or on-demand reconnection.** Secondary fixes improve tool name resolution, error reporting, and cache health.

This bug affects **all agents using Jira tools** and potentially other MCP integrations, making the SDLC signal pipeline completely non-functional. The fix is **medium complexity** but essential for restoring Jira integration functionality.

---

**Prepared by**: AI Assistant (Claude Sonnet 4.5)  
**Date**: 2026-03-13  
**Status**: Analysis Complete - Ready for Implementation  
**Next Step**: Phase 1 Diagnosis - Add logging and confirm hypothesis

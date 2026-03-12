# Fix Reference Card: Issue #166

**File**: `apps/agent/src/lib/inngest-functions.ts`  
**Function**: `integrationHealthCheckFunction` (lines 8264-8362)  
**Changes**: 3 additions, 1 modification

---

## Change 1: Clear Errors Before Testing

**Location**: After line 8293  
**Context**: Inside the per-org step.run, before listMcpToolDefinitions is called

### BEFORE (lines 8293-8299)
```typescript
for (const [orgId, orgConnections] of byOrg) {
    await step.run(`health-check-org-${orgId.slice(0, 8)}`, async () => {
        // Import dynamically to avoid circular deps
        const { listMcpToolDefinitions } = await import("@repo/agentc2");

        try {
            const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
```

### AFTER (lines 8293-8307)
```typescript
for (const [orgId, orgConnections] of byOrg) {
    await step.run(`health-check-org-${orgId.slice(0, 8)}`, async () => {
        // Clear errorMessage on all connections before health check to break circular dependency.
        // This matches the pattern from the manual test route which clears errors before testing
        // (apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts:64-71)
        const connectionsToCheck = orgConnections.filter(c => c.errorMessage !== null);
        if (connectionsToCheck.length > 0) {
            await prisma.integrationConnection.updateMany({
                where: {
                    id: { in: connectionsToCheck.map(c => c.id) }
                },
                data: { errorMessage: null }
            });
            console.log(
                `[Inngest] Cleared errorMessage on ${connectionsToCheck.length} connection(s) ` +
                `before health check for org ${orgId.slice(0, 8)}`
            );
        }

        // Import dynamically to avoid circular deps
        const { listMcpToolDefinitions } = await import("@repo/agentc2");

        try {
            const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
```

**Why**: Ensures connections are visible to `getIntegrationConnections()` during the health check, breaking the circular dependency.

---

## Change 2: Fix Error Preservation Logic

**Location**: Line 8325  
**Context**: Inside the `else` block for connections without server errors

### BEFORE (line 8325)
```typescript
await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: {
        errorMessage: hasTools ? null : conn.errorMessage,  // ⚠️ Preserves stale error
        metadata: {
            ...((conn.metadata as Record<string, unknown>) || {}),
            lastHealthCheck: new Date().toISOString(),
            healthStatus: hasTools ? "healthy" : "no-tools"
        }
    }
});
```

### AFTER (line 8325 → line 8340 after Change 1 inserted)
```typescript
await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: {
        errorMessage: null,  // ✅ Always clear when no server error
        metadata: {
            ...((conn.metadata as Record<string, unknown>) || {}),
            lastHealthCheck: new Date().toISOString(),
            healthStatus: hasTools ? "healthy" : "no-tools"
        }
    }
});
```

**Why**: We already cleared errors at the start. If `hasTools` is false, it's a "no-tools" state (not an error). Don't preserve stale error messages.

---

## Change 3: Invalidate Cache

**Location**: After line 8336 (connection update loop), before line 8337 (`} catch (error) {`)  
**Context**: After all connection updates are complete for this org

### BEFORE (lines 8336-8337)
```typescript
                }
            } catch (error) {
```

### AFTER (lines 8336-8343 after previous changes)
```typescript
                }
                
                // Invalidate MCP cache after clearing errors so next agent run picks up recovered connections
                const { invalidateMcpCacheForOrg } = await import("@repo/agentc2/mcp");
                invalidateMcpCacheForOrg(orgId);
            } catch (error) {
```

**Why**: MCP tools are cached for 60 seconds. Invalidating immediately ensures agents can use recovered connections without delay.

---

## Exact Line Numbers (Reference)

**Before applying changes, verify your file matches these line numbers:**

```typescript
8293: for (const [orgId, orgConnections] of byOrg) {
8294:     await step.run(`health-check-org-${orgId.slice(0, 8)}`, async () => {
8295:         // Import dynamically to avoid circular deps
8296:         const { listMcpToolDefinitions } = await import("@repo/agentc2");
8297: 
8298:         try {
8299:             const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
...
8325:                 errorMessage: hasTools ? null : conn.errorMessage,
...
8336:             }
8337:         } catch (error) {
```

**If line numbers don't match**: The file may have been modified. Re-read lines 8260-8370 to locate the health check function.

---

## Diff Preview

```diff
for (const [orgId, orgConnections] of byOrg) {
    await step.run(`health-check-org-${orgId.slice(0, 8)}`, async () => {
+       // Clear errorMessage on all connections before health check to break circular dependency.
+       const connectionsToCheck = orgConnections.filter(c => c.errorMessage !== null);
+       if (connectionsToCheck.length > 0) {
+           await prisma.integrationConnection.updateMany({
+               where: { id: { in: connectionsToCheck.map(c => c.id) } },
+               data: { errorMessage: null }
+           });
+           console.log(
+               `[Inngest] Cleared errorMessage on ${connectionsToCheck.length} connection(s) ` +
+               `before health check for org ${orgId.slice(0, 8)}`
+           );
+       }
+
        // Import dynamically to avoid circular deps
        const { listMcpToolDefinitions } = await import("@repo/agentc2");

        try {
            const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
            
            // ... server error handling ...
            
            } else {
                const prefix = `${key}_`;
                const hasTools = definitions.some((t) => t.name.startsWith(prefix));

                await prisma.integrationConnection.update({
                    where: { id: conn.id },
                    data: {
-                       errorMessage: hasTools ? null : conn.errorMessage,
+                       errorMessage: null,
                        metadata: {
                            ...((conn.metadata as Record<string, unknown>) || {}),
                            lastHealthCheck: new Date().toISOString(),
                            healthStatus: hasTools ? "healthy" : "no-tools"
                        }
                    }
                });
                if (hasTools) healthy++;
                else unhealthy++;
            }
        }
+       
+       // Invalidate MCP cache after clearing errors
+       const { invalidateMcpCacheForOrg } = await import("@repo/agentc2/mcp");
+       invalidateMcpCacheForOrg(orgId);
    } catch (error) {
```

---

## Verification Commands

### Before applying fix
```bash
# Should show connections with errorMessage
psql $DATABASE_URL -c "
SELECT id, name, \"errorMessage\" 
FROM \"IntegrationConnection\" 
WHERE \"isActive\" = true AND \"errorMessage\" IS NOT NULL;
"
```

### After applying fix + one health check cycle
```bash
# Should show 0 rows (or only fresh errors from currently failing servers)
psql $DATABASE_URL -c "
SELECT id, name, \"errorMessage\", \"updatedAt\"
FROM \"IntegrationConnection\" 
WHERE \"isActive\" = true 
AND \"errorMessage\" IS NOT NULL
AND \"updatedAt\" < NOW() - INTERVAL '7 hours';
"
```

---

## Console Log Output (Expected)

### Successful Recovery
```
[Inngest] Cleared errorMessage on 3 connection(s) before health check for org a1b2c3d4
[MCP] Loaded 45 tools from 3 server(s) (hubspot: 15, jira: 12, slack: 18)
[Inngest] Integration health check: 3 checked, 3 healthy, 0 unhealthy
```

### Persistent Failure
```
[Inngest] Cleared errorMessage on 1 connection(s) before health check for org a1b2c3d4
[MCP] Server "hubspot" failed to load tools after retry: Invalid credentials
[Inngest] Integration health check: 1 checked, 0 healthy, 1 unhealthy
```

### No Errors to Clear
```
[Inngest] Integration health check: 5 checked, 5 healthy, 0 unhealthy
```

---

## Implementation Time Estimate

- ⏱️ **Reading/Understanding**: 15 minutes (RCA + Plan)
- ⏱️ **Code Changes**: 10 minutes (3 blocks to add/modify)
- ⏱️ **Local Testing**: 20 minutes (lint, type-check, build, test)
- ⏱️ **Manual Verification Setup**: 15 minutes (SQL setup, agent testing)
- ⏱️ **Deployment**: 10 minutes (push, restart)
- ⏱️ **Verification**: 5 minutes (logs, queries)
- ⏱️ **Wait for Health Check**: 6 hours (passive)

**Total Active Time**: ~1.5 hours  
**Total Elapsed Time**: ~7.5 hours (including one health check cycle)

---

**Reference Card Created**: 2026-03-12  
**Status**: Ready for copy-paste implementation

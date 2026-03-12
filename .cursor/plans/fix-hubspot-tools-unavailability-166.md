# Fix Plan: HubSpot MCP Tools Unavailability (Issue #166)

**Issue**: [#166](https://github.com/Appello-Prototypes/agentc2/issues/166)  
**RCA Document**: `/workspace/RCA-hubspot-tools-unavailability.md`  
**Branch**: `cursor/hubspot-tools-unavailability-43bf`  
**Priority**: High  
**Complexity**: Low  
**Estimated Effort**: 3 hours (implementation + testing + verification)

---

## Overview

This fix resolves a circular dependency bug where IntegrationConnections with `errorMessage` set are permanently excluded from MCP tool loading, preventing agents from using their configured tools. The fix clears error state before health checks, matching the pattern already used in the manual connection test route.

---

## Implementation Steps

### Step 1: Fix Health Check Function

**File**: `apps/agent/src/lib/inngest-functions.ts`  
**Function**: `integrationHealthCheckFunction`  
**Lines to Modify**: 8293-8354

#### Change 1.1: Clear errors before testing

**Location**: After line 8293 (inside `step.run` for org health check)

**Add this code block**:
```typescript
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
```

**Why**: Ensures connections are visible to `getIntegrationConnections()` during the health check.

#### Change 1.2: Simplify error preservation logic

**Location**: Line 8325

**Change from**:
```typescript
errorMessage: hasTools ? null : conn.errorMessage,
```

**To**:
```typescript
errorMessage: null,
```

**Why**: We already cleared errors at the start of the check. If `hasTools` is false, it should be treated as "no-tools" (not an error), not preserve a stale error message.

#### Change 1.3: Add cache invalidation

**Location**: After line 8336 (after the connection update loop)

**Add**:
```typescript
// Invalidate MCP cache after clearing errors so next agent run picks up recovered connections
const { invalidateMcpCacheForOrg } = await import("@repo/agentc2/mcp");
invalidateMcpCacheForOrg(orgId);
```

**Why**: MCP tools are cached for 60 seconds. Invalidating immediately after error clearing ensures agents can use recovered connections without delay.

---

### Step 2: Add Integration Test

**File**: `tests/integration/inngest/health-check.test.ts` (NEW)

**Purpose**: Verify health check clears errors and recovers connections.

**Test Cases**:
1. Connection with `errorMessage` gets cleared before test
2. Connection with cleared error and working server gets `errorMessage: null`
3. Connection with cleared error and failing server gets new error message
4. MCP cache is invalidated after error clearing

**Example Structure**:
```typescript
import { describe, it, expect, beforeEach, vi } from "bun:test";
import { prismaMock } from "../setup";

describe("Integration Health Check", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("clears errorMessage before testing connections", async () => {
        const mockConnection = {
            id: "conn-1",
            organizationId: "org-1",
            errorMessage: "Health check failed: timeout",
            provider: { key: "hubspot" }
        };

        prismaMock.integrationConnection.findMany.mockResolvedValue([mockConnection]);
        prismaMock.integrationConnection.updateMany.mockResolvedValue({ count: 1 });

        // Import and run health check function
        const { integrationHealthCheckFunction } = await import(
            "../../apps/agent/src/lib/inngest-functions"
        );

        // Trigger the function
        await integrationHealthCheckFunction.trigger({});

        // Verify errorMessage was cleared
        expect(prismaMock.integrationConnection.updateMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["conn-1"] }
            },
            data: { errorMessage: null }
        });
    });

    it("sets new errorMessage only when server fails", async () => {
        // ... test that working servers clear errors, failing servers set new errors
    });

    it("invalidates MCP cache after clearing errors", async () => {
        // ... verify cache invalidation is called
    });
});
```

---

### Step 3: Add Unit Test for Connection Filtering

**File**: `tests/unit/mcp-connection-filtering.test.ts` (NEW)

**Purpose**: Document the filtering behavior and ensure it works correctly after error clearing.

**Test Cases**:
1. `getIntegrationConnections` filters connections with `errorMessage`
2. After clearing `errorMessage`, connection appears in results
3. Manual test route pattern (clear → test → set result)

---

### Step 4: Update Documentation

**File**: `CLAUDE.md`  
**Section**: "MCP Server Integration Details" or "Troubleshooting"

**Add**:
```markdown
### MCP Connection Health & Recovery

IntegrationConnections are monitored by an automated health check that runs every 6 hours. If an MCP server fails to respond, the connection's `errorMessage` field is set with diagnostic information. 

**Important**: The health check automatically clears `errorMessage` before testing, allowing connections to recover from transient failures (network timeouts, NPM download delays, temporary API issues).

**Manual Recovery**: Users can also test connections via Settings > Integrations > [Provider] > Test Connection button, which clears error state and re-validates credentials.

**Troubleshooting "Tools Unavailable" Errors**:
1. Check IntegrationConnection.errorMessage in database (should be null for working connections)
2. Verify credentials are present and not expired
3. Test connection manually via UI
4. Check Activity Log for "Integration unhealthy" alerts
5. Wait for next health check cycle (up to 6 hours) for automatic recovery
```

---

## Testing Plan

### Pre-Deployment Testing

1. **Lint & Type Check**:
   ```bash
   bun run lint
   bun run type-check
   ```

2. **Run Existing Tests**:
   ```bash
   bun run test
   ```

3. **Build Verification**:
   ```bash
   bun run build
   ```

### Post-Deployment Testing

#### Test Case 1: Reproduce and Verify Fix

**Setup**:
1. Identify a HubSpot connection in production (or use test environment)
2. Manually set `errorMessage`:
   ```sql
   UPDATE "IntegrationConnection" 
   SET "errorMessage" = 'Test error - manual RCA verification' 
   WHERE "providerId" = (
       SELECT id FROM "IntegrationProvider" WHERE key = 'hubspot' LIMIT 1
   );
   ```

**Expected Behavior (Before Fix)**:
- Agent with HubSpot tools shows "tools unavailable" notice
- Health check preserves error message
- Connection stuck in error state

**Expected Behavior (After Fix)**:
- Next health check clears `errorMessage`
- Agent with HubSpot tools loads successfully
- Tools are available for use

**Verification**:
```sql
-- Check error was cleared
SELECT "errorMessage", metadata->>'healthStatus', metadata->>'lastHealthCheck'
FROM "IntegrationConnection"
WHERE id = 'connection-id-here';

-- Should show:
-- errorMessage: NULL
-- healthStatus: "healthy"
-- lastHealthCheck: <recent timestamp>
```

#### Test Case 2: Persistent Failure Handling

**Setup**:
1. Create a connection with invalid credentials
2. Wait for health check

**Expected Behavior**:
- Health check clears old `errorMessage`
- Tests the connection
- Sets new `errorMessage` with current failure reason
- Connection marked as unhealthy

**Verification**:
- `errorMessage` should contain current error, not stale error
- `metadata.healthStatus` should be "unhealthy"
- Agent should see updated error message

#### Test Case 3: Transient Failure Recovery

**Setup**:
1. Use a connection that works (valid credentials)
2. Temporarily break it (simulate network timeout)
3. Health check sets error
4. Fix the connection (restore network)
5. Wait for next health check

**Expected Behavior**:
- First health check sets `errorMessage`
- Second health check clears error, tests successfully, leaves `errorMessage: null`
- Agent can use tools again

**Verification**:
- Query shows `errorMessage: NULL` after second check
- Agent resolution succeeds
- Activity Log shows connection recovered

---

## Rollback Plan

### If Issues Arise

**Symptoms of Regression**:
- Health checks fail to complete
- Database update errors in Inngest logs
- Connections get stuck in clearing loop

**Rollback Procedure**:
```bash
# 1. Revert the commit
git revert HEAD

# 2. Push to production
git push origin cursor/hubspot-tools-unavailability-43bf

# 3. Restart services
pm2 restart ecosystem.config.js

# 4. Manually clear errors on affected connections
```

**SQL to Clear Errors Manually**:
```sql
UPDATE "IntegrationConnection"
SET "errorMessage" = NULL
WHERE "isActive" = true 
  AND "errorMessage" IS NOT NULL
  AND "providerId" IN (
      SELECT id FROM "IntegrationProvider" WHERE "providerType" = 'mcp'
  );
```

**Re-test Approach**: If rollback is needed, implement alternative fix (Phase 3 options from RCA).

---

## Code Review Checklist

- [ ] Health check clears `errorMessage` before calling `listMcpToolDefinitions`
- [ ] Update logic no longer preserves stale `errorMessage` when `hasTools` is false
- [ ] MCP cache invalidation called after error clearing
- [ ] Console logs added for observability
- [ ] Pattern matches manual test route implementation
- [ ] No breaking changes to API contracts
- [ ] No new database migrations required
- [ ] Existing tests pass
- [ ] New integration test added
- [ ] Documentation updated

---

## Success Criteria

### Functional Requirements

- ✅ Connections with `errorMessage` are included in health checks
- ✅ Health check clears `errorMessage` before testing
- ✅ Working connections recover automatically within 6 hours
- ✅ Failing connections get fresh error messages (not stale)
- ✅ Agents can load MCP tools from recovered connections
- ✅ Skills can load MCP tools from recovered connections
- ✅ Tool provisioning works for recovered connections
- ✅ Tool rediscovery works for recovered connections

### Non-Functional Requirements

- ✅ No performance degradation (health checks already call `listMcpToolDefinitions`)
- ✅ No breaking changes to existing APIs
- ✅ Cache invalidation ensures < 60s recovery latency
- ✅ Backwards compatible with existing connection records
- ✅ Logging provides visibility into recovery events

### Metrics to Monitor

**Pre-deployment baseline**:
```sql
-- Count connections in error state
SELECT COUNT(*) as error_count
FROM "IntegrationConnection"
WHERE "isActive" = true AND "errorMessage" IS NOT NULL;
```

**Post-deployment target**: Zero connections with `errorMessage` older than 6 hours

**Query for monitoring**:
```sql
-- Should approach zero over time after fix is deployed
SELECT 
    ip.key as provider,
    COUNT(*) as error_count,
    MAX(ic."updatedAt") as most_recent_error
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true 
  AND ic."errorMessage" IS NOT NULL
GROUP BY ip.key
ORDER BY error_count DESC;
```

---

## Implementation Notes

### Code Style

- Follow existing patterns in `inngest-functions.ts`
- Use 4-space indentation
- No semicolons
- Console logs for observability

### Error Messages

When setting new `errorMessage` values, use consistent format:
- ✅ `"Health check failed: Connection timeout after 60000ms"`
- ✅ `"Health check failed: Invalid credentials"`
- ❌ `"timeout"` (too terse)
- ❌ `"The HubSpot MCP server could not be reached..."` (too verbose)

### Logging

Add structured logging for recovery events:
```typescript
console.log(
    `[Inngest] Health check for org ${orgId.slice(0, 8)}: ` +
    `cleared ${connectionsToCheck.length} error(s), ` +
    `${healthy} healthy, ${unhealthy} unhealthy`
);
```

---

## Related Work

### Must Review Before Implementation

1. **Manual test route**: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts`
   - Lines 64-71 show the correct pattern
   - Ensure health check matches this implementation

2. **Connection filtering logic**: `packages/agentc2/src/mcp/client.ts`
   - Lines 2818-2827 contain the filter that is circumvented by this fix
   - No changes needed to this file (fix is in health check)

3. **RCA document**: `/workspace/RCA-hubspot-tools-unavailability.md`
   - Full technical analysis
   - Understand the circular dependency before implementing

### Optional Future Enhancements

- Add `errorCount` and `errorFirstOccurred` fields to track error patterns
- Implement exponential backoff for persistently failing connections
- Add "Clear Error & Retry" button in UI
- Create dedicated recovery endpoint at `/api/integrations/connections/[id]/recover`

These are NOT required for the immediate fix but may improve resilience.

---

## Timeline

1. **Implementation**: 30 minutes
   - Modify health check function
   - Add console logging
   - Add cache invalidation

2. **Testing**: 2 hours
   - Write integration test
   - Run existing test suite
   - Manual reproduction verification

3. **Deployment**: 15 minutes
   - Push to branch
   - Deploy to production
   - Monitor logs

4. **Verification**: 6-12 hours
   - Wait for health check cycle
   - Verify error clearing works
   - Check agent tool resolution succeeds

**Total**: 3 hours active work + 6-12 hours passive monitoring

---

## Sign-off

**Implementer**: [To be assigned]  
**Reviewer**: [To be assigned]  
**QA**: [To be assigned]  
**Deployment Window**: Next available (fix is low-risk)

---

**Plan Created**: 2026-03-12  
**Author**: Claude (AgentC2 Cloud Agent)  
**Status**: Ready for implementation

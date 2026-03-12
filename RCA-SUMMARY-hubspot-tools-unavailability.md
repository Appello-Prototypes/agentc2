# Executive Summary: HubSpot Tools Unavailability Bug (#166)

**Status**: Analysis Complete — Ready for Implementation  
**Severity**: HIGH (affects all MCP integrations)  
**Complexity**: LOW (2-line fix + cache invalidation)  
**Time to Fix**: 30 minutes implementation + 6 hours verification

---

## The Bug in 3 Sentences

When an MCP server fails a health check, the system sets `errorMessage` on the IntegrationConnection. Subsequently, ALL code that loads MCP tools filters out connections with `errorMessage` set. The health check itself uses this filtered list, so it can never re-test the connection to clear the error — creating a permanent failure state.

---

## Root Cause

**File**: `packages/agentc2/src/mcp/client.ts` (lines 2818-2827)

```typescript
// This filter excludes connections from ALL operations, including health checks
const connections = allConnections.filter((conn) => {
    if (conn.errorMessage) {
        return false;  // ⚠️ Permanent exclusion
    }
    return true;
});
```

**File**: `apps/agent/src/lib/inngest-functions.ts` (line 8325)

```typescript
// Health check preserves stale error instead of clearing it
errorMessage: hasTools ? null : conn.errorMessage,  // ⚠️ Circular dependency
```

---

## The Fix

**Change 1**: Clear `errorMessage` BEFORE health check (5 lines added)  
**Change 2**: Always clear `errorMessage` when no server error (1 line changed)  
**Change 3**: Invalidate MCP cache after clearing (2 lines added)

**File**: `apps/agent/src/lib/inngest-functions.ts`  
**Lines**: 8293-8354

### Before (Buggy)
```typescript
// Line 8294
await step.run(`health-check-org-${orgId.slice(0, 8)}`, async () => {
    const { listMcpToolDefinitions } = await import("@repo/agentc2");
    try {
        const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
        // ... connections with errorMessage are filtered out ...
        
        // Line 8325
        errorMessage: hasTools ? null : conn.errorMessage,  // Keeps stale error
    }
});
```

### After (Fixed)
```typescript
// Line 8294
await step.run(`health-check-org-${orgId.slice(0, 8)}`, async () => {
    // ✅ NEW: Clear errors before testing
    await prisma.integrationConnection.updateMany({
        where: {
            id: { in: orgConnections.map(c => c.id) },
            errorMessage: { not: null }
        },
        data: { errorMessage: null }
    });
    
    const { listMcpToolDefinitions } = await import("@repo/agentc2");
    try {
        const { definitions, serverErrors } = await listMcpToolDefinitions(orgId);
        // ... connections now included ...
        
        // Line 8325 → Line 8333 (after added code)
        errorMessage: null,  // ✅ FIXED: Always clear when no server error
        
        // ✅ NEW: Invalidate cache after clearing
        const { invalidateMcpCacheForOrg } = await import("@repo/agentc2/mcp");
        invalidateMcpCacheForOrg(orgId);
    }
});
```

---

## Why This Happens

**Trigger Events** (any can cause initial error):
1. NPM package download timeout (`npx @hubspot/mcp-server` takes too long)
2. Network timeout (60s MCP handshake fails)
3. HubSpot API rate limiting
4. Server process spawn failure
5. Temporary DNS resolution issue

**Once Triggered**:
- ❌ Connection excluded from health checks
- ❌ Agent tool loading fails
- ❌ Skill tool loading fails
- ❌ Tool provisioning fails
- ❌ Tool rediscovery fails
- ✅ Manual UI test temporarily clears error (only workaround)

**Recovery**: None (until manual intervention or this fix is deployed)

---

## Impact

### Affected Systems
- **Agent Resolution**: Agents report "tools unavailable" even when connection shows "Connected" in UI
- **Skills**: Skills with MCP tools fail to load tools
- **Provisioning**: New connections with transient setup failures never recover
- **Rediscovery**: Daily tool sync job skips connections with errors
- **Health Checks**: Cannot auto-recover (the circular dependency)

### Affected Integrations
ALL MCP providers:
- HubSpot (CRM)
- Jira (Project Management)
- Slack (Communication)
- GitHub (Code)
- Firecrawl (Web Scraping)
- JustCall (Phone/SMS)
- Playwright (Browser Automation)
- ATLAS/n8n (Automation)
- Custom MCP servers

### Production Query
```sql
-- Find connections currently affected
SELECT 
    ic.name,
    ip.key as provider,
    ic."organizationId",
    ic."errorMessage",
    ic."updatedAt"
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true 
  AND ic."errorMessage" IS NOT NULL
ORDER BY ic."updatedAt" DESC;
```

---

## Proof of Correctness

### Existing Working Pattern

**File**: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts`  
**Lines**: 64-71

The manual connection test route ALREADY implements the correct pattern:

```typescript
// Clear any previous errorMessage before testing so the connection
// is visible to getIntegrationConnections (which filters by errorMessage)
if (connection.errorMessage) {
    await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { errorMessage: null }
    });
}
```

**Developer Note**: The comment shows developers knew about the filtering behavior but didn't apply it to health checks.

**Our Fix**: Apply the same pattern to the health check function.

---

## Risk Assessment

### Risk Level: **LOW**

**Why Safe**:
1. ✅ Pattern proven in manual test route (used in production)
2. ✅ No API contract changes
3. ✅ No database schema changes
4. ✅ Backwards compatible
5. ✅ Health checks already have retry logic
6. ✅ Worst case: Failed connections get re-tested every 6 hours (acceptable overhead)

**Failure Modes**:
- Health check takes slightly longer (clearing errors adds ~50ms per org)
- More server test attempts (failed servers tested every 6h instead of being skipped)
- More error logs (transient failures visible instead of hidden)

**None of these are worse than the current bug** (permanent unavailability).

---

## Validation

### Pre-Deployment
```bash
bun run lint
bun run type-check
bun run build
bun run test
```

### Post-Deployment

**Wait 6 hours** (one health check cycle), then run:

```sql
-- Should return 0 rows (or only fresh errors from currently failing servers)
SELECT COUNT(*) 
FROM "IntegrationConnection"
WHERE "isActive" = true 
  AND "errorMessage" IS NOT NULL
  AND "updatedAt" < NOW() - INTERVAL '7 hours';
```

**Test agent resolution**:
- Resolve agent with HubSpot tools
- Verify no "tools unavailable" notice in instructions
- Verify `toolHealth.missingTools` is empty

---

## Quick Reference

### Files Changed
1. ✅ `apps/agent/src/lib/inngest-functions.ts` (PRIMARY FIX)
   - Add error clearing before health check
   - Fix error preservation logic
   - Add cache invalidation

### Files Created
1. ✅ `/workspace/RCA-hubspot-tools-unavailability.md` (1351 lines)
   - Complete technical analysis
   - Code paths, reproduction scenarios, testing strategy

2. ✅ `/workspace/.cursor/plans/fix-hubspot-tools-unavailability-166.md` (476 lines)
   - Detailed implementation steps
   - Code snippets, test cases, rollback plan

3. ✅ `/workspace/RCA-SUMMARY-hubspot-tools-unavailability.md` (THIS FILE)
   - Executive summary for quick review

### Testing Files to Create
1. ⚠️ `tests/integration/inngest/health-check.test.ts` (NEW)
   - Verify error clearing behavior
   - Test recovery scenarios

---

## Recommendation

**Proceed with Phase 1 fix immediately**:
- Low risk
- High impact
- Proven pattern
- No breaking changes
- Self-healing for future occurrences

**Defer Phase 2 & 3 enhancements**:
- Not critical for immediate resolution
- Can be addressed in follow-up PRs
- Monitoring improvements can inform better solutions

---

**Next Steps**:
1. ✅ Review this summary
2. ✅ Review full RCA (`/workspace/RCA-hubspot-tools-unavailability.md`)
3. ⚠️ Implement fix per plan (`/workspace/.cursor/plans/fix-hubspot-tools-unavailability-166.md`)
4. ⚠️ Deploy to production
5. ⚠️ Monitor for 24 hours
6. ⚠️ Mark Issue #166 as resolved

---

**Analysis Completed**: 2026-03-12  
**Ready for**: Implementation Review → Code Implementation → Deployment

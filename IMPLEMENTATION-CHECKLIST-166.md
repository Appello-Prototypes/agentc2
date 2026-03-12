# Implementation Checklist: Issue #166 - HubSpot Tools Unavailability

**Quick Reference**: 2-line fix + cache invalidation  
**Time**: 30 minutes code + 2 hours testing  
**Risk**: LOW (proven pattern from manual test route)

---

## Pre-Implementation

- [ ] Read `/workspace/RCA-hubspot-tools-unavailability.md` (full technical analysis)
- [ ] Read `/workspace/.cursor/plans/fix-hubspot-tools-unavailability-166.md` (detailed plan)
- [ ] Read this checklist
- [ ] Review manual test route pattern: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts:64-71`
- [ ] Understand the circular dependency: errorMessage → filter → no test → preserve error

---

## Code Changes

### File: `apps/agent/src/lib/inngest-functions.ts`

#### Change 1: Clear errors before health check

**Location**: Line 8294 (inside `step.run` for org health check)  
**Action**: Add AFTER `async () => {` and BEFORE `const { listMcpToolDefinitions } = ...`

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

**Verification**: `connectionsToCheck.length` should match the count of connections with errors for this org.

---

#### Change 2: Fix error preservation logic

**Location**: Line 8325 (inside `else` block for successful servers)  
**Action**: Change ONE word

**FROM**:
```typescript
errorMessage: hasTools ? null : conn.errorMessage,
```

**TO**:
```typescript
errorMessage: null,
```

**Verification**: Error is cleared for all servers that didn't explicitly fail (even if `hasTools` is false).

---

#### Change 3: Invalidate MCP cache

**Location**: After line 8336 (after the connection update loop, before the catch block)  
**Action**: Add cache invalidation

```typescript
// Invalidate MCP cache after clearing errors so next agent run picks up recovered connections
const { invalidateMcpCacheForOrg } = await import("@repo/agentc2/mcp");
invalidateMcpCacheForOrg(orgId);
```

**Verification**: Cache is invalidated once per org, not per connection.

---

## Testing

### Quick Smoke Test (Local)

1. **Run linting**:
   ```bash
   bun run lint
   ```
   Expected: No errors

2. **Run type checking**:
   ```bash
   bun run type-check
   ```
   Expected: No errors

3. **Run existing tests**:
   ```bash
   bun run test
   ```
   Expected: All pass

4. **Build**:
   ```bash
   bun run build
   ```
   Expected: Success

---

### Manual Verification (Production or Staging)

#### Step 1: Reproduce the bug

1. **Find a HubSpot connection** (or any MCP connection):
   ```sql
   SELECT id, name, "errorMessage" 
   FROM "IntegrationConnection" 
   WHERE "providerId" = (SELECT id FROM "IntegrationProvider" WHERE key = 'hubspot')
   AND "isActive" = true
   LIMIT 1;
   ```

2. **Set an error manually**:
   ```sql
   UPDATE "IntegrationConnection" 
   SET "errorMessage" = 'Manual test error - verifying RCA fix' 
   WHERE id = '<connection-id-from-step-1>';
   ```

3. **Resolve an agent with HubSpot tools**:
   ```bash
   curl -X POST http://localhost:3001/api/agents/resolve \
     -H "Content-Type: application/json" \
     -d '{"slug": "demo-prep-agent-appello"}'
   ```

4. **Verify bug exists**:
   - Response should show HubSpot tools in "unavailable" notice
   - Logs should show: `[MCP] Skipping connection "..." (hubspot): Manual test error...`

---

#### Step 2: Verify the fix

1. **Deploy the fix** (push branch, PM2 restart)

2. **Trigger health check manually** (or wait up to 6 hours):
   ```typescript
   // Via Node.js console or temporary API endpoint
   import { inngest } from "@/lib/inngest";
   await inngest.send({ name: "integration/health-check", data: {} });
   ```

3. **Check error was cleared**:
   ```sql
   SELECT "errorMessage", metadata->>'healthStatus', metadata->>'lastHealthCheck'
   FROM "IntegrationConnection"
   WHERE id = '<connection-id>';
   ```
   Expected:
   - `errorMessage`: NULL
   - `healthStatus`: "healthy" (or "no-tools" if HubSpot truly unavailable)
   - `lastHealthCheck`: Recent timestamp

4. **Verify agent resolution works**:
   ```bash
   curl -X POST http://localhost:3001/api/agents/resolve \
     -H "Content-Type: application/json" \
     -d '{"slug": "demo-prep-agent-appello"}'
   ```
   Expected: No "tools unavailable" notice for HubSpot tools

5. **Verify tools are loaded**:
   ```bash
   curl -X POST http://localhost:3001/api/agents/demo-prep-agent-appello/invoke \
     -H "Content-Type: application/json" \
     -d '{"input": "Search HubSpot for contacts"}'
   ```
   Expected: Agent attempts to use HubSpot tools (not refused)

---

### Edge Case Testing

#### Test: Persistent failure (real broken connection)

1. **Create connection with invalid credentials**
2. **Wait for health check** (or trigger manually)
3. **Verify**:
   - Old error cleared
   - New error set (fresh failure reason)
   - Connection marked unhealthy

#### Test: Transient failure recovery

1. **Start with working connection**
2. **Simulate timeout** (firewall rule or network delay)
3. **Health check sets error**
4. **Remove simulation**
5. **Next health check clears error**
6. **Verify agent can use tools again**

#### Test: Multiple orgs

1. **Set errors on connections in org-1 and org-2**
2. **Health check runs for both orgs**
3. **Verify errors cleared independently**
4. **Verify cache invalidated per-org**

---

## Git Workflow

### Commit Messages

Use conventional commits:

```bash
git add apps/agent/src/lib/inngest-functions.ts
git commit -m "fix: clear errorMessage before health check to enable auto-recovery

Resolves circular dependency where connections with errorMessage are filtered
out of health checks, preventing automatic recovery from transient failures.

Pattern matches manual test route (apps/agent/.../test/route.ts:64-71).

Fixes #166"
```

If adding tests:
```bash
git add tests/integration/inngest/health-check.test.ts
git commit -m "test: add health check recovery test for issue #166"
```

### Push

```bash
git push origin cursor/hubspot-tools-unavailability-43bf
```

---

## Post-Deployment Monitoring

### Immediate (T+0 to T+1h)

1. **Check Inngest logs** for health check execution:
   - Look for "Cleared errorMessage on N connection(s)"
   - Verify no errors during health check run

2. **Check Activity Log** (if monitoring added):
   - Look for "Integration unhealthy" events
   - Should see recovery events for previously broken connections

### Short-term (T+6h to T+24h)

1. **Query connection error rate**:
   ```sql
   SELECT COUNT(*) as with_errors
   FROM "IntegrationConnection"
   WHERE "isActive" = true AND "errorMessage" IS NOT NULL;
   ```
   Expected: Zero or decreasing

2. **Check agent tool health**:
   - Review recent agent runs for tool health warnings
   - Should see decrease in "missing tools" alerts

### Long-term (T+7d)

1. **Error pattern analysis**:
   ```sql
   SELECT 
       ip.key,
       COUNT(*) as error_events,
       COUNT(DISTINCT ic.id) as unique_connections,
       array_agg(DISTINCT SUBSTRING(ic."errorMessage", 1, 50)) as error_types
   FROM "IntegrationConnection" ic
   JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
   WHERE ic."updatedAt" > NOW() - INTERVAL '7 days'
   AND ic."errorMessage" IS NOT NULL
   GROUP BY ip.key
   ORDER BY error_events DESC;
   ```

2. **Identify persistently failing connections**:
   - Connections with errors on every health check indicate real issues
   - Requires manual investigation (bad credentials, network restrictions, etc.)

---

## Rollback Conditions

### Revert if:
- Health check function errors increase
- Database update failures in Inngest logs
- Connections stuck in clearing loop (unlikely but monitor)
- Agent resolution latency increases significantly

### Rollback Steps:
```bash
git revert HEAD
git push origin cursor/hubspot-tools-unavailability-43bf
pm2 restart ecosystem.config.js
```

### Manual Error Clearing (if rollback needed):
```sql
UPDATE "IntegrationConnection"
SET "errorMessage" = NULL
WHERE "isActive" = true AND "errorMessage" IS NOT NULL;
```

---

## Success Indicators

- ✅ Health check logs show error clearing
- ✅ Connections transition from error → healthy automatically
- ✅ Agents load MCP tools without "unavailable" notices
- ✅ Zero connections with stale errors (> 7 hours old)
- ✅ Activity Log shows connection recovery events
- ✅ No increase in health check failures

---

## Known Limitations

### This Fix Does NOT Address:

1. **Persistently failing connections**: Connections with real issues (invalid credentials, network blocks) will continue to fail. This is expected and correct behavior.

2. **Initial connection setup failures**: If a connection fails during provisioning before the first health check, the fix won't help. However, users can manually test via UI.

3. **Cache propagation delay**: Up to 60 seconds between error clearing and agent resolution (MCP_CACHE_TTL). Acceptable for auto-recovery scenario.

### These Are Expected:

- Connections with invalid credentials will still fail (and set fresh errorMessage)
- Connections to permanently offline servers will still fail
- The fix enables **recovery from transient failures**, not immunity from all failures

---

## Related Issues

- [#158](https://github.com/Appello-Prototypes/agentc2/issues/158) - Gmail/Calendar/Drive connection bug (similar lifecycle issue, fixed)
- [#166](https://github.com/Appello-Prototypes/agentc2/issues/166) - This issue
- See `/workspace/RCA-gmail-calendar-drive-connection-bug.md` for related patterns

---

## Questions During Implementation?

1. **"Should I also add the monitoring/alerting improvements?"**  
   No, focus on Phase 1 (immediate fix) only. Monitoring is Phase 2.

2. **"Should I refactor the filtering logic in getIntegrationConnections?"**  
   No, the fix is in the health check function. Don't modify the filter (Phase 3).

3. **"Should I add the UI recovery button?"**  
   No, that's Phase 2. Manual test button already works as a workaround.

4. **"Should I add the errorCount/errorFirstOccurred fields?"**  
   No, that's Phase 2. No schema changes in Phase 1.

5. **"What if the test shows connections still broken?"**  
   Check: (1) error was actually cleared, (2) cache was invalidated, (3) credentials are valid, (4) MCP server is reachable.

---

## Final Pre-Push Checklist

- [ ] Code changes made to `inngest-functions.ts` only
- [ ] Three changes: error clearing, logic fix, cache invalidation
- [ ] Console logs added for observability
- [ ] Code formatted: `bun run format`
- [ ] Linting passed: `bun run lint`
- [ ] Type checking passed: `bun run type-check`
- [ ] Build succeeded: `bun run build`
- [ ] Tests passed: `bun run test`
- [ ] Git diff reviewed
- [ ] Commit message follows conventional commits
- [ ] Branch pushed to remote

---

**Ready to implement**: YES  
**Blocked by**: Nothing  
**Go/No-Go**: GO

---

**Checklist Created**: 2026-03-12  
**Status**: Ready for implementation

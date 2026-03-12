# Root Cause Analysis Index: Issue #166

**Issue**: HubSpot MCP tools intermittently reported as unavailable to agents  
**GitHub**: [#166](https://github.com/Appello-Prototypes/agentc2/issues/166)  
**Branch**: `cursor/hubspot-tools-unavailability-43bf`  
**Analysis Date**: 2026-03-12  
**Status**: ✅ Analysis Complete — Ready for Implementation

---

## Document Navigation

### Quick Start (5 minutes)
1. **Read**: `RCA-SUMMARY-hubspot-tools-unavailability.md` (8KB)
   - Executive summary
   - The bug in 3 sentences
   - The fix in 3 code blocks

### Implementation (30 minutes)
2. **Read**: `FIX-REFERENCE-166.md` (9KB)
   - Exact code changes with line numbers
   - Before/after diffs
   - Verification commands

3. **Follow**: `IMPLEMENTATION-CHECKLIST-166.md` (12KB)
   - Step-by-step checklist
   - Testing procedures
   - Git workflow

### Deep Dive (30 minutes)
4. **Read**: `RCA-hubspot-tools-unavailability.md` (45KB)
   - Complete technical analysis
   - All affected code paths
   - Reproduction scenarios
   - Testing strategy

### Detailed Plan (Reference)
5. **Read**: `.cursor/plans/fix-hubspot-tools-unavailability-166.md` (14KB)
   - Implementation steps
   - Test cases
   - Rollback plan
   - Success criteria

---

## The Bug (TL;DR)

**What**: MCP tools (HubSpot, Jira, Slack, etc.) become permanently unavailable when a connection fails a health check, even after the underlying issue resolves.

**Why**: Circular dependency — health checks filter out connections with `errorMessage`, preventing them from being re-tested to clear the error.

**Fix**: Clear `errorMessage` before health checks (2 line change + cache invalidation).

**Risk**: LOW (proven pattern from manual test route)

**Time**: 30 minutes implementation + 6 hours verification

---

## Key Findings

### Root Cause
**File**: `packages/agentc2/src/mcp/client.ts:2818-2827`
```typescript
// This filter creates the circular dependency
const connections = allConnections.filter((conn) => {
    if (conn.errorMessage) {
        return false;  // ⚠️ Permanent exclusion
    }
    return true;
});
```

### The Circular Dependency
```
Health Check Fails → Set errorMessage
    ↓
errorMessage Present → Filter out connection
    ↓
Connection Filtered → Not tested by health check
    ↓
Not Tested → errorMessage preserved
    ↓
(Loop forever)
```

### Affected Code Paths (All use `getIntegrationConnections`)
1. Agent tool resolution → `getToolsByNamesAsync()` → `getMcpToolsCached()` → `getMcpTools()`
2. Skill tool loading → `getToolsByNamesAsync()` → `getMcpToolsCached()` → `getMcpTools()`
3. Integration provisioning → `listMcpToolDefinitions()` → `getMcpTools()`
4. Tool rediscovery → `listMcpToolDefinitions()` → `getMcpTools()`
5. Health checks → `listMcpToolDefinitions()` → `getMcpTools()`

### The Fix (3 Changes)
1. Clear `errorMessage` before health check (5 lines added)
2. Always clear error when no server failure (1 word changed)
3. Invalidate cache after clearing (2 lines added)

---

## Impact Summary

### Severity: HIGH
- Affects ALL MCP integrations (HubSpot, Jira, Slack, GitHub, Firecrawl, JustCall, Playwright, ATLAS, custom servers)
- Agents report tools unavailable despite UI showing "Connected"
- No automatic recovery mechanism
- Silent degradation (inconsistent state)

### Scope: BROAD
- Agent resolution ❌
- Skill tool loading ❌
- Integration provisioning ❌
- Tool rediscovery ❌
- Health checks ❌ (self-referential)
- Manual UI test ✅ (only workaround)

### Production Impact
- Unknown number of connections currently stuck in error state
- Query to find affected connections:
  ```sql
  SELECT COUNT(*) FROM "IntegrationConnection"
  WHERE "isActive" = true AND "errorMessage" IS NOT NULL;
  ```

---

## Implementation Priority

### Phase 1: Critical (THIS PR)
- ✅ Fix health check circular dependency
- ✅ Add cache invalidation
- ✅ Deploy to production
- ⏱️ **Effort**: 3 hours

### Phase 2: Defensive Improvements (FUTURE PR)
- ⚠️ Add error recovery endpoint
- ⚠️ Add UI recovery button
- ⚠️ Add monitoring & alerts
- ⚠️ Add error tracking fields (errorCount, errorFirstOccurred)
- ⏱️ **Effort**: 4 hours

### Phase 3: Architectural Improvements (FUTURE PR)
- ⚠️ Consider removing errorMessage filter entirely
- ⚠️ Implement exponential backoff for persistent failures
- ⚠️ Enhance stale-while-revalidate pattern
- ⏱️ **Effort**: 6 hours

**Recommendation**: Implement Phase 1 now, defer Phase 2 & 3.

---

## File Inventory

### Analysis Documents
| File | Size | Purpose | Audience |
|------|------|---------|----------|
| `RCA-hubspot-tools-unavailability.md` | 45KB | Complete technical analysis | Engineers, reviewers |
| `RCA-SUMMARY-hubspot-tools-unavailability.md` | 8KB | Executive summary | Stakeholders, PMs |
| `RCA-INDEX-166.md` | This file | Navigation guide | All |

### Implementation Documents
| File | Size | Purpose | Audience |
|------|------|---------|----------|
| `FIX-REFERENCE-166.md` | 9KB | Code changes with diffs | Implementer |
| `IMPLEMENTATION-CHECKLIST-166.md` | 12KB | Step-by-step guide | Implementer, QA |
| `.cursor/plans/fix-hubspot-tools-unavailability-166.md` | 14KB | Detailed implementation plan | Team lead, reviewers |

### Total Documentation: 106KB (6 files)

---

## Code Changes Summary

### Files Modified: 1
- `apps/agent/src/lib/inngest-functions.ts`
  - **Lines**: 8293-8354 (health check function)
  - **Changes**: 3 additions, 1 modification
  - **Net Lines**: +17 lines

### Files Created: 0
- No new files required for Phase 1

### Tests Created: 0 (recommended but optional)
- `tests/integration/inngest/health-check.test.ts` (future work)

---

## Verification Checklist

### Pre-Deployment
- [ ] Lint: `bun run lint` ✅ Pass
- [ ] Type check: `bun run type-check` ✅ Pass
- [ ] Build: `bun run build` ✅ Pass
- [ ] Tests: `bun run test` ✅ Pass
- [ ] Git diff reviewed

### Post-Deployment (T+6h)
- [ ] Health check ran successfully
- [ ] Errors cleared in database
- [ ] Agent tool resolution works
- [ ] No regression in logs

### Success Criteria (T+24h)
- [ ] Zero stale errors (> 7 hours old)
- [ ] Agent tool health warnings decreased
- [ ] No health check failures
- [ ] Activity Log shows recoveries

---

## Related Work

### Recent Similar Fixes
- **Issue #158**: Gmail/Calendar/Drive connection bug (fixed 2026-03-12)
  - RCA: `/workspace/RCA-gmail-calendar-drive-connection-bug.md`
  - Pattern: Connection lifecycle circular dependencies

### References
- Manual test route pattern: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts:64-71`
- Connection filtering logic: `packages/agentc2/src/mcp/client.ts:2818-2827`
- Agent resolver tool health: `packages/agentc2/src/agents/resolver.ts:817-851`

---

## Sign-Off

### Analysis Phase
- [x] Root cause identified
- [x] All code paths traced
- [x] Impact assessed
- [x] Fix designed
- [x] Risk evaluated
- [x] Documentation complete

### Implementation Phase (Next)
- [ ] Code changes applied
- [ ] Tests written
- [ ] Manual verification complete
- [ ] Deployed to production
- [ ] Monitoring confirmed

### Resolution Phase (T+24h)
- [ ] Success criteria met
- [ ] No regressions detected
- [ ] Issue #166 closed
- [ ] Retrospective complete

---

## Key Contacts

**Issue Reporter**: [From GitHub issue]  
**Analyst**: Claude (AgentC2 Cloud Agent)  
**Implementer**: [To be assigned]  
**Reviewer**: [To be assigned]  
**Deployment**: [To be scheduled]

---

## Quick Commands

### Reproduce Bug
```sql
-- Set error on HubSpot connection
UPDATE "IntegrationConnection" 
SET "errorMessage" = 'Test error' 
WHERE "providerId" = (SELECT id FROM "IntegrationProvider" WHERE key = 'hubspot');
```

### Verify Fix
```sql
-- Should return 0 after one health check cycle
SELECT COUNT(*) FROM "IntegrationConnection"
WHERE "isActive" = true 
AND "errorMessage" IS NOT NULL
AND "updatedAt" < NOW() - INTERVAL '7 hours';
```

### Manual Recovery (Temporary)
```sql
-- Clear errors manually (before fix is deployed)
UPDATE "IntegrationConnection"
SET "errorMessage" = NULL
WHERE "isActive" = true AND "errorMessage" IS NOT NULL;
```

---

**Index Created**: 2026-03-12  
**Last Updated**: 2026-03-12  
**Status**: Complete and ready for implementation review

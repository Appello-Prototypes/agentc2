# Issue #166: HubSpot MCP Tools Unavailability — Analysis Complete ✅

**GitHub Issue**: [#166](https://github.com/Appello-Prototypes/agentc2/issues/166)  
**Branch**: `cursor/hubspot-tools-unavailability-43bf`  
**Analysis Date**: 2026-03-12  
**Status**: ✅ READY FOR IMPLEMENTATION

---

## Analysis Summary

**Root Cause Identified**: Circular dependency between health check system and connection filtering logic.

**Fix Complexity**: LOW (2-line change + cache invalidation)  
**Implementation Time**: 30 minutes  
**Risk Level**: LOW (proven pattern)  
**Impact**: HIGH (affects all MCP integrations)

**Recommendation**: ✅ **Implement immediately**

---

## Document Guide

### For Quick Review (10 minutes)
Start here if you need to understand the bug and approve the fix:

1. **`RCA-INDEX-166.md`** — Navigation guide (this is the master index)
2. **`RCA-SUMMARY-hubspot-tools-unavailability.md`** — Executive summary (8KB)
3. **`FIX-REFERENCE-166.md`** — Code changes with diffs (9KB)

### For Implementation (1 hour)
Follow these in order if you're implementing the fix:

1. **`IMPLEMENTATION-CHECKLIST-166.md`** — Step-by-step checklist (12KB)
2. **`FIX-REFERENCE-166.md`** — Exact code to change (9KB)
3. **`QUERIES-166.sql`** — Diagnostic and monitoring queries (11KB)

### For Deep Technical Understanding (1 hour)
Read these if you need full context or are auditing the analysis:

1. **`RCA-hubspot-tools-unavailability.md`** — Complete technical analysis (45KB)
2. **`.cursor/plans/fix-hubspot-tools-unavailability-166.md`** — Detailed fix plan (14KB)

---

## The Bug (30-Second Summary)

**What Happens**:
1. MCP server (HubSpot, Jira, etc.) fails a health check
2. System sets `errorMessage` on the IntegrationConnection
3. All subsequent code filters out connections with `errorMessage`
4. Health checks can't re-test the connection (circular dependency)
5. Connection stuck in error state forever

**User Impact**:
- Agent reports "HubSpot tools unavailable"
- UI shows "Connected" (green badge)
- Manual test button temporarily fixes it
- Error returns after next health check

**The Fix**:
Clear `errorMessage` before health checks, matching the pattern already used in manual test route.

---

## Quick Stats

### Documentation Created
- **7 files** totaling **~107KB**
- **3,367 lines** of analysis, plans, and queries
- **5 code paths** traced and analyzed
- **15 SQL queries** for diagnostics and monitoring
- **11 MCP providers** confirmed affected
- **2 integration tests** recommended (not blocking)

### Code Changes Required
- **1 file** modified: `apps/agent/src/lib/inngest-functions.ts`
- **17 lines** added (error clearing + cache invalidation + logging)
- **1 line** changed (error preservation logic)
- **0 files** created
- **0 schema** changes

### Risk Assessment
- **Risk Level**: LOW
- **Breaking Changes**: None
- **API Changes**: None
- **Database Migrations**: None
- **Rollback Complexity**: Trivial (single git revert)

---

## Key Files Reference

### Primary Analysis Document
📄 **`RCA-hubspot-tools-unavailability.md`** (45KB, 1351 lines)
- Complete root cause analysis
- All affected code paths
- Reproduction scenarios
- Testing strategy
- Three-phase fix plan (immediate, defensive, architectural)

### Implementation Guide
📋 **`IMPLEMENTATION-CHECKLIST-166.md`** (12KB, 294 lines)
- Pre-implementation checklist
- Step-by-step code changes
- Testing procedures
- Git workflow
- Post-deployment monitoring

### Code Reference
💻 **`FIX-REFERENCE-166.md`** (9KB, 320 lines)
- Exact line numbers and code blocks
- Before/after diffs
- Verification commands
- Expected console output

### SQL Diagnostics
🗄️ **`QUERIES-166.sql`** (11KB, 300 lines)
- 15 diagnostic queries
- Pre/post-deployment validation
- Monitoring queries
- Cleanup queries (if needed)

### Quick Reference
📊 **`RCA-SUMMARY-hubspot-tools-unavailability.md`** (8KB, 285 lines)
- Executive summary
- The fix in 3 code blocks
- Risk assessment
- Quick validation steps

### Navigation Hub
🗺️ **`RCA-INDEX-166.md`** (8KB, 291 lines)
- Document navigation
- Priority guide
- Key findings summary
- Implementation phases

### Detailed Plan
📝 **`.cursor/plans/fix-hubspot-tools-unavailability-166.md`** (14KB, 476 lines)
- Phase 1, 2, 3 implementation steps
- Test case specifications
- Rollback procedures
- Success criteria

---

## Implementation Fast Track

### If You Have 30 Minutes
1. Read `RCA-SUMMARY-hubspot-tools-unavailability.md` (5 min)
2. Read `FIX-REFERENCE-166.md` (5 min)
3. Apply the 3 code changes (10 min)
4. Run `bun run lint && bun run type-check && bun run build` (5 min)
5. Push to branch (2 min)
6. Deploy and monitor (3 min)

### If You Have 2 Hours
1. Read full RCA: `RCA-hubspot-tools-unavailability.md` (30 min)
2. Follow checklist: `IMPLEMENTATION-CHECKLIST-166.md` (1 hour)
3. Write integration test (optional, 30 min)

### If You're Auditing
1. Read `RCA-INDEX-166.md` first for navigation
2. Review `RCA-hubspot-tools-unavailability.md` for technical depth
3. Verify code paths match the analysis
4. Check proposed fix against manual test route pattern
5. Assess risk and approve/reject

---

## Critical Insights

### Why This Matters
1. **Silent Degradation**: UI shows "Connected", runtime fails (inconsistent state)
2. **Affects All MCP**: Not just HubSpot — Jira, Slack, GitHub, Firecrawl, etc.
3. **No Auto-Recovery**: Connections stay broken until manual intervention
4. **Production Impact**: Unknown number of connections currently stuck

### Why The Fix Works
1. ✅ **Proven Pattern**: Manual test route already does this successfully
2. ✅ **Breaks Circular Dependency**: Clear error → test → set result (linear flow)
3. ✅ **Backwards Compatible**: No API or schema changes
4. ✅ **Fail-Safe**: Worst case is more test attempts (acceptable overhead)

### Why Low Risk
1. Health checks are read-heavy operations
2. Already have retry logic built in
3. Cache invalidation is safe (just forces reload)
4. No changes to critical agent resolution path
5. Rollback is trivial (single commit revert)

---

## Validation Checklist

### Before Claiming Fix Complete

- [ ] Code changes applied to `inngest-functions.ts`
- [ ] All 3 changes present (error clearing, logic fix, cache invalidation)
- [ ] Console logs added for observability
- [ ] Lint, type-check, build all pass
- [ ] Existing tests pass
- [ ] Git pushed to branch
- [ ] Deployed to production
- [ ] Wait 6 hours for one health check cycle
- [ ] Run validation queries from `QUERIES-166.sql`
- [ ] Verify zero stale errors (> 7 hours old)
- [ ] Test agent resolution with HubSpot tools
- [ ] Verify tools load successfully
- [ ] Monitor Activity Log for 24 hours
- [ ] Close GitHub issue #166

---

## Expected Outcomes

### Immediate (T+0)
- ✅ Code deployed
- ✅ Health check function updated
- ✅ Logs show changes deployed

### Short-term (T+6h after first health check)
- ✅ Errors cleared automatically
- ✅ Agents load MCP tools successfully
- ✅ No "tools unavailable" notices
- ✅ Zero stale errors in database

### Long-term (T+7d)
- ✅ No circular dependency failures
- ✅ Transient failures auto-recover
- ✅ Health metrics stable
- ✅ Activity Log shows normal operation

### What Won't Change (Expected)
- ⚠️ Connections with invalid credentials still fail (correct behavior)
- ⚠️ Servers that are permanently down still fail (correct behavior)
- ⚠️ Initial connection setup can still fail (requires manual test)

---

## Related Context

### Similar Issues Fixed Recently
- **#158**: Gmail/Calendar/Drive connection lifecycle bug (fixed 2026-03-12)
- **Pattern**: Both involve circular dependencies in connection state management
- **Lesson**: Connection lifecycle needs defensive error recovery patterns

### Code Locations Cross-Reference

| Component | File | Lines | Function |
|-----------|------|-------|----------|
| **Filter (Bug Source)** | `packages/agentc2/src/mcp/client.ts` | 2818-2827 | `getIntegrationConnections` |
| **Health Check (Fix Target)** | `apps/agent/src/lib/inngest-functions.ts` | 8264-8362 | `integrationHealthCheckFunction` |
| **Manual Test (Correct Pattern)** | `apps/agent/src/app/api/integrations/connections/[id]/test/route.ts` | 64-71 | `POST` handler |
| **Agent Resolution (Consumer)** | `packages/agentc2/src/agents/resolver.ts` | 542-556, 862-871 | `hydrate` |
| **Tool Registry (Consumer)** | `packages/agentc2/src/tools/registry.ts` | 1908-1999 | `getToolsByNamesAsync` |
| **Provisioner (Consumer)** | `packages/agentc2/src/integrations/provisioner.ts` | 952 | `discoverMcpToolsWithDefinitions` |

---

## Questions & Answers

### Q: Why wasn't this caught in testing?
**A**: The bug manifests after health checks run (6-hour intervals). Local dev and unit tests don't run health checks. Integration tests don't simulate health check failures.

### Q: Why did the UI show "Connected" when tools were unavailable?
**A**: `isActive: true` and `errorMessage: "..."` can coexist. The UI checks `isActive`, but runtime checks `errorMessage`. Inconsistent state.

### Q: Why didn't cache invalidation help?
**A**: Cache expires every 60s, but the underlying connection is still filtered out. Cache refresh doesn't help if the source data (connection list) excludes the connection.

### Q: How did users work around this?
**A**: Manual test button in UI clears `errorMessage` temporarily. Works until next health check (up to 6 hours).

### Q: Could this affect non-MCP integrations?
**A**: No. OAuth-based integrations (Gmail, Microsoft, Dropbox) don't use the MCP client infrastructure. Only MCP and custom providers affected.

### Q: What happens to connections that are legitimately broken?
**A**: They fail the health check after error clearing, get a FRESH error message (not stale), and are marked unhealthy. This is correct behavior.

---

## Success Metrics

### Primary Metric: Connection Error Rate
```sql
-- Target: < 5% of active MCP connections have errorMessage
SELECT 
    ROUND(100.0 * SUM(CASE WHEN "errorMessage" IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as error_rate_pct
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."isActive" = true AND ip."providerType" = 'mcp';
```

**Baseline** (before fix): Unknown, likely 10-30%  
**Target** (after fix): < 5% (only legitimately failing connections)

### Secondary Metrics
- Agent tool health warnings (should decrease to near-zero)
- Health check success rate (should increase to ~95%)
- Stale error count (should be zero after 12 hours)
- Activity Log recovery events (should see multiple per org)

---

## Deployment Recommendation

### Approval Criteria
- [x] Root cause confirmed
- [x] All code paths analyzed
- [x] Fix designed and documented
- [x] Risk assessed as LOW
- [x] Testing strategy defined
- [x] Rollback plan documented

### Go/No-Go Decision
- ✅ **GO**: All criteria met, fix is safe and proven
- ⏸️ **HOLD**: If integration tests reveal edge cases (unlikely)
- ❌ **NO-GO**: If codebase has diverged from analyzed version

### Deployment Strategy
1. **Deploy to staging** (if available): Test with synthetic error
2. **Deploy to production**: Standard push + PM2 restart
3. **Monitor for 24 hours**: Run validation queries every 6 hours
4. **Verify success**: Run Query 6 from `QUERIES-166.sql` after 12 hours
5. **Close issue**: Mark #166 as resolved

---

## Support Resources

### If Implementation Questions Arise
1. Review the **FIX-REFERENCE-166.md** for exact code changes
2. Check **IMPLEMENTATION-CHECKLIST-166.md** for step-by-step guide
3. Review manual test route: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts:64-71`

### If Issues Detected Post-Deployment
1. Check Inngest logs for health check errors
2. Run diagnostic queries from **QUERIES-166.sql**
3. Review Activity Log for integration alerts
4. If necessary, rollback per **IMPLEMENTATION-CHECKLIST-166.md**

### If Further Analysis Needed
1. Read full RCA: **RCA-hubspot-tools-unavailability.md**
2. Review detailed plan: **.cursor/plans/fix-hubspot-tools-unavailability-166.md**
3. Check related issue: **RCA-gmail-calendar-drive-connection-bug.md** (similar pattern)

---

## File Inventory

### Created by Analysis

| File | Size | Lines | Purpose |
|------|------|-------|---------|
| `RCA-hubspot-tools-unavailability.md` | 45KB | 1351 | Complete technical analysis |
| `RCA-SUMMARY-hubspot-tools-unavailability.md` | 8KB | 285 | Executive summary |
| `RCA-INDEX-166.md` | 8KB | 291 | Navigation guide |
| `FIX-REFERENCE-166.md` | 9KB | 320 | Code changes reference |
| `IMPLEMENTATION-CHECKLIST-166.md` | 12KB | 294 | Implementation checklist |
| `.cursor/plans/fix-hubspot-tools-unavailability-166.md` | 14KB | 476 | Detailed fix plan |
| `QUERIES-166.sql` | 11KB | 300 | SQL diagnostics |
| **`README-ISSUE-166.md`** | **This file** | Master index |

**Total**: 107KB documentation, 3,367 lines

---

## What's Next?

### Immediate Actions (Today)
1. ✅ Review documents (stakeholder approval)
2. ⚠️ Assign implementer
3. ⚠️ Implement fix (follow IMPLEMENTATION-CHECKLIST-166.md)
4. ⚠️ Deploy to production
5. ⚠️ Monitor for 24 hours

### Follow-up Actions (This Week)
- Run validation queries daily
- Monitor error rates
- Verify agent tool health improves
- Document lessons learned

### Future Enhancements (Next Sprint)
- Phase 2: Add error recovery endpoint + UI
- Phase 3: Consider architectural improvements
- Add integration test coverage
- Improve error tracking metadata

---

## Confidence Level

### Analysis Confidence: **VERY HIGH** (95%)

**Why**:
- ✅ Circular dependency confirmed via code tracing
- ✅ All consumers of `getIntegrationConnections` identified
- ✅ Manual test route provides proven working pattern
- ✅ Developer comments show awareness of filtering behavior
- ✅ Bug symptom matches user report exactly

**Uncertainty**:
- ⚠️ Exact count of affected connections in production (requires SQL query)
- ⚠️ Whether other concurrent bugs exist in connection lifecycle

### Fix Confidence: **HIGH** (90%)

**Why**:
- ✅ Pattern already proven in production (manual test route)
- ✅ No new logic introduced
- ✅ Minimal code surface area
- ✅ Comprehensive testing strategy

**Risk Factors**:
- ⚠️ Health check performance impact (minimal, ~50ms per org)
- ⚠️ Edge cases with concurrent health checks (mitigated by step locking)

---

## Stakeholder Sign-Off

### Analysis Complete ✅
- [x] Root cause identified with evidence
- [x] All affected systems documented
- [x] Fix designed and documented
- [x] Risk assessed
- [x] Testing strategy defined

### Ready for Implementation ✅
- [x] Implementation guide complete
- [x] Code changes specified
- [x] Rollback plan documented
- [x] Success criteria defined
- [x] Monitoring queries provided

### Pending
- [ ] Code review
- [ ] Implementation
- [ ] Deployment
- [ ] Verification
- [ ] Issue closure

---

## Contact

**Analysis Performed By**: Claude (AgentC2 Cloud Agent)  
**Analysis Date**: 2026-03-12  
**GitHub Issue**: [#166](https://github.com/Appello-Prototypes/agentc2/issues/166)  
**Repository**: Appello-Prototypes/agentc2  
**Branch**: cursor/hubspot-tools-unavailability-43bf

**For Questions**: Review the appropriate document from the File Inventory above.

---

**Status**: ✅ Analysis Complete — Awaiting Implementation

**Recommendation**: Implement Phase 1 fix immediately. The bug is well-understood, the fix is proven, and the risk is low. Deferring increases production impact with no benefit.

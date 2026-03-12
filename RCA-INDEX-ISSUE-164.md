# Root Cause Analysis Index - Issue #164

**Issue**: Google Calendar OAuth connection missing calendar.events scope after re-authorization  
**GitHub**: https://github.com/Appello-Prototypes/agentc2/issues/164  
**Branch**: `cursor/calendar-events-scope-missing-2b10`  
**Date**: 2026-03-12

---

## Analysis Documents

This root cause analysis consists of four comprehensive documents:

### 1. Complete Root Cause Analysis (RCA)
**File**: `RCA-google-calendar-scope-missing.md`  
**Purpose**: Full technical analysis with code references, fix plans, and implementation details  
**Audience**: Engineers implementing the fix  
**Length**: ~1,250 lines

**Contents**:
- Executive summary
- Technical deep dive with authorization flow diagrams
- Root cause hierarchy (primary + secondary causes)
- Complete impact assessment
- Detailed fix plan (5 phases)
- Testing checklist
- Data migration scripts
- Post-deployment actions
- Long-term recommendations

**Read this if**: You're implementing the fix or need complete technical context

---

### 2. Executive Summary
**File**: `ISSUE-164-SUMMARY.md`  
**Purpose**: Concise summary for stakeholders and reviewers  
**Audience**: Product managers, auditors, non-technical reviewers  
**Length**: ~200 lines

**Contents**:
- Problem statement (2 paragraphs)
- Root cause (confirmed, with code references)
- Fix plan (2 files, ~25 lines)
- Impact assessment
- Timeline estimate (~1 hour)
- Risk assessment (Low)
- User communication template

**Read this if**: You need to understand the issue quickly or approve the fix

---

### 3. Implementation Guide
**File**: `FIX-IMPLEMENTATION-GUIDE.md`  
**Purpose**: Step-by-step instructions for developer implementing the fix  
**Audience**: Engineer assigned to implement  
**Length**: ~300 lines

**Contents**:
- Pre-implementation checklist
- Exact code changes (copy-paste ready)
- Verification steps
- Deployment steps
- User communication template
- Post-deployment monitoring
- Rollback plan

**Read this if**: You're the engineer implementing the fix

---

### 4. Test Plan
**File**: `TEST-PLAN-ISSUE-164.md`  
**Purpose**: Comprehensive test cases for QA validation  
**Audience**: QA engineer or implementation developer  
**Length**: ~400 lines

**Contents**:
- 10 functional test cases
- 2 security test cases
- 3 documentation verification checks
- Database inspection queries
- Troubleshooting guide
- Test results template
- Sign-off checklist

**Read this if**: You're testing the fix before production deployment

---

### 5. Scope Comparison Analysis
**File**: `SCOPE-COMPARISON-ANALYSIS.md`  
**Purpose**: Deep dive on Google OAuth scopes and best practices  
**Audience**: Anyone wanting to understand OAuth scope management  
**Length**: ~350 lines

**Contents**:
- Scope definitions from Google
- Capability matrix (what each scope allows)
- AgentC2 tool requirements
- Historical scope evolution
- Why calendar.events is correct choice
- OAuth best practices
- Testing gaps analysis

**Read this if**: You want to understand OAuth scopes or prevent similar bugs

---

## Quick Start Guide

### For Engineers (Implementing the Fix)

1. **Read**: `ISSUE-164-SUMMARY.md` (5 min)
2. **Read**: `FIX-IMPLEMENTATION-GUIDE.md` (10 min)
3. **Implement**: Follow step-by-step guide (10 min)
4. **Test**: Use `TEST-PLAN-ISSUE-164.md` (30 min)
5. **Deploy**: Follow deployment steps (5 min)
6. **Reference**: `RCA-google-calendar-scope-missing.md` for any questions

**Total Time**: ~1 hour

### For Reviewers (Approving the Fix)

1. **Read**: `ISSUE-164-SUMMARY.md` (5 min)
2. **Skim**: `RCA-google-calendar-scope-missing.md` Executive Summary and Fix Plan sections (10 min)
3. **Decide**: Approve or request changes
4. **If approved**: Hand off `FIX-IMPLEMENTATION-GUIDE.md` to engineer

**Total Time**: ~15 minutes

### For QA (Testing the Fix)

1. **Read**: `ISSUE-164-SUMMARY.md` (5 min)
2. **Execute**: `TEST-PLAN-ISSUE-164.md` test cases (45 min)
3. **Reference**: `RCA-google-calendar-scope-missing.md` for troubleshooting
4. **Report**: Fill out test results template

**Total Time**: ~1 hour

### For Auditors (Compliance Review)

1. **Read**: `SCOPE-COMPARISON-ANALYSIS.md` (15 min)
2. **Read**: `RCA-google-calendar-scope-missing.md` compliance sections (10 min)
3. **Verify**: Updated privacy/security policies match actual implementation
4. **Approve**: Documentation updates

**Total Time**: ~30 minutes

---

## Key Findings at a Glance

### Root Cause

Two configuration files have incorrect Google Calendar OAuth scopes:

1. **SetupWizard.tsx** (line 70): Hardcoded `calendar.readonly` instead of `calendar.events`
2. **mcp/client.ts** (line 598): Gmail provider seed missing calendar/drive scopes

### Impact

- Users who re-authorize Gmail via Integrations Hub get insufficient permissions
- Connection test shows "connected" but calendar tools fail with scope error
- Affects connection `cmls22ux9002r8e6o1m2n2u7x` for user nathan@useappello.com

### Fix

- Import and use `GOOGLE_OAUTH_SCOPES` in SetupWizard (remove hardcoded array)
- Update Gmail provider database seed with complete Google scopes
- Update 6 documentation files to reflect correct scope
- Optional: Add scope validation to connection test

### Complexity

- **Files Changed**: 2 (core fix) + 6 (documentation)
- **Lines Changed**: ~25 (core) + ~15 (docs)
- **Time Estimate**: ~1 hour implementation + testing
- **Risk**: Low (config-only changes, clear rollback)

---

## File Change Summary

### Must Change (Phase 1 - Critical)

| File | Lines | Change Type | Impact |
|------|-------|-------------|--------|
| `apps/agent/src/components/integrations/SetupWizard.tsx` | 64-75 | Import GOOGLE_OAUTH_SCOPES | Fixes re-authorization |
| `packages/agentc2/src/mcp/client.ts` | 594-601 | Add all Google scopes | Fixes database config |

### Should Change (Phase 2 - Documentation)

| File | Lines | Change Type | Impact |
|------|-------|-------------|--------|
| `apps/agent/src/components/integrations/SetupWizard.tsx` | 81 | Add scope description | User clarity |
| `apps/frontend/src/app/(Public)/privacy/page.tsx` | 147 | Update scope reference | Accurate privacy policy |
| `apps/frontend/src/app/(Public)/security/page.tsx` | 272 | Update scope reference | Accurate security claims |
| `docs/compliance/audits/PIPEDA-AUDIT.md` | 75 | Update audit reference | Audit accuracy |
| `docs/compliance/audits/GDPR-AUDIT.md` | 33 | Update audit reference | Audit accuracy |
| `apps/frontend/content/docs/guides/build-a-sales-agent.mdx` | 133-134 | Clarify scope requirements | Correct instructions |

### Optional (Phase 3 - Enhancements)

| File | Lines | Change Type | Impact |
|------|-------|-------------|--------|
| `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts` | 124-140 | Add scope validation | Better error detection |
| `packages/agentc2/src/tools/google-calendar/search-events.ts` | 91 | Update comment | Code clarity |

---

## Decision Log

### ✅ Decisions Made

1. **Use calendar.events, not calendar.readonly**: Agents need write access for scheduling
2. **Fix both locations**: SetupWizard AND database seed must be updated
3. **Import from SSoT**: Use `GOOGLE_OAUTH_SCOPES` instead of hardcoding
4. **Update documentation**: All 6 docs must reflect correct scope
5. **Require user re-authorization**: Cannot fix OAuth token without user action

### ❓ Decisions Pending Approval

1. **Scope validation in connection test**: Should we add this? (Recommended: Yes)
2. **Remove fallback entirely**: Should we force all config from database? (Recommended: No, keep fallback but fix it)
3. **Migration script**: Should we auto-fix stored scope strings? (Recommended: Yes, but users still must re-auth for actual token)
4. **User notification**: Should we email affected users? (Recommended: Yes, if we can identify them)

### ❌ Decisions Rejected

1. **Use calendar.readonly for read tools, calendar.events for write tools**: Too complex, inconsistent UX
2. **Keep separate OAuth flows for Gmail vs Calendar**: Doesn't match Google OAuth model (shared tokens)
3. **Request incremental scopes**: Not supported by Google OAuth (scopes aren't additive)

---

## Status Tracking

| Milestone | Status | Date | Notes |
|-----------|--------|------|-------|
| Root cause identified | ✅ Complete | 2026-03-12 | Two-location scope mismatch |
| Analysis documents created | ✅ Complete | 2026-03-12 | 4 docs, ~2,000 lines total |
| Fix plan approved | ⏳ Pending | | Awaiting review |
| Code changes implemented | ⏳ Pending | | Blocked by approval |
| Tests passed | ⏳ Pending | | Blocked by implementation |
| Deployed to production | ⏳ Pending | | Blocked by tests |
| User verified fix | ⏳ Pending | | Blocked by deployment |
| Issue closed | ⏳ Pending | | Blocked by verification |

---

## Communication Plan

### Internal Team

- **Slack/Email**: Share `ISSUE-164-SUMMARY.md` with team
- **Standup**: Brief update on RCA completion, awaiting approval
- **Documentation**: Update issue #164 with link to RCA documents

### Affected Users

**Timing**: After fix is deployed and verified

**Message**: 
> We've resolved a permissions issue with Google Calendar integration. If you recently reconnected your Google account and calendar tools stopped working, please disconnect and reconnect one more time. This will grant the correct permissions and restore full calendar functionality.

**Delivery**:
- In-app notification in Integrations Hub
- Email to affected users (if identifiable)
- Update in issue #164 for public visibility

---

## Metrics to Track

### Before Fix (Baseline)

- Number of Gmail connections with `calendar.readonly`: [Run query to count]
- Calendar tool error rate: [Check logs for "missing scope" errors]
- Connection test pass rate: [Likely 100% - false positive]

### After Fix (Target)

- Number of Gmail connections with `calendar.readonly`: 0 (after all users re-auth)
- Calendar tool error rate: <5% (normal API errors only)
- Connection test pass rate: >95% (with scope validation)
- User satisfaction: No reports of calendar tools failing

---

## Approval Sign-Off

**RCA Completed By**: Cloud Agent (Cursor)  
**Date**: 2026-03-12

**Reviewed By**: _____________  
**Date**: _____________  
**Status**: [ ] Approved [ ] Changes Requested [ ] Rejected

**Implementation Assigned To**: _____________  
**Date**: _____________  

**QA Tested By**: _____________  
**Date**: _____________  
**Result**: [ ] Passed [ ] Failed

**Deployed By**: _____________  
**Date**: _____________  
**Deployment Status**: [ ] Success [ ] Rolled Back

**User Verified By**: nathan@useappello.com  
**Date**: _____________  
**Status**: [ ] Fixed [ ] Still Broken

---

## Quick Reference

**TL;DR**: SetupWizard and database seed have wrong Google Calendar scope. Change `calendar.readonly` to `calendar.events` in both locations. Users must re-authorize after fix deployed.

**Files to Change**: 
- `apps/agent/src/components/integrations/SetupWizard.tsx` (import GOOGLE_OAUTH_SCOPES)
- `packages/agentc2/src/mcp/client.ts` (update Gmail provider configJson)

**Time to Fix**: ~10 min coding + ~30 min testing = ~1 hour total

**User Impact**: Must re-authorize Google connection after fix deployed

**Risk**: Low (config changes only, clear rollback path)

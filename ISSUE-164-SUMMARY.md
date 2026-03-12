# Issue #164: Google Calendar OAuth Scope Missing - Executive Summary

**Status**: Root cause identified, fix plan ready  
**Severity**: Critical  
**Affected Component**: Google Calendar integration  
**Connection ID**: `cmls22ux9002r8e6o1m2n2u7x`  
**User**: nathan@useappello.com

---

## Problem Statement

After connecting Google Calendar via OAuth in the Integrations Hub, the connection test shows "connected: true" but all calendar agent tools fail with:

> Unable to access Google Calendar due to missing authorization scope (calendar.events)

---

## Root Cause (Confirmed)

**Two configuration files contain incorrect OAuth scopes:**

### Location 1: SetupWizard Fallback Config
**File**: `apps/agent/src/components/integrations/SetupWizard.tsx:70`  
**Issue**: Hardcoded scope `calendar.readonly` instead of `calendar.events`

### Location 2: Database Provider Seed  
**File**: `packages/agentc2/src/mcp/client.ts:598`  
**Issue**: Gmail provider config only includes Gmail scopes, missing Calendar/Drive scopes

When users "re-authorize" Gmail via the Integrations Hub, one of these incomplete configs is used to request OAuth permissions. Google grants only the requested scopes, **overwriting** the previously correct scopes and breaking calendar functionality.

---

## Why Connection Test Passes But Tools Fail

The connection test (`/api/integrations/connections/{id}/test`) only validates that an OAuth token exists:

```typescript
const connected = Boolean(
    credentials.accessToken || credentials.refreshToken || credentials.oauthToken
);
return { success: connected, connected };
```

It does NOT validate that the token has the required scopes. This creates a false positive: test passes with `calendar.readonly` scope, but tools require `calendar.events` scope.

---

## Fix Plan (2 Files, ~25 Lines)

### Fix 1: SetupWizard (apps/agent/src/components/integrations/SetupWizard.tsx)

Replace hardcoded scope array with import from single source of truth:

```typescript
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";

const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [...GOOGLE_OAUTH_SCOPES],  // ✅ Was: [gmail.modify, gmail.send, calendar.readonly]
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

### Fix 2: Database Seed (packages/agentc2/src/mcp/client.ts)

Update Gmail provider config to include all Google scopes:

```typescript
configJson: {
    requiredScopes: [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar.events"
    ],
    oauthConfig: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/webmasters.readonly"
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    },
    // ... rest unchanged
}
```

### Post-Fix Actions

1. **Deploy code changes**
2. **Restart server** (triggers database seed update)
3. **Affected users must re-authorize**:
   - Navigate to Settings > Integrations > Gmail
   - Click "Disconnect" then "Connect"
   - Complete OAuth flow
4. **Verify** calendar tools now work

---

## Optional Enhancements

### Add Scope Validation to Connection Test

Prevent false positives by validating scopes during connection test:

```typescript
// In /api/integrations/connections/[connectionId]/test
if (connection.provider.key === "gmail") {
    const scopeCheck = await checkGoogleScopes(gmailAddress, GOOGLE_REQUIRED_SCOPES);
    if (!scopeCheck.ok) {
        return {
            success: false,
            error: `Missing required scopes: ${scopeCheck.missing.join(", ")}`,
            scopeCheck
        };
    }
}
```

### Update Documentation

Update 6 documentation files that incorrectly reference `calendar.readonly`:
- Privacy policy page
- Security policy page
- GDPR/PIPEDA compliance audits
- Public docs
- Code comments

---

## Impact Assessment

| User Group | Before Fix | After Fix | Action Required |
|------------|------------|-----------|-----------------|
| New sign-ups | ✅ Working (uses auth.ts config) | ✅ Working | None |
| Existing connections (never re-authorized) | ✅ Working | ✅ Working | None |
| Users who re-authorized via Hub | ❌ Broken | ✅ Fixed after re-auth | Must re-authorize |
| Connection `cmls22ux9002r8e6o1m2n2u7x` | ❌ Broken | ✅ Fixed after re-auth | Must re-authorize |

---

## Timeline Estimate

- **Fix Implementation**: 10 minutes
- **Testing**: 20 minutes  
- **Deployment**: 5 minutes
- **User Re-Authorization**: 2 minutes per user
- **Verification**: 10 minutes
- **Total**: ~45-60 minutes from start to verified resolution

---

## Risk Assessment

**Risk Level**: Low  
**Why**: 
- Changes are localized to config values only
- No logic changes required
- Backward compatible (doesn't break existing working connections)
- Clear rollback path (git revert)
- Database seed update is idempotent

**Deployment Safety**:
- Can be deployed during business hours
- No downtime required
- Gradual rollout possible (fix deployed, users re-auth on their own schedule)

---

## Questions Answered

### Q: Why did this happen?

**A**: Historical scope configuration (`calendar.readonly`) was meant for data minimization but conflicts with actual tool requirements. The system evolved to need write access, but config wasn't updated.

### Q: Why didn't we catch this in testing?

**A**: 
1. Initial sign-ups work correctly (use `auth.ts` config)
2. Connection test doesn't validate scopes
3. Bug only manifests when users re-authorize via Integrations Hub

### Q: How many users are affected?

**A**: Run this query to count:
```sql
SELECT COUNT(DISTINCT ic."organizationId")
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ip.key = 'gmail'
AND ic."isActive" = true
AND ic.credentials::text LIKE '%calendar.readonly%'
AND ic.credentials::text NOT LIKE '%calendar.events%';
```

### Q: Can we fix existing connections without user re-authorization?

**A**: Partially. We can update the stored scope string in the database (migration script), but the actual OAuth token from Google still only has `calendar.readonly` permission. Users must complete a full re-authorization flow to grant `calendar.events` to Google.

### Q: Why not use calendar.readonly for read operations?

**A**: 
1. Agents need create/update/delete capabilities for scheduling
2. Having different scopes for read vs write tools adds complexity
3. Users expect agents to manage calendar, not just view it
4. Prevents future "upgrade permission" issues

---

## Related Issues

- Original RCA document: `/workspace/RCA-google-calendar-scope-missing.md` (full technical details)
- Related issue #158: Gmail/Calendar/Drive connection failure (different root cause - timing issue with deferred org creation)

---

## Approval Checklist

Before implementing:

- [ ] Review full RCA document (`RCA-google-calendar-scope-missing.md`)
- [ ] Confirm scope change acceptable (calendar.readonly → calendar.events)
- [ ] Verify Google Cloud Console has calendar.events scope approved
- [ ] Approve documentation updates (privacy/security pages)
- [ ] Decide on scope validation enhancement (Phase 3)
- [ ] Plan user communication for affected users

---

**RCA Author**: Cloud Agent (Cursor)  
**Date**: 2026-03-12  
**Review Status**: Awaiting approval for implementation

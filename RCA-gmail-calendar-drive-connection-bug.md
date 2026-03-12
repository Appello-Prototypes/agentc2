# Root Cause Analysis: Gmail, Google Calendar, Google Drive Integration Connection Failure

**Issue:** [#158](https://github.com/Appello-Prototypes/agentc2/issues/158)  
**Reporter:** sdlc-test@agentc2.ai (Flywheel Demo instance)  
**Date:** 2026-03-12  
**Severity:** High - Prevents users from connecting critical Google integrations

---

## Executive Summary

Gmail, Google Calendar, and Google Drive integrations fail to persist as connected integrations when users attempt to connect them directly from the Integrations page. The OAuth authentication flow completes successfully, but the credentials are never saved to the database, resulting in the integration appearing as "not connected" after the user returns from Google's authorization page.

**Root Cause:** Google Calendar and Google Drive are missing the `syncEndpoint` configuration in their OAuth config, causing the post-OAuth credential sync to be skipped entirely.

**Impact:** Users cannot connect Google Calendar or Google Drive independently. They only work if Gmail is connected first, which then automatically provisions the sibling connections.

---

## Detailed Analysis

### 1. Expected Flow

When a user clicks "Connect" on a Google integration (Gmail, Google Calendar, or Google Drive), the expected flow is:

1. **User initiates connection** → Clicks "Connect" button on the integration
2. **OAuth redirect** → User is redirected to Google OAuth consent screen via Better Auth's `linkSocial()`
3. **User grants permission** → User authorizes the requested scopes
4. **OAuth callback** → Google redirects back with authorization code
5. **Better Auth processes callback** → Authorization code exchanged for access/refresh tokens
6. **Tokens stored in Account table** → Better Auth stores tokens in `account` table with `providerId: "google"`
7. **Credential sync triggered** → POST request to `syncEndpoint` to copy tokens from `account` table to `integration_connection` table
8. **Integration marked as connected** → IntegrationConnection record created with encrypted credentials
9. **Success screen shown** → User sees confirmation that integration is connected

### 2. Actual Flow (Broken for Google Calendar & Google Drive)

**Steps 1-6** work correctly for all three integrations.

**Step 7** fails for Google Calendar and Google Drive:

**File:** `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines:** 1102-1154

```typescript
// Post-OAuth return: detect oauth_return param, trigger sync, and show result
useEffect(() => {
    if (oauthReturnHandled.current) return;
    if (!provider) return;
    if (searchParams.get("oauth_return") !== "1") return;

    const oauthCfg = getOAuthConfig(provider);
    if (!oauthCfg?.syncEndpoint) return;  // ⚠️ EXITS EARLY HERE FOR GOOGLE CALENDAR & DRIVE
    
    // ... rest of sync logic never executes
}, [provider, searchParams, apiBase]);
```

**The bug:** Line 1108 exits early if there's no `syncEndpoint` in the OAuth config. For Google Calendar and Google Drive, this value is `undefined`.

### 3. Provider Configuration Analysis

**File:** `packages/agentc2/src/mcp/client.ts`

#### Gmail Configuration (Lines 588-621) ✅ Works

```typescript
{
    key: "gmail",
    name: "Gmail",
    authType: "oauth",
    providerType: "oauth",
    configJson: {
        requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
        oauthConfig: {
            socialProvider: "google",
            scopes: ["https://www.googleapis.com/auth/gmail.modify"],
            statusEndpoint: "/api/integrations/gmail/status",   // ✅ Present
            syncEndpoint: "/api/integrations/gmail/sync"        // ✅ Present
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Open OAuth Setup"
    }
}
```

#### Google Calendar Configuration (Lines 622-639) ❌ Broken

```typescript
{
    key: "google-calendar",
    name: "Google Calendar",
    authType: "oauth",
    providerType: "oauth",
    configJson: {
        requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
        oauthConfig: {
            socialProvider: "google",
            scopes: ["https://www.googleapis.com/auth/calendar.events"],
            siblingOf: "gmail"   // ⚠️ Has sibling relationship but NO syncEndpoint
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Connect via Google Sign-In"
    }
}
```

#### Google Drive Configuration (Lines 640-663) ❌ Broken

```typescript
{
    key: "google-drive",
    name: "Google Drive",
    authType: "oauth",
    providerType: "oauth",
    configJson: {
        requiredScopes: [
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.file"
        ],
        oauthConfig: {
            socialProvider: "google",
            scopes: [
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/drive.file"
            ],
            siblingOf: "gmail"   // ⚠️ Has sibling relationship but NO syncEndpoint
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Connect via Google Sign-In"
    }
}
```

### 4. Why the Sibling Approach Exists

Google Calendar and Google Drive have `siblingOf: "gmail"` in their configuration, indicating they share OAuth credentials with Gmail (all use the same Google OAuth consent for the user's Google account).

**File:** `apps/agent/src/lib/gmail.ts`  
**Lines:** 174-323 - `syncSiblingGoogleConnections()` function

When Gmail is synced via `/api/integrations/gmail/sync`, it:
1. Saves Gmail credentials to `IntegrationConnection`
2. Calls `syncSiblingGoogleConnections()` which creates connections for Google Calendar, Google Drive, and Google Search Console
3. Auto-provisions skills and agents for each sibling

**The problem:** This only works if Gmail is connected FIRST. If a user tries to connect Google Calendar or Google Drive directly, the `siblingOf` relationship is never utilized, and no sync happens.

### 5. Missing Sync Endpoint

**The sync endpoint exists and works perfectly:**

**File:** `apps/agent/src/app/api/integrations/gmail/sync/route.ts`  
**Purpose:** Syncs Google OAuth tokens from Better Auth `account` table to `integration_connection` table

This endpoint:
- ✅ Reads the user's Google Account record from Better Auth
- ✅ Validates required scopes are present
- ✅ Fetches Gmail profile to get email address
- ✅ Encrypts and stores credentials in `integration_connection` table
- ✅ Calls `syncSiblingGoogleConnections()` to create Calendar/Drive connections

**The issue:** Google Calendar and Google Drive don't reference this endpoint in their configuration, so the SetupWizard never calls it.

### 6. Code Flow Trace

**Path taken when user connects Google Calendar:**

```
User clicks "Connect Google Calendar"
    ↓
SetupWizard component loads (SetupWizard.tsx)
    ↓
User proceeds through overview step
    ↓
handleNativeOAuth() called (line 1157)
    ↓
linkSocial({ provider: "google", scopes: [...], callbackURL: "..." })
    ↓
User redirected to Google OAuth
    ↓
User approves permissions
    ↓
Google redirects back with auth code
    ↓
Better Auth callback processes code → stores tokens in `account` table
    ↓
User redirected to /mcp/providers/google-calendar?oauth_return=1
    ↓
SetupWizard useEffect detects oauth_return=1 (line 1102)
    ↓
getOAuthConfig(provider) returns config WITHOUT syncEndpoint
    ↓
Line 1108: if (!oauthCfg?.syncEndpoint) return;  ⚠️ EXITS HERE
    ↓
No sync happens
    ↓
User sees "connecting" screen indefinitely or is stuck
    ↓
No IntegrationConnection created
    ↓
Integration shows as "not connected" in UI
```

### 7. Why It's Not Immediately Obvious

1. **OAuth succeeds** - Google OAuth flow completes successfully, tokens are stored in `account` table
2. **No error message** - The code silently exits early (line 1108), no error is thrown
3. **Works via sibling provisioning** - If Gmail is connected first, Calendar/Drive work fine
4. **Misleading UI** - The wizard may stay in "connecting" state without clear feedback

---

## Impact Assessment

### Affected Systems

1. **Integration Connections** - Cannot create standalone connections for Google Calendar or Google Drive
2. **Auto-Provisioning** - Skills and agents for Calendar/Drive are not provisioned unless Gmail is connected first
3. **User Experience** - Confusing behavior where OAuth succeeds but integration doesn't connect
4. **Tool Availability** - Google Calendar and Drive tools unavailable to agents

### Affected Users

- ✅ **Gmail first, then Calendar/Drive** - Works (siblings auto-provisioned)
- ❌ **Google Calendar first** - Fails to connect
- ❌ **Google Drive first** - Fails to connect
- ❌ **Calendar or Drive without Gmail** - Cannot connect independently

### Data Integrity

- **No data corruption** - Better Auth `account` table has valid tokens
- **Missing records** - `integration_connection` table missing entries for Calendar/Drive
- **No security risk** - Credentials are stored properly in `account` table, just not synced

---

## Root Cause

**Primary cause:** Google Calendar and Google Drive provider configurations are missing the `syncEndpoint` field in their `oauthConfig`, causing the post-OAuth credential sync to be skipped.

**Contributing factors:**
1. **SetupWizard architecture** - Assumes all OAuth providers have a sync endpoint
2. **Sibling relationship not utilized** - The `siblingOf` field exists but is only used by Gmail's sync, not recognized by SetupWizard
3. **No fallback logic** - No code to detect sibling relationships and use the sibling's sync endpoint
4. **Silent failure** - Early return with no error logging or user feedback

**Design assumption:** The system was designed expecting Gmail to be the "primary" Google integration, with Calendar/Drive as siblings that get provisioned automatically. Direct connection of siblings was not properly supported.

---

## Proof of Concept

### Test Case 1: Connect Google Calendar Directly

**Steps:**
1. Log in as fresh user with no existing Google integrations
2. Navigate to Integrations page
3. Click "Connect" on Google Calendar
4. Complete OAuth flow, approve permissions
5. Redirected back to app

**Expected Result:** Google Calendar shows as "connected"

**Actual Result:** Google Calendar shows as "not connected"

**Database State:**
```sql
-- account table HAS the Google OAuth tokens
SELECT * FROM account WHERE userId = '...' AND providerId = 'google';
-- Returns 1 row with accessToken, refreshToken, scope

-- integration_connection table MISSING Google Calendar connection
SELECT * FROM integration_connection ic
JOIN integration_provider ip ON ic.providerId = ip.id
WHERE ip.key = 'google-calendar' AND ic.organizationId = '...';
-- Returns 0 rows
```

### Test Case 2: Connect Gmail First, Then Calendar

**Steps:**
1. Connect Gmail (works as expected)
2. Observe that Google Calendar automatically shows as "connected"

**Result:** ✅ Works - `syncSiblingGoogleConnections()` creates Calendar connection

**Database State:**
```sql
-- Both gmail AND google-calendar have connections
SELECT ip.key, ic.name, ic.isActive
FROM integration_connection ic
JOIN integration_provider ip ON ic.providerId = ip.id
WHERE ip.key IN ('gmail', 'google-calendar')
AND ic.organizationId = '...';
-- Returns 2 rows
```

---

## Fix Plan

### Option 1: Add syncEndpoint to Google Calendar & Google Drive (Recommended) ⭐

**Complexity:** Low  
**Risk:** Low  
**Impact:** Complete fix

**Changes Required:**

**File:** `packages/agentc2/src/mcp/client.ts`

**For Google Calendar (line 631):**
```typescript
oauthConfig: {
    socialProvider: "google",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    siblingOf: "gmail",
    statusEndpoint: "/api/integrations/gmail/status",  // ADD
    syncEndpoint: "/api/integrations/gmail/sync"       // ADD
}
```

**For Google Drive (line 652):**
```typescript
oauthConfig: {
    socialProvider: "google",
    scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file"
    ],
    siblingOf: "gmail",
    statusEndpoint: "/api/integrations/gmail/status",  // ADD
    syncEndpoint: "/api/integrations/gmail/sync"       // ADD
}
```

**Why this works:**
- Gmail's `/api/integrations/gmail/sync` endpoint already handles all Google OAuth credentials
- It already calls `syncSiblingGoogleConnections()` to provision Calendar/Drive
- No new endpoint needed, just reference the existing one
- SetupWizard will call the sync endpoint after OAuth callback
- All three integrations become independently connectable

**Testing:**
1. Connect Google Calendar directly → Should work
2. Connect Google Drive directly → Should work
3. Connect Gmail first → Siblings should still auto-provision (existing behavior maintained)

---

### Option 2: Enhance SetupWizard to Recognize Sibling Relationships

**Complexity:** Medium  
**Risk:** Medium  
**Impact:** More robust solution but requires more changes

**Changes Required:**

**File:** `apps/agent/src/components/integrations/SetupWizard.tsx`

1. Detect `siblingOf` in OAuth config
2. If `syncEndpoint` is missing but `siblingOf` exists, look up the sibling provider
3. Use the sibling's `syncEndpoint` instead

```typescript
// Post-OAuth return: detect oauth_return param, trigger sync, and show result
useEffect(() => {
    if (oauthReturnHandled.current) return;
    if (!provider) return;
    if (searchParams.get("oauth_return") !== "1") return;

    const oauthCfg = getOAuthConfig(provider);
    let syncEndpoint = oauthCfg?.syncEndpoint;
    
    // NEW: Check for sibling relationship
    if (!syncEndpoint && oauthCfg?.siblingOf) {
        const siblingProvider = allProviders.find(p => p.key === oauthCfg.siblingOf);
        const siblingConfig = siblingProvider ? getOAuthConfig(siblingProvider) : null;
        syncEndpoint = siblingConfig?.syncEndpoint;
    }
    
    if (!syncEndpoint) return;
    
    // ... rest of sync logic
}, [provider, searchParams, apiBase, allProviders]);
```

**Pros:**
- More explicit about sibling relationships
- Future-proof for other sibling integrations

**Cons:**
- More complex logic
- Requires `allProviders` to be available in effect
- Additional provider lookup overhead

---

### Option 3: Create Separate Sync Endpoints

**Complexity:** Medium  
**Risk:** Low  
**Impact:** Clean separation but duplicates logic

**Changes Required:**

Create new API routes:
- `apps/agent/src/app/api/integrations/google-calendar/sync/route.ts`
- `apps/agent/src/app/api/integrations/google-drive/sync/route.ts`

Both would:
1. Import and call `syncGmailFromAccount()` from `@/lib/gmail-sync`
2. Return success/error response

**Pros:**
- Clean separation of concerns
- Each integration has its own endpoint

**Cons:**
- Code duplication (2 new files that are nearly identical)
- More maintenance burden
- Unnecessary complexity when Gmail sync already handles all Google services

---

## Recommended Fix: Option 1

**Rationale:**
1. **Minimal code change** - Only 4 lines added to configuration
2. **No new files** - Uses existing, tested sync endpoint
3. **Low risk** - Gmail sync already handles all Google OAuth credentials
4. **Maintains existing behavior** - Sibling auto-provisioning still works when Gmail is connected first
5. **Enables new behavior** - Calendar and Drive become independently connectable

**Implementation Steps:**
1. Update `packages/agentc2/src/mcp/client.ts` with sync/status endpoints for google-calendar and google-drive
2. Test connecting Google Calendar directly
3. Test connecting Google Drive directly
4. Verify Gmail connection still auto-provisions siblings
5. Verify all three integrations show correct connection status in UI

**Estimated Implementation Time:** 15 minutes  
**Estimated Testing Time:** 30 minutes  
**Total:** ~45 minutes

---

## Additional Observations

### Missing Error Feedback

**File:** `apps/agent/src/components/integrations/SetupWizard.tsx` (Line 1108)

The early return when `syncEndpoint` is missing is **silent** - no error is logged, no user feedback is shown. This makes debugging difficult.

**Recommendation:** Add console logging or error state:

```typescript
if (!oauthCfg?.syncEndpoint) {
    console.warn(
        `[SetupWizard] No syncEndpoint configured for ${provider.key}. ` +
        `OAuth completed but credentials will not be synced.`
    );
    setConnectError("Integration configuration error: no sync endpoint");
    setStep("error");
    return;
}
```

### Consistency with Microsoft OAuth

Microsoft OAuth integrations (Outlook Mail, Outlook Calendar) use a standalone OAuth flow with explicit `startEndpoint` and `callbackEndpoint`. They don't rely on Better Auth's `linkSocial()`.

**File:** `packages/agentc2/src/mcp/client.ts` (Lines 688-721)

```typescript
oauthConfig: {
    socialProvider: "microsoft",
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    statusEndpoint: "/api/integrations/microsoft/status",
    startEndpoint: "/api/integrations/microsoft/start",
    callbackEndpoint: "/api/integrations/microsoft/callback"
}
```

This approach doesn't have the sibling/sync issue because each integration manages its own OAuth flow end-to-end.

**For future Google integrations** (e.g., Google Search Console), ensure they either:
1. Have their own complete OAuth endpoints, OR
2. Reference Gmail's sync endpoint in their config

---

## Testing Checklist

### Pre-Fix Verification (Confirm Bug)
- [ ] Fresh user account with no Google integrations
- [ ] Attempt to connect Google Calendar directly
- [ ] Verify OAuth succeeds (tokens in `account` table)
- [ ] Verify connection NOT created (`integration_connection` table empty for google-calendar)
- [ ] Verify UI shows "not connected"

### Post-Fix Verification (Confirm Resolution)
- [ ] Connect Google Calendar directly → Shows "connected"
- [ ] Verify `integration_connection` record created
- [ ] Verify Gmail skill and agent auto-provisioned
- [ ] Connect Google Drive directly → Shows "connected"
- [ ] Verify `integration_connection` record created
- [ ] Verify Google Drive skill and agent auto-provisioned
- [ ] Connect Gmail → Verify siblings still auto-provision (backward compatibility)
- [ ] Check all three integrations show in Integrations Hub with correct status

### Edge Cases
- [ ] User who previously connected Gmail tries to connect Calendar → Should work (sibling already exists)
- [ ] User connects Calendar, then Gmail → Both should be connected (no duplicate connections)
- [ ] User revokes Google OAuth permissions → All three should show "needs_auth"
- [ ] User with expired Google tokens → Refresh token should work for all three

---

## Related Files

### Core Integration Configuration
- `packages/agentc2/src/mcp/client.ts` - Provider configuration (lines 588-663)

### OAuth & Sync Logic
- `apps/agent/src/lib/gmail.ts` - Gmail OAuth client, credential management (lines 1-595)
- `apps/agent/src/lib/gmail-sync.ts` - Sync logic from Account to IntegrationConnection (lines 1-164)
- `apps/agent/src/app/api/integrations/gmail/sync/route.ts` - Sync API endpoint (lines 1-137)

### UI Components
- `apps/agent/src/components/integrations/SetupWizard.tsx` - Integration setup wizard (lines 1-1642)

### Database Schema
- `packages/database/prisma/schema.prisma` - IntegrationProvider (lines 364-384), IntegrationConnection (lines 387-430)

### Integration Blueprints
- `packages/agentc2/src/integrations/blueprints/email.ts` - Gmail/Calendar/Drive blueprints (lines 1-257)

---

## Conclusion

The bug is a **configuration omission** rather than a logic error. The sync mechanism works perfectly when called, but Google Calendar and Google Drive configurations don't tell the SetupWizard to call it.

**Fix is simple:** Add `syncEndpoint: "/api/integrations/gmail/sync"` to the OAuth config for both google-calendar and google-drive providers.

**Impact of fix:**
- ✅ Users can connect Google Calendar independently
- ✅ Users can connect Google Drive independently
- ✅ All Google integrations work whether connected individually or via Gmail first
- ✅ No breaking changes to existing behavior
- ✅ No new code files needed

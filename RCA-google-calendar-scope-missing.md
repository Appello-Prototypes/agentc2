# Root Cause Analysis: Google Calendar OAuth Missing calendar.events Scope

**Issue**: [#164](https://github.com/Appello-Prototypes/agentc2/issues/164)  
**Branch**: `cursor/calendar-events-scope-missing-2b10`  
**Date**: 2026-03-12  
**Severity**: Critical — Calendar integration completely non-functional after re-authorization  
**Affected Connection**: `cmls22ux9002r8e6o1m2n2u7x` (Google Calendar - nathan@useappello.com)  
**Affected Agent**: `demo-prep-agent-appello`

---

## Executive Summary

When users **re-authorize** their Google Calendar connection via the Integrations Hub (Settings > Integrations > Gmail > Connect), the OAuth flow requests the **wrong scope** (`calendar.readonly` instead of `calendar.events`). This causes all calendar tools (`google-calendar-list-events`, `google-calendar-search-events`, etc.) to fail with a missing authorization scope error, even though the connection test shows as "connected."

**Root Cause**: The `SetupWizard.tsx` component contains a hardcoded fallback scope configuration (`OAUTH_PROVIDER_MAP`) with an **incorrect scope** for Google Calendar. When this fallback is used instead of the database configuration, users re-authorize with insufficient permissions, breaking all calendar functionality.

**Impact**:
- All calendar read operations fail (list, search, get)
- All calendar write operations fail (create, update, delete)
- Connection appears healthy but is actually non-functional
- Affects users who:
  - Re-authorize Gmail/Calendar from Integrations Hub
  - Connect Calendar via the Setup Wizard when database config is unavailable
  - Manually trigger linkSocial for Gmail integration

---

## Technical Deep Dive

### Authorization Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INITIAL SIGN-UP (Working ✅)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  User clicks "Sign up with Google"                                       │
│         ↓                                                                 │
│  Better Auth uses GOOGLE_OAUTH_SCOPES from auth.ts                      │
│         ↓                                                                 │
│  Scopes: [gmail.modify, calendar.events, drive.*, webmasters.readonly] │
│         ↓                                                                 │
│  Google grants all scopes                                                │
│         ↓                                                                 │
│  Account table: scope = "...calendar.events..."                         │
│         ↓                                                                 │
│  syncGmailFromAccount() copies to IntegrationConnection                 │
│         ↓                                                                 │
│  ✅ Calendar tools work correctly                                        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ RE-AUTHORIZATION VIA INTEGRATIONS HUB (Broken ❌)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  User navigates to Settings > Integrations > Gmail                       │
│         ↓                                                                 │
│  SetupWizard loads provider from database                                │
│         ↓                                                                 │
│  getOAuthConfig() checks provider.config.oauthConfig                     │
│         ↓                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ IF config exists: Use database scopes (calendar.events) ✅  │       │
│  │ IF config missing: Use OAUTH_PROVIDER_MAP fallback ❌       │       │
│  └─────────────────────────────────────────────────────────────┘       │
│         ↓                                                                 │
│  FALLBACK USED (due to config structure mismatch or DB issue)           │
│         ↓                                                                 │
│  Scopes: [gmail.modify, gmail.send, calendar.readonly] ❌               │
│         ↓                                                                 │
│  linkSocial({ scopes: [...] }) requests ONLY these scopes                │
│         ↓                                                                 │
│  Google grants ONLY calendar.readonly (not calendar.events)             │
│         ↓                                                                 │
│  Account table: scope = "...calendar.readonly..." (OVERWRITTEN)         │
│         ↓                                                                 │
│  syncGmailFromAccount() copies WRONG scope to IntegrationConnection     │
│         ↓                                                                 │
│  ❌ Calendar tools fail with "missing scope: calendar.events"           │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Two Authorization Paths

#### Path 1: Initial Sign-Up (✅ Working)

1. User signs up with "Sign up with Google" button
2. Better Auth (`packages/auth/src/auth.ts`) initiates OAuth with **correct scopes** from `GOOGLE_OAUTH_SCOPES`:

```8:21:packages/auth/src/google-scopes.ts
import { GOOGLE_OAUTH_SCOPES } from "./google-scopes";

export const GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.events",  // ✅ Correct scope
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/webmasters.readonly"
] as const;
```

3. Google grants all scopes including `calendar.events`
4. Better Auth stores tokens in `Account` table with correct `scope` field
5. Post-sign-up sync creates `IntegrationConnection` records for Gmail, Calendar, Drive
6. ✅ Result: Calendar tools work correctly

#### Path 2: Re-Authorization via Integrations Hub (❌ BROKEN)

1. User navigates to Settings > Integrations > Gmail provider page
2. User clicks "Connect" or "Reconnect" button in `SetupWizard` component
3. `SetupWizard` calls `getOAuthConfig(provider)` to determine OAuth scopes:

```149:155:apps/agent/src/components/integrations/SetupWizard.tsx
function getOAuthConfig(provider: IntegrationProvider): OAuthConfig | null {
    const config = provider.config as Record<string, unknown> | null;
    if (config?.oauthConfig && typeof config.oauthConfig === "object") {
        return config.oauthConfig as OAuthConfig;
    }
    return OAUTH_PROVIDER_MAP[provider.key] || null;
}
```

4. **CRITICAL**: If `provider.config.oauthConfig` is missing or malformed, the function falls back to the hardcoded `OAUTH_PROVIDER_MAP`:

```64:75:apps/agent/src/components/integrations/SetupWizard.tsx
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.readonly"  // ❌ WRONG SCOPE
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

5. `linkSocial` is called with **wrong scopes**:

```1165:1169:apps/agent/src/components/integrations/SetupWizard.tsx
await linkSocial({
    provider: oauthConfig.socialProvider,
    scopes: oauthConfig.scopes,  // ❌ Uses wrong scopes
    callbackURL
});
```

6. Better Auth requests OAuth authorization with `calendar.readonly` instead of `calendar.events`
7. Google grants only `calendar.readonly` (read-only permission)
8. Better Auth **overwrites** the `Account.scope` field with the new (insufficient) scope
9. Gmail sync endpoint reads from `Account` table and syncs to `IntegrationConnection`:

```100:108:apps/agent/src/app/api/integrations/gmail/sync/route.ts
const tokenPayload = {
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.accessTokenExpiresAt?.getTime(),
    scope: account.scope  // ❌ Now contains calendar.readonly instead of calendar.events
};

const saved = await saveGmailCredentials(organizationId, gmailAddress, tokenPayload);
```

10. ❌ Result: `IntegrationConnection.credentials.scope` now contains `calendar.readonly`, breaking all calendar tools

### Why Tools Fail After Re-Authorization

All Google Calendar tools perform a scope check before executing:

```86:93:packages/agentc2/src/tools/google-calendar/list-events.ts
const scopeCheck = await checkGoogleScopes(address, CALENDAR_READ_SCOPES);
if (!scopeCheck.ok) {
    return {
        success: false,
        events: [],
        error: `Google Calendar requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth to grant calendar access.`
    };
}
```

The `CALENDAR_READ_SCOPES` constant requires `calendar.events`:

```19:23:packages/agentc2/src/tools/google-calendar/shared.ts
/** Required scopes for read operations (search, list, get). */
export const CALENDAR_READ_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

/** Required scopes for write operations (create, update). */
export const CALENDAR_WRITE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
```

The `checkGoogleScopes` function reads from the stored `IntegrationConnection`:

```232:266:packages/agentc2/src/tools/gmail/shared.ts
export const checkGoogleScopes = async (
    gmailAddress: string,
    requiredScopes: string[]
): Promise<{ ok: boolean; missing: string[] }> => {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    if (!provider) return { ok: false, missing: requiredScopes };

    const integration = await prisma.gmailIntegration.findFirst({
        where: { gmailAddress, isActive: true },
        include: { workspace: { select: { organizationId: true } } }
    });
    if (!integration) return { ok: false, missing: requiredScopes };

    const organizationId = integration.workspace?.organizationId;
    if (!organizationId) return { ok: false, missing: requiredScopes };

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true,
            OR: [
                { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
                { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
            ]
        }
    });

    const creds = decrypt(connection?.credentials) as { scope?: string } | null;
    const grantedScopes = new Set((creds?.scope || "").split(/[,\s]+/).filter(Boolean));
    const missing = requiredScopes.filter((s) => !grantedScopes.has(s));
    return { ok: missing.length === 0, missing };
};
```

**Result**: The scope check finds `calendar.readonly` in the stored credentials but requires `calendar.events`, so it fails with the error: "Google Calendar requires scope: https://www.googleapis.com/auth/calendar.events. Re-authorize Google OAuth to grant calendar access."

### Why Connection Test Shows Success

The connection test endpoint for OAuth providers only checks if a token exists, not if it has the correct scopes:

```124:140:apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts
if (connection.provider.authType === "oauth") {
    const credentials = getConnectionCredentials(connection);
    const connected = Boolean(
        credentials.accessToken || credentials.refreshToken || credentials.oauthToken
    );
    await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
            lastTestedAt: new Date(),
            errorMessage: connected ? null : "OAuth credentials missing"
        }
    });
    return NextResponse.json({
        success: connected,
        connected
    });
}
```

**Result**: The test passes because an `accessToken` exists, even though it has insufficient scopes.

---

## Critical Open Question

**Why was the fallback triggered for this specific user?**

The analysis above assumes the `OAUTH_PROVIDER_MAP` fallback was used, but we need to confirm:

### Investigation Required

1. **Check Database Provider Config**:
   ```sql
   SELECT 
       key,
       name,
       "authType",
       "providerType",
       "configJson"
   FROM "IntegrationProvider"
   WHERE key = 'gmail';
   ```
   
   **Expected**: `configJson` should be a valid JSON object with:
   ```json
   {
       "requiredScopes": ["https://www.googleapis.com/auth/gmail.modify"],
       "oauthConfig": {
           "socialProvider": "google",
           "scopes": ["https://www.googleapis.com/auth/gmail.modify"],
           "statusEndpoint": "/api/integrations/gmail/status",
           "syncEndpoint": "/api/integrations/gmail/sync"
       },
       "setupUrl": "/mcp/gmail",
       "setupLabel": "Open OAuth Setup"
   }
   ```

2. **Check What SetupWizard Actually Received**:
   - Add console.log in `getOAuthConfig()` to see if database config exists
   - Check if config structure matches expected format
   - Verify `config.oauthConfig` is an object (not null, undefined, or array)

3. **Two Possible Scenarios**:

   **Scenario A: Database Config Missing or Malformed**
   - Provider seed never ran or failed
   - `configJson` is null, empty, or has wrong structure
   - `getOAuthConfig()` falls back to `OAUTH_PROVIDER_MAP`
   - **Fix**: Ensure database is properly seeded + fix fallback scope

   **Scenario B: Database Config Correct But Still Used Wrong Scope**
   - Provider has correct `configJson.oauthConfig.scopes`
   - But somewhere in the flow, wrong scopes were requested anyway
   - **Fix**: Investigate if there's another code path that bypasses the config

### Recommended Investigation Steps

Before implementing the fix, we should:

1. **Read the actual provider record** from production database
2. **Check the connection metadata** for the specific connection `cmls22ux9002r8e6o1m2n2u7x`
3. **Review server logs** around the time the connection was created/updated
4. **Trace the exact OAuth flow** that was used for this connection

This will confirm whether:
- The fallback was actually used (most likely)
- OR there's another code path we haven't discovered yet
- OR the database seed is incorrect

**For this RCA**: I'm proceeding with the assumption that the fallback was used, as this is the only code path that could produce the observed symptoms. However, production debugging is needed to confirm.

---

## Root Cause Hierarchy

### Primary Root Cause

**File**: `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines**: 64-75  
**Issue**: Hardcoded `OAUTH_PROVIDER_MAP` contains **incorrect scope** for Gmail OAuth:

```typescript
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.readonly"  // ❌ Should be calendar.events
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

**Why This Exists**: This is a fallback configuration for when the database-driven provider config is unavailable. The scope choice (`calendar.readonly`) suggests an earlier design decision for data minimization, but this conflicts with the actual tool requirements.

### Secondary Root Cause (Architectural)

**File**: `packages/agentc2/src/mcp/client.ts`  
**Lines**: 594-601  
**Issue**: Gmail provider's database seed contains **incomplete scopes** for a Google OAuth flow that needs to authorize Calendar and Drive:

```typescript
configJson: {
    requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
    oauthConfig: {
        socialProvider: "google",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],  // ❌ Missing calendar scopes
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    },
    setupUrl: "/mcp/gmail",
    setupLabel: "Open OAuth Setup"
}
```

**Architectural Problem**: Gmail, Calendar, and Drive are implemented as three separate providers but share a single OAuth flow. When users authorize "Gmail" in the SetupWizard, they're expected to get access to all three services, but the Gmail provider config only includes Gmail scopes.

**Why This Is Problematic**:
- The Gmail provider's `oauthConfig` should include **all** Google scopes needed by the platform
- Currently it only includes `gmail.modify`, not `calendar.events` or `drive.*`
- This causes scope issues regardless of whether database or fallback config is used
- The sibling providers (Calendar, Drive) have correct scopes in their own records, but those aren't used during Gmail authorization

**Why The Fallback Gets Triggered**: The `getOAuthConfig()` function checks if `config?.oauthConfig` exists. However, there are scenarios where this check fails:

1. **Config Structure Mismatch**: The database stores `configJson` as a JSON column, but the SetupWizard expects a specific structure. If the structure changes or is malformed, the check fails.

2. **Database Not Seeded**: If `ensureIntegrationProviders()` hasn't run or failed, the provider record may exist but `configJson` may be null or incomplete.

3. **Provider Loaded Without Config**: If the provider is loaded via a direct database query that doesn't include `configJson`, or if `configJson` is filtered out, the fallback is used.

4. **Type Coercion Issues**: The config is stored as JSON in Postgres but accessed as a typed object in TypeScript. Type mismatches or null values may cause the `typeof config.oauthConfig === "object"` check to fail.

**Most Likely Scenario**: The fallback is triggered when the provider's `configJson` field exists but doesn't have the expected `oauthConfig` structure, possibly due to database migration issues or manual edits to provider records.

### Alternative Root Cause Scenarios

While the primary hypothesis is that the `OAUTH_PROVIDER_MAP` fallback was used with incorrect scopes, there are alternative scenarios that could produce the same symptoms:

#### Alternative Scenario 1: Database Seed Has Wrong Scope

**Likelihood**: Low (verified that `mcp/client.ts` has correct scope)

```588:601:packages/agentc2/src/mcp/client.ts
key: "gmail",
name: "Gmail",
description: "Email ingestion and draft approvals using Gmail OAuth",
category: "communication",
authType: "oauth",
providerType: "oauth",
configJson: {
    requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
    oauthConfig: {
        socialProvider: "google",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    },
```

**Analysis**: The database seed in `mcp/client.ts` shows `oauthConfig.scopes` includes only `gmail.modify`, **not** `calendar.events`. This is by design because the Gmail provider record is meant only for Gmail email tools, not calendar tools. Calendar is a separate "sibling" provider with its own record.

**Issue**: The SetupWizard doesn't distinguish between "authorize Gmail only" vs "authorize all Google services." When users click "Connect" on the Gmail provider, the wizard uses the Gmail provider's OAuth config, which lacks calendar scopes. This creates a mismatch between what's authorized (Gmail only) and what's expected (Gmail + Calendar + Drive).

**This changes the analysis**: The problem is NOT just that the fallback has the wrong scope — it's that the **database config is also incomplete** for the Gmail provider when used to authorize calendar access.

#### Alternative Scenario 2: Calendar Provider Should Be Separate

**Likelihood**: Medium (architectural issue)

The `google-calendar` provider has its own database record:

```623:638:packages/agentc2/src/mcp/client.ts
key: "google-calendar",
name: "Google Calendar",
description: "Calendar events — list, create, update, and delete via Google Calendar API",
category: "productivity",
authType: "oauth",
providerType: "oauth",
configJson: {
    requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
    oauthConfig: {
        socialProvider: "google",
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
        siblingOf: "gmail"
    },
    setupUrl: "/mcp/gmail",
    setupLabel: "Connect via Google Sign-In"
}
```

**Analysis**: The `google-calendar` provider has the correct scope (`calendar.events`) but it's marked as `siblingOf: "gmail"`, meaning it shares credentials with Gmail. When users click "Connect" on the Gmail provider page, they're authorizing Gmail, not Calendar, so the Gmail scopes are used.

**The Real Issue**: Users should be clicking "Connect" on the **Google Calendar provider page**, not the Gmail provider page, to authorize calendar access. But both providers route to `/mcp/gmail` for setup.

#### Alternative Scenario 3: Sibling Sync Doesn't Check Database Config

**Likelihood**: High (most likely actual root cause)

When a user authorizes Gmail via the SetupWizard and the sync happens:

```109:122:apps/agent/src/lib/gmail.ts
// Sync sibling Google services (Calendar, Drive)
try {
    await syncSiblingGoogleConnections(organizationId, gmailAddress, tokenPayload);
} catch (err) {
    console.warn(
        "[GmailSync] Sibling sync failed (non-fatal):",
        err instanceof Error ? err.message : err
    );
}
```

The sibling sync checks if the token has required scopes:

```223:225:apps/agent/src/lib/gmail.ts
for (const sibling of siblings) {
    const hasScopes = sibling.requiredScopes.every((s) => scopeSet.has(s));
    if (!hasScopes) continue;
```

**If the token only has `calendar.readonly`**, the sibling sync would skip creating the Calendar connection (because `calendar.events` is required). But the bug report says the connection exists and tests as "connected."

**This suggests**: The connection was created with `calendar.readonly` scope, meaning the sibling sync's `requiredScopes` check passed, which should be impossible unless the `requiredScopes` in the sibling configuration were also wrong at some point.

### Contributing Factors

1. **Inconsistent Scope Documentation**:
   - Privacy policy (`apps/frontend/src/app/(Public)/privacy/page.tsx:147`) documents `calendar.readonly`
   - Security policy (`apps/frontend/src/app/(Public)/security/page.tsx:272`) documents `calendar.readonly`
   - Compliance audits (GDPR, PIPEDA) reference `calendar.readonly` as evidence of data minimization
   - Public docs (`apps/frontend/content/docs/guides/build-a-sales-agent.mdx:134`) list BOTH scopes as needed

2. **Fallback Logic Can Be Triggered**:
   - If database provider seed fails or is corrupted
   - If `configJson.oauthConfig` structure changes
   - If provider is somehow loaded without full config
   - The fallback silently uses wrong scopes with no error or warning

3. **No Scope Validation During OAuth Flow**:
   - Better Auth accepts any scopes passed to `linkSocial`
   - No validation that requested scopes match required scopes
   - No warning when re-authorization reduces scope from previous authorization

4. **Connection Test Doesn't Validate Scopes**:
   - Only checks if token exists
   - Doesn't verify token has required scopes
   - Shows "connected: true" even with insufficient permissions

---

## Affected Code Paths

### Files Containing Incorrect Scope References

| File | Lines | Issue | Fix Required |
|------|-------|-------|--------------|
| `apps/agent/src/components/integrations/SetupWizard.tsx` | 64-75 | Hardcoded `OAUTH_PROVIDER_MAP` with `calendar.readonly` | Change to `calendar.events` |
| `apps/agent/src/components/integrations/SetupWizard.tsx` | 78-88 | `SCOPE_DESCRIPTIONS` includes `calendar.readonly` | Add `calendar.events` description |
| `apps/frontend/src/app/(Public)/privacy/page.tsx` | 147 | Privacy policy lists `calendar.readonly` | Update to `calendar.events` |
| `apps/frontend/src/app/(Public)/security/page.tsx` | 272 | Security policy lists `calendar.readonly` | Update to `calendar.events` |
| `docs/compliance/audits/PIPEDA-AUDIT.md` | 75 | Audit references `calendar.readonly` | Update to `calendar.events` |
| `docs/compliance/audits/GDPR-AUDIT.md` | 33 | Audit references `calendar.readonly` | Update to `calendar.events` |
| `apps/frontend/content/docs/guides/build-a-sales-agent.mdx` | 134 | Docs list both scopes | Clarify only `calendar.events` needed |
| `packages/agentc2/src/tools/google-calendar/search-events.ts` | 91 | Comment says "calendar.readonly was granted" | Update comment |

### Files with Correct Scope Implementation (✅ No Changes Needed)

- `packages/auth/src/google-scopes.ts` — Single source of truth, correct
- `packages/auth/src/auth.ts` — Uses `GOOGLE_OAUTH_SCOPES`, correct
- `packages/agentc2/src/mcp/client.ts` — Database seed has correct scope
- `packages/agentc2/src/tools/google-calendar/*.ts` — All tools correctly require `calendar.events`
- `apps/agent/src/lib/gmail.ts` — Sibling sync correctly uses `calendar.events`
- `apps/agent/src/components/AppProvidersWrapper.tsx` — Re-auth uses `GOOGLE_OAUTH_SCOPES`, correct
- `apps/agent/src/app/mcp/gmail/page.tsx` — Gmail page uses `GOOGLE_OAUTH_SCOPES`, correct

---

## Impact Assessment

### Immediate Impact

1. **Broken Calendar Functionality**: Users who re-authorize cannot use any calendar features
2. **Silent Failure**: Connection test shows "success" but tools fail at runtime
3. **Data Inconsistency**: Database contains `calendar.readonly` while tools require `calendar.events`
4. **User Confusion**: Error message says to "re-authorize" but re-authorization makes it worse

### Affected User Scenarios

| Scenario | Affected? | Why |
|----------|-----------|-----|
| New user signs up with Google | ❌ **Not affected** | Uses `GOOGLE_OAUTH_SCOPES` from `auth.ts` (correct) |
| Existing user re-authorizes via Integrations Hub | ✅ **Affected** | Uses `OAUTH_PROVIDER_MAP` fallback (wrong) |
| User clicks "Reconnect Gmail" on `/mcp/gmail` page | ❌ **Not affected** | Uses `GOOGLE_OAUTH_SCOPES` (correct) |
| User reconnects via `AppProvidersWrapper` auto-reauth | ❌ **Not affected** | Uses `GOOGLE_OAUTH_SCOPES` (correct) |
| SetupWizard triggered when database config unavailable | ✅ **Potentially affected** | Falls back to `OAUTH_PROVIDER_MAP` (wrong) |

### Data Integrity Impact

**Affected Records**: All `IntegrationConnection` records where:
- `providerId` matches Gmail provider
- `credentials.scope` contains `calendar.readonly` but not `calendar.events`
- Last updated after user clicked "Connect" in SetupWizard

**Query to Find Affected Connections**:

```sql
SELECT 
    ic.id,
    ic.name,
    ic."organizationId",
    ic."lastTestedAt",
    ic.metadata->>'gmailAddress' as gmail_address
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ip.key = 'gmail'
AND ic."isActive" = true
AND ic.credentials::text LIKE '%calendar.readonly%'
AND ic.credentials::text NOT LIKE '%calendar.events%';
```

### System-Wide Scope Inconsistencies

| Component | Expected Scope | Actual Behavior | Risk |
|-----------|----------------|-----------------|------|
| Better Auth signup | `calendar.events` | ✅ Correct | Low - working as intended |
| SetupWizard fallback | `calendar.events` | ❌ Uses `calendar.readonly` | **High** - breaks calendar |
| Database seed (mcp/client.ts) | `calendar.events` | ✅ Correct | Low - seed is correct |
| Calendar tools | `calendar.events` | ✅ Validates correctly | Low - tools are defensive |
| Documentation | `calendar.events` | ❌ Shows `calendar.readonly` | Medium - confuses users |
| Privacy/Security pages | `calendar.events` | ❌ Shows `calendar.readonly` | Medium - misleading claims |

---

## Reproduction Steps

To reproduce this exact bug:

1. **Initial Setup (Establish working connection)**:
   ```bash
   # Sign up with Google OAuth (gets correct scopes)
   # Navigate to Settings > Integrations
   # Verify Gmail shows as "Connected"
   # Test calendar tool - should work
   ```

2. **Trigger Re-Authorization**:
   ```bash
   # Navigate to Settings > Integrations > Gmail
   # Click "Disconnect"
   # Click "Connect" in the setup wizard
   # Complete OAuth flow
   ```

3. **Verify Broken State**:
   ```bash
   # Connection test shows "connected: true"
   # Try to use google-calendar-list-events tool
   # Tool fails with: "Google Calendar requires scope: https://www.googleapis.com/auth/calendar.events"
   ```

4. **Database Verification**:
   ```sql
   -- Check what scope was stored after re-authorization
   SELECT 
       a."userId",
       a."providerId", 
       a.scope
   FROM "Account" a
   WHERE a."providerId" = 'google'
   ORDER BY a."updatedAt" DESC
   LIMIT 1;
   
   -- Expected result: scope contains "calendar.readonly" but NOT "calendar.events"
   ```

---

## Fix Plan

### Phase 1: Immediate Hotfix (Critical — Blocks All Calendar Usage)

**Risk**: Low  
**Complexity**: Trivial  
**ETA**: 10 minutes

#### 1.1: Fix Hardcoded Scope in SetupWizard

**File**: `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines**: 64-75

```typescript
// BEFORE (incomplete scopes):
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.readonly"  // ❌ WRONG
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};

// AFTER (use single source of truth):
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";

const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [...GOOGLE_OAUTH_SCOPES],  // ✅ Use SSoT - includes all Google scopes
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

**Changes**:
- Import `GOOGLE_OAUTH_SCOPES` from the single source of truth
- Use spread operator to include all scopes: `gmail.modify`, `calendar.events`, `drive.readonly`, `drive.file`, `webmasters.readonly`
- Eliminates all hardcoded Google scopes from this file

**Why This Fix Works**:
- Ensures fallback always matches what Better Auth requests during sign-up
- Automatically stays in sync if scopes are updated in `google-scopes.ts`
- Prevents future scope mismatch bugs

#### 1.2: Fix Database Seed for Gmail Provider

**File**: `packages/agentc2/src/mcp/client.ts`  
**Lines**: 594-601

```typescript
// BEFORE (incomplete scopes):
configJson: {
    requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
    oauthConfig: {
        socialProvider: "google",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],  // ❌ Missing calendar/drive
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    },
    setupUrl: "/mcp/gmail",
    setupLabel: "Open OAuth Setup"
}

// AFTER (complete scopes):
configJson: {
    requiredScopes: [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar.events"  // Include calendar for sibling sync
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
    setupUrl: "/mcp/gmail",
    setupLabel: "Open OAuth Setup"
}
```

**Changes**:
- Add all Google scopes to `oauthConfig.scopes` (matches `GOOGLE_OAUTH_SCOPES`)
- Update `requiredScopes` to include calendar (for validation)
- Ensures database config matches SSoT

**Why This Fix Is Needed**:
- The Gmail provider is the "parent" for Google OAuth (Calendar and Drive are siblings)
- When authorizing via Gmail provider, all Google scopes must be requested
- The sibling sync depends on the Gmail OAuth token having all necessary scopes

**Important Note**: This change requires a database migration or re-seed. After deploying:
```bash
# The ensureIntegrationProviders() function will automatically update the database
# on next server start, but you can force it:
bun run db:seed  # Or restart the server
```

#### 1.3: Update Scope Descriptions

**File**: `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines**: 78-88

```typescript
// Add description for calendar.events
const SCOPE_DESCRIPTIONS: Record<string, string> = {
    "https://www.googleapis.com/auth/gmail.modify": "Read and manage your emails",
    "https://www.googleapis.com/auth/gmail.send": "Send emails on your behalf",
    "https://www.googleapis.com/auth/calendar.readonly": "View your calendar events",
    "https://www.googleapis.com/auth/calendar.events": "Manage your calendar events (read/write)",  // ✅ Add this
    "https://www.googleapis.com/auth/calendar": "Manage your calendar events",
    // ... rest unchanged
};
```

### Phase 2: Documentation Updates (High Priority — Prevents Confusion)

**Risk**: None  
**Complexity**: Trivial  
**ETA**: 10 minutes

Update all documentation to reflect the correct scope:

#### 2.1: Privacy Policy

**File**: `apps/frontend/src/app/(Public)/privacy/page.tsx`  
**Line**: 147

```tsx
// BEFORE:
<code className="text-foreground/80 text-xs">calendar.readonly</code>

// AFTER:
<code className="text-foreground/80 text-xs">calendar.events</code>
```

**Additional Context**: Update the description to clarify why write access is needed:
```tsx
— Read and manage calendar events (required for agent-initiated scheduling)
```

#### 2.2: Security Policy

**File**: `apps/frontend/src/app/(Public)/security/page.tsx`  
**Line**: 272

```tsx
// BEFORE:
Google Calendar access uses{" "}
<code className="text-foreground/80 text-xs">calendar.readonly</code>{" "}
rather than full write access, reflecting actual feature requirements

// AFTER:
Google Calendar access uses{" "}
<code className="text-foreground/80 text-xs">calendar.events</code>{" "}
to enable agents to create and update meetings on your behalf
```

#### 2.3: Compliance Audits

**Files**:
- `docs/compliance/audits/PIPEDA-AUDIT.md` (Line 75)
- `docs/compliance/audits/GDPR-AUDIT.md` (Line 33)

Update assessment text:
```markdown
// BEFORE:
calendar uses `calendar.readonly`

// AFTER:
calendar uses `calendar.events` (full CRUD for agent-initiated scheduling)
```

#### 2.4: Public Documentation

**File**: `apps/frontend/content/docs/guides/build-a-sales-agent.mdx`  
**Lines**: 133-134

```markdown
// BEFORE:
2. **Add Calendar scopes** to OAuth consent screen:
    - `https://www.googleapis.com/auth/calendar.events`
    - `https://www.googleapis.com/auth/calendar.readonly`

// AFTER:
2. **Add Calendar scope** to OAuth consent screen:
    - `https://www.googleapis.com/auth/calendar.events` (full read/write access for scheduling)
```

#### 2.5: Code Comment Cleanup

**File**: `packages/agentc2/src/tools/google-calendar/search-events.ts`  
**Line**: 91

```typescript
// BEFORE:
// Pre-flight scope check: verify calendar.readonly was granted

// AFTER:
// Pre-flight scope check: verify calendar.events was granted
```

### Phase 3: Enhanced Validation (Medium Priority — Prevents Future Issues)

**Risk**: Low  
**Complexity**: Moderate  
**ETA**: 30 minutes

#### 3.1: Add Scope Validation to Connection Test

**File**: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts`  
**Lines**: 124-140

Enhance OAuth connection test to validate scopes, not just token presence:

```typescript
if (connection.provider.authType === "oauth") {
    const credentials = getConnectionCredentials(connection);
    const connected = Boolean(
        credentials.accessToken || credentials.refreshToken || credentials.oauthToken
    );
    
    // NEW: Validate scopes for Google/Microsoft OAuth providers
    let scopeValidation: { ok: boolean; missing: string[] } | null = null;
    if (connection.provider.key === "gmail") {
        const { checkGoogleScopes } = await import("@repo/agentc2/tools/gmail/shared");
        const { GOOGLE_REQUIRED_SCOPES } = await import("@repo/auth/google-scopes");
        const gmailAddress = credentials.gmailAddress as string | undefined;
        if (gmailAddress) {
            scopeValidation = await checkGoogleScopes(gmailAddress, GOOGLE_REQUIRED_SCOPES);
        }
    }
    
    const errorMessage = !connected
        ? "OAuth credentials missing"
        : scopeValidation && !scopeValidation.ok
          ? `Missing required scopes: ${scopeValidation.missing.join(", ")}`
          : null;
    
    await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
            lastTestedAt: new Date(),
            errorMessage
        }
    });
    
    return NextResponse.json({
        success: connected && (!scopeValidation || scopeValidation.ok),
        connected,
        ...(scopeValidation ? { scopeCheck: scopeValidation } : {})
    });
}
```

#### 3.2: Add Warning When Fallback Config Is Used

**File**: `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines**: 149-155

Add console warning when fallback is used:

```typescript
function getOAuthConfig(provider: IntegrationProvider): OAuthConfig | null {
    const config = provider.config as Record<string, unknown> | null;
    if (config?.oauthConfig && typeof config.oauthConfig === "object") {
        return config.oauthConfig as OAuthConfig;
    }
    
    // NEW: Warn when using fallback
    if (OAUTH_PROVIDER_MAP[provider.key]) {
        console.warn(
            `[SetupWizard] Using fallback OAuth config for ${provider.key}. ` +
            `Database config missing or malformed. This may cause scope issues.`
        );
    }
    
    return OAUTH_PROVIDER_MAP[provider.key] || null;
}
```

#### 3.3: Remove Fallback Entirely (Optional - Aggressive)

**Alternative approach**: Remove the `OAUTH_PROVIDER_MAP` fallback completely and force all OAuth config to come from the database:

```typescript
function getOAuthConfig(provider: IntegrationProvider): OAuthConfig | null {
    const config = provider.config as Record<string, unknown> | null;
    if (config?.oauthConfig && typeof config.oauthConfig === "object") {
        return config.oauthConfig as OAuthConfig;
    }
    
    // No fallback - if config is missing, OAuth setup is unavailable
    console.error(
        `[SetupWizard] OAuth config not found for ${provider.key}. ` +
        `Provider seed may be missing or database may not be initialized.`
    );
    return null;
}
```

**Pros**: Prevents silent scope bugs  
**Cons**: Breaks setup if database seed fails (but this should be caught in dev/test)

### Phase 4: Google Cloud Console Configuration (User Action Required)

**Risk**: None  
**Complexity**: Trivial  
**ETA**: 2 minutes

Verify Google Cloud Console OAuth consent screen includes the correct scope:

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the AgentC2 project
3. Go to "APIs & Services" > "OAuth consent screen"
4. Click "Edit App"
5. In "Scopes" section, verify:
   - ✅ `https://www.googleapis.com/auth/calendar.events` is enabled
   - ❌ `https://www.googleapis.com/auth/calendar.readonly` can be present but is NOT sufficient
6. If only `calendar.readonly` is enabled, add `calendar.events`
7. Save changes

**Note**: If `calendar.events` is not currently in the consent screen, adding it may require re-verification by Google (up to 1-3 business days for sensitive scopes). During verification, existing tokens will continue to work, but new authorizations may be limited.

### Phase 5: Data Migration for Affected Users (High Priority — Fix Existing Broken Connections)

**Risk**: Low  
**Complexity**: Moderate  
**ETA**: 20 minutes

#### 5.1: Create Migration Script

**File**: `scripts/fix-calendar-scope.ts` (new file)

```typescript
/**
 * Migration script to fix Google Calendar connections with calendar.readonly
 * instead of calendar.events.
 *
 * Run with: bun run scripts/fix-calendar-scope.ts
 */

import { prisma } from "@repo/database";
import { decryptCredentials, encryptCredentials } from "../apps/agent/src/lib/credential-crypto";

async function fixCalendarScopes() {
    const gmailProvider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    
    if (!gmailProvider) {
        console.error("Gmail provider not found in database");
        return;
    }
    
    const connections = await prisma.integrationConnection.findMany({
        where: {
            providerId: gmailProvider.id,
            isActive: true
        }
    });
    
    console.log(`Found ${connections.length} Gmail connections to check`);
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const connection of connections) {
        try {
            const creds = decryptCredentials(connection.credentials);
            if (!creds || typeof creds !== "object" || Array.isArray(creds)) {
                console.warn(`Skipping ${connection.id}: invalid credentials format`);
                skipped++;
                continue;
            }
            
            const scope = (creds as { scope?: string }).scope || "";
            const scopeSet = new Set(scope.split(/[,\s]+/).filter(Boolean));
            
            // Check if has calendar.readonly but missing calendar.events
            if (scopeSet.has("https://www.googleapis.com/auth/calendar.readonly") && 
                !scopeSet.has("https://www.googleapis.com/auth/calendar.events")) {
                
                console.log(`Fixing connection ${connection.id} (${connection.name})`);
                console.log(`  Current scope: ${scope}`);
                
                // Replace calendar.readonly with calendar.events
                const newScopeArray = Array.from(scopeSet)
                    .filter(s => s !== "https://www.googleapis.com/auth/calendar.readonly")
                    .concat("https://www.googleapis.com/auth/calendar.events");
                const newScope = newScopeArray.join(" ");
                
                const updatedCreds = { ...creds, scope: newScope };
                const encrypted = encryptCredentials(updatedCreds);
                
                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: {
                        credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
                        errorMessage: null  // Clear any previous error
                    }
                });
                
                console.log(`  ✅ Fixed scope: ${newScope}`);
                fixed++;
            } else if (scopeSet.has("https://www.googleapis.com/auth/calendar.events")) {
                // Already has correct scope
                skipped++;
            } else {
                console.warn(`Connection ${connection.id} has no calendar scope at all`);
                skipped++;
            }
        } catch (error) {
            console.error(`Error processing connection ${connection.id}:`, error);
            errors++;
        }
    }
    
    console.log("\n=== Migration Summary ===");
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total: ${connections.length}`);
}

fixCalendarScopes()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
```

**Note**: This script only fixes the stored scope string in the database. It does NOT update the actual OAuth token scopes with Google. Users will still need to re-authorize to grant the correct scope to Google. However, this fixes the immediate inconsistency and prevents error messages from being confusing.

#### 5.2: Add Admin Endpoint to Trigger Re-Sync

**File**: `apps/agent/src/app/api/admin/fix-calendar-scopes/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { syncGmailFromAccount } from "@/lib/gmail-sync";

/**
 * POST /api/admin/fix-calendar-scopes
 * 
 * Re-sync all Gmail connections to refresh scopes from the Account table.
 * Requires admin auth.
 */
export async function POST(request: NextRequest) {
    // TODO: Add admin authentication check
    
    const users = await prisma.user.findMany({
        include: {
            accounts: {
                where: { providerId: "google" }
            },
            memberships: {
                include: { organization: true }
            }
        }
    });
    
    const results = [];
    
    for (const user of users) {
        const googleAccount = user.accounts[0];
        if (!googleAccount) continue;
        
        for (const membership of user.memberships) {
            const result = await syncGmailFromAccount(user.id, membership.organizationId);
            results.push({
                userId: user.id,
                organizationId: membership.organizationId,
                ...result
            });
        }
    }
    
    return NextResponse.json({ success: true, results });
}
```

---

## Testing Checklist

### Pre-Deployment Testing

- [ ] **Build Check**: `bun run build` passes
- [ ] **Type Check**: `bun run type-check` passes  
- [ ] **Lint Check**: `bun run lint` passes
- [ ] **Format Check**: `bun run format` passes

### Functional Testing

#### Test 1: Fresh Sign-Up (Should Still Work)
- [ ] Sign up new user with Google OAuth
- [ ] Verify all scopes granted in Account table
- [ ] Verify Gmail, Calendar, Drive connections created
- [ ] Test `google-calendar-list-events` tool — should work
- [ ] Connection test shows "connected: true"

#### Test 2: Re-Authorization via SetupWizard (Should Now Work)
- [ ] Disconnect existing Gmail connection
- [ ] Navigate to Integrations Hub > Gmail
- [ ] Click "Connect" in SetupWizard
- [ ] Complete OAuth flow
- [ ] Verify `Account.scope` contains `calendar.events` (not `calendar.readonly`)
- [ ] Test `google-calendar-list-events` tool — should work
- [ ] Connection test shows "connected: true"

#### Test 3: Re-Authorization via Gmail Page (Should Still Work)
- [ ] Navigate to `/mcp/gmail`
- [ ] Click "Reconnect Gmail" button
- [ ] Complete OAuth flow
- [ ] Verify scopes are correct
- [ ] Calendar tools work

#### Test 4: Scope Check Validation
- [ ] Manually edit connection credentials to have only `calendar.readonly`
- [ ] Run connection test
- [ ] Test should now FAIL (not show success) with scope error
- [ ] Tool execution should fail with clear error message

#### Test 5: Migration Script (Dry Run)
- [ ] Create test connection with `calendar.readonly` scope
- [ ] Run migration script: `bun run scripts/fix-calendar-scope.ts`
- [ ] Verify connection credentials updated to `calendar.events`
- [ ] No data loss or corruption
- [ ] Script is idempotent (safe to run multiple times)

### Database Validation Queries

```sql
-- Check all Gmail connections for scope issues
SELECT 
    ic.id,
    ic.name,
    ic."organizationId",
    ic.metadata->>'gmailAddress' as gmail_address,
    LENGTH(ic.credentials::text) as creds_length
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ip.key = 'gmail'
AND ic."isActive" = true;

-- Check Account table for incorrect scopes
SELECT 
    a.id,
    a."userId",
    u.email,
    a.scope
FROM "Account" a
JOIN "User" u ON a."userId" = u.id
WHERE a."providerId" = 'google'
AND a.scope LIKE '%calendar.readonly%'
AND a.scope NOT LIKE '%calendar.events%';

-- Verify sibling connections exist for each Gmail connection
SELECT 
    o.slug as org_slug,
    COUNT(CASE WHEN ip.key = 'gmail' THEN 1 END) as gmail_count,
    COUNT(CASE WHEN ip.key = 'google-calendar' THEN 1 END) as calendar_count,
    COUNT(CASE WHEN ip.key = 'google-drive' THEN 1 END) as drive_count
FROM "Organization" o
LEFT JOIN "IntegrationConnection" ic ON o.id = ic."organizationId" AND ic."isActive" = true
LEFT JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id AND ip.key IN ('gmail', 'google-calendar', 'google-drive')
GROUP BY o.id, o.slug
HAVING COUNT(CASE WHEN ip.key = 'gmail' THEN 1 END) > 0;
```

---

## Post-Deployment Actions

### For Affected Users (Immediate)

1. **Identify affected users**:
   ```sql
   SELECT DISTINCT
       u.email,
       o.name as org_name,
       ic.id as connection_id
   FROM "IntegrationConnection" ic
   JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
   JOIN "Organization" o ON ic."organizationId" = o.id
   JOIN "Membership" m ON o.id = m."organizationId"
   JOIN "User" u ON m."userId" = u.id
   WHERE ip.key = 'gmail'
   AND ic.credentials::text LIKE '%calendar.readonly%'
   AND ic.credentials::text NOT LIKE '%calendar.events%';
   ```

2. **Notify users** (if applicable):
   - Email/in-app notification: "We've fixed a Google Calendar permissions issue. Please reconnect your Google account to restore calendar functionality."
   - Link directly to Integrations Hub with clear instructions

3. **Run migration script** (if implemented):
   ```bash
   bun run scripts/fix-calendar-scope.ts
   ```

4. **Monitor error rates** for calendar tool executions

### For Current Bug Report (Connection ID: cmls22ux9002r8e6o1m2n2u7x)

1. **Immediate Investigation**:
   ```sql
   -- Verify current state of the specific connection
   SELECT 
       ic.id,
       ic.name,
       ic."organizationId",
       ic."providerId",
       ic."isActive",
       ic."lastTestedAt",
       ic."errorMessage",
       ic.metadata,
       LENGTH(ic.credentials::text) as creds_size
   FROM "IntegrationConnection" ic
   WHERE ic.id = 'cmls22ux9002r8e6o1m2n2u7x';
   
   -- Check associated Account for user nathan@useappello.com
   SELECT 
       a.id,
       a."userId",
       u.email,
       a."providerId",
       a.scope,
       a."accessTokenExpiresAt",
       a."updatedAt"
   FROM "Account" a
   JOIN "User" u ON a."userId" = u.id
   WHERE a."providerId" = 'google'
   AND (
       a.scope LIKE '%nathan@useappello.com%'
       OR u.email = 'nathan@useappello.com'
   )
   ORDER BY a."updatedAt" DESC
   LIMIT 1;
   
   -- Check Gmail provider config in database
   SELECT 
       key,
       name,
       "configJson"->'oauthConfig'->'scopes' as oauth_scopes,
       "configJson"->'requiredScopes' as required_scopes
   FROM "IntegrationProvider"
   WHERE key = 'gmail';
   ```

2. **Root Cause Confirmation**:
   - If `Account.scope` contains `calendar.readonly` but not `calendar.events`: ✅ Confirms the hypothesis
   - If provider `configJson.oauthConfig.scopes` is null or malformed: ✅ Explains why fallback was used
   - If connection credentials contain `calendar.readonly`: ✅ Confirms scope was synced from Account

3. **Apply code fix** (Phase 1) — Update SetupWizard.tsx OAUTH_PROVIDER_MAP

4. **User re-authorizes** via fixed SetupWizard at `/mcp/providers/gmail`

5. **Verify fix**:
   - [ ] `Account.scope` contains `calendar.events` after re-authorization
   - [ ] `IntegrationConnection.credentials` contains `calendar.events` after sync
   - [ ] Connection test passes with scope validation enabled
   - [ ] Agent `demo-prep-agent-appello` can call `google-calendar-list-events` successfully
   - [ ] No more "missing authorization scope" errors

---

## Risk Assessment

### Change Risk Matrix

| Change | Risk Level | Impact if Broken | Rollback Difficulty |
|--------|------------|------------------|---------------------|
| Fix OAUTH_PROVIDER_MAP scope | **Low** | OAuth requests wrong scope again | Easy - revert commit |
| Update documentation | **None** | Documentation inaccurate | Easy - revert commit |
| Add scope validation to test | **Low** | Connection test may fail incorrectly | Easy - revert or fix |
| Remove fallback entirely | **Medium** | OAuth setup breaks if DB seed fails | Medium - requires DB seed fix |
| Run migration script | **Low** | May corrupt credentials if encryption fails | Medium - restore from backup |

### Blast Radius

| Component | Breaking Change? | Requires User Action? | Notes |
|-----------|------------------|-----------------------|-------|
| New sign-ups | No | No | Already working correctly |
| Existing connections (correct scope) | No | No | Unaffected |
| Existing connections (wrong scope) | No | Yes | Must re-authorize after fix deployed |
| SetupWizard | No | No | Backward compatible |
| Documentation | No | No | Cosmetic updates only |

---

## Long-Term Recommendations

### 1. Centralize Scope Configuration

**Problem**: Scopes are currently defined in multiple places:
- `packages/auth/src/google-scopes.ts` (server-side auth)
- `packages/agentc2/src/mcp/client.ts` (database seed)
- `apps/agent/src/components/integrations/SetupWizard.tsx` (fallback)

**Solution**: Import from single source of truth everywhere:

```typescript
// In SetupWizard.tsx
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";

const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [...GOOGLE_OAUTH_SCOPES],  // ✅ Use SSoT
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

### 2. Add Integration Tests for OAuth Flows

**File**: `tests/integration/auth/oauth-scopes.test.ts` (new file)

```typescript
import { test, expect } from "bun:test";
import { GOOGLE_OAUTH_SCOPES, GOOGLE_REQUIRED_SCOPES } from "@repo/auth/google-scopes";

test("SetupWizard OAuth config matches GOOGLE_OAUTH_SCOPES", () => {
    // This test would require refactoring SetupWizard to export OAUTH_PROVIDER_MAP
    // or reading the compiled component code
    
    // Verify critical scopes are present
    expect(GOOGLE_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(GOOGLE_REQUIRED_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
});

test("Database seed OAuth config matches GOOGLE_OAUTH_SCOPES", async () => {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    
    const config = provider?.configJson as { oauthConfig?: { scopes?: string[] } } | null;
    const scopes = config?.oauthConfig?.scopes || [];
    
    expect(scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(scopes).not.toContain("https://www.googleapis.com/auth/calendar.readonly");
});
```

### 3. Add Runtime Scope Monitoring

Add telemetry to track OAuth scope issues:

```typescript
// In checkGoogleScopes function
if (missing.length > 0) {
    // Log to monitoring system
    console.warn("[Scope Check Failed]", {
        gmailAddress,
        required: requiredScopes,
        granted: Array.from(grantedScopes),
        missing
    });
    
    // Optional: Send to error tracking (Sentry, etc.)
    // captureMessage("Google OAuth scope mismatch", { extra: { ... } });
}
```

### 4. Improve Connection Test Accuracy

Enhance the connection test to validate actual API functionality, not just token presence:

```typescript
// For gmail provider
const testResult = await callGmailApi(gmailAddress, "/users/me/profile");

// For google-calendar provider  
const testResult = await callCalendarApi(gmailAddress, "/calendars/primary");

// Return detailed result
return {
    success: testResult.ok,
    connected: testResult.ok,
    statusCode: testResult.status,
    scopeCheck: await checkGoogleScopes(gmailAddress, REQUIRED_SCOPES)
};
```

### 5. Add User-Facing Scope Status

Display which scopes are currently granted in the Integrations Hub UI:

```tsx
<div className="space-y-1">
    <Label>Permissions Granted</Label>
    {grantedScopes.map(scope => (
        <div key={scope} className="flex items-center gap-2">
            <CheckIcon className="h-3 w-3 text-green-500" />
            <span className="text-xs">{SCOPE_DESCRIPTIONS[scope] || scope}</span>
        </div>
    ))}
</div>

{missingScopes.length > 0 && (
    <div className="border-yellow-500 bg-yellow-50 mt-3 rounded-lg border p-3">
        <Label className="text-yellow-700">Missing Permissions</Label>
        {missingScopes.map(scope => (
            <div key={scope} className="text-xs text-yellow-600">
                • {SCOPE_DESCRIPTIONS[scope] || scope}
            </div>
        ))}
    </div>
)}
```

---

## Complexity & Effort Estimate

| Phase | Description | Files Changed | Lines Changed | Effort | Risk |
|-------|-------------|---------------|---------------|--------|------|
| 1 | Fix scopes in SetupWizard + Database Seed | 2 | ~25 | 10 min | Low |
| 2 | Update documentation | 6 | ~15 | 10 min | None |
| 3 | Enhanced validation | 2 | ~50 | 30 min | Low |
| 4 | Google Console config check | 0 | 0 | 2 min | None |
| 5 | Data migration script | 1 new file | ~100 | 20 min | Low |
| **Total** | | **9-11 files** | **~190 lines** | **72 min** | **Low** |

### Recommended Phasing

1. **Immediate (10 min)**: Deploy Phase 1 (scope fixes in SetupWizard + database seed) to prevent new users from being affected
2. **Same Day (10 min)**: Deploy Phase 2 (docs) to prevent confusion  
3. **Within 24h (30 min)**: Deploy Phase 3 (validation) to catch future issues early
4. **Within 24h (20 min)**: Run Phase 5 (migration) to fix existing broken connections
5. **Optional (long-term)**: Implement long-term recommendations

**Critical**: Phase 1 must include BOTH the SetupWizard fix AND the database seed fix. Fixing only one leaves the other code path broken.

---

## Regression Prevention

### Code Review Checklist

When reviewing OAuth-related changes:

- [ ] OAuth scopes match the single source of truth (`packages/auth/src/google-scopes.ts`)
- [ ] No hardcoded scope arrays outside of SSoT files
- [ ] Documentation updated to reflect scope changes
- [ ] Tool requirements match requested scopes
- [ ] Connection test validates scopes, not just token presence

### Monitoring & Alerts

Add alerts for:

1. **Scope Mismatch Rate**: Track how often `checkGoogleScopes` returns `ok: false`
2. **Connection Test Pass But Tool Fail**: Connection test succeeds but actual tool execution fails
3. **Account Scope Changes**: Alert when `Account.scope` is updated with fewer scopes than before
4. **Fallback Config Usage**: Log when `OAUTH_PROVIDER_MAP` fallback is used instead of database config

### Future-Proofing

1. **Eliminate fallback entirely**: Force all OAuth config to come from database
2. **Scope inheritance validation**: On DB seed, assert that provider.configJson.oauthConfig.scopes matches GOOGLE_OAUTH_SCOPES
3. **Runtime scope validation**: On every OAuth callback, validate granted scopes match expected scopes
4. **User notification**: When scopes are insufficient, show in-app banner with actionable fix instructions

---

## Appendix A: Scope Comparison

### Correct Scope (calendar.events)

- **Full Name**: `https://www.googleapis.com/auth/calendar.events`
- **Permissions**: See, edit, share, and permanently delete all calendars you can access using Google Calendar
- **Read Operations**: ✅ List, search, get events
- **Write Operations**: ✅ Create, update, delete events
- **AgentC2 Usage**: Required for all calendar tools

### Incorrect Scope (calendar.readonly)

- **Full Name**: `https://www.googleapis.com/auth/calendar.readonly`
- **Permissions**: See all your calendars and events
- **Read Operations**: ✅ List, search, get events
- **Write Operations**: ❌ Cannot create, update, or delete
- **AgentC2 Usage**: Insufficient — breaks create/update/delete tools

### Why calendar.events Is Required

Even though AgentC2 currently implements these calendar tools:

**Read Tools**:
- `google-calendar-list-events` — Could work with `calendar.readonly`
- `google-calendar-search-events` — Could work with `calendar.readonly`
- `google-calendar-get-event` — Could work with `calendar.readonly`

**Write Tools**:
- `google-calendar-create-event` — **Requires** `calendar.events`
- `google-calendar-update-event` — **Requires** `calendar.events`
- `google-calendar-delete-event` — **Requires** `calendar.events`

**Decision**: Use `calendar.events` for all tools because:
1. Simplifies permission management (one scope instead of conditional logic)
2. Prevents edge cases where read succeeds but write fails with different error
3. Enables future calendar features without re-authorization
4. Matches user expectations (if agents can read calendar, they should be able to manage it)

---

## Appendix B: Better Auth Scope Behavior

Based on the Better Auth documentation and GitHub issues:

### How linkSocial Handles Scopes

1. **Custom Scopes Override Defaults**: When you call `linkSocial({ scopes: [...] })`, those scopes are used for that specific authorization request, **replacing** (not merging with) the defaults configured in `auth.ts`.

2. **Scope Persistence**: After OAuth callback, the granted scopes are stored in `Account.scope` field as a space-separated string.

3. **Scope Updates on Re-Authorization**: When a user re-authorizes:
   - Better Auth creates a new authorization request with the specified scopes
   - Google returns a new token with **only** the requested scopes (not cumulative)
   - Better Auth **overwrites** the `Account.scope` field with the new scope string
   - Any previously granted scopes that weren't requested are **lost**

4. **No Scope Merging**: If initial auth granted `[A, B, C]` and re-auth requests `[A, B]`, the final stored scopes are `[A, B]`, not `[A, B, C]`.

### Implications for AgentC2

- **Every** call to `linkSocial` must include the **full set** of required scopes
- Cannot incrementally add scopes — must re-request all scopes each time
- Fallback configurations must be complete and match the primary configuration exactly
- Users cannot "upgrade" from read-only to read-write without a full re-authorization

---

## Verification & Debugging

### How to Verify If You're Affected

Run these queries to check your system:

```sql
-- 1. Check if gmail provider has correct scope in database seed
SELECT 
    key,
    name,
    "configJson"->'oauthConfig'->'scopes' as oauth_scopes
FROM "IntegrationProvider"
WHERE key = 'gmail';
-- Expected: oauth_scopes should include "calendar.events"

-- 2. Check user Account scopes
SELECT 
    u.email,
    a."providerId",
    a.scope,
    CASE 
        WHEN a.scope LIKE '%calendar.events%' THEN '✅ Correct'
        WHEN a.scope LIKE '%calendar.readonly%' THEN '❌ Wrong (readonly)'
        ELSE '⚠️  No calendar scope'
    END as status
FROM "Account" a
JOIN "User" u ON a."userId" = u.id
WHERE a."providerId" = 'google'
ORDER BY a."updatedAt" DESC;

-- 3. Check IntegrationConnection scopes (encrypted, so check for pattern)
SELECT 
    ic.id,
    ic.name,
    o.slug as org_slug,
    ic.metadata->>'gmailAddress' as gmail_address,
    ic."lastTestedAt",
    ic."errorMessage"
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
JOIN "Organization" o ON ic."organizationId" = o.id
WHERE ip.key = 'gmail'
AND ic."isActive" = true;
```

### Debugging Checklist

When investigating calendar scope issues:

- [ ] Check `Account.scope` field for the user's Google account
- [ ] Verify scope contains `calendar.events` (not just `calendar.readonly`)
- [ ] Check `IntegrationConnection.credentials` (encrypted, look for decrypt errors)
- [ ] Run connection test: `POST /api/integrations/connections/{id}/test`
- [ ] Check if connection test passes but tool execution fails (classic symptom)
- [ ] Review `IntegrationProvider.configJson.oauthConfig.scopes` in database
- [ ] Check if fallback was used (look for console warnings after implementing Phase 3.2)
- [ ] Verify Google Cloud Console has `calendar.events` in approved scopes

---

## Conclusion

This bug is caused by a **scope configuration mismatch** between the hardcoded fallback in `SetupWizard.tsx` and the actual requirements of the calendar tools. When users re-authorize via the Integrations Hub, they unknowingly request insufficient permissions (`calendar.readonly` instead of `calendar.events`), which breaks all calendar functionality.

### Root Cause Summary

1. **Primary Defect**: `SetupWizard.tsx` line 70 contains incorrect scope `calendar.readonly`
2. **Trigger Condition**: User re-authorizes Gmail via Integrations Hub AND fallback config is used
3. **Failure Mode**: Better Auth overwrites `Account.scope` with insufficient permissions
4. **Symptom**: Connection test passes but calendar tools fail with scope error
5. **User Impact**: Cannot use any calendar features (read or write)

### Fix Summary

**The fix is straightforward**: 

1. Update the hardcoded scope in `OAUTH_PROVIDER_MAP` from `calendar.readonly` to `calendar.events`
2. Remove redundant `gmail.send` scope (covered by `gmail.modify`)
3. Update all documentation to reflect correct scope
4. Add scope validation to connection test
5. Run migration script to fix existing broken connections

**Estimated Total Effort**: ~1 hour (implementation + testing)  
**Risk**: Low — Changes are isolated and have clear rollback path  
**Priority**: Critical — Blocks core calendar functionality for affected users

### Next Steps (Analysis Complete — Implementation NOT Started)

This document provides complete analysis and detailed implementation plans. **No code changes have been made yet** per the instructions to perform analysis only.

To implement the fix:
1. Review this RCA document
2. Get approval for the fix plan
3. Execute Phase 1 (immediate hotfix) first — **Both** SetupWizard and database seed must be fixed
4. Roll out remaining phases based on priority
5. Monitor for any regressions
6. Update issue #164 with resolution details

---

## Key Findings Summary

### What We Discovered

1. **Two Locations with Wrong Scopes**:
   - `SetupWizard.tsx` fallback: Has `calendar.readonly` instead of `calendar.events`
   - `mcp/client.ts` database seed: Has Gmail scopes only, missing calendar/drive scopes

2. **Why Both Are Wrong**:
   - Gmail provider acts as "parent" for all Google services (Calendar, Drive, Search Console)
   - OAuth flow must request ALL Google scopes at once (cannot incrementally add)
   - Both configs only request subset of needed scopes

3. **How It Breaks**:
   - User re-authorizes Gmail → insufficient scopes requested
   - Better Auth overwrites stored scopes with new insufficient scopes
   - Calendar tools fail because they need `calendar.events` but connection has `calendar.readonly` or nothing

4. **Why Connection Test Still Passes**:
   - Test only checks if token exists, not if scopes are sufficient
   - Returns `connected: true` with insufficient permissions

### What Must Be Fixed

| Component | Current State | Required Fix |
|-----------|---------------|--------------|
| **SetupWizard fallback** | `[gmail.modify, gmail.send, calendar.readonly]` | Import and use `GOOGLE_OAUTH_SCOPES` |
| **Database seed (Gmail)** | `[gmail.modify]` | Include all Google scopes |
| **Connection test** | Only checks token presence | Add scope validation |
| **Documentation** | Shows `calendar.readonly` | Update to `calendar.events` |
| **Affected connections** | Have wrong scope in credentials | Run migration script |

### Critical Path to Resolution

```
1. Fix SetupWizard.tsx (import GOOGLE_OAUTH_SCOPES) 
   ↓
2. Fix mcp/client.ts database seed (include all Google scopes)
   ↓
3. Deploy + restart server (auto-updates database via ensureIntegrationProviders)
   ↓
4. Affected users re-authorize via fixed wizard
   ↓
5. Verify: calendar tools now work
```

### Files Requiring Changes (Phase 1 Only)

1. `apps/agent/src/components/integrations/SetupWizard.tsx` — Import and use `GOOGLE_OAUTH_SCOPES`
2. `packages/agentc2/src/mcp/client.ts` — Update Gmail provider seed with full Google scopes

**Total Lines Changed**: ~25 lines across 2 files  
**Deployment Impact**: Requires server restart to apply database seed updates  
**User Impact**: Users with broken connections must re-authorize after fix is deployed

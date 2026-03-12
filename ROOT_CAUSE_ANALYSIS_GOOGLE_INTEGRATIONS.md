# Root Cause Analysis: Google Integrations Not Persisting

**Issue:** [#159](https://github.com/Appello-Prototypes/agentc2/issues/159)  
**Reporter:** sdlc-test@agentc2.ai (Flywheel Demo instance)  
**Date:** March 12, 2026  
**Status:** ✅ Root Cause Identified

---

## Executive Summary

Gmail, Google Calendar, and Google Drive integrations fail to persist connections when users authenticate directly from their individual integration pages (`/mcp/providers/google-calendar`, `/mcp/providers/google-drive`). The OAuth flow completes successfully, but the SetupWizard component fails to create an `IntegrationConnection` record because it expects a `syncEndpoint` in the provider's OAuth configuration, which is missing for Google Calendar and Google Drive.

**Impact:** Users authenticate with Google, grant permissions, but see no confirmation. The integration appears disconnected, causing confusion and frustration.

---

## Root Cause

### Primary Bug Location

**File:** `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines:** 1102-1154  
**Function:** `useEffect` hook for post-OAuth sync

```typescript:1102:1154:apps/agent/src/components/integrations/SetupWizard.tsx
// Post-OAuth return: detect oauth_return param, trigger sync, and show result
useEffect(() => {
    if (oauthReturnHandled.current) return;
    if (!provider) return;
    if (searchParams.get("oauth_return") !== "1") return;

    const oauthCfg = getOAuthConfig(provider);
    if (!oauthCfg?.syncEndpoint) return; // ← BUG: Returns early for google-calendar/google-drive!

    oauthReturnHandled.current = true;
    setStep("connecting");
    setConnecting(true);
    setOauthSyncing(true);

    // Clean the oauth_return param from the URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth_return");
    window.history.replaceState({}, "", url.toString());

    const runSync = async () => {
        try {
            const syncRes = await fetch(`${apiBase}${oauthCfg.syncEndpoint}`, {
                method: "POST"
            });
            const syncData = await syncRes.json();

            if (syncData.success) {
                setToolCount(syncData.toolCount);
                setStep("success");
            } else if (
                Array.isArray(syncData.missingScopes) &&
                syncData.missingScopes.length > 0
            ) {
                setConnectError(
                    "Additional permissions are needed. Please disconnect and reconnect Gmail."
                );
                setStep("error");
            } else {
                setConnectError(syncData.error || "Failed to sync credentials after OAuth");
                setStep("error");
            }
        } catch (err) {
            setConnectError(
                err instanceof Error ? err.message : "Failed to complete connection"
            );
            setStep("error");
        } finally {
            setConnecting(false);
            setOauthSyncing(false);
        }
    };

    void runSync();
}, [provider, searchParams, apiBase]);
```

**The Critical Line:** Line 1108 returns early when `syncEndpoint` is missing:

```typescript
if (!oauthCfg?.syncEndpoint) return; // ← Silently fails for google-calendar/google-drive
```

---

## Technical Details

### 1. Provider Configuration (Correct)

**File:** `packages/agentc2/src/mcp/client.ts`

The providers are configured correctly with proper OAuth scopes and sibling relationships:

**Gmail (works):**
```typescript:588:621:packages/agentc2/src/mcp/client.ts
{
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
        setupUrl: "/mcp/gmail",
        setupLabel: "Open OAuth Setup"
    }
}
```

**Google Calendar (broken):**
```typescript:622:639:packages/agentc2/src/mcp/client.ts
{
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
            siblingOf: "gmail"  // ← Indicates shared OAuth with Gmail
            // ❌ Missing: statusEndpoint, syncEndpoint
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Connect via Google Sign-In"
    }
}
```

**Google Drive (broken):**
```typescript:640:663:packages/agentc2/src/mcp/client.ts
{
    key: "google-drive",
    name: "Google Drive",
    description: "File storage — search, read, and create documents via Google Drive API",
    category: "productivity",
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
            siblingOf: "gmail"  // ← Indicates shared OAuth with Gmail
            // ❌ Missing: statusEndpoint, syncEndpoint
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Connect via Google Sign-In"
    }
}
```

### 2. OAuth Configuration Type Mismatch

**File:** `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines:** 51-56

The `OAuthConfig` type definition requires `syncEndpoint`:

```typescript:51:56:apps/agent/src/components/integrations/SetupWizard.tsx
type OAuthConfig = {
    socialProvider: "google";
    scopes: string[];
    statusEndpoint: string;
    syncEndpoint: string;  // ← Required but missing for siblings
};
```

### 3. Configuration Comparison Table

| Provider | Has oauthConfig? | Has syncEndpoint? | Has statusEndpoint? | Result |
|----------|------------------|-------------------|---------------------|--------|
| **gmail** | ✅ Yes | ✅ Yes (`/api/integrations/gmail/sync`) | ✅ Yes (`/api/integrations/gmail/status`) | ✅ Works |
| **google-calendar** | ✅ Yes | ❌ No | ❌ No | ❌ Broken |
| **google-drive** | ✅ Yes | ❌ No | ❌ No | ❌ Broken |
| **google-search-console** | ✅ Yes | ❌ No | ❌ No | ❌ Broken |
| **microsoft** | ✅ Yes | ❌ No (uses custom flow) | ✅ Yes | ✅ Works (custom) |
| **microsoft-teams** | ✅ Yes | ❌ No | ❌ No | ⚠️ Likely broken |

### 4. The Missing Sync Endpoint Problem

**File:** `apps/agent/src/components/integrations/SetupWizard.tsx`  
**Lines:** 149-155

The `getOAuthConfig` function returns the provider's `oauthConfig` if it exists:

```typescript:149:155:apps/agent/src/components/integrations/SetupWizard.tsx
function getOAuthConfig(provider: IntegrationProvider): OAuthConfig | null {
    const config = provider.config as Record<string, unknown> | null;
    if (config?.oauthConfig && typeof config.oauthConfig === "object") {
        return config.oauthConfig as OAuthConfig;
    }
    return OAUTH_PROVIDER_MAP[provider.key] || null;
}
```

For google-calendar and google-drive:
1. They **have** `oauthConfig` in their `configJson`
2. This causes `getOAuthConfig()` to return their partial config (missing `syncEndpoint`)
3. They are **NOT** in `OAUTH_PROVIDER_MAP` (only Gmail is)
4. Result: `getOAuthConfig()` returns `{ socialProvider: "google", scopes: [...], siblingOf: "gmail" }` with no `syncEndpoint`

**OAUTH_PROVIDER_MAP only contains Gmail:**

```typescript:64:75:apps/agent/src/components/integrations/SetupWizard.tsx
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.readonly"
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};
```

---

## The Broken User Flow

### What the User Experiences

1. **Navigate to integration:** User goes to `/mcp/providers/google-calendar` (or `google-drive`)
2. **Click "Connect":** SetupWizard shows overview, user clicks "Continue"
3. **OAuth flow starts:** 
   - `handleNativeOAuth()` is called (line 1157-1175)
   - Calls Better Auth's `linkSocial({ provider: "google", scopes: [...], callbackURL: "/mcp/providers/google-calendar?oauth_return=1" })`
   - User is redirected to Google OAuth consent screen
4. **User authorizes:** User grants permissions in Google
5. **OAuth completes:** Google redirects back to `/mcp/providers/google-calendar?oauth_return=1`
6. **Better Auth processes callback:** Creates/updates `Account` record with tokens
7. **SetupWizard effect runs (line 1102):**
   - Detects `oauth_return=1` ✅
   - Gets `oauthConfig` → `{ socialProvider: "google", scopes: [...], siblingOf: "gmail" }` ✅
   - **Checks for `syncEndpoint` → NOT FOUND** ❌
   - **Returns early (line 1108)** ❌
   - **No connection created** ❌
   - **No success/error feedback shown** ❌
8. **User sees:** Page remains in the same state, no indication of success or failure. Integration still shows as "disconnected"

### Important Context: Post-Bootstrap Hook Limitation

**File:** `packages/auth/src/auth.ts`  
**Lines:** 184-197

The Gmail sync post-bootstrap hook **only runs for new users** when an organization is first created:

```typescript
// Run post-bootstrap hooks (e.g., Gmail sync) only
// when an org was actually created/joined (invite code path)
if (result.success && result.organization) {
    for (const cb of postBootstrapCallbacks) {
        try {
            await cb(newSession.user.id, result.organization.id);
        } catch (hookError) {
            console.error(
                "[Auth Hook] Post-bootstrap callback failed:",
                hookError
            );
        }
    }
}
```

**Impact:** The user in the bug report (sdlc-test@agentc2.ai) is an **existing user** in the Flywheel Demo organization. When they link Google to their account via `linkSocial()`, the post-bootstrap hooks **do not run**, so Gmail sync never happens. They must explicitly trigger the sync by:
- Navigating to `/mcp/gmail` and clicking "Reconnect Gmail", OR
- Using the SetupWizard on the Gmail provider page

But when they try to connect Calendar/Drive directly, the SetupWizard fails due to the missing `syncEndpoint`.

### What SHOULD Happen

The intended architecture is:

1. **Single OAuth flow for all Google services:** When a user authenticates with Google, they grant ALL scopes (Gmail, Calendar, Drive, Search Console) in one consent
2. **Sibling sync mechanism:** After Gmail is connected, `syncSiblingGoogleConnections()` automatically creates connections for Calendar and Drive if those scopes were granted
3. **One connection source:** Users should primarily connect via Gmail (`/mcp/gmail`), which then enables all Google services

**However**, the UI shows all three as separate, equal integrations with individual "Connect" buttons, creating user confusion.

---

## Supporting Code Evidence

### 1. Sibling Sync Function (Exists But Not Used)

**File:** `apps/agent/src/lib/gmail.ts`  
**Lines:** 182-323

The `syncSiblingGoogleConnections()` function **correctly** creates connections for Calendar and Drive:

```typescript:182:323:apps/agent/src/lib/gmail.ts
export const syncSiblingGoogleConnections = async (
    organizationId: string,
    gmailAddress: string,
    tokens: {
        access_token?: string | null;
        refresh_token?: string | null;
        expiry_date?: number | null;
        scope?: string | null;
        token_type?: string | null;
    }
): Promise<{ created: string[] }> => {
    const scopeSet = new Set(
        (tokens.scope || "")
            .split(/[,\s]+/)
            .map((v) => v.trim())
            .filter(Boolean)
    );

    const siblings: { key: string; name: string; requiredScopes: string[] }[] = [
        {
            key: "google-calendar",
            name: "Google Calendar",
            requiredScopes: ["https://www.googleapis.com/auth/calendar.events"]
        },
        {
            key: "google-drive",
            name: "Google Drive",
            requiredScopes: [
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/drive.file"
            ]
        },
        {
            key: "google-search-console",
            name: "Google Search Console",
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
        }
    ];

    const created: string[] = [];

    for (const sibling of siblings) {
        const hasScopes = sibling.requiredScopes.every((s) => scopeSet.has(s));
        if (!hasScopes) continue;

        const provider = await prisma.integrationProvider.findUnique({
            where: { key: sibling.key }
        });
        if (!provider) continue;

        // ... creates IntegrationConnection for each sibling
        // ... triggers auto-provisioning
        
        created.push(sibling.key);
    }

    return { created };
};
```

This function IS called when syncing via Gmail:

**File:** `apps/agent/src/app/api/integrations/gmail/sync/route.ts`  
**Lines:** 109-117

```typescript:109:117:apps/agent/src/app/api/integrations/gmail/sync/route.ts
// Sync sibling Google services (Calendar, Drive)
try {
    await syncSiblingGoogleConnections(organizationId, gmailAddress, tokenPayload);
} catch (err) {
    console.warn(
        "[Gmail Sync] Sibling sync failed (non-fatal):",
        err instanceof Error ? err.message : err
    );
}
```

**But:** This only runs when authenticating via the Gmail flow, not when authenticating from Calendar or Drive pages directly.

### 2. Better Auth Account Storage

When OAuth completes, Better Auth stores tokens in the `Account` table:

**Table:** `account`  
**Key fields:**
- `providerId: "google"`
- `accessToken: string`
- `refreshToken: string`
- `scope: string` (space-separated list of granted scopes)
- `accessTokenExpiresAt: DateTime`

The Gmail sync endpoint reads from this table:

**File:** `apps/agent/src/app/api/integrations/gmail/sync/route.ts`  
**Lines:** 46-52

```typescript:46:52:apps/agent/src/app/api/integrations/gmail/sync/route.ts
const account = await prisma.account.findFirst({
    where: {
        userId: session.user.id,
        providerId: "google"
    },
    orderBy: { updatedAt: "desc" }
});
```

### 3. Tool OAuth Requirements (Correct)

**File:** `packages/agentc2/src/tools/oauth-requirements.ts`  
**Lines:** 7-21

All Google tools correctly map to the "gmail" provider:

```typescript:7:21:packages/agentc2/src/tools/oauth-requirements.ts
export const TOOL_OAUTH_REQUIREMENTS: Record<string, string> = {
    // Google (Gmail OAuth — also covers Calendar and Drive)
    "gmail-archive-email": "gmail",
    "gmail-search-emails": "gmail",
    "gmail-read-email": "gmail",
    "gmail-draft-email": "gmail",
    "gmail-send-email": "gmail",
    "google-calendar-search-events": "gmail",
    "google-calendar-list-events": "gmail",
    "google-calendar-get-event": "gmail",
    "google-calendar-create-event": "gmail",
    "google-calendar-update-event": "gmail",
    "google-calendar-delete-event": "gmail",
    "google-drive-search-files": "gmail",
    "google-drive-read-file": "gmail",
    "google-drive-create-doc": "gmail",
    // ...
};
```

This is architecturally correct — all Google Calendar and Drive tools require the Gmail connection to be active.

---

## The Intended vs Actual Flow

### Intended Architecture (Design Intent)

1. **Single OAuth flow:** User connects Gmail → grants all Google scopes → Calendar and Drive are automatically enabled
2. **Sibling provisioning:** `syncSiblingGoogleConnections()` creates connections for Calendar and Drive
3. **Single Google account:** One OAuth token set serves all three integrations

### Actual User Experience (Current Bug)

1. **Three separate integrations:** UI shows Gmail, Google Calendar, Google Drive as independent integrations
2. **All show "Connect" buttons:** No indication that they share the same OAuth flow
3. **Clicking Calendar/Drive "Connect":**
   - Takes user through OAuth (✅ works)
   - OAuth completes, tokens stored in Better Auth Account table (✅ works)
   - SetupWizard checks for `syncEndpoint` (❌ missing)
   - Returns early, no connection created (❌ broken)
   - No error or success message shown (❌ broken)
   - User left in indeterminate state (❌ broken)

### Working Flow (Gmail Only)

**File:** `apps/agent/src/app/mcp/gmail/page.tsx`

When connecting via the Gmail page:
1. User navigates to `/mcp/gmail`
2. Custom Gmail page (not SetupWizard) handles the flow
3. Calls `linkSocial()` with callback to `/mcp/gmail?oauth_return=1`
4. After OAuth, page detects `oauth_return` param and calls `/api/integrations/gmail/sync`
5. Sync endpoint creates Gmail connection AND calls `syncSiblingGoogleConnections()`
6. All three integrations (Gmail, Calendar, Drive) become connected ✅

---

## Why This Happens

### Design Flaw: Inconsistent OAuth Handling

The codebase has **two different OAuth patterns**:

#### Pattern 1: Better Auth Native OAuth (Gmail, Google siblings)
- Uses Better Auth's `linkSocial()` for OAuth
- Requires a sync endpoint to convert Account table tokens → IntegrationConnection
- Gmail has this, Calendar/Drive don't

#### Pattern 2: Custom OAuth (Microsoft, Dropbox)
- Uses custom `/api/integrations/{provider}/start` and `/callback` endpoints
- Callback endpoint directly creates IntegrationConnection
- No sync step needed

The SetupWizard was built assuming all Better Auth OAuth providers have sync endpoints, but only Gmail was configured with one.

### The `siblingOf` Relationship Is Not Handled

The `siblingOf: "gmail"` field in `oauthConfig` indicates that google-calendar and google-drive share OAuth with Gmail, but:

1. **SetupWizard doesn't recognize this field** — no logic to detect sibling relationships
2. **No automatic redirect** — when user clicks "Connect" on Calendar/Drive, they don't get redirected to Gmail
3. **No UI hints** — nothing tells the user "Connect Gmail first to enable Calendar and Drive"
4. **setupUrl points to `/mcp/gmail`** — but this is only used when rendering a Link in OAuthConnectStep, not when triggering OAuth programmatically

---

## Impact Assessment

### Affected Integrations

| Provider | Status | Has syncEndpoint? | Issue |
|----------|--------|-------------------|-------|
| **gmail** | ✅ Works | Yes | No issue |
| **google-calendar** | ❌ Broken | No | **Fails to persist connection** |
| **google-drive** | ❌ Broken | No | **Fails to persist connection** |
| **google-search-console** | ❌ Broken | No | **Fails to persist connection** (same pattern) |
| **microsoft** | ✅ Works | N/A | Uses custom OAuth flow |
| **microsoft-teams** | ⚠️ Potentially broken | No | Has `siblingOf: "microsoft"`, likely same bug |

### User Experience Impact

- **High frustration:** Users authenticate multiple times with no result
- **Confusion:** No error messages, unclear what went wrong
- **Workflow disruption:** Cannot use Calendar/Drive tools in agents
- **Support burden:** Users filing duplicate bug reports or asking for help

### System Impact

- **Database state:** Better Auth `Account` table has valid tokens, but `IntegrationConnection` records are never created
- **Tools unavailable:** Agents cannot use Google Calendar or Drive tools even though OAuth succeeded
- **No data corruption:** Existing data is not affected, but new connections fail silently

---

## Current Workaround for Users

Until the fix is deployed, users can work around this issue by:

### Workaround: Connect Gmail First

1. Navigate to **Integrations** → **Gmail** (or directly to `/mcp/gmail`)
2. Click **"Reconnect Gmail"** button
3. Complete Google OAuth and grant **all permissions** (Gmail, Calendar, Drive)
4. After redirect, Gmail sync endpoint will run automatically via post-bootstrap hook or manual sync
5. This creates connections for:
   - ✅ Gmail
   - ✅ Google Calendar (auto-provisioned as sibling)
   - ✅ Google Drive (auto-provisioned as sibling)
6. All three integrations should now show as "Connected" in the Integrations Hub

**Important:** The user must grant ALL Google permissions in one OAuth consent. If they previously authenticated with only Gmail scopes, they need to:
1. Disconnect Gmail first (if partially connected)
2. Reconnect and approve all scopes

### Alternative: Manual Database Fix (Advanced)

For already-authenticated users, an admin can manually trigger the sync via API:

```bash
# Trigger Gmail sync for a user (creates sibling connections)
curl -X POST "https://your-domain.com/agent/api/integrations/gmail/sync" \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json"
```

Or via server-side script:

```typescript
import { syncGmailFromAccount } from "@/lib/gmail-sync";

await syncGmailFromAccount(userId, organizationId);
```

---

## Fix Plan

### Solution: Add Sync Endpoints for Sibling Providers

Create dedicated sync endpoints for google-calendar and google-drive that leverage the existing `syncSiblingGoogleConnections()` logic.

---

### Option A: Individual Sync Endpoints (Recommended)

Create sync endpoints for each sibling provider that call the Gmail sync logic.

#### Implementation Details

**1. Create `/apps/agent/src/app/api/integrations/google-calendar/sync/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { syncGmailFromAccount } from "@/lib/gmail-sync";

/**
 * POST /api/integrations/google-calendar/sync
 * 
 * Sync Google Calendar connection. Since Calendar shares OAuth with Gmail,
 * this delegates to the Gmail sync function which handles all Google services.
 */
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const silent = searchParams.get("silent") === "true";

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: silent ? 200 : 401 }
            );
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: silent ? 200 : 403 }
            );
        }

        // Sync via Gmail (which handles all Google siblings including Calendar)
        const result = await syncGmailFromAccount(session.user.id, organizationId);
        
        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || "Failed to sync Google Calendar",
                missingScopes: result.missingScopes,
                skipped: result.skipped
            }, { status: silent ? 200 : 400 });
        }

        // Verify that Calendar connection was actually created
        const calendarProvider = await prisma.integrationProvider.findUnique({
            where: { key: "google-calendar" }
        });
        
        if (calendarProvider) {
            const calendarConn = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    providerId: calendarProvider.id,
                    isActive: true
                }
            });
            
            if (!calendarConn) {
                return NextResponse.json({
                    success: false,
                    error: "Google Calendar scopes not granted during authentication. Please re-authenticate and grant Calendar permissions.",
                    missingScopes: ["https://www.googleapis.com/auth/calendar.events"]
                }, { status: 400 });
            }
        }

        return NextResponse.json({
            success: true,
            connected: true,
            gmailAddress: result.gmailAddress,
            connectionId: result.connectionId
        });
    } catch (error) {
        console.error("[Google Calendar Sync] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to sync Google Calendar"
        }, { status: 500 });
    }
}
```

**2. Create `/apps/agent/src/app/api/integrations/google-calendar/status/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { decryptCredentials } from "@/lib/credential-crypto";

/**
 * GET /api/integrations/google-calendar/status
 * 
 * Check Google Calendar connection status.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "google-calendar" }
        });

        if (!provider) {
            return NextResponse.json(
                { success: false, error: "Google Calendar provider not configured" },
                { status: 404 }
            );
        }

        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                providerId: provider.id,
                isActive: true
            }
        });

        const credentials = decryptCredentials(connection?.credentials);
        const gmailAddress =
            credentials && typeof credentials === "object" && !Array.isArray(credentials)
                ? (credentials as { gmailAddress?: string }).gmailAddress
                : null;

        const connected = Boolean(connection?.isActive && gmailAddress);

        return NextResponse.json({
            success: true,
            connected,
            gmailAddress,
            connectionId: connection?.id
        });
    } catch (error) {
        console.error("[Google Calendar Status] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to check status"
        }, { status: 500 });
    }
}
```

**3. Create `/apps/agent/src/app/api/integrations/google-drive/sync/route.ts`**

```typescript
// Same as google-calendar/sync/route.ts but with:
// - Provider key check for "google-drive"
// - Required scopes check for Drive scopes
// - Console log prefix "[Google Drive Sync]"
```

**4. Create `/apps/agent/src/app/api/integrations/google-drive/status/route.ts`**

```typescript
// Same as google-calendar/status/route.ts but with:
// - Provider key: "google-drive"
// - Console log prefix "[Google Drive Status]"
```

**5. Update `/packages/agentc2/src/mcp/client.ts` (lines 622-663)**

```typescript
{
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
            siblingOf: "gmail",
            statusEndpoint: "/api/integrations/google-calendar/status",  // ← ADD THIS
            syncEndpoint: "/api/integrations/google-calendar/sync"        // ← ADD THIS
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Connect via Google Sign-In"
    }
},
{
    key: "google-drive",
    name: "Google Drive",
    description: "File storage — search, read, and create documents via Google Drive API",
    category: "productivity",
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
            siblingOf: "gmail",
            statusEndpoint: "/api/integrations/google-drive/status",  // ← ADD THIS
            syncEndpoint: "/api/integrations/google-drive/sync"        // ← ADD THIS
        },
        setupUrl: "/mcp/gmail",
        setupLabel: "Connect via Google Sign-In"
    }
}
```

**6. OPTIONAL: Update `/apps/agent/src/components/integrations/SetupWizard.tsx`**

Add better error handling for missing sync endpoints (line 1108):

```typescript
// Before the early return, add logging and error state
if (!oauthCfg?.syncEndpoint) {
    console.warn(
        `[SetupWizard] Provider ${provider.key} has no syncEndpoint. ` +
        `siblingOf: ${oauthCfg?.siblingOf || "none"}`
    );
    
    // Show error to user instead of silent failure
    setConnectError(
        `Configuration error: ${provider.name} cannot complete setup. ` +
        `Please try connecting via ${oauthCfg?.siblingOf ? 
            oauthCfg.siblingOf.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
            'the main integration page'}.`
    );
    setStep("error");
    return;
}
```

---

## Related Code References

### Key Functions

#### Risk Assessment: **LOW**
- No breaking changes to existing code
- Reuses existing sync logic
- Gmail flow remains unchanged
- Backward compatible

#### Estimated Complexity: **Low** (2-3 hours)
- Create 2 new sync endpoint files (Calendar, Drive)
- Create 2 new status endpoint files (Calendar, Drive)
- Update provider configs in `mcp/client.ts`
- Test all three flows

---

### Option B: Smart Sibling Detection in SetupWizard (Alternative)

Modify the SetupWizard to detect `siblingOf` relationships and use the parent's sync endpoint.

#### Files to Modify:

**1. `/apps/agent/src/components/integrations/SetupWizard.tsx`**

Add logic to resolve parent provider's sync endpoint when `siblingOf` is present:

```typescript
// In the post-OAuth effect (line 1102-1154)
const oauthCfg = getOAuthConfig(provider);

// NEW: Check for siblingOf relationship
let effectiveSyncEndpoint = oauthCfg?.syncEndpoint;
if (!effectiveSyncEndpoint && oauthCfg?.siblingOf) {
    // Look up parent provider's sync endpoint
    const parentProvider = allProviders.find(p => p.key === oauthCfg.siblingOf);
    if (parentProvider) {
        const parentConfig = getOAuthConfig(parentProvider);
        effectiveSyncEndpoint = parentConfig?.syncEndpoint;
    }
}

if (!effectiveSyncEndpoint) return; // Still guard against missing endpoint

// Use effectiveSyncEndpoint instead of oauthCfg.syncEndpoint
const syncRes = await fetch(`${apiBase}${effectiveSyncEndpoint}`, {
    method: "POST"
});
```

#### Risk Assessment: **MEDIUM**
- Changes core SetupWizard logic
- Relies on `allProviders` being loaded (race condition possible)
- More complex control flow
- Potential for unintended side effects

#### Estimated Complexity: **Medium** (3-5 hours)
- Modify SetupWizard OAuth handling
- Add sibling resolution logic
- Handle edge cases (parent not found, circular siblings)
- Comprehensive testing

---

### Option C: UI/UX Solution (Complementary)

Improve the UI to guide users to connect Gmail first when accessing Calendar/Drive.

#### Files to Modify:

**1. `/apps/agent/src/components/integrations/SetupWizard.tsx`**

When a sibling provider is accessed but parent is not connected, show a different message:

```typescript
// In OverviewStep or OAuthConnectStep
const siblingOf = oauthConfig?.siblingOf;
const parentConnected = siblingOf 
    ? allProviders.find(p => p.key === siblingOf)?.connections.some(c => c.isActive)
    : true;

if (!parentConnected) {
    return (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 px-4 py-3">
                <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Connect Gmail First
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Google Calendar and Google Drive share the same authentication with Gmail. 
                    Please connect Gmail first, which will automatically enable Calendar and Drive.
                </p>
            </div>
            <Link href="/mcp/providers/gmail" className={buttonVariants({ size: "lg", className: "w-full" })}>
                Go to Gmail Setup
            </Link>
        </div>
    );
}
```

**2. `/apps/agent/src/components/integrations/PlatformsTab.tsx`**

Update the card to show dependency hint for sibling providers.

#### Risk Assessment: **LOW**
- Only affects UI presentation
- Non-breaking change
- Can be combined with Option A

#### Estimated Complexity: **Low** (1-2 hours)
- Add conditional rendering
- Style warning message
- Update card badges/hints

---

## Recommended Fix Strategy

**Implement Option A + Option C together:**

1. **Short term (Option A):** Add sync endpoints for google-calendar and google-drive so direct connection works
2. **Medium term (Option C):** Add UI hints to guide users to connect Gmail first
3. **Long term consideration:** Evaluate if Calendar and Drive should even show as separate integrations, or just be "capabilities" under Gmail

### Why This Combination?

- **Option A** fixes the immediate bug — connections will persist
- **Option C** improves UX — users understand the relationship
- **Low risk** — both are additive, non-breaking changes
- **Fast implementation** — can be done in a single PR

---

## Additional Issues Discovered

### Microsoft Teams Has Same Bug

**File:** `packages/agentc2/src/mcp/client.ts`  
**Lines:** 783-828

Microsoft Teams provider has:
- `authType: "oauth"`
- `providerType: "oauth"`
- `oauthConfig.siblingOf: "microsoft"`
- `setupUrl: "/mcp/microsoft"`
- **No `syncEndpoint`** ❌

However, Microsoft uses a **custom OAuth flow** with `/api/integrations/microsoft/start` and `/callback` endpoints, so it may work differently. The Microsoft callback route (line 158-179) handles auto-provisioning directly.

**Recommendation:** Test Microsoft Teams connection flow separately and apply same fix if broken.

---

## Verification in Production

### How to Confirm the Bug is Present

**Database Query to Check Current State:**

```sql
-- Check if user has Google Account linked in Better Auth
SELECT 
    u.email as user_email,
    a.provider_id,
    a.scope,
    a.access_token IS NOT NULL as has_access_token,
    a.refresh_token IS NOT NULL as has_refresh_token,
    a.access_token_expires_at,
    a.created_at,
    a.updated_at
FROM account a
JOIN "user" u ON a.user_id = u.id
WHERE u.email = 'sdlc-test@agentc2.ai'
  AND a.provider_id = 'google';

-- Check if IntegrationConnections exist for Google services
SELECT 
    ic.id,
    ic.name,
    ic.is_active,
    ip.key as provider_key,
    ic.created_at,
    ic.credentials IS NOT NULL as has_credentials,
    ic.metadata->>'gmailAddress' as gmail_address
FROM integration_connection ic
JOIN integration_provider ip ON ic.provider_id = ip.id
JOIN membership m ON ic.organization_id = m.organization_id
JOIN "user" u ON m.user_id = u.id
WHERE u.email = 'sdlc-test@agentc2.ai'
  AND ip.key IN ('gmail', 'google-calendar', 'google-drive')
ORDER BY ip.key, ic.created_at;
```

**Expected findings if bug is present:**
- ✅ `account` record exists with `provider_id = 'google'` and valid tokens
- ✅ `scope` field includes Calendar and/or Drive scopes
- ❌ No `integration_connection` records for `google-calendar` or `google-drive`
- ⚠️ Possibly no `integration_connection` for `gmail` either (if user never used Gmail page)

### Browser DevTools Check

1. Navigate to `/mcp/providers/google-calendar`
2. Open browser DevTools → Console tab
3. Click "Continue" and complete OAuth
4. After redirect to `?oauth_return=1`, check console for:
   - No errors (silent failure)
   - Network tab shows no POST to `/api/integrations/*/sync`
   - Page state doesn't change to "success"

---

## Testing Plan

### Before Fix (Reproduction Steps)

1. Log in as a test user (e.g., sdlc-test@agentc2.ai)
2. Navigate to `/mcp/providers/google-calendar`
3. Click "Continue" on overview
4. Complete Google OAuth, grant permissions
5. **Expected bug:** Redirected back, no connection created, no feedback shown
6. **Verify:** Run database query above - no `integration_connection` for google-calendar

### After Fix (Validation Steps)

**For Option A implementation:**

1. **Test Google Calendar direct connection:**
   - Navigate to `/mcp/providers/google-calendar`
   - Click "Continue"
   - Complete OAuth
   - Verify: Success screen shown
   - Verify: IntegrationConnection created in database
   - Verify: Skill and Agent auto-provisioned
   - Verify: Tools available in tool registry

2. **Test Google Drive direct connection:**
   - Same steps as Calendar
   - Verify all success criteria

3. **Test Gmail connection (ensure still works):**
   - Navigate to `/mcp/gmail` or `/mcp/providers/gmail`
   - Complete OAuth
   - Verify Gmail connection created
   - Verify siblings (Calendar, Drive) also created

4. **Test re-authentication:**
   - Delete existing connections
   - Connect Calendar first → verify works
   - Connect Drive second → verify uses existing OAuth tokens
   - Connect Gmail third → verify all three now active

5. **Test missing scopes:**
   - Modify OAuth consent to remove Calendar scope
   - Try connecting Calendar → verify error message shown

### Database Validation Queries

```sql
-- Check all Google connections for an org
SELECT 
    ic.id, 
    ic.name, 
    ic.isActive, 
    ip.key as provider_key,
    ic.metadata->>'gmailAddress' as email
FROM integration_connection ic
JOIN integration_provider ip ON ic.provider_id = ip.id
WHERE ic.organization_id = '<org-id>'
  AND ip.key IN ('gmail', 'google-calendar', 'google-drive')
ORDER BY ic.created_at;

-- Check Better Auth Account tokens
SELECT 
    a.provider_id,
    a.access_token IS NOT NULL as has_access_token,
    a.refresh_token IS NOT NULL as has_refresh_token,
    a.scope,
    a.access_token_expires_at,
    u.email
FROM account a
JOIN user u ON a.user_id = u.id
WHERE a.provider_id = 'google'
  AND u.email = 'sdlc-test@agentc2.ai';
```

---

## Files Requiring Changes

### Option A Implementation

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/agentc2/src/mcp/client.ts` | **Modify** | Add `syncEndpoint` and `statusEndpoint` to google-calendar config (lines 622-639) |
| `packages/agentc2/src/mcp/client.ts` | **Modify** | Add `syncEndpoint` and `statusEndpoint` to google-drive config (lines 640-663) |
| `apps/agent/src/app/api/integrations/google-calendar/sync/route.ts` | **Create** | New sync endpoint that calls `syncGmailFromAccount()` |
| `apps/agent/src/app/api/integrations/google-calendar/status/route.ts` | **Create** | Status endpoint to check Calendar connection |
| `apps/agent/src/app/api/integrations/google-drive/sync/route.ts` | **Create** | New sync endpoint that calls `syncGmailFromAccount()` |
| `apps/agent/src/app/api/integrations/google-drive/status/route.ts` | **Create** | Status endpoint to check Drive connection |

### Option C Implementation (Complementary)

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/agent/src/components/integrations/SetupWizard.tsx` | **Modify** | Add sibling dependency warning in OverviewStep |
| `apps/agent/src/components/integrations/PlatformsTab.tsx` | **Modify** | Show "Requires Gmail" badge on Calendar/Drive cards |

---

## Edge Cases and Considerations

### 1. Partial Scope Grants

**Scenario:** User authenticates but only grants Gmail permissions, not Calendar/Drive.

**Current behavior:** 
- `syncSiblingGoogleConnections()` checks if each sibling's required scopes are present
- If scopes missing, that sibling is skipped (no error)
- Result: Gmail connected, Calendar/Drive not connected

**Impact on fix:**
- Sync endpoints should check if the specific provider's connection was created
- Return appropriate error: "Google Calendar scopes not granted"
- User can re-authenticate with correct permissions

**Example:** User unchecks "Access Google Calendar" during OAuth consent.

### 2. Multiple OAuth Attempts

**Scenario:** User tries to connect Calendar multiple times without success.

**Current behavior:**
- Each attempt creates/updates the Better Auth `Account` record
- `accessToken` and `refreshToken` are replaced on each attempt
- No duplicate `IntegrationConnection` records (unique constraint on org + provider)

**Impact on fix:**
- Sync endpoints should be idempotent
- `syncGmailFromAccount()` and `saveGmailCredentials()` handle upsert logic correctly ✅
- Multiple calls safe

### 3. Token Expiry During Setup

**Scenario:** User completes OAuth but waits >1 hour before the sync runs (token expires).

**Current behavior:**
- `Account.accessToken` has short TTL (~1 hour)
- `Account.refreshToken` is long-lived
- Gmail API client auto-refreshes using refresh token ✅

**Impact on fix:**
- Sync endpoints inherit Gmail's token refresh logic ✅
- No additional handling needed

### 4. Workspace Not Created Yet

**Scenario:** New user signs up, OAuth completes, but default workspace doesn't exist yet.

**Current behavior:**
- Post-bootstrap hook creates organization
- Workspace should be created during bootstrap
- Auto-provisioning checks for default workspace before creating Skill/Agent

**Impact on fix:**
- Sync endpoints delegate to `syncGmailFromAccount()` which doesn't provision directly
- Provisioning happens in `syncSiblingGoogleConnections()` (line 298-317 in gmail.ts)
- If no workspace found, provisioning is skipped (non-fatal) ✅

### 5. Concurrent OAuth Flows

**Scenario:** User opens Calendar and Drive tabs, clicks Connect on both simultaneously.

**Current behavior (buggy):**
- Both create separate Better Auth OAuth flows
- Both redirect back to their respective pages
- Both fail to create connections (missing syncEndpoint)

**After fix:**
- Both would call their respective sync endpoints
- Both delegate to `syncGmailFromAccount()`
- `saveGmailCredentials()` has upsert logic (safe)
- `syncSiblingGoogleConnections()` has upsert logic (safe)
- Result: All connections created, no race conditions ✅

### 6. User Has Gmail But Not Calendar/Drive Scopes

**Scenario:** User connected Gmail months ago with only Gmail scopes. Now tries to connect Calendar.

**Current behavior (buggy):**
- User goes to Calendar page, clicks Connect
- OAuth flow only requests Calendar scopes (not full Google suite)
- Better Auth merges scopes into existing Account
- No sync runs (missing syncEndpoint)

**After fix:**
- Calendar sync endpoint runs
- Calls `syncGmailFromAccount()`
- Gmail connection updated with new tokens
- `syncSiblingGoogleConnections()` checks if Calendar scopes present
- If present: Calendar connection created ✅
- If absent: Skipped (non-fatal)

**Recommendation:** Update Calendar/Drive OAuth flow to request ALL Google scopes (not just their own) to ensure full suite is granted. This matches Gmail's behavior.

### 7. Google Search Console

**Note:** Google Search Console has the same configuration pattern as Calendar/Drive:
- `providerKey: "google-search-console"`
- `siblingOf: "gmail"`
- No `syncEndpoint`

Same fix should be applied to Search Console.

---

## Additional Recommendations

### 1. Add Better Error Handling

Currently, when the sync fails silently (line 1108 returns early), the user sees no feedback. Add error state:

```typescript
if (!oauthCfg?.syncEndpoint) {
    // Instead of silent return
    setConnectError(
        "This integration requires additional setup. Please connect via Gmail to enable Google Calendar and Drive."
    );
    setStep("error");
    return;
}
```

### 2. Add Integration to OAUTH_PROVIDER_MAP

Add google-calendar and google-drive to the hardcoded map as a fallback:

```typescript
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: { /* ... */ },
    "google-calendar": {
        socialProvider: "google",
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
        statusEndpoint: "/api/integrations/google-calendar/status",
        syncEndpoint: "/api/integrations/google-calendar/sync"
    },
    "google-drive": {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.file"
        ],
        statusEndpoint: "/api/integrations/google-drive/status",
        syncEndpoint: "/api/integrations/google-drive/sync"
    }
};
```

This ensures the endpoints are available even if the provider config is missing them.

### 3. Add E2E Integration Tests

Create integration tests for the OAuth flow:

**File:** `tests/integration/oauth-google.test.ts`

```typescript
describe("Google OAuth Integrations", () => {
    test("Gmail connection should auto-provision Calendar and Drive", async () => {
        // Mock OAuth flow
        // Verify all three connections created
    });
    
    test("Google Calendar direct connection should work", async () => {
        // Navigate to /mcp/providers/google-calendar
        // Complete OAuth
        // Verify connection persisted
    });
    
    test("Missing Calendar scopes should show error", async () => {
        // OAuth with only Gmail scopes
        // Try connecting Calendar
        // Verify error message shown
    });
});
```

### 4. Add Logging for Debugging

Add console logging in the SetupWizard effect to help diagnose future issues:

```typescript
// Post-OAuth return: detect oauth_return param, trigger sync, and show result
useEffect(() => {
    if (oauthReturnHandled.current) return;
    if (!provider) return;
    if (searchParams.get("oauth_return") !== "1") return;

    const oauthCfg = getOAuthConfig(provider);
    
    // Add logging
    console.log(`[SetupWizard] OAuth return for ${provider.key}:`, {
        hasOAuthConfig: !!oauthCfg,
        hasSyncEndpoint: !!oauthCfg?.syncEndpoint,
        siblingOf: oauthCfg?.siblingOf
    });
    
    if (!oauthCfg?.syncEndpoint) {
        console.warn(`[SetupWizard] No sync endpoint for ${provider.key}, skipping sync`);
        return;
    }
    
    // ... rest of sync logic
}, [provider, searchParams, apiBase]);
```

### 5. Add Telemetry/Metrics

Track OAuth flow success/failure rates to detect issues early:

**Recommended metrics:**
- `integration.oauth.started` - Counter with labels: provider, user_type (new/existing)
- `integration.oauth.completed` - Counter with labels: provider, status (success/failure/missing_sync)
- `integration.oauth.sync_failed` - Counter with labels: provider, error_type
- `integration.connection.created` - Counter with labels: provider, method (oauth/api_key)

**Implementation location:** 
- Inngest events in sync endpoints
- Client-side analytics in SetupWizard

This would have caught this bug in production through anomaly detection (high oauth.completed but low connection.created for Calendar/Drive).

### 6. Add Documentation

**Create:** `docs/integrations/google-workspace.md`

Document the shared OAuth architecture:
```markdown
# Google Workspace Integrations

Gmail, Google Calendar, Google Drive, and Google Search Console all use the same Google OAuth flow.

## How It Works

1. **Single OAuth consent:** When you connect any Google service, you grant permissions for all services in one flow
2. **Automatic provisioning:** Connecting Gmail automatically enables Calendar and Drive (if those scopes were granted)
3. **Shared credentials:** All Google tools use the same OAuth tokens

## Connecting Google Services

### Option 1: Connect Gmail (Recommended)
1. Navigate to Integrations → Gmail
2. Click "Reconnect Gmail"  
3. Grant all permissions (Gmail, Calendar, Drive)
4. ✅ All three services will be connected automatically

### Option 2: Connect Individually
1. Navigate to the specific service (Calendar or Drive)
2. Click "Connect"
3. Grant permissions
4. ✅ Connection persists (after fix is deployed)

## Troubleshooting

**"Calendar/Drive not showing as connected after OAuth"**
- Cause: You may have only granted Gmail permissions
- Fix: Reconnect Gmail and ensure all permissions are checked
```

---

## Quick Reference

### The Bug in One Sentence
Google Calendar and Google Drive OAuth flows complete successfully but fail to create database connections because the SetupWizard requires a `syncEndpoint` that these providers don't have.

### The Fix in One Sentence
Create sync and status API endpoints for google-calendar and google-drive that delegate to the existing Gmail sync logic, then update provider configs to reference these endpoints.

### Files Changed (Option A)
- ✏️ Modify: `packages/agentc2/src/mcp/client.ts` (add syncEndpoint to 2 providers)
- ➕ Create: `apps/agent/src/app/api/integrations/google-calendar/sync/route.ts`
- ➕ Create: `apps/agent/src/app/api/integrations/google-calendar/status/route.ts`
- ➕ Create: `apps/agent/src/app/api/integrations/google-drive/sync/route.ts`
- ➕ Create: `apps/agent/src/app/api/integrations/google-drive/status/route.ts`

### Risk Level
🟢 **LOW** - Additive changes only, no breaking modifications to existing flows

### Estimated Effort
⏱️ **2-3 hours** - Mostly boilerplate, reusing existing logic

---

## Summary

### Root Cause
The SetupWizard component expects all OAuth providers to have a `syncEndpoint` in their `oauthConfig`, but google-calendar and google-drive only have `siblingOf: "gmail"` without sync endpoints. When users authenticate directly from these provider pages, the OAuth flow completes successfully, but no IntegrationConnection is created because the sync step is silently skipped (line 1108 returns early).

### Immediate Fix
Create sync and status API endpoints for google-calendar and google-drive that reuse the existing Gmail sync logic (`syncGmailFromAccount()`). Update provider configs to reference these new endpoints.

### Long-term Fix
Add UI warnings when accessing sibling providers without parent connected, and consider consolidating Google services under a single "Google Workspace" integration to reduce user confusion.

### Why This Matters
- **User Impact:** High frustration, blocked workflows, support burden
- **Data Impact:** OAuth tokens stored but unusable, tools unavailable
- **Business Impact:** Integration features don't work, poor user experience
- **Security Impact:** None - proper OAuth flows, just missing persistence layer

---

## Visual Flow Diagrams

### Current Broken Flow (Google Calendar/Drive)

```
User clicks "Connect" on Google Calendar
           ↓
    SetupWizard loads provider config
           ↓
    Detects: isNativeOAuth = true (has oauthConfig)
           ↓
    Calls handleNativeOAuth()
           ↓
    linkSocial({ provider: "google", scopes: [...calendar...], callbackURL: "/mcp/providers/google-calendar?oauth_return=1" })
           ↓
    → Redirect to Google OAuth consent screen
           ↓
    User grants permissions
           ↓
    Google redirects to Better Auth callback: /api/auth/callback/google
           ↓
    Better Auth processes callback:
      - Creates/updates Account record with tokens ✅
      - Checks if new org creation (existing user = false) ✅
      - Post-bootstrap hooks NOT called (existing org) ✅
           ↓
    Better Auth redirects to: /mcp/providers/google-calendar?oauth_return=1
           ↓
    SetupWizard effect runs (line 1102):
      - Detects oauth_return=1 ✅
      - Gets oauthConfig: { socialProvider: "google", scopes: [...], siblingOf: "gmail" }
      - Checks oauthCfg?.syncEndpoint → UNDEFINED ❌
      - Line 1108: if (!oauthCfg?.syncEndpoint) return; → EXITS EARLY ❌
           ↓
    ❌ NO CONNECTION CREATED
    ❌ NO FEEDBACK TO USER
    ❌ USER LEFT IN BROKEN STATE
```

### Working Flow (Gmail)

```
User clicks "Reconnect Gmail" on /mcp/gmail
           ↓
    linkSocial({ provider: "google", scopes: [...all Google scopes...], callbackURL: "/mcp/gmail" })
           ↓
    → Redirect to Google OAuth consent screen
           ↓
    User grants permissions (Gmail + Calendar + Drive + Search Console)
           ↓
    Google redirects to Better Auth callback: /api/auth/callback/google
           ↓
    Better Auth processes callback:
      - Creates/updates Account record with ALL tokens ✅
      - For NEW users only: calls post-bootstrap hook → syncGmailFromAccount() ✅
           ↓
    Better Auth redirects to: /mcp/gmail
           ↓
    Gmail page loads, shows "Reconnect Gmail" button
    (Note: No automatic sync triggered for existing users!)
           ↓
    (For existing users) Must manually call /api/integrations/gmail/sync:
      - User can trigger via another flow, OR
      - Admin calls sync endpoint manually
           ↓
    Gmail sync endpoint (/api/integrations/gmail/sync):
      - Reads Account tokens ✅
      - Calls saveGmailCredentials() → creates Gmail connection ✅
      - Calls syncSiblingGoogleConnections() → creates Calendar, Drive, Search Console connections ✅
      - Triggers auto-provisioning for each ✅
           ↓
    ✅ ALL CONNECTIONS CREATED
    ✅ SKILLS AND AGENTS PROVISIONED
    ✅ TOOLS AVAILABLE
```

### Intended Flow After Fix (Option A)

```
User clicks "Connect" on Google Calendar
           ↓
    SetupWizard loads provider config (now includes syncEndpoint) ✅
           ↓
    OAuth flow completes → redirect to /mcp/providers/google-calendar?oauth_return=1
           ↓
    SetupWizard effect runs:
      - Gets oauthConfig: { ..., syncEndpoint: "/api/integrations/google-calendar/sync" } ✅
      - Calls sync endpoint ✅
           ↓
    Google Calendar sync endpoint:
      - Calls syncGmailFromAccount() (reuses Gmail logic) ✅
      - Gmail sync creates Gmail connection
      - Sibling sync creates Calendar, Drive, Search Console connections ✅
           ↓
    ✅ SUCCESS SCREEN SHOWN
    ✅ ALL GOOGLE SERVICES CONNECTED
```

---

## Related Code References

### Key Functions
- `syncSiblingGoogleConnections()` - `apps/agent/src/lib/gmail.ts:182-323`
- `syncGmailFromAccount()` - `apps/agent/src/lib/gmail-sync.ts:49-142`
- `saveGmailCredentials()` - `apps/agent/src/lib/gmail.ts:68-172`
- `getOAuthConfig()` - `apps/agent/src/components/integrations/SetupWizard.tsx:149-155`

### Key Files
- Provider configs: `packages/agentc2/src/mcp/client.ts`
- SetupWizard: `apps/agent/src/components/integrations/SetupWizard.tsx`
- Gmail sync: `apps/agent/src/app/api/integrations/gmail/sync/route.ts`
- OAuth requirements: `packages/agentc2/src/tools/oauth-requirements.ts`

### Database Tables
- `integration_provider` - Provider definitions
- `integration_connection` - Org-scoped OAuth connections
- `account` - Better Auth user OAuth tokens
- `skill` - Auto-provisioned skills
- `agent` - Auto-provisioned agents

---

---

## Implementation Checklist (For Developer)

When implementing Option A, follow these steps:

### Phase 1: Create Sync Endpoints (30 min)

- [ ] Create `apps/agent/src/app/api/integrations/google-calendar/sync/route.ts`
  - [ ] Copy structure from gmail/sync/route.ts
  - [ ] Update provider key checks to "google-calendar"
  - [ ] Update error messages
  - [ ] Verify Calendar connection was created after sync
- [ ] Create `apps/agent/src/app/api/integrations/google-drive/sync/route.ts`
  - [ ] Copy structure from google-calendar/sync/route.ts
  - [ ] Update provider key to "google-drive"
  - [ ] Update error messages

### Phase 2: Create Status Endpoints (20 min)

- [ ] Create `apps/agent/src/app/api/integrations/google-calendar/status/route.ts`
  - [ ] Copy structure from gmail/status/route.ts
  - [ ] Update provider key to "google-calendar"
  - [ ] Return connection status
- [ ] Create `apps/agent/src/app/api/integrations/google-drive/status/route.ts`
  - [ ] Copy structure from google-calendar/status/route.ts
  - [ ] Update provider key to "google-drive"

### Phase 3: Update Provider Configs (10 min)

- [ ] Edit `packages/agentc2/src/mcp/client.ts`
  - [ ] Line ~634: Add `statusEndpoint` and `syncEndpoint` to google-calendar oauthConfig
  - [ ] Line ~658: Add `statusEndpoint` and `syncEndpoint` to google-drive oauthConfig
  - [ ] Optional: Add same to google-search-console (line ~677)

### Phase 4: Testing (45 min)

- [ ] Test Google Calendar direct connection flow
  - [ ] Navigate to `/mcp/providers/google-calendar`
  - [ ] Complete OAuth
  - [ ] Verify success screen shows
  - [ ] Verify IntegrationConnection created in DB
  - [ ] Verify Skill and Agent auto-provisioned
- [ ] Test Google Drive direct connection flow
  - [ ] Same steps as Calendar
  - [ ] Verify all success criteria
- [ ] Test Gmail connection still works
  - [ ] Navigate to `/mcp/gmail`
  - [ ] Click "Reconnect Gmail"
  - [ ] Verify all three connections created
- [ ] Test partial scope scenario
  - [ ] Mock OAuth response with only Gmail scopes
  - [ ] Try connecting Calendar
  - [ ] Verify appropriate error shown
- [ ] Test with existing connections
  - [ ] User already has Gmail connected
  - [ ] Connect Calendar → verify uses existing tokens
  - [ ] Verify no duplicate connections

### Phase 5: Code Quality (15 min)

- [ ] Run `bun run format`
- [ ] Run `bun run lint` - fix any errors
- [ ] Run `bun run type-check` - fix any errors
- [ ] Run `bun run build` - verify succeeds
- [ ] Review changes with `git diff`

### Phase 6: Commit & Push (10 min)

- [ ] Stage changes: `git add -A`
- [ ] Commit: `git commit -m "fix: add sync endpoints for Google Calendar and Drive (resolves #159)"`
- [ ] Push: `git push origin cursor/integrations-connection-root-cause-25b3`
- [ ] Link PR to issue #159

### Total Estimated Time: ~2.5 hours

---

---

## Confidence Assessment

### Root Cause Identification: ✅ VERY HIGH (95%+)

**Evidence:**
- ✅ Exact code location identified (SetupWizard.tsx:1108)
- ✅ Configuration mismatch confirmed (missing syncEndpoint)
- ✅ Flow traced from UI click through OAuth to failed persistence
- ✅ Working reference implementation exists (Gmail)
- ✅ Consistent pattern across multiple affected providers

**Uncertainties:**
- Minor: Browser console logs from actual user not captured (but logic is definitive)
- Minor: Database state not directly inspected (but can be verified with queries above)

### Fix Approach Validation: ✅ HIGH (90%+)

**Evidence:**
- ✅ Similar pattern already works for Gmail
- ✅ Reuses battle-tested sync logic (`syncGmailFromAccount`, `syncSiblingGoogleConnections`)
- ✅ Low-risk additive changes
- ✅ Clear implementation path
- ✅ Comprehensive test plan included

**Risks Mitigated:**
- ✅ Edge cases documented and handled
- ✅ Rollback plan: delete new endpoints, remove config changes
- ✅ No data migrations required
- ✅ Backward compatible with existing Gmail flow

---

**Analysis completed by:** Claude (Cloud Agent)  
**Analysis date:** March 12, 2026  
**Analysis time:** ~45 minutes  
**Status:** ✅ Ready for Implementation  
**Next step:** Developer implements Option A following checklist above

**Approved for implementation:** ⏳ Pending human review

# Root Cause Analysis: Google Search Console Agent Authorization Failure

**Issue ID:** GitHub Issue #188  
**Reporter:** User  
**Date:** 2026-03-13  
**Status:** Analysis Complete - Ready for Fix Implementation

---

## Executive Summary

The Google Search Console agent (`gsc-agent`) fails with an authorization error despite showing an active connection and 4 healthy tools. The root cause is a **scope validation gap** between the connection test and actual tool execution. The connection test validates only that OAuth tokens exist, but does NOT verify that the required `webmasters.readonly` scope was granted during the OAuth flow.

**Severity:** High  
**User Impact:** GSC integration is non-functional, blocking SEO analytics features  
**Fix Complexity:** Medium (requires multi-layer validation improvements)

---

## Reproduction Steps

1. **Connection Test (Passes):**
   ```
   integration_connection_test(connectionId: 'cmmo3rowu004p8eo53hn25qea')
   → {success: true, connected: true}
   ```

2. **Tool Discovery (Passes):**
   ```
   integration_tools_list(providerKey: 'google-search-console')
   → Returns 4 tools: gsc-list-sites, gsc-query-analytics, gsc-get-sitemaps, gsc-inspect-url
   → All tools show validationStatus: 'healthy'
   ```

3. **Agent Invocation (Fails):**
   ```
   agent_invoke_dynamic(agentSlug: 'gsc-agent', message: 'List all verified sites in Google Search Console.')
   → Agent responds: 'Please ensure that you have granted the necessary permissions for Google Search Console access.'
   ```

---

## Root Cause Analysis

### 1. The Connection Test Gap

**File:** `packages/agentc2/src/tools/integration-import-tools.ts`  
**Lines:** 873-951 (function `integrationConnectionTestTool`)

The connection test for OAuth providers (lines 942-946) only checks for token presence:

```typescript:873:951:packages/agentc2/src/tools/integration-import-tools.ts
export const integrationConnectionTestTool = createTool({
    id: "integration-connection-test",
    description: "Test an integration connection by validating credentials and listing MCP tools.",
    inputSchema: z.object({
        connectionId: z.string(),
        organizationId: z.string().optional(),
        userId: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        toolCount: z.number().optional(),
        sampleTools: z.array(z.string()).optional(),
        missingFields: z.array(z.string()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId, userId }) => {
        const orgId = await resolveOrganizationId({ organizationId, userId });
        if (!orgId) {
            return { success: false, error: "Organization context is required" };
        }

        const connection = await prisma.integrationConnection.findFirst({
            where: { id: connectionId, organizationId: orgId },
            include: { provider: true }
        });
        if (!connection) {
            return { success: false, error: "Connection not found" };
        }

        const credentials =
            connection.credentials && typeof connection.credentials === "object"
                ? (connection.credentials as Record<string, string>)
                : {};
        const requiredFields = getRequiredFields(connection.provider.configJson);
        const missingFields = getMissingFields(requiredFields, credentials);
        if (missingFields.length > 0) {
            return { success: false, missingFields };
        }

        if (
            connection.provider.providerType === "mcp" ||
            connection.provider.providerType === "custom"
        ) {
            try {
                const { tools } = await getMcpTools({
                    organizationId: orgId,
                    userId: userId || null
                });
                const serverId = resolveServerId(
                    connection.provider.key,
                    connection.id,
                    connection.isDefault
                );
                const toolNames = Object.keys(tools).filter((name) =>
                    name.startsWith(`${serverId}_`)
                );
                return {
                    success: toolNames.length > 0,
                    toolCount: toolNames.length,
                    sampleTools: toolNames.slice(0, 5)
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to test MCP tools"
                };
            }
        }

        if (connection.provider.authType === "oauth") {
            const connected = Boolean(
                credentials.accessToken || credentials.refreshToken || credentials.oauthToken
            );
            return { success: connected };
        }

        return { success: true };
    }
});
```

**Problem:** Lines 942-946 validate only token presence, NOT API scopes. This returns `{success: true}` even when the token lacks the `webmasters.readonly` scope.

### 2. Tool Execution Scope Validation

**File:** `packages/agentc2/src/tools/google-search-console/list-sites.ts`  
**Lines:** 40-50

At execution time, the GSC tools perform rigorous scope validation:

```typescript:40:50:packages/agentc2/src/tools/google-search-console/list-sites.ts
    execute: async ({ gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const scopeCheck = await checkGoogleScopes(address, GSC_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    sites: [],
                    error: `Google Search Console requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth.`
                };
            }
```

**File:** `packages/agentc2/src/tools/gmail/shared.ts`  
**Lines:** 232-266 (function `checkGoogleScopes`)

The `checkGoogleScopes` function extracts the `scope` field from stored credentials and validates required scopes:

```typescript:232:266:packages/agentc2/src/tools/gmail/shared.ts
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

This explains the agent error: The tool execution detects missing scopes and returns an error message prompting re-authorization.

### 3. OAuth Flow and Scope Request

**File:** `packages/auth/src/google-scopes.ts`  
**Lines:** 15-29

The OAuth flow correctly includes the `webmasters.readonly` scope:

```typescript:15:29:packages/auth/src/google-scopes.ts
export const GOOGLE_OAUTH_SCOPES = [
    // Gmail — gmail.modify is a superset covering read, compose, draft, send, label.
    // No need for gmail.send separately since gmail.modify already includes it.
    "https://www.googleapis.com/auth/gmail.modify",

    // Calendar — full CRUD on events
    "https://www.googleapis.com/auth/calendar.events",

    // Drive — read/search files + create Google Docs
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",

    // Search Console — read-only search analytics, sitemaps, URL inspection
    "https://www.googleapis.com/auth/webmasters.readonly"
] as const;
```

**File:** `apps/agent/src/lib/google-oauth.ts`  
**Lines:** 67-89

The authorization URL builder uses these scopes:

```typescript:67:89:apps/agent/src/lib/google-oauth.ts
export function buildGoogleAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scopes?: readonly string[];
}): string {
    const { clientId, redirectUri, state, codeChallenge, scopes } = params;
    const scopeString = (scopes || GOOGLE_OAUTH_SCOPES).join(" ");
    const url = new URL(AUTHORIZATION_ENDPOINT);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopeString);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return url.toString();
}
```

### 4. Sibling Connection Sync Logic

**File:** `apps/agent/src/lib/gmail.ts`  
**Lines:** 180-321 (function `syncSiblingGoogleConnections`)

After Google OAuth completes, sibling connections (Calendar, Drive, Search Console) are created only if the token has the required scopes:

```typescript:191:223:apps/agent/src/lib/gmail.ts
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
```

**Critical Logic:** Line 222 checks `hasScopes` before creating the sibling connection. If the Google OAuth token does NOT include `webmasters.readonly`, the GSC connection is never created.

**However:** If a GSC connection exists (indicating the scope WAS granted initially), but the stored `scope` field in credentials is missing or incomplete, the connection test passes while tool execution fails.

---

## Likely Root Causes (Ranked by Probability)

### 1. **Incomplete OAuth Consent (Most Likely)**

**Scenario:** User denied the Search Console scope during the OAuth consent screen, or the scope wasn't requested due to a temporary configuration issue.

**Evidence:**
- The sibling sync logic (line 222 in `gmail.ts`) would skip creating the GSC connection if the scope is missing
- Yet the user has a GSC connection (`cmmo3rowu004p8eo53hn25qea`), suggesting the scope WAS granted at some point
- The connection may have been created manually or the scope was revoked post-creation

**Fix Required:** Re-authorize via `/api/integrations/google/start` to re-request all scopes.

### 2. **Scope Field Corruption or Missing**

**Scenario:** The `credentials.scope` field in the database is NULL, empty, or malformed due to a credential migration or encryption key mismatch.

**Evidence:**
- Line 262 in `gmail/shared.ts`: `const grantedScopes = new Set((creds?.scope || "").split(/[,\s]+/).filter(Boolean));`
- If `creds?.scope` is null or empty, `grantedScopes` will be an empty set, causing all scope checks to fail

**Fix Required:** Database inspection to verify the `scope` field in `IntegrationConnection.credentials`.

### 3. **Search Console API Not Enabled in Google Cloud Console**

**Scenario:** The Google Cloud project associated with `GOOGLE_CLIENT_ID` does not have the Search Console API enabled.

**Evidence:**
- Google returns tokens with the requested scopes only if the corresponding APIs are enabled
- If the API is disabled, Google may silently omit the scope from the returned token

**Fix Required:** Enable "Google Search Console API" in the Google Cloud Console (APIs & Services → Library).

### 4. **Token Refresh Lost Scope**

**Scenario:** During token refresh, Google returned a new access token with fewer scopes than originally granted.

**Evidence:**
- OAuth refresh token responses can have reduced scopes if the user revoked permissions via Google Account settings
- The stored `scope` field may not be updated during refresh (refresh responses don't always include the `scope` field)

**Fix Required:** Update token refresh logic to detect scope changes and trigger re-authorization if scopes are missing.

---

## Impact Assessment

### Affected Components

1. **Google Search Console Agent (`gsc-agent`)**
   - **File:** `packages/agentc2/src/integrations/blueprints/marketing.ts` (lines 143-159)
   - **Impact:** Completely non-functional

2. **Google Search Console Skill (`gsc-expert`)**
   - **File:** `packages/agentc2/src/integrations/blueprints/marketing.ts` (lines 115-142)
   - **Impact:** Cannot provide SEO insights

3. **GSC Tools (All 4 tools)**
   - `gsc-list-sites` (`packages/agentc2/src/tools/google-search-console/list-sites.ts`)
   - `gsc-query-analytics` (`packages/agentc2/src/tools/google-search-console/query-analytics.ts`)
   - `gsc-get-sitemaps` (`packages/agentc2/src/tools/google-search-console/get-sitemaps.ts`)
   - `gsc-inspect-url` (`packages/agentc2/src/tools/google-search-console/inspect-url.ts`)
   - **Impact:** All return authorization errors

4. **Connection Test Tool**
   - **File:** `packages/agentc2/src/tools/integration-import-tools.ts` (lines 873-951)
   - **Impact:** False positive — reports `success: true` when connection is actually broken

### Broader System Impact

- **Gmail/Calendar/Drive integrations:** Unaffected (use different scopes)
- **Other OAuth providers:** Same false-positive risk exists for Microsoft, Dropbox, etc.
- **User Trust:** Connection health indicators are misleading

---

## Detailed Fix Plan

### Phase 1: Immediate Fix (User Workaround)

**Objective:** Get the user's GSC integration working immediately.

**Steps:**

1. **Verify Connection Credentials:**
   ```sql
   SELECT id, "organizationId", "providerId", "isActive", "isDefault", 
          "credentials", "metadata", "lastTestedAt", "errorMessage"
   FROM "IntegrationConnection"
   WHERE id = 'cmmo3rowu004p8eo53hn25qea';
   ```

2. **Decrypt and Inspect Scope Field:**
   - Use the `decrypt` helper from `packages/agentc2/src/tools/gmail/shared.ts`
   - Check if `credentials.scope` includes `https://www.googleapis.com/auth/webmasters.readonly`

3. **If Scope is Missing:**
   - Delete the GSC connection: `DELETE FROM "IntegrationConnection" WHERE id = 'cmmo3rowu004p8eo53hn25qea';`
   - Re-authorize via: `/api/integrations/google/start?returnUrl=/mcp/gmail`
   - Verify the new connection includes the scope

**Risk:** Low (manual, no code changes)  
**Estimated Time:** 15 minutes

---

### Phase 2: Enhanced Connection Test (Core Fix)

**Objective:** Make connection tests validate API-specific scopes for OAuth providers.

**File to Modify:** `packages/agentc2/src/tools/integration-import-tools.ts`

**Changes:**

1. **Add Scope Validation for OAuth Providers (lines 942-946):**

   **Current Code:**
   ```typescript
   if (connection.provider.authType === "oauth") {
       const connected = Boolean(
           credentials.accessToken || credentials.refreshToken || credentials.oauthToken
       );
       return { success: connected };
   }
   ```

   **Proposed Fix:**
   ```typescript
   if (connection.provider.authType === "oauth") {
       const hasToken = Boolean(
           credentials.accessToken || credentials.refreshToken || credentials.oauthToken
       );
       if (!hasToken) {
           return { success: false, error: "OAuth token missing" };
       }

       // Validate required scopes
       const configJson = connection.provider.configJson as Record<string, unknown> | null;
       const requiredScopes = Array.isArray(configJson?.requiredScopes)
           ? (configJson.requiredScopes as string[])
           : [];

       if (requiredScopes.length > 0) {
           const grantedScopes = new Set(
               (credentials.scope || "")
                   .toString()
                   .split(/[,\s]+/)
                   .filter(Boolean)
           );
           const missingScopes = requiredScopes.filter((s) => !grantedScopes.has(s));

           if (missingScopes.length > 0) {
               return {
                   success: false,
                   error: `Missing required OAuth scopes: ${missingScopes.join(", ")}. Re-authorize to grant access.`,
                   missingFields: missingScopes
               };
           }
       }

       return { success: true };
   }
   ```

2. **Update IntegrationProvider `configJson` Schema:**

   Ensure all OAuth providers have a `requiredScopes` array in their `configJson`. Google Search Console already has this (line 675 in `mcp/client.ts`):

   ```typescript:674:676:packages/agentc2/src/mcp/client.ts
       configJson: {
           requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
           oauthConfig: {
   ```

**Risk:** Low (defensive — preserves existing behavior for providers without `requiredScopes`)  
**Estimated Time:** 30 minutes coding + 30 minutes testing

---

### Phase 3: Token Refresh Scope Monitoring

**Objective:** Detect when refreshed tokens have fewer scopes than expected and trigger re-authorization.

**File to Modify:** `packages/agentc2/src/tools/gmail/shared.ts`

**Changes:**

1. **Update `refreshAccessToken` Function (lines 46-65):**

   **Current Code:**
   ```typescript
   export const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
       const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
       const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
       if (!clientId || !clientSecret) return null;

       const response = await fetch(TOKEN_ENDPOINT, {
           method: "POST",
           headers: { "Content-Type": "application/x-www-form-urlencoded" },
           body: new URLSearchParams({
               client_id: clientId,
               client_secret: clientSecret,
               refresh_token: refreshToken,
               grant_type: "refresh_token"
           })
       });

       if (!response.ok) return null;
       const result = (await response.json()) as { access_token?: string };
       return result.access_token || null;
   };
   ```

   **Proposed Enhancement:**
   ```typescript
   export const refreshAccessToken = async (
       refreshToken: string
   ): Promise<{ accessToken: string; scope?: string } | null> => {
       const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
       const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
       if (!clientId || !clientSecret) return null;

       const response = await fetch(TOKEN_ENDPOINT, {
           method: "POST",
           headers: { "Content-Type": "application/x-www-form-urlencoded" },
           body: new URLSearchParams({
               client_id: clientId,
               client_secret: clientSecret,
               refresh_token: refreshToken,
               grant_type: "refresh_token"
           })
       });

       if (!response.ok) return null;
       const result = (await response.json()) as {
           access_token?: string;
           scope?: string;
       };
       if (!result.access_token) return null;

       return {
           accessToken: result.access_token,
           scope: result.scope
       };
   };
   ```

2. **Update Callers to Store Refreshed Scope:**

   In `callGmailApi` (line 185) and `callGscApi` (line 79 in `google-search-console/shared.ts`), update the refreshed token handler:

   ```typescript
   const refreshed = await refreshAccessToken(creds.refreshToken as string);
   if (refreshed) {
       token = refreshed.accessToken;
       
       // Update stored scope if provided
       if (refreshed.scope) {
           await prisma.integrationConnection.update({
               where: { id: connection.id },
               data: {
                   credentials: encrypt({
                       ...creds,
                       accessToken: refreshed.accessToken,
                       scope: refreshed.scope
                   })
               }
           });
       }
       
       // Retry the request...
   }
   ```

**Risk:** Medium (requires updating multiple call sites)  
**Estimated Time:** 1 hour coding + 1 hour testing

---

### Phase 4: Connection Health Dashboard Enhancement

**Objective:** Show scope validation status in the Integrations Hub UI.

**Files to Modify:**
- `apps/agent/src/app/api/integrations/connections/route.ts` (or similar)
- Frontend component displaying connection status

**Changes:**

1. **Extend Connection API Response:**
   Add a `scopeStatus` field:
   ```typescript
   {
       id: string,
       providerKey: string,
       name: string,
       isActive: boolean,
       lastTestedAt: Date,
       scopeStatus?: {
           valid: boolean,
           missing?: string[]
       }
   }
   ```

2. **Update UI to Show Scope Warnings:**
   Display: "⚠️ Missing permissions: webmasters.readonly — Re-authorize to fix."

**Risk:** Low (UI-only, no breaking changes)  
**Estimated Time:** 2 hours

---

### Phase 5: Automated Re-Authorization Prompt

**Objective:** Detect authorization errors in agent runs and prompt the user to re-authorize.

**Implementation:**

1. **Add Error Detection in Agent Executor:**
   - When a tool returns an error containing "requires scope:" or "Re-authorize", set a flag in the run metadata

2. **Show Banner in Agent UI:**
   - "This agent requires additional Google permissions. [Re-authorize now →](/api/integrations/google/start?returnUrl=/workspace/agents/gsc-agent)"

**Risk:** Low (non-breaking enhancement)  
**Estimated Time:** 2 hours

---

## Testing Strategy

### Unit Tests

1. **Test `checkGoogleScopes` with Missing Scopes:**
   ```typescript
   it("should detect missing webmasters.readonly scope", async () => {
       const result = await checkGoogleScopes("test@example.com", [
           "https://www.googleapis.com/auth/webmasters.readonly"
       ]);
       expect(result.ok).toBe(false);
       expect(result.missing).toContain("https://www.googleapis.com/auth/webmasters.readonly");
   });
   ```

2. **Test Enhanced Connection Test:**
   ```typescript
   it("should fail connection test when OAuth scopes are missing", async () => {
       const result = await integrationConnectionTestTool.execute({
           connectionId: "test-connection-id",
           organizationId: "test-org-id"
       });
       expect(result.success).toBe(false);
       expect(result.error).toContain("Missing required OAuth scopes");
   });
   ```

### Integration Tests

1. **End-to-End OAuth Flow:**
   - Start OAuth flow with all scopes
   - Verify GSC connection is created with correct scope
   - Test `gsc-list-sites` tool execution

2. **Scope Revocation Simulation:**
   - Manually remove `webmasters.readonly` from stored credentials
   - Run connection test → should fail
   - Run `gsc-list-sites` → should return scope error

3. **Token Refresh with Scope Change:**
   - Mock Google token refresh endpoint to return fewer scopes
   - Trigger refresh by expiring the access token
   - Verify scope field is updated in database

### Manual Testing Checklist

- [ ] Fresh Google OAuth authorization (all scopes granted)
- [ ] GSC connection test passes with scope validation
- [ ] `gsc-list-sites` returns verified sites
- [ ] `gsc-agent` invocation completes successfully
- [ ] Partial scope authorization (deny Search Console) → connection test fails
- [ ] Scope revocation via Google Account settings → next API call triggers re-auth prompt
- [ ] Token refresh preserves scope field

---

## Rollout Plan

### Deployment Steps

1. **Database Backup:** Export `IntegrationConnection` and `IntegrationProvider` tables
2. **Deploy Phase 2 (Enhanced Connection Test):**
   - Deploy to staging
   - Run connection tests for all OAuth integrations
   - Verify no false negatives
3. **Deploy Phase 3 (Token Refresh Monitoring):**
   - Deploy to staging
   - Monitor token refresh logs for 24 hours
4. **Deploy Phase 4 & 5 (UI Enhancements):**
   - Deploy to production
   - Announce to users via changelog

### Rollback Plan

If the enhanced connection test causes false failures:

1. Revert `integration-import-tools.ts` to remove scope validation
2. Database state unchanged (no migrations)
3. No data loss risk

---

## Related Issues and Future Improvements

### Similar Bugs

- **Microsoft OAuth:** Same false-positive risk exists for Outlook/Calendar integrations
- **Dropbox OAuth:** Connection test doesn't validate Dropbox-specific scopes

### Recommended Enhancements

1. **Standardize OAuth Connection Tests:**
   - Create a shared `validateOAuthConnection` helper used by all OAuth providers
   - Enforce `requiredScopes` field in all OAuth provider definitions

2. **Scope Audit Tool:**
   - Add a CLI command: `bun run audit:oauth-scopes`
   - Reports all connections with missing scopes

3. **Proactive Scope Monitoring:**
   - Background job that periodically tests OAuth connections
   - Auto-marks connections as `scopeIssue: true` when validation fails
   - Triggers in-app notification to user

4. **Better Error Messages:**
   - Agent responses should include actionable links: "Re-authorize Google [here](/api/integrations/google/start?returnUrl=...)"

---

## Conclusion

The Google Search Console authorization failure is caused by a **scope validation gap** between the connection test (which only checks token presence) and tool execution (which validates API-specific scopes). The fix requires:

1. **Immediate:** User re-authorizes Google OAuth to grant missing scope
2. **Short-term:** Enhanced connection test validates required scopes (Phase 2)
3. **Long-term:** Token refresh monitoring + UI enhancements (Phases 3-5)

**Estimated Total Implementation Time:** 6-8 hours (including testing)  
**Deployment Risk:** Low (backward-compatible changes)  
**User Impact Post-Fix:** GSC integration fully functional + improved reliability for all OAuth integrations

---

## Appendix: Relevant File Locations

### Core Implementation Files

| File | Purpose |
|------|---------|
| `packages/agentc2/src/tools/integration-import-tools.ts` | Connection test tool (lines 873-951) |
| `packages/agentc2/src/tools/gmail/shared.ts` | Scope validation helpers (lines 232-266) |
| `packages/agentc2/src/tools/google-search-console/*.ts` | GSC tool implementations (all 4 tools) |
| `packages/auth/src/google-scopes.ts` | OAuth scope definitions (lines 15-29) |
| `apps/agent/src/lib/google-oauth.ts` | OAuth URL builder (lines 67-89) |
| `apps/agent/src/lib/gmail.ts` | Sibling connection sync (lines 180-321) |
| `packages/agentc2/src/mcp/client.ts` | Integration provider seeds (lines 667-685) |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `packages/agentc2/src/integrations/blueprints/marketing.ts` | GSC agent/skill definitions (lines 113-160) |

### Database Tables

| Table | Relevant Columns |
|-------|------------------|
| `IntegrationProvider` | `key`, `authType`, `configJson` (requiredScopes) |
| `IntegrationConnection` | `id`, `credentials` (includes `scope` field), `providerId`, `organizationId` |
| `GmailIntegration` | `gmailAddress`, `workspaceId`, `isActive` |

---

**End of Root Cause Analysis**

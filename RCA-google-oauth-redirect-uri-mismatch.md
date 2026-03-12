# Root Cause Analysis: Google OAuth redirect_uri_mismatch (Error 400)

**Issue**: [#176](https://github.com/Appello-Prototypes/agentc2/issues/176)  
**Branch**: `cursor/google-oauth-redirect-uri-975b`  
**Date**: 2026-03-12  
**Severity**: **Critical** — Blocks Gmail, Calendar, Drive, and Search Console integrations in production

---

## Executive Summary

When users attempt to authenticate Google services (Gmail, Calendar, Drive) in the production environment (agentc2.ai), the OAuth flow fails with "Error 400: redirect_uri_mismatch". The application sends a redirect URI containing `/agent` prefix (`https://agentc2.ai/agent/api/integrations/google/callback`), but this URI is not configured in the Google Cloud Console, causing Google to reject the authorization request.

**Root Cause**: OAuth redirect URI builder functions include a hardcoded `/agent` prefix for production environments, but the Next.js basePath was removed on Feb 3, 2026. The agent app now serves at root (`/`), not under `/agent`, making the redirect URI incorrect.

**Impact**:
- **Gmail integration**: Cannot connect (100% broken in production)
- **Google Calendar integration**: Cannot connect (100% broken in production)
- **Google Drive integration**: Cannot connect (100% broken in production)
- **Google Search Console integration**: Cannot connect (100% broken in production)
- **Microsoft integrations**: Also affected (Outlook Mail, Outlook Calendar)
- **Dropbox integration**: Also affected
- **MCP OAuth integrations**: Also affected
- **Better Auth Google sign-in**: NOT affected (uses different callback route)

---

## Technical Deep Dive

### The Two Google OAuth Flows

AgentC2 has **two separate Google OAuth flows** for different purposes:

#### 1. Better Auth Social Login (Working ✅)

**Purpose**: User authentication to sign into AgentC2  
**Route**: `/api/auth/callback/google`  
**Implementation**: Better Auth library handles redirect URI automatically  
**Status**: ✅ Working correctly

Better Auth uses `baseURL` property to construct callback URLs:

```typescript
// packages/auth/src/auth.ts (lines 11-12, 117)
const appUrl = isProduction ? getAppUrl("http://localhost:3000") : "http://localhost:3001";

export const auth = betterAuth({
    // ...
    baseURL: appUrl,
    // ...
});
```

Better Auth constructs: `{baseURL}/api/auth/callback/google`
- Production: `https://agentc2.ai/api/auth/callback/google` ✅ Correct
- Development: `http://localhost:3001/api/auth/callback/google` ✅ Correct

#### 2. Standalone Integration OAuth (Broken ❌)

**Purpose**: Connect Gmail/Calendar/Drive as integrations within an organization  
**Route**: `/api/integrations/google/callback`  
**Implementation**: Custom OAuth2 helper with PKCE  
**Status**: ❌ Broken in production

Custom implementation in `apps/agent/src/lib/google-oauth.ts`:

```typescript
// apps/agent/src/lib/google-oauth.ts (lines 157-162)
export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : ""; // ❌ BUG: /agent prefix no longer valid
    return `${base}${prefix}/api/integrations/google/callback`;
}
```

This constructs:
- Production: `https://agentc2.ai/agent/api/integrations/google/callback` ❌ **WRONG**
- Development: `http://localhost:3001/api/integrations/google/callback` ✅ Correct

The actual route exists at:
- Production: `https://agentc2.ai/api/integrations/google/callback` (no `/agent` prefix)

### Why the Mismatch Occurs

When a user clicks "Sign in with Google" for Gmail integration:

1. Browser requests: `GET /api/integrations/google/start`
2. Server calls `getGoogleRedirectUri()` which returns: `https://agentc2.ai/agent/api/integrations/google/callback`
3. Server redirects browser to Google with `redirect_uri=https://agentc2.ai/agent/api/integrations/google/callback`
4. User grants permissions
5. Google validates `redirect_uri` against authorized URIs in Cloud Console
6. ❌ **Validation fails** because `https://agentc2.ai/agent/api/integrations/google/callback` is not in the allowlist
7. Google returns "Error 400: redirect_uri_mismatch"

### Why Development Works

In development, `NODE_ENV !== "production"`, so:
- `prefix = ""` (empty string)
- Redirect URI: `http://localhost:3001/api/integrations/google/callback` ✅ Correct

This URI matches the route and can be configured in Google Cloud Console for local testing.

---

## Historical Context: The basePath Removal

### Timeline

| Date | Commit | Event |
|---|---|---|
| Jan 31, 2026 | `818bbeea` | basePath made conditional for standalone Vercel deployment |
| Feb 3, 2026 | `948e9bb2` | basePath `/agent` added for production routing |
| **Feb 3, 2026** | **`8cd5e361`** | **basePath `/agent` removed to serve agent app at root** |
| Feb 11, 2026 | `bbffa725` | Microsoft OAuth created (with `/agent` prefix bug) |
| **Mar 12, 2026** | **`10a0e7f3`** | **Google OAuth migrated to standalone (copied bug from Microsoft)** |

### Commit 8cd5e361: basePath Removal

```
commit 8cd5e3619d3b54089cdc876e8f655865c941cc0b
Author: coreylikestocode <corey@useappello.com>
Date:   Tue Feb 3 15:52:59 2026 -0500

    fix: remove basePath /agent to serve agent app at root
    
    The agent app is the primary app and should serve at root (/), not under
    /agent. This fixes 404s for menu items and navigation links which all
    assume root-level routing.
    
    - Remove basePath: "/agent" from next.config.ts
    - Simplify MCP setup page URL detection
```

**What was changed**:
- Removed `basePath: "/agent"` from `apps/agent/next.config.ts`
- Updated utility functions that constructed URLs with `/agent` prefix

**What was NOT changed** (incomplete refactoring):
- OAuth redirect URI builders (didn't exist yet for Microsoft; were never updated for others)
- Webhook URL builders (Outlook Mail, Outlook Calendar)
- Documentation and comments referencing `/agent` basePath
- `BEHIND_PROXY` environment variable (still set but not used)

### Why the Bug Persisted

When Microsoft OAuth was created 8 days after basePath removal, the developer:
1. Copied the redirect URI pattern from another integration (likely Dropbox)
2. Included outdated comments: "In production (behind Caddy), routes include /agent basePath"
3. This pattern assumed basePath still existed

When Google OAuth was migrated on Mar 12, 2026 (TODAY), the developer:
1. Used Microsoft OAuth as a reference implementation
2. Copied the same redirect URI pattern, including the bug
3. Result: Introduced the same bug into Google integrations

---

## Affected Code Locations

### Files with Incorrect Redirect URI Logic

All these files use the same buggy pattern: `const prefix = isProduction ? "/agent" : "";`

| File | Function | Line | Integration |
|---|---|---|---|
| `apps/agent/src/lib/google-oauth.ts` | `getGoogleRedirectUri()` | 157-162 | Gmail, Calendar, Drive, Search Console |
| `apps/agent/src/lib/microsoft-oauth.ts` | `getMicrosoftRedirectUri()` | 443-450 | Outlook Mail, Outlook Calendar |
| `apps/agent/src/lib/dropbox.ts` | `getDropboxRedirectUri()` | 108-113 | Dropbox |
| `apps/agent/src/lib/gmail.ts` | `getGmailOAuthClient()` | 23-27 | Gmail (legacy, uses googleapis SDK) |
| `apps/agent/src/app/api/integrations/mcp-oauth/callback/route.ts` | `getMcpOAuthRedirectUri()` | 24-29 | Generic MCP OAuth |
| `apps/agent/src/app/api/integrations/mcp-oauth/start/route.ts` | `getMcpOAuthRedirectUri()` | 23-28 | Generic MCP OAuth |

### Additional Files with Stale `/agent` Prefix Logic

These don't affect OAuth but use the same outdated pattern:

| File | Function | Line | Purpose |
|---|---|---|---|
| `apps/agent/src/lib/outlook-calendar.ts` | `getCalendarWebhookUrl()` | 170-175 | Microsoft webhook URLs |
| `apps/agent/src/lib/outlook-mail.ts` | `getMailWebhookUrl()` | 128-133 | Microsoft webhook URLs |

### Stale Documentation & Comments

| File | Line | Content |
|---|---|---|
| `.env.example` | 56-57 | "This enables basePath='/agent' for the agent app" |
| `ecosystem.config.js` | 59-60 | "Enable reverse proxy mode for /agent basePath" |
| `apps/agent/src/lib/microsoft-oauth.ts` | 445-446 | "In production (behind Caddy), routes include /agent basePath" |
| `apps/agent/src/lib/utils.ts` | 10-11 | "Agent app now serves at root without basePath" (correct!) |
| `packages/next-config/README.md` | 159 | Shows `basePath: "/agent"` in example |

---

## Current vs Expected Redirect URIs

### Google OAuth Integration

| Environment | Current (Incorrect) | Expected (Correct) |
|---|---|---|
| Production | `https://agentc2.ai/agent/api/integrations/google/callback` ❌ | `https://agentc2.ai/api/integrations/google/callback` ✅ |
| Development | `http://localhost:3001/api/integrations/google/callback` ✅ | `http://localhost:3001/api/integrations/google/callback` ✅ |
| Development (Caddy) | `https://catalyst.localhost/api/integrations/google/callback` ✅ | `https://catalyst.localhost/api/integrations/google/callback` ✅ |

### Microsoft OAuth Integration

| Environment | Current (Incorrect) | Expected (Correct) |
|---|---|---|
| Production | `https://agentc2.ai/agent/api/integrations/microsoft/callback` ❌ | `https://agentc2.ai/api/integrations/microsoft/callback` ✅ |
| Development | `http://localhost:3001/api/integrations/microsoft/callback` ✅ | `http://localhost:3001/api/integrations/microsoft/callback` ✅ |

### Dropbox OAuth Integration

| Environment | Current (Incorrect) | Expected (Correct) |
|---|---|---|
| Production | `https://agentc2.ai/agent/api/integrations/dropbox/callback` ❌ | `https://agentc2.ai/api/integrations/dropbox/callback` ✅ |
| Development | `http://localhost:3001/api/integrations/dropbox/callback` ✅ | `http://localhost:3001/api/integrations/dropbox/callback` ✅ |

### MCP OAuth (Generic)

| Environment | Current (Incorrect) | Expected (Correct) |
|---|---|---|
| Production | `https://agentc2.ai/agent/api/integrations/mcp-oauth/callback` ❌ | `https://agentc2.ai/api/integrations/mcp-oauth/callback` ✅ |
| Development | `http://localhost:3001/api/integrations/mcp-oauth/callback` ✅ | `http://localhost:3001/api/integrations/mcp-oauth/callback` ✅ |

---

## Why Better Auth OAuth Still Works

Better Auth's Google OAuth (used for sign-in) uses the `baseURL` property:

```typescript
// packages/auth/src/auth.ts (lines 11-12)
const appUrl = isProduction ? getAppUrl("http://localhost:3000") : "http://localhost:3001";

export const auth = betterAuth({
    baseURL: appUrl,
    // ...
});
```

In production:
- `getAppUrl()` returns `NEXT_PUBLIC_APP_URL` → `https://agentc2.ai`
- Better Auth constructs: `https://agentc2.ai/api/auth/callback/google` ✅ Correct

Better Auth's callback route is handled internally and doesn't use the buggy redirect URI builder functions.

---

## Impact Assessment

### Affected Integrations (Production)

| Integration | Status | Severity | Notes |
|---|---|---|---|
| **Gmail** | ❌ Broken | Critical | Email ingestion, send, archive unusable |
| **Google Calendar** | ❌ Broken | Critical | Event CRUD unusable |
| **Google Drive** | ❌ Broken | High | File search, document reading unusable |
| **Google Search Console** | ❌ Broken | Medium | SEO analytics unusable |
| **Outlook Mail** | ❌ Broken | Critical | Email ingestion, send, archive unusable |
| **Outlook Calendar** | ❌ Broken | Critical | Event CRUD unusable |
| **Dropbox** | ❌ Broken | High | File operations unusable |
| **MCP OAuth integrations** | ❌ Broken | Medium | Any MCP server using OAuth2 |

### Not Affected

| Integration | Status | Reason |
|---|---|---|
| Better Auth Google sign-in | ✅ Working | Uses Better Auth's internal redirect URI construction |
| Better Auth Microsoft sign-in | ✅ Working | Uses Better Auth's internal redirect URI construction |
| MCP integrations (API key) | ✅ Working | Don't use OAuth |
| Native tools | ✅ Working | Don't require external OAuth |

### User Scenarios

1. **New user signs up via Google** → ✅ Sign-in works, but ❌ Gmail integration fails to connect
2. **Existing user connects Gmail** → ❌ OAuth flow fails immediately
3. **User reconnects expired Gmail** → ❌ Cannot refresh connection
4. **Development environment** → ✅ Everything works (no `/agent` prefix)
5. **Production environment** → ❌ All OAuth integrations broken

---

## Reproduction Steps (Verified)

1. Navigate to production: https://agentc2.ai
2. Sign in with: `assdlc-test@agentc2.ai`
3. Go to Settings > Integrations > Gmail
4. Click "Connect" or "Sign in with Google"
5. Browser redirects to Google OAuth consent screen
6. Observe the `redirect_uri` parameter in URL: `https://agentc2.ai/agent/api/integrations/google/callback`
7. Click "Allow" to grant permissions
8. ❌ **Google returns error**: "Error 400: redirect_uri_mismatch"

**Expected behavior**: Google redirects back to `https://agentc2.ai/api/integrations/google/callback` (no `/agent`)

---

## Root Cause Analysis

### Primary Cause: Incomplete Refactoring

When basePath was removed in commit `8cd5e361` (Feb 3, 2026), not all code was updated:

```diff
commit 8cd5e3619d3b54089cdc876e8f655865c941cc0b
Author: coreylikestocode <corey@useappello.com>
Date:   Tue Feb 3 15:52:59 2026 -0500

    fix: remove basePath /agent to serve agent app at root
    
-   // Agent app serves under /agent path in production
+   // Agent app serves at root (primary app)
    const nextConfig: NextConfig = {
-       basePath: "/agent",
        env: sharedEnv,
```

**What was updated**:
- ✅ `apps/agent/next.config.ts` - basePath removed
- ✅ `apps/agent/src/app/mcp/setup/page.tsx` - URL detection simplified
- ✅ `apps/agent/src/lib/utils.ts` - `getApiBase()` returns empty string

**What was NOT updated** (bugs introduced):
- ❌ OAuth redirect URI builders (didn't exist yet)
- ❌ Webhook URL builders (Outlook Mail, Outlook Calendar)
- ❌ Documentation (.env.example, ecosystem.config.js comments)

### Secondary Cause: Pattern Copying

On Feb 11, 2026 (8 days after basePath removal), Microsoft OAuth was created with the buggy pattern:

```typescript
// apps/agent/src/lib/microsoft-oauth.ts (created Feb 11, 2026)
export function getMicrosoftRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    // In production (behind Caddy), routes include /agent basePath  // ❌ Stale comment
    // In development, no basePath
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";  // ❌ basePath removed 8 days ago
    return `${base}${prefix}/api/integrations/microsoft/callback`;
}
```

On Mar 12, 2026 (TODAY), Google OAuth was migrated using Microsoft OAuth as a reference:

```
commit 10a0e7f34f408bcd367de184226a57b05e3ec51b
Date:   Thu Mar 12 15:50:47 2026 -0400

    feat: migrate Google OAuth from Better Auth linkSocial to standalone PKCE flow
    
    Replaces Better Auth's socialProvider-based Google OAuth with a standalone
    OAuth2 flow using PKCE. Tokens are now stored directly in IntegrationConnection
    (org-scoped) rather than the Account table, enabling multi-org Google integrations.
```

The developer copied the redirect URI pattern from `microsoft-oauth.ts`, perpetuating the bug.

### Why the Bug Wasn't Caught

1. **Development testing**: Works fine (no `/agent` prefix)
2. **Better Auth OAuth**: Still works (different route)
3. **No integration tests**: No tests validate production redirect URIs
4. **Silent failure**: Bug only manifests when deployed to production
5. **Recent change**: Google OAuth was migrated TODAY (Mar 12, 2026)

---

## Code Analysis: Redirect URI Construction

### Pattern Used Across All OAuth Integrations

```typescript
export function get[Provider]RedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";  // ❌ BUG
    return `${base}${prefix}/api/integrations/[provider]/callback`;
}
```

**Files using this pattern**:
1. `apps/agent/src/lib/google-oauth.ts:157-162` - `getGoogleRedirectUri()`
2. `apps/agent/src/lib/microsoft-oauth.ts:443-450` - `getMicrosoftRedirectUri()`
3. `apps/agent/src/lib/dropbox.ts:108-113` - `getDropboxRedirectUri()`
4. `apps/agent/src/lib/gmail.ts:23-27` - `getGmailOAuthClient()` (legacy)
5. `apps/agent/src/app/api/integrations/mcp-oauth/callback/route.ts:24-29` - `getMcpOAuthRedirectUri()`
6. `apps/agent/src/app/api/integrations/mcp-oauth/start/route.ts:23-28` - `getMcpOAuthRedirectUri()`

### Correct Pattern (What It Should Be)

```typescript
export function get[Provider]RedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}/api/integrations/[provider]/callback`;  // ✅ No prefix logic
}
```

The agent app serves at root in ALL environments (development and production), so there should be NO prefix logic.

---

## Routing Architecture Verification

### Production Caddy Configuration

From `apps/caddy/Caddyfile.production`:

```caddy
agentc2.ai {
    # ... security headers ...
    
    # Admin portal routes to admin app (port 3003)
    @admin_routes {
        path /admin*
    }
    handle @admin_routes {
        reverse_proxy localhost:3003
    }
    
    # All other traffic routes to agent app (primary app on port 3001)
    handle {
        reverse_proxy localhost:3001
    }
}
```

**Key observation**: Caddy does NOT rewrite paths or add prefixes. Requests to `https://agentc2.ai/api/integrations/google/callback` are proxied directly to `http://localhost:3001/api/integrations/google/callback`.

### Next.js Configuration

From `apps/agent/next.config.ts`:

```typescript
// Agent app serves at root (primary app)
const nextConfig: NextConfig = {
    env: sharedEnv,
    devIndicators,
    // ... NO basePath property ...
};
```

**Key observation**: No basePath configured, so routes are served at root.

### Route File Location

The callback route is defined at:
```
apps/agent/src/app/api/integrations/google/callback/route.ts
```

In Next.js App Router, this creates route: `/api/integrations/google/callback`

With basePath removed, this route is accessible at:
- Production: `https://agentc2.ai/api/integrations/google/callback` ✅
- NOT at: `https://agentc2.ai/agent/api/integrations/google/callback` ❌

---

## Google Cloud Console Configuration

### Current Configuration (Assumed)

Based on `.env.example` guidance:

```
Authorized redirect URIs:
- http://localhost:3001/api/auth/callback/google
- https://agentc2.ai/api/auth/callback/google
- https://agentc2.ai/admin/api/auth/google/callback
```

These URIs are for **Better Auth social login**, not standalone Gmail integration.

### Missing URIs (Causing the Bug)

The following URIs are NOT configured but SHOULD be:

```
Authorized redirect URIs (Missing):
- http://localhost:3001/api/integrations/google/callback
- https://catalyst.localhost/api/integrations/google/callback
- https://agentc2.ai/api/integrations/google/callback  ← Required for production Gmail integration
```

### Why Only Gmail Integration Fails

Better Auth uses `/api/auth/callback/google` (configured ✅)  
Gmail integration uses `/api/integrations/google/callback` (NOT configured ❌)

---

## Solution Analysis

### Option 1: Fix the Code (Recommended)

**Remove the `/agent` prefix logic from all OAuth redirect URI builders.**

**Pros**:
- Minimal configuration change
- Fixes the bug at the source
- Consistent behavior across all environments
- No Google Cloud Console changes needed (just add missing URI)
- Aligns with current architecture (agent app at root)

**Cons**:
- Requires code changes to 6 files
- Requires deployment to production

**Complexity**: Low (string concatenation fix)

### Option 2: Add Missing URIs to Google Cloud Console Only

**Add `https://agentc2.ai/agent/api/integrations/google/callback` to authorized URIs.**

**Pros**:
- Quick fix (no code deployment needed)
- Can be done immediately via Google Cloud Console

**Cons**:
- ❌ Wrong solution - the URI with `/agent` is incorrect
- ❌ Route doesn't actually exist (404)
- ❌ Doesn't fix Microsoft, Dropbox, MCP OAuth
- ❌ Perpetuates technical debt

**Complexity**: Very Low, but **NOT RECOMMENDED**

### Option 3: Restore basePath (Not Recommended)

**Add `basePath: "/agent"` back to `next.config.ts`.**

**Pros**:
- Aligns code with existing redirect URI logic

**Cons**:
- ❌ Reverts the Feb 3 fix for 404s
- ❌ Breaks all existing frontend navigation
- ❌ Requires Caddy rewrite rules
- ❌ Would need to update hundreds of links and references

**Complexity**: Very High, **NOT RECOMMENDED**

---

## Recommended Solution: Option 1

### Step-by-Step Fix Plan

#### Phase 1: Fix OAuth Redirect URI Builders (Critical)

**Files to modify** (6 files):

1. **`apps/agent/src/lib/google-oauth.ts`** (lines 157-162)

   **Current**:
   ```typescript
   export function getGoogleRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/integrations/google/callback`;
   }
   ```

   **Fixed**:
   ```typescript
   export function getGoogleRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/integrations/google/callback`;
   }
   ```

2. **`apps/agent/src/lib/microsoft-oauth.ts`** (lines 443-450)

   **Current**:
   ```typescript
   export function getMicrosoftRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       // In production (behind Caddy), routes include /agent basePath
       // In development, no basePath
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/integrations/microsoft/callback`;
   }
   ```

   **Fixed**:
   ```typescript
   export function getMicrosoftRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/integrations/microsoft/callback`;
   }
   ```

3. **`apps/agent/src/lib/dropbox.ts`** (lines 108-113)

   **Current**:
   ```typescript
   export function getDropboxRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/integrations/dropbox/callback`;
   }
   ```

   **Fixed**:
   ```typescript
   export function getDropboxRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/integrations/dropbox/callback`;
   }
   ```

4. **`apps/agent/src/lib/gmail.ts`** (lines 23-27)

   **Current**:
   ```typescript
   const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
   const isProduction = process.env.NODE_ENV === "production";
   const prefix = isProduction ? "/agent" : "";
   const redirectUri =
       process.env.GMAIL_OAUTH_REDIRECT_URI || `${base}${prefix}/api/integrations/google/callback`;
   ```

   **Fixed**:
   ```typescript
   const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
   const redirectUri =
       process.env.GMAIL_OAUTH_REDIRECT_URI || `${base}/api/integrations/google/callback`;
   ```

5. **`apps/agent/src/app/api/integrations/mcp-oauth/callback/route.ts`** (lines 24-29)

   **Current**:
   ```typescript
   function getMcpOAuthRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/integrations/mcp-oauth/callback`;
   }
   ```

   **Fixed**:
   ```typescript
   function getMcpOAuthRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/integrations/mcp-oauth/callback`;
   }
   ```

6. **`apps/agent/src/app/api/integrations/mcp-oauth/start/route.ts`** (lines 23-28)

   **Current**:
   ```typescript
   function getMcpOAuthRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/integrations/mcp-oauth/callback`;
   }
   ```

   **Fixed**:
   ```typescript
   function getMcpOAuthRedirectUri(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/integrations/mcp-oauth/callback`;
   }
   ```

#### Phase 2: Fix Webhook URL Builders (Non-Critical)

These don't cause OAuth failures but have the same outdated pattern:

7. **`apps/agent/src/lib/outlook-calendar.ts`** (lines 170-175)

   **Current**:
   ```typescript
   function getCalendarWebhookUrl(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/microsoft/webhook`;
   }
   ```

   **Fixed**:
   ```typescript
   function getCalendarWebhookUrl(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/microsoft/webhook`;
   }
   ```

8. **`apps/agent/src/lib/outlook-mail.ts`** (lines 128-133)

   **Current**:
   ```typescript
   function getMailWebhookUrl(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/api/microsoft/webhook`;
   }
   ```

   **Fixed**:
   ```typescript
   function getMailWebhookUrl(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/api/microsoft/webhook`;
   }
   ```

9. **`apps/agent/src/app/api/integrations/mcp-oauth/callback/route.ts`** (lines 31-36)

   **Current**:
   ```typescript
   function getSetupPageUrl(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       const isProduction = process.env.NODE_ENV === "production";
       const prefix = isProduction ? "/agent" : "";
       return `${base}${prefix}/mcp/setup`;
   }
   ```

   **Fixed**:
   ```typescript
   function getSetupPageUrl(): string {
       const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
       return `${base}/mcp/setup`;
   }
   ```

#### Phase 3: Update Google Cloud Console (Required)

Add the correct redirect URIs to the Google Cloud Console OAuth consent screen:

**Authorized redirect URIs** (add these):
```
# Local development
http://localhost:3001/api/integrations/google/callback

# Local development with Caddy
https://catalyst.localhost/api/integrations/google/callback

# Production (Gmail integration)
https://agentc2.ai/api/integrations/google/callback
```

**Keep existing** (for Better Auth social login):
```
# Better Auth social login (already configured)
http://localhost:3001/api/auth/callback/google
https://agentc2.ai/api/auth/callback/google
https://agentc2.ai/admin/api/auth/google/callback
```

#### Phase 4: Update Microsoft/Dropbox OAuth Providers

Perform the same redirect URI updates in:
- Azure AD app registration (Microsoft)
- Dropbox App Console

#### Phase 5: Update Documentation

**Files to update**:

1. **`.env.example`** (lines 32-38)

   **Current**:
   ```bash
   # Google OAuth (SSO)
   # Add redirect URIs in Google Cloud Console:
   # - http://localhost:3001/api/auth/callback/google (local - main app)
   # - https://your-domain.com/api/auth/callback/google (prod - main app)
   # - https://your-domain.com/admin/api/auth/google/callback (prod - admin portal)
   ```

   **Fixed**:
   ```bash
   # Google OAuth (SSO + Gmail Integration)
   # Add redirect URIs in Google Cloud Console:
   # 
   # For Better Auth social login (sign-in/sign-up):
   # - http://localhost:3001/api/auth/callback/google (local)
   # - https://your-domain.com/api/auth/callback/google (prod)
   # - https://your-domain.com/admin/api/auth/google/callback (admin)
   #
   # For Gmail/Calendar/Drive integration:
   # - http://localhost:3001/api/integrations/google/callback (local)
   # - https://catalyst.localhost/api/integrations/google/callback (local with Caddy)
   # - https://your-domain.com/api/integrations/google/callback (prod)
   ```

2. **`.env.example`** (lines 55-57)

   **Current**:
   ```bash
   # Set to "true" when running behind a reverse proxy (Caddy/nginx)
   # This enables basePath="/agent" for the agent app
   BEHIND_PROXY="true"
   ```

   **Fixed**:
   ```bash
   # Set to "true" when running behind a reverse proxy (Caddy/nginx)
   # Note: The agent app serves at root; this flag is deprecated
   BEHIND_PROXY="true"
   ```

3. **`ecosystem.config.js`** (lines 59-60)

   **Current**:
   ```javascript
   // Enable reverse proxy mode for /agent basePath
   BEHIND_PROXY: "true",
   ```

   **Fixed**:
   ```javascript
   // Flag for reverse proxy mode (deprecated, kept for compatibility)
   BEHIND_PROXY: "true",
   ```

4. **`CLAUDE.md` and `README.md`**

   Update all references to:
   - "basePath: /agent" → Remove or note as deprecated
   - Document that agent app serves at root
   - Update OAuth setup instructions

#### Phase 6: Add Integration Tests

Prevent regression with automated tests:

**New test file**: `tests/integration/oauth-redirect-uris.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import {
    getGoogleRedirectUri,
    getMicrosoftRedirectUri,
    getDropboxRedirectUri
} from "@/lib/[oauth-helpers]";

describe("OAuth Redirect URIs", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    });

    test("Google redirect URI should not include /agent in production", () => {
        process.env.NODE_ENV = "production";
        process.env.NEXT_PUBLIC_APP_URL = "https://agentc2.ai";
        
        const uri = getGoogleRedirectUri();
        
        expect(uri).toBe("https://agentc2.ai/api/integrations/google/callback");
        expect(uri).not.toContain("/agent/");
    });

    test("Microsoft redirect URI should not include /agent in production", () => {
        process.env.NODE_ENV = "production";
        process.env.NEXT_PUBLIC_APP_URL = "https://agentc2.ai";
        
        const uri = getMicrosoftRedirectUri();
        
        expect(uri).toBe("https://agentc2.ai/api/integrations/microsoft/callback");
        expect(uri).not.toContain("/agent/");
    });

    test("Dropbox redirect URI should not include /agent in production", () => {
        process.env.NODE_ENV = "production";
        process.env.NEXT_PUBLIC_APP_URL = "https://agentc2.ai";
        
        const uri = getDropboxRedirectUri();
        
        expect(uri).toBe("https://agentc2.ai/api/integrations/dropbox/callback");
        expect(uri).not.toContain("/agent/");
    });

    test("Development redirect URIs should not include /agent", () => {
        process.env.NODE_ENV = "development";
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
        
        expect(getGoogleRedirectUri()).toBe("http://localhost:3001/api/integrations/google/callback");
        expect(getMicrosoftRedirectUri()).toBe("http://localhost:3001/api/integrations/microsoft/callback");
        expect(getDropboxRedirectUri()).toBe("http://localhost:3001/api/integrations/dropbox/callback");
    });
});
```

---

## Implementation Plan

### Priority: P0 (Critical - Production Broken)

### Implementation Steps

#### Step 1: Code Changes (30 minutes)

1. **Remove `/agent` prefix logic** from all 6 OAuth redirect URI builders:
   - `google-oauth.ts` → `getGoogleRedirectUri()`
   - `microsoft-oauth.ts` → `getMicrosoftRedirectUri()`
   - `dropbox.ts` → `getDropboxRedirectUri()`
   - `gmail.ts` → `getGmailOAuthClient()`
   - `mcp-oauth/callback/route.ts` → `getMcpOAuthRedirectUri()` + `getSetupPageUrl()`
   - `mcp-oauth/start/route.ts` → `getMcpOAuthRedirectUri()`

2. **Remove `/agent` prefix logic** from webhook URL builders (non-critical but consistent):
   - `outlook-calendar.ts` → `getCalendarWebhookUrl()`
   - `outlook-mail.ts` → `getMailWebhookUrl()`

3. **Update stale comments** in all modified files

#### Step 2: Add Integration Test (15 minutes)

Create `tests/integration/oauth-redirect-uris.test.ts` to validate redirect URI construction.

#### Step 3: Update Documentation (15 minutes)

1. Update `.env.example` with correct redirect URI examples
2. Update `ecosystem.config.js` comments
3. Update `packages/next-config/README.md` to remove basePath example
4. Add note to `CLAUDE.md` documenting the basePath removal and OAuth implications

#### Step 4: Google Cloud Console Configuration (5 minutes)

Add missing redirect URIs:
```
https://agentc2.ai/api/integrations/google/callback
http://localhost:3001/api/integrations/google/callback
https://catalyst.localhost/api/integrations/google/callback
```

#### Step 5: Azure AD Configuration (5 minutes)

Update Microsoft app registration redirect URIs:
```
https://agentc2.ai/api/integrations/microsoft/callback
http://localhost:3001/api/integrations/microsoft/callback
```

#### Step 6: Dropbox App Configuration (5 minutes)

Update Dropbox app redirect URIs:
```
https://agentc2.ai/api/integrations/dropbox/callback
http://localhost:3001/api/integrations/dropbox/callback
```

#### Step 7: Testing (30 minutes)

**Pre-deployment testing** (local with Caddy):
1. Set `NEXT_PUBLIC_APP_URL="https://catalyst.localhost"`
2. Set `NODE_ENV="production"`
3. Run `bun run dev`
4. Attempt Gmail OAuth → verify redirect URI is correct
5. Complete OAuth flow → verify success

**Post-deployment testing** (production):
1. Clear existing Gmail connection (if any)
2. Navigate to Settings > Integrations > Gmail
3. Click "Connect" and complete OAuth flow
4. Verify success page shows
5. Verify IntegrationConnection created in database
6. Test Gmail tool: send a test email
7. Repeat for Microsoft and Dropbox

#### Step 8: Quality Checks

1. Run `bun run type-check` → No errors
2. Run `bun run lint` → No errors
3. Run `bun run format` → Apply formatting
4. Run `bun run build` → Build succeeds
5. Run integration tests → Pass

#### Step 9: Deployment

1. Commit changes with descriptive message
2. Push to branch `cursor/google-oauth-redirect-uri-975b`
3. Merge to `main` after testing
4. GitHub Actions deploys automatically
5. Monitor PM2 logs for OAuth attempts
6. Verify production Gmail connection

---

## Risk Assessment

### Implementation Risk: **Low**

| Risk Factor | Level | Mitigation |
|---|---|---|
| **Code complexity** | Low | Simple string concatenation changes |
| **Breaking changes** | None | Development already works; production gets fixed |
| **Rollback difficulty** | Low | Git revert restores previous behavior |
| **Test coverage** | Medium | Add integration tests to prevent regression |
| **OAuth provider config** | Medium | Must update Google/Microsoft/Dropbox consoles |

### Deployment Risk: **Low**

| Risk Factor | Level | Mitigation |
|---|---|---|
| **Service disruption** | None | OAuth flows already broken; can only improve |
| **Data loss** | None | No database schema changes |
| **User impact** | Positive | Fixes broken integrations |
| **Rollback time** | < 5 min | Git revert + redeploy |

### Testing Risk: **Medium**

| Risk Factor | Level | Mitigation |
|---|---|---|
| **Environment differences** | Medium | Test with `NODE_ENV=production` locally |
| **OAuth provider config** | High | Verify all redirect URIs in Cloud Consoles |
| **Cross-integration impact** | Low | Each OAuth flow is independent |

---

## Verification Checklist

### Pre-Deployment

- [ ] All 9 files updated (6 OAuth builders + 2 webhook builders + 1 setup URL)
- [ ] Integration tests added and passing
- [ ] Documentation updated (`.env.example`, `ecosystem.config.js`, `CLAUDE.md`)
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] Google Cloud Console redirect URIs added
- [ ] Azure AD redirect URIs added
- [ ] Dropbox redirect URIs added

### Post-Deployment

#### Gmail Integration
- [ ] Navigate to Settings > Integrations > Gmail
- [ ] Click "Connect" → OAuth flow initiates
- [ ] Grant permissions on Google consent screen
- [ ] Redirected back to AgentC2 with success message
- [ ] IntegrationConnection created in database with `isActive=true`
- [ ] Gmail, Calendar, Drive, Search Console all show "Connected"
- [ ] Test Gmail tool: Send test email successfully
- [ ] Test Calendar tool: List upcoming events
- [ ] Test Drive tool: Search for files

#### Microsoft Integration
- [ ] Navigate to Settings > Integrations > Outlook Mail
- [ ] Click "Connect" → OAuth flow initiates
- [ ] Grant permissions on Microsoft consent screen
- [ ] Redirected back to AgentC2 with success message
- [ ] IntegrationConnection created for Outlook Mail and Calendar
- [ ] Test Outlook Mail tool: List recent emails
- [ ] Test Outlook Calendar tool: Create test event
- [ ] Verify webhooks registered for real-time notifications

#### Dropbox Integration
- [ ] Navigate to Settings > Integrations > Dropbox
- [ ] Click "Connect" → OAuth flow initiates
- [ ] Grant permissions on Dropbox consent screen
- [ ] Redirected back to AgentC2 with success message
- [ ] IntegrationConnection created
- [ ] Test Dropbox tool: List files in root folder

#### Better Auth (Ensure Not Broken)
- [ ] Sign out completely
- [ ] Click "Sign in with Google"
- [ ] Complete OAuth flow
- [ ] Successfully signed in ✅ (should still work)

#### Database Validation
```sql
-- Verify connections created
SELECT 
    ic.name,
    ic."isActive",
    ip.key,
    ic.metadata->>'gmailAddress' as email
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."organizationId" = '<test-org-id>'
AND ip.key IN ('gmail', 'google-calendar', 'google-drive', 'outlook-mail', 'outlook-calendar', 'dropbox');

-- Expected: Multiple rows with isActive=true
```

---

## Related Issues & Documentation

### Related RCA Documents

- **RCA-gmail-calendar-drive-connection-bug.md** (Issue #158)
  - Different root cause: Deferred org creation preventing post-bootstrap callbacks
  - Fixed by adding sync calls in confirm-org endpoint
  - Not related to redirect_uri_mismatch

### GitHub Issues

- **[Issue #176](https://github.com/Appello-Prototypes/agentc2/issues/176)** - Current issue
- **[Issue #158](https://github.com/Appello-Prototypes/agentc2/issues/158)** - Related but different bug

### Relevant Commits

- `8cd5e361` (Feb 3, 2026) - basePath removal (root cause trigger)
- `bbffa725` (Feb 11, 2026) - Microsoft OAuth created (bug introduced)
- `10a0e7f3` (Mar 12, 2026) - Google OAuth migrated (bug propagated)

---

## Preventive Measures

To prevent similar issues in the future:

### 1. Centralized URL Builder

Create a shared redirect URI builder to eliminate duplication:

**New file**: `apps/agent/src/lib/oauth-helpers.ts`

```typescript
/**
 * Build OAuth redirect URI for any integration.
 * Agent app serves at root (no basePath) in all environments.
 */
export function buildIntegrationRedirectUri(callbackPath: string): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}${callbackPath}`;
}
```

**Usage**:
```typescript
// google-oauth.ts
export function getGoogleRedirectUri(): string {
    return buildIntegrationRedirectUri("/api/integrations/google/callback");
}

// microsoft-oauth.ts
export function getMicrosoftRedirectUri(): string {
    return buildIntegrationRedirectUri("/api/integrations/microsoft/callback");
}
```

### 2. Integration Tests for Redirect URIs

Add tests that validate redirect URIs in production mode:

```typescript
test("OAuth redirect URIs never include /agent prefix", () => {
    process.env.NODE_ENV = "production";
    const allRedirectUris = [
        getGoogleRedirectUri(),
        getMicrosoftRedirectUri(),
        getDropboxRedirectUri(),
        // ... add all OAuth builders ...
    ];
    for (const uri of allRedirectUris) {
        expect(uri).not.toContain("/agent/");
    }
});
```

### 3. Documentation Standards

When making architectural changes (like basePath removal):

1. **Search for all usages** of the changed pattern
2. **Update all code** using that pattern, not just the config
3. **Update all documentation** referencing the pattern
4. **Add deprecation notes** for removed features
5. **Create migration guide** if users are affected

### 4. Pre-Push Checklist Enhancement

Add to `CLAUDE.md` pre-push checklist:

```markdown
### Before Modifying URL/Path Structure

If changing basePath, domain, or routing:
- [ ] Search codebase for hardcoded path assumptions
- [ ] Update all OAuth redirect URI builders
- [ ] Update all webhook URL builders
- [ ] Update documentation (.env.example, CLAUDE.md, README.md)
- [ ] Add integration tests validating URL construction
- [ ] Test OAuth flows in production-like environment
```

---

## Alternative Solutions Considered

### Option A: Use Environment Variable Override

Add `OAUTH_REDIRECT_BASE_PATH` environment variable to allow manual override:

```typescript
export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const pathPrefix = process.env.OAUTH_REDIRECT_BASE_PATH || "";
    return `${base}${pathPrefix}/api/integrations/google/callback`;
}
```

**Pros**: Flexible for different deployment scenarios  
**Cons**: Adds configuration complexity; not needed since basePath is gone  
**Verdict**: ❌ Not recommended - over-engineering

### Option B: Use BEHIND_PROXY to Control Prefix

```typescript
export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const prefix = process.env.BEHIND_PROXY === "true" ? "/agent" : "";
    return `${base}${prefix}/api/integrations/google/callback`;
}
```

**Pros**: Uses existing environment variable  
**Cons**: `BEHIND_PROXY` is deprecated; basePath doesn't exist  
**Verdict**: ❌ Not recommended - perpetuates confusion

### Option C: Remove NODE_ENV Check (Chosen ✅)

Simply remove all prefix logic:

```typescript
export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}/api/integrations/google/callback`;
}
```

**Pros**: Simple, correct, consistent  
**Cons**: None  
**Verdict**: ✅ **Recommended**

---

## Estimated Effort

| Phase | Task | Time | Complexity |
|---|---|---|---|
| 1 | Fix 6 OAuth redirect URI builders | 20 min | Low |
| 1 | Fix 2 webhook URL builders | 5 min | Low |
| 1 | Fix 1 setup page URL builder | 5 min | Low |
| 2 | Add integration tests | 15 min | Low |
| 3 | Update documentation | 15 min | Low |
| 4 | Update Google Cloud Console | 5 min | Low |
| 5 | Update Azure AD | 5 min | Low |
| 6 | Update Dropbox Console | 5 min | Low |
| 7 | Testing (local + production) | 30 min | Medium |
| 8 | Quality checks & deployment | 15 min | Low |
| **Total** | **115 minutes** | **~2 hours** | **Low** |

---

## Deployment Strategy

### Phase A: Code Changes Only (Safe, No Risk)

1. Update all 9 files with redirect URI and webhook fixes
2. Add integration tests
3. Update documentation
4. Run quality checks: `type-check`, `lint`, `format`, `build`
5. Commit and push to branch
6. **DO NOT deploy yet**

### Phase B: OAuth Provider Configuration (Medium Risk)

1. Add redirect URIs to Google Cloud Console
2. Add redirect URIs to Azure AD
3. Add redirect URIs to Dropbox App Console
4. **Wait 5 minutes for propagation**

### Phase C: Deploy and Test (Low Risk)

1. Merge branch to `main`
2. GitHub Actions deploys automatically
3. Monitor PM2 logs: `pm2 logs --lines 100`
4. Test Gmail OAuth flow with test user
5. Test Microsoft OAuth flow
6. Verify existing connections still work

### Rollback Plan (If Needed)

```bash
# SSH into production server
ssh root@138.197.150.253

# Revert to previous commit
cd /var/www/agentc2
git revert HEAD --no-edit
bun install
bun run db:generate
NODE_OPTIONS="--max-old-space-size=24576" bunx turbo build
pm2 restart ecosystem.config.js --update-env

# Estimated rollback time: 3-5 minutes
```

---

## Success Criteria

### Immediate Success (Phase C Complete)

- [ ] Gmail OAuth completes successfully in production
- [ ] Google Calendar connection appears as "Connected"
- [ ] Google Drive connection appears as "Connected"
- [ ] Microsoft Outlook connections work
- [ ] Dropbox connection works
- [ ] No 404 errors in PM2 logs
- [ ] Better Auth Google sign-in still works

### Long-Term Success (1 Week Post-Deploy)

- [ ] No redirect_uri_mismatch errors in logs
- [ ] Users successfully connecting integrations
- [ ] No support tickets about OAuth failures
- [ ] Integration tests prevent regression

---

## Key Learnings

### What Went Wrong

1. **Incomplete refactoring**: basePath removal didn't update all dependent code
2. **Pattern copying**: New code copied outdated patterns from existing code
3. **Missing tests**: No integration tests caught the environment-specific bug
4. **Stale documentation**: Comments and docs referenced removed features
5. **Silent failure**: Bug only manifests in production, not in development

### What to Do Differently

1. **Comprehensive search**: When refactoring, search for all usages of changed patterns
2. **Environment parity**: Test with `NODE_ENV=production` locally before deploying
3. **Integration tests**: Add tests for environment-specific behavior
4. **Documentation hygiene**: Update docs immediately when making architectural changes
5. **Code review focus**: Review for hardcoded environment assumptions

---

## Conclusion

The Google OAuth redirect_uri_mismatch bug is caused by OAuth redirect URI builders using an outdated `/agent` prefix that was removed from the Next.js configuration on Feb 3, 2026. The bug was introduced when new OAuth integrations (Microsoft, Google, Dropbox) were created after the basePath removal but copied patterns from older code that assumed basePath still existed.

**Fix**: Remove the `/agent` prefix logic from all OAuth redirect URI builders and webhook URL builders (9 files), add integration tests, update documentation, and configure correct redirect URIs in OAuth provider consoles.

**Estimated effort**: 2 hours  
**Risk level**: Low  
**User impact**: Positive (fixes broken integrations)  
**Rollback time**: < 5 minutes

The fix is straightforward, low-risk, and addresses the root cause systematically across all affected integrations.

---

## Appendix A: Complete File Change List

### Files to Modify (Code)

1. `apps/agent/src/lib/google-oauth.ts` - Remove `/agent` prefix from `getGoogleRedirectUri()`
2. `apps/agent/src/lib/microsoft-oauth.ts` - Remove `/agent` prefix from `getMicrosoftRedirectUri()`
3. `apps/agent/src/lib/dropbox.ts` - Remove `/agent` prefix from `getDropboxRedirectUri()`
4. `apps/agent/src/lib/gmail.ts` - Remove `/agent` prefix from `getGmailOAuthClient()`
5. `apps/agent/src/app/api/integrations/mcp-oauth/callback/route.ts` - Remove `/agent` prefix from `getMcpOAuthRedirectUri()` and `getSetupPageUrl()`
6. `apps/agent/src/app/api/integrations/mcp-oauth/start/route.ts` - Remove `/agent` prefix from `getMcpOAuthRedirectUri()`
7. `apps/agent/src/lib/outlook-calendar.ts` - Remove `/agent` prefix from `getCalendarWebhookUrl()`
8. `apps/agent/src/lib/outlook-mail.ts` - Remove `/agent` prefix from `getMailWebhookUrl()`

### Files to Create (Tests)

9. `tests/integration/oauth-redirect-uris.test.ts` - Integration tests for redirect URI construction

### Files to Update (Documentation)

10. `.env.example` - Update Google OAuth redirect URI examples (lines 32-38, 55-57)
11. `ecosystem.config.js` - Update comment about BEHIND_PROXY (line 59-60)
12. `packages/next-config/README.md` - Remove basePath example (line 159)
13. `CLAUDE.md` - Add note about basePath removal and OAuth implications
14. `README.md` - Update references to agent app routing (line 25, 178)

**Total**: 9 code files + 1 test file + 5 documentation files = **15 files**

---

## Appendix B: OAuth Provider Console Changes

### Google Cloud Console

**Project**: (Your Google Cloud project)  
**Location**: APIs & Services > Credentials > OAuth 2.0 Client IDs > (Your client ID) > Authorized redirect URIs

**Add these URIs**:
```
http://localhost:3001/api/integrations/google/callback
https://catalyst.localhost/api/integrations/google/callback
https://agentc2.ai/api/integrations/google/callback
```

**Keep existing URIs** (for Better Auth):
```
http://localhost:3001/api/auth/callback/google
https://agentc2.ai/api/auth/callback/google
https://agentc2.ai/admin/api/auth/google/callback
```

### Azure AD (Microsoft)

**Location**: Azure Portal > App registrations > (Your app) > Authentication > Redirect URIs

**Add these URIs**:
```
http://localhost:3001/api/integrations/microsoft/callback
https://agentc2.ai/api/integrations/microsoft/callback
```

### Dropbox App Console

**Location**: Dropbox App Console > (Your app) > Settings > Redirect URIs

**Add these URIs**:
```
http://localhost:3001/api/integrations/dropbox/callback
https://agentc2.ai/api/integrations/dropbox/callback
```

---

## Appendix C: Testing Commands

### Local Testing (Production Mode)

```bash
# Set environment to production mode
export NODE_ENV=production
export NEXT_PUBLIC_APP_URL="https://catalyst.localhost"

# Start dev server with Caddy
bun run dev

# In browser:
# 1. Navigate to https://catalyst.localhost/mcp/gmail
# 2. Click "Connect"
# 3. Check redirect_uri in browser address bar
# 4. Expected: https://catalyst.localhost/api/integrations/google/callback (no /agent)
```

### Integration Test Execution

```bash
# Run new OAuth redirect URI tests
bun test tests/integration/oauth-redirect-uris.test.ts

# Expected output:
# ✅ Google redirect URI should not include /agent in production
# ✅ Microsoft redirect URI should not include /agent in production
# ✅ Dropbox redirect URI should not include /agent in production
# ✅ Development redirect URIs should not include /agent
```

### Production Verification

```bash
# SSH into production
ssh root@138.197.150.253

# Check PM2 logs for OAuth attempts
pm2 logs --lines 50 | grep -i "oauth\|redirect\|gmail"

# Check for errors
pm2 logs --err-lines 50

# Verify database connections
psql $DATABASE_URL -c "SELECT ic.name, ip.key FROM \"IntegrationConnection\" ic JOIN \"IntegrationProvider\" ip ON ic.\"providerId\" = ip.id WHERE ip.key IN ('gmail', 'google-calendar', 'google-drive');"
```

---

**Analysis completed**: 2026-03-12  
**Analyst**: AI Agent (Claude Sonnet 4.5)  
**Review status**: Ready for human review and implementation approval

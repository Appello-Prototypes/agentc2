# Root Cause Analysis: Google OAuth redirect_uri_mismatch (Error 400)

**Issue**: [#176](https://github.com/Appello-Prototypes/agentc2/issues/176)  
**Date**: 2026-03-12  
**Status**: Resolved  
**Branch**: `cursor/google-oauth-redirect-uri-22c1`

---

## Summary

Google OAuth sign-in for the Gmail integration was failing with **Error 400: redirect_uri_mismatch**. The OAuth redirect URI being sent by the application (`https://agentc2.ai/agent/api/integrations/google/callback`) did not match the actual callback route location (`https://agentc2.ai/api/integrations/google/callback`).

---

## Impact

- **Severity**: High (blocking critical integration)
- **Affected users**: All users attempting to connect Gmail integration
- **Workaround**: None available
- **Related integrations**: Microsoft OAuth (Outlook Mail + Calendar) had the same underlying issue

---

## Timeline

1. User attempted to sign in with Google for Gmail integration
2. OAuth authorization flow redirected to Google with incorrect `redirect_uri` parameter
3. Google rejected the request with "Access blocked: This app's request is invalid"
4. Error 400: redirect_uri_mismatch displayed to user

---

## Root Cause

The `getGoogleRedirectUri()` function in `apps/agent/src/lib/google-oauth.ts` (and similarly `getMicrosoftRedirectUri()` in `microsoft-oauth.ts`) was incorrectly adding a `/agent` basePath prefix in production environments:

```typescript
export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";  // ❌ Incorrect assumption
    return `${base}${prefix}/api/integrations/google/callback`;
}
```

**Why this was wrong:**

1. **Architecture assumption mismatch**: The code assumed the agent app was deployed with a Next.js `basePath: "/agent"` configuration (similar to the admin app which has `basePath: "/admin"`).

2. **Actual architecture**: The agent app (`apps/agent/`) is the **primary application** and serves routes directly at the root domain. The Caddyfile (both development and production) routes all traffic (except specific frontend/admin routes) directly to port 3001 without any path prefix.

3. **Result**:
   - **Constructed redirect URI** (sent to Google): `https://agentc2.ai/agent/api/integrations/google/callback`
   - **Actual callback route**: `https://agentc2.ai/api/integrations/google/callback`
   - **Mismatch**: Google rejected the OAuth request because the redirect URI didn't match

---

## Evidence

### Caddyfile Configuration (Production)

```caddy
# All other traffic routes to agent app (primary app on port 3001)
handle {
    reverse_proxy localhost:3001 {
        transport http {
            read_timeout 300s
            write_timeout 300s
        }
        flush_interval -1
    }
}
```

The agent app is **not** mounted at `/agent` — it serves routes directly at the root.

### Next.js Configuration

`apps/agent/next.config.ts` does **not** include a `basePath` configuration (unlike `apps/admin/next.config.ts` which has `basePath: "/admin"`):

```typescript
// Agent app serves at root (primary app)
const nextConfig: NextConfig = {
    env: sharedEnv,
    devIndicators,
    // ... no basePath
};
```

### Error Message

```
Error 400: redirect_uri_mismatch

The redirect URI in the request, https://agentc2.ai/agent/api/integrations/google/callback, 
does not match the ones authorized for the OAuth client.
```

---

## Fix

Removed the incorrect `/agent` prefix logic from both OAuth helper functions:

### Fixed `google-oauth.ts`

```typescript
export function getGoogleRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}/api/integrations/google/callback`;
}
```

### Fixed `microsoft-oauth.ts`

```typescript
export function getMicrosoftRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    return `${base}/api/integrations/microsoft/callback`;
}
```

---

## Verification Steps

1. Start OAuth flow: `GET /api/integrations/google/start`
2. Verify authorization URL contains correct redirect URI:
   - Production: `https://agentc2.ai/api/integrations/google/callback`
   - Development: `http://localhost:3001/api/integrations/google/callback`
3. Complete OAuth flow and verify callback route is reached successfully
4. Verify Gmail integration connection is created in database
5. Verify Microsoft OAuth flow also works correctly with the same fix

---

## Prevention

### Recommended Safeguards

1. **Integration tests**: Add OAuth flow tests that verify redirect URI construction matches actual route configuration

2. **Documentation**: Update CLAUDE.md to clarify that the agent app serves at root, not at `/agent` basePath

3. **Configuration validation**: Add startup checks that validate OAuth redirect URIs are registered in provider consoles

4. **Code comments**: Add explicit comments in Caddyfile and Next.js configs about routing architecture

---

## Related Issues

- Microsoft OAuth (Outlook Mail + Calendar) had the same bug and was fixed in the same commit
- No other OAuth integrations (Dropbox, Slack) were affected as they use different patterns

---

## Files Changed

- `apps/agent/src/lib/google-oauth.ts` - Removed `/agent` prefix logic
- `apps/agent/src/lib/microsoft-oauth.ts` - Removed `/agent` prefix logic
- `RCA-google-oauth-redirect-uri-mismatch.md` - This document

---

## Lessons Learned

1. **Always verify deployment architecture** before implementing environment-specific logic
2. **Test OAuth flows end-to-end** in production-like environments
3. **Document routing architecture clearly** to prevent assumptions
4. **Mirror working patterns carefully** — the Microsoft OAuth helper was copied from elsewhere but inherited the same incorrect assumption

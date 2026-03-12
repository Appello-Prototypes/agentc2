# Test Plan: Google Calendar OAuth Scope Fix (Issue #164)

**Purpose**: Verify that the Google Calendar scope fix resolves the authorization issue and doesn't introduce regressions.

---

## Test Environment Setup

### Prerequisites

- [ ] Code changes deployed to test environment
- [ ] Database seed applied (server restarted)
- [ ] Test user account with Gmail access
- [ ] Test agent configured with calendar tools
- [ ] Access to browser developer tools
- [ ] Access to database query interface (Prisma Studio or SQL client)

### Test Data

Create/identify:
- Test user email: `test-user@example.com`
- Test organization: `test-org`
- Test agent with calendar tools: `calendar-test-agent`
- Test calendar event: Create a dummy event for search/list operations

---

## Test Cases

### TC-001: Fresh Sign-Up Flow (Baseline - Should Still Work)

**Purpose**: Verify initial sign-up OAuth flow still works correctly  
**Priority**: Critical  
**Estimated Time**: 5 minutes

**Steps**:
1. Open incognito browser window
2. Navigate to `/sign-up`
3. Click "Sign up with Google"
4. Complete Google OAuth consent (grant all permissions)
5. Complete onboarding (create new organization)
6. Navigate to Settings > Integrations
7. Verify Gmail shows as "Connected"
8. Navigate to Google Calendar provider
9. Verify shows as "Connected"

**Expected Result**:
- OAuth consent screen shows all 5 scopes including `calendar.events`
- After sign-up, both Gmail and Calendar show as connected
- No error messages in browser console
- No error messages in server logs

**Database Verification**:
```sql
-- Check Account table
SELECT scope FROM "Account" 
WHERE "userId" = '<new-user-id>' AND "providerId" = 'google';
-- Should contain "calendar.events"

-- Check IntegrationConnections
SELECT ip.key, ic."isActive" 
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ic."organizationId" = '<new-org-id>'
AND ip.key IN ('gmail', 'google-calendar', 'google-drive');
-- Should return 3 rows, all active
```

**Pass/Fail**: [ ]

---

### TC-002: Re-Authorization via SetupWizard (Primary Fix Validation)

**Purpose**: Verify SetupWizard now requests correct scopes  
**Priority**: Critical  
**Estimated Time**: 7 minutes

**Steps**:
1. Log in as existing user with Gmail connected
2. Navigate to Settings > Integrations > Gmail
3. Open browser developer tools > Console
4. Click "Disconnect" button
5. Wait for disconnection to complete
6. Click "Connect" button
7. **OBSERVE** the OAuth consent screen from Google
8. Verify scopes shown include "Manage your calendar events"
9. Approve and complete OAuth flow
10. Wait for sync to complete
11. Verify Gmail shows as "Connected"
12. Navigate to Google Calendar provider
13. Verify shows as "Connected"

**Expected Result**:
- OAuth consent screen lists `calendar.events` (not `calendar.readonly`)
- Both Gmail and Calendar show as connected after flow completes
- No scope errors in console or server logs

**Debug Point**:
In `SetupWizard.tsx`, add temporary console.log before calling `linkSocial`:
```typescript
console.log("[DEBUG] OAuth scopes:", oauthConfig.scopes);
```
Should log array with 5 scopes including `calendar.events`.

**Database Verification**:
```sql
-- Check that new scope was saved
SELECT scope, "updatedAt" FROM "Account"
WHERE "userId" = '<test-user-id>' AND "providerId" = 'google';
-- scope should contain "calendar.events"
-- updatedAt should be recent (just now)
```

**Pass/Fail**: [ ]

---

### TC-003: Calendar Tool Execution (End-to-End)

**Purpose**: Verify calendar tools work after re-authorization  
**Priority**: Critical  
**Estimated Time**: 10 minutes

**Setup**:
1. Use re-authorized connection from TC-002
2. Create test calendar event manually in Google Calendar

**Steps**:

**Test 3a: List Events**
1. Navigate to agent workspace
2. Open chat with test agent
3. Send message: "List my calendar events for today"
4. Verify agent calls `google-calendar-list-events` tool
5. Verify tool execution succeeds (no scope error)
6. Verify events are returned

**Test 3b: Search Events**
1. Send message: "Search for calendar events with 'meeting' in the title"
2. Verify agent calls `google-calendar-search-events` tool
3. Verify tool execution succeeds
4. Verify matching events returned

**Test 3c: Get Event Details**
1. Note event ID from previous test
2. Send message: "Get details for event [event-id]"
3. Verify agent calls `google-calendar-get-event` tool
4. Verify tool execution succeeds
5. Verify event details returned

**Test 3d: Create Event** (if agent has appropriate instructions)
1. Send message: "Create a test calendar event for tomorrow at 2pm"
2. Verify agent calls `google-calendar-create-event` tool
3. Verify tool execution succeeds
4. Verify event appears in Google Calendar web UI

**Expected Result**:
- All tool executions succeed
- No "missing authorization scope" errors
- Events are correctly listed/searched/retrieved/created
- Server logs show successful API calls to Google Calendar

**Pass/Fail**: [ ]

---

### TC-004: Connection Test Validation

**Purpose**: Verify connection test endpoint correctly validates scopes  
**Priority**: High (if Phase 3 implemented)  
**Estimated Time**: 5 minutes

**Steps**:
1. Get connection ID for Gmail connection
2. Call test endpoint:
   ```bash
   curl -X POST "http://localhost:3001/api/integrations/connections/<connection-id>/test" \
     -H "Cookie: <session-cookie>"
   ```
3. Verify response includes scope validation
4. Response should show `success: true` and `scopeCheck: { ok: true, missing: [] }`

**Expected Result**:
- Test endpoint returns detailed scope validation
- No false positives (doesn't show connected if scopes missing)

**Pass/Fail**: [ ]

---

### TC-005: Fallback Config Edge Case

**Purpose**: Verify fallback is rarely/never used and logs warning when it is  
**Priority**: Medium  
**Estimated Time**: 5 minutes

**Steps**:
1. Temporarily modify API to return provider without `configJson`:
   ```typescript
   // In /api/integrations/providers route, add:
   if (provider.key === "gmail") {
       provider.configJson = null;  // Simulate missing config
   }
   ```
2. Navigate to SetupWizard
3. Check browser console for warning message
4. Verify OAuth flow still works (uses fallback with corrected scopes)
5. Restore original code

**Expected Result**:
- Console warning: "Using fallback OAuth config for gmail..."
- OAuth flow completes successfully with correct scopes
- Calendar tools work after authorization

**Pass/Fail**: [ ]

---

### TC-006: Existing Working Connection (Regression Test)

**Purpose**: Ensure fix doesn't break existing connections  
**Priority**: High  
**Estimated Time**: 3 minutes

**Steps**:
1. Identify user who already has working Gmail+Calendar connection
2. Do NOT re-authorize
3. Test calendar tools with their agent
4. Verify tools still work correctly

**Expected Result**:
- No changes to existing working connections
- Calendar tools continue to function
- No errors in logs

**Pass/Fail**: [ ]

---

### TC-007: Database Seed Idempotency

**Purpose**: Verify repeated database seeds don't corrupt data  
**Priority**: Medium  
**Estimated Time**: 3 minutes

**Steps**:
1. Check current Gmail provider config:
   ```sql
   SELECT "configJson" FROM "IntegrationProvider" WHERE key = 'gmail';
   ```
2. Restart server (triggers `ensureIntegrationProviders()`)
3. Check config again
4. Verify config unchanged (or updated if code changed)

**Expected Result**:
- Database seed is idempotent
- Provider config correctly updated
- No duplicate providers created

**Pass/Fail**: [ ]

---

### TC-008: Cross-Browser OAuth Flow

**Purpose**: Verify OAuth works in different browsers  
**Priority**: Low  
**Estimated Time**: 5 minutes per browser

**Browsers to Test**:
- [ ] Chrome
- [ ] Firefox  
- [ ] Safari
- [ ] Edge

**Steps** (per browser):
1. Open browser in incognito/private mode
2. Navigate to `/sign-up`
3. Complete OAuth flow
4. Test calendar tools

**Expected Result**:
- OAuth completes successfully in all browsers
- No browser-specific issues
- Calendar tools work in all browsers

**Pass/Fail**: [ ]

---

### TC-009: Scope Downgrade Detection

**Purpose**: Verify system detects when user has insufficient scopes  
**Priority**: Medium  
**Estimated Time**: 5 minutes

**Steps**:
1. Manually edit test connection credentials to have only `calendar.readonly`:
   ```sql
   -- WARNING: This test corrupts data - use test environment only
   -- Get encrypted credentials, decrypt, edit scope string, re-encrypt
   ```
2. Try to execute `google-calendar-list-events` tool
3. Verify tool fails with clear error message
4. Verify error message instructs user to re-authorize
5. Restore correct credentials

**Expected Result**:
- Tool execution fails gracefully
- Error message clearly states missing scope
- Error message provides actionable fix instructions

**Pass/Fail**: [ ]

---

### TC-010: Migration Script (If Implemented)

**Purpose**: Verify migration script correctly updates affected connections  
**Priority**: Medium (only if Phase 5 implemented)  
**Estimated Time**: 10 minutes

**Setup**:
1. Create test connection with wrong scope
2. Verify it's broken (calendar tools fail)

**Steps**:
1. Run migration script:
   ```bash
   bun run scripts/fix-calendar-scope.ts
   ```
2. Review script output
3. Check that test connection was identified and fixed
4. Verify credentials now contain `calendar.events`
5. Verify scope string no longer contains `calendar.readonly`

**Expected Result**:
- Script finds affected connections
- Updates scope strings correctly
- No data corruption
- Script is idempotent (can run multiple times safely)

**Pass/Fail**: [ ]

---

## Performance Testing

### Load Test: Mass Re-Authorization

**Purpose**: Verify system handles many users re-authorizing simultaneously  
**Priority**: Low  
**Estimated Time**: 15 minutes

**Steps**:
1. Create 10 test users with Gmail connections
2. Simulate all 10 re-authorizing within 1 minute
3. Monitor server performance
4. Verify all connections created successfully
5. No rate limiting issues with Google OAuth

**Expected Result**:
- All re-authorizations succeed
- No server errors or crashes
- No Google API rate limit errors
- Database connections handled properly

**Pass/Fail**: [ ]

---

## Security Testing

### SEC-001: Scope Privilege Escalation Prevention

**Purpose**: Verify users cannot grant themselves additional scopes  
**Priority**: High  
**Estimated Time**: 10 minutes

**Steps**:
1. Attempt to modify OAuth request to include additional scopes
2. Use browser dev tools to intercept and modify `linkSocial` call
3. Add scope like `calendar` (full access) or `drive` (full write)
4. Complete OAuth flow
5. Check what scopes were actually stored

**Expected Result**:
- User cannot arbitrarily add scopes beyond what platform requests
- Google OAuth validates against approved scopes in Cloud Console
- Better Auth stores only what Google actually granted

**Pass/Fail**: [ ]

### SEC-002: Token Encryption Integrity

**Purpose**: Verify OAuth tokens remain encrypted after scope update  
**Priority**: High  
**Estimated Time**: 5 minutes

**Steps**:
1. Re-authorize connection (TC-002)
2. Query database for connection credentials:
   ```sql
   SELECT credentials FROM "IntegrationConnection" 
   WHERE id = '<connection-id>';
   ```
3. Verify credentials are encrypted (contains `__enc`, `iv`, `tag`, `data` fields)
4. Verify credentials are NOT plaintext JSON

**Expected Result**:
- Credentials remain encrypted
- Encryption format unchanged
- No plaintext tokens in database

**Pass/Fail**: [ ]

---

## Documentation Verification

### DOC-001: Check Privacy Policy

**File**: `apps/frontend/src/app/(Public)/privacy/page.tsx`

**Verify**:
- [ ] Privacy policy lists `calendar.events` scope
- [ ] Description matches actual usage ("manage events" not "view only")
- [ ] No references to deprecated `calendar.readonly`

### DOC-002: Check Security Policy

**File**: `apps/frontend/src/app/(Public)/security/page.tsx`

**Verify**:
- [ ] Security policy lists `calendar.events`
- [ ] Justification updated to reflect write access
- [ ] Data minimization principles still satisfied

### DOC-003: Check Public Docs

**File**: `apps/frontend/content/docs/guides/build-a-sales-agent.mdx`

**Verify**:
- [ ] Setup instructions list correct scope
- [ ] No conflicting scope requirements
- [ ] Google Cloud Console setup instructions accurate

---

## Acceptance Criteria

All of these must be true to consider the fix complete:

- [ ] **TC-001 passes**: Fresh sign-ups get correct scopes
- [ ] **TC-002 passes**: Re-authorization via SetupWizard works
- [ ] **TC-003 passes**: Calendar tools execute successfully
- [ ] **Build passes**: `bun run build` succeeds
- [ ] **Type check passes**: `bun run type-check` succeeds
- [ ] **Lint passes**: `bun run lint` succeeds
- [ ] **No regressions**: Existing working connections unaffected
- [ ] **Documentation updated**: All 6 docs reference correct scope
- [ ] **User verified**: Nathan (or test user) confirms calendar works

---

## Test Results Template

```
Test Execution Date: _____________
Tester Name: _____________
Environment: [ ] Local [ ] Staging [ ] Production

TC-001: Fresh Sign-Up                 [ ] PASS [ ] FAIL
TC-002: Re-Authorization               [ ] PASS [ ] FAIL  
TC-003: Calendar Tool Execution        [ ] PASS [ ] FAIL
TC-004: Connection Test Validation     [ ] PASS [ ] FAIL [ ] N/A
TC-005: Fallback Config Edge Case      [ ] PASS [ ] FAIL
TC-006: Existing Connection Regression [ ] PASS [ ] FAIL
TC-007: Database Seed Idempotency      [ ] PASS [ ] FAIL
TC-008: Cross-Browser OAuth            [ ] PASS [ ] FAIL [ ] SKIP
TC-009: Scope Downgrade Detection      [ ] PASS [ ] FAIL
TC-010: Migration Script               [ ] PASS [ ] FAIL [ ] N/A

SEC-001: Privilege Escalation          [ ] PASS [ ] FAIL
SEC-002: Token Encryption              [ ] PASS [ ] FAIL

DOC-001: Privacy Policy                [ ] PASS [ ] FAIL [ ] N/A
DOC-002: Security Policy               [ ] PASS [ ] FAIL [ ] N/A  
DOC-003: Public Docs                   [ ] PASS [ ] FAIL [ ] N/A

Overall Result: [ ] ALL PASS [ ] SOME FAILURES

Failures/Notes:
_____________________________________________
_____________________________________________
_____________________________________________
```

---

## Known Limitations

These are expected behaviors, NOT bugs:

1. **Users must re-authorize**: Existing connections with wrong scope cannot be fixed without user re-authorization
2. **Scope string shows all scopes**: After re-auth, `Account.scope` includes all Google scopes, even if user only uses Gmail
3. **Migration script only fixes DB**: Changes stored scope string but doesn't refresh actual OAuth token from Google
4. **Connection test may still pass**: If Phase 3 not implemented, test won't validate scopes

---

## Troubleshooting Guide

### Issue: OAuth consent screen still shows calendar.readonly

**Cause**: Browser cached old consent screen  
**Fix**: 
1. Clear browser cache
2. Use incognito window
3. Try different Google account

### Issue: Database seed didn't update

**Cause**: Server didn't restart or seed didn't run  
**Fix**:
```bash
# Check server logs for:
# "[MCP] Ensuring integration providers..."

# Force restart:
pm2 restart agent

# Verify update:
bun run db:studio
# Check IntegrationProvider -> gmail -> configJson
```

### Issue: Calendar tools still fail after re-auth

**Possible Causes**:
1. **Re-auth didn't complete**: Check Account.updatedAt timestamp
2. **Sync didn't run**: Check IntegrationConnection.updatedAt timestamp  
3. **Wrong connection being used**: Multiple Gmail connections exist, agent using old one
4. **Token not refreshed**: Old token still cached somewhere

**Debug**:
```sql
-- Find all Gmail connections for user's org
SELECT ic.id, ic.name, ic."updatedAt", ic.metadata
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ip.key = 'gmail'
AND ic."organizationId" = '<org-id>'
ORDER BY ic."updatedAt" DESC;

-- Check which connection the agent is using
-- (Agent resolves connection by orgId, providerId, and gmailAddress)
```

### Issue: Fallback still being used

**Cause**: Database config.oauthConfig has wrong structure  
**Fix**:
```sql
-- Check provider config structure
SELECT "configJson" FROM "IntegrationProvider" WHERE key = 'gmail';

-- Should return JSON with oauthConfig.scopes array
-- If oauthConfig is missing or malformed, seed didn't apply correctly
```

---

## Appendix: Manual Database Inspection

### Check Stored Scopes

```sql
-- 1. Check Better Auth Account scopes
SELECT 
    u.email,
    a."providerId",
    a.scope,
    a."accessTokenExpiresAt",
    a."updatedAt"
FROM "Account" a
JOIN "User" u ON a."userId" = u.id
WHERE a."providerId" = 'google'
ORDER BY a."updatedAt" DESC;

-- 2. Check IntegrationConnection (credentials are encrypted)
SELECT 
    ic.id,
    ic.name,
    ic."organizationId",
    ic.metadata->>'gmailAddress' as gmail_address,
    ic."isActive",
    ic."lastTestedAt",
    ic."errorMessage",
    ic."updatedAt"
FROM "IntegrationConnection" ic
JOIN "IntegrationProvider" ip ON ic."providerId" = ip.id
WHERE ip.key = 'gmail';

-- 3. Check provider config
SELECT 
    key,
    name,
    "configJson"->'oauthConfig'->'scopes' as oauth_scopes,
    "configJson"->'requiredScopes' as required_scopes
FROM "IntegrationProvider"
WHERE key IN ('gmail', 'google-calendar', 'google-drive');
```

### Decrypt Connection Credentials (Node REPL)

```javascript
// In apps/agent directory
const { prisma } = require("@repo/database");
const { decryptCredentials } = require("./src/lib/credential-crypto");

// Load connection
const connection = await prisma.integrationConnection.findUnique({
    where: { id: "connection-id-here" }
});

// Decrypt and inspect
const creds = decryptCredentials(connection.credentials);
console.log("Scopes:", creds.scope);
console.log("Scope array:", creds.scope.split(/[\s,]+/));
console.log("Has calendar.events:", creds.scope.includes("calendar.events"));
console.log("Has calendar.readonly:", creds.scope.includes("calendar.readonly"));
```

---

## Sign-Off

**Test Execution Completed By**: _____________  
**Date**: _____________  
**Environment**: _____________  
**Result**: [ ] APPROVED FOR PRODUCTION [ ] NEEDS FIXES

**Approver**: _____________  
**Date**: _____________  

**Deployment Authorization**: [ ] APPROVED [ ] DENIED

**Notes**:
_____________________________________________
_____________________________________________

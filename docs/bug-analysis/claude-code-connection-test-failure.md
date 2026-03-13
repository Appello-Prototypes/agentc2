# Root Cause Analysis: Claude Code Agent Connection Test Failure

**Issue ID:** #179  
**GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/179  
**Analysis Date:** 2026-03-13  
**Status:** ✅ Analysis Complete - Implementation Pending

---

## Executive Summary

The Claude Code Agent connection test fails with "Error invoking tool: Request failed" because the connection test endpoint treats Claude Code as an MCP server when it should be validated as a **credential-only provider** (like Cursor). Claude Code does not expose an MCP server - it's a native tool provider that uses the Claude Agent SDK with an Anthropic API key.

**Root Cause:** Missing validation handler for `claude-code` provider in `testCredentialOnlyProvider()` function.

**Severity:** Medium (blocks pipeline dispatch validation but doesn't break functionality if API key is valid)

**Risk Level:** Low (fix is isolated and straightforward)

---

## Detailed Root Cause Analysis

### 1. Code Flow Analysis

#### File: `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts`

**Lines 60-90: Provider Type Routing Logic**

```typescript:60:90:apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts
if (
    connection.provider.providerType === "mcp" ||
    connection.provider.providerType === "custom"
) {
    // Clear any previous errorMessage before testing so the connection
    // is visible to getIntegrationConnections (which filters by errorMessage)
    if (connection.errorMessage) {
        await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: { errorMessage: null }
        });
    }

    // Credential-only providers (e.g. Cursor) use native tools, not MCP.
    // Validate them with a direct API call instead of MCP handshake.
    const credentialOnlyResult = await testCredentialOnlyProvider(
        connection.provider.key,
        getConnectionCredentials(connection)
    );
    if (credentialOnlyResult !== null) {
        await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: {
                lastTestedAt: new Date(),
                errorMessage: credentialOnlyResult.success
                    ? null
                    : credentialOnlyResult.error || "Credential validation failed"
            }
        });
        return NextResponse.json(credentialOnlyResult);
    }
```

**Lines 168-209: Credential-Only Provider Test Function**

```typescript:168:209:apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts
async function testCredentialOnlyProvider(
    providerKey: string,
    credentials: Record<string, unknown>
): Promise<{ success: boolean; error?: string; detail?: string } | null> {
    switch (providerKey) {
        case "cursor": {
            const apiKey = (credentials.CURSOR_API_KEY as string) || (credentials.apiKey as string);
            if (!apiKey) {
                return { success: false, error: "CURSOR_API_KEY not found in credentials" };
            }
            try {
                const basicAuth = Buffer.from(`${apiKey}:`).toString("base64");
                const resp = await fetch("https://api.cursor.com/v0/agents", {
                    method: "GET",
                    headers: {
                        Authorization: `Basic ${basicAuth}`,
                        "Content-Type": "application/json"
                    },
                    signal: AbortSignal.timeout(10_000)
                });
                if (resp.ok || resp.status === 200) {
                    return {
                        success: true,
                        detail: `Cursor API key valid (HTTP ${resp.status})`
                    };
                }
                const body = await resp.text().catch(() => "");
                return {
                    success: false,
                    error: `Cursor API returned HTTP ${resp.status}: ${body.slice(0, 200)}`
                };
            } catch (err) {
                return {
                    success: false,
                    error: `Cursor API unreachable: ${err instanceof Error ? err.message : String(err)}`
                };
            }
        }
        default:
            return null;  // ⚠️ THIS IS THE PROBLEM
    }
}
```

**Problem:** Line 206 returns `null` for any provider not explicitly handled (including `claude-code`).

### 2. Provider Configuration

#### File: `packages/agentc2/src/mcp/client.ts`

**Lines 1269-1302: Claude Code Provider Definition**

```typescript:1269:1302:packages/agentc2/src/mcp/client.ts
{
    key: "claude-code",
    name: "Claude Code Agent",
    description:
        "Autonomous coding agent powered by Claude Agent SDK — launch agents to analyze code, fix bugs, and create PRs",
    category: "developer",
    authType: "apiKey",
    providerType: "custom",  // ⚠️ Treated as MCP server candidate
    configJson: {
        requiredFields: ["ANTHROPIC_API_KEY"],
        fieldDefinitions: {
            ANTHROPIC_API_KEY: {
                label: "Anthropic API Key",
                description:
                    "Same key used for Claude models. Get from https://console.anthropic.com/settings/keys",
                placeholder: "sk-ant-...",
                type: "password"
            }
        },
        importHints: {
            matchNames: ["Claude Code", "claude-code", "Claude Agent SDK"],
            envAliases: {
                ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY"
            }
        },
        linkedProviders: [
            {
                providerKey: "anthropic",
                sharedFields: ["ANTHROPIC_API_KEY"],
                label: "Use existing Anthropic AI key"
            }
        ]
    }
}
```

**Claude Code Characteristics:**
- ✅ `authType: "apiKey"` (requires API key)
- ✅ `providerType: "custom"` (matches condition on line 62)
- ❌ **Does NOT expose an MCP server**
- ✅ Uses native tools (`claude-launch-agent`, `claude-poll-until-done`, etc.)

### 3. Failure Sequence

When `integration_connection_test` is called for the Claude Code connection:

1. **Line 60-62:** Provider type is `"custom"` → enters MCP/custom provider block
2. **Line 75:** Calls `testCredentialOnlyProvider("claude-code", credentials)`
3. **Line 206:** No case for `"claude-code"` → returns `null`
4. **Line 79:** Result is `null` → **falls through to MCP test path**
5. **Line 96-99:** Resolves server ID for `"claude-code"`
6. **Line 103-109:** Calls `testMcpServer()` with the server ID
7. **File: `packages/agentc2/src/mcp/client.ts`, Line 4750:** `resolveServerDefinitionById()` attempts to build MCP server definition
8. **Line 3035-3037:** For `providerType: "custom"`, calls `buildCustomServerDefinition()`
9. **Line 3037:** This returns `null` because Claude Code has no MCP server config
10. **Line 4751-4757:** Server definition is `null` → test fails with "Server definition could not be resolved"
11. **Connection test returns:** `{ success: false, error: "Error invoking tool: Request failed" }`

### 4. Comparison with Working Provider (Cursor)

**Cursor Cloud Agent (Working):**

```typescript:1243:1268:packages/agentc2/src/mcp/client.ts
{
    key: "cursor",
    name: "Cursor Cloud Agent",
    description:
        "Autonomous coding agent — launch cloud agents to write code, fix bugs, and create PRs on GitHub repositories",
    category: "developer",
    authType: "apiKey",
    providerType: "custom",  // Same as claude-code
    configJson: {
        requiredFields: ["CURSOR_API_KEY"],
        fieldDefinitions: {
            CURSOR_API_KEY: {
                label: "Cursor API key",
                description: "Get from https://cursor.com/settings/api",
                placeholder: "cm_...",
                type: "password"
            }
        }
    }
}
```

**Why Cursor Works:**
- Has explicit handler in `testCredentialOnlyProvider()` (line 173)
- Validates API key via `https://api.cursor.com/v0/agents`
- Returns success result → never reaches MCP test path

**Why Claude Code Fails:**
- No handler in `testCredentialOnlyProvider()` → returns `null`
- Falls through to MCP test path
- MCP test fails because Claude Code is not an MCP server

---

## Impact Assessment

### Affected Components

1. **Connection Test Endpoint** (`/api/integrations/connections/[connectionId]/test`)
   - ❌ Cannot validate Claude Code connections
   - ✅ All other 13 connections test successfully

2. **SDLC Pipeline Dispatcher Agent**
   - Uses `claude-launch-agent` tool to dispatch coding tasks
   - ⚠️ If connection test fails, users may think the integration is broken
   - ✅ Actual pipeline dispatch **may still work** if API key is valid (test failure != functionality failure)

3. **Integration UI**
   - Connection shows as "error" status
   - Users cannot verify their Claude Code integration is working

### User-Facing Symptoms

- ❌ Connection test returns "Request failed" error
- ❌ Connection status shows as "error" in UI
- ❌ Users cannot validate their Anthropic API key via UI
- ✅ Actual Claude Code agent dispatch **may still work** (untested)

### Data Flow Impact

```
User Tests Connection
       ↓
POST /api/integrations/connections/{id}/test
       ↓
providerType === "custom" → testCredentialOnlyProvider("claude-code")
       ↓
No case for "claude-code" → returns null
       ↓
Falls through to testMcpServer("claude-code")
       ↓
resolveServerDefinitionById() → buildCustomServerDefinition()
       ↓
No MCP config for claude-code → returns null
       ↓
Test fails: "Server definition could not be resolved"
       ↓
UI shows: "Error invoking tool: Request failed"
```

---

## Fix Plan

### Solution Overview

Add a validation handler for `claude-code` in the `testCredentialOnlyProvider()` function that validates the Anthropic API key via the Anthropic API.

### Implementation Steps

#### Step 1: Add Claude Code Validation Case

**File:** `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts`

**Location:** Lines 168-209 (inside `testCredentialOnlyProvider()` function)

**Change Type:** Add new `case` statement

**Code to Add:**

```typescript
case "claude-code": {
    const apiKey = 
        (credentials.ANTHROPIC_API_KEY as string) || 
        (credentials.apiKey as string);
    
    if (!apiKey) {
        return { 
            success: false, 
            error: "ANTHROPIC_API_KEY not found in credentials" 
        };
    }
    
    try {
        // Validate API key using Anthropic's models endpoint
        const resp = await fetch("https://api.anthropic.com/v1/models", {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(10_000)
        });
        
        if (resp.ok || resp.status === 200) {
            return {
                success: true,
                detail: `Anthropic API key valid (HTTP ${resp.status})`
            };
        }
        
        const body = await resp.text().catch(() => "");
        return {
            success: false,
            error: `Anthropic API returned HTTP ${resp.status}: ${body.slice(0, 200)}`
        };
    } catch (err) {
        return {
            success: false,
            error: `Anthropic API unreachable: ${err instanceof Error ? err.message : String(err)}`
        };
    }
}
```

**Insertion Point:** After the `cursor` case (line 205), before the `default` case (line 206).

**Rationale:**
- Matches existing pattern for Cursor validation
- Uses Anthropic's official `/v1/models` endpoint (read-only, safe for validation)
- Follows Anthropic API best practices (headers: `x-api-key`, `anthropic-version`)
- Consistent timeout handling (10 seconds, same as Cursor)
- Error messages follow existing format

#### Step 2: Add Unit Tests

**File:** `tests/integration/api/connection-test.test.ts` (if exists) OR create new test file

**Test Cases to Add:**

1. **Valid API key test:**
   - Mock successful Anthropic API response (HTTP 200)
   - Verify `{ success: true, detail: "Anthropic API key valid (HTTP 200)" }`

2. **Invalid API key test:**
   - Mock Anthropic API error (HTTP 401)
   - Verify `{ success: false, error: "Anthropic API returned HTTP 401: ..." }`

3. **Missing API key test:**
   - Empty credentials object
   - Verify `{ success: false, error: "ANTHROPIC_API_KEY not found in credentials" }`

4. **Network error test:**
   - Mock fetch rejection (timeout/network error)
   - Verify `{ success: false, error: "Anthropic API unreachable: ..." }`

#### Step 3: Verify Existing Integration Tests Pass

**Files to check:**
- `tests/integration/api/connection-test.test.ts`
- Any tests that exercise the connection test endpoint

**Expected Result:** All existing tests should pass (change is additive, doesn't modify existing behavior)

#### Step 4: Manual Testing

**Test Scenarios:**

1. **Valid Claude Code Connection:**
   - Configure Claude Code integration with valid `ANTHROPIC_API_KEY`
   - Call `POST /api/integrations/connections/{id}/test`
   - Expected: `{ success: true, detail: "Anthropic API key valid (HTTP 200)" }`

2. **Invalid API Key:**
   - Configure with invalid key (e.g., `sk-ant-invalid`)
   - Expected: `{ success: false, error: "Anthropic API returned HTTP 401: ..." }`

3. **Missing Credentials:**
   - Create connection without API key
   - Expected: `{ success: false, error: "ANTHROPIC_API_KEY not found in credentials" }`

4. **Network Failure:**
   - Block outbound HTTPS (simulate network issue)
   - Expected: `{ success: false, error: "Anthropic API unreachable: ..." }`

5. **Other Connections Still Work:**
   - Test Cursor Cloud Agent connection (should still work)
   - Test all other 13 connections
   - Expected: All connections test successfully as before

#### Step 5: Update Connection in Database

After code fix is deployed, update the failing connection:

```sql
-- Clear error message so connection shows as healthy
UPDATE "IntegrationConnection"
SET "errorMessage" = NULL,
    "lastTestedAt" = NOW()
WHERE id = 'cmmmdce3s008o8ej55wc0assq';
```

---

## Risk Assessment

### Implementation Risk: **LOW**

**Why:**
- ✅ Change is isolated to one function
- ✅ Additive change (doesn't modify existing behavior)
- ✅ Follows existing pattern (Cursor validation)
- ✅ No database schema changes
- ✅ No breaking API changes
- ✅ Uses well-documented Anthropic API endpoint

### Regression Risk: **LOW**

**Affected Code Paths:**
- Only affects connection test for `claude-code` provider
- Does not affect runtime agent dispatch
- Does not affect other providers

**Mitigation:**
- Comprehensive test coverage
- Manual verification of all 14 connection types
- Rollback plan: revert single function change

### Deployment Risk: **LOW**

**Why:**
- No database migrations required
- No environment variable changes
- Can deploy during business hours
- Instant rollback possible

---

## Alternative Solutions Considered

### Alternative 1: Change `providerType` to `"native"`

**Approach:** Create new `providerType` value for credential-only providers

**Pros:**
- More explicit provider categorization
- Clearer separation of MCP vs native tools

**Cons:**
- ❌ Requires database migration
- ❌ Requires schema changes (`ProviderType` enum)
- ❌ Breaks existing `"custom"` provider logic
- ❌ Higher implementation complexity

**Decision:** ❌ Rejected (overkill for this issue)

### Alternative 2: Add MCP Server for Claude Code

**Approach:** Wrap Claude Agent SDK in an MCP server

**Pros:**
- Consistent with other integrations
- Could enable dynamic tool discovery

**Cons:**
- ❌ Unnecessary complexity (Claude tools are static)
- ❌ Performance overhead (extra IPC layer)
- ❌ Maintenance burden (new server to maintain)
- ❌ Doesn't solve the immediate problem

**Decision:** ❌ Rejected (over-engineering)

### Alternative 3: Skip Validation for `claude-code`

**Approach:** Return `{ success: true }` without API call

**Pros:**
- ✅ Simple implementation

**Cons:**
- ❌ Doesn't actually validate credentials
- ❌ Users can't verify their API key is correct
- ❌ False positives (invalid keys show as valid)

**Decision:** ❌ Rejected (defeats purpose of connection test)

---

## Dependencies

### External APIs

- **Anthropic API** (`https://api.anthropic.com/v1/models`)
  - Used for: API key validation
  - Rate limits: Standard Anthropic API limits apply
  - Availability: 99.9% uptime SLA
  - Documentation: https://docs.anthropic.com/en/api/models

### Internal Dependencies

- `getConnectionCredentials()` - extracts decrypted credentials
- `prisma.integrationConnection.update()` - updates test results
- Database connection (PostgreSQL via Prisma)

### Environment Variables

- `ANTHROPIC_API_KEY` (optional fallback for testing)
- `CREDENTIAL_ENCRYPTION_KEY` (required for credential decryption)

---

## Testing Checklist

### Pre-Implementation

- [x] Root cause analysis complete
- [x] Fix plan reviewed
- [x] Code locations identified
- [x] Test scenarios defined

### During Implementation

- [ ] Add `claude-code` case to `testCredentialOnlyProvider()`
- [ ] Add unit tests for all scenarios
- [ ] Run `bun run type-check` (must pass)
- [ ] Run `bun run lint` (must pass)
- [ ] Run `bun run format` (must pass)
- [ ] Run `bun run build` (must pass)

### Post-Implementation

- [ ] Manual test: Valid API key → success
- [ ] Manual test: Invalid API key → failure with clear error
- [ ] Manual test: Missing API key → failure with clear error
- [ ] Manual test: Network error → failure with clear error
- [ ] Manual test: All 14 connections test successfully
- [ ] Update failing connection in database
- [ ] Verify SDLC pipeline dispatch works
- [ ] Update issue #179 with fix confirmation

---

## Success Metrics

### Functional Success

- ✅ Claude Code connection test returns `{ success: true }` for valid API key
- ✅ Clear error messages for invalid/missing keys
- ✅ Connection status shows as "connected" in UI
- ✅ All other connections continue to work

### Performance

- ⏱️ Test completes in < 10 seconds (same as Cursor)
- ⏱️ No increase in overall test endpoint latency

### Reliability

- 🎯 Test result accuracy: 100% (valid keys pass, invalid keys fail)
- 🎯 Zero false positives (invalid keys don't show as valid)
- 🎯 Zero false negatives (valid keys don't show as invalid)

---

## Rollback Plan

### If Issues Arise

1. **Immediate rollback:** Revert commit via `git revert`
2. **Database cleanup:** Not needed (no schema changes)
3. **Notification:** Update issue #179 with rollback status

### Rollback Steps

```bash
# Identify problematic commit
git log --oneline -n 10

# Revert the commit
git revert <commit-hash>

# Push rollback
git push origin main

# Clear connection error manually (if needed)
psql $DATABASE_URL -c "UPDATE \"IntegrationConnection\" SET \"errorMessage\" = NULL WHERE id = 'cmmmdce3s008o8ej55wc0assq';"
```

---

## Related Code References

### Key Files Modified

- `apps/agent/src/app/api/integrations/connections/[connectionId]/test/route.ts` (lines 168-209)

### Reference Implementations

- **Cursor validation:** Lines 173-205 (same file)
- **Anthropic API usage:** `packages/agentc2/src/agents/model-registry.ts` (lines 1417-1428)
- **Claude tools:** `packages/agentc2/src/tools/claude-tools.ts` (lines 47-82)

### Related Issues

- Issue #179: Claude Code Agent connection test fails
- Provider definition: `packages/agentc2/src/mcp/client.ts` (lines 1269-1302)
- Blueprint definition: `packages/agentc2/src/integrations/blueprints/developer.ts` (lines 303-361)

---

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| Code implementation | 15 minutes | Add `claude-code` case to function |
| Unit test implementation | 30 minutes | Add comprehensive test coverage |
| Local testing | 15 minutes | Manual verification of all scenarios |
| Build & type checks | 5 minutes | Run all quality checks |
| Git commit & push | 5 minutes | Commit with proper message |
| **Total** | **70 minutes** | **End-to-end fix implementation** |

### Post-Deploy

| Phase | Duration | Description |
|-------|----------|-------------|
| Deployment | ~5 minutes | Automatic via GitHub Actions |
| Connection test verification | 5 minutes | Test production connection |
| Database cleanup | 2 minutes | Clear error message |
| Documentation update | 5 minutes | Update issue #179 |
| **Total** | **17 minutes** | **Post-deploy verification** |

---

## Conclusion

The Claude Code connection test failure is caused by a **missing validation handler** in the `testCredentialOnlyProvider()` function. The fix is straightforward, low-risk, and follows the existing pattern for the Cursor Cloud Agent provider.

**Key Findings:**

1. ✅ Root cause identified: Missing case in switch statement
2. ✅ Fix location identified: Single function, single file
3. ✅ Implementation pattern exists: Copy Cursor approach
4. ✅ API endpoint documented: Anthropic `/v1/models` endpoint
5. ✅ Risk level: Low (isolated, additive change)

**Recommended Action:** Implement fix as outlined in Step 1 above.

**Next Steps:**

1. Review this analysis document
2. Get approval to proceed with implementation
3. Implement fix following the detailed plan
4. Deploy and verify
5. Close issue #179

---

**Analysis Performed By:** Claude (Sonnet 4.5)  
**Date:** 2026-03-13  
**Review Status:** ⏳ Pending Human Review  
**Implementation Status:** ⏳ Not Started

# Test Suite Failure Analysis

Analysis of [GitHub Actions run 22460191770](https://github.com/Appello-Prototypes/agentc2/actions/runs/22460191770/job/65052102937?pr=8)

**Date**: February 26, 2026  
**Branch**: `cursor/failing-test-suite-analysis-469a`

---

## Executive Summary

The test suite has **5 categories of failures** across E2E and integration tests:

1. **Sandbox Infrastructure Tests**: Missing filesystem mocks (`realpath`, `lstat`)
2. **MCP API Test**: Missing database mock (`agentInstance.findMany`)
3. **Networks API Test**: Missing authentication mock
4. **Triggers API Test**: Missing authentication mock + incomplete mock expectations
5. **Webhook Execution Tests**: Tests written for old fail-open logic, need updates for new fail-closed signature verification

All issues are test-only problems - no production code bugs identified.

---

## Detailed Root Cause Analysis

### 1. Sandbox Infrastructure Tests (E2E)

**Location**: `tests/e2e/sandbox-infra.test.ts`  
**Failing tests**:

- `execute-code > falls back to child_process when Docker is unavailable` (line 65)
- `execute-code > accepts networkAccess and injectCredentials params` (line 86)

**Error**:

```
ENOENT: no such file or directory, realpath '/var/lib/agentc2/workspaces/test-agent'
```

**Root Cause**:  
The test mocks `fs/promises` module (lines 42-52) but only includes:

- `mkdir`, `writeFile`, `readFile`, `stat`, `readdir`

Missing from mock:

- `realpath` - called by `ensureWorkspaceDir` at line 171 of `sandbox-tools.ts`
- `lstat` - potentially called by path validation logic

When `executeCodeTool.execute` runs, it calls `ensureWorkspaceDir` which calls `realpath(dir)`. Since `realpath` isn't mocked, it hits the real filesystem in CI and fails because `/var/lib/agentc2/workspaces/test-agent` doesn't exist.

**Code Flow**:

```
executeCodeTool.execute (line 505)
  → ensureWorkspaceDir(agentId) (line 514)
    → realpath(dir) (line 171)
      → Real filesystem access
        → ENOENT error in CI
```

---

### 2. MCP API Test

**Location**: `tests/integration/api/mcp-api.test.ts:100`  
**Failing test**: `should list active workflow and network tools`

**Error**:

```
Status 500: {"success":false,"error":"Cannot read properties of undefined (reading 'map')"}
```

**Root Cause**:  
The test mocks three database queries (lines 43-92):

- ✅ `agent.findMany` - mocked
- ✅ `workflow.findMany` - mocked
- ✅ `network.findMany` - mocked
- ❌ `agentInstance.findMany` - **NOT mocked**

The MCP route's GET handler queries agent instances at line 442:

```typescript
const instances = await prisma.agentInstance.findMany({
    where: {
        isActive: true,
        organization: { id: organizationId }
    }
    // ...
});
```

When `agentInstance.findMany` is unmocked with `vitest-mock-extended`, it returns a mock proxy that behaves unpredictably. This causes the route to throw an error when trying to map over the result.

**Code Flow**:

```
GET /api/mcp (line 170)
  → prisma.agentInstance.findMany (line 442)
    → Returns undefined or throws (unmocked)
      → Route catches error at line 538
        → Returns 500 with error message
          → Test's assertSuccess fails
```

---

### 3. Networks API Test

**Location**: `tests/integration/api/networks-api.test.ts:102`  
**Failing test**: `should apply filters when listing network runs`

**Error**:

```
Expected success response, got status 401: {"error":"Unauthorized"}
```

**Root Cause**:  
The test file mocks authentication incorrectly. Looking at the mocks (lines 11-26):

```typescript
vi.mock("@repo/database", () => ({ prisma: prismaMock }));
vi.mock("@repo/auth", () => ({
    auth: {
        api: {
            getSession: getSessionMock
        }
    }
}));
vi.mock("@/lib/organization", () => ({
    getUserOrganizationId: getUserOrganizationIdMock,
    getDefaultWorkspaceIdForUser: getDefaultWorkspaceIdForUserMock
}));
```

But the actual route imports and calls `authenticateRequest` from `@/lib/api-auth`:

```typescript
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, ...) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ...
}
```

The test never mocks `authenticateRequest`, so it returns `null`, triggering the 401 response.

**Comparison with working test**:  
`tests/integration/api/triggers.test.ts` (which passes) correctly mocks `authenticateRequest`:

```typescript
const authenticateRequestMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: authenticateRequestMock
}));

beforeEach(() => {
    authenticateRequestMock.mockResolvedValue({
        userId: "user-1",
        organizationId: "org-1"
    });
});
```

---

### 4. Triggers API Test

**Location**: `tests/integration/api/triggers-api.test.ts:68`  
**Failing test**: `filters triggers by type`

**Error**:

```
AssertionError: expected "vi.fn()" to be called with arguments: [ ObjectContaining{…} ]

Received actual query with extra fields:
  - select: { id, name, description, triggerType, webhookPath, webhookSecret, isActive, createdAt, triggerCount, lastTriggeredAt, agent: {...} }
  - orderBy: { createdAt: "desc" }
  - where: { agent: { workspace: { organizationId: "org-1" } }, triggerType: "webhook" }
```

**Root Causes**: Two issues:

1. **Missing authentication mock** (same as Networks API)
    - Test doesn't mock `authenticateRequest` from `@/lib/api-auth`
    - Route uses `authenticateRequest` helper
    - Unmocked helper returns `null`, causing 401

2. **Incomplete mock expectation** (line 68-72)
    - Test expects only `where: { triggerType: "webhook" }`
    - Actual route query (lines 29-49 of `triggers/route.ts`) includes:
        - Full `select` clause with all returned fields
        - `agent` relation with nested select
        - `orderBy: { createdAt: "desc" }`
        - `where` with nested organization filter

The test's `expect.objectContaining` doesn't account for these additional fields, causing a mismatch.

---

### 5. Webhook Execution Tests

**Location**: `tests/integration/api/webhook-execution.test.ts`  
**Failing tests**:

- `returns 401 for invalid signature` (line 151)
- `returns 401 for expired timestamp` (line 183)

**Error**:

```
AssertionError: expected "vi.fn()" to be called at least once
```

(Expected `updateTriggerEventRecordMock` to be called)

**Root Cause**:  
The webhook route was refactored to use **fail-closed signature verification**. The tests were written for the old fail-open logic.

**Old Flow** (what tests expect):

1. Create trigger event record
2. Verify signature
3. Update event record status if verification fails

**New Flow** (actual implementation):

1. Verify signature (lines 103-149)
2. **Return 401 IMMEDIATELY if invalid** (lines 114-135)
3. Create trigger event record (line 161) - only if signature passed
4. Update event status if trigger/agent inactive (lines 177-191)

**Why tests fail**:  
Tests at lines 151 and 183 expect `updateTriggerEventRecord` to be called when:

- Signature is invalid
- Timestamp is expired

But in the new fail-closed flow, the route returns 401 BEFORE creating any database records. So neither `createTriggerEventRecord` nor `updateTriggerEventRecord` are called.

**Additional Issue**:  
Line 105 of webhook route calls `decryptString(trigger.webhookSecret)` to decrypt the stored secret, but this isn't mocked in tests. However, the tests pass `webhookSecret: "secret"` as plain text, so `decryptString` needs to be mocked to return the input unchanged.

---

## Resolution Plan

### Phase 1: Fix Sandbox Infrastructure Tests ✅

**File**: `tests/e2e/sandbox-infra.test.ts`

```typescript
// Add to fs/promises mock (line 42):
vi.mock("fs/promises", async () => {
    const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
    return {
        ...actual,
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue("file content"),
        stat: vi.fn().mockResolvedValue({ size: 123, isFile: () => true }),
        readdir: vi.fn().mockResolvedValue([]),
        realpath: vi.fn((path) => Promise.resolve(path)), // ADD
        lstat: vi.fn().mockResolvedValue({ size: 123, isFile: () => true }) // ADD
    };
});
```

### Phase 2: Fix MCP API Test ✅

**File**: `tests/integration/api/mcp-api.test.ts`

```typescript
// Add to test setup (after line 92, before GET call):
prismaMock.agentInstance.findMany.mockResolvedValue([]);
```

### Phase 3: Fix Networks API Test ✅

**File**: `tests/integration/api/networks-api.test.ts`

```typescript
// Add after imports:
const authenticateRequestMock = vi.fn();

// Add to mocks:
vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: authenticateRequestMock
}));

// Add to beforeEach:
authenticateRequestMock.mockResolvedValue({
    userId: "user-1",
    organizationId: "org-1"
});

// Remove unnecessary mocks:
// - getSessionMock (no longer needed)
// - getUserOrganizationIdMock (no longer needed)
// - vi.mock("@repo/auth") (no longer needed)
// - vi.mock("@/lib/organization") (no longer needed)
```

### Phase 4: Fix Triggers API Test ✅

**File**: `tests/integration/api/triggers-api.test.ts`

```typescript
// Add after imports:
const authenticateRequestMock = vi.fn();

// Add to mocks:
vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: authenticateRequestMock
}));

// Add to beforeEach:
authenticateRequestMock.mockResolvedValue({
    userId: "user-1",
    organizationId: "org-1"
});

// Update assertion at line 68:
expect(prismaMock.agentTrigger.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
        where: expect.objectContaining({
            triggerType: "webhook"
        })
    })
);
```

### Phase 5: Fix Webhook Execution Tests ✅

**File**: `tests/integration/api/webhook-execution.test.ts`

```typescript
// Add after imports:
const decryptStringMock = vi.fn((s: string) => s);

// Add to mocks:
vi.mock("@/lib/credential-crypto", () => ({
    decryptString: decryptStringMock
}));

// Update "returns 401 for invalid signature" test (line 129):
// Remove line 151: expect(updateTriggerEventRecordMock).toHaveBeenCalled();
// Add: expect(createTriggerEventRecordMock).not.toHaveBeenCalled();

// Update "returns 401 for expired timestamp" test (line 154):
// Remove line 183: expect(updateTriggerEventRecordMock).toHaveBeenCalled();
// Add: expect(createTriggerEventRecordMock).not.toHaveBeenCalled();

// Keep lines 105 and 126 unchanged - these correctly expect updateTriggerEventRecord
```

### Phase 6: Verification ✅

```bash
bun run test           # Verify all tests pass
bun run type-check     # Ensure no type errors
bun run lint           # Ensure no linting errors
bun run build          # Ensure build succeeds
git add -A             # Stage changes
git commit -m "fix: resolve test suite failures"
git push               # Trigger CI recheck
```

---

## Key Takeaways

### 1. Mock Completeness

When mocking Node.js built-in modules like `fs/promises`, ensure ALL used functions are mocked. The sandbox tools use:

- Standard: `mkdir`, `writeFile`, `readFile`, `stat`, `readdir`
- Path resolution: `realpath`, `lstat` ← These were missed

### 2. Authentication Consistency

API routes consistently use `authenticateRequest` helper from `@/lib/api-auth`, not direct auth calls. Tests must mock the same helper, not the underlying auth library.

### 3. Security Architecture Changes

When security logic is refactored (fail-open → fail-closed), tests must be updated to match:

- **Fail-open**: Create record → Verify → Update status
- **Fail-closed**: Verify → Return early if invalid → Create record

Tests expecting database writes during verification failures are no longer valid.

### 4. Mock Granularity

Database mocks should match actual queries:

- Use `expect.objectContaining` for flexible matching
- Don't assume minimal `where` clauses - routes often add `select`, `orderBy`, nested relations
- Mock ALL queries in the route, not just the ones the test focuses on

---

## Implementation Status

- [ ] Phase 1: Sandbox infrastructure tests fixed
- [ ] Phase 2: MCP API test fixed
- [ ] Phase 3: Networks API test fixed
- [ ] Phase 4: Triggers API test fixed
- [ ] Phase 5: Webhook execution tests fixed
- [ ] Phase 6: All tests verified passing in CI

---

## Additional Notes

### Test Infrastructure Improvements Needed (Future)

1. **Shared auth mock helper**: Create `tests/utils/auth-mock.ts` to standardize authentication mocking
2. **Comprehensive fs mock**: Create `tests/utils/fs-mock.ts` with all filesystem functions pre-mocked
3. **Mock validation**: Add a test-time validator to warn when routes call unmocked database queries

### CI Environment Considerations

The CI environment (GitHub Actions) has:

- No Docker daemon available
- No `/var/lib/agentc2/` directory structure
- Limited filesystem access

Tests must either:

- Mock all filesystem operations completely, OR
- Skip tests requiring filesystem access in CI (using `process.env.CI` checks)

The current approach (full mocking) is preferred for deterministic test behavior.

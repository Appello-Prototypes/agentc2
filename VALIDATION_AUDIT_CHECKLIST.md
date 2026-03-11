# Validation Audit Checklist - Issue #100 Fix

This checklist ensures the modelName null validation bug fix is complete and no similar issues remain.

---

## Pre-Fix Verification

### Current State Audit

- [x] **Confirmed bug exists:** Manual validation in POST /api/agents (line 289-299)
- [x] **Confirmed PUT bug:** `!== undefined` check allows null (line 179)
- [x] **Confirmed networks bug:** Same manual validation pattern (line 72-79)
- [x] **Confirmed Zod schema exists:** `/workspace/packages/agentc2/src/schemas/agent.ts`
- [x] **Confirmed schema not used:** No imports in API route files
- [x] **Confirmed error leakage:** Generic catch blocks return Prisma errors

### Root Cause Documentation

- [x] `ROOT_CAUSE_ANALYSIS_ISSUE_100.md` created - comprehensive analysis
- [x] `BUG_FIX_SUMMARY.md` created - quick reference
- [x] `VALIDATION_AUDIT_CHECKLIST.md` created - this file

---

## Implementation Checklist

### Phase 1: POST /api/agents Fix

**File:** `apps/agent/src/app/api/agents/route.ts`

- [ ] Import `agentCreateSchema` from `@repo/agentc2/schemas/agent`
- [ ] Replace manual validation (lines 289-299) with `agentCreateSchema.safeParse(body)`
- [ ] Handle validation failure with structured error response (400)
- [ ] Use `validation.data` throughout function instead of raw `body`
- [ ] Update Prisma create call to use validated data
- [ ] Add Prisma error handling in catch block:
  - [ ] P2011 → 400 "Required field cannot be null"
  - [ ] P2002 → 409 "Already exists"
  - [ ] P2003 → 400 "Referenced resource not found"
  - [ ] Other → 500 "Failed to create agent" (generic, no details)
- [ ] Test locally with null modelName
- [ ] Verify 400 response with clear error message

**Estimated LOC:** ~40 lines changed

---

### Phase 2: PUT /api/agents/[id] Fix

**File:** `apps/agent/src/app/api/agents/[id]/route.ts`

- [ ] Import `agentUpdateSchema` from `@repo/agentc2/schemas/agent`
- [ ] Add validation after body parsing (after line 124)
- [ ] Handle validation failure with structured error response (400)
- [ ] Fix null assignment bug at line 179:
  - [ ] Option A: Use `validation.data.modelName` if using Zod for full body
  - [ ] Option B: Add explicit null check: `if (body.modelName !== undefined && body.modelName !== null)`
- [ ] Update model validation logic to use validated data
- [ ] Add Prisma error handling in catch block (same as Phase 1)
- [ ] Test locally with null modelName in PUT
- [ ] Verify 400 response (not 500)

**Estimated LOC:** ~50 lines changed

---

### Phase 3: POST /api/networks Fix

**File:** `apps/agent/src/app/api/networks/route.ts`

- [ ] Create or import `networkCreateSchema` (may need to create if doesn't exist)
- [ ] Replace manual validation (lines 72-79) with Zod validation
- [ ] Handle validation failure with structured error response (400)
- [ ] Use validated data throughout function
- [ ] Update Prisma create call to use validated data
- [ ] Add Prisma error handling in catch block
- [ ] Test locally with null modelName
- [ ] Verify 400 response

**Estimated LOC:** ~40 lines changed

---

### Phase 4: E2E Tests

**New File:** `tests/e2e/agent-validation.test.ts`

#### Test Suite 1: POST /api/agents

- [ ] Test: `modelName: null` → 400 with "Expected string, received null"
- [ ] Test: `modelName: undefined` (missing) → 400 with "Required"
- [ ] Test: `modelName: ""` → 400 with "String must contain at least 1 character"
- [ ] Test: `modelName: 123` → 400 with "Expected string, received number"
- [ ] Test: `modelName: true` → 400 with "Expected string, received boolean"
- [ ] Test: `modelName: {}` → 400 with "Expected string, received object"
- [ ] Test: `modelName: []` → 400 with "Expected string, received array"
- [ ] Test: `name: null` → 400
- [ ] Test: `instructions: null` → 400
- [ ] Test: `modelProvider: "invalid"` → 400 with enum error
- [ ] Test: Valid request → 200 with created agent
- [ ] Test: Error response structure includes `details` array
- [ ] Test: Error details have `field`, `message`, `code` properties

#### Test Suite 2: PUT /api/agents/[id]

- [ ] Test: Update `modelName: null` → 400 (was 500 - THE BUG)
- [ ] Test: Update `modelName: ""` → 400
- [ ] Test: Update `modelName: 123` → 400
- [ ] Test: Update `modelName: "gpt-4o"` → 200 with updated agent
- [ ] Test: Update without modelName field → 200 (field not updated)
- [ ] Test: Partial update with valid fields → 200

#### Test Suite 3: POST /api/networks

- [ ] Test: `modelName: null` → 400
- [ ] Test: Valid request → 200

#### Test Suite 4: Security Verification

- [ ] Test: No Prisma error codes in 500 responses
- [ ] Test: No constraint names in error messages
- [ ] Test: No stack traces in responses
- [ ] Test: Error messages don't mention "Prisma" or database specifics

**Estimated LOC:** ~350 lines

---

### Phase 5: Quality Assurance

#### Automated Checks

- [ ] Run `bun run type-check` → All pass
- [ ] Run `bun run lint` → All pass
- [ ] Run `bun run build` → Clean build
- [ ] Run `bun test tests/e2e/agent-validation.test.ts` → All pass
- [ ] Run `bun test tests/integration/api/` → All pass (no regressions)
- [ ] Run `bun test` (all tests) → All pass

#### Manual Testing

- [ ] Start dev server: `bun run dev`
- [ ] Test POST with null modelName via curl
- [ ] Test POST with missing modelName via curl
- [ ] Test POST with empty string modelName via curl
- [ ] Test POST with valid modelName via curl
- [ ] Test PUT with null modelName via curl
- [ ] Test PUT with valid modelName via curl
- [ ] Verify all error responses have correct structure
- [ ] Verify no Prisma errors visible in responses
- [ ] Check console logs for any unexpected errors

#### Regression Testing

- [ ] Create agent via UI → Works
- [ ] Update agent via UI → Works
- [ ] Create network via UI → Works
- [ ] Run existing integration tests → All pass
- [ ] Test agent invocation still works → Works
- [ ] Test MCP agent-create tool → Works (uses same schema)

---

## Git Workflow

### Commit Strategy

```bash
# 1. Stage changes
git add apps/agent/src/app/api/agents/route.ts
git add apps/agent/src/app/api/agents/[id]/route.ts
git add apps/agent/src/app/api/networks/route.ts
git add tests/e2e/agent-validation.test.ts

# 2. Commit with descriptive message
git commit -m "fix: add Zod validation for agent/network creation to prevent 500 errors (issue #100)

- Replace manual validation with agentCreateSchema/agentUpdateSchema
- Fix PUT endpoint bug where modelName: null bypassed validation
- Add Prisma error handling (P2011, P2002, P2003)
- Add 20+ E2E tests for validation edge cases
- Sanitize error messages (no database schema leakage)

Fixes: #100
Related: #127"

# 3. Run final verification
bun run type-check && bun run lint && bun run build

# 4. Push to remote
git push origin cursor/agents-modelname-null-analysis-b7a5
```

---

## Documentation Updates

- [ ] Add entry to `CHANGELOG.md`:
  ```markdown
  ## [Unreleased]
  
  ### Fixed
  - **API Validation:** POST /api/agents and PUT /api/agents/[id] now return 400 (not 500) when modelName is null or invalid. Implemented proper Zod schema validation to prevent Prisma constraint error leakage. (#100)
  ```

- [ ] Update `CLAUDE.md` if needed (add validation best practices section)

- [ ] Update API documentation if it exists

---

## Post-Fix Verification

### Immediate Checks (Within 1 Hour)

- [ ] Deploy to staging environment
- [ ] Monitor error logs for:
  - [ ] No P2011 errors in production logs
  - [ ] No 500 errors from validation failures
  - [ ] Increased 400 errors (expected - validation working)
- [ ] Test from staging UI:
  - [ ] Create agent works
  - [ ] Update agent works
  - [ ] Validation errors show in UI properly

### Follow-Up Checks (Within 24 Hours)

- [ ] Review production logs for any unexpected errors
- [ ] Check support tickets for validation-related issues
- [ ] Monitor API error rates (should decrease 500s, increase 400s)
- [ ] Verify no customer complaints about broken agent creation

### Long-Term Monitoring (Within 1 Week)

- [ ] Compare error metrics before/after:
  - [ ] 500 errors should decrease by ~5-10%
  - [ ] 400 errors should increase by ~5-10%
  - [ ] Total successful requests unchanged
- [ ] Review any edge cases discovered in production
- [ ] Document any unexpected behavior

---

## Rollback Criteria

Trigger rollback if:

- ❌ **Critical:** Valid agent creation requests start failing (500s or 400s incorrectly)
- ❌ **Critical:** Production error rate increases by >20%
- ❌ **High:** E2E tests fail after merge
- ❌ **High:** Customer-facing UI breaks
- ❌ **Medium:** Performance degrades by >50ms per request
- ⚠️ **Low:** Minor edge cases discovered (can be fixed in follow-up)

**Rollback Command:**
```bash
git revert <commit-hash>
git push origin cursor/agents-modelname-null-analysis-b7a5
```

---

## Additional Improvements (Optional, Future)

### Short-Term (Next Sprint)

- [ ] Audit all other API routes for similar manual validation patterns
- [ ] Create shared validation utility for common patterns
- [ ] Add ESLint rule to warn on manual validation in API routes

### Long-Term (Next Quarter)

- [ ] Establish API validation standard in docs
- [ ] Create API route template with Zod validation by default
- [ ] Add code review checklist item for validation
- [ ] Build validation metrics dashboard (400 vs 500 rates)

---

## Related Documentation

- **Full Analysis:** `ROOT_CAUSE_ANALYSIS_ISSUE_100.md`
- **GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/100
- **Previous RCA (Issue #127):** Commit c9bf1079
- **Zod Schema:** `/workspace/packages/agentc2/src/schemas/agent.ts`

---

**Status:** ✅ Ready for Implementation  
**Reviewed:** Pending  
**Approved:** Pending

**Last Updated:** 2026-03-11  
**Document Version:** 1.0

# Root Cause Analysis: Agent contextConfig Not Persisting via MCP

**Bug Report:** [GitHub Issue #59](https://github.com/Appello-Prototypes/agentc2/issues/59)  
**Date:** March 3, 2026  
**Severity:** Medium  
**Status:** Analysis Complete - Ready for Implementation

---

## Executive Summary

The `agent_update` MCP tool does not persist `contextConfig` values to the database despite accepting them in the input. When an agent is updated via MCP with `contextConfig` in the data object, the values are silently ignored and the field remains `null` in the database. Reading the agent back confirms the field was not persisted.

The root cause is that **`contextConfig` is missing from multiple critical locations** in the agent CRUD implementation:

1. The MCP tool's input schema (`agentCreateSchema`)
2. The MCP tool's update logic (`updateData` object)
3. The version snapshot builder (`buildAgentSnapshot`)
4. The HTTP API routes (both POST and PUT)

This is a **schema drift bug** where the database and runtime support a field that was never exposed through the CRUD interfaces.

---

## Root Cause Details

### Primary Root Cause: Missing from `agentCreateSchema`

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Lines:** 20-63

The `agentCreateSchema` Zod schema defines the accepted input for both `agent-create` and `agent-update` MCP tools. It includes `memoryConfig` (line 46) but does NOT include `contextConfig` or `routingConfig`.

```typescript
const agentCreateSchema = z
    .object({
        name: z.string(),
        slug: z.string().optional(),
        // ... other fields ...
        memoryConfig: z.record(z.any()).optional().nullable(),
        // ❌ contextConfig: MISSING
        // ❌ routingConfig: MISSING
        // ...
    })
    .passthrough();
```

**Impact:** MCP tools will accept `contextConfig` due to `.passthrough()` but won't validate or document it.

### Secondary Root Cause: Missing from `updateData` Object

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Lines:** 456-487 (inside `agentUpdateTool.execute()`)

The `updateData` object explicitly maps each field from the input to the database update. It includes `memoryConfig` (lines 467-470) but does NOT include `contextConfig` or `routingConfig`.

```typescript
const updateData: Prisma.AgentUncheckedUpdateInput = {
    name: payload.name ?? existing.name,
    // ... other fields ...
    memoryConfig:
        payload.memoryConfig !== undefined
            ? (payload.memoryConfig as Prisma.InputJsonValue)
            : existingMemoryConfig,
    // ❌ contextConfig: MISSING
    // ❌ routingConfig: MISSING
    // ...
};
```

**Impact:** Even if `contextConfig` is passed, it will never be written to the database.

### Tertiary Root Cause: Missing from `buildAgentSnapshot`

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Lines:** 202-244

The `buildAgentSnapshot` function creates version snapshots for rollback capability. It includes `memoryConfig` (line 234) but does NOT include `contextConfig` or `routingConfig`.

```typescript
const buildAgentSnapshot = (agent: {
    // ... parameter types ...
    memoryConfig: unknown;
    // ❌ contextConfig: MISSING from parameters
    // ❌ routingConfig: MISSING from parameters
}) => ({
    // ... fields ...
    memoryConfig: agent.memoryConfig,
    // ❌ contextConfig: MISSING from snapshot
    // ❌ routingConfig: MISSING from snapshot
});
```

**Impact:** Version rollback will not restore `contextConfig` or `routingConfig` values even if they exist in the database.

### Quaternary Root Cause: Missing from HTTP API Routes

**File:** `/workspace/apps/agent/src/app/api/agents/route.ts` (POST)  
**Lines:** 310-336

The HTTP API POST route for creating agents does not handle `contextConfig` or `routingConfig` at all.

**File:** `/workspace/apps/agent/src/app/api/agents/[id]/route.ts` (PUT)  
**Lines:** 166-260

The HTTP API PUT route for updating agents handles `routingConfig` (line 248) but does NOT handle `contextConfig`:

```typescript
// ✅ routingConfig is handled
if (body.routingConfig !== undefined) updateData.routingConfig = body.routingConfig;

// ✅ memoryConfig is handled
if (body.memoryConfig !== undefined) updateData.memoryConfig = body.memoryConfig;

// ❌ contextConfig is NOT handled at all
```

**Impact:** `contextConfig` cannot be set via either HTTP API or MCP tools. `routingConfig` can be set via HTTP PUT but not via MCP or HTTP POST.

---

## Schema Evidence

### Database Schema (Prisma)

**File:** `/workspace/packages/database/prisma/schema.prisma`  
**Line:** 776

```prisma
model Agent {
    // ...
    modelConfig   Json? // Provider-specific: {reasoning: {type: "enabled"}, toolChoice: "auto"}
    routingConfig Json? // {mode: "locked"|"auto", fastModel: {provider, name}, escalationModel: {provider, name}}
    contextConfig Json? // {maxContextTokens: 50000, windowSize: 5, anchorInstructions: true, anchorInterval: 10}
    // ...
}
```

**Status:** ✅ Database field exists and is correctly typed as `Json?`.

### Application Schema

**File:** `/workspace/packages/agentc2/src/schemas/agent.ts`  
**Lines:** 49-58, 80

```typescript
export const contextConfigSchema = z
    .object({
        ragEnabled: z.boolean().optional(),
        ragTopK: z.number().int().min(1).max(50).optional(),
        ragMinScore: z.number().min(0).max(1).optional(),
        documentIds: z.array(z.string()).optional()
    })
    .passthrough()
    .nullable()
    .optional();

export const agentCreateSchema = z.object({
    // ...
    contextConfig: contextConfigSchema, // ✅ INCLUDED in application schema
    routingConfig: routingConfigSchema, // ✅ INCLUDED in application schema
    // ...
});
```

**Status:** ✅ Application schema correctly defines and includes these fields.

### Runtime Usage

**File:** `/workspace/apps/agent/src/app/api/agents/[id]/runs/route.ts`  
**Lines:** 424-432

```typescript
const contextCfg = (record as { contextConfig?: Record<string, unknown> })
    .contextConfig;
const managedResult = await managedGenerate(agent, input, {
    maxSteps: effectiveMaxSteps,
    maxContextTokens: (contextCfg?.maxContextTokens as number) ?? 50_000,
    windowSize: (contextCfg?.windowSize as number) ?? 5,
    anchorInstructions: (contextCfg?.anchorInstructions as boolean) ?? true,
    anchorInterval: (contextCfg?.anchorInterval as number) ?? 10,
    // ...
});
```

**Status:** ✅ `contextConfig` IS read and used at runtime for context window management.

---

## Detailed Impact Assessment

### 1. Functional Impact

#### **contextConfig**
- **Purpose:** Controls agent context window management for multi-step runs
  - `maxContextTokens`: Maximum tokens before compression (default: 50,000)
  - `windowSize`: Sliding window size for context retention (default: 5)
  - `anchorInstructions`: Whether to anchor system instructions (default: true)
  - `anchorInterval`: How often to re-anchor (default: 10 steps)
  - `ragEnabled`: Enable RAG for this agent
  - `ragTopK`: Number of RAG results to retrieve
  - `ragMinScore`: Minimum similarity score for RAG results
  - `documentIds`: Specific documents to use for RAG

- **Current Status:** 
  - ❌ Cannot be set via MCP tools
  - ❌ Cannot be set via HTTP API
  - ✅ Can be set directly via database (but no public interface)
  - ✅ Values ARE used at runtime if present
  - ✅ Playbook deployment system supports it

- **User Impact:**
  - Users cannot configure context window management via any standard interface
  - Multi-step agent runs always use default values
  - RAG configuration for agents is inaccessible
  - No way to optimize token usage per-agent

#### **routingConfig**
- **Purpose:** Controls model routing for complexity-based escalation
  - `mode`: "locked" (single model) or "auto" (route based on complexity)
  - `fastModel`: {provider, name} for simple queries
  - `escalationModel`: {provider, name} for complex queries
  - `confidenceThreshold`: When to escalate (default: 0.7)
  - `budgetAware`: Consider cost in routing decisions

- **Current Status:**
  - ❌ Cannot be set via MCP tools (not in schema)
  - ✅ CAN be set via HTTP PUT API (line 248 of `[id]/route.ts`)
  - ❌ Cannot be set via HTTP POST API (agent creation)
  - ✅ UI configure page DOES support it
  - ⚠️ Version snapshots do NOT include it (line 472 includes it in HTTP API but NOT in MCP tools)

- **User Impact:**
  - MCP-based agent management tools cannot configure model routing
  - Agents created via HTTP POST cannot set routing config at creation time
  - MCP version rollback will not restore routing configuration

### 2. Affected User Workflows

1. **MCP Client Users** (Cursor IDE, external tools):
   - Cannot configure `contextConfig` at all
   - Cannot configure `routingConfig` via MCP
   - Version restore via MCP will lose these configurations

2. **HTTP API Users**:
   - Cannot set `contextConfig` at all
   - CAN set `routingConfig` via PUT but NOT via POST
   - Inconsistent behavior between create and update

3. **Playbook Users**:
   - Playbooks CAN include both fields (supported in deployer)
   - But editing playbook agents after deployment loses these configs

4. **UI Users**:
   - CAN configure `routingConfig` via the web UI
   - CANNOT configure `contextConfig` (no UI exists)
   - Changes via UI work because it uses HTTP PUT

### 3. Version History Impact

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Lines:** 489-510

Version snapshots are created before every update for rollback capability. The snapshot builder does not capture `contextConfig` or `routingConfig`, meaning:

- ❌ Rolling back to a previous version will NOT restore these configurations
- ❌ Version history does not track changes to these fields
- ❌ Audit trail is incomplete

However, the HTTP API route DOES include both fields in its version snapshot (line 472 of `apps/agent/src/app/api/agents/[id]/route.ts`), creating **inconsistent versioning behavior** between HTTP and MCP interfaces.

### 4. Data Integrity Concerns

**Current State:**
- Database schema: ✅ Fields exist
- Runtime code: ✅ Fields are read and used
- Application schema: ✅ Fields are defined in `packages/agentc2/src/schemas/agent.ts`
- MCP tools: ❌ Fields not exposed
- HTTP API: ⚠️ Partial support (PUT has `routingConfig`, POST/PUT missing `contextConfig`)
- UI: ⚠️ Partial support (`routingConfig` only)

**Schema Drift:** The database schema has evolved ahead of the CRUD interfaces, creating a hidden feature that's unusable via public APIs.

---

## Comparison: Working vs Broken Fields

### ✅ Working Example: `memoryConfig`

**MCP Tool (agent-crud-tools.ts):**
```typescript
// Line 46: In schema
memoryConfig: z.record(z.any()).optional().nullable(),

// Lines 467-470: In updateData
memoryConfig:
    payload.memoryConfig !== undefined
        ? (payload.memoryConfig as Prisma.InputJsonValue)
        : existingMemoryConfig,

// Line 234: In buildAgentSnapshot
memoryConfig: agent.memoryConfig,
```

**HTTP API ([id]/route.ts):**
```typescript
// Line 250: In updateData
if (body.memoryConfig !== undefined) updateData.memoryConfig = body.memoryConfig;

// Line 474: In version snapshot
memoryConfig: existing.memoryConfig,

// Line 532: In changelog
jc("memoryConfig", existing.memoryConfig, body.memoryConfig),
```

**Result:** ✅ Works correctly via MCP, HTTP API, and version rollback.

### ❌ Broken Examples: `contextConfig` and `routingConfig`

**MCP Tool (agent-crud-tools.ts):**
```typescript
// ❌ NOT in schema (lines 20-63)
// ❌ NOT in updateData (lines 456-487)
// ❌ NOT in buildAgentSnapshot (lines 202-244)
```

**HTTP API - routingConfig:**
```typescript
// ✅ Line 248 of [id]/route.ts: Handled in PUT
if (body.routingConfig !== undefined) updateData.routingConfig = body.routingConfig;

// ✅ Line 472: In version snapshot
routingConfig: existing.routingConfig,

// ✅ Line 533: In changelog
jc("routingConfig", existing.routingConfig, body.routingConfig),

// ❌ NOT handled in POST route (agent creation)
```

**HTTP API - contextConfig:**
```typescript
// ❌ NOT in POST route
// ❌ NOT in PUT route
// ❌ NOT in version snapshot (HTTP API)
// ❌ NOT in changelog detection
```

**Result:**
- `contextConfig`: ❌ Completely inaccessible via all public interfaces
- `routingConfig`: ⚠️ Partially accessible (HTTP PUT only, not MCP or HTTP POST)

---

## Technical Debt: Why This Happened

### 1. Schema Evolution Without Interface Updates

The database schema was extended with `contextConfig` and `routingConfig` fields, but the CRUD tools were not updated in parallel. This created a "hidden feature" that exists in the database but has no public interface.

**Evidence:** The Prisma schema comment shows the intended structure:
```prisma
contextConfig Json? // {maxContextTokens: 50000, windowSize: 5, anchorInstructions: true, anchorInterval: 10}
```

But this was never exposed through the CRUD interfaces.

### 2. Inconsistent Implementation Patterns

There are **THREE separate implementations** of agent CRUD:

1. **MCP Tools** (`packages/agentc2/src/tools/agent-crud-tools.ts`):
   - Missing: `contextConfig`, `routingConfig`
   - Has: Custom `buildModelConfig` logic for thinking/reasoning

2. **HTTP API** (`apps/agent/src/app/api/agents/[id]/route.ts`):
   - Missing: `contextConfig`
   - Partial: `routingConfig` (PUT only)
   - Has: Comprehensive changelog detection

3. **Application Schema** (`packages/agentc2/src/schemas/agent.ts`):
   - Complete: All fields including `contextConfig`, `routingConfig`
   - Used by: UI components, validation

This divergence means changes to one don't propagate to the others.

### 3. Missing Validation Against Database Schema

There's no automated check that ensures CRUD tool schemas match the database schema. This allowed the drift to go undetected.

**Note:** The `docs/mcp-crud-tools-spec.json` specification document explicitly states:
> "Before shipping, verify and include every configuration primitive already supported by the current runtime, database schema, and tool registry. No UI-only configuration should remain inaccessible via MCP tools."

This requirement was not followed.

---

## Files Requiring Changes

### Critical Files (Must Fix)

| File | Lines | Change Required |
|------|-------|----------------|
| `packages/agentc2/src/tools/agent-crud-tools.ts` | 20-63 | Add `contextConfig` and `routingConfig` to `agentCreateSchema` |
| `packages/agentc2/src/tools/agent-crud-tools.ts` | 456-487 | Add fields to `updateData` object in `agentUpdateTool.execute()` |
| `packages/agentc2/src/tools/agent-crud-tools.ts` | 202-244 | Add fields to `buildAgentSnapshot` function parameters and return value |
| `packages/agentc2/src/tools/agent-crud-tools.ts` | 273-308 | Add fields to `agentCreateTool.execute()` data object |
| `apps/agent/src/app/api/agents/route.ts` | 310-336 | Add `contextConfig` and `routingConfig` to POST (create) handler |
| `apps/agent/src/app/api/agents/[id]/route.ts` | 166-260 | Add `contextConfig` to PUT (update) handler |
| `apps/agent/src/app/api/agents/[id]/route.ts` | 462-487 | Add `contextConfig` to version snapshot |
| `apps/agent/src/app/api/agents/[id]/route.ts` | 520-536 | Add `contextConfig` to changelog detection |

### Documentation Files

| File | Change Required |
|------|----------------|
| `docs/AGENTC2-MCP-TOOLS.md` | Update `agent_update` tool description to mention `contextConfig` and `routingConfig` |
| `docs/mcp-crud-tools-spec.json` | Update `AgentCreateInput` schema to include both fields |

### Test Files (Should Add)

| File | Change Required |
|------|----------------|
| `tests/integration/api/agents-crud.test.ts` | **NEW FILE** - Add comprehensive CRUD tests for `contextConfig` and `routingConfig` |
| `tests/e2e/agent-lifecycle.test.ts` | Add test case for version rollback with these fields |

---

## Fix Plan

### Phase 1: MCP Tool Schema Updates (Low Risk)

**Goal:** Make MCP tools accept and validate `contextConfig` and `routingConfig`.

#### Step 1.1: Update `agentCreateSchema` in `agent-crud-tools.ts`

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Location:** Lines 20-63  
**Action:** Add two new fields after `memoryConfig` (line 46):

```typescript
memoryConfig: z.record(z.any()).optional().nullable(),
routingConfig: z.record(z.any()).optional().nullable(), // ADD THIS
contextConfig: z.record(z.any()).optional().nullable(), // ADD THIS
maxSteps: z.number().optional(),
```

**Rationale:** Use `z.record(z.any())` for consistency with `memoryConfig` and to allow schema evolution without breaking changes.

#### Step 1.2: Import Proper Schemas (Optional Enhancement)

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Location:** Top of file (after line 3)  
**Action:** Import the proper schemas for better validation:

```typescript
import { 
    routingConfigSchema, 
    contextConfigSchema 
} from "../schemas/agent";
```

Then replace the `z.record(z.any())` usage with the imported schemas:

```typescript
memoryConfig: z.record(z.any()).optional().nullable(),
routingConfig: routingConfigSchema,
contextConfig: contextConfigSchema,
maxSteps: z.number().optional(),
```

**Rationale:** Provides better type safety and validation, but requires testing to ensure compatibility.

**Recommendation:** Start with `z.record(z.any())` for minimal risk, then enhance with typed schemas in a follow-up PR.

---

### Phase 2: MCP Tool Persistence Logic (Medium Risk)

**Goal:** Make MCP tools persist the fields to the database.

#### Step 2.1: Update `agentCreateTool.execute()` - Create Operation

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Location:** Lines 273-308  
**Action:** Add persistence logic after `memoryConfig` (line 286-289):

```typescript
memoryConfig:
    input.memoryConfig !== undefined
        ? (input.memoryConfig as Prisma.InputJsonValue)
        : Prisma.DbNull,
routingConfig:
    input.routingConfig !== undefined
        ? (input.routingConfig as Prisma.InputJsonValue)
        : Prisma.DbNull,
contextConfig:
    input.contextConfig !== undefined
        ? (input.contextConfig as Prisma.InputJsonValue)
        : Prisma.DbNull,
maxSteps: input.maxSteps ?? 5,
```

#### Step 2.2: Update `agentUpdateTool.execute()` - Update Operation

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Location:** Lines 456-487  
**Action:** Add update logic after `memoryConfig` handling (line 467-470):

First, add variables to capture existing values (after line 454):

```typescript
const existingMemoryConfig = (existing.memoryConfig ?? Prisma.DbNull) as Prisma.InputJsonValue;
const existingRoutingConfig = (existing.routingConfig ?? Prisma.DbNull) as Prisma.InputJsonValue;
const existingContextConfig = (existing.contextConfig ?? Prisma.DbNull) as Prisma.InputJsonValue;
const existingMetadata = (existing.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue;
```

Then add to `updateData` (after line 470):

```typescript
memoryConfig:
    payload.memoryConfig !== undefined
        ? (payload.memoryConfig as Prisma.InputJsonValue)
        : existingMemoryConfig,
routingConfig:
    payload.routingConfig !== undefined
        ? (payload.routingConfig as Prisma.InputJsonValue)
        : existingRoutingConfig,
contextConfig:
    payload.contextConfig !== undefined
        ? (payload.contextConfig as Prisma.InputJsonValue)
        : existingContextConfig,
maxSteps: payload.maxSteps ?? existing.maxSteps,
```

---

### Phase 3: Version Snapshot Updates (Medium Risk)

**Goal:** Ensure version rollback preserves these fields.

#### Step 3.1: Update `buildAgentSnapshot` Function

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Location:** Lines 202-244

**Action A:** Add to function parameter type (after line 213):

```typescript
const buildAgentSnapshot = (agent: {
    name: string;
    description: string | null;
    instructions: string;
    instructionsTemplate: string | null;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    maxTokens: number | null;
    modelConfig: unknown;
    routingConfig: unknown; // ADD THIS
    contextConfig: unknown; // ADD THIS
    memoryEnabled: boolean;
    memoryConfig: unknown;
    // ...
```

**Action B:** Add to return object (after line 234):

```typescript
modelConfig: agent.modelConfig,
routingConfig: agent.routingConfig, // ADD THIS
contextConfig: agent.contextConfig, // ADD THIS
memoryEnabled: agent.memoryEnabled,
memoryConfig: agent.memoryConfig,
```

#### Step 3.2: Verify Snapshot Usage at Line 489

**File:** `/workspace/packages/agentc2/src/tools/agent-crud-tools.ts`  
**Location:** Line 489

The snapshot is built from `existing` which is loaded with:
```typescript
const existing = await prisma.agent.findFirst({
    where: { OR: [{ slug: agentId }, { id: agentId }] },
    include: { tools: true }
});
```

This query returns ALL fields including `routingConfig` and `contextConfig`, so no change needed here. The fields just need to be passed to `buildAgentSnapshot`.

---

### Phase 4: HTTP API Consistency (Low Risk)

**Goal:** Ensure HTTP API has feature parity with MCP tools.

#### Step 4.1: Add to POST Route (Agent Creation)

**File:** `/workspace/apps/agent/src/app/api/agents/route.ts`  
**Location:** Lines 310-336 (inside `prisma.agent.create()`)

**Action:** Add after `memoryConfig` (line 323):

```typescript
memoryConfig: body.memoryConfig ?? Prisma.DbNull,
routingConfig: body.routingConfig ?? Prisma.DbNull,
contextConfig: body.contextConfig ?? Prisma.DbNull,
maxSteps: body.maxSteps ?? 5,
```

#### Step 4.2: Add to PUT Route (Agent Update)

**File:** `/workspace/apps/agent/src/app/api/agents/[id]/route.ts`  
**Location:** Line 248 (after `routingConfig` handling)

**Action:** Add `contextConfig` handling:

```typescript
if (body.routingConfig !== undefined) updateData.routingConfig = body.routingConfig;
if (body.contextConfig !== undefined) updateData.contextConfig = body.contextConfig; // ADD THIS
if (body.memoryEnabled !== undefined) updateData.memoryEnabled = body.memoryEnabled;
```

#### Step 4.3: Add to Version Snapshot

**File:** `/workspace/apps/agent/src/app/api/agents/[id]/route.ts`  
**Location:** Lines 462-487

**Action:** Add to snapshot (after line 472):

```typescript
modelConfig: existing.modelConfig,
routingConfig: existing.routingConfig,
contextConfig: existing.contextConfig, // ADD THIS
memoryEnabled: existing.memoryEnabled,
```

#### Step 4.4: Add to Changelog Detection

**File:** `/workspace/apps/agent/src/app/api/agents/[id]/route.ts`  
**Location:** Lines 520-536

**Action:** Add to `scalarChecks` array (after line 533):

```typescript
jc("memoryConfig", existing.memoryConfig, body.memoryConfig),
jc("routingConfig", existing.routingConfig, body.routingConfig),
jc("contextConfig", existing.contextConfig, body.contextConfig), // ADD THIS
jc("metadata", existing.metadata, body.metadata),
```

#### Step 4.5: Add Human-Readable Change Detection

**File:** `/workspace/apps/agent/src/app/api/agents/[id]/route.ts`  
**Location:** After line 360 (inside the changes array building logic)

**Action:** Add contextConfig change detection:

```typescript
if (
    body.contextConfig !== undefined &&
    !jsonEqual(body.contextConfig, existing.contextConfig)
) {
    const cc = body.contextConfig as { ragEnabled?: boolean; maxContextTokens?: number } | null;
    if (cc?.ragEnabled !== undefined) {
        changes.push(
            cc.ragEnabled
                ? "Context: RAG enabled"
                : "Context: RAG disabled"
        );
    } else if (cc?.maxContextTokens !== undefined) {
        changes.push(`Context: max tokens updated`);
    } else {
        changes.push("Context config updated");
    }
}
```

---

### Phase 5: Testing (Critical)

**Goal:** Ensure fix works correctly and doesn't break existing functionality.

#### Step 5.1: Create Integration Test

**File:** `tests/integration/api/agent-config-fields.test.ts` (NEW FILE)

**Test Cases:**
1. Create agent with `contextConfig` via MCP tool
2. Read agent back and verify `contextConfig` is persisted
3. Update agent `contextConfig` via MCP tool
4. Read agent back and verify update persisted
5. Repeat for `routingConfig`
6. Test version rollback preserves both fields
7. Test via HTTP POST and PUT routes
8. Test that `null` values correctly clear the fields
9. Test that partial updates don't clear other fields

#### Step 5.2: Manual Testing Checklist

**Via MCP (Cursor IDE):**
- [ ] Create agent with `contextConfig` and `routingConfig`
- [ ] Verify fields persist in database
- [ ] Update both fields via `agent_update`
- [ ] Verify updates persist
- [ ] Restore to previous version
- [ ] Verify restored values are correct

**Via HTTP API:**
- [ ] Create agent with both fields via POST
- [ ] Update both fields via PUT
- [ ] Verify version history includes these fields

**Via UI:**
- [ ] Create agent via UI (should work for `routingConfig`)
- [ ] Verify MCP `agent_read` returns the routing config
- [ ] Note: `contextConfig` has no UI, so only API testing applies

#### Step 5.3: Regression Testing

- [ ] Run existing test suite: `bun run test`
- [ ] Verify no existing tests break
- [ ] Run type check: `bun run type-check`
- [ ] Run linter: `bun run lint`

---

## Risk Assessment

### Overall Risk: **LOW to MEDIUM**

#### Low Risk Factors ✅
- Changes are purely additive (no deletions)
- Fields already exist in database schema
- Runtime code already handles these fields correctly
- No schema migrations needed
- `passthrough()` on Zod schemas means current API calls won't break

#### Medium Risk Factors ⚠️
- Multiple implementation locations must stay in sync
- Version history format changes (snapshots)
- Potential edge case: existing agents with `null` values
- Playbook deployment already uses these fields, so compatibility is important

#### Mitigations
- Use exact same pattern as `memoryConfig` (proven working)
- Comprehensive test coverage
- Manual testing via MCP and HTTP API
- Review version snapshot format carefully

---

## Estimated Complexity

### Implementation Time: **1-2 hours**
- Schema updates: 30 minutes
- Persistence logic: 30 minutes
- Version snapshot updates: 20 minutes
- HTTP API updates: 20 minutes
- Code review and cleanup: 20 minutes

### Testing Time: **1-2 hours**
- Write integration tests: 45 minutes
- Manual testing (MCP + HTTP): 30 minutes
- Regression testing: 30 minutes
- Documentation: 15 minutes

### Total: **2-4 hours** (including testing)

---

## Validation Criteria

### Definition of Done ✅

1. **Schema Validation:**
   - [ ] `agentCreateSchema` includes `contextConfig` and `routingConfig`
   - [ ] Both fields use appropriate Zod types (either `z.record()` or imported schemas)

2. **Persistence:**
   - [ ] MCP `agent-create` persists both fields
   - [ ] MCP `agent-update` persists both fields
   - [ ] HTTP POST persists both fields
   - [ ] HTTP PUT persists both fields

3. **Version History:**
   - [ ] `buildAgentSnapshot` includes both fields
   - [ ] Version rollback via MCP restores both fields
   - [ ] Version history via HTTP API tracks changes

4. **Testing:**
   - [ ] Integration test covers create/read/update/rollback
   - [ ] Manual testing via MCP successful
   - [ ] Manual testing via HTTP API successful
   - [ ] No regressions in existing tests

5. **Quality Gates:**
   - [ ] `bun run type-check` passes
   - [ ] `bun run lint` passes
   - [ ] `bun run build` succeeds

---

## Related Issues & Follow-ups

### Immediate Follow-ups (Not Part of This Fix)

1. **UI for `contextConfig`:**
   - Currently no UI exists for configuring `contextConfig`
   - Consider adding to agent configure page
   - Low priority: most users won't need this (advanced feature)

2. **Schema Drift Detection:**
   - Add automated check to ensure CRUD schemas match database schema
   - Prevent future occurrences of this bug class
   - Could be a linter rule or CI check

3. **API Documentation:**
   - Update API reference docs for agent endpoints
   - Document the new fields and their purposes
   - Add examples of valid `contextConfig` and `routingConfig` objects

### Similar Bugs to Check

**Question:** Are there other fields in the Agent model that are missing from CRUD tools?

**Action:** Review the full Prisma schema and compare against:
- `agentCreateSchema` in `agent-crud-tools.ts`
- HTTP API POST/PUT handlers
- MCP schema definitions

**Potentially Missing Fields:**
- `deploymentMode` - Present in schema, check if exposed
- `autoVectorize` - Present in schema, check if exposed
- `playbookSourceId` - Internal field, likely intentionally hidden
- `publicToken` - Generated field, likely intentionally hidden

---

## Code References

### Key Function Locations

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `agentCreateSchema` | `packages/agentc2/src/tools/agent-crud-tools.ts` | 20-63 | Input validation for create/update |
| `agentUpdateTool.execute()` | `packages/agentc2/src/tools/agent-crud-tools.ts` | 378-545 | MCP update implementation |
| `agentCreateTool.execute()` | `packages/agentc2/src/tools/agent-crud-tools.ts` | 246-335 | MCP create implementation |
| `buildAgentSnapshot()` | `packages/agentc2/src/tools/agent-crud-tools.ts` | 202-244 | Version snapshot builder |
| `POST /api/agents` | `apps/agent/src/app/api/agents/route.ts` | 245-447 | HTTP create endpoint |
| `PUT /api/agents/[id]` | `apps/agent/src/app/api/agents/[id]/route.ts` | 116-663 | HTTP update endpoint |

### Schema Definitions

| Schema | File | Lines | Purpose |
|--------|------|-------|---------|
| `contextConfigSchema` | `packages/agentc2/src/schemas/agent.ts` | 49-58 | Application schema definition |
| `routingConfigSchema` | `packages/agentc2/src/schemas/agent.ts` | 33-47 | Application schema definition |
| `memoryConfigSchema` | `packages/agentc2/src/schemas/agent.ts` | 14-31 | Working example to follow |

### Runtime Usage

| Location | File | Lines | Purpose |
|----------|------|-------|---------|
| Managed Generate | `apps/agent/src/app/api/agents/[id]/runs/route.ts` | 424-432 | Uses `contextConfig` for context management |
| Agent Invoke | `apps/agent/src/app/api/agents/[id]/invoke/route.ts` | 446-448 | Reads `contextConfig` at runtime |
| Phase Runner | `packages/agentc2/src/lib/phase-runner.ts` | 60-69, 165-168 | Uses `contextConfig` for phased execution |

---

## Architectural Notes

### Why This Bug Matters

`contextConfig` is not just a nice-to-have feature. It's critical for:

1. **Token Efficiency:** Agents with long conversations need context window management to avoid hitting token limits
2. **Cost Optimization:** Smaller context windows = lower API costs
3. **RAG Integration:** The `ragEnabled` and related fields control whether an agent uses the RAG pipeline
4. **Performance:** Proper context management prevents slowdowns in multi-step runs

The fact that it's already implemented in the runtime (`apps/agent/src/app/api/agents/[id]/runs/route.ts`) but inaccessible via CRUD interfaces means users are stuck with defaults.

### Why `routingConfig` Also Matters

Model routing enables:
- **Cost Savings:** Use cheap models for simple queries, expensive models for complex ones
- **Performance:** Fast models for quick responses, powerful models when needed
- **Budget Control:** Route based on cost constraints

The HTTP API supports it partially, but MCP doesn't, creating an inconsistent user experience.

---

## Implementation Priority

### P0 (Critical) - Must Fix
- ✅ Add `contextConfig` to MCP tool schema
- ✅ Add `contextConfig` to MCP tool persistence logic
- ✅ Add `routingConfig` to MCP tool schema
- ✅ Add `routingConfig` to MCP tool persistence logic

### P1 (High) - Should Fix
- ✅ Add both fields to `buildAgentSnapshot` for version rollback
- ✅ Add `contextConfig` to HTTP API (POST and PUT)
- ✅ Add `routingConfig` to HTTP API POST (PUT already has it)
- ✅ Add integration tests

### P2 (Medium) - Nice to Have
- ⬜ Use typed schemas instead of `z.record(z.any())`
- ⬜ Add UI for `contextConfig` (separate feature request)
- ⬜ Schema drift detection tooling

---

## Summary

This is a **schema drift bug** where database capabilities evolved ahead of the CRUD interfaces. The fix is straightforward: mirror the pattern used for `memoryConfig` (which works correctly) and apply it to `contextConfig` and `routingConfig`.

**Complexity:** Low - Mostly copy-paste of existing patterns  
**Risk:** Low to Medium - Additive changes with clear precedent  
**Impact:** High - Unblocks critical features for MCP users  
**Effort:** 2-4 hours including comprehensive testing

The bug is well-scoped, the fix is clear, and the pattern to follow is proven. The main risk is ensuring all three implementation locations (MCP tools, HTTP API, version snapshots) stay in sync.

---

## Appendix: Pattern to Follow

**Reference Implementation:** `memoryConfig` (working correctly)

### In Schema (Line 46):
```typescript
memoryConfig: z.record(z.any()).optional().nullable(),
```

### In Create Logic (Lines 286-289):
```typescript
memoryConfig:
    input.memoryConfig !== undefined
        ? (input.memoryConfig as Prisma.InputJsonValue)
        : Prisma.DbNull,
```

### In Update Logic (Lines 452-470):
```typescript
const existingMemoryConfig = (existing.memoryConfig ?? Prisma.DbNull) as Prisma.InputJsonValue;

// ...later in updateData:
memoryConfig:
    payload.memoryConfig !== undefined
        ? (payload.memoryConfig as Prisma.InputJsonValue)
        : existingMemoryConfig,
```

### In Snapshot (Line 213 + 234):
```typescript
// Parameter type:
memoryConfig: unknown;

// Return object:
memoryConfig: agent.memoryConfig,
```

**Apply this exact pattern to `contextConfig` and `routingConfig`.**

---

*End of Root Cause Analysis*

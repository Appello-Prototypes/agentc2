# Technical Design: Add routingConfig Support to Agent CRUD MCP Tools

**Feature Request:** [GitHub Issue #55](https://github.com/Appello-Prototypes/agentc2/issues/55)  
**Scope:** Medium | **Priority:** Medium  
**Author:** AI Agent | **Date:** 2026-03-03  
**Status:** Design Phase

---

## Executive Summary

This design document outlines the changes required to add `routingConfig` support to the agent CRUD MCP tools. The `routingConfig` field exists in the Prisma schema and is handled by the API routes, but is currently omitted from the MCP tools in `packages/agentc2/src/tools/agent-crud-tools.ts`. This creates a gap where MCP clients (like Cursor IDE) cannot create or update agents with routing configuration.

This fix follows the same pattern as other JSON configuration fields (`modelConfig`, `memoryConfig`, `metadata`) already handled by these tools.

---

## Current State Analysis

### 1. Database Schema

The `routingConfig` field is defined in the Prisma schema at line 775:

```prisma
routingConfig Json? // {mode: "locked"|"auto", fastModel: {provider, name}, escalationModel: {provider, name}, confidenceThreshold: 0.7, budgetAware: true}
```

**Type Definition:** The field structure is defined in `packages/agentc2/src/agents/resolver.ts`:

```typescript
export interface RoutingConfig {
    mode: "locked" | "auto";
    fastModel?: { provider: string; name: string };
    escalationModel?: { provider: string; name: string };
    reasoningModel?: { provider: string; name: string };
    confidenceThreshold?: number; // 0-1, default 0.7
    budgetAware?: boolean;
}
```

### 2. API Route Support

The Next.js API routes **already support** `routingConfig`:

**`apps/agent/src/app/api/agents/route.ts` (POST):**
- Line 185: Returns `routingConfig` in GET response
- Does NOT accept `routingConfig` in POST create (gap identified)

**`apps/agent/src/app/api/agents/[id]/route.ts` (PUT):**
- Line 248: Accepts `routingConfig` in request body
- Line 351-360: Generates change log entries for routing config updates
- Line 472: Includes `routingConfig` in version snapshots
- Line 533: Detects routing config changes for structured change logs

### 3. Schema Validation

A `routingConfigSchema` exists in `packages/agentc2/src/schemas/agent.ts` at line 33:

```typescript
export const routingConfigSchema = z
    .object({
        model: z.string().optional(),
        rules: z
            .array(
                z.object({
                    condition: z.string(),
                    targetAgent: z.string()
                })
            )
            .optional()
    })
    .passthrough()
    .nullable()
    .optional();
```

**⚠️ Schema Discrepancy:** The Zod schema does not match the TypeScript interface. The Zod schema has `model` and `rules`, while the actual usage expects `mode`, `fastModel`, `escalationModel`, `reasoningModel`, `confidenceThreshold`, and `budgetAware`.

### 4. MCP Tool Gap

The MCP tools in `packages/agentc2/src/tools/agent-crud-tools.ts` **do NOT handle** `routingConfig`:

- **`agentCreateSchema`** (line 20-63): Missing `routingConfig` field
- **`agentCreateTool.execute`** (line 254-334): Does not accept or pass `routingConfig` to Prisma
- **`agentUpdateTool.execute`** (line 378-544): Does not handle `routingConfig` updates
- **`buildAgentSnapshot`** (line 202-244): Does not include `routingConfig` in version snapshots

### 5. MCP Schema Gap

The MCP JSON Schema in `packages/agentc2/src/tools/mcp-schemas/shared.ts` **does NOT define** `routingConfig`:

- **`agentCreateInputSchema`** (line 209-264): Missing `routingConfig` property
- **`agentUpdateInputSchema`** (line 266-278): Inherits from `agentCreateInputSchema`, so also missing

### 6. Usage in Codebase

`routingConfig` is actively used in:

1. **Agent Resolver** (`packages/agentc2/src/agents/resolver.ts`):
   - `resolveRoutingDecision()` (line 1911): Determines model tier based on routing config
   - `resolveModelOverride()` (line 1973): Resolves model overrides for execution paths
   - `classifyComplexity()` (line 1870): Analyzes input complexity for routing decisions

2. **Playbooks** (`packages/agentc2/src/playbooks/`):
   - Packager, deployer, and manifest all include `routingConfig` in agent snapshots

3. **API Routes:**
   - Used for dynamic model selection based on input complexity
   - Budget-aware routing to optimize costs

---

## Architecture Changes

### High-Level Changes

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Client (Cursor IDE, external tools)                     │
└───────────────────┬─────────────────────────────────────────┘
                    │ Uses MCP JSON Schema
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ MCP Schema (shared.ts)                                      │
│ ✅ CHANGE: Add routingConfig to agentCreateInputSchema     │
│ ✅ CHANGE: Add routingConfigSchema definition              │
└───────────────────┬─────────────────────────────────────────┘
                    │ Validates input
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent CRUD Tools (agent-crud-tools.ts)                      │
│ ✅ CHANGE: Add routingConfig to agentCreateSchema (Zod)    │
│ ✅ CHANGE: Accept routingConfig in agentCreateTool.execute │
│ ✅ CHANGE: Accept routingConfig in agentUpdateTool.execute │
│ ✅ CHANGE: Include routingConfig in buildAgentSnapshot     │
└───────────────────┬─────────────────────────────────────────┘
                    │ Passes to Prisma
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Database (PostgreSQL via Prisma)                            │
│ ✅ ALREADY EXISTS: routingConfig Json? column              │
└─────────────────────────────────────────────────────────────┘
                    │ Read by
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent Resolver (resolver.ts)                                │
│ ✅ ALREADY USES: resolveRoutingDecision()                  │
│ ✅ ALREADY USES: resolveModelOverride()                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Create Flow:**
```
MCP Client → agentCreateTool → Prisma.agent.create() → Database
                      ↓
              routingConfig: {
                  mode: "auto",
                  fastModel: { provider: "openai", name: "gpt-4o-mini" },
                  escalationModel: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
                  confidenceThreshold: 0.7,
                  budgetAware: true
              }
```

**Update Flow:**
```
MCP Client → agentUpdateTool → Check existing.routingConfig
                              → Merge with update payload
                              → Create version snapshot (with routingConfig)
                              → Prisma.agent.update()
                              → Database
```

---

## Technical Design

### 1. Zod Schema Updates (`agent-crud-tools.ts`)

**Location:** Line 20-63

**Current:**
```typescript
const agentCreateSchema = z
    .object({
        name: z.string(),
        slug: z.string().optional(),
        description: z.string().optional().nullable(),
        instructions: z.string(),
        // ... other fields ...
        memoryConfig: z.record(z.any()).optional().nullable(),
        metadata: z.record(z.any()).optional().nullable(),
        // ❌ routingConfig missing
    })
    .passthrough();
```

**Proposed:**
```typescript
const routingConfigSchema = z
    .object({
        mode: z.enum(["locked", "auto"]),
        fastModel: z
            .object({
                provider: z.string(),
                name: z.string()
            })
            .optional(),
        escalationModel: z
            .object({
                provider: z.string(),
                name: z.string()
            })
            .optional(),
        reasoningModel: z
            .object({
                provider: z.string(),
                name: z.string()
            })
            .optional(),
        confidenceThreshold: z.number().min(0).max(1).optional(),
        budgetAware: z.boolean().optional()
    })
    .optional()
    .nullable();

const agentCreateSchema = z
    .object({
        name: z.string(),
        slug: z.string().optional(),
        description: z.string().optional().nullable(),
        instructions: z.string(),
        // ... other fields ...
        memoryConfig: z.record(z.any()).optional().nullable(),
        routingConfig: routingConfigSchema, // ✅ ADDED
        metadata: z.record(z.any()).optional().nullable(),
        // ... other fields ...
    })
    .passthrough();
```

**Placement:** Add `routingConfig` after `memoryConfig` (line 46), following the same pattern as in the Prisma schema.

### 2. Create Tool Payload (`agentCreateTool.execute`)

**Location:** Line 273-308

**Current:**
```typescript
const agent = await prisma.agent.create({
    data: {
        slug,
        name: input.name,
        description: input.description ?? null,
        instructions: input.instructions,
        // ... other fields ...
        memoryConfig:
            input.memoryConfig !== undefined
                ? (input.memoryConfig as Prisma.InputJsonValue)
                : Prisma.DbNull,
        // ❌ routingConfig missing
        metadata:
            input.metadata !== undefined
                ? (input.metadata as Prisma.InputJsonValue)
                : Prisma.DbNull,
        // ... other fields ...
    },
    include: { tools: true }
});
```

**Proposed:**
```typescript
const agent = await prisma.agent.create({
    data: {
        slug,
        name: input.name,
        description: input.description ?? null,
        instructions: input.instructions,
        // ... other fields ...
        memoryConfig:
            input.memoryConfig !== undefined
                ? (input.memoryConfig as Prisma.InputJsonValue)
                : Prisma.DbNull,
        routingConfig:
            input.routingConfig !== undefined
                ? (input.routingConfig as Prisma.InputJsonValue)
                : Prisma.DbNull, // ✅ ADDED
        metadata:
            input.metadata !== undefined
                ? (input.metadata as Prisma.InputJsonValue)
                : Prisma.DbNull,
        // ... other fields ...
    },
    include: { tools: true }
});
```

### 3. Update Tool Payload (`agentUpdateTool.execute`)

**Location:** Line 456-487

**Current:**
```typescript
const existingMemoryConfig = (existing.memoryConfig ??
    Prisma.DbNull) as Prisma.InputJsonValue;
const existingMetadata = (existing.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue;

const updateData: Prisma.AgentUncheckedUpdateInput = {
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    // ... other fields ...
    memoryConfig:
        payload.memoryConfig !== undefined
            ? (payload.memoryConfig as Prisma.InputJsonValue)
            : existingMemoryConfig,
    // ❌ routingConfig missing
    metadata:
        payload.metadata !== undefined
            ? (payload.metadata as Prisma.InputJsonValue)
            : existingMetadata,
    // ... other fields ...
};
```

**Proposed:**
```typescript
const existingMemoryConfig = (existing.memoryConfig ??
    Prisma.DbNull) as Prisma.InputJsonValue;
const existingRoutingConfig = (existing.routingConfig ??
    Prisma.DbNull) as Prisma.InputJsonValue; // ✅ ADDED
const existingMetadata = (existing.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue;

const updateData: Prisma.AgentUncheckedUpdateInput = {
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    // ... other fields ...
    memoryConfig:
        payload.memoryConfig !== undefined
            ? (payload.memoryConfig as Prisma.InputJsonValue)
            : existingMemoryConfig,
    routingConfig:
        payload.routingConfig !== undefined
            ? (payload.routingConfig as Prisma.InputJsonValue)
            : existingRoutingConfig, // ✅ ADDED
    metadata:
        payload.metadata !== undefined
            ? (payload.metadata as Prisma.InputJsonValue)
            : existingMetadata,
    // ... other fields ...
};
```

### 4. Version Snapshot (`buildAgentSnapshot`)

**Location:** Line 202-244

**Current:**
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
    memoryEnabled: boolean;
    memoryConfig: unknown;
    // ❌ routingConfig missing from parameter type
    maxSteps: number | null;
    subAgents: string[];
    workflows: string[];
    tools: { toolId: string; config: unknown }[];
    visibility: string;
    isActive: boolean;
    requiresApproval: boolean;
    maxSpendUsd: number | null;
    metadata: unknown;
}) => ({
    name: agent.name,
    description: agent.description,
    instructions: agent.instructions,
    instructionsTemplate: agent.instructionsTemplate,
    modelProvider: agent.modelProvider,
    modelName: agent.modelName,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    modelConfig: agent.modelConfig,
    memoryEnabled: agent.memoryEnabled,
    memoryConfig: agent.memoryConfig,
    // ❌ routingConfig missing from return object
    maxSteps: agent.maxSteps,
    subAgents: agent.subAgents,
    workflows: agent.workflows,
    tools: agent.tools.map((tool) => ({ toolId: tool.toolId, config: tool.config })),
    visibility: agent.visibility,
    isActive: agent.isActive,
    requiresApproval: agent.requiresApproval,
    maxSpendUsd: agent.maxSpendUsd,
    metadata: agent.metadata
});
```

**Proposed:**
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
    memoryEnabled: boolean;
    memoryConfig: unknown;
    routingConfig: unknown; // ✅ ADDED
    maxSteps: number | null;
    subAgents: string[];
    workflows: string[];
    tools: { toolId: string; config: unknown }[];
    visibility: string;
    isActive: boolean;
    requiresApproval: boolean;
    maxSpendUsd: number | null;
    metadata: unknown;
}) => ({
    name: agent.name,
    description: agent.description,
    instructions: agent.instructions,
    instructionsTemplate: agent.instructionsTemplate,
    modelProvider: agent.modelProvider,
    modelName: agent.modelName,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    modelConfig: agent.modelConfig,
    memoryEnabled: agent.memoryEnabled,
    memoryConfig: agent.memoryConfig,
    routingConfig: agent.routingConfig, // ✅ ADDED
    maxSteps: agent.maxSteps,
    subAgents: agent.subAgents,
    workflows: agent.workflows,
    tools: agent.tools.map((tool) => ({ toolId: tool.toolId, config: tool.config })),
    visibility: agent.visibility,
    isActive: agent.isActive,
    requiresApproval: agent.requiresApproval,
    maxSpendUsd: agent.maxSpendUsd,
    metadata: agent.metadata
});
```

### 5. MCP Schema Updates (`mcp-schemas/shared.ts`)

**Location:** Line 209-264

**Current:**
```typescript
export const agentCreateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
        instructions: { type: "string" },
        // ... other fields ...
        memoryEnabled: { type: "boolean" },
        memoryConfig: memoryConfigSchema,
        // ❌ routingConfig missing
        maxSteps: { type: "number" },
        // ... other fields ...
    },
    required: ["name", "instructions", "modelProvider", "modelName"],
    additionalProperties: true
};
```

**Proposed:**

First, add a `routingConfigSchema` definition near line 163 (after `memoryConfigSchema`):

```typescript
export const routingConfigSchema: JsonSchema = {
    type: "object",
    properties: {
        mode: { 
            type: "string", 
            enum: ["locked", "auto"],
            description: "Routing mode: 'locked' uses primary model always, 'auto' routes based on complexity"
        },
        fastModel: {
            type: "object",
            properties: {
                provider: { type: "string" },
                name: { type: "string" }
            },
            description: "Model for simple queries (e.g., gpt-4o-mini)"
        },
        escalationModel: {
            type: "object",
            properties: {
                provider: { type: "string" },
                name: { type: "string" }
            },
            description: "Model for complex queries (e.g., claude-sonnet-4-20250514)"
        },
        reasoningModel: {
            type: "object",
            properties: {
                provider: { type: "string" },
                name: { type: "string" }
            },
            description: "Model for reasoning-heavy queries (e.g., o3, claude-opus-4)"
        },
        confidenceThreshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Complexity score threshold for escalation (default: 0.7)"
        },
        budgetAware: {
            type: "boolean",
            description: "If true, biases toward fast model when budget is exceeded"
        }
    },
    description: "Model routing configuration for cost optimization and quality balancing",
    additionalProperties: false
};
```

Then update `agentCreateInputSchema`:

```typescript
export const agentCreateInputSchema: JsonSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
        instructions: { type: "string" },
        // ... other fields ...
        memoryEnabled: { type: "boolean" },
        memoryConfig: memoryConfigSchema,
        routingConfig: routingConfigSchema, // ✅ ADDED
        maxSteps: { type: "number" },
        // ... other fields ...
    },
    required: ["name", "instructions", "modelProvider", "modelName"],
    additionalProperties: true
};
```

---

## Impact Assessment

### Affected Components

| Component | Change Type | Impact Level | Notes |
|-----------|-------------|--------------|-------|
| `agent-crud-tools.ts` | **Modified** | 🟡 Medium | Core tool logic updated |
| `mcp-schemas/shared.ts` | **Modified** | 🟢 Low | JSON schema definition added |
| `schemas/agent.ts` | **Modified** | 🟡 Medium | Zod schema needs correction |
| API Routes | **No Change** | ✅ None | Already support routingConfig |
| Agent Resolver | **No Change** | ✅ None | Already uses routingConfig |
| Database Schema | **No Change** | ✅ None | Field already exists |
| Playbooks | **No Change** | ✅ None | Already include routingConfig |

### Breaking Changes

**None.** This is a purely additive change:

- New field is optional (`Json?` in Prisma, `.optional().nullable()` in Zod)
- Existing agents without `routingConfig` will continue to work
- Existing MCP clients that don't send `routingConfig` will work unchanged
- Version snapshots will now include `routingConfig`, but this is backward-compatible

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Schema mismatch between Zod and TypeScript interface | 🟡 Medium | Align Zod schema with `RoutingConfig` interface |
| Invalid routing config values causing runtime errors | 🟡 Medium | Strict Zod validation + comprehensive tests |
| Version snapshots missing historical routing config | 🟢 Low | Acceptable; field wasn't tracked before |
| MCP clients sending invalid routing config structure | 🟢 Low | Zod validation will reject invalid payloads |

---

## Implementation Plan

### Phase 1: Schema Correction (Foundation)

**Goal:** Align all schema definitions with the actual `RoutingConfig` interface.

**Tasks:**
1. ✅ Update `routingConfigSchema` in `packages/agentc2/src/schemas/agent.ts`:
   - Replace `model` and `rules` fields
   - Add `mode`, `fastModel`, `escalationModel`, `reasoningModel`, `confidenceThreshold`, `budgetAware`
   - Match the structure in `packages/agentc2/src/agents/resolver.ts` (line 1838)

2. ✅ Define `routingConfigSchema` in Zod at the top of `agent-crud-tools.ts`:
   - Use the corrected schema from step 1
   - Place before `agentCreateSchema` definition

**Deliverables:**
- Corrected Zod schema matching TypeScript interface
- No functional changes yet (foundation only)

**Validation:**
- Schema compiles without errors
- Types match `RoutingConfig` interface

---

### Phase 2: MCP Tool Updates (Core Implementation)

**Goal:** Add `routingConfig` support to all CRUD operations.

**Tasks:**
1. ✅ Add `routingConfig` to `agentCreateSchema` (Zod):
   - Insert after `memoryConfig` field (line ~46)
   - Use `.optional().nullable()` to match Prisma schema

2. ✅ Update `agentCreateTool.execute`:
   - Add `routingConfig` to Prisma create payload
   - Insert after `memoryConfig` (line ~289)
   - Use same pattern: `input.routingConfig !== undefined ? (input.routingConfig as Prisma.InputJsonValue) : Prisma.DbNull`

3. ✅ Update `agentUpdateTool.execute`:
   - Extract `existingRoutingConfig` (line ~452)
   - Add `routingConfig` to `updateData` (line ~467)
   - Use fallback pattern: `payload.routingConfig !== undefined ? ... : existingRoutingConfig`

4. ✅ Update `buildAgentSnapshot`:
   - Add `routingConfig: unknown` to parameter type (line ~213)
   - Add `routingConfig: agent.routingConfig` to return object (line ~234)

**Deliverables:**
- MCP tools fully support `routingConfig` CRUD operations
- Version history includes `routingConfig` in snapshots

**Validation:**
- TypeScript compiles without errors
- Zod validation works for valid and invalid payloads
- Tool can be invoked via MCP protocol

---

### Phase 3: MCP Schema Documentation (Discoverability)

**Goal:** Document `routingConfig` in MCP JSON Schema for external clients.

**Tasks:**
1. ✅ Add `routingConfigSchema` to `mcp-schemas/shared.ts`:
   - Place after `memoryConfigSchema` (line ~163)
   - Include detailed property descriptions
   - Set `additionalProperties: false` for strict validation

2. ✅ Add `routingConfig` to `agentCreateInputSchema`:
   - Insert after `memoryConfig` property
   - Reference `routingConfigSchema`

3. ✅ Verify `agentUpdateInputSchema` inherits `routingConfig`:
   - Check line 266-278 (inherits from `agentCreateInputSchema`)

**Deliverables:**
- MCP schema includes `routingConfig` documentation
- External clients (Cursor IDE) can discover routing configuration options

**Validation:**
- MCP schema validates against JSON Schema spec
- Cursor IDE autocomplete shows `routingConfig` properties

---

### Phase 4: Testing (Validation)

**Goal:** Ensure all paths work correctly with comprehensive tests.

**Test Cases:**
1. **Create agent with routingConfig:**
   ```typescript
   const result = await agentCreateTool.execute({
       name: "Test Agent",
       instructions: "Test instructions",
       modelProvider: "openai",
       modelName: "gpt-4o",
       routingConfig: {
           mode: "auto",
           fastModel: { provider: "openai", name: "gpt-4o-mini" },
           escalationModel: { provider: "anthropic", name: "claude-sonnet-4-20250514" },
           confidenceThreshold: 0.75,
           budgetAware: true
       }
   });
   // Verify agent.routingConfig in database matches input
   ```

2. **Create agent without routingConfig:**
   ```typescript
   const result = await agentCreateTool.execute({
       name: "Simple Agent",
       instructions: "Test instructions",
       modelProvider: "openai",
       modelName: "gpt-4o"
       // routingConfig omitted
   });
   // Verify agent.routingConfig is null
   ```

3. **Update agent adding routingConfig:**
   ```typescript
   const result = await agentUpdateTool.execute({
       agentId: existingAgentId,
       data: {
           routingConfig: {
               mode: "auto",
               fastModel: { provider: "openai", name: "gpt-4o-mini" }
           }
       }
   });
   // Verify routingConfig was added
   ```

4. **Update agent modifying routingConfig:**
   ```typescript
   const result = await agentUpdateTool.execute({
       agentId: agentWithRoutingConfig.id,
       data: {
           routingConfig: {
               ...existingConfig,
               confidenceThreshold: 0.8
           }
       }
   });
   // Verify confidenceThreshold updated, other fields preserved
   ```

5. **Update agent clearing routingConfig:**
   ```typescript
   const result = await agentUpdateTool.execute({
       agentId: agentWithRoutingConfig.id,
       data: {
           routingConfig: null
       }
   });
   // Verify routingConfig is null
   ```

6. **Version snapshot includes routingConfig:**
   ```typescript
   const result = await agentUpdateTool.execute({
       agentId: agentWithRoutingConfig.id,
       data: { name: "Updated Name" }
   });
   // Fetch version snapshot from AgentVersion table
   // Verify snapshot.routingConfig matches pre-update state
   ```

7. **Invalid routingConfig rejected:**
   ```typescript
   try {
       await agentCreateTool.execute({
           name: "Invalid Agent",
           instructions: "Test",
           modelProvider: "openai",
           modelName: "gpt-4o",
           routingConfig: {
               mode: "invalid-mode", // Should fail validation
               confidenceThreshold: 1.5 // Out of range
           }
       });
       fail("Should have thrown validation error");
   } catch (err) {
       // Verify Zod validation error
   }
   ```

**Deliverables:**
- Test suite covering all CRUD scenarios
- Edge cases validated (null, undefined, partial updates)
- Error handling verified

**Validation:**
- All tests pass
- Coverage includes happy path + error cases

---

### Phase 5: Documentation & Communication (Knowledge Transfer)

**Goal:** Update documentation and communicate changes.

**Tasks:**
1. ✅ Update `/CLAUDE.md`:
   - Add `routingConfig` to Agent Architecture section
   - Document routing modes and model selection logic

2. ✅ Update MCP tool descriptions:
   - Add `routingConfig` to `agentCreateTool` and `agentUpdateTool` descriptions
   - Include usage examples

3. ✅ Update API documentation (if exists):
   - Document routing config structure
   - Provide usage examples

4. ✅ Create changelog entry:
   - Document new capability
   - Note backward compatibility

**Deliverables:**
- Updated documentation
- Changelog entry
- Usage examples

**Validation:**
- Documentation reviewed and approved
- Examples tested and verified

---

## Phased Implementation Summary

| Phase | Duration Estimate | Dependencies | Deliverable |
|-------|-------------------|--------------|-------------|
| **1. Schema Correction** | 1 hour | None | Aligned Zod schemas |
| **2. MCP Tool Updates** | 2 hours | Phase 1 | Working CRUD operations |
| **3. MCP Schema Docs** | 1 hour | Phase 2 | Client discoverability |
| **4. Testing** | 3 hours | Phase 2 | Test suite |
| **5. Documentation** | 1 hour | Phase 4 | Updated docs |
| **Total** | ~8 hours | Sequential | Full implementation |

**Recommended Approach:** Implement phases sequentially. Each phase is independently testable and provides incremental value.

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/agent-crud-tools.test.ts` (new file)

**Test Groups:**
1. **Schema Validation:**
   - Valid routing config structures pass
   - Invalid structures fail with clear errors
   - Optional fields work when omitted

2. **Create Operations:**
   - Agent created with routing config
   - Agent created without routing config (null)
   - Complex routing config with all fields

3. **Update Operations:**
   - Add routing config to existing agent
   - Update existing routing config (partial)
   - Clear routing config (set to null)
   - Update preserves routing config when not specified

4. **Version Snapshots:**
   - Snapshot includes routing config
   - Snapshot correctly captures pre-update state

### Integration Tests

**File:** `tests/integration/agent-crud-mcp.test.ts` (new file)

**Test Groups:**
1. **End-to-End MCP Flow:**
   - MCP client creates agent with routing config
   - Database persists routing config
   - Agent resolver reads and uses routing config

2. **API Parity:**
   - MCP tool behavior matches API route behavior
   - Version history consistency

### Manual Testing

**Test in Cursor IDE:**
1. Use MCP tool to create agent with routing config
2. Verify autocomplete suggestions
3. Test with different model combinations
4. Verify routing decisions in agent invocations

---

## Success Metrics

### Functional Metrics

- ✅ MCP tools accept `routingConfig` in create and update operations
- ✅ `routingConfig` persists correctly to database
- ✅ Version snapshots include `routingConfig`
- ✅ Schema validation works for valid and invalid inputs
- ✅ MCP schema exposes `routingConfig` for client discovery

### Quality Metrics

- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ No TypeScript compilation errors
- ✅ No linting errors
- ✅ Code follows existing patterns (consistent with `memoryConfig`, `metadata`)

### User Experience Metrics

- ✅ Cursor IDE autocomplete shows routing config options
- ✅ Clear error messages for invalid routing configs
- ✅ Documentation explains routing modes and use cases

---

## Rollout Plan

### Pre-Deployment Checklist

- [ ] All tests pass (`bun run type-check`, `bun run lint`, `bun run build`)
- [ ] Documentation updated
- [ ] Code reviewed by team
- [ ] Backward compatibility verified (existing agents unaffected)

### Deployment Steps

1. **Merge to main branch:**
   - No database migrations required (field already exists)
   - No breaking changes (additive only)

2. **Deploy to staging:**
   - Verify MCP tools work in staging environment
   - Test with real Cursor IDE instance

3. **Deploy to production:**
   - Standard deployment process
   - Monitor for errors

### Rollback Plan

**If issues occur:**
1. Revert code changes (git revert)
2. Existing agents unaffected (field is optional)
3. No data cleanup required

---

## Open Questions & Future Considerations

### Open Questions

1. **Schema Discrepancy:** Should we keep the old `routingConfigSchema` in `schemas/agent.ts` for backward compatibility, or replace it?
   - **Recommendation:** Replace it. The old schema doesn't match actual usage.

2. **API Route Create Gap:** Should we also add `routingConfig` support to the API POST route (`apps/agent/src/app/api/agents/route.ts`)?
   - **Recommendation:** Yes, for parity. The route currently returns `routingConfig` but doesn't accept it on create.

3. **Default Values:** Should `mode: "locked"` be the default, or should `routingConfig` default to null?
   - **Recommendation:** Default to null (no routing). Users opt-in to auto routing.

### Future Enhancements

1. **Routing Analytics:**
   - Track which tier was used per invocation
   - Report cost savings from routing decisions

2. **Routing UI:**
   - Visual routing config editor in agent settings
   - Complexity classifier preview

3. **Advanced Routing Rules:**
   - Time-based routing (fast model during business hours)
   - User-based routing (premium users get better models)
   - Topic-based routing (specific domains route to specific models)

4. **Routing Optimization:**
   - ML-based complexity classification
   - Adaptive thresholds based on historical accuracy

---

## Appendix: Example Routing Configurations

### Example 1: Cost-Optimized Agent

```json
{
    "mode": "auto",
    "fastModel": {
        "provider": "openai",
        "name": "gpt-4o-mini"
    },
    "escalationModel": {
        "provider": "openai",
        "name": "gpt-4o"
    },
    "confidenceThreshold": 0.7,
    "budgetAware": true
}
```

**Use Case:** Customer support agent that routes simple queries to mini model, complex queries to full model, and respects budget limits.

---

### Example 2: Quality-First Agent

```json
{
    "mode": "auto",
    "fastModel": {
        "provider": "openai",
        "name": "gpt-4o"
    },
    "escalationModel": {
        "provider": "anthropic",
        "name": "claude-sonnet-4-20250514"
    },
    "reasoningModel": {
        "provider": "openai",
        "name": "o3"
    },
    "confidenceThreshold": 0.5,
    "budgetAware": false
}
```

**Use Case:** Research agent that uses high-quality models for all queries, with reasoning model for complex analytical tasks.

---

### Example 3: Locked Mode (No Routing)

```json
{
    "mode": "locked"
}
```

**Use Case:** Agent that always uses its primary model without any routing decisions.

---

## References

- **GitHub Issue:** https://github.com/Appello-Prototypes/agentc2/issues/55
- **Prisma Schema:** `packages/database/prisma/schema.prisma` (line 775)
- **Agent Resolver:** `packages/agentc2/src/agents/resolver.ts` (line 1838, 1911, 1973)
- **API Route:** `apps/agent/src/app/api/agents/[id]/route.ts` (line 248, 351, 472, 533)
- **MCP Tools:** `packages/agentc2/src/tools/agent-crud-tools.ts`
- **MCP Schema:** `packages/agentc2/src/tools/mcp-schemas/shared.ts`

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-03  
**Status:** Ready for Review

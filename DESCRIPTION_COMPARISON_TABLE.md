# MCP Tool Description Comparison Table

**Issue**: [#58](https://github.com/Appello-Prototypes/agentc2/issues/58)  
**Purpose**: Visual comparison of current (stale) vs correct (target) descriptions

---

## All 8 Affected Tools

| # | Tool ID | Category | Current MCP Description ❌ | Target Description ✅ | Delta |
|---|---------|----------|---------------------------|---------------------|-------|
| 1 | `workflow-execute` | workflow-ops | "Execute a workflow by slug or ID." | "Execute a workflow by slug or ID **and return output plus run metadata.**" | +46 chars |
| 2 | `workflow-read` | workflow-crud | "Retrieve a workflow definition/state by ID or slug." | "**Read** a workflow by ID or slug **with optional related data.**" | Changed verb + added detail |
| 3 | `network-execute` | network-ops | "Execute a network by slug or ID." | "Execute a network by slug or ID **and return output plus run metadata.**" | +46 chars |
| 4 | `network-read` | network-crud | "Retrieve a network definition/state by ID or slug." | "**Read** a network by ID or slug **with optional related data.**" | Changed verb + added detail |
| 5 | `agent-create` | agent-crud | "Create a new agent with full configuration." | "Create a new agent with full configuration **and tool bindings.**" | +19 chars |
| 6 | `agent-read` | agent-crud | "Retrieve agent definition/state by ID or slug." | "**Read** an agent by ID or slug **with optional related data.**" | Changed verb + added detail |
| 7 | `agent-update` | agent-crud | "Update an agent configuration with versioning and rollback support." | "Update an agent configuration **with optional version restore.**" | Simplified terminology |
| 8 | `agent-update` (API) | api-route | Same as #7 | Same as #7 | Duplicate in API route |

---

## Patterns Identified

### Pattern 1: Missing Return Value Detail
**Affects**: Execute operations (`workflow-execute`, `network-execute`)

- **Current**: "Execute a [entity] by slug or ID."
- **Correct**: "Execute a [entity] by slug or ID **and return output plus run metadata.**"
- **Why Important**: Users need to know these are NOT fire-and-forget operations
- **Missing Detail**: Information about returned data (runId, status, output, run object)

---

### Pattern 2: Wrong Verb + Missing Include Parameter Hint
**Affects**: Read operations (`agent-read`, `workflow-read`, `network-read`)

- **Current**: "**Retrieve** [entity] definition/state by ID or slug."
- **Correct**: "**Read** [entity] by ID or slug **with optional related data.**"
- **Issues**:
  1. **Verb inconsistency**: "Retrieve" vs "Read" (implementation uses "Read")
  2. **Missing hint**: Doesn't mention the `include` parameter for fetching versions/runs/tools
- **Why Important**: Users should know they can fetch related entities in one call

---

### Pattern 3: Terminology Simplification
**Affects**: Update operations (`agent-update`)

- **Current**: "Update an agent configuration **with versioning and rollback support.**"
- **Correct**: "Update an agent configuration **with optional version restore.**"
- **Issue**: Current description is MORE verbose but LESS accurate
- **Why Important**: The tool doesn't automatically create versions; it optionally restores from a version

---

## File-by-File Change Summary

### MCP Schema Files (3 files, 7 changes)

| File | Tool Count | Changes | Location |
|------|------------|---------|----------|
| `crud.ts` | 5 tools | agent-create, agent-read, agent-update, workflow-read, network-read | Lines 26, 34, 58, 89, 141 |
| `workflow-ops.ts` | 1 tool | workflow.execute | Line 6 |
| `network-ops.ts` | 1 tool | network.execute | Line 6 |

**Total**: 7 description string replacements

---

### API Route Files (1 file, 5 changes)

| File | Tool Count | Changes | Location |
|------|------------|---------|----------|
| `apps/agent/src/app/api/mcp/tools/[tool]/route.ts` | 5 tools | agent-create, agent-read, agent-update, workflow-read, network-read | Lines 135, 145, 150, 165, 200 |

**Total**: 5 description string replacements in `crudToolDetails` object

**Note**: This file has a hardcoded fallback object. If you only fix MCP schemas and not this file, the API endpoint will still return stale descriptions.

---

### Documentation Files (2 files, 3 changes)

| File | Changes | Location |
|------|---------|----------|
| `docs/mcp-workflows-networks.md` | workflow.execute | Line 9 |
| `docs/AGENTC2-MCP-TOOLS.md` | workflow_execute, workflow_read | Lines 163, 166 |

**Total**: 3 documentation string updates

---

## Character Count Analysis

| Description | Current Length | New Length | Change |
|-------------|----------------|------------|--------|
| workflow-execute | 35 chars | 74 chars | +39 chars (+111%) |
| workflow-read | 52 chars | 55 chars | +3 chars (+6%) |
| network-execute | 34 chars | 73 chars | +39 chars (+115%) |
| network-read | 51 chars | 54 chars | +3 chars (+6%) |
| agent-create | 45 chars | 64 chars | +19 chars (+42%) |
| agent-read | 47 chars | 54 chars | +7 chars (+15%) |
| agent-update | 68 chars | 56 chars | -12 chars (-18%) |

**Observations**:
- Execute operations: +111% length (significant but necessary detail)
- Read operations: +6-15% length (minimal increase)
- Update operation: -18% length (more concise and accurate)
- **Longest description**: 74 characters (workflow-execute) - Still reasonable for UI display

---

## Side-by-Side Comparison

### workflow-execute

```diff
- description: "Execute a workflow by slug or ID.",
+ description: "Execute a workflow by slug or ID and return output plus run metadata.",
```

**What Changed**: Added detail about return value (output + run metadata)  
**Why**: Users need to know the tool returns execution results, not just triggers execution

---

### workflow-read

```diff
- description: "Retrieve a workflow definition/state by ID or slug.",
+ description: "Read a workflow by ID or slug with optional related data.",
```

**What Changed**: 
1. Verb: "Retrieve" → "Read" (matches implementation)
2. Detail: "definition/state" → "with optional related data" (hints at `include` parameter)

**Why**: Consistency with tool implementation and clarifies optional data fetching

---

### network-execute

```diff
- description: "Execute a network by slug or ID.",
+ description: "Execute a network by slug or ID and return output plus run metadata.",
```

**What Changed**: Added detail about return value (output + run metadata)  
**Why**: Parallel to workflow-execute, same reasoning

---

### network-read

```diff
- description: "Retrieve a network definition/state by ID or slug.",
+ description: "Read a network by ID or slug with optional related data.",
```

**What Changed**: 
1. Verb: "Retrieve" → "Read" (matches implementation)
2. Detail: "definition/state" → "with optional related data" (hints at `include` parameter)

**Why**: Parallel to workflow-read, consistency

---

### agent-create

```diff
- description: "Create a new agent with full configuration.",
+ description: "Create a new agent with full configuration and tool bindings.",
```

**What Changed**: Added "and tool bindings"  
**Why**: Clarifies that tools can be attached during creation via `tools` or `toolIds` parameters

---

### agent-read

```diff
- description: "Retrieve agent definition/state by ID or slug.",
+ description: "Read an agent by ID or slug with optional related data.",
```

**What Changed**: 
1. Verb: "Retrieve" → "Read" (matches implementation)
2. Detail: "definition/state" → "with optional related data" (hints at `include` parameter)
3. Added article: "an agent" for grammatical consistency

**Why**: Parallel to workflow-read and network-read, consistency

---

### agent-update

```diff
- description: "Update an agent configuration with versioning and rollback support.",
+ description: "Update an agent configuration with optional version restore.",
```

**What Changed**: Simplified and clarified versioning terminology  
**Why**: 
- "versioning and rollback support" sounds automatic but it's actually optional
- "optional version restore" is more accurate (via `restoreVersion` or `restoreVersionId` params)
- Shorter and clearer

---

## Implementation Verification Matrix

Use this table to track changes during implementation:

| File | Line | Tool | Status | Verified |
|------|------|------|--------|----------|
| `crud.ts` | 26 | agent-create | ⬜ TODO | ⬜ |
| `crud.ts` | 34 | agent-read | ⬜ TODO | ⬜ |
| `crud.ts` | 58 | agent-update | ⬜ TODO | ⬜ |
| `crud.ts` | 89 | workflow-read | ⬜ TODO | ⬜ |
| `crud.ts` | 141 | network-read | ⬜ TODO | ⬜ |
| `workflow-ops.ts` | 6 | workflow.execute | ⬜ TODO | ⬜ |
| `network-ops.ts` | 6 | network.execute | ⬜ TODO | ⬜ |
| `route.ts` | 135 | "agent-create" | ⬜ TODO | ⬜ |
| `route.ts` | 145 | "agent-read" | ⬜ TODO | ⬜ |
| `route.ts` | 150 | "agent-update" | ⬜ TODO | ⬜ |
| `route.ts` | 165 | "workflow-read" | ⬜ TODO | ⬜ |
| `route.ts` | 200 | "network-read" | ⬜ TODO | ⬜ |
| `mcp-workflows-networks.md` | 9 | workflow.execute | ⬜ TODO | ⬜ |
| `AGENTC2-MCP-TOOLS.md` | 163 | workflow_read | ⬜ TODO | ⬜ |
| `AGENTC2-MCP-TOOLS.md` | 166 | workflow_execute | ⬜ TODO | ⬜ |

**Total**: 15 changes across 6 files

---

## Copy-Paste Ready Descriptions

For quick implementation, here are the exact strings to use:

### Execute Operations
```
Execute a workflow by slug or ID and return output plus run metadata.
```
```
Execute a network by slug or ID and return output plus run metadata.
```

### Read Operations
```
Read an agent by ID or slug with optional related data.
```
```
Read a workflow by ID or slug with optional related data.
```
```
Read a network by ID or slug with optional related data.
```

### Create Operation
```
Create a new agent with full configuration and tool bindings.
```

### Update Operation
```
Update an agent configuration with optional version restore.
```

---

## Grep Commands for Verification

### Find all current workflow.execute references
```bash
grep -rn "workflow.execute" packages/agentc2/src/tools/mcp-schemas/
```

### Verify tool implementation descriptions
```bash
grep -A 1 'id: "workflow-execute"' packages/agentc2/src/tools/workflow-tools.ts
grep -A 1 'id: "workflow-read"' packages/agentc2/src/tools/workflow-crud-tools.ts
grep -A 1 'id: "agent-create"' packages/agentc2/src/tools/agent-crud-tools.ts
```

### Check MCP schema descriptions after fix
```bash
grep -A 1 'name: "workflow.execute"' packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts
grep -A 1 'name: "workflow-read"' packages/agentc2/src/tools/mcp-schemas/crud.ts
```

---

## Notes for Implementer

### Important
- Use **EXACT** strings from the "Copy-Paste Ready Descriptions" section above
- Don't paraphrase or modify - must match tool implementations character-for-character
- Run `bun run format` after changes to ensure consistent formatting
- The test file will fail if descriptions don't match EXACTLY

### Watch Out For
- Line numbers may shift slightly if files were modified since analysis
- Use search/replace by unique context, not just line numbers
- The `crudToolDetails` object in `route.ts` uses **double quotes** as keys (e.g., `"agent-create"`)
- Some descriptions span multiple lines in the source - ensure you update the complete string

### Pro Tip
Use your editor's "Find and Replace" feature with these exact patterns:

**Find**: `description: "Execute a workflow by slug or ID.",`  
**Replace**: `description: "Execute a workflow by slug or ID and return output plus run metadata.",`

Repeat for each of the 8 changes.

---

**Document created**: March 3, 2026  
**For use with**: `FIX_PLAN_MCP_DESCRIPTIONS.md` implementation guide

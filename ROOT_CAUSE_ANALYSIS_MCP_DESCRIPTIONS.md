# Root Cause Analysis: Stale MCP Tool Descriptions

**Issue**: [#58](https://github.com/Appello-Prototypes/agentc2/issues/58) - Fix stale MCP tool descriptions  
**Date**: March 3, 2026  
**Status**: Analysis Complete - Ready for Implementation

---

## Executive Summary

MCP schema files contain outdated tool descriptions that don't match the actual tool implementations. This affects 8 tools across agents, workflows, and networks. The root cause is that during the v4 package rename (commit 66cddcf, Feb 20, 2026), MCP schema files were created with simplified descriptions that diverged from the source tool implementations.

**Impact**: External MCP clients (Cursor IDE, Claude Desktop, etc.) receive incomplete/inaccurate tool descriptions, potentially leading to suboptimal tool selection and confusion about tool capabilities.

---

## Root Cause

### The Event
On **February 20, 2026** (commit `66cddcf895a4f14f6709fab161d82c6e3fcf03a2`), the codebase underwent a major refactoring:
- `packages/mastra` → `packages/agentc2` (full package rename)
- MCP schema files created as **new files** in `packages/agentc2/src/tools/mcp-schemas/`
- Tool implementation files also moved to new location

### The Problem
When the MCP schema files were created, descriptions were **simplified or altered** from the actual tool implementations. The tool implementations retained their full, detailed descriptions, but the MCP schemas received abbreviated versions.

**Example**:
- **Tool Implementation** (`workflow-tools.ts:97`): `"Execute a workflow by slug or ID and return output plus run metadata."`
- **MCP Schema** (`workflow-ops.ts:6`): `"Execute a workflow by slug or ID."`
- **Missing**: "and return output plus run metadata"

### Why It Matters
The MCP schemas are the **source of truth** for external MCP clients. These descriptions are:
1. Exposed via `GET /api/mcp` to Cursor IDE and other MCP clients
2. Used by AI agents to understand tool capabilities
3. Displayed in UI components throughout the platform
4. Referenced in documentation files

---

## Affected Tools (8 Total)

### Category 1: Workflow Operations (1 mismatch)

#### `workflow-execute` / `workflow.execute`
- **File**: `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts:6`
- **MCP Schema**: `"Execute a workflow by slug or ID."`
- **Tool Implementation**: `"Execute a workflow by slug or ID and return output plus run metadata."`
- **Missing**: "and return output plus run metadata"
- **Impact**: Users don't know the tool returns run metadata, may make unnecessary follow-up calls

---

### Category 2: Workflow CRUD (1 mismatch)

#### `workflow-read`
- **File**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:89`
- **MCP Schema**: `"Retrieve a workflow definition/state by ID or slug."`
- **Tool Implementation**: `"Read a workflow by ID or slug with optional related data."`
- **Issues**: 
  - Different verb: "Retrieve" vs "Read"
  - Different detail: "definition/state" vs "with optional related data"
- **Impact**: Users don't understand they can include versions/runs via the `include` parameter

---

### Category 3: Network Operations (1 mismatch)

#### `network-execute` / `network.execute`
- **File**: `packages/agentc2/src/tools/mcp-schemas/network-ops.ts:6`
- **MCP Schema**: `"Execute a network by slug or ID."`
- **Tool Implementation**: `"Execute a network by slug or ID and return output plus run metadata."`
- **Missing**: "and return output plus run metadata"
- **Impact**: Users don't know the tool returns run metadata, may make unnecessary follow-up calls

---

### Category 4: Network CRUD (1 mismatch)

#### `network-read`
- **File**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:141`
- **MCP Schema**: `"Retrieve a network definition/state by ID or slug."`
- **Tool Implementation**: `"Read a network by ID or slug with optional related data."`
- **Issues**: 
  - Different verb: "Retrieve" vs "Read"
  - Different detail: "definition/state" vs "with optional related data"
- **Impact**: Users don't understand they can include primitives/versions/runs via the `include` parameter

---

### Category 5: Agent CRUD (3 mismatches)

#### `agent-create`
- **File**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:26`
- **MCP Schema**: `"Create a new agent with full configuration."`
- **Tool Implementation**: `"Create a new agent with full configuration and tool bindings."`
- **Missing**: "and tool bindings"
- **Impact**: Users don't know they can attach tools during creation

#### `agent-read`
- **File**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:34`
- **MCP Schema**: `"Retrieve agent definition/state by ID or slug."`
- **Tool Implementation**: `"Read an agent by ID or slug with optional related data."`
- **Issues**: 
  - Different verb: "Retrieve" vs "Read"
  - Different detail: "definition/state" vs "with optional related data"
- **Impact**: Users don't understand they can include tools/versions/runs/schedules/triggers via the `include` parameter

#### `agent-update`
- **File**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:58`
- **MCP Schema**: `"Update an agent configuration with versioning and rollback support."`
- **Tool Implementation**: `"Update an agent configuration with optional version restore."`
- **Issues**: Different wording about versioning capabilities
- **Impact**: Inconsistent terminology may confuse users

---

## Affected Code Locations

### Primary Sources (MCP Schema Definitions)
1. **`packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts`**
   - Lines 3-121: `workflowOpsToolDefinitions` array
   - Affected: `workflow.execute` (line 5-6)

2. **`packages/agentc2/src/tools/mcp-schemas/network-ops.ts`**
   - Lines 3-106: `networkOpsToolDefinitions` array
   - Affected: `network.execute` (line 5-6)

3. **`packages/agentc2/src/tools/mcp-schemas/crud.ts`**
   - Lines 23-185: `crudToolDefinitions` array
   - Affected: 
     - `agent-create` (line 26)
     - `agent-read` (line 34)
     - `agent-update` (line 58)
     - `workflow-read` (line 89)
     - `network-read` (line 141)

### Secondary Sources (Hardcoded Fallbacks)
4. **`apps/agent/src/app/api/mcp/tools/[tool]/route.ts`**
   - Lines 41-250: `crudToolDetails` hardcoded object
   - Contains duplicate stale descriptions for all CRUD tools
   - Used as fallback when dynamic tool lookup fails

### Documentation
5. **`docs/mcp-workflows-networks.md`**
   - Line 9: References old `workflow.execute` description
   - Should be updated to match tool implementation

6. **`docs/AGENTC2-MCP-TOOLS.md`**
   - Lines 160-176: Tool table with abbreviated descriptions
   - Contains even MORE simplified versions (e.g., "Execute a workflow")

### Consumption Points (Where Descriptions Are Used)
- **`apps/agent/src/app/api/mcp/route.ts:448`**: Exports `mcpToolDefinitions` to MCP clients
- **`apps/agent/src/lib/mcp-server.ts:160`**: Uses descriptions for Claude CoWork MCP server
- **`scripts/mcp-server/index.js:142`**: Cursor stdio MCP server uses these descriptions
- **`packages/agentc2/src/index.ts:139`**: Public export of `mcpToolDefinitions`
- **Multiple UI components**: Display tool descriptions from MCP schemas or API responses

---

## Impact Assessment

### High Impact Areas

#### 1. **MCP Client Tool Discovery** (Critical)
External MCP clients (Cursor IDE, Claude Desktop, Claude Code) receive incomplete descriptions via `GET /api/mcp`. This affects:
- **Agent tool selection**: AI agents may not understand what data tools actually return
- **Developer experience**: Developers using Cursor see abbreviated descriptions
- **Documentation parity**: External docs don't match internal behavior

**Affected Users**: All developers using Cursor MCP integration, all AI agents using MCP tools

#### 2. **Platform Documentation** (Medium)
Documentation files reference the outdated descriptions, creating confusion when docs don't match observed behavior.

**Affected Files**:
- `docs/mcp-workflows-networks.md`
- `docs/AGENTC2-MCP-TOOLS.md`

#### 3. **API Routes** (Medium)
The `/api/mcp/tools/[tool]` endpoint has hardcoded stale descriptions in the `crudToolDetails` object. This means even if the MCP schemas are fixed, this API route will still return old descriptions.

**Affected Endpoint**: `GET /api/mcp/tools/{tool}`

#### 4. **UI Components** (Low)
UI components that display tool descriptions will show inconsistent text depending on whether they read from:
- The tool registry (correct descriptions)
- The MCP schemas (stale descriptions)
- The API endpoint (stale descriptions)

**Affected Components**: Tool selection pages, agent configuration, skill management

### Low Impact Areas

#### 5. **Internal Tool Invocation** (No Impact)
Tool **execution** is unaffected. The descriptions are metadata only; they don't affect functionality. The actual tool code in `workflow-tools.ts`, `network-tools.ts`, etc. executes correctly.

#### 6. **Tool Registry** (No Impact)
The tool registry in `packages/agentc2/src/tools/registry.ts` correctly references the tool implementations, so agents using the registry directly (not via MCP) see correct descriptions.

---

## System Architecture Context

### How MCP Schemas Are Used

```
┌─────────────────────────────────────────────────────────────┐
│  Tool Implementation (Source of Truth)                      │
│  packages/agentc2/src/tools/workflow-tools.ts              │
│  - workflow-execute: "...and return output plus run..."    │
└─────────────────────────────────────────────────────────────┘
                           ▼
                    SHOULD MATCH
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Schema (External Interface) ❌ STALE                   │
│  packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts    │
│  - workflow.execute: "Execute a workflow by slug or ID."   │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐   ┌─────────────┐  ┌──────────────┐
    │ GET      │   │ Cursor MCP  │  │ API Routes   │
    │ /api/mcp │   │ Server      │  │ /api/mcp/... │
    └──────────┘   └─────────────┘  └──────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
              ┌─────────────────────────┐
              │ MCP Clients (Cursor)    │
              │ See STALE descriptions  │
              └─────────────────────────┘
```

### The Three Sources of Truth

1. **Tool Registry** (`packages/agentc2/src/tools/registry.ts`)
   - Maps tool IDs to tool instances
   - Used by agents via `getToolsByNamesAsync()`
   - ✅ Contains CORRECT descriptions (from tool implementations)

2. **MCP Schemas** (`packages/agentc2/src/tools/mcp-schemas/`)
   - Defines tools for external MCP clients
   - Exported via `mcpToolDefinitions` from `index.ts`
   - ❌ Contains STALE descriptions

3. **Hardcoded API Fallbacks** (`apps/agent/src/app/api/mcp/tools/[tool]/route.ts`)
   - `crudToolDetails` object with hardcoded descriptions
   - Used when tool lookup fails or for legacy compatibility
   - ❌ Contains STALE descriptions

---

## Historical Context

### Git History Analysis

**Commit 66cddcf** (Feb 20, 2026): "feat: rename packages/mastra to packages/agentc2, schema updates, security hardening, and multi-instance support"

This massive commit included:
- 1,000+ file changes across the entire codebase
- Complete package rename from `@repo/mastra` to `@repo/agentc2`
- Creation of new MCP schema files in `packages/agentc2/src/tools/mcp-schemas/`
- Migration of tool implementations to new package structure

**What went wrong**: During this large refactoring, the MCP schema descriptions were either:
1. **Copied from an older version** of the tools with abbreviated descriptions
2. **Manually simplified** to reduce verbosity
3. **Not synced** with the current tool implementation descriptions

### Evidence from Git Diff

**Before v4 rename** (packages/mastra):
```typescript
// packages/mastra/src/tools/workflow-tools.ts
id: "workflow-execute",
description: "Execute a workflow by slug or ID and return output plus run metadata."
```

**After v4 rename** (packages/agentc2):
```typescript
// Tool implementation KEPT full description:
// packages/agentc2/src/tools/workflow-tools.ts:97
id: "workflow-execute",
description: "Execute a workflow by slug or ID and return output plus run metadata."

// But NEW MCP schema got simplified version:
// packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts:6
name: "workflow.execute",
description: "Execute a workflow by slug or ID.",  // ← Missing detail
```

---

## Complete List of Mismatches

### 1. Workflow Tools

| Tool ID | MCP Schema Description | Tool Implementation Description | File |
|---------|------------------------|--------------------------------|------|
| `workflow-execute` | "Execute a workflow by slug or ID." | "Execute a workflow by slug or ID and return output plus run metadata." | `workflow-ops.ts:6` |
| `workflow-read` | "Retrieve a workflow definition/state by ID or slug." | "Read a workflow by ID or slug with optional related data." | `crud.ts:89` |

### 2. Network Tools

| Tool ID | MCP Schema Description | Tool Implementation Description | File |
|---------|------------------------|--------------------------------|------|
| `network-execute` | "Execute a network by slug or ID." | "Execute a network by slug or ID and return output plus run metadata." | `network-ops.ts:6` |
| `network-read` | "Retrieve a network definition/state by ID or slug." | "Read a network by ID or slug with optional related data." | `crud.ts:141` |

### 3. Agent Tools

| Tool ID | MCP Schema Description | Tool Implementation Description | File |
|---------|------------------------|--------------------------------|------|
| `agent-create` | "Create a new agent with full configuration." | "Create a new agent with full configuration and tool bindings." | `crud.ts:26` |
| `agent-read` | "Retrieve agent definition/state by ID or slug." | "Read an agent by ID or slug with optional related data." | `crud.ts:34` |
| `agent-update` | "Update an agent configuration with versioning and rollback support." | "Update an agent configuration with optional version restore." | `crud.ts:58` |

### 4. Verification Command Output

```bash
$ node /tmp/full-comparison.js

Tool: workflow-execute
Category: workflow-ops
MCP Schema:     "Execute a workflow by slug or ID."
Implementation: "Execute a workflow by slug or ID and return output plus run metadata."

Tool: workflow-read
Category: workflow-crud
MCP Schema:     "Retrieve a workflow definition/state by ID or slug."
Implementation: "Read a workflow by ID or slug with optional related data."

Tool: network-execute
Category: network-ops
MCP Schema:     "Execute a network by slug or ID."
Implementation: "Execute a network by slug or ID and return output plus run metadata."

Tool: network-read
Category: network-crud
MCP Schema:     "Retrieve a network definition/state by ID or slug."
Implementation: "Read a network by ID or slug with optional related data."

Total mismatches found: 4 (workflows/networks only)
```

**Note**: Agent tools have 3 additional mismatches (verified separately).

---

## Related Systems Affected

### 1. MCP Gateway (`/api/mcp`)
**File**: `apps/agent/src/app/api/mcp/route.ts:448`

```typescript
const staticTools = mcpToolDefinitions.map((tool) => ({
    ...tool,
    invoke_url: tool.invoke_url || "/api/mcp"
}));
```

The gateway directly exports `mcpToolDefinitions` with stale descriptions to external clients.

### 2. Tool Detail Endpoint (`/api/mcp/tools/[tool]`)
**File**: `apps/agent/src/app/api/mcp/tools/[tool]/route.ts:41-250`

Contains a hardcoded `crudToolDetails` object with stale descriptions:

```typescript
const crudToolDetails: Record<string, { description: string; ... }> = {
    "workflow-read": {
        description: "Retrieve a workflow definition/state by ID or slug.",  // ← Stale
        ...
    },
    ...
};
```

This means **fixing the MCP schemas alone won't fix this endpoint** - it needs separate updates.

### 3. Cursor MCP Server (stdio)
**File**: `scripts/mcp-server/index.js:142`

```javascript
description: tool.description || `Invoke ${tool.name}`,
```

Uses descriptions from the `/api/mcp` gateway, which pulls from `mcpToolDefinitions`.

### 4. Claude CoWork MCP Server (HTTP)
**File**: `apps/agent/src/lib/mcp-server.ts:160`

```typescript
description: tool.description || `Invoke ${tool.name}`,
```

Also uses descriptions from the `/api/mcp` gateway.

### 5. Tool Parity Check Script
**File**: `scripts/check-tool-parity.ts:19`

```typescript
import { mcpToolDefinitions } from "../packages/agentc2/src/tools/mcp-schemas/index";
```

This script compares registry vs MCP schema but **only checks tool name parity**, not description consistency.

### 6. Documentation Files

**`docs/mcp-workflows-networks.md:9`**:
```markdown
- `workflow.execute` - Execute a workflow by slug/ID.
```
Uses the stale MCP schema description.

**`docs/AGENTC2-MCP-TOOLS.md:166`**:
```markdown
| `workflow_execute` | Execute a workflow |
```
Even MORE abbreviated than the MCP schema!

---

## Why "Standard and Feature Workflows"?

The bug report title mentions "MCP schema files for standard and feature workflows show old descriptions."

**Clarification**: This likely refers to:
1. **SDLC Workflow Types**: The SDLC Flywheel playbook defines three workflow types:
   - `sdlc-standard` - Standard development workflow
   - `sdlc-bugfix` - Bug fix workflow
   - `sdlc-feature` - Feature development workflow
   
   Defined in `scripts/seed-sdlc-playbook.ts:9`

2. **Broader Interpretation**: "Standard and feature workflows" could also mean:
   - **Standard workflows**: Basic workflow CRUD operations (`workflow-create`, `workflow-read`, etc.)
   - **Feature workflows**: Advanced workflow operations (`workflow-execute`, `workflow-resume`, etc.)

**Actual Issue**: The bug affects **ALL workflow/network tools** exposed via MCP, not just specific workflow instances. The stale descriptions are in the MCP schema definitions for the workflow/network tool categories themselves.

---

## Technical Deep Dive

### MCP Tool Definition Structure

Each tool in `mcpToolDefinitions` has this structure:

```typescript
export interface McpToolDefinition {
    name: string;                          // Tool name (e.g., "workflow.execute")
    description: string;                   // ← THIS IS STALE
    inputSchema: JsonSchema;               // JSON Schema for parameters
    outputSchema?: JsonSchema;             // Optional output schema
    invoke_url?: string;                   // Invocation endpoint
    category?: string;                     // Tool category for organization
}
```

The `description` field is what MCP clients see. This is the field that's outdated.

### MCP Tool Routes

The `mcpToolRoutes` array defines how to invoke each tool:

```typescript
export interface McpToolRoute {
    kind: "registry" | "internal" | "custom";
    name: string;
    handler?: string;                      // For custom handlers
    method?: string;                       // For internal API calls
    path?: string;                         // For internal API calls
    // ...
}
```

The routes are **correct** - only the descriptions are wrong. This means tool invocation works perfectly; only the documentation/discovery metadata is stale.

### Export Chain

```
MCP Schema Files (*.ts in mcp-schemas/)
    ↓ (imported by)
mcp-schemas/index.ts (consolidates all definitions)
    ↓ (exported as mcpToolDefinitions)
packages/agentc2/src/tools/index.ts
    ↓ (imported by)
apps/agent/src/app/api/mcp/route.ts
    ↓ (exposed via)
GET /api/mcp (MCP gateway endpoint)
    ↓ (consumed by)
External MCP clients (Cursor, Claude Desktop, etc.)
```

---

## Fix Plan

### Phase 1: Update MCP Schema Files (Primary Fix)

Update descriptions in the following files to match tool implementations:

#### File 1: `packages/agentc2/src/tools/mcp-schemas/crud.ts`

**Changes Required**:

1. Line 26: `agent-create`
   - **FROM**: `"Create a new agent with full configuration."`
   - **TO**: `"Create a new agent with full configuration and tool bindings."`

2. Line 34: `agent-read`
   - **FROM**: `"Retrieve agent definition/state by ID or slug."`
   - **TO**: `"Read an agent by ID or slug with optional related data."`

3. Line 58: `agent-update`
   - **FROM**: `"Update an agent configuration with versioning and rollback support."`
   - **TO**: `"Update an agent configuration with optional version restore."`

4. Line 89: `workflow-read`
   - **FROM**: `"Retrieve a workflow definition/state by ID or slug."`
   - **TO**: `"Read a workflow by ID or slug with optional related data."`

5. Line 141: `network-read`
   - **FROM**: `"Retrieve a network definition/state by ID or slug."`
   - **TO**: `"Read a network by ID or slug with optional related data."`

#### File 2: `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts`

**Changes Required**:

1. Line 6: `workflow.execute`
   - **FROM**: `"Execute a workflow by slug or ID."`
   - **TO**: `"Execute a workflow by slug or ID and return output plus run metadata."`

#### File 3: `packages/agentc2/src/tools/mcp-schemas/network-ops.ts`

**Changes Required**:

1. Line 6: `network.execute`
   - **FROM**: `"Execute a network by slug or ID."`
   - **TO**: `"Execute a network by slug or ID and return output plus run metadata."`

---

### Phase 2: Update API Route Hardcoded Descriptions

#### File 4: `apps/agent/src/app/api/mcp/tools/[tool]/route.ts`

Update the `crudToolDetails` object (lines 41-250) to match tool implementations:

**Changes Required**:

1. Line 135: `"agent-create"` description
   - **FROM**: `"Create a new agent with full configuration."`
   - **TO**: `"Create a new agent with full configuration and tool bindings."`

2. Line 145: `"agent-read"` description
   - **FROM**: `"Retrieve agent definition/state by ID or slug."`
   - **TO**: `"Read an agent by ID or slug with optional related data."`

3. Line 150: `"agent-update"` description
   - **FROM**: `"Update an agent configuration with versioning and rollback support."`
   - **TO**: `"Update an agent configuration with optional version restore."`

4. Line 165: `"workflow-read"` description
   - **FROM**: `"Retrieve a workflow definition/state by ID or slug."`
   - **TO**: `"Read a workflow by ID or slug with optional related data."`

5. Line 200: `"network-read"` description
   - **FROM**: `"Retrieve a network definition/state by ID or slug."`
   - **TO**: `"Read a network by ID or slug with optional related data."`

**Note**: This file doesn't have entries for `workflow-execute` or `network-execute` in the `crudToolDetails` object, so only the "read" operations need updating here.

---

### Phase 3: Update Documentation

#### File 5: `docs/mcp-workflows-networks.md`

**Changes Required**:

1. Line 9: Update tool description
   - **FROM**: `- workflow.execute - Execute a workflow by slug/ID.`
   - **TO**: `- workflow.execute - Execute a workflow by slug or ID and return output plus run metadata.`

**Optional**: Add clarifying notes about what "run metadata" includes (runId, status, steps, etc.)

#### File 6: `docs/AGENTC2-MCP-TOOLS.md`

**Changes Required**:

1. Line 166: Update tool description
   - **FROM**: `| workflow_execute | Execute a workflow |`
   - **TO**: `| workflow_execute | Execute a workflow and return run metadata |`

2. Line 163: Update `workflow_read` description
   - **FROM**: `| workflow_read | Read workflow configuration |`
   - **TO**: `| workflow_read | Read workflow by ID or slug with optional related data |`

**Note**: Consider whether to keep this file abbreviated for readability, or make it comprehensive. Current style is very terse.

---

### Phase 4: Add Automated Tests

**New File**: `tests/unit/mcp-schema-parity.test.ts`

Create a test that verifies MCP schema descriptions match tool implementation descriptions:

```typescript
import { describe, it, expect } from "bun:test";
import { mcpToolDefinitions } from "@repo/agentc2/tools";
import { toolRegistry } from "@repo/agentc2/tools";

describe("MCP Schema Parity", () => {
    it("should have matching descriptions between MCP schemas and tool implementations", () => {
        const mismatches: string[] = [];
        
        mcpToolDefinitions.forEach((mcpTool) => {
            // Normalize tool name (workflow.execute → workflow-execute)
            const toolId = mcpTool.name.replace(/\./g, "-");
            const tool = toolRegistry[toolId];
            
            if (tool && tool.description !== mcpTool.description) {
                mismatches.push(
                    `${toolId}: MCP="${mcpTool.description}" vs Tool="${tool.description}"`
                );
            }
        });
        
        expect(mismatches).toEqual([]);
    });
});
```

**Purpose**: Prevent future regressions by catching description drift during CI.

---

### Phase 5: Enhance Tool Parity Script

**File**: `scripts/check-tool-parity.ts`

**Current Behavior**: Only checks tool NAME parity (missing tools), not description consistency.

**Enhancement Required**: Add description comparison check:

```typescript
// After line 131, add:
console.log("\n4. Checking description consistency...");

const descriptionMismatches: string[] = [];
mcpToolDefinitions.forEach((mcpTool) => {
    const toolId = normaliseToRegistryId(mcpTool.name);
    const tool = toolRegistry[toolId];
    
    if (tool && tool.description !== mcpTool.description) {
        descriptionMismatches.push(
            `  - ${toolId}: MCP schema has different description than tool implementation`
        );
    }
});

if (descriptionMismatches.length > 0) {
    console.error(`\n❌ Found ${descriptionMismatches.length} description mismatches:\n`);
    descriptionMismatches.forEach(msg => console.error(msg));
    gaps.push(...descriptionMismatches);
}
```

**Purpose**: Make description drift visible in CI and local development checks.

---

## Implementation Risk Assessment

### Risk Level: **LOW**

**Why Low Risk**:
1. **Metadata-only changes**: No functional code changes required
2. **No schema structure changes**: Only updating string values
3. **No database migrations**: No Prisma schema changes
4. **No breaking changes**: Existing tool invocations continue working
5. **Additive information**: Adding detail, not removing functionality

### Potential Issues

#### Issue 1: Description Length
**Risk**: MCP clients may truncate long descriptions in UI displays

**Mitigation**: Keep descriptions concise but complete. Current longest description is 74 characters, which is reasonable for most UIs.

**Example**:
- Current: `"Execute a workflow by slug or ID."`
- Proposed: `"Execute a workflow by slug or ID and return output plus run metadata."`
- Length: 35 → 74 characters (acceptable)

#### Issue 2: Cached Descriptions
**Risk**: MCP clients may cache tool definitions, requiring restart to see updates

**Mitigation**: 
- Cursor MCP server: Restart Cursor or reload MCP configuration
- Claude Desktop: Restart application
- Web clients: Clear browser cache or hard refresh

**Impact**: Low - Users will see updates on next session

#### Issue 3: Documentation Synchronization
**Risk**: Documentation files may become outdated again if not maintained

**Mitigation**: 
- Add description comparison to `check-tool-parity.ts`
- Add unit test to catch future drift
- Document the "descriptions must match" requirement in contributor guidelines

---

## Testing Strategy

### Pre-Implementation Testing
1. **Verify current state**: Run comparison script to document all 8 mismatches
2. **Check tool invocation**: Confirm tools still execute correctly (unchanged)
3. **Capture before state**: Take screenshots of MCP tool list in Cursor

### Post-Implementation Testing

#### Unit Tests
- [ ] Run `bun test tests/unit/mcp-schema-parity.test.ts` (new test)
- [ ] Verify all descriptions match between MCP schemas and tool implementations

#### Integration Tests
- [ ] Run `bun run scripts/check-tool-parity.ts`
- [ ] Verify zero description mismatches reported

#### Manual Verification
- [ ] Restart Cursor and check MCP tool list
- [ ] Verify `workflow-execute` shows full description: "Execute a workflow by slug or ID and return output plus run metadata."
- [ ] Test `GET /api/mcp` endpoint returns updated descriptions
- [ ] Test `GET /api/mcp/tools/workflow-read` returns updated description

#### Regression Prevention
- [ ] Add description check to CI pipeline
- [ ] Document requirement in `.cursor/rules/tool-parity.mdc`

---

## Implementation Complexity: **LOW**

### Estimated Effort
- **Phase 1** (MCP schemas): 15 minutes - 8 string replacements in 3 files
- **Phase 2** (API route): 10 minutes - 5 string replacements in 1 file
- **Phase 3** (Documentation): 10 minutes - 2 string replacements in 2 files
- **Phase 4** (Tests): 30 minutes - Create new test file with description comparison
- **Phase 5** (Parity script): 20 minutes - Add description check to existing script
- **Testing**: 15 minutes - Manual verification across all integration points

**Total**: ~1.5 hours for complete implementation and testing

### Files to Modify (6 files)
1. `packages/agentc2/src/tools/mcp-schemas/crud.ts` (5 changes)
2. `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts` (1 change)
3. `packages/agentc2/src/tools/mcp-schemas/network-ops.ts` (1 change)
4. `apps/agent/src/app/api/mcp/tools/[tool]/route.ts` (5 changes)
5. `docs/mcp-workflows-networks.md` (1 change)
6. `docs/AGENTC2-MCP-TOOLS.md` (2 changes)

### Files to Create (1 file)
1. `tests/unit/mcp-schema-parity.test.ts` (new automated test)

### Files to Enhance (1 file)
1. `scripts/check-tool-parity.ts` (add description comparison)

---

## Detailed Change Specification

### Change 1: workflow-execute Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts:6`

**Current**:
```typescript
description: "Execute a workflow by slug or ID.",
```

**New**:
```typescript
description: "Execute a workflow by slug or ID and return output plus run metadata.",
```

**Justification**: Matches `workflow-tools.ts:97` - Users need to know the tool returns run metadata, not just executes silently.

---

### Change 2: workflow-read Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:89`

**Current**:
```typescript
description: "Retrieve a workflow definition/state by ID or slug.",
```

**New**:
```typescript
description: "Read a workflow by ID or slug with optional related data.",
```

**Justification**: Matches `workflow-crud-tools.ts:143` - Clarifies that the `include` parameter allows fetching versions/runs.

---

### Change 3: network-execute Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/network-ops.ts:6`

**Current**:
```typescript
description: "Execute a network by slug or ID.",
```

**New**:
```typescript
description: "Execute a network by slug or ID and return output plus run metadata.",
```

**Justification**: Matches `network-tools.ts:91` - Parallel to workflow-execute change.

---

### Change 4: network-read Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:141`

**Current**:
```typescript
description: "Retrieve a network definition/state by ID or slug.",
```

**New**:
```typescript
description: "Read a network by ID or slug with optional related data.",
```

**Justification**: Matches `network-crud-tools.ts:156` - Parallel to workflow-read change.

---

### Change 5: agent-create Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:26`

**Current**:
```typescript
description: "Create a new agent with full configuration.",
```

**New**:
```typescript
description: "Create a new agent with full configuration and tool bindings.",
```

**Justification**: Matches `agent-crud-tools.ts:248` - Clarifies that tools can be attached during creation.

---

### Change 6: agent-read Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:34`

**Current**:
```typescript
description: "Retrieve agent definition/state by ID or slug.",
```

**New**:
```typescript
description: "Read an agent by ID or slug with optional related data.",
```

**Justification**: Matches `agent-crud-tools.ts:340` - Uses consistent verb and clarifies `include` parameter support.

---

### Change 7: agent-update Description

**Location**: `packages/agentc2/src/tools/mcp-schemas/crud.ts:58`

**Current**:
```typescript
description: "Update an agent configuration with versioning and rollback support.",
```

**New**:
```typescript
description: "Update an agent configuration with optional version restore.",
```

**Justification**: Matches `agent-crud-tools.ts:380` - More accurate description of the restore capability.

---

### Change 8: Hardcoded API Route Descriptions

**Location**: `apps/agent/src/app/api/mcp/tools/[tool]/route.ts`

Update the `crudToolDetails` object to match (same 5 changes as above for the CRUD tools that appear in this object).

---

### Change 9: Documentation Updates

**Location**: `docs/mcp-workflows-networks.md:9`

**Current**:
```markdown
- `workflow.execute` - Execute a workflow by slug/ID.
```

**New**:
```markdown
- `workflow.execute` - Execute a workflow by slug or ID and return output plus run metadata.
```

---

### Change 10: Tool Reference Documentation

**Location**: `docs/AGENTC2-MCP-TOOLS.md:166`

**Current**:
```markdown
| `workflow_execute` | Execute a workflow |
```

**New**:
```markdown
| `workflow_execute` | Execute a workflow and return run metadata |
```

**Alternative** (more verbose):
```markdown
| `workflow_execute` | Execute a workflow by slug or ID and return output plus run metadata |
```

**Recommendation**: Use the middle-ground version for table readability.

---

## Validation Criteria

### Definition of Done

- [ ] All 8 tool descriptions updated in MCP schema files
- [ ] All 5 CRUD tool descriptions updated in `/api/mcp/tools/[tool]/route.ts`
- [ ] Documentation files updated (`mcp-workflows-networks.md`, `AGENTC2-MCP-TOOLS.md`)
- [ ] New unit test created: `tests/unit/mcp-schema-parity.test.ts`
- [ ] Parity script enhanced: `scripts/check-tool-parity.ts` checks descriptions
- [ ] All tests pass: `bun test tests/unit/mcp-schema-parity.test.ts`
- [ ] Parity check passes: `bun run scripts/check-tool-parity.ts`
- [ ] Manual verification in Cursor shows updated descriptions

### Success Metrics

**Before**:
```bash
$ node /tmp/full-comparison.js
Total mismatches found: 4 (workflows/networks)
Total agent mismatches: 3
```

**After**:
```bash
$ node /tmp/full-comparison.js
Total mismatches found: 0
Total agent mismatches: 0
```

**Tool Parity Script**:
```bash
$ bun run scripts/check-tool-parity.ts
✓ All tool descriptions match between registry and MCP schemas
✓ Registry tools: 145
✓ MCP schema tools: 145
✓ No gaps detected
```

---

## Alternative Approaches Considered

### Option 1: Auto-Generate MCP Schemas from Tool Registry
**Description**: Automatically generate MCP schema definitions by introspecting the tool registry at build time.

**Pros**:
- Eliminates description drift permanently
- Single source of truth (tool implementations)
- No manual synchronization required

**Cons**:
- Complex implementation (requires type introspection)
- May not work for all tool types (custom handlers, async tools)
- MCP schemas sometimes need additional metadata not in tool definitions
- Breaking change to existing architecture

**Decision**: Rejected - Over-engineered for this problem. Manual sync with automated tests is sufficient.

---

### Option 2: Extract Descriptions to Shared Constants
**Description**: Define all descriptions in a shared constants file, import in both MCP schemas and tool implementations.

**Pros**:
- Single source of truth for descriptions
- Easier to maintain consistency
- TypeScript enforces usage

**Cons**:
- Requires refactoring both MCP schemas and tool implementations
- Breaks existing import patterns
- More invasive than direct string updates

**Decision**: Rejected - Too invasive for the benefit. The current architecture is fine; it just needs proper synchronization.

---

### Option 3: Use Tool Registry as Source for MCP Schemas
**Description**: Have MCP schema files import tool instances and extract descriptions dynamically.

**Pros**:
- Automatic synchronization
- No duplication of description strings

**Cons**:
- Circular dependency risk (MCP schemas import tools which import MCP schemas)
- Runtime overhead vs compile-time definitions
- MCP schemas should be declarative, not dynamic

**Decision**: Rejected - Architectural anti-pattern. Keep MCP schemas as pure data definitions.

---

## Recommended Approach: **Direct String Updates + Automated Tests**

**Why This Is Best**:
1. **Minimal invasiveness**: Only string changes, no architecture modifications
2. **Low risk**: No functional code changes
3. **Quick to implement**: ~1.5 hours total
4. **Regression prevention**: Automated tests catch future drift
5. **Clear ownership**: MCP schemas are intentionally maintained separately

**Trade-off Accepted**: Manual synchronization required, but with automated tests and CI checks, the risk of future drift is minimal.

---

## Questions for Stakeholders

### Question 1: Description Style Preference
Should we standardize on a description style?

**Current Mix**:
- Some use "Execute..." (imperative)
- Some use "Retrieve..." (imperative)
- Some use "Read..." (imperative)
- Some emphasize what's returned ("...and return output plus run metadata")

**Recommendation**: Use the tool implementation descriptions as-is (they're already in production and working). Don't introduce a third style.

---

### Question 2: AGENTC2-MCP-TOOLS.md Verbosity
Should the tool reference table be:
- **Verbose**: Full descriptions matching tool implementations (may be too wide for readable table)
- **Abbreviated**: Current terse style (easier to scan, but less informative)
- **Hybrid**: Keep table terse, add detailed descriptions in a separate section

**Recommendation**: Keep table abbreviated for readability, add a note that full descriptions are available via `GET /api/mcp`.

---

## Rollout Plan

### Step 1: Pre-Push Validation
```bash
# Before making changes
bun run type-check    # Should pass
bun run lint          # Should pass
bun run build         # Should pass
```

### Step 2: Make Changes
1. Update 3 MCP schema files (8 description changes)
2. Update 1 API route file (5 description changes)
3. Update 2 documentation files (3 changes)
4. Create 1 test file
5. Enhance 1 script

### Step 3: Post-Change Validation
```bash
bun run format                              # Format all changes
bun run lint                                # Should pass
bun run type-check                          # Should pass
bun test tests/unit/mcp-schema-parity.test.ts  # New test should pass
bun run scripts/check-tool-parity.ts        # Should show zero gaps
bun run build                               # Should pass
```

### Step 4: Manual Testing
1. Start dev environment: `bun run dev`
2. Test MCP endpoint: `curl http://localhost:3001/api/mcp | jq '.tools[] | select(.name | contains("workflow"))'`
3. Verify updated descriptions appear in response
4. Open Cursor IDE and check MCP tool list (may require restart)

### Step 5: Commit and Push
```bash
git add -A
git commit -m "fix: sync MCP schema descriptions with tool implementations (#58)"
git push origin main
```

---

## Post-Implementation Monitoring

### What to Monitor
1. **CI Pipeline**: Ensure new tests pass on all future PRs
2. **MCP Client Logs**: Check for any tool discovery errors
3. **User Feedback**: Monitor for confusion about tool capabilities
4. **Parity Script**: Should run in CI and catch any future drift

### Success Indicators
- Zero description mismatch reports from `check-tool-parity.ts`
- Zero test failures in `mcp-schema-parity.test.ts`
- Positive developer feedback about clearer tool descriptions
- Reduced support questions about what workflow/network tools return

---

## Related Issues and Context

### GitHub Issue
- **Issue**: [#58](https://github.com/Appello-Prototypes/agentc2/issues/58)
- **Title**: Fix stale MCP tool descriptions
- **Description**: "MCP schema files for standard and feature workflows show old descriptions. Need refresh after v4 updates."

### Related Documentation
- `docs/mcp-tool-exposure.md` - Explains how MCP tools are exposed
- `.cursor/rules/tool-parity.mdc` - Tool parity maintenance guidelines
- `scripts/check-tool-parity.ts` - Automated parity checking

### Related Commits
- **66cddcf** (Feb 20, 2026): "feat: rename packages/mastra to packages/agentc2..." - Where the issue was introduced
- **a60cfcf** (Feb 25, 2026): "feat: admin org-scoped dispatch with per-workspace workflow slugs" - Most recent workflow tool changes

---

## Appendix: Verification Commands

### Check Current Mismatches
```bash
# Run the comparison script created during analysis
node /tmp/full-comparison.js

# Expected output: 4 workflow/network mismatches
# Expected output: 3 agent mismatches (run separately)
```

### Check Git History
```bash
# View v4 rename commit
git show 66cddcf --stat

# View workflow tool changes
git log --oneline --all -- packages/agentc2/src/tools/workflow-*.ts

# Compare old vs new descriptions
git show 66cddcf^:packages/mastra/src/tools/workflow-tools.ts | grep -A 1 "workflow-execute"
```

### Test MCP Endpoint
```bash
# List all workflow tools
curl -s http://localhost:3001/api/mcp \
  -H "X-API-Key: $MCP_API_KEY" \
  -H "X-Organization-Slug: agentc2" | \
  jq '.tools[] | select(.name | contains("workflow"))'
```

### Check Tool Implementation
```bash
# View actual tool description
grep -A 1 'id: "workflow-execute"' packages/agentc2/src/tools/workflow-tools.ts

# View MCP schema description  
grep -A 1 'name: "workflow.execute"' packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts
```

---

## Conclusion

This is a straightforward metadata synchronization issue introduced during a major refactoring. The fix is low-risk, low-complexity, and high-value. Updated descriptions will improve:

1. **Developer experience**: Clearer tool capabilities in Cursor IDE
2. **Agent reasoning**: Better tool selection with accurate descriptions
3. **Documentation quality**: Consistency between docs and actual behavior
4. **System maintainability**: Automated tests prevent future drift

**Recommendation**: Proceed with implementation using the direct string update approach outlined in this analysis.

---

**Analysis completed by**: Cloud Agent (Cursor)  
**Analysis date**: March 3, 2026  
**Ready for**: Human review and implementation approval

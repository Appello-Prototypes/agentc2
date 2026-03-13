# Root Cause Analysis: MCP Schema Missing Model Parameter for cursor-launch-agent

**Issue**: [#202](https://github.com/Appello-Prototypes/agentc2/issues/202)  
**Title**: MCP schema for cursor-launch-agent drops model parameter, causing Cursor Cloud to use wrong model (Codex 5.3 instead of claude-4.6-opus)  
**Date**: 2026-03-13  
**Severity**: High  
**Status**: Analysis Complete - Ready for Fix

---

## Executive Summary

The `model` parameter was added to the `cursor-launch-agent` tool implementation and SDLC workflow configurations in commit `7252f5de` (2026-03-12), but the corresponding MCP schema definition was not updated. This creates a schema mismatch that affects any code path where the MCP schema is used for parameter validation or tool definition exposure to LLMs. While direct workflow-to-registry tool calls work correctly, any path that relies on the MCP schema will silently drop the `model` parameter, causing Cursor Cloud Agents to fall back to the account default model (Codex 5.3) instead of the intended `claude-4.6-opus-high-thinking`.

---

## Timeline of Events

| Date | Event |
|------|-------|
| 2026-03-12 | Commit `7252f5de`: Model parameter added to tool implementation (`cursor-tools.ts`) and workflow seeds (`seed-sdlc-playbook.ts`) |
| 2026-03-12 | **BUG INTRODUCED**: MCP schema (`coding-pipeline.ts`) not updated with model parameter |
| 2026-03-13 | Issue #202 filed: SDLC pipeline Cursor Cloud Agents using wrong model |

---

## Root Cause

### Schema Mismatch Between Three Layers

There are **three sources of truth** for the `cursor-launch-agent` tool signature, and they are currently out of sync:

#### 1. **Tool Implementation** (✅ CORRECT)
**File**: `packages/agentc2/src/tools/cursor-tools.ts`  
**Lines**: 96-102

```typescript
model: z
    .string()
    .optional()
    .describe(
        "Explicit model ID (e.g., 'claude-4.6-opus-high-thinking'). " +
        "When omitted, Cursor resolves your user/team/system default."
    ),
```

The tool's Zod `inputSchema` correctly defines the `model` parameter with proper description.

#### 2. **Workflow Seed Configurations** (✅ CORRECT - mostly)
**File**: `scripts/seed-sdlc-playbook.ts`  
**Lines**: 834, 956, 1165, 1276, 1499, 1642

The SDLC playbook workflow steps correctly set `model: "claude-4.6-opus-high-thinking"` in their `parameters` blocks for most cursor-launch-agent calls.

**Exception**: The `ci-fix-launch` steps (lines 1045-1051, 1350-1356, 1716-1722) are missing the `model` parameter entirely. These three steps will always use the account default.

#### 3. **MCP Schema Definition** (❌ INCORRECT - MISSING MODEL)
**File**: `packages/agentc2/src/tools/mcp-schemas/coding-pipeline.ts`  
**Lines**: 10-38

```typescript
inputSchema: {
    type: "object",
    properties: {
        repository: { ... },
        prompt: { ... },
        ref: { ... },
        autoCreatePr: { ... },
        openAsCursorGithubApp: { ... }
        // ❌ model property MISSING
    },
    required: ["repository", "prompt"]
}
```

The MCP schema is missing the `model` property completely.

---

## Detailed Technical Analysis

### How Parameters Flow Through the System

#### Path 1: Workflow Runtime → Tool Registry (Direct Execution)
**Status**: ✅ **WORKS CORRECTLY**

```
Workflow Step Config (parameters)
    ↓
Runtime resolves input (runtime.ts:427-429)
    ↓
Gets tool from registry (runtime.ts:420)
    ↓
Calls tool.execute(input) directly (runtime.ts:484)
    ↓
Tool receives ALL parameters including model
```

**Evidence**: 
- `packages/agentc2/src/workflows/builder/runtime.ts`, lines 407-494
- The workflow runtime calls `getToolsByNamesAsync([config.toolId], organizationId)` (line 420)
- Input is resolved from `config.parameters` (line 428)
- Tool handler is called directly with full input object (line 484)
- **No MCP schema validation occurs in this path**

#### Path 2: MCP Gateway → Tool Registry (MCP Client Invocation)
**Status**: ⚠️ **POTENTIALLY AFFECTED**

```
MCP Client (external or internal)
    ↓
POST /api/mcp (route.ts:601-1491)
    ↓
buildRegistryHandler (route.ts:799-924)
    ↓
Gets tool from registry (route.ts:801)
    ↓
Validates against tool's Zod schema (route.ts:880-912)
    ↓
Executes tool (route.ts:913)
```

**Evidence**:
- `apps/agent/src/app/api/mcp/route.ts`, lines 799-924
- The MCP gateway validates against the **tool's Zod schema**, not the MCP schema (lines 880-912)
- This path should work correctly IF the parameters are passed through

**However**: The MCP schema is used when:
1. **Listing tools** (GET /api/mcp, lines 191-573) - External clients see incomplete schema
2. **External MCP clients** (Cursor IDE, Claude Desktop) use the MCP schema to understand what parameters are available
3. **LLM tool definitions** - If an agent is given the MCP schema as its tool definition, it won't know about the `model` parameter

#### Path 3: Agent with MCP Tools (LLM-Generated Tool Calls)
**Status**: ❌ **AFFECTED**

```
Agent given tools from MCP schema
    ↓
LLM generates tool call based on MCP schema
    ↓
LLM omits 'model' parameter (not in schema)
    ↓
Tool call executed with incomplete parameters
    ↓
Cursor API receives no model, uses account default
```

This is the most likely problematic path. If the SDLC pipeline agents (sdlc-planner, sdlc-auditor, etc.) are exposed to cursor-launch-agent via the MCP schema rather than the direct registry, they will not see the `model` parameter and cannot generate tool calls that include it.

---

## Impact Assessment

### Affected Systems

#### ✅ **NOT Affected**
- Direct workflow tool steps executing via the workflow runtime
- Most tool calls in the SDLC pipeline workflows (if they go through the workflow runtime directly)

#### ❌ **AFFECTED**
1. **External MCP Clients**: Cursor IDE, Claude Desktop, or other MCP clients connecting to the AgentC2 MCP server will not see the `model` parameter in the tool schema
2. **Agent Tool Calls**: Any agent that has `cursor-launch-agent` in its tool list via MCP schema exposure will not include the `model` parameter when generating tool calls
3. **MCP Gateway Clients**: Internal or external systems calling cursor-launch-agent through POST /api/mcp
4. **CI Fix Steps**: All three `ci-fix-launch` steps in the SDLC workflows are missing the model parameter in their seed configurations (lines 1050, 1355, 1721)

### Severity Breakdown

| Severity | Count | Description |
|----------|-------|-------------|
| **High** | 3 | CI fix steps missing model parameter in seed config |
| **Medium** | Unknown | Agent tool calls if using MCP schema |
| **Low** | External | External MCP clients missing parameter visibility |

---

## Code-Level Evidence

### File 1: Tool Implementation (CORRECT)
**Location**: `packages/agentc2/src/tools/cursor-tools.ts:96-102`

```typescript
model: z
    .string()
    .optional()
    .describe(
        "Explicit model ID (e.g., 'claude-4.6-opus-high-thinking'). " +
        "When omitted, Cursor resolves your user/team/system default."
    ),
```

### File 2: MCP Schema (INCORRECT - MISSING MODEL)
**Location**: `packages/agentc2/src/tools/mcp-schemas/coding-pipeline.ts:10-38`

```typescript
inputSchema: {
    type: "object",
    properties: {
        repository: {
            type: "string",
            description: "GitHub repository URL (e.g., 'https://github.com/org/repo')"
        },
        prompt: {
            type: "string",
            description: "Detailed implementation instructions for the coding agent"
        },
        ref: {
            type: "string",
            description: "Base branch or ref to work from (default: 'main')"
        },
        autoCreatePr: {
            type: "boolean",
            description:
                "Automatically create a PR when the agent finishes. " +
                "The PR URL will be available at target.prUrl on the agent response."
        },
        openAsCursorGithubApp: {
            type: "boolean",
            description:
                "Open the PR as the Cursor GitHub App instead of as the user. " +
                "Only applies when autoCreatePr is true."
        }
        // ❌ NO 'model' PROPERTY
    },
    required: ["repository", "prompt"]
}
```

### File 3: Workflow Seeds (MOSTLY CORRECT, 3 MISSING)
**Location**: `scripts/seed-sdlc-playbook.ts`

**Correct (6 instances)**: Lines 834, 956, 1165, 1276, 1499, 1642
```typescript
parameters: {
    prompt: "...",
    repository: "https://github.com/{{input.repository}}",
    model: "claude-4.6-opus-high-thinking"  // ✅ PRESENT
}
```

**Missing (3 instances)**: Lines 1050, 1355, 1721 (all `ci-fix-launch` steps)
```typescript
parameters: {
    prompt: "...",
    repository: "https://github.com/{{input.repository}}",
    branch: "{{steps['implement-wait'].branchName}}"
    // ❌ NO 'model' PARAMETER
}
```

### File 4: Tool Execution (CORRECT)
**Location**: `packages/agentc2/src/tools/cursor-tools.ts:145`

```typescript
const response = await cursorFetch("/agents", apiKey, {
    method: "POST",
    body: JSON.stringify({
        prompt: { text: prompt },
        ...(model ? { model } : {}),  // ✅ Conditional spread works correctly
        source: {
            repository,
            ref: ref || "main"
        },
        ...(Object.keys(target).length > 0 ? { target } : {})
    })
});
```

The tool implementation correctly spreads the model parameter when present.

---

## Historical Context

### Commit History

```bash
commit 7252f5de3140850ea2e21605d389fba879c76c7f
Author: coreylikestocode <corey@useappello.com>
Date:   Thu Mar 12 14:43:06 2026 -0400

    feat: add model parameter to cursor-launch-agent and default SDLC workflows to Opus 4.6
    
    The cursor-launch-agent tool now accepts an optional `model` parameter
    passed through to the Cursor Cloud API. All SDLC workflow steps that
    launch Cursor Cloud agents are configured to use claude-4.6-opus-high-thinking.
    
    Made-with: Cursor

 packages/agentc2/src/tools/cursor-tools.ts |  9 +++++++++
 scripts/seed-sdlc-playbook.ts              | 18 ++++++++++++------
 2 files changed, 21 insertions(+), 6 deletions(-)
```

**Analysis**: The commit added the `model` parameter to the tool implementation and most workflow steps, but **did not update the MCP schema**. This is the direct cause of the schema mismatch.

---

## Affected Workflows & Steps

### Standard Workflow (sdlc-standard)
- ✅ `analyze-launch` (line 830): Has model parameter
- ✅ `implement-launch` (line 952): Has model parameter
- ❌ `ci-fix-launch` (line 1045): **MISSING model parameter**

### Bugfix Workflow (sdlc-bugfix)
- ✅ `analyze-launch` (line 1161): Has model parameter
- ✅ `implement` (line 1271): Has model parameter
- ❌ `ci-fix-launch` (line 1350): **MISSING model parameter**

### Feature Workflow (sdlc-feature)
- ✅ `design-launch` (line 1495): Has model parameter
- ✅ `implement` (line 1637): Has model parameter
- ❌ `ci-fix-launch` (line 1716): **MISSING model parameter**

---

## Risk Assessment

### Complexity: **LOW**
The fix is straightforward - add the missing property to the MCP schema.

### Risk Level: **LOW**
- Adding an optional parameter to an existing schema is a non-breaking change
- Existing callers without the parameter will continue to work
- New callers can now specify the model parameter
- No data migration required
- No API contract changes (the parameter already exists in the tool implementation)

### Blast Radius: **MEDIUM**
- Affects all external MCP clients connecting to AgentC2
- Affects any agents using cursor-launch-agent via MCP schema
- Affects CI fix steps in all three SDLC workflows (currently missing model parameter)
- Does NOT affect direct workflow-to-registry tool calls

---

## Fix Plan

### Step 1: Update MCP Schema Definition
**File**: `packages/agentc2/src/tools/mcp-schemas/coding-pipeline.ts`  
**Action**: Add `model` property to `cursor-launch-agent` inputSchema

```typescript
inputSchema: {
    type: "object",
    properties: {
        repository: {
            type: "string",
            description: "GitHub repository URL (e.g., 'https://github.com/org/repo')"
        },
        prompt: {
            type: "string",
            description: "Detailed implementation instructions for the coding agent"
        },
        ref: {
            type: "string",
            description: "Base branch or ref to work from (default: 'main')"
        },
        model: {  // ✅ ADD THIS
            type: "string",
            description: "Explicit model ID (e.g., 'claude-4.6-opus-high-thinking'). When omitted, Cursor resolves your user/team/system default."
        },
        autoCreatePr: {
            type: "boolean",
            description:
                "Automatically create a PR when the agent finishes. " +
                "The PR URL will be available at target.prUrl on the agent response."
        },
        openAsCursorGithubApp: {
            type: "boolean",
            description:
                "Open the PR as the Cursor GitHub App instead of as the user. " +
                "Only applies when autoCreatePr is true."
        }
    },
    required: ["repository", "prompt"]
}
```

**Location in file**: Line 10-38  
**Estimated time**: 2 minutes

### Step 2: Add Model Parameter to CI Fix Steps
**File**: `scripts/seed-sdlc-playbook.ts`  
**Action**: Add `model: "claude-4.6-opus-high-thinking"` to all three `ci-fix-launch` steps

**Locations**:
1. Line 1046-1051 (standard workflow)
2. Line 1351-1356 (bugfix workflow)
3. Line 1717-1722 (feature workflow)

**Change**:
```typescript
parameters: {
    prompt: "CI validation failed...",
    repository: "https://github.com/{{input.repository}}",
    branch: "{{steps['implement-wait'].branchName}}",
    model: "claude-4.6-opus-high-thinking"  // ✅ ADD THIS
}
```

**Estimated time**: 5 minutes

### Step 3: Verify Tool Parity
**Action**: Run the tool parity check script to ensure MCP schema and tool registry are in sync

```bash
bun run scripts/check-tool-parity.ts --skip-api
```

**Expected result**: No gaps found  
**Estimated time**: 1 minute

### Step 4: Reseed SDLC Playbooks
**Action**: Re-run the seed script to update the workflows in the database

```bash
bun run scripts/seed-sdlc-playbook.ts
```

**Estimated time**: 30 seconds

### Step 5: Validate Fix
**Action**: Test that the model parameter flows through correctly

**Test cases**:
1. ✅ Direct workflow execution includes model parameter
2. ✅ MCP schema lists model parameter in tool definition
3. ✅ External MCP client can see and use model parameter
4. ✅ CI fix steps now include model parameter in their configurations

**Estimated time**: 15 minutes

---

## Testing Strategy

### Unit Tests (None Required)
The change is purely declarative (schema definition). No new logic to unit test.

### Integration Tests (Manual)

#### Test 1: Verify MCP Schema Includes Model
```bash
curl -X GET http://localhost:3001/api/mcp \
  -H "X-API-Key: $MCP_API_KEY" \
  | jq '.tools[] | select(.name == "cursor-launch-agent") | .inputSchema.properties.model'
```

**Expected**: Should return the model property definition

#### Test 2: Verify Workflow Execution Passes Model
1. Dispatch a ticket through the SDLC pipeline
2. Monitor the cursor-launch-agent tool calls in the workflow run logs
3. Verify the model parameter is included in the API request

#### Test 3: Verify CI Fix Steps Include Model
1. Trigger a CI failure in the SDLC pipeline (intentionally break a test)
2. Verify the ci-fix-launch step includes `model: "claude-4.6-opus-high-thinking"`
3. Verify the Cursor Cloud Agent runs on the correct model

---

## Related Issues & Documentation

### Related Files
- `packages/agentc2/src/tools/cursor-tools.ts` - Tool implementation
- `packages/agentc2/src/tools/mcp-schemas/coding-pipeline.ts` - MCP schema (needs fix)
- `scripts/seed-sdlc-playbook.ts` - Workflow seeds (needs 3 fixes)
- `packages/agentc2/src/workflows/builder/runtime.ts` - Workflow runtime (no changes needed)
- `apps/agent/src/app/api/mcp/route.ts` - MCP gateway (no changes needed)

### Related Cursor Rules
- `.cursor/rules/tool-parity.mdc` - Tool Parity Rule

### Related GitHub Issues
- Issue #202 - MCP schema for cursor-launch-agent drops model parameter

---

## Conclusion

### Root Cause Summary
When the `model` parameter was added to `cursor-launch-agent` in commit `7252f5de`, the MCP schema definition was not updated, creating a schema mismatch. Additionally, the `ci-fix-launch` workflow steps were not updated with the model parameter in the seed script.

### Impact
- External MCP clients cannot see or use the model parameter
- Agents using cursor-launch-agent via MCP schema cannot specify the model
- CI fix steps in all three SDLC workflows will use the account default model instead of claude-4.6-opus-high-thinking

### Fix Complexity
**LOW** - Simple schema update + 3 parameter additions to seed script

### Risk Level
**LOW** - Non-breaking change, backward compatible

### Estimated Fix Time
**25 minutes** (2 min schema + 5 min seed updates + 1 min parity check + 1 min reseed + 15 min validation)

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-13  
**Author**: Claude (Root Cause Analysis Agent)  
**Reviewer**: Pending  
**Status**: Ready for Implementation

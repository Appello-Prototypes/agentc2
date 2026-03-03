# Implementation Plan: Fix Stale MCP Tool Descriptions

**Issue**: [#58](https://github.com/Appello-Prototypes/agentc2/issues/58)  
**Root Cause Analysis**: See `ROOT_CAUSE_ANALYSIS_MCP_DESCRIPTIONS.md`  
**Risk Level**: LOW  
**Estimated Time**: 1.5 hours  
**Complexity**: LOW

---

## Overview

This plan provides step-by-step instructions to fix the 8 tool description mismatches between MCP schemas and tool implementations. The fix is straightforward: update string values in 6 existing files and create 1 new test file.

---

## Pre-Implementation Checklist

- [ ] Read the complete root cause analysis: `ROOT_CAUSE_ANALYSIS_MCP_DESCRIPTIONS.md`
- [ ] Understand the affected files and change locations
- [ ] Verify current environment builds successfully: `bun run build`
- [ ] Confirm you have a clean git state: `git status`
- [ ] Create a feature branch: `git checkout -b fix/mcp-tool-descriptions-58`

---

## Step-by-Step Implementation

### Step 1: Update CRUD Tool Descriptions (5 changes in 1 file)

**File**: `packages/agentc2/src/tools/mcp-schemas/crud.ts`

#### Change 1.1: agent-create (Line 26)
```typescript
// FROM:
description: "Create a new agent with full configuration.",

// TO:
description: "Create a new agent with full configuration and tool bindings.",
```

#### Change 1.2: agent-read (Line 34)
```typescript
// FROM:
description: "Retrieve agent definition/state by ID or slug.",

// TO:
description: "Read an agent by ID or slug with optional related data.",
```

#### Change 1.3: agent-update (Line 58)
```typescript
// FROM:
description: "Update an agent configuration with versioning and rollback support.",

// TO:
description: "Update an agent configuration with optional version restore.",
```

#### Change 1.4: workflow-read (Line 89)
```typescript
// FROM:
description: "Retrieve a workflow definition/state by ID or slug.",

// TO:
description: "Read a workflow by ID or slug with optional related data.",
```

#### Change 1.5: network-read (Line 141)
```typescript
// FROM:
description: "Retrieve a network definition/state by ID or slug.",

// TO:
description: "Read a network by ID or slug with optional related data.",
```

**Verification**:
```bash
grep -n "description:" packages/agentc2/src/tools/mcp-schemas/crud.ts | head -20
```

---

### Step 2: Update Workflow Operations Descriptions (1 change)

**File**: `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts`

#### Change 2.1: workflow.execute (Line 6)
```typescript
// FROM:
description: "Execute a workflow by slug or ID.",

// TO:
description: "Execute a workflow by slug or ID and return output plus run metadata.",
```

**Verification**:
```bash
grep "workflow.execute" -A 1 packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts
```

---

### Step 3: Update Network Operations Descriptions (1 change)

**File**: `packages/agentc2/src/tools/mcp-schemas/network-ops.ts`

#### Change 3.1: network.execute (Line 6)
```typescript
// FROM:
description: "Execute a network by slug or ID.",

// TO:
description: "Execute a network by slug or ID and return output plus run metadata.",
```

**Verification**:
```bash
grep "network.execute" -A 1 packages/agentc2/src/tools/mcp-schemas/network-ops.ts
```

---

### Step 4: Update API Route Hardcoded Descriptions (5 changes)

**File**: `apps/agent/src/app/api/mcp/tools/[tool]/route.ts`

Update the `crudToolDetails` object:

#### Change 4.1: "agent-create" (Line 135)
```typescript
// FROM:
description: "Create a new agent with full configuration.",

// TO:
description: "Create a new agent with full configuration and tool bindings.",
```

#### Change 4.2: "agent-read" (Line 145)
```typescript
// FROM:
description: "Retrieve agent definition/state by ID or slug.",

// TO:
description: "Read an agent by ID or slug with optional related data.",
```

#### Change 4.3: "agent-update" (Line 150)
```typescript
// FROM:
description: "Update an agent configuration with versioning and rollback support.",

// TO:
description: "Update an agent configuration with optional version restore.",
```

#### Change 4.4: "workflow-read" (Line 165)
```typescript
// FROM:
description: "Retrieve a workflow definition/state by ID or slug.",

// TO:
description: "Read a workflow by ID or slug with optional related data.",
```

#### Change 4.5: "network-read" (Line 200)
```typescript
// FROM:
description: "Retrieve a network definition/state by ID or slug.",

// TO:
description: "Read a network by ID or slug with optional related data.",
```

**Verification**:
```bash
grep -n '"agent-create":' -A 3 apps/agent/src/app/api/mcp/tools/\[tool\]/route.ts
```

---

### Step 5: Update Documentation Files

#### File 1: `docs/mcp-workflows-networks.md`

**Change 5.1: Line 9**
```markdown
# FROM:
- `workflow.execute` - Execute a workflow by slug/ID.

# TO:
- `workflow.execute` - Execute a workflow by slug or ID and return output plus run metadata.
```

#### File 2: `docs/AGENTC2-MCP-TOOLS.md`

**Change 5.2: Line 166**
```markdown
# FROM:
| `workflow_execute`       | Execute a workflow                 |

# TO:
| `workflow_execute`       | Execute a workflow and return run metadata |
```

**Change 5.3: Line 163**
```markdown
# FROM:
| `workflow_read`          | Read workflow configuration        |

# TO:
| `workflow_read`          | Read workflow by ID or slug with optional related data |
```

**Note**: Keep table descriptions concise for readability. These are abbreviated from the full descriptions.

**Verification**:
```bash
grep "workflow_execute\|workflow_read" docs/AGENTC2-MCP-TOOLS.md
```

---

### Step 6: Create Automated Test

**New File**: `tests/unit/mcp-schema-parity.test.ts`

```typescript
import { describe, it, expect } from "bun:test";
import { mcpToolDefinitions } from "@repo/agentc2/tools";
import { toolRegistry } from "@repo/agentc2/tools";

/**
 * MCP Schema Parity Test
 *
 * Ensures that MCP schema descriptions match tool implementation descriptions.
 * This prevents description drift between the external MCP interface and
 * internal tool definitions.
 *
 * Issue: #58 - Fix stale MCP tool descriptions
 */

describe("MCP Schema Description Parity", () => {
    it("should have matching descriptions between MCP schemas and tool implementations", () => {
        const mismatches: Array<{
            toolId: string;
            mcpDescription: string;
            toolDescription: string;
        }> = [];

        // Normalize MCP tool names to registry format
        const normalizeToolName = (mcpName: string): string => {
            // Handle dot notation (workflow.execute → workflow-execute)
            return mcpName.replace(/\./g, "-");
        };

        mcpToolDefinitions.forEach((mcpTool) => {
            const toolId = normalizeToolName(mcpTool.name);
            const tool = toolRegistry[toolId];

            // Skip if tool doesn't exist in registry (may be MCP-only or legacy)
            if (!tool) {
                return;
            }

            const mcpDescription = mcpTool.description;
            const toolDescription = tool.description;

            if (mcpDescription !== toolDescription) {
                mismatches.push({
                    toolId,
                    mcpDescription,
                    toolDescription
                });
            }
        });

        if (mismatches.length > 0) {
            const errorMessage = [
                `Found ${mismatches.length} description mismatch(es) between MCP schemas and tool implementations:`,
                "",
                ...mismatches.map((m) =>
                    [
                        `  Tool: ${m.toolId}`,
                        `    MCP Schema:     "${m.mcpDescription}"`,
                        `    Implementation: "${m.toolDescription}"`
                    ].join("\n")
                ),
                "",
                "To fix: Update descriptions in packages/agentc2/src/tools/mcp-schemas/ to match tool implementations."
            ].join("\n");

            throw new Error(errorMessage);
        }

        expect(mismatches).toEqual([]);
    });

    it("should have consistent description style for CRUD operations", () => {
        const crudTools = ["agent-read", "workflow-read", "network-read"];
        const descriptions: Record<string, string> = {};

        mcpToolDefinitions.forEach((mcpTool) => {
            const toolId = mcpTool.name.replace(/\./g, "-");
            if (crudTools.includes(toolId)) {
                descriptions[toolId] = mcpTool.description;
            }
        });

        // All "read" operations should use the same verb and pattern
        const readVerb = "Read"; // Expected verb for read operations
        crudTools.forEach((toolId) => {
            const desc = descriptions[toolId];
            if (desc) {
                expect(desc.startsWith(readVerb)).toBe(true);
            }
        });
    });
});
```

**Verification**:
```bash
bun test tests/unit/mcp-schema-parity.test.ts
```

**Expected Result**: Test should FAIL before fixes are applied, PASS after fixes are applied.

---

### Step 7: Enhance Tool Parity Script

**File**: `scripts/check-tool-parity.ts`

Add description comparison check after line 131 (after the MCP IDs are loaded):

```typescript
// After line 149 (B. Registry tools missing from MCP Schema)

// C. Description consistency check
const descriptionMismatches: Array<{
    toolId: string;
    mcpDesc: string;
    registryDesc: string;
}> = [];

mcpToolDefinitions.forEach((mcpTool) => {
    const toolId = normaliseToRegistryId(mcpTool.name);
    const tool = toolRegistry[toolId];

    if (tool && tool.description !== mcpTool.description) {
        descriptionMismatches.push({
            toolId,
            mcpDesc: mcpTool.description,
            registryDesc: tool.description
        });
    }
});

if (descriptionMismatches.length > 0) {
    console.error(
        `\n❌ Found ${descriptionMismatches.length} description mismatch(es) between MCP schema and tool registry:\n`
    );
    descriptionMismatches.forEach(({ toolId, mcpDesc, registryDesc }) => {
        console.error(`  - ${toolId}:`);
        console.error(`      MCP:      "${mcpDesc}"`);
        console.error(`      Registry: "${registryDesc}"`);
    });
    gaps.push(...descriptionMismatches.map((m) => m.toolId));
}
```

**Location**: Insert after the "Registry tools missing from MCP Schema" check, before the final report.

**Verification**:
```bash
bun run scripts/check-tool-parity.ts --skip-api
```

**Expected Result**: Should report 8 description mismatches before fixes, 0 after fixes.

---

## Post-Implementation Validation

### Automated Validation
```bash
# 1. Format code
bun run format

# 2. Run linting
bun run lint

# 3. Type check
bun run type-check

# 4. Run new unit test
bun test tests/unit/mcp-schema-parity.test.ts

# 5. Run tool parity script
bun run scripts/check-tool-parity.ts --skip-api

# 6. Build all apps
bun run build
```

**Expected Results**:
- ✅ Format: No changes (already formatted)
- ✅ Lint: No errors
- ✅ Type check: No errors
- ✅ Unit test: PASS (0 mismatches)
- ✅ Parity script: PASS (0 description gaps)
- ✅ Build: SUCCESS

---

### Manual Validation

#### Test 1: MCP Gateway Endpoint
```bash
# Start dev server
bun run dev

# In another terminal, test the endpoint
curl -s http://localhost:3001/api/mcp \
  -H "X-API-Key: $MCP_API_KEY" \
  -H "X-Organization-Slug: agentc2" | \
  jq '.tools[] | select(.name == "workflow.execute")'
```

**Expected Output**:
```json
{
  "name": "workflow.execute",
  "description": "Execute a workflow by slug or ID and return output plus run metadata.",
  "inputSchema": { ... },
  "invoke_url": "/api/mcp",
  "category": "workflow-ops"
}
```

#### Test 2: Tool Detail Endpoint
```bash
curl -s http://localhost:3001/api/mcp/tools/workflow-read \
  -H "X-API-Key: $MCP_API_KEY" \
  -H "X-Organization-Slug: agentc2" | \
  jq '.description'
```

**Expected Output**:
```
"Read a workflow by ID or slug with optional related data."
```

#### Test 3: Cursor IDE Integration
1. Restart Cursor IDE
2. Open the MCP tools panel (if available) or use Cursor's tool autocomplete
3. Search for "workflow-execute" or "workflow.execute"
4. Verify the description shows: "Execute a workflow by slug or ID and return output plus run metadata."

**Note**: Cursor may cache tool definitions. If old descriptions persist, try:
- Reloading the MCP server configuration
- Clearing Cursor's cache
- Restarting Cursor completely

#### Test 4: Comparison Script
```bash
# Run the verification script created during analysis
node /tmp/full-comparison.js
node /tmp/check-all-crud.js
node /tmp/check-network-crud.js
```

**Expected Output**: "Total mismatches found: 0" for all scripts

---

## Specific String Replacements

### Summary Table

| File | Line | Tool | Old Description | New Description |
|------|------|------|----------------|-----------------|
| `crud.ts` | 26 | agent-create | "Create a new agent with full configuration." | "Create a new agent with full configuration and tool bindings." |
| `crud.ts` | 34 | agent-read | "Retrieve agent definition/state by ID or slug." | "Read an agent by ID or slug with optional related data." |
| `crud.ts` | 58 | agent-update | "Update an agent configuration with versioning and rollback support." | "Update an agent configuration with optional version restore." |
| `crud.ts` | 89 | workflow-read | "Retrieve a workflow definition/state by ID or slug." | "Read a workflow by ID or slug with optional related data." |
| `crud.ts` | 141 | network-read | "Retrieve a network definition/state by ID or slug." | "Read a network by ID or slug with optional related data." |
| `workflow-ops.ts` | 6 | workflow.execute | "Execute a workflow by slug or ID." | "Execute a workflow by slug or ID and return output plus run metadata." |
| `network-ops.ts` | 6 | network.execute | "Execute a network by slug or ID." | "Execute a network by slug or ID and return output plus run metadata." |

**Total MCP Schema Changes**: 7 string replacements across 3 files

---

### API Route Changes

| File | Line | Tool | Old Description | New Description |
|------|------|------|----------------|-----------------|
| `route.ts` | 135 | "agent-create" | "Create a new agent with full configuration." | "Create a new agent with full configuration and tool bindings." |
| `route.ts` | 145 | "agent-read" | "Retrieve agent definition/state by ID or slug." | "Read an agent by ID or slug with optional related data." |
| `route.ts` | 150 | "agent-update" | "Update an agent configuration with versioning and rollback support." | "Update an agent configuration with optional version restore." |
| `route.ts` | 165 | "workflow-read" | "Retrieve a workflow definition/state by ID or slug." | "Read a workflow by ID or slug with optional related data." |
| `route.ts` | 200 | "network-read" | "Retrieve a network definition/state by ID or slug." | "Read a network by ID or slug with optional related data." |

**Total API Route Changes**: 5 string replacements in 1 file

---

## Testing Procedure

### Phase 1: Unit Tests
```bash
# Run the new MCP schema parity test
bun test tests/unit/mcp-schema-parity.test.ts

# Expected: PASS (0 mismatches)
```

### Phase 2: Integration Tests
```bash
# Run existing API tests (should still pass)
bun test tests/integration/api/

# Run tool parity check
bun run scripts/check-tool-parity.ts --skip-api

# Expected: Zero gaps, zero description mismatches
```

### Phase 3: Manual API Testing
```bash
# Start dev server
bun run dev:local

# Test workflow.execute description
curl -s http://localhost:3001/api/mcp | \
  jq '.tools[] | select(.name == "workflow.execute") | .description'

# Expected: "Execute a workflow by slug or ID and return output plus run metadata."

# Test workflow-read description (via tool detail endpoint)
curl -s http://localhost:3001/api/mcp/tools/workflow-read | \
  jq '.description'

# Expected: "Read a workflow by ID or slug with optional related data."
```

### Phase 4: Cursor IDE Testing
1. Ensure Cursor is connected to the MCP server
2. Check tool list for updated descriptions
3. Verify tool autocomplete shows correct information

---

## Commit and Push

### Commit Message
```
fix: sync MCP schema descriptions with tool implementations (#58)

- Update 8 tool descriptions in MCP schema files to match implementations
- Fix workflow-execute: add "and return output plus run metadata"
- Fix workflow-read: change "Retrieve" to "Read", add "with optional related data"
- Fix network-execute: add "and return output plus run metadata"
- Fix network-read: change "Retrieve" to "Read", add "with optional related data"
- Fix agent-create: add "and tool bindings"
- Fix agent-read: change "Retrieve" to "Read", add "with optional related data"
- Fix agent-update: update versioning description
- Update hardcoded descriptions in /api/mcp/tools/[tool] route
- Update documentation: mcp-workflows-networks.md, AGENTC2-MCP-TOOLS.md
- Add unit test: tests/unit/mcp-schema-parity.test.ts
- Enhance tool parity script with description comparison

Fixes #58

Root cause: MCP schema files created during v4 rename (commit 66cddcf)
had simplified descriptions that diverged from tool implementations.

Impact: External MCP clients (Cursor IDE, Claude Desktop) now see
accurate, complete tool descriptions for better agent reasoning and
developer experience.
```

### Push Commands
```bash
# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "fix: sync MCP schema descriptions with tool implementations (#58)

- Update 8 tool descriptions in MCP schema files to match implementations
- Fix workflow-execute: add \"and return output plus run metadata\"
- Fix workflow-read: change \"Retrieve\" to \"Read\", add \"with optional related data\"
- Fix network-execute: add \"and return output plus run metadata\"
- Fix network-read: change \"Retrieve\" to \"Read\", add \"with optional related data\"
- Fix agent-create: add \"and tool bindings\"
- Fix agent-read: change \"Retrieve\" to \"Read\", add \"with optional related data\"
- Fix agent-update: update versioning description
- Update hardcoded descriptions in /api/mcp/tools/[tool] route
- Update documentation files
- Add automated test to prevent future drift
- Enhance tool parity script with description comparison

Fixes #58"

# Push to remote
git push origin fix/mcp-tool-descriptions-58
```

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Likelihood**: Very Low  
**Impact**: None  
**Mitigation**: These are description-only changes. No functional code, schemas, or APIs are modified.

### Risk 2: Description Length in UI
**Likelihood**: Low  
**Impact**: Minor (text overflow in some UI components)  
**Mitigation**: 
- Longest new description is 74 characters (reasonable for most UIs)
- If overflow occurs, add CSS ellipsis truncation to affected components
- Document as known limitation if it becomes an issue

### Risk 3: Cached Descriptions
**Likelihood**: Medium  
**Impact**: Low (users see old descriptions until cache clears)  
**Mitigation**:
- Document that Cursor restart may be required
- Add cache-busting version parameter if needed in future
- Not critical - descriptions will update on next session

### Risk 4: Future Drift
**Likelihood**: Medium (without prevention)  
**Impact**: Medium (same issue recurs)  
**Mitigation**:
- Automated unit test catches drift in CI
- Enhanced parity script reports mismatches
- Document synchronization requirement in tool parity rule

---

## Rollback Plan

If issues arise after deployment:

### Rollback Command
```bash
git revert HEAD
git push origin main
```

### Manual Revert (if needed)
Simply restore the old descriptions by reversing all string changes. Since these are metadata-only changes, there's no database state or API contracts to roll back.

### Rollback Risks
**None** - This is a pure metadata change with no functional dependencies.

---

## Success Criteria

### Definition of Done
- [ ] All 7 MCP schema descriptions updated (3 files)
- [ ] All 5 API route descriptions updated (1 file)
- [ ] Documentation files updated (2 files)
- [ ] New unit test created and passing
- [ ] Tool parity script enhanced with description check
- [ ] All automated checks pass (lint, type-check, build, test)
- [ ] Manual testing confirms descriptions visible in MCP gateway
- [ ] Git committed and pushed with descriptive commit message
- [ ] GitHub issue #58 closed with link to commit

### Acceptance Tests
1. ✅ `bun test tests/unit/mcp-schema-parity.test.ts` passes
2. ✅ `bun run scripts/check-tool-parity.ts` reports zero gaps
3. ✅ `GET /api/mcp` returns updated descriptions
4. ✅ `GET /api/mcp/tools/workflow-read` returns updated description
5. ✅ Cursor IDE shows updated descriptions (may require restart)
6. ✅ All builds pass in CI/CD pipeline

---

## Post-Implementation Tasks

### Immediate (Same PR)
- [ ] Close GitHub issue #58
- [ ] Update `.cursor/rules/tool-parity.mdc` to mention description consistency requirement
- [ ] Add this fix to changelog or release notes

### Short-term (Next Sprint)
- [ ] Review all other MCP schema files for similar issues
- [ ] Add description linting rule to enforce style consistency
- [ ] Consider adding descriptions to CI validation pipeline

### Long-term (Backlog)
- [ ] Evaluate whether MCP schema generation should be automated
- [ ] Consider unifying description style guide across all tools
- [ ] Document best practices for maintaining MCP schema parity

---

## Reference Information

### Tool Implementation Files (Source of Truth)
- `packages/agentc2/src/tools/workflow-tools.ts` - Workflow operation tools
- `packages/agentc2/src/tools/workflow-crud-tools.ts` - Workflow CRUD tools
- `packages/agentc2/src/tools/workflow-config-tools.ts` - Workflow config tools
- `packages/agentc2/src/tools/network-tools.ts` - Network operation tools
- `packages/agentc2/src/tools/network-crud-tools.ts` - Network CRUD tools
- `packages/agentc2/src/tools/agent-crud-tools.ts` - Agent CRUD tools

### MCP Schema Files (Need Updates)
- `packages/agentc2/src/tools/mcp-schemas/crud.ts` - CRUD tool definitions
- `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts` - Workflow operation definitions
- `packages/agentc2/src/tools/mcp-schemas/network-ops.ts` - Network operation definitions
- `packages/agentc2/src/tools/mcp-schemas/index.ts` - Consolidated exports

### Related Rules and Guidelines
- `.cursor/rules/tool-parity.mdc` - Tool parity maintenance guidelines
- `docs/internal/building-custom-integrations.md` - MCP integration patterns
- `docs/mcp-tool-exposure.md` - How MCP tools are exposed to clients

---

## Timeline

### Recommended Execution Order

**Day 1, Hour 1: Implementation**
- Step 1: Update `crud.ts` (15 min)
- Step 2: Update `workflow-ops.ts` (3 min)
- Step 3: Update `network-ops.ts` (3 min)
- Step 4: Update API route (10 min)
- Step 5: Update documentation (10 min)
- **Checkpoint**: Run format, lint, type-check (5 min)

**Day 1, Hour 2: Testing & Prevention**
- Step 6: Create unit test (25 min)
- Step 7: Enhance parity script (15 min)
- **Checkpoint**: Run all validation commands (10 min)
- Final review and commit (10 min)

**Total**: ~1.5 hours

---

## Questions for Review

1. **Description Style**: Should we standardize on a single verb for "read" operations (e.g., always use "Read" instead of "Retrieve")?
   - **Recommendation**: Yes, use "Read" consistently (matches tool implementations)

2. **Documentation Verbosity**: Should `AGENTC2-MCP-TOOLS.md` use full descriptions or keep abbreviated versions?
   - **Recommendation**: Keep abbreviated for readability, add note to refer to `/api/mcp` for full descriptions

3. **Testing Coverage**: Should we add E2E tests for MCP tool descriptions?
   - **Recommendation**: No, unit tests + parity script are sufficient for metadata validation

4. **Version Bump**: Does this fix warrant a version bump or changelog entry?
   - **Recommendation**: Yes, add to changelog as "Bug Fix: MCP tool descriptions now match implementations"

---

## Appendix: Exact Git Diff Preview

### Before
```bash
$ git diff packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts
```

```diff
@@ -3,7 +3,7 @@ import { McpToolDefinition, McpToolRoute } from "./types";
 export const workflowOpsToolDefinitions: McpToolDefinition[] = [
     {
         name: "workflow.execute",
-        description: "Execute a workflow by slug or ID.",
+        description: "Execute a workflow by slug or ID and return output plus run metadata.",
         inputSchema: {
             type: "object",
             properties: {
```

### After All Changes
```bash
$ node /tmp/full-comparison.js
=== WORKFLOW OPS TOOLS ===
All descriptions match ✓

=== WORKFLOW CONFIG TOOLS ===
All descriptions match ✓

=== WORKFLOW CRUD TOOLS ===
All descriptions match ✓

Total mismatches found: 0
```

---

**Plan created by**: Cloud Agent (Cursor)  
**Plan date**: March 3, 2026  
**Ready for**: Implementation

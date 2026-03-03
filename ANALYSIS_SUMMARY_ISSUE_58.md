# Bug Analysis Summary: Issue #58 - Stale MCP Tool Descriptions

**Issue**: [#58](https://github.com/Appello-Prototypes/agentc2/issues/58)  
**Analysis Date**: March 3, 2026  
**Status**: ✅ Analysis Complete - Ready for Implementation  
**Risk**: LOW | **Complexity**: LOW | **Time**: 1.5 hours

---

## Quick Summary

**What**: MCP tool descriptions don't match actual tool implementations  
**Why**: Created with simplified descriptions during v4 package rename (Feb 20, 2026)  
**Impact**: External MCP clients see incomplete tool descriptions  
**Fix**: Update 8 tool descriptions across 6 files + add automated tests  

---

## The Problem

During the `packages/mastra` → `packages/agentc2` rename (commit 66cddcf, Feb 20, 2026), MCP schema files were created with abbreviated descriptions that don't match the actual tool implementations.

### Example Mismatch

**Tool Implementation** (`workflow-tools.ts`):
```typescript
description: "Execute a workflow by slug or ID and return output plus run metadata."
```

**MCP Schema** (`workflow-ops.ts`):
```typescript
description: "Execute a workflow by slug or ID."  // ← Missing detail
```

**Impact**: Cursor IDE and other MCP clients don't know the tool returns run metadata.

---

## Affected Tools (8 Total)

### Workflow Tools (2 mismatches)
- `workflow-execute` - Missing "and return output plus run metadata"
- `workflow-read` - Says "Retrieve" instead of "Read", missing "with optional related data"

### Network Tools (2 mismatches)
- `network-execute` - Missing "and return output plus run metadata"
- `network-read` - Says "Retrieve" instead of "Read", missing "with optional related data"

### Agent Tools (3 mismatches)
- `agent-create` - Missing "and tool bindings"
- `agent-read` - Says "Retrieve" instead of "Read", missing "with optional related data"
- `agent-update` - Inconsistent versioning terminology

**Pattern**: Execution tools missing return value detail, read tools using wrong verb and missing `include` parameter hint.

---

## Files to Modify

### Primary Changes (7 description updates)
1. `packages/agentc2/src/tools/mcp-schemas/crud.ts` (5 changes)
2. `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts` (1 change)
3. `packages/agentc2/src/tools/mcp-schemas/network-ops.ts` (1 change)

### Secondary Changes (5 description updates)
4. `apps/agent/src/app/api/mcp/tools/[tool]/route.ts` (5 changes in `crudToolDetails`)

### Documentation (3 updates)
5. `docs/mcp-workflows-networks.md` (1 change)
6. `docs/AGENTC2-MCP-TOOLS.md` (2 changes)

### Prevention (2 new/enhanced files)
7. `tests/unit/mcp-schema-parity.test.ts` (NEW - automated test)
8. `scripts/check-tool-parity.ts` (ENHANCE - add description check)

**Total**: 6 files to modify, 1 file to create, 1 file to enhance

---

## Root Cause

**When**: February 20, 2026 (commit 66cddcf)  
**What**: Massive package rename from `@repo/mastra` to `@repo/agentc2`  
**How**: MCP schema files created as new files with simplified descriptions  
**Why**: During the large refactor, descriptions were either copied from an older version or manually abbreviated, creating divergence from the current tool implementations

---

## Impact Analysis

### Critical Impact
- **MCP Clients**: Cursor IDE, Claude Desktop, Claude Code see incomplete descriptions
- **Agent Reasoning**: AI agents may not understand tool return values
- **Developer Experience**: Developers see abbreviated capabilities

### Medium Impact
- **Documentation**: Docs reference old descriptions
- **API Responses**: `/api/mcp/tools/[tool]` endpoint has hardcoded stale descriptions

### Low Impact
- **UI Components**: Some displays may show inconsistent text
- **Tool Execution**: ✅ NO IMPACT - tools function correctly, only metadata is stale

---

## Fix Approach: Direct String Updates

### Why This Approach
1. ✅ **Minimal invasiveness** - Only string changes
2. ✅ **Low risk** - No functional code modifications
3. ✅ **Quick to implement** - 1.5 hours total
4. ✅ **Automated prevention** - Unit tests + CI checks
5. ✅ **No breaking changes** - Additive information only

### Why NOT Auto-Generation
- ❌ Over-engineered for the problem
- ❌ Complex type introspection required
- ❌ May not work for all tool types
- ❌ Breaking change to architecture

**Decision**: Manual sync with automated tests is the right balance.

---

## Implementation Steps (Quick Reference)

### 1. Update MCP Schemas
```bash
# Edit these 3 files:
packages/agentc2/src/tools/mcp-schemas/crud.ts          # 5 changes
packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts  # 1 change
packages/agentc2/src/tools/mcp-schemas/network-ops.ts   # 1 change
```

### 2. Update API Route
```bash
# Edit this file:
apps/agent/src/app/api/mcp/tools/[tool]/route.ts  # 5 changes in crudToolDetails object
```

### 3. Update Documentation
```bash
# Edit these 2 files:
docs/mcp-workflows-networks.md      # 1 change
docs/AGENTC2-MCP-TOOLS.md           # 2 changes
```

### 4. Add Prevention
```bash
# Create new test:
tests/unit/mcp-schema-parity.test.ts  # NEW FILE

# Enhance existing script:
scripts/check-tool-parity.ts          # Add description comparison
```

### 5. Validate
```bash
bun run format
bun run lint
bun run type-check
bun test tests/unit/mcp-schema-parity.test.ts
bun run scripts/check-tool-parity.ts --skip-api
bun run build
```

### 6. Commit and Push
```bash
git add -A
git commit -m "fix: sync MCP schema descriptions with tool implementations (#58)"
git push origin fix/mcp-tool-descriptions-58
```

---

## Expected Outcomes

### Before Fix
```bash
$ node /tmp/full-comparison.js
Total mismatches found: 4 (workflow/network tools)

$ node /tmp/check-all-crud.js  
Total agent mismatches: 3
```

### After Fix
```bash
$ node /tmp/full-comparison.js
Total mismatches found: 0

$ bun test tests/unit/mcp-schema-parity.test.ts
✓ MCP Schema Description Parity > should have matching descriptions... [PASS]

$ bun run scripts/check-tool-parity.ts
✓ Zero gaps detected
✓ Zero description mismatches
```

---

## Key Takeaways

### For Implementers
1. This is a **metadata-only fix** - no functional changes
2. The tool implementations are **correct** - MCP schemas need updating
3. Update descriptions to **match tool implementations exactly**
4. Add **automated tests** to prevent future drift
5. **Document the requirement** in contributor guidelines

### For Reviewers
1. Verify each description change matches the tool implementation
2. Confirm no functional code is modified
3. Check that tests are comprehensive and will catch future issues
4. Validate documentation updates are accurate

### For Stakeholders
1. Low-risk fix that improves developer experience
2. Prevents confusion about tool capabilities
3. Adds automated safeguards against future issues
4. Quick to implement and deploy

---

## Related Documents

- **Full Analysis**: `ROOT_CAUSE_ANALYSIS_MCP_DESCRIPTIONS.md` (comprehensive deep-dive)
- **Implementation Plan**: `FIX_PLAN_MCP_DESCRIPTIONS.md` (step-by-step instructions)
- **This Document**: Quick reference and executive summary

---

**Analysis completed**: March 3, 2026  
**Reviewed by**: Pending human review  
**Implementation**: Approved pending review  
**Branch**: `cursor/stale-mcp-descriptions-4125` (current working branch)

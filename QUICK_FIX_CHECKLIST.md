# Quick Fix Checklist: Issue #58

**Time Required**: 1.5 hours  
**Risk Level**: LOW  
**Files to Change**: 8 files

---

## ✅ Pre-Implementation

- [ ] Read `ANALYSIS_SUMMARY_ISSUE_58.md` (5 min)
- [ ] Verify clean git state: `git status`
- [ ] Create branch: `git checkout -b fix/mcp-tool-descriptions-58`
- [ ] Baseline test: `bun run build` (should pass)

---

## 📝 Changes Required

### File 1: `packages/agentc2/src/tools/mcp-schemas/crud.ts`
- [ ] Line 26: agent-create → Add "and tool bindings"
- [ ] Line 34: agent-read → Change "Retrieve" to "Read", add "with optional related data"
- [ ] Line 58: agent-update → Change to "with optional version restore"
- [ ] Line 89: workflow-read → Change "Retrieve" to "Read", add "with optional related data"
- [ ] Line 141: network-read → Change "Retrieve" to "Read", add "with optional related data"

### File 2: `packages/agentc2/src/tools/mcp-schemas/workflow-ops.ts`
- [ ] Line 6: workflow.execute → Add "and return output plus run metadata"

### File 3: `packages/agentc2/src/tools/mcp-schemas/network-ops.ts`
- [ ] Line 6: network.execute → Add "and return output plus run metadata"

### File 4: `apps/agent/src/app/api/mcp/tools/[tool]/route.ts`
- [ ] Line 135: "agent-create" → Add "and tool bindings"
- [ ] Line 145: "agent-read" → Change "Retrieve" to "Read", add "with optional related data"
- [ ] Line 150: "agent-update" → Change to "with optional version restore"
- [ ] Line 165: "workflow-read" → Change "Retrieve" to "Read", add "with optional related data"
- [ ] Line 200: "network-read" → Change "Retrieve" to "Read", add "with optional related data"

### File 5: `docs/mcp-workflows-networks.md`
- [ ] Line 9: workflow.execute → Add "and return output plus run metadata"

### File 6: `docs/AGENTC2-MCP-TOOLS.md`
- [ ] Line 166: workflow_execute → Update to "Execute a workflow and return run metadata"
- [ ] Line 163: workflow_read → Update to match (if exists)

### File 7: `tests/unit/mcp-schema-parity.test.ts` (NEW FILE)
- [ ] Create new test file with description comparison logic
- [ ] Copy template from `FIX_PLAN_MCP_DESCRIPTIONS.md` Step 6

### File 8: `scripts/check-tool-parity.ts` (ENHANCE)
- [ ] Add description comparison check after line 149
- [ ] Copy enhancement code from `FIX_PLAN_MCP_DESCRIPTIONS.md` Step 7

---

## ✅ Validation

### Automated Checks
- [ ] `bun run format`
- [ ] `bun run lint`
- [ ] `bun run type-check`
- [ ] `bun test tests/unit/mcp-schema-parity.test.ts` (should PASS)
- [ ] `bun run scripts/check-tool-parity.ts --skip-api` (should report 0 gaps)
- [ ] `bun run build`

### Manual Verification
- [ ] `node /tmp/full-comparison.js` (should show 0 mismatches)
- [ ] Test API: `curl http://localhost:3001/api/mcp | jq '.tools[] | select(.name == "workflow.execute")'`
- [ ] Check description field shows full text with "and return output plus run metadata"

---

## 🚀 Commit and Push

```bash
git add -A
git commit -m "fix: sync MCP schema descriptions with tool implementations (#58)"
git push origin fix/mcp-tool-descriptions-58
```

---

## 📊 Expected Results

**Before**:
- 8 description mismatches
- MCP clients see incomplete information
- Documentation inconsistent with implementation

**After**:
- 0 description mismatches
- MCP clients see complete, accurate descriptions
- Automated tests prevent future drift
- Documentation matches implementation

---

## 📚 Reference Documents

- **Quick Reference**: `ANALYSIS_SUMMARY_ISSUE_58.md` (this summary)
- **Deep Dive**: `ROOT_CAUSE_ANALYSIS_MCP_DESCRIPTIONS.md` (43KB analysis)
- **Implementation Guide**: `FIX_PLAN_MCP_DESCRIPTIONS.md` (25KB step-by-step)

---

**Total Time**: ~90 minutes  
**Files**: 8 files (6 modify, 1 create, 1 enhance)  
**Changes**: 20 string replacements + 2 code additions  
**Risk**: LOW - Metadata only, no functional changes

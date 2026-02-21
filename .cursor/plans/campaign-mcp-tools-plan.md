# Campaign MCP Tools & V&V Integration Plan

**Created**: 2026-02-14
**Status**: READY
**Priority**: HIGH — Campaigns are fully functional (API + UI + Inngest) but invisible to MCP clients (Cursor IDE, workspace concierge, external integrations)

---

## Problem Statement

The Campaign (Mission Command) feature is fully operational:

- 3 API routes (list/create, detail/update/delete)
- 3 UI pages (list, detail, new)
- 4 Prisma models (Campaign, Mission, MissionTask, CampaignLog)
- 6 Inngest functions (analyze, plan, execute, mission-execute, mission-aar, campaign-aar)

**But it has ZERO MCP exposure.** This means:

1. **Cursor IDE** cannot create/monitor/manage campaigns via AgentC2 MCP tools
2. **Workspace Concierge** agent has no campaign tools — can't help users manage campaigns
3. **V&V suite** has no campaign test coverage — campaigns are untested in formal validation
4. **Platform Skill & V&V Skill** don't document campaigns — invisible to AI assistants
5. **Tool Parity Check** will flag campaigns as a gap once tools are added to registry

---

## Research Findings

### End-to-End Tool Registration Flow (proven pattern from Goals)

```
1. MCP Schema Definition     → packages/agentc2/src/tools/mcp-schemas/campaigns.ts
2. Tool Implementation        → packages/agentc2/src/tools/campaign-tools.ts
3. Tool Registry Registration → packages/agentc2/src/tools/registry.ts
4. MCP Schema Index Export    → packages/agentc2/src/tools/mcp-schemas/index.ts
5. Workspace Concierge Agent  → packages/database/prisma/seed-agents.ts
6. V&V Coverage               → ~/.cursor/skills/mastra-vv/ (SKILL.md, procedures.md, acceptance-criteria.md)
7. Platform Skill Docs        → ~/.cursor/skills/mastra-platform/ (SKILL.md, tool-reference.md, recipes.md)
```

### API Auth: Already MCP-Ready

Campaign routes use `getDemoSession(request)` which already supports:

- Session cookie auth (browser UI)
- API key auth via `X-API-Key` + `X-Organization-Slug` headers (MCP clients)

**No auth changes needed** — campaign routes are already MCP-compatible.

### Existing API Surface (maps 1:1 to MCP tools)

| HTTP Method                  | Endpoint                                         | Purpose           | MCP Tool |
| ---------------------------- | ------------------------------------------------ | ----------------- | -------- |
| `POST /api/campaigns`        | Create campaign + trigger analysis               | `campaign-create` |
| `GET /api/campaigns`         | List campaigns (status filter, pagination)       | `campaign-list`   |
| `GET /api/campaigns/[id]`    | Get campaign with missions/tasks/logs/AARs       | `campaign-get`    |
| `PATCH /api/campaigns/[id]`  | Update fields OR actions (approve/cancel/resume) | `campaign-update` |
| `DELETE /api/campaigns/[id]` | Delete campaign (cascade)                        | `campaign-delete` |

---

## Tool Design: 5 Campaign MCP Tools

### 1. `campaign-create`

**Description**: Create a new campaign using Mission Command principles. Define WHAT to achieve (intent + end state), and the platform autonomously determines HOW (missions, tasks, agent assignments).

**Input Schema**:

```json
{
    "name": "string (required) — Campaign name",
    "intent": "string (required) — Commander's intent: WHAT to achieve, not HOW",
    "endState": "string (required) — Observable conditions that define success",
    "description": "string (optional) — Additional context or background",
    "constraints": "string[] (optional) — Restrictions on HOW (must/must not)",
    "restraints": "string[] (optional) — Limitations on resources or approach",
    "requireApproval": "boolean (optional, default: false) — Require human approval before execution",
    "maxCostUsd": "number (optional) — Maximum cost budget in USD",
    "timeoutMinutes": "number (optional) — Maximum execution time in minutes"
}
```

**Route**: `{ kind: "registry", name: "campaign-create" }`

### 2. `campaign-list`

**Description**: List all campaigns with optional status filter and pagination.

**Input Schema**:

```json
{
    "status": "string (optional) — Filter: PLANNING, ANALYZING, READY, EXECUTING, REVIEWING, COMPLETE, FAILED, PAUSED",
    "limit": "number (optional, default: 50) — Max results per page",
    "offset": "number (optional, default: 0) — Pagination offset"
}
```

**Route**: `{ kind: "registry", name: "campaign-list" }`

### 3. `campaign-get`

**Description**: Get full campaign details including missions, tasks, evaluations, AARs, and activity logs.

**Input Schema**:

```json
{
    "campaignId": "string (required) — Campaign ID"
}
```

**Route**: `{ kind: "registry", name: "campaign-get" }`

### 4. `campaign-update`

**Description**: Update a campaign's configuration or perform lifecycle actions (approve, cancel, resume).

**Input Schema**:

```json
{
    "campaignId": "string (required) — Campaign ID",
    "action": "string (optional) — Lifecycle action: 'approve' (start READY campaign), 'cancel' (stop campaign), 'resume' (resume PAUSED campaign)",
    "name": "string (optional) — Update campaign name",
    "intent": "string (optional) — Update intent",
    "endState": "string (optional) — Update end state",
    "description": "string (optional) — Update description",
    "constraints": "string[] (optional) — Update constraints",
    "restraints": "string[] (optional) — Update restraints",
    "requireApproval": "boolean (optional) — Update approval requirement",
    "maxCostUsd": "number (optional) — Update cost budget",
    "timeoutMinutes": "number (optional) — Update timeout"
}
```

**Route**: `{ kind: "registry", name: "campaign-update" }`

### 5. `campaign-delete`

**Description**: Delete a campaign and all related data (missions, tasks, logs). Cannot delete executing campaigns.

**Input Schema**:

```json
{
    "campaignId": "string (required) — Campaign ID"
}
```

**Route**: `{ kind: "registry", name: "campaign-delete" }`

---

## Implementation Steps

### Step 1: Create MCP Schema Definition

**File**: `packages/agentc2/src/tools/mcp-schemas/campaigns.ts`
**Pattern**: Copy `goals.ts` structure
**Content**: 5 `McpToolDefinition` entries + 5 `McpToolRoute` entries (all `kind: "registry"`)

### Step 2: Create Tool Implementations

**File**: `packages/agentc2/src/tools/campaign-tools.ts`
**Pattern**: Copy `goal-tools.ts` structure (uses `callInternalApi` helper)
**Content**: 5 `createTool()` exports:

- `campaignCreateTool` → `POST /api/campaigns`
- `campaignListTool` → `GET /api/campaigns`
- `campaignGetTool` → `GET /api/campaigns/{id}`
- `campaignUpdateTool` → `PATCH /api/campaigns/{id}`
- `campaignDeleteTool` → `DELETE /api/campaigns/{id}`

### Step 3: Register in Tool Registry

**File**: `packages/agentc2/src/tools/registry.ts`
**Changes**:

1. Add import for all 5 campaign tools
2. Add to `toolCategoryMap` under `"Campaigns"` category
3. Add to `toolRegistry` object

### Step 4: Export from MCP Schema Index

**File**: `packages/agentc2/src/tools/mcp-schemas/index.ts`
**Changes**:

1. Add import for `campaignToolDefinitions` and `campaignToolRoutes`
2. Spread into `mcpToolDefinitions` array
3. Spread into `mcpToolRoutes` array

### Step 5: Update Workspace Concierge Agent

**File**: `packages/database/prisma/seed-agents.ts`
**Changes**:

1. Add 5 campaign tool IDs to the concierge's `tools` array
2. Add "Campaigns" section to concierge instructions explaining Mission Command capabilities
3. Run `bun run db:seed` to update the database

### Step 6: Update V&V Skill — Tool Inventory

**File**: `~/.cursor/skills/mastra-vv/SKILL.md`
**Changes**:

1. Add "Campaigns (5 tools) — `campaigns.ts`" section to the MCP Tool Inventory
2. Update total tool count (137 → 142)
3. Add campaign to Phase 5 gate criteria

### Step 7: Update V&V Procedures

**File**: `~/.cursor/skills/mastra-vv/procedures.md`
**Changes**:

1. Add "Phase 5d: Campaign Lifecycle" test procedure:
    - Create campaign via MCP tool
    - Verify analysis + planning (poll status)
    - Approve if requireApproval was set
    - Monitor execution until COMPLETE
    - Verify missions have AARs
    - Verify campaign AAR exists
    - Delete campaign
2. Add campaign-specific prompts to prompt bank

### Step 8: Update V&V Acceptance Criteria

**File**: `~/.cursor/skills/mastra-vv/acceptance-criteria.md`
**Changes**:

1. Add Campaign acceptance criteria table:
    - `campaign-create` returns campaign with PLANNING status
    - `campaign-list` returns campaigns with pagination
    - `campaign-get` returns full detail (missions, tasks, logs)
    - Campaign reaches COMPLETE status end-to-end
    - Missions have AAR data after completion
    - `campaign-delete` cascades cleanup
2. Update Phase 5 gate to include campaigns
3. Update Phase 12 final verification to include campaigns

### Step 9: Update Platform Skill

**File**: `~/.cursor/skills/mastra-platform/SKILL.md`
**Changes**:

1. Add "Campaigns" row to Quick Reference table
2. Add "Campaign Lifecycle" operation pattern
3. Document Mission Command terminology (intent, end state, constraints, restraints)

**File**: `~/.cursor/skills/mastra-platform/tool-reference.md`
**Changes**:

1. Add Campaigns section with all 5 tools and their parameters

**File**: `~/.cursor/skills/mastra-platform/recipes.md`
**Changes**:

1. Add "Create and Monitor a Campaign" recipe
2. Add "Approve a Pending Campaign" recipe

### Step 10: Verify Tool Parity

**Command**: `bun run scripts/check-tool-parity.ts`
**Expected**: All 5 campaign tools present in Registry, MCP Schema, and Concierge agent — zero gaps

---

## File Change Summary

| File                                                  | Action     | Category            |
| ----------------------------------------------------- | ---------- | ------------------- |
| `packages/agentc2/src/tools/mcp-schemas/campaigns.ts` | **CREATE** | MCP Schema          |
| `packages/agentc2/src/tools/campaign-tools.ts`        | **CREATE** | Tool Implementation |
| `packages/agentc2/src/tools/registry.ts`              | **MODIFY** | Tool Registry       |
| `packages/agentc2/src/tools/mcp-schemas/index.ts`     | **MODIFY** | MCP Schema Index    |
| `packages/database/prisma/seed-agents.ts`             | **MODIFY** | Concierge Agent     |
| `~/.cursor/skills/mastra-vv/SKILL.md`                 | **MODIFY** | V&V Skill           |
| `~/.cursor/skills/mastra-vv/procedures.md`            | **MODIFY** | V&V Procedures      |
| `~/.cursor/skills/mastra-vv/acceptance-criteria.md`   | **MODIFY** | V&V Acceptance      |
| `~/.cursor/skills/mastra-platform/SKILL.md`           | **MODIFY** | Platform Skill      |
| `~/.cursor/skills/mastra-platform/tool-reference.md`  | **MODIFY** | Platform Tool Ref   |
| `~/.cursor/skills/mastra-platform/recipes.md`         | **MODIFY** | Platform Recipes    |

**2 new files, 9 modified files, 0 deleted files**

---

## Verification Checklist

After implementation:

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- [ ] `bun run scripts/check-tool-parity.ts` exits 0 (or with campaigns accounted for)
- [ ] Campaign tools appear in Cursor IDE as `user-AgentC2-campaign_*`
- [ ] Workspace Concierge can create a campaign via conversation
- [ ] Campaign created via MCP tool reaches COMPLETE status
- [ ] V&V SKILL.md shows 142 tools (was 137)

---

## Risk Assessment

| Risk                                             | Likelihood | Mitigation                                     |
| ------------------------------------------------ | ---------- | ---------------------------------------------- |
| API routes return Unauthorized for MCP calls     | LOW        | `getDemoSession` already supports API key auth |
| Tool parity script doesn't account for campaigns | LOW        | Script dynamically reads registry + schema     |
| Concierge tool list stale in prod DB             | MEDIUM     | Must run `bun run db:seed` after update        |
| V&V procedures too complex for campaigns         | LOW        | Follow existing goal/canvas pattern            |

---

## Timeline Estimate

| Step                                          | Effort      | Dependencies |
| --------------------------------------------- | ----------- | ------------ |
| Steps 1-4 (Schema + Tools + Registry + Index) | 20 min      | None         |
| Step 5 (Concierge)                            | 10 min      | Steps 1-4    |
| Steps 6-8 (V&V updates)                       | 15 min      | Steps 1-4    |
| Step 9 (Platform skill)                       | 10 min      | Steps 1-4    |
| Step 10 (Parity check)                        | 5 min       | All above    |
| **Total**                                     | **~60 min** |              |

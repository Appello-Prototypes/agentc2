# V&V Execution Log

**Session Start**: 2026-02-09T00:38:41Z
**Platform**: https://mastra.useappello.app
**Organization**: Appello Inc. (slug: appello)
**Workspace**: Production (default)
**Starting State**: Empty system (0 agents, 0 workflows, 0 networks, 0 runs)

---

## Decision Log

| # | Iteration | Tier | Phase | Status | Tool | Issue | Root Cause | Fix Applied | Re-run From |
|---|-----------|------|-------|--------|------|-------|------------|-------------|-------------|
| 1 | 1 | Pre-Flight | MCP Tool Mapping | FAIL | org_get, org_members_list, rag_*, goals_*, integration_providers_list, integration_connections_list | Returns "Unauthorized" | API routes only check session cookies, not API key headers. The `authenticateRequest()` function in `/api/mcp/route.ts` supports API keys but was not shared with other routes. | Created shared `api-auth.ts` utility. Updated 12 route files to use `authenticateRequest()` or pass request to `getDemoSession()`. | Pre-Flight |

---

## Codebase Fixes Applied

### Fix #1: API Key Authentication for All Routes (2026-02-09)

**Problem**: Only `/api/mcp` supported API key authentication. All other routes required browser session cookies, making them inaccessible from MCP clients.

**Root Cause**: The `authenticateRequest()` function in `apps/agent/src/app/api/mcp/route.ts` was not shared. Other routes used `auth.api.getSession()` (session-only) or `getDemoSession()` (session or standalone mode only).

**Fix**:
1. Created `apps/agent/src/lib/api-auth.ts` -- shared `authenticateRequest()` supporting API key + session fallback
2. Updated `apps/agent/src/lib/standalone-auth.ts` -- `getDemoSession()` now accepts optional `NextRequest` param for API key auth
3. Updated routes to use the shared auth:
   - `apps/agent/src/app/api/organizations/[orgId]/route.ts` (GET, PATCH, DELETE)
   - `apps/agent/src/app/api/organizations/[orgId]/members/route.ts` (GET, POST)
   - `apps/agent/src/app/api/integrations/providers/route.ts` (GET, POST)
   - `apps/agent/src/app/api/integrations/connections/route.ts` (GET, POST)
   - `apps/agent/src/app/api/goals/route.ts` (GET, POST)
   - `apps/agent/src/app/api/goals/[id]/route.ts` (GET, PATCH, DELETE)
   - `apps/agent/src/app/api/goals/stream/route.ts` (GET)
   - `apps/agent/src/app/api/rag/query/route.ts` (POST)
   - `apps/agent/src/app/api/rag/ingest/route.ts` (POST)
   - `apps/agent/src/app/api/rag/documents/route.ts` (GET, DELETE)
4. Removed unused imports (`headers`, `auth`, `getUserOrganizationId`) from updated files

**Status**: Code changes applied locally. Requires build + deploy to production to verify.

---

## TIER 1: FOUNDATION

### Phase 0: Environment Baseline

**Status**: NOT YET RUN (awaiting deploy of Fix #1)

| # | Tool | Expected | Actual | Status |
|---|------|----------|--------|--------|
| 1 | `org_list` | >= 1 org | | |
| 2 | `org_get` (orgId: appello) | Appello Inc. details | | |
| 3 | `org_workspaces_list` (orgId: appello) | >= 1 workspace | | |
| 4 | `org_members_list` (orgId: appello) | >= 1 member | | |
| 5 | `live_stats` | Valid response, 0 runs | | |

**Gate**: All 5 pass, all responses < 5s.

### Phase 1: MCP Configuration & Integration Smoke Tests

**Status**: NOT YET RUN

#### Phase 1a: Import MCP Config

| # | Tool | Expected | Actual | Status |
|---|------|----------|--------|--------|
| 1 | `integration_mcp_config` (read) | Empty config `{}` | | |
| 2 | `integration_mcp_config` (plan) | Impact analysis for 13 servers | | |
| 3 | `integration_mcp_config` (apply, merge) | Config imported | | |
| 4 | `integration_mcp_config` (read) | 13 servers in config | | |
| 5 | `integration_providers_list` | 13 providers listed | | |
| 6 | `integration_connections_list` | Active connections | | |

#### Phase 1b: MCP Smoke Tests (via Cursor IDE tools)

| # | Server | Tool | Expected | Actual | Status |
|---|--------|------|----------|--------|--------|
| 1 | HubSpot | hubspot-search-objects "Vanos" | Company found | | |
| 2 | Jira | jira_get_project_issues Q21030 | Issues returned | | |
| 3 | ATLAS | Query_ATLAS "What is Appello?" | Context returned | | |
| 4 | Fathom | list_meetings | Meetings returned | | |
| 5 | Gmail | search_emails "Appello" | Results returned | | |
| 6 | Google Calendar | list-events primary | Events returned | | |
| 7 | Slack | (read-only test) | Channels returned | | |
| 8 | GitHub | (read-only test) | Repos returned | | |
| 9 | JustCall | (read-only test) | Data returned | | |
| 10 | Firecrawl | scrape useappello.com | Content returned | | |
| 11 | Playwright | navigate test URL | Responds | | |
| 12 | Google Workspace | (read-only test) | Files returned | | |

**Gate**: Config imported (13 servers). At least 10/13 smoke tests pass. HubSpot, Jira, ATLAS, Fathom MUST pass.

### Phase 2: Agent CRUD + Versioning + Idempotency

**Status**: NOT YET RUN

| # | Tool | Expected | Actual | Status |
|---|------|----------|--------|--------|
| 1 | `agent_list` | 0 agents (empty system) | | |
| 2 | `agent_create` (v-and-v-test) | Agent created, version 1 | | |
| 3 | `agent_read` (v-and-v-test) | Full definition returned | | |
| 4 | `agent_list` | 1 agent | | |
| 5 | `agent_update` (add timestamp instruction) | Updated, version 2 | | |
| 6 | `agent_versions_list` | 2 versions | | |
| 7 | `agent_update` (restoreVersion: 1) | Rolled back | | |
| 8 | `agent_read` | Original instructions | | |
| 9 | `agent_update` (version 3 state) | Updated forward | | |
| 10 | `agent_versions_list` | 3 versions | | |
| 11 | `agent_create` (duplicate slug) | Graceful error | | |
| 12 | `agent_budget_update` | Budget set ($10 limit) | | |
| 13 | `agent_budget_get` | Budget confirmed | | |

**Gate**: All CRUD works, versioning + rollback works, idempotency error is graceful, budget set.

### TIER 1 GATE

All Phase 0-2 criteria met in a single continuous run.

---

## TIER 2: EXECUTION & DATA GENERATION

### Phase 3a: V&V Test Agent -- 30 Runs

**Status**: NOT YET RUN

**Baseline**: agent_runs_list count = ___, agent_overview total = ___

#### Batch 1: Basic Questions (10 prompts)
| # | Prompt | Status | Run ID | Output (truncated) | Latency | Cost |
|---|--------|--------|--------|--------------------|---------|------|
| 1 | | | | | | |
| ... | | | | | | |

#### Checkpoint 1: ___/10 completed

#### Batch 2: Date-Time Tool (10 prompts)
(same table format)

#### Checkpoint 2: ___/20 cumulative

#### Batch 3: Calculator Tool (10 prompts)
(same table format)

#### Checkpoint 3: ___/30 cumulative

**Post-Batch Verification**:
- agent_runs_list count: ___
- agent_overview total: ___
- agent_costs total: $___
- Tool call success rate: ___/20 (___%)
- Mean latency: ___ms
- Mean cost: $___

---

## Running Tallies

| Metric | Value |
|--------|-------|
| Total Runs Executed | 0 |
| Total Cost (USD) | $0.00 |
| Agents Created | 0 |
| Workflows Created | 0 |
| Networks Created | 0 |
| Codebase Fixes Applied | 1 |
| Decision Log Entries | 1 |
| Current Tier | 1 (Pre-Flight) |
| Current Phase | Awaiting deploy of Fix #1 |

---

## Baseline Metrics Snapshot

(Recorded after Phase 3d)

| Agent | Run Count | Mean Latency (ms) | Mean Cost ($) | Failure Rate |
|-------|-----------|-------------------|---------------|--------------|
| (to be filled) | | | | |

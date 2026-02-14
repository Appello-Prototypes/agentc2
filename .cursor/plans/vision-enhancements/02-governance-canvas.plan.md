---
name: "Enhancement 2: Governance Canvas Template"
overview: "Create a pre-built governance canvas template that pulls live data from budgets, guardrails, learning sessions, and audit logs into a single-screen dashboard. Also serves as proof that the canvas system can compose real operational views from MCP data queries."
todos:
    - id: canvas-template-api
      content: "Create /api/canvas/templates endpoint that returns available canvas templates as JSON schemas"
      status: pending
    - id: governance-template-json
      content: "Define the governance canvas JSON schema with dataQueries for budgets, guardrails, learning, audit logs and components for KPI cards, tables, lists"
      status: pending
    - id: template-picker-ui
      content: "Add 'Start from Template' option to the canvas gallery page new-canvas flow, with template cards"
      status: pending
    - id: template-instantiation
      content: "When user selects a template, auto-create the canvas from the template JSON and redirect to the rendered canvas"
      status: pending
isProject: false
---

# Enhancement 2: Governance Canvas Template

## Goal

Provide a one-click governance dashboard that shows budget utilization, guardrail violations, pending learning proposals, and audit log across all agents -- all in a single canvas. This also proves the canvas system can pull live data from multiple MCP tool queries and render a real operational view.

## Dependencies

- None. Uses only existing canvas infrastructure, MCP tools, and canvas block types.

## Pre-requisites to Understand

- Canvas schema is defined at [packages/mastra/src/canvas/schema.ts](packages/mastra/src/canvas/schema.ts) with DataQuerySchema supporting sources: `mcp`, `sql`, `rag`, `static`, `agent`, `api`
- Canvas can use MCP tools as data sources: `{ source: "mcp", tool: "agent-costs", params: {...} }`
- 25 block types exist across 7 categories: `kpi-card`, `bar-chart`, `data-table`, `list`, `progress-bar`, etc.
- The canvas gallery page is at [apps/agent/src/app/canvas/page.tsx](apps/agent/src/app/canvas/page.tsx) -- it already has "New Canvas" functionality
- The canvas builder is at [apps/agent/src/app/canvas/build/page.tsx](apps/agent/src/app/canvas/build/page.tsx) using `CanvasBuilderPanel`
- The canvas renderer/view is at [apps/agent/src/app/canvas/[slug]/page.tsx](apps/agent/src/app/canvas/[slug]/page.tsx)
- Available MCP tools for governance data:
    - `agent-costs` -- cost data per agent
    - `agent-budget-get` -- budget policy per agent
    - `agent-guardrails-events` -- guardrail violation events
    - `agent-learning-sessions` -- learning sessions with status
    - `audit-logs-list` -- audit trail events
    - `agent-list` -- list all agents
    - `live-stats` -- live production stats

---

## Step 1: Define the Governance Canvas Template JSON

Create a template file or constant that contains the full canvas schema JSON. This is the template that gets instantiated when the user clicks "Governance Dashboard."

**File:** Create `apps/agent/src/lib/canvas-templates.ts`

The template should define:

```typescript
export const GOVERNANCE_CANVAS_TEMPLATE = {
    slug: "governance-dashboard",
    title: "Governance Dashboard",
    description:
        "Budget utilization, guardrail events, learning proposals, and audit trail across all agents",
    category: "governance",
    tags: ["governance", "compliance", "monitoring"],
    schemaJson: {
        title: "Governance Dashboard",
        description: "Single-pane governance view",
        layout: { type: "grid", columns: 12, gap: 16 },
        dataQueries: [
            {
                id: "agents",
                source: "mcp",
                tool: "agent-list",
                params: { active: true }
            },
            {
                id: "live-stats",
                source: "mcp",
                tool: "live-stats",
                params: {},
                refreshInterval: 30000
            },
            {
                id: "guardrail-events",
                source: "mcp",
                tool: "agent-guardrails-events",
                params: { limit: 20 }
                // Note: this queries one agent -- may need to iterate or use a broader endpoint
            },
            {
                id: "audit-logs",
                source: "mcp",
                tool: "audit-logs-list",
                params: { limit: 50 }
            },
            {
                id: "live-metrics",
                source: "mcp",
                tool: "live-metrics",
                params: {}
            }
        ],
        components: [
            // Row 1: KPI cards (4 across)
            {
                type: "kpi-card",
                span: 3,
                title: "Active Agents",
                dataQueryId: "agents",
                config: { valueKey: "length", label: "Active Agents" }
            },
            {
                type: "kpi-card",
                span: 3,
                title: "Guardrail Events",
                dataQueryId: "guardrail-events",
                config: { valueKey: "length", label: "Events This Period" }
            },
            {
                type: "kpi-card",
                span: 3,
                title: "Total Runs",
                dataQueryId: "live-metrics",
                config: { valueKey: "totalRuns", label: "Total Runs" }
            },
            {
                type: "kpi-card",
                span: 3,
                title: "Success Rate",
                dataQueryId: "live-metrics",
                config: { valueKey: "successRate", label: "Success Rate", format: "percent" }
            },
            // Row 2: Budget utilization + Guardrail events
            {
                type: "data-table",
                span: 6,
                title: "Agent Overview",
                dataQueryId: "live-stats",
                config: {
                    columns: [
                        { key: "name", label: "Agent" },
                        { key: "totalRuns", label: "Runs" },
                        { key: "successRate", label: "Success %", format: "percent" },
                        { key: "totalCostUsd", label: "Cost", format: "currency" }
                    ]
                }
            },
            {
                type: "list",
                span: 6,
                title: "Recent Guardrail Events",
                dataQueryId: "guardrail-events",
                config: {
                    titleKey: "guardrail",
                    subtitleKey: "reason",
                    timestampKey: "timestamp",
                    badgeKey: "type"
                }
            },
            // Row 3: Audit log
            {
                type: "data-table",
                span: 12,
                title: "Audit Trail",
                dataQueryId: "audit-logs",
                config: {
                    columns: [
                        { key: "action", label: "Action" },
                        { key: "entityType", label: "Entity" },
                        { key: "entityId", label: "ID" },
                        { key: "createdAt", label: "When", format: "datetime" }
                    ],
                    maxRows: 20
                }
            }
        ]
    }
};
```

**Note:** The exact data query params and transform expressions will need to be adjusted based on what the MCP tools actually return. Use `canvas-query-preview` MCP tool to test each query shape before finalizing.

---

## Step 2: Template API Endpoint

**File:** Create `apps/agent/src/app/api/canvas/templates/route.ts`

Simple endpoint that returns available templates:

```typescript
// GET /api/canvas/templates
// Returns: { templates: [{ slug, title, description, category, tags, preview }] }
```

And a POST to instantiate a template:

```typescript
// POST /api/canvas/templates
// Body: { templateSlug: "governance-dashboard" }
// Action: Creates a new canvas from the template JSON, returns the created canvas
```

The POST should:

1. Look up the template by slug
2. Generate a unique slug for the instance (e.g., `governance-dashboard-1`)
3. Call the existing canvas creation logic (same as the canvas builder uses)
4. Return the created canvas with its slug

---

## Step 3: Template Picker UI

**File:** [apps/agent/src/app/canvas/page.tsx](apps/agent/src/app/canvas/page.tsx)

**Location:** The "New Canvas" button/flow area.

**What to add:**

When the user clicks "New Canvas", show two options:

1. "Blank Canvas" -- goes to the existing `/canvas/build` page (current behavior)
2. "Start from Template" -- shows a grid of template cards

Each template card shows: title, description, category badge, and a mini-preview (same `CanvasMiniPreview` component already on this page).

Clicking a template card:

1. Calls POST `/api/canvas/templates` with the template slug
2. On success, redirects to `/canvas/{newSlug}` to view the created canvas

**Components used:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button` -- all already imported on this page. The template picker can be a Dialog or a section that appears inline.

---

## Step 4: Test the Data Queries

Before finalizing the template, test each MCP data query using the `canvas-query-preview` tool or by creating a test canvas manually:

1. Test `agent-list` with `active: true` -- verify it returns agent names and IDs
2. Test `live-stats` -- verify it returns per-agent stats
3. Test `agent-guardrails-events` -- verify event format (may need to query per-agent then aggregate)
4. Test `audit-logs-list` -- verify log entry format
5. Adjust template JSON based on actual response shapes

---

## Testing

1. Go to `/canvas`, click "New Canvas", select "Governance Dashboard" template
2. Verify canvas is created and renders with live data
3. Verify KPI cards show correct numbers
4. Verify data tables populate with agent stats and audit logs
5. Verify guardrail events list populates (may be empty if no events -- that is OK)
6. Edit the canvas -- verify all blocks are editable via the existing canvas editor
7. Run `bun run type-check`, `bun run lint`, `bun run build`

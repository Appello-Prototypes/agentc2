# 08 -- Agent Fleet Dashboard Canvas

**Priority:** TIER 3 (Visibility)
**Effort:** Low-Medium (2-3 hours)
**Dependencies:** None

## Problem Statement

Zero canvases exist despite the Canvas Builder agent having 24 runs and a full 26-block-type component library. The Agent Fleet Dashboard is the most impactful first canvas because it gives users a command center view of all their agents.

## Canvas Design

**Name:** `Agent Fleet Dashboard`
**Slug:** `agent-fleet-dashboard`
**Category:** `dashboard`

### Layout

Grid layout (3 columns) with these sections:

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Total Runs     │  Success Rate   │  Total Cost     │
│  (KPI Card)     │  (KPI Card)     │  (KPI Card)     │
├─────────────────┴─────────────────┴─────────────────┤
│              Agent Performance Table                 │
│  Name | Runs | Success% | Avg Latency | Cost | Last │
├─────────────────────────┬───────────────────────────┤
│  Runs by Agent          │  Runs by Source           │
│  (Bar Chart)            │  (Pie Chart)              │
├─────────────────────────┴───────────────────────────┤
│              Daily Run Volume (Line Chart)           │
├─────────────────────────────────────────────────────┤
│              Cost by Agent (Bar Chart)               │
└─────────────────────────────────────────────────────┘
```

## Canvas Schema

```json
{
    "slug": "agent-fleet-dashboard",
    "title": "Agent Fleet Dashboard",
    "description": "Real-time overview of all active agents: runs, success rates, costs, and trends.",
    "category": "dashboard",
    "tags": ["agents", "monitoring", "operations"],
    "schemaJson": {
        "title": "Agent Fleet Dashboard",
        "description": "Real-time overview of all active agents",
        "layout": {
            "type": "grid",
            "columns": 3,
            "gap": 16
        },
        "dataQueries": [
            {
                "id": "live-stats",
                "source": "mcp",
                "tool": "agentc2_live-stats"
            },
            {
                "id": "live-metrics",
                "source": "mcp",
                "tool": "agentc2_live-metrics"
            }
        ],
        "components": [
            {
                "type": "kpi-card",
                "title": "Total Runs",
                "dataQueryId": "live-stats",
                "config": {
                    "value": "{{ data.summary.totalProdRuns }}",
                    "format": "number",
                    "icon": "activity"
                }
            },
            {
                "type": "kpi-card",
                "title": "Success Rate",
                "dataQueryId": "live-stats",
                "config": {
                    "value": "{{ data.summary.successRate }}",
                    "format": "percent",
                    "icon": "check-circle",
                    "color": "{{ data.summary.successRate > 90 ? 'green' : data.summary.successRate > 70 ? 'yellow' : 'red' }}"
                }
            },
            {
                "type": "kpi-card",
                "title": "Total Cost",
                "dataQueryId": "live-stats",
                "config": {
                    "value": "{{ data.summary.totalCostUsd }}",
                    "format": "currency",
                    "icon": "dollar-sign"
                }
            },
            {
                "type": "data-table",
                "title": "Agent Performance",
                "dataQueryId": "live-stats",
                "colSpan": 3,
                "config": {
                    "data": "{{ data.agents }}",
                    "columns": [
                        { "key": "name", "label": "Agent", "sortable": true },
                        { "key": "prodRuns", "label": "Runs", "sortable": true },
                        {
                            "key": "successRate",
                            "label": "Success %",
                            "sortable": true,
                            "format": "percent"
                        },
                        {
                            "key": "avgLatencyMs",
                            "label": "Avg Latency",
                            "sortable": true,
                            "format": "duration"
                        },
                        {
                            "key": "totalCostUsd",
                            "label": "Cost",
                            "sortable": true,
                            "format": "currency"
                        },
                        { "key": "lastRunAt", "label": "Last Run", "format": "relative-time" }
                    ],
                    "sortBy": "prodRuns",
                    "sortDirection": "desc"
                }
            },
            {
                "type": "bar-chart",
                "title": "Runs by Agent",
                "dataQueryId": "live-stats",
                "config": {
                    "data": "{{ data.agents }}",
                    "xField": "name",
                    "yField": "prodRuns",
                    "sortBy": "prodRuns",
                    "sortDirection": "desc"
                }
            },
            {
                "type": "pie-chart",
                "title": "Runs by Source",
                "dataQueryId": "live-stats",
                "config": {
                    "data": "{{ data.summary.runsBySource }}",
                    "nameField": "source",
                    "valueField": "count"
                }
            },
            {
                "type": "bar-chart",
                "title": "Cost by Agent",
                "dataQueryId": "live-stats",
                "colSpan": 3,
                "config": {
                    "data": "{{ data.agents.filter(a => a.totalCostUsd > 0) }}",
                    "xField": "name",
                    "yField": "totalCostUsd",
                    "sortBy": "totalCostUsd",
                    "sortDirection": "desc",
                    "yFormat": "currency"
                }
            }
        ]
    }
}
```

## Implementation Steps

### Step 1: Create the canvas via MCP tool

Use `canvas_create` with the schema above.

### Step 2: Test data queries

Use `canvas_execute_queries` to verify the `live-stats` and `live-metrics` data queries return correct data:

```
GET /api/canvases/agent-fleet-dashboard/data
```

### Step 3: Verify rendering

Navigate to `/canvas/agent-fleet-dashboard` in the browser to verify the dashboard renders correctly with live data.

### Step 4: Publish

Set `isPublished: true` so it appears in the canvas list.

## Acceptance Criteria

- [ ] Canvas created and accessible at `/canvas/agent-fleet-dashboard`
- [ ] KPI cards show correct totals (runs, success rate, cost)
- [ ] Data table lists all active agents with sortable columns
- [ ] Bar chart shows runs per agent
- [ ] Pie chart shows run distribution by source
- [ ] Cost chart shows spend per agent
- [ ] Data refreshes on page load

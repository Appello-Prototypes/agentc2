/**
 * Canvas Templates
 *
 * Pre-built canvas templates that can be instantiated with one click.
 * Each template defines the full canvas schema including data queries,
 * layout, and components.
 */

export interface CanvasTemplate {
    slug: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    schemaJson: {
        title: string;
        description?: string;
        layout: { type: "grid" | "stack"; columns: number; gap: number };
        dataQueries: Array<{
            id: string;
            source: string;
            query?: string;
            tool?: string;
            params?: Record<string, unknown>;
            refreshInterval?: number;
        }>;
        components: Array<Record<string, unknown>>;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance Dashboard Template
// ─────────────────────────────────────────────────────────────────────────────

export const GOVERNANCE_CANVAS_TEMPLATE: CanvasTemplate = {
    slug: "governance-dashboard",
    title: "Governance Dashboard",
    description:
        "Budget utilization, guardrail events, learning proposals, and audit trail across all agents",
    category: "governance",
    tags: ["governance", "compliance", "monitoring"],
    schemaJson: {
        title: "Governance Dashboard",
        description: "Single-pane governance view across all agents",
        layout: { type: "grid", columns: 12, gap: 16 },
        dataQueries: [
            {
                id: "summary",
                source: "sql",
                query: `SELECT
                    count(*)::int as "totalRuns",
                    count(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as "completedRuns",
                    count(CASE WHEN status = 'FAILED' THEN 1 END)::int as "failedRuns",
                    CASE WHEN count(*) > 0
                        THEN ROUND((count(CASE WHEN status = 'COMPLETED' THEN 1 END) * 100.0 / count(*))::numeric, 0)::int
                        ELSE 0
                    END as "successRate",
                    ROUND(COALESCE(SUM("costUsd"), 0)::numeric, 2)::float as "totalCostUsd",
                    count(DISTINCT "agentId")::int as "activeAgents"
                FROM agent_run`
            },
            {
                id: "agent-overview",
                source: "sql",
                query: `SELECT
                    a.slug,
                    a.name,
                    a."modelProvider" || '/' || a."modelName" as "model",
                    count(r.id)::int as "totalRuns",
                    CASE WHEN count(r.id) > 0
                        THEN ROUND((count(CASE WHEN r.status = 'COMPLETED' THEN 1 END) * 100.0 / count(r.id))::numeric, 0)::int
                        ELSE 0
                    END as "successRate",
                    ROUND(COALESCE(SUM(r."costUsd"), 0)::numeric, 4)::float as "totalCostUsd",
                    ROUND(COALESCE(AVG(r."durationMs"), 0)::numeric, 0)::int as "avgLatencyMs"
                FROM agent a
                LEFT JOIN agent_run r ON r."agentId" = a.id
                WHERE a."isActive" = true
                GROUP BY a.id, a.slug, a.name, a."modelProvider", a."modelName"
                ORDER BY count(r.id) DESC`
            },
            {
                id: "guardrail-events",
                source: "sql",
                query: `SELECT
                    ge.type,
                    ge."guardrailKey" as "guardrail",
                    ge.reason,
                    ge."createdAt",
                    a.name as "agentName"
                FROM guardrail_event ge
                JOIN agent a ON a.id = ge."agentId"
                ORDER BY ge."createdAt" DESC
                LIMIT 20`
            },
            {
                id: "audit-logs",
                source: "sql",
                query: `SELECT
                    action,
                    "entityType",
                    "entityId",
                    COALESCE("actorId", 'system') as "actorId",
                    "createdAt"
                FROM audit_log
                ORDER BY "createdAt" DESC
                LIMIT 30`
            }
        ],
        components: [
            // Row 1: KPI cards (4 across)
            {
                id: "kpi-active-agents",
                type: "kpi-card",
                span: 3,
                title: "Active Agents",
                value: "{{ queries.summary[0].activeAgents }}",
                color: "blue"
            },
            {
                id: "kpi-total-runs",
                type: "kpi-card",
                span: 3,
                title: "Total Runs",
                value: "{{ queries.summary[0].totalRuns }}",
                format: "number",
                color: "purple"
            },
            {
                id: "kpi-success-rate",
                type: "kpi-card",
                span: 3,
                title: "Success Rate",
                value: "{{ queries.summary[0].successRate }}",
                suffix: "%",
                color: "green"
            },
            {
                id: "kpi-total-cost",
                type: "kpi-card",
                span: 3,
                title: "Total Spend",
                value: "{{ queries.summary[0].totalCostUsd }}",
                prefix: "$",
                format: "number",
                color: "yellow"
            },
            // Row 2: Agent overview table + Guardrail events list
            {
                id: "agent-table",
                type: "data-table",
                span: 7,
                title: "Agent Overview",
                data: "{{ queries.agent-overview }}",
                columns: [
                    { key: "name", label: "Agent" },
                    { key: "model", label: "Model" },
                    { key: "totalRuns", label: "Runs", sortable: true },
                    { key: "successRate", label: "Success %", format: "number", sortable: true },
                    { key: "totalCostUsd", label: "Cost ($)", format: "number", sortable: true },
                    {
                        key: "avgLatencyMs",
                        label: "Avg Latency (ms)",
                        format: "number",
                        sortable: true
                    }
                ],
                pageSize: 10,
                searchable: true,
                striped: true
            },
            {
                id: "guardrail-list",
                type: "list",
                span: 5,
                title: "Recent Guardrail Events",
                data: "{{ queries.guardrail-events }}",
                titleKey: "guardrail",
                descriptionKey: "reason",
                badgeKey: "type",
                emptyMessage: "No guardrail events recorded"
            },
            // Row 3: Audit log table (full width)
            {
                id: "audit-table",
                type: "data-table",
                span: 12,
                title: "Audit Trail",
                data: "{{ queries.audit-logs }}",
                columns: [
                    { key: "action", label: "Action" },
                    { key: "entityType", label: "Entity" },
                    { key: "entityId", label: "ID" },
                    { key: "actorId", label: "Actor" },
                    { key: "createdAt", label: "When", format: "datetime" }
                ],
                pageSize: 15,
                striped: true,
                compact: true
            }
        ]
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Template Registry
// ─────────────────────────────────────────────────────────────────────────────

export const CANVAS_TEMPLATES: CanvasTemplate[] = [GOVERNANCE_CANVAS_TEMPLATE];

export function getCanvasTemplate(slug: string): CanvasTemplate | undefined {
    return CANVAS_TEMPLATES.find((t) => t.slug === slug);
}

export function listCanvasTemplates(): Array<{
    slug: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    preview: {
        layout: { type: string; columns: number };
        components: Array<{ type: string; span: number; title?: string }>;
    };
}> {
    return CANVAS_TEMPLATES.map((t) => ({
        slug: t.slug,
        title: t.title,
        description: t.description,
        category: t.category,
        tags: t.tags,
        preview: {
            layout: {
                type: t.schemaJson.layout.type,
                columns: t.schemaJson.layout.columns
            },
            components: t.schemaJson.components.map((c) => ({
                type: c.type as string,
                span: (c.span as number) || 12,
                title: c.title as string | undefined
            }))
        }
    }));
}

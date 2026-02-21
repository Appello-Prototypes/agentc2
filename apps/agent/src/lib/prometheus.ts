import client from "prom-client";

const register = new client.Registry();

register.setDefaultLabels({ app: "agentc2-agent" });
client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["route", "method", "status"] as const,
    registers: [register]
});

export const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["route", "method"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register]
});

export const agentRunsTotal = new client.Counter({
    name: "agent_runs_total",
    help: "Total agent runs",
    labelNames: ["agent", "status", "source"] as const,
    registers: [register]
});

export const agentRunDuration = new client.Histogram({
    name: "agent_run_duration_seconds",
    help: "Agent run duration in seconds",
    labelNames: ["agent"] as const,
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [register]
});

export const mcpToolCallsTotal = new client.Counter({
    name: "mcp_tool_calls_total",
    help: "Total MCP tool calls",
    labelNames: ["server", "tool", "status"] as const,
    registers: [register]
});

export const mcpConnectionStatus = new client.Gauge({
    name: "mcp_connection_status",
    help: "MCP server connection status (1=connected, 0=disconnected)",
    labelNames: ["server"] as const,
    registers: [register]
});

export const workflowRunsTotal = new client.Counter({
    name: "workflow_runs_total",
    help: "Total workflow runs",
    labelNames: ["workflow", "status"] as const,
    registers: [register]
});

export const activeSessions = new client.Gauge({
    name: "active_sessions",
    help: "Number of active sessions",
    registers: [register]
});

export const activeSseConnections = new client.Gauge({
    name: "active_sse_connections",
    help: "Number of active SSE connections",
    registers: [register]
});

export { register };

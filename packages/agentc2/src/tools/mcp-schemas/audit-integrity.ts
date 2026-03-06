import { McpToolDefinition, McpToolRoute } from "./types";

export const auditIntegrityToolDefinitions: McpToolDefinition[] = [
    {
        name: "audit-logs-verify",
        description:
            "Verify the integrity of the audit log hash chain. Recomputes SHA-256 hashes and checks for tampering.",
        inputSchema: {
            type: "object",
            properties: {
                startDate: {
                    type: "string",
                    description: "Start date filter (ISO string)"
                },
                endDate: {
                    type: "string",
                    description: "End date filter (ISO string)"
                },
                limit: {
                    type: "number",
                    description: "Maximum entries to verify (default: 1000)"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "governance"
    }
];

export const auditIntegrityToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "audit-logs-verify",
        method: "POST",
        path: "/api/audit-logs/verify",
        bodyParams: ["startDate", "endDate", "limit"]
    }
];

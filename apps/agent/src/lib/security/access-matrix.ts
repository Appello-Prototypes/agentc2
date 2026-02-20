export type AccessLevel = "public" | "authenticated" | "member" | "admin" | "owner";

export const MCP_TOOL_ACCESS: Array<{ pattern: RegExp; minAccess: AccessLevel }> = [
    {
        pattern:
            /^(agent-delete|workflow-delete|network-delete|destroy-resource|teardown-compute)$/i,
        minAccess: "admin"
    },
    {
        pattern:
            /^(agent-create|agent-update|workflow-create|workflow-update|network-create|network-update)$/i,
        minAccess: "admin"
    },
    {
        pattern: /^(execute-code|remote-execute|remote-file-transfer|provision-compute)$/i,
        minAccess: "admin"
    },
    { pattern: /^agent\./, minAccess: "member" },
    { pattern: /^instance\./, minAccess: "member" },
    { pattern: /^workflow-/, minAccess: "member" },
    { pattern: /^network-/, minAccess: "member" }
];

export function resolveRequiredToolAccess(toolName: string): AccessLevel {
    const match = MCP_TOOL_ACCESS.find((entry) => entry.pattern.test(toolName));
    return match?.minAccess ?? "member";
}

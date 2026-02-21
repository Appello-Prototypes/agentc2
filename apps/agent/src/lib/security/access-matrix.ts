export type AccessLevel = "public" | "authenticated" | "member" | "admin" | "owner";

export type ToolPermissionCategory = "read" | "write" | "spend";

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

/**
 * Maps tool IDs to default permission categories.
 * "read" — search, list, get operations (low risk)
 * "write" — create, update, delete operations (medium risk)
 * "spend" — financial tools that incur real-world cost (high risk)
 */
export const TOOL_PERMISSION_CATEGORIES: Array<{
    pattern: RegExp;
    category: ToolPermissionCategory;
}> = [
    // Spend — financial tools
    {
        pattern: /^(stripe-acs-|coinbase\.|record-outcome)/i,
        category: "spend"
    },
    // Write — mutation tools
    {
        pattern:
            /^(agent-create|agent-update|agent-delete|workflow-create|workflow-update|workflow-delete|network-create|network-update|network-delete|document-create|document-update|document-delete|skill-create|skill-update|skill-delete|execute-code|write-workspace-file|gmail-send-email|gmail-draft-email|outlook-mail-send-email|teams-send-|dropbox-upload-file)/i,
        category: "write"
    },
    // Read — everything else defaults to read
    { pattern: /.*/, category: "read" }
];

export function resolveRequiredToolAccess(toolName: string): AccessLevel {
    const match = MCP_TOOL_ACCESS.find((entry) => entry.pattern.test(toolName));
    return match?.minAccess ?? "member";
}

export function resolveToolPermissionCategory(toolName: string): ToolPermissionCategory {
    const match = TOOL_PERMISSION_CATEGORIES.find((entry) => entry.pattern.test(toolName));
    return match?.category ?? "read";
}

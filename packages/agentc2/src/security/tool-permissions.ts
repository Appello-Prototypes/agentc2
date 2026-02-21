import { prisma } from "@repo/database";

export type ToolPermission = "read_only" | "write" | "spend" | "full";

export interface ToolPermissionResult {
    allowed: boolean;
    permission: ToolPermission;
    maxCostUsd: number | null;
    source: "override" | "default";
    reason?: string;
}

/**
 * Check if an agent has permission to use a specific tool.
 * First checks per-agent DB overrides, then falls back to default category mapping.
 */
export async function checkToolPermission(
    agentId: string,
    toolId: string,
    requiredCategory: "read" | "write" | "spend"
): Promise<ToolPermissionResult> {
    const override = await prisma.agentToolPermission.findUnique({
        where: { agentId_toolId: { agentId, toolId } }
    });

    if (override) {
        const permission = override.permission as ToolPermission;
        const allowed = isPermissionSufficient(permission, requiredCategory);
        return {
            allowed,
            permission,
            maxCostUsd: override.maxCostUsd,
            source: "override",
            reason: allowed
                ? undefined
                : `Tool permission '${permission}' insufficient for '${requiredCategory}' operation`
        };
    }

    // No override — default to "full" (existing behavior, no restrictions)
    return {
        allowed: true,
        permission: "full",
        maxCostUsd: null,
        source: "default"
    };
}

function isPermissionSufficient(
    permission: ToolPermission,
    requiredCategory: "read" | "write" | "spend"
): boolean {
    if (permission === "full") return true;
    if (permission === "spend") return true;
    if (permission === "write" && requiredCategory !== "spend") return true;
    if (permission === "read_only" && requiredCategory === "read") return true;
    return false;
}

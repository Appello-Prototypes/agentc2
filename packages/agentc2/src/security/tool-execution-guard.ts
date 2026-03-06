/**
 * Tool Execution Guard
 *
 * Wraps each tool's execute function with permission and egress checks,
 * wiring the previously dead-code checkToolPermission() and checkEgressPermission()
 * into the live execution path.
 */

import { checkToolPermission, type ToolPermissionResult } from "./tool-permissions";
import { checkEgressPermission, type EgressCheckResult } from "./egress-control";
import { toolBehaviorMap } from "../tools/registry";

export interface GuardedToolResult {
    toolsGuarded: number;
    permissionChecksWired: string[];
}

/**
 * Wrap every tool in the record so that each execute() call first checks:
 *   1. checkToolPermission — does this agent have the right permission level?
 *   2. checkEgressPermission — is the target domain allowed by the org's egress policy?
 *
 * If a check fails, the tool returns a structured error string instead of executing,
 * allowing the agent to self-correct (choose another tool) rather than hard-crashing.
 */
export function wrapToolsWithPermissionGuard(
    tools: Record<string, any>,
    agentId: string,
    organizationId?: string
): GuardedToolResult {
    const guarded: string[] = [];

    for (const [toolId, tool] of Object.entries(tools)) {
        if (!tool || typeof tool.execute !== "function") continue;

        const originalExecute = tool.execute.bind(tool);
        const behavior = toolBehaviorMap[toolId];
        const requiredCategory: "read" | "write" | "spend" =
            behavior?.behavior === "mutation" ? "write" : "read";

        tool.execute = async (context: any) => {
            // 1. Permission check (fail-closed: deny on error)
            let permResult: ToolPermissionResult;
            try {
                permResult = await checkToolPermission(agentId, toolId, requiredCategory);
            } catch (err) {
                console.error(`[ToolGuard] Permission check error for "${toolId}", denying:`, err);
                permResult = {
                    allowed: false,
                    permission: "read_only",
                    maxCostUsd: null,
                    source: "default",
                    reason: "Permission check failed — denying by default"
                };
            }

            if (!permResult.allowed) {
                const msg = `[TOOL BLOCKED] Permission denied for "${toolId}": ${permResult.reason}`;
                console.warn(`[ToolGuard] ${msg}`);
                return { error: msg };
            }

            // 2. Egress check — only if org has an egress policy and tool args contain a URL-like value
            if (organizationId) {
                const targetUrl = extractUrlFromArgs(context);
                if (targetUrl) {
                    // Egress check (fail-closed: deny on error)
                    let egressResult: EgressCheckResult;
                    try {
                        egressResult = await checkEgressPermission(organizationId, targetUrl);
                    } catch (err) {
                        console.error(
                            `[ToolGuard] Egress check error for "${toolId}", denying:`,
                            err
                        );
                        egressResult = {
                            allowed: false,
                            reason: "Egress check failed — denying by default"
                        };
                    }

                    if (!egressResult.allowed) {
                        const msg = `[TOOL BLOCKED] Egress denied for "${toolId}": ${egressResult.reason}`;
                        console.warn(`[ToolGuard] ${msg}`);
                        return { error: msg };
                    }
                }
            }

            return originalExecute(context);
        };

        guarded.push(toolId);
    }

    return { toolsGuarded: guarded.length, permissionChecksWired: guarded };
}

/**
 * Best-effort extraction of a URL from tool arguments for egress checking.
 * Scans common parameter names (url, href, domain, endpoint, baseUrl, targetUrl).
 */
function extractUrlFromArgs(context: any): string | null {
    if (!context) return null;

    const args = context.context || context;
    if (typeof args !== "object") return null;

    const urlKeys = ["url", "href", "domain", "endpoint", "baseUrl", "targetUrl", "target_url"];
    for (const key of urlKeys) {
        const val = args[key];
        if (typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"))) {
            return val;
        }
    }

    return null;
}

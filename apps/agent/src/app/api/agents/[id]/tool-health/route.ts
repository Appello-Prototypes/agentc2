import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { toolRegistry } from "@repo/agentc2/tools";
import { getMcpTools } from "@repo/agentc2/mcp";

/**
 * GET /api/agents/[id]/tool-health
 *
 * Returns tool health status for an agent: expected vs available tools,
 * with details on which tools are missing and why.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] },
            select: {
                id: true,
                slug: true,
                name: true,
                tenantId: true,
                metadata: true,
                tools: { select: { toolId: true } },
                skills: {
                    select: {
                        pinned: true,
                        skill: {
                            select: {
                                slug: true,
                                name: true,
                                tools: { select: { toolId: true } }
                            }
                        }
                    }
                },
                workspace: { select: { organizationId: true } }
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Collect expected tools from direct attachments
        const directToolIds = agent.tools.map((t) => t.toolId);

        // Collect expected tools from skills
        const skillToolMap: Record<string, string[]> = {};
        for (const as of agent.skills) {
            const toolIds = as.skill.tools.map((t) => t.toolId);
            if (toolIds.length > 0) {
                skillToolMap[as.skill.slug] = toolIds;
            }
        }
        const skillToolIds = Object.values(skillToolMap).flat();
        const allExpectedIds = [...new Set([...directToolIds, ...skillToolIds])];

        // Check which tools exist in the static registry
        const registryKeys = new Set(Object.keys(toolRegistry));
        const inRegistry: string[] = [];
        const notInRegistry: string[] = [];
        for (const toolId of allExpectedIds) {
            if (registryKeys.has(toolId)) {
                inRegistry.push(toolId);
            } else {
                notInRegistry.push(toolId);
            }
        }

        // Check which MCP tools are currently loadable
        const organizationId = agent.workspace?.organizationId || agent.tenantId;
        let mcpAvailable: string[] = [];
        let mcpErrors: Record<string, string> = {};
        try {
            const { tools: mcpTools, serverErrors } = await getMcpTools(
                organizationId ? { organizationId } : undefined
            );
            mcpAvailable = Object.keys(mcpTools);
            mcpErrors = serverErrors;
        } catch {
            // MCP loading failed entirely
        }

        // Classify each expected tool
        const toolStatuses: Array<{
            toolId: string;
            status: "available" | "missing" | "mcp_unavailable";
            source: string;
            reason?: string;
        }> = [];

        for (const toolId of allExpectedIds) {
            if (registryKeys.has(toolId)) {
                toolStatuses.push({ toolId, status: "available", source: "registry" });
            } else if (mcpAvailable.includes(toolId)) {
                toolStatuses.push({ toolId, status: "available", source: "mcp" });
            } else if (toolId.includes("_")) {
                // MCP-pattern tool that isn't available
                const serverName = toolId.split("_")[0] || "unknown";
                const serverError = mcpErrors[serverName];
                toolStatuses.push({
                    toolId,
                    status: "mcp_unavailable",
                    source: `mcp:${serverName}`,
                    reason: serverError || "MCP server not responding"
                });
            } else {
                toolStatuses.push({
                    toolId,
                    status: "missing",
                    source: "unknown",
                    reason: "Not found in registry or MCP servers"
                });
            }
        }

        const availableCount = toolStatuses.filter((t) => t.status === "available").length;
        const missingCount = toolStatuses.filter((t) => t.status !== "available").length;
        const healthStatus =
            missingCount === 0 ? "healthy" : missingCount <= 3 ? "warning" : "critical";

        // Check alwaysLoadedTools metadata for mismatches
        const metadata = agent.metadata as Record<string, unknown> | null;
        const alwaysLoaded = (metadata?.alwaysLoadedTools as string[]) || [];
        const allAttachedIds = new Set(allExpectedIds);
        const unattachedAlwaysLoaded = alwaysLoaded.filter((t) => !allAttachedIds.has(t));

        return NextResponse.json({
            success: true,
            data: {
                agentSlug: agent.slug,
                health: healthStatus,
                summary: {
                    total: allExpectedIds.length,
                    available: availableCount,
                    missing: missingCount,
                    registryTools: inRegistry.length,
                    mcpTools: notInRegistry.length,
                    mcpServerErrors: Object.keys(mcpErrors).length
                },
                tools: toolStatuses.filter((t) => t.status !== "available"),
                mcpServerErrors: mcpErrors,
                unattachedAlwaysLoaded,
                skillToolMap
            }
        });
    } catch (error) {
        console.error("[Tool Health] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to check tool health"
            },
            { status: 500 }
        );
    }
}

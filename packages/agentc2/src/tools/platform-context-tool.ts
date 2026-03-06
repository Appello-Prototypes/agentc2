/**
 * Platform Context Tool
 *
 * Single hyper-optimized call that returns a compact manifest of every
 * entity on the platform: agents, networks, workflows, skills, MCP servers,
 * and tool categories. Designed to eliminate slug-guessing failures by giving
 * agents accurate identifiers upfront (~6KB typical output).
 *
 * All DB queries run in parallel via Promise.all for minimum latency.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";

const DESCRIPTION_CAP = 100;

function cap(s: string | null | undefined): string {
    if (!s) return "";
    if (s.length <= DESCRIPTION_CAP) return s;
    return s.slice(0, DESCRIPTION_CAP - 1) + "…";
}

export const platformContextTool = createTool({
    id: "platform-context",
    description:
        "CALL FIRST: Returns a compact manifest of every agent, network, workflow, skill, MCP server, and tool category on the platform. " +
        "Use this to discover valid slugs/IDs before calling agent-read, network-read, network-execute, agent-invoke-dynamic, etc. " +
        "Eliminates slug-guessing failures. No parameters required.",
    inputSchema: z.object({
        includeTools: z
            .boolean()
            .optional()
            .describe(
                "Include per-category tool ID lists (default: false — only counts are returned)"
            ),
        organizationId: z.string().optional().describe("Auto-injected organization ID")
    }),
    outputSchema: z
        .object({
            agents: z.array(z.any()),
            networks: z.array(z.any()),
            workflows: z.array(z.any()),
            skills: z.array(z.any()),
            mcpServers: z.array(z.any()),
            toolCategories: z.array(z.any()),
            counts: z.object({
                agents: z.number(),
                networks: z.number(),
                workflows: z.number(),
                skills: z.number(),
                mcpServers: z.number(),
                tools: z.number()
            })
        })
        .passthrough(),
    execute: async ({ includeTools, organizationId }) => {
        const orgWhere = organizationId ? { workspace: { organizationId } } : {};
        const skillOrgWhere = organizationId
            ? { OR: [{ workspace: { organizationId } }, { type: "SYSTEM" }] }
            : {};

        const [agents, networks, workflows, skills, mcpToolDefs] = await Promise.all([
            prisma.agent.findMany({
                where: { isArchived: false, ...orgWhere },
                select: {
                    slug: true,
                    name: true,
                    description: true,
                    type: true,
                    modelProvider: true,
                    modelName: true,
                    isActive: true,
                    _count: { select: { tools: true } }
                },
                orderBy: { name: "asc" }
            }),
            prisma.network.findMany({
                where: { isArchived: false, ...orgWhere },
                select: {
                    slug: true,
                    name: true,
                    description: true,
                    isActive: true,
                    type: true,
                    _count: { select: { primitives: true } }
                },
                orderBy: { name: "asc" }
            }),
            prisma.workflow.findMany({
                where: { isArchived: false, ...orgWhere },
                select: {
                    slug: true,
                    name: true,
                    description: true,
                    isActive: true,
                    type: true
                },
                orderBy: { name: "asc" }
            }),
            prisma.skill.findMany({
                where: skillOrgWhere,
                select: {
                    slug: true,
                    name: true,
                    description: true,
                    category: true,
                    _count: { select: { tools: true, documents: true } }
                },
                orderBy: { name: "asc" }
            }),
            loadMcpServerSummary()
        ]);

        const { listAvailableTools } = await import("./registry");
        const registryTools = listAvailableTools();
        const catCounts: Record<string, string[]> = {};
        for (const t of registryTools) {
            if (!catCounts[t.category]) catCounts[t.category] = [];
            catCounts[t.category].push(t.id);
        }

        const toolCategories = Object.entries(catCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, ids]) =>
                includeTools
                    ? { category, count: ids.length, toolIds: ids }
                    : { category, count: ids.length }
            );

        return {
            agents: agents.map((a) => ({
                slug: a.slug,
                name: a.name,
                description: cap(a.description),
                type: a.type,
                model: `${a.modelProvider}/${a.modelName}`,
                active: a.isActive,
                toolCount: a._count.tools
            })),
            networks: networks.map((n) => ({
                slug: n.slug,
                name: n.name,
                description: cap(n.description),
                active: n.isActive,
                type: n.type,
                primitiveCount: n._count.primitives
            })),
            workflows: workflows.map((w) => ({
                slug: w.slug,
                name: w.name,
                description: cap(w.description),
                active: w.isActive,
                type: w.type
            })),
            skills: skills.map((s) => ({
                slug: s.slug,
                name: s.name,
                description: cap(s.description),
                category: s.category,
                toolCount: s._count.tools,
                docCount: s._count.documents
            })),
            mcpServers: mcpToolDefs,
            toolCategories,
            counts: {
                agents: agents.length,
                networks: networks.length,
                workflows: workflows.length,
                skills: skills.length,
                mcpServers: mcpToolDefs.length,
                tools: registryTools.length
            }
        };
    }
});

/**
 * Loads MCP tool definitions and groups them by server name.
 * Returns [{server, toolCount, toolNames}] — compact summary, not full definitions.
 * Falls back gracefully if MCP connections are unavailable.
 */
async function loadMcpServerSummary(): Promise<
    Array<{ server: string; toolCount: number; tools: string[] }>
> {
    try {
        const { listMcpToolDefinitions } = await import("../mcp/client");
        const { definitions } = await listMcpToolDefinitions();
        const byServer: Record<string, string[]> = {};
        for (const def of definitions) {
            if (!byServer[def.server]) byServer[def.server] = [];
            byServer[def.server].push(def.name);
        }
        return Object.entries(byServer)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([server, tools]) => ({ server, toolCount: tools.length, tools }));
    } catch {
        return [];
    }
}

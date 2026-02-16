import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma, Prisma } from "@repo/database";
import { agentResolver } from "@repo/mastra/agents";
import { auth } from "@repo/auth";
import { getDefaultWorkspaceIdForUser, getUserOrganizationId } from "@/lib/organization";
import { authenticateRequest } from "@/lib/api-auth";

// Feature flag for using new Agent model vs legacy StoredAgent
// Default to true for the new database-driven agents
const USE_DB_AGENTS = process.env.FEATURE_DB_AGENTS !== "false";

/**
 * Generate a URL-safe slug from a name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Generate a unique agent slug within a workspace, appending a numeric suffix if the base slug already exists.
 * e.g. "general-assistant" -> "general-assistant-2" -> "general-assistant-3"
 */
async function generateUniqueAgentSlug(base: string, workspaceId?: string | null): Promise<string> {
    let slug = base;
    let suffix = 2;
    while (
        await prisma.agent.findFirst({
            where: { slug, ...(workspaceId ? { workspaceId } : {}) }
        })
    ) {
        slug = `${base}-${suffix}`;
        suffix++;
    }
    return slug;
}

/**
 * GET /api/agents
 *
 * List all agents (SYSTEM + user's own)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get("active") !== "false";
        const systemOnly = searchParams.get("system") === "true";

        if (USE_DB_AGENTS) {
            // Support both API key and session cookie authentication
            const apiAuth = await authenticateRequest(request);
            let userId = apiAuth?.userId;

            if (!userId) {
                const session = await auth.api.getSession({
                    headers: await headers()
                });
                userId = session?.user?.id;
            }

            // Use new Agent model via AgentResolver
            const agents = systemOnly
                ? await agentResolver.listSystem()
                : await agentResolver.listForUser(userId);

            // When ?detail=capabilities, include pinned/discoverable skill breakdown
            const detailMode = searchParams.get("detail");
            let skillBreakdowns: Map<
                string,
                {
                    pinnedSkills: string[];
                    pinnedToolCount: number;
                    discoverableSkills: string[];
                    discoverableToolCount: number;
                }
            > | null = null;

            if (detailMode === "capabilities") {
                const agentIds = agents.map((a) => a.id);
                const agentSkills = await prisma.agentSkill.findMany({
                    where: { agentId: { in: agentIds } },
                    include: {
                        skill: {
                            select: { slug: true, name: true, _count: { select: { tools: true } } }
                        }
                    }
                });

                skillBreakdowns = new Map();
                for (const as of agentSkills) {
                    const existing = skillBreakdowns.get(as.agentId) || {
                        pinnedSkills: [],
                        pinnedToolCount: 0,
                        discoverableSkills: [],
                        discoverableToolCount: 0
                    };
                    if (as.pinned) {
                        existing.pinnedSkills.push(as.skill.slug);
                        existing.pinnedToolCount += as.skill._count.tools;
                    } else {
                        existing.discoverableSkills.push(as.skill.slug);
                        existing.discoverableToolCount += as.skill._count.tools;
                    }
                    skillBreakdowns.set(as.agentId, existing);
                }
            }

            return NextResponse.json({
                success: true,
                count: agents.length,
                agents: agents.map((agent) => {
                    const base = {
                        id: agent.id,
                        slug: agent.slug,
                        name: agent.name,
                        description: agent.description,
                        type: agent.type,
                        modelProvider: agent.modelProvider,
                        modelName: agent.modelName,
                        memoryEnabled: agent.memoryEnabled,
                        scorers: agent.scorers,
                        toolCount: agent.tools.length,
                        isActive: agent.isActive,
                        routingConfig: agent.routingConfig,
                        createdAt: agent.createdAt,
                        updatedAt: agent.updatedAt
                    };

                    if (skillBreakdowns) {
                        const breakdown = skillBreakdowns.get(agent.id);
                        return {
                            ...base,
                            pinnedSkills: breakdown?.pinnedSkills || [],
                            pinnedToolCount: (breakdown?.pinnedToolCount || 0) + agent.tools.length,
                            discoverableSkills: breakdown?.discoverableSkills || [],
                            discoverableToolCount: breakdown?.discoverableToolCount || 0,
                            runtimeToolCount: (breakdown?.pinnedToolCount || 0) + agent.tools.length
                        };
                    }
                    return base;
                }),
                source: "database"
            });
        }

        // Legacy: Use StoredAgent model
        const where = activeOnly ? { isActive: true } : {};

        const agents = await prisma.storedAgent.findMany({
            where,
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            count: agents.length,
            agents,
            source: "legacy"
        });
    } catch (error) {
        console.error("[Agents List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list agents"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents
 *
 * Create a new agent (USER type)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const session = await auth.api.getSession({
            headers: await headers()
        });
        const workspaceId = session?.user
            ? await getDefaultWorkspaceIdForUser(session.user.id)
            : null;
        const organizationId = session?.user ? await getUserOrganizationId(session.user.id) : null;

        // Validate required fields
        const { name, instructions, modelProvider, modelName } = body;
        if (!name || !instructions || !modelProvider || !modelName) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: name, instructions, modelProvider, modelName"
                },
                { status: 400 }
            );
        }

        if (USE_DB_AGENTS) {
            // Use new Agent model
            const baseSlug = body.slug || generateSlug(name);
            const slug = await generateUniqueAgentSlug(baseSlug, workspaceId);

            // Build modelConfig from extended thinking settings
            const modelConfigBase = (body.modelConfig as Record<string, unknown> | null) || {};
            if (body.extendedThinking) {
                modelConfigBase.thinking = {
                    type: "enabled",
                    budget_tokens: body.thinkingBudget || 10000
                };
            }
            if (body.parallelToolCalls !== undefined) {
                modelConfigBase.parallelToolCalls = body.parallelToolCalls;
            }
            if (body.reasoningEffort) {
                modelConfigBase.reasoningEffort = body.reasoningEffort;
            }
            if (body.cacheControl) {
                modelConfigBase.cacheControl = { type: "ephemeral" };
            }
            if (body.toolChoice) {
                modelConfigBase.toolChoice = body.toolChoice;
            }
            if (body.reasoning) {
                modelConfigBase.reasoning = body.reasoning;
            }
            const modelConfig =
                Object.keys(modelConfigBase).length > 0
                    ? (modelConfigBase as Prisma.InputJsonValue)
                    : Prisma.DbNull;

            // Create the agent
            const agent = await prisma.agent.create({
                data: {
                    slug,
                    name,
                    description: body.description || null,
                    instructions,
                    instructionsTemplate: body.instructionsTemplate || null,
                    modelProvider,
                    modelName,
                    temperature: body.temperature ?? 0.7,
                    maxTokens: body.maxTokens || null,
                    modelConfig,
                    memoryEnabled: body.memoryEnabled ?? body.memory ?? false,
                    memoryConfig: body.memoryConfig ?? Prisma.DbNull,
                    maxSteps: body.maxSteps ?? 5,
                    subAgents: body.subAgents || [],
                    workflows: body.workflows || [],
                    scorers: body.scorers || [],
                    type: "USER",
                    tenantId: organizationId,
                    workspaceId,
                    isPublic: body.isPublic ?? false,
                    metadata: body.metadata ?? Prisma.DbNull,
                    isActive: body.isActive ?? true
                },
                include: { tools: true }
            });

            // Create tool associations if provided
            if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
                await prisma.agentTool.createMany({
                    data: body.tools.map((toolId: string) => ({
                        agentId: agent.id,
                        toolId
                    }))
                });
            }

            // Fetch agent with tools
            const agentWithTools = await prisma.agent.findUnique({
                where: { id: agent.id },
                include: { tools: true }
            });

            return NextResponse.json({
                success: true,
                agent: agentWithTools,
                source: "database"
            });
        }

        // Legacy: Use StoredAgent model
        const agent = await prisma.storedAgent.create({
            data: {
                name,
                description: body.description || null,
                instructions,
                modelProvider,
                modelName,
                temperature: body.temperature ?? 0.7,
                tools: body.tools || [],
                memory: body.memory || false,
                metadata: body.metadata || null,
                isActive: body.isActive ?? true
            }
        });

        return NextResponse.json({
            success: true,
            agent,
            source: "legacy"
        });
    } catch (error) {
        console.error("[Agents Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create agent"
            },
            { status: 500 }
        );
    }
}

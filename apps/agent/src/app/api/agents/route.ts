import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { agentResolver } from "@repo/mastra";

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
            // Use new Agent model via AgentResolver
            const agents = systemOnly
                ? await agentResolver.listSystem()
                : await agentResolver.listForUser();

            return NextResponse.json({
                success: true,
                count: agents.length,
                agents: agents.map((agent) => ({
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
                    createdAt: agent.createdAt,
                    updatedAt: agent.updatedAt
                })),
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
            const slug = body.slug || generateSlug(name);

            // Check if slug already exists
            const existing = await prisma.agent.findUnique({
                where: { slug }
            });

            if (existing) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Agent with slug '${slug}' already exists`
                    },
                    { status: 409 }
                );
            }

            // Build modelConfig from extended thinking settings
            let modelConfig = body.modelConfig || null;
            if (body.extendedThinking) {
                modelConfig = {
                    ...modelConfig,
                    thinking: {
                        type: "enabled",
                        budget_tokens: body.thinkingBudget || 10000
                    }
                };
            }

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
                    memoryConfig: body.memoryConfig || null,
                    maxSteps: body.maxSteps ?? 5,
                    scorers: body.scorers || [],
                    type: "USER",
                    isPublic: body.isPublic ?? false,
                    metadata: body.metadata || null,
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

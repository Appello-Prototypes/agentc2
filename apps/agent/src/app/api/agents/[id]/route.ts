import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

// Feature flag for using new Agent model vs legacy StoredAgent
// Default to true for the new database-driven agents
const USE_DB_AGENTS = process.env.FEATURE_DB_AGENTS !== "false";

/**
 * GET /api/agents/[id]
 *
 * Get a specific agent by ID or slug
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        if (USE_DB_AGENTS) {
            // Try to find by slug first, then by id
            const agent = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: id }, { id: id }]
                },
                include: { tools: true }
            });

            if (!agent) {
                return NextResponse.json(
                    { success: false, error: `Agent '${id}' not found` },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                agent,
                source: "database"
            });
        }

        // Legacy: Use StoredAgent model
        const agent = await prisma.storedAgent.findUnique({
            where: { id }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            agent,
            source: "legacy"
        });
    } catch (error) {
        console.error("[Agent Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get agent"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/agents/[id]
 *
 * Update an agent (USER type only - SYSTEM agents are protected)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        if (USE_DB_AGENTS) {
            // Find agent by slug or id
            const existing = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: id }, { id: id }]
                },
                include: { tools: true }
            });

            if (!existing) {
                return NextResponse.json(
                    { success: false, error: `Agent '${id}' not found` },
                    { status: 404 }
                );
            }

            // Build update data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: any = {};

            if (body.name !== undefined) updateData.name = body.name;
            if (body.description !== undefined) updateData.description = body.description;
            if (body.instructions !== undefined) updateData.instructions = body.instructions;
            if (body.instructionsTemplate !== undefined)
                updateData.instructionsTemplate = body.instructionsTemplate;
            if (body.modelProvider !== undefined) updateData.modelProvider = body.modelProvider;
            if (body.modelName !== undefined) updateData.modelName = body.modelName;
            if (body.temperature !== undefined) updateData.temperature = body.temperature;
            if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
            if (body.subAgents !== undefined) updateData.subAgents = body.subAgents;
            if (body.workflows !== undefined) updateData.workflows = body.workflows;

            const hasModelConfigUpdate =
                body.extendedThinking !== undefined ||
                body.modelConfig !== undefined ||
                body.parallelToolCalls !== undefined ||
                body.reasoningEffort !== undefined ||
                body.cacheControl !== undefined ||
                body.toolChoice !== undefined ||
                body.reasoning !== undefined;

            if (hasModelConfigUpdate) {
                const baseConfig =
                    (body.modelConfig !== undefined
                        ? (body.modelConfig as Record<string, unknown> | null)
                        : (existing.modelConfig as Record<string, unknown> | null)) || {};
                const nextConfig: Record<string, unknown> = { ...baseConfig };

                if (body.extendedThinking !== undefined) {
                    if (body.extendedThinking) {
                        nextConfig.thinking = {
                            type: "enabled",
                            budget_tokens: body.thinkingBudget || 10000
                        };
                    } else {
                        delete nextConfig.thinking;
                    }
                }

                if (body.parallelToolCalls !== undefined) {
                    nextConfig.parallelToolCalls = body.parallelToolCalls;
                }

                if (body.reasoningEffort !== undefined) {
                    if (body.reasoningEffort) {
                        nextConfig.reasoningEffort = body.reasoningEffort;
                    } else {
                        delete nextConfig.reasoningEffort;
                    }
                }

                if (body.cacheControl !== undefined) {
                    if (body.cacheControl) {
                        nextConfig.cacheControl = { type: "ephemeral" };
                    } else {
                        delete nextConfig.cacheControl;
                    }
                }

                if (body.toolChoice !== undefined) {
                    if (body.toolChoice) {
                        nextConfig.toolChoice = body.toolChoice;
                    } else {
                        delete nextConfig.toolChoice;
                    }
                }

                if (body.reasoning !== undefined) {
                    if (body.reasoning) {
                        nextConfig.reasoning = body.reasoning;
                    } else {
                        delete nextConfig.reasoning;
                    }
                }

                updateData.modelConfig = Object.keys(nextConfig).length > 0 ? nextConfig : null;
            }

            if (body.memoryEnabled !== undefined) updateData.memoryEnabled = body.memoryEnabled;
            if (body.memoryConfig !== undefined) updateData.memoryConfig = body.memoryConfig;
            if (body.maxSteps !== undefined) updateData.maxSteps = body.maxSteps;
            if (body.scorers !== undefined) updateData.scorers = body.scorers;
            if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
            if (body.metadata !== undefined) updateData.metadata = body.metadata;
            if (body.isActive !== undefined) updateData.isActive = body.isActive;

            // Detect changes and build changesJson for version history
            const changes: string[] = [];

            if (body.name !== undefined && body.name !== existing.name) {
                changes.push(`Name: "${existing.name}" → "${body.name}"`);
            }
            if (body.description !== undefined && body.description !== existing.description) {
                changes.push("Updated description");
            }
            if (body.instructions !== undefined && body.instructions !== existing.instructions) {
                changes.push("Updated instructions");
            }
            if (body.modelProvider !== undefined && body.modelProvider !== existing.modelProvider) {
                changes.push(`Provider: ${existing.modelProvider} → ${body.modelProvider}`);
            }
            if (body.modelName !== undefined && body.modelName !== existing.modelName) {
                changes.push(`Model: ${existing.modelName} → ${body.modelName}`);
            }
            if (body.temperature !== undefined && body.temperature !== existing.temperature) {
                changes.push(`Temperature: ${existing.temperature} → ${body.temperature}`);
            }
            if (body.maxTokens !== undefined && body.maxTokens !== existing.maxTokens) {
                changes.push(
                    `Max tokens: ${existing.maxTokens || "default"} → ${body.maxTokens || "default"}`
                );
            }
            if (body.maxSteps !== undefined && body.maxSteps !== existing.maxSteps) {
                changes.push(`Max steps: ${existing.maxSteps} → ${body.maxSteps}`);
            }
            if (body.memoryEnabled !== undefined && body.memoryEnabled !== existing.memoryEnabled) {
                changes.push(
                    `Memory: ${existing.memoryEnabled ? "enabled" : "disabled"} → ${body.memoryEnabled ? "enabled" : "disabled"}`
                );
            }
            if (body.memoryConfig !== undefined) {
                changes.push("Updated memory configuration");
            }
            if (body.subAgents !== undefined) {
                const existingSubAgents = existing.subAgents || [];
                const newSubAgents = body.subAgents || [];
                if (
                    JSON.stringify(existingSubAgents.sort()) !== JSON.stringify(newSubAgents.sort())
                ) {
                    changes.push(
                        `Sub-agents: ${existingSubAgents.length} → ${newSubAgents.length}`
                    );
                }
            }
            if (body.workflows !== undefined) {
                const existingWorkflows = existing.workflows || [];
                const newWorkflows = body.workflows || [];
                if (
                    JSON.stringify(existingWorkflows.sort()) !== JSON.stringify(newWorkflows.sort())
                ) {
                    changes.push(`Workflows: ${existingWorkflows.length} → ${newWorkflows.length}`);
                }
            }
            if (body.scorers !== undefined) {
                const existingScorers = existing.scorers || [];
                const newScorers = body.scorers || [];
                if (JSON.stringify(existingScorers.sort()) !== JSON.stringify(newScorers.sort())) {
                    changes.push(`Scorers: ${existingScorers.length} → ${newScorers.length}`);
                }
            }
            if (body.tools !== undefined && Array.isArray(body.tools)) {
                const existingToolIds = existing.tools.map((t) => t.toolId).sort();
                const newToolIds = [...body.tools].sort();
                if (JSON.stringify(existingToolIds) !== JSON.stringify(newToolIds)) {
                    changes.push(`Tools: ${existingToolIds.length} → ${newToolIds.length}`);
                }
            }
            if (body.extendedThinking !== undefined) {
                const existingThinking =
                    (existing.modelConfig as { thinking?: { type: string } })?.thinking?.type ===
                    "enabled";
                if (body.extendedThinking !== existingThinking) {
                    changes.push(
                        `Extended thinking: ${existingThinking ? "enabled" : "disabled"} → ${body.extendedThinking ? "enabled" : "disabled"}`
                    );
                }
            }
            if (body.parallelToolCalls !== undefined) {
                const existingParallel = (existing.modelConfig as { parallelToolCalls?: boolean })
                    ?.parallelToolCalls;
                if (body.parallelToolCalls !== existingParallel) {
                    changes.push("Parallel tool calling updated");
                }
            }
            if (body.reasoningEffort !== undefined) {
                const existingEffort = (existing.modelConfig as { reasoningEffort?: string })
                    ?.reasoningEffort;
                if (body.reasoningEffort !== existingEffort) {
                    changes.push("Reasoning effort updated");
                }
            }
            if (body.cacheControl !== undefined) {
                const existingCache =
                    (existing.modelConfig as { cacheControl?: { type?: string } })?.cacheControl
                        ?.type === "ephemeral";
                if (body.cacheControl !== existingCache) {
                    changes.push("Prompt cache control updated");
                }
            }
            if (body.toolChoice !== undefined) {
                const existingToolChoice = (existing.modelConfig as { toolChoice?: string })
                    ?.toolChoice;
                if (body.toolChoice !== existingToolChoice) {
                    changes.push("Tool choice updated");
                }
            }
            if (body.isActive !== undefined && body.isActive !== existing.isActive) {
                changes.push(
                    `Status: ${existing.isActive ? "active" : "inactive"} → ${body.isActive ? "active" : "inactive"}`
                );
            }
            if (body.isPublic !== undefined && body.isPublic !== existing.isPublic) {
                changes.push(
                    `Visibility: ${existing.isPublic ? "public" : "private"} → ${body.isPublic ? "public" : "private"}`
                );
            }

            // Create version snapshot if there are actual changes
            if (changes.length > 0) {
                // Get the next version number from AgentVersion table
                const lastVersion = await prisma.agentVersion.findFirst({
                    where: { agentId: existing.id },
                    orderBy: { version: "desc" },
                    select: { version: true }
                });
                const nextVersion = (lastVersion?.version || 0) + 1;

                // Build full snapshot of current state (before changes)
                const snapshot = {
                    name: existing.name,
                    description: existing.description,
                    instructions: existing.instructions,
                    instructionsTemplate: existing.instructionsTemplate,
                    modelProvider: existing.modelProvider,
                    modelName: existing.modelName,
                    temperature: existing.temperature,
                    maxTokens: existing.maxTokens,
                    modelConfig: existing.modelConfig,
                    memoryEnabled: existing.memoryEnabled,
                    memoryConfig: existing.memoryConfig,
                    maxSteps: existing.maxSteps,
                    subAgents: existing.subAgents,
                    workflows: existing.workflows,
                    scorers: existing.scorers,
                    tools: existing.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
                    isPublic: existing.isPublic,
                    isActive: existing.isActive,
                    metadata: existing.metadata
                };

                // Create version record
                await prisma.agentVersion.create({
                    data: {
                        agentId: existing.id,
                        tenantId: existing.tenantId,
                        version: nextVersion,
                        description:
                            changes.length === 1
                                ? changes[0]
                                : `${changes.length} configuration changes`,
                        instructions: existing.instructions,
                        modelProvider: existing.modelProvider,
                        modelName: existing.modelName,
                        changesJson: changes,
                        snapshot,
                        createdBy: body.createdBy || null
                    }
                });

                // Add version to updateData
                updateData.version = nextVersion;
            }

            // Update agent
            await prisma.agent.update({
                where: { id: existing.id },
                data: updateData
            });

            // Update tools if provided
            if (body.tools !== undefined && Array.isArray(body.tools)) {
                // Delete existing tools
                await prisma.agentTool.deleteMany({
                    where: { agentId: existing.id }
                });

                // Create new tools
                if (body.tools.length > 0) {
                    await prisma.agentTool.createMany({
                        data: body.tools.map((toolId: string) => ({
                            agentId: existing.id,
                            toolId
                        }))
                    });
                }
            }

            // Fetch updated agent with tools
            const updatedAgent = await prisma.agent.findUnique({
                where: { id: existing.id },
                include: { tools: true }
            });

            return NextResponse.json({
                success: true,
                agent: updatedAgent,
                source: "database"
            });
        }

        // Legacy: Use StoredAgent model
        const existing = await prisma.storedAgent.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Build update data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.instructions !== undefined) updateData.instructions = body.instructions;
        if (body.modelProvider !== undefined) updateData.modelProvider = body.modelProvider;
        if (body.modelName !== undefined) updateData.modelName = body.modelName;
        if (body.temperature !== undefined) updateData.temperature = body.temperature;
        if (body.tools !== undefined) updateData.tools = body.tools;
        if (body.memory !== undefined) updateData.memory = body.memory;
        if (body.metadata !== undefined) updateData.metadata = body.metadata;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;

        const agent = await prisma.storedAgent.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            agent,
            source: "legacy"
        });
    } catch (error) {
        console.error("[Agent Update] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update agent"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]
 *
 * Delete an agent (USER type only - SYSTEM agents are protected)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (USE_DB_AGENTS) {
            // Find agent by slug or id
            const existing = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: id }, { id: id }]
                }
            });

            if (!existing) {
                return NextResponse.json(
                    { success: false, error: `Agent '${id}' not found` },
                    { status: 404 }
                );
            }

            // SYSTEM agents cannot be deleted
            if (existing.type === "SYSTEM") {
                return NextResponse.json(
                    {
                        success: false,
                        error: "SYSTEM agents cannot be deleted"
                    },
                    { status: 403 }
                );
            }

            await prisma.agent.delete({
                where: { id: existing.id }
            });

            return NextResponse.json({
                success: true,
                message: `Agent '${id}' deleted`,
                source: "database"
            });
        }

        // Legacy: Use StoredAgent model
        const existing = await prisma.storedAgent.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        await prisma.storedAgent.delete({
            where: { id }
        });

        return NextResponse.json({
            success: true,
            message: `Agent '${id}' deleted`,
            source: "legacy"
        });
    } catch (error) {
        console.error("[Agent Delete] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete agent"
            },
            { status: 500 }
        );
    }
}

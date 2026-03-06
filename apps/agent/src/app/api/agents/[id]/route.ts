import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { validateModelSelection } from "@repo/agentc2/agents";
import type { ModelProvider } from "@repo/agentc2/agents";
import { recordActivity } from "@repo/agentc2/activity/service";
import {
    createChangeLog,
    detectScalarChange,
    detectJsonChange,
    detectArrayChange,
    type FieldChange
} from "@/lib/changelog";
import { requireAgentAccess, requireAuth } from "@/lib/authz";
import { requireEntityAccess } from "@/lib/authz/require-entity-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";

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
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) {
            return accessResult.response;
        }

        if (USE_DB_AGENTS) {
            // Try to find by slug first, then by id
            const agent = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: id }, { id: id }]
                },
                include: {
                    tools: true,
                    skills: {
                        include: {
                            skill: {
                                select: {
                                    id: true,
                                    slug: true,
                                    name: true,
                                    description: true,
                                    category: true,
                                    version: true,
                                    _count: {
                                        select: {
                                            tools: true,
                                            documents: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
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
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }

        const rateKey = `orgMutation:agent:${authResult.context.organizationId}`;
        const rate = await checkRateLimit(rateKey, RATE_LIMIT_POLICIES.orgMutation);
        if (!rate.allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        const updateAccess = await requireEntityAccess(
            authResult.context.userId,
            authResult.context.organizationId,
            "update"
        );
        if (!updateAccess.allowed) return updateAccess.response;
        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) {
            return accessResult.response;
        }
        const body = await request.json();

        if (USE_DB_AGENTS) {
            // Find agent by slug or id
            const existing = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: id }, { id: id }]
                },
                include: {
                    tools: true,
                    skills: {
                        include: {
                            skill: { select: { id: true, slug: true, name: true, version: true } }
                        }
                    }
                }
            });

            if (!existing) {
                return NextResponse.json(
                    { success: false, error: `Agent '${id}' not found` },
                    { status: 404 }
                );
            }

            // Enforce unique agent names within the org
            if (body.name !== undefined && body.name !== existing.name) {
                const orgId = authResult.context.organizationId;
                if (orgId) {
                    const nameConflict = await prisma.agent.findFirst({
                        where: {
                            name: body.name,
                            id: { not: existing.id },
                            workspace: { organizationId: orgId }
                        },
                        select: { id: true }
                    });
                    if (nameConflict) {
                        return NextResponse.json(
                            {
                                success: false,
                                error: `An agent named "${body.name}" already exists in this organization`
                            },
                            { status: 409 }
                        );
                    }
                }
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

            // Validate model when provider or model name is being changed
            const effectiveProvider = (body.modelProvider ?? existing.modelProvider) as string;
            const effectiveModel = (body.modelName ?? existing.modelName) as string;
            if (body.modelProvider !== undefined || body.modelName !== undefined) {
                const modelValidation = await validateModelSelection(
                    effectiveProvider as ModelProvider,
                    effectiveModel,
                    authResult.context.organizationId
                );
                if (!modelValidation.valid) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: modelValidation.message,
                            suggestion: modelValidation.suggestion
                        },
                        { status: 400 }
                    );
                }
            }
            if (body.temperature !== undefined) updateData.temperature = body.temperature;
            if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
            if (body.subAgents !== undefined) updateData.subAgents = body.subAgents;
            if (body.workflows !== undefined) updateData.workflows = body.workflows;

            const hasModelConfigUpdate =
                body.modelConfig !== undefined ||
                body.extendedThinking !== undefined ||
                body.parallelToolCalls !== undefined ||
                body.reasoningEffort !== undefined ||
                body.cacheControl !== undefined ||
                body.toolChoice !== undefined ||
                body.reasoning !== undefined;

            if (hasModelConfigUpdate) {
                // When body.modelConfig is provided directly (new UI sends complete
                // provider-keyed config), use it as the base. Otherwise fall back to
                // the existing DB value and apply flat-field overrides for backward
                // compatibility (MCP tools, legacy clients).
                const isFullConfigProvided = body.modelConfig !== undefined;
                const baseConfig = isFullConfigProvided
                    ? (body.modelConfig as Record<string, unknown> | null) || {}
                    : { ...((existing.modelConfig as Record<string, unknown> | null) || {}) };

                const nextConfig: Record<string, unknown> = { ...baseConfig };

                // Backward-compatible flat field overrides (for MCP tools / legacy clients).
                // These normalize into provider-keyed format.
                if (!isFullConfigProvided) {
                    const provider = body.modelProvider || existing.modelProvider || "";

                    if (body.extendedThinking !== undefined) {
                        const providerCfg = (nextConfig[provider] as Record<string, unknown>) ?? {};
                        if (body.extendedThinking) {
                            providerCfg.thinking = {
                                type: "enabled",
                                budgetTokens: body.thinkingBudget || 10000
                            };
                        } else {
                            delete providerCfg.thinking;
                        }
                        nextConfig[provider] = providerCfg;
                    }

                    if (body.parallelToolCalls !== undefined && provider === "openai") {
                        const providerCfg = (nextConfig.openai as Record<string, unknown>) ?? {};
                        providerCfg.parallelToolCalls = body.parallelToolCalls;
                        nextConfig.openai = providerCfg;
                    }

                    if (body.reasoningEffort !== undefined && provider === "openai") {
                        const providerCfg = (nextConfig.openai as Record<string, unknown>) ?? {};
                        if (body.reasoningEffort) {
                            providerCfg.reasoningEffort = body.reasoningEffort;
                        } else {
                            delete providerCfg.reasoningEffort;
                        }
                        nextConfig.openai = providerCfg;
                    }

                    if (body.cacheControl !== undefined && provider === "anthropic") {
                        const providerCfg = (nextConfig.anthropic as Record<string, unknown>) ?? {};
                        if (body.cacheControl) {
                            providerCfg.cacheControl = { type: "ephemeral" };
                        } else {
                            delete providerCfg.cacheControl;
                        }
                        nextConfig.anthropic = providerCfg;
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
                }

                // Strip deprecated flat fields on every save
                delete nextConfig.thinking;
                delete nextConfig.parallelToolCalls;
                delete nextConfig.reasoningEffort;
                delete nextConfig.cacheControl;

                updateData.modelConfig = Object.keys(nextConfig).length > 0 ? nextConfig : null;
            }

            if (body.routingConfig !== undefined) updateData.routingConfig = body.routingConfig;
            if (body.memoryEnabled !== undefined) updateData.memoryEnabled = body.memoryEnabled;
            if (body.memoryConfig !== undefined) updateData.memoryConfig = body.memoryConfig;
            if (body.contextConfig !== undefined) updateData.contextConfig = body.contextConfig;
            if (body.maxSteps !== undefined) updateData.maxSteps = body.maxSteps;
            if (body.visibility !== undefined) {
                updateData.visibility = body.visibility;
                if (body.visibility === "PUBLIC" && !existing.publicToken) {
                    updateData.publicToken = randomUUID();
                }
            }
            if (body.metadata !== undefined) updateData.metadata = body.metadata;
            if (body.isActive !== undefined) updateData.isActive = body.isActive;
            if (body.deploymentMode !== undefined) updateData.deploymentMode = body.deploymentMode;

            // Detect changes and build changesJson for version history
            // Use deep comparison for JSON fields with sorted keys to avoid false positives/negatives
            const sortedStringify = (val: unknown): string =>
                JSON.stringify(val, (_, v) =>
                    v && typeof v === "object" && !Array.isArray(v)
                        ? Object.keys(v)
                              .sort()
                              .reduce(
                                  (acc, key) => {
                                      acc[key] = v[key];
                                      return acc;
                                  },
                                  {} as Record<string, unknown>
                              )
                        : v
                );
            const jsonEqual = (a: unknown, b: unknown): boolean =>
                sortedStringify(a) === sortedStringify(b);

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
            if (
                body.memoryConfig !== undefined &&
                !jsonEqual(body.memoryConfig, existing.memoryConfig)
            ) {
                changes.push("Updated memory configuration");
            }
            if (
                body.contextConfig !== undefined &&
                !jsonEqual(body.contextConfig, existing.contextConfig)
            ) {
                changes.push("Updated context management configuration");
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
            if (body.tools !== undefined && Array.isArray(body.tools)) {
                const existingToolIds = existing.tools.map((t) => t.toolId).sort();
                const newToolIds = [...body.tools].sort();
                if (JSON.stringify(existingToolIds) !== JSON.stringify(newToolIds)) {
                    changes.push(`Tools: ${existingToolIds.length} → ${newToolIds.length}`);
                }
            }
            if (body.metadata !== undefined && !jsonEqual(body.metadata, existing.metadata)) {
                changes.push("Updated metadata");
            }
            if (
                body.routingConfig !== undefined &&
                !jsonEqual(body.routingConfig, existing.routingConfig)
            ) {
                const rc = body.routingConfig as { mode?: string } | null;
                changes.push(
                    rc?.mode
                        ? `Routing: ${(existing.routingConfig as { mode?: string } | null)?.mode || "none"} → ${rc.mode}`
                        : "Routing config cleared"
                );
            }
            if (hasModelConfigUpdate && !jsonEqual(updateData.modelConfig, existing.modelConfig)) {
                changes.push("Updated model configuration");
            }
            if (body.isActive !== undefined && body.isActive !== existing.isActive) {
                changes.push(
                    `Status: ${existing.isActive ? "active" : "inactive"} → ${body.isActive ? "active" : "inactive"}`
                );
            }
            if (body.visibility !== undefined && body.visibility !== existing.visibility) {
                changes.push(`Visibility: ${existing.visibility} → ${body.visibility}`);
            }

            // Determine if there are actual data changes beyond what the change descriptions cover
            // This catches any field update even if the specific change description logic missed it
            const hasDataChanges =
                changes.length > 0 ||
                Object.keys(updateData).some((key) => {
                    if (key === "version") return false; // skip version field itself
                    const existingVal = (existing as Record<string, unknown>)[key];
                    const newVal = (updateData as Record<string, unknown>)[key];
                    return !jsonEqual(existingVal, newVal);
                });

            // Also check tools separately since they're updated outside updateData
            const hasToolChanges =
                body.tools !== undefined &&
                Array.isArray(body.tools) &&
                JSON.stringify(existing.tools.map((t) => t.toolId).sort()) !==
                    JSON.stringify([...body.tools].sort());

            const shouldVersion = hasDataChanges || hasToolChanges;

            // Create version snapshot if there are actual changes
            if (shouldVersion) {
                // If we detected data changes but no specific change descriptions, add a generic one
                if (changes.length === 0) {
                    changes.push("Configuration updated");
                }

                // Get the next version number from AgentVersion table
                const lastVersion = await prisma.agentVersion.findFirst({
                    where: { agentId: existing.id },
                    orderBy: { version: "desc" },
                    select: { version: true }
                });
                const nextVersion = (lastVersion?.version || existing.version || 0) + 1;

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
                    routingConfig: existing.routingConfig,
                    memoryEnabled: existing.memoryEnabled,
                    memoryConfig: existing.memoryConfig,
                    contextConfig: existing.contextConfig,
                    maxSteps: existing.maxSteps,
                    subAgents: existing.subAgents,
                    workflows: existing.workflows,
                    tools: existing.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
                    skills: existing.skills.map((s) => ({
                        skillId: s.skillId,
                        skillSlug: s.skill.slug,
                        skillVersion: s.skill.version
                    })),
                    visibility: existing.visibility,
                    isActive: existing.isActive,
                    metadata: existing.metadata
                };

                // Create version record and update agent atomically
                await prisma.$transaction([
                    prisma.agentVersion.create({
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
                    }),
                    prisma.agent.update({
                        where: { id: existing.id },
                        data: { ...updateData, version: nextVersion }
                    })
                ]);

                // Write structured changelog entry
                const fieldChanges: FieldChange[] = [];
                const sc = detectScalarChange;
                const jc = detectJsonChange;
                const ac = detectArrayChange;

                const scalarChecks = [
                    sc("name", existing.name, body.name),
                    sc("description", existing.description, body.description),
                    sc("instructions", existing.instructions, body.instructions),
                    sc("modelProvider", existing.modelProvider, body.modelProvider),
                    sc("modelName", existing.modelName, body.modelName),
                    sc("temperature", existing.temperature, body.temperature),
                    sc("maxTokens", existing.maxTokens, body.maxTokens),
                    sc("maxSteps", existing.maxSteps, body.maxSteps),
                    sc("memoryEnabled", existing.memoryEnabled, body.memoryEnabled),
                    sc("visibility", existing.visibility, body.visibility),
                    sc("isActive", existing.isActive, body.isActive),
                    jc("memoryConfig", existing.memoryConfig, body.memoryConfig),
                    jc("routingConfig", existing.routingConfig, body.routingConfig),
                    jc("metadata", existing.metadata, body.metadata),
                    jc("modelConfig", existing.modelConfig, updateData.modelConfig)
                ];
                for (const c of scalarChecks) {
                    if (c) fieldChanges.push(c);
                }

                fieldChanges.push(
                    ...ac(
                        "tools",
                        existing.tools.map((t) => t.toolId),
                        body.tools
                    ),
                    ...ac("subAgents", existing.subAgents || [], body.subAgents),
                    ...ac("workflows", existing.workflows || [], body.workflows)
                );

                if (fieldChanges.length > 0) {
                    createChangeLog({
                        entityType: "agent",
                        entityId: existing.id,
                        entitySlug: existing.slug,
                        version: nextVersion,
                        action: "update",
                        changes: fieldChanges,
                        reason: body.changeReason || undefined,
                        createdBy: body.createdBy || undefined
                    }).catch((err) => console.error("[ChangeLog] Agent write failed:", err));
                }
            } else {
                // No version-worthy changes, but still apply any updateData
                if (Object.keys(updateData).length > 0) {
                    await prisma.agent.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                }
            }

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

            // Record to Activity Feed
            recordActivity({
                type: "AGENT_UPDATED",
                agentId: existing.id,
                agentSlug: existing.slug,
                agentName: body.name || existing.name,
                summary: `Agent "${existing.name}" updated`,
                status: "info",
                source: "api",
                workspaceId: existing.workspaceId || undefined
            });

            // Track customized fields for playbook-sourced agents
            if (existing.playbookInstallationId) {
                const changedFieldNames = Object.keys(updateData);
                const existingCustomized = existing.customizedFields ?? [];
                const merged = [...new Set([...existingCustomized, ...changedFieldNames])];
                if (merged.length !== existingCustomized.length) {
                    prisma.agent
                        .update({
                            where: { id: existing.id },
                            data: { customizedFields: merged }
                        })
                        .catch((err: unknown) =>
                            console.warn("[Agent Update] customizedFields tracking failed:", err)
                        );
                }
            }

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
 * PATCH /api/agents/[id]
 *
 * Archive or unarchive an agent
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const updateAccess = await requireEntityAccess(
            authResult.context.userId,
            authResult.context.organizationId,
            "update"
        );
        if (!updateAccess.allowed) return updateAccess.response;
        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) {
            return accessResult.response;
        }

        const body = await request.json();
        const { action } = body as { action: string };

        if (action !== "archive" && action !== "unarchive") {
            return NextResponse.json(
                { success: false, error: "Invalid action. Use 'archive' or 'unarchive'." },
                { status: 400 }
            );
        }

        const existing = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        if (existing.type === "SYSTEM") {
            return NextResponse.json(
                { success: false, error: "SYSTEM agents cannot be archived" },
                { status: 403 }
            );
        }

        const updateData =
            action === "archive"
                ? { isArchived: true, archivedAt: new Date(), isActive: false }
                : { isArchived: false, archivedAt: null, isActive: true };

        const agent = await prisma.agent.update({
            where: { id: existing.id },
            data: updateData
        });

        recordActivity({
            type: action === "archive" ? "AGENT_UPDATED" : "AGENT_UPDATED",
            agentId: existing.id,
            agentSlug: existing.slug,
            agentName: existing.name,
            summary: `Agent "${existing.name}" ${action === "archive" ? "archived" : "unarchived"}`,
            status: "info",
            source: "api",
            workspaceId: existing.workspaceId || undefined
        });

        return NextResponse.json({
            success: true,
            agent,
            action
        });
    } catch (error) {
        console.error("[Agent Archive] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to archive agent"
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
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const deleteAccess = await requireEntityAccess(
            authResult.context.userId,
            authResult.context.organizationId,
            "delete"
        );
        if (!deleteAccess.allowed) return deleteAccess.response;
        const accessResult = await requireAgentAccess(authResult.context.organizationId, id);
        if (accessResult.response) {
            return accessResult.response;
        }

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

            // SYSTEM and DEMO agents cannot be deleted (they are seeded)
            if (existing.type === "SYSTEM" || existing.type === "DEMO") {
                return NextResponse.json(
                    {
                        success: false,
                        error: `${existing.type} agents cannot be deleted`
                    },
                    { status: 403 }
                );
            }

            const deletedAgentId = existing.id;

            await prisma.agent.delete({
                where: { id: deletedAgentId }
            });

            // Clean up parent playbook installation if this agent came from one
            if (existing.playbookInstallationId) {
                try {
                    const { removeEntityFromInstallation } = await import("@repo/agentc2");
                    await removeEntityFromInstallation(deletedAgentId, "createdAgentIds");
                } catch (cleanupErr) {
                    console.warn("[Agent Delete] Installation cleanup failed:", cleanupErr);
                }
            }

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

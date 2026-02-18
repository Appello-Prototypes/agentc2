/**
 * Integration Auto-Provisioner
 *
 * When an IntegrationConnection is created, this module:
 * 1. Looks up the blueprint for the provider
 * 2. Upserts a Skill with the blueprint's instructions + discovered tools
 * 3. Upserts an Agent configured to use that skill
 * 4. Logs all provisioned resources for auditability
 *
 * Key design decisions:
 * - Idempotent: reconnecting the same provider reactivates, not duplicates
 * - Org-scoped: slugs are unique within a workspace, every org gets clean slugs
 * - Background fallback: if MCP tool discovery times out, an Inngest job retries
 */

import { prisma, Prisma } from "@repo/database";
import type { IntegrationBlueprint, ProvisionResult } from "./blueprints/types";
import { getBlueprint } from "./blueprints";
import { listMcpToolDefinitions } from "../mcp/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProvisionOptions {
    /** REQUIRED: workspace ID for org-scoped resources */
    workspaceId: string;
    /** Optional: user ID for audit trail (some OAuth callbacks don't have it) */
    userId?: string;
    /** Skip agent creation (only create skill) */
    skipAgent?: boolean;
}

// ── Main Provisioner ─────────────────────────────────────────────────────────

/**
 * Provision a Skill + Agent for a newly connected integration.
 *
 * This is the main entry point called after an IntegrationConnection is created.
 */
export async function provisionIntegration(
    connectionId: string,
    opts: ProvisionOptions
): Promise<ProvisionResult> {
    const { workspaceId, userId, skipAgent = false } = opts;

    try {
        // 1. Load connection + provider
        const connection = await prisma.integrationConnection.findUnique({
            where: { id: connectionId },
            include: { provider: true }
        });

        if (!connection) {
            return {
                success: false,
                toolsDiscovered: [],
                skillCreated: false,
                agentCreated: false,
                error: `Connection not found: ${connectionId}`
            };
        }

        // 2. Find blueprint by provider key
        const blueprint = getBlueprint(connection.provider.key);
        if (!blueprint) {
            console.log(
                `[Provisioner] No blueprint for provider "${connection.provider.key}" — skipping`
            );
            return {
                success: true,
                toolsDiscovered: [],
                skillCreated: false,
                agentCreated: false
            };
        }

        // 3. Discover tools from MCP server
        let toolIds: string[] = [];
        let discoveryStatus: "complete" | "failed" | "pending" = "pending";
        if (blueprint.skill.toolDiscovery === "dynamic") {
            try {
                const organizationId = connection.organizationId;
                toolIds = await discoverMcpTools(organizationId, connection.provider.key);
                discoveryStatus = toolIds.length > 0 ? "complete" : "failed";
            } catch (err) {
                console.warn(
                    `[Provisioner] Tool discovery failed for ${connection.provider.key}:`,
                    err instanceof Error ? err.message : err
                );
                discoveryStatus = "failed";
            }
        } else if (blueprint.skill.staticTools) {
            toolIds = blueprint.skill.staticTools;
            discoveryStatus = "complete";
        }

        // 4. Upsert Skill
        const { skill, created: skillCreated } = await upsertSkill(
            blueprint,
            workspaceId,
            userId,
            toolIds,
            discoveryStatus
        );

        // 5. Upsert Agent (unless skipped)
        let agentId: string | undefined;
        let agentCreated = false;

        if (!skipAgent) {
            const agentResult = await upsertAgent(
                blueprint,
                workspaceId,
                userId,
                skill.id,
                toolIds
            );
            agentId = agentResult.agent.id;
            agentCreated = agentResult.created;
        }

        // 6. Write audit log
        console.log(
            `[Provisioner] ✓ ${connection.provider.key} — ` +
                `Skill: ${skill.slug} (${skillCreated ? "created" : "reactivated"})` +
                (agentId
                    ? `, Agent: ${blueprint.agent.slug} (${agentCreated ? "created" : "reactivated"})`
                    : "") +
                `, Tools: ${toolIds.length}`
        );

        return {
            success: true,
            skillId: skill.id,
            agentId,
            toolsDiscovered: toolIds,
            skillCreated,
            agentCreated
        };
    } catch (error) {
        console.error(`[Provisioner] Failed to provision for connection ${connectionId}:`, error);
        return {
            success: false,
            toolsDiscovered: [],
            skillCreated: false,
            agentCreated: false,
            error: error instanceof Error ? error.message : "Unknown provisioning error"
        };
    }
}

// ── Skill Upsert ─────────────────────────────────────────────────────────────

async function upsertSkill(
    blueprint: IntegrationBlueprint,
    workspaceId: string,
    userId: string | undefined,
    toolIds: string[],
    discoveryStatus: "complete" | "failed" | "pending" = "complete"
): Promise<{ skill: { id: string; slug: string }; created: boolean }> {
    const { skill: bp } = blueprint;

    // Check if skill already exists in this workspace
    const existing = await prisma.skill.findFirst({
        where: { slug: bp.slug, workspaceId }
    });

    if (existing) {
        // Reactivate and update instructions
        const updated = await prisma.skill.update({
            where: { id: existing.id },
            data: {
                name: bp.name,
                description: bp.description,
                instructions: bp.instructions,
                category: bp.category,
                tags: bp.tags,
                metadata: {
                    ...((existing.metadata as Record<string, unknown>) || {}),
                    blueprintVersion: blueprint.version,
                    lastToolSync: new Date().toISOString(),
                    discoveryStatus,
                    provisionedBy: "auto-provisioner"
                } satisfies Prisma.InputJsonValue
            }
        });

        // Sync tool records
        await syncSkillTools(existing.id, toolIds);

        return { skill: { id: updated.id, slug: updated.slug }, created: false };
    }

    // Create new skill
    const created = await prisma.skill.create({
        data: {
            slug: bp.slug,
            name: bp.name,
            description: bp.description,
            instructions: bp.instructions,
            category: bp.category,
            tags: bp.tags,
            workspaceId,
            type: "USER",
            createdBy: userId,
            metadata: {
                blueprintVersion: blueprint.version,
                providerKey: blueprint.providerKey,
                lastToolSync: new Date().toISOString(),
                discoveryStatus,
                provisionedBy: "auto-provisioner"
            } satisfies Prisma.InputJsonValue
        }
    });

    // Attach tools
    if (toolIds.length > 0) {
        await prisma.skillTool.createMany({
            data: toolIds.map((toolId) => ({
                skillId: created.id,
                toolId
            })),
            skipDuplicates: true
        });
    }

    return { skill: { id: created.id, slug: created.slug }, created: true };
}

// ── Agent Upsert ─────────────────────────────────────────────────────────────

async function upsertAgent(
    blueprint: IntegrationBlueprint,
    workspaceId: string,
    userId: string | undefined,
    skillId: string,
    toolIds: string[]
): Promise<{ agent: { id: string; slug: string }; created: boolean }> {
    const { agent: bp } = blueprint;

    // All tools = discovered MCP tools + additional tools defined in blueprint
    const allToolIds = [...new Set([...toolIds, ...bp.additionalTools])];

    // Check if agent already exists in this workspace
    const existing = await prisma.agent.findFirst({
        where: { slug: bp.slug, workspaceId }
    });

    if (existing) {
        // Reactivate
        const updated = await prisma.agent.update({
            where: { id: existing.id },
            data: {
                isActive: true,
                name: bp.name,
                description: bp.description,
                instructions: bp.instructions,
                modelProvider: bp.modelProvider,
                modelName: bp.modelName,
                temperature: bp.temperature,
                memoryEnabled: bp.memoryEnabled,
                metadata: {
                    ...((existing.metadata as Record<string, unknown>) || {}),
                    blueprintVersion: blueprint.version,
                    provisionedBy: "auto-provisioner",
                    ...bp.metadata
                } satisfies Prisma.InputJsonValue
            }
        });

        // Sync tool attachments
        await syncAgentTools(existing.id, allToolIds);

        // Ensure skill is pinned to agent
        await prisma.agentSkill.upsert({
            where: {
                agentId_skillId: { agentId: existing.id, skillId }
            },
            update: { pinned: true },
            create: {
                agentId: existing.id,
                skillId,
                pinned: true
            }
        });

        return { agent: { id: updated.id, slug: updated.slug }, created: false };
    }

    // Create new agent
    const created = await prisma.agent.create({
        data: {
            slug: bp.slug,
            name: bp.name,
            description: bp.description,
            instructions: bp.instructions,
            modelProvider: bp.modelProvider,
            modelName: bp.modelName,
            temperature: bp.temperature,
            memoryEnabled: bp.memoryEnabled,
            type: "USER",
            workspaceId,
            ownerId: userId,
            createdBy: userId,
            isActive: true,
            metadata: {
                blueprintVersion: blueprint.version,
                providerKey: blueprint.providerKey,
                provisionedBy: "auto-provisioner",
                ...bp.metadata
            } satisfies Prisma.InputJsonValue,
            // Create tool attachments inline
            tools: {
                create: allToolIds.map((toolId) => ({ toolId }))
            }
        }
    });

    // Attach skill to agent
    await prisma.agentSkill.create({
        data: {
            agentId: created.id,
            skillId,
            pinned: true
        }
    });

    return { agent: { id: created.id, slug: created.slug }, created: true };
}

// ── Tool Sync ────────────────────────────────────────────────────────────────

/**
 * Sync SkillTool records: remove tools no longer present, add new ones.
 */
async function syncSkillTools(skillId: string, toolIds: string[]) {
    const existing = await prisma.skillTool.findMany({
        where: { skillId },
        select: { toolId: true }
    });

    const existingSet = new Set(existing.map((t) => t.toolId));
    const newSet = new Set(toolIds);

    // Remove tools no longer present
    const toRemove = existing.filter((t) => !newSet.has(t.toolId));
    if (toRemove.length > 0) {
        await prisma.skillTool.deleteMany({
            where: {
                skillId,
                toolId: { in: toRemove.map((t) => t.toolId) }
            }
        });
    }

    // Add new tools
    const toAdd = toolIds.filter((id) => !existingSet.has(id));
    if (toAdd.length > 0) {
        await prisma.skillTool.createMany({
            data: toAdd.map((toolId) => ({ skillId, toolId })),
            skipDuplicates: true
        });
    }
}

/**
 * Sync AgentTool records: remove tools no longer present, add new ones.
 */
async function syncAgentTools(agentId: string, toolIds: string[]) {
    const existing = await prisma.agentTool.findMany({
        where: { agentId },
        select: { toolId: true }
    });

    const existingSet = new Set(existing.map((t) => t.toolId));
    const newSet = new Set(toolIds);

    // Remove tools no longer present
    const toRemove = existing.filter((t) => !newSet.has(t.toolId));
    if (toRemove.length > 0) {
        await prisma.agentTool.deleteMany({
            where: {
                agentId,
                toolId: { in: toRemove.map((t) => t.toolId) }
            }
        });
    }

    // Add new tools
    const toAdd = toolIds.filter((id) => !existingSet.has(id));
    if (toAdd.length > 0) {
        await prisma.agentTool.createMany({
            data: toAdd.map((toolId) => ({ agentId, toolId })),
            skipDuplicates: true
        });
    }
}

// ── Deprovisioning ──────────────────────────────────────────────────────────

export interface DeprovisionResult {
    /** Provider key of the disconnected integration */
    providerKey: string;
    /** Skills that were deactivated (set isActive: false) */
    deactivatedSkills: string[];
    /** Agents that were deactivated (set isActive: false) */
    deactivatedAgents: string[];
}

/**
 * Deactivate provisioned resources when an integration connection is removed.
 *
 * Does NOT delete anything -- only sets `isActive: false` to preserve history.
 * If the user reconnects, the provisioner will reactivate existing resources.
 *
 * @param providerKey - The provider key (e.g., "hubspot", "slack")
 * @param workspaceId - The workspace to scope the search
 */
export async function deprovisionIntegration(
    providerKey: string,
    workspaceId: string
): Promise<DeprovisionResult> {
    const result: DeprovisionResult = {
        providerKey,
        deactivatedSkills: [],
        deactivatedAgents: []
    };

    const blueprint = getBlueprint(providerKey);
    if (!blueprint) {
        // No blueprint -> nothing was auto-provisioned
        return result;
    }

    // Deactivate the provisioned skill
    const skill = await prisma.skill.findFirst({
        where: {
            slug: blueprint.skill.slug,
            workspaceId,
            metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
        }
    });

    if (skill) {
        // Skill model has no isActive field -- mark as deactivated in metadata
        const meta = skill.metadata as Record<string, unknown> | null;
        await prisma.skill.update({
            where: { id: skill.id },
            data: {
                metadata: {
                    ...(meta || {}),
                    deactivated: true,
                    deactivatedAt: new Date().toISOString()
                } satisfies Prisma.InputJsonValue
            }
        });
        result.deactivatedSkills.push(skill.slug);
    }

    // Deactivate the provisioned agent (if exists)
    if (blueprint.agent) {
        const agent = await prisma.agent.findFirst({
            where: {
                slug: blueprint.agent.slug,
                workspaceId,
                metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
            }
        });

        if (agent) {
            await prisma.agent.update({
                where: { id: agent.id },
                data: { isActive: false }
            });
            result.deactivatedAgents.push(agent.slug);
        }
    }

    console.log(
        `[Provisioner] Deprovisioned ${providerKey}: ` +
            `skills=[${result.deactivatedSkills.join(",")}], ` +
            `agents=[${result.deactivatedAgents.join(",")}]`
    );

    return result;
}

// ── Blueprint Version Sync ──────────────────────────────────────────────────

export interface BlueprintSyncResult {
    updated: Array<{
        type: "skill" | "agent";
        slug: string;
        fromVersion: number;
        toVersion: number;
    }>;
    skipped: number;
    errors: string[];
}

/**
 * Sync existing provisioned skills/agents with the latest blueprint versions.
 *
 * Call this on app startup or deploy to update instructions, metadata, etc.
 * for resources that were provisioned by an older blueprint version.
 */
export async function syncBlueprintVersions(): Promise<BlueprintSyncResult> {
    const { getAllBlueprints } = await import("./blueprints");

    const result: BlueprintSyncResult = {
        updated: [],
        skipped: 0,
        errors: []
    };

    const blueprints = getAllBlueprints();

    for (const bp of blueprints) {
        try {
            // Find skills provisioned by auto-provisioner with outdated version
            const skills = await prisma.skill.findMany({
                where: {
                    slug: bp.skill.slug,
                    metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
                }
            });

            for (const skill of skills) {
                const meta = skill.metadata as Record<string, unknown> | null;
                const currentVersion = (meta?.blueprintVersion as number) ?? 0;

                if (currentVersion < bp.version) {
                    await prisma.skill.update({
                        where: { id: skill.id },
                        data: {
                            name: bp.skill.name,
                            description: bp.skill.description,
                            instructions: bp.skill.instructions,
                            category: bp.skill.category,
                            tags: bp.skill.tags,
                            metadata: {
                                ...(meta || {}),
                                blueprintVersion: bp.version,
                                lastBlueprintSync: new Date().toISOString()
                            } satisfies Prisma.InputJsonValue
                        }
                    });
                    result.updated.push({
                        type: "skill",
                        slug: skill.slug,
                        fromVersion: currentVersion,
                        toVersion: bp.version
                    });
                } else {
                    result.skipped++;
                }
            }

            // Find agents provisioned by auto-provisioner with outdated version
            if (bp.agent) {
                const agents = await prisma.agent.findMany({
                    where: {
                        slug: bp.agent.slug,
                        metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
                    }
                });

                for (const agent of agents) {
                    const meta = agent.metadata as Record<string, unknown> | null;
                    const currentVersion = (meta?.blueprintVersion as number) ?? 0;

                    if (currentVersion < bp.version) {
                        await prisma.agent.update({
                            where: { id: agent.id },
                            data: {
                                name: bp.agent.name,
                                description: bp.agent.description,
                                instructions: bp.agent.instructions,
                                modelProvider: bp.agent.modelProvider,
                                modelName: bp.agent.modelName,
                                temperature: bp.agent.temperature,
                                metadata: {
                                    ...(meta || {}),
                                    blueprintVersion: bp.version,
                                    lastBlueprintSync: new Date().toISOString(),
                                    ...bp.agent.metadata
                                } satisfies Prisma.InputJsonValue
                            }
                        });
                        result.updated.push({
                            type: "agent",
                            slug: agent.slug,
                            fromVersion: currentVersion,
                            toVersion: bp.version
                        });
                    } else {
                        result.skipped++;
                    }
                }
            }
        } catch (error) {
            result.errors.push(
                `${bp.providerKey}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    console.log(
        `[Provisioner] Blueprint sync complete: ` +
            `${result.updated.length} updated, ${result.skipped} skipped, ${result.errors.length} errors`
    );

    return result;
}

// ── Tool Re-Discovery ───────────────────────────────────────────────────────

export interface ToolRediscoveryResult {
    provider: string;
    added: string[];
    removed: string[];
    unchanged: number;
}

/**
 * Re-discover MCP tools for a specific connection and sync SkillTool records.
 *
 * Called by the daily Inngest cron to keep tool lists fresh as remote MCP
 * servers add/remove tools over time.
 */
export async function rediscoverToolsForConnection(
    connectionId: string
): Promise<ToolRediscoveryResult | null> {
    // Load connection with provider
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId },
        include: { provider: true }
    });

    if (!connection || !connection.isActive) return null;

    const providerKey = connection.provider.key;
    const blueprint = getBlueprint(providerKey);
    if (!blueprint) return null;

    // Find the provisioned skill
    const skill = await prisma.skill.findFirst({
        where: {
            slug: blueprint.skill.slug,
            metadata: { path: ["provisionedBy"], equals: "auto-provisioner" }
        },
        include: { tools: true }
    });

    if (!skill) return null;

    // Discover current tools
    const currentTools = await discoverMcpTools(connection.organizationId, providerKey);

    const existingToolIds = new Set(skill.tools.map((t) => t.toolId));
    const discoveredSet = new Set(currentTools);

    const added: string[] = [];
    const removed: string[] = [];

    // Add newly discovered tools
    for (const toolId of currentTools) {
        if (!existingToolIds.has(toolId)) {
            await prisma.skillTool
                .create({
                    data: { skillId: skill.id, toolId }
                })
                .catch(() => {
                    // Skip duplicates
                });
            added.push(toolId);
        }
    }

    // Remove tools that are no longer available
    for (const existing of skill.tools) {
        if (!discoveredSet.has(existing.toolId)) {
            await prisma.skillTool
                .delete({
                    where: { id: existing.id }
                })
                .catch(() => {
                    // Already deleted
                });
            removed.push(existing.toolId);
        }
    }

    // Update skill metadata with last sync time
    if (added.length > 0 || removed.length > 0) {
        const meta = skill.metadata as Record<string, unknown> | null;
        await prisma.skill.update({
            where: { id: skill.id },
            data: {
                metadata: {
                    ...(meta || {}),
                    lastToolSync: new Date().toISOString(),
                    toolCount: currentTools.length
                } satisfies Prisma.InputJsonValue
            }
        });
    }

    return {
        provider: providerKey,
        added,
        removed,
        unchanged: currentTools.length - added.length
    };
}

// ── MCP Tool Discovery ──────────────────────────────────────────────────────

/**
 * Discover MCP tools available for the organization.
 * Uses the existing listMcpToolDefinitions infrastructure which handles
 * per-org MCP server connections, credential decryption, etc.
 *
 * @param organizationId - The org whose MCP connections to query
 * @param providerKey - Filter tools by this provider prefix
 * @returns Array of tool IDs matching the provider
 */
async function discoverMcpTools(organizationId: string, providerKey: string): Promise<string[]> {
    const retryDelays = [0, 2000, 5000];

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        try {
            if (retryDelays[attempt] > 0) {
                await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
            }

            const { definitions: allTools } = await listMcpToolDefinitions(organizationId);
            if (!allTools || allTools.length === 0) {
                if (attempt < retryDelays.length - 1) continue;
                return [];
            }

            const prefix = `${providerKey}_`;
            const matched = allTools.filter((t) => t.name.startsWith(prefix)).map((t) => t.name);

            if (matched.length === 0 && attempt < retryDelays.length - 1) continue;
            return matched;
        } catch (error) {
            if (attempt === retryDelays.length - 1) {
                console.warn(
                    `[Provisioner] MCP tool discovery failed for ${providerKey} after ${retryDelays.length} attempts:`,
                    error instanceof Error ? error.message : error
                );
                return [];
            }
        }
    }

    return [];
}

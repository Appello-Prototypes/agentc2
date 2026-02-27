import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { createChangeLog } from "@/lib/changelog";

/**
 * POST /api/agents/[id]/versions/[version]/rollback
 *
 * Rollback an agent to a specific version
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; version: string }> }
) {
    try {
        const { id, version: versionStr } = await params;
        const body = await request.json().catch(() => ({}));

        const { reason, createdBy } = body;
        const targetVersion = parseInt(versionStr);

        if (isNaN(targetVersion)) {
            return NextResponse.json(
                { success: false, error: "Invalid version number" },
                { status: 400 }
            );
        }

        // Find agent by slug or id
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

        // Find the target version
        const targetVersionRecord = await prisma.agentVersion.findFirst({
            where: {
                agentId: agent.id,
                version: targetVersion
            }
        });

        if (!targetVersionRecord) {
            return NextResponse.json(
                { success: false, error: `Version ${targetVersion} not found` },
                { status: 404 }
            );
        }

        // Get snapshot data
        const snapshot = targetVersionRecord.snapshot as Record<string, unknown>;

        // Delete existing tool and skill associations
        await prisma.agentTool.deleteMany({
            where: { agentId: agent.id }
        });
        await prisma.agentSkill.deleteMany({
            where: { agentId: agent.id }
        });

        // Apply the snapshot to the agent
        const updatedAgent = await prisma.agent.update({
            where: { id: agent.id },
            data: {
                name: (snapshot.name as string) || agent.name,
                description: (snapshot.description as string) || agent.description,
                instructions: (snapshot.instructions as string) || agent.instructions,
                instructionsTemplate: (snapshot.instructionsTemplate as string) || undefined,
                modelProvider: (snapshot.modelProvider as string) || agent.modelProvider,
                modelName: (snapshot.modelName as string) || agent.modelName,
                temperature: (snapshot.temperature as number) ?? agent.temperature,
                maxTokens: (snapshot.maxTokens as number) || undefined,
                modelConfig: snapshot.modelConfig
                    ? (snapshot.modelConfig as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                memoryEnabled: (snapshot.memoryEnabled as boolean) ?? agent.memoryEnabled,
                memoryConfig: snapshot.memoryConfig
                    ? (snapshot.memoryConfig as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                maxSteps: (snapshot.maxSteps as number) ?? agent.maxSteps,
                visibility: ((snapshot.visibility as string) ?? agent.visibility) as
                    | "PRIVATE"
                    | "ORGANIZATION"
                    | "PUBLIC",
                metadata: snapshot.metadata
                    ? (snapshot.metadata as Prisma.InputJsonValue)
                    : Prisma.JsonNull
            }
        });

        // Restore tool associations
        const tools = snapshot.tools as Array<{ toolId: string; config?: unknown }>;
        if (tools && tools.length > 0) {
            await prisma.agentTool.createMany({
                data: tools.map((t) => ({
                    agentId: agent.id,
                    toolId: t.toolId,
                    config: t.config ? (t.config as Prisma.InputJsonValue) : Prisma.JsonNull
                }))
            });
        }

        // Restore skill associations
        const skills = snapshot.skills as Array<{ skillId: string; pinned?: boolean }>;
        if (skills && skills.length > 0) {
            await prisma.agentSkill.createMany({
                data: skills.map((s) => ({
                    agentId: agent.id,
                    skillId: s.skillId,
                    pinned: s.pinned ?? true
                }))
            });
        }

        // Create a new version record for the rollback
        const lastVersion = await prisma.agentVersion.findFirst({
            where: { agentId: agent.id },
            orderBy: { version: "desc" },
            select: { version: true }
        });

        const newVersion = (lastVersion?.version || 0) + 1;

        const rollbackVersion = await prisma.agentVersion.create({
            data: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                version: newVersion,
                description: `Rollback to version ${targetVersion}${reason ? `: ${reason}` : ""}`,
                instructions: updatedAgent.instructions,
                modelProvider: updatedAgent.modelProvider,
                modelName: updatedAgent.modelName,
                changesJson: {
                    type: "rollback",
                    fromVersion: agent.version,
                    toVersion: targetVersion,
                    reason: reason || null
                } as Prisma.InputJsonValue,
                snapshot: snapshot as Prisma.InputJsonValue,
                createdBy
            }
        });

        // Update agent's current version
        await prisma.agent.update({
            where: { id: agent.id },
            data: { version: newVersion }
        });

        // Create an alert for the rollback
        await prisma.agentAlert.create({
            data: {
                agentId: agent.id,
                severity: "INFO",
                message: `Agent rolled back from version ${agent.version} to version ${targetVersion}`,
                source: "SYSTEM"
            }
        });

        // Write structured changelog entry for rollback
        createChangeLog({
            entityType: "agent",
            entityId: agent.id,
            entitySlug: agent.slug,
            version: newVersion,
            action: "rollback",
            changes: [
                {
                    field: "version",
                    action: "modified",
                    before: agent.version,
                    after: targetVersion
                }
            ],
            summary: `Rolled back from v${agent.version} to v${targetVersion}`,
            reason: reason || undefined,
            createdBy
        }).catch((err) => console.error("[ChangeLog] Rollback write failed:", err));

        // Create audit log
        await prisma.auditLog.create({
            data: {
                tenantId: agent.tenantId,
                actorId: createdBy,
                action: "VERSION_ROLLBACK",
                entityType: "Agent",
                entityId: agent.id,
                metadata: {
                    fromVersion: agent.version,
                    toVersion: targetVersion,
                    newVersion,
                    reason
                }
            }
        });

        return NextResponse.json({
            success: true,
            newVersion: {
                id: rollbackVersion.id,
                version: rollbackVersion.version,
                description: rollbackVersion.description,
                createdAt: rollbackVersion.createdAt
            },
            previousVersion: agent.version,
            rolledBackTo: targetVersion
        });
    } catch (error) {
        console.error("[Agent Version Rollback] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to rollback version"
            },
            { status: 500 }
        );
    }
}

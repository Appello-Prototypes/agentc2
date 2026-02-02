import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/versions
 *
 * List agent versions with pagination
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const cursor = searchParams.get("cursor");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId: agent.id };

        if (cursor) {
            where.version = { lt: parseInt(cursor) };
        }

        // Query versions
        const versions = await prisma.agentVersion.findMany({
            where,
            orderBy: { version: "desc" },
            take: limit + 1,
            include: {
                versionStats: {
                    select: {
                        runs: true,
                        successRate: true,
                        avgQuality: true
                    }
                }
            }
        });

        // Check if there are more results
        const hasMore = versions.length > limit;
        if (hasMore) {
            versions.pop();
        }

        return NextResponse.json({
            success: true,
            versions: versions.map((v) => ({
                id: v.id,
                version: v.version,
                description: v.description,
                modelProvider: v.modelProvider,
                modelName: v.modelName,
                changesJson: v.changesJson,
                createdBy: v.createdBy,
                createdAt: v.createdAt,
                isActive: v.version === agent.version,
                stats: v.versionStats[0] || null
            })),
            currentVersion: agent.version,
            nextCursor: hasMore ? versions[versions.length - 1].version.toString() : null
        });
    } catch (error) {
        console.error("[Agent Versions List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list versions"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/versions
 *
 * Create a new version snapshot
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { description, createdBy } = body;

        // Find agent by slug or id with tools
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

        // Create full snapshot
        const snapshot = {
            name: agent.name,
            description: agent.description,
            instructions: agent.instructions,
            instructionsTemplate: agent.instructionsTemplate,
            modelProvider: agent.modelProvider,
            modelName: agent.modelName,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            modelConfig: agent.modelConfig,
            memoryEnabled: agent.memoryEnabled,
            memoryConfig: agent.memoryConfig,
            maxSteps: agent.maxSteps,
            scorers: agent.scorers,
            tools: agent.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
            isPublic: agent.isPublic,
            metadata: agent.metadata
        };

        // Get the next version number
        const lastVersion = await prisma.agentVersion.findFirst({
            where: { agentId: agent.id },
            orderBy: { version: "desc" },
            select: { version: true }
        });

        const nextVersion = (lastVersion?.version || 0) + 1;

        // Create the version
        const version = await prisma.agentVersion.create({
            data: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                version: nextVersion,
                description: description || `Version ${nextVersion}`,
                instructions: agent.instructions,
                modelProvider: agent.modelProvider,
                modelName: agent.modelName,
                snapshot,
                createdBy
            }
        });

        // Update agent's current version
        await prisma.agent.update({
            where: { id: agent.id },
            data: { version: nextVersion }
        });

        return NextResponse.json({
            success: true,
            version: {
                id: version.id,
                version: version.version,
                description: version.description,
                modelProvider: version.modelProvider,
                modelName: version.modelName,
                createdAt: version.createdAt,
                createdBy: version.createdBy
            }
        });
    } catch (error) {
        console.error("[Agent Version Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create version"
            },
            { status: 500 }
        );
    }
}

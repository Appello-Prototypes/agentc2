import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { validateModelSelection } from "@repo/agentc2/agents";
import type { ModelProvider } from "@repo/agentc2/agents";
import { buildNetworkTopologyFromPrimitives, isNetworkTopologyEmpty } from "@repo/agentc2/networks";
import { authenticateRequest } from "@/lib/api-auth";
import { requireEntityAccess } from "@/lib/authz/require-entity-access";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const networks = await prisma.network.findMany({
            where: { workspace: { organizationId: authContext.organizationId } },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { runs: true, primitives: true } }
            }
        });

        return NextResponse.json({
            success: true,
            networks: networks.map((network) => ({
                id: network.id,
                slug: network.slug,
                name: network.name,
                description: network.description,
                version: network.version,
                isPublished: network.isPublished,
                isActive: network.isActive,
                runCount: network._count?.runs ?? 0,
                primitiveCount: network._count?.primitives ?? 0,
                createdAt: network.createdAt,
                updatedAt: network.updatedAt
            }))
        });
    } catch (error) {
        console.error("[Networks List] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list networks" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const access = await requireEntityAccess(
            authContext.userId,
            authContext.organizationId,
            "create"
        );
        if (!access.allowed) return access.response;

        const body = await request.json();
        const { name, slug, description } = body;

        if (!name || !body.instructions || !body.modelProvider || !body.modelName) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: name, instructions, modelProvider, modelName"
                },
                { status: 400 }
            );
        }

        // Validate model exists for the provider
        const modelValidation = await validateModelSelection(
            body.modelProvider as ModelProvider,
            body.modelName,
            authContext.organizationId
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

        const networkSlug = slug || generateSlug(name);
        const existing = await prisma.network.findFirst({
            where: {
                slug: networkSlug,
                workspace: { organizationId: authContext.organizationId }
            }
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: `Network slug '${networkSlug}' already exists` },
                { status: 409 }
            );
        }

        const primitives = Array.isArray(body.primitives) ? body.primitives : [];
        const baseTopology = body.topologyJson || { nodes: [], edges: [] };
        const topologyJson =
            primitives.length > 0 && isNetworkTopologyEmpty(baseTopology)
                ? buildNetworkTopologyFromPrimitives(primitives)
                : baseTopology;

        let workspaceId = body.workspaceId;
        if (workspaceId) {
            const ws = await prisma.workspace.findFirst({
                where: { id: workspaceId, organizationId: authContext.organizationId }
            });
            if (!ws) {
                return NextResponse.json(
                    { success: false, error: "Workspace not found in your organization" },
                    { status: 403 }
                );
            }
        } else {
            const { getDefaultWorkspaceIdForUser } = await import("@/lib/organization");
            workspaceId = await getDefaultWorkspaceIdForUser(
                authContext.userId,
                authContext.organizationId
            );
        }

        const network = await prisma.network.create({
            data: {
                slug: networkSlug,
                name,
                description: description || null,
                instructions: body.instructions,
                modelProvider: body.modelProvider,
                modelName: body.modelName,
                temperature: body.temperature ?? 0.7,
                topologyJson,
                memoryConfig: body.memoryConfig || {},
                maxSteps: body.maxSteps ?? 10,
                isPublished: body.isPublished ?? false,
                isActive: body.isActive ?? true,
                workspaceId,
                ownerId: body.ownerId || authContext.userId,
                type: body.type || "USER"
            }
        });

        if (primitives.length > 0) {
            await prisma.networkPrimitive.createMany({
                data: primitives.map((primitive: Record<string, unknown>) => ({
                    networkId: network.id,
                    primitiveType: primitive.primitiveType as string,
                    agentId: primitive.agentId as string,
                    workflowId: primitive.workflowId as string,
                    toolId: primitive.toolId as string,
                    description: primitive.description as string,
                    position: primitive.position as object
                }))
            });
        }

        await prisma.networkVersion.create({
            data: {
                networkId: network.id,
                version: 1,
                topologyJson,
                primitivesJson: primitives,
                description: body.versionDescription || "Initial version",
                createdBy: body.createdBy || null
            }
        });

        return NextResponse.json({
            success: true,
            network
        });
    } catch (error) {
        console.error("[Network Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create network" },
            { status: 500 }
        );
    }
}

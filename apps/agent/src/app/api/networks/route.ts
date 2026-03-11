import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { validateModelSelection } from "@repo/agentc2/agents";
import type { ModelProvider } from "@repo/agentc2/agents";
import { buildNetworkTopologyFromPrimitives, isNetworkTopologyEmpty } from "@repo/agentc2/networks";
import { networkCreateSchema } from "@repo/agentc2/schemas/network";
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

        // Generic error (no sensitive details)
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

        // Validate request body with Zod schema
        const validation = networkCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation failed",
                    details: validation.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                },
                { status: 400 }
            );
        }
        const validatedData = validation.data;
        const { name, slug, description } = validatedData;

        // Validate model exists for the provider
        const modelValidation = await validateModelSelection(
            validatedData.modelProvider as ModelProvider,
            validatedData.modelName,
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

        const primitives = Array.isArray(validatedData.primitives) ? validatedData.primitives : [];
        const baseTopology = validatedData.topologyJson || { nodes: [], edges: [] };
        const topologyJson =
            primitives.length > 0 && isNetworkTopologyEmpty(baseTopology)
                ? buildNetworkTopologyFromPrimitives(primitives)
                : baseTopology;

        let workspaceId = validatedData.workspaceId;
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
                instructions: validatedData.instructions,
                modelProvider: validatedData.modelProvider,
                modelName: validatedData.modelName,
                temperature: validatedData.temperature ?? 0.7,
                topologyJson,
                memoryConfig: validatedData.memoryConfig || {},
                maxSteps: validatedData.maxSteps ?? 10,
                isPublished: validatedData.isPublished ?? false,
                isActive: validatedData.isActive ?? true,
                workspaceId,
                ownerId: validatedData.ownerId || authContext.userId,
                type: validatedData.type || "USER"
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
                description: validatedData.versionDescription || "Initial version",
                createdBy: validatedData.createdBy || null
            }
        });

        return NextResponse.json({
            success: true,
            network
        });
    } catch (error) {
        console.error("[Network Create] Error:", error);

        // Handle Prisma-specific errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2011") {
                return NextResponse.json(
                    { success: false, error: "Required field is null or missing" },
                    { status: 400 }
                );
            }
            if (error.code === "P2002") {
                return NextResponse.json(
                    { success: false, error: "A record with this identifier already exists" },
                    { status: 409 }
                );
            }
        }

        // Generic error (no sensitive details)
        return NextResponse.json(
            { success: false, error: "Failed to create network" },
            { status: 500 }
        );
    }
}

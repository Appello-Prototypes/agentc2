import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

async function findNetwork(slug: string) {
    return prisma.network.findFirst({
        where: { OR: [{ slug }, { id: slug }] },
        include: {
            primitives: {
                include: {
                    agent: { select: { id: true, slug: true, name: true } },
                    workflow: { select: { id: true, slug: true, name: true } }
                }
            },
            _count: { select: { runs: true, primitives: true } }
        }
    });
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const network = await findNetwork(slug);

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            network: {
                ...network,
                runCount: network._count?.runs ?? 0,
                primitiveCount: network._count?.primitives ?? 0
            }
        });
    } catch (error) {
        console.error("[Network Get] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get network" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const body = await request.json();
        const existing = await findNetwork(slug);

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.instructions !== undefined) updateData.instructions = body.instructions;
        if (body.modelProvider !== undefined) updateData.modelProvider = body.modelProvider;
        if (body.modelName !== undefined) updateData.modelName = body.modelName;
        if (body.temperature !== undefined) updateData.temperature = body.temperature;
        if (body.topologyJson !== undefined) updateData.topologyJson = body.topologyJson;
        if (body.memoryConfig !== undefined) updateData.memoryConfig = body.memoryConfig;
        if (body.maxSteps !== undefined) updateData.maxSteps = body.maxSteps;
        if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;

        const topologyChanged =
            body.topologyJson !== undefined &&
            JSON.stringify(existing.topologyJson) !== JSON.stringify(body.topologyJson);

        const primitivesChanged =
            body.primitives !== undefined &&
            JSON.stringify(existing.primitives) !== JSON.stringify(body.primitives);

        if (topologyChanged || primitivesChanged) {
            const lastVersion = await prisma.networkVersion.findFirst({
                where: { networkId: existing.id },
                orderBy: { version: "desc" },
                select: { version: true }
            });
            const nextVersion = (lastVersion?.version || 0) + 1;
            updateData.version = nextVersion;

            await prisma.networkVersion.create({
                data: {
                    networkId: existing.id,
                    version: nextVersion,
                    topologyJson: body.topologyJson || existing.topologyJson,
                    primitivesJson: body.primitives || existing.primitives,
                    description: body.versionDescription || "Topology update",
                    createdBy: body.createdBy || null
                }
            });
        }

        const updated = await prisma.network.update({
            where: { id: existing.id },
            data: updateData
        });

        if (Array.isArray(body.primitives)) {
            await prisma.networkPrimitive.deleteMany({
                where: { networkId: existing.id }
            });
            if (body.primitives.length > 0) {
                await prisma.networkPrimitive.createMany({
                    data: body.primitives.map((primitive: Record<string, unknown>) => ({
                        networkId: existing.id,
                        primitiveType: primitive.primitiveType as string,
                        agentId: primitive.agentId as string,
                        workflowId: primitive.workflowId as string,
                        toolId: primitive.toolId as string,
                        description: primitive.description as string,
                        position: primitive.position as object
                    }))
                });
            }
        }

        return NextResponse.json({
            success: true,
            network: updated
        });
    } catch (error) {
        console.error("[Network Update] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update network" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const existing = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        if (existing.type === "SYSTEM") {
            return NextResponse.json(
                { success: false, error: "SYSTEM networks cannot be deleted" },
                { status: 403 }
            );
        }

        await prisma.network.delete({ where: { id: existing.id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Network Delete] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete network" },
            { status: 500 }
        );
    }
}

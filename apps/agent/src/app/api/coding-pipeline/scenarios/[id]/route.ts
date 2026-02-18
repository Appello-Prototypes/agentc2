import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const scenario = await prisma.pipelineScenario.findFirst({
            where: {
                id,
                repositoryConfig: { organizationId: authResult.organizationId }
            },
            include: {
                runs: { orderBy: { createdAt: "desc" }, take: 10 }
            }
        });

        if (!scenario) {
            return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
        }

        return NextResponse.json({ scenario });
    } catch (error) {
        console.error("[PipelineScenario] GET error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.pipelineScenario.findFirst({
            where: {
                id,
                repositoryConfig: { organizationId: authResult.organizationId }
            }
        });

        if (!existing) {
            return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
        }

        const { name, description, prompt, expectedOutcome, isHoldout, isActive } = body;

        const scenario = await prisma.pipelineScenario.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(prompt !== undefined && { prompt }),
                ...(expectedOutcome !== undefined && { expectedOutcome }),
                ...(isHoldout !== undefined && { isHoldout }),
                ...(isActive !== undefined && { isActive })
            }
        });

        return NextResponse.json({ scenario });
    } catch (error) {
        console.error("[PipelineScenario] PUT error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const existing = await prisma.pipelineScenario.findFirst({
            where: {
                id,
                repositoryConfig: { organizationId: authResult.organizationId }
            }
        });

        if (!existing) {
            return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
        }

        await prisma.pipelineScenario.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[PipelineScenario] DELETE error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

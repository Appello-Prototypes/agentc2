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

        const repo = await prisma.repositoryConfig.findFirst({
            where: { id, organizationId: authResult.organizationId }
        });

        if (!repo) {
            return NextResponse.json({ error: "Repository config not found" }, { status: 404 });
        }

        return NextResponse.json({ repo });
    } catch (error) {
        console.error("[RepositoryConfig] GET error:", error);
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

        const existing = await prisma.repositoryConfig.findFirst({
            where: { id, organizationId: authResult.organizationId }
        });

        if (!existing) {
            return NextResponse.json({ error: "Repository config not found" }, { status: 404 });
        }

        const {
            name,
            baseBranch,
            installCommand,
            buildCommand,
            testCommand,
            codingStandards,
            codingAgentSlug,
            metadata
        } = body;

        const repo = await prisma.repositoryConfig.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(baseBranch !== undefined && { baseBranch }),
                ...(installCommand !== undefined && { installCommand }),
                ...(buildCommand !== undefined && { buildCommand }),
                ...(testCommand !== undefined && { testCommand }),
                ...(codingStandards !== undefined && { codingStandards }),
                ...(codingAgentSlug !== undefined && { codingAgentSlug }),
                ...(metadata !== undefined && { metadata })
            }
        });

        return NextResponse.json({ repo });
    } catch (error) {
        console.error("[RepositoryConfig] PUT error:", error);
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

        const existing = await prisma.repositoryConfig.findFirst({
            where: { id, organizationId: authResult.organizationId }
        });

        if (!existing) {
            return NextResponse.json({ error: "Repository config not found" }, { status: 404 });
        }

        await prisma.repositoryConfig.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[RepositoryConfig] DELETE error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const repositoryConfigId = searchParams.get("repositoryConfigId");

        const scenarios = await prisma.pipelineScenario.findMany({
            where: {
                repositoryConfig: {
                    organizationId: authResult.organizationId
                },
                ...(repositoryConfigId ? { repositoryConfigId } : {})
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ scenarios });
    } catch (error) {
        console.error("[PipelineScenario] GET error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { repositoryConfigId, name, description, prompt, expectedOutcome, isHoldout } = body;

        if (!repositoryConfigId || !name || !prompt) {
            return NextResponse.json(
                { error: "Missing required fields: repositoryConfigId, name, prompt" },
                { status: 400 }
            );
        }

        const repoConfig = await prisma.repositoryConfig.findFirst({
            where: { id: repositoryConfigId, organizationId: authResult.organizationId }
        });

        if (!repoConfig) {
            return NextResponse.json(
                { error: "Repository config not found or not owned by your organization" },
                { status: 404 }
            );
        }

        const scenario = await prisma.pipelineScenario.create({
            data: {
                repositoryConfigId,
                name,
                description: description ?? null,
                prompt,
                expectedOutcome: expectedOutcome ?? null,
                isHoldout: isHoldout ?? false
            }
        });

        return NextResponse.json({ scenario }, { status: 201 });
    } catch (error) {
        console.error("[PipelineScenario] POST error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

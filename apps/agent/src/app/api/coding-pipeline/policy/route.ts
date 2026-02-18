import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const policy = await prisma.pipelinePolicy.findUnique({
            where: { organizationId: authResult.organizationId }
        });

        return NextResponse.json({
            policy: policy ?? {
                enabled: false,
                autoApprovePlanBelow: "medium",
                autoApprovePrBelow: "low",
                allowedRepos: []
            }
        });
    } catch (error) {
        console.error("[PipelinePolicy] GET error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { enabled, autoApprovePlanBelow, autoApprovePrBelow, allowedRepos } = body;

        const validRiskLevels = ["trivial", "low", "medium", "high", "critical"];

        if (autoApprovePlanBelow && !validRiskLevels.includes(autoApprovePlanBelow)) {
            return NextResponse.json(
                { error: `autoApprovePlanBelow must be one of: ${validRiskLevels.join(", ")}` },
                { status: 400 }
            );
        }

        if (autoApprovePrBelow && !validRiskLevels.includes(autoApprovePrBelow)) {
            return NextResponse.json(
                { error: `autoApprovePrBelow must be one of: ${validRiskLevels.join(", ")}` },
                { status: 400 }
            );
        }

        const policy = await prisma.pipelinePolicy.upsert({
            where: { organizationId: authResult.organizationId },
            update: {
                ...(enabled !== undefined && { enabled }),
                ...(autoApprovePlanBelow && { autoApprovePlanBelow }),
                ...(autoApprovePrBelow && { autoApprovePrBelow }),
                ...(allowedRepos && { allowedRepos })
            },
            create: {
                organizationId: authResult.organizationId,
                enabled: enabled ?? false,
                autoApprovePlanBelow: autoApprovePlanBelow ?? "medium",
                autoApprovePrBelow: autoApprovePrBelow ?? "low",
                allowedRepos: allowedRepos ?? []
            }
        });

        return NextResponse.json({ policy });
    } catch (error) {
        console.error("[PipelinePolicy] PUT error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

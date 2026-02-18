import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const repos = await prisma.repositoryConfig.findMany({
            where: { organizationId: authResult.organizationId },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ repos });
    } catch (error) {
        console.error("[RepositoryConfig] GET error:", error);
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
        const {
            repositoryUrl,
            name,
            baseBranch,
            installCommand,
            buildCommand,
            testCommand,
            codingStandards,
            codingAgentSlug,
            metadata
        } = body;

        if (!repositoryUrl) {
            return NextResponse.json(
                { error: "Missing required field: repositoryUrl" },
                { status: 400 }
            );
        }

        const repo = await prisma.repositoryConfig.create({
            data: {
                organizationId: authResult.organizationId,
                repositoryUrl,
                name: name ?? null,
                baseBranch: baseBranch ?? "main",
                installCommand: installCommand ?? "bun install",
                buildCommand: buildCommand ?? "bun run type-check && bun run lint && bun run build",
                testCommand: testCommand ?? null,
                codingStandards: codingStandards ?? null,
                codingAgentSlug: codingAgentSlug ?? null,
                metadata: metadata ?? null
            }
        });

        return NextResponse.json({ repo }, { status: 201 });
    } catch (error) {
        console.error("[RepositoryConfig] POST error:", error);
        if (error instanceof Error && error.message.includes("Unique constraint failed")) {
            return NextResponse.json(
                {
                    error: "Repository config already exists for this org + URL. Use PUT to update."
                },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

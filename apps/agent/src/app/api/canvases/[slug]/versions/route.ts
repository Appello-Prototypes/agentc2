import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma, type Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/canvases/[slug]/versions - List version history
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({ headers: await headers() });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await params;

        const canvas = await prisma.canvas.findUnique({
            where: { slug },
            select: { id: true }
        });

        if (!canvas) {
            return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
        }

        const versions = await prisma.canvasVersion.findMany({
            where: { canvasId: canvas.id },
            orderBy: { version: "desc" },
            select: {
                id: true,
                version: true,
                changelog: true,
                createdAt: true,
                createdBy: true
            }
        });

        return NextResponse.json({ versions });
    } catch (error) {
        console.error("List canvas versions error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list versions" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvases/[slug]/versions - Rollback to a specific version
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({ headers: await headers() });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await params;
        const body = await request.json();
        const { version: targetVersion } = body;

        if (!targetVersion) {
            return NextResponse.json(
                { error: "version is required for rollback" },
                { status: 400 }
            );
        }

        const canvas = await prisma.canvas.findUnique({ where: { slug } });
        if (!canvas) {
            return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
        }

        const targetVersionRecord = await prisma.canvasVersion.findUnique({
            where: {
                canvasId_version: {
                    canvasId: canvas.id,
                    version: targetVersion
                }
            }
        });

        if (!targetVersionRecord) {
            return NextResponse.json(
                { error: `Version ${targetVersion} not found` },
                { status: 404 }
            );
        }

        const newVersion = canvas.version + 1;

        // Create a new version from the rollback target
        const rollbackSchema = targetVersionRecord.schemaJson as Prisma.InputJsonValue;
        await prisma.canvasVersion.create({
            data: {
                canvasId: canvas.id,
                version: newVersion,
                schemaJson: rollbackSchema,
                changelog: `Rolled back to version ${targetVersion}`,
                createdBy: userId
            }
        });

        // Update the canvas with the rolled-back schema
        const updated = await prisma.canvas.update({
            where: { slug },
            data: {
                schemaJson: rollbackSchema,
                version: newVersion
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Rollback canvas error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to rollback" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/canvases/[slug] - Get a single canvas
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;

        // Allow public access for published canvases with token
        const { searchParams } = new URL(request.url);
        const publicToken = searchParams.get("token");

        let canvas;

        if (publicToken) {
            canvas = await prisma.canvas.findFirst({
                where: { slug, isPublic: true, publicToken },
                include: {
                    versions: {
                        orderBy: { version: "desc" },
                        take: 1
                    }
                }
            });
        } else {
            // Require auth for non-public access
            const apiAuth = await authenticateRequest(request);
            let userId = apiAuth?.userId;

            if (!userId) {
                const session = await auth.api.getSession({ headers: await headers() });
                userId = session?.user?.id;
            }

            if (!userId) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            canvas = await prisma.canvas.findUnique({
                where: { slug },
                include: {
                    versions: {
                        orderBy: { version: "desc" },
                        take: 5
                    }
                }
            });
        }

        if (!canvas) {
            return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
        }

        return NextResponse.json(canvas);
    } catch (error) {
        console.error("Get canvas error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get canvas" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/canvases/[slug] - Update a canvas
 */
export async function PATCH(
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

        const existing = await prisma.canvas.findUnique({ where: { slug } });
        if (!existing) {
            return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {};
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.tags !== undefined) updateData.tags = body.tags;
        if (body.category !== undefined) updateData.category = body.category;
        if (body.metadata !== undefined) updateData.metadata = body.metadata;
        if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
        if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail;

        // If schema is being updated, create a new version
        if (body.schemaJson) {
            const newVersion = existing.version + 1;
            updateData.schemaJson = body.schemaJson;
            updateData.dataQueries = body.schemaJson.dataQueries || existing.dataQueries;
            updateData.version = newVersion;

            await prisma.canvasVersion.create({
                data: {
                    canvasId: existing.id,
                    version: newVersion,
                    schemaJson: body.schemaJson,
                    changelog: body.changelog || `Updated to version ${newVersion}`,
                    createdBy: userId
                }
            });
        }

        // Generate public token if making public for the first time
        if (body.isPublic && !existing.isPublic && !existing.publicToken) {
            updateData.publicToken = generateToken();
        }

        const canvas = await prisma.canvas.update({
            where: { slug },
            data: updateData
        });

        return NextResponse.json(canvas);
    } catch (error) {
        console.error("Update canvas error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update canvas" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/canvases/[slug] - Delete a canvas
 */
export async function DELETE(
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

        await prisma.canvas.delete({ where: { slug } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete canvas error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete canvas" },
            { status: 500 }
        );
    }
}

function generateToken(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

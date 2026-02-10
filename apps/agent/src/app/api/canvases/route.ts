import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";

/**
 * GET /api/canvases - List all canvases
 */
export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category") || undefined;
        const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
        const skip = parseInt(searchParams.get("skip") || "0", 10);
        const take = parseInt(searchParams.get("take") || "50", 10);
        const workspaceId =
            searchParams.get("workspaceId") ||
            (await getDefaultWorkspaceIdForUser(userId)) ||
            undefined;

        const where: Record<string, unknown> = {};
        if (workspaceId) where.workspaceId = workspaceId;
        if (category) where.category = category;
        if (tags && tags.length > 0) where.tags = { hasSome: tags };

        const [canvases, total] = await Promise.all([
            prisma.canvas.findMany({
                where,
                skip,
                take,
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    description: true,
                    thumbnail: true,
                    isPublished: true,
                    isActive: true,
                    version: true,
                    tags: true,
                    category: true,
                    agentId: true,
                    createdAt: true,
                    updatedAt: true,
                    schemaJson: true
                }
            }),
            prisma.canvas.count({ where })
        ]);

        // Extract lightweight preview info from schemaJson
        const canvasesWithPreview = canvases.map((c) => {
            const schema = c.schemaJson as Record<string, unknown> | null;
            const components = (schema?.components as Array<Record<string, unknown>>) || [];
            const layout = schema?.layout as Record<string, unknown> | undefined;

            return {
                ...c,
                schemaJson: undefined, // Don't send the full schema
                preview: {
                    layout: layout
                        ? {
                              type: layout.type || "grid",
                              columns: layout.columns || 12
                          }
                        : { type: "grid", columns: 12 },
                    components: components.map((comp) => ({
                        type: comp.type as string,
                        span: (comp.span as number) || 12,
                        row: comp.row as string | undefined,
                        title: comp.title as string | undefined
                    }))
                }
            };
        });

        return NextResponse.json({ canvases: canvasesWithPreview, total, skip, take });
    } catch (error) {
        console.error("List canvases error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list canvases" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvases - Create a new canvas
 */
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { slug, title, description, schemaJson, tags, category, metadata, agentId } = body;

        if (!slug || !title || !schemaJson) {
            return NextResponse.json(
                { error: "slug, title, and schemaJson are required" },
                { status: 400 }
            );
        }

        const workspaceId =
            body.workspaceId || (await getDefaultWorkspaceIdForUser(userId)) || undefined;

        // Extract data queries from schema for the query executor
        const dataQueries = schemaJson.dataQueries || [];

        const canvas = await prisma.canvas.create({
            data: {
                slug,
                title,
                description,
                schemaJson,
                dataQueries: dataQueries.length > 0 ? dataQueries : undefined,
                workspaceId,
                ownerId: userId,
                createdBy: userId,
                agentId,
                tags: tags || [],
                category,
                metadata
            }
        });

        // Create initial version
        await prisma.canvasVersion.create({
            data: {
                canvasId: canvas.id,
                version: 1,
                schemaJson,
                changelog: "Initial version",
                createdBy: userId
            }
        });

        return NextResponse.json(canvas, { status: 201 });
    } catch (error) {
        console.error("Create canvas error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create canvas" },
            { status: 500 }
        );
    }
}

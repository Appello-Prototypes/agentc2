import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";
import type { Prisma } from "@repo/database";
import { listCanvasTemplates, getCanvasTemplate } from "@/lib/canvas-templates";

/**
 * GET /api/canvas/templates - List available canvas templates
 */
export async function GET() {
    try {
        const templates = listCanvasTemplates();
        return NextResponse.json({ templates });
    } catch (error) {
        console.error("List templates error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to list templates"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvas/templates - Instantiate a template as a new canvas
 *
 * Body: { templateSlug: string, slug?: string, title?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { templateSlug, slug: customSlug, title: customTitle } = body;

        if (!templateSlug) {
            return NextResponse.json({ error: "templateSlug is required" }, { status: 400 });
        }

        const template = getCanvasTemplate(templateSlug);
        if (!template) {
            return NextResponse.json(
                { error: `Template "${templateSlug}" not found` },
                { status: 404 }
            );
        }

        // Generate a unique slug if not provided
        const timestamp = Date.now().toString(36);
        const finalSlug = customSlug || `${template.slug}-${timestamp}`;
        const finalTitle = customTitle || template.title;

        const workspaceId =
            body.workspaceId || (await getDefaultWorkspaceIdForUser(userId)) || undefined;

        // Extract data queries from the template schema
        const dataQueries = template.schemaJson.dataQueries || [];

        const schemaJsonValue = template.schemaJson as unknown as Prisma.InputJsonValue;
        const dataQueriesValue =
            dataQueries.length > 0 ? (dataQueries as unknown as Prisma.InputJsonValue) : undefined;

        const canvas = await prisma.canvas.create({
            data: {
                slug: finalSlug,
                title: finalTitle,
                description: template.description,
                schemaJson: schemaJsonValue,
                dataQueries: dataQueriesValue,
                workspaceId,
                ownerId: userId,
                createdBy: userId,
                tags: template.tags,
                category: template.category
            }
        });

        // Create initial version
        await prisma.canvasVersion.create({
            data: {
                canvasId: canvas.id,
                version: 1,
                schemaJson: schemaJsonValue,
                changelog: `Created from template: ${template.title}`,
                createdBy: userId
            }
        });

        return NextResponse.json(canvas, { status: 201 });
    } catch (error) {
        console.error("Instantiate template error:", error);

        // Handle unique constraint violations
        if (error instanceof Error && error.message.includes("Unique constraint")) {
            return NextResponse.json(
                {
                    error: "A canvas with that slug already exists. Try a different name."
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error ? error.message : "Failed to create canvas from template"
            },
            { status: 500 }
        );
    }
}

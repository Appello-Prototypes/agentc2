import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { SCORECARD_TEMPLATES } from "@repo/mastra/scorers";

/**
 * GET /api/agents/[id]/scorecard/templates
 *
 * Lists all available scorecard templates.
 * Also seeds templates into the database if not yet created.
 */
export async function GET() {
    try {
        // Ensure templates are seeded in the database
        const existingCount = await prisma.scorecardTemplate.count();
        if (existingCount === 0) {
            for (const template of SCORECARD_TEMPLATES) {
                await prisma.scorecardTemplate.upsert({
                    where: { slug: template.slug },
                    update: {},
                    create: {
                        slug: template.slug,
                        name: template.name,
                        description: template.description,
                        category: template.category,
                        criteria: template.criteria as unknown as Prisma.InputJsonValue,
                        isSystem: true
                    }
                });
            }
        }

        const templates = await prisma.scorecardTemplate.findMany({
            orderBy: { name: "asc" }
        });

        return NextResponse.json({
            success: true,
            templates: templates.map((t) => ({
                id: t.id,
                slug: t.slug,
                name: t.name,
                description: t.description,
                category: t.category,
                criteria: t.criteria,
                isSystem: t.isSystem
            }))
        });
    } catch (error) {
        console.error("[Scorecard Templates] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list templates"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/scorecard/templates
 *
 * Create scorecard from a template.
 * Body: { templateSlug: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { templateSlug } = body as { templateSlug: string };

        if (!templateSlug) {
            return NextResponse.json(
                { success: false, error: "templateSlug is required" },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const template = await prisma.scorecardTemplate.findUnique({
            where: { slug: templateSlug }
        });

        if (!template) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Template '${templateSlug}' not found`
                },
                { status: 404 }
            );
        }

        // Check if scorecard exists
        const existing = await prisma.agentScorecard.findUnique({
            where: { agentId: agent.id }
        });

        let scorecard;
        if (existing) {
            scorecard = await prisma.agentScorecard.update({
                where: { agentId: agent.id },
                data: {
                    criteria: template.criteria as Prisma.InputJsonValue,
                    templateId: template.id,
                    version: existing.version + 1
                }
            });
        } else {
            scorecard = await prisma.agentScorecard.create({
                data: {
                    agentId: agent.id,
                    tenantId: agent.tenantId,
                    criteria: template.criteria as Prisma.InputJsonValue,
                    templateId: template.id
                }
            });
        }

        return NextResponse.json({
            success: true,
            scorecard: {
                id: scorecard.id,
                agentId: scorecard.agentId,
                criteria: scorecard.criteria,
                version: scorecard.version,
                templateId: scorecard.templateId,
                samplingRate: scorecard.samplingRate,
                auditorModel: scorecard.auditorModel,
                evaluateTurns: scorecard.evaluateTurns
            }
        });
    } catch (error) {
        console.error("[Scorecard From Template] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create scorecard from template"
            },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/playbooks/[slug]/reviews
 * List reviews (public)
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { slug } = await params;
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        const [reviews, total] = await Promise.all([
            prisma.playbookReview.findMany({
                where: { playbookId: playbook.id },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    rating: true,
                    title: true,
                    body: true,
                    createdAt: true,
                    reviewerOrg: {
                        select: { name: true, slug: true, logoUrl: true }
                    }
                }
            }),
            prisma.playbookReview.count({ where: { playbookId: playbook.id } })
        ]);

        return NextResponse.json({ reviews, total });
    } catch (error) {
        console.error("[playbooks] Reviews list error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/playbooks/[slug]/reviews
 * Submit a review (buyer only)
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const { userId, organizationId } = authResult.context;
        const body = await request.json();

        if (!body.rating || body.rating < 1 || body.rating > 5) {
            return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
        }

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        // Must have an active installation to review
        const installation = await prisma.playbookInstallation.findUnique({
            where: {
                playbookId_targetOrgId: {
                    playbookId: playbook.id,
                    targetOrgId: organizationId
                }
            }
        });
        if (!installation || installation.status === "UNINSTALLED") {
            return NextResponse.json(
                { error: "Must have an active installation to review" },
                { status: 403 }
            );
        }

        const review = await prisma.playbookReview.upsert({
            where: {
                playbookId_reviewerOrgId: {
                    playbookId: playbook.id,
                    reviewerOrgId: organizationId
                }
            },
            create: {
                playbookId: playbook.id,
                reviewerOrgId: organizationId,
                reviewerUserId: userId,
                rating: body.rating,
                title: body.title ?? null,
                body: body.body ?? null
            },
            update: {
                rating: body.rating,
                title: body.title ?? null,
                body: body.body ?? null,
                reviewerUserId: userId
            }
        });

        // Update playbook aggregate stats
        const stats = await prisma.playbookReview.aggregate({
            where: { playbookId: playbook.id },
            _avg: { rating: true },
            _count: { rating: true }
        });

        await prisma.playbook.update({
            where: { id: playbook.id },
            data: {
                averageRating: stats._avg.rating,
                reviewCount: stats._count.rating
            }
        });

        return NextResponse.json({ review }, { status: 201 });
    } catch (error) {
        console.error("[playbooks] Review submit error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

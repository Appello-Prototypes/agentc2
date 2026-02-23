import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/playbooks/[slug]
 * Get playbook details (public — no auth required)
 */
export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { slug } = await params;

        const playbook = await prisma.playbook.findUnique({
            where: { slug },
            include: {
                publisherOrg: {
                    select: { id: true, name: true, slug: true, logoUrl: true }
                },
                components: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                        id: true,
                        componentType: true,
                        sourceSlug: true,
                        configSnapshot: true,
                        isEntryPoint: true,
                        sortOrder: true
                    }
                },
                versions: {
                    orderBy: { version: "desc" },
                    take: 5,
                    select: {
                        id: true,
                        version: true,
                        changelog: true,
                        createdAt: true
                    }
                },
                reviews: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        rating: true,
                        title: true,
                        body: true,
                        createdAt: true,
                        reviewerOrg: {
                            select: { name: true, slug: true }
                        }
                    }
                }
            }
        });

        if (!playbook || (playbook.status !== "PUBLISHED" && playbook.status !== "DRAFT")) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }

        return NextResponse.json({ playbook });
    } catch (error) {
        console.error("[playbooks] Detail error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/playbooks/[slug]
 * Update playbook metadata (owner only)
 */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const { slug } = await params;
        const body = await request.json();

        const playbook = await prisma.playbook.findUnique({ where: { slug } });
        if (!playbook) {
            return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
        }
        if (playbook.publisherOrgId !== authResult.context.organizationId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const updated = await prisma.playbook.update({
            where: { slug },
            data: {
                name: body.name ?? undefined,
                tagline: body.tagline ?? undefined,
                description: body.description ?? undefined,
                longDescription: body.longDescription ?? undefined,
                category: body.category ?? undefined,
                tags: body.tags ?? undefined,
                coverImageUrl: body.coverImageUrl ?? undefined,
                iconUrl: body.iconUrl ?? undefined,
                pricingModel: body.pricingModel ?? undefined,
                priceUsd: body.priceUsd ?? undefined,
                monthlyPriceUsd: body.monthlyPriceUsd ?? undefined,
                perUsePriceUsd: body.perUsePriceUsd ?? undefined
            }
        });

        return NextResponse.json({ playbook: updated });
    } catch (error) {
        console.error("[playbooks] Update error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

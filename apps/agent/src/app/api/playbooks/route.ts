import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@repo/database";

/**
 * GET /api/playbooks
 * Browse published playbooks (public — no auth required)
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const category = url.searchParams.get("category") ?? undefined;
        const search = url.searchParams.get("search") ?? undefined;
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

        const where: Record<string, unknown> = { status: "PUBLISHED" };
        if (category) where.category = category;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { tagline: { contains: search, mode: "insensitive" } },
                { tags: { has: search.toLowerCase() } }
            ];
        }

        const [playbooks, total] = await Promise.all([
            prisma.playbook.findMany({
                where,
                orderBy: [{ installCount: "desc" }, { createdAt: "desc" }],
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    tagline: true,
                    description: true,
                    category: true,
                    tags: true,
                    coverImageUrl: true,
                    iconUrl: true,
                    pricingModel: true,
                    priceUsd: true,
                    monthlyPriceUsd: true,
                    installCount: true,
                    averageRating: true,
                    reviewCount: true,
                    trustScore: true,
                    requiredIntegrations: true,
                    version: true,
                    createdAt: true,
                    publisherOrg: {
                        select: { id: true, name: true, slug: true, logoUrl: true }
                    },
                    _count: { select: { components: true } }
                }
            }),
            prisma.playbook.count({ where })
        ]);

        return NextResponse.json({ playbooks, total });
    } catch (error) {
        console.error("[playbooks] Browse error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/playbooks
 * Create a new playbook (builder)
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const body = await request.json();
        const {
            name,
            slug,
            description,
            category,
            tags,
            tagline,
            pricingModel,
            priceUsd,
            monthlyPriceUsd,
            perUsePriceUsd,
            coverImageUrl,
            iconUrl
        } = body;

        if (!name || !slug || !description || !category) {
            return NextResponse.json(
                { error: "name, slug, description, and category are required" },
                { status: 400 }
            );
        }

        const existing = await prisma.playbook.findUnique({ where: { slug } });
        if (existing) {
            return NextResponse.json(
                { error: "A playbook with this slug already exists" },
                { status: 409 }
            );
        }

        const playbook = await prisma.playbook.create({
            data: {
                slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                name,
                description,
                tagline: tagline ?? null,
                category,
                tags: tags ?? [],
                coverImageUrl: coverImageUrl ?? null,
                iconUrl: iconUrl ?? null,
                publisherOrgId: authResult.context.organizationId,
                publishedByUserId: authResult.context.userId,
                pricingModel: pricingModel ?? "FREE",
                priceUsd: priceUsd ?? null,
                monthlyPriceUsd: monthlyPriceUsd ?? null,
                perUsePriceUsd: perUsePriceUsd ?? null
            }
        });

        return NextResponse.json({ playbook }, { status: 201 });
    } catch (error) {
        console.error("[playbooks] Create error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

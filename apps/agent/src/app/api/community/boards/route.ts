import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { organizationId } = auth.context;

        const { searchParams } = new URL(request.url);
        const pulseId = searchParams.get("pulseId");

        const boards = await prisma.communityBoard.findMany({
            where: {
                ...(pulseId ? { pulseId } : { OR: [{ scope: "global" }, { organizationId }] })
            },
            include: {
                _count: { select: { posts: true, members: true } }
            },
            orderBy: [{ scope: "asc" }, { createdAt: "desc" }]
        });

        const mapped = boards.map((b) => ({
            ...b,
            postCount: b._count.posts,
            memberCount: b._count.members,
            _count: undefined
        }));

        return NextResponse.json({ success: true, boards: mapped });
    } catch (error) {
        console.error("[community/boards] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { organizationId } = auth.context;

        const body = await request.json();
        const { name, description, scope, culturePrompt, isDefault } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "Name is required" },
                { status: 400 }
            );
        }

        const boardScope = scope === "global" ? "global" : "organization";

        let slug = generateSlug(name);
        let suffix = 2;
        while (await prisma.communityBoard.findUnique({ where: { slug } })) {
            slug = `${generateSlug(name)}-${suffix}`;
            suffix++;
        }

        const board = await prisma.communityBoard.create({
            data: {
                slug,
                name,
                description: description || null,
                scope: boardScope,
                organizationId: boardScope === "organization" ? organizationId : null,
                culturePrompt: culturePrompt || null,
                isDefault: isDefault || false
            }
        });

        return NextResponse.json({ success: true, board }, { status: 201 });
    } catch (error) {
        console.error("[community/boards] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

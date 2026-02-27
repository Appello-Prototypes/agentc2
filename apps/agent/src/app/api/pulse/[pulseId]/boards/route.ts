import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { pulseId } = await params;

        const boards = await prisma.communityBoard.findMany({
            where: { pulseId },
            include: {
                _count: { select: { posts: true, members: true } }
            },
            orderBy: { createdAt: "asc" }
        });

        const mapped = boards.map((b) => ({
            ...b,
            postCount: b._count.posts,
            memberCount: b._count.members,
            _count: undefined
        }));

        return NextResponse.json({ success: true, boards: mapped });
    } catch (error) {
        console.error("[pulse/boards] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { pulseId } = await params;
        const body = await request.json();
        const { name, description, culturePrompt } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "name is required" },
                { status: 400 }
            );
        }

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
                description: description ?? null,
                scope: "global",
                culturePrompt: culturePrompt ?? null,
                pulseId
            }
        });

        return NextResponse.json({ success: true, board }, { status: 201 });
    } catch (error) {
        console.error("[pulse/boards] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

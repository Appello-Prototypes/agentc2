import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { pulseId } = await params;

        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") ?? "20", 10);
        const offset = parseInt(searchParams.get("offset") ?? "0", 10);

        const [evaluations, total] = await Promise.all([
            prisma.pulseEvaluation.findMany({
                where: { pulseId },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset
            }),
            prisma.pulseEvaluation.count({ where: { pulseId } })
        ]);

        return NextResponse.json({ success: true, evaluations, total });
    } catch (error) {
        console.error("[pulse/evaluations] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

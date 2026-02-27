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

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get("status");

        const pulses = await prisma.pulse.findMany({
            where: {
                ...(status ? { status: status as "ACTIVE" | "PAUSED" | "ARCHIVED" } : {})
            },
            include: {
                _count: { select: { members: true, boards: true, evaluations: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const mapped = pulses.map((p) => ({
            ...p,
            memberCount: p._count.members,
            boardCount: p._count.boards,
            evaluationCount: p._count.evaluations,
            _count: undefined
        }));

        return NextResponse.json({ success: true, pulses: mapped });
    } catch (error) {
        console.error("[pulse] GET error:", error);
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
        const { userId } = auth.context;

        const body = await request.json();
        const {
            name,
            goal,
            description,
            metricsConfig,
            rewardConfig,
            evalCronExpr,
            evalTimezone,
            evalWindowDays,
            reportConfig
        } = body;

        if (!name || !goal) {
            return NextResponse.json(
                { success: false, error: "name and goal are required" },
                { status: 400 }
            );
        }

        let slug = generateSlug(name);
        let suffix = 2;
        while (await prisma.pulse.findUnique({ where: { slug } })) {
            slug = `${generateSlug(name)}-${suffix}`;
            suffix++;
        }

        const pulse = await prisma.pulse.create({
            data: {
                slug,
                name,
                goal,
                description: description ?? null,
                metricsConfig: metricsConfig ?? {
                    communityPosts: 3,
                    communityComments: 2,
                    communityVotes: 1,
                    avgEvalScore: 10
                },
                rewardConfig: rewardConfig ?? {
                    baseMaxSteps: 8,
                    baseFrequencyMinutes: 60,
                    tiers: []
                },
                evalCronExpr: evalCronExpr ?? "0 23 * * 0",
                evalTimezone: evalTimezone ?? "America/Toronto",
                evalWindowDays: evalWindowDays ?? 7,
                reportConfig: reportConfig ?? null,
                createdBy: userId
            }
        });

        return NextResponse.json({ success: true, pulse }, { status: 201 });
    } catch (error) {
        console.error("[pulse] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

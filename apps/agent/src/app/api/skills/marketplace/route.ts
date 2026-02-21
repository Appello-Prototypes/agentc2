import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { listPublicSkills, publishSkill } from "@repo/agentc2/skills/marketplace";

/**
 * GET /api/skills/marketplace
 *
 * Browse publicly available skills.
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const url = new URL(request.url);
        const category = url.searchParams.get("category") ?? undefined;
        const search = url.searchParams.get("search") ?? undefined;
        const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

        const result = await listPublicSkills({ category, search, limit, offset });
        return NextResponse.json(result);
    } catch (error) {
        console.error("[marketplace] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/skills/marketplace
 *
 * Publish a skill to the marketplace.
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const body = await request.json();
        if (!body.skillId) {
            return NextResponse.json({ error: "skillId is required" }, { status: 400 });
        }

        const skill = await publishSkill(body.skillId);
        return NextResponse.json({ skill }, { status: 200 });
    } catch (error) {
        console.error("[marketplace] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

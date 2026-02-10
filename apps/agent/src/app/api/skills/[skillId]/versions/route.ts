import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getSkillVersions } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * GET /api/skills/[skillId]/versions
 *
 * Retrieves version history for a skill.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({ headers: await headers() });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { skillId } = await context.params;
        const versions = await getSkillVersions(skillId);

        return NextResponse.json({ versions });
    } catch (error) {
        console.error("Get skill versions error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get skill versions" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getSkill, getSkillVersions } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * GET /api/skills/[skillId]/versions
 *
 * Retrieves version history for a skill.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const authCtx = await authenticateRequest(request);
        if (!authCtx) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { skillId } = await context.params;

        const skill = await getSkill(skillId, authCtx.organizationId);
        if (!skill) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        const versions = await getSkillVersions(skill.id);

        return NextResponse.json({ versions });
    } catch (error) {
        console.error("Get skill versions error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get skill versions" },
            { status: 500 }
        );
    }
}

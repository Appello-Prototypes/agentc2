import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getSkill, updateSkill, deleteSkill, type UpdateSkillInput } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * GET /api/skills/[skillId]
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
        const skill = await getSkill(skillId);

        if (!skill) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        return NextResponse.json(skill);
    } catch (error) {
        console.error("Get skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get skill" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/skills/[skillId]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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
        const body = await request.json();

        const input: UpdateSkillInput = {
            name: body.name,
            description: body.description,
            instructions: body.instructions,
            examples: body.examples,
            category: body.category,
            tags: body.tags,
            metadata: body.metadata,
            changeSummary: body.changeSummary,
            createdBy: userId
        };

        const skill = await updateSkill(skillId, input);

        return NextResponse.json(skill);
    } catch (error) {
        console.error("Update skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update skill" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/skills/[skillId]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

        await deleteSkill(skillId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete skill" },
            { status: 500 }
        );
    }
}

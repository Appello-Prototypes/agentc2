import { NextRequest, NextResponse } from "next/server";
import { createSkill, listSkills, type CreateSkillInput } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";

/**
 * GET /api/skills
 */
export async function GET(request: NextRequest) {
    try {
        const authCtx = await authenticateRequest(request);
        if (!authCtx) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category") || undefined;
        const type = searchParams.get("type") === "USER" ? "USER" : undefined;
        const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
        const skip = parseInt(searchParams.get("skip") || "0", 10);
        const take = parseInt(searchParams.get("take") || "50", 10);
        const workspaceId =
            searchParams.get("workspaceId") ||
            (await getDefaultWorkspaceIdForUser(authCtx.userId, authCtx.organizationId)) ||
            undefined;

        const result = await listSkills({
            workspaceId,
            organizationId: authCtx.organizationId,
            category,
            tags,
            skip,
            take
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("List skills error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list skills" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/skills
 */
export async function POST(request: NextRequest) {
    try {
        const authCtx = await authenticateRequest(request);
        if (!authCtx) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { slug, name, instructions, description, examples, category, tags, metadata, type } =
            body;

        if (!slug || !name || !instructions) {
            return NextResponse.json(
                { error: "slug, name, and instructions are required" },
                { status: 400 }
            );
        }

        const workspaceId =
            body.workspaceId ||
            (await getDefaultWorkspaceIdForUser(authCtx.userId, authCtx.organizationId)) ||
            undefined;

        const input: CreateSkillInput = {
            slug,
            name,
            description,
            instructions,
            examples,
            category,
            tags,
            metadata,
            workspaceId,
            organizationId: authCtx.organizationId,
            createdBy: authCtx.userId
        };

        const skill = await createSkill(input);

        return NextResponse.json(skill, { status: 201 });
    } catch (error) {
        console.error("Create skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create skill" },
            { status: 500 }
        );
    }
}

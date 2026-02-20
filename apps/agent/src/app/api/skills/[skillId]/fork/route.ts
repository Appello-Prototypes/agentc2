/**
 * POST /api/skills/[skillId]/fork
 *
 * Fork/customize a skill — creates a USER copy of a SYSTEM skill.
 * Body: { slug?, name? }
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { forkSkill } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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
        const body = await request.json().catch(() => ({}));
        const { slug, name } = body as { slug?: string; name?: string };

        const forked = await forkSkill(skillId, {
            slug,
            name,
            createdBy: userId
        });

        return NextResponse.json({ skill: forked }, { status: 201 });
    } catch (error) {
        console.error("Fork skill error:", error);
        const message = error instanceof Error ? error.message : "Failed to fork skill";
        const status = message.includes("not found") ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

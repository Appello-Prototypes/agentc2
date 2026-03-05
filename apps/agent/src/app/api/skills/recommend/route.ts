/**
 * GET /api/skills/recommend?agentId=...
 *
 * Recommend skills for an agent based on its instructions.
 * Used by the agent configuration UI and skill-builder agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { recommendSkills } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const agentId = request.nextUrl.searchParams.get("agentId");
        const maxResults = parseInt(request.nextUrl.searchParams.get("maxResults") || "10", 10);

        if (!agentId) {
            return NextResponse.json(
                { error: "agentId query parameter is required" },
                { status: 400 }
            );
        }

        // Get agent instructions
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ id: agentId }, { slug: agentId }],
                workspace: { organizationId: authContext.organizationId }
            },
            select: { id: true, slug: true, instructions: true, description: true }
        });

        if (!agent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const instructions = [agent.instructions, agent.description || ""].join("\n");

        const recommendations = await recommendSkills(instructions, {
            agentId: agent.id,
            maxResults,
            excludeAttached: true
        });

        return NextResponse.json({
            agentSlug: agent.slug,
            recommendations
        });
    } catch (error) {
        console.error("[Skills Recommend] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Recommendation failed" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/skills/recommend?agentId=...
 *
 * Recommend skills for an agent based on its instructions.
 * Used by the agent configuration UI and skill-builder agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { recommendSkills } from "@repo/mastra";

export async function GET(request: NextRequest) {
    try {
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
            where: { OR: [{ id: agentId }, { slug: agentId }] },
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/federation/agent-card
 *
 * A2A-compatible Agent Card endpoint.
 * Returns the Agent Card for a publicly-exposed agent.
 *
 * Query params:
 *   org  - Organization slug
 *   agent - Agent slug
 *
 * This endpoint is unauthenticated -- it returns only metadata
 * for agents explicitly marked as publicly discoverable.
 * Full invocation still requires a federation agreement.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orgSlug = searchParams.get("org");
        const agentSlug = searchParams.get("agent");

        if (!orgSlug || !agentSlug) {
            return NextResponse.json(
                { error: "org and agent query parameters are required" },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true, name: true, slug: true, status: true }
        });

        if (!org || org.status !== "active") {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // Find the agent and verify it has at least one federation exposure
        const agent = await prisma.agent.findFirst({
            where: {
                slug: agentSlug,
                workspace: { organizationId: org.id },
                isActive: true
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                tools: { select: { toolId: true } },
                federationExposures: {
                    where: { enabled: true },
                    select: { id: true, exposedSkills: true },
                    take: 1
                }
            }
        });

        if (!agent || agent.federationExposures.length === 0) {
            return NextResponse.json(
                { error: "Agent not found or not exposed for federation" },
                { status: 404 }
            );
        }

        const platformUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
        const exposure = agent.federationExposures[0]!;

        const card = {
            name: agent.name,
            description: agent.description,
            provider: {
                organization: org.name,
                platform: "AgentC2",
                url: platformUrl
            },
            url: `${platformUrl}/agent/api/federation/invoke`,
            version: "1.0.0",
            capabilities: {
                streaming: false,
                pushNotifications: false,
                stateTransitionHistory: true
            },
            authentication: {
                schemes: ["AgentC2-Federation", "Bearer"]
            },
            skills: agent.tools
                .filter(
                    (t) =>
                        exposure.exposedSkills.length === 0 ||
                        exposure.exposedSkills.includes(t.toolId)
                )
                .map((t) => ({
                    id: t.toolId,
                    name: t.toolId,
                    description: `Tool: ${t.toolId}`,
                    tags: [],
                    inputModes: ["text"],
                    outputModes: ["text", "application/json"]
                }))
        };

        return NextResponse.json(card, {
            headers: {
                "Cache-Control": "public, max-age=3600",
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        console.error("[Federation] Agent card error:", error);
        return NextResponse.json({ error: "Failed to generate agent card" }, { status: 500 });
    }
}

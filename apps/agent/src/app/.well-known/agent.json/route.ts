import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /.well-known/agent.json
 *
 * A2A spec-compliant discovery endpoint.
 * Returns the platform's master Agent Card listing all publicly
 * discoverable agents across all organizations.
 */
export async function GET(_request: NextRequest) {
    try {
        const platformUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";

        const exposures = await prisma.federationExposure.findMany({
            where: { enabled: true },
            select: {
                agent: {
                    select: {
                        slug: true,
                        name: true,
                        description: true,
                        tools: { select: { toolId: true }, take: 20 },
                        workspace: {
                            select: {
                                organization: {
                                    select: {
                                        name: true,
                                        slug: true,
                                        status: true
                                    }
                                }
                            }
                        }
                    }
                },
                exposedSkills: true
            },
            distinct: ["agentId"]
        });

        const activeExposures = exposures.filter(
            (e) => e.agent.workspace?.organization?.status === "active"
        );

        const card = {
            name: "AgentC2 Federation",
            description:
                "Multi-tenant AI agent platform supporting cross-organization agent collaboration via the AgentC2 Federation Protocol.",
            provider: {
                organization: "AgentC2",
                url: platformUrl
            },
            url: `${platformUrl}/agent/api/a2a`,
            version: "1.0.0",
            capabilities: {
                streaming: false,
                pushNotifications: false,
                stateTransitionHistory: true
            },
            authentication: {
                schemes: ["Bearer"],
                description:
                    "OAuth2 Bearer token. Obtain via AgentC2 API key or federation agreement."
            },
            skills: activeExposures.map((e) => ({
                id: `${e.agent.workspace?.organization?.slug}/${e.agent.slug}`,
                name: e.agent.name,
                description: e.agent.description || "",
                tags: [e.agent.workspace?.organization?.slug ?? ""],
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
        console.error("[A2A] Well-known agent card error:", error);
        return NextResponse.json({ error: "Failed to generate agent card" }, { status: 500 });
    }
}

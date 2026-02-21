import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /llms.txt
 *
 * Machine-readable sitemap for LLM agents.
 * Lists all publicly discoverable agents, skills, and API endpoints
 * in a concise format that agents can use for service discovery.
 */
export async function GET() {
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
                }
            },
            distinct: ["agentId"]
        });

        const activeExposures = exposures.filter(
            (e) => e.agent.workspace?.organization?.status === "active"
        );

        const lines: string[] = [
            "# AgentC2 Platform",
            "",
            "> Multi-tenant AI agent platform for building, deploying, and orchestrating AI agents.",
            "",
            "## Discovery Endpoints",
            "",
            `- Agent Card (A2A): ${platformUrl}/agent/.well-known/agent.json`,
            `- Full Documentation: ${platformUrl}/agent/llms-full.txt`,
            "",
            "## API",
            "",
            `- Agent Invocation: POST ${platformUrl}/agent/api/agents/{id}/invoke`,
            `- A2A Protocol: POST ${platformUrl}/agent/api/a2a`,
            `- MCP Server: ${platformUrl}/agent/api/mcp`,
            ""
        ];

        if (activeExposures.length > 0) {
            lines.push("## Available Agents", "");
            for (const e of activeExposures) {
                const orgSlug = e.agent.workspace?.organization?.slug ?? "unknown";
                lines.push(`- ${orgSlug}/${e.agent.slug}: ${e.agent.description || e.agent.name}`);
            }
            lines.push("");
        }

        return new NextResponse(lines.join("\n"), {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=3600"
            }
        });
    } catch (error) {
        console.error("[llms.txt] Error generating llms.txt:", error);
        return new NextResponse("# AgentC2 Platform\n\nError generating content.", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
    }
}

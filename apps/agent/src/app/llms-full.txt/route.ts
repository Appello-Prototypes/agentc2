import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /llms-full.txt
 *
 * Full machine-readable documentation for LLM agents.
 * Includes detailed agent descriptions, skills, tools,
 * and API documentation for agent-to-agent interaction.
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
                        instructions: true,
                        modelProvider: true,
                        modelName: true,
                        tools: { select: { toolId: true } },
                        skills: {
                            select: {
                                skill: {
                                    select: {
                                        name: true,
                                        slug: true,
                                        description: true
                                    }
                                }
                            }
                        },
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

        const lines: string[] = [
            "# AgentC2 Platform — Full Documentation",
            "",
            "> Multi-tenant AI agent platform for building, deploying, and orchestrating AI agents",
            "> with voice capabilities, MCP integrations, and background job processing.",
            "",
            "## Platform Overview",
            "",
            "AgentC2 is an AI agent framework built on the Mastra open-source platform.",
            "It supports multiple AI providers (OpenAI, Anthropic), RAG pipelines,",
            "MCP tool integrations, and cross-organization agent collaboration via the A2A protocol.",
            "",
            "## Discovery Endpoints",
            "",
            `- Agent Card (A2A): ${platformUrl}/agent/.well-known/agent.json`,
            `- Concise Summary: ${platformUrl}/agent/llms.txt`,
            "",
            "## API Reference",
            "",
            "### Agent Invocation",
            "",
            "```",
            `POST ${platformUrl}/agent/api/agents/{agentId}/invoke`,
            "Content-Type: application/json",
            "Authorization: Bearer <token>",
            "",
            '{ "messages": [{ "role": "user", "content": "..." }] }',
            "```",
            "",
            "### A2A Protocol",
            "",
            "```",
            `POST ${platformUrl}/agent/api/a2a`,
            "Content-Type: application/json",
            "Authorization: Bearer <token>",
            "",
            '{ "jsonrpc": "2.0", "method": "tasks/send", "params": { "task": { ... } } }',
            "```",
            "",
            "### MCP Server",
            "",
            `Endpoint: ${platformUrl}/agent/api/mcp`,
            "Protocol: Model Context Protocol (stdio or SSE transport)",
            ""
        ];

        if (activeExposures.length > 0) {
            lines.push("## Available Agents", "");
            for (const e of activeExposures) {
                const orgSlug = e.agent.workspace?.organization?.slug ?? "unknown";
                const agent = e.agent;
                lines.push(`### ${orgSlug}/${agent.slug}`, "");
                lines.push(`**Name:** ${agent.name}`);
                if (agent.description) {
                    lines.push(`**Description:** ${agent.description}`);
                }
                lines.push(`**Model:** ${agent.modelProvider}/${agent.modelName}`);

                if (agent.tools.length > 0) {
                    lines.push(`**Tools:** ${agent.tools.map((t) => t.toolId).join(", ")}`);
                }

                if (agent.skills.length > 0) {
                    lines.push("**Skills:**");
                    for (const s of agent.skills) {
                        lines.push(`  - ${s.skill.slug}: ${s.skill.description || s.skill.name}`);
                    }
                }

                lines.push("");
            }
        }

        return new NextResponse(lines.join("\n"), {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=3600"
            }
        });
    } catch (error) {
        console.error("[llms-full.txt] Error generating llms-full.txt:", error);
        return new NextResponse("# AgentC2 Platform\n\nError generating content.", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
    }
}

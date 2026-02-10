import { NextResponse } from "next/server";
import { resolveChannelCredentials } from "@/lib/channel-credentials";

/**
 * ElevenLabs Agent from API response
 */
interface ElevenLabsAgent {
    agent_id: string;
    name: string;
    tags?: string[];
    created_at_unix_secs?: number;
    archived?: boolean;
}

/**
 * Fetch all agents from ElevenLabs API
 */
async function fetchAgentsFromElevenLabs(apiKey: string): Promise<ElevenLabsAgent[]> {
    const response = await fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=100", {
        method: "GET",
        headers: {
            "xi-api-key": apiKey
        }
    });

    if (!response.ok) {
        console.error("Failed to fetch agents:", await response.text());
        return [];
    }

    const data = await response.json();
    // Filter out archived agents
    return (data.agents || []).filter((agent: ElevenLabsAgent) => !agent.archived);
}

/**
 * Filter agents that have MCP tools configured
 *
 * Agents with "mcp" or "tools" in their tags are considered MCP-enabled.
 * If no agents have these tags, all agents are returned.
 */
function filterMcpEnabledAgents(agents: ElevenLabsAgent[]): ElevenLabsAgent[] {
    const mcpAgents = agents.filter((agent) => {
        const tags = agent.tags?.map((t) => t.toLowerCase()) || [];
        return tags.some((tag) => tag.includes("mcp") || tag.includes("tools"));
    });

    // If no explicitly tagged agents, return all (user may not have set up tags)
    return mcpAgents.length > 0 ? mcpAgents : agents;
}

/**
 * GET /api/demos/live-agent-mcp/signed-url
 *
 * Returns a signed WebSocket URL for connecting to an MCP-enabled ElevenLabs agent.
 * This keeps the API key secure on the server side.
 *
 * Query params:
 * - agent: Agent ID to connect to
 * - list: If "true", returns list of available MCP-enabled agents
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get("agent");
    const listAgents = searchParams.get("list") === "true";

    const { credentials: elCreds } = await resolveChannelCredentials("elevenlabs");
    const apiKey = elCreds.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }

    // Return list of available MCP-enabled agents
    if (listAgents) {
        try {
            const allAgents = await fetchAgentsFromElevenLabs(apiKey);
            const mcpAgents = filterMcpEnabledAgents(allAgents);

            const availableAgents = mcpAgents.map((agent) => ({
                key: agent.agent_id,
                name: agent.name,
                description: agent.tags?.join(", ") || "Voice agent with MCP tools"
            }));

            return NextResponse.json({
                agents: availableAgents,
                mcpEnabled: true
            });
        } catch (error) {
            console.error("Error fetching agents:", error);
            return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
        }
    }

    // Use provided agent ID or fall back to environment variable
    const agentId =
        agentIdParam ||
        elCreds.ELEVENLABS_MCP_AGENT_ID ||
        elCreds.ELEVENLABS_AGENT_ID ||
        process.env.ELEVENLABS_MCP_AGENT_ID ||
        process.env.ELEVENLABS_AGENT_ID;

    if (!agentId) {
        return NextResponse.json(
            {
                error: "No agent specified. Set ELEVENLABS_MCP_AGENT_ID or pass ?agent=<id>"
            },
            { status: 400 }
        );
    }

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
            {
                method: "GET",
                headers: {
                    "xi-api-key": apiKey
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs API error:", errorText);
            return NextResponse.json(
                { error: "Failed to get signed URL from ElevenLabs" },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            signed_url: data.signed_url,
            agent_id: agentId,
            mcpEnabled: true
        });
    } catch (error) {
        console.error("Error getting signed URL:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

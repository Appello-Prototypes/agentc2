import { NextResponse } from "next/server";

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
 * GET /api/demos/voice/signed-url
 *
 * Returns a signed WebSocket URL for connecting to a private ElevenLabs agent.
 * This keeps the API key secure on the server side.
 *
 * Query params:
 * - agent: Agent ID to connect to
 * - list: If "true", returns list of available agents from ElevenLabs API
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get("agent");
    const listAgents = searchParams.get("list") === "true";

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }

    // Return list of available agents from ElevenLabs API
    if (listAgents) {
        try {
            const agents = await fetchAgentsFromElevenLabs(apiKey);
            const availableAgents = agents.map((agent) => ({
                key: agent.agent_id,
                name: agent.name,
                description: agent.tags?.join(", ") || "Voice agent"
            }));
            return NextResponse.json({ agents: availableAgents });
        } catch (error) {
            console.error("Error fetching agents:", error);
            return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
        }
    }

    // Use provided agent ID or fall back to environment variable
    const agentId = agentIdParam || process.env.ELEVENLABS_AGENT_ID;

    if (!agentId) {
        return NextResponse.json(
            { error: "No agent specified and ELEVENLABS_AGENT_ID not configured" },
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
            agent_id: agentId
        });
    } catch (error) {
        console.error("Error getting signed URL:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";

interface NgrokTunnel {
    name: string;
    public_url: string;
    proto: string;
    config: {
        addr: string;
        inspect: boolean;
    };
}

interface NgrokRequest {
    start: string;
    duration: number;
    request: {
        method: string;
        uri: string;
        raw: string;
    };
    response: {
        status: string;
        raw: string;
    };
}

/**
 * GET /api/demos/live-agent-mcp/monitor
 *
 * Returns monitoring data from ngrok and system status
 */
export async function GET() {
    const results: {
        timestamp: string;
        ngrok: {
            running: boolean;
            url: string | null;
            tunnels: NgrokTunnel[];
        };
        requests: {
            total: number;
            recent: Array<{
                time: string;
                method: string;
                path: string;
                status: string;
                duration_ms: number;
            }>;
        };
        elevenlabs: {
            toolConfigured: boolean;
            toolUrl: string | null;
            agentHasTool: boolean;
        };
    } = {
        timestamp: new Date().toISOString(),
        ngrok: {
            running: false,
            url: null,
            tunnels: []
        },
        requests: {
            total: 0,
            recent: []
        },
        elevenlabs: {
            toolConfigured: false,
            toolUrl: null,
            agentHasTool: false
        }
    };

    // Check ngrok status
    try {
        const tunnelsRes = await fetch("http://127.0.0.1:4040/api/tunnels");
        if (tunnelsRes.ok) {
            const tunnelsData = await tunnelsRes.json();
            results.ngrok = {
                running: true,
                url: tunnelsData.tunnels?.[0]?.public_url || null,
                tunnels: tunnelsData.tunnels || []
            };
        }
    } catch {
        // ngrok not running
    }

    // Get recent requests
    try {
        const requestsRes = await fetch("http://127.0.0.1:4040/api/requests/http");
        if (requestsRes.ok) {
            const requestsData = await requestsRes.json();
            const requests = requestsData.requests || [];
            results.requests = {
                total: requests.length,
                recent: requests.slice(0, 10).map((r: NgrokRequest) => ({
                    time: r.start,
                    method: r.request.method,
                    path: r.request.uri,
                    status: r.response.status,
                    duration_ms: r.duration / 1000000 // Convert nanoseconds to ms
                }))
            };
        }
    } catch {
        // Failed to get requests
    }

    // Check ElevenLabs configuration
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
        try {
            // Check tool
            const toolRes = await fetch(
                "https://api.elevenlabs.io/v1/convai/tools/tool_2701kgar5c7xea1rremmc16whvhr",
                { headers: { "xi-api-key": apiKey } }
            );
            if (toolRes.ok) {
                const toolData = await toolRes.json();
                results.elevenlabs.toolConfigured = true;
                results.elevenlabs.toolUrl = toolData.tool_config?.api_schema?.url || null;
            }

            // Check agent
            const agentRes = await fetch(
                "https://api.elevenlabs.io/v1/convai/agents/agent_0301kg9h2x19evavrqpfp3h54s48",
                { headers: { "xi-api-key": apiKey } }
            );
            if (agentRes.ok) {
                const agentData = await agentRes.json();
                const tools = agentData.conversation_config?.agent?.prompt?.tools || [];
                results.elevenlabs.agentHasTool = tools.some(
                    (t: { name: string }) => t.name === "ask_assistant"
                );
            }
        } catch {
            // Failed to check ElevenLabs
        }
    }

    return NextResponse.json(results);
}

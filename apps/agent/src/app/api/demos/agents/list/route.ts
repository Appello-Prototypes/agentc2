import { NextResponse } from "next/server";
import { mastra } from "@repo/agentc2/core";

/**
 * GET /api/demos/agents/list
 *
 * Lists all registered agents with their configuration summary.
 * Uses registration keys (not internal agent IDs) for consistency.
 */
export async function GET() {
    try {
        // Registration keys used in mastra.ts buildAgents()
        // These are the keys we use to look up agents
        const registrationKeys = [
            "assistant",
            "structured",
            "vision",
            "research",
            "evaluated",
            "openai-voice-agent",
            "elevenlabs-voice-agent",
            "hybrid-voice-agent"
        ];

        const agents = [];

        for (const registrationKey of registrationKeys) {
            try {
                const agent = mastra.getAgent(registrationKey);
                if (agent) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const agentAny = agent as any;

                    // Extract agent configuration
                    const config = {
                        // Use registration key for lookups, but show internal id/name
                        registrationKey,
                        id: agentAny.id || registrationKey,
                        name: agentAny.name || registrationKey,
                        model: typeof agentAny.model === "string" ? agentAny.model : "unknown",
                        hasMemory: !!agentAny.memory,
                        toolCount: agentAny.tools ? Object.keys(agentAny.tools).length : 0,
                        hasScorers: !!agentAny.scorers,
                        tools: agentAny.tools ? Object.keys(agentAny.tools) : [],
                        hasVoice: !!agentAny.voice
                    };
                    agents.push(config);
                }
            } catch {
                // Agent not registered, skip
            }
        }

        // Also add MCP agent info (dynamically created)
        agents.push({
            registrationKey: "mcp-agent",
            id: "mcp-agent",
            name: "MCP-Enabled Agent",
            model: "openai/gpt-4o-mini",
            hasMemory: false,
            toolCount: 136,
            hasScorers: false,
            tools: ["(loaded dynamically from MCP servers)"],
            hasVoice: false,
            isDynamic: true
        });

        return NextResponse.json({
            success: true,
            count: agents.length,
            agents
        });
    } catch (error) {
        console.error("[Agents List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list agents"
            },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import {
    getMcpServerStatus,
    isServerlessEnvironment,
    getMcpMode,
    type ServerConnectionStatus
} from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * MCP Status API Response
 *
 * Provides detailed status about MCP server connections and API fallback mode.
 * In serverless environments, shows which integrations are using API fallback.
 */
export interface McpStatusResponse {
    servers: ServerConnectionStatus[];
    totalTools: number;
    connectedServers: number;
    availableServers: number;
    timestamp: number;
    isServerless: boolean;
    mode: "mcp" | "api" | "hybrid";
}

export async function GET() {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isServerless = isServerlessEnvironment();
        const mode = getMcpMode();

        // Get unified server status (handles both MCP and API modes)
        const servers = await getMcpServerStatus();

        // Calculate totals
        const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0);
        const connectedServers = servers.filter((s) => s.connected).length;
        const availableServers = servers.filter((s) => s.available).length;

        const response: McpStatusResponse = {
            servers,
            totalTools,
            connectedServers,
            availableServers,
            timestamp: Date.now(),
            isServerless,
            mode
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("MCP status error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get MCP status" },
            { status: 500 }
        );
    }
}

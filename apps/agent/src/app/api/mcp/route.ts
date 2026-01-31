import { NextRequest, NextResponse } from "next/server";
import { createMcpAgent } from "@repo/mastra";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Create agent with MCP tools loaded
        const agent = await createMcpAgent();

        // Generate response
        const response = await agent.generate(message, {
            maxSteps: 5
        });

        return NextResponse.json({
            text: response.text,
            toolCalls: response.toolCalls
        });
    } catch (error) {
        console.error("MCP agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "MCP request failed" },
            { status: 500 }
        );
    }
}

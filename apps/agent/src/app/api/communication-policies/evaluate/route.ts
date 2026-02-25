import { NextRequest, NextResponse } from "next/server";
import { evaluateCommunicationPolicy } from "@repo/agentc2";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            fromAgentSlug,
            toAgentSlug,
            sessionId,
            organizationId,
            workspaceId,
            networkId,
            userId,
            currentDepth,
            currentPeerCalls
        } = body;

        if (!fromAgentSlug || !toAgentSlug) {
            return NextResponse.json(
                { success: false, error: "fromAgentSlug and toAgentSlug are required" },
                { status: 400 }
            );
        }

        const decision = await evaluateCommunicationPolicy({
            fromAgentSlug,
            toAgentSlug,
            sessionId,
            organizationId,
            workspaceId,
            networkId,
            userId,
            currentDepth,
            currentPeerCalls
        });

        return NextResponse.json({ success: true, decision });
    } catch (error) {
        console.error("[CommPolicy Evaluate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to evaluate policy" },
            { status: 500 }
        );
    }
}

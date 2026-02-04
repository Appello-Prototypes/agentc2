import { NextRequest, NextResponse } from "next/server";
import { validateNetworkDefinition } from "@/lib/network-validation";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { topologyJson, primitives } = body;

        const validation = validateNetworkDefinition({ topologyJson, primitives });

        return NextResponse.json({
            success: true,
            ...validation
        });
    } catch (error) {
        console.error("[Network Validate] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to validate network" },
            { status: 500 }
        );
    }
}

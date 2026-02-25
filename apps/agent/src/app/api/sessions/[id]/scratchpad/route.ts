import { NextRequest, NextResponse } from "next/server";
import { readScratchpad } from "@repo/agentc2";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const scratchpad = await readScratchpad(id);

        if (scratchpad === null) {
            return NextResponse.json(
                { success: false, error: "Session not found or scratchpad empty" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, scratchpad });
    } catch (error) {
        console.error("[Session Scratchpad] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to read scratchpad" },
            { status: 500 }
        );
    }
}

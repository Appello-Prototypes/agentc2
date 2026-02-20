/**
 * Available Scorers API
 *
 * GET /api/agents/scorers
 *
 * Lists all available scorers that can be attached to agents.
 */

import { NextResponse } from "next/server";
import { listAvailableScorers } from "@repo/agentc2/scorers/registry";

export async function GET() {
    const scorers = listAvailableScorers();

    return NextResponse.json({
        scorers
    });
}

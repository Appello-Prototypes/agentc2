import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { matchesTriggerFilter } from "@/lib/trigger-utils";
import { parseUnifiedTriggerId } from "@/lib/unified-triggers";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * POST /api/networks/[slug]/execution-triggers/[triggerId]/test
 *
 * Dry-run a network trigger without creating a run.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; triggerId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { payload } = body as { payload?: Record<string, unknown> };

        const network = await prisma.network.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            },
            select: { id: true, slug: true }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: {
                id: parsed.id,
                networkId: network.id,
                entityType: "network"
            }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        const payloadObj = (
            payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
        ) as Record<string, unknown>;

        const matches = matchesTriggerFilter(
            payloadObj,
            trigger.filterJson as Record<string, unknown> | null
        );

        const message =
            typeof payloadObj === "object" && "message" in payloadObj
                ? String(payloadObj.message)
                : JSON.stringify(payloadObj);

        return NextResponse.json({
            success: true,
            matched: matches,
            resolved: {
                networkSlug: network.slug,
                message
            }
        });
    } catch (error) {
        console.error("[Network Triggers] Error testing:", error);
        return NextResponse.json(
            { success: false, error: "Failed to test network trigger" },
            { status: 500 }
        );
    }
}

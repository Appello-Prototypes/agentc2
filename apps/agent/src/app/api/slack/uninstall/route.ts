import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@repo/database";

/**
 * POST /api/slack/uninstall
 *
 * Webhook endpoint for Slack app_uninstalled events.
 * When a customer uninstalls the Slack app from their workspace,
 * Slack sends this event. We mark the IntegrationConnection as inactive.
 *
 * This uses the Events API (same signing secret verification as the main events route).
 */
export async function POST(request: NextRequest) {
    const body = await request.text();

    // Verify Slack signature
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
        console.error("[Slack Uninstall] SLACK_SIGNING_SECRET not configured");
        return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signature = request.headers.get("x-slack-signature");

    if (!timestamp || !signature) {
        return NextResponse.json({ error: "Missing headers" }, { status: 401 });
    }

    // Reject requests older than 5 minutes (replay protection)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
        return NextResponse.json({ error: "Request too old" }, { status: 401 });
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const expectedSignature =
        "v0=" + crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse event
    const payload = JSON.parse(body) as {
        type?: string;
        event?: {
            type: string;
            [key: string]: unknown;
        };
        team_id?: string;
        challenge?: string;
    };

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
        return NextResponse.json({ challenge: payload.challenge });
    }

    // Handle app_uninstalled event
    if (payload.event?.type === "app_uninstalled" && payload.team_id) {
        const teamId = payload.team_id;

        console.log(`[Slack Uninstall] App uninstalled from workspace ${teamId}`);

        // Find and deactivate the connection
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "slack" }
        });

        if (provider) {
            const connections = await prisma.integrationConnection.findMany({
                where: {
                    providerId: provider.id,
                    isActive: true,
                    metadata: {
                        path: ["teamId"],
                        equals: teamId
                    }
                }
            });

            for (const conn of connections) {
                await prisma.integrationConnection.update({
                    where: { id: conn.id },
                    data: {
                        isActive: false,
                        errorMessage: "Slack app was uninstalled from workspace."
                    }
                });

                console.log(
                    `[Slack Uninstall] Deactivated connection ${conn.id} for org ${conn.organizationId}`
                );
            }
        }
    }

    // Handle tokens_revoked event
    if (payload.event?.type === "tokens_revoked" && payload.team_id) {
        const teamId = payload.team_id;

        console.log(`[Slack Uninstall] Tokens revoked for workspace ${teamId}`);

        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "slack" }
        });

        if (provider) {
            await prisma.integrationConnection.updateMany({
                where: {
                    providerId: provider.id,
                    isActive: true,
                    metadata: {
                        path: ["teamId"],
                        equals: teamId
                    }
                },
                data: {
                    errorMessage: "Slack tokens were revoked. Please re-install the app."
                }
            });
        }
    }

    return NextResponse.json({ ok: true });
}

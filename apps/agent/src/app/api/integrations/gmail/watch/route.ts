import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { getGmailClient, watchMailbox } from "@/lib/gmail";
import { getNextRunAt } from "@/lib/schedule-utils";

/**
 * POST /api/integrations/gmail/watch
 *
 * Start or refresh Gmail watch.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { integrationId, gmailAddress } = body;

        if (!integrationId && !gmailAddress) {
            return NextResponse.json(
                { success: false, error: "integrationId or gmailAddress is required" },
                { status: 400 }
            );
        }

        const integration = await prisma.gmailIntegration.findFirst({
            where: {
                ...(integrationId ? { id: integrationId } : {}),
                ...(gmailAddress ? { gmailAddress } : {}),
                workspace: { organizationId }
            },
            include: { agent: true }
        });

        if (!integration) {
            return NextResponse.json(
                { success: false, error: "Integration not found" },
                { status: 404 }
            );
        }

        const topicName = process.env.GMAIL_PUBSUB_TOPIC;
        if (!topicName) {
            return NextResponse.json(
                { success: false, error: "GMAIL_PUBSUB_TOPIC not configured" },
                { status: 500 }
            );
        }

        const gmail = await getGmailClient(organizationId, integration.gmailAddress);
        const watchResult = await watchMailbox(gmail, topicName);

        const updated = await prisma.gmailIntegration.update({
            where: { id: integration.id },
            data: {
                historyId: watchResult.historyId || integration.historyId,
                watchExpiration: watchResult.expiration || integration.watchExpiration
            }
        });

        const scheduleName = `Gmail Watch Refresh (${integration.id})`;
        const existingSchedule = await prisma.agentSchedule.findFirst({
            where: {
                agentId: integration.agentId,
                name: scheduleName
            }
        });

        if (!existingSchedule && integration.agentId) {
            await prisma.agentSchedule.create({
                data: {
                    agentId: integration.agentId,
                    workspaceId: integration.workspaceId,
                    name: scheduleName,
                    description: "Refresh Gmail watch registration daily.",
                    cronExpr: "0 2 * * *",
                    timezone: "UTC",
                    inputJson: {
                        task: "gmail_watch_refresh",
                        integrationId: integration.id
                    },
                    isActive: true,
                    nextRunAt: getNextRunAt("0 2 * * *", "UTC", new Date())
                }
            });
        }

        return NextResponse.json({
            success: true,
            integration: updated
        });
    } catch (error) {
        console.error("[Gmail Watch] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to start Gmail watch"
            },
            { status: 500 }
        );
    }
}

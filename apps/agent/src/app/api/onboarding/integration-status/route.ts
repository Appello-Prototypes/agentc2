import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserMembership } from "@/lib/organization";

/**
 * GET /api/onboarding/integration-status
 *
 * Returns the connection status of key integrations for the user's
 * organization. Used by the onboarding ConnectStep to detect if
 * the org already has Slack (or other services) connected — e.g.
 * when a new user joins an existing organization.
 *
 * Response shape:
 * {
 *   success: true,
 *   integrations: {
 *     slack: { connected: true, teamName: "Acme", isOrgLevel: true },
 *     gmail: { connected: false }
 *   }
 * }
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const membership = await getUserMembership(session.user.id);
        if (!membership) {
            return NextResponse.json({
                success: true,
                integrations: {
                    slack: { connected: false },
                    gmail: { connected: false }
                }
            });
        }

        const organizationId = membership.organizationId;

        // Fetch all active org-level connections for key providers
        const connections = await prisma.integrationConnection.findMany({
            where: {
                organizationId,
                isActive: true,
                provider: {
                    key: { in: ["slack", "gmail"] }
                }
            },
            include: {
                provider: { select: { key: true } }
            }
        });

        // Build status map
        const slackConn = connections.find((c) => c.provider.key === "slack");
        const gmailConn = connections.find((c) => c.provider.key === "gmail");

        const slackMetadata = slackConn?.metadata as Record<string, unknown> | null;

        return NextResponse.json({
            success: true,
            integrations: {
                slack: slackConn
                    ? {
                          connected: true,
                          teamName: (slackMetadata?.teamName as string) || null,
                          isOrgLevel: slackConn.scope === "org"
                      }
                    : { connected: false },
                gmail: gmailConn ? { connected: true } : { connected: false }
            }
        });
    } catch (error) {
        console.error("[Onboarding Integration Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to check integration status"
            },
            { status: 500 }
        );
    }
}

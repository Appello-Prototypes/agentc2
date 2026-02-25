import { prisma } from "@repo/database";
import { NextRequest, NextResponse } from "next/server";
import {
    verifyEmbedIdentity,
    getUserIntegrationStatus,
    type VerifiedEmbedIdentity,
    type UserIntegrationStatus
} from "@/lib/embed-identity";

/**
 * Default embed configuration applied when publicEmbed metadata is not set.
 */
const DEFAULT_EMBED_CONFIG = {
    greeting: "",
    suggestions: [] as string[],
    theme: "dark" as const,
    showToolActivity: true,
    showModeSelector: false,
    showModelSelector: false,
    showFileUpload: false,
    showVoiceInput: false,
    showConversationSidebar: false,
    showSignupCTA: false,
    showAuthButtons: true,
    signupProviders: ["google"] as string[],
    poweredByBadge: true,
    maxMessagesPerSession: 50
};

export type EmbedConfig = typeof DEFAULT_EMBED_CONFIG;

/**
 * GET /api/agents/[id]/embed?token=abc123&identity=signedPayload
 *
 * Returns the embed configuration for a public agent.
 * Requires a valid publicToken query param.
 *
 * Optional params:
 *   - identity: HMAC-signed identity token from an embed partner
 *   - format=embed-code: returns an HTML snippet instead of config
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");
        const identityToken = searchParams.get("identity");
        const format = searchParams.get("format");

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Missing token parameter" },
                { status: 401 }
            );
        }

        // Look up agent by slug with token validation
        const agent = await prisma.agent.findFirst({
            where: {
                slug: id,
                visibility: "PUBLIC",
                publicToken: token,
                isActive: true
            },
            select: {
                id: true,
                slug: true,
                name: true,
                metadata: true,
                publicToken: true,
                workspaceId: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid token or agent not public"
                },
                { status: 403 }
            );
        }

        // Merge stored publicEmbed config with defaults
        const metadata = agent.metadata as Record<string, unknown> | null;
        const storedConfig = (metadata?.publicEmbed as Partial<EmbedConfig>) || {};

        const config: EmbedConfig = {
            ...DEFAULT_EMBED_CONFIG,
            greeting: storedConfig.greeting || `Hi, I'm ${agent.name}. How can I help you?`,
            ...storedConfig
        };

        // ── Identity verification (optional) ─────────────────────────────
        let identity: VerifiedEmbedIdentity | null = null;

        if (identityToken && agent.workspaceId) {
            const ws = await prisma.workspace.findUnique({
                where: { id: agent.workspaceId },
                select: { organizationId: true }
            });

            if (ws?.organizationId) {
                identity = await verifyEmbedIdentity(identityToken, ws.organizationId);

                if (identity) {
                    // When identity is verified, hide auth buttons by default
                    config.showAuthButtons = false;
                }
            }
        }

        // If embed-code format requested, return HTML snippet
        if (format === "embed-code") {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";
            const embedUrl = `${baseUrl}/embed/${agent.slug}?token=${agent.publicToken}`;
            const snippet = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  style="border:none; border-radius:12px;"
  allow="clipboard-write"
></iframe>`;

            return NextResponse.json({
                embedUrl,
                embedCode: snippet
            });
        }

        // Fetch integration status for identified users
        let integrations: UserIntegrationStatus | undefined;
        if (identity?.mappedUserId) {
            integrations = await getUserIntegrationStatus(
                identity.mappedUserId,
                identity.organizationId
            );
        }

        // Standard config response (with optional identity context)
        return NextResponse.json({
            slug: agent.slug,
            name: agent.name,
            config,
            ...(identity && {
                identity: {
                    name: identity.name,
                    email: identity.email,
                    externalUserId: identity.externalUserId,
                    partnerName: identity.partnerName,
                    partnerUserId: identity.partnerUserId,
                    userId: identity.mappedUserId,
                    organizationId: identity.organizationId
                }
            }),
            ...(integrations && { integrations })
        });
    } catch (error) {
        console.error("[Embed Config] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch embed config"
            },
            { status: 500 }
        );
    }
}

/**
 * Slack Channel Preferences CRUD API
 *
 * GET    /api/slack/channels          - List channel preferences for the org
 * POST   /api/slack/channels          - Create/update a channel preference
 * DELETE /api/slack/channels           - Remove a channel preference by ID
 * GET    /api/slack/channels?available - Proxy conversations.list for available channels
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import {
    listChannelPreferences,
    upsertChannelPreference,
    deleteChannelPreference
} from "@/lib/slack-channels";
import { decryptCredentials } from "@/lib/credential-crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSessionOrg() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id) return null;

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true }
    });
    return membership?.organizationId ?? null;
}

async function findSlackConnection(organizationId: string) {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "slack" }
    });
    if (!provider) return null;

    return prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const organizationId = await getSessionOrg();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const available = url.searchParams.has("available");

    const connection = await findSlackConnection(organizationId);
    if (!connection) {
        return NextResponse.json({ error: "No active Slack connection found" }, { status: 404 });
    }

    // List available channels from Slack API
    if (available) {
        const creds = decryptCredentials(connection.credentials) as Record<string, unknown> | null;
        const botToken = (creds?.botToken || creds?.SLACK_BOT_TOKEN) as string | undefined;
        if (!botToken) {
            return NextResponse.json({ error: "No bot token available" }, { status: 500 });
        }

        try {
            const res = await fetch(
                "https://slack.com/api/conversations.list?" +
                    new URLSearchParams({
                        types: "public_channel,private_channel",
                        exclude_archived: "true",
                        limit: "200"
                    }),
                {
                    headers: {
                        Authorization: `Bearer ${botToken}`
                    }
                }
            );
            const data = (await res.json()) as {
                ok: boolean;
                channels?: Array<{
                    id: string;
                    name: string;
                    is_private: boolean;
                    is_member: boolean;
                    num_members?: number;
                }>;
                error?: string;
            };

            if (!data.ok) {
                return NextResponse.json(
                    { error: data.error || "Slack API error" },
                    { status: 502 }
                );
            }

            const channels = (data.channels || [])
                .filter((c) => c.is_member)
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    isPrivate: c.is_private,
                    numMembers: c.num_members
                }));

            return NextResponse.json({ channels });
        } catch (error) {
            console.error("[SlackChannels] Failed to list channels:", error);
            return NextResponse.json({ error: "Failed to fetch Slack channels" }, { status: 502 });
        }
    }

    // List configured preferences
    const preferences = await listChannelPreferences(connection.id);
    return NextResponse.json({
        connectionId: connection.id,
        preferences
    });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    const organizationId = await getSessionOrg();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        purposeKey?: string;
        channelId?: string;
        channelName?: string;
        userId?: string | null;
    };

    if (!body.purposeKey || !body.channelId) {
        return NextResponse.json(
            { error: "purposeKey and channelId are required" },
            { status: 400 }
        );
    }

    const connection = await findSlackConnection(organizationId);
    if (!connection) {
        return NextResponse.json({ error: "No active Slack connection found" }, { status: 404 });
    }

    const pref = await upsertChannelPreference({
        connectionId: connection.id,
        userId: body.userId ?? null,
        purposeKey: body.purposeKey,
        channelId: body.channelId,
        channelName: body.channelName
    });

    return NextResponse.json({ preference: pref });
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
    const organizationId = await getSessionOrg();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    // Verify the preference belongs to the org's connection
    const pref = await prisma.slackChannelPreference.findUnique({
        where: { id },
        include: {
            integrationConnection: { select: { organizationId: true } }
        }
    });

    if (!pref) {
        return NextResponse.json({ error: "Preference not found" }, { status: 404 });
    }

    if (pref.integrationConnection.organizationId !== organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteChannelPreference(id);
    return NextResponse.json({ deleted: true });
}

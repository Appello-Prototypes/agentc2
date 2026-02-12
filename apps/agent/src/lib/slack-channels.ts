/**
 * Slack Channel Preference Resolution
 *
 * Resolves the correct Slack channel ID for a given purpose key,
 * supporting per-user overrides and org-wide defaults.
 */

import { prisma } from "@repo/database";

/**
 * Resolve the Slack channel for a given purpose within an org's Slack connection.
 *
 * Priority:
 *  1. User-specific preference (connectionId + userId + purposeKey)
 *  2. Org-wide default (connectionId + null userId + purposeKey)
 *  3. null (no channel configured for this purpose)
 */
export async function resolveChannel(
    connectionId: string,
    userId: string | null,
    purposeKey: string
): Promise<{ channelId: string; channelName: string | null } | null> {
    const prefs = await prisma.slackChannelPreference.findMany({
        where: { integrationConnectionId: connectionId, purposeKey }
    });

    // User-specific override
    const userPref = userId ? prefs.find((p) => p.userId === userId) : null;
    // Org-wide default
    const orgPref = prefs.find((p) => p.userId === null);

    const match = userPref || orgPref;
    return match ? { channelId: match.channelId, channelName: match.channelName } : null;
}

/**
 * Resolve multiple channel preferences for an org's Slack connection.
 * Useful for hydrating template variables in agent instructions.
 *
 * Returns a map of purposeKey -> channelId.
 */
export async function resolveChannelMap(
    connectionId: string,
    userId: string | null
): Promise<Record<string, string>> {
    const prefs = await prisma.slackChannelPreference.findMany({
        where: { integrationConnectionId: connectionId }
    });

    const map: Record<string, string> = {};

    // Group by purposeKey, prefer user-specific over org-wide
    const byPurpose = new Map<string, { user?: string; org?: string }>();
    for (const p of prefs) {
        const entry = byPurpose.get(p.purposeKey) || {};
        if (p.userId === userId && userId) {
            entry.user = p.channelId;
        } else if (p.userId === null) {
            entry.org = p.channelId;
        }
        byPurpose.set(p.purposeKey, entry);
    }

    for (const [purpose, entry] of byPurpose) {
        map[purpose] = entry.user || entry.org || "";
    }

    return map;
}

/**
 * List all channel preferences for a given connection.
 */
export async function listChannelPreferences(connectionId: string) {
    return prisma.slackChannelPreference.findMany({
        where: { integrationConnectionId: connectionId },
        orderBy: [{ purposeKey: "asc" }, { userId: "asc" }]
    });
}

/**
 * Create or update a channel preference.
 * Uses upsert-like logic with findFirst + create/update.
 */
export async function upsertChannelPreference(params: {
    connectionId: string;
    userId: string | null;
    purposeKey: string;
    channelId: string;
    channelName?: string | null;
}) {
    const existing = await prisma.slackChannelPreference.findFirst({
        where: {
            integrationConnectionId: params.connectionId,
            userId: params.userId,
            purposeKey: params.purposeKey
        }
    });

    if (existing) {
        return prisma.slackChannelPreference.update({
            where: { id: existing.id },
            data: {
                channelId: params.channelId,
                channelName: params.channelName ?? existing.channelName
            }
        });
    }

    return prisma.slackChannelPreference.create({
        data: {
            integrationConnectionId: params.connectionId,
            userId: params.userId,
            purposeKey: params.purposeKey,
            channelId: params.channelId,
            channelName: params.channelName ?? null
        }
    });
}

/**
 * Remove a channel preference by ID.
 */
export async function deleteChannelPreference(id: string) {
    return prisma.slackChannelPreference.delete({
        where: { id }
    });
}

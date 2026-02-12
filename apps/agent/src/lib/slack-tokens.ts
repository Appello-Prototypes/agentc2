/**
 * Slack Token Management & Installation Resolution
 *
 * Resolves per-org Slack installations from IntegrationConnection,
 * handles token rotation (oauth.v2.exchange), and provides a
 * withSlackToken() wrapper for automatic refresh-on-expiry.
 *
 * Architecture: Single Slack App installed across multiple workspaces.
 * - SLACK_SIGNING_SECRET stays as env var (per-app, not per-workspace)
 * - Per-workspace bot tokens stored in IntegrationConnection.credentials (encrypted)
 * - team_id -> IntegrationConnection lookup for event routing
 */

import { prisma } from "@repo/database";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-crypto";

// =============================================================================
// Types
// =============================================================================

export interface SlackInstallationContext {
    /** IntegrationConnection ID (null if using env var fallback) */
    connectionId: string | null;
    /** Organization that owns this Slack installation */
    organizationId: string;
    /** Decrypted bot token for Slack API calls */
    botToken: string;
    /** Bot's Slack user ID for self-message detection */
    botUserId: string;
    /** Slack workspace ID (T...) */
    teamId: string;
    /** Slack enterprise ID (E...) for Enterprise Grid, null otherwise */
    enterpriseId: string | null;
    /** Default agent slug for this workspace */
    defaultAgentSlug: string;
    /** Channel ID for system alerts (null = not configured) */
    alertsChannelId: string | null;
}

// =============================================================================
// Per-installation bot user ID cache
// =============================================================================

const botUserIdCache = new Map<string, string>();

// =============================================================================
// Installation Resolution
// =============================================================================

/**
 * Resolve a Slack installation from the database by team_id or enterprise_id.
 * Falls back to env vars during the migration period.
 */
export async function resolveSlackInstallation(
    teamId?: string,
    enterpriseId?: string
): Promise<SlackInstallationContext | null> {
    // 1. Try DB lookup by enterpriseId first (Enterprise Grid), then teamId
    if (enterpriseId || teamId) {
        const connection = await findSlackConnection(teamId, enterpriseId);
        if (connection) {
            return buildContextFromConnection(connection);
        }
    }

    // 2. Fallback: construct virtual context from env vars (migration period)
    if (process.env.SLACK_BOT_TOKEN) {
        return buildContextFromEnvVars();
    }

    return null;
}

/**
 * Find the Slack IntegrationConnection matching a team_id or enterprise_id.
 */
async function findSlackConnection(teamId?: string, enterpriseId?: string) {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "slack" }
    });
    if (!provider) return null;

    // Try enterprise_id first (Enterprise Grid installs span multiple workspaces)
    if (enterpriseId) {
        const conn = await prisma.integrationConnection.findFirst({
            where: {
                providerId: provider.id,
                isActive: true,
                metadata: {
                    path: ["enterpriseId"],
                    equals: enterpriseId
                }
            }
        });
        if (conn) return conn;
    }

    // Then try team_id
    if (teamId) {
        const conn = await prisma.integrationConnection.findFirst({
            where: {
                providerId: provider.id,
                isActive: true,
                metadata: {
                    path: ["teamId"],
                    equals: teamId
                }
            }
        });
        if (conn) return conn;
    }

    return null;
}

/**
 * Build a SlackInstallationContext from a database IntegrationConnection.
 */
function buildContextFromConnection(connection: {
    id: string;
    organizationId: string;
    credentials: unknown;
    metadata: unknown;
}): SlackInstallationContext | null {
    const creds = decryptCredentials(connection.credentials) as Record<string, unknown>;
    const meta = (connection.metadata || {}) as Record<string, unknown>;

    const botToken = (creds.botToken || creds.SLACK_BOT_TOKEN) as string | undefined;
    if (!botToken) {
        console.error(`[SlackTokens] Connection ${connection.id} has no botToken in credentials`);
        return null;
    }

    const botUserId = (creds.botUserId as string) || "";
    // Cache the bot user ID
    if (botUserId) {
        botUserIdCache.set(connection.id, botUserId);
    }

    return {
        connectionId: connection.id,
        organizationId: connection.organizationId,
        botToken,
        botUserId,
        teamId: (meta.teamId as string) || "",
        enterpriseId: (meta.enterpriseId as string) || null,
        defaultAgentSlug:
            (meta.defaultAgentSlug as string) ||
            process.env.SLACK_DEFAULT_AGENT_SLUG ||
            "assistant",
        alertsChannelId: (meta.alertsChannelId as string) || null
    };
}

/**
 * Build a fallback SlackInstallationContext from env vars (migration period).
 */
async function buildContextFromEnvVars(): Promise<SlackInstallationContext | null> {
    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!botToken) return null;

    // Resolve the org via the default agent slug
    const orgId = await resolveOrgFromDefaultAgent();

    // Resolve bot user ID via auth.test
    const botUserId = await resolveBotUserIdFromApi(botToken);

    return {
        connectionId: null,
        organizationId: orgId || "",
        botToken,
        botUserId: botUserId || "",
        teamId: process.env.SLACK_TEAM_ID || "unknown",
        enterpriseId: null,
        defaultAgentSlug: process.env.SLACK_DEFAULT_AGENT_SLUG || "assistant",
        alertsChannelId: process.env.SLACK_ALERTS_CHANNEL || null
    };
}

/**
 * Resolve the organization ID from the default agent slug (legacy path).
 */
async function resolveOrgFromDefaultAgent(): Promise<string | null> {
    const slug = process.env.SLACK_DEFAULT_AGENT_SLUG || "assistant";
    try {
        const agent = await prisma.agent.findFirst({
            where: { slug },
            select: { workspaceId: true }
        });
        if (!agent?.workspaceId) return null;
        const workspace = await prisma.workspace.findUnique({
            where: { id: agent.workspaceId },
            select: { organizationId: true }
        });
        return workspace?.organizationId || null;
    } catch {
        return null;
    }
}

/**
 * Resolve bot user ID via Slack auth.test API.
 */
async function resolveBotUserIdFromApi(botToken: string): Promise<string | null> {
    try {
        const res = await fetch("https://slack.com/api/auth.test", {
            method: "POST",
            headers: { Authorization: `Bearer ${botToken}` }
        });
        const data = (await res.json()) as {
            ok: boolean;
            user_id?: string;
        };
        return data.ok ? data.user_id || null : null;
    } catch {
        return null;
    }
}

// =============================================================================
// Bot User ID Cache
// =============================================================================

/**
 * Get the bot user ID for a specific installation, using cache.
 */
export function getBotUserIdForInstallation(context: SlackInstallationContext): string {
    if (context.botUserId) return context.botUserId;
    if (context.connectionId) {
        const cached = botUserIdCache.get(context.connectionId);
        if (cached) return cached;
    }
    return "";
}

// =============================================================================
// Token Rotation
// =============================================================================

/**
 * Execute a Slack API call with automatic token rotation.
 *
 * 1. Load & decrypt credentials from IntegrationConnection
 * 2. Check tokenExpiresAt -- if within 5 min of expiry, refresh proactively
 * 3. If expired, call oauth.v2.exchange with refreshToken
 * 4. Store new botToken + refreshToken + tokenExpiresAt
 * 5. Execute the API call with a valid token
 * 6. On 401 response, retry once with a fresh token
 */
export async function withSlackToken<T>(
    connectionId: string,
    apiCall: (botToken: string) => Promise<T>
): Promise<T> {
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });
    if (!connection || !connection.credentials) {
        throw new Error(`[SlackTokens] Connection ${connectionId} not found or has no credentials`);
    }

    const creds = decryptCredentials(connection.credentials) as Record<string, unknown>;
    const meta = (connection.metadata || {}) as Record<string, unknown>;

    let botToken = (creds.botToken || creds.SLACK_BOT_TOKEN) as string;
    const refreshToken = creds.refreshToken as string | undefined;
    const tokenExpiresAt = meta.tokenExpiresAt as string | undefined;

    // Proactive refresh: if within 5 minutes of expiry
    if (tokenExpiresAt && refreshToken) {
        const expiresAt = new Date(tokenExpiresAt).getTime();
        const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
        if (expiresAt <= fiveMinFromNow) {
            try {
                const refreshed = await refreshSlackToken(connectionId, refreshToken);
                botToken = refreshed.accessToken;
            } catch (error) {
                console.error(`[SlackTokens] Proactive refresh failed for ${connectionId}:`, error);
                // Continue with current token -- it may still be valid for a few more minutes
            }
        }
    }

    // Execute the API call
    try {
        return await apiCall(botToken);
    } catch (error: unknown) {
        // Retry on 401 if we have a refresh token
        if (refreshToken && error instanceof Error && error.message.includes("401")) {
            try {
                const refreshed = await refreshSlackToken(connectionId, refreshToken);
                return await apiCall(refreshed.accessToken);
            } catch (refreshError) {
                console.error(
                    `[SlackTokens] Token refresh retry failed for ${connectionId}:`,
                    refreshError
                );
                // Mark connection as degraded
                await prisma.integrationConnection.update({
                    where: { id: connectionId },
                    data: {
                        errorMessage: "Token refresh failed. Re-install Slack to fix."
                    }
                });
            }
        }
        throw error;
    }
}

/**
 * Refresh a Slack bot token using the refresh token (token rotation).
 * Updates the IntegrationConnection credentials and metadata in the database.
 */
export async function refreshSlackToken(
    connectionId: string,
    refreshToken: string
): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("[SlackTokens] SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not configured");
    }

    const response = await fetch("https://slack.com/api/oauth.v2.exchange", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken
        })
    });

    const data = (await response.json()) as {
        ok: boolean;
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
    };

    if (!data.ok || !data.access_token) {
        throw new Error(`[SlackTokens] Token refresh failed: ${data.error || "unknown error"}`);
    }

    // Update the connection with new tokens
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });
    if (connection) {
        const existingCreds = decryptCredentials(connection.credentials) as Record<string, unknown>;
        const existingMeta = (connection.metadata || {}) as Record<string, unknown>;

        const newCreds = {
            ...existingCreds,
            botToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken
        };

        const newMeta = {
            ...existingMeta,
            tokenExpiresAt: data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000).toISOString()
                : null
        };

        await prisma.integrationConnection.update({
            where: { id: connectionId },
            data: {
                credentials: encryptCredentials(newCreds) as object,
                metadata: newMeta,
                errorMessage: null // Clear any prior error
            }
        });
    }

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in || 0
    };
}

// =============================================================================
// Event Deduplication (DB-backed, cross-process safe)
// =============================================================================

/**
 * Check if a Slack event has already been processed (cross-process safe).
 * Uses PostgreSQL unique constraint on eventId. Returns true if duplicate.
 */
export async function isDuplicateSlackEvent(eventId: string): Promise<boolean> {
    try {
        await prisma.slackEventDedup.create({
            data: {
                eventId,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            }
        });
        return false; // Created = first time seeing this event
    } catch {
        return true; // Unique constraint violation = duplicate
    }
}

/**
 * Cleanup expired dedup records. Call periodically (e.g., every 10 minutes).
 */
export async function cleanupExpiredDedupRecords(): Promise<number> {
    const result = await prisma.slackEventDedup.deleteMany({
        where: { expiresAt: { lt: new Date() } }
    });
    return result.count;
}

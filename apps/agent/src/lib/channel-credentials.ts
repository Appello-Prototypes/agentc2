/**
 * Channel Credentials Resolver
 *
 * Resolves credentials for voice/messaging channel integrations by:
 * 1. Checking the IntegrationConnection table for the user's org (DB-first)
 * 2. Falling back to process.env if no database connection exists
 *
 * This mirrors the MCP system's allowEnvFallback pattern.
 */

import { prisma } from "@repo/database";
import { decryptCredentials } from "@/lib/credential-crypto";

export type CredentialSource = "database" | "env_fallback" | "none";

export interface ResolvedCredentials {
    /** The resolved key-value pairs */
    credentials: Record<string, string>;
    /** Where the credentials came from */
    source: CredentialSource;
    /** The IntegrationConnection id, if from database */
    connectionId?: string;
}

/**
 * Environment variable names that each channel provider maps to.
 * Used for the env-var fallback when no DB connection exists.
 */
const PROVIDER_ENV_KEYS: Record<string, string[]> = {
    "twilio-voice": [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "VOICE_TTS_PROVIDER",
        "VOICE_DEFAULT_AGENT_SLUG",
        "VOICE_WEBHOOK_URL",
        "ELEVENLABS_VOICE_ID"
    ],
    elevenlabs: [
        "ELEVENLABS_API_KEY",
        "ELEVENLABS_AGENT_ID",
        "ELEVENLABS_MCP_AGENT_ID",
        "ELEVENLABS_WEBHOOK_SECRET",
        "ELEVENLABS_MCP_WEBHOOK_URL",
        "ELEVENLABS_DEFAULT_AGENT_SLUG"
    ],
    "telegram-bot": [
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_WEBHOOK_SECRET",
        "TELEGRAM_DEFAULT_AGENT_SLUG",
        "TELEGRAM_USE_WEBHOOK",
        "TELEGRAM_WEBHOOK_URL"
    ],
    "whatsapp-web": [
        "WHATSAPP_ENABLED",
        "WHATSAPP_DEFAULT_AGENT_SLUG",
        "WHATSAPP_ALLOWLIST",
        "WHATSAPP_SELF_CHAT_MODE",
        "WHATSAPP_SESSION_PATH"
    ]
};

/**
 * Resolve credentials from env vars for a given provider key.
 * Returns only the vars that are actually set.
 */
function resolveFromEnv(providerKey: string): Record<string, string> {
    const envKeys = PROVIDER_ENV_KEYS[providerKey] || [];
    const result: Record<string, string> = {};
    for (const key of envKeys) {
        const value = process.env[key];
        if (value) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Resolve credentials for a channel provider.
 *
 * @param providerKey - The IntegrationProvider key (e.g. "twilio-voice", "elevenlabs")
 * @param organizationId - The org to look up DB credentials for (optional)
 * @returns The resolved credentials with their source
 */
export async function resolveChannelCredentials(
    providerKey: string,
    organizationId?: string
): Promise<ResolvedCredentials> {
    // 1. Try database first (if we have an org context)
    if (organizationId) {
        try {
            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                    provider: { key: providerKey }
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            });

            if (connection) {
                const decrypted = decryptCredentials(connection.credentials);
                if (decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)) {
                    const credentials: Record<string, string> = {};
                    for (const [key, value] of Object.entries(
                        decrypted as Record<string, unknown>
                    )) {
                        if (typeof value === "string" && value.trim()) {
                            credentials[key] = value.trim();
                        }
                    }

                    // Only return DB credentials if we found at least one field
                    if (Object.keys(credentials).length > 0) {
                        return {
                            credentials,
                            source: "database",
                            connectionId: connection.id
                        };
                    }
                }
            }
        } catch (error) {
            console.warn(
                `[ChannelCredentials] Failed to resolve DB credentials for ${providerKey}:`,
                error instanceof Error ? error.message : error
            );
        }
    }

    // 2. Fall back to env vars
    const envCredentials = resolveFromEnv(providerKey);
    if (Object.keys(envCredentials).length > 0) {
        return { credentials: envCredentials, source: "env_fallback" };
    }

    return { credentials: {}, source: "none" };
}

/**
 * Convenience: resolve a single credential value across DB + env.
 * Useful when a route only needs one key (e.g. ELEVENLABS_API_KEY).
 */
export async function resolveCredentialValue(
    providerKey: string,
    fieldName: string,
    organizationId?: string
): Promise<{ value: string | undefined; source: CredentialSource }> {
    const { credentials, source } = await resolveChannelCredentials(providerKey, organizationId);
    return { value: credentials[fieldName], source };
}

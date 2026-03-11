import { decryptCredentials } from "../crypto";

export interface ChronoGolfCredentials {
    apiKey: string;
}

export interface GolfNowCredentials {
    username: string;
    password: string;
    channelId: string;
    useSandbox: boolean;
}

function getCredentialValue(
    credentials: Record<string, unknown>,
    keys: string[]
): string | undefined {
    for (const key of keys) {
        const val = credentials[key];
        if (typeof val === "string" && val.length > 0) return val;
    }
    return undefined;
}

async function resolveIntegrationCredentials(
    providerKey: string,
    organizationId?: string
): Promise<Record<string, unknown> | null> {
    try {
        const { prisma } = await import("@repo/database");

        const connection = await prisma.integrationConnection.findFirst({
            where: {
                provider: { key: providerKey },
                isActive: true,
                ...(organizationId ? { organizationId } : {})
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            select: { credentials: true }
        });

        if (!connection?.credentials) return null;

        return decryptCredentials(connection.credentials);
    } catch {
        return null;
    }
}

export async function resolveChronoGolfCredentials(
    organizationId?: string
): Promise<ChronoGolfCredentials | null> {
    // 1. Check env var first (simple dev setup)
    if (process.env.CHRONOGOLF_API_KEY) {
        return { apiKey: process.env.CHRONOGOLF_API_KEY };
    }

    // 2. Check IntegrationConnection
    const creds = await resolveIntegrationCredentials("chronogolf", organizationId);
    if (!creds) return null;

    const apiKey = getCredentialValue(creds, ["CHRONOGOLF_API_KEY", "apiKey", "api_key"]);
    if (!apiKey) return null;

    return { apiKey };
}

export async function resolveGolfNowCredentials(
    organizationId?: string
): Promise<GolfNowCredentials | null> {
    // 1. Check env vars first
    if (process.env.GOLFNOW_USERNAME && process.env.GOLFNOW_PASSWORD) {
        return {
            username: process.env.GOLFNOW_USERNAME,
            password: process.env.GOLFNOW_PASSWORD,
            channelId: process.env.GOLFNOW_CHANNEL_ID || "331",
            useSandbox: process.env.GOLFNOW_SANDBOX === "true"
        };
    }

    // 2. Check IntegrationConnection
    const creds = await resolveIntegrationCredentials("golfnow", organizationId);
    if (!creds) return null;

    const username = getCredentialValue(creds, ["GOLFNOW_USERNAME", "username", "UserName"]);
    const password = getCredentialValue(creds, ["GOLFNOW_PASSWORD", "password", "Password"]);
    if (!username || !password) return null;

    const channelId =
        getCredentialValue(creds, ["GOLFNOW_CHANNEL_ID", "channelId", "channel_id"]) || "331";
    const sandboxVal = getCredentialValue(creds, ["GOLFNOW_SANDBOX", "sandbox", "useSandbox"]);
    const useSandbox = sandboxVal === "true";

    return { username, password, channelId, useSandbox };
}

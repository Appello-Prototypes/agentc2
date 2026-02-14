/**
 * Shared Gmail OAuth helpers
 *
 * Common utilities for all Gmail tools: credential resolution,
 * token refresh, and authenticated API calls.
 */

import { prisma } from "@repo/database";
import { createDecipheriv } from "crypto";

export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type EncryptedPayload = { __enc: "v1"; iv: string; tag: string; data: string };

const isEncrypted = (v: unknown): v is EncryptedPayload =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (v as Record<string, unknown>).__enc === "v1";

export const decrypt = (value: unknown) => {
    if (!isEncrypted(value)) return value as Record<string, unknown> | null;
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) return null;
    const buf = Buffer.from(key, "hex");
    if (buf.length !== 32) return null;
    const iv = Buffer.from(value.iv, "base64");
    const tag = Buffer.from(value.tag, "base64");
    const encrypted = Buffer.from(value.data, "base64");
    const decipher = createDecipheriv("aes-256-gcm", buf, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        "utf8"
    );
    try {
        return JSON.parse(decrypted) as Record<string, unknown>;
    } catch {
        return null;
    }
};

/**
 * Refresh an expired OAuth access token using the refresh token.
 */
export const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        })
    });

    if (!response.ok) return null;
    const result = (await response.json()) as { access_token?: string };
    return result.access_token || null;
};

/**
 * Get a valid access token for the Gmail API.
 * Attempts the stored token first, then refreshes if expired.
 */
export const getAccessToken = async (gmailAddress: string) => {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    if (!provider) throw new Error("Gmail provider not configured");

    const integration = await prisma.gmailIntegration.findFirst({
        where: { gmailAddress, isActive: true },
        include: { workspace: { select: { organizationId: true } } }
    });
    if (!integration) throw new Error(`No active integration for ${gmailAddress}`);

    const organizationId = integration.workspace?.organizationId;
    if (!organizationId) throw new Error("Organization not found");

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true,
            OR: [
                { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
                { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
            ]
        }
    });
    if (!connection) throw new Error("Gmail credentials not found");

    const creds = decrypt(connection.credentials);
    if (!creds) throw new Error("Failed to decrypt Gmail credentials");

    // Check if token is likely expired (1-hour tokens with 5-min buffer)
    const expiryDate = typeof creds.expiryDate === "number" ? creds.expiryDate : 0;
    const isExpired = Date.now() > expiryDate - 5 * 60 * 1000;

    if (!isExpired && creds.accessToken) {
        return creds.accessToken as string;
    }

    // Refresh the token
    if (!creds.refreshToken) {
        throw new Error("Gmail access token expired and no refresh token available");
    }

    const newToken = await refreshAccessToken(creds.refreshToken as string);
    if (!newToken) {
        throw new Error("Failed to refresh Gmail access token");
    }

    return newToken;
};

/**
 * Make an authenticated Gmail API call with automatic token refresh on 401.
 */
export const callGmailApi = async (
    gmailAddress: string,
    path: string,
    options?: {
        method?: string;
        body?: unknown;
        params?: Record<string, string>;
    }
): Promise<Response> => {
    let token = await getAccessToken(gmailAddress);

    const url = new URL(`${GMAIL_API}${path}`);
    if (options?.params) {
        Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const fetchOptions: RequestInit = {
        method: options?.method || "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    };
    if (options?.body) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    let response = await fetch(url.toString(), fetchOptions);

    // Retry once with refreshed token on 401
    if (response.status === 401) {
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "gmail" }
        });
        const integration = await prisma.gmailIntegration.findFirst({
            where: { gmailAddress, isActive: true },
            include: { workspace: { select: { organizationId: true } } }
        });
        const organizationId = integration?.workspace?.organizationId;
        if (provider && organizationId) {
            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    providerId: provider.id,
                    isActive: true,
                    OR: [
                        { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
                        { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
                    ]
                }
            });
            const creds = decrypt(connection?.credentials);
            if (creds?.refreshToken) {
                const refreshed = await refreshAccessToken(creds.refreshToken as string);
                if (refreshed) {
                    token = refreshed;
                    fetchOptions.headers = {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    };
                    response = await fetch(url.toString(), fetchOptions);
                }
            }
        }
    }

    return response;
};

/**
 * Resolve the Gmail address to use for API calls.
 * If provided and non-empty, use as-is.
 * If empty/default, query the first active GmailIntegration from the database.
 */
export const resolveGmailAddress = async (gmailAddress?: string): Promise<string> => {
    if (gmailAddress && gmailAddress.includes("@")) {
        return gmailAddress;
    }
    // Fallback: find the first active Gmail integration
    const integration = await prisma.gmailIntegration.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        select: { gmailAddress: true }
    });
    if (!integration?.gmailAddress) {
        throw new Error(
            "No Gmail address provided and no active Gmail integration found. " +
                "Connect Google in Settings > Integrations first."
        );
    }
    return integration.gmailAddress;
};

/**
 * Check whether stored Google OAuth credentials include the required scopes.
 * Returns { ok: true } if all required scopes are granted, or { ok: false, missing: [...] }.
 */
export const checkGoogleScopes = async (
    gmailAddress: string,
    requiredScopes: string[]
): Promise<{ ok: boolean; missing: string[] }> => {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    if (!provider) return { ok: false, missing: requiredScopes };

    const integration = await prisma.gmailIntegration.findFirst({
        where: { gmailAddress, isActive: true },
        include: { workspace: { select: { organizationId: true } } }
    });
    if (!integration) return { ok: false, missing: requiredScopes };

    const organizationId = integration.workspace?.organizationId;
    if (!organizationId) return { ok: false, missing: requiredScopes };

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true,
            OR: [
                { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
                { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
            ]
        }
    });

    const creds = decrypt(connection?.credentials) as { scope?: string } | null;
    const grantedScopes = new Set((creds?.scope || "").split(/[,\s]+/).filter(Boolean));
    const missing = requiredScopes.filter((s) => !grantedScopes.has(s));
    return { ok: missing.length === 0, missing };
};

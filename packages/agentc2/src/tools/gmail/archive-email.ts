import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";
import { createDecipheriv } from "crypto";
import { resolveGmailAddress } from "./shared";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type EncryptedPayload = { __enc: "v1"; iv: string; tag: string; data: string };

const isEncrypted = (v: unknown): v is EncryptedPayload =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (v as Record<string, unknown>).__enc === "v1";

const decrypt = (value: unknown) => {
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
const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
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
const getAccessToken = async (gmailAddress: string) => {
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
 * Call the Gmail API to modify a message, with automatic token refresh on 401.
 */
const callGmailModify = async (
    gmailAddress: string,
    messageId: string,
    body: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> => {
    let token = await getAccessToken(gmailAddress);

    let response = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

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
                    response = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(body)
                    });
                }
            }
        }
    }

    if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Gmail API error ${response.status}: ${errorText}` };
    }

    return { success: true };
};

/**
 * Gmail Archive Email Tool
 *
 * Archives an email by removing the INBOX label.
 * Uses existing Gmail OAuth credentials from the platform database.
 * Handles token refresh automatically on expired tokens.
 */
export const gmailArchiveEmailTool = createTool({
    id: "gmail-archive-email",
    description:
        "Archive a Gmail email by removing it from the inbox. Provide the message ID and the Gmail address.",
    inputSchema: z.object({
        messageId: z.string().describe("The Gmail message ID to archive"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        messageId: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ messageId, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const result = await callGmailModify(address, messageId, {
                removeLabelIds: ["INBOX"]
            });
            return { ...result, messageId };
        } catch (error) {
            return {
                success: false,
                messageId,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});

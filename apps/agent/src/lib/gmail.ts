import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@repo/database";
import { getIntegrationProviders } from "@repo/mastra/mcp";
import { decryptCredentials, encryptCredentials } from "@/lib/credential-crypto";

// Import from the single source of truth and re-export under the legacy name
import { GOOGLE_REQUIRED_SCOPES } from "@repo/auth/google-scopes";
export const GMAIL_REQUIRED_SCOPES = GOOGLE_REQUIRED_SCOPES;

type StoredGmailCredentials = {
    gmailAddress: string;
    accessToken?: string;
    refreshToken?: string;
    expiryDate?: number;
    scope?: string;
    tokenType?: string;
};

export const getGmailOAuthClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
    const redirectUri =
        process.env.GMAIL_OAUTH_REDIRECT_URI ||
        (process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
            : undefined);

    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth is not configured");
    }

    return new OAuth2Client(clientId, clientSecret, redirectUri);
};

export const getGmailAuthUrl = () => {
    const client = getGmailOAuthClient();
    return client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [...GMAIL_REQUIRED_SCOPES]
    });
};

export const exchangeGmailCode = async (code: string) => {
    const client = getGmailOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailAddress = profile.data.emailAddress;

    if (!gmailAddress) {
        throw new Error("Failed to resolve Gmail address");
    }

    return { tokens, gmailAddress };
};

const getGmailProvider = async () => {
    await getIntegrationProviders();
    return prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
};

export const saveGmailCredentials = async (
    organizationId: string,
    gmailAddress: string,
    tokens: {
        access_token?: string | null;
        refresh_token?: string | null;
        expiry_date?: number | null;
        scope?: string | null;
        token_type?: string | null;
    }
) => {
    const credentialPayload: StoredGmailCredentials = {
        gmailAddress,
        ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(tokens.expiry_date ? { expiryDate: tokens.expiry_date } : {}),
        ...(tokens.scope ? { scope: tokens.scope } : {}),
        ...(tokens.token_type ? { tokenType: tokens.token_type } : {})
    };

    const provider = await getGmailProvider();
    if (!provider) {
        throw new Error("Gmail provider not configured");
    }

    const existing = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            OR: [
                {
                    metadata: {
                        path: ["gmailAddress"],
                        equals: gmailAddress
                    }
                },
                {
                    credentials: {
                        path: ["gmailAddress"],
                        equals: gmailAddress
                    }
                }
            ]
        }
    });

    const existingCredentials = decryptCredentials(existing?.credentials);
    const mergedCredentials =
        existingCredentials && typeof existingCredentials === "object"
            ? {
                  ...existingCredentials,
                  ...credentialPayload,
                  gmailAddress
              }
            : credentialPayload;
    const encryptedCredentials = encryptCredentials(mergedCredentials);

    const isDefault = !existing;
    if (isDefault) {
        await prisma.integrationConnection.updateMany({
            where: {
                organizationId,
                providerId: provider.id,
                scope: "org"
            },
            data: { isDefault: false }
        });
    }

    const connection = existing
        ? await prisma.integrationConnection.update({
              where: { id: existing.id },
              data: {
                  credentials: encryptedCredentials
                      ? JSON.parse(JSON.stringify(encryptedCredentials))
                      : null,
                  isActive: true,
                  metadata: {
                      ...(existing.metadata && typeof existing.metadata === "object"
                          ? (existing.metadata as Record<string, unknown>)
                          : {}),
                      gmailAddress
                  }
              }
          })
        : await prisma.integrationConnection.create({
              data: {
                  providerId: provider.id,
                  organizationId,
                  scope: "org",
                  name: `Gmail (${gmailAddress})`,
                  isDefault,
                  isActive: true,
                  credentials: encryptedCredentials
                      ? JSON.parse(JSON.stringify(encryptedCredentials))
                      : null,
                  metadata: { gmailAddress }
              }
          });

    return {
        ...mergedCredentials,
        connectionId: connection.id
    } as StoredGmailCredentials & { connectionId: string };
};

export const getGmailClient = async (organizationId: string, gmailAddress: string) => {
    const provider = await getGmailProvider();
    if (!provider) {
        throw new Error("Gmail provider not configured");
    }

    const connection = await prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true,
            OR: [
                {
                    metadata: {
                        path: ["gmailAddress"],
                        equals: gmailAddress
                    }
                },
                {
                    credentials: {
                        path: ["gmailAddress"],
                        equals: gmailAddress
                    }
                }
            ]
        }
    });

    if (!connection) {
        throw new Error("Gmail credentials not configured");
    }

    const credentials = decryptCredentials(connection.credentials) as StoredGmailCredentials | null;
    if (!credentials?.gmailAddress) {
        throw new Error("Gmail credentials missing account information");
    }

    const client = getGmailOAuthClient();
    client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.expiryDate,
        scope: credentials.scope,
        token_type: credentials.tokenType
    });

    client.on("tokens", async (tokens) => {
        if (!tokens.access_token && !tokens.refresh_token) {
            return;
        }
        await saveGmailCredentials(organizationId, gmailAddress, tokens);
    });

    return google.gmail({ version: "v1", auth: client });
};

export const watchMailbox = async (gmail: ReturnType<typeof google.gmail>, topicName: string) => {
    const response = await gmail.users.watch({
        userId: "me",
        requestBody: {
            topicName,
            labelFilterAction: "include",
            labelIds: ["INBOX"] // Only notify on INBOX changes (prevents feedback loops from agent label/archive actions)
        }
    });

    const historyId = response.data.historyId;
    const expiration = response.data.expiration ? new Date(Number(response.data.expiration)) : null;

    return { historyId, expiration };
};

/**
 * Fetch message IDs added since a given historyId.
 *
 * @param maxMessages  Stop collecting after this many unique message IDs.
 *                     Prevents unbounded Gmail API calls when the stored
 *                     historyId is very stale. Defaults to 25.
 */
export const listHistory = async (
    gmail: ReturnType<typeof google.gmail>,
    startHistoryId: string,
    maxMessages = 25
) => {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;

    do {
        const response = await gmail.users.history.list({
            userId: "me",
            startHistoryId,
            historyTypes: ["messageAdded"],
            labelId: "INBOX", // Only return messages added to INBOX (excludes SENT, DRAFT)
            pageToken
        });

        response.data.history?.forEach((entry) => {
            entry.messagesAdded?.forEach((added) => {
                if (added.message?.id) {
                    messageIds.add(added.message.id);
                }
            });
        });

        // Stop paginating once we have enough messages
        if (messageIds.size >= maxMessages) break;

        pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return Array.from(messageIds).slice(0, maxMessages);
};

/**
 * Fetch full message details for a list of IDs with controlled concurrency.
 *
 * Instead of Promise.all (which fires every request at once), this processes
 * messages in small batches to stay within Gmail API per-user quota limits.
 * At 5 quota units per messages.get, a concurrency of 3 uses ~15 units per
 * batch — well within the 15,000 units/min per-user limit.
 */
export const getMessagesWithConcurrency = async (
    gmail: ReturnType<typeof google.gmail>,
    messageIds: string[],
    concurrency = 3
) => {
    const results: Awaited<ReturnType<typeof getMessage>>[] = [];

    for (let i = 0; i < messageIds.length; i += concurrency) {
        const batch = messageIds.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(batch.map((id) => getMessage(gmail, id)));

        for (const result of batchResults) {
            if (result.status === "fulfilled") {
                results.push(result.value);
            } else {
                // Skip messages that were deleted or are no longer accessible (404)
                const msg =
                    result.reason instanceof Error ? result.reason.message : String(result.reason);
                console.warn(`[Gmail] Skipping inaccessible message: ${msg}`);
            }
        }
    }

    return results;
};

const getHeaderValue = (
    headers: Array<{ name?: string | null; value?: string | null }>,
    key: string
) => headers.find((header) => header.name?.toLowerCase() === key.toLowerCase())?.value || "";

const decodeBase64 = (value?: string | null) => {
    if (!value) return "";
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
};

const parseEmailList = (value: string) => {
    if (!value) return [];
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    return matches ? matches.map((email) => email.toLowerCase()) : [];
};

type AttachmentMeta = {
    filename: string;
    mimeType?: string | null;
    size?: number | null;
    attachmentId?: string | null;
};

const extractPayloadContent = (payload?: {
    mimeType?: string | null;
    body?: { data?: string | null; size?: number | null; attachmentId?: string | null };
    filename?: string | null;
    parts?: unknown;
}): {
    bodyText: string;
    bodyHtml: string;
    attachments: AttachmentMeta[];
    hasAttachments: boolean;
} => {
    if (!payload) {
        return { bodyText: "", bodyHtml: "", attachments: [], hasAttachments: false };
    }

    const attachments: AttachmentMeta[] = [];
    const plainTexts: string[] = [];
    const htmlTexts: string[] = [];

    const walk = (part: typeof payload) => {
        if (!part) return;
        const filename = part.filename || "";
        if (filename) {
            attachments.push({
                filename,
                mimeType: part.mimeType,
                size: part.body?.size ?? null,
                attachmentId: part.body?.attachmentId ?? null
            });
        }

        if (part.mimeType === "text/plain" && part.body?.data) {
            plainTexts.push(decodeBase64(part.body.data));
        }
        if (part.mimeType === "text/html" && part.body?.data) {
            htmlTexts.push(decodeBase64(part.body.data));
        }

        if (Array.isArray(part.parts)) {
            part.parts.forEach((child) => walk(child as typeof payload));
        }
    };

    walk(payload);

    return {
        bodyText: plainTexts.join("\n").trim(),
        bodyHtml: htmlTexts.join("\n").trim(),
        attachments,
        hasAttachments: attachments.length > 0
    };
};

export const getMessage = async (gmail: ReturnType<typeof google.gmail>, messageId: string) => {
    const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full"
    });

    const headers = response.data.payload?.headers || [];
    const from = getHeaderValue(headers, "From");
    const to = getHeaderValue(headers, "To");
    const cc = getHeaderValue(headers, "Cc");
    const bcc = getHeaderValue(headers, "Bcc");
    const subject = getHeaderValue(headers, "Subject");
    const date = getHeaderValue(headers, "Date");
    const messageIdHeader = getHeaderValue(headers, "Message-ID");
    const replyTo = getHeaderValue(headers, "Reply-To");
    const labels = response.data.labelIds || [];

    const { bodyText, bodyHtml, attachments, hasAttachments } = extractPayloadContent(
        response.data.payload
    );

    return {
        messageId,
        threadId: response.data.threadId || "",
        snippet: response.data.snippet || "",
        internalDate: response.data.internalDate || "",
        from,
        to,
        cc,
        bcc,
        subject,
        date,
        replyTo,
        messageIdHeader,
        labels,
        bodyText,
        bodyHtml,
        attachments,
        hasAttachments,
        parsedFrom: parseEmailList(from),
        parsedTo: parseEmailList(to),
        parsedCc: parseEmailList(cc),
        parsedBcc: parseEmailList(bcc)
    };
};

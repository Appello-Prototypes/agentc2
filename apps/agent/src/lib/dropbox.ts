/**
 * Dropbox OAuth + API Library
 *
 * Standalone OAuth2 with PKCE for Dropbox. Handles token exchange,
 * refresh, and API calls with automatic token refresh.
 * Also manages delta cursors for webhook change tracking.
 */

import { prisma } from "@repo/database";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-crypto";

// ── Constants ──────────────────────────────────────────────────────

const AUTHORIZATION_ENDPOINT = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_ENDPOINT = "https://api.dropboxapi.com/oauth2/token";
const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

// ── Types ──────────────────────────────────────────────────────────

export type DropboxTokens = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    accountId?: string;
    uid?: string;
    tokenType?: string;
};

export type DropboxClientCredentials = {
    appKey: string;
    appSecret: string;
};

type DropboxTokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    uid?: string;
    account_id?: string;
};

export type DropboxFileEntry = {
    ".tag": "file" | "folder" | "deleted";
    name: string;
    path_lower?: string;
    path_display?: string;
    id?: string;
    size?: number;
    is_downloadable?: boolean;
    server_modified?: string;
    client_modified?: string;
    rev?: string;
    content_hash?: string;
};

type DropboxListFolderResult = {
    entries: DropboxFileEntry[];
    cursor: string;
    has_more: boolean;
};

// ── Credential Resolution ──────────────────────────────────────────

export function getDropboxClientCredentials(
    connectionMetadata?: Record<string, unknown> | null
): DropboxClientCredentials {
    const meta = connectionMetadata || {};
    const appKey =
        (typeof meta.dropboxAppKey === "string" && meta.dropboxAppKey) ||
        process.env.DROPBOX_APP_KEY;
    const appSecret =
        (typeof meta.dropboxAppSecret === "string" && meta.dropboxAppSecret) ||
        process.env.DROPBOX_APP_SECRET;

    if (!appKey || !appSecret) {
        throw new Error(
            "Dropbox OAuth not configured. Set DROPBOX_APP_KEY and DROPBOX_APP_SECRET."
        );
    }

    return { appKey, appSecret };
}

// ── URL Builders ───────────────────────────────────────────────────

export function buildDropboxAuthorizationUrl(params: {
    appKey: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
}): string {
    const { appKey, redirectUri, state, codeChallenge } = params;
    const url = new URL(AUTHORIZATION_ENDPOINT);

    url.searchParams.set("client_id", appKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("token_access_type", "offline");

    return url.toString();
}

export function getDropboxRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const isProduction = process.env.NODE_ENV === "production";
    const prefix = isProduction ? "/agent" : "";
    return `${base}${prefix}/api/integrations/dropbox/callback`;
}

// ── Token Exchange ─────────────────────────────────────────────────

export async function exchangeDropboxCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    credentials: DropboxClientCredentials;
}): Promise<DropboxTokens> {
    const { code, codeVerifier, redirectUri, credentials } = params;

    const body = new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: credentials.appKey,
        client_secret: credentials.appSecret
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Dropbox token exchange failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as DropboxTokenResponse;

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        accountId: data.account_id,
        uid: data.uid,
        tokenType: data.token_type
    };
}

// ── Token Refresh ──────────────────────────────────────────────────

export async function refreshDropboxToken(params: {
    refreshToken: string;
    credentials: DropboxClientCredentials;
}): Promise<DropboxTokens> {
    const { refreshToken, credentials } = params;

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: credentials.appKey,
        client_secret: credentials.appSecret
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Dropbox token refresh failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as DropboxTokenResponse;

    return {
        accessToken: data.access_token,
        refreshToken: refreshToken, // Dropbox doesn't return new refresh token
        expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: data.token_type
    };
}

// ── Connection Helpers ─────────────────────────────────────────────

export async function loadDropboxTokens(
    connectionId: string
): Promise<{ tokens: DropboxTokens; connectionMetadata: Record<string, unknown> | null }> {
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });

    if (!connection || !connection.isActive) {
        throw new Error("Dropbox connection not found or inactive");
    }

    const decrypted = decryptCredentials(connection.credentials);
    if (!decrypted || typeof decrypted !== "object" || Array.isArray(decrypted)) {
        throw new Error("Failed to decrypt Dropbox credentials");
    }

    const creds = decrypted as Record<string, unknown>;
    const tokens: DropboxTokens = {
        accessToken: (creds.accessToken as string) || "",
        refreshToken: creds.refreshToken as string | undefined,
        expiresAt: (creds.expiresAt as number) || 0,
        accountId: creds.accountId as string | undefined,
        uid: creds.uid as string | undefined
    };

    const connectionMetadata =
        connection.metadata && typeof connection.metadata === "object"
            ? (connection.metadata as Record<string, unknown>)
            : null;

    return { tokens, connectionMetadata };
}

export async function saveDropboxTokens(
    connectionId: string,
    tokens: DropboxTokens
): Promise<void> {
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });

    const existingCreds =
        connection?.credentials && typeof connection.credentials === "object"
            ? (decryptCredentials(connection.credentials) as Record<string, unknown>)
            : {};

    const merged = {
        ...existingCreds,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || existingCreds?.refreshToken,
        expiresAt: tokens.expiresAt,
        accountId: tokens.accountId || existingCreds?.accountId,
        uid: tokens.uid || existingCreds?.uid,
        tokenType: tokens.tokenType || existingCreds?.tokenType
    };

    const encrypted = encryptCredentials(merged);

    await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: {
            credentials: encrypted ? JSON.parse(JSON.stringify(encrypted)) : null,
            lastUsedAt: new Date(),
            errorMessage: null,
            isActive: true
        }
    });
}

// ── Dropbox API Client ─────────────────────────────────────────────

/**
 * Call Dropbox API with automatic token refresh.
 */
export async function callDropboxApi<T = unknown>(params: {
    connectionId: string;
    endpoint: string;
    body?: unknown;
    isContent?: boolean;
}): Promise<T> {
    const { connectionId, endpoint, body, isContent = false } = params;

    const makeRequest = async (accessToken: string): Promise<Response> => {
        const base = isContent ? CONTENT_BASE : API_BASE;
        const url = `${base}${endpoint}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`
        };

        if (isContent) {
            headers["Dropbox-API-Arg"] = JSON.stringify(body || {});
        } else {
            headers["Content-Type"] = "application/json";
        }

        return fetch(url, {
            method: "POST",
            headers,
            body: isContent ? undefined : JSON.stringify(body || {})
        });
    };

    const { tokens, connectionMetadata } = await loadDropboxTokens(connectionId);
    const credentials = getDropboxClientCredentials(connectionMetadata);

    const isExpired = Date.now() > tokens.expiresAt - 5 * 60 * 1000;
    let accessToken = tokens.accessToken;

    if (isExpired && tokens.refreshToken) {
        try {
            const newTokens = await refreshDropboxToken({
                refreshToken: tokens.refreshToken,
                credentials
            });
            newTokens.accountId = tokens.accountId;
            newTokens.uid = tokens.uid;
            await saveDropboxTokens(connectionId, newTokens);
            accessToken = newTokens.accessToken;
        } catch (refreshError) {
            await prisma.integrationConnection.update({
                where: { id: connectionId },
                data: {
                    isActive: false,
                    errorMessage: `Token refresh failed: ${(refreshError as Error).message}. Re-authentication required.`
                }
            });
            throw refreshError;
        }
    }

    let response = await makeRequest(accessToken);

    if (response.status === 401 && tokens.refreshToken) {
        try {
            const newTokens = await refreshDropboxToken({
                refreshToken: tokens.refreshToken,
                credentials
            });
            newTokens.accountId = tokens.accountId;
            newTokens.uid = tokens.uid;
            await saveDropboxTokens(connectionId, newTokens);
            response = await makeRequest(newTokens.accessToken);
        } catch (refreshError) {
            await prisma.integrationConnection.update({
                where: { id: connectionId },
                data: {
                    isActive: false,
                    errorMessage: `Token refresh failed: ${(refreshError as Error).message}. Re-authentication required.`
                }
            });
            throw refreshError;
        }
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Dropbox API ${endpoint} failed (${response.status}): ${errorText}`);
    }

    if (isContent) {
        // Content endpoints return the file data; metadata is in Dropbox-API-Result header
        const resultHeader = response.headers.get("Dropbox-API-Result");
        return (resultHeader ? JSON.parse(resultHeader) : {}) as T;
    }

    return (await response.json()) as T;
}

// ── File Operations ────────────────────────────────────────────────

export async function listFiles(
    connectionId: string,
    path: string = ""
): Promise<DropboxFileEntry[]> {
    const result = await callDropboxApi<DropboxListFolderResult>({
        connectionId,
        endpoint: "/files/list_folder",
        body: {
            path: path || "",
            recursive: false,
            include_media_info: false,
            include_deleted: false,
            limit: 100
        }
    });

    const entries = result.entries || [];

    if (result.has_more) {
        let cursor = result.cursor;
        let hasMore = result.has_more;
        while (hasMore) {
            const more = await callDropboxApi<DropboxListFolderResult>({
                connectionId,
                endpoint: "/files/list_folder/continue",
                body: { cursor }
            });
            entries.push(...(more.entries || []));
            cursor = more.cursor;
            hasMore = more.has_more;
        }
    }

    return entries;
}

export async function getFileMetadata(
    connectionId: string,
    path: string
): Promise<DropboxFileEntry> {
    return callDropboxApi<DropboxFileEntry>({
        connectionId,
        endpoint: "/files/get_metadata",
        body: { path, include_media_info: true }
    });
}

export async function downloadFile(
    connectionId: string,
    path: string
): Promise<{ metadata: DropboxFileEntry; content: string }> {
    const { tokens } = await loadDropboxTokens(connectionId);
    const response = await fetch(`${CONTENT_BASE}/files/download`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            "Dropbox-API-Arg": JSON.stringify({ path })
        }
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Dropbox download failed (${response.status}): ${errorText}`);
    }

    const resultHeader = response.headers.get("Dropbox-API-Result");
    const metadata = resultHeader
        ? (JSON.parse(resultHeader) as DropboxFileEntry)
        : ({} as DropboxFileEntry);
    const content = await response.text();

    return { metadata, content };
}

export async function uploadFile(
    connectionId: string,
    path: string,
    content: string,
    mode: "add" | "overwrite" = "add"
): Promise<DropboxFileEntry> {
    const { tokens } = await loadDropboxTokens(connectionId);
    const response = await fetch(`${CONTENT_BASE}/files/upload`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            "Dropbox-API-Arg": JSON.stringify({
                path,
                mode,
                autorename: true,
                mute: false
            }),
            "Content-Type": "application/octet-stream"
        },
        body: content
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Dropbox upload failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as DropboxFileEntry;
}

export async function searchFiles(
    connectionId: string,
    query: string,
    path: string = ""
): Promise<DropboxFileEntry[]> {
    const result = await callDropboxApi<{
        matches: Array<{ metadata: { metadata: DropboxFileEntry } }>;
        has_more: boolean;
    }>({
        connectionId,
        endpoint: "/files/search_v2",
        body: {
            query,
            options: {
                path: path || "",
                max_results: 50,
                file_status: "active"
            }
        }
    });

    return (result.matches || []).map((m) => m.metadata.metadata);
}

export async function getSharingLinks(
    connectionId: string,
    path: string
): Promise<Array<{ url: string; name: string }>> {
    const result = await callDropboxApi<{
        links: Array<{ url: string; name: string; path_lower: string }>;
    }>({
        connectionId,
        endpoint: "/sharing/list_shared_links",
        body: { path, direct_only: true }
    });

    return (result.links || []).map((link) => ({
        url: link.url,
        name: link.name
    }));
}

// ── Delta Cursor Management ────────────────────────────────────────

/**
 * Get the initial cursor for tracking changes (used when setting up webhooks).
 */
export async function getLatestCursor(connectionId: string, path: string = ""): Promise<string> {
    const result = await callDropboxApi<{ cursor: string }>({
        connectionId,
        endpoint: "/files/list_folder/get_latest_cursor",
        body: { path: path || "", recursive: true, include_deleted: false }
    });
    return result.cursor;
}

/**
 * Get changes since the last cursor.
 */
export async function getChangesSinceCursor(
    connectionId: string,
    cursor: string
): Promise<{ entries: DropboxFileEntry[]; newCursor: string }> {
    const allEntries: DropboxFileEntry[] = [];
    let currentCursor = cursor;
    let hasMore = true;

    while (hasMore) {
        const result = await callDropboxApi<DropboxListFolderResult>({
            connectionId,
            endpoint: "/files/list_folder/continue",
            body: { cursor: currentCursor }
        });
        allEntries.push(...(result.entries || []));
        currentCursor = result.cursor;
        hasMore = result.has_more;
    }

    return { entries: allEntries, newCursor: currentCursor };
}

/**
 * Get the Dropbox account info (for identifying webhook notifications).
 */
export async function getAccountInfo(
    connectionId: string
): Promise<{ accountId: string; email: string; displayName: string }> {
    const result = await callDropboxApi<{
        account_id: string;
        email: string;
        name: { display_name: string };
    }>({
        connectionId,
        endpoint: "/users/get_current_account",
        body: null
    });

    return {
        accountId: result.account_id,
        email: result.email,
        displayName: result.name?.display_name || ""
    };
}

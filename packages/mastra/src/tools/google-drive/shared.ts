/**
 * Shared Google Drive helpers
 *
 * Common utilities for all Google Drive tools: authenticated API calls
 * using the same Google OAuth credentials as Gmail/Calendar.
 */

import {
    getAccessToken,
    refreshAccessToken,
    decrypt,
    checkGoogleScopes,
    resolveGmailAddress
} from "../gmail/shared";
import { prisma } from "@repo/database";

export const DRIVE_API = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/** Required scopes for read operations (search, list, read). */
export const DRIVE_READ_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

/** Required scopes for write operations (create doc). */
export const DRIVE_WRITE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/**
 * Make an authenticated Google Drive API call with automatic token refresh on 401.
 */
export const callDriveApi = async (
    gmailAddress: string,
    baseUrl: string,
    path: string,
    options?: {
        method?: string;
        body?: unknown;
        params?: Record<string, string>;
        headers?: Record<string, string>;
        rawBody?: BodyInit;
    }
): Promise<Response> => {
    let token = await getAccessToken(gmailAddress);

    const url = new URL(`${baseUrl}${path}`);
    if (options?.params) {
        Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const fetchOptions: RequestInit = {
        method: options?.method || "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            ...(!options?.rawBody ? { "Content-Type": "application/json" } : {}),
            ...(options?.headers || {})
        }
    };

    if (options?.rawBody) {
        fetchOptions.body = options.rawBody;
    } else if (options?.body) {
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
                    const retryHeaders: Record<string, string> = {
                        Authorization: `Bearer ${token}`,
                        ...(options?.headers || {})
                    };
                    if (!options?.rawBody) {
                        retryHeaders["Content-Type"] = "application/json";
                    }
                    fetchOptions.headers = retryHeaders;
                    response = await fetch(url.toString(), fetchOptions);
                }
            }
        }
    }

    return response;
};

export { checkGoogleScopes, resolveGmailAddress };

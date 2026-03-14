/**
 * Shared Google Calendar helpers
 *
 * Common utilities for all Google Calendar tools: authenticated API calls
 * using the same Google OAuth credentials as Gmail.
 */

import {
    getAccessToken,
    refreshAccessToken,
    decrypt,
    checkGoogleScopes,
    resolveGmailAddress
} from "../gmail/shared";
import { prisma } from "@repo/database";

export const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/** Required scopes for read operations (search, list, get). */
export const CALENDAR_READ_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

/** Required scopes for write operations (create, update). */
export const CALENDAR_WRITE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

/**
 * Make an authenticated Google Calendar API GET call with automatic token refresh on 401.
 */
export const callCalendarApi = async (
    gmailAddress: string,
    path: string,
    params?: Record<string, string>
): Promise<Response> => {
    let token = await getAccessToken(gmailAddress);

    const url = new URL(`${CALENDAR_API}${path}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    let response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
        const refreshResult = await refreshConnectionToken(gmailAddress);
        if (refreshResult) {
            token = refreshResult.token;
            response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${token}` }
            });
        }
    }

    return response;
};

/**
 * Make an authenticated Google Calendar API call with a JSON body (POST/PATCH/PUT).
 * Supports automatic token refresh on 401.
 */
export const callCalendarApiWithBody = async (
    gmailAddress: string,
    path: string,
    options: {
        method: "POST" | "PATCH" | "PUT" | "DELETE";
        body?: unknown;
        params?: Record<string, string>;
    }
): Promise<Response> => {
    let token = await getAccessToken(gmailAddress);

    const url = new URL(`${CALENDAR_API}${path}`);
    if (options.params) {
        Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const fetchOptions: RequestInit = {
        method: options.method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    };
    if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    let response = await fetch(url.toString(), fetchOptions);

    if (response.status === 401) {
        const refreshResult = await refreshConnectionToken(gmailAddress);
        if (refreshResult) {
            token = refreshResult.token;
            fetchOptions.headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            };
            response = await fetch(url.toString(), fetchOptions);
        }
    }

    return response;
};

/**
 * Find the Gmail connection (cross-org fallback) and refresh the token.
 */
async function refreshConnectionToken(
    gmailAddress: string
): Promise<{ token: string } | null> {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "gmail" }
    });
    const integration = await prisma.gmailIntegration.findFirst({
        where: { gmailAddress, isActive: true },
        include: { workspace: { select: { organizationId: true } } }
    });
    const organizationId = integration?.workspace?.organizationId;
    if (!provider || !organizationId) return null;

    let connection = await prisma.integrationConnection.findFirst({
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

    if (!connection) {
        connection = await prisma.integrationConnection.findFirst({
            where: {
                providerId: provider.id,
                isActive: true,
                OR: [
                    { metadata: { path: ["gmailAddress"], equals: gmailAddress } },
                    { credentials: { path: ["gmailAddress"], equals: gmailAddress } }
                ]
            }
        });
    }

    if (!connection) return null;

    const connOrgId = connection.organizationId;
    const creds = decrypt(connection.credentials, connOrgId);
    if (!creds?.refreshToken) return null;

    const refreshed = await refreshAccessToken(creds.refreshToken as string);
    if (!refreshed) return null;

    const newExpiryDate = refreshed.expiresIn
        ? Date.now() + refreshed.expiresIn * 1000
        : Date.now() + 3600 * 1000;

    const updatedCreds = {
        ...creds,
        accessToken: refreshed.accessToken,
        expiryDate: newExpiryDate,
        ...(refreshed.scope && { scope: refreshed.scope })
    };

    const { encryptCredentials } = await import("../../mcp/client");
    const encrypted = encryptCredentials(updatedCreds, connOrgId) as Record<string, unknown>;

    await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { credentials: encrypted }
    });

    return { token: refreshed.accessToken };
}

export { checkGoogleScopes, resolveGmailAddress };

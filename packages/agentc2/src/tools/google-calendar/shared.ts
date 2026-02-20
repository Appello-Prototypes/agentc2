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
                    response = await fetch(url.toString(), {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }
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

export { checkGoogleScopes, resolveGmailAddress };

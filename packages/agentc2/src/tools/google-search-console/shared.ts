/**
 * Shared Google Search Console helpers
 *
 * Uses the google-search-console IntegrationConnection directly
 * (created by syncSiblingGoogleConnections) instead of the gmail connection.
 * Requires the `webmasters.readonly` scope.
 */

import {
    refreshAccessToken,
    decrypt,
    checkGoogleScopes,
    resolveGmailAddress
} from "../gmail/shared";
import { prisma } from "@repo/database";

export const GSC_API = "https://searchconsole.googleapis.com";

export const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

/**
 * Get access token from the google-search-console IntegrationConnection.
 * Falls back to gmail connection if GSC connection doesn't exist.
 */
const getGscAccessToken = async (
    gmailAddress: string
): Promise<{ token: string; connectionId: string; organizationId: string }> => {
    const integration = await prisma.gmailIntegration.findFirst({
        where: { gmailAddress, isActive: true },
        include: { workspace: { select: { organizationId: true } } }
    });
    if (!integration) throw new Error(`No active integration for ${gmailAddress}`);
    const organizationId = integration.workspace?.organizationId;
    if (!organizationId) throw new Error("Organization not found");

    const providerKeys = ["google-search-console", "gmail"];

    for (const key of providerKeys) {
        const provider = await prisma.integrationProvider.findUnique({
            where: { key }
        });
        if (!provider) continue;

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
        if (!connection) continue;

        const creds = decrypt(connection.credentials, connection.organizationId);
        if (!creds) continue;

        const expiryDate = typeof creds.expiryDate === "number" ? creds.expiryDate : 0;
        const isExpired = Date.now() > expiryDate - 5 * 60 * 1000;

        if (!isExpired && creds.accessToken) {
            console.log(
                `[getGscAccessToken] Using ${key} connection, scope: ${creds.scope || "NONE"}, expired: false`
            );
            return {
                token: creds.accessToken as string,
                connectionId: connection.id,
                organizationId
            };
        }

        if (creds.refreshToken) {
            const refreshed = await refreshAccessToken(creds.refreshToken as string);
            if (refreshed) {
                console.log(
                    `[getGscAccessToken] Refreshed ${key} token, scope: ${refreshed.scope || "NONE"}`
                );

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
                const encrypted = encryptCredentials(
                    updatedCreds,
                    connection.organizationId
                ) as Record<string, unknown>;

                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: { credentials: encrypted }
                });

                return {
                    token: refreshed.accessToken,
                    connectionId: connection.id,
                    organizationId: connection.organizationId
                };
            }
        }
    }

    throw new Error("No valid Google credentials found for Search Console access");
};

/**
 * Make an authenticated Google Search Console API call with automatic token refresh on 401.
 */
export const callGscApi = async (
    gmailAddress: string,
    path: string,
    options?: {
        method?: string;
        body?: unknown;
        params?: Record<string, string>;
    }
): Promise<Response> => {
    const { token: initialToken, connectionId, organizationId } =
        await getGscAccessToken(gmailAddress);
    let token = initialToken;

    const url = new URL(`${GSC_API}${path}`);
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

    if (response.status === 401) {
        const connection = await prisma.integrationConnection.findUnique({
            where: { id: connectionId }
        });
        const connOrgId = connection?.organizationId || organizationId;
        const creds = decrypt(connection?.credentials, connOrgId);
        if (creds?.refreshToken && connection) {
            const refreshed = await refreshAccessToken(creds.refreshToken as string);
            if (refreshed) {
                token = refreshed.accessToken;

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
                const encrypted = encryptCredentials(updatedCreds, connOrgId) as Record<
                    string,
                    unknown
                >;

                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: { credentials: encrypted }
                });

                fetchOptions.headers = {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                };
                response = await fetch(url.toString(), fetchOptions);
            }
        }
    }

    return response;
};

export { checkGoogleScopes, resolveGmailAddress };

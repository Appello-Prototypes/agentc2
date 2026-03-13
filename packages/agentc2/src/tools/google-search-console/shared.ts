/**
 * Shared Google Search Console helpers
 *
 * Authenticated API calls using the same Google OAuth credentials as Gmail.
 * Requires the `webmasters.readonly` scope.
 */

import {
    getAccessToken,
    refreshAccessToken,
    decrypt,
    checkGoogleScopes,
    resolveGmailAddress
} from "../gmail/shared";
import { prisma } from "@repo/database";

export const GSC_API = "https://searchconsole.googleapis.com";

export const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

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
    let token = await getAccessToken(gmailAddress);

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
                    const encrypted = encryptCredentials(
                        updatedCreds,
                        organizationId
                    ) as Record<string, unknown>;

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
    }

    return response;
};

export { checkGoogleScopes, resolveGmailAddress };

/**
 * Shared MoltBook REST API helpers.
 *
 * Thin wrapper around the MoltBook public API (https://www.moltbook.com/api/v1).
 * Used by all moltbook-* tools. Follows the same pattern as github-helpers.ts.
 */

const MOLTBOOK_API = "https://www.moltbook.com/api/v1";

const MOLTBOOK_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json"
} as const;

/**
 * Resolve a MoltBook API key.
 *
 * Priority:
 *  1. Per-org IntegrationConnection (provider key = "moltbook")
 *  2. MOLTBOOK_API_KEY environment variable
 */
export async function resolveMoltBookToken(organizationId?: string): Promise<string> {
    if (organizationId) {
        try {
            const { prisma } = await import("@repo/database");
            const { decryptJson } = await import("../crypto/encryption");

            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    isActive: true,
                    provider: { key: "moltbook" },
                    organizationId
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
            });

            if (connection?.credentials) {
                const decrypted = decryptJson(connection.credentials);
                const token =
                    (decrypted?.MOLTBOOK_API_KEY as string) ||
                    (decrypted?.api_key as string) ||
                    (decrypted?.token as string);
                if (token) return token;
            }
        } catch (err) {
            console.warn("[moltbook-helpers] Failed to resolve org credentials:", err);
        }
    }

    const envToken = process.env.MOLTBOOK_API_KEY;
    if (envToken) return envToken;

    throw new Error(
        "No MoltBook API key found. Configure a MoltBook integration or set MOLTBOOK_API_KEY."
    );
}

/**
 * Thin wrapper around fetch that adds Bearer auth + standard MoltBook headers.
 */
export async function moltbookFetch(
    path: string,
    token: string,
    options: RequestInit = {}
): Promise<Response> {
    return fetch(`${MOLTBOOK_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...MOLTBOOK_HEADERS,
            ...options.headers
        }
    });
}

/**
 * Convenience: call a MoltBook endpoint and return parsed JSON.
 * Throws on non-2xx responses with the error body.
 */
export async function moltbookRequest<T = unknown>(
    path: string,
    token: string,
    options: {
        method?: string;
        body?: Record<string, unknown>;
        query?: Record<string, string | number | undefined>;
    } = {}
): Promise<T> {
    let url = path;
    if (options.query) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(options.query)) {
            if (v !== undefined && v !== null) params.set(k, String(v));
        }
        const qs = params.toString();
        if (qs) url = `${path}?${qs}`;
    }

    const response = await moltbookFetch(url, token, {
        method: options.method ?? "GET",
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`MoltBook API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<T>;
}

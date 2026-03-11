import { prisma } from "@repo/database";

const orgSlugCache = new Map<string, string>();

export async function resolveOrgSlug(organizationId: string): Promise<string | undefined> {
    const cached = orgSlugCache.get(organizationId);
    if (cached) return cached;
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true }
    });
    if (org?.slug) {
        orgSlugCache.set(organizationId, org.slug);
        return org.slug;
    }
    return undefined;
}

export function getInternalBaseUrl(): string {
    return process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
}

export function buildHeaders(organizationSlug?: string): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const effectiveSlug =
        organizationSlug ||
        process.env.MASTRA_ORGANIZATION_SLUG ||
        process.env.MCP_API_ORGANIZATION_SLUG;
    if (effectiveSlug) {
        headers["X-Organization-Slug"] = effectiveSlug;
    }
    return headers;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callInternalApi(
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
        organizationId?: string;
    }
): Promise<any> {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const orgSlug = options?.organizationId
        ? await resolveOrgSlug(options.organizationId)
        : undefined;

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(orgSlug),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        const errorMessage =
            (data && typeof data === "object" && "error" in data ? data.error : undefined) ||
            `Request failed (${response.status})`;
        throw new Error(String(errorMessage));
    }
    return data;
}

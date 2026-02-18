import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";
import { validateAccessToken } from "@/lib/mcp-oauth";

/**
 * Authenticate an API request via API key or session cookie.
 *
 * Supports two authentication methods:
 * 1. **API Key** (for MCP clients / programmatic access):
 *    - Header: `X-API-Key` or `Authorization: Bearer <key>`
 *    - Organization context via `X-Organization-Slug` header
 *    - Validated against `MCP_API_KEY` env var or `ToolCredential` table
 * 2. **Session Cookie** (for browser clients):
 *    - Falls back to Better Auth session via `auth.api.getSession()`
 *
 * Returns `{ userId, organizationId }` on success, or `null` on failure.
 */
export async function authenticateRequest(
    request?: NextRequest
): Promise<{ userId: string; organizationId: string } | null> {
    // --- API Key Authentication ---
    const apiKey = request
        ? request.headers.get("x-api-key") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
        : null;

    if (apiKey) {
        const oauthToken = validateAccessToken(apiKey);
        if (oauthToken) {
            const membership = await prisma.membership.findFirst({
                where: { organizationId: oauthToken.organizationId },
                select: { userId: true }
            });
            if (membership) {
                return { userId: membership.userId, organizationId: oauthToken.organizationId };
            }
        }

        const orgSlugHeader = request!.headers.get("x-organization-slug")?.trim();

        const resolveOrgContext = async (orgSlug: string) => {
            const org = await prisma.organization.findUnique({
                where: { slug: orgSlug },
                select: { id: true }
            });
            if (!org) return null;

            const membership = await prisma.membership.findFirst({
                where: { organizationId: org.id },
                select: { userId: true }
            });
            if (!membership) return null;

            return { userId: membership.userId, organizationId: org.id };
        };

        // Check against MCP_API_KEY env var
        const validApiKey = process.env.MCP_API_KEY;
        if (validApiKey && apiKey === validApiKey) {
            const orgSlug = orgSlugHeader || process.env.MCP_API_ORGANIZATION_SLUG;
            if (orgSlug) {
                const context = await resolveOrgContext(orgSlug);
                if (context) return context;
            }
        }

        // Check against ToolCredential table (database-stored API keys)
        if (orgSlugHeader) {
            const org = await prisma.organization.findUnique({
                where: { slug: orgSlugHeader },
                select: { id: true }
            });
            if (org) {
                const credential = await prisma.toolCredential.findUnique({
                    where: {
                        organizationId_toolId: {
                            organizationId: org.id,
                            toolId: "mastra-mcp-api"
                        }
                    },
                    select: { credentials: true, isActive: true }
                });
                const credentialPayload = credential?.credentials;
                const storedKey =
                    credentialPayload &&
                    typeof credentialPayload === "object" &&
                    !Array.isArray(credentialPayload)
                        ? (credentialPayload as { apiKey?: string }).apiKey
                        : undefined;
                if (credential?.isActive && storedKey && storedKey === apiKey) {
                    const context = await resolveOrgContext(orgSlugHeader);
                    if (context) return context;
                }
            }
        }

        // API key provided but invalid
        return null;
    }

    // --- Session Cookie Authentication ---
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) return null;

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) return null;

        return { userId: session.user.id, organizationId };
    } catch {
        return null;
    }
}

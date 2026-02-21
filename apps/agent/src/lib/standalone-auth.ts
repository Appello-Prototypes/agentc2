import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { validateStoredApiKey } from "@/lib/api-key-hash";

/**
 * Check if running in standalone mode (demo access without authentication)
 *
 * Standalone mode is enabled when:
 * - STANDALONE_DEMO=true (explicit)
 *
 * By default, authentication is required.
 */
export function isStandaloneDeployment(): boolean {
    // Explicit standalone mode
    return process.env.STANDALONE_DEMO === "true";
}

/**
 * Demo user returned when running in standalone mode without authentication
 */
export const DEMO_USER = {
    id: "demo-user",
    email: "demo@example.com",
    name: "Demo User"
};

export interface DemoUser {
    id: string;
    email: string;
    name: string;
}

export interface DemoSession {
    user: DemoUser;
}

/**
 * Get session for demo routes.
 * Supports API key auth (via X-API-Key header), standalone mode, and session cookies.
 *
 * @param request - Optional NextRequest to check API key headers
 * @returns Session with user, or null if unauthorized
 */
export async function getDemoSession(request?: NextRequest): Promise<DemoSession | null> {
    // Try API key authentication first (for MCP clients)
    if (request) {
        const apiKey =
            request.headers.get("x-api-key") ||
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

        if (apiKey) {
            const orgSlugHeader = request.headers.get("x-organization-slug")?.trim();

            const resolveUser = async (orgSlug: string) => {
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

                return { id: membership.userId, email: "api@mcp", name: "MCP API" };
            };

            // Check against MCP_API_KEY env var
            const validApiKey = process.env.MCP_API_KEY;
            if (validApiKey && apiKey === validApiKey) {
                const orgSlug = orgSlugHeader || process.env.MCP_API_ORGANIZATION_SLUG;
                if (orgSlug) {
                    const user = await resolveUser(orgSlug);
                    if (user) return { user };
                }
            }

            // Check against ToolCredential table
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
                    if (
                        credential &&
                        validateStoredApiKey(apiKey, credential.credentials, credential.isActive)
                    ) {
                        const user = await resolveUser(orgSlugHeader);
                        if (user) return { user };
                    }
                }
            }

            // API key provided but invalid
            return null;
        }
    }

    // In standalone mode, return demo user without auth check
    if (isStandaloneDeployment()) {
        return { user: DEMO_USER };
    }

    // In authenticated mode, verify session
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return null;
        }
        return {
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name
            }
        };
    } catch (error) {
        console.error("Auth error in demo route:", error);
        return null;
    }
}

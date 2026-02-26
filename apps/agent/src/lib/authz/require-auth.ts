import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrganizationId } from "@/lib/organization";

export type AuthContext = {
    userId: string;
    organizationId: string;
};

export type UserOnlyContext = {
    userId: string;
};

export type AuthResult<T> =
    | { context: T; response?: undefined }
    | { context?: undefined; response: NextResponse };

/**
 * Require authenticated user with organization context.
 * Supports both API key and session cookie authentication.
 *
 * Returns 401 if not authenticated, or if no organization membership found.
 *
 * @example
 * const authResult = await requireAuth(request);
 * if (authResult.response) return authResult.response;
 * const { userId, organizationId } = authResult.context;
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult<AuthContext>> {
    const context = await authenticateRequest(request);
    if (!context) {
        return {
            response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        };
    }
    return { context };
}

/**
 * Require authenticated user only (no organization required).
 * Uses session cookie authentication.
 *
 * Returns 401 if not authenticated.
 *
 * @example
 * const authResult = await requireUser();
 * if (authResult.response) return authResult.response;
 * const { userId } = authResult.context;
 */
export async function requireUser(): Promise<AuthResult<UserOnlyContext>> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
        return {
            response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        };
    }
    return { context: { userId: session.user.id } };
}

/**
 * Require authenticated user with organization context via session cookie.
 * More explicit than requireAuth() - specifically for session-based routes.
 *
 * Returns 401 if not authenticated.
 * Returns 403 if no organization membership found.
 *
 * @example
 * const authResult = await requireUserWithOrg();
 * if (authResult.response) return authResult.response;
 * const { userId, organizationId } = authResult.context;
 */
export async function requireUserWithOrg(): Promise<AuthResult<AuthContext>> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
        return {
            response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        };
    }

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) {
        return {
            response: NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            )
        };
    }

    return { context: { userId: session.user.id, organizationId } };
}

/**
 * Require authenticated user with specific organization role.
 * Checks if the user has at least one of the specified roles in their organization.
 *
 * Returns 401 if not authenticated.
 * Returns 403 if no organization membership or insufficient permissions.
 *
 * @example
 * const authResult = await requireRole(request, ["owner", "admin"]);
 * if (authResult.response) return authResult.response;
 * const { userId, organizationId } = authResult.context;
 */
export async function requireRole(
    request: NextRequest,
    allowedRoles: string[]
): Promise<AuthResult<AuthContext>> {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult;

    const { userId, organizationId } = authResult.context;

    const membership = await prisma.membership.findFirst({
        where: { userId, organizationId }
    });

    if (!membership || !allowedRoles.includes(membership.role)) {
        return {
            response: NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            )
        };
    }

    return { context: authResult.context };
}

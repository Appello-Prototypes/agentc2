/**
 * Entity-Level RBAC Middleware
 *
 * Provides consistent role-based access checks for platform entities.
 * Uses the membership role from the authenticated user's org context.
 */

import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export type EntityAction = "read" | "execute" | "create" | "update" | "delete" | "admin";

const ROLE_PERMISSIONS: Record<string, EntityAction[]> = {
    owner: ["read", "execute", "create", "update", "delete", "admin"],
    admin: ["read", "execute", "create", "update", "delete", "admin"],
    member: ["read", "execute", "create", "update"],
    viewer: ["read"]
};

export interface EntityAccessResult {
    allowed: true;
    role: string;
    response?: undefined;
}

export interface EntityAccessDenied {
    allowed: false;
    role?: string;
    response: NextResponse;
}

/**
 * Check if a user has the required permission for an entity action.
 *
 * @param userId         - Authenticated user ID
 * @param organizationId - Organization the entity belongs to
 * @param action         - The action being performed
 * @returns { allowed, role } on success, { allowed: false, response } on denial
 */
export async function requireEntityAccess(
    userId: string,
    organizationId: string,
    action: EntityAction
): Promise<EntityAccessResult | EntityAccessDenied> {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: { userId, organizationId }
        },
        select: { role: true }
    });

    if (!membership) {
        return {
            allowed: false,
            response: NextResponse.json(
                { success: false, error: "Not a member of this organization" },
                { status: 403 }
            )
        };
    }

    const permissions = ROLE_PERMISSIONS[membership.role] || [];
    if (!permissions.includes(action)) {
        return {
            allowed: false,
            role: membership.role,
            response: NextResponse.json(
                {
                    success: false,
                    error: `Insufficient permissions: '${membership.role}' role cannot '${action}'`
                },
                { status: 403 }
            )
        };
    }

    return { allowed: true, role: membership.role };
}

/**
 * Convenience helper: check minimum role for an action.
 * Returns the user's role or a 403 response.
 */
export function canPerform(role: string, action: EntityAction): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(action);
}

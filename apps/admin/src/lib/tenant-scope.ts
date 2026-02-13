/**
 * Tenant Scoping Helpers
 *
 * Every admin query that touches tenant data must go through these helpers
 * to prevent cross-tenant data leakage.
 */

/**
 * Prisma where clause to scope queries by organization.
 * Use when querying entities that belong to a workspace within an org.
 */
export function tenantWhere(orgId: string) {
    return {
        workspace: { organizationId: orgId }
    };
}

/**
 * Direct organization scope for entities directly on org.
 */
export function orgWhere(orgId: string) {
    return {
        organizationId: orgId
    };
}

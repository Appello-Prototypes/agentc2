/**
 * Admin RBAC Permission Matrix
 *
 * Roles (hierarchical):
 *   super_admin > platform_admin > billing_admin > support_agent > viewer
 *
 * Each action maps to the minimum required role.
 */

export type AdminRole =
    | "super_admin"
    | "platform_admin"
    | "billing_admin"
    | "support_agent"
    | "viewer";

export type AdminAction =
    // Tenant management
    | "tenant:list"
    | "tenant:read"
    | "tenant:create"
    | "tenant:update"
    | "tenant:suspend"
    | "tenant:reactivate"
    | "tenant:delete"
    // User management
    | "user:list"
    | "user:read"
    | "user:reset_password"
    | "user:force_logout"
    | "user:impersonate"
    // Feature flags
    | "flag:list"
    | "flag:read"
    | "flag:create"
    | "flag:update"
    | "flag:delete"
    | "flag:override"
    // Billing
    | "billing:list"
    | "billing:read"
    | "billing:update"
    // Observability
    | "metrics:read"
    | "audit:read"
    // Admin user management
    | "admin:list"
    | "admin:create"
    | "admin:update"
    | "admin:delete";

const ROLE_HIERARCHY: Record<AdminRole, number> = {
    viewer: 0,
    support_agent: 1,
    billing_admin: 2,
    platform_admin: 3,
    super_admin: 4
};

/**
 * Minimum role required for each action.
 */
const ACTION_MIN_ROLE: Record<AdminAction, AdminRole> = {
    // Tenant management
    "tenant:list": "viewer",
    "tenant:read": "viewer",
    "tenant:create": "platform_admin",
    "tenant:update": "platform_admin",
    "tenant:suspend": "platform_admin",
    "tenant:reactivate": "platform_admin",
    "tenant:delete": "super_admin",

    // User management
    "user:list": "support_agent",
    "user:read": "support_agent",
    "user:reset_password": "support_agent",
    "user:force_logout": "support_agent",
    "user:impersonate": "platform_admin",

    // Feature flags
    "flag:list": "viewer",
    "flag:read": "viewer",
    "flag:create": "platform_admin",
    "flag:update": "platform_admin",
    "flag:delete": "platform_admin",
    "flag:override": "platform_admin",

    // Billing
    "billing:list": "billing_admin",
    "billing:read": "billing_admin",
    "billing:update": "billing_admin",

    // Observability
    "metrics:read": "viewer",
    "audit:read": "support_agent",

    // Admin user management
    "admin:list": "super_admin",
    "admin:create": "super_admin",
    "admin:update": "super_admin",
    "admin:delete": "super_admin"
};

/**
 * Check if a role has permission to perform an action.
 */
export function can(role: AdminRole, action: AdminAction): boolean {
    const requiredLevel = ROLE_HIERARCHY[ACTION_MIN_ROLE[action]];
    const userLevel = ROLE_HIERARCHY[role];
    return userLevel >= requiredLevel;
}

/**
 * Get all allowed actions for a given role.
 */
export function getAllowedActions(role: AdminRole): AdminAction[] {
    return (Object.keys(ACTION_MIN_ROLE) as AdminAction[]).filter((action) => can(role, action));
}

/**
 * Get human-readable label for a role.
 */
export function getRoleLabel(role: AdminRole): string {
    const labels: Record<AdminRole, string> = {
        super_admin: "Super Admin",
        platform_admin: "Platform Admin",
        billing_admin: "Billing Admin",
        support_agent: "Support Agent",
        viewer: "Viewer"
    };
    return labels[role] || role;
}

/**
 * All available roles in descending order of privilege.
 */
export const ALL_ROLES: AdminRole[] = [
    "super_admin",
    "platform_admin",
    "billing_admin",
    "support_agent",
    "viewer"
];

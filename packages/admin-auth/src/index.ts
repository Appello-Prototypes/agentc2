// Server-side admin auth
export {
    adminLogin,
    adminLogout,
    adminLogoutAll,
    validateAdminSession,
    hashAdminPassword,
    getAdminTokenFromRequest,
    requireAdmin,
    requireAdminAction,
    AdminAuthError,
    ADMIN_COOKIE_NAME,
    ADMIN_SESSION_IDLE_TIMEOUT,
    ADMIN_SESSION_MAX_LIFETIME
} from "./auth";
export type { AdminSessionData } from "./auth";

// Permissions / RBAC
export { can, getAllowedActions, getRoleLabel, ALL_ROLES } from "./permissions";
export type { AdminRole, AdminAction } from "./permissions";

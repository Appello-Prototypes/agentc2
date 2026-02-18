// Server-side admin auth
export {
    adminLogin,
    adminLoginWithGoogle,
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

// Google SSO
export {
    generateOAuthState,
    verifyOAuthState,
    getGoogleAuthUrl,
    exchangeAndVerifyGoogleCode,
    isGoogleSsoEnabled
} from "./google";
export type { GoogleUserInfo } from "./google";

// Rate limiting
export { checkLoginRateLimit, recordFailedLogin, clearLoginRateLimit } from "./rate-limit";
export type { RateLimitResult } from "./rate-limit";

// Permissions / RBAC
export { can, getAllowedActions, getRoleLabel, ALL_ROLES } from "./permissions";
export type { AdminRole, AdminAction } from "./permissions";

import { prisma } from "@repo/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { AdminRole, AdminAction } from "./permissions";
import { can } from "./permissions";

// Session config
const SESSION_IDLE_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
const SESSION_MAX_LIFETIME = 12 * 60 * 60 * 1000; // 12 hours

export interface AdminSessionData {
    id: string;
    adminUserId: string;
    email: string;
    name: string;
    role: AdminRole;
    ipAddress: string | null;
    createdAt: Date;
    expiresAt: Date;
}

/**
 * Authenticate admin user with email + password.
 * Returns a session token on success.
 */
export async function adminLogin(
    email: string,
    password: string,
    ipAddress: string,
    userAgent?: string
): Promise<{ token: string; session: AdminSessionData }> {
    const admin = await prisma.adminUser.findUnique({
        where: { email: email.toLowerCase() }
    });

    if (!admin || !admin.isActive) {
        throw new AdminAuthError("Invalid credentials", 401);
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
        throw new AdminAuthError("Invalid credentials", 401);
    }

    // Create session
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_MAX_LIFETIME);

    const session = await prisma.adminSession.create({
        data: {
            adminUserId: admin.id,
            token,
            ipAddress,
            userAgent: userAgent?.substring(0, 512),
            expiresAt
        }
    });

    // Update last login
    await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() }
    });

    return {
        token,
        session: {
            id: session.id,
            adminUserId: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role as AdminRole,
            ipAddress: session.ipAddress,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt
        }
    };
}

/**
 * Validate session token and return admin session data.
 */
export async function validateAdminSession(token: string): Promise<AdminSessionData | null> {
    const session = await prisma.adminSession.findUnique({
        where: { token },
        include: { adminUser: true }
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt < new Date()) {
        // Clean up expired session
        await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
        return null;
    }

    // Check idle timeout (session.createdAt is the last activity for simplicity)
    const lastActivity = session.createdAt;
    if (Date.now() - lastActivity.getTime() > SESSION_IDLE_TIMEOUT) {
        await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
        return null;
    }

    // Check admin is still active
    if (!session.adminUser.isActive) {
        await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
        return null;
    }

    return {
        id: session.id,
        adminUserId: session.adminUser.id,
        email: session.adminUser.email,
        name: session.adminUser.name,
        role: session.adminUser.role as AdminRole,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
    };
}

/**
 * Destroy admin session (logout).
 */
export async function adminLogout(token: string): Promise<void> {
    await prisma.adminSession.delete({ where: { token } }).catch(() => {});
}

/**
 * Destroy all sessions for an admin user.
 */
export async function adminLogoutAll(adminUserId: string): Promise<void> {
    await prisma.adminSession.deleteMany({ where: { adminUserId } });
}

/**
 * Hash a password for storing in the AdminUser table.
 */
export async function hashAdminPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export class AdminAuthError extends Error {
    status: number;
    constructor(message: string, status: number = 401) {
        super(message);
        this.name = "AdminAuthError";
        this.status = status;
    }
}

// ----- Request Helpers -----

const COOKIE_NAME = "admin-auth-token";

/**
 * Extract admin session token from request (cookie or Authorization header).
 */
export function getAdminTokenFromRequest(request: Request): string | null {
    // Check Authorization header
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }

    // Check cookie
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
        const cookies = Object.fromEntries(
            cookieHeader.split(";").map((c) => {
                const [key, ...rest] = c.trim().split("=");
                return [key, rest.join("=")];
            })
        );
        return cookies[COOKIE_NAME] || null;
    }

    return null;
}

/**
 * Middleware helper: require admin with minimum role.
 * Throws AdminAuthError on failure.
 *
 * Usage:
 *   const admin = await requireAdmin(request, "platform_admin")
 */
export async function requireAdmin(
    request: Request,
    minimumRole?: AdminRole
): Promise<AdminSessionData> {
    const token = getAdminTokenFromRequest(request);
    if (!token) {
        throw new AdminAuthError("Authentication required", 401);
    }

    const session = await validateAdminSession(token);
    if (!session) {
        throw new AdminAuthError("Invalid or expired session", 401);
    }

    if (minimumRole && !can(session.role, `tenant:list` as AdminAction)) {
        // Use the RBAC hierarchy check directly
        const roleHierarchy: Record<AdminRole, number> = {
            viewer: 0,
            support_agent: 1,
            billing_admin: 2,
            platform_admin: 3,
            super_admin: 4
        };
        if (roleHierarchy[session.role] < roleHierarchy[minimumRole]) {
            throw new AdminAuthError("Insufficient permissions", 403);
        }
    }

    return session;
}

/**
 * Require admin with permission for a specific action.
 *
 * Usage:
 *   const admin = await requireAdminAction(request, "tenant:suspend")
 */
export async function requireAdminAction(
    request: Request,
    action: AdminAction
): Promise<AdminSessionData> {
    const token = getAdminTokenFromRequest(request);
    if (!token) {
        throw new AdminAuthError("Authentication required", 401);
    }

    const session = await validateAdminSession(token);
    if (!session) {
        throw new AdminAuthError("Invalid or expired session", 401);
    }

    if (!can(session.role, action)) {
        throw new AdminAuthError(`Insufficient permissions for action: ${action}`, 403);
    }

    return session;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_IDLE_TIMEOUT = SESSION_IDLE_TIMEOUT;
export const ADMIN_SESSION_MAX_LIFETIME = SESSION_MAX_LIFETIME;

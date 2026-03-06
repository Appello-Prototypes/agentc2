/**
 * Centralized Credential Resolver
 *
 * Enforces access policy on IntegrationConnection lookups based on the
 * ToolExecutionContext. Replaces ad-hoc credential lookups in individual
 * tools (Gmail, Drive, Calendar, Dropbox, Outlook).
 */

import { prisma } from "@repo/database";
import type { ToolExecutionContext } from "./tool-execution-context";

export class AccessDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AccessDeniedError";
    }
}

export interface ResolvedConnection {
    id: string;
    credentials: unknown;
    metadata: unknown;
    userId: string | null;
    scope: string;
    accessPolicy: string;
}

/**
 * Resolve an IntegrationConnection respecting the ToolExecutionContext.
 *
 * @param ctx         - Security context from the tool invocation
 * @param providerKey - Integration provider key (e.g. "gmail", "dropbox")
 * @param hint        - Optional identifier to narrow the lookup (e.g. gmailAddress)
 * @returns The matching connection record
 * @throws AccessDeniedError if the caller lacks access
 */
export async function resolveCredential(
    ctx: ToolExecutionContext,
    providerKey: string,
    hint?: string
): Promise<ResolvedConnection> {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: providerKey }
    });
    if (!provider) {
        throw new Error(`Integration provider '${providerKey}' not configured`);
    }

    // Build base filter: always scoped to the org
    const baseWhere: Record<string, unknown> = {
        providerId: provider.id,
        organizationId: ctx.organizationId,
        isActive: true
    };

    // If a hint is provided (e.g. email address), narrow by metadata/credentials
    if (hint) {
        baseWhere.OR = [
            { metadata: { path: ["gmailAddress"], equals: hint } },
            { credentials: { path: ["gmailAddress"], equals: hint } },
            { metadata: { path: ["email"], equals: hint } },
            { metadata: { path: ["account"], equals: hint } },
            { name: hint }
        ];
    }

    // Fetch candidate connections
    const connections = await prisma.integrationConnection.findMany({
        where: baseWhere,
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            credentials: true,
            metadata: true,
            userId: true,
            scope: true,
            accessPolicy: true
        }
    });

    if (connections.length === 0) {
        throw new Error(`No active ${providerKey} connection found in organization`);
    }

    // Filter by access policy
    for (const conn of connections) {
        if (isAccessible(ctx, conn)) {
            return conn;
        }
    }

    throw new AccessDeniedError(
        `Access denied: no accessible ${providerKey} connection for user ` +
            `${ctx.callingUserId} (role: ${ctx.callingUserRole}, mode: ${ctx.executionMode})`
    );
}

/**
 * Resolve ALL accessible connections for a provider (for org-level agents
 * that need to aggregate across multiple accounts).
 */
export async function resolveAllCredentials(
    ctx: ToolExecutionContext,
    providerKey: string
): Promise<ResolvedConnection[]> {
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: providerKey }
    });
    if (!provider) return [];

    const connections = await prisma.integrationConnection.findMany({
        where: {
            providerId: provider.id,
            organizationId: ctx.organizationId,
            isActive: true
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            credentials: true,
            metadata: true,
            userId: true,
            scope: true,
            accessPolicy: true
        }
    });

    return connections.filter((conn) => isAccessible(ctx, conn));
}

function isAccessible(
    ctx: ToolExecutionContext,
    conn: Pick<ResolvedConnection, "accessPolicy" | "userId" | "scope">
): boolean {
    const policy = conn.accessPolicy || "org-wide";

    // Admins and owners always have access
    if (ctx.callingUserRole === "owner" || ctx.callingUserRole === "admin") {
        return true;
    }

    // "org-wide" connections are accessible to everyone in the org
    if (policy === "org-wide") {
        return true;
    }

    // "owner-only" connections are only accessible to the authenticating user
    if (policy === "owner-only") {
        if (ctx.executionMode === "user") {
            return conn.userId === ctx.callingUserId;
        }
        return false;
    }

    // "role-restricted": only admins+ (already handled above)
    if (policy === "role-restricted") {
        return false;
    }

    return true;
}

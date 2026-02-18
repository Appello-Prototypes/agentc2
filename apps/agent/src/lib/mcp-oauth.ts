/**
 * Shared OAuth utilities for the Claude CoWork MCP server.
 *
 * This module holds state and helpers that must be shared across
 * the /authorize and /token route handlers.
 */

import { NextRequest } from "next/server";
import { prisma } from "@repo/database";
import { randomBytes } from "crypto";

// ── Auth Code Store ─────────────────────────────────────────────

interface AuthCodeEntry {
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    expiresAt: number;
}

const MAX_AUTH_CODES = 1000;
const AUTH_CODE_TTL_MS = 60_000; // 60 seconds

/**
 * In-memory authorization code store.
 *
 * Shared between /authorize (writes codes) and /token (consumes codes).
 * Codes are single-use and expire after 60 seconds.
 *
 * Note: This requires the authorize and token routes to run in the same
 * Node.js process (true for PM2-managed production, true for Next.js dev).
 */
const authCodes = new Map<string, AuthCodeEntry>();

/**
 * Store an authorization code. Automatically cleans up expired entries
 * and enforces a size cap to prevent memory exhaustion.
 */
export function storeAuthCode(code: string, entry: AuthCodeEntry): void {
    // Evict expired entries
    const now = Date.now();
    for (const [key, value] of authCodes.entries()) {
        if (value.expiresAt < now) {
            authCodes.delete(key);
        }
    }

    // Enforce size cap -- evict oldest if at limit
    if (authCodes.size >= MAX_AUTH_CODES) {
        const oldestKey = authCodes.keys().next().value;
        if (oldestKey) authCodes.delete(oldestKey);
    }

    authCodes.set(code, entry);
}

/**
 * Consume an authorization code (single-use).
 * Returns the entry if found and not expired, otherwise null.
 */
export function consumeAuthCode(code: string): AuthCodeEntry | null {
    const entry = authCodes.get(code);
    if (!entry) return null;

    // Always delete (single-use)
    authCodes.delete(code);

    // Check expiration
    if (entry.expiresAt < Date.now()) return null;

    return entry;
}

export { AUTH_CODE_TTL_MS };

// ── Access Token Store ───────────────────────────────────────────

interface AccessTokenEntry {
    organizationId: string;
    expiresAt: number;
}

const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACCESS_TOKENS = 5000;
const accessTokens = new Map<string, AccessTokenEntry>();

function cleanupExpiredAccessTokens() {
    const now = Date.now();
    for (const [token, entry] of accessTokens.entries()) {
        if (entry.expiresAt < now) {
            accessTokens.delete(token);
        }
    }
}

export function issueAccessToken(organizationId: string): string {
    cleanupExpiredAccessTokens();
    if (accessTokens.size >= MAX_ACCESS_TOKENS) {
        const oldest = accessTokens.keys().next().value;
        if (oldest) accessTokens.delete(oldest);
    }

    const token = `mcp_at_${randomBytes(32).toString("base64url")}`;
    accessTokens.set(token, {
        organizationId,
        expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS
    });
    return token;
}

export function validateAccessToken(token: string): { organizationId: string } | null {
    if (!token) return null;
    const entry = accessTokens.get(token);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        accessTokens.delete(token);
        return null;
    }
    return { organizationId: entry.organizationId };
}

// ── Client Credential Validation ────────────────────────────────

/**
 * Validate client_id (org slug) + client_secret (MCP API key) against the database.
 * Returns the organization ID on success, null on failure.
 */
export async function validateClientCredentials(
    clientId: string,
    clientSecret: string
): Promise<{ organizationId: string } | null> {
    if (!clientId || !clientSecret) return null;

    const org = await prisma.organization.findUnique({
        where: { slug: clientId },
        select: { id: true }
    });
    if (!org) return null;

    // Check org-specific MCP API key
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

    if (credential?.isActive && storedKey && storedKey === clientSecret) {
        return { organizationId: org.id };
    }

    // Also accept global MCP_API_KEY
    const globalKey = process.env.MCP_API_KEY;
    if (globalKey && clientSecret === globalKey) {
        return { organizationId: org.id };
    }

    return null;
}

/**
 * Validate that a client_id corresponds to a real organization.
 */
export async function validateClientId(clientId: string): Promise<boolean> {
    if (!clientId) return false;
    const org = await prisma.organization.findUnique({
        where: { slug: clientId },
        select: { id: true }
    });
    return !!org;
}

// ── Public URL Resolution ───────────────────────────────────────

/**
 * Resolve the public-facing base URL from forwarded headers.
 * In production behind Caddy, request.url shows localhost:3001 but
 * x-forwarded-host/proto contain the real public domain.
 */
export function getPublicBaseUrl(request: NextRequest): string {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
    }
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
}

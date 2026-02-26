import { createHmac, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "crypto";
import { prisma } from "@repo/database";

// ── Types ────────────────────────────────────────────────────────────────

export interface EmbedIdentityPayload {
    /** User's ID in the partner platform */
    externalUserId: string;
    /** Optional email for display / future account linking */
    email?: string;
    /** Optional display name */
    name?: string;
    /** Unix timestamp (seconds) when the token expires */
    exp?: number;
    /** Arbitrary partner-supplied context (position, department, etc.) */
    metadata?: Record<string, unknown>;
}

export interface VerifiedEmbedIdentity {
    partnerId: string;
    partnerSlug: string;
    partnerName: string;
    organizationId: string;
    externalUserId: string;
    email?: string;
    name?: string;
    metadata?: Record<string, unknown>;
    /** AgentC2 user ID if the partner user is linked to a full account */
    mappedUserId?: string;
    /** The EmbedPartnerUser record ID */
    partnerUserId: string;
}

// ── Token format ─────────────────────────────────────────────────────────
// Identity tokens use the format:  base64url(payload).hmac_hex
// The partner's backend signs the JSON payload with HMAC-SHA256 using the
// shared signing secret, then concatenates:  base64url(json) + "." + hex(signature)

/**
 * Verify an HMAC-signed identity token from an embed partner.
 *
 * Token format: `base64url(jsonPayload).hexSignature`
 *
 * When `partnerId` is provided (from deployment context), the partner is
 * looked up directly — avoiding ambiguity when an org has multiple partners.
 * Falls back to `findFirst` for backward compatibility with Mode 1 embeds.
 *
 * Returns the verified identity with a JIT-provisioned partner user record,
 * or null if verification fails.
 */
export async function verifyEmbedIdentity(
    identityToken: string,
    agentOrgId: string,
    partnerId?: string
): Promise<VerifiedEmbedIdentity | null> {
    // Split token into payload and signature
    const dotIndex = identityToken.lastIndexOf(".");
    if (dotIndex === -1 || dotIndex === 0 || dotIndex === identityToken.length - 1) {
        console.warn("[EmbedIdentity] Invalid token format: missing separator");
        return null;
    }

    const payloadB64 = identityToken.slice(0, dotIndex);
    const signature = identityToken.slice(dotIndex + 1);

    // Decode payload
    let payload: EmbedIdentityPayload;
    try {
        const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
        payload = JSON.parse(jsonStr);
    } catch {
        console.warn("[EmbedIdentity] Failed to decode token payload");
        return null;
    }

    if (!payload.externalUserId) {
        console.warn("[EmbedIdentity] Token missing externalUserId");
        return null;
    }

    // Resolve partner — prefer explicit partnerId from deployment context
    const partner = partnerId
        ? await prisma.embedPartner.findUnique({
              where: { id: partnerId, isActive: true }
          })
        : await prisma.embedPartner.findFirst({
              where: { organizationId: agentOrgId, isActive: true }
          });

    if (!partner) {
        console.warn(
            `[EmbedIdentity] No active embed partner found (partnerId=${partnerId || "auto"}, org=${agentOrgId})`
        );
        return null;
    }

    if (partner.organizationId !== agentOrgId) {
        console.warn(
            `[EmbedIdentity] Partner ${partner.slug} org mismatch: expected ${agentOrgId}, got ${partner.organizationId}`
        );
        return null;
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = createHmac("sha256", partner.signingSecret)
        .update(payloadB64)
        .digest("hex");

    if (!timingSafeEqual(signature, expectedSignature)) {
        console.warn(`[EmbedIdentity] Signature mismatch for partner ${partner.slug}`);
        return null;
    }

    // Check expiry
    if (payload.exp) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > payload.exp) {
            console.warn(`[EmbedIdentity] Token expired for partner ${partner.slug}`);
            return null;
        }

        const ageSec = nowSec - (payload.exp - partner.tokenMaxAgeSec);
        if (ageSec > partner.tokenMaxAgeSec) {
            console.warn(`[EmbedIdentity] Token exceeds max age for partner ${partner.slug}`);
            return null;
        }
    }

    // JIT provision or update the partner user record
    let partnerUser = await prisma.embedPartnerUser.upsert({
        where: {
            partnerId_externalUserId: {
                partnerId: partner.id,
                externalUserId: payload.externalUserId
            }
        },
        create: {
            partnerId: partner.id,
            externalUserId: payload.externalUserId,
            email: payload.email || null,
            name: payload.name || null,
            metadata: payload.metadata || undefined,
            lastSeenAt: new Date()
        },
        update: {
            email: payload.email || undefined,
            name: payload.name || undefined,
            metadata: payload.metadata || undefined,
            lastSeenAt: new Date()
        }
    });

    // JIT provision a real AgentC2 User + Membership if one doesn't exist yet.
    // This gives the partner user a full account that can own IntegrationConnections.
    if (!partnerUser.userId && payload.email) {
        const userId = await jitProvisionUser({
            email: payload.email,
            name: payload.name || payload.email.split("@")[0] || "Partner User",
            organizationId: partner.organizationId,
            partnerUserId: partnerUser.id
        });

        if (userId) {
            partnerUser = { ...partnerUser, userId };
        }
    }

    return {
        partnerId: partner.id,
        partnerSlug: partner.slug,
        partnerName: partner.name,
        organizationId: partner.organizationId,
        externalUserId: payload.externalUserId,
        email: payload.email,
        name: payload.name,
        metadata: payload.metadata,
        mappedUserId: partnerUser.userId || undefined,
        partnerUserId: partnerUser.id
    };
}

/**
 * Build a deterministic resource ID for memory isolation.
 * Uses the partner + external user ID so conversations persist across sessions.
 */
export function buildPartnerResourceId(
    organizationId: string,
    partnerSlug: string,
    externalUserId: string
): string {
    return `${organizationId}:partner-${partnerSlug}:${externalUserId}`;
}

/**
 * Build a deterministic thread ID for memory isolation.
 * Scoped to org + partner + external user + optional thread suffix.
 */
export function buildPartnerThreadId(
    organizationId: string,
    partnerSlug: string,
    externalUserId: string,
    threadSuffix?: string
): string {
    const base = `${organizationId}:partner-${partnerSlug}:${externalUserId}`;
    return threadSuffix ? `${base}:${threadSuffix}` : base;
}

// ── JIT User Provisioning ─────────────────────────────────────────────────

interface JitProvisionOptions {
    email: string;
    name: string;
    organizationId: string;
    partnerUserId: string;
}

/**
 * Create a real AgentC2 User + Membership for a partner user.
 * If a user with this email already exists, link to them instead of creating a duplicate.
 * Returns the User ID or null on failure.
 */
async function jitProvisionUser(options: JitProvisionOptions): Promise<string | null> {
    const { email, name, organizationId, partnerUserId } = options;

    try {
        // Check if a user with this email already exists
        let user = await prisma.user.findUnique({
            where: { email },
            select: { id: true }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    emailVerified: true,
                    status: "active",
                    // No password -- this user authenticates via partner identity tokens.
                    // They can set a password later if they want direct AgentC2 access.
                    termsAcceptedAt: new Date(),
                    privacyConsentAt: new Date()
                },
                select: { id: true }
            });
            console.log(
                `[EmbedIdentity] JIT-provisioned User ${user.id} for partner user ${partnerUserId}`
            );
        }

        // Ensure membership exists in the partner's organization
        await prisma.membership.upsert({
            where: {
                userId_organizationId: {
                    userId: user.id,
                    organizationId
                }
            },
            create: {
                userId: user.id,
                organizationId,
                role: "member",
                onboardingCompletedAt: new Date(),
                onboardingPath: "partner_embed"
            },
            update: {}
        });

        // Link the EmbedPartnerUser to the real User
        await prisma.embedPartnerUser.update({
            where: { id: partnerUserId },
            data: { userId: user.id }
        });

        return user.id;
    } catch (error) {
        console.error("[EmbedIdentity] JIT provisioning failed:", error);
        return null;
    }
}

// ── Integration Status ───────────────────────────────────────────────────

export interface UserIntegrationStatus {
    gmail: boolean;
    microsoft: boolean;
    dropbox: boolean;
}

/**
 * Check which OAuth integrations a user has connected in an organization.
 * Returns a map of provider key → connected boolean.
 */
export async function getUserIntegrationStatus(
    userId: string,
    organizationId: string
): Promise<UserIntegrationStatus> {
    const connections = await prisma.integrationConnection.findMany({
        where: {
            organizationId,
            isActive: true,
            OR: [{ scope: "org" }, { scope: "user", userId }]
        },
        include: { provider: { select: { key: true } } }
    });

    const keys = new Set(connections.map((c) => c.provider.key));

    return {
        gmail: keys.has("gmail"),
        microsoft: keys.has("microsoft"),
        dropbox: keys.has("dropbox")
    };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison to prevent timing attacks on signature verification.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    return cryptoTimingSafeEqual(bufA, bufB);
}

/**
 * Generate a cryptographically secure signing secret for a new EmbedPartner.
 * Returns a 64-character hex string (256 bits).
 */
export function generateSigningSecret(): string {
    return randomBytes(32).toString("hex");
}

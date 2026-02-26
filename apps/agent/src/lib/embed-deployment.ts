import { prisma } from "@repo/database";

// ── Types ────────────────────────────────────────────────────────────────

export type EmbedMode = "chat-widget" | "agent" | "workspace";

export interface EmbedBranding {
    appName?: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    showPoweredBy: boolean;
}

export interface EmbedUIConfig {
    greeting?: string;
    suggestions?: string[];
    theme?: "dark" | "light";
    showToolActivity?: boolean;
    maxMessagesPerSession?: number;
    showAuthButtons?: boolean;
}

export interface EmbedSessionConfig {
    deploymentId: string;
    partnerId: string;
    partnerSlug: string;
    organizationId: string;
    mode: EmbedMode;
    agentSlug?: string;
    agentId?: string;
    features: string[];
    branding: EmbedBranding;
    embedConfig?: EmbedUIConfig;
}

export interface ResolvedDeployment {
    id: string;
    partnerId: string;
    partnerSlug: string;
    partnerName: string;
    organizationId: string;
    signingSecret: string;
    agentId: string | null;
    agentSlug: string | null;
    deploymentToken: string;
    label: string;
    mode: EmbedMode;
    features: string[];
    branding: EmbedBranding;
    embedConfig: EmbedUIConfig;
    allowedDomains: string[];
    isActive: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: EmbedBranding = {
    showPoweredBy: true
};

const DEFAULT_EMBED_CONFIG: EmbedUIConfig = {
    showToolActivity: true,
    showAuthButtons: false
};

export const FEATURE_PRESETS: Record<string, string[]> = {
    "chat-only": ["chat"],
    "chat-plus": ["chat", "settings"],
    workspace: ["chat", "agents", "knowledge", "observe", "settings"],
    builder: ["chat", "agents", "workflows", "networks", "knowledge", "observe", "settings"],
    full: [
        "chat",
        "agents",
        "workflows",
        "networks",
        "skills",
        "knowledge",
        "observe",
        "schedule",
        "integrations",
        "settings"
    ]
};

// ── Deployment Resolution ────────────────────────────────────────────────

/**
 * Validate a deployment token and resolve the full deployment context.
 * Returns null if the token is invalid, inactive, or the partner is inactive.
 */
export async function resolveDeployment(
    deploymentToken: string
): Promise<ResolvedDeployment | null> {
    const deployment = await prisma.embedDeployment.findUnique({
        where: { deploymentToken },
        include: {
            partner: {
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    organizationId: true,
                    signingSecret: true,
                    isActive: true
                }
            },
            agent: {
                select: {
                    id: true,
                    slug: true,
                    metadata: true
                }
            }
        }
    });

    if (!deployment || !deployment.isActive) {
        console.warn(
            `[EmbedDeployment] Deployment not found or inactive: ${deploymentToken.slice(0, 8)}...`
        );
        return null;
    }

    if (!deployment.partner.isActive) {
        console.warn(`[EmbedDeployment] Partner inactive for deployment: ${deployment.id}`);
        return null;
    }

    const agentMeta = (deployment.agent?.metadata as Record<string, unknown>) || {};
    const agentPublicEmbed = (agentMeta.publicEmbed as Record<string, unknown>) || {};

    const mergedConfig = resolveEmbedConfig(
        agentPublicEmbed,
        (deployment.embedConfig as Record<string, unknown>) || {}
    );
    const mergedBranding = resolveBranding((deployment.branding as Record<string, unknown>) || {});

    return {
        id: deployment.id,
        partnerId: deployment.partner.id,
        partnerSlug: deployment.partner.slug,
        partnerName: deployment.partner.name,
        organizationId: deployment.partner.organizationId,
        signingSecret: deployment.partner.signingSecret,
        agentId: deployment.agent?.id || null,
        agentSlug: deployment.agent?.slug || null,
        deploymentToken: deployment.deploymentToken,
        label: deployment.label,
        mode: deployment.mode as EmbedMode,
        features: deployment.features,
        branding: mergedBranding,
        embedConfig: mergedConfig,
        allowedDomains: deployment.allowedDomains,
        isActive: deployment.isActive
    };
}

// ── Config Merging (4-layer) ─────────────────────────────────────────────

/**
 * Merge embed UI config from multiple layers:
 *   Platform defaults → Agent.metadata.publicEmbed → EmbedDeployment.embedConfig
 * Runtime overrides (identity-based) are applied by the caller.
 */
function resolveEmbedConfig(
    agentConfig: Record<string, unknown>,
    deploymentConfig: Record<string, unknown>
): EmbedUIConfig {
    return {
        ...DEFAULT_EMBED_CONFIG,
        ...stripUndefined(agentConfig),
        ...stripUndefined(deploymentConfig)
    } as EmbedUIConfig;
}

/**
 * Merge branding config: defaults → deployment branding.
 */
function resolveBranding(deploymentBranding: Record<string, unknown>): EmbedBranding {
    return {
        ...DEFAULT_BRANDING,
        ...stripUndefined(deploymentBranding)
    } as EmbedBranding;
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

// ── Session Config Builder ───────────────────────────────────────────────

/**
 * Build the EmbedSessionConfig that gets serialized into the agentc2-embed cookie.
 */
export function buildSessionConfig(deployment: ResolvedDeployment): EmbedSessionConfig {
    return {
        deploymentId: deployment.id,
        partnerId: deployment.partnerId,
        partnerSlug: deployment.partnerSlug,
        organizationId: deployment.organizationId,
        mode: deployment.mode,
        agentSlug: deployment.agentSlug || undefined,
        agentId: deployment.agentId || undefined,
        features: deployment.features,
        branding: deployment.branding,
        embedConfig: deployment.embedConfig
    };
}

// ── Feature Helpers ──────────────────────────────────────────────────────

export const FEATURE_TO_PATH: Record<string, string> = {
    chat: "/workspace",
    agents: "/agents",
    workflows: "/workflows",
    networks: "/networks",
    skills: "/skills",
    knowledge: "/knowledge",
    observe: "/observe",
    schedule: "/schedule",
    integrations: "/mcp",
    settings: "/settings",
    campaigns: "/campaigns"
};

const PATH_TO_FEATURE: Record<string, string> = Object.fromEntries(
    Object.entries(FEATURE_TO_PATH).map(([k, v]) => [v, k])
);

/**
 * Map a pathname to its feature key.
 * Returns null if the path doesn't map to a gated feature.
 */
export function pathToFeature(pathname: string): string | null {
    for (const [path, feature] of Object.entries(PATH_TO_FEATURE)) {
        if (pathname === path || pathname.startsWith(path + "/")) {
            return feature;
        }
    }
    return null;
}

// ── Deployment Token Generation ──────────────────────────────────────────

import { randomBytes } from "crypto";

export function generateDeploymentToken(): string {
    return randomBytes(24).toString("base64url");
}

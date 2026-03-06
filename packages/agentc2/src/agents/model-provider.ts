/**
 * Model Provider Resolver
 *
 * Resolves AI SDK language model instances with org-scoped API keys.
 *
 * Resolution:
 * 1. Look up the org's IntegrationConnection for the provider (e.g., "openai")
 * 2. Decrypt the stored API key from the connection credentials
 * 3. Create an AI SDK provider instance with that key
 *
 * No environment variable fallback — all API keys must be configured
 * via IntegrationConnection in the database. This ensures consistent
 * multi-tenant behavior and avoids encryption key mismatches.
 */

import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createFireworks } from "@ai-sdk/fireworks";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createKimi } from "kimi-vercel-ai-sdk-provider";
import { prisma } from "@repo/database";
import { decryptCredentials } from "../crypto";

/**
 * Map from model provider string (as stored in Agent.modelProvider)
 * to the IntegrationProvider key and the credential field name.
 *
 * All API keys are resolved exclusively from IntegrationConnection
 * records in the database — no environment variable fallback.
 */
const PROVIDER_KEY_MAP: Record<string, { integrationKey: string; credentialField: string }> = {
    openai: {
        integrationKey: "openai",
        credentialField: "OPENAI_API_KEY"
    },
    anthropic: {
        integrationKey: "anthropic",
        credentialField: "ANTHROPIC_API_KEY"
    },
    google: {
        integrationKey: "google",
        credentialField: "GOOGLE_GENERATIVE_AI_API_KEY"
    },
    groq: {
        integrationKey: "groq",
        credentialField: "GROQ_API_KEY"
    },
    mistral: {
        integrationKey: "mistral",
        credentialField: "MISTRAL_API_KEY"
    },
    xai: {
        integrationKey: "xai",
        credentialField: "XAI_API_KEY"
    },
    deepseek: {
        integrationKey: "deepseek",
        credentialField: "DEEPSEEK_API_KEY"
    },
    togetherai: {
        integrationKey: "togetherai",
        credentialField: "TOGETHER_AI_API_KEY"
    },
    fireworks: {
        integrationKey: "fireworks",
        credentialField: "FIREWORKS_API_KEY"
    },
    openrouter: {
        integrationKey: "openrouter",
        credentialField: "OPENROUTER_API_KEY"
    },
    kimi: {
        integrationKey: "kimi",
        credentialField: "MOONSHOT_API_KEY"
    }
};

/**
 * Look up an organization's API key for a given model provider.
 *
 * Requires an IntegrationConnection in the database for the provider.
 * No environment variable fallback — all API keys must be configured
 * via IntegrationConnection to ensure consistent multi-tenant behavior
 * and avoid encryption key mismatches across environments.
 */
export async function getOrgApiKey(
    provider: string,
    organizationId?: string | null
): Promise<string | undefined> {
    const mapping = PROVIDER_KEY_MAP[provider];
    if (!mapping) return undefined;

    if (!organizationId) {
        console.warn(
            `[ModelProvider] No organizationId provided for provider "${provider}". ` +
                `Cannot look up API key without an org context.`
        );
        return undefined;
    }

    try {
        const connection = await prisma.integrationConnection.findFirst({
            where: {
                organizationId,
                isActive: true,
                provider: {
                    key: mapping.integrationKey,
                    providerType: "ai-model"
                }
            },
            include: { provider: true },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });

        if (!connection) {
            console.error(
                `[ModelProvider] No IntegrationConnection for provider "${provider}" ` +
                    `(org=${organizationId}). Create one via Settings > Integrations.`
            );
            return undefined;
        }

        if (!connection.credentials) {
            console.error(
                `[ModelProvider] IntegrationConnection for "${provider}" exists ` +
                    `(org=${organizationId}, id=${connection.id}) but has no credentials stored.`
            );
            return undefined;
        }

        const credentials = decryptCredentials(connection.credentials);
        if (Object.keys(credentials).length === 0) {
            console.error(
                `[ModelProvider] Credential decryption returned empty for provider "${provider}" ` +
                    `(org=${organizationId}, connectionId=${connection.id}). ` +
                    `Likely CREDENTIAL_ENCRYPTION_KEY mismatch between environments. ` +
                    `Re-create the connection to re-encrypt with the current key.`
            );
            return undefined;
        }

        const apiKey = credentials[mapping.credentialField];
        if (typeof apiKey === "string" && apiKey.trim()) {
            return apiKey.trim();
        }

        console.warn(
            `[ModelProvider] Connection exists for "${provider}" (org=${organizationId}) ` +
                `but credential field "${mapping.credentialField}" not found in decrypted keys: ` +
                `[${Object.keys(credentials).join(", ")}]`
        );
        return undefined;
    } catch (error) {
        console.error(
            `[ModelProvider] Failed to look up org API key for "${provider}" ` +
                `(org=${organizationId}):`,
            error
        );
        return undefined;
    }
}

/**
 * Resolve a LanguageModel instance for a given provider and model name,
 * using the organization's IntegrationConnection API key.
 *
 * @returns A LanguageModel instance, or null if no API key is configured
 *          or the provider is unsupported.
 */
export async function resolveModelForOrg(
    provider: string,
    modelName: string,
    organizationId?: string | null
): Promise<LanguageModel | null> {
    const apiKey = await getOrgApiKey(provider, organizationId);

    // If no API key found anywhere, return null to let caller handle
    if (!apiKey) {
        return null;
    }

    switch (provider) {
        case "openai": {
            const openai = createOpenAI({ apiKey });
            return openai(modelName);
        }
        case "anthropic": {
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelName);
        }
        case "google": {
            const google = createGoogleGenerativeAI({ apiKey });
            return google(modelName);
        }
        case "groq": {
            const groq = createGroq({ apiKey });
            return groq(modelName);
        }
        case "mistral": {
            const mistral = createMistral({ apiKey });
            return mistral(modelName);
        }
        case "xai": {
            const xai = createXai({ apiKey });
            return xai(modelName);
        }
        case "deepseek": {
            const deepseek = createDeepSeek({ apiKey });
            return deepseek(modelName);
        }
        case "togetherai": {
            const together = createTogetherAI({ apiKey });
            return together(modelName);
        }
        case "fireworks": {
            const fireworks = createFireworks({ apiKey });
            return fireworks(modelName);
        }
        case "openrouter": {
            const openrouter = createOpenRouter({ apiKey });
            return openrouter.chat(modelName);
        }
        case "kimi": {
            const kimi = createKimi({ apiKey });
            return kimi(modelName);
        }
        default:
            return null;
    }
}

/**
 * Check whether an organization has an API key configured for a given provider.
 *
 * Used by the UI to show connection status for model providers.
 */
export async function hasOrgApiKey(provider: string, organizationId: string): Promise<boolean> {
    const apiKey = await getOrgApiKey(provider, organizationId);
    return Boolean(apiKey);
}

/**
 * Get the status of all AI model provider connections for an organization.
 *
 * Returns which providers have org-level keys configured via IntegrationConnection.
 */
export async function getAiProviderStatus(
    organizationId: string
): Promise<Record<string, { hasOrgKey: boolean; connected: boolean }>> {
    const result: Record<string, { hasOrgKey: boolean; connected: boolean }> = {};

    for (const [provider, mapping] of Object.entries(PROVIDER_KEY_MAP)) {
        let hasOrgKey = false;
        try {
            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                    provider: {
                        key: mapping.integrationKey,
                        providerType: "ai-model"
                    }
                },
                include: { provider: true },
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
            });

            if (connection?.credentials) {
                const credentials = decryptCredentials(connection.credentials);
                const apiKey = credentials[mapping.credentialField];
                hasOrgKey = typeof apiKey === "string" && apiKey.trim().length > 0;
            }
        } catch {
            // Ignore errors, treat as no org key
        }

        result[provider] = {
            hasOrgKey,
            connected: hasOrgKey
        };
    }

    return result;
}

/**
 * Resolve a fast, cheap model suitable for semantic compression of tool results.
 * Prefers gpt-4o-mini (reliable, widely available), then Anthropic Haiku as fallback.
 */
export async function getFastCompressionModel(
    organizationId?: string | null
): Promise<LanguageModel | null> {
    const miniModel = await resolveModelForOrg("openai", "gpt-4o-mini", organizationId);
    if (miniModel) return miniModel;

    const haikuModel = await resolveModelForOrg(
        "anthropic",
        "claude-3-5-haiku-20241022",
        organizationId
    );
    if (haikuModel) return haikuModel;

    return null;
}

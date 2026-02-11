/**
 * Model Provider Resolver
 *
 * Resolves AI SDK language model instances with org-scoped API keys.
 *
 * Resolution order:
 * 1. Look up the org's IntegrationConnection for the provider (e.g., "openai")
 * 2. Decrypt the stored API key from the connection credentials
 * 3. Create an AI SDK provider instance with that key
 * 4. Fall back to process.env API keys if no org connection exists
 *
 * This ensures each organization pays for their own model usage.
 */

import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { prisma } from "@repo/database";
import { decryptCredentials } from "../crypto";

/**
 * Map from model provider string (as stored in Agent.modelProvider)
 * to the IntegrationProvider key and the credential field name.
 */
const PROVIDER_KEY_MAP: Record<
    string,
    { integrationKey: string; credentialField: string; envVar: string }
> = {
    openai: {
        integrationKey: "openai",
        credentialField: "OPENAI_API_KEY",
        envVar: "OPENAI_API_KEY"
    },
    anthropic: {
        integrationKey: "anthropic",
        credentialField: "ANTHROPIC_API_KEY",
        envVar: "ANTHROPIC_API_KEY"
    },
    google: {
        integrationKey: "google",
        credentialField: "GOOGLE_GENERATIVE_AI_API_KEY",
        envVar: "GOOGLE_GENERATIVE_AI_API_KEY"
    }
};

/**
 * Look up an organization's API key for a given model provider.
 *
 * Checks IntegrationConnection for the provider, decrypts credentials,
 * and returns the API key string. Falls back to process.env if no
 * org connection exists.
 */
export async function getOrgApiKey(
    provider: string,
    organizationId?: string | null
): Promise<string | undefined> {
    const mapping = PROVIDER_KEY_MAP[provider];
    if (!mapping) return undefined;

    // Try org-scoped connection first
    if (organizationId) {
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
                if (typeof apiKey === "string" && apiKey.trim()) {
                    return apiKey.trim();
                }
            }
        } catch (error) {
            console.warn(`[ModelProvider] Failed to look up org API key for ${provider}:`, error);
        }
    }

    // Fall back to environment variable
    return process.env[mapping.envVar] || undefined;
}

/**
 * Resolve a LanguageModel instance for a given provider and model name,
 * using the organization's API key if available.
 *
 * If the provider has an org-scoped key, creates a provider instance
 * with that key. Otherwise, falls back to the default behavior
 * (reading from process.env).
 *
 * @returns A LanguageModel instance, or null if the provider is unsupported.
 *          When null, the caller should use the string-based model format
 *          as a fallback (for providers not yet in this system).
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
 * Returns which providers have org-level keys, env-level keys, or no keys.
 */
export async function getAiProviderStatus(
    organizationId: string
): Promise<Record<string, { hasOrgKey: boolean; hasEnvKey: boolean; connected: boolean }>> {
    const result: Record<string, { hasOrgKey: boolean; hasEnvKey: boolean; connected: boolean }> =
        {};

    for (const [provider, mapping] of Object.entries(PROVIDER_KEY_MAP)) {
        const hasEnvKey = Boolean(process.env[mapping.envVar]);

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
            hasEnvKey,
            connected: hasOrgKey || hasEnvKey
        };
    }

    return result;
}

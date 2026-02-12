import type { IntegrationConnection, IntegrationProvider } from "@repo/database";
import { decryptCredentials } from "@/lib/credential-crypto";

export const resolveConnectionServerId = (
    providerKey: string,
    connection: IntegrationConnection
) => {
    return connection.isDefault ? providerKey : `${providerKey}__${connection.id.slice(0, 8)}`;
};

export const getConnectionCredentials = (connection: IntegrationConnection) => {
    const decrypted = decryptCredentials(connection.credentials);
    if (decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)) {
        return decrypted as Record<string, unknown>;
    }
    return {};
};

export const getProviderRequiredFields = (provider: IntegrationProvider) => {
    const config = provider.configJson as Record<string, unknown> | null;
    const required = config?.requiredFields;
    if (!required || !Array.isArray(required)) {
        return [];
    }
    return required.filter((field) => typeof field === "string");
};

export const hasOAuthCredentials = (credentials: Record<string, unknown>) => {
    return Boolean(
        credentials.accessToken ||
        credentials.refreshToken ||
        credentials.oauthToken ||
        credentials.token
    );
};

/**
 * Alternative credential key names that buildMcpConfig() also accepts at runtime.
 * If a required field isn't found under its canonical name, we check these aliases
 * so the status page matches actual MCP server behaviour.
 */
const CREDENTIAL_ALIASES: Record<string, string[]> = {
    SLACK_BOT_TOKEN: ["botToken"],
    SLACK_TEAM_ID: ["teamId"],
    HUBSPOT_ACCESS_TOKEN: ["PRIVATE_APP_ACCESS_TOKEN"],
    PRIVATE_APP_ACCESS_TOKEN: ["HUBSPOT_ACCESS_TOKEN"],
};

/**
 * Metadata keys that can satisfy a required credential field.
 * e.g. SLACK_TEAM_ID can come from connection metadata.teamId.
 */
const METADATA_ALIASES: Record<string, string[]> = {
    SLACK_TEAM_ID: ["teamId"],
};

export const getConnectionMissingFields = (
    connection: IntegrationConnection,
    provider: IntegrationProvider
) => {
    if (provider.authType === "none") {
        return [];
    }

    const credentials = getConnectionCredentials(connection);

    if (provider.authType === "oauth") {
        return hasOAuthCredentials(credentials) ? [] : ["oauth"];
    }

    const metadata =
        connection.metadata && typeof connection.metadata === "object"
            ? (connection.metadata as Record<string, unknown>)
            : {};

    const requiredFields = getProviderRequiredFields(provider);
    return requiredFields.filter((field) => {
        // Check canonical key
        if (credentials[field]) return false;

        // Check credential aliases
        const aliases = CREDENTIAL_ALIASES[field];
        if (aliases?.some((alias) => credentials[alias])) return false;

        // Check metadata aliases
        const metaAliases = METADATA_ALIASES[field];
        if (metaAliases?.some((alias) => metadata[alias])) return false;

        return true;
    });
};

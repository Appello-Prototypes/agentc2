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

    const requiredFields = getProviderRequiredFields(provider);
    return requiredFields.filter((field) => !credentials[field]);
};

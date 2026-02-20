import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma, type Prisma } from "@repo/database";
import {
    analyzeMcpConfigImpact,
    exportMcpConfig,
    getIntegrationProviders,
    getMcpTools,
    importMcpConfig
} from "../mcp/client";

type McpServerConfig = {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
};

type McpJsonConfigFile = {
    mcpServers: Record<string, McpServerConfig>;
};

type ImportHints = {
    matchNames?: string[];
    matchArgs?: string[];
    matchUrls?: string[];
    envAliases?: Record<string, string>;
    headerAliases?: Record<string, string>;
    argValueMap?: Record<string, string>;
};

type ProviderMatch = {
    providerId: string;
    providerKey: string;
    providerName: string;
    providerType: string;
    authType: string;
    requiredFields: string[];
    importHints: ImportHints;
};

type ImportItem = {
    serverName: string;
    providerKey: string;
    providerName: string;
    providerType: string;
    authType: string;
    action: "create" | "update";
    connectionId?: string;
    missingFields: string[];
    credentialsApplied: string[];
    summary: string;
    testResult?: {
        success: boolean;
        toolCount?: number;
        sampleTools?: string[];
        error?: string;
    };
};

const baseOutputSchema = z.object({ success: z.boolean() }).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

function normalizeValue(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractJsonBlock(rawText: string) {
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }

    const first = rawText.indexOf("{");
    const last = rawText.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
        return rawText.slice(first, last + 1);
    }

    return rawText.trim();
}

function toSlug(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function parseMcpServers(rawText: string) {
    const jsonBlock = extractJsonBlock(rawText);
    const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
    const servers =
        (parsed?.mcpServers as Record<string, unknown> | undefined) ||
        (parsed?.servers as Record<string, unknown> | undefined) ||
        (parsed as Record<string, unknown>);
    if (!servers || typeof servers !== "object") {
        throw new Error("No MCP servers found in input");
    }
    return Object.entries(servers).reduce<Record<string, McpServerConfig>>((acc, [key, value]) => {
        if (!value || typeof value !== "object") return acc;
        const server = value as McpServerConfig;
        acc[key] = {
            command: typeof server.command === "string" ? server.command : undefined,
            args: Array.isArray(server.args)
                ? server.args.filter((arg) => typeof arg === "string")
                : undefined,
            env:
                server.env && typeof server.env === "object"
                    ? (server.env as Record<string, string>)
                    : undefined,
            url: typeof server.url === "string" ? server.url : undefined,
            headers:
                server.headers && typeof server.headers === "object"
                    ? (server.headers as Record<string, string>)
                    : undefined
        };
        return acc;
    }, {});
}

function resolveMcpConfigInput(options: {
    config?: unknown;
    rawText?: string;
}): McpJsonConfigFile | null {
    if (options.config && typeof options.config === "object" && !Array.isArray(options.config)) {
        const configRecord = options.config as Record<string, unknown>;
        const mcpServers = configRecord.mcpServers;
        if (mcpServers && typeof mcpServers === "object" && !Array.isArray(mcpServers)) {
            return { mcpServers: mcpServers as Record<string, McpServerConfig> };
        }
        const servers = configRecord.servers;
        if (servers && typeof servers === "object" && !Array.isArray(servers)) {
            return { mcpServers: servers as Record<string, McpServerConfig> };
        }
        return { mcpServers: configRecord as Record<string, McpServerConfig> };
    }

    if (options.rawText) {
        return { mcpServers: parseMcpServers(options.rawText) };
    }

    return null;
}

function getImportHints(configJson: unknown): ImportHints {
    if (!configJson || typeof configJson !== "object") return {};
    const hints = (configJson as { importHints?: ImportHints }).importHints;
    if (!hints || typeof hints !== "object") return {};
    return hints;
}

function getRequiredFields(configJson: unknown): string[] {
    if (!configJson || typeof configJson !== "object") return [];
    const required = (configJson as { requiredFields?: string[] }).requiredFields;
    return Array.isArray(required) ? required.filter((field) => typeof field === "string") : [];
}

function matchProviderForServer(
    serverName: string,
    serverConfig: McpServerConfig,
    providers: Array<{
        id: string;
        key: string;
        name: string;
        providerType: string;
        authType: string;
        configJson: unknown;
    }>
): ProviderMatch | null {
    const normalizedServer = normalizeValue(serverName);
    let best: ProviderMatch | null = null;
    let bestScore = 0;

    for (const provider of providers) {
        if (provider.providerType !== "mcp") continue;

        const hints = getImportHints(provider.configJson);
        const requiredFields = getRequiredFields(provider.configJson);

        let score = 0;
        const normalizedKey = normalizeValue(provider.key);
        if (normalizedServer === normalizedKey) score += 5;
        if (hints.matchNames?.some((name) => normalizeValue(name) === normalizedServer)) {
            score += 4;
        }

        const argsJoined = serverConfig.args?.join(" ") || "";
        if (hints.matchArgs?.some((match) => argsJoined.includes(match))) {
            score += 3;
        }

        if (
            serverConfig.url &&
            hints.matchUrls?.some((match) => serverConfig.url?.includes(match))
        ) {
            score += 3;
        }

        if (score > bestScore) {
            bestScore = score;
            best = {
                providerId: provider.id,
                providerKey: provider.key,
                providerName: provider.name,
                providerType: provider.providerType,
                authType: provider.authType,
                requiredFields,
                importHints: hints
            };
        }
    }

    return bestScore > 0 ? best : null;
}

function applyArgMappings(
    args: string[] | undefined,
    argValueMap: Record<string, string> | undefined
) {
    if (!args || !argValueMap) return {};
    const result: Record<string, string> = {};
    args.forEach((arg, index) => {
        const targetKey = argValueMap[arg];
        if (!targetKey) return;
        const value = args[index + 1];
        if (value && typeof value === "string") {
            result[targetKey] = value;
        }
    });
    return result;
}

function extractCredentials(
    serverConfig: McpServerConfig,
    providerMatch: ProviderMatch | null,
    overrides: Record<string, string> | undefined
) {
    const credentials: Record<string, string> = {};
    const hints = providerMatch?.importHints || {};

    if (serverConfig.env) {
        Object.entries(serverConfig.env).forEach(([key, value]) => {
            const mappedKey = hints.envAliases?.[key] || key;
            if (value) credentials[mappedKey] = value;
        });
    }

    if (serverConfig.headers) {
        Object.entries(serverConfig.headers).forEach(([key, value]) => {
            const mappedKey = hints.headerAliases?.[key] || key;
            if (value) credentials[mappedKey] = value;
        });
    }

    if (serverConfig.args && hints.argValueMap) {
        const mapped = applyArgMappings(serverConfig.args, hints.argValueMap);
        Object.entries(mapped).forEach(([key, value]) => {
            if (value) credentials[key] = value;
        });
    }

    if (overrides) {
        Object.entries(overrides).forEach(([key, value]) => {
            if (value) credentials[key] = value;
        });
    }

    return credentials;
}

function getMissingFields(requiredFields: string[], credentials: Record<string, string>) {
    if (!requiredFields.length) return [];
    return requiredFields.filter((field) => !credentials[field]);
}

function resolveServerId(providerKey: string, connectionId: string, isDefault: boolean) {
    if (isDefault) return providerKey;
    return `${providerKey}__${connectionId.slice(0, 8)}`;
}

function buildCustomProviderPayload(
    serverName: string,
    serverConfig: McpServerConfig
): {
    key: string;
    name: string;
    providerType: string;
    authType: string;
    category: string;
    configJson: Record<string, unknown>;
} {
    const slug = toSlug(serverName) || "custom";
    const key = `custom-${slug}`;
    const isHttp = Boolean(serverConfig.url);
    const requiredFields: string[] = [];
    const fieldDefinitions: Record<
        string,
        { label: string; description?: string; placeholder?: string }
    > = {};
    const configJson: Record<string, unknown> = {
        transport: isHttp ? "http" : "stdio",
        requiredFields,
        fieldDefinitions
    };

    if (isHttp && serverConfig.url) {
        configJson.url = serverConfig.url;
        const headerMapping: Record<string, string> = {};
        Object.keys(serverConfig.headers || {}).forEach((header) => {
            const keyName =
                header.toLowerCase() === "authorization"
                    ? "AUTHORIZATION"
                    : header.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
            headerMapping[header] = keyName;
            requiredFields.push(keyName);
            fieldDefinitions[keyName] = {
                label: header
            };
        });
        configJson.headerMapping = headerMapping;
    }

    if (!isHttp && serverConfig.command) {
        configJson.command = serverConfig.command;
        configJson.args = serverConfig.args || [];
        const envMapping: Record<string, string> = {};
        Object.keys(serverConfig.env || {}).forEach((envKey) => {
            envMapping[envKey] = envKey;
            requiredFields.push(envKey);
            fieldDefinitions[envKey] = {
                label: envKey
            };
        });
        configJson.envMapping = envMapping;
    }

    return {
        key,
        name: serverName,
        providerType: "custom",
        authType: "custom",
        category: "productivity",
        configJson
    };
}

async function resolveOrganizationId(input: { organizationId?: string; userId?: string }) {
    if (input.organizationId) return input.organizationId;
    if (!input.userId) return null;
    const membership = await prisma.membership.findFirst({
        where: { userId: input.userId },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true }
    });
    return membership?.organizationId || null;
}

function redactValue(value: string) {
    if (value.length <= 8) return "****";
    return `${value.slice(0, 3)}****${value.slice(-3)}`;
}

function extractCustomCredentials(
    serverConfig: McpServerConfig,
    configJson: Record<string, unknown>,
    overrides?: Record<string, string>
) {
    const credentials: Record<string, string> = {};
    const headerMapping =
        configJson.headerMapping && typeof configJson.headerMapping === "object"
            ? (configJson.headerMapping as Record<string, string>)
            : null;
    const envMapping =
        configJson.envMapping && typeof configJson.envMapping === "object"
            ? (configJson.envMapping as Record<string, string>)
            : null;

    if (headerMapping && serverConfig.headers) {
        const headersLower = Object.entries(serverConfig.headers).reduce<Record<string, string>>(
            (acc, [key, value]) => {
                acc[key.toLowerCase()] = value;
                return acc;
            },
            {}
        );
        Object.entries(headerMapping).forEach(([header, key]) => {
            const value = serverConfig.headers?.[header] || headersLower[header.toLowerCase()];
            if (value) credentials[key] = value;
        });
    }

    if (envMapping && serverConfig.env) {
        Object.entries(envMapping).forEach(([envKey, key]) => {
            const value = serverConfig.env?.[envKey];
            if (value) credentials[key] = value;
        });
    }

    if (overrides) {
        Object.entries(overrides).forEach(([key, value]) => {
            if (value) credentials[key] = value;
        });
    }

    return credentials;
}

export const integrationImportMcpJsonTool = createTool({
    id: "integration-import-mcp-json",
    description:
        "Parse unstructured MCP JSON, map servers to integration providers, and create or update integration connections.",
    inputSchema: z.object({
        rawText: z.string().describe("Raw MCP JSON or unstructured text containing MCP JSON"),
        organizationId: z.string().optional().describe("Organization ID for the connections"),
        userId: z.string().optional().describe("User ID to resolve organization membership"),
        dryRun: z.boolean().optional().describe("If true, only returns a plan without changes"),
        overrides: z
            .record(z.record(z.string()))
            .optional()
            .describe("Optional overrides keyed by server name or provider key")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        dryRun: z.boolean(),
        organizationId: z.string().nullable(),
        summary: z.object({
            totalServers: z.number(),
            providersCreated: z.number(),
            connectionsCreated: z.number(),
            connectionsUpdated: z.number(),
            missingFieldsCount: z.number()
        }),
        items: z.array(
            z.object({
                serverName: z.string(),
                providerKey: z.string(),
                providerName: z.string(),
                providerType: z.string(),
                authType: z.string(),
                action: z.string(),
                connectionId: z.string().optional(),
                missingFields: z.array(z.string()),
                credentialsApplied: z.array(z.string()),
                summary: z.string(),
                testResult: z
                    .object({
                        success: z.boolean(),
                        toolCount: z.number().optional(),
                        sampleTools: z.array(z.string()).optional(),
                        error: z.string().optional()
                    })
                    .optional()
            })
        ),
        errors: z.array(z.string()).optional()
    }),
    execute: async ({ rawText, organizationId, userId, dryRun, overrides }) => {
        const errors: string[] = [];
        const orgId = await resolveOrganizationId({ organizationId, userId });
        if (!orgId) {
            return {
                success: false,
                dryRun: true,
                organizationId: null,
                summary: {
                    totalServers: 0,
                    providersCreated: 0,
                    connectionsCreated: 0,
                    connectionsUpdated: 0,
                    missingFieldsCount: 0
                },
                items: [],
                errors: ["Organization context is required"]
            };
        }

        let servers: Record<string, McpServerConfig>;
        try {
            servers = parseMcpServers(rawText);
        } catch (error) {
            return {
                success: false,
                dryRun: true,
                organizationId: orgId,
                summary: {
                    totalServers: 0,
                    providersCreated: 0,
                    connectionsCreated: 0,
                    connectionsUpdated: 0,
                    missingFieldsCount: 0
                },
                items: [],
                errors: [error instanceof Error ? error.message : "Unable to parse MCP JSON"]
            };
        }

        await getIntegrationProviders();
        const providers = await prisma.integrationProvider.findMany({
            where: { isActive: true }
        });

        const items: ImportItem[] = [];
        let providersCreated = 0;
        let connectionsCreated = 0;
        let connectionsUpdated = 0;
        let missingFieldsCount = 0;

        for (const [serverName, serverConfig] of Object.entries(servers)) {
            const providerMatch = matchProviderForServer(serverName, serverConfig, providers);
            let providerId = providerMatch?.providerId || "";
            let providerKey = providerMatch?.providerKey || "";
            let providerName = providerMatch?.providerName || serverName;
            let providerType = providerMatch?.providerType || "custom";
            let authType = providerMatch?.authType || "custom";
            let requiredFields = providerMatch?.requiredFields || [];
            let customConfig: Record<string, unknown> | null = null;

            if (!providerMatch) {
                const customPayload = buildCustomProviderPayload(serverName, serverConfig);
                providerKey = customPayload.key;
                providerName = customPayload.name;
                providerType = customPayload.providerType;
                authType = customPayload.authType;
                requiredFields = getRequiredFields(customPayload.configJson);
                customConfig = customPayload.configJson;

                const existing = providers.find((p) => p.key === customPayload.key);
                if (!existing && !dryRun) {
                    const created = await prisma.integrationProvider.create({
                        data: {
                            key: customPayload.key,
                            name: customPayload.name,
                            description: `Custom MCP server for ${serverName}`,
                            category: customPayload.category,
                            authType: customPayload.authType,
                            providerType: customPayload.providerType,
                            configJson: customPayload.configJson as Prisma.InputJsonValue
                        }
                    });
                    providers.push(created);
                    providersCreated += 1;
                    providerId = created.id;
                } else if (existing) {
                    providerId = existing.id;
                } else if (dryRun) {
                    providerId = `dry-run-${customPayload.key}`;
                }
            }

            if (!providerId) {
                errors.push(`Failed to resolve provider for ${serverName}`);
                continue;
            }

            const override = overrides?.[serverName] || overrides?.[providerKey] || undefined;
            const credentials = customConfig
                ? extractCustomCredentials(serverConfig, customConfig, override)
                : extractCredentials(serverConfig, providerMatch, override);
            const missingFields = getMissingFields(requiredFields, credentials);
            missingFieldsCount += missingFields.length;

            const metadata = {
                importSource: "mcp.json",
                mcpServerName: serverName,
                command: serverConfig.command,
                args: serverConfig.args,
                url: serverConfig.url
            };

            let connectionId: string | undefined;
            let action: "create" | "update" = "create";
            let mergedCredentials = credentials;
            let isDefault = false;

            const existingConnection = providerId.startsWith("dry-run-")
                ? null
                : await prisma.integrationConnection.findFirst({
                      where: {
                          organizationId: orgId,
                          providerId,
                          OR: [
                              { name: serverName },
                              {
                                  metadata: { path: ["mcpServerName"], equals: serverName }
                              }
                          ]
                      }
                  });

            if (existingConnection) {
                action = "update";
                connectionId = existingConnection.id;
                isDefault = existingConnection.isDefault;
                if (
                    existingConnection.credentials &&
                    typeof existingConnection.credentials === "object"
                ) {
                    mergedCredentials = {
                        ...(existingConnection.credentials as Record<string, string>),
                        ...credentials
                    };
                }
            }

            if (!isDefault && !providerId.startsWith("dry-run-")) {
                const existingDefault = await prisma.integrationConnection.findFirst({
                    where: { organizationId: orgId, providerId, isDefault: true }
                });
                if (!existingDefault) {
                    isDefault = true;
                }
            }

            if (!dryRun) {
                if (existingConnection) {
                    await prisma.integrationConnection.update({
                        where: { id: existingConnection.id },
                        data: {
                            name: serverName,
                            isDefault,
                            credentials: mergedCredentials,
                            metadata,
                            userId: userId || existingConnection.userId
                        }
                    });
                    connectionsUpdated += 1;
                } else {
                    const created = await prisma.integrationConnection.create({
                        data: {
                            providerId,
                            organizationId: orgId,
                            userId: userId || null,
                            name: serverName,
                            isDefault,
                            credentials: mergedCredentials,
                            metadata
                        }
                    });
                    connectionId = created.id;
                    connectionsCreated += 1;
                }
            }

            const credentialsApplied = Object.entries(credentials).map(
                ([key, value]) => `${key}: ${redactValue(value)}`
            );

            items.push({
                serverName,
                providerKey,
                providerName,
                providerType,
                authType,
                action,
                connectionId,
                missingFields,
                credentialsApplied,
                summary:
                    missingFields.length > 0
                        ? `Missing required fields: ${missingFields.join(", ")}`
                        : "Ready for testing"
            });
        }

        if (!dryRun) {
            for (const item of items) {
                if (!item.connectionId) continue;
                const connection = await prisma.integrationConnection.findUnique({
                    where: { id: item.connectionId },
                    include: { provider: true }
                });
                if (!connection) continue;

                const credentials =
                    connection.credentials && typeof connection.credentials === "object"
                        ? (connection.credentials as Record<string, string>)
                        : {};
                const requiredFields = getRequiredFields(connection.provider.configJson);
                const missingFields = getMissingFields(requiredFields, credentials);
                if (missingFields.length > 0) {
                    item.testResult = {
                        success: false,
                        error: "Missing required credentials"
                    };
                    continue;
                }

                if (
                    connection.provider.providerType === "mcp" ||
                    connection.provider.providerType === "custom"
                ) {
                    try {
                        const { tools } = await getMcpTools({
                            organizationId: orgId,
                            userId: userId || null
                        });
                        const serverId = resolveServerId(
                            connection.provider.key,
                            connection.id,
                            connection.isDefault
                        );
                        const toolNames = Object.keys(tools).filter((name) =>
                            name.startsWith(`${serverId}_`)
                        );
                        item.testResult = {
                            success: toolNames.length > 0,
                            toolCount: toolNames.length,
                            sampleTools: toolNames.slice(0, 5)
                        };
                    } catch (error) {
                        item.testResult = {
                            success: false,
                            error:
                                error instanceof Error ? error.message : "Failed to test MCP tools"
                        };
                    }
                } else if (connection.provider.authType === "oauth") {
                    const connected = Boolean(
                        credentials.accessToken ||
                        credentials.refreshToken ||
                        credentials.oauthToken
                    );
                    item.testResult = { success: connected };
                } else {
                    item.testResult = { success: true };
                }

                await prisma.integrationConnection.update({
                    where: { id: connection.id },
                    data: {
                        lastTestedAt: new Date(),
                        errorMessage: item.testResult?.success
                            ? null
                            : item.testResult?.error || null
                    }
                });
            }
        }

        return {
            success: errors.length === 0,
            dryRun: Boolean(dryRun),
            organizationId: orgId,
            summary: {
                totalServers: Object.keys(servers).length,
                providersCreated,
                connectionsCreated,
                connectionsUpdated,
                missingFieldsCount
            },
            items,
            errors: errors.length > 0 ? errors : undefined
        };
    }
});

export const integrationMcpConfigTool = createTool({
    id: "integration-mcp-config",
    description: "Read MCP config, preview impact, and apply updates with confirmation gating.",
    inputSchema: z.object({
        action: z.enum(["read", "plan", "apply"]).optional().default("read"),
        config: z.record(z.any()).optional().describe("MCP config object"),
        rawText: z.string().optional().describe("Raw MCP JSON or text containing MCP JSON"),
        mode: z.enum(["replace", "merge"]).optional().default("replace"),
        confirm: z.boolean().optional().describe("Require true to apply if impact exists"),
        organizationId: z.string().optional(),
        userId: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        action: z.enum(["read", "plan", "apply"]),
        config: z.record(z.any()).optional(),
        configText: z.string().optional(),
        impact: z.record(z.any()).optional(),
        requiresConfirmation: z.boolean().optional(),
        result: z.record(z.any()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ action, config, rawText, mode, confirm, organizationId, userId }) => {
        const resolvedAction = action ?? "read";
        const resolvedMode = mode === "merge" ? "merge" : "replace";
        const orgId = await resolveOrganizationId({ organizationId, userId });
        if (!orgId) {
            return {
                success: false,
                action: resolvedAction,
                error: "Organization context is required"
            };
        }

        if (resolvedAction === "read") {
            const exported = await exportMcpConfig({ organizationId: orgId, userId });
            return {
                success: true,
                action: resolvedAction,
                config: exported as Record<string, unknown>,
                configText: JSON.stringify(exported, null, 2)
            };
        }

        let resolvedConfig: McpJsonConfigFile | null = null;
        try {
            resolvedConfig = resolveMcpConfigInput({ config, rawText });
        } catch (error) {
            return {
                success: false,
                action: resolvedAction,
                error: error instanceof Error ? error.message : "Unable to parse MCP config"
            };
        }

        if (!resolvedConfig) {
            return {
                success: false,
                action: resolvedAction,
                error: "MCP config is required for this action"
            };
        }

        if (resolvedAction === "plan") {
            const impact = await analyzeMcpConfigImpact({
                organizationId: orgId,
                userId,
                config: resolvedConfig,
                mode: resolvedMode
            });
            return {
                success: true,
                action: resolvedAction,
                impact: impact as Record<string, unknown>
            };
        }

        const impact = await analyzeMcpConfigImpact({
            organizationId: orgId,
            userId,
            config: resolvedConfig,
            mode: resolvedMode
        });

        if (impact.hasImpact && confirm !== true) {
            return {
                success: true,
                action: resolvedAction,
                requiresConfirmation: true,
                impact: impact as Record<string, unknown>
            };
        }

        const result = await importMcpConfig({
            organizationId: orgId,
            userId,
            config: resolvedConfig,
            mode: resolvedMode
        });

        return {
            success: true,
            action: resolvedAction,
            result: result as Record<string, unknown>
        };
    }
});

export const integrationConnectionTestTool = createTool({
    id: "integration-connection-test",
    description: "Test an integration connection by validating credentials and listing MCP tools.",
    inputSchema: z.object({
        connectionId: z.string(),
        organizationId: z.string().optional(),
        userId: z.string().optional()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        toolCount: z.number().optional(),
        sampleTools: z.array(z.string()).optional(),
        missingFields: z.array(z.string()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, organizationId, userId }) => {
        const orgId = await resolveOrganizationId({ organizationId, userId });
        if (!orgId) {
            return { success: false, error: "Organization context is required" };
        }

        const connection = await prisma.integrationConnection.findFirst({
            where: { id: connectionId, organizationId: orgId },
            include: { provider: true }
        });
        if (!connection) {
            return { success: false, error: "Connection not found" };
        }

        const credentials =
            connection.credentials && typeof connection.credentials === "object"
                ? (connection.credentials as Record<string, string>)
                : {};
        const requiredFields = getRequiredFields(connection.provider.configJson);
        const missingFields = getMissingFields(requiredFields, credentials);
        if (missingFields.length > 0) {
            return { success: false, missingFields };
        }

        if (
            connection.provider.providerType === "mcp" ||
            connection.provider.providerType === "custom"
        ) {
            try {
                const { tools } = await getMcpTools({
                    organizationId: orgId,
                    userId: userId || null
                });
                const serverId = resolveServerId(
                    connection.provider.key,
                    connection.id,
                    connection.isDefault
                );
                const toolNames = Object.keys(tools).filter((name) =>
                    name.startsWith(`${serverId}_`)
                );
                return {
                    success: toolNames.length > 0,
                    toolCount: toolNames.length,
                    sampleTools: toolNames.slice(0, 5)
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to test MCP tools"
                };
            }
        }

        if (connection.provider.authType === "oauth") {
            const connected = Boolean(
                credentials.accessToken || credentials.refreshToken || credentials.oauthToken
            );
            return { success: connected };
        }

        return { success: true };
    }
});

export const integrationProvidersListTool = createTool({
    id: "integration-providers-list",
    description: "List available integration providers with connection status.",
    inputSchema: z.object({}),
    outputSchema: baseOutputSchema,
    execute: async () => {
        return callInternalApi("/api/integrations/providers");
    }
});

export const integrationConnectionsListTool = createTool({
    id: "integration-connections-list",
    description: "List integration connections for the organization.",
    inputSchema: z.object({
        providerKey: z.string().optional(),
        scope: z.string().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ providerKey, scope }) => {
        return callInternalApi("/api/integrations/connections", {
            query: { providerKey, scope }
        });
    }
});

export const integrationConnectionCreateTool = createTool({
    id: "integration-connection-create",
    description: "Create a new integration connection.",
    inputSchema: z.object({
        providerKey: z.string(),
        name: z.string(),
        scope: z.string().optional(),
        credentials: z.record(z.any()).optional(),
        metadata: z.record(z.any()).optional(),
        isDefault: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ providerKey, name, scope, credentials, metadata, isDefault }) => {
        return callInternalApi("/api/integrations/connections", {
            method: "POST",
            body: { providerKey, name, scope, credentials, metadata, isDefault }
        });
    }
});

export const integrationConnectionUpdateTool = createTool({
    id: "integration-connection-update",
    description: "Update an existing integration connection.",
    inputSchema: z.object({
        connectionId: z.string().describe("Connection ID to update"),
        name: z.string().optional(),
        credentials: z.record(z.any()).optional(),
        metadata: z.record(z.any()).optional(),
        isDefault: z.boolean().optional()
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ connectionId, name, credentials, metadata, isDefault }) => {
        return callInternalApi(`/api/integrations/connections/${connectionId}`, {
            method: "PATCH",
            body: { name, credentials, metadata, isDefault }
        });
    }
});

export const integrationConnectionDeleteTool = createTool({
    id: "integration-connection-delete",
    description: "Delete an integration connection.",
    inputSchema: z.object({
        connectionId: z.string().describe("Connection ID to delete")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ connectionId }) => {
        return callInternalApi(`/api/integrations/connections/${connectionId}`, {
            method: "DELETE"
        });
    }
});

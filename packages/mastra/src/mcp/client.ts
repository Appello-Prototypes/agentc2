import { createDecipheriv } from "crypto";
import { MCPClient, type MastraMCPServerDefinition } from "@mastra/mcp";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import {
    prisma,
    type IntegrationConnection,
    type IntegrationProvider,
    type Prisma
} from "@repo/database";

declare global {
    var mcpClient: MCPClient | undefined;
}

const ORG_MCP_CACHE_TTL = 60000;
const orgMcpClients = new Map<string, { client: MCPClient; loadedAt: number }>();

export function invalidateMcpCacheForOrg(organizationId: string) {
    for (const key of orgMcpClients.keys()) {
        if (key.startsWith(`${organizationId}:`)) {
            orgMcpClients.delete(key);
        }
    }
}

type EncryptedPayload = {
    __enc: "v1";
    iv: string;
    tag: string;
    data: string;
};

const getEncryptionKey = () => {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) return null;
    const buffer = Buffer.from(key, "hex");
    if (buffer.length !== 32) {
        console.warn("[MCP] Invalid CREDENTIAL_ENCRYPTION_KEY length");
        return null;
    }
    return buffer;
};

const isEncryptedPayload = (value: unknown): value is EncryptedPayload => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    return (
        payload.__enc === "v1" &&
        typeof payload.iv === "string" &&
        typeof payload.tag === "string" &&
        typeof payload.data === "string"
    );
};

const decryptCredentials = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    if (!isEncryptedPayload(value)) return value;

    const key = getEncryptionKey();
    if (!key) return {};

    try {
        const iv = Buffer.from(value.iv, "base64");
        const tag = Buffer.from(value.tag, "base64");
        const encrypted = Buffer.from(value.data, "base64");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
            "utf8"
        );
        return JSON.parse(decrypted) as Record<string, unknown>;
    } catch (error) {
        console.error("[MCP] Failed to decrypt credentials:", error);
        return {};
    }
};

type IntegrationProviderSeed = {
    key: string;
    name: string;
    description: string;
    category: IntegrationProvider["category"];
    authType: IntegrationProvider["authType"];
    providerType: IntegrationProvider["providerType"];
    configJson?: Prisma.InputJsonValue;
    actionsJson?: Prisma.InputJsonValue;
    triggersJson?: Prisma.InputJsonValue;
};

const INTEGRATION_PROVIDER_SEEDS: IntegrationProviderSeed[] = [
    {
        key: "playwright",
        name: "Playwright",
        description: "Browser automation - navigate, click, screenshot, interact with web pages",
        category: "web",
        authType: "none",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["Playwright", "playwright"],
                matchArgs: ["@playwright/mcp", "@playwright/mcp@latest"]
            }
        }
    },
    {
        key: "firecrawl",
        name: "Firecrawl",
        description: "Web scraping and crawling - extract data from websites",
        category: "web",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["FIRECRAWL_API_KEY"],
            fieldDefinitions: {
                FIRECRAWL_API_KEY: {
                    label: "Firecrawl API key",
                    description: "Create in the Firecrawl dashboard",
                    placeholder: "fc-...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Firecrawl", "firecrawl"],
                matchArgs: ["firecrawl-mcp"],
                envAliases: {
                    FIRECRAWL_API_KEY: "FIRECRAWL_API_KEY"
                }
            }
        }
    },
    {
        key: "hubspot",
        name: "HubSpot",
        description: "CRM integration - contacts, companies, deals, and pipeline",
        category: "crm",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["HUBSPOT_ACCESS_TOKEN"],
            fieldDefinitions: {
                HUBSPOT_ACCESS_TOKEN: {
                    label: "HubSpot private app token",
                    description: "Generate in HubSpot private app settings",
                    placeholder: "pat-na1-...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Hubspot", "HubSpot", "hubspot"],
                matchArgs: ["@hubspot/mcp-server"],
                envAliases: {
                    PRIVATE_APP_ACCESS_TOKEN: "HUBSPOT_ACCESS_TOKEN",
                    HUBSPOT_ACCESS_TOKEN: "HUBSPOT_ACCESS_TOKEN"
                }
            }
        }
    },
    {
        key: "jira",
        name: "Jira",
        description: "Project management - issues, sprints, and project tracking",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["JIRA_URL", "JIRA_USERNAME", "JIRA_API_TOKEN"],
            fieldDefinitions: {
                JIRA_URL: {
                    label: "Jira base URL",
                    description: "Example: https://your-org.atlassian.net",
                    placeholder: "https://your-org.atlassian.net",
                    type: "url"
                },
                JIRA_USERNAME: {
                    label: "Jira username",
                    description: "Email address used to create the API token",
                    placeholder: "email@example.com"
                },
                JIRA_API_TOKEN: {
                    label: "Jira API token",
                    description: "Create in Atlassian API tokens",
                    placeholder: "ATATT3x...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Jira", "JIRA", "jira"],
                matchArgs: ["mcp-atlassian", "jira-mcp", "jira-review-wrapper.js"],
                envAliases: {
                    JIRA_URL: "JIRA_URL",
                    JIRA_USERNAME: "JIRA_USERNAME",
                    JIRA_API_TOKEN: "JIRA_API_TOKEN",
                    JIRA_PROJECTS_FILTER: "JIRA_PROJECTS_FILTER"
                }
            }
        }
    },
    {
        key: "justcall",
        name: "JustCall",
        description: "Phone and SMS communication - call logs and messaging",
        category: "communication",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["JUSTCALL_AUTH_TOKEN"],
            fieldDefinitions: {
                JUSTCALL_AUTH_TOKEN: {
                    label: "JustCall auth token",
                    description: "Format: api_key:api_secret",
                    placeholder: "api_key:api_secret",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["JustCall", "justcall"],
                matchUrls: ["mcp.justcall.host/mcp"],
                headerAliases: {
                    Authorization: "JUSTCALL_AUTH_TOKEN"
                }
            }
        }
    },
    {
        key: "twilio",
        name: "Twilio",
        description: "Outbound voice calls via Twilio and ElevenLabs streaming",
        category: "communication",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["TWILIO_MCP_API_URL"],
            fieldDefinitions: {
                TWILIO_MCP_API_URL: {
                    label: "Twilio MCP API URL",
                    description: "URL to the Twilio MCP service",
                    placeholder: "https://...",
                    type: "url"
                }
            },
            importHints: {
                matchNames: ["Twilio", "twilio"],
                envAliases: {
                    TWILIO_MCP_API_URL: "TWILIO_MCP_API_URL"
                }
            }
        }
    },
    {
        key: "atlas",
        name: "ATLAS",
        description: "Custom n8n workflow automation and business processes",
        category: "automation",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["ATLAS_N8N_SSE_URL"],
            fieldDefinitions: {
                ATLAS_N8N_SSE_URL: {
                    label: "ATLAS n8n SSE URL",
                    description: "Streaming endpoint from ATLAS/n8n MCP",
                    placeholder: "https://.../sse",
                    type: "url"
                }
            },
            importHints: {
                matchNames: ["ATLAS", "atlas"],
                matchArgs: ["supergateway", "--sse"],
                argValueMap: {
                    "--sse": "ATLAS_N8N_SSE_URL"
                },
                envAliases: {
                    ATLAS_N8N_SSE_URL: "ATLAS_N8N_SSE_URL"
                }
            }
        }
    },
    {
        key: "fathom",
        name: "Fathom",
        description: "Meeting recordings, transcripts, and summaries from Fathom AI",
        category: "knowledge",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["FATHOM_API_KEY"],
            fieldDefinitions: {
                FATHOM_API_KEY: {
                    label: "Fathom API key",
                    description: "From Fathom account settings",
                    placeholder: "fathom_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Fathom", "fathom"],
                matchArgs: ["fathom-mcp", "fathom-mcp-package"],
                envAliases: {
                    FATHOM_API_KEY: "FATHOM_API_KEY"
                }
            }
        }
    },
    {
        key: "slack",
        name: "Slack",
        description: "Workspace messaging - channels, messages, users, and search",
        category: "communication",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
            fieldDefinitions: {
                SLACK_BOT_TOKEN: {
                    label: "Slack bot token",
                    description: "Bot User OAuth token (xoxb-...)",
                    placeholder: "xoxb-...",
                    type: "password"
                },
                SLACK_TEAM_ID: {
                    label: "Slack workspace ID",
                    description: "Workspace ID (starts with T)",
                    placeholder: "T01234567"
                }
            },
            importHints: {
                matchNames: ["Slack", "slack"],
                matchArgs: ["@modelcontextprotocol/server-slack"],
                envAliases: {
                    SLACK_BOT_TOKEN: "SLACK_BOT_TOKEN",
                    SLACK_TEAM_ID: "SLACK_TEAM_ID"
                }
            }
        }
    },
    {
        key: "gdrive",
        name: "Google Drive",
        description: "File storage - search, list, and read Google Drive files",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["GDRIVE_CREDENTIALS_PATH"],
            fieldDefinitions: {
                GDRIVE_CREDENTIALS_PATH: {
                    label: "Google Drive credentials path",
                    description: "Path to OAuth JSON credentials",
                    placeholder: "./credentials/gdrive-oauth.json"
                }
            },
            importHints: {
                matchNames: ["Google Drive", "Google Workspace", "GDrive", "Google Suite"],
                matchArgs: ["mcp-google-suite", "google-suite", "google-calendar-mcp"],
                envAliases: {
                    GOOGLE_OAUTH_CREDENTIALS: "GDRIVE_CREDENTIALS_PATH",
                    GDRIVE_CREDENTIALS_PATH: "GDRIVE_CREDENTIALS_PATH"
                }
            }
        }
    },
    {
        key: "github",
        name: "GitHub",
        description: "Repository management - issues, PRs, code, and actions",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
            fieldDefinitions: {
                GITHUB_PERSONAL_ACCESS_TOKEN: {
                    label: "GitHub personal access token",
                    description: "PAT with repo access",
                    placeholder: "ghp_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["GitHub", "github"],
                matchArgs: ["@modelcontextprotocol/server-github"],
                envAliases: {
                    GITHUB_PERSONAL_ACCESS_TOKEN: "GITHUB_PERSONAL_ACCESS_TOKEN"
                }
            }
        }
    },
    {
        key: "gmail",
        name: "Gmail",
        description: "Email ingestion and draft approvals using Gmail OAuth",
        category: "communication",
        authType: "oauth",
        providerType: "oauth",
        configJson: {
            requiredScopes: [
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.send"
            ],
            oauthConfig: {
                socialProvider: "google",
                scopes: [
                    "https://www.googleapis.com/auth/gmail.modify",
                    "https://www.googleapis.com/auth/gmail.send"
                ],
                statusEndpoint: "/api/integrations/gmail/status",
                syncEndpoint: "/api/integrations/gmail/sync"
            },
            setupUrl: "/mcp/gmail",
            setupLabel: "Open OAuth Setup"
        },
        triggersJson: {
            triggers: [
                {
                    key: "gmail.message.received",
                    description: "New email received"
                }
            ]
        }
    },
    {
        key: "webhook",
        name: "Incoming Webhook",
        description: "Webhook connections that trigger agents via the unified trigger system",
        category: "automation",
        authType: "webhook",
        providerType: "webhook"
    }
];

function getCredentialValue(
    credentials: Record<string, unknown> | undefined,
    keys: string[]
): string | undefined {
    if (!credentials) return undefined;
    for (const key of keys) {
        const value = credentials[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

async function ensureIntegrationProviders() {
    await Promise.all(
        INTEGRATION_PROVIDER_SEEDS.map((seed) =>
            prisma.integrationProvider.upsert({
                where: { key: seed.key },
                update: {
                    name: seed.name,
                    description: seed.description,
                    category: seed.category,
                    authType: seed.authType,
                    providerType: seed.providerType,
                    configJson: seed.configJson ?? undefined,
                    actionsJson: seed.actionsJson ?? undefined,
                    triggersJson: seed.triggersJson ?? undefined,
                    isActive: true
                },
                create: {
                    key: seed.key,
                    name: seed.name,
                    description: seed.description,
                    category: seed.category,
                    authType: seed.authType,
                    providerType: seed.providerType,
                    configJson: seed.configJson ?? undefined,
                    actionsJson: seed.actionsJson ?? undefined,
                    triggersJson: seed.triggersJson ?? undefined,
                    isActive: true
                }
            })
        )
    );
}

export async function getIntegrationProviders() {
    await ensureIntegrationProviders();
    return prisma.integrationProvider.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" }
    });
}

type ConnectionWithProvider = IntegrationConnection & {
    provider: IntegrationProvider;
};

async function getIntegrationConnections(options: {
    organizationId?: string | null;
    userId?: string | null;
}) {
    if (!options.organizationId) {
        return [] as ConnectionWithProvider[];
    }

    await ensureIntegrationProviders();

    const connections = await prisma.integrationConnection.findMany({
        where: {
            organizationId: options.organizationId,
            isActive: true,
            OR: [
                { scope: "org" },
                ...(options.userId ? [{ scope: "user", userId: options.userId }] : [])
            ]
        },
        include: { provider: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });

    if (connections.length > 0) {
        return connections;
    }

    const legacyCredentials = await prisma.toolCredential.findMany({
        where: { organizationId: options.organizationId, isActive: true }
    });

    if (legacyCredentials.length === 0) {
        return connections;
    }

    const legacyKeys = legacyCredentials
        .map((credential) => credential.toolId)
        .filter((toolId) => toolId !== "mastra-mcp-api");

    if (legacyKeys.length === 0) {
        return connections;
    }

    const providers = await prisma.integrationProvider.findMany({
        where: { key: { in: legacyKeys } }
    });
    const providersByKey = new Map(providers.map((provider) => [provider.key, provider]));

    return legacyCredentials
        .filter((credential) => providersByKey.has(credential.toolId))
        .map((credential) => {
            const provider = providersByKey.get(credential.toolId)!;
            return {
                id: credential.id,
                providerId: provider.id,
                provider,
                organizationId: credential.organizationId,
                userId: null,
                scope: "org",
                name: credential.name,
                isDefault: true,
                isActive: credential.isActive,
                credentials:
                    credential.credentials && typeof credential.credentials === "object"
                        ? (credential.credentials as Record<string, unknown>)
                        : null,
                metadata: null,
                lastUsedAt: credential.lastUsedAt,
                lastTestedAt: null,
                errorMessage: null,
                webhookPath: null,
                webhookSecret: null,
                agentTriggerId: null,
                createdAt: credential.createdAt,
                updatedAt: credential.updatedAt
            } as ConnectionWithProvider;
        });
}

function resolveServerId(
    providerKey: string,
    connection: ConnectionWithProvider | null,
    isDefault: boolean
) {
    if (!connection || isDefault) {
        return providerKey;
    }
    return `${providerKey}__${connection.id.slice(0, 8)}`;
}

function buildCustomServerDefinition(
    provider: IntegrationProvider,
    connection: ConnectionWithProvider,
    credentials: Record<string, unknown>
): MastraMCPServerDefinition | null {
    const config = provider.configJson as Record<string, unknown> | null;
    if (!config) return null;

    const transport = config.transport;
    if (transport === "http") {
        const urlValue = typeof config.url === "string" ? config.url : null;
        if (!urlValue) return null;
        const headers =
            config.headerMapping && typeof config.headerMapping === "object"
                ? Object.entries(config.headerMapping as Record<string, string>).reduce<
                      Record<string, string>
                  >((acc, [header, key]) => {
                      const value = getCredentialValue(credentials, [key]);
                      if (value) acc[header] = value;
                      return acc;
                  }, {})
                : {};
        return {
            url: new URL(urlValue),
            requestInit: {
                headers
            }
        };
    }

    const command = typeof config.command === "string" ? config.command : null;
    const args =
        Array.isArray(config.args) && config.args.every((arg) => typeof arg === "string")
            ? (config.args as string[])
            : [];
    if (!command) return null;

    const env =
        config.envMapping && typeof config.envMapping === "object"
            ? Object.entries(config.envMapping as Record<string, string>).reduce<
                  Record<string, string>
              >((acc, [envKey, key]) => {
                  const value = getCredentialValue(credentials, [key]);
                  if (value) acc[envKey] = value;
                  return acc;
              }, {})
            : {};

    return { command, args, env };
}

function buildServerDefinitionForProvider(options: {
    provider: IntegrationProvider;
    connection?: ConnectionWithProvider | null;
    credentials: Record<string, unknown>;
    allowEnvFallback?: boolean;
}): MastraMCPServerDefinition | null {
    const { provider, credentials, allowEnvFallback = false, connection } = options;
    const providerKey = provider.key;

    if (provider.providerType === "custom") {
        if (!connection) return null;
        return buildCustomServerDefinition(provider, connection, credentials);
    }

    switch (providerKey) {
        case "playwright":
            return {
                command: "npx",
                args: ["-y", "@playwright/mcp@latest"]
            };
        case "firecrawl": {
            const firecrawlKey =
                getCredentialValue(credentials, ["FIRECRAWL_API_KEY"]) ||
                (allowEnvFallback ? process.env.FIRECRAWL_API_KEY : undefined);
            if (!firecrawlKey) return null;
            return {
                command: "npx",
                args: ["-y", "firecrawl-mcp"],
                env: { FIRECRAWL_API_KEY: firecrawlKey }
            };
        }
        case "hubspot": {
            const hubspotToken =
                getCredentialValue(credentials, [
                    "PRIVATE_APP_ACCESS_TOKEN",
                    "HUBSPOT_ACCESS_TOKEN"
                ]) || (allowEnvFallback ? process.env.HUBSPOT_ACCESS_TOKEN : undefined);
            if (!hubspotToken) return null;
            return {
                command: "npx",
                args: ["-y", "@hubspot/mcp-server"],
                env: { PRIVATE_APP_ACCESS_TOKEN: hubspotToken }
            };
        }
        case "jira": {
            const jiraUrl =
                getCredentialValue(credentials, ["JIRA_URL"]) ||
                (allowEnvFallback ? process.env.JIRA_URL : undefined);
            const jiraUsername =
                getCredentialValue(credentials, ["JIRA_USERNAME"]) ||
                (allowEnvFallback ? process.env.JIRA_USERNAME : undefined);
            const jiraToken =
                getCredentialValue(credentials, ["JIRA_API_TOKEN"]) ||
                (allowEnvFallback ? process.env.JIRA_API_TOKEN : undefined);
            const jiraProjectsFilter =
                getCredentialValue(credentials, ["JIRA_PROJECTS_FILTER"]) ||
                (allowEnvFallback ? process.env.JIRA_PROJECTS_FILTER : undefined);
            if (!jiraUrl || !jiraUsername || !jiraToken) return null;
            return {
                command: "uvx",
                args: ["mcp-atlassian"],
                env: {
                    JIRA_URL: jiraUrl,
                    JIRA_USERNAME: jiraUsername,
                    JIRA_API_TOKEN: jiraToken,
                    ...(jiraProjectsFilter ? { JIRA_PROJECTS_FILTER: jiraProjectsFilter } : {})
                }
            };
        }
        case "justcall": {
            const justcallToken =
                getCredentialValue(credentials, ["JUSTCALL_AUTH_TOKEN"]) ||
                (allowEnvFallback ? process.env.JUSTCALL_AUTH_TOKEN : undefined);
            if (!justcallToken) return null;
            return {
                url: new URL("https://mcp.justcall.host/mcp"),
                requestInit: {
                    headers: { Authorization: `Bearer ${justcallToken}` }
                }
            };
        }
        case "twilio": {
            const twilioMcpApiUrl =
                getCredentialValue(credentials, ["TWILIO_MCP_API_URL", "MASTRA_API_URL"]) ||
                (allowEnvFallback
                    ? process.env.TWILIO_MCP_API_URL ||
                      process.env.MASTRA_API_URL ||
                      process.env.NEXT_PUBLIC_APP_URL
                    : undefined);
            if (!twilioMcpApiUrl) return null;
            const twilioApiKey =
                getCredentialValue(credentials, ["MASTRA_API_KEY"]) ||
                (allowEnvFallback ? process.env.MASTRA_API_KEY : undefined);
            const twilioOrgSlug =
                getCredentialValue(credentials, [
                    "MASTRA_ORGANIZATION_SLUG",
                    "MCP_API_ORGANIZATION_SLUG"
                ]) ||
                (allowEnvFallback
                    ? process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG
                    : undefined);
            return {
                command: "node",
                args: [
                    resolve(dirname(fileURLToPath(import.meta.url)), "../../../twilio-mcp/index.js")
                ],
                env: {
                    TWILIO_MCP_API_URL: twilioMcpApiUrl,
                    ...(twilioApiKey ? { MASTRA_API_KEY: twilioApiKey } : {}),
                    ...(twilioOrgSlug ? { MASTRA_ORGANIZATION_SLUG: twilioOrgSlug } : {})
                }
            };
        }
        case "atlas": {
            const atlasUrl =
                getCredentialValue(credentials, ["ATLAS_N8N_SSE_URL"]) ||
                (allowEnvFallback ? process.env.ATLAS_N8N_SSE_URL : undefined);
            if (!atlasUrl) return null;
            return {
                command: "npx",
                args: [
                    "-y",
                    "supergateway",
                    "--sse",
                    atlasUrl,
                    "--timeout",
                    "600000",
                    "--keep-alive-timeout",
                    "600000",
                    "--retry-after-disconnect",
                    "--reconnect-interval",
                    "1000"
                ]
            };
        }
        case "fathom": {
            const fathomKey =
                getCredentialValue(credentials, ["FATHOM_API_KEY"]) ||
                (allowEnvFallback ? process.env.FATHOM_API_KEY : undefined);
            if (!fathomKey) return null;
            return {
                command: "node",
                args: [
                    resolve(dirname(fileURLToPath(import.meta.url)), "../../../fathom-mcp/index.js")
                ],
                env: { FATHOM_API_KEY: fathomKey }
            };
        }
        case "slack": {
            const slackToken =
                getCredentialValue(credentials, ["SLACK_BOT_TOKEN"]) ||
                (allowEnvFallback ? process.env.SLACK_BOT_TOKEN : undefined);
            const slackTeamId =
                getCredentialValue(credentials, ["SLACK_TEAM_ID"]) ||
                (allowEnvFallback ? process.env.SLACK_TEAM_ID : undefined);
            if (!slackToken || !slackTeamId) return null;
            return {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-slack"],
                env: { SLACK_BOT_TOKEN: slackToken, SLACK_TEAM_ID: slackTeamId }
            };
        }
        case "gdrive": {
            const gdriveCredentialsPath =
                getCredentialValue(credentials, ["GDRIVE_CREDENTIALS_PATH"]) ||
                (allowEnvFallback ? process.env.GDRIVE_CREDENTIALS_PATH : undefined);
            const gdriveOauthPath =
                getCredentialValue(credentials, ["GDRIVE_OAUTH_PATH"]) ||
                (allowEnvFallback ? process.env.GDRIVE_OAUTH_PATH : undefined);
            if (!gdriveCredentialsPath) return null;
            return {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-gdrive"],
                env: {
                    GDRIVE_CREDENTIALS_PATH: gdriveCredentialsPath,
                    ...(gdriveOauthPath ? { GDRIVE_OAUTH_PATH: gdriveOauthPath } : {})
                }
            };
        }
        case "github": {
            const githubToken =
                getCredentialValue(credentials, ["GITHUB_PERSONAL_ACCESS_TOKEN"]) ||
                (allowEnvFallback ? process.env.GITHUB_PERSONAL_ACCESS_TOKEN : undefined);
            if (!githubToken) return null;
            return {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: { GITHUB_PERSONAL_ACCESS_TOKEN: githubToken }
            };
        }
        default:
            return null;
    }
}

function buildServerConfigs(options: {
    connections: ConnectionWithProvider[];
    allowEnvFallback?: boolean;
}): Record<string, MastraMCPServerDefinition> {
    const { connections, allowEnvFallback = false } = options;
    const servers: Record<string, MastraMCPServerDefinition> = {};

    const connectionsByProvider = new Map<string, ConnectionWithProvider[]>();
    for (const connection of connections) {
        const list = connectionsByProvider.get(connection.provider.key) ?? [];
        list.push(connection);
        connectionsByProvider.set(connection.provider.key, list);
    }

    // Ensure Playwright is always available
    const playwrightProvider = INTEGRATION_PROVIDER_SEEDS.find((seed) => seed.key === "playwright");
    if (playwrightProvider) {
        servers.playwright = {
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"]
        };
    }

    for (const [providerKey, providerConnections] of connectionsByProvider.entries()) {
        const defaultConnection =
            providerConnections.find((conn) => conn.isDefault) ?? providerConnections[0];

        for (const connection of providerConnections) {
            const isDefault = connection.id === defaultConnection?.id;
            const serverId = resolveServerId(providerKey, connection, isDefault);
            const decryptedCredentials = decryptCredentials(connection.credentials);
            const credentials =
                decryptedCredentials &&
                typeof decryptedCredentials === "object" &&
                !Array.isArray(decryptedCredentials)
                    ? (decryptedCredentials as Record<string, unknown>)
                    : {};
            const serverDefinition = buildServerDefinitionForProvider({
                provider: connection.provider,
                connection,
                credentials,
                allowEnvFallback
            });
            if (serverDefinition) {
                servers[serverId] = serverDefinition;
            }
        }
    }

    // Env fallback for providers without connections
    if (allowEnvFallback) {
        const seededProviders = INTEGRATION_PROVIDER_SEEDS.filter(
            (seed) => seed.providerType === "mcp"
        );
        for (const providerSeed of seededProviders) {
            if (servers[providerSeed.key]) continue;
            const serverDefinition = buildServerDefinitionForProvider({
                provider: providerSeed as IntegrationProvider,
                connection: null,
                credentials: {},
                allowEnvFallback
            });
            if (serverDefinition) {
                servers[providerSeed.key] = serverDefinition;
            }
        }
    }

    return servers;
}

/**
 * Sanitize JSON Schema to fix common issues that cause OpenAI model validation failures.
 *
 * Known issues fixed:
 * - Array properties missing "items" definition (e.g., HubSpot's search-objects tool)
 * - Empty object schemas
 *
 * @param schema - The JSON schema to sanitize
 * @returns Sanitized schema safe for all LLM providers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeToolSchema(schema: any): any {
    if (!schema || typeof schema !== "object") {
        return schema;
    }

    // Handle arrays
    if (Array.isArray(schema)) {
        return schema.map(sanitizeToolSchema);
    }

    // Clone the schema to avoid mutations
    const result = { ...schema };

    // Fix: Array type missing items definition
    if (result.type === "array" && !result.items) {
        result.items = { type: "string" }; // Default to string array
    }

    // Recursively sanitize nested schemas
    if (result.properties && typeof result.properties === "object") {
        result.properties = Object.fromEntries(
            Object.entries(result.properties).map(([key, value]) => [
                key,
                sanitizeToolSchema(value)
            ])
        );
    }

    if (result.items && typeof result.items === "object") {
        result.items = sanitizeToolSchema(result.items);
    }

    if (result.additionalProperties && typeof result.additionalProperties === "object") {
        result.additionalProperties = sanitizeToolSchema(result.additionalProperties);
    }

    // Handle allOf, anyOf, oneOf
    for (const keyword of ["allOf", "anyOf", "oneOf"]) {
        if (Array.isArray(result[keyword])) {
            result[keyword] = result[keyword].map(sanitizeToolSchema);
        }
    }

    return result;
}

/**
 * Sanitize all tools returned from MCP to ensure schema compatibility with all LLM providers.
 *
 * @param tools - Record of tool name to tool instance
 * @returns Sanitized tools with fixed schemas
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeMcpTools(tools: Record<string, any>): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized: Record<string, any> = {};

    for (const [name, tool] of Object.entries(tools)) {
        if (tool && typeof tool === "object") {
            // Clone the tool
            const sanitizedTool = { ...tool };

            // Sanitize inputSchema if present
            if (sanitizedTool.inputSchema) {
                sanitizedTool.inputSchema = sanitizeToolSchema(sanitizedTool.inputSchema);
            }

            // Also check for schema property (some tools use this)
            if (sanitizedTool.schema) {
                sanitizedTool.schema = sanitizeToolSchema(sanitizedTool.schema);
            }

            // Check for parameters (another common property name)
            if (sanitizedTool.parameters) {
                sanitizedTool.parameters = sanitizeToolSchema(sanitizedTool.parameters);
            }

            sanitized[name] = sanitizedTool;
        } else {
            sanitized[name] = tool;
        }
    }

    return sanitized;
}

/**
 * MCP Server Configuration
 *
 * Defines all available MCP servers and their metadata.
 * This is the single source of truth for server configuration.
 */
export interface McpServerConfig {
    id: string;
    name: string;
    description: string;
    category: "knowledge" | "web" | "crm" | "productivity" | "communication" | "automation";
    requiresAuth: boolean;
    envVars?: string[];
}

export const MCP_SERVER_CONFIGS: McpServerConfig[] = INTEGRATION_PROVIDER_SEEDS.filter(
    (seed) => seed.providerType === "mcp"
).map((seed) => ({
    id: seed.key,
    name: seed.name,
    description: seed.description,
    category: seed.category as McpServerConfig["category"],
    requiresAuth: seed.authType !== "none",
    envVars:
        seed.configJson && typeof seed.configJson === "object" && !Array.isArray(seed.configJson)
            ? ((seed.configJson as { requiredFields?: string[] }).requiredFields ?? undefined)
            : undefined
}));

/**
 * MCP Client Configuration
 *
 * Connects to external MCP servers to provide additional tools.
 * All servers use npx for easy installation without local dependencies.
 */
function getMcpClient(): MCPClient {
    if (!global.mcpClient) {
        const servers = buildServerConfigs({
            connections: [],
            allowEnvFallback: true
        });

        global.mcpClient = new MCPClient({
            id: "mastra-mcp-client",
            servers,
            timeout: 60000 // 60 second timeout
        });
    }

    return global.mcpClient;
}

export const mcpClient = getMcpClient();

async function getMcpClientForOrganization(options?: {
    organizationId?: string | null;
    userId?: string | null;
}): Promise<MCPClient> {
    const organizationId = options?.organizationId;
    if (!organizationId) {
        return mcpClient;
    }

    const cacheKey = `${organizationId}:${options?.userId || "org"}`;
    const cached = orgMcpClients.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.loadedAt < ORG_MCP_CACHE_TTL) {
        return cached.client;
    }

    const connections = await getIntegrationConnections({
        organizationId,
        userId: options?.userId
    });

    const servers = buildServerConfigs({
        connections,
        allowEnvFallback: true
    });

    const client = new MCPClient({
        id: `mastra-mcp-client-${organizationId}`,
        servers,
        timeout: 60000
    });

    orgMcpClients.set(cacheKey, { client, loadedAt: now });
    return client;
}

/**
 * Get all available MCP tools
 * Use this when configuring an agent with static tools
 *
 * Tools are sanitized to fix schema issues that cause validation failures
 * with strict LLM providers like OpenAI GPT-4o-mini.
 */
export async function getMcpTools(
    organizationIdOrOptions?:
        | string
        | null
        | { organizationId?: string | null; userId?: string | null }
) {
    const options =
        organizationIdOrOptions && typeof organizationIdOrOptions === "object"
            ? organizationIdOrOptions
            : { organizationId: organizationIdOrOptions };
    const client = await getMcpClientForOrganization(options);
    const tools = await client.listTools();
    return sanitizeMcpTools(tools);
}

/**
 * Get MCP toolsets for dynamic per-request configuration
 * Use this when tools need to vary by request (e.g., different API keys per user)
 *
 * Toolsets are sanitized to fix schema issues that cause validation failures
 * with strict LLM providers like OpenAI GPT-4o-mini.
 */
export async function getMcpToolsets() {
    const toolsets = await mcpClient.listToolsets();
    return sanitizeMcpTools(toolsets);
}

/**
 * Disconnect MCP client
 * Call when shutting down the application
 */
export async function disconnectMcp() {
    await mcpClient.disconnect();
}

/**
 * Tool execution result
 */
export interface McpToolExecutionResult {
    success: boolean;
    toolName: string;
    result?: unknown;
    error?: string;
}

/**
 * Tool definition for external use (e.g., ElevenLabs webhook configuration)
 */
export interface McpToolDefinition {
    name: string;
    description: string;
    server: string;
    parameters: Record<string, unknown>;
}

/**
 * Execute an MCP tool directly by name
 *
 * Tool names can be in either format:
 * - Underscore: "serverName_toolName" (e.g., "hubspot_hubspot-get-user-details")
 * - Dot: "serverName.toolName" (e.g., "hubspot.hubspot-get-user-details")
 *
 * Use listMcpToolDefinitions() to get available tool names.
 *
 * @param toolName - The namespaced tool name
 * @param parameters - The parameters to pass to the tool
 * @returns The result of the tool execution
 */
export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
    }
): Promise<McpToolExecutionResult> {
    let resolvedToolName = toolName;
    try {
        if (options?.connectionId && !toolName.includes("_") && !toolName.includes(".")) {
            const connection = await prisma.integrationConnection.findUnique({
                where: { id: options.connectionId },
                include: { provider: true }
            });
            if (connection) {
                const serverId = resolveServerId(
                    connection.provider.key,
                    connection as ConnectionWithProvider,
                    connection.isDefault
                );
                resolvedToolName = `${serverId}_${toolName}`;
            }
        }

        const client = await getMcpClientForOrganization({
            organizationId: options?.organizationId,
            userId: options?.userId
        });
        const toolsets = await client.listToolsets();

        // Try multiple name formats to find the tool
        // listToolsets() uses dot notation: serverName.toolName
        // listTools() uses underscore: serverName_toolName
        const namesToTry = [
            resolvedToolName,
            resolvedToolName.replace("_", "."), // Convert underscore to dot (first occurrence only for server name)
            resolvedToolName.replace(".", "_") // Convert dot to underscore
        ];

        // For tools like "hubspot_hubspot-get-user-details", convert to "hubspot.hubspot-get-user-details"
        const parts = resolvedToolName.split("_");
        if (parts.length >= 2) {
            const serverName = parts[0];
            const restOfName = parts.slice(1).join("_");
            namesToTry.push(`${serverName}.${restOfName}`);
        }

        let tool = null;
        let matchedName = toolName;

        for (const name of namesToTry) {
            if (toolsets[name]) {
                tool = toolsets[name];
                matchedName = name;
                break;
            }
        }

        if (!tool) {
            const availableTools = Object.keys(toolsets).slice(0, 10).join(", ");
            return {
                success: false,
                toolName: resolvedToolName,
                error: `Tool not found: ${resolvedToolName}. First 10 available: ${availableTools}...`
            };
        }

        // Execute the tool - toolsets return Tool objects that are callable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (tool as any).execute({ context: parameters });

        if (options?.organizationId) {
            const serverName = matchedName.includes("_")
                ? matchedName.split("_")[0]
                : matchedName.split(".")[0];
            const now = new Date();
            if (serverName.includes("__")) {
                const [providerKey, idPrefix] = serverName.split("__");
                void prisma.integrationConnection
                    .updateMany({
                        where: {
                            organizationId: options.organizationId,
                            provider: { key: providerKey },
                            id: { startsWith: idPrefix },
                            isActive: true
                        },
                        data: { lastUsedAt: now }
                    })
                    .catch(() => undefined);
            } else {
                void prisma.integrationConnection
                    .updateMany({
                        where: {
                            organizationId: options.organizationId,
                            provider: { key: serverName },
                            isDefault: true,
                            isActive: true
                        },
                        data: { lastUsedAt: now }
                    })
                    .catch(() => undefined);
            }
        }

        return {
            success: true,
            toolName: matchedName,
            result
        };
    } catch (error) {
        return {
            success: false,
            toolName: resolvedToolName,
            error: error instanceof Error ? error.message : "Unknown error executing tool"
        };
    }
}

/**
 * List all available MCP tool definitions
 *
 * Returns tool metadata suitable for configuring external systems
 * like ElevenLabs webhook tools.
 */
export async function listMcpToolDefinitions(
    organizationIdOrOptions?:
        | string
        | null
        | { organizationId?: string | null; userId?: string | null }
): Promise<McpToolDefinition[]> {
    const options =
        organizationIdOrOptions && typeof organizationIdOrOptions === "object"
            ? organizationIdOrOptions
            : { organizationId: organizationIdOrOptions };
    const client = await getMcpClientForOrganization(options);
    const tools = await client.listTools();
    const definitions: McpToolDefinition[] = [];

    for (const [name, tool] of Object.entries(tools)) {
        // Parse server name from tool name (format: serverName_toolName)
        const parts = name.split("_");
        const serverName = parts[0];
        const toolName = parts.slice(1).join("_");

        // Type assertion for tool properties
        const toolDef = tool as {
            description?: string;
            inputSchema?: { shape?: Record<string, unknown> };
        };

        definitions.push({
            name,
            description: toolDef.description || `Tool: ${toolName}`,
            server: serverName,
            parameters: toolDef.inputSchema?.shape || {}
        });
    }

    return definitions;
}

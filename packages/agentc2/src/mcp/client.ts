import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { MCPClient, InternalMastraMCPClient, type MastraMCPServerDefinition } from "@mastra/mcp";
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
    var __mcpSchemaPatched: boolean | undefined;
}

/**
 * Patch InternalMastraMCPClient.convertInputSchema to sanitize MCP server
 * JSON schemas BEFORE they are converted to Zod. This fixes issues like
 * HubSpot's `values` array having no `items` definition.
 *
 * Must happen before any MCPClient is created.
 */
if (!global.__mcpSchemaPatched) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = InternalMastraMCPClient.prototype as any;
    const originalConvert = proto.convertInputSchema;
    proto.convertInputSchema = async function (inputSchema: unknown) {
        // Only sanitize raw JSON Schema objects (not Zod schemas)
        if (
            inputSchema &&
            typeof inputSchema === "object" &&
            !Array.isArray(inputSchema) &&
            !(inputSchema as Record<string, unknown>)._def // Not a Zod schema
        ) {
            inputSchema = sanitizeToolSchema(inputSchema);
        }
        return originalConvert.call(this, inputSchema);
    };
    global.__mcpSchemaPatched = true;
}

const ORG_MCP_CACHE_TTL = 60000;
/** Stale cache is used as fallback when fresh loading fails — 10 minutes */
const ORG_MCP_STALE_TTL = 600000;
const orgMcpClients = new Map<string, { client: MCPClient; loadedAt: number }>();

/** Cache for per-server tool-loading results (keyed by orgId or "__default__") */
const perServerToolsCache = new Map<
    string,
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: Record<string, any>;
        serverErrors: Record<string, string>;
        loadedAt: number;
    }
>();

/**
 * Last-known-good cache: stores successful tool loads per server so we can
 * fall back to stale tools when a server fails on reload.
 * Keyed by `${cacheKey}::${serverId}`.
 */
const lastKnownGoodTools = new Map<
    string,
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: Record<string, any>;
        loadedAt: number;
    }
>();

export function invalidateMcpCacheForOrg(organizationId: string) {
    for (const key of orgMcpClients.keys()) {
        if (key.startsWith(`${organizationId}:`)) {
            orgMcpClients.delete(key);
        }
    }
    for (const key of perServerToolsCache.keys()) {
        if (key === organizationId || key.startsWith(`${organizationId}:`)) {
            perServerToolsCache.delete(key);
        }
    }
}

export function resetMcpClients() {
    orgMcpClients.clear();
    perServerToolsCache.clear();
    lastKnownGoodTools.clear();
    global.mcpClient = undefined;
}

async function invalidateMcpToolsCache(organizationId?: string | null) {
    const { invalidateMcpToolsCacheForOrg } = await import("../tools/registry");
    invalidateMcpToolsCacheForOrg(organizationId);
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
    if (!key) {
        console.error(
            "[MCP] CREDENTIAL_ENCRYPTION_KEY is not set — cannot decrypt integration credentials. " +
                "MCP servers requiring credentials will fail to connect."
        );
        return {};
    }

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
        console.error(
            "[MCP] Failed to decrypt credentials — data may be corrupted or encryption key may have changed:",
            error
        );
        return {};
    }
};

const encryptCredentials = (value: Record<string, unknown> | null) => {
    if (!value || isEncryptedPayload(value)) return value;
    const key = getEncryptionKey();
    if (!key) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        __enc: "v1",
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64")
    };
};

type IntegrationProviderSeed = {
    key: string;
    name: string;
    description: string;
    category: IntegrationProvider["category"];
    authType: IntegrationProvider["authType"];
    providerType: IntegrationProvider["providerType"];
    maturityLevel?: "internal";
    configJson?: Prisma.InputJsonValue;
    actionsJson?: Prisma.InputJsonValue;
    triggersJson?: Prisma.InputJsonValue;
};

type McpJsonServerConfig = {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
};

type McpJsonConfigFile = {
    mcpServers: Record<string, McpJsonServerConfig>;
};

export type McpConfigImpactAgent = {
    id: string;
    slug: string;
    name: string;
    toolCount: number;
    reason: "explicit" | "mcpEnabled";
};

export type McpConfigImpactServer = {
    serverKey: string;
    serverName: string;
    affectedAgents: McpConfigImpactAgent[];
};

export type McpConfigImpact = {
    serversToDisable: McpConfigImpactServer[];
    serversToAdd: string[];
    serversToUpdate: string[];
    totalAffectedAgents: number;
    hasImpact: boolean;
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
        key: "youtube-transcript",
        name: "YouTube Transcript",
        description:
            "Extract transcripts and captions from YouTube videos with language selection and ad filtering",
        category: "knowledge",
        authType: "none",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["YouTube Transcript", "youtube-transcript", "YouTube"],
                matchArgs: [
                    "@kimtaeyoon83/mcp-server-youtube-transcript",
                    "mcp-server-youtube-transcript"
                ]
            }
        }
    },
    {
        key: "supadata",
        name: "Supadata",
        description:
            "YouTube transcript extraction API — reliably fetches transcripts and captions from YouTube videos with AI fallback for videos without native captions",
        category: "knowledge",
        authType: "apiKey",
        providerType: "custom",
        configJson: {
            requiredFields: ["SUPADATA_API_KEY"],
            fieldDefinitions: {
                SUPADATA_API_KEY: {
                    label: "Supadata API key",
                    description: "Get your API key at https://dash.supadata.ai",
                    placeholder: "sd_...",
                    type: "password"
                }
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
            hostedMcpUrl: "https://mcp.hubspot.com",
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
            hostedMcpUrl: "https://mcp.atlassian.com/v1/mcp",
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
        key: "appello",
        name: "Appello",
        description:
            "Construction & field service management - jobs, projects, scheduling, timesheets, safety, equipment, financials",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["APPELLO_API_TOKEN"],
            fieldDefinitions: {
                APPELLO_API_TOKEN: {
                    label: "Appello MCP JWT token",
                    description: "Bearer token for the Appello MCP API",
                    placeholder: "eyJhbGci...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Appello", "appello"],
                matchUrls: ["release-api.useappello.app/mcp", "api.useappello.app/mcp"],
                headerAliases: {
                    Authorization: "APPELLO_API_TOKEN"
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
        description:
            "n8n MCP server (workflow automation). Name and description can be set from your n8n workflow or MCP config.",
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
    // Google Drive MCP server deprecated — replaced by native OAuth tools
    // (google-drive-search-files, google-drive-read-file, google-drive-create-doc)
    // which use the same Google OAuth credentials as Gmail/Calendar.
    {
        key: "github",
        name: "GitHub",
        description: "Repository management - issues, PRs, code, and actions",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://api.githubcopilot.com/mcp/",
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
            requiredScopes: ["https://www.googleapis.com/auth/gmail.modify"],
            oauthConfig: {
                socialProvider: "google",
                scopes: ["https://www.googleapis.com/auth/gmail.modify"],
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
        },
        actionsJson: {
            actions: [
                {
                    key: "gmail-archive-email",
                    description: "Archive a Gmail email by removing it from the inbox"
                }
            ]
        }
    },
    {
        key: "google-calendar",
        name: "Google Calendar",
        description: "Calendar events — list, create, update, and delete via Google Calendar API",
        category: "productivity",
        authType: "oauth",
        providerType: "oauth",
        configJson: {
            requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
            oauthConfig: {
                socialProvider: "google",
                scopes: ["https://www.googleapis.com/auth/calendar.events"],
                siblingOf: "gmail"
            },
            setupUrl: "/mcp/gmail",
            setupLabel: "Connect via Google Sign-In"
        }
    },
    {
        key: "google-drive",
        name: "Google Drive",
        description: "File storage — search, read, and create documents via Google Drive API",
        category: "productivity",
        authType: "oauth",
        providerType: "oauth",
        configJson: {
            requiredScopes: [
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/drive.file"
            ],
            oauthConfig: {
                socialProvider: "google",
                scopes: [
                    "https://www.googleapis.com/auth/drive.readonly",
                    "https://www.googleapis.com/auth/drive.file"
                ],
                siblingOf: "gmail"
            },
            setupUrl: "/mcp/gmail",
            setupLabel: "Connect via Google Sign-In"
        }
    },
    {
        key: "microsoft",
        name: "Microsoft (Outlook)",
        description:
            "Outlook Mail and Calendar via Microsoft Graph — send/read email, manage calendar events",
        category: "communication",
        authType: "oauth",
        providerType: "oauth",
        configJson: {
            requiredScopes: [
                "Mail.Read",
                "Mail.ReadWrite",
                "Mail.Send",
                "Calendars.Read",
                "Calendars.ReadWrite",
                "offline_access",
                "User.Read"
            ],
            oauthConfig: {
                socialProvider: "microsoft",
                scopes: [
                    "Mail.Read",
                    "Mail.ReadWrite",
                    "Mail.Send",
                    "Calendars.Read",
                    "Calendars.ReadWrite",
                    "offline_access",
                    "User.Read"
                ],
                authorizationEndpoint:
                    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                statusEndpoint: "/api/integrations/microsoft/status",
                startEndpoint: "/api/integrations/microsoft/start",
                callbackEndpoint: "/api/integrations/microsoft/callback"
            },
            setupUrl: "/mcp/microsoft",
            setupLabel: "Connect via Microsoft Sign-In"
        },
        triggersJson: {
            triggers: [
                {
                    key: "microsoft.mail.received",
                    description: "New email received in Outlook inbox"
                },
                {
                    key: "microsoft.calendar.event.created",
                    description: "New calendar event created"
                },
                {
                    key: "microsoft.calendar.event.updated",
                    description: "Calendar event updated"
                }
            ]
        },
        actionsJson: {
            actions: [
                {
                    key: "outlook-mail-send-email",
                    description: "Send an email via Outlook"
                },
                {
                    key: "outlook-mail-archive-email",
                    description: "Archive an Outlook email (move to Archive folder)"
                },
                {
                    key: "outlook-mail-list-emails",
                    description: "List recent emails from Outlook inbox"
                },
                {
                    key: "outlook-mail-get-email",
                    description: "Get a specific Outlook email by ID"
                },
                {
                    key: "outlook-calendar-list-events",
                    description: "List upcoming calendar events"
                },
                {
                    key: "outlook-calendar-get-event",
                    description: "Get a specific calendar event by ID"
                },
                {
                    key: "outlook-calendar-create-event",
                    description: "Create a new calendar event"
                },
                {
                    key: "outlook-calendar-update-event",
                    description: "Update an existing calendar event"
                }
            ]
        }
    },
    {
        key: "microsoft-teams",
        name: "Microsoft Teams",
        description:
            "Team collaboration — list teams and channels, send messages, manage chats via Microsoft Graph",
        category: "communication",
        authType: "oauth",
        providerType: "oauth",
        configJson: {
            requiredScopes: [
                "Team.ReadBasic.All",
                "Channel.ReadBasic.All",
                "ChannelMessage.Send",
                "Chat.ReadWrite",
                "User.Read"
            ],
            oauthConfig: {
                socialProvider: "microsoft",
                scopes: [
                    "Team.ReadBasic.All",
                    "Channel.ReadBasic.All",
                    "ChannelMessage.Send",
                    "Chat.ReadWrite"
                ],
                siblingOf: "microsoft"
            },
            setupUrl: "/mcp/microsoft",
            setupLabel: "Connect via Microsoft Sign-In"
        },
        actionsJson: {
            actions: [
                {
                    key: "teams-list-teams",
                    description: "List teams the user is a member of"
                },
                {
                    key: "teams-list-channels",
                    description: "List channels in a team"
                },
                {
                    key: "teams-send-channel-message",
                    description: "Send a message to a Teams channel"
                },
                {
                    key: "teams-list-chats",
                    description: "List recent 1:1 and group chats"
                },
                {
                    key: "teams-send-chat-message",
                    description: "Send a message in a Teams chat"
                }
            ]
        }
    },
    {
        key: "dropbox",
        name: "Dropbox",
        description: "File storage — list, read, upload, search, and share files via Dropbox",
        category: "productivity",
        authType: "oauth",
        providerType: "oauth",
        configJson: {
            requiredScopes: [
                "files.metadata.read",
                "files.content.read",
                "files.content.write",
                "sharing.read"
            ],
            oauthConfig: {
                provider: "dropbox",
                scopes: [
                    "files.metadata.read",
                    "files.content.read",
                    "files.content.write",
                    "sharing.read"
                ],
                authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
                tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
                statusEndpoint: "/api/integrations/dropbox/status",
                startEndpoint: "/api/integrations/dropbox/start",
                callbackEndpoint: "/api/integrations/dropbox/callback"
            },
            setupUrl: "/mcp/dropbox",
            setupLabel: "Connect Dropbox Account"
        },
        triggersJson: {
            triggers: [
                {
                    key: "dropbox.file.changed",
                    description: "File or folder changed in Dropbox"
                }
            ]
        },
        actionsJson: {
            actions: [
                {
                    key: "dropbox-list-files",
                    description: "List files and folders in a Dropbox path"
                },
                {
                    key: "dropbox-get-file",
                    description: "Download or read a file from Dropbox"
                },
                {
                    key: "dropbox-upload-file",
                    description: "Upload a file to Dropbox"
                },
                {
                    key: "dropbox-search-files",
                    description: "Search for files in Dropbox"
                },
                {
                    key: "dropbox-get-sharing-links",
                    description: "Get sharing links for a Dropbox file"
                }
            ]
        }
    },
    // ── New Platform Integrations (hosted MCP / marketplace) ────────────
    {
        key: "linear",
        name: "Linear",
        description: "Issue tracking and project management — issues, projects, teams, sprints",
        category: "productivity",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.linear.app/mcp",
            importHints: {
                matchNames: ["Linear", "linear"]
            }
        }
    },
    {
        key: "notion",
        name: "Notion",
        description: "Workspace wiki and databases — pages, databases, search, create",
        category: "productivity",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.notion.com/mcp",
            importHints: {
                matchNames: ["Notion", "notion"]
            }
        }
    },
    {
        key: "asana",
        name: "Asana",
        description: "Work management — tasks, projects, portfolios, reporting",
        category: "productivity",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.asana.com/v2/mcp",
            importHints: {
                matchNames: ["Asana", "asana"]
            }
        }
    },
    {
        key: "monday",
        name: "Monday.com",
        description: "Work OS — boards, items, CRM activities, automations",
        category: "productivity",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.monday.com/mcp",
            importHints: {
                matchNames: ["Monday", "monday", "monday.com"]
            }
        }
    },
    {
        key: "airtable",
        name: "Airtable",
        description: "Flexible databases — bases, tables, records, search and analysis",
        category: "data",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["Airtable", "airtable"]
            }
        }
    },
    {
        key: "stripe",
        name: "Stripe",
        description: "Payments and billing — customers, subscriptions, invoices, checkout",
        category: "payments",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.stripe.com",
            requiredFields: ["STRIPE_API_KEY"],
            fieldDefinitions: {
                STRIPE_API_KEY: {
                    label: "Stripe secret key",
                    description: "From Stripe Dashboard > Developers > API keys",
                    placeholder: "sk_live_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Stripe", "stripe"],
                envAliases: {
                    STRIPE_API_KEY: "STRIPE_API_KEY"
                }
            }
        }
    },
    {
        key: "shopify",
        name: "Shopify",
        description: "E-commerce — orders, products, customers, inventory management",
        category: "ecommerce",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["SHOPIFY_ACCESS_TOKEN", "SHOPIFY_STORE_URL"],
            fieldDefinitions: {
                SHOPIFY_ACCESS_TOKEN: {
                    label: "Shopify access token",
                    description: "Admin API access token from your Shopify custom app",
                    placeholder: "shpat_...",
                    type: "password"
                },
                SHOPIFY_STORE_URL: {
                    label: "Store URL",
                    description: "Your Shopify store URL",
                    placeholder: "https://your-store.myshopify.com",
                    type: "url"
                }
            },
            importHints: {
                matchNames: ["Shopify", "shopify"],
                envAliases: {
                    SHOPIFY_ACCESS_TOKEN: "SHOPIFY_ACCESS_TOKEN",
                    SHOPIFY_STORE_URL: "SHOPIFY_STORE_URL"
                }
            }
        }
    },
    {
        key: "salesforce",
        name: "Salesforce",
        description: "CRM platform — contacts, accounts, opportunities, reports",
        category: "crm",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["Salesforce", "salesforce"]
            }
        }
    },
    {
        key: "intercom",
        name: "Intercom",
        description: "Customer messaging — conversations, contacts, help center search",
        category: "support",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["Intercom", "intercom"]
            }
        }
    },
    {
        key: "confluence",
        name: "Confluence",
        description: "Team wiki and documentation — pages, spaces, search across knowledge base",
        category: "knowledge",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.atlassian.com/v1/mcp",
            requiredFields: ["CONFLUENCE_URL", "CONFLUENCE_USERNAME", "CONFLUENCE_API_TOKEN"],
            fieldDefinitions: {
                CONFLUENCE_URL: {
                    label: "Confluence base URL",
                    description: "Your Atlassian Cloud URL (e.g. https://your-org.atlassian.net)",
                    placeholder: "https://your-org.atlassian.net",
                    type: "url"
                },
                CONFLUENCE_USERNAME: {
                    label: "Username (email)",
                    description: "Same email used for your Atlassian API token",
                    placeholder: "email@example.com"
                },
                CONFLUENCE_API_TOKEN: {
                    label: "API token",
                    description: "Atlassian API token (can be the same as Jira)",
                    placeholder: "ATATT3x...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Confluence", "confluence"],
                matchArgs: ["mcp-atlassian"],
                envAliases: {
                    CONFLUENCE_URL: "CONFLUENCE_URL",
                    CONFLUENCE_USERNAME: "CONFLUENCE_USERNAME",
                    CONFLUENCE_API_TOKEN: "CONFLUENCE_API_TOKEN"
                }
            }
        }
    },
    {
        key: "figma",
        name: "Figma",
        description: "Design tool — files, components, styles, design tokens and data",
        category: "design",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.figma.com/mcp",
            requiredFields: ["FIGMA_ACCESS_TOKEN"],
            fieldDefinitions: {
                FIGMA_ACCESS_TOKEN: {
                    label: "Figma personal access token",
                    description: "From Figma Settings > Account > Personal Access Tokens",
                    placeholder: "figd_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Figma", "figma"],
                envAliases: {
                    FIGMA_ACCESS_TOKEN: "FIGMA_ACCESS_TOKEN"
                }
            }
        }
    },

    // ── Additional Remote MCP Providers ─────────────────────────────────
    {
        key: "zapier",
        name: "Zapier",
        description: "Workflow automation — connect 8000+ apps, trigger workflows, manage Zaps",
        category: "automation",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://actions.zapier.com/mcp/",
            importHints: {
                matchNames: ["Zapier", "zapier"]
            }
        }
    },
    {
        key: "webflow",
        name: "Webflow",
        description: "Web design and CMS — sites, collections, items, forms, and design data",
        category: "marketing",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.webflow.com",
            importHints: {
                matchNames: ["Webflow", "webflow"]
            }
        }
    },
    {
        key: "sentry",
        name: "Sentry",
        description: "Error monitoring — issues, events, releases, and performance data",
        category: "developer",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.sentry.dev/sse",
            importHints: {
                matchNames: ["Sentry", "sentry"]
            }
        }
    },
    {
        key: "vercel",
        name: "Vercel",
        description: "Deployment platform — projects, deployments, domains, and team management",
        category: "developer",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://vercel.com/api/mcp",
            importHints: {
                matchNames: ["Vercel", "vercel"]
            }
        }
    },
    {
        key: "supabase",
        name: "Supabase",
        description: "Managed Postgres — databases, queries, migrations, and project management",
        category: "developer",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.supabase.com",
            requiredFields: ["SUPABASE_ACCESS_TOKEN"],
            fieldDefinitions: {
                SUPABASE_ACCESS_TOKEN: {
                    label: "Supabase access token",
                    description: "From Supabase Dashboard > Account Settings > Access Tokens",
                    placeholder: "sbp_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Supabase", "supabase"]
            }
        }
    },
    {
        key: "cloudflare",
        name: "Cloudflare",
        description: "Edge platform — DNS, Workers, KV, R2 storage, and security settings",
        category: "developer",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["CLOUDFLARE_API_TOKEN"],
            fieldDefinitions: {
                CLOUDFLARE_API_TOKEN: {
                    label: "Cloudflare API token",
                    description: "From Cloudflare Dashboard > API Tokens",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Cloudflare", "cloudflare"]
            }
        }
    },
    {
        key: "neon",
        name: "Neon",
        description: "Serverless Postgres — databases, branches, queries, and compute management",
        category: "developer",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.neon.tech",
            requiredFields: ["NEON_API_KEY"],
            fieldDefinitions: {
                NEON_API_KEY: {
                    label: "Neon API key",
                    description: "From Neon Console > Account > API Keys",
                    placeholder: "neon_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Neon", "neon"]
            }
        }
    },
    {
        key: "cursor",
        name: "Cursor Cloud Agent",
        description:
            "Autonomous coding agent — launch cloud agents to write code, fix bugs, and create PRs on GitHub repositories",
        category: "developer",
        authType: "apiKey",
        providerType: "custom",
        configJson: {
            requiredFields: ["CURSOR_API_KEY"],
            fieldDefinitions: {
                CURSOR_API_KEY: {
                    label: "Cursor API key",
                    description:
                        "Get from Cursor Dashboard > Integrations (cursor.com/dashboard?tab=integrations)",
                    placeholder: "cur_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Cursor", "cursor"],
                envAliases: {
                    CURSOR_API_KEY: "CURSOR_API_KEY"
                }
            }
        }
    },
    {
        key: "netlify",
        name: "Netlify",
        description: "Web deployment — sites, deploys, forms, functions, and DNS management",
        category: "developer",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["NETLIFY_ACCESS_TOKEN"],
            fieldDefinitions: {
                NETLIFY_ACCESS_TOKEN: {
                    label: "Netlify personal access token",
                    description: "From Netlify User Settings > Applications",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Netlify", "netlify"]
            }
        }
    },
    {
        key: "buildkite",
        name: "Buildkite",
        description: "CI/CD platform — pipelines, builds, agents, and artifact management",
        category: "developer",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["BUILDKITE_API_TOKEN"],
            fieldDefinitions: {
                BUILDKITE_API_TOKEN: {
                    label: "Buildkite API token",
                    description: "From Buildkite Settings > API Access Tokens",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Buildkite", "buildkite"]
            }
        }
    },
    {
        key: "paypal",
        name: "PayPal",
        description: "Payments — transactions, invoices, disputes, and payout management",
        category: "payments",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
            fieldDefinitions: {
                PAYPAL_CLIENT_ID: {
                    label: "PayPal client ID",
                    description: "From PayPal Developer Dashboard",
                    placeholder: ""
                },
                PAYPAL_CLIENT_SECRET: {
                    label: "PayPal client secret",
                    description: "From PayPal Developer Dashboard",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["PayPal", "paypal"]
            }
        }
    },
    {
        key: "square",
        name: "Square",
        description: "Commerce platform — payments, orders, items, customers, and inventory",
        category: "payments",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["SQUARE_ACCESS_TOKEN"],
            fieldDefinitions: {
                SQUARE_ACCESS_TOKEN: {
                    label: "Square access token",
                    description: "From Square Developer Dashboard",
                    placeholder: "EAA...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Square", "square"]
            }
        }
    },
    {
        key: "plaid",
        name: "Plaid",
        description: "Financial data — bank accounts, transactions, balances, and identity",
        category: "payments",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["PLAID_CLIENT_ID", "PLAID_SECRET"],
            fieldDefinitions: {
                PLAID_CLIENT_ID: {
                    label: "Plaid client ID",
                    description: "From Plaid Dashboard > Team Settings",
                    placeholder: ""
                },
                PLAID_SECRET: {
                    label: "Plaid secret",
                    description: "From Plaid Dashboard > Team Settings",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Plaid", "plaid"]
            }
        }
    },
    {
        key: "ramp",
        name: "Ramp",
        description: "Corporate spend — cards, expenses, reimbursements, and accounting sync",
        category: "payments",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["RAMP_API_KEY"],
            fieldDefinitions: {
                RAMP_API_KEY: {
                    label: "Ramp API key",
                    description: "From Ramp Developer Settings",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Ramp", "ramp"]
            }
        }
    },
    {
        key: "close-crm",
        name: "Close CRM",
        description: "Sales CRM — leads, contacts, opportunities, activities, and pipeline",
        category: "crm",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["CLOSE_API_KEY"],
            fieldDefinitions: {
                CLOSE_API_KEY: {
                    label: "Close API key",
                    description: "From Close Settings > API Keys",
                    placeholder: "api_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Close", "close", "Close CRM"]
            }
        }
    },
    {
        key: "fireflies",
        name: "Fireflies.ai",
        description: "Meeting intelligence — transcripts, summaries, action items, and search",
        category: "communication",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["FIREFLIES_API_KEY"],
            fieldDefinitions: {
                FIREFLIES_API_KEY: {
                    label: "Fireflies API key",
                    description: "From Fireflies.ai Settings > API & Integrations",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Fireflies", "fireflies"]
            }
        }
    },
    {
        key: "canva",
        name: "Canva",
        description: "Design platform — templates, designs, brand assets, and team content",
        category: "design",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["Canva", "canva"]
            }
        }
    },
    {
        key: "cloudinary",
        name: "Cloudinary",
        description: "Media management — images, videos, transformations, and CDN delivery",
        category: "design",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["CLOUDINARY_URL"],
            fieldDefinitions: {
                CLOUDINARY_URL: {
                    label: "Cloudinary URL",
                    description: "From Cloudinary Console > Dashboard (cloudinary://...)",
                    placeholder: "cloudinary://...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Cloudinary", "cloudinary"]
            }
        }
    },
    {
        key: "ahrefs",
        name: "Ahrefs",
        description: "SEO platform — backlinks, keywords, rank tracking, site audits",
        category: "marketing",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.ahrefs.com/mcp",
            requiredFields: ["AHREFS_API_KEY"],
            fieldDefinitions: {
                AHREFS_API_KEY: {
                    label: "Ahrefs API key",
                    description: "From Ahrefs Account > API",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Ahrefs", "ahrefs"]
            }
        }
    },
    {
        key: "semrush",
        name: "Semrush",
        description: "Digital marketing — keyword research, competitive analysis, SEO audits",
        category: "marketing",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["SEMRUSH_API_KEY"],
            fieldDefinitions: {
                SEMRUSH_API_KEY: {
                    label: "Semrush API key",
                    description: "From Semrush > Subscription Info",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Semrush", "semrush"]
            }
        }
    },
    {
        key: "wix",
        name: "Wix",
        description: "Website builder — sites, CMS collections, forms, and member management",
        category: "marketing",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["WIX_API_KEY"],
            fieldDefinitions: {
                WIX_API_KEY: {
                    label: "Wix API key",
                    description: "From Wix Developers > API Keys",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Wix", "wix"]
            }
        }
    },
    {
        key: "google-bigquery",
        name: "Google BigQuery",
        description: "Data warehouse — SQL queries, datasets, tables, and analytics",
        category: "data",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.googleapis.com/v1/bigquery",
            importHints: {
                matchNames: ["BigQuery", "bigquery"]
            }
        }
    },
    {
        key: "google-maps",
        name: "Google Maps",
        description: "Location services — geocoding, places, directions, and distance calculations",
        category: "data",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["GOOGLE_MAPS_API_KEY"],
            fieldDefinitions: {
                GOOGLE_MAPS_API_KEY: {
                    label: "Google Maps API key",
                    description: "From Google Cloud Console > APIs & Services",
                    placeholder: "AIza...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Google Maps", "google-maps"]
            }
        }
    },
    {
        key: "apify",
        name: "Apify",
        description: "Web scraping platform — actors, crawlers, datasets, and data extraction",
        category: "data",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://actors-mcp-server.apify.actor/mcp",
            requiredFields: ["APIFY_TOKEN"],
            fieldDefinitions: {
                APIFY_TOKEN: {
                    label: "Apify API token",
                    description: "From Apify Console > Settings > Integrations",
                    placeholder: "apify_api_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Apify", "apify"]
            }
        }
    },
    {
        key: "box",
        name: "Box",
        description: "Enterprise content — files, folders, sharing, workflows, and collaboration",
        category: "data",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["Box", "box"]
            }
        }
    },
    {
        key: "atlassian",
        name: "Atlassian (Rovo)",
        description:
            "Unified Atlassian access — cross-product search, Jira, Confluence via Rovo MCP",
        category: "productivity",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://mcp.atlassian.com/v1/mcp",
            importHints: {
                matchNames: ["Atlassian", "atlassian", "Rovo"]
            }
        }
    },
    {
        key: "clickup",
        name: "ClickUp",
        description: "Project management — tasks, docs, goals, dashboards, and time tracking",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["CLICKUP_API_TOKEN"],
            fieldDefinitions: {
                CLICKUP_API_TOKEN: {
                    label: "ClickUp personal API token",
                    description: "From ClickUp Settings > Apps > API Token",
                    placeholder: "pk_...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["ClickUp", "clickup"]
            }
        }
    },
    {
        key: "pipedrive",
        name: "Pipedrive",
        description: "Sales CRM — deals, contacts, organizations, activities, and pipeline",
        category: "crm",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["PIPEDRIVE_API_TOKEN"],
            fieldDefinitions: {
                PIPEDRIVE_API_TOKEN: {
                    label: "Pipedrive API token",
                    description: "From Pipedrive Settings > Personal preferences > API",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Pipedrive", "pipedrive"]
            }
        }
    },
    {
        key: "zendesk",
        name: "Zendesk",
        description: "Customer support — tickets, users, organizations, help center articles",
        category: "support",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["ZENDESK_URL", "ZENDESK_EMAIL", "ZENDESK_API_TOKEN"],
            fieldDefinitions: {
                ZENDESK_URL: {
                    label: "Zendesk subdomain URL",
                    description: "Your Zendesk URL (e.g. https://company.zendesk.com)",
                    placeholder: "https://company.zendesk.com",
                    type: "url"
                },
                ZENDESK_EMAIL: {
                    label: "Agent email",
                    description: "Email of the Zendesk agent for API access",
                    placeholder: "agent@company.com"
                },
                ZENDESK_API_TOKEN: {
                    label: "API token",
                    description: "From Zendesk Admin > Channels > API",
                    placeholder: "",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Zendesk", "zendesk"]
            }
        }
    },
    {
        key: "calendly",
        name: "Calendly",
        description: "Scheduling — events, event types, invitees, availability, and routing",
        category: "productivity",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["CALENDLY_API_KEY"],
            fieldDefinitions: {
                CALENDLY_API_KEY: {
                    label: "Calendly personal access token",
                    description: "From Calendly Integrations > API & Webhooks",
                    placeholder: "eyJ...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Calendly", "calendly"]
            }
        }
    },
    {
        key: "docusign",
        name: "DocuSign",
        description: "E-signatures — envelopes, templates, recipients, and signing workflows",
        category: "productivity",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            importHints: {
                matchNames: ["DocuSign", "docusign"]
            }
        }
    },
    {
        key: "make",
        name: "Make",
        description:
            "Visual workflow automation — scenarios, modules, connections, and data stores",
        category: "automation",
        authType: "oauth",
        providerType: "mcp",
        configJson: {
            hostedMcpUrl: "https://us.make.com/mcp/sse",
            importHints: {
                matchNames: ["Make", "make", "Integromat"]
            }
        }
    },

    {
        key: "webhook",
        name: "Incoming Webhook",
        description: "Webhook connections that trigger agents via the unified trigger system",
        category: "automation",
        authType: "webhook",
        providerType: "webhook",
        maturityLevel: "internal"
    },

    // ── AI Model Providers ─────────────────────────────────────────────
    {
        key: "openai",
        name: "OpenAI",
        description: "GPT-4.1, GPT-4o, o3/o4-mini reasoning, and text embeddings",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["OPENAI_API_KEY"],
            fieldDefinitions: {
                OPENAI_API_KEY: {
                    label: "OpenAI API Key",
                    description: "Create at https://platform.openai.com/api-keys",
                    placeholder: "sk-...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "anthropic",
        name: "Anthropic",
        description: "Claude 4.5, Claude 4, Claude 3.5, and Claude 3 models",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["ANTHROPIC_API_KEY"],
            fieldDefinitions: {
                ANTHROPIC_API_KEY: {
                    label: "Anthropic API Key",
                    description: "Create at https://console.anthropic.com/settings/keys",
                    placeholder: "sk-ant-...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "google",
        name: "Google (Gemini)",
        description: "Gemini 2.5 Pro/Flash, Gemini 2.0 Flash, and other Google AI models",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["GOOGLE_GENERATIVE_AI_API_KEY"],
            fieldDefinitions: {
                GOOGLE_GENERATIVE_AI_API_KEY: {
                    label: "Google AI API Key",
                    description: "Create at https://aistudio.google.com/apikey",
                    placeholder: "AIza...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "groq",
        name: "Groq",
        description:
            "Ultra-fast inference for open-source models — Llama, Mixtral, Gemma. Free tier available.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["GROQ_API_KEY"],
            fieldDefinitions: {
                GROQ_API_KEY: {
                    label: "Groq API Key",
                    description: "Create free at https://console.groq.com/keys",
                    placeholder: "gsk_...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "deepseek",
        name: "DeepSeek",
        description:
            "Extremely affordable models with strong coding and reasoning — DeepSeek V3 and R1.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["DEEPSEEK_API_KEY"],
            fieldDefinitions: {
                DEEPSEEK_API_KEY: {
                    label: "DeepSeek API Key",
                    description: "Create at https://platform.deepseek.com/api_keys",
                    placeholder: "sk-...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "mistral",
        name: "Mistral",
        description: "European AI models — Mistral Large, Codestral, Mistral Small, and open Nemo.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["MISTRAL_API_KEY"],
            fieldDefinitions: {
                MISTRAL_API_KEY: {
                    label: "Mistral API Key",
                    description: "Create at https://console.mistral.ai/api-keys",
                    placeholder: "",
                    type: "password"
                }
            }
        }
    },
    {
        key: "xai",
        name: "xAI (Grok)",
        description: "Grok 3, Grok 3 Mini, and Grok 2 — with vision and function calling.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["XAI_API_KEY"],
            fieldDefinitions: {
                XAI_API_KEY: {
                    label: "xAI API Key",
                    description: "Create at https://console.x.ai",
                    placeholder: "xai-...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "togetherai",
        name: "Together AI",
        description:
            "200+ open-source models — Llama, DeepSeek, Qwen, Mixtral at competitive pricing.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["TOGETHER_AI_API_KEY"],
            fieldDefinitions: {
                TOGETHER_AI_API_KEY: {
                    label: "Together AI API Key",
                    description: "Create at https://api.together.ai/settings/api-keys",
                    placeholder: "",
                    type: "password"
                }
            }
        }
    },
    {
        key: "fireworks",
        name: "Fireworks AI",
        description: "Fast open-source model inference — Llama, DeepSeek, Qwen at low cost.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["FIREWORKS_API_KEY"],
            fieldDefinitions: {
                FIREWORKS_API_KEY: {
                    label: "Fireworks API Key",
                    description: "Create at https://fireworks.ai/account/api-keys",
                    placeholder: "",
                    type: "password"
                }
            }
        }
    },
    {
        key: "openrouter",
        name: "OpenRouter",
        description: "Access 300+ models through one API. Many FREE models available ($0/token).",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["OPENROUTER_API_KEY"],
            fieldDefinitions: {
                OPENROUTER_API_KEY: {
                    label: "OpenRouter API Key",
                    description:
                        "Create free at https://openrouter.ai/keys — free models available",
                    placeholder: "sk-or-...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "kimi",
        name: "Kimi (Moonshot)",
        description:
            "Kimi K2.5 and K2 — large MoE models with strong agentic and coding capabilities.",
        category: "ai",
        authType: "apiKey",
        providerType: "ai-model",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["MOONSHOT_API_KEY"],
            fieldDefinitions: {
                MOONSHOT_API_KEY: {
                    label: "Moonshot API Key",
                    description: "Create at https://platform.moonshot.cn/console/api-keys",
                    placeholder: "sk-...",
                    type: "password"
                }
            }
        }
    },

    // ── Channel Integrations (voice / messaging) ──────────────────────
    {
        key: "twilio-voice",
        name: "Twilio Voice",
        description: "Phone call integration with speech recognition and TTS",
        category: "communication",
        authType: "apiKey",
        providerType: "custom",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
            fieldDefinitions: {
                TWILIO_ACCOUNT_SID: {
                    label: "Account SID",
                    description: "Found on the Twilio Console dashboard",
                    placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                },
                TWILIO_AUTH_TOKEN: {
                    label: "Auth Token",
                    description: "Found on the Twilio Console dashboard",
                    placeholder: "your_auth_token",
                    type: "password"
                },
                TWILIO_PHONE_NUMBER: {
                    label: "Phone Number",
                    description: "Twilio phone number in E.164 format",
                    placeholder: "+15551234567"
                },
                VOICE_TTS_PROVIDER: {
                    label: "TTS Provider (optional)",
                    description: "Text-to-speech provider: twilio, elevenlabs, or openai",
                    placeholder: "twilio"
                },
                VOICE_DEFAULT_AGENT_SLUG: {
                    label: "Default Agent Slug (optional)",
                    description: "Agent to handle voice calls",
                    placeholder: "mcp-agent"
                }
            }
        }
    },
    {
        key: "elevenlabs",
        name: "ElevenLabs",
        description: "Conversational AI agents, premium text-to-speech, and webhook tools",
        category: "communication",
        authType: "apiKey",
        providerType: "custom",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["ELEVENLABS_API_KEY"],
            fieldDefinitions: {
                ELEVENLABS_API_KEY: {
                    label: "API Key",
                    description: "From the ElevenLabs dashboard > Profile + API Key",
                    placeholder: "sk_...",
                    type: "password"
                },
                ELEVENLABS_AGENT_ID: {
                    label: "Agent ID (optional)",
                    description: "Default conversational agent ID",
                    placeholder: "agent_..."
                },
                ELEVENLABS_WEBHOOK_SECRET: {
                    label: "Webhook Secret (optional)",
                    description: "Secret for authenticating webhook calls from ElevenLabs",
                    placeholder: "wsec_...",
                    type: "password"
                },
                ELEVENLABS_MCP_WEBHOOK_URL: {
                    label: "MCP Webhook URL (optional)",
                    description: "Public URL for MCP tool webhooks (via ngrok)",
                    placeholder: "https://your-domain.ngrok-free.dev/api/demos/live-agent-mcp/tools"
                }
            }
        }
    },
    {
        key: "telegram-bot",
        name: "Telegram Bot",
        description: "Telegram Bot API for messaging and group chat",
        category: "communication",
        authType: "apiKey",
        providerType: "custom",
        maturityLevel: "internal",
        configJson: {
            requiredFields: ["TELEGRAM_BOT_TOKEN"],
            fieldDefinitions: {
                TELEGRAM_BOT_TOKEN: {
                    label: "Bot Token",
                    description: "Obtain from @BotFather on Telegram",
                    placeholder: "7123456789:AAH...",
                    type: "password"
                },
                TELEGRAM_WEBHOOK_SECRET: {
                    label: "Webhook Secret (optional)",
                    description: "Secret for verifying webhook requests",
                    placeholder: "your_secret",
                    type: "password"
                },
                TELEGRAM_DEFAULT_AGENT_SLUG: {
                    label: "Default Agent Slug (optional)",
                    description: "Agent to handle Telegram messages",
                    placeholder: "mcp-agent"
                }
            }
        }
    },
    {
        key: "whatsapp-web",
        name: "WhatsApp Web",
        description: "WhatsApp integration via Baileys (QR code pairing, no API key required)",
        category: "communication",
        authType: "none",
        providerType: "custom",
        maturityLevel: "internal",
        configJson: {
            requiredFields: [],
            fieldDefinitions: {
                WHATSAPP_ALLOWLIST: {
                    label: "Phone Number Allowlist (optional)",
                    description: "Comma-separated phone numbers allowed to message",
                    placeholder: "+15551234567,+15559876543"
                },
                WHATSAPP_DEFAULT_AGENT_SLUG: {
                    label: "Default Agent Slug (optional)",
                    description: "Agent to handle WhatsApp messages",
                    placeholder: "mcp-agent"
                },
                WHATSAPP_SESSION_PATH: {
                    label: "Session Path (optional)",
                    description: "Path for storing the Baileys session",
                    placeholder: "./.whatsapp-session"
                }
            },
            setupUrl: "/api/channels/whatsapp/qr",
            setupLabel: "Scan QR Code"
        }
    },
    {
        key: "digitalocean",
        name: "DigitalOcean",
        description:
            "Cloud infrastructure — create and manage Droplets, databases, domains, and networking via doctl CLI in the agent sandbox",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "custom",
        configJson: {
            requiredFields: ["DIGITALOCEAN_ACCESS_TOKEN"],
            fieldDefinitions: {
                DIGITALOCEAN_ACCESS_TOKEN: {
                    label: "DigitalOcean API Token",
                    description:
                        "Personal access token from https://cloud.digitalocean.com/account/api/tokens",
                    placeholder: "dop_v1_...",
                    type: "password"
                }
            }
        }
    },
    {
        key: "supabase",
        name: "Supabase",
        description:
            "Managed PostgreSQL databases, auth, and storage — create projects and manage databases via Supabase CLI in the agent sandbox",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "custom",
        configJson: {
            requiredFields: ["SUPABASE_ACCESS_TOKEN"],
            fieldDefinitions: {
                SUPABASE_ACCESS_TOKEN: {
                    label: "Supabase Access Token",
                    description:
                        "Personal access token from https://supabase.com/dashboard/account/tokens",
                    placeholder: "sbp_...",
                    type: "password"
                }
            }
        }
    },
    // ── Cloud Provider MCP Servers ──────────────────────────────────────
    {
        key: "aws",
        name: "AWS",
        description:
            "Amazon Web Services — manage infrastructure, query services, troubleshoot issues, and automate cloud operations via the AWS API MCP server",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
            fieldDefinitions: {
                AWS_ACCESS_KEY_ID: {
                    label: "AWS Access Key ID",
                    description: "IAM access key from the AWS Console",
                    placeholder: "AKIA...",
                    type: "password"
                },
                AWS_SECRET_ACCESS_KEY: {
                    label: "AWS Secret Access Key",
                    description: "Secret key paired with the access key ID",
                    placeholder: "wJalr...",
                    type: "password"
                },
                AWS_REGION: {
                    label: "AWS Region",
                    description: "Default AWS region (e.g. us-east-1)",
                    placeholder: "us-east-1"
                },
                AWS_SESSION_TOKEN: {
                    label: "AWS Session Token (optional)",
                    description: "Temporary session token for STS-assumed roles",
                    placeholder: "FwoGZX...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["AWS", "aws", "Amazon Web Services"],
                matchArgs: ["awslabs.aws-api-mcp-server", "awslabs.aws-api-mcp-server@latest"],
                envAliases: {
                    AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
                    AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
                    AWS_REGION: "AWS_REGION",
                    AWS_SESSION_TOKEN: "AWS_SESSION_TOKEN"
                }
            }
        }
    },
    {
        key: "azure",
        name: "Azure",
        description:
            "Microsoft Azure — manage resources, compute, databases, containers, and DevOps across 40+ Azure services via the Azure MCP server",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["AZURE_SUBSCRIPTION_ID"],
            fieldDefinitions: {
                AZURE_SUBSCRIPTION_ID: {
                    label: "Azure Subscription ID",
                    description:
                        "Subscription ID from the Azure Portal. Auth is handled via Azure Identity SDK (az login or env vars).",
                    placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                }
            },
            importHints: {
                matchNames: ["Azure", "azure", "Microsoft Azure"],
                matchArgs: ["@azure/mcp", "@azure/mcp@latest"],
                envAliases: {
                    AZURE_SUBSCRIPTION_ID: "AZURE_SUBSCRIPTION_ID"
                }
            }
        }
    },
    {
        key: "gcloud",
        name: "Google Cloud",
        description:
            "Google Cloud Platform — interact with GCP services, manage resources, query infrastructure, and run operations via the gcloud MCP server",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["GOOGLE_CLOUD_PROJECT"],
            fieldDefinitions: {
                GOOGLE_CLOUD_PROJECT: {
                    label: "Google Cloud Project ID",
                    description:
                        "GCP project ID. Auth is handled via Application Default Credentials (gcloud auth application-default login).",
                    placeholder: "my-project-123"
                }
            },
            importHints: {
                matchNames: ["Google Cloud", "GCP", "gcloud", "Google Cloud Platform"],
                matchArgs: ["@google-cloud/gcloud-mcp"],
                envAliases: {
                    GOOGLE_CLOUD_PROJECT: "GOOGLE_CLOUD_PROJECT"
                }
            }
        }
    },
    {
        key: "oracle-cloud",
        name: "Oracle Cloud",
        description:
            "Oracle Cloud Infrastructure — manage compute, storage, networking, databases, and IAM via the OCI MCP server",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["OCI_CLI_TENANCY", "OCI_CLI_USER", "OCI_CLI_REGION"],
            fieldDefinitions: {
                OCI_CLI_TENANCY: {
                    label: "OCI Tenancy OCID",
                    description: "Tenancy OCID from the Oracle Cloud Console",
                    placeholder: "ocid1.tenancy.oc1..aaaa..."
                },
                OCI_CLI_USER: {
                    label: "OCI User OCID",
                    description: "User OCID from the Oracle Cloud Console",
                    placeholder: "ocid1.user.oc1..aaaa..."
                },
                OCI_CLI_REGION: {
                    label: "OCI Region",
                    description: "Oracle Cloud region identifier",
                    placeholder: "us-ashburn-1"
                },
                OCI_CLI_FINGERPRINT: {
                    label: "API Key Fingerprint",
                    description: "Fingerprint of the API signing key",
                    placeholder: "aa:bb:cc:..."
                },
                OCI_CLI_KEY_CONTENT: {
                    label: "API Private Key (PEM)",
                    description: "PEM-encoded private key content for API signing",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Oracle Cloud", "OCI", "oracle-cloud", "Oracle"],
                matchArgs: ["oracle.oci-cloud-mcp-server", "@purplesquirrel/oracle-mcp-server"],
                envAliases: {
                    OCI_CLI_TENANCY: "OCI_CLI_TENANCY",
                    OCI_CLI_USER: "OCI_CLI_USER",
                    OCI_CLI_REGION: "OCI_CLI_REGION"
                }
            }
        }
    },
    {
        key: "ibm-cloud",
        name: "IBM Cloud",
        description:
            "IBM Cloud — discover resources, query services, manage VPCs, Kubernetes, and storage via the IBM Cloud CLI MCP server",
        category: "infrastructure",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["IBMCLOUD_API_KEY"],
            fieldDefinitions: {
                IBMCLOUD_API_KEY: {
                    label: "IBM Cloud API Key",
                    description:
                        "API key from https://cloud.ibm.com/iam/apikeys (preferably from a service ID)",
                    placeholder: "...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["IBM Cloud", "ibm-cloud", "IBM"],
                envAliases: {
                    IBMCLOUD_API_KEY: "IBMCLOUD_API_KEY"
                }
            }
        }
    },
    {
        key: "coinbase",
        name: "Coinbase AgentKit",
        description:
            "Crypto wallets and payments — create wallets, send/receive crypto, check balances, interact with smart contracts",
        category: "payments",
        authType: "apiKey",
        providerType: "mcp",
        configJson: {
            requiredFields: ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"],
            fieldDefinitions: {
                CDP_API_KEY_NAME: {
                    label: "CDP API key name",
                    description: "From Coinbase Developer Platform > API Keys",
                    placeholder: "organizations/...",
                    type: "text"
                },
                CDP_API_KEY_PRIVATE_KEY: {
                    label: "CDP API key private key",
                    description: "The private key associated with your CDP API key",
                    placeholder: "-----BEGIN EC PRIVATE KEY-----...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["Coinbase", "coinbase", "AgentKit", "agentkit", "CDP"],
                envAliases: {
                    CDP_API_KEY_NAME: "CDP_API_KEY_NAME",
                    CDP_API_KEY_PRIVATE_KEY: "CDP_API_KEY_PRIVATE_KEY"
                }
            }
        }
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

type ProviderImportHints = {
    matchNames?: string[];
    matchArgs?: string[];
    matchUrls?: string[];
    envAliases?: Record<string, string>;
    headerAliases?: Record<string, string>;
    argValueMap?: Record<string, string>;
};

const normalizeStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const normalizeStringRecord = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
        (acc, [key, val]) => {
            if (typeof val === "string") {
                acc[key] = val;
                return acc;
            }
            if (val !== null && val !== undefined) {
                acc[key] = String(val);
            }
            return acc;
        },
        {}
    );
};

const getImportHints = (provider: IntegrationProvider | IntegrationProviderSeed) => {
    const config = provider.configJson as Record<string, unknown> | null;
    const hints = config?.importHints;
    if (!hints || typeof hints !== "object" || Array.isArray(hints)) {
        return {} as ProviderImportHints;
    }
    return {
        matchNames: normalizeStringArray((hints as Record<string, unknown>).matchNames),
        matchArgs: normalizeStringArray((hints as Record<string, unknown>).matchArgs),
        matchUrls: normalizeStringArray((hints as Record<string, unknown>).matchUrls),
        envAliases: normalizeStringRecord((hints as Record<string, unknown>).envAliases),
        headerAliases: normalizeStringRecord((hints as Record<string, unknown>).headerAliases),
        argValueMap: normalizeStringRecord((hints as Record<string, unknown>).argValueMap)
    };
};

const normalizeMcpServerConfig = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const command = typeof record.command === "string" ? record.command : undefined;
    const args = normalizeStringArray(record.args);
    const env = normalizeStringRecord(record.env);
    const url = typeof record.url === "string" ? record.url : undefined;
    const headers = normalizeStringRecord(record.headers);

    if (!command && !url) {
        return null;
    }

    return { command, args, env, url, headers };
};

const scoreProviderMatch = (options: {
    provider: IntegrationProvider;
    serverName: string;
    serverConfig: ReturnType<typeof normalizeMcpServerConfig>;
}) => {
    const { provider, serverName, serverConfig } = options;
    const normalizedName = serverName.toLowerCase();
    if (provider.key.toLowerCase() === normalizedName) {
        return 100;
    }

    const hints = getImportHints(provider);
    let score = 0;
    if (hints.matchNames?.some((name) => name.toLowerCase() === normalizedName)) {
        score += 3;
    }
    if (serverConfig?.args?.length && hints.matchArgs?.length) {
        const normalizedArgs = serverConfig.args.map((arg) => arg.toLowerCase());
        if (
            hints.matchArgs.some((match) =>
                normalizedArgs.some((arg) => arg.includes(match.toLowerCase()))
            )
        ) {
            score += 1;
        }
    }
    if (serverConfig?.url && hints.matchUrls?.length) {
        const normalizedUrl = serverConfig.url.toLowerCase();
        if (hints.matchUrls.some((match) => normalizedUrl.includes(match.toLowerCase()))) {
            score += 2;
        }
    }
    return score;
};

const resolveProviderForServer = (
    providers: IntegrationProvider[],
    serverName: string,
    serverConfig: ReturnType<typeof normalizeMcpServerConfig>
) => {
    let best: { provider: IntegrationProvider; score: number } | null = null;

    for (const provider of providers) {
        if (provider.providerType !== "mcp" && provider.providerType !== "custom") {
            continue;
        }
        const score = scoreProviderMatch({ provider, serverName, serverConfig });
        if (score > 0 && (!best || score > best.score)) {
            best = { provider, score };
        }
    }

    return best?.provider ?? null;
};

const serverDefinitionToConfig = (
    definition: MastraMCPServerDefinition
): McpJsonServerConfig | null => {
    if ("command" in definition) {
        const env = normalizeStringRecord(definition.env);
        return {
            command: definition.command,
            args: Array.isArray(definition.args) ? definition.args : [],
            ...(Object.keys(env).length > 0 ? { env } : {})
        };
    }

    if ("url" in definition) {
        const headers = normalizeStringRecord(definition.requestInit?.headers);
        return {
            url: definition.url.toString(),
            ...(Object.keys(headers).length > 0 ? { headers } : {})
        };
    }

    return null;
};

const buildCustomProviderConfig = (
    serverConfig: NonNullable<ReturnType<typeof normalizeMcpServerConfig>>
) => {
    if (serverConfig.url) {
        const headerMapping = Object.keys(serverConfig.headers || {}).reduce<
            Record<string, string>
        >((acc, key) => {
            acc[key] = key;
            return acc;
        }, {});
        return {
            transport: "http",
            url: serverConfig.url,
            ...(Object.keys(headerMapping).length > 0 ? { headerMapping } : {})
        };
    }

    if (serverConfig.command) {
        const envMapping = Object.keys(serverConfig.env || {}).reduce<Record<string, string>>(
            (acc, key) => {
                acc[key] = key;
                return acc;
            },
            {}
        );
        return {
            transport: "stdio",
            command: serverConfig.command,
            args: serverConfig.args,
            ...(Object.keys(envMapping).length > 0 ? { envMapping } : {})
        };
    }

    return null;
};

const buildCredentialsForProvider = (
    provider: IntegrationProvider,
    serverConfig: NonNullable<ReturnType<typeof normalizeMcpServerConfig>>
) => {
    const credentials: Record<string, unknown> = {};

    if (provider.providerType === "custom") {
        for (const [key, value] of Object.entries(serverConfig.env || {})) {
            credentials[key] = value;
        }
        for (const [key, value] of Object.entries(serverConfig.headers || {})) {
            credentials[key] = value;
        }
        return credentials;
    }

    const hints = getImportHints(provider);
    const envAliases = hints.envAliases ?? {};
    for (const [key, value] of Object.entries(serverConfig.env || {})) {
        const alias = envAliases[key] ?? key;
        credentials[alias] = value;
    }

    const headerAliases = hints.headerAliases ?? {};
    for (const [key, value] of Object.entries(serverConfig.headers || {})) {
        const alias = headerAliases[key];
        if (!alias) continue;
        let normalizedValue = value;
        if (
            key.toLowerCase() === "authorization" &&
            typeof normalizedValue === "string" &&
            normalizedValue.toLowerCase().startsWith("bearer ")
        ) {
            normalizedValue = normalizedValue.slice(7);
        }
        credentials[alias] = normalizedValue;
    }

    const argValueMap = hints.argValueMap ?? {};
    if (serverConfig.args?.length && Object.keys(argValueMap).length > 0) {
        serverConfig.args.forEach((arg, index) => {
            const targetKey = argValueMap[arg];
            if (targetKey && serverConfig.args[index + 1]) {
                credentials[targetKey] = serverConfig.args[index + 1];
            }
        });
    }

    return credentials;
};

let _ensureProvidersPromise: Promise<void> | null = null;

async function ensureIntegrationProviders() {
    if (_ensureProvidersPromise) return _ensureProvidersPromise;
    _ensureProvidersPromise = _doEnsureIntegrationProviders();
    return _ensureProvidersPromise;
}

async function _doEnsureIntegrationProviders() {
    for (const seed of INTEGRATION_PROVIDER_SEEDS) {
        await prisma.integrationProvider.upsert({
            where: { key: seed.key },
            update: {
                // Do not overwrite name/description so imported config or server-provided
                // metadata (e.g. from MCP initialize serverInfo) can persist.
                category: seed.category,
                authType: seed.authType,
                providerType: seed.providerType,
                maturityLevel: seed.maturityLevel ?? "visible",
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
                maturityLevel: seed.maturityLevel ?? "visible",
                configJson: seed.configJson ?? undefined,
                actionsJson: seed.actionsJson ?? undefined,
                triggersJson: seed.triggersJson ?? undefined,
                isActive: true
            }
        });
    }
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

    const allConnections = await prisma.integrationConnection.findMany({
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

    // Filter out connections with persistent errors to prevent loading broken tools
    const connections = allConnections.filter((conn) => {
        if (conn.errorMessage) {
            console.warn(
                `[MCP] Skipping connection "${conn.name}" (${conn.provider.key}): ${conn.errorMessage}`
            );
            return false;
        }
        return true;
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

/**
 * Build authentication headers for a remote MCP server based on provider authType.
 *
 * - "oauth" providers: look for accessToken / access_token in credentials
 * - "api_key" providers: look for common API key field names
 * - "none" / other: no auth header
 */
function buildRemoteMcpAuthHeaders(
    provider: IntegrationProvider,
    credentials: Record<string, unknown>,
    allowEnvFallback: boolean
): Record<string, string> {
    const authType = provider.authType;
    const providerKey = provider.key;
    const envKeyUpper = providerKey.toUpperCase().replace(/-/g, "_");

    if (authType === "oauth") {
        // For OAuth providers, extract access token from stored credentials
        const accessToken = getCredentialValue(credentials, [
            "accessToken",
            "access_token",
            "token",
            "apiToken",
            "api_token"
        ]);
        if (accessToken) {
            return { Authorization: `Bearer ${accessToken}` };
        }
        // Fallback to env var
        if (allowEnvFallback) {
            const envToken =
                process.env[`${envKeyUpper}_ACCESS_TOKEN`] ||
                process.env[`${envKeyUpper}_TOKEN`] ||
                process.env[`${envKeyUpper}_API_KEY`];
            if (envToken) {
                return { Authorization: `Bearer ${envToken}` };
            }
        }
        return {};
    }

    if (authType === "api_key") {
        // For API key providers, look for common key field names
        const apiKey = getCredentialValue(credentials, [
            "apiKey",
            "api_key",
            "API_KEY",
            `${envKeyUpper}_API_KEY`,
            "token",
            "accessToken",
            "access_token"
        ]);
        if (apiKey) {
            return { Authorization: `Bearer ${apiKey}` };
        }
        // Fallback to env var
        if (allowEnvFallback) {
            const envKey =
                process.env[`${envKeyUpper}_API_KEY`] ||
                process.env[`${envKeyUpper}_ACCESS_TOKEN`] ||
                process.env[`${envKeyUpper}_TOKEN`];
            if (envKey) {
                return { Authorization: `Bearer ${envKey}` };
            }
        }
        return {};
    }

    // No auth needed (e.g., "none" or open endpoints)
    return {};
}

function buildServerDefinitionForProvider(options: {
    provider: IntegrationProvider;
    connection?: ConnectionWithProvider | null;
    credentials: Record<string, unknown>;
    allowEnvFallback?: boolean;
}): MastraMCPServerDefinition | null {
    const { provider, credentials, allowEnvFallback = false, connection } = options;
    const providerKey = provider.key;
    const connectionMetadata =
        connection?.metadata && typeof connection.metadata === "object"
            ? (connection.metadata as Record<string, unknown>)
            : undefined;

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
        case "youtube-transcript":
            return {
                command: "npx",
                args: ["-y", "@kimtaeyoon83/mcp-server-youtube-transcript"],
                env: {}
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
        case "appello": {
            const appelloToken =
                getCredentialValue(credentials, ["APPELLO_API_TOKEN"]) ||
                (allowEnvFallback ? process.env.APPELLO_API_TOKEN : undefined);
            if (!appelloToken) return null;
            return {
                url: new URL("https://release-api.useappello.app/mcp"),
                requestInit: {
                    headers: { Authorization: `Bearer ${appelloToken}` }
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
            // Support both OAuth-stored "botToken" and legacy "SLACK_BOT_TOKEN" key names
            const slackToken =
                getCredentialValue(credentials, ["botToken", "SLACK_BOT_TOKEN"]) ||
                (allowEnvFallback ? process.env.SLACK_BOT_TOKEN : undefined);
            // teamId from connection metadata or credentials
            const slackTeamId =
                getCredentialValue(credentials, ["SLACK_TEAM_ID"]) ||
                (connectionMetadata?.teamId as string | undefined) ||
                (allowEnvFallback ? process.env.SLACK_TEAM_ID : undefined);
            if (!slackToken || !slackTeamId) return null;
            return {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-slack"],
                env: { SLACK_BOT_TOKEN: slackToken, SLACK_TEAM_ID: slackTeamId }
            };
        }
        // case "gdrive": deprecated — replaced by native OAuth Google Drive tools
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
        // ── Cloud Provider MCP Servers ──────────────────────────────────
        case "aws": {
            const awsAccessKey =
                getCredentialValue(credentials, ["AWS_ACCESS_KEY_ID"]) ||
                (allowEnvFallback ? process.env.AWS_ACCESS_KEY_ID : undefined);
            const awsSecretKey =
                getCredentialValue(credentials, ["AWS_SECRET_ACCESS_KEY"]) ||
                (allowEnvFallback ? process.env.AWS_SECRET_ACCESS_KEY : undefined);
            const awsRegion =
                getCredentialValue(credentials, ["AWS_REGION"]) ||
                (allowEnvFallback ? process.env.AWS_REGION : undefined) ||
                "us-east-1";
            if (!awsAccessKey || !awsSecretKey) return null;
            const awsSessionToken =
                getCredentialValue(credentials, ["AWS_SESSION_TOKEN"]) ||
                (allowEnvFallback ? process.env.AWS_SESSION_TOKEN : undefined);
            return {
                command: "uvx",
                args: ["awslabs.aws-api-mcp-server@latest"],
                env: {
                    AWS_ACCESS_KEY_ID: awsAccessKey,
                    AWS_SECRET_ACCESS_KEY: awsSecretKey,
                    AWS_REGION: awsRegion,
                    ...(awsSessionToken ? { AWS_SESSION_TOKEN: awsSessionToken } : {})
                }
            };
        }
        case "azure": {
            const azureSubscription =
                getCredentialValue(credentials, ["AZURE_SUBSCRIPTION_ID"]) ||
                (allowEnvFallback ? process.env.AZURE_SUBSCRIPTION_ID : undefined);
            if (!azureSubscription) return null;
            return {
                command: "npx",
                args: ["-y", "@azure/mcp@latest", "server", "start"],
                env: { AZURE_SUBSCRIPTION_ID: azureSubscription }
            };
        }
        case "gcloud": {
            const gcpProject =
                getCredentialValue(credentials, ["GOOGLE_CLOUD_PROJECT"]) ||
                (allowEnvFallback ? process.env.GOOGLE_CLOUD_PROJECT : undefined);
            if (!gcpProject) return null;
            return {
                command: "npx",
                args: ["-y", "@google-cloud/gcloud-mcp"],
                env: { GOOGLE_CLOUD_PROJECT: gcpProject }
            };
        }
        case "oracle-cloud": {
            const ociTenancy =
                getCredentialValue(credentials, ["OCI_CLI_TENANCY"]) ||
                (allowEnvFallback ? process.env.OCI_CLI_TENANCY : undefined);
            const ociUser =
                getCredentialValue(credentials, ["OCI_CLI_USER"]) ||
                (allowEnvFallback ? process.env.OCI_CLI_USER : undefined);
            const ociRegion =
                getCredentialValue(credentials, ["OCI_CLI_REGION"]) ||
                (allowEnvFallback ? process.env.OCI_CLI_REGION : undefined);
            if (!ociTenancy || !ociUser || !ociRegion) return null;
            const ociFingerprint =
                getCredentialValue(credentials, ["OCI_CLI_FINGERPRINT"]) ||
                (allowEnvFallback ? process.env.OCI_CLI_FINGERPRINT : undefined);
            const ociKeyContent =
                getCredentialValue(credentials, ["OCI_CLI_KEY_CONTENT"]) ||
                (allowEnvFallback ? process.env.OCI_CLI_KEY_CONTENT : undefined);
            return {
                command: "uvx",
                args: ["oracle.oci-cloud-mcp-server"],
                env: {
                    OCI_CLI_TENANCY: ociTenancy,
                    OCI_CLI_USER: ociUser,
                    OCI_CLI_REGION: ociRegion,
                    ...(ociFingerprint ? { OCI_CLI_FINGERPRINT: ociFingerprint } : {}),
                    ...(ociKeyContent ? { OCI_CLI_KEY_CONTENT: ociKeyContent } : {})
                }
            };
        }
        case "ibm-cloud": {
            const ibmApiKey =
                getCredentialValue(credentials, ["IBMCLOUD_API_KEY"]) ||
                (allowEnvFallback ? process.env.IBMCLOUD_API_KEY : undefined);
            if (!ibmApiKey) return null;
            return {
                command: "ibmcloud",
                args: ["--mcp-transport", "stdio"],
                env: { IBMCLOUD_API_KEY: ibmApiKey }
            };
        }
        case "coinbase": {
            const cdpKeyName =
                getCredentialValue(credentials, ["CDP_API_KEY_NAME"]) ||
                (allowEnvFallback ? process.env.CDP_API_KEY_NAME : undefined);
            const cdpPrivateKey =
                getCredentialValue(credentials, ["CDP_API_KEY_PRIVATE_KEY"]) ||
                (allowEnvFallback ? process.env.CDP_API_KEY_PRIVATE_KEY : undefined);
            if (!cdpKeyName || !cdpPrivateKey) return null;
            return {
                command: "npx",
                args: ["-y", "@coinbase/agentkit", "chatbot", "--mcp"],
                env: {
                    CDP_API_KEY_NAME: cdpKeyName,
                    CDP_API_KEY_PRIVATE_KEY: cdpPrivateKey
                }
            };
        }
        default: {
            // Generic handler: any provider with hostedMcpUrl in configJson
            const configJson =
                provider.configJson && typeof provider.configJson === "object"
                    ? (provider.configJson as Record<string, unknown>)
                    : undefined;
            const hostedMcpUrl = configJson?.hostedMcpUrl as string | undefined;

            if (!hostedMcpUrl) return null;

            // Build auth header from credentials based on authType
            const authHeaders = buildRemoteMcpAuthHeaders(provider, credentials, allowEnvFallback);

            return {
                url: new URL(hostedMcpUrl),
                ...(Object.keys(authHeaders).length > 0
                    ? { requestInit: { headers: authHeaders } }
                    : {})
            };
        }
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

    // ── Normalize nullable type arrays ────────────────────────────────
    // JSON Schema type: ["string", "null"] → z.union([z.string(), z.null()])
    // ZodNull is rejected by @mastra/schema-compat. Normalize to non-null type.
    if (Array.isArray(result.type)) {
        const nonNullTypes = result.type.filter((t: string) => t !== "null");
        if (nonNullTypes.length === 0) {
            result.type = "string"; // type: ["null"] → string fallback
        } else if (nonNullTypes.length === 1) {
            result.type = nonNullTypes[0]; // type: ["string", "null"] → "string"
        } else {
            result.type = nonNullTypes; // type: ["string", "number", "null"] → ["string", "number"]
        }
    }

    // Handle pure null type: type: "null" → type: "string"
    if (result.type === "null") {
        result.type = "string";
    }

    // ── Normalize anyOf/oneOf with null ───────────────────────────────
    // anyOf: [{type: "string"}, {type: "null"}] → type: "string"
    for (const keyword of ["anyOf", "oneOf"] as const) {
        if (Array.isArray(result[keyword])) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nonNull = result[keyword].filter((s: any) => !(s && s.type === "null"));
            if (nonNull.length < result[keyword].length) {
                if (nonNull.length === 0) {
                    delete result[keyword];
                    result.type = "string";
                } else if (nonNull.length === 1) {
                    delete result[keyword];
                    Object.assign(result, sanitizeToolSchema(nonNull[0]));
                    return result; // Already recursed via the promoted schema
                } else {
                    result[keyword] = nonNull.map(sanitizeToolSchema);
                }
            }
        }
    }

    // Fix: Array type missing items definition
    // Handle both string type and array type (e.g., ["array", "null"])
    const isArrayType =
        result.type === "array" || (Array.isArray(result.type) && result.type.includes("array"));
    if (isArrayType && !result.items) {
        result.items = {}; // Default to any type (most permissive)
    }

    // Fix: Remove unsupported "default" values that cause schema validation errors
    // Some MCP servers set defaults that are incompatible with the schema
    if (result.type === "object" && result.default !== undefined) {
        delete result.default;
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

    // Handle if/then/else
    for (const keyword of ["if", "then", "else"]) {
        if (result[keyword] && typeof result[keyword] === "object") {
            result[keyword] = sanitizeToolSchema(result[keyword]);
        }
    }

    return result;
}

/**
 * Layer 2 of the two-layer schema defense. Sanitizes Zod schemas AFTER
 * the zod-from-json-schema conversion, catching any unsupported types
 * that slipped through Layer 1.
 *
 * @mastra/schema-compat defines these as UNSUPPORTED:
 *   ZodIntersection, ZodNever, ZodNull, ZodTuple, ZodUndefined
 *
 * And these as SUPPORTED:
 *   ZodObject, ZodArray, ZodUnion, ZodString, ZodNumber, ZodDate,
 *   ZodAny, ZodDefault, ZodNullable
 *
 * This sanitizer converts unsupported types to safe supported equivalents.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeZodSchema(schema: any): any {
    if (!schema || typeof schema !== "object" || !schema._def) {
        return schema;
    }

    const typeName = schema._def?.typeName;

    // Helper: get zod lazily
    const getZ = () => {
        try {
            return require("zod").z;
        } catch {
            return null;
        }
    };

    // ── UNSUPPORTED TYPES (rejected by @mastra/schema-compat) ────────

    // ZodNull → z.any().optional()
    // Null-only parameters are meaningless for LLM tool calls.
    if (typeName === "ZodNull") {
        const z = getZ();
        return z ? z.any().optional() : schema;
    }

    // ZodUndefined → z.any().optional()
    if (typeName === "ZodUndefined") {
        const z = getZ();
        return z ? z.any().optional() : schema;
    }

    // ZodNever → z.any().optional()
    if (typeName === "ZodNever") {
        const z = getZ();
        return z ? z.any().optional() : schema;
    }

    // ZodVoid → z.any().optional()
    if (typeName === "ZodVoid") {
        const z = getZ();
        return z ? z.any().optional() : schema;
    }

    // ZodTuple → z.array(z.any())
    // Tuples don't have clean JSON Schema representation for LLMs.
    if (typeName === "ZodTuple") {
        const z = getZ();
        return z ? z.array(z.any()).optional() : schema;
    }

    // ZodIntersection → sanitize both sides, return first side
    // Intersections (A & B) don't map to JSON Schema cleanly.
    if (typeName === "ZodIntersection") {
        const left = schema._def?.left;
        const right = schema._def?.right;
        if (left) {
            return sanitizeZodSchema(left);
        }
        if (right) {
            return sanitizeZodSchema(right);
        }
        const z = getZ();
        return z ? z.any().optional() : schema;
    }

    // ── SUPPORTED TYPES THAT NEED RECURSIVE SANITIZATION ─────────────

    // ZodUnion: recursively sanitize members, filter out unsupported null/undefined/never
    if (typeName === "ZodUnion" && schema._def?.options) {
        const z = getZ();
        if (!z) return schema;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options: any[] = schema._def.options;
        const sanitized = options.map(sanitizeZodSchema).filter((opt) => {
            // Remove ZodNull, ZodUndefined, ZodNever, ZodVoid from unions
            const tn = opt?._def?.typeName;
            return (
                tn !== "ZodNull" && tn !== "ZodUndefined" && tn !== "ZodNever" && tn !== "ZodVoid"
            );
        });

        if (sanitized.length === 0) {
            return z.any().optional();
        }
        if (sanitized.length === 1) {
            // Unwrap single-member union
            return sanitized[0].optional?.() || sanitized[0];
        }
        // Rebuild the union with sanitized members
        return z.union(
            sanitized as [
                import("zod").ZodTypeAny,
                import("zod").ZodTypeAny,
                ...import("zod").ZodTypeAny[]
            ]
        );
    }

    // ZodArray: check if inner type is ZodAny — replace if so
    if (typeName === "ZodArray") {
        const innerTypeName = schema._def?.type?._def?.typeName;
        if (innerTypeName === "ZodAny" || innerTypeName === "ZodUnknown" || !schema._def?.type) {
            const z = getZ();
            if (!z) return schema;
            // Replace z.array(z.any()) with z.array(z.record(z.string(), z.any()))
            // This produces valid JSON Schema: { type: "array", items: { type: "object" } }
            return z.array(z.record(z.string(), z.any())).optional();
        }
        // Recursively fix the inner type
        const fixedInner = sanitizeZodSchema(schema._def.type);
        if (fixedInner !== schema._def.type) {
            const z = getZ();
            if (!z) return schema;
            return z.array(fixedInner);
        }
        return schema;
    }

    // ZodObject: recursively fix all shape properties
    if (typeName === "ZodObject" && schema._def?.shape) {
        const shape =
            typeof schema._def.shape === "function" ? schema._def.shape() : schema._def.shape;
        let changed = false;
        const newShape: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(shape)) {
            const fixed = sanitizeZodSchema(value);
            if (fixed !== value) changed = true;
            newShape[key] = fixed;
        }
        if (changed) {
            const z = getZ();
            if (!z) return schema;
            return z.object(newShape as Record<string, import("zod").ZodTypeAny>);
        }
        return schema;
    }

    // ZodOptional: unwrap and fix inner
    if (typeName === "ZodOptional" && schema._def?.innerType) {
        const fixed = sanitizeZodSchema(schema._def.innerType);
        if (fixed !== schema._def.innerType) {
            return fixed.optional?.() || schema;
        }
        return schema;
    }

    // ZodNullable: unwrap and fix inner
    if (typeName === "ZodNullable" && schema._def?.innerType) {
        const fixed = sanitizeZodSchema(schema._def.innerType);
        if (fixed !== schema._def.innerType) {
            return fixed.nullable?.() || schema;
        }
        return schema;
    }

    // ZodDefault: unwrap and fix inner
    if (typeName === "ZodDefault" && schema._def?.innerType) {
        const fixed = sanitizeZodSchema(schema._def.innerType);
        if (fixed !== schema._def.innerType) {
            return fixed;
        }
        return schema;
    }

    // ZodEffects: unwrap the inner schema
    if (typeName === "ZodEffects" && schema._def?.schema) {
        return sanitizeZodSchema(schema._def.schema);
    }

    // ZodLazy: evaluate and sanitize
    if (typeName === "ZodLazy" && schema._def?.getter) {
        try {
            const inner = schema._def.getter();
            return sanitizeZodSchema(inner);
        } catch {
            const z = getZ();
            return z ? z.any().optional() : schema;
        }
    }

    // ── CATCH-ALL for unrecognized types ─────────────────────────────
    // If the type is not in the supported list and we haven't handled it,
    // log a warning and return as-is (Layer 1 should have prevented most issues).
    const supportedTypes = [
        "ZodObject",
        "ZodArray",
        "ZodUnion",
        "ZodString",
        "ZodNumber",
        "ZodDate",
        "ZodAny",
        "ZodDefault",
        "ZodNullable",
        "ZodOptional",
        "ZodBoolean",
        "ZodEnum",
        "ZodLiteral",
        "ZodRecord",
        "ZodUnknown"
    ];
    if (typeName && !supportedTypes.includes(typeName)) {
        console.warn(`[MCP Schema] Unrecognized Zod type "${typeName}" — converting to z.any()`);
        const z = getZ();
        return z ? z.any().optional() : schema;
    }

    return schema;
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

            // Sanitize inputSchema — may be JSON Schema or Zod schema
            if (sanitizedTool.inputSchema) {
                if (sanitizedTool.inputSchema._def) {
                    // Zod schema — use Zod-specific sanitizer
                    sanitizedTool.inputSchema = sanitizeZodSchema(sanitizedTool.inputSchema);
                } else {
                    // JSON Schema — use JSON Schema sanitizer
                    sanitizedTool.inputSchema = sanitizeToolSchema(sanitizedTool.inputSchema);
                }
            }

            // Also check for schema property (some tools use this)
            if (sanitizedTool.schema) {
                if (sanitizedTool.schema._def) {
                    sanitizedTool.schema = sanitizeZodSchema(sanitizedTool.schema);
                } else {
                    sanitizedTool.schema = sanitizeToolSchema(sanitizedTool.schema);
                }
            }

            // Check for parameters (another common property name)
            if (sanitizedTool.parameters) {
                if (sanitizedTool.parameters._def) {
                    sanitizedTool.parameters = sanitizeZodSchema(sanitizedTool.parameters);
                } else {
                    sanitizedTool.parameters = sanitizeToolSchema(sanitizedTool.parameters);
                }
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
    category:
        | "knowledge"
        | "web"
        | "crm"
        | "productivity"
        | "communication"
        | "automation"
        | "infrastructure"
        | "data"
        | "payments"
        | "ecommerce"
        | "support"
        | "design"
        | "marketing"
        | "developer"
        | "ai";
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
        allowEnvFallback: false
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
 * Get all available MCP tools with per-server error isolation.
 *
 * Connects to each MCP server independently so one failing server
 * (e.g. bad path, timeout) does not prevent tools from other servers
 * from loading. Returns merged tools + per-server errors.
 */
export async function getMcpTools(
    organizationIdOrOptions?:
        | string
        | null
        | { organizationId?: string | null; userId?: string | null }
): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: Record<string, any>;
    serverErrors: Record<string, string>;
}> {
    const options =
        organizationIdOrOptions && typeof organizationIdOrOptions === "object"
            ? organizationIdOrOptions
            : { organizationId: organizationIdOrOptions };

    const cacheKey = options.organizationId
        ? `${options.organizationId}:${options.userId || "org"}`
        : "__default__";
    const now = Date.now();
    const cached = perServerToolsCache.get(cacheKey);
    if (cached && now - cached.loadedAt < ORG_MCP_CACHE_TTL) {
        return { tools: cached.tools, serverErrors: cached.serverErrors };
    }

    const servers = await buildServerConfigsForOptions(options);
    const result = await loadToolsPerServer(servers, cacheKey);

    // If some servers failed, backfill from last-known-good cache (stale fallback)
    const failedServerIds = Object.keys(result.serverErrors);
    if (failedServerIds.length > 0) {
        let backfilledCount = 0;
        for (const serverId of failedServerIds) {
            const lkg = lastKnownGoodTools.get(`${cacheKey}::${serverId}`);
            if (lkg && now - lkg.loadedAt < ORG_MCP_STALE_TTL) {
                Object.assign(result.tools, lkg.tools);
                result.serverErrors[serverId] =
                    `${result.serverErrors[serverId]} (using ${Object.keys(lkg.tools).length} stale tools)`;
                backfilledCount += Object.keys(lkg.tools).length;
            }
        }
        if (backfilledCount > 0) {
            console.log(
                `[MCP] Backfilled ${backfilledCount} stale tool(s) from last-known-good cache ` +
                    `for ${failedServerIds.length} failed server(s)`
            );
        }
    }

    perServerToolsCache.set(cacheKey, { ...result, loadedAt: now });
    return result;
}

/**
 * Build server configs for the given org/user options.
 * Centralises the connection-loading + buildServerConfigs call.
 */
async function buildServerConfigsForOptions(options: {
    organizationId?: string | null;
    userId?: string | null;
}): Promise<Record<string, MastraMCPServerDefinition>> {
    const organizationId = options.organizationId;
    if (!organizationId) {
        return buildServerConfigs({ connections: [], allowEnvFallback: true });
    }
    const connections = await getIntegrationConnections({
        organizationId,
        userId: options.userId
    });
    return buildServerConfigs({ connections, allowEnvFallback: false });
}

/**
 * Load tools from a single MCP server with 1 retry on failure.
 * Returns the tools on success, or throws on failure after retry.
 */
async function loadToolsFromServer(
    serverId: string,
    serverDef: MastraMCPServerDefinition,
    maxRetries = 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ serverId: string; tools: Record<string, any> }> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            // Wait 2 seconds before retry
            await new Promise((r) => setTimeout(r, 2000));
            console.log(
                `[MCP] Retrying server "${serverId}" (attempt ${attempt + 1}/${maxRetries + 1})`
            );
        }
        const client = new MCPClient({
            id: `mastra-mcp-iso-${serverId}`,
            servers: { [serverId]: serverDef },
            timeout: 60000
        });
        try {
            const tools = await client.listTools();
            return { serverId, tools: sanitizeMcpTools(tools) };
        } catch (err) {
            lastError = err;
        } finally {
            await client.disconnect().catch(() => {});
        }
    }
    throw lastError;
}

/**
 * Load tools from each server independently using Promise.allSettled.
 * Each server gets 1 retry on failure before being marked as errored.
 * Successful loads are stored in a last-known-good cache for stale fallback.
 * Returns merged tools and a map of serverId -> error message for failures.
 */
async function loadToolsPerServer(
    servers: Record<string, MastraMCPServerDefinition>,
    cacheKey = "__default__"
): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: Record<string, any>;
    serverErrors: Record<string, string>;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergedTools: Record<string, any> = {};
    const serverErrors: Record<string, string> = {};

    const serverEntries = Object.entries(servers);
    if (serverEntries.length === 0) {
        return { tools: mergedTools, serverErrors };
    }

    const results = await Promise.allSettled(
        serverEntries.map(([serverId, serverDef]) => loadToolsFromServer(serverId, serverDef))
    );

    for (const result of results) {
        if (result.status === "fulfilled") {
            const { serverId, tools } = result.value;
            Object.assign(mergedTools, tools);
            // Update last-known-good cache for this server
            lastKnownGoodTools.set(`${cacheKey}::${serverId}`, {
                tools,
                loadedAt: Date.now()
            });
        } else {
            // Extract serverId from the error context
            const idx = results.indexOf(result);
            const serverId = serverEntries[idx]![0];
            const message = formatTestError(result.reason);
            serverErrors[serverId] = message;
            console.warn(`[MCP] Server "${serverId}" failed to load tools after retry: ${message}`);
        }
    }

    return { tools: mergedTools, serverErrors };
}

async function resolveServerDefinitionById(options: {
    serverId: string;
    organizationId?: string | null;
    userId?: string | null;
    allowEnvFallback?: boolean;
}) {
    const { serverId, allowEnvFallback = true } = options;
    const connections = await getIntegrationConnections({
        organizationId: options.organizationId,
        userId: options.userId
    });

    const connectionsByProvider = new Map<string, ConnectionWithProvider[]>();
    for (const connection of connections) {
        const list = connectionsByProvider.get(connection.provider.key) ?? [];
        list.push(connection);
        connectionsByProvider.set(connection.provider.key, list);
    }

    for (const [providerKey, providerConnections] of connectionsByProvider.entries()) {
        const defaultConnection =
            providerConnections.find((conn) => conn.isDefault) ?? providerConnections[0];

        for (const connection of providerConnections) {
            const isDefault = connection.id === defaultConnection?.id;
            const resolvedServerId = resolveServerId(providerKey, connection, isDefault);
            if (resolvedServerId !== serverId) continue;

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
            if (!serverDefinition) {
                return null;
            }

            return {
                serverDefinition,
                provider: connection.provider,
                connection
            };
        }
    }

    if (allowEnvFallback && !serverId.includes("__")) {
        const providerSeed = INTEGRATION_PROVIDER_SEEDS.find(
            (seed) => seed.key === serverId && seed.providerType === "mcp"
        );
        if (providerSeed) {
            const serverDefinition = buildServerDefinitionForProvider({
                provider: providerSeed as IntegrationProvider,
                connection: null,
                credentials: {},
                allowEnvFallback: true
            });
            if (!serverDefinition) {
                return null;
            }

            return {
                serverDefinition,
                provider: providerSeed as IntegrationProvider,
                connection: null
            };
        }
    }

    return null;
}

/**
 * Get MCP tools for a single server without connecting to all servers.
 */
export async function getMcpToolsForServer(options: {
    serverId: string;
    organizationId?: string | null;
    userId?: string | null;
    allowEnvFallback?: boolean;
}) {
    const { serverId } = options;
    const resolved = await resolveServerDefinitionById(options);
    if (!resolved?.serverDefinition) {
        return {};
    }

    const client = new MCPClient({
        id: `mastra-mcp-client-${serverId}`,
        servers: { [serverId]: resolved.serverDefinition },
        timeout: 60000
    });

    try {
        const tools = await client.listTools();
        return sanitizeMcpTools(tools);
    } finally {
        await client.disconnect();
    }
}

export async function exportMcpConfig(options: {
    organizationId: string;
    userId?: string | null;
}): Promise<McpJsonConfigFile> {
    const connections = await getIntegrationConnections({
        organizationId: options.organizationId,
        userId: options.userId
    });
    const mcpServers: Record<string, McpJsonServerConfig> = {};

    const connectionsByProvider = new Map<string, ConnectionWithProvider[]>();
    for (const connection of connections) {
        if (
            connection.provider.providerType !== "mcp" &&
            connection.provider.providerType !== "custom"
        ) {
            continue;
        }
        const list = connectionsByProvider.get(connection.provider.key) ?? [];
        list.push(connection);
        connectionsByProvider.set(connection.provider.key, list);
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
                allowEnvFallback: false
            });
            if (!serverDefinition) {
                continue;
            }
            const config = serverDefinitionToConfig(serverDefinition);
            if (config) {
                mcpServers[serverId] = config;
            }
        }
    }

    return { mcpServers };
}

export async function importMcpConfig(options: {
    organizationId: string;
    userId?: string | null;
    config: McpJsonConfigFile;
    mode?: "replace" | "merge";
}) {
    const { organizationId, userId, config, mode = "replace" } = options;
    if (!config || typeof config !== "object" || !config.mcpServers) {
        throw new Error("Invalid MCP config: missing mcpServers");
    }
    if (typeof config.mcpServers !== "object" || Array.isArray(config.mcpServers)) {
        throw new Error("Invalid MCP config: mcpServers must be an object");
    }

    await ensureIntegrationProviders();

    const providers = await prisma.integrationProvider.findMany({
        where: { isActive: true }
    });
    const providersByKey = new Map(providers.map((provider) => [provider.key, provider]));

    const existingConnections = await prisma.integrationConnection.findMany({
        where: {
            organizationId,
            OR: [{ scope: "org" }, ...(userId ? [{ scope: "user", userId }] : [])],
            provider: { providerType: { in: ["mcp", "custom"] } }
        },
        include: { provider: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });

    const connectionMatchMap = new Map<string, ConnectionWithProvider>();
    for (const connection of existingConnections) {
        const metadata =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : null;
        const serverName =
            metadata && typeof metadata.mcpServerName === "string"
                ? metadata.mcpServerName
                : connection.name;
        const matchKey = `${connection.provider.key}::${serverName.toLowerCase()}`;
        if (!connectionMatchMap.has(matchKey)) {
            connectionMatchMap.set(matchKey, connection);
        }
    }

    const seenConnectionIds = new Set<string>();
    const createdProviders: string[] = [];
    const updatedProviders: string[] = [];
    const createdConnections: string[] = [];
    const updatedConnections: string[] = [];
    const disabledConnections: string[] = [];
    const warnings: string[] = [];

    await prisma.$transaction(async (tx) => {
        for (const [serverName, rawServerConfig] of Object.entries(config.mcpServers)) {
            const serverConfig = normalizeMcpServerConfig(rawServerConfig);
            if (!serverConfig) {
                warnings.push(`Skipped '${serverName}': invalid server config`);
                continue;
            }

            // Validate for local/relative paths that won't work in production
            const localPathPrefixes = ["/Users/", "/home/", "C:\\"];
            const localPathFragments = ["/.cursor/", "/.nvm/", "/AppData/", "/.local/"];

            if (serverConfig.command) {
                const cmd = serverConfig.command;
                const isLocalCmd =
                    localPathPrefixes.some((p) => cmd.startsWith(p)) ||
                    localPathFragments.some((f) => cmd.includes(f));
                if (isLocalCmd) {
                    warnings.push(
                        `Server '${serverName}': command is a local path (${cmd}). This will fail in production.`
                    );
                }
                if (cmd.startsWith("./") || cmd.startsWith("../")) {
                    warnings.push(
                        `Server '${serverName}': command uses a relative path (${cmd}). This may not resolve correctly on the server.`
                    );
                }
            }

            if (serverConfig.args) {
                for (const arg of serverConfig.args) {
                    const isLocalArg =
                        localPathPrefixes.some((p) => arg.startsWith(p)) ||
                        localPathFragments.some((f) => arg.includes(f));
                    if (isLocalArg) {
                        warnings.push(
                            `Server '${serverName}': arg contains a local path (${arg}). This will fail in production.`
                        );
                        break;
                    }
                }
            }

            if (serverConfig.url) {
                if (
                    !serverConfig.url.startsWith("http://") &&
                    !serverConfig.url.startsWith("https://")
                ) {
                    warnings.push(
                        `Server '${serverName}': url should start with http:// or https:// (got: ${serverConfig.url})`
                    );
                }
            }

            let provider =
                providersByKey.get(serverName) ??
                resolveProviderForServer(providers, serverName, serverConfig);

            if (!provider) {
                const isSafeKey = /^[a-zA-Z0-9_-]+$/.test(serverName);
                const providerKey = isSafeKey
                    ? serverName
                    : `custom-${serverName
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9_-]/g, "")}`;
                const customConfig = buildCustomProviderConfig(serverConfig);
                const created = await tx.integrationProvider.create({
                    data: {
                        key: providerKey,
                        name: serverName,
                        description: null,
                        category: "custom",
                        authType: "custom",
                        providerType: "custom",
                        configJson: customConfig
                            ? (customConfig as Prisma.InputJsonValue)
                            : undefined,
                        isActive: true
                    }
                });
                providers.push(created);
                providersByKey.set(created.key, created);
                provider = created;
                createdProviders.push(created.key);
            } else if (provider.providerType === "custom") {
                const customConfig = buildCustomProviderConfig(serverConfig);
                if (customConfig) {
                    await tx.integrationProvider.update({
                        where: { id: provider.id },
                        data: {
                            configJson: customConfig as Prisma.InputJsonValue
                        }
                    });
                    updatedProviders.push(provider.key);
                }
            }

            if (!provider) {
                warnings.push(`Skipped '${serverName}': unable to resolve provider`);
                continue;
            }

            const credentials = buildCredentialsForProvider(provider, serverConfig);
            const encryptedCredentials = encryptCredentials(credentials);
            const isDefault = provider.key.toLowerCase() === serverName.toLowerCase();

            if (isDefault) {
                await tx.integrationConnection.updateMany({
                    where: {
                        organizationId,
                        providerId: provider.id,
                        scope: "org"
                    },
                    data: { isDefault: false }
                });
            }

            const matchKey = `${provider.key}::${serverName.toLowerCase()}`;
            const existing = connectionMatchMap.get(matchKey);

            const metadata = {
                ...(existing?.metadata && typeof existing.metadata === "object"
                    ? (existing.metadata as Record<string, unknown>)
                    : {}),
                mcpServerName: serverName
            };

            if (existing) {
                const updated = await tx.integrationConnection.update({
                    where: { id: existing.id },
                    data: {
                        name: serverName,
                        isDefault,
                        isActive: true,
                        credentials: encryptedCredentials
                            ? JSON.parse(JSON.stringify(encryptedCredentials))
                            : undefined,
                        metadata: JSON.parse(JSON.stringify(metadata))
                    }
                });
                updatedConnections.push(updated.id);
                seenConnectionIds.add(updated.id);
            } else {
                const created = await tx.integrationConnection.create({
                    data: {
                        providerId: provider.id,
                        organizationId,
                        userId: null,
                        scope: "org",
                        name: serverName,
                        isDefault,
                        isActive: true,
                        credentials: encryptedCredentials
                            ? JSON.parse(JSON.stringify(encryptedCredentials))
                            : undefined,
                        metadata: JSON.parse(JSON.stringify(metadata))
                    }
                });
                createdConnections.push(created.id);
                seenConnectionIds.add(created.id);
            }
        }

        if (mode === "replace") {
            for (const connection of existingConnections) {
                if (seenConnectionIds.has(connection.id)) {
                    continue;
                }
                await tx.integrationConnection.update({
                    where: { id: connection.id },
                    data: { isActive: false, isDefault: false }
                });
                disabledConnections.push(connection.id);
            }
        }
    });

    resetMcpClients();
    invalidateMcpCacheForOrg(organizationId);
    await invalidateMcpToolsCache(organizationId);

    return {
        createdProviders,
        updatedProviders,
        createdConnections,
        updatedConnections,
        disabledConnections,
        warnings
    };
}

export async function analyzeMcpConfigImpact(options: {
    organizationId: string;
    userId?: string | null;
    config: McpJsonConfigFile;
    mode?: "replace" | "merge";
}): Promise<McpConfigImpact> {
    const { organizationId, userId, config, mode = "replace" } = options;
    if (!config || typeof config !== "object" || !config.mcpServers) {
        throw new Error("Invalid MCP config: missing mcpServers");
    }
    if (typeof config.mcpServers !== "object" || Array.isArray(config.mcpServers)) {
        throw new Error("Invalid MCP config: mcpServers must be an object");
    }

    await ensureIntegrationProviders();

    const providers = await prisma.integrationProvider.findMany({
        where: { isActive: true }
    });
    const providersByKey = new Map(providers.map((provider) => [provider.key, provider]));

    const existingConnections = await prisma.integrationConnection.findMany({
        where: {
            organizationId,
            isActive: true,
            OR: [{ scope: "org" }, ...(userId ? [{ scope: "user", userId }] : [])],
            provider: { providerType: { in: ["mcp", "custom"] } }
        },
        include: { provider: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });

    const connectionMatchMap = new Map<string, ConnectionWithProvider>();
    for (const connection of existingConnections) {
        const metadata =
            connection.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : null;
        const serverName =
            metadata && typeof metadata.mcpServerName === "string"
                ? metadata.mcpServerName
                : connection.name;
        const matchKey = `${connection.provider.key}::${serverName.toLowerCase()}`;
        if (!connectionMatchMap.has(matchKey)) {
            connectionMatchMap.set(matchKey, connection);
        }
    }

    const seenConnectionIds = new Set<string>();
    const serversToAdd = new Set<string>();
    const serversToUpdate = new Set<string>();

    for (const [serverName, rawServerConfig] of Object.entries(config.mcpServers)) {
        const serverConfig = normalizeMcpServerConfig(rawServerConfig);
        if (!serverConfig) {
            continue;
        }

        let provider =
            providersByKey.get(serverName) ??
            resolveProviderForServer(providers, serverName, serverConfig);

        if (!provider) {
            serversToAdd.add(serverName);
            continue;
        }

        const matchKey = `${provider.key}::${serverName.toLowerCase()}`;
        const existing = connectionMatchMap.get(matchKey);

        if (existing) {
            seenConnectionIds.add(existing.id);
            serversToUpdate.add(serverName);
        } else {
            serversToAdd.add(serverName);
        }
    }

    const connectionsByProvider = new Map<string, ConnectionWithProvider[]>();
    for (const connection of existingConnections) {
        const list = connectionsByProvider.get(connection.provider.key) ?? [];
        list.push(connection);
        connectionsByProvider.set(connection.provider.key, list);
    }

    const connectionServerIds = new Map<string, string>();
    for (const [providerKey, providerConnections] of connectionsByProvider.entries()) {
        const defaultConnection =
            providerConnections.find((conn) => conn.isDefault) ?? providerConnections[0];
        for (const connection of providerConnections) {
            const isDefault = connection.id === defaultConnection?.id;
            connectionServerIds.set(
                connection.id,
                resolveServerId(providerKey, connection, isDefault)
            );
        }
    }

    const serversToDisable: McpConfigImpactServer[] =
        mode === "replace"
            ? existingConnections
                  .filter((connection) => !seenConnectionIds.has(connection.id))
                  .map((connection) => {
                      const metadata =
                          connection.metadata && typeof connection.metadata === "object"
                              ? (connection.metadata as Record<string, unknown>)
                              : null;
                      const serverName =
                          metadata && typeof metadata.mcpServerName === "string"
                              ? metadata.mcpServerName
                              : connection.name;
                      return {
                          serverKey:
                              connectionServerIds.get(connection.id) ?? connection.provider.key,
                          serverName,
                          affectedAgents: []
                      };
                  })
            : [];

    const serverKeys = Array.from(new Set(serversToDisable.map((server) => server.serverKey)));
    const agentScopeFilter = {
        isActive: true,
        OR: [{ workspace: { organizationId } }, { tenantId: organizationId }]
    };

    const toolMatches =
        serverKeys.length > 0
            ? await prisma.agentTool.findMany({
                  where: {
                      agent: agentScopeFilter,
                      OR: serverKeys.map((serverKey) => ({
                          toolId: { startsWith: `${serverKey}_` }
                      }))
                  },
                  select: {
                      toolId: true,
                      agentId: true,
                      agent: { select: { id: true, slug: true, name: true } }
                  }
              })
            : [];

    const explicitAgentsByServer = new Map<
        string,
        Map<string, { id: string; slug: string; name: string; toolCount: number }>
    >();

    for (const match of toolMatches) {
        const serverKey = serverKeys.find((key) => match.toolId.startsWith(`${key}_`));
        if (!serverKey) {
            continue;
        }
        const agentsForServer = explicitAgentsByServer.get(serverKey) ?? new Map();
        const existing = agentsForServer.get(match.agentId);
        if (existing) {
            existing.toolCount += 1;
        } else {
            agentsForServer.set(match.agentId, {
                id: match.agent.id,
                slug: match.agent.slug,
                name: match.agent.name,
                toolCount: 1
            });
        }
        explicitAgentsByServer.set(serverKey, agentsForServer);
    }

    const mcpEnabledAgents = await prisma.agent.findMany({
        where: {
            ...agentScopeFilter,
            metadata: { path: ["mcpEnabled"], equals: true }
        },
        select: { id: true, slug: true, name: true }
    });

    const totalAffectedAgentIds = new Set<string>();

    for (const server of serversToDisable) {
        const affectedAgents: McpConfigImpactAgent[] = [];
        const explicitAgents = explicitAgentsByServer.get(server.serverKey);
        if (explicitAgents) {
            for (const agent of explicitAgents.values()) {
                affectedAgents.push({
                    id: agent.id,
                    slug: agent.slug,
                    name: agent.name,
                    toolCount: agent.toolCount,
                    reason: "explicit"
                });
                totalAffectedAgentIds.add(agent.id);
            }
        }

        const explicitAgentIds = new Set(explicitAgents?.keys() ?? []);
        for (const agent of mcpEnabledAgents) {
            if (explicitAgentIds.has(agent.id)) {
                continue;
            }
            affectedAgents.push({
                id: agent.id,
                slug: agent.slug,
                name: agent.name,
                toolCount: 0,
                reason: "mcpEnabled"
            });
            totalAffectedAgentIds.add(agent.id);
        }

        server.affectedAgents = affectedAgents;
    }

    return {
        serversToDisable,
        serversToAdd: Array.from(serversToAdd),
        serversToUpdate: Array.from(serversToUpdate),
        totalAffectedAgents: totalAffectedAgentIds.size,
        hasImpact: serversToDisable.length > 0 && totalAffectedAgentIds.size > 0
    };
}

export type McpServerTestPhase = {
    name: "config_validation" | "process_spawn" | "server_init" | "tool_list";
    status: "pass" | "fail";
    ms: number;
    detail: string;
};

export type McpServerTestResult = {
    success: boolean;
    phases: McpServerTestPhase[];
    toolCount?: number;
    sampleTools?: string[];
    totalMs: number;
};

const formatTestError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("enoent")) {
        return `${message}. Command not found. Check that required binaries are installed.`;
    }
    if (lower.includes("timeout")) {
        return `${message}. The server did not respond in time.`;
    }
    return message;
};

export async function testMcpServer(options: {
    serverId: string;
    organizationId?: string | null;
    userId?: string | null;
    timeoutMs?: number;
    allowEnvFallback?: boolean;
}): Promise<McpServerTestResult> {
    const start = Date.now();
    const phases: McpServerTestPhase[] = [];

    const resolved = await resolveServerDefinitionById(options);
    if (!resolved?.serverDefinition) {
        phases.push({
            name: "config_validation",
            status: "fail",
            ms: 0,
            detail: "Server definition could not be resolved. Check credentials and config."
        });
        return {
            success: false,
            phases,
            totalMs: Date.now() - start
        };
    }

    phases.push({
        name: "config_validation",
        status: "pass",
        ms: 0,
        detail: "Server definition resolved"
    });

    const client = new MCPClient({
        id: `mastra-mcp-test-${options.serverId}`,
        servers: { [options.serverId]: resolved.serverDefinition },
        timeout: options.timeoutMs ?? 10000
    });

    const listStart = Date.now();
    try {
        const tools = await client.listTools();
        const listMs = Date.now() - listStart;
        const toolNames = Object.keys(tools);
        phases.push({
            name: "process_spawn",
            status: "pass",
            ms: 0,
            detail: "Process spawn initiated"
        });
        phases.push({
            name: "server_init",
            status: "pass",
            ms: listMs,
            detail: "MCP handshake complete"
        });
        phases.push({
            name: "tool_list",
            status: "pass",
            ms: 0,
            detail: `Found ${toolNames.length} tools`
        });
        return {
            success: true,
            phases,
            toolCount: toolNames.length,
            sampleTools: toolNames.slice(0, 5),
            totalMs: Date.now() - start
        };
    } catch (error) {
        const listMs = Date.now() - listStart;
        phases.push({
            name: "server_init",
            status: "fail",
            ms: listMs,
            detail: formatTestError(error)
        });
        return {
            success: false,
            phases,
            totalMs: Date.now() - start
        };
    } finally {
        await client.disconnect();
    }
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

const MAX_MCP_RESULT_CHARS = 12_000;

/**
 * Truncate an MCP tool result to prevent context explosion in multi-step runs.
 * Handles both string and object results safely.
 */
export function truncateMcpResult(
    result: unknown,
    maxChars: number = MAX_MCP_RESULT_CHARS
): unknown {
    if (result === null || result === undefined) return result;

    const serialized = typeof result === "string" ? result : JSON.stringify(result);
    if (serialized.length <= maxChars) return result;

    if (typeof result === "string") {
        return (
            result.substring(0, maxChars) +
            `\n...[truncated, ${serialized.length - maxChars} chars omitted]`
        );
    }

    // For objects, truncate the serialized form and return a wrapper
    const truncatedStr = serialized.substring(0, maxChars);
    return {
        _truncated: true,
        _originalLength: serialized.length,
        data: truncatedStr
    };
}

export async function executeMcpTool(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
        organizationId?: string | null;
        userId?: string | null;
        connectionId?: string | null;
        accessLevel?: "public" | "authenticated" | "member" | "admin" | "owner";
        timeoutMs?: number;
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

        // ACL enforcement: check tool access level when called internally by agents
        if (options?.accessLevel) {
            const adminToolPattern =
                /^(agent-delete|workflow-delete|network-delete|destroy-resource|teardown-compute|agent-create|agent-update|workflow-create|workflow-update|network-create|network-update|execute-code|remote-execute|remote-file-transfer|provision-compute)$/i;
            const memberToolPattern = /^(agent\.|instance\.|workflow-|network-)/;

            let requiredLevel: "public" | "authenticated" | "member" | "admin" | "owner" = "member";
            if (adminToolPattern.test(matchedName)) requiredLevel = "admin";
            else if (memberToolPattern.test(matchedName)) requiredLevel = "member";

            const levels = ["public", "authenticated", "member", "admin", "owner"] as const;
            const callerIdx = levels.indexOf(options.accessLevel);
            const requiredIdx = levels.indexOf(requiredLevel);
            if (callerIdx < requiredIdx) {
                return {
                    success: false,
                    toolName: matchedName,
                    error: `Insufficient access: tool "${matchedName}" requires ${requiredLevel}, caller has ${options.accessLevel}`
                };
            }
        }

        // Parameter validation: if the tool has an inputSchema, validate params against it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolObj = tool as any;
        if (toolObj.inputSchema || toolObj.schema?.input) {
            const schema = toolObj.inputSchema || toolObj.schema?.input;
            if (schema && typeof schema.safeParse === "function") {
                const validation = schema.safeParse(parameters);
                if (!validation.success) {
                    return {
                        success: false,
                        toolName: matchedName,
                        error: `Invalid parameters: ${validation.error?.issues?.map((i: { message: string }) => i.message).join(", ") || "validation failed"}`
                    };
                }
            }
        }

        // Execute with timeout
        const timeoutMs = options?.timeoutMs ?? 60_000;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const executePromise = (tool as any).execute({ context: parameters });
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)),
                timeoutMs
            )
        );
        const result = await Promise.race([executePromise, timeoutPromise]);

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
            result: truncateMcpResult(result)
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
 * List all available MCP tool definitions with per-server error isolation.
 *
 * Returns tool metadata suitable for configuring external systems
 * like ElevenLabs webhook tools. One failing server does not block others.
 */
export async function listMcpToolDefinitions(
    organizationIdOrOptions?:
        | string
        | null
        | { organizationId?: string | null; userId?: string | null }
): Promise<{ definitions: McpToolDefinition[]; serverErrors: Record<string, string> }> {
    // Reuse getMcpTools so we benefit from the per-server results cache
    const { tools, serverErrors } = await getMcpTools(organizationIdOrOptions);
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

    return { definitions, serverErrors };
}

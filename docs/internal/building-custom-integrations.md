# Building Custom Integrations (Internal)

> **Internal Documentation** — This document covers how to build custom MCP and OAuth integrations by modifying the AgentC2 monorepo. Not published to the public documentation site.

---

## Overview

AgentC2 supports two integration architectures:

1. **MCP Integrations** — External tools exposed via the Model Context Protocol. The MCP client connects to stdio or SSE-based MCP servers and dynamically discovers tools.
2. **OAuth/Custom Integrations** — Native integrations built directly into the platform with first-class OAuth flows, encrypted credential storage, and purpose-built tools.

### Integration Architecture

```
┌─────────────────────────────────────────────────┐
│                  Agent Runtime                    │
│                                                   │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Tool         │  │  MCP Client               │  │
│  │  Registry     │  │  (packages/agentc2/src/    │  │
│  │  (registry.ts)│  │   mcp/client.ts)          │  │
│  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                      │                   │
│  ┌──────▼───────┐  ┌──────────▼───────────────┐  │
│  │  Native Tools │  │  MCP Servers              │  │
│  │  (Gmail,      │  │  (HubSpot, Jira,          │  │
│  │   Calendar,   │  │   Firecrawl, Playwright,  │  │
│  │   Dropbox...) │  │   Slack, GitHub...)       │  │
│  └──────────────┘  └─────────────────────────┘  │
│                                                   │
│  Credentials: AES-256-GCM encrypted in           │
│  IntegrationConnection.credentials                │
└─────────────────────────────────────────────────┘
```

### Key Files

| File                                       | Purpose                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| `packages/agentc2/src/mcp/client.ts`        | MCP client, server definitions, `INTEGRATION_PROVIDER_SEEDS` |
| `packages/agentc2/src/tools/registry.ts`    | Tool registry, `toolRegistry`, `toolCategoryMap`             |
| `packages/agentc2/src/crypto/encryption.ts` | Credential encryption/decryption                             |
| `packages/database/prisma/schema.prisma`   | `IntegrationProvider`, `IntegrationConnection` models        |

---

## Build Checklist

Use this checklist when adding a new integration:

- [ ] Decide: MCP or OAuth/Custom integration
- [ ] Add `IntegrationProviderSeed` to `INTEGRATION_PROVIDER_SEEDS` in `mcp/client.ts`
- [ ] (MCP) Configure server command/args/env or SSE URL
- [ ] (OAuth) Implement OAuth start/callback routes
- [ ] (OAuth) Implement tool functions in `packages/agentc2/src/tools/`
- [ ] Register tools in `toolRegistry` in `registry.ts`
- [ ] Add tools to `toolCategoryMap` in `registry.ts`
- [ ] (If MCP-exposed) Add MCP schema in `tools/mcp-schemas/`
- [ ] Test tool execution end-to-end
- [ ] Update Workspace Concierge agent with new tool IDs
- [ ] Run parity check: `bun run scripts/check-tool-parity.ts --skip-api`

---

## MCP Server Integration

### Adding an MCP Server

#### Step 1: Add to `INTEGRATION_PROVIDER_SEEDS`

In `packages/agentc2/src/mcp/client.ts`, add a new entry to the `INTEGRATION_PROVIDER_SEEDS` array:

```typescript
const INTEGRATION_PROVIDER_SEEDS: IntegrationProviderSeed[] = [
    // ... existing entries ...
    {
        key: "my-new-server",
        name: "My New Server",
        description: "What this server does",
        category: "productivity", // "web" | "crm" | "productivity" | "communication" | "automation" | "knowledge"
        authType: "apiKey", // "none" | "apiKey" | "oauth2"
        providerType: "mcp",
        configJson: {
            requiredFields: ["MY_SERVER_API_KEY"],
            fieldDefinitions: {
                MY_SERVER_API_KEY: {
                    label: "API Key",
                    description: "Get your API key from the dashboard",
                    placeholder: "sk-...",
                    type: "password"
                }
            },
            importHints: {
                matchNames: ["My Server", "my-server"],
                matchArgs: ["@my-org/mcp-server"],
                envAliases: {
                    MY_SERVER_API_KEY: "MY_SERVER_API_KEY"
                }
            }
        }
    }
];
```

#### IntegrationProviderSeed Type

```typescript
type IntegrationProviderSeed = {
    key: string; // Unique identifier (e.g., "hubspot")
    name: string; // Display name
    description: string; // Short description
    category: "web" | "crm" | "productivity" | "communication" | "automation" | "knowledge";
    authType: "none" | "apiKey" | "oauth2";
    providerType: "mcp" | "custom";
    maturityLevel?: "internal"; // Hide from public UI
    configJson?: Prisma.InputJsonValue; // Provider configuration
    actionsJson?: Prisma.InputJsonValue; // Available actions metadata
    triggersJson?: Prisma.InputJsonValue; // Available triggers metadata
};
```

#### Configuration Schema (`configJson`)

```typescript
configJson: {
    // Required credential fields
    requiredFields: ["API_KEY", "WORKSPACE_URL"],

    // Field display definitions
    fieldDefinitions: {
        API_KEY: {
            label: "API Key",
            description: "Your API key",
            placeholder: "sk-...",
            type: "password"       // "password" | "text" | "url"
        },
        WORKSPACE_URL: {
            label: "Workspace URL",
            description: "Your workspace URL",
            placeholder: "https://your-org.example.com",
            type: "url"
        }
    },

    // Import hints for auto-detecting servers from MCP JSON config files
    importHints: {
        matchNames: ["My Server", "my-server"],
        matchArgs: ["@my-org/mcp-server", "mcp-server-mine"],
        envAliases: {
            API_KEY: "MY_SERVER_API_KEY"
        }
    }
}
```

#### Step 2: Provider Seeding

Providers are automatically seeded to the database when the MCP client initializes:

```typescript
async function _doEnsureIntegrationProviders() {
    for (const seed of INTEGRATION_PROVIDER_SEEDS) {
        await prisma.integrationProvider.upsert({
            where: { key: seed.key },
            update: {
                // Does not overwrite name/description so imported config
                // or server-provided metadata can persist
                category: seed.category,
                authType: seed.authType,
                providerType: seed.providerType,
                configJson: seed.configJson ?? undefined
                // ...
            },
            create: {
                key: seed.key,
                name: seed.name,
                description: seed.description,
                category: seed.category,
                authType: seed.authType,
                providerType: seed.providerType,
                configJson: seed.configJson ?? undefined
                // ...
            }
        });
    }
}
```

#### Step 3: MCP Server Definition

The MCP client builds server definitions from `IntegrationConnection` records in the database. For stdio-based servers:

```typescript
type McpJsonServerConfig = {
    command?: string; // e.g., "npx"
    args?: string[]; // e.g., ["-y", "@hubspot/mcp-server"]
    env?: Record<string, string>; // Environment variables
    url?: string; // SSE endpoint URL (for SSE-based servers)
    headers?: Record<string, string>; // HTTP headers (for SSE)
};
```

**Examples of existing server definitions:**

```typescript
// Stdio-based (HubSpot)
{
    key: "hubspot",
    command: "npx",
    args: ["-y", "@hubspot/mcp-server"],
    env: { PRIVATE_APP_ACCESS_TOKEN: "pat-na1-..." }
}

// Stdio-based (Playwright)
{
    key: "playwright",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest", "--headless"]
}

// SSE-based (ATLAS/n8n)
{
    key: "atlas",
    url: "https://your-n8n.app.n8n.cloud/mcp/.../sse"
}
```

### Existing MCP Providers

```typescript
const INTEGRATION_PROVIDER_SEEDS: IntegrationProviderSeed[] = [
    {
        key: "playwright",
        name: "Playwright",
        description: "Browser automation - navigate, click, screenshot, interact with web pages",
        category: "web",
        authType: "none",
        providerType: "mcp"
    },
    {
        key: "youtube-transcript",
        name: "YouTube Transcript",
        description: "Extract transcripts and captions from YouTube videos",
        category: "knowledge",
        authType: "none",
        providerType: "mcp"
    },
    {
        key: "firecrawl",
        name: "Firecrawl",
        description: "Web scraping and crawling - extract data from websites",
        category: "web",
        authType: "apiKey",
        providerType: "mcp"
    },
    {
        key: "hubspot",
        name: "HubSpot",
        description: "CRM integration - contacts, companies, deals, and pipeline",
        category: "crm",
        authType: "apiKey",
        providerType: "mcp"
    }
    // ... jira, justcall, fathom, atlas, slack, google-drive, github ...
];
```

### Per-Organization MCP Connections

Each organization can have its own set of MCP connections with separate credentials:

```
IntegrationProvider (platform-level)
    └── IntegrationConnection (per-organization)
            ├── credentials (AES-256-GCM encrypted)
            ├── configJson (server command/args/url)
            └── status (active, disabled, error)
```

The MCP client caches connections per-organization with a 60-second TTL and 10-minute stale fallback.

---

## OAuth Integration

### Architecture

OAuth integrations follow this pattern:

1. **Start route** — Generates OAuth URL with PKCE, redirects user
2. **Callback route** — Exchanges auth code for tokens, encrypts and stores
3. **Token refresh** — Automatic refresh before expiry via Inngest background job
4. **Tool functions** — Native tools that use the stored tokens

### OAuth Flow Implementation

#### Start Route

```typescript
// apps/agent/src/app/api/integrations/[provider]/start/route.ts

export async function GET(req: NextRequest) {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const state = crypto.randomBytes(32).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

    // Store state + verifier in session/database
    await prisma.oauthState.create({
        data: {
            state,
            codeVerifier,
            userId: session.user.id,
            organizationId: session.organizationId,
            provider: "my-provider",
            expiresAt: new Date(Date.now() + 600000) // 10 min
        }
    });

    const authUrl = new URL("https://provider.com/oauth2/authorize");
    authUrl.searchParams.set("client_id", process.env.MY_PROVIDER_CLIENT_ID!);
    authUrl.searchParams.set("redirect_uri", `${appUrl}/api/integrations/my-provider/callback`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "read write");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authUrl.toString());
}
```

#### Callback Route

```typescript
// apps/agent/src/app/api/integrations/[provider]/callback/route.ts

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Verify state
    const oauthState = await prisma.oauthState.findUnique({ where: { state } });
    if (!oauthState || oauthState.expiresAt < new Date()) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://provider.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${appUrl}/api/integrations/my-provider/callback`,
            client_id: process.env.MY_PROVIDER_CLIENT_ID!,
            client_secret: process.env.MY_PROVIDER_CLIENT_SECRET!,
            code_verifier: oauthState.codeVerifier
        })
    });

    const tokens = await tokenResponse.json();

    // Encrypt and store credentials
    const encryptedCredentials = encryptJson({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        token_type: tokens.token_type
    });

    await prisma.integrationConnection.upsert({
        where: {
            organizationId_providerKey: {
                organizationId: oauthState.organizationId,
                providerKey: "my-provider"
            }
        },
        update: {
            credentials: encryptedCredentials,
            status: "active",
            lastValidatedAt: new Date()
        },
        create: {
            organizationId: oauthState.organizationId,
            providerKey: "my-provider",
            credentials: encryptedCredentials,
            status: "active"
        }
    });

    // Cleanup state
    await prisma.oauthState.delete({ where: { state } });

    return NextResponse.redirect(`${appUrl}/settings/integrations?connected=my-provider`);
}
```

---

## Tool Registration

### Step 1: Create Tool Functions

Create tool files in `packages/agentc2/src/tools/`:

```typescript
// packages/agentc2/src/tools/my-provider/actions.ts

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";
import { decryptJson } from "../crypto";

export const myProviderListItemsTool = createTool({
    id: "my-provider-list-items",
    description: "List items from My Provider",
    inputSchema: z.object({
        limit: z.number().optional().default(20),
        query: z.string().optional()
    }),
    outputSchema: z.object({
        items: z.array(
            z.object({
                id: z.string(),
                name: z.string()
                // ...
            })
        ),
        total: z.number()
    }),
    execute: async ({ context, ...input }) => {
        const organizationId = context?.organizationId;
        if (!organizationId) throw new Error("Organization context required");

        // Load and decrypt credentials
        const connection = await prisma.integrationConnection.findUnique({
            where: {
                organizationId_providerKey: {
                    organizationId,
                    providerKey: "my-provider"
                }
            }
        });

        if (!connection) throw new Error("My Provider not connected");

        const creds = decryptJson(connection.credentials);
        if (!creds?.access_token) throw new Error("Invalid credentials");

        // Make API call
        const response = await fetch("https://api.my-provider.com/items", {
            headers: {
                Authorization: `Bearer ${creds.access_token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        return { items: data.items, total: data.total };
    }
});
```

### Step 2: Register in `toolRegistry`

In `packages/agentc2/src/tools/registry.ts`:

```typescript
import { myProviderListItemsTool, myProviderGetItemTool } from "./my-provider/actions";

// Add to toolRegistry
export const toolRegistry: Record<string, any> = {
    // ... existing tools ...

    // My Provider
    "my-provider-list-items": myProviderListItemsTool,
    "my-provider-get-item": myProviderGetItemTool
};
```

### Step 3: Add to `toolCategoryMap`

```typescript
export const toolCategoryMap: Record<string, string> = {
    // ... existing categories ...

    // My Provider
    "my-provider-list-items": "My Provider",
    "my-provider-get-item": "My Provider"
};
```

### Step 4: Export from Package

In `packages/agentc2/src/index.ts`, ensure the tools are exported:

```typescript
export { myProviderListItemsTool, myProviderGetItemTool } from "./tools/my-provider/actions";
```

---

## Error Handling Patterns

### Credential Validation

```typescript
async function getValidCredentials(organizationId: string, providerKey: string) {
    const connection = await prisma.integrationConnection.findUnique({
        where: {
            organizationId_providerKey: { organizationId, providerKey }
        }
    });

    if (!connection) {
        throw new Error(`${providerKey} not connected. Please connect in Settings > Integrations.`);
    }

    if (connection.status === "disabled") {
        throw new Error(`${providerKey} connection is disabled.`);
    }

    const creds = decryptJson(connection.credentials) as Record<string, unknown>;
    if (!creds?.access_token) {
        throw new Error(`${providerKey} credentials are invalid. Please reconnect.`);
    }

    // Check token expiry for OAuth integrations
    const expiresAt = creds.expires_at as number | undefined;
    if (expiresAt && Date.now() > expiresAt) {
        // Attempt refresh
        const refreshed = await refreshToken(connection, creds);
        if (!refreshed) {
            throw new Error(`${providerKey} token expired. Please reconnect.`);
        }
        return refreshed;
    }

    return creds;
}
```

### API Error Handling

```typescript
async function callProviderApi(url: string, token: string) {
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
        throw new Error("Authentication failed. Token may be expired or revoked.");
    }

    if (response.status === 403) {
        throw new Error("Insufficient permissions. Check your OAuth scopes.");
    }

    if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(`Rate limited. Retry after ${retryAfter || "60"} seconds.`);
    }

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`API error (${response.status}): ${body.slice(0, 200)}`);
    }

    return response.json();
}
```

### MCP Tool Error Handling

MCP tools include automatic error handling at the client level:

```typescript
// In mcp/client.ts - per-server tool loading with fallback
const perServerToolsCache = new Map<
    string,
    {
        tools: Record<string, any>;
        serverErrors: Record<string, string>;
        loadedAt: number;
    }
>();

const lastKnownGoodTools = new Map<
    string,
    {
        tools: Record<string, any>;
        loadedAt: number;
    }
>();
```

If a server fails to load tools on refresh, the client falls back to last-known-good cached tools from a previous successful load.

---

## Testing Strategy

### Unit Testing Tools

```typescript
import { myProviderListItemsTool } from "./my-provider/actions";

describe("myProviderListItemsTool", () => {
    it("should list items with valid credentials", async () => {
        // Mock Prisma and API calls
        const result = await myProviderListItemsTool.execute({
            limit: 10,
            context: { organizationId: "test-org" }
        });

        expect(result.items).toBeDefined();
        expect(result.total).toBeGreaterThan(0);
    });
});
```

### Integration Testing

```bash
# Test MCP server manually
npx -y @hubspot/mcp-server --help

# List available tools from an MCP server
import { getMcpTools } from "@repo/agentc2/mcp/client";
const tools = await getMcpTools("hubspot");
console.log(Object.keys(tools));
```

### Tool Parity Check

Run the parity check script to confirm all tools are registered consistently:

```bash
# Local check (registry vs MCP schema)
bun run scripts/check-tool-parity.ts --skip-api

# Full check (includes live Concierge agent)
bun run scripts/check-tool-parity.ts
```

The script exits with code 1 if gaps are found between:

- `toolRegistry` in `registry.ts`
- `toolCategoryMap` in `registry.ts`
- MCP schema definitions in `tools/mcp-schemas/`
- Workspace Concierge agent tool list

---

## MCP Client Caching Architecture

The MCP client uses a multi-layer caching strategy:

| Cache                 | TTL                   | Purpose                          |
| --------------------- | --------------------- | -------------------------------- |
| `orgMcpClients`       | 60s fresh, 600s stale | Per-org MCPClient instances      |
| `perServerToolsCache` | 60s                   | Per-server tool definitions      |
| `lastKnownGoodTools`  | Indefinite            | Fallback for failed server loads |

### Cache Invalidation

```typescript
// Invalidate cache for a specific organization
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

// Reset all caches (nuclear option)
export function resetMcpClients() {
    orgMcpClients.clear();
    perServerToolsCache.clear();
    lastKnownGoodTools.clear();
    global.mcpClient = undefined;
}
```

### Schema Sanitization

The client patches `InternalMastraMCPClient.convertInputSchema` to sanitize MCP server JSON schemas before Zod conversion. This fixes issues like HubSpot's `values` array missing `items` definitions:

```typescript
if (!global.__mcpSchemaPatched) {
    const proto = InternalMastraMCPClient.prototype as any;
    const originalConvert = proto.convertInputSchema;
    proto.convertInputSchema = async function (inputSchema: unknown) {
        if (
            inputSchema &&
            typeof inputSchema === "object" &&
            !Array.isArray(inputSchema) &&
            !(inputSchema as Record<string, unknown>)._def
        ) {
            inputSchema = sanitizeToolSchema(inputSchema);
        }
        return originalConvert.call(this, inputSchema);
    };
    global.__mcpSchemaPatched = true;
}
```

---

## Tool Resolution Flow

When an agent needs tools at runtime:

```typescript
// Synchronous (static tools only)
import { getToolsByNames } from "@repo/agentc2/tools/registry";
const tools = getToolsByNames(["calculator", "web-fetch"]);

// Async (static + MCP + federation tools)
import { getToolsByNamesAsync } from "@repo/agentc2/tools/registry";
const tools = await getToolsByNamesAsync(
    ["calculator", "hubspot_hubspot-get-contacts", "federation:partner-tool"],
    organizationId
);
```

The async version:

1. Resolves static tools from `toolRegistry`
2. Splits unresolved names into federation tools (`federation:*`) and MCP tools
3. Loads MCP tools from the cached MCP client for the organization
4. Loads federation tools from partner organizations
5. Returns the combined tool record

---

## Supadata (Custom Provider Example)

Supadata is an example of a `custom` provider (not MCP) with API key auth:

```typescript
{
    key: "supadata",
    name: "Supadata",
    description: "YouTube transcript extraction API",
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
}
```

Custom providers have their tools implemented natively in the tool registry rather than discovered dynamically via MCP.

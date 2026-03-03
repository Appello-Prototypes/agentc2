import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionHeader } from "@/components/website/sections/section-header";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { RelatedPages } from "@/components/website/sections/related-pages";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { McpIntegrationIllustration } from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "MCP Integration Guide — AgentC2",
    description:
        "The open standard for AI-to-tool communication. Connect 40+ built-in MCP servers, bring your own, and give every agent access to real-world tools.",
    path: "/developers/mcp",
    keywords: [
        "Model Context Protocol",
        "MCP integration",
        "AI tool connection",
        "MCP server",
        "agent tools"
    ]
});

const builtInServers = [
    {
        category: "CRM & Sales",
        servers: [
            {
                name: "HubSpot",
                tools: "Contacts, companies, deals, pipeline, owners",
                auth: "OAuth 2.0"
            },
            {
                name: "Salesforce",
                tools: "Leads, opportunities, accounts, reports",
                auth: "OAuth 2.0"
            }
        ]
    },
    {
        category: "Communication",
        servers: [
            {
                name: "Slack",
                tools: "Channels, messages, users, search, reactions",
                auth: "OAuth 2.0"
            },
            {
                name: "Gmail",
                tools: "Send, list, archive, search emails",
                auth: "Google OAuth"
            },
            {
                name: "Microsoft Outlook",
                tools: "Mail send, list, archive; Calendar CRUD",
                auth: "Azure AD OAuth"
            },
            {
                name: "JustCall",
                tools: "Call logs, SMS messaging, contact lookup",
                auth: "API Key"
            }
        ]
    },
    {
        category: "Productivity",
        servers: [
            {
                name: "Jira",
                tools: "Issues, sprints, boards, project tracking",
                auth: "API Token"
            },
            {
                name: "GitHub",
                tools: "Repos, issues, PRs, code search, actions",
                auth: "PAT"
            },
            {
                name: "Google Drive",
                tools: "File search, list, read Docs/Sheets/Slides",
                auth: "Google OAuth"
            },
            {
                name: "Dropbox",
                tools: "File list, read, upload, search, sharing",
                auth: "OAuth 2.0"
            }
        ]
    },
    {
        category: "Web & Data",
        servers: [
            {
                name: "Firecrawl",
                tools: "Web scraping, content extraction, crawling",
                auth: "API Key"
            },
            {
                name: "Playwright",
                tools: "Browser automation, screenshots, interaction",
                auth: "Local"
            }
        ]
    },
    {
        category: "Knowledge & Analytics",
        servers: [
            {
                name: "Fathom",
                tools: "Meeting recordings, transcripts, summaries",
                auth: "API Key"
            },
            {
                name: "ATLAS (n8n)",
                tools: "Workflow triggers, automation orchestration",
                auth: "SSE URL"
            }
        ]
    }
];

export default function McpPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Developers", href: "/developers" },
                        { label: "MCP Integration" }
                    ]}
                    currentPath="/developers/mcp"
                    className="mb-8"
                />
            </SectionWrapper>

            <PageHero
                overline="MCP Integration"
                title="The open standard for AI-to-tool communication"
                description="Model Context Protocol (MCP) is the universal interface between AI agents and external tools. AgentC2 ships with 40+ built-in MCP integrations and supports any custom MCP server you build or connect."
                primaryCta={{
                    label: "Browse Integrations",
                    href: "#built-in"
                }}
                secondaryCta={{
                    label: "Bring Your Own Server",
                    href: "#byos"
                }}
            >
                <McpIntegrationIllustration className="w-full max-w-md" />
            </PageHero>

            {/* What is MCP */}
            <SectionWrapper muted id="what-is-mcp">
                <SectionHeader
                    overline="The Protocol"
                    title="What is MCP?"
                    description="Model Context Protocol standardizes how AI models discover and invoke external tools — eliminating custom integration code for every service."
                />
                <div className="mt-12 grid gap-8 lg:grid-cols-3">
                    {[
                        {
                            title: "Universal Tool Interface",
                            description:
                                "MCP defines a standard JSON-RPC protocol for tool discovery, schema introspection, and execution. Any MCP-compliant server works with any MCP-compliant client — zero custom integration code."
                        },
                        {
                            title: "Schema-First Design",
                            description:
                                "Every MCP tool declares its input and output schemas upfront. Agents understand what parameters a tool expects, what it returns, and when to use it — all from the schema alone."
                        },
                        {
                            title: "Secure by Default",
                            description:
                                "MCP supports OAuth 2.0, API keys, and token-based authentication. Credentials are encrypted at rest (AES-256-GCM) and never exposed to the AI model."
                        }
                    ].map((item) => (
                        <div
                            key={item.title}
                            className="border-border/60 bg-card rounded-2xl border p-6"
                        >
                            <h3 className="text-foreground mb-2 text-lg font-semibold">
                                {item.title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* MCP in AgentC2 */}
            <SectionWrapper id="built-in">
                <SectionHeader
                    overline="Built-In Integrations"
                    title="40+ MCP servers, ready to go"
                    description="AgentC2 ships with pre-configured MCP servers for the most popular business tools. Connect with a single API key or OAuth flow."
                />
                <div className="mt-12 space-y-10">
                    {builtInServers.map((category) => (
                        <div key={category.category}>
                            <h3 className="text-foreground mb-4 text-lg font-semibold">
                                {category.category}
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {category.servers.map((server) => (
                                    <div
                                        key={server.name}
                                        className="border-border/60 bg-card rounded-2xl border p-5"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-foreground text-sm font-semibold">
                                                {server.name}
                                            </span>
                                            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                                                {server.auth}
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            {server.tools}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* Bring Your Own MCP Server */}
            <SectionWrapper muted id="byos">
                <SectionHeader
                    overline="Extensibility"
                    title="Bring your own MCP server"
                    description="Connect any MCP-compliant server to AgentC2. Point to a stdio binary, an SSE endpoint, or a Streamable HTTP URL — AgentC2 handles discovery, authentication, and tool routing."
                />
                <div className="mx-auto mt-12 max-w-3xl space-y-8">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            1. Define your server config
                        </h3>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
                            <code>{`// packages/agentc2/src/mcp/client.ts
{
  "my-custom-server": {
    // Option A: stdio transport
    command: "npx",
    args: ["-y", "@your-org/mcp-server"],
    env: {
      API_KEY: process.env.MY_SERVER_API_KEY
    },

    // Option B: SSE transport
    // url: "https://your-server.com/mcp/sse",

    // Option C: Streamable HTTP
    // url: "https://your-server.com/mcp",
  }
}`}</code>
                        </pre>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            2. Tools are automatically discovered
                        </h3>
                        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                            AgentC2 connects to your server, introspects all available tools via the
                            MCP protocol, and registers them in the tool registry. No manual schema
                            definition required.
                        </p>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
                            <code>{`import { listMcpToolDefinitions } from "@repo/agentc2";

const tools = await listMcpToolDefinitions();
// Includes tools from your custom server:
// "my-custom-server.list-items"
// "my-custom-server.create-item"
// "my-custom-server.update-item"`}</code>
                        </pre>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            3. Attach tools to agents
                        </h3>
                        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                            Assign MCP tools to any agent via the dashboard or the API. Agents can
                            use tools from multiple MCP servers in a single conversation.
                        </p>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
                            <code>{`// Attach via API
await fetch("/agent/api/agents/my-agent", {
  method: "PATCH",
  headers: { "Authorization": "Bearer YOUR_API_KEY" },
  body: JSON.stringify({
    tools: [
      "my-custom-server.list-items",
      "hubspot.get-contacts",
      "calculator"
    ]
  })
});`}</code>
                        </pre>
                    </div>
                </div>
            </SectionWrapper>

            {/* Using MCP Tools in Cursor */}
            <SectionWrapper id="cursor">
                <SectionHeader
                    overline="IDE Integration"
                    title="Using MCP tools in Cursor"
                    description="AgentC2 exposes your MCP tools as a Cursor-compatible MCP server. Your AI coding assistant can query your CRM, search documents, and trigger workflows — directly from the IDE."
                />
                <div className="mx-auto mt-12 max-w-3xl space-y-8">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            Add AgentC2 as a Cursor MCP server
                        </h3>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
                            <code>{`// .cursor/mcp.json
{
  "mcpServers": {
    "agentc2": {
      "url": "https://agentc2.ai/agent/api/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</code>
                        </pre>
                        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                            Once configured, Cursor&apos;s AI assistant can discover and invoke all
                            your AgentC2 tools — HubSpot lookups, Jira ticket creation, document
                            search, and any custom MCP tools you&apos;ve connected.
                        </p>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            Example prompts in Cursor
                        </h3>
                        <div className="space-y-3">
                            {[
                                "Look up the contact info for Acme Corp in HubSpot",
                                "Create a Jira ticket for the auth bug we just discussed",
                                "Search our knowledge base for the deployment runbook",
                                "Summarize the last 3 Fathom meeting transcripts"
                            ].map((prompt) => (
                                <div key={prompt} className="bg-muted/50 rounded-xl px-4 py-3">
                                    <p className="text-foreground text-sm">
                                        &ldquo;{prompt}&rdquo;
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionWrapper>

            {/* Tool Naming and Discovery */}
            <SectionWrapper muted id="tool-naming">
                <SectionHeader
                    overline="Tool Discovery"
                    title="Tool naming and discovery"
                    description="Every MCP tool follows a consistent naming convention that makes discovery predictable and programmatic."
                />
                <div className="mx-auto mt-12 max-w-3xl">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            Naming convention
                        </h3>
                        <div className="bg-muted/50 mb-6 rounded-xl p-4">
                            <code className="text-foreground text-sm font-medium">
                                {"{server-name}.{tool-name}"}
                            </code>
                            <p className="text-muted-foreground mt-2 text-xs">
                                The server name is the MCP server identifier. The tool name is
                                defined by the server itself.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                Examples
                            </h4>
                            {[
                                {
                                    tool: "hubspot.get-contacts",
                                    desc: "Fetch contacts from HubSpot CRM"
                                },
                                {
                                    tool: "jira.create-issue",
                                    desc: "Create a new Jira issue"
                                },
                                {
                                    tool: "firecrawl.scrape-url",
                                    desc: "Scrape and extract content from a URL"
                                },
                                {
                                    tool: "slack.post-message",
                                    desc: "Send a message to a Slack channel"
                                },
                                {
                                    tool: "github.search-code",
                                    desc: "Search code across GitHub repositories"
                                }
                            ].map((item) => (
                                <div key={item.tool} className="flex items-center gap-4 py-2">
                                    <code className="bg-muted/50 text-foreground shrink-0 rounded px-2 py-1 font-mono text-xs">
                                        {item.tool}
                                    </code>
                                    <span className="text-muted-foreground text-xs">
                                        {item.desc}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mx-auto mt-8 max-w-3xl">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            Programmatic discovery
                        </h3>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
                            <code>{`import {
  executeMcpTool,
  listMcpToolDefinitions
} from "@repo/agentc2";

// List all tools across all servers
const tools = await listMcpToolDefinitions();

// Each tool includes:
// - name: "hubspot.get-contacts"
// - description: "Fetch contacts from HubSpot"
// - inputSchema: { type: "object", properties: {...} }
// - serverName: "hubspot"

// Execute a specific tool
const contacts = await executeMcpTool(
  "hubspot.get-contacts",
  { limit: 10, properties: ["email", "name"] }
);`}</code>
                        </pre>
                    </div>
                </div>
            </SectionWrapper>

            {/* How MCP Flows Through AgentC2 */}
            <SectionWrapper id="architecture">
                <SectionHeader
                    overline="Architecture"
                    title="How MCP flows through AgentC2"
                    description="From agent prompt to tool execution — a complete picture of how MCP tools are discovered, resolved, and invoked at runtime."
                />
                <div className="mt-12">
                    <FeatureGrid
                        columns={4}
                        features={[
                            {
                                title: "1. Discovery",
                                description:
                                    "On startup, AgentC2 connects to every configured MCP server and introspects available tools via the MCP protocol."
                            },
                            {
                                title: "2. Registration",
                                description:
                                    "Discovered tools are registered in the unified tool registry with their schemas, descriptions, and server metadata."
                            },
                            {
                                title: "3. Resolution",
                                description:
                                    "When an agent runs, AgentC2 resolves its assigned tools from the registry and injects them into the LLM context."
                            },
                            {
                                title: "4. Execution",
                                description:
                                    "When the LLM calls a tool, AgentC2 routes the request to the correct MCP server, handles auth, and returns the result."
                            }
                        ]}
                    />
                </div>
            </SectionWrapper>

            {/* Security */}
            <SectionWrapper muted id="security">
                <SectionHeader
                    overline="Security"
                    title="Enterprise-grade credential management"
                    description="MCP server credentials are encrypted at rest, scoped per organization, and never exposed to AI models."
                />
                <div className="mt-12">
                    <FeatureGrid
                        columns={3}
                        features={[
                            {
                                title: "AES-256-GCM Encryption",
                                description:
                                    "All OAuth tokens and API keys are encrypted at rest using AES-256-GCM with a per-deployment encryption key."
                            },
                            {
                                title: "Automatic Token Refresh",
                                description:
                                    "OAuth integrations automatically refresh expired tokens. Your agents never fail due to stale credentials."
                            },
                            {
                                title: "Org-Scoped Access",
                                description:
                                    "Each organization has its own set of MCP credentials. Multi-tenant isolation ensures no cross-org data leakage."
                            }
                        ]}
                    />
                </div>
            </SectionWrapper>

            <CTABanner
                title="Connect your first MCP server"
                description="Choose from 40+ built-in integrations or connect your own MCP server in minutes. No custom integration code required."
                primaryCta={{ label: "Get Started Free", href: "/signup" }}
                secondaryCta={{
                    label: "API Reference",
                    href: "/developers/api"
                }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="Continue Exploring"
                    pages={[
                        {
                            title: "Developer Overview",
                            description:
                                "Platform capabilities, quick start guide, and architecture overview for building with AgentC2.",
                            href: "/developers"
                        },
                        {
                            title: "API Reference",
                            description:
                                "Complete REST API documentation for agents, workflows, networks, knowledge, and MCP tools.",
                            href: "/developers/api"
                        },
                        {
                            title: "Use Cases",
                            description:
                                "See how teams across Sales, Support, Engineering, and Operations use AgentC2 agents.",
                            href: "/use-cases"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}

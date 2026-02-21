import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
    // Namespace static assets so they don't clash with the agent app behind Caddy.
    // Caddy routes /_home/* to the frontend (port 3000).
    assetPrefix: "/_home",
    // Skip TypeScript checking in build -- verified by CI/local type-check
    typescript: {
        ignoreBuildErrors: true
    },
    env: sharedEnv,
    devIndicators,
    async headers() {
        const headersFn = createHeadersConfig();
        const baseHeaders = headersFn ? await headersFn() : [];

        // Add CORS headers for auth API in development to allow agent app access
        if (isDevelopment) {
            return [
                ...baseHeaders,
                {
                    source: "/api/auth/:path*",
                    headers: [
                        { key: "Access-Control-Allow-Origin", value: "http://localhost:3001" },
                        {
                            key: "Access-Control-Allow-Methods",
                            value: "GET, POST, PUT, DELETE, OPTIONS"
                        },
                        {
                            key: "Access-Control-Allow-Headers",
                            value: "Content-Type, Authorization, Cookie"
                        },
                        { key: "Access-Control-Allow-Credentials", value: "true" }
                    ]
                }
            ];
        }

        return baseHeaders;
    },
    async redirects() {
        return [
            // Skills section → merged into core-concepts/agents and api-reference/skills
            {
                source: "/docs/skills/overview",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/skills/creating-skills",
                destination: "/docs/api-reference/skills",
                permanent: true
            },
            {
                source: "/docs/skills/progressive-disclosure",
                destination: "/docs/api-reference/skills",
                permanent: true
            },
            {
                source: "/docs/skills/auto-generated-skills",
                destination: "/docs/api-reference/skills",
                permanent: true
            },
            {
                source: "/docs/skills/version-control",
                destination: "/docs/api-reference/skills",
                permanent: true
            },
            {
                source: "/docs/skills/api-reference",
                destination: "/docs/api-reference/skills",
                permanent: true
            },

            // Channels section → merged into guides and core-concepts
            {
                source: "/docs/channels/overview",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/channels/slack",
                destination: "/docs/guides/deploy-to-slack",
                permanent: true
            },
            {
                source: "/docs/channels/whatsapp",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/channels/telegram",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/channels/voice",
                destination: "/docs/guides/add-voice-to-your-agent",
                permanent: true
            },
            {
                source: "/docs/channels/embed",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },

            // Campaigns section → merged into api-reference/campaigns
            {
                source: "/docs/campaigns/overview",
                destination: "/docs/api-reference/campaigns",
                permanent: true
            },
            {
                source: "/docs/campaigns/creating-campaigns",
                destination: "/docs/api-reference/campaigns",
                permanent: true
            },
            {
                source: "/docs/campaigns/templates",
                destination: "/docs/api-reference/campaigns",
                permanent: true
            },
            {
                source: "/docs/campaigns/after-action-reviews",
                destination: "/docs/api-reference/campaigns",
                permanent: true
            },

            // Platform section → merged into workspace/overview
            {
                source: "/docs/platform/multi-tenancy",
                destination: "/docs/workspace/overview",
                permanent: true
            },
            {
                source: "/docs/platform/federation",
                destination: "/docs/workspace/overview",
                permanent: true
            },
            {
                source: "/docs/platform/observability",
                destination: "/docs/workspace/overview",
                permanent: true
            },
            {
                source: "/docs/platform/triggers-and-schedules",
                destination: "/docs/workspace/overview",
                permanent: true
            },

            // Agents section → merged into core-concepts/agents and workspace/managing-agents
            {
                source: "/docs/agents/overview",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/agents/creating-agents",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/agents/configuration",
                destination: "/docs/workspace/managing-agents",
                permanent: true
            },
            {
                source: "/docs/agents/tools",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/agents/memory",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/agents/model-providers",
                destination: "/docs/core-concepts/agents",
                permanent: true
            },
            {
                source: "/docs/agents/evaluations",
                destination: "/docs/api-reference/agents",
                permanent: true
            },
            {
                source: "/docs/agents/version-control",
                destination: "/docs/workspace/managing-agents",
                permanent: true
            },
            {
                source: "/docs/agents/budgets-and-costs",
                destination: "/docs/workspace/managing-agents",
                permanent: true
            },
            {
                source: "/docs/agents/learning",
                destination: "/docs/guides/continuous-learning-setup",
                permanent: true
            },
            {
                source: "/docs/agents/simulations",
                destination: "/docs/workspace/managing-agents",
                permanent: true
            },
            {
                source: "/docs/agents/output-actions",
                destination: "/docs/workspace/managing-agents",
                permanent: true
            },
            {
                source: "/docs/agents/public-embedding",
                destination: "/docs/workspace/managing-agents",
                permanent: true
            },
            {
                source: "/docs/agents/guardrails",
                destination: "/docs/guides/production-guardrails",
                permanent: true
            },
            {
                source: "/docs/agents/api-reference",
                destination: "/docs/api-reference/agents",
                permanent: true
            },

            // Networks section → merged into core-concepts/networks
            {
                source: "/docs/networks/overview",
                destination: "/docs/core-concepts/networks",
                permanent: true
            },
            {
                source: "/docs/networks/creating-networks",
                destination: "/docs/core-concepts/networks",
                permanent: true
            },
            {
                source: "/docs/networks/topology",
                destination: "/docs/core-concepts/networks",
                permanent: true
            },
            {
                source: "/docs/networks/ai-assisted-design",
                destination: "/docs/core-concepts/networks",
                permanent: true
            },
            {
                source: "/docs/networks/version-control",
                destination: "/docs/core-concepts/networks",
                permanent: true
            },
            {
                source: "/docs/networks/api-reference",
                destination: "/docs/api-reference/networks",
                permanent: true
            },

            // Workflows section → merged into core-concepts/workflows
            {
                source: "/docs/workflows/overview",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/creating-workflows",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/step-types",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/control-flow",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/human-in-the-loop",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/ai-assisted-design",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/version-control",
                destination: "/docs/core-concepts/workflows",
                permanent: true
            },
            {
                source: "/docs/workflows/api-reference",
                destination: "/docs/api-reference/workflows",
                permanent: true
            },

            // Knowledge section → merged into core-concepts/knowledge
            {
                source: "/docs/knowledge/overview",
                destination: "/docs/core-concepts/knowledge",
                permanent: true
            },
            {
                source: "/docs/knowledge/document-ingestion",
                destination: "/docs/core-concepts/knowledge",
                permanent: true
            },
            {
                source: "/docs/knowledge/vector-search",
                destination: "/docs/core-concepts/knowledge",
                permanent: true
            },
            {
                source: "/docs/knowledge/hybrid-search",
                destination: "/docs/core-concepts/knowledge",
                permanent: true
            },
            {
                source: "/docs/knowledge/api-reference",
                destination: "/docs/api-reference/knowledge",
                permanent: true
            },

            // Integrations section → merged into core-concepts/integrations
            {
                source: "/docs/integrations/overview",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/hubspot",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/jira",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/github",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/firecrawl",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/fathom",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/justcall",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/gmail",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/google-calendar",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/google-drive",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/microsoft-outlook",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/microsoft-teams",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/dropbox",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/slack",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/elevenlabs",
                destination: "/docs/core-concepts/integrations",
                permanent: true
            },
            {
                source: "/docs/integrations/model-context-protocol",
                destination: "/docs/api-reference/mcp-overview",
                permanent: true
            },

            // MCP section → merged into api-reference/mcp-*
            {
                source: "/docs/mcp/overview",
                destination: "/docs/api-reference/mcp-overview",
                permanent: true
            },
            {
                source: "/docs/mcp/getting-started",
                destination: "/docs/api-reference/mcp-getting-started",
                permanent: true
            },
            {
                source: "/docs/mcp/cursor-setup",
                destination: "/docs/api-reference/mcp-cursor-setup",
                permanent: true
            },
            {
                source: "/docs/mcp/claude-setup",
                destination: "/docs/api-reference/mcp-claude-setup",
                permanent: true
            },
            {
                source: "/docs/mcp/common-patterns",
                destination: "/docs/api-reference/mcp-common-patterns",
                permanent: true
            },
            {
                source: "/docs/mcp/tool-reference",
                destination: "/docs/api-reference/mcp-tool-reference",
                permanent: true
            },

            // Old getting-started pages
            {
                source: "/docs/getting-started/first-agent",
                destination: "/docs/getting-started/quickstart",
                permanent: true
            },
            {
                source: "/docs/getting-started/architecture",
                destination: "/docs/getting-started/introduction",
                permanent: true
            },
            {
                source: "/docs/getting-started/key-concepts",
                destination: "/docs/core-concepts/agents",
                permanent: true
            }
        ];
    },
    async rewrites() {
        return [];
    }
};

export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.SENTRY_AUTH_TOKEN,
    disableLogger: true,
    widenClientFileUpload: true,
    sourcemaps: {
        deleteSourcemapsAfterUpload: true
    }
});

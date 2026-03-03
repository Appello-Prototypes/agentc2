import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionHeader } from "@/components/website/sections/section-header";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { RelatedPages } from "@/components/website/sections/related-pages";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { ObservabilityIllustration } from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "API Reference — AgentC2 REST API",
    description:
        "Complete REST API for agent operations. Create, invoke, and manage AI agents, workflows, networks, knowledge bases, and MCP tools over standard HTTP.",
    path: "/developers/api",
    keywords: [
        "AI agent API",
        "REST API",
        "agent orchestration API",
        "streaming chat API",
        "MCP API"
    ]
});

const endpointSections = [
    {
        id: "agents",
        overline: "Agents API",
        title: "Create, configure, and invoke agents",
        description:
            "Full lifecycle management for AI agents — from creation and configuration to real-time streaming chat.",
        endpoints: [
            {
                method: "GET",
                path: "/api/agents",
                summary: "List all agents in your organization"
            },
            {
                method: "POST",
                path: "/api/agents",
                summary: "Create a new agent with model, tools, and instructions"
            },
            {
                method: "GET",
                path: "/api/agents/:slug",
                summary: "Retrieve agent configuration by slug"
            },
            {
                method: "PATCH",
                path: "/api/agents/:slug",
                summary: "Update agent settings (model, temperature, tools, instructions)"
            },
            {
                method: "POST",
                path: "/api/agents/:slug/chat",
                summary: "Send a message and receive a streamed response"
            },
            {
                method: "POST",
                path: "/api/agents/:slug/invoke",
                summary: "Invoke an agent and wait for the full response"
            }
        ],
        example: `// Stream a chat response
const response = await fetch(
  "https://agentc2.ai/agent/api/agents/assistant/chat",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Summarize the Q4 pipeline",
      threadId: "thread_abc123"
    })
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}`
    },
    {
        id: "workflows",
        overline: "Workflows API",
        title: "Orchestrate multi-step agent pipelines",
        description:
            "Execute complex multi-step workflows with branching, human-in-the-loop approval, and parallel agent execution.",
        endpoints: [
            {
                method: "GET",
                path: "/api/workflows",
                summary: "List all registered workflows"
            },
            {
                method: "POST",
                path: "/api/workflows/:id/execute",
                summary: "Start a workflow run with input parameters"
            },
            {
                method: "GET",
                path: "/api/workflows/:id/runs/:runId",
                summary: "Check status and output of a workflow run"
            },
            {
                method: "POST",
                path: "/api/workflows/:id/runs/:runId/resume",
                summary: "Resume a paused workflow (human approval step)"
            }
        ],
        example: `// Execute a workflow and wait for human approval
const run = await fetch(
  "https://agentc2.ai/agent/api/workflows/onboarding/execute",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: { customerId: "cust_456" }
    })
  }
);

const { runId, status } = await run.json();
// status: "waiting_for_approval"

// Later, approve the step
await fetch(
  \`https://agentc2.ai/agent/api/workflows/onboarding/runs/\${runId}/resume\`,
  {
    method: "POST",
    headers: { "Authorization": "Bearer YOUR_API_KEY" },
    body: JSON.stringify({ approved: true })
  }
);`
    },
    {
        id: "networks",
        overline: "Networks API",
        title: "Multi-agent coordination",
        description:
            "Deploy networks of specialized agents that collaborate, delegate tasks, and share context to solve complex problems.",
        endpoints: [
            {
                method: "GET",
                path: "/api/networks",
                summary: "List all agent networks"
            },
            {
                method: "POST",
                path: "/api/networks/:id/execute",
                summary: "Run a network with a goal and input data"
            },
            {
                method: "GET",
                path: "/api/networks/:id/runs/:runId",
                summary: "Retrieve network execution results and agent traces"
            }
        ],
        example: `// Execute a multi-agent network
const result = await fetch(
  "https://agentc2.ai/agent/api/networks/research-team/execute",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      goal: "Research competitor pricing for Q1 strategy",
      context: { competitors: ["Acme", "Globex"] }
    })
  }
);`
    },
    {
        id: "knowledge",
        overline: "Knowledge API",
        title: "RAG-powered document intelligence",
        description:
            "Ingest documents, chunk and embed content, and query your knowledge base with semantic search powered by pgvector.",
        endpoints: [
            {
                method: "POST",
                path: "/api/knowledge/ingest",
                summary: "Ingest a document (PDF, text, URL) into the vector store"
            },
            {
                method: "POST",
                path: "/api/knowledge/query",
                summary: "Semantic search across ingested documents"
            },
            {
                method: "GET",
                path: "/api/knowledge/documents",
                summary: "List all ingested documents with metadata"
            },
            {
                method: "DELETE",
                path: "/api/knowledge/documents/:id",
                summary: "Remove a document and its embeddings"
            }
        ],
        example: `// Ingest a document
await fetch("https://agentc2.ai/agent/api/knowledge/ingest", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    content: "Your document text here...",
    metadata: {
      source: "handbook",
      department: "engineering"
    }
  })
});

// Query the knowledge base
const results = await fetch(
  "https://agentc2.ai/agent/api/knowledge/query",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "What is the PTO policy?",
      maxResults: 5
    })
  }
);`
    },
    {
        id: "skills",
        overline: "Skills API",
        title: "Manage agent capabilities",
        description:
            "Register, list, and attach tools to agents. Each skill is a typed function with a Zod schema that agents can invoke at runtime.",
        endpoints: [
            {
                method: "GET",
                path: "/api/tools",
                summary: "List all registered tools with schemas"
            },
            {
                method: "POST",
                path: "/api/tools/:name/execute",
                summary: "Execute a tool directly with input parameters"
            },
            {
                method: "GET",
                path: "/api/agents/:slug/tools",
                summary: "List tools attached to a specific agent"
            }
        ],
        example: `// List available tools
const tools = await fetch(
  "https://agentc2.ai/agent/api/tools",
  {
    headers: { "Authorization": "Bearer YOUR_API_KEY" }
  }
);

const { tools: toolList } = await tools.json();
// [{ name: "calculator", description: "...", schema: {...} }, ...]`
    },
    {
        id: "mcp",
        overline: "MCP API",
        title: "Model Context Protocol operations",
        description:
            "List MCP servers, discover available tools, and execute MCP tool calls through the unified AgentC2 gateway.",
        endpoints: [
            {
                method: "GET",
                path: "/api/mcp/servers",
                summary: "List connected MCP servers and their status"
            },
            {
                method: "GET",
                path: "/api/mcp/tools",
                summary: "Discover all tools across all MCP servers"
            },
            {
                method: "POST",
                path: "/api/mcp/tools/:toolName/execute",
                summary: "Execute an MCP tool with parameters"
            }
        ],
        example: `// Execute an MCP tool
const result = await fetch(
  "https://agentc2.ai/agent/api/mcp/tools/hubspot.get-contacts/execute",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      limit: 10,
      properties: ["email", "firstname", "lastname"]
    })
  }
);`
    },
    {
        id: "webhooks",
        overline: "Webhooks",
        title: "Real-time event subscriptions",
        description:
            "Subscribe to agent lifecycle events with signed webhook payloads, automatic retries, and configurable filters.",
        endpoints: [
            {
                method: "POST",
                path: "/api/webhooks",
                summary: "Register a webhook endpoint for specific events"
            },
            {
                method: "GET",
                path: "/api/webhooks",
                summary: "List all registered webhook subscriptions"
            },
            {
                method: "DELETE",
                path: "/api/webhooks/:id",
                summary: "Remove a webhook subscription"
            }
        ],
        example: `// Register a webhook
await fetch("https://agentc2.ai/agent/api/webhooks", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://your-app.com/webhooks/agentc2",
    events: [
      "run.completed",
      "run.failed",
      "approval.requested"
    ],
    secret: "whsec_your_signing_secret"
  })
});

// Webhook payload example:
// {
//   "event": "run.completed",
//   "timestamp": "2026-03-03T12:00:00Z",
//   "data": {
//     "agentSlug": "assistant",
//     "runId": "run_789",
//     "status": "completed",
//     "duration_ms": 2340
//   }
// }`
    }
];

function MethodBadge({ method }: { method: string }) {
    const colors: Record<string, string> = {
        GET: "bg-emerald-500/10 text-emerald-400",
        POST: "bg-sky-500/10 text-sky-400",
        PATCH: "bg-amber-500/10 text-amber-400",
        PUT: "bg-amber-500/10 text-amber-400",
        DELETE: "bg-red-500/10 text-red-400"
    };

    return (
        <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${colors[method] ?? "bg-muted text-muted-foreground"}`}
        >
            {method}
        </span>
    );
}

export default function ApiReferencePage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Developers", href: "/developers" },
                        { label: "API Reference" }
                    ]}
                    currentPath="/developers/api"
                    className="mb-8"
                />
            </SectionWrapper>

            <PageHero
                overline="API Reference"
                title="Complete REST API for agent operations"
                description="Create, invoke, and orchestrate AI agents over standard HTTP. Streaming responses, typed schemas, and comprehensive error handling — everything you need to integrate AgentC2 into your stack."
                primaryCta={{
                    label: "Get API Key",
                    href: "/signup"
                }}
                secondaryCta={{
                    label: "View on GitHub",
                    href: "https://github.com/agentc2"
                }}
            >
                <ObservabilityIllustration className="w-full max-w-md" />
            </PageHero>

            {/* Authentication */}
            <SectionWrapper muted id="authentication">
                <SectionHeader
                    overline="Authentication"
                    title="Bearer token authentication"
                    description="All API requests require a Bearer token in the Authorization header. Generate keys from the AgentC2 dashboard."
                />
                <div className="mx-auto mt-12 max-w-3xl">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-4 text-lg font-semibold">
                            Request headers
                        </h3>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs">
                            <code>{`Authorization: Bearer YOUR_API_KEY
Content-Type: application/json`}</code>
                        </pre>
                        <div className="mt-6 space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="bg-primary/10 text-primary mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold">
                                    SCOPE
                                </span>
                                <p className="text-muted-foreground text-sm">
                                    Keys are scoped to your organization. Each key can be restricted
                                    to read-only or full access.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                                    RATE
                                </span>
                                <p className="text-muted-foreground text-sm">
                                    Default rate limit is 100 requests per minute per key.
                                    Enterprise plans support custom limits.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                    BASE
                                </span>
                                <p className="text-muted-foreground text-sm">
                                    All endpoints are served from{" "}
                                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                                        https://agentc2.ai/agent/api
                                    </code>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </SectionWrapper>

            {/* Endpoint Sections */}
            {endpointSections.map((section, index) => (
                <SectionWrapper key={section.id} id={section.id} muted={index % 2 === 1}>
                    <SectionHeader
                        overline={section.overline}
                        title={section.title}
                        description={section.description}
                    />
                    <div className="mt-12 grid gap-8 lg:grid-cols-2">
                        <div className="space-y-3">
                            {section.endpoints.map((ep) => (
                                <div
                                    key={`${ep.method}-${ep.path}`}
                                    className="border-border/60 bg-card flex items-start gap-3 rounded-xl border p-4"
                                >
                                    <MethodBadge method={ep.method} />
                                    <div className="min-w-0 flex-1">
                                        <code className="text-foreground block truncate text-sm font-medium">
                                            {ep.path}
                                        </code>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {ep.summary}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-border/60 bg-card rounded-2xl border p-6">
                            <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                                Example
                            </h4>
                            <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed">
                                <code>{section.example}</code>
                            </pre>
                        </div>
                    </div>
                </SectionWrapper>
            ))}

            {/* Response Format */}
            <SectionWrapper id="response-format">
                <SectionHeader
                    overline="Response Format"
                    title="Consistent, predictable responses"
                    description="All endpoints return JSON with a consistent envelope. Errors include machine-readable codes and human-friendly messages."
                />
                <div className="mx-auto mt-12 grid max-w-4xl gap-8 lg:grid-cols-2">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h4 className="text-foreground mb-3 text-sm font-semibold">
                            Success response
                        </h4>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs">
                            <code>{`{
  "success": true,
  "data": {
    "agent": {
      "slug": "assistant",
      "name": "General Assistant",
      "model": "gpt-4o",
      "tools": ["calculator", "web-fetch"]
    }
  }
}`}</code>
                        </pre>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h4 className="text-foreground mb-3 text-sm font-semibold">
                            Error response
                        </h4>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs">
                            <code>{`{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "No agent found with slug 'unknown'",
    "status": 404
  }
}`}</code>
                        </pre>
                    </div>
                </div>
            </SectionWrapper>

            {/* SDK Quick Reference */}
            <SectionWrapper muted id="sdks">
                <SectionHeader
                    overline="SDKs"
                    title="Client libraries"
                    description="Use the REST API directly or leverage our typed client libraries for faster integration."
                />
                <div className="mt-12">
                    <FeatureGrid
                        columns={3}
                        features={[
                            {
                                title: "TypeScript / Node.js",
                                description:
                                    "First-class TypeScript SDK with full type inference, streaming helpers, and auto-retry. Published on npm as @agentc2/sdk."
                            },
                            {
                                title: "Python",
                                description:
                                    "Async Python client with Pydantic models, streaming support, and comprehensive error handling. pip install agentc2."
                            },
                            {
                                title: "cURL / HTTP",
                                description:
                                    "Every endpoint is accessible via standard HTTP. Use cURL, Postman, or any HTTP client — no SDK required."
                            }
                        ]}
                    />
                </div>
            </SectionWrapper>

            <CTABanner
                title="Ready to integrate?"
                description="Generate your API key and start building. Full type safety, streaming responses, and comprehensive documentation."
                primaryCta={{ label: "Get API Key", href: "/signup" }}
                secondaryCta={{ label: "Read the Docs", href: "/docs" }}
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
                            title: "MCP Integration Guide",
                            description:
                                "Connect any MCP server, bring your own tools, and discover 40+ built-in integrations.",
                            href: "/developers/mcp"
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

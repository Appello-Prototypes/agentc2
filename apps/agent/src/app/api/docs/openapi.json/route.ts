import { NextResponse } from "next/server";

const openApiSpec = {
    openapi: "3.1.0",
    info: {
        title: "AgentC2 API",
        version: "1.0.0",
        description:
            "The AgentC2 AI Agent Framework API enables you to build, deploy, and orchestrate AI agents with voice capabilities, MCP integrations, and background job processing.",
        contact: {
            name: "AgentC2 Support",
            url: "https://agentc2.ai"
        },
        license: {
            name: "Proprietary"
        }
    },
    servers: [
        {
            url: "https://agentc2.ai",
            description: "Production"
        },
        {
            url: "https://staging.agentc2.ai",
            description: "Staging"
        },
        {
            url: "http://localhost:3001",
            description: "Local Development"
        }
    ],
    paths: {
        "/api/health": {
            get: {
                summary: "Liveness Probe",
                description: "Returns 200 if the process is running.",
                operationId: "healthLiveness",
                tags: ["Health"],
                responses: {
                    "200": {
                        description: "Service is healthy",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string", example: "ok" },
                                        uptime: { type: "number", example: 3600 },
                                        timestamp: { type: "string", format: "date-time" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/health/ready": {
            get: {
                summary: "Readiness Probe",
                description: "Checks database connectivity.",
                operationId: "healthReadiness",
                tags: ["Health"],
                responses: {
                    "200": { description: "Service is ready" },
                    "503": { description: "Service is not ready" }
                }
            }
        },
        "/api/agents": {
            get: {
                summary: "List Agents",
                description: "Returns all agents in the current organization.",
                operationId: "listAgents",
                tags: ["Agents"],
                security: [{ sessionAuth: [] }],
                parameters: [
                    {
                        name: "page",
                        in: "query",
                        schema: { type: "integer", default: 1 }
                    },
                    {
                        name: "limit",
                        in: "query",
                        schema: { type: "integer", default: 20, maximum: 100 }
                    }
                ],
                responses: {
                    "200": { description: "List of agents" },
                    "401": { description: "Unauthorized" }
                }
            }
        },
        "/api/agents/{id}/chat": {
            post: {
                summary: "Chat with Agent",
                description: "Send a message to an agent and receive a streaming response.",
                operationId: "chatWithAgent",
                tags: ["Agents"],
                security: [{ sessionAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["messages"],
                                properties: {
                                    messages: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                role: {
                                                    type: "string",
                                                    enum: ["user", "assistant", "system"]
                                                },
                                                content: { type: "string" }
                                            }
                                        }
                                    },
                                    threadId: { type: "string" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Streaming agent response" },
                    "401": { description: "Unauthorized" },
                    "404": { description: "Agent not found" },
                    "429": { description: "Rate limit exceeded" }
                }
            }
        },
        "/api/workflow": {
            get: {
                summary: "List Workflows",
                description: "Returns all workflows in the current organization.",
                operationId: "listWorkflows",
                tags: ["Workflows"],
                security: [{ sessionAuth: [] }],
                responses: {
                    "200": { description: "List of workflows" },
                    "401": { description: "Unauthorized" }
                }
            }
        },
        "/api/metrics": {
            get: {
                summary: "Prometheus Metrics",
                description: "Returns Prometheus-format metrics. IP-restricted in production.",
                operationId: "getMetrics",
                tags: ["Monitoring"],
                responses: {
                    "200": {
                        description: "Prometheus metrics",
                        content: {
                            "text/plain": {
                                schema: { type: "string" }
                            }
                        }
                    },
                    "403": { description: "Forbidden — IP not allowed" }
                }
            }
        }
    },
    components: {
        securitySchemes: {
            sessionAuth: {
                type: "apiKey",
                in: "cookie",
                name: "better-auth.session_token",
                description: "Session cookie from Better Auth"
            },
            apiKeyAuth: {
                type: "apiKey",
                in: "header",
                name: "x-api-key",
                description: "API key for programmatic access"
            }
        }
    },
    tags: [
        { name: "Health", description: "Health check endpoints" },
        { name: "Agents", description: "Agent management and chat" },
        { name: "Workflows", description: "Workflow management and execution" },
        { name: "Monitoring", description: "Metrics and monitoring" }
    ]
};

export async function GET() {
    return NextResponse.json(openApiSpec);
}

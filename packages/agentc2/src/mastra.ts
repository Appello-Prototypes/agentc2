import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";
import {
    Observability,
    DefaultExporter,
    SensitiveDataFilter,
    SamplingStrategyType
} from "@mastra/observability";
import { storage } from "./storage";
import {
    assistantAgent,
    sidekickAgent,
    structuredAgent,
    visionAgent,
    researchAgent,
    mcpAgent
} from "./agents";
import {
    analysisWorkflow,
    parallelWorkflow,
    branchWorkflow,
    foreachWorkflow,
    doWhileWorkflow,
    humanApprovalWorkflow
} from "./workflows";

// Extend global type for Next.js HMR singleton pattern
declare global {
    var mastraInstance: Mastra | undefined;
    var observabilityInstance: Observability | undefined;
}

/**
 * Build Observability instance for Mastra.
 * Enables automatic tracing of agent runs, tool calls, and model generations.
 *
 * Configuration:
 * - DefaultExporter: Persists traces to PostgreSQL storage (initialized automatically by Mastra)
 * - SensitiveDataFilter: Redacts sensitive fields (password, apiKey, token, secret, authorization)
 * - 100% sampling: All traces are collected
 */
function getObservability(): Observability {
    if (!global.observabilityInstance) {
        global.observabilityInstance = new Observability({
            configs: {
                default: {
                    serviceName: "mastra-agent-workspace",
                    sampling: {
                        type: SamplingStrategyType.ALWAYS
                    },
                    exporters: [new DefaultExporter()],
                    spanOutputProcessors: [
                        new SensitiveDataFilter({
                            sensitiveFields: [
                                "password",
                                "apiKey",
                                "token",
                                "secret",
                                "authorization",
                                "api_key",
                                "access_token",
                                "refresh_token"
                            ]
                        })
                    ]
                }
            }
        });
    }
    return global.observabilityInstance;
}

/**
 * Build agents object for static/code-defined agents.
 *
 * Voice agents are not registered here — they are resolved dynamically
 * with org-scoped API keys from the database at request time.
 *
 * Note: The Trip Planner network is now database-driven and resolved via NetworkResolver.
 * It is not registered here; instead, it's constructed dynamically when needed.
 */
function buildAgents(): Record<string, Agent> {
    return {
        assistant: assistantAgent,
        sidekick: sidekickAgent,
        structured: structuredAgent,
        vision: visionAgent,
        research: researchAgent,
        "mcp-agent": mcpAgent
    };
}

/**
 * Create Mastra instance with all agents, workflows, and storage.
 */
function getMastra(): Mastra {
    if (!global.mastraInstance) {
        global.mastraInstance = new Mastra({
            agents: buildAgents(),
            workflows: {
                "analysis-workflow": analysisWorkflow,
                "parallel-processing": parallelWorkflow,
                "conditional-branch": branchWorkflow,
                "foreach-loop": foreachWorkflow,
                "dowhile-loop": doWhileWorkflow,
                "human-approval": humanApprovalWorkflow
            },
            storage,
            observability: getObservability()
        });

        console.log("[Mastra] Initialized with agents, workflows, and observability");
    }

    return global.mastraInstance;
}

function createMastraProxy(): Mastra {
    return new Proxy({} as Mastra, {
        get(_target, prop) {
            const instance = getMastra();
            const value = instance[prop as keyof Mastra];
            return typeof value === "function" ? value.bind(instance) : value;
        }
    });
}

export const mastra = createMastraProxy();

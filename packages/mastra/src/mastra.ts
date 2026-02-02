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
    structuredAgent,
    visionAgent,
    researchAgent,
    evaluatedAgent,
    openaiVoiceAgent,
    elevenlabsVoiceAgent,
    hybridVoiceAgent
} from "./agents";
import {
    analysisWorkflow,
    parallelWorkflow,
    branchWorkflow,
    foreachWorkflow,
    doWhileWorkflow,
    humanApprovalWorkflow
} from "./workflows";

// Trip Planner Workflows (agents are now database-driven via NetworkResolver)
import {
    parallelResearchWorkflow,
    itineraryAssemblyWorkflow,
    budgetApprovalWorkflow
} from "./workflows/trip-planner";

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
 * Build agents object, only including voice agents if their API keys are available.
 *
 * Note: The Trip Planner network is now database-driven and resolved via NetworkResolver.
 * It is not registered here; instead, it's constructed dynamically when needed.
 */
function buildAgents(): Record<string, Agent> {
    const agents: Record<string, Agent> = {
        assistant: assistantAgent,
        structured: structuredAgent,
        vision: visionAgent,
        research: researchAgent,
        evaluated: evaluatedAgent
    };

    // Only add voice agents if they were successfully created (API keys present)
    if (openaiVoiceAgent) {
        agents["openai-voice-agent"] = openaiVoiceAgent;
    }
    if (elevenlabsVoiceAgent) {
        agents["elevenlabs-voice-agent"] = elevenlabsVoiceAgent;
    }
    if (hybridVoiceAgent) {
        agents["hybrid-voice-agent"] = hybridVoiceAgent;
    }

    return agents;
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
                "human-approval": humanApprovalWorkflow,
                // Trip Planner Workflows
                "trip-parallel-research": parallelResearchWorkflow,
                "trip-itinerary-assembly": itineraryAssemblyWorkflow,
                "trip-budget-approval": budgetApprovalWorkflow
            },
            storage,
            observability: getObservability()
        });

        console.log("[Mastra] Initialized with agents, workflows, and observability");
    }

    return global.mastraInstance;
}

export const mastra = getMastra();

import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";
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

// Extend global type for Next.js HMR singleton pattern
declare global {
    var mastraInstance: Mastra | undefined;
}

/**
 * Build agents object, only including voice agents if their API keys are available.
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
                "human-approval": humanApprovalWorkflow
            },
            storage
        });
    }

    return global.mastraInstance;
}

export const mastra = getMastra();

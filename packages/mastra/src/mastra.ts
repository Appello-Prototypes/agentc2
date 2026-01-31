import { Mastra } from "@mastra/core/mastra";
import { storage } from "./storage";
import {
    assistantAgent,
    structuredAgent,
    visionAgent,
    researchAgent,
    evaluatedAgent
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
 * Create Mastra instance with all agents, workflows, and storage.
 */
function getMastra(): Mastra {
    if (!global.mastraInstance) {
        global.mastraInstance = new Mastra({
            agents: {
                assistant: assistantAgent,
                structured: structuredAgent,
                vision: visionAgent,
                research: researchAgent,
                evaluated: evaluatedAgent
            },
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

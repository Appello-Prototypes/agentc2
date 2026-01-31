import { Mastra } from "@mastra/core/mastra";
import { storage } from "./storage";
import { assistantAgent } from "./agents";
import { analysisWorkflow } from "./workflows";

// Extend global type for Next.js HMR singleton pattern
declare global {
  var mastraInstance: Mastra | undefined;
}

/**
 * Create Mastra instance with all agents, workflows, and storage
 */
function getMastra(): Mastra {
  if (!global.mastraInstance) {
    global.mastraInstance = new Mastra({
      agents: {
        assistant: assistantAgent,
      },
      workflows: {
        "analysis-workflow": analysisWorkflow,
      },
      storage,
    });
  }

  return global.mastraInstance;
}

export const mastra = getMastra();

import { Agent } from "@mastra/core/agent";
import { extendedTools, memoryRecallTool } from "../tools";

const ORCHESTRATOR_INSTRUCTIONS = `
You are an autonomous goal-execution agent. You receive goals and work to accomplish them.

## Your Tools
You have access to these tools - USE THEM to accomplish goals:

### Direct Tools
- webFetchTool: Fetch content from any URL
- memoryRecall: Search past conversations for relevant info
- dateTimeTool: Get current date/time
- calculatorTool: Perform calculations

### Your Approach
1. Analyze the goal
2. Use your tools to gather information or perform actions
3. Synthesize the results
4. Provide a comprehensive response

## Response Format
When completing a goal:
1. State what you did (which tools you used)
2. Present the findings clearly
3. Provide actionable next steps if relevant

Be thorough but concise. Use your tools actively - don't just describe what you would do.
`;

// Extend global type for Next.js HMR singleton pattern
declare global {
    var orchestratorAgent: Agent | undefined;
}

/**
 * Get or create the orchestrator agent.
 * Configured with tools for goal execution.
 */
export async function getOrchestratorAgent(): Promise<Agent> {
    if (!global.orchestratorAgent) {
        // Build tools - these are the actual capabilities
        const tools = {
            ...extendedTools,
            memoryRecall: memoryRecallTool
        };

        global.orchestratorAgent = new Agent({
            id: "orchestrator",
            name: "Goal Orchestrator",
            instructions: ORCHESTRATOR_INSTRUCTIONS,
            model: "anthropic/claude-sonnet-4-20250514",
            tools
        });

        console.log("[Orchestrator] Agent initialized with tools:", Object.keys(tools));
    }

    return global.orchestratorAgent;
}

/**
 * Reset the orchestrator agent (useful for testing or reconfiguration)
 */
export function resetOrchestratorAgent(): void {
    global.orchestratorAgent = undefined;
}

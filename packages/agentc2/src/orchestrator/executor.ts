import { getOrchestratorAgent } from "./agent";
import { goalStore, Goal, GoalScore } from "./store";
function evaluateHelpfulness(input: string, output: string): { score: number; reasoning: string } {
    let score = 0.5;
    const reasoning: string[] = [];
    const actionWords = ["here's how", "follow these steps", "you can", "try this", "to do this"];
    if (actionWords.some((word) => output.toLowerCase().includes(word))) {
        score += 0.2;
        reasoning.push("Contains actionable guidance");
    }
    if (output.includes("example") || output.includes("for instance") || output.includes("```")) {
        score += 0.15;
        reasoning.push("Includes examples or code");
    }
    if (output.includes("1.") || output.includes("- ") || output.includes("##")) {
        score += 0.1;
        reasoning.push("Well-structured response");
    }
    if (output.length > 200) {
        score += 0.05;
        reasoning.push("Sufficient detail");
    }
    score = Math.min(score, 1.0);
    return {
        score,
        reasoning:
            reasoning.length > 0 ? reasoning.join("; ") : "Basic response without special features"
    };
}

export interface ExecutionResult {
    text: string;
    toolCalls?: Array<{ name: string; result: unknown }>;
}

export class GoalExecutor {
    /**
     * Plan phase - analyze the goal and create execution plan
     */
    async plan(goal: Goal): Promise<string> {
        console.log(`[GoalExecutor] Planning goal: ${goal.id}`);

        try {
            const orchestrator = await getOrchestratorAgent();

            const planPrompt = `Analyze this goal and create a brief execution plan (2-4 steps):

Goal: ${goal.description}

Respond with a numbered list of steps you'll take to accomplish this goal.`;

            const response = await orchestrator.generate(planPrompt, {
                maxSteps: 3
            });

            await goalStore.updateStatus(goal.id, "running", {
                progress: 20,
                currentStep: "Planning complete"
            });

            console.log(`[GoalExecutor] Plan created for goal: ${goal.id}`);
            return response.text || "";
        } catch (error) {
            console.error(`[GoalExecutor] Planning failed for goal: ${goal.id}`, error);
            throw error;
        }
    }

    /**
     * Execute phase - carry out the plan
     */
    async execute(goal: Goal, plan: string): Promise<ExecutionResult> {
        console.log(`[GoalExecutor] Executing goal: ${goal.id}`);

        try {
            const orchestrator = await getOrchestratorAgent();

            await goalStore.updateStatus(goal.id, "running", {
                progress: 40,
                currentStep: "Executing plan..."
            });

            const executePrompt = `Execute this plan to accomplish the goal:

Goal: ${goal.description}

Plan:
${plan}

IMPORTANT: Use your tools (webFetchTool, etc.) to actually execute these steps. Don't just describe what you would do - do it.

Provide the final result with specific findings.`;

            // Allow up to 10 steps for tool usage
            const response = await orchestrator.generate(executePrompt, {
                maxSteps: 10
            });

            await goalStore.updateStatus(goal.id, "running", {
                progress: 80,
                currentStep: "Execution complete"
            });

            // Memory is handled by the orchestrator agent through its memory configuration

            console.log(`[GoalExecutor] Execution complete for goal: ${goal.id}`);
            return { text: response.text || "" };
        } catch (error) {
            console.error(`[GoalExecutor] Execution failed for goal: ${goal.id}`, error);
            throw error;
        }
    }

    /**
     * Score phase - evaluate the result using heuristic scorer
     * Note: LLM-based scorers (relevancyScorer, completenessScorer) can be used
     * but require additional API calls. Using heuristic for lower latency.
     */
    async score(goal: Goal, result: ExecutionResult): Promise<GoalScore> {
        console.log(`[GoalExecutor] Scoring goal: ${goal.id}`);

        try {
            await goalStore.updateStatus(goal.id, "running", {
                progress: 90,
                currentStep: "Evaluating results..."
            });

            // Use heuristic scoring for speed (can upgrade to LLM-based scorers if needed)
            const helpfulness = evaluateHelpfulness(goal.description, result.text);

            // Estimate relevancy based on content overlap
            const goalWords = new Set(goal.description.toLowerCase().split(/\s+/));
            const resultWords = result.text.toLowerCase().split(/\s+/);
            const overlapCount = resultWords.filter((w) => goalWords.has(w)).length;
            const relevancyScore = Math.min(1, overlapCount / Math.max(goalWords.size, 1));

            // Estimate completeness based on response length and structure
            const hasStructure = result.text.includes("1.") || result.text.includes("-");
            const hasDetail = result.text.length > 200;
            const completenessScore = (hasStructure ? 0.5 : 0.3) + (hasDetail ? 0.3 : 0.1) + 0.2;

            const overall = (relevancyScore + completenessScore + helpfulness.score) / 3;
            const score: GoalScore = {
                relevancy: relevancyScore,
                completeness: Math.min(1, completenessScore),
                overall,
                passed: overall >= 0.5
            };

            console.log(`[GoalExecutor] Score for goal ${goal.id}:`, score);
            return score;
        } catch (error) {
            console.error(`[GoalExecutor] Scoring failed for goal: ${goal.id}`, error);
            // Return default score on error
            return { relevancy: 0.5, completeness: 0.5, overall: 0.5, passed: false };
        }
    }

    /**
     * Complete the goal
     */
    async complete(goal: Goal, result: ExecutionResult, score: GoalScore): Promise<void> {
        console.log(`[GoalExecutor] Completing goal: ${goal.id}`);

        await goalStore.updateStatus(goal.id, "completed", {
            progress: 100,
            currentStep: "Complete",
            result: { text: result.text },
            score
        });

        console.log(`[GoalExecutor] Goal completed: ${goal.id}`);
    }

    /**
     * Mark goal as failed
     */
    async fail(goal: Goal, error: string): Promise<void> {
        console.error(`[GoalExecutor] Goal failed: ${goal.id}`, error);

        await goalStore.updateStatus(goal.id, "failed", {
            error,
            currentStep: "Failed"
        });
    }
}

export const goalExecutor = new GoalExecutor();

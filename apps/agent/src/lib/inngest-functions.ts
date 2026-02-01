import { inngest } from "./inngest";
import { goalStore, goalExecutor } from "@repo/mastra/orchestrator";

/**
 * Execute Goal Function
 *
 * Uses Inngest step functions to break execution into resumable steps.
 * This bypasses Vercel's function timeout limits.
 *
 * Flow:
 * 1. get-goal: Fetch goal and mark as running
 * 2. plan: Create execution plan
 * 3. execute: Execute the plan
 * 4. score: Evaluate the result
 * 5. complete: Mark goal as complete
 */
export const executeGoalFunction = inngest.createFunction(
    {
        id: "execute-goal",
        retries: 3,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onFailure: async ({ error, event }: { error: Error; event: any }) => {
            // Mark goal as failed on final retry failure
            const goalId = event.data?.goalId;
            console.error(`[Inngest] Goal ${goalId} failed after retries:`, error.message);
            try {
                if (goalId) {
                    const goal = await goalStore.getById(goalId);
                    if (goal) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await goalExecutor.fail(goal as any, error.message);
                    }
                }
            } catch (updateError) {
                console.error(`[Inngest] Failed to update goal status:`, updateError);
            }
        }
    },
    { event: "goal/submitted" },
    async ({ event, step, runId }) => {
        const { goalId } = event.data;

        console.log(`[Inngest] Starting goal execution: ${goalId}`);

        // Step 1: Get the goal and mark as running
        const goal = await step.run("get-goal", async () => {
            const g = await goalStore.getById(goalId);
            if (!g) {
                throw new Error(`Goal not found: ${goalId}`);
            }

            // Update with Inngest run ID for tracking
            await goalStore.updateStatus(goalId, "running", {
                inngestRunId: runId
            });

            return g;
        });

        // Step 2: Plan
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const goalWithDates = goal as any;
        const plan = await step.run("plan", async () => {
            return await goalExecutor.plan(goalWithDates);
        });

        // Step 3: Execute
        const result = await step.run("execute", async () => {
            return await goalExecutor.execute(goalWithDates, plan);
        });

        // Step 4: Score
        const score = await step.run("score", async () => {
            return await goalExecutor.score(goalWithDates, result);
        });

        // Step 5: Complete
        await step.run("complete", async () => {
            await goalExecutor.complete(goalWithDates, result, score);
        });

        console.log(`[Inngest] Goal execution complete: ${goalId}`, { score });

        return {
            goalId,
            status: "completed",
            score
        };
    }
);

/**
 * Retry Goal Function
 *
 * Manually triggered to retry a failed goal.
 */
export const retryGoalFunction = inngest.createFunction(
    {
        id: "retry-goal",
        retries: 2
    },
    { event: "goal/retry" },
    async ({ event, step, runId }) => {
        const { goalId } = event.data;

        console.log(`[Inngest] Retrying goal: ${goalId}, attempt: ${event.data.attempt}`);

        // Reset goal status and re-execute
        const goal = await step.run("reset-goal", async () => {
            const g = await goalStore.getById(goalId);
            if (!g) {
                throw new Error(`Goal not found: ${goalId}`);
            }

            await goalStore.updateStatus(goalId, "queued", {
                progress: 0,
                currentStep: "Queued for retry",
                inngestRunId: runId
            });

            return g;
        });

        // Trigger the main execution function
        await step.sendEvent("trigger-execute", {
            name: "goal/submitted",
            data: {
                goalId: goal.id,
                userId: goal.userId
            }
        });

        return { goalId, status: "retry-triggered" };
    }
);

/**
 * All Inngest functions to register
 */
export const inngestFunctions = [executeGoalFunction, retryGoalFunction];

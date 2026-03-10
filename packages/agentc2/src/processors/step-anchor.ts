/**
 * Step Anchor Processor
 *
 * Mastra-native input processor that implements instruction anchoring
 * at periodic intervals during multi-step agent execution. Runs at
 * every step via processInputStep.
 *
 * Replaces managedGenerate's buildStepInstructions() function, applying
 * anchoring uniformly across streaming and non-streaming paths.
 *
 * Behavior:
 *   - Every anchorInterval steps, appends a progress summary to the
 *     system messages, reminding the agent of its task and progress
 *   - On the final step, injects a "wrap up" instruction
 *   - Does NOT modify messages on non-anchor steps (preserving cache)
 */

import type {
    Processor,
    ProcessInputStepArgs,
    ProcessInputStepResult
} from "@mastra/core/processors";

export interface StepAnchorConfig {
    /** How often to inject progress anchors. Default: 10 */
    anchorInterval?: number;
    /** Whether anchoring is enabled. Default: true */
    anchorInstructions?: boolean;
    /** Maximum steps for this execution. Used for progress display. */
    maxSteps?: number;
}

interface AnchorState {
    /** Tool calls seen so far for progress tracking */
    toolCallHistory: Array<{ step: number; toolName: string }>;
}

/**
 * Create a step anchor processor that periodically injects progress
 * summaries into the system messages.
 */
export function createStepAnchorProcessor(config?: StepAnchorConfig): Processor<"step-anchor"> {
    const anchorInterval = config?.anchorInterval ?? 10;
    const anchorInstructions = config?.anchorInstructions ?? true;
    const maxSteps = config?.maxSteps ?? 25;

    return {
        id: "step-anchor" as const,
        name: "Step Anchor",

        async processInputStep(
            args: ProcessInputStepArgs
        ): Promise<ProcessInputStepResult | undefined> {
            const { stepNumber, state, systemMessages } = args;

            // Initialize state
            const as = state as unknown as AnchorState;
            if (!as.toolCallHistory) {
                as.toolCallHistory = [];
            }

            // Record tool calls from previous steps
            if (args.steps && args.steps.length > 0) {
                const lastStep = args.steps[args.steps.length - 1];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stepToolCalls = (lastStep as any)?.toolCalls;
                if (Array.isArray(stepToolCalls)) {
                    for (const tc of stepToolCalls) {
                        as.toolCallHistory.push({
                            step: stepNumber,
                            toolName: tc.toolName || "unknown"
                        });
                    }
                }
            }

            if (!anchorInstructions) return undefined;

            // Only anchor at intervals (not on step 0/1)
            const currentStep = stepNumber + 1; // 0-indexed → 1-indexed
            if (currentStep <= 1) return undefined;

            const isAnchorStep = (currentStep - 1) % anchorInterval === 0;
            const isFinalStep = currentStep >= maxSteps;

            if (!isAnchorStep && !isFinalStep) return undefined;

            // Build progress summary from recent tool calls
            const recentTools = as.toolCallHistory.slice(-5);

            console.log(
                `[StepAnchor] Step ${currentStep}/${maxSteps}${isFinalStep ? " (FINAL)" : ""}: injecting progress anchor (${recentTools.length} recent tool calls)`
            );
            const progressLines = recentTools.map((t) => `  - Step ${t.step}: ${t.toolName}`);

            let anchorText: string;
            if (isFinalStep) {
                anchorText = [
                    "",
                    `[Progress - FINAL STEP ${currentStep}/${maxSteps}]`,
                    `This is your last step. Provide your final answer now.`,
                    `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
                    `Summarize your findings and respond to the user.`
                ].join("\n");
            } else {
                anchorText = [
                    "",
                    `[Progress - Step ${currentStep}/${maxSteps}]`,
                    `Recent progress:\n${progressLines.join("\n") || "  (none yet)"}`,
                    `Continue your task. Do not repeat completed steps.`
                ].join("\n");
            }

            // Append anchor to system messages
            const updatedSystemMessages = [
                ...systemMessages,
                {
                    role: "system" as const,
                    content: anchorText
                }
            ];

            return { systemMessages: updatedSystemMessages };
        }
    };
}

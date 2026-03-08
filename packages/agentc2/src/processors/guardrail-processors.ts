/**
 * Guardrail Processors
 *
 * Mastra-native input/output processors that enforce guardrail policies
 * at the Agent level via inputProcessors / outputProcessors.
 *
 * These replace point-of-use guardrail calls with universal enforcement —
 * every agent.generate() and agent.stream() call is automatically guarded.
 */

import type { Processor } from "@mastra/core/processors";
import { enforceInputGuardrails, enforceOutputGuardrails } from "../guardrails";

/**
 * Input guardrail processor.
 *
 * Runs enforceInputGuardrails on the latest user message before it reaches the LLM.
 * If blocked, aborts the generation with the violation details.
 */
export function createInputGuardrailProcessor(
    agentId: string,
    tenantId?: string
): Processor<"input-guardrail"> {
    return {
        id: "input-guardrail" as const,
        name: "Input Guardrail",

        async processInput({ messages, abort }) {
            const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
            if (!lastUserMsg) return messages;

            const text =
                typeof lastUserMsg.content === "string"
                    ? lastUserMsg.content
                    : Array.isArray(lastUserMsg.content)
                      ? lastUserMsg.content
                            .filter((p: any) => p.type === "text")
                            .map((p: any) => p.text)
                            .join(" ")
                      : "";

            if (!text) return messages;

            const result = await enforceInputGuardrails(agentId, text, { tenantId });

            if (result.blocked) {
                const reasons = result.violations.map((v) => v.message).join("; ");
                abort(`Input guardrail blocked: ${reasons}`);
            }

            return messages;
        }
    };
}

/**
 * Output guardrail processor.
 *
 * Runs enforceOutputGuardrails on the final agent response.
 * If blocked, aborts with retry so the agent can try again.
 */
export function createOutputGuardrailProcessor(
    agentId: string,
    tenantId?: string
): Processor<"output-guardrail"> {
    return {
        id: "output-guardrail" as const,
        name: "Output Guardrail",

        async processOutputResult({ messages, abort, retryCount }) {
            const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
            if (!lastAssistantMsg) return messages;

            const text =
                typeof lastAssistantMsg.content === "string"
                    ? lastAssistantMsg.content
                    : Array.isArray(lastAssistantMsg.content)
                      ? lastAssistantMsg.content
                            .filter((p: any) => p.type === "text")
                            .map((p: any) => p.text)
                            .join(" ")
                      : "";

            if (!text) return messages;

            const result = await enforceOutputGuardrails(agentId, text, { tenantId });

            if (result.blocked) {
                const reasons = result.violations.map((v) => v.message).join("; ");
                if (retryCount < 2) {
                    abort(`Output guardrail blocked: ${reasons}`, { retry: true });
                }
                abort(`Output guardrail blocked after retries: ${reasons}`);
            }

            return messages;
        }
    };
}

/**
 * Thinking block filter processor.
 *
 * Strips thinking content parts from assistant messages before they're saved to memory.
 * This prevents thinking tokens from leaking into conversation history and bloating
 * subsequent prompts (RC-2 fix for BigJim2 token bloat issue).
 *
 * Preserves text and tool_use parts while removing thinking parts.
 */
export function createThinkingFilterProcessor(): Processor<"thinking-filter"> {
    return {
        id: "thinking-filter" as const,
        name: "Thinking Block Filter",

        async processOutputResult({ messages }) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return messages.map((msg: any) => {
                if (msg.role !== "assistant") return msg;

                const content = msg.content;

                if (
                    typeof content === "object" &&
                    content !== null &&
                    "parts" in content &&
                    Array.isArray(content.parts)
                ) {
                    const originalPartsCount = content.parts.length;
                    const filteredParts = content.parts.filter(
                        (part: any) => part.type !== "thinking"
                    );

                    if (filteredParts.length !== originalPartsCount) {
                        const removedCount = originalPartsCount - filteredParts.length;
                        console.log(
                            `[ThinkingFilter] Removed ${removedCount} thinking block(s) from assistant message before memory save`
                        );

                        return {
                            ...msg,
                            content: {
                                ...content,
                                parts: filteredParts
                            }
                        };
                    }
                }

                if (Array.isArray(content)) {
                    const filteredContent = content.filter((part: any) => part.type !== "thinking");

                    if (filteredContent.length !== content.length) {
                        const removedCount = content.length - filteredContent.length;
                        console.log(
                            `[ThinkingFilter] Removed ${removedCount} thinking block(s) from assistant message before memory save`
                        );

                        return {
                            ...msg,
                            content: filteredContent.length > 0 ? filteredContent : content
                        };
                    }
                }

                return msg;
            });
        }
    };
}

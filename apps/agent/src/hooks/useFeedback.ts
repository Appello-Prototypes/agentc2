"use client";

import { useState, useCallback } from "react";
import { getApiBase } from "@/lib/utils";

export type FeedbackValue = boolean | null; // true = thumbs up, false = thumbs down, null = no feedback

export interface FeedbackState {
    value: FeedbackValue;
    isSubmitting: boolean;
    error: string | null;
}

interface UseFeedbackOptions {
    agentSlug: string;
    onSuccess?: (runId: string, value: boolean) => void;
    onError?: (runId: string, error: string) => void;
}

interface UseFeedbackReturn {
    /** Get the current feedback state for a run */
    getFeedback: (runId: string) => FeedbackState;
    /** Submit feedback for a run (true = thumbs up, false = thumbs down) */
    submitFeedback: (runId: string, thumbs: boolean) => Promise<void>;
    /** Check if any feedback is currently being submitted */
    isSubmitting: boolean;
}

/**
 * Hook for managing user feedback on agent runs.
 *
 * Features:
 * - Tracks feedback state per runId
 * - Optimistic UI updates
 * - Error handling with rollback
 * - Loading states
 *
 * @example
 * ```tsx
 * const { getFeedback, submitFeedback } = useFeedback({ agentSlug: "my-agent" });
 *
 * const feedback = getFeedback(runId);
 * <button onClick={() => submitFeedback(runId, true)}>
 *   <ThumbsUpIcon className={feedback.value === true ? "text-green-500" : ""} />
 * </button>
 * ```
 */
export function useFeedback({
    agentSlug,
    onSuccess,
    onError
}: UseFeedbackOptions): UseFeedbackReturn {
    // Store feedback state per runId
    const [feedbackMap, setFeedbackMap] = useState<Map<string, FeedbackState>>(new Map());

    // Track global submitting state
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getFeedback = useCallback(
        (runId: string): FeedbackState => {
            return (
                feedbackMap.get(runId) || {
                    value: null,
                    isSubmitting: false,
                    error: null
                }
            );
        },
        [feedbackMap]
    );

    const submitFeedback = useCallback(
        async (runId: string, thumbs: boolean): Promise<void> => {
            // Get current state for potential rollback
            const previousState = feedbackMap.get(runId);

            // Optimistically update the UI
            setFeedbackMap((prev) => {
                const next = new Map(prev);
                next.set(runId, {
                    value: thumbs,
                    isSubmitting: true,
                    error: null
                });
                return next;
            });
            setIsSubmitting(true);

            try {
                const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/feedback`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        runId,
                        thumbs
                    })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || "Failed to submit feedback");
                }

                // Success - update state to complete
                setFeedbackMap((prev) => {
                    const next = new Map(prev);
                    next.set(runId, {
                        value: thumbs,
                        isSubmitting: false,
                        error: null
                    });
                    return next;
                });

                onSuccess?.(runId, thumbs);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Failed to submit feedback";

                // Rollback to previous state on error
                setFeedbackMap((prev) => {
                    const next = new Map(prev);
                    next.set(runId, {
                        value: previousState?.value ?? null,
                        isSubmitting: false,
                        error: errorMessage
                    });
                    return next;
                });

                onError?.(runId, errorMessage);
            } finally {
                setIsSubmitting(false);
            }
        },
        [agentSlug, feedbackMap, onSuccess, onError]
    );

    return {
        getFeedback,
        submitFeedback,
        isSubmitting
    };
}

/**
 * Extract runId from message data parts.
 *
 * The chat API sends runId in a data-run-metadata message after text-start.
 * This helper extracts it from the message's parts.
 *
 * @example
 * ```tsx
 * const runId = extractRunIdFromMessage(message);
 * if (runId) {
 *   submitFeedback(runId, true);
 * }
 * ```
 */
export function extractRunIdFromMessage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: { parts?: Array<{ type: string; data?: any }> } | undefined
): string | null {
    if (!message?.parts) return null;

    for (const part of message.parts) {
        // Check for data-run-metadata type (our custom type)
        if (part.type === "data-run-metadata" && part.data) {
            const data = part.data;
            if (typeof data === "object" && data !== null && "runId" in data) {
                return (data as { runId: string }).runId;
            }
        }
        // Also check for generic data parts with runId
        if (part.type.startsWith("data") && part.data) {
            const data = part.data;
            // Handle array format
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (typeof item === "object" && item !== null && "runId" in item) {
                        return (item as { runId: string }).runId;
                    }
                }
            }
            // Handle object format
            if (typeof data === "object" && data !== null && "runId" in data) {
                return (data as { runId: string }).runId;
            }
        }
    }

    return null;
}

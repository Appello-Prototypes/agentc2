"use client";

import { cn } from "../../lib/utils";
import { LoaderIcon } from "./loader";
import type { HTMLAttributes } from "react";
import { memo, useEffect, useState } from "react";

export interface StreamingStatusProps extends HTMLAttributes<HTMLDivElement> {
    /** Current chat status from useChat */
    status: "submitted" | "streaming" | undefined;
    /** True when assistant text has started rendering in the conversation */
    hasVisibleContent?: boolean;
    /** Optional agent name for contextual feedback, e.g. "Research Agent" */
    agentName?: string;
}

/**
 * StreamingStatus -- replaces the static `<Loader />` spinner used in chat UIs
 * with contextual, progressive feedback during the submitted/streaming lifecycle.
 *
 * - submitted (no content yet): "Thinking..." -> escalates to "Still working..." after 4s
 * - streaming (no visible content): "Generating response..."
 * - streaming (visible content): hides itself (the text IS the feedback)
 * - undefined / idle: renders nothing
 */
export const StreamingStatus = memo(
    ({
        status,
        hasVisibleContent = false,
        agentName,
        className,
        ...props
    }: StreamingStatusProps) => {
        const [escalated, setEscalated] = useState(false);

        // Reset escalation when status changes
        useEffect(() => {
            setEscalated(false);

            if (status !== "submitted") return;

            const timer = setTimeout(() => {
                setEscalated(true);
            }, 4000);

            return () => clearTimeout(timer);
        }, [status]);

        // Don't render when idle or when streaming text is already visible
        if (!status) return null;
        if (status === "streaming" && hasVisibleContent) return null;

        let label: string;
        if (status === "submitted") {
            if (escalated) {
                label = "Still working";
            } else if (agentName) {
                label = `${agentName} is thinking`;
            } else {
                label = "Thinking";
            }
        } else {
            // streaming but no visible content yet
            label = "Generating response";
        }

        return (
            <div
                className={cn(
                    "text-muted-foreground flex items-center justify-center gap-2 py-3 text-sm",
                    "animate-in fade-in-0 duration-300",
                    className
                )}
                {...props}
            >
                <LoaderIcon className="animate-spin" size={14} />
                <span>
                    {label}
                    <span className="inline-flex w-5">
                        <AnimatedDots />
                    </span>
                </span>
            </div>
        );
    }
);

StreamingStatus.displayName = "StreamingStatus";

/** Three dots that appear sequentially via CSS animation */
function AnimatedDots() {
    return (
        <>
            <span className="animate-pulse" style={{ animationDelay: "0ms" }}>
                .
            </span>
            <span className="animate-pulse" style={{ animationDelay: "300ms" }}>
                .
            </span>
            <span className="animate-pulse" style={{ animationDelay: "600ms" }}>
                .
            </span>
        </>
    );
}

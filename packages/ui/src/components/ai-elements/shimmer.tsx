"use client";

import { cn } from "../../lib/utils";
import type { ComponentProps } from "react";
import { memo } from "react";

// ─── Shimmer ─────────────────────────────────────────────────────────────────
// Animated loading placeholder with gradient sweep effect.
// Use inside message bubbles during streaming gaps and Plan content areas.

export type ShimmerProps = ComponentProps<"div"> & {
    /** Number of shimmer lines to display */
    lines?: number;
    /** Width pattern for lines: "uniform" | "varied" (default) */
    pattern?: "uniform" | "varied";
};

const lineWidths = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3"];

export const Shimmer = memo(
    ({ className, lines = 3, pattern = "varied", ...props }: ShimmerProps) => {
        return (
            <div
                className={cn("flex flex-col gap-2.5 py-1", className)}
                role="status"
                aria-label="Loading"
                {...props}
            >
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "shimmer-line h-3 rounded",
                            pattern === "varied" ? lineWidths[i % lineWidths.length] : "w-full"
                        )}
                        style={{ animationDelay: `${i * 150}ms` }}
                    />
                ))}
            </div>
        );
    }
);

Shimmer.displayName = "Shimmer";

// ─── Shimmer Text ────────────────────────────────────────────────────────────
// Inline shimmer for single-line loading states (e.g., titles, labels).

export type ShimmerTextProps = ComponentProps<"span"> & {
    /** Width of the shimmer text */
    width?: string;
};

export const ShimmerText = memo(({ className, width = "8rem", ...props }: ShimmerTextProps) => (
    <span
        className={cn("shimmer-line inline-block h-4 rounded", className)}
        style={{ width }}
        role="status"
        aria-label="Loading"
        {...props}
    />
));

ShimmerText.displayName = "ShimmerText";

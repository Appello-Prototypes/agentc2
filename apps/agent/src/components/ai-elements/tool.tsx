"use client";

import * as React from "react";
import { cn } from "@repo/ui";

interface ToolProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Tool({ children, className, ...props }: ToolProps) {
    return (
        <div className={cn("bg-muted/50 overflow-hidden rounded-lg border", className)} {...props}>
            {children}
        </div>
    );
}

interface ToolHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    type?: string;
    state?: "input-available" | "output-available" | "output-error" | string;
}

export function ToolHeader({ type, state, className, ...props }: ToolHeaderProps) {
    const toolName = type?.replace("tool-", "") || "Tool";

    const stateColors = {
        "input-available": "text-yellow-600 dark:text-yellow-400",
        "output-available": "text-green-600 dark:text-green-400",
        "output-error": "text-red-600 dark:text-red-400"
    };

    const stateLabels = {
        "input-available": "Running...",
        "output-available": "Complete",
        "output-error": "Error"
    };

    return (
        <div
            className={cn(
                "bg-muted/80 flex items-center justify-between border-b px-3 py-2 text-sm font-medium",
                className
            )}
            {...props}
        >
            <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Tool:</span>
                <span>{toolName}</span>
            </span>
            {state && (
                <span
                    className={cn(
                        "text-xs",
                        stateColors[state as keyof typeof stateColors] || "text-muted-foreground"
                    )}
                >
                    {stateLabels[state as keyof typeof stateLabels] || state}
                </span>
            )}
        </div>
    );
}

interface ToolContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function ToolContent({ children, className, ...props }: ToolContentProps) {
    return (
        <div className={cn("space-y-2 p-3", className)} {...props}>
            {children}
        </div>
    );
}

interface ToolInputProps extends React.HTMLAttributes<HTMLDivElement> {
    input: Record<string, unknown>;
}

export function ToolInput({ input, className, ...props }: ToolInputProps) {
    if (!input || Object.keys(input).length === 0) return null;

    return (
        <div className={cn("text-xs", className)} {...props}>
            <div className="text-muted-foreground mb-1">Input:</div>
            <pre className="bg-background overflow-x-auto rounded p-2">
                {JSON.stringify(input, null, 2)}
            </pre>
        </div>
    );
}

interface ToolOutputProps extends React.HTMLAttributes<HTMLDivElement> {
    output?: unknown;
    errorText?: string;
}

export function ToolOutput({ output, errorText, className, ...props }: ToolOutputProps) {
    if (errorText) {
        return (
            <div className={cn("text-xs text-red-600 dark:text-red-400", className)} {...props}>
                <div className="text-muted-foreground mb-1">Error:</div>
                <pre className="overflow-x-auto rounded bg-red-50 p-2 dark:bg-red-950/50">
                    {errorText}
                </pre>
            </div>
        );
    }

    if (!output) return null;

    return (
        <div className={cn("text-xs", className)} {...props}>
            <div className="text-muted-foreground mb-1">Output:</div>
            <pre className="bg-background overflow-x-auto rounded p-2">
                {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
            </pre>
        </div>
    );
}

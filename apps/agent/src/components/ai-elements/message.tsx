"use client";

import * as React from "react";
import { cn } from "@repo/ui";

interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
    from: "user" | "assistant" | "system";
    children: React.ReactNode;
}

export function Message({ from, children, className, ...props }: MessageProps) {
    return (
        <div
            className={cn(
                "flex w-full",
                from === "user" ? "justify-end" : "justify-start",
                className
            )}
            {...props}
        >
            <div
                className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    from === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                )}
            >
                {children}
            </div>
        </div>
    );
}

interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function MessageContent({ children, className, ...props }: MessageContentProps) {
    return (
        <div className={cn("text-sm", className)} {...props}>
            {children}
        </div>
    );
}

interface MessageResponseProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function MessageResponse({ children, className, ...props }: MessageResponseProps) {
    return (
        <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)} {...props}>
            {children}
        </div>
    );
}

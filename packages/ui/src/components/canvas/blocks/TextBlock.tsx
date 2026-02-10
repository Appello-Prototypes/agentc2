"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";

const variantStyles: Record<string, string> = {
    default: "",
    muted: "text-muted-foreground",
    info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100",
    warning:
        "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100",
    success:
        "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100",
    error: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TextBlock({ config }: { config: any }) {
    const variant = config.variant || "default";
    const variantClass = variantStyles[variant] || "";

    return (
        <div
            className={cn(
                "rounded-lg text-sm leading-relaxed",
                variant !== "default" && variant !== "muted" && "border p-4",
                variantClass,
                config.className
            )}
        >
            {config.title && <h3 className="mb-2 text-sm font-semibold">{config.title}</h3>}
            <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                    __html: simpleMarkdown(config.content || "")
                }}
            />
        </div>
    );
}

/** Very simple markdown to HTML (bold, italic, links, code, headings, lists) */
function simpleMarkdown(text: string): string {
    return text
        .replace(/^### (.*$)/gm, "<h4>$1</h4>")
        .replace(/^## (.*$)/gm, "<h3>$1</h3>")
        .replace(/^# (.*$)/gm, "<h2>$1</h2>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
        .replace(/^- (.*$)/gm, "<li>$1</li>")
        .replace(/(<li>[\s\S]*<\/li>)/g, "<ul>$1</ul>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>");
}

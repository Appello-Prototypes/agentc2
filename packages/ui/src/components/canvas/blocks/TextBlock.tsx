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

/** Simple markdown to HTML (bold, italic, links, code, headings, lists, paragraphs) */
function simpleMarkdown(text: string): string {
    // Split into lines for block-level processing
    const lines = text.split("\n");
    const html: string[] = [];
    let inList = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Headings
        if (trimmed.startsWith("### ")) {
            if (inList) { html.push("</ul>"); inList = false; }
            html.push(`<h4>${inlineMarkdown(trimmed.slice(4))}</h4>`);
        } else if (trimmed.startsWith("## ")) {
            if (inList) { html.push("</ul>"); inList = false; }
            html.push(`<h3>${inlineMarkdown(trimmed.slice(3))}</h3>`);
        } else if (trimmed.startsWith("# ")) {
            if (inList) { html.push("</ul>"); inList = false; }
            html.push(`<h2>${inlineMarkdown(trimmed.slice(2))}</h2>`);
        }
        // List items
        else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            if (!inList) { html.push("<ul>"); inList = true; }
            html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
        }
        // Numbered list items
        else if (/^\d+\.\s/.test(trimmed)) {
            if (!inList) { html.push("<ol>"); inList = true; }
            html.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s/, ""))}</li>`);
        }
        // Empty line = paragraph break
        else if (trimmed === "") {
            if (inList) { html.push("</ul>"); inList = false; }
            html.push("<br>");
        }
        // Regular text
        else {
            if (inList) { html.push("</ul>"); inList = false; }
            html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
        }
    }

    if (inList) html.push("</ul>");

    return html.join("");
}

/** Inline markdown transforms (bold, italic, code, links) */
function inlineMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>")
        .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>'
        );
}

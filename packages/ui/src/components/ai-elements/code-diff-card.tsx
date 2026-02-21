"use client";

import { cn } from "../../lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { Badge } from "../badge";
import { Button } from "../button";
import {
    ChevronDownIcon,
    CopyIcon,
    DiffIcon,
    FileCodeIcon,
    PlusIcon,
    MinusIcon
} from "lucide-react";
import type { ComponentProps } from "react";
import { memo, useState, useMemo, useCallback } from "react";

interface DiffLine {
    type: "added" | "removed" | "context";
    content: string;
    lineNumber?: number;
}

function parseDiffLines(diff: string): DiffLine[] {
    return diff.split("\n").map((line) => {
        if (line.startsWith("+") && !line.startsWith("+++")) {
            return { type: "added", content: line.slice(1) };
        }
        if (line.startsWith("-") && !line.startsWith("---")) {
            return { type: "removed", content: line.slice(1) };
        }
        if (line.startsWith(" ")) {
            return { type: "context", content: line.slice(1) };
        }
        return { type: "context", content: line };
    });
}

/**
 * Detect whether a string contains a unified diff pattern.
 */
export function isDiffResult(result: unknown): boolean {
    if (typeof result !== "string") return false;
    const text = result;

    // Unified diff markers
    if (text.includes("--- a/") && text.includes("+++ b/")) return true;
    if (text.includes("@@ -") && text.includes(" @@")) return true;

    // Heuristic: many lines starting with + or - (at least 4 each)
    const lines = text.split("\n");
    let addCount = 0;
    let removeCount = 0;
    for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) addCount++;
        if (line.startsWith("-") && !line.startsWith("---")) removeCount++;
    }
    return addCount >= 4 && removeCount >= 2;
}

function extractFilenames(diff: string): { from?: string; to?: string } {
    const fromMatch = diff.match(/^--- a\/(.+)$/m);
    const toMatch = diff.match(/^\+\+\+ b\/(.+)$/m);
    return {
        from: fromMatch?.[1],
        to: toMatch?.[1]
    };
}

// ─── Main Component ───────────────────────────────────────────────────────

export interface CodeDiffCardProps extends ComponentProps<"div"> {
    result: string;
    toolName: string;
}

export const CodeDiffCard = memo(({ result, toolName, className, ...props }: CodeDiffCardProps) => {
    const [expanded, setExpanded] = useState(false);

    const { lines, stats, filenames } = useMemo(() => {
        const parsed = parseDiffLines(result);
        const added = parsed.filter((l) => l.type === "added").length;
        const removed = parsed.filter((l) => l.type === "removed").length;
        return {
            lines: parsed,
            stats: { added, removed },
            filenames: extractFilenames(result)
        };
    }, [result]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(result);
    }, [result]);

    const displayFilename = filenames.to || filenames.from || "changes";

    return (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div
                className={cn(
                    "bg-card border-border/60 my-2 overflow-hidden rounded-lg border",
                    "animate-in fade-in-0 slide-in-from-top-1 duration-200",
                    className
                )}
                {...props}
            >
                <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors">
                    <div className="bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-md">
                        <DiffIcon className="text-primary size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <FileCodeIcon className="text-muted-foreground size-3" />
                            <span className="text-foreground truncate font-mono text-sm">
                                {displayFilename}
                            </span>
                        </div>
                        {!expanded && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                {stats.added > 0 && (
                                    <span className="text-green-600 dark:text-green-400">
                                        +{stats.added}
                                    </span>
                                )}
                                {stats.added > 0 && stats.removed > 0 && " "}
                                {stats.removed > 0 && (
                                    <span className="text-red-500 dark:text-red-400">
                                        -{stats.removed}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                            <DiffIcon className="size-2.5" />
                            Diff
                        </Badge>
                        <ChevronDownIcon
                            className={cn(
                                "text-muted-foreground size-4 shrink-0 transition-transform",
                                expanded && "rotate-180"
                            )}
                        />
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="border-t">
                        <div className="text-muted-foreground flex items-center justify-between px-3 py-1.5">
                            <div className="flex items-center gap-3 text-[10px]">
                                <span className="font-medium tracking-wider uppercase">
                                    Changes
                                </span>
                                <span className="text-green-600 dark:text-green-400">
                                    <PlusIcon className="mr-0.5 inline size-2.5" />
                                    {stats.added}
                                </span>
                                <span className="text-red-500 dark:text-red-400">
                                    <MinusIcon className="mr-0.5 inline size-2.5" />
                                    {stats.removed}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy();
                                }}
                            >
                                <CopyIcon className="size-3" />
                            </Button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            <pre className="text-xs leading-5">
                                {lines.map((line, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "px-3",
                                            line.type === "added" &&
                                                "bg-green-500/10 text-green-700 dark:text-green-300",
                                            line.type === "removed" &&
                                                "bg-red-500/10 text-red-700 dark:text-red-300",
                                            line.type === "context" && "text-foreground/70"
                                        )}
                                    >
                                        <span className="text-muted-foreground/50 mr-2 inline-block w-4 text-right select-none">
                                            {line.type === "added"
                                                ? "+"
                                                : line.type === "removed"
                                                  ? "-"
                                                  : " "}
                                        </span>
                                        {line.content}
                                    </div>
                                ))}
                            </pre>
                        </div>
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
});

CodeDiffCard.displayName = "CodeDiffCard";

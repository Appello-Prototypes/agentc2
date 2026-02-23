"use client";

import { cn } from "../../lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { Button } from "../button";
import { Badge } from "../badge";
import {
    CheckIcon,
    ChevronDownIcon,
    CopyIcon,
    Loader2Icon,
    WrenchIcon,
    XCircleIcon,
    CodeIcon,
    FileTextIcon,
    DatabaseIcon,
    SearchIcon,
    GlobeIcon,
    MailIcon,
    MessageSquareIcon,
    BrainIcon
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { memo, useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
    CodeBlock,
    CodeBlockHeader,
    CodeBlockTitle,
    CodeBlockFilename,
    CodeBlockActions,
    CodeBlockCopyButton,
    CodeBlockContent
} from "./code-block";
import type { BundledLanguage } from "shiki";

const TOOL_ICONS: Record<string, typeof WrenchIcon> = {
    search: SearchIcon,
    web: GlobeIcon,
    code: CodeIcon,
    file: FileTextIcon,
    database: DatabaseIcon,
    email: MailIcon,
    mail: MailIcon,
    gmail: MailIcon,
    slack: MessageSquareIcon,
    message: MessageSquareIcon,
    think: BrainIcon,
    reason: BrainIcon
};

function getToolIcon(toolName: string) {
    const lower = toolName.toLowerCase();
    for (const [key, Icon] of Object.entries(TOOL_ICONS)) {
        if (lower.includes(key)) return Icon;
    }
    return WrenchIcon;
}

function humanizeToolName(name: string): string {
    return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectLanguage(content: string, toolName?: string): BundledLanguage | null {
    if (toolName?.toLowerCase().includes("python")) return "python";
    if (toolName?.toLowerCase().includes("typescript") || toolName?.toLowerCase().includes("ts"))
        return "typescript";
    if (toolName?.toLowerCase().includes("javascript") || toolName?.toLowerCase().includes("js"))
        return "javascript";
    if (toolName?.toLowerCase().includes("bash") || toolName?.toLowerCase().includes("shell"))
        return "bash";

    if (content.includes("function ") || content.includes("const ") || content.includes("import "))
        return "typescript";
    if (content.includes("def ") || content.includes("import ") || content.includes("class "))
        return "python";
    if (content.startsWith("{") || content.startsWith("[")) return "json";
    if (content.includes("#!/bin/") || content.includes("$ ")) return "bash";

    return null;
}

function isCodeLike(text: string): boolean {
    if (!text || text.length < 20) return false;
    const codeIndicators = [
        /^[\s]*[{[\]]/m,
        /function\s+\w+/,
        /const\s+\w+\s*=/,
        /let\s+\w+\s*=/,
        /var\s+\w+\s*=/,
        /import\s+/,
        /export\s+/,
        /def\s+\w+/,
        /class\s+\w+/,
        /=>\s*[{(]/,
        /^\s*#\s/m
    ];
    return codeIndicators.some((re) => re.test(text));
}

function tryParseJson(text: string): unknown | null {
    if (!text.startsWith("{") && !text.startsWith("[")) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function formatResultPreview(result: unknown): string {
    if (result === null || result === undefined) return "No result";
    if (typeof result === "string") {
        if (result.length > 120) return `${result.slice(0, 117)}...`;
        return result;
    }
    if (typeof result === "object") {
        const str = JSON.stringify(result);
        if (str.length > 120) return `${str.slice(0, 117)}...`;
        return str;
    }
    return String(result);
}

// ─── Rich Result Renderer ─────────────────────────────────────────────────

function RichResult({ result, toolName }: { result: unknown; toolName: string }) {
    const stringified = useMemo(() => {
        if (typeof result === "string") return result;
        try {
            return JSON.stringify(result, null, 2);
        } catch {
            return String(result);
        }
    }, [result]);

    if (typeof result === "string" && result.trim().length === 0) {
        return (
            <div className="text-muted-foreground px-3 py-2 text-xs italic">
                Tool completed with no output
            </div>
        );
    }

    if (typeof result === "object" && result !== null) {
        const json = JSON.stringify(result, null, 2);
        return (
            <div className="overflow-hidden rounded-b-lg">
                <CodeBlock code={json} language="json">
                    <CodeBlockHeader>
                        <CodeBlockTitle>
                            <DatabaseIcon size={12} />
                            <CodeBlockFilename>result.json</CodeBlockFilename>
                        </CodeBlockTitle>
                        <CodeBlockActions>
                            <CodeBlockCopyButton />
                        </CodeBlockActions>
                    </CodeBlockHeader>
                </CodeBlock>
            </div>
        );
    }

    if (typeof result === "string") {
        const lang = detectLanguage(result, toolName);
        if (lang || isCodeLike(result)) {
            return (
                <div className="overflow-hidden rounded-b-lg">
                    <CodeBlock code={result} language={lang || ("plaintext" as BundledLanguage)}>
                        <CodeBlockHeader>
                            <CodeBlockTitle>
                                <CodeIcon size={12} />
                                <CodeBlockFilename>output</CodeBlockFilename>
                            </CodeBlockTitle>
                            <CodeBlockActions>
                                <CodeBlockCopyButton />
                            </CodeBlockActions>
                        </CodeBlockHeader>
                    </CodeBlock>
                </div>
            );
        }

        const parsed = tryParseJson(result);
        if (parsed) {
            return (
                <div className="overflow-hidden rounded-b-lg">
                    <CodeBlock code={JSON.stringify(parsed, null, 2)} language="json">
                        <CodeBlockHeader>
                            <CodeBlockTitle>
                                <DatabaseIcon size={12} />
                                <CodeBlockFilename>result.json</CodeBlockFilename>
                            </CodeBlockTitle>
                            <CodeBlockActions>
                                <CodeBlockCopyButton />
                            </CodeBlockActions>
                        </CodeBlockHeader>
                    </CodeBlock>
                </div>
            );
        }

        if (result.length > 500) {
            return (
                <div className="max-h-64 overflow-y-auto px-3 py-2">
                    <pre className="text-foreground/80 text-xs leading-relaxed whitespace-pre-wrap">
                        {result}
                    </pre>
                </div>
            );
        }

        return (
            <div className="px-3 py-2">
                <p className="text-foreground/80 text-xs leading-relaxed">{result}</p>
            </div>
        );
    }

    return (
        <div className="px-3 py-2">
            <pre className="text-foreground/80 text-xs">{stringified}</pre>
        </div>
    );
}

// ─── Input Viewer ─────────────────────────────────────────────────────────

function InputViewer({ input }: { input: Record<string, unknown> }) {
    if (!input || Object.keys(input).length === 0) return null;

    return (
        <div className="border-t px-3 py-2">
            <div className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase">
                Input
            </div>
            <div className="space-y-1">
                {Object.entries(input).map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground shrink-0 font-mono">{key}:</span>
                        <span className="text-foreground/80 min-w-0 truncate">
                            {typeof value === "string"
                                ? value.length > 100
                                    ? `${value.slice(0, 97)}...`
                                    : value
                                : JSON.stringify(value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Duration Display ─────────────────────────────────────────────────────

function DurationBadge({ startTime }: { startTime: number }) {
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [startTime]);

    if (elapsed < 1) return null;

    return <span className="text-muted-foreground/50 text-[10px] tabular-nums">{elapsed}s</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────

export interface ToolInvocationCardProps extends ComponentProps<"div"> {
    toolName: string;
    hasResult: boolean;
    input?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    startTime?: number;
    displayLabel?: string;
}

export const ToolInvocationCard = memo(
    ({
        toolName,
        hasResult,
        input,
        result,
        error,
        startTime,
        displayLabel,
        className,
        ...props
    }: ToolInvocationCardProps) => {
        const [expanded, setExpanded] = useState(false);
        const displayName = displayLabel ?? humanizeToolName(toolName);
        const Icon = getToolIcon(toolName);
        const isRunning = !hasResult && !error;
        const hasError = !!error;

        const handleCopyResult = useCallback(() => {
            if (!result) return;
            const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
            navigator.clipboard.writeText(text);
        }, [result]);

        if (isRunning) {
            return (
                <div
                    className={cn(
                        "bg-muted/30 my-2 flex items-center gap-2.5 rounded-lg border px-3 py-2.5",
                        "animate-in fade-in-0 slide-in-from-top-1 duration-200",
                        className
                    )}
                    {...props}
                >
                    <div className="bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-md">
                        <Loader2Icon className="text-primary size-3.5 animate-spin" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className="text-foreground text-sm font-medium">{displayName}</span>
                    </div>
                    {startTime && <DurationBadge startTime={startTime} />}
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Loader2Icon className="size-2.5 animate-spin" />
                        Running
                    </Badge>
                </div>
            );
        }

        return (
            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <div
                    className={cn(
                        "my-2 overflow-hidden rounded-lg border",
                        hasError
                            ? "border-destructive/30 bg-destructive/5"
                            : "bg-card border-border/60",
                        "animate-in fade-in-0 slide-in-from-top-1 duration-200",
                        className
                    )}
                    {...props}
                >
                    <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors">
                        <div
                            className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-md",
                                hasError ? "bg-destructive/10" : "bg-primary/10"
                            )}
                        >
                            {hasError ? (
                                <XCircleIcon className="text-destructive size-3.5" />
                            ) : (
                                <Icon className="text-primary size-3.5" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-foreground text-sm font-medium">
                                {displayName}
                            </span>
                            {!expanded && result !== undefined && !hasError && (
                                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                    {String(formatResultPreview(result))}
                                </p>
                            )}
                            {hasError && (
                                <p className="text-destructive mt-0.5 truncate text-xs">{error}</p>
                            )}
                        </div>
                        <Badge
                            variant={hasError ? "destructive" : "default"}
                            className="gap-1 text-[10px]"
                        >
                            {hasError ? (
                                <>
                                    <XCircleIcon className="size-2.5" />
                                    Error
                                </>
                            ) : (
                                <>
                                    <CheckIcon className="size-2.5" />
                                    Done
                                </>
                            )}
                        </Badge>
                        <ChevronDownIcon
                            className={cn(
                                "text-muted-foreground size-4 shrink-0 transition-transform",
                                expanded && "rotate-180"
                            )}
                        />
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        {input && Object.keys(input).length > 0 && <InputViewer input={input} />}
                        {result !== undefined && !hasError && (
                            <div className="border-t">
                                <div className="text-muted-foreground flex items-center justify-between px-3 py-1.5">
                                    <span className="text-[10px] font-medium tracking-wider uppercase">
                                        Output
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyResult();
                                        }}
                                    >
                                        <CopyIcon className="size-3" />
                                    </Button>
                                </div>
                                <RichResult result={result} toolName={toolName} />
                            </div>
                        )}
                        {hasError && error && (
                            <div className="border-destructive/20 border-t px-3 py-2">
                                <pre className="text-destructive text-xs whitespace-pre-wrap">
                                    {error}
                                </pre>
                            </div>
                        )}
                    </CollapsibleContent>
                </div>
            </Collapsible>
        );
    }
);

ToolInvocationCard.displayName = "ToolInvocationCard";

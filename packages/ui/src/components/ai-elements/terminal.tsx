"use client";

import { cn } from "../../lib/utils";
import { Button } from "../button";
import { CheckIcon, CopyIcon, TrashIcon, TerminalSquareIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

// ─── Terminal Container ───────────────────────────────────────────────────

export type TerminalProps = ComponentProps<"div"> & {
    output?: string;
    isStreaming?: boolean;
    autoScroll?: boolean;
    onClear?: () => void;
};

export const Terminal = memo(
    ({
        output = "",
        isStreaming = false,
        autoScroll = true,
        onClear,
        className,
        children,
        ...props
    }: TerminalProps) => (
        <div
            className={cn(
                "not-prose my-3 overflow-hidden rounded-lg border bg-[#1a1b26] text-[#a9b1d6] shadow-sm",
                "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                className
            )}
            {...props}
        >
            {children || (
                <>
                    <TerminalHeader>
                        <TerminalTitle>Terminal</TerminalTitle>
                        {isStreaming && <TerminalStatus>Running</TerminalStatus>}
                        <TerminalActions>
                            <TerminalCopyButton content={output} />
                            {onClear && <TerminalClearButton onClick={onClear} />}
                        </TerminalActions>
                    </TerminalHeader>
                    <TerminalContent
                        output={output}
                        isStreaming={isStreaming}
                        autoScroll={autoScroll}
                    />
                </>
            )}
        </div>
    )
);

// ─── Terminal Header ──────────────────────────────────────────────────────

export type TerminalHeaderProps = ComponentProps<"div">;

export const TerminalHeader = memo(({ className, children, ...props }: TerminalHeaderProps) => (
    <div
        className={cn("flex items-center gap-2 border-b border-[#2a2b3d] px-3 py-2", className)}
        {...props}
    >
        {/* macOS-style dots */}
        <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-1 items-center justify-between gap-2">{children}</div>
    </div>
));

// ─── Terminal Title ───────────────────────────────────────────────────────

export type TerminalTitleProps = ComponentProps<"div">;

export const TerminalTitle = memo(({ className, children, ...props }: TerminalTitleProps) => (
    <div className={cn("flex items-center gap-1.5 text-xs text-[#565f89]", className)} {...props}>
        <TerminalSquareIcon className="size-3" />
        {children}
    </div>
));

// ─── Terminal Status ──────────────────────────────────────────────────────

export type TerminalStatusProps = ComponentProps<"div">;

export const TerminalStatus = memo(({ className, children, ...props }: TerminalStatusProps) => (
    <div className={cn("flex items-center gap-1.5 text-xs", className)} {...props}>
        <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
        <span className="text-green-400/80">{children || "Running"}</span>
    </div>
));

// ─── Terminal Actions ─────────────────────────────────────────────────────

export type TerminalActionsProps = ComponentProps<"div">;

export const TerminalActions = memo(({ className, children, ...props }: TerminalActionsProps) => (
    <div className={cn("ml-auto flex items-center gap-1", className)} {...props}>
        {children}
    </div>
));

// ─── Terminal Copy Button ─────────────────────────────────────────────────

export type TerminalCopyButtonProps = ComponentProps<typeof Button> & {
    content?: string;
    onCopy?: () => void;
    onError?: (error: Error) => void;
    timeout?: number;
};

export const TerminalCopyButton = memo(
    ({
        content = "",
        onCopy,
        onError,
        timeout = 2000,
        className,
        ...props
    }: TerminalCopyButtonProps) => {
        const [copied, setCopied] = useState(false);
        const timeoutRef = useRef<number>(0);

        const handleCopy = useCallback(async () => {
            try {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                onCopy?.();
                timeoutRef.current = window.setTimeout(() => setCopied(false), timeout);
            } catch (err) {
                onError?.(err as Error);
            }
        }, [content, onCopy, onError, timeout]);

        const Icon = copied ? CheckIcon : CopyIcon;

        return (
            <Button
                className={cn(
                    "size-6 text-[#565f89] hover:bg-[#2a2b3d] hover:text-[#a9b1d6]",
                    className
                )}
                size="icon"
                variant="ghost"
                onClick={handleCopy}
                {...props}
            >
                <Icon className="size-3" />
            </Button>
        );
    }
);

// ─── Terminal Clear Button ────────────────────────────────────────────────

export type TerminalClearButtonProps = ComponentProps<typeof Button>;

export const TerminalClearButton = memo(({ className, ...props }: TerminalClearButtonProps) => (
    <Button
        className={cn("size-6 text-[#565f89] hover:bg-[#2a2b3d] hover:text-[#a9b1d6]", className)}
        size="icon"
        variant="ghost"
        {...props}
    >
        <TrashIcon className="size-3" />
    </Button>
));

// ─── Terminal Content ─────────────────────────────────────────────────────

export type TerminalContentProps = ComponentProps<"div"> & {
    output?: string;
    isStreaming?: boolean;
    autoScroll?: boolean;
};

export const TerminalContent = memo(
    ({
        output = "",
        isStreaming = false,
        autoScroll = true,
        className,
        ...props
    }: TerminalContentProps) => {
        const scrollRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (autoScroll && scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, [output, autoScroll]);

        return (
            <div
                ref={scrollRef}
                className={cn(
                    "max-h-80 overflow-auto p-3 font-mono text-xs leading-relaxed",
                    className
                )}
                {...props}
            >
                <pre className="break-words whitespace-pre-wrap">
                    {output}
                    {isStreaming && <span className="animate-pulse text-green-400">_</span>}
                </pre>
            </div>
        );
    }
);

Terminal.displayName = "Terminal";
TerminalHeader.displayName = "TerminalHeader";
TerminalTitle.displayName = "TerminalTitle";
TerminalStatus.displayName = "TerminalStatus";
TerminalActions.displayName = "TerminalActions";
TerminalCopyButton.displayName = "TerminalCopyButton";
TerminalClearButton.displayName = "TerminalClearButton";
TerminalContent.displayName = "TerminalContent";

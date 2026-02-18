"use client";

import { cn } from "../../lib/utils";
import { Button } from "../button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";
import {
    CheckIcon,
    CopyIcon,
    DownloadIcon,
    ExternalLinkIcon,
    XIcon,
    type LucideIcon
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { memo, useCallback, useRef, useState } from "react";

// ─── Artifact Container ───────────────────────────────────────────────────

export type ArtifactProps = ComponentProps<"div">;

export const Artifact = memo(({ className, children, ...props }: ArtifactProps) => (
    <div
        className={cn(
            "bg-card not-prose my-3 overflow-hidden rounded-lg border shadow-sm",
            "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
            className
        )}
        {...props}
    >
        {children}
    </div>
));

// ─── Artifact Header ──────────────────────────────────────────────────────

export type ArtifactHeaderProps = ComponentProps<"div">;

export const ArtifactHeader = memo(({ className, children, ...props }: ArtifactHeaderProps) => (
    <div
        className={cn(
            "bg-muted/50 flex items-center justify-between gap-2 border-b px-3 py-2",
            className
        )}
        {...props}
    >
        {children}
    </div>
));

// ─── Artifact Title ───────────────────────────────────────────────────────

export type ArtifactTitleProps = ComponentProps<"p">;

export const ArtifactTitle = memo(({ className, ...props }: ArtifactTitleProps) => (
    <p className={cn("text-sm font-medium", className)} {...props} />
));

// ─── Artifact Description ─────────────────────────────────────────────────

export type ArtifactDescriptionProps = ComponentProps<"p">;

export const ArtifactDescription = memo(({ className, ...props }: ArtifactDescriptionProps) => (
    <p className={cn("text-muted-foreground text-xs", className)} {...props} />
));

// ─── Artifact Actions ─────────────────────────────────────────────────────

export type ArtifactActionsProps = ComponentProps<"div">;

export const ArtifactActions = memo(({ className, children, ...props }: ArtifactActionsProps) => (
    <div className={cn("flex items-center gap-1", className)} {...props}>
        {children}
    </div>
));

// ─── Artifact Action Button ───────────────────────────────────────────────

export type ArtifactActionProps = ComponentProps<typeof Button> & {
    tooltip?: string;
    label?: string;
    icon?: LucideIcon;
};

export const ArtifactAction = memo(
    ({
        tooltip,
        label,
        icon: Icon,
        children,
        variant = "ghost",
        size = "icon",
        className,
        ...props
    }: ArtifactActionProps) => {
        const button = (
            <Button className={cn("size-7", className)} size={size} variant={variant} {...props}>
                {Icon && <Icon className="size-3.5" />}
                {children}
                <span className="sr-only">{label || tooltip}</span>
            </Button>
        );

        if (tooltip) {
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger render={button} />
                        <TooltipContent>
                            <p>{tooltip}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        return button;
    }
);

// ─── Artifact Copy Button ─────────────────────────────────────────────────

export type ArtifactCopyButtonProps = ComponentProps<typeof Button> & {
    content: string;
    timeout?: number;
};

export const ArtifactCopyButton = memo(
    ({ content, timeout = 2000, className, ...props }: ArtifactCopyButtonProps) => {
        const [copied, setCopied] = useState(false);
        const timeoutRef = useRef<number>(0);

        const handleCopy = useCallback(() => {
            navigator.clipboard.writeText(content);
            setCopied(true);
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => setCopied(false), timeout);
        }, [content, timeout]);

        const Icon = copied ? CheckIcon : CopyIcon;

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                className={cn("size-7", className)}
                                size="icon"
                                variant="ghost"
                                onClick={handleCopy}
                                {...props}
                            >
                                <Icon className="size-3.5" />
                                <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
                            </Button>
                        }
                    />
                    <TooltipContent>
                        <p>{copied ? "Copied!" : "Copy to clipboard"}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
);

// ─── Artifact Close Button ────────────────────────────────────────────────

export type ArtifactCloseProps = ComponentProps<typeof Button>;

export const ArtifactClose = memo(({ className, ...props }: ArtifactCloseProps) => (
    <Button className={cn("size-7", className)} size="icon" variant="ghost" {...props}>
        <XIcon className="size-3.5" />
        <span className="sr-only">Close</span>
    </Button>
));

// ─── Artifact Content ─────────────────────────────────────────────────────

export type ArtifactContentProps = ComponentProps<"div">;

export const ArtifactContent = memo(({ className, children, ...props }: ArtifactContentProps) => (
    <div className={cn("relative", className)} {...props}>
        {children}
    </div>
));

Artifact.displayName = "Artifact";
ArtifactHeader.displayName = "ArtifactHeader";
ArtifactTitle.displayName = "ArtifactTitle";
ArtifactDescription.displayName = "ArtifactDescription";
ArtifactActions.displayName = "ArtifactActions";
ArtifactAction.displayName = "ArtifactAction";
ArtifactCopyButton.displayName = "ArtifactCopyButton";
ArtifactClose.displayName = "ArtifactClose";
ArtifactContent.displayName = "ArtifactContent";

"use client";

import { cn } from "../../lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { ChevronDownIcon, CircleIcon, CheckCircle2Icon, ListIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { memo } from "react";

// ─── Queue Component ─────────────────────────────────────────────────────────
// A task list / todo display component for showing pending, active, and
// completed items in AI workflows.

export type QueueProps = ComponentProps<"div">;

export const Queue = memo(({ className, children, ...props }: QueueProps) => (
    <div
        className={cn("bg-card not-prose overflow-hidden rounded-lg border", className)}
        {...props}
    >
        {children}
    </div>
));

export type QueueSectionProps = ComponentProps<typeof Collapsible> & {
    defaultOpen?: boolean;
};

export const QueueSection = memo(
    ({ className, defaultOpen = true, children, ...props }: QueueSectionProps) => (
        <Collapsible defaultOpen={defaultOpen} className={cn("", className)} {...props}>
            {children}
        </Collapsible>
    )
);

export type QueueSectionTriggerProps = ComponentProps<"button">;

export const QueueSectionTrigger = memo(
    ({ className, children, ...props }: QueueSectionTriggerProps) => (
        <CollapsibleTrigger
            className={cn(
                "hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                className
            )}
            {...(props as ComponentProps<typeof CollapsibleTrigger>)}
        >
            <ChevronDownIcon className="size-3.5 transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
            {children}
        </CollapsibleTrigger>
    )
);

export type QueueSectionLabelProps = ComponentProps<"span"> & {
    label?: string;
    count?: number;
    icon?: ReactNode;
};

export const QueueSectionLabel = memo(
    ({ className, label, count, icon, ...props }: QueueSectionLabelProps) => (
        <span className={cn("flex items-center gap-2", className)} {...props}>
            {icon || <ListIcon className="size-3.5" />}
            <span className="flex-1 text-left">{label}</span>
            {count !== undefined && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs">
                    {count}
                </span>
            )}
        </span>
    )
);

export type QueueSectionContentProps = ComponentProps<typeof CollapsibleContent>;

export const QueueSectionContent = memo(
    ({ className, children, ...props }: QueueSectionContentProps) => (
        <CollapsibleContent className={cn("", className)} {...props}>
            {children}
        </CollapsibleContent>
    )
);

export type QueueListProps = ComponentProps<"div"> & {
    maxHeight?: string;
};

export const QueueList = memo(
    ({ className, maxHeight = "20rem", children, ...props }: QueueListProps) => (
        <div className={cn("overflow-y-auto", className)} style={{ maxHeight }} {...props}>
            <ul className="divide-y">{children}</ul>
        </div>
    )
);

export type QueueItemProps = ComponentProps<"li">;

export const QueueItem = memo(({ className, children, ...props }: QueueItemProps) => (
    <li className={cn("group flex items-start gap-2.5 px-3 py-2", className)} {...props}>
        {children}
    </li>
));

export type QueueItemIndicatorProps = ComponentProps<"span"> & {
    completed?: boolean;
};

export const QueueItemIndicator = memo(
    ({ className, completed = false, ...props }: QueueItemIndicatorProps) => {
        const Icon = completed ? CheckCircle2Icon : CircleIcon;
        return (
            <span className={cn("mt-0.5 shrink-0", className)} {...props}>
                <Icon
                    className={cn(
                        "size-3.5",
                        completed ? "text-primary" : "text-muted-foreground/50"
                    )}
                />
            </span>
        );
    }
);

export type QueueItemContentProps = ComponentProps<"span"> & {
    completed?: boolean;
};

export const QueueItemContent = memo(
    ({ className, completed = false, children, ...props }: QueueItemContentProps) => (
        <span
            className={cn(
                "min-w-0 flex-1 text-sm",
                completed && "text-muted-foreground line-through",
                className
            )}
            {...props}
        >
            {children}
        </span>
    )
);

export type QueueItemDescriptionProps = ComponentProps<"div"> & {
    completed?: boolean;
};

export const QueueItemDescription = memo(
    ({ className, completed = false, children, ...props }: QueueItemDescriptionProps) => (
        <div
            className={cn(
                "text-muted-foreground mt-0.5 text-xs",
                completed && "text-muted-foreground/50",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
);

export type QueueItemActionsProps = ComponentProps<"div">;

export const QueueItemActions = memo(({ className, children, ...props }: QueueItemActionsProps) => (
    <div
        className={cn(
            "ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
            className
        )}
        {...props}
    >
        {children}
    </div>
));

// ─── Type Exports ────────────────────────────────────────────────────────────

export interface QueueMessagePart {
    type: string;
    text?: string;
    url?: string;
    filename?: string;
    mediaType?: string;
}

export interface QueueMessage {
    id: string;
    parts: QueueMessagePart[];
}

export interface QueueTodo {
    id: string;
    title: string;
    description?: string;
    status?: "pending" | "completed";
}

Queue.displayName = "Queue";
QueueSection.displayName = "QueueSection";
QueueSectionTrigger.displayName = "QueueSectionTrigger";
QueueSectionLabel.displayName = "QueueSectionLabel";
QueueSectionContent.displayName = "QueueSectionContent";
QueueList.displayName = "QueueList";
QueueItem.displayName = "QueueItem";
QueueItemIndicator.displayName = "QueueItemIndicator";
QueueItemContent.displayName = "QueueItemContent";
QueueItemDescription.displayName = "QueueItemDescription";
QueueItemActions.displayName = "QueueItemActions";

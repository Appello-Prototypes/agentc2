"use client";

import { Badge } from "../badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { cn } from "../../lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
    CheckIcon,
    ChevronDownIcon,
    CircleAlertIcon,
    CircleDashedIcon,
    ClockIcon,
    Loader2Icon,
    XCircleIcon
} from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
    <Collapsible className={cn("bg-muted/30 rounded-lg border", className)} {...props} />
);

export type ToolHeaderProps = Omit<ComponentProps<typeof CollapsibleTrigger>, "type"> & {
    title?: string;
    type: ToolUIPart["type"] | DynamicToolUIPart["type"];
    state: ToolUIPart["state"] | DynamicToolUIPart["state"];
    toolName?: string;
};

export const ToolHeader = ({
    title,
    type,
    state,
    toolName,
    className,
    ...props
}: ToolHeaderProps) => {
    const typeStr = typeof type === "string" ? type : "";
    const name = toolName || typeStr.replace("tool-", "") || "Tool";

    return (
        <CollapsibleTrigger
            className={cn(
                "hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium [&[data-state=open]>svg]:rotate-180",
                className
            )}
            {...props}
        >
            <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Tool:</span>
                <span>{title || name}</span>
            </span>
            <div className="flex items-center gap-2">
                {getStatusBadge(state)}
                <ChevronDownIcon className="text-muted-foreground size-4 transition-transform" />
            </div>
        </CollapsibleTrigger>
    );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
    <CollapsibleContent className={cn("space-y-2 border-t px-3 py-2", className)} {...props} />
);

export type ToolInputProps = HTMLAttributes<HTMLDivElement> & {
    input?: ToolUIPart["input"];
};

export const ToolInput = ({ input, className, ...props }: ToolInputProps) => {
    if (!input || Object.keys(input).length === 0) return null;

    return (
        <div className={cn("text-xs", className)} {...props}>
            <div className="text-muted-foreground mb-1 font-medium">Parameters</div>
            <pre className="bg-background overflow-x-auto rounded p-2 text-xs">
                {JSON.stringify(input, null, 2)}
            </pre>
        </div>
    );
};

export type ToolOutputProps = HTMLAttributes<HTMLDivElement> & {
    output?: ReactNode;
    errorText?: ToolUIPart["errorText"];
};

export const ToolOutput = ({ output, errorText, className, ...props }: ToolOutputProps) => {
    if (errorText) {
        return (
            <div className={cn("text-destructive text-xs", className)} {...props}>
                <div className="mb-1 font-medium">Error</div>
                <pre className="bg-destructive/10 overflow-x-auto rounded p-2">{errorText}</pre>
            </div>
        );
    }

    if (!output) return null;

    return (
        <div className={cn("text-xs", className)} {...props}>
            <div className="text-muted-foreground mb-1 font-medium">Result</div>
            <div className="bg-background overflow-x-auto rounded p-2">
                {typeof output === "string" ? <pre>{output}</pre> : output}
            </div>
        </div>
    );
};

export const getStatusBadge = (
    state: ToolUIPart["state"] | DynamicToolUIPart["state"]
): ReactNode => {
    const statusConfig: Record<
        string,
        {
            label: string;
            icon: ReactNode;
            variant: "default" | "secondary" | "destructive" | "outline";
        }
    > = {
        "input-streaming": {
            label: "Pending",
            icon: <CircleDashedIcon className="size-3" />,
            variant: "secondary"
        },
        "input-available": {
            label: "Running",
            icon: <Loader2Icon className="size-3 animate-spin" />,
            variant: "secondary"
        },
        "approval-requested": {
            label: "Awaiting Approval",
            icon: <ClockIcon className="size-3" />,
            variant: "outline"
        },
        "approval-responded": {
            label: "Responded",
            icon: <CheckIcon className="size-3" />,
            variant: "default"
        },
        "output-available": {
            label: "Completed",
            icon: <CheckIcon className="size-3" />,
            variant: "default"
        },
        "output-error": {
            label: "Error",
            icon: <XCircleIcon className="size-3" />,
            variant: "destructive"
        },
        "output-denied": {
            label: "Denied",
            icon: <CircleAlertIcon className="size-3" />,
            variant: "destructive"
        }
    };

    const config = statusConfig[state] || {
        label: state,
        icon: null,
        variant: "secondary" as const
    };

    return (
        <Badge variant={config.variant} className="gap-1 text-xs">
            {config.icon}
            {config.label}
        </Badge>
    );
};

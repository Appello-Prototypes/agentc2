"use client";

import * as React from "react";
import {
    CheckCircle2Icon,
    CircleIcon,
    CircleDotIcon,
    Loader2Icon,
    XCircleIcon,
    ClockIcon,
    ChevronDownIcon
} from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";
import { Badge } from "./badge";

/* ---------- Step status ---------- */

export type StepStatus = "completed" | "active" | "pending" | "failed" | "suspended";

const statusIcons: Record<StepStatus, React.ReactNode> = {
    completed: <CheckCircle2Icon className="size-5 text-green-500" />,
    active: <Loader2Icon className="text-primary size-5 animate-spin" />,
    pending: <CircleIcon className="text-muted-foreground/40 size-5" />,
    failed: <XCircleIcon className="text-destructive size-5" />,
    suspended: <ClockIcon className="size-5 text-amber-500" />
};

/* ---------- Stepper root ---------- */

const stepperVariants = cva("flex", {
    variants: {
        orientation: {
            vertical: "flex-col gap-0",
            horizontal: "flex-row items-start gap-4"
        }
    },
    defaultVariants: {
        orientation: "vertical"
    }
});

interface StepperProps
    extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof stepperVariants> {
    orientation?: "vertical" | "horizontal";
}

function Stepper({ className, orientation = "vertical", children, ...props }: StepperProps) {
    return (
        <div
            className={cn(stepperVariants({ orientation, className }))}
            data-orientation={orientation}
            {...props}
        >
            {children}
        </div>
    );
}

/* ---------- Step item ---------- */

interface StepItemProps extends React.HTMLAttributes<HTMLDivElement> {
    status?: StepStatus;
    stepNumber?: number;
    label: string;
    description?: string;
    iterationBadge?: string;
    isLast?: boolean;
    expandable?: boolean;
    defaultExpanded?: boolean;
}

function StepItem({
    className,
    status = "pending",
    stepNumber,
    label,
    description,
    iterationBadge,
    isLast = false,
    expandable = false,
    defaultExpanded = false,
    children,
    onClick,
    ...props
}: StepItemProps) {
    const [expanded, setExpanded] = React.useState(defaultExpanded);
    const isClickable = !!onClick || expandable;
    const hasContent = !!children;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (expandable && hasContent) {
            setExpanded((prev) => !prev);
        }
        onClick?.(e);
    };

    return (
        <div className={cn("group relative flex gap-3", className)} data-status={status} {...props}>
            {/* Connector line + icon column */}
            <div className="flex flex-col items-center">
                <div
                    className={cn(
                        "bg-background relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
                        status === "completed" && "border-green-500/30",
                        status === "active" && "border-primary/30",
                        status === "failed" && "border-destructive/30",
                        status === "suspended" && "border-amber-500/30",
                        status === "pending" && "border-border",
                        isClickable && "cursor-pointer"
                    )}
                    onClick={handleClick}
                >
                    {stepNumber !== undefined ? (
                        <span
                            className={cn(
                                "text-xs font-medium",
                                status === "completed" && "text-green-500",
                                status === "active" && "text-primary",
                                status === "failed" && "text-destructive",
                                status === "suspended" && "text-amber-500",
                                status === "pending" && "text-muted-foreground/60"
                            )}
                        >
                            {status === "completed" ? (
                                <CheckCircle2Icon className="size-4" />
                            ) : (
                                stepNumber
                            )}
                        </span>
                    ) : (
                        statusIcons[status]
                    )}
                </div>

                {/* Vertical connector */}
                {!isLast && (
                    <div
                        className={cn(
                            "min-h-6 w-px flex-1",
                            status === "completed" ? "bg-green-500/30" : "bg-border"
                        )}
                    />
                )}
            </div>

            {/* Content column */}
            <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                <div
                    className={cn(
                        "flex min-h-8 items-center gap-2",
                        isClickable && "cursor-pointer"
                    )}
                    onClick={handleClick}
                >
                    <span
                        className={cn(
                            "text-sm leading-none font-medium",
                            status === "pending" && "text-muted-foreground",
                            status === "active" && "text-foreground",
                            status === "completed" && "text-foreground",
                            status === "failed" && "text-destructive",
                            status === "suspended" && "text-amber-600"
                        )}
                    >
                        {label}
                    </span>

                    {iterationBadge && (
                        <Badge variant="secondary" className="h-4 text-[10px]">
                            {iterationBadge}
                        </Badge>
                    )}

                    {expandable && hasContent && (
                        <ChevronDownIcon
                            className={cn(
                                "text-muted-foreground size-4 transition-transform",
                                expanded && "rotate-180"
                            )}
                        />
                    )}
                </div>

                {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}

                {hasContent && (!expandable || expanded) && <div className="mt-3">{children}</div>}
            </div>
        </div>
    );
}

/* ---------- Exports ---------- */

export { Stepper, StepItem, statusIcons };
export type { StepperProps, StepItemProps };

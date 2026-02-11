"use client";

import { cn } from "../../lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import {
    ChevronDownIcon,
    ClipboardListIcon,
    PlayIcon,
    CheckCircle2Icon,
    CircleIcon
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useMemo } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";

// ─── Plan Component ──────────────────────────────────────────────────────────
// A collapsible plan component for displaying AI-generated execution plans
// with streaming support and shimmer animations.

interface PlanContextValue {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    isStreaming: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlan = () => {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error("Plan components must be used within Plan");
    }
    return context;
};

export type PlanProps = ComponentProps<"div"> & {
    isStreaming?: boolean;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export const Plan = memo(
    ({
        className,
        isStreaming = false,
        defaultOpen = true,
        open,
        onOpenChange,
        children,
        ...props
    }: PlanProps) => {
        const [isOpen, setIsOpen] = useControllableState({
            prop: open,
            defaultProp: defaultOpen,
            onChange: onOpenChange
        });

        const planContext = useMemo(
            () => ({ isOpen, setIsOpen, isStreaming }),
            [isOpen, setIsOpen, isStreaming]
        );

        return (
            <PlanContext.Provider value={planContext}>
                <div
                    className={cn(
                        "bg-card not-prose overflow-hidden rounded-lg border shadow-sm",
                        isStreaming && "border-primary/20",
                        className
                    )}
                    {...props}
                >
                    {children}
                </div>
            </PlanContext.Provider>
        );
    }
);

export type PlanHeaderProps = ComponentProps<"div">;

export const PlanHeader = memo(({ className, children, ...props }: PlanHeaderProps) => (
    <div className={cn("flex items-start gap-3 px-4 pt-4 pb-2", className)} {...props}>
        <ClipboardListIcon className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">{children}</div>
    </div>
));

export type PlanTitleProps = ComponentProps<"h3"> & {
    children?: string;
};

export const PlanTitle = memo(({ className, children, ...props }: PlanTitleProps) => (
    <h3 className={cn("text-sm font-semibold leading-tight", className)} {...props}>
        {children}
    </h3>
));

export type PlanDescriptionProps = ComponentProps<"p"> & {
    children?: string;
};

export const PlanDescription = memo(({ className, children, ...props }: PlanDescriptionProps) => (
    <p className={cn("text-muted-foreground mt-1 text-xs leading-relaxed", className)} {...props}>
        {children}
    </p>
));

export type PlanTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export const PlanTrigger = memo(({ className, children, ...props }: PlanTriggerProps) => {
    const { isOpen, setIsOpen } = usePlan();

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger
                className={cn(
                    "text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-4 py-2 text-xs transition-colors",
                    className
                )}
                {...props}
            >
                <ChevronDownIcon
                    className={cn(
                        "size-3.5 transition-transform",
                        isOpen ? "rotate-180" : "rotate-0"
                    )}
                />
                <span>{children ?? (isOpen ? "Hide plan" : "Toggle plan")}</span>
            </CollapsibleTrigger>
        </Collapsible>
    );
});

export type PlanContentProps = ComponentProps<"div">;

export const PlanContent = memo(({ className, children, ...props }: PlanContentProps) => {
    const { isOpen, isStreaming } = usePlan();

    return (
        <Collapsible open={isOpen}>
            <CollapsibleContent>
                <div className={cn("space-y-1 px-4 pb-3", className)} {...props}>
                    {children}
                    {isStreaming && (
                        <div className="flex flex-col gap-2 pt-2">
                            <div className="shimmer-line h-3 w-2/3 rounded" />
                            <div className="shimmer-line h-3 w-1/2 rounded" />
                        </div>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
});

export type PlanStepProps = ComponentProps<"div"> & {
    status?: "pending" | "active" | "complete";
    label: ReactNode;
};

export const PlanStep = memo(
    ({ className, status = "pending", label, children, ...props }: PlanStepProps) => {
        const StatusIcon = status === "complete" ? CheckCircle2Icon : CircleIcon;

        return (
            <div
                className={cn(
                    "flex items-start gap-2 py-1 text-sm",
                    status === "complete" && "text-muted-foreground",
                    status === "active" && "text-foreground font-medium",
                    status === "pending" && "text-muted-foreground/60",
                    className
                )}
                {...props}
            >
                <StatusIcon
                    className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        status === "complete" && "text-primary",
                        status === "active" && "text-primary animate-pulse"
                    )}
                />
                <div className="min-w-0 flex-1">
                    <span>{label}</span>
                    {children}
                </div>
            </div>
        );
    }
);

export type PlanFooterProps = ComponentProps<"div">;

export const PlanFooter = memo(({ className, children, ...props }: PlanFooterProps) => (
    <div
        className={cn("flex items-center justify-end gap-2 border-t px-4 py-2.5", className)}
        {...props}
    >
        {children}
    </div>
));

export type PlanActionProps = ComponentProps<"button">;

export const PlanAction = memo(({ className, children, ...props }: PlanActionProps) => (
    <button
        type="button"
        className={cn(
            "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            className
        )}
        {...props}
    >
        <PlayIcon className="size-3" />
        {children ?? "Build"}
    </button>
));

Plan.displayName = "Plan";
PlanHeader.displayName = "PlanHeader";
PlanTitle.displayName = "PlanTitle";
PlanDescription.displayName = "PlanDescription";
PlanTrigger.displayName = "PlanTrigger";
PlanContent.displayName = "PlanContent";
PlanStep.displayName = "PlanStep";
PlanFooter.displayName = "PlanFooter";
PlanAction.displayName = "PlanAction";

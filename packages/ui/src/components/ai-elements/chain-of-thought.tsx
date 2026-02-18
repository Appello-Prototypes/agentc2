"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Badge } from "../badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { cn } from "../../lib/utils";
import {
    BrainIcon,
    ChevronDownIcon,
    DotIcon,
    SearchIcon,
    LightbulbIcon,
    CheckCircle2Icon,
    CircleDashedIcon,
    type LucideIcon
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useMemo } from "react";

interface ChainOfThoughtContextValue {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    isStreaming: boolean;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null);

const useChainOfThought = () => {
    const context = useContext(ChainOfThoughtContext);
    if (!context) {
        throw new Error("ChainOfThought components must be used within ChainOfThought");
    }
    return context;
};

export type ChainOfThoughtProps = ComponentProps<"div"> & {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    isStreaming?: boolean;
};

export const ChainOfThought = memo(
    ({
        className,
        open,
        defaultOpen = false,
        onOpenChange,
        isStreaming = false,
        children,
        ...props
    }: ChainOfThoughtProps) => {
        const [isOpen, setIsOpen] = useControllableState({
            prop: open,
            defaultProp: defaultOpen,
            onChange: onOpenChange
        });

        const chainOfThoughtContext = useMemo(
            () => ({ isOpen, setIsOpen, isStreaming }),
            [isOpen, setIsOpen, isStreaming]
        );

        return (
            <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
                <div
                    className={cn(
                        "not-prose my-3 overflow-hidden rounded-lg border",
                        isStreaming
                            ? "border-primary/20 bg-primary/[0.02]"
                            : "bg-muted/20 border-border/50",
                        className
                    )}
                    {...props}
                >
                    {children}
                </div>
            </ChainOfThoughtContext.Provider>
        );
    }
);

export type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger>;

export const ChainOfThoughtHeader = memo(
    ({ className, children, ...props }: ChainOfThoughtHeaderProps) => {
        const { isOpen, setIsOpen, isStreaming } = useChainOfThought();

        return (
            <Collapsible onOpenChange={setIsOpen} open={isOpen}>
                <CollapsibleTrigger
                    className={cn(
                        "hover:bg-muted/40 flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                        className
                    )}
                    {...props}
                >
                    <div
                        className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
                            isStreaming ? "bg-primary/15" : "bg-muted"
                        )}
                    >
                        <BrainIcon
                            className={cn(
                                "size-3.5",
                                isStreaming ? "text-primary animate-pulse" : "text-muted-foreground"
                            )}
                        />
                    </div>
                    <span
                        className={cn(
                            "flex-1 text-left font-medium",
                            isStreaming ? "text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {children ?? "Thought process"}
                    </span>
                    {isStreaming && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                            <CircleDashedIcon className="size-2.5 animate-spin" />
                            Thinking
                        </Badge>
                    )}
                    <ChevronDownIcon
                        className={cn(
                            "text-muted-foreground size-4 transition-transform",
                            isOpen ? "rotate-180" : "rotate-0"
                        )}
                    />
                </CollapsibleTrigger>
            </Collapsible>
        );
    }
);

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
    icon?: LucideIcon;
    label: ReactNode;
    description?: ReactNode;
    status?: "complete" | "active" | "pending";
};

export const ChainOfThoughtStep = memo(
    ({
        className,
        icon: Icon,
        label,
        description,
        status = "complete",
        children,
        ...props
    }: ChainOfThoughtStepProps) => {
        const resolvedIcon = Icon || (status === "complete" ? CheckCircle2Icon : DotIcon);
        const ResolvedIcon = resolvedIcon;

        return (
            <div
                className={cn(
                    "relative flex gap-2.5 py-1.5 text-sm",
                    "animate-in fade-in-0 slide-in-from-left-2 duration-300",
                    className
                )}
                {...props}
            >
                {/* Timeline connector */}
                <div className="relative flex flex-col items-center">
                    <div
                        className={cn(
                            "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full",
                            status === "complete" && "bg-primary/10 text-primary",
                            status === "active" && "bg-primary/20 text-primary",
                            status === "pending" && "bg-muted text-muted-foreground/50"
                        )}
                    >
                        <ResolvedIcon
                            className={cn("size-3", status === "active" && "animate-pulse")}
                        />
                    </div>
                    <div className="bg-border/50 absolute top-6 bottom-0 w-px" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pb-1">
                    <div
                        className={cn(
                            "leading-snug",
                            status === "complete" && "text-foreground/80",
                            status === "active" && "text-foreground font-medium",
                            status === "pending" && "text-muted-foreground/50"
                        )}
                    >
                        {label}
                    </div>
                    {description && (
                        <div className="text-muted-foreground mt-1 text-xs leading-relaxed">
                            {description}
                        </div>
                    )}
                    {children}
                </div>
            </div>
        );
    }
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
    ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
        <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", className)} {...props} />
    )
);

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
    ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
        <Badge
            className={cn("gap-1 px-2 py-0.5 text-xs font-normal", className)}
            variant="secondary"
            {...props}
        >
            <SearchIcon className="size-2.5" />
            {children}
        </Badge>
    )
);

export type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>;

export const ChainOfThoughtContent = memo(
    ({ className, children, ...props }: ChainOfThoughtContentProps) => {
        const { isOpen, isStreaming } = useChainOfThought();

        return (
            <Collapsible open={isOpen}>
                <CollapsibleContent
                    className={cn(
                        "border-t px-3 pt-2 pb-3",
                        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
                        className
                    )}
                    {...props}
                >
                    <div className="space-y-0.5">{children}</div>
                    {isStreaming && (
                        <div className="mt-2 flex items-center gap-2 pl-7">
                            <div className="flex gap-1">
                                <span className="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                                <span className="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                                <span className="bg-primary/40 size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                            </div>
                            <span className="text-muted-foreground text-xs">Reasoning...</span>
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>
        );
    }
);

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
    caption?: string;
};

export const ChainOfThoughtImage = memo(
    ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
        <div className={cn("mt-2 space-y-2", className)} {...props}>
            <div className="bg-muted relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg p-3">
                {children}
            </div>
            {caption && <p className="text-muted-foreground text-xs">{caption}</p>}
        </div>
    )
);

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";

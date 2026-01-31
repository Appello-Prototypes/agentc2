"use client";

import * as React from "react";
import { cn } from "../lib/utils";

interface TabsContextValue {
    value: string;
    onValueChange: (value: string) => void;
    orientation: "horizontal" | "vertical";
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
    const context = React.useContext(TabsContext);
    if (!context) {
        throw new Error("Tabs components must be used within a Tabs provider");
    }
    return context;
}

interface TabsProps {
    defaultValue: string;
    value?: string;
    onValueChange?: (value: string) => void;
    orientation?: "horizontal" | "vertical";
    className?: string;
    children: React.ReactNode;
}

function Tabs({
    defaultValue,
    value: controlledValue,
    onValueChange,
    orientation = "horizontal",
    className,
    children
}: TabsProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue);

    const value = controlledValue ?? internalValue;
    const handleValueChange = React.useCallback(
        (newValue: string) => {
            setInternalValue(newValue);
            onValueChange?.(newValue);
        },
        [onValueChange]
    );

    return (
        <TabsContext.Provider value={{ value, onValueChange: handleValueChange, orientation }}>
            <div
                data-slot="tabs"
                data-orientation={orientation}
                className={cn(
                    "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
                    className
                )}
            >
                {children}
            </div>
        </TabsContext.Provider>
    );
}

interface TabsListProps {
    className?: string;
    children: React.ReactNode;
}

function TabsList({ className, children }: TabsListProps) {
    const { orientation } = useTabsContext();
    return (
        <div
            role="tablist"
            data-slot="tabs-list"
            data-orientation={orientation}
            className={cn(
                "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
                orientation === "vertical" && "h-fit flex-col",
                className
            )}
        >
            {children}
        </div>
    );
}

interface TabsTriggerProps {
    value: string;
    className?: string;
    children: React.ReactNode;
    disabled?: boolean;
}

function TabsTrigger({ value, className, children, disabled }: TabsTriggerProps) {
    const { value: selectedValue, onValueChange } = useTabsContext();
    const isActive = selectedValue === value;

    return (
        <button
            role="tab"
            type="button"
            data-slot="tabs-trigger"
            data-active={isActive ? "" : undefined}
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onValueChange(value)}
            className={cn(
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50",
                isActive &&
                    "bg-background text-foreground dark:text-foreground dark:border-input dark:bg-input/30 shadow-sm",
                !isActive && "hover:text-foreground",
                className
            )}
        >
            {children}
        </button>
    );
}

interface TabsContentProps {
    value: string;
    className?: string;
    children: React.ReactNode;
}

function TabsContent({ value, className, children }: TabsContentProps) {
    const { value: selectedValue } = useTabsContext();
    const isActive = selectedValue === value;

    if (!isActive) {
        return null;
    }

    return (
        <div
            role="tabpanel"
            data-slot="tabs-content"
            className={cn("mt-2 flex-1 text-sm outline-none", className)}
        >
            {children}
        </div>
    );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

import type { ReactNode } from "react";

export type BuilderNodeStatus =
    | "pending"
    | "running"
    | "completed"
    | "error"
    | "suspended"
    | "disabled";

export interface BuilderNodeData {
    label: string;
    description?: string;
    stepType?: string;
    status?: BuilderNodeStatus;
    selected?: boolean;
    disabled?: boolean;
    manuallyPositioned?: boolean;

    // Step config fields
    config?: Record<string, unknown>;
    inputMapping?: Record<string, unknown>;

    // Display
    icon?: ReactNode;
    badges?: Array<{
        label: string;
        variant?: "default" | "secondary" | "destructive" | "outline";
    }>;
    [key: string]: unknown;
}

export const NODE_STATUS_STYLES: Record<BuilderNodeStatus, string> = {
    pending: "border-border",
    running: "border-blue-500 ring-2 ring-blue-500/20",
    completed: "border-green-500",
    error: "border-red-500",
    suspended: "border-amber-500 border-dashed",
    disabled: "border-border opacity-40"
};

export const NODE_STATUS_DOT: Record<BuilderNodeStatus, string> = {
    pending: "bg-muted-foreground/40",
    running: "bg-blue-500 animate-pulse",
    completed: "bg-green-500",
    error: "bg-red-500",
    suspended: "bg-amber-500",
    disabled: "bg-muted-foreground/20"
};

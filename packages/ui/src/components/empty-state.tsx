"use client";

import * as React from "react";
import { cn } from "../lib/utils";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick?: () => void;
        href?: string;
    };
    variant?: "default" | "error" | "search" | "filtered";
    className?: string;
}

const variantStyles = {
    default: "text-muted-foreground",
    error: "text-destructive",
    search: "text-muted-foreground",
    filtered: "text-muted-foreground"
};

export function EmptyState({
    icon,
    title,
    description,
    action,
    variant = "default",
    className
}: EmptyStateProps) {
    const ActionWrapper = action?.href ? "a" : "button";

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center px-4 py-12 text-center",
                className
            )}
        >
            {icon && <div className={cn("mb-4 text-4xl", variantStyles[variant])}>{icon}</div>}
            <h3
                className={cn(
                    "text-lg font-semibold",
                    variant === "error" ? "text-destructive" : "text-foreground"
                )}
            >
                {title}
            </h3>
            {description && (
                <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>
            )}
            {action && (
                <ActionWrapper
                    className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    onClick={action.onClick}
                    {...(action.href ? { href: action.href } : {})}
                >
                    {action.label}
                </ActionWrapper>
            )}
        </div>
    );
}

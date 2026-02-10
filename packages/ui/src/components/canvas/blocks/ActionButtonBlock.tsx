"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";

const sizeMap: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
};

const variantMap: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ActionButtonBlock({ config }: { config: any }) {
    const action = config.action || {};
    const size = sizeMap[config.size || "md"] || sizeMap.md;
    const variant = variantMap[action.variant || "default"] || variantMap.default;

    const handleClick = () => {
        if (action.type === "link" && action.href) {
            window.open(action.href, "_blank");
        } else if (action.type === "navigate" && action.target) {
            window.location.href = action.target;
        }
        // Tool actions would be handled by the canvas runtime
    };

    return (
        <div className={cn(config.className)}>
            <button
                onClick={handleClick}
                className={cn(
                    "inline-flex items-center justify-center rounded-md font-medium transition-colors",
                    size,
                    variant,
                    config.fullWidth && "w-full"
                )}
            >
                {action.icon && <span className="mr-1.5">{action.icon}</span>}
                {action.label || "Action"}
            </button>
        </div>
    );
}

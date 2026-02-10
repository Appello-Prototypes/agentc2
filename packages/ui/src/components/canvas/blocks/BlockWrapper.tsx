"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";

export function BlockWrapper({
    title,
    description,
    children,
    className,
    noPadding
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}) {
    return (
        <div className={cn("bg-card text-card-foreground rounded-lg border shadow-sm", className)}>
            {(title || description) && (
                <div className="border-b px-4 py-3">
                    {title && <h3 className="text-sm font-semibold">{title}</h3>}
                    {description && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
                    )}
                </div>
            )}
            <div className={cn(!noPadding && "p-4")}>{children}</div>
        </div>
    );
}

"use client";

import type { ReactNode } from "react";
import { cn } from "@repo/ui";

interface BuilderShellProps {
    outline: ReactNode;
    canvas: ReactNode;
    inspector: ReactNode;
    className?: string;
    outlineClassName?: string;
    canvasClassName?: string;
    inspectorClassName?: string;
}

export function BuilderShell({
    outline,
    canvas,
    inspector,
    className,
    outlineClassName,
    canvasClassName,
    inspectorClassName
}: BuilderShellProps) {
    return (
        <div
            className={cn(
                "grid min-h-[calc(100vh-220px)] grid-cols-[260px_minmax(0,1fr)_360px] gap-4",
                className
            )}
        >
            <aside
                className={cn(
                    "bg-muted/20 flex h-full flex-col overflow-hidden rounded-lg border",
                    outlineClassName
                )}
            >
                {outline}
            </aside>
            <section className={cn("min-w-0", canvasClassName)}>{canvas}</section>
            <aside
                className={cn(
                    "bg-muted/20 flex h-full flex-col overflow-hidden rounded-lg border",
                    inspectorClassName
                )}
            >
                {inspector}
            </aside>
        </div>
    );
}

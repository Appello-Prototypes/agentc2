"use client";

import { type ReactNode } from "react";
import { cn, useIsMobile, Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui";

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
    const isMobile = useIsMobile();

    // Mobile: tabbed interface instead of 3-column grid
    if (isMobile) {
        return (
            <Tabs
                defaultValue="canvas"
                className={cn("flex min-h-[calc(100dvh-220px)] flex-col", className)}
            >
                <TabsList className="mx-4 mt-2 grid w-auto grid-cols-3">
                    <TabsTrigger value="outline">Outline</TabsTrigger>
                    <TabsTrigger value="canvas">Canvas</TabsTrigger>
                    <TabsTrigger value="inspector">Inspector</TabsTrigger>
                </TabsList>
                <TabsContent value="outline" className="mt-0 min-h-0 flex-1">
                    <div
                        className={cn(
                            "bg-muted/20 mx-4 mb-4 flex h-full flex-col overflow-hidden rounded-lg border",
                            outlineClassName
                        )}
                    >
                        {outline}
                    </div>
                </TabsContent>
                <TabsContent value="canvas" className="mt-0 min-h-0 flex-1">
                    <div className={cn("mx-4 mb-4 min-w-0 flex-1", canvasClassName)}>{canvas}</div>
                </TabsContent>
                <TabsContent value="inspector" className="mt-0 min-h-0 flex-1">
                    <div
                        className={cn(
                            "bg-muted/20 mx-4 mb-4 flex h-full flex-col overflow-hidden rounded-lg border",
                            inspectorClassName
                        )}
                    >
                        {inspector}
                    </div>
                </TabsContent>
            </Tabs>
        );
    }

    // Desktop: 3-column grid
    return (
        <div
            className={cn(
                "grid min-h-[calc(100dvh-220px)] grid-cols-[260px_minmax(0,1fr)_360px] gap-4",
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

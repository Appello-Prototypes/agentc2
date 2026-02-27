"use client";

import { type ReactNode, useState, useCallback } from "react";
import { cn, Button } from "@repo/ui";

interface BuilderShellProps {
    toolbar: ReactNode;
    palette?: ReactNode;
    canvas: ReactNode;
    inspector?: ReactNode;
    className?: string;
    defaultPaletteOpen?: boolean;
    defaultInspectorOpen?: boolean;
    showInspector?: boolean;
}

export function BuilderShell({
    toolbar,
    palette,
    canvas,
    inspector,
    className,
    defaultPaletteOpen = true,
    defaultInspectorOpen = true,
    showInspector = true
}: BuilderShellProps) {
    const [paletteOpen, setPaletteOpen] = useState(defaultPaletteOpen);
    const [inspectorOpen, setInspectorOpen] = useState(defaultInspectorOpen);

    const togglePalette = useCallback(() => setPaletteOpen((p) => !p), []);
    const toggleInspector = useCallback(() => setInspectorOpen((p) => !p), []);

    return (
        <div className={cn("flex h-[calc(100dvh-64px)] flex-col", className)}>
            {toolbar}

            <div className="relative flex-1 overflow-hidden">
                {/* Canvas - full viewport, always underneath */}
                <div className="absolute inset-0">{canvas}</div>

                {/* Left palette overlay */}
                {palette && (
                    <div
                        className={cn(
                            "absolute top-0 left-0 z-10 flex h-full transition-transform duration-200 ease-in-out",
                            paletteOpen ? "translate-x-0" : "-translate-x-full"
                        )}
                    >
                        <aside className="bg-background/90 flex w-60 flex-col overflow-hidden border-r backdrop-blur-xl">
                            {palette}
                        </aside>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={togglePalette}
                            className="bg-background/80 border-border mt-2 h-6 w-6 rounded-l-none rounded-r-md border border-l-0 p-0 backdrop-blur-sm"
                            title={paletteOpen ? "Hide palette ([)" : "Show palette ([)"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={cn(
                                    "transition-transform",
                                    paletteOpen ? "rotate-0" : "rotate-180"
                                )}
                            >
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </Button>
                    </div>
                )}

                {/* Palette collapsed toggle (shown when palette is closed) */}
                {palette && !paletteOpen && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={togglePalette}
                        className="bg-background/80 border-border absolute top-2 left-0 z-10 h-6 w-6 rounded-l-none rounded-r-md border border-l-0 p-0 backdrop-blur-sm"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </Button>
                )}

                {/* Right inspector overlay */}
                {showInspector && inspector && (
                    <div
                        className={cn(
                            "absolute top-0 right-0 z-10 flex h-full transition-transform duration-200 ease-in-out",
                            inspectorOpen ? "translate-x-0" : "translate-x-full"
                        )}
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleInspector}
                            className="bg-background/80 border-border mt-2 h-6 w-6 rounded-l-md rounded-r-none border border-r-0 p-0 backdrop-blur-sm"
                            title={inspectorOpen ? "Hide inspector (])" : "Show inspector (])"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={cn(
                                    "transition-transform",
                                    inspectorOpen ? "rotate-0" : "rotate-180"
                                )}
                            >
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </Button>
                        <aside className="bg-background/90 flex w-[400px] flex-col overflow-hidden border-l backdrop-blur-xl">
                            {inspector}
                        </aside>
                    </div>
                )}

                {/* Inspector collapsed toggle (shown when inspector is closed) */}
                {showInspector && inspector && !inspectorOpen && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleInspector}
                        className="bg-background/80 border-border absolute top-2 right-0 z-10 h-6 w-6 rounded-l-md rounded-r-none border border-r-0 p-0 backdrop-blur-sm"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                    </Button>
                )}
            </div>
        </div>
    );
}

export { type BuilderShellProps };

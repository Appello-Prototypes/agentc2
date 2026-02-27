"use client";

import { Button, Badge, cn } from "@repo/ui";
import type { SaveStatus } from "./hooks/useAutoSave";

interface BuilderToolbarProps {
    title: string;
    subtitle?: string;
    saveStatus: SaveStatus;
    onSave: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    undoCount?: number;
    redoCount?: number;
    onAutoLayout?: () => void;
    onFitView?: () => void;
    onTogglePalette?: () => void;
    paletteOpen?: boolean;
    className?: string;
    actions?: React.ReactNode;
}

const STATUS_DISPLAY: Record<
    SaveStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    saved: { label: "Saved", variant: "outline" },
    unsaved: { label: "Unsaved", variant: "secondary" },
    saving: { label: "Saving...", variant: "secondary" },
    error: { label: "Save failed", variant: "destructive" },
    conflict: { label: "Conflict", variant: "destructive" }
};

export function BuilderToolbar({
    title,
    subtitle,
    saveStatus,
    onSave,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    onAutoLayout,
    onFitView,
    onTogglePalette,
    paletteOpen,
    className,
    actions
}: BuilderToolbarProps) {
    const statusInfo = STATUS_DISPLAY[saveStatus];

    return (
        <div className={cn("bg-background/95 border-b backdrop-blur-sm", className)}>
            <div className="flex h-12 items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-3">
                    {onTogglePalette && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onTogglePalette}
                            className="h-8 w-8 p-0"
                            title={paletteOpen ? "Hide palette" : "Show palette"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect width="7" height="7" x="3" y="3" rx="1" />
                                <rect width="7" height="7" x="14" y="3" rx="1" />
                                <rect width="7" height="7" x="14" y="14" rx="1" />
                                <rect width="7" height="7" x="3" y="14" rx="1" />
                            </svg>
                        </Button>
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{title}</div>
                        {subtitle && (
                            <div className="text-muted-foreground truncate text-xs">{subtitle}</div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Badge variant={statusInfo.variant} className="text-[10px]">
                        {statusInfo.label}
                    </Badge>
                </div>

                <div className="flex items-center gap-1">
                    {onUndo && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onUndo}
                            disabled={!canUndo}
                            className="h-8 w-8 p-0"
                            title="Undo (Cmd+Z)"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M3 7v6h6" />
                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                            </svg>
                        </Button>
                    )}
                    {onRedo && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRedo}
                            disabled={!canRedo}
                            className="h-8 w-8 p-0"
                            title="Redo (Cmd+Shift+Z)"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 7v6h-6" />
                                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                            </svg>
                        </Button>
                    )}

                    <div className="bg-border mx-1 h-5 w-px" />

                    {onAutoLayout && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onAutoLayout}
                            className="h-8 px-2 text-xs"
                            title="Auto-layout (Cmd+Shift+L)"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect width="7" height="7" x="14" y="3" rx="1" />
                                <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                                <path d="m14 15 3-3" />
                            </svg>
                            <span className="ml-1">Layout</span>
                        </Button>
                    )}
                    {onFitView && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onFitView}
                            className="h-8 w-8 p-0"
                            title="Fit to view (Cmd+0)"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                            </svg>
                        </Button>
                    )}

                    <div className="bg-border mx-1 h-5 w-px" />

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onSave}
                        className="h-8 px-3 text-xs"
                    >
                        Save
                    </Button>

                    {actions}
                </div>
            </div>
        </div>
    );
}

"use client";

import type { ReactNode } from "react";
import { Badge, Button, Input, cn } from "@repo/ui";

export interface OutlineItem {
    id: string;
    kind: string;
    label: string;
    description?: string;
    meta?: string;
    badges?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" }[];
}

export interface OutlineSection {
    id: string;
    label: string;
    items: OutlineItem[];
    emptyState?: string;
}

interface OutlinePanelProps {
    title: string;
    searchValue: string;
    searchPlaceholder?: string;
    onSearchChange: (value: string) => void;
    sections: OutlineSection[];
    selected?: { kind: string; id: string } | null;
    onSelect: (selection: { kind: string; id: string }) => void;
    headerActions?: ReactNode;
    footer?: ReactNode;
}

export function OutlinePanel({
    title,
    searchValue,
    searchPlaceholder = "Search...",
    onSearchChange,
    sections,
    selected,
    onSelect,
    headerActions,
    footer
}: OutlinePanelProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="border-b p-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="text-sm font-semibold">{title}</div>
                        <div className="text-muted-foreground text-xs">
                            {sections.reduce((sum, section) => sum + section.items.length, 0)} items
                        </div>
                    </div>
                    {headerActions}
                </div>
                <div className="mt-3">
                    <Input
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={searchPlaceholder}
                    />
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-3">
                {sections.map((section) => (
                    <div key={section.id}>
                        <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                            {section.label}
                        </div>
                        {section.items.length === 0 ? (
                            <div className="text-muted-foreground text-xs">
                                {section.emptyState || "No items"}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const isSelected =
                                        selected?.kind === item.kind && selected?.id === item.id;
                                    return (
                                        <Button
                                            key={`${item.kind}-${item.id}`}
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start gap-2 px-2 py-2 text-left",
                                                isSelected &&
                                                    "bg-background text-foreground shadow-sm"
                                            )}
                                            onClick={() =>
                                                onSelect({ kind: item.kind, id: item.id })
                                            }
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium">
                                                    {item.label}
                                                </div>
                                                {item.description && (
                                                    <div className="text-muted-foreground truncate text-xs">
                                                        {item.description}
                                                    </div>
                                                )}
                                                {item.meta && (
                                                    <div className="text-muted-foreground text-[10px]">
                                                        {item.meta}
                                                    </div>
                                                )}
                                            </div>
                                            {item.badges && item.badges.length > 0 && (
                                                <div className="flex flex-col items-end gap-1">
                                                    {item.badges.map((badge, index) => (
                                                        <Badge
                                                            key={`${item.id}-${index}`}
                                                            variant={badge.variant || "outline"}
                                                            className="text-[10px]"
                                                        >
                                                            {badge.label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {footer && <div className="border-t p-3">{footer}</div>}
        </div>
    );
}

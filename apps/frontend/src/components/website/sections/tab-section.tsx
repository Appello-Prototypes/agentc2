"use client";

import { useState } from "react";
import { cn } from "@repo/ui";

export interface TabSectionProps {
    tabs: Array<{
        id: string;
        label: string;
        content: React.ReactNode;
    }>;
    className?: string;
}

export function TabSection({ tabs, className }: TabSectionProps) {
    const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

    const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

    return (
        <div className={cn(className)}>
            <div className="border-border/40 flex gap-1 overflow-x-auto border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveId(tab.id)}
                        className={cn(
                            "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                            activeId === tab.id
                                ? "text-primary border-primary border-b-2"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="mt-8">{activeTab?.content}</div>
        </div>
    );
}

"use client";

import { useState, type DragEvent } from "react";
import { Input, cn } from "@repo/ui";

export interface PaletteItem {
    type: string;
    label: string;
    description: string;
    category: string;
    icon: React.ReactNode;
    defaultConfig?: Record<string, unknown>;
}

interface NodePaletteProps {
    items: PaletteItem[];
    className?: string;
}

const CATEGORY_ORDER = [
    "AI",
    "Actions",
    "Logic",
    "Loops",
    "Flow Control",
    "Visual",
    "Primitives",
    "Core"
];

export function NodePalette({ items, className }: NodePaletteProps) {
    const [search, setSearch] = useState("");

    const filtered = search.trim()
        ? items.filter(
              (item) =>
                  item.label.toLowerCase().includes(search.toLowerCase()) ||
                  item.description.toLowerCase().includes(search.toLowerCase())
          )
        : items;

    const grouped = CATEGORY_ORDER.map((category) => ({
        category,
        items: filtered.filter((item) => item.category === category)
    })).filter((group) => group.items.length > 0);

    const handleDragStart = (event: DragEvent, item: PaletteItem) => {
        event.dataTransfer.setData(
            "application/json",
            JSON.stringify({
                type: item.type,
                label: item.label,
                defaultConfig: item.defaultConfig || {}
            })
        );
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <div className={cn("flex h-full flex-col", className)}>
            <div className="border-b p-3">
                <div className="text-sm font-semibold">Steps</div>
                <div className="mt-2">
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search steps..."
                        className="h-8 text-xs"
                    />
                </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {grouped.map(({ category, items: categoryItems }) => (
                    <div key={category}>
                        <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                            {category}
                        </div>
                        <div className="space-y-1">
                            {categoryItems.map((item) => (
                                <div
                                    key={item.type}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item)}
                                    className="hover:bg-muted/50 flex cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors active:cursor-grabbing"
                                >
                                    <div className="text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md border">
                                        {item.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-medium">
                                            {item.label}
                                        </div>
                                        <div className="text-muted-foreground truncate text-[10px]">
                                            {item.description}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {grouped.length === 0 && (
                    <div className="text-muted-foreground py-8 text-center text-xs">
                        No matching steps
                    </div>
                )}
            </div>
        </div>
    );
}

export const WORKFLOW_PALETTE_ITEMS: PaletteItem[] = [
    {
        type: "agent",
        label: "Agent",
        description: "Invoke an AI agent",
        category: "AI",
        icon: (
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
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
            </svg>
        ),
        defaultConfig: { agentSlug: "", promptTemplate: "" }
    },
    {
        type: "tool",
        label: "Tool",
        description: "Execute a tool or function",
        category: "Actions",
        icon: (
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
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
        ),
        defaultConfig: { toolId: "" }
    },
    {
        type: "workflow",
        label: "Sub-Workflow",
        description: "Nest another workflow",
        category: "Actions",
        icon: (
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
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
            </svg>
        ),
        defaultConfig: { workflowId: "" }
    },
    {
        type: "branch",
        label: "Branch",
        description: "If/else conditions",
        category: "Logic",
        icon: (
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
                <path d="M16 3h5v5" />
                <path d="M8 3H3v5" />
                <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
                <path d="m15 9 6-6" />
            </svg>
        ),
        defaultConfig: { branches: [{ condition: "", steps: [] }], defaultBranch: [] }
    },
    {
        type: "parallel",
        label: "Parallel",
        description: "Run branches concurrently",
        category: "Logic",
        icon: (
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
                <path d="M8 6v12" />
                <path d="M16 6v12" />
            </svg>
        ),
        defaultConfig: { branches: [{ steps: [] }, { steps: [] }] }
    },
    {
        type: "foreach",
        label: "Foreach",
        description: "Iterate over a list",
        category: "Loops",
        icon: (
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
                <path d="M17 12H3" />
                <path d="m11 18 6-6-6-6" />
                <path d="M21 5v14" />
            </svg>
        ),
        defaultConfig: { collectionPath: "", itemVar: "item", concurrency: 1, steps: [] }
    },
    {
        type: "dowhile",
        label: "Do While",
        description: "Loop with condition",
        category: "Loops",
        icon: (
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
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
        ),
        defaultConfig: { conditionExpression: "true", maxIterations: 10, steps: [] }
    },
    {
        type: "human",
        label: "Human Approval",
        description: "Suspend for input",
        category: "Flow Control",
        icon: (
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
        defaultConfig: {}
    },
    {
        type: "delay",
        label: "Delay",
        description: "Wait for a duration",
        category: "Flow Control",
        icon: (
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
        defaultConfig: { delayMs: 1000 }
    },
    {
        type: "transform",
        label: "Transform",
        description: "Data pass-through",
        category: "Flow Control",
        icon: (
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
                <path d="M4 20h16" />
                <path d="m6 16 6-12 6 12" />
            </svg>
        ),
        defaultConfig: {}
    }
];

"use client";

import { useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { RocketIcon, ChevronDownIcon, ChevronRightIcon, ZapIcon } from "lucide-react";

interface BootTask {
    title: string;
    description?: string;
    priority: number;
    tags: string[];
    sortOrder: number;
}

interface BootTasksCardProps {
    tasks: BootTask[];
    autoBootEnabled: boolean;
}

function getPriorityLabel(priority: number): { label: string; className: string } {
    if (priority <= 1) return { label: "Critical", className: "border-red-800/50 text-red-300" };
    if (priority <= 2) return { label: "High", className: "border-orange-800/50 text-orange-300" };
    if (priority <= 3)
        return { label: "Medium", className: "border-yellow-800/50 text-yellow-300" };
    return { label: "Low", className: "border-zinc-700 text-zinc-400" };
}

export function BootTasksCard({ tasks, autoBootEnabled }: BootTasksCardProps) {
    const [expanded, setExpanded] = useState(false);
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const preview = sorted.slice(0, 5);
    const remaining = sorted.length - preview.length;

    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <RocketIcon className="h-4 w-4 text-orange-400" />
                        Boot Sequence ({tasks.length} tasks)
                    </CardTitle>
                    <div className="flex gap-2">
                        {autoBootEnabled && (
                            <Badge className="bg-green-500/10 text-xs text-green-400">
                                <ZapIcon className="mr-1 h-3 w-3" />
                                Auto-Boot
                            </Badge>
                        )}
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">
                    Tasks executed automatically when the playbook is deployed
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {(expanded ? sorted : preview).map((task, i) => {
                        const priority = getPriorityLabel(task.priority);
                        return (
                            <div
                                key={task.sortOrder}
                                className="flex items-start gap-3 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                            >
                                <span className="text-muted-foreground mt-0.5 w-5 shrink-0 text-right font-mono text-xs">
                                    {task.sortOrder + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">{task.title}</span>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${priority.className}`}
                                        >
                                            {priority.label}
                                        </Badge>
                                    </div>
                                    {task.description && (
                                        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                                            {task.description}
                                        </p>
                                    )}
                                    {task.tags.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {task.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="text-muted-foreground rounded bg-zinc-800 px-1.5 py-0.5 text-[10px]"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {remaining > 0 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1 text-xs transition-colors"
                    >
                        {expanded ? (
                            <>
                                <ChevronDownIcon className="h-3 w-3" />
                                Show less
                            </>
                        ) : (
                            <>
                                <ChevronRightIcon className="h-3 w-3" />
                                Show {remaining} more tasks
                            </>
                        )}
                    </button>
                )}
            </CardContent>
        </Card>
    );
}

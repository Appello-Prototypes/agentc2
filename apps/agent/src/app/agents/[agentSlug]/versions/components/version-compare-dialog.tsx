"use client";

import { useMemo, useState } from "react";
import { diffLines, Change } from "diff";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Badge,
    Button
} from "@repo/ui";
import { AgentVersion } from "./types";

interface VersionCompareDialogProps {
    versions: [AgentVersion | null, AgentVersion | null];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function VersionCompareDialog({ versions, open, onOpenChange }: VersionCompareDialogProps) {
    const [v1, v2] = versions;
    const [diffMode, setDiffMode] = useState<"side-by-side" | "unified">("unified");

    const instructionsDiff = useMemo(() => {
        if (!v1 || !v2) return null;
        const text1 = v1.instructions || v1.snapshot?.instructions || "";
        const text2 = v2.instructions || v2.snapshot?.instructions || "";
        if (text1 === text2) return null;
        return diffLines(text1, text2);
    }, [v1, v2]);

    if (!v1 || !v2) return null;

    // Tool diff computation
    const v1Tools = new Set(v1.snapshot?.tools?.map((t) => t.toolId) || []);
    const v2Tools = new Set(v2.snapshot?.tools?.map((t) => t.toolId) || []);
    const addedTools = [...v2Tools].filter((t) => !v1Tools.has(t));
    const removedTools = [...v1Tools].filter((t) => !v2Tools.has(t));
    const unchangedTools = [...v1Tools].filter((t) => v2Tools.has(t));

    // Stats delta helper
    const statDelta = (a: number, b: number) => {
        const diff = b - a;
        if (diff === 0) return null;
        return { value: diff, positive: diff > 0 };
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        Compare Version {v1.version} vs Version {v2.version}
                    </DialogTitle>
                    <DialogDescription>
                        Side-by-side comparison of agent configurations
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] space-y-6 overflow-y-auto">
                    {/* Header comparison */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted rounded-lg p-3">
                            <div className="mb-1 flex items-center gap-2">
                                <Badge variant="outline">v{v1.version}</Badge>
                                {v1.isActive && <Badge>Active</Badge>}
                                {v1.isRollback && (
                                    <Badge variant="outline" className="text-[10px]">
                                        Rollback
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {new Date(v1.createdAt).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                            <div className="mb-1 flex items-center gap-2">
                                <Badge variant="outline">v{v2.version}</Badge>
                                {v2.isActive && <Badge>Active</Badge>}
                                {v2.isRollback && (
                                    <Badge variant="outline" className="text-[10px]">
                                        Rollback
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {new Date(v2.createdAt).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Model comparison */}
                    <div>
                        <h4 className="mb-2 text-sm font-medium">Model Configuration</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {[v1, v2].map((v, vi) => {
                                const other = vi === 0 ? v2 : v1;
                                return (
                                    <div key={vi} className="space-y-1">
                                        <CompareField
                                            label="Provider"
                                            value={v.modelProvider}
                                            changed={v.modelProvider !== other.modelProvider}
                                        />
                                        <CompareField
                                            label="Model"
                                            value={v.modelName}
                                            changed={v.modelName !== other.modelName}
                                        />
                                        <CompareField
                                            label="Temperature"
                                            value={String(v.snapshot?.temperature ?? "Default")}
                                            changed={
                                                v.snapshot?.temperature !==
                                                other.snapshot?.temperature
                                            }
                                        />
                                        <CompareField
                                            label="Max Steps"
                                            value={String(v.snapshot?.maxSteps ?? "Default")}
                                            changed={
                                                v.snapshot?.maxSteps !== other.snapshot?.maxSteps
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stats comparison */}
                    <div>
                        <h4 className="mb-2 text-sm font-medium">Performance Stats</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {[v1, v2].map((v, vi) => (
                                <div key={vi} className="space-y-1">
                                    <CompareField label="Runs" value={String(v.stats.runs)} />
                                    <CompareField
                                        label="Success Rate"
                                        value={`${v.stats.successRate}%`}
                                        delta={
                                            vi === 1
                                                ? statDelta(
                                                      v1.stats.successRate,
                                                      v2.stats.successRate
                                                  )
                                                : undefined
                                        }
                                    />
                                    <CompareField
                                        label="Quality"
                                        value={`${v.stats.avgQuality}%`}
                                        delta={
                                            vi === 1
                                                ? statDelta(
                                                      v1.stats.avgQuality,
                                                      v2.stats.avgQuality
                                                  )
                                                : undefined
                                        }
                                    />
                                    <CompareField
                                        label="Total Cost"
                                        value={`$${v.stats.totalCost.toFixed(4)}`}
                                    />
                                    <CompareField
                                        label="Avg Latency"
                                        value={
                                            v.stats.avgDurationMs
                                                ? `${(v.stats.avgDurationMs / 1000).toFixed(1)}s`
                                                : "-"
                                        }
                                    />
                                    <CompareField
                                        label="Feedback"
                                        value={`${v.stats.feedbackSummary.thumbsUp}↑ ${v.stats.feedbackSummary.thumbsDown}↓`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tools comparison */}
                    <div>
                        <h4 className="mb-2 text-sm font-medium">Tools</h4>
                        <div className="space-y-2">
                            {addedTools.length > 0 && (
                                <div>
                                    <p className="mb-1 text-xs text-green-500">
                                        Added in v{v2.version} ({addedTools.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {addedTools.map((t) => (
                                            <Badge
                                                key={t}
                                                variant="outline"
                                                className="border-green-500 text-green-500"
                                            >
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {removedTools.length > 0 && (
                                <div>
                                    <p className="mb-1 text-xs text-red-500">
                                        Removed from v{v1.version} ({removedTools.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {removedTools.map((t) => (
                                            <Badge
                                                key={t}
                                                variant="outline"
                                                className="border-red-500 text-red-500"
                                            >
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {unchangedTools.length > 0 && (
                                <div>
                                    <p className="text-muted-foreground mb-1 text-xs">
                                        Unchanged ({unchangedTools.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {unchangedTools.map((t) => (
                                            <Badge key={t} variant="outline">
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {addedTools.length === 0 &&
                                removedTools.length === 0 &&
                                unchangedTools.length === 0 && (
                                    <p className="text-muted-foreground text-sm">
                                        No tools in either version
                                    </p>
                                )}
                        </div>
                    </div>

                    {/* Instructions comparison */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-medium">Instructions</h4>
                            {instructionsDiff && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() =>
                                        setDiffMode(
                                            diffMode === "unified" ? "side-by-side" : "unified"
                                        )
                                    }
                                >
                                    {diffMode === "unified" ? "Side-by-side" : "Unified diff"}
                                </Button>
                            )}
                        </div>
                        {instructionsDiff ? (
                            diffMode === "unified" ? (
                                <div className="bg-muted max-h-[300px] overflow-y-auto rounded-lg p-3 font-mono text-xs">
                                    {instructionsDiff.map((part: Change, i: number) => (
                                        <div
                                            key={i}
                                            className={
                                                part.added
                                                    ? "bg-green-500/20 text-green-300"
                                                    : part.removed
                                                      ? "bg-red-500/20 text-red-300"
                                                      : "text-muted-foreground"
                                            }
                                        >
                                            <pre className="whitespace-pre-wrap">
                                                {part.added ? "+ " : part.removed ? "- " : "  "}
                                                {part.value}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {[v1, v2].map((v, vi) => (
                                        <div
                                            key={vi}
                                            className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
                                        >
                                            <pre className="max-h-[200px] overflow-y-auto text-xs whitespace-pre-wrap">
                                                {v.instructions ||
                                                    v.snapshot?.instructions ||
                                                    "No instructions"}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                Instructions are identical
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* Helper: Compare field row */
function CompareField({
    label,
    value,
    changed,
    delta
}: {
    label: string;
    value: string;
    changed?: boolean;
    delta?: { value: number; positive: boolean } | null;
}) {
    return (
        <div className={`rounded p-2 text-sm ${changed ? "bg-yellow-500/20" : "bg-muted"}`}>
            <span className="text-muted-foreground text-xs">{label}:</span>{" "}
            <span className="font-medium">{value}</span>
            {delta && (
                <span
                    className={`ml-1 text-xs ${delta.positive ? "text-green-500" : "text-red-500"}`}
                >
                    {delta.positive ? "↑" : "↓"} {Math.abs(Math.round(delta.value * 100) / 100)}
                </span>
            )}
        </div>
    );
}

"use client";

import { useState, useMemo } from "react";
import { diffLines, Change } from "diff";
import { Button } from "@repo/ui";

interface InstructionDiffViewProps {
    current: string;
    previous: string | null;
    previousVersion: number | null;
}

export function InstructionDiffView({
    current,
    previous,
    previousVersion
}: InstructionDiffViewProps) {
    const [showDiff, setShowDiff] = useState(false);

    const changes = useMemo(() => {
        if (!showDiff || !previous) return null;
        return diffLines(previous, current);
    }, [showDiff, previous, current]);

    if (!current) {
        return <p className="text-muted-foreground text-sm">No instructions</p>;
    }

    return (
        <div className="space-y-2">
            {previous && previousVersion && (
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDiff(!showDiff)}
                        className="text-xs"
                    >
                        {showDiff ? "Hide diff" : `Diff vs v${previousVersion}`}
                    </Button>
                </div>
            )}

            {showDiff && changes ? (
                <div className="bg-muted max-h-[400px] overflow-y-auto rounded-lg p-3 font-mono text-xs">
                    {changes.map((part: Change, i: number) => (
                        <div
                            key={i}
                            className={
                                part.added
                                    ? "bg-green-500/20 text-green-300"
                                    : part.removed
                                      ? "bg-red-500/20 text-red-300 line-through"
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
                <pre className="bg-muted max-h-[400px] overflow-y-auto rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {current}
                </pre>
            )}
        </div>
    );
}

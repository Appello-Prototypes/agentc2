"use client";

import { useCallback, useState } from "react";
import { Button, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface PrInfo {
    number: number;
    title: string;
    state: string;
    htmlUrl: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    headRef: string;
    baseRef: string;
}

interface DiffLine {
    type: "add" | "remove" | "context" | "header";
    content: string;
}

function parseDiff(raw: string): DiffLine[] {
    return raw.split("\n").map((line) => {
        if (line.startsWith("@@")) return { type: "header" as const, content: line };
        if (line.startsWith("+")) return { type: "add" as const, content: line };
        if (line.startsWith("-")) return { type: "remove" as const, content: line };
        return { type: "context" as const, content: line };
    });
}

const LINE_STYLES: Record<DiffLine["type"], string> = {
    add: "bg-green-500/10 text-green-700 dark:text-green-300",
    remove: "bg-red-500/10 text-red-700 dark:text-red-300",
    context: "",
    header: "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
};

export function CodeDiffCard({ reviewId }: { reviewId: string }) {
    const [pr, setPr] = useState<PrInfo | null>(null);
    const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetched, setFetched] = useState(false);

    const fetchDiff = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/reviews/${reviewId}/diff`);
            const data = await res.json();
            if (data.success) {
                setPr(data.pr);
                if (data.diff) setDiffLines(parseDiff(data.diff));
            } else {
                setError(data.error || "Failed to load diff");
            }
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
            setFetched(true);
        }
    }, [reviewId]);

    if (!fetched && !loading) {
        return (
            <div className="pt-2">
                <Button size="sm" variant="outline" onClick={fetchDiff}>
                    Load PR diff
                </Button>
            </div>
        );
    }

    if (loading) {
        return <Skeleton className="h-24 w-full rounded-lg" />;
    }

    if (error) {
        return (
            <div className="text-muted-foreground text-xs">
                {error === "No PR linked to this review" ? "No PR linked" : error}
            </div>
        );
    }

    if (!pr) return null;

    return (
        <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 text-xs">
                <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                >
                    PR #{pr.number}: {pr.title}
                </a>
                <span className="text-muted-foreground">
                    {pr.baseRef} ← {pr.headRef}
                </span>
            </div>
            <div className="text-muted-foreground flex gap-3 text-xs">
                <span className="text-green-600">+{pr.additions}</span>
                <span className="text-red-600">-{pr.deletions}</span>
                <span>{pr.changedFiles} files</span>
            </div>
            {diffLines.length > 0 && (
                <pre className="bg-muted/30 max-h-64 overflow-auto rounded-lg border p-2 text-xs leading-5">
                    {diffLines.slice(0, 200).map((line, i) => (
                        <div key={i} className={LINE_STYLES[line.type]}>
                            {line.content}
                        </div>
                    ))}
                    {diffLines.length > 200 && (
                        <div className="text-muted-foreground mt-1">
                            … {diffLines.length - 200} more lines
                        </div>
                    )}
                </pre>
            )}
        </div>
    );
}

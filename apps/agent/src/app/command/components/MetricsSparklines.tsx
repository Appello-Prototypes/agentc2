"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface DailyCount {
    date: string;
    count: number;
}

function Sparkline({
    data,
    width = 200,
    height = 32
}: {
    data: number[];
    width?: number;
    height?: number;
}) {
    if (data.length < 2) return null;

    const max = Math.max(...data, 1);
    const step = width / (data.length - 1);
    const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(" ");

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary"
            />
        </svg>
    );
}

export function MetricsSparklines() {
    const [data, setData] = useState<DailyCount[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDaily = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/reviews?action=daily-counts&days=30`);
            const json = await res.json();
            if (json.success && Array.isArray(json.dailyCounts)) {
                setData(json.dailyCounts);
            }
        } catch {
            /* non-critical */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDaily();
    }, [fetchDaily]);

    if (loading) {
        return <Skeleton className="h-16 w-full rounded-xl" />;
    }

    const counts = data.map((d) => d.count);
    const total = counts.reduce((a, b) => a + b, 0);

    if (counts.length === 0) {
        return (
            <Card>
                <CardContent className="flex items-center gap-4 p-4">
                    <div className="text-muted-foreground text-xs">
                        No daily decision data available
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div>
                    <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Decisions (30d)
                    </div>
                    <div className="mt-0.5 text-lg font-bold tabular-nums">{total}</div>
                </div>
                <Sparkline data={counts} />
            </CardContent>
        </Card>
    );
}

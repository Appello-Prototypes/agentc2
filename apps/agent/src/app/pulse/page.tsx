"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@repo/ui";

interface PulseSummary {
    id: string;
    slug: string;
    name: string;
    goal: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
    memberCount: number;
    boardCount: number;
    evaluationCount: number;
    createdAt: string;
}

const statusStyles: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    PAUSED: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    ARCHIVED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
};

export default function PulseListPage() {
    const router = useRouter();
    const [pulses, setPulses] = useState<PulseSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPulses = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/pulse`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setPulses(data.pulses ?? []);
        } catch (err) {
            console.error("Failed to load pulses:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPulses();
    }, [fetchPulses]);

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pulses</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Goal-oriented agent collectives with evaluation and capacity-based rewards.
                    </p>
                </div>
                <Button onClick={() => router.push("/pulse/new")}>+ New Pulse</Button>
            </div>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-lg" />
                    ))}
                </div>
            ) : pulses.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <p className="text-muted-foreground mb-4 text-sm">
                            No pulses yet. Create your first pulse to start organizing agents around
                            a goal.
                        </p>
                        <Button onClick={() => router.push("/pulse/new")}>Create Pulse</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pulses.map((p) => (
                        <Card
                            key={p.id}
                            className="cursor-pointer transition-colors hover:border-zinc-600"
                            onClick={() => router.push(`/pulse/${p.slug}`)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-base">{p.name}</CardTitle>
                                    <Badge
                                        variant="outline"
                                        className={statusStyles[p.status] ?? ""}
                                    >
                                        {p.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-muted-foreground line-clamp-2 text-sm">
                                    {p.goal}
                                </p>
                                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                                    <span>{p.memberCount} members</span>
                                    <span>{p.boardCount} boards</span>
                                    <span>{p.evaluationCount} evals</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

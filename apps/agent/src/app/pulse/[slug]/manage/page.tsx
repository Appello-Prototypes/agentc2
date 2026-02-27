"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Skeleton,
    Separator,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { ArrowLeftIcon } from "lucide-react";

interface PulseDetail {
    id: string;
    slug: string;
    name: string;
    goal: string;
    description: string | null;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
    metricsConfig: Record<string, number>;
    rewardConfig: {
        baseMaxSteps: number;
        baseFrequencyMinutes: number;
        tiers: Array<{
            position: string;
            count: number;
            minScore?: number;
            maxScore?: number;
            maxStepsBonus?: number;
            maxStepsPenalty?: number;
            frequencyMultiplier?: number;
        }>;
    };
    evalCronExpr: string;
    evalWindowDays: number;
    members: Array<{
        id: string;
        role: string;
        capacityLevel: number;
        maxStepsOverride: number | null;
        frequencyOverride: string | null;
        agent: {
            id: string;
            slug: string;
            name: string;
            modelName: string;
            isActive: boolean;
        };
    }>;
    boards: Array<{
        id: string;
        slug: string;
        name: string;
        _count: { posts: number };
    }>;
    _count: { evaluations: number };
    createdAt: string;
}

interface PulseEvaluation {
    id: string;
    windowStart: string;
    windowEnd: string;
    rankingsJson: Array<{
        slug: string;
        name: string;
        compositeScore: number;
        posts: number;
        comments: number;
        votesReceived: number;
        avgEvalScore: number;
    }>;
    actionsJson: Array<{
        slug: string;
        action: string;
        details: string;
    }>;
    createdAt: string;
}

const statusStyles: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    PAUSED: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    ARCHIVED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
};

export default function PulseManagePage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [pulse, setPulse] = useState<PulseDetail | null>(null);
    const [evaluations, setEvaluations] = useState<PulseEvaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);

    const fetchPulse = useCallback(async () => {
        try {
            const listRes = await fetch(`${getApiBase()}/api/pulse`);
            if (!listRes.ok) throw new Error("Failed to list pulses");
            const listData = await listRes.json();
            const match = listData.pulses?.find((p: { slug: string }) => p.slug === slug);
            if (!match) {
                setLoading(false);
                return;
            }

            const res = await fetch(`${getApiBase()}/api/pulse/${match.id}`);
            if (!res.ok) throw new Error("Failed to fetch pulse");
            const data = await res.json();
            setPulse(data.pulse);

            const evalsRes = await fetch(
                `${getApiBase()}/api/pulse/${match.id}/evaluations?limit=10`
            );
            if (evalsRes.ok) {
                const evalsData = await evalsRes.json();
                setEvaluations(evalsData.evaluations ?? []);
            }
        } catch (err) {
            console.error("Failed to load pulse:", err);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchPulse();
    }, [fetchPulse]);

    async function handleEvaluate() {
        if (!pulse) return;
        setEvaluating(true);
        try {
            const res = await fetch(`${getApiBase()}/api/pulse/${pulse.id}/evaluate`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Evaluation failed");
            await fetchPulse();
        } catch (err) {
            console.error("Evaluation error:", err);
        } finally {
            setEvaluating(false);
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl space-y-6 p-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!pulse) {
        return (
            <div className="mx-auto max-w-6xl p-6">
                <p className="text-muted-foreground">Pulse not found.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => router.push(`/pulse/${slug}`)}
                        className="mb-2 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                        <ArrowLeftIcon className="h-3 w-3" />
                        Back to {pulse.name}
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Manage: {pulse.name}
                        </h1>
                        <Badge variant="outline" className={statusStyles[pulse.status] ?? ""}>
                            {pulse.status}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">{pulse.goal}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => router.push(`/pulse/${slug}/configure`)}
                    >
                        Configure
                    </Button>
                    <Button onClick={handleEvaluate} disabled={evaluating}>
                        {evaluating ? "Evaluating..." : "Run Evaluation"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{pulse.members.length}</div>
                        <div className="text-muted-foreground text-xs">Members</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{pulse.boards.length}</div>
                        <div className="text-muted-foreground text-xs">Boards</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{pulse._count.evaluations}</div>
                        <div className="text-muted-foreground text-xs">Evaluations</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{pulse.evalWindowDays}d</div>
                        <div className="text-muted-foreground text-xs">Eval Window</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="members">
                <TabsList>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="boards">Boards</TabsTrigger>
                    <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Members ({pulse.members.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agent</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead>Capacity</TableHead>
                                        <TableHead>Max Steps</TableHead>
                                        <TableHead>Frequency</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pulse.members.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">
                                                        {m.agent.name}
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        {m.agent.slug}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{m.role}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {m.agent.modelName}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        m.capacityLevel > 0
                                                            ? "text-emerald-400"
                                                            : m.capacityLevel < 0
                                                              ? "text-red-400"
                                                              : ""
                                                    }
                                                >
                                                    {m.capacityLevel > 0
                                                        ? `+${m.capacityLevel}`
                                                        : m.capacityLevel}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {m.maxStepsOverride ?? "default"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {m.frequencyOverride ?? "default"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="boards" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Boards ({pulse.boards.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Board</TableHead>
                                        <TableHead>Slug</TableHead>
                                        <TableHead>Posts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pulse.boards.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="font-medium">{b.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {b.slug}
                                            </TableCell>
                                            <TableCell>{b._count.posts}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="evaluations" className="mt-4 space-y-4">
                    {evaluations.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <p className="text-muted-foreground text-sm">
                                    No evaluations yet. Click &ldquo;Run Evaluation&rdquo; to
                                    trigger one.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        evaluations.map((ev) => (
                            <Card key={ev.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm">
                                            {new Date(ev.windowStart).toLocaleDateString()} —{" "}
                                            {new Date(ev.windowEnd).toLocaleDateString()}
                                        </CardTitle>
                                        <span className="text-muted-foreground text-xs">
                                            {new Date(ev.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <p className="text-muted-foreground mb-1 text-xs font-medium">
                                            Rankings
                                        </p>
                                        <div className="space-y-1">
                                            {ev.rankingsJson.map((r, i) => (
                                                <div
                                                    key={r.slug}
                                                    className="text-muted-foreground flex items-center gap-2 text-xs"
                                                >
                                                    <span className="w-5 text-right font-mono">
                                                        {i + 1}.
                                                    </span>
                                                    <span className="font-medium text-zinc-200">
                                                        {r.name}
                                                    </span>
                                                    <span>Score: {r.compositeScore}</span>
                                                    <span>
                                                        ({r.posts}p / {r.comments}c /{" "}
                                                        {r.votesReceived}v)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {ev.actionsJson.length > 0 && (
                                        <>
                                            <Separator />
                                            <div>
                                                <p className="text-muted-foreground mb-1 text-xs font-medium">
                                                    Capacity Adjustments
                                                </p>
                                                <div className="space-y-1">
                                                    {ev.actionsJson.map((a, i) => (
                                                        <div key={i} className="text-xs">
                                                            <span
                                                                className={
                                                                    a.action === "capacity_increase"
                                                                        ? "text-emerald-400"
                                                                        : "text-red-400"
                                                                }
                                                            >
                                                                {a.slug}
                                                            </span>{" "}
                                                            <span className="text-muted-foreground">
                                                                {a.details}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

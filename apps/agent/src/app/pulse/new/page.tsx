"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Separator,
    Textarea
} from "@repo/ui";

export default function NewPulsePage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [goal, setGoal] = useState("");
    const [description, setDescription] = useState("");

    const [postsWeight, setPostsWeight] = useState(3);
    const [commentsWeight, setCommentsWeight] = useState(2);
    const [votesWeight, setVotesWeight] = useState(1);
    const [evalWeight, setEvalWeight] = useState(10);

    const [baseMaxSteps, setBaseMaxSteps] = useState(8);
    const [baseFreqMinutes, setBaseFreqMinutes] = useState(60);
    const [topCount, setTopCount] = useState(3);
    const [topMinScore, setTopMinScore] = useState(5);
    const [topBonus, setTopBonus] = useState(4);
    const [topFreqMult, setTopFreqMult] = useState(0.5);
    const [bottomCount, setBottomCount] = useState(3);
    const [bottomMaxScore, setBottomMaxScore] = useState(3);
    const [bottomPenalty, setBottomPenalty] = useState(3);
    const [bottomFreqMult, setBottomFreqMult] = useState(2.0);

    const [evalCron, setEvalCron] = useState("0 23 * * 0");
    const [evalTimezone, setEvalTimezone] = useState("America/Toronto");
    const [evalWindowDays, setEvalWindowDays] = useState(7);

    const [reportBoard, setReportBoard] = useState("");
    const [reportRole, setReportRole] = useState("monitor");

    async function handleSubmit() {
        if (!name.trim() || !goal.trim()) {
            setError("Name and goal are required");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`${getApiBase()}/api/pulse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    goal,
                    description: description || undefined,
                    metricsConfig: {
                        communityPosts: postsWeight,
                        communityComments: commentsWeight,
                        communityVotes: votesWeight,
                        avgEvalScore: evalWeight
                    },
                    rewardConfig: {
                        baseMaxSteps,
                        baseFrequencyMinutes: baseFreqMinutes,
                        tiers: [
                            {
                                position: "top",
                                count: topCount,
                                minScore: topMinScore,
                                maxStepsBonus: topBonus,
                                frequencyMultiplier: topFreqMult
                            },
                            {
                                position: "bottom",
                                count: bottomCount,
                                maxScore: bottomMaxScore,
                                maxStepsPenalty: bottomPenalty,
                                frequencyMultiplier: bottomFreqMult
                            }
                        ]
                    },
                    evalCronExpr: evalCron,
                    evalTimezone,
                    evalWindowDays,
                    reportConfig: reportBoard
                        ? {
                              boardSlug: reportBoard,
                              authorMemberRole: reportRole,
                              category: "performance-report"
                          }
                        : undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "Failed to create pulse");
            }

            const data = await res.json();
            router.push(`/pulse/${data.pulse.slug}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Create Pulse</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Define a goal-oriented agent collective with evaluation metrics and
                    capacity-based rewards.
                </p>
            </div>

            {error && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="AI Knowledge Pulse"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Goal</Label>
                        <Textarea
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            placeholder="Build a living knowledge base about AI technologies through collaborative agent discussions."
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Additional context about this pulse..."
                            rows={2}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Metrics Weights</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Posts</Label>
                        <Input
                            type="number"
                            value={postsWeight}
                            onChange={(e) => setPostsWeight(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Comments</Label>
                        <Input
                            type="number"
                            value={commentsWeight}
                            onChange={(e) => setCommentsWeight(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Votes</Label>
                        <Input
                            type="number"
                            value={votesWeight}
                            onChange={(e) => setVotesWeight(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Eval Score</Label>
                        <Input
                            type="number"
                            value={evalWeight}
                            onChange={(e) => setEvalWeight(Number(e.target.value))}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Capacity Rewards</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Base Max Steps</Label>
                            <Input
                                type="number"
                                value={baseMaxSteps}
                                onChange={(e) => setBaseMaxSteps(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Base Frequency (min)</Label>
                            <Input
                                type="number"
                                value={baseFreqMinutes}
                                onChange={(e) => setBaseFreqMinutes(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <Separator />
                    <p className="text-muted-foreground text-xs">Top Performers</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Count</Label>
                            <Input
                                type="number"
                                value={topCount}
                                onChange={(e) => setTopCount(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Min Score</Label>
                            <Input
                                type="number"
                                value={topMinScore}
                                onChange={(e) => setTopMinScore(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Steps Bonus</Label>
                            <Input
                                type="number"
                                value={topBonus}
                                onChange={(e) => setTopBonus(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Frequency Multiplier</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={topFreqMult}
                                onChange={(e) => setTopFreqMult(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <Separator />
                    <p className="text-muted-foreground text-xs">Bottom Performers</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Count</Label>
                            <Input
                                type="number"
                                value={bottomCount}
                                onChange={(e) => setBottomCount(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Score</Label>
                            <Input
                                type="number"
                                value={bottomMaxScore}
                                onChange={(e) => setBottomMaxScore(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Steps Penalty</Label>
                            <Input
                                type="number"
                                value={bottomPenalty}
                                onChange={(e) => setBottomPenalty(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Frequency Multiplier</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={bottomFreqMult}
                                onChange={(e) => setBottomFreqMult(Number(e.target.value))}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Evaluation Schedule</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Cron Expression</Label>
                        <Input value={evalCron} onChange={(e) => setEvalCron(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Input
                            value={evalTimezone}
                            onChange={(e) => setEvalTimezone(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Window (days)</Label>
                        <Input
                            type="number"
                            value={evalWindowDays}
                            onChange={(e) => setEvalWindowDays(Number(e.target.value))}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Reporting (Optional)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Report Board Slug</Label>
                        <Input
                            value={reportBoard}
                            onChange={(e) => setReportBoard(e.target.value)}
                            placeholder="signal-noise"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Author Role</Label>
                        <Input
                            value={reportRole}
                            onChange={(e) => setReportRole(e.target.value)}
                            placeholder="monitor"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                    {saving ? "Creating..." : "Create Pulse"}
                </Button>
            </div>
        </div>
    );
}

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

    const [scoreFunction, setScoreFunction] = useState("");
    const [scoreFunctionType, setScoreFunctionType] = useState("manual");
    const [scoreDirection, setScoreDirection] = useState("higher");
    const [targetScore, setTargetScore] = useState<number | "">("");

    const [enableGodAgent, setEnableGodAgent] = useState(false);
    const [godAgentModel, setGodAgentModel] = useState("gpt-4o");
    const [godAgentCron, setGodAgentCron] = useState("0 */2 * * *");
    const [godAgentMaxSteps, setGodAgentMaxSteps] = useState(50);

    const [constraintReviewInterval, setConstraintReviewInterval] = useState(10);
    const [timeReviewDays, setTimeReviewDays] = useState(7);

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
                        : undefined,
                    scoreFunction: scoreFunction || undefined,
                    scoreFunctionType,
                    scoreDirection,
                    targetScore: targetScore !== "" ? targetScore : undefined,
                    settings: {
                        godAgentConfig: enableGodAgent
                            ? {
                                  enabled: true,
                                  model: godAgentModel,
                                  cronExpr: godAgentCron,
                                  maxSteps: godAgentMaxSteps
                              }
                            : undefined,
                        reviewConfig: {
                            constraintReviewInterval,
                            timeReviewDays,
                            scoreCheckpoints: []
                        }
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "Failed to create pulse");
            }

            const data = await res.json();

            if (enableGodAgent && data.pulse?.id) {
                try {
                    await fetch(`${getApiBase()}/api/pulse/${data.pulse.id}/bootstrap`, {
                        method: "POST",
                        credentials: "include"
                    });
                } catch {
                    // Bootstrap failure is non-fatal
                }
            }

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
                    <CardTitle className="text-base">Score Function</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>What single number measures success?</Label>
                        <Textarea
                            value={scoreFunction}
                            onChange={(e) => setScoreFunction(e.target.value)}
                            placeholder="e.g., Number of page-1 keywords, Deal close rate %, Churn rate %"
                            rows={2}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Score Type</Label>
                            <select
                                className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                                value={scoreFunctionType}
                                onChange={(e) => setScoreFunctionType(e.target.value)}
                            >
                                <option value="manual">Manual (God Agent measures)</option>
                                <option value="milestone_completion">Milestone Completion %</option>
                                <option value="task_completion">Task Completion %</option>
                                <option value="community_activity">Community Activity Count</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Direction</Label>
                            <select
                                className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                                value={scoreDirection}
                                onChange={(e) => setScoreDirection(e.target.value)}
                            >
                                <option value="higher">Higher is better</option>
                                <option value="lower">Lower is better</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Target Score</Label>
                            <Input
                                type="number"
                                value={targetScore}
                                onChange={(e) =>
                                    setTargetScore(e.target.value ? Number(e.target.value) : "")
                                }
                                placeholder="100"
                            />
                        </div>
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

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">God Agent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={enableGodAgent}
                            onChange={(e) => setEnableGodAgent(e.target.checked)}
                            className="h-4 w-4"
                        />
                        <Label>Enable autonomous God Agent orchestrator</Label>
                    </div>
                    {enableGodAgent && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <select
                                    className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                                    value={godAgentModel}
                                    onChange={(e) => setGodAgentModel(e.target.value)}
                                >
                                    <option value="gpt-4o">GPT-4o</option>
                                    <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Run Schedule (cron)</Label>
                                <Input
                                    value={godAgentCron}
                                    onChange={(e) => setGodAgentCron(e.target.value)}
                                    placeholder="0 */2 * * *"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Steps per Run</Label>
                                <Input
                                    type="number"
                                    value={godAgentMaxSteps}
                                    onChange={(e) => setGodAgentMaxSteps(Number(e.target.value))}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Human Review Points</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Constraint Review Every N Constraints</Label>
                        <Input
                            type="number"
                            value={constraintReviewInterval}
                            onChange={(e) => setConstraintReviewInterval(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Time Review Every N Days</Label>
                        <Input
                            type="number"
                            value={timeReviewDays}
                            onChange={(e) => setTimeReviewDays(Number(e.target.value))}
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

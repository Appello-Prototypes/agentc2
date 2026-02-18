"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Separator,
    Skeleton,
    Switch,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface PipelinePolicy {
    enabled: boolean;
    autoApprovePlanBelow: string;
    autoApprovePrBelow: string;
    allowedRepos: string[];
}

interface RepositoryConfig {
    id: string;
    repositoryUrl: string;
    name: string | null;
    baseBranch: string;
    installCommand: string;
    buildCommand: string;
    testCommand: string | null;
    codingStandards: string | null;
    codingAgentSlug: string | null;
    createdAt: string;
}

interface PipelineRun {
    id: string;
    status: string;
    riskLevel: string | null;
    trustScore: number | null;
    variant: string;
    createdAt: string;
}

interface DashboardMetrics {
    totalRuns: number;
    autoApproved: number;
    humanApproved: number;
    deployed: number;
    failed: number;
    avgTrustScore: number | null;
    autonomyRate: number;
}

const RISK_LEVELS = ["trivial", "low", "medium", "high", "critical"];

function computeMetrics(runs: PipelineRun[]): DashboardMetrics {
    const total = runs.length;
    const deployed = runs.filter((r) => r.status === "deployed").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const trustScores = runs.filter((r) => r.trustScore !== null).map((r) => r.trustScore!);
    const avgTrust =
        trustScores.length > 0 ? trustScores.reduce((a, b) => a + b, 0) / trustScores.length : null;

    const autoApproved = runs.filter(
        (r) => r.status === "deployed" || r.status === "merged"
    ).length;
    const humanApproved = total - autoApproved - failed;
    const autonomyRate = total > 0 ? autoApproved / total : 0;

    return {
        totalRuns: total,
        autoApproved,
        humanApproved,
        deployed,
        failed,
        avgTrustScore: avgTrust,
        autonomyRate
    };
}

function ReadinessLevel({
    metrics,
    policy
}: {
    metrics: DashboardMetrics;
    policy: PipelinePolicy;
}) {
    let label = "Level 0: Manual";
    let color = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

    if (policy.enabled) {
        label = "Level 2: Risk-Gated Approval";
        color = "bg-blue-500/10 text-blue-400 border-blue-500/20";

        if (
            RISK_LEVELS.indexOf(policy.autoApprovePlanBelow) >= 2 &&
            RISK_LEVELS.indexOf(policy.autoApprovePrBelow) >= 1
        ) {
            label = "Level 3: Scenario Testing";
            color = "bg-purple-500/10 text-purple-400 border-purple-500/20";
        }

        if (
            metrics.avgTrustScore !== null &&
            metrics.avgTrustScore >= 0.9 &&
            metrics.autonomyRate >= 0.7
        ) {
            label = "Level 4: Trust-Gated Merge";
            color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        }

        if (
            metrics.avgTrustScore !== null &&
            metrics.avgTrustScore >= 0.95 &&
            metrics.autonomyRate >= 0.9 &&
            RISK_LEVELS.indexOf(policy.autoApprovePrBelow) >= 3
        ) {
            label = "Level 5: Dark Factory";
            color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        }
    }

    return (
        <Badge variant="outline" className={`px-3 py-1 text-sm ${color}`}>
            {label}
        </Badge>
    );
}

export default function DarkFactoryDashboard() {
    const [policy, setPolicy] = useState<PipelinePolicy | null>(null);
    const [repos, setRepos] = useState<RepositoryConfig[]>([]);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const apiBase = getApiBase();

    const fetchData = useCallback(async () => {
        try {
            const [policyRes, reposRes, runsRes] = await Promise.all([
                fetch(`${apiBase}/api/coding-pipeline/policy`),
                fetch(`${apiBase}/api/coding-pipeline/repos`),
                fetch(`${apiBase}/api/coding-pipeline/runs?limit=100`)
            ]);

            if (policyRes.ok) {
                const data = await policyRes.json();
                setPolicy(data.policy);
            }
            if (reposRes.ok) {
                const data = await reposRes.json();
                setRepos(data.repos || []);
            }
            if (runsRes.ok) {
                const data = await runsRes.json();
                setRuns(data.runs || []);
            }
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updatePolicy = async (updates: Partial<PipelinePolicy>) => {
        if (!policy) return;
        setSaving(true);
        try {
            const res = await fetch(`${apiBase}/api/coding-pipeline/policy`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...policy, ...updates })
            });
            if (res.ok) {
                const data = await res.json();
                setPolicy(data.policy);
            }
        } catch (err) {
            console.error("Failed to update policy:", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto max-w-6xl space-y-6 p-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    const metrics = computeMetrics(runs);
    const effectivePolicy = policy ?? {
        enabled: false,
        autoApprovePlanBelow: "medium",
        autoApprovePrBelow: "low",
        allowedRepos: []
    };

    return (
        <div className="container mx-auto max-w-6xl space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dark Factory Dashboard</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Autonomous coding pipeline configuration and metrics
                    </p>
                </div>
                <ReadinessLevel metrics={metrics} policy={effectivePolicy} />
            </div>

            <Separator />

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{metrics.totalRuns}</div>
                        <p className="text-muted-foreground text-xs">Total Pipeline Runs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-emerald-400">
                            {metrics.deployed}
                        </div>
                        <p className="text-muted-foreground text-xs">Deployed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                            {metrics.avgTrustScore !== null
                                ? (metrics.avgTrustScore * 100).toFixed(1) + "%"
                                : "N/A"}
                        </div>
                        <p className="text-muted-foreground text-xs">Avg Trust Score</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                            {(metrics.autonomyRate * 100).toFixed(0)}%
                        </div>
                        <p className="text-muted-foreground text-xs">Autonomy Rate</p>
                    </CardContent>
                </Card>
            </div>

            {/* Policy Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Pipeline Policy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="dark-factory-toggle">Dark Factory Mode</Label>
                            <p className="text-muted-foreground text-sm">
                                Enable risk-gated auto-approval of plans and PRs
                            </p>
                        </div>
                        <Switch
                            id="dark-factory-toggle"
                            checked={effectivePolicy.enabled}
                            disabled={saving}
                            onCheckedChange={(checked) => updatePolicy({ enabled: checked })}
                        />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Auto-Approve Plan Below</Label>
                            <p className="text-muted-foreground text-xs">
                                Plans with risk below this level are auto-approved
                            </p>
                            <Select
                                value={effectivePolicy.autoApprovePlanBelow ?? undefined}
                                disabled={saving || !effectivePolicy.enabled}
                                onValueChange={(val) => {
                                    if (val)
                                        updatePolicy({
                                            autoApprovePlanBelow: val
                                        });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RISK_LEVELS.map((level) => (
                                        <SelectItem key={level} value={level}>
                                            {level}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Auto-Approve PR Below</Label>
                            <p className="text-muted-foreground text-xs">
                                PRs with risk below this level are auto-merged
                            </p>
                            <Select
                                value={effectivePolicy.autoApprovePrBelow ?? undefined}
                                disabled={saving || !effectivePolicy.enabled}
                                onValueChange={(val) => {
                                    if (val) updatePolicy({ autoApprovePrBelow: val });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RISK_LEVELS.map((level) => (
                                        <SelectItem key={level} value={level}>
                                            {level}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Repository Configs */}
            <Card>
                <CardHeader>
                    <CardTitle>Repository Configurations ({repos.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {repos.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No repository configurations yet. Create one via the API.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {repos.map((repo) => (
                                <div
                                    key={repo.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <div>
                                        <div className="font-medium">
                                            {repo.name || repo.repositoryUrl}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {repo.repositoryUrl} ({repo.baseBranch})
                                        </div>
                                        <div className="text-muted-foreground mt-1 text-xs">
                                            Build: {repo.buildCommand}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {repo.codingAgentSlug && (
                                            <Badge variant="outline">{repo.codingAgentSlug}</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Runs with Trust Scores */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Pipeline Runs</CardTitle>
                </CardHeader>
                <CardContent>
                    {runs.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No pipeline runs yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {runs.slice(0, 20).map((run) => (
                                <div
                                    key={run.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Badge
                                            variant="outline"
                                            className={
                                                run.status === "deployed"
                                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                                    : run.status === "failed"
                                                      ? "border-red-500/20 bg-red-500/10 text-red-400"
                                                      : "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                            }
                                        >
                                            {run.status}
                                        </Badge>
                                        {run.riskLevel && (
                                            <Badge variant="secondary">{run.riskLevel}</Badge>
                                        )}
                                        <span className="text-muted-foreground text-sm">
                                            {run.variant}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {run.trustScore !== null && (
                                            <span
                                                className={`font-mono text-sm ${
                                                    run.trustScore >= 0.9
                                                        ? "text-emerald-400"
                                                        : run.trustScore >= 0.7
                                                          ? "text-amber-400"
                                                          : "text-red-400"
                                                }`}
                                            >
                                                {(run.trustScore * 100).toFixed(1)}%
                                            </span>
                                        )}
                                        <span className="text-muted-foreground text-xs">
                                            {new Date(run.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

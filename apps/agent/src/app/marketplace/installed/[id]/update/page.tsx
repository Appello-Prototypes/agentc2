"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox } from "@repo/ui";
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    AlertCircleIcon,
    LoaderIcon,
    MinusIcon,
    PlusIcon,
    PencilIcon
} from "lucide-react";

interface FieldDiff {
    field: string;
    status: "unchanged" | "added" | "removed" | "modified";
    installedValue?: unknown;
    latestValue?: unknown;
    currentValue?: unknown;
    customized: boolean;
}

interface ComponentDiff {
    type: "agent" | "workflow" | "network";
    sourceSlug: string;
    installedSlug?: string;
    status: "unchanged" | "added" | "removed" | "modified";
    fields: FieldDiff[];
}

interface DiffResponse {
    upToDate: boolean;
    installedVersion: number;
    latestVersion: number;
    components: ComponentDiff[];
}

function formatFieldValue(val: unknown): string {
    if (val === null || val === undefined) return "(empty)";
    if (typeof val === "string") {
        if (val.length > 200) return val.slice(0, 200) + "...";
        return val;
    }
    const s = JSON.stringify(val, null, 2);
    if (s.length > 200) return s.slice(0, 200) + "...";
    return s;
}

const statusIcons: Record<string, typeof PlusIcon> = {
    added: PlusIcon,
    removed: MinusIcon,
    modified: PencilIcon
};

const statusColors: Record<string, string> = {
    added: "text-green-400",
    removed: "text-red-400",
    modified: "text-amber-400",
    unchanged: "text-muted-foreground"
};

export default function UpdatePage(props: { params: Promise<{ id: string }> }) {
    const { id } = use(props.params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [diff, setDiff] = useState<DiffResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [playbookSlug, setPlaybookSlug] = useState("");
    const [playbookName, setPlaybookName] = useState("");
    const [selectedFields, setSelectedFields] = useState<Record<string, Set<string>>>({});
    const [merging, setMerging] = useState(false);
    const [mergeResult, setMergeResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const instRes = await fetch(`${getApiBase()}/api/playbooks/my/installed`);
                const instData = await instRes.json();
                const inst = (instData.installations ?? []).find(
                    (i: { id: string }) => i.id === id
                );
                if (!inst) {
                    setError("Installation not found");
                    return;
                }

                setPlaybookSlug(inst.playbook.slug);
                setPlaybookName(inst.playbook.name);

                const diffRes = await fetch(
                    `${getApiBase()}/api/playbooks/${inst.playbook.slug}/diff?installationId=${id}`
                );
                if (!diffRes.ok) {
                    const errData = await diffRes.json();
                    setError(errData.error ?? "Failed to load diff");
                    return;
                }

                const diffData: DiffResponse = await diffRes.json();
                setDiff(diffData);

                // Pre-select all non-customized changed fields
                const initial: Record<string, Set<string>> = {};
                for (const comp of diffData.components) {
                    if (comp.status === "unchanged") continue;
                    const key = `${comp.type}:${comp.sourceSlug}`;
                    initial[key] = new Set(
                        comp.fields
                            .filter((f) => f.status !== "unchanged" && !f.customized)
                            .map((f) => f.field)
                    );
                }
                setSelectedFields(initial);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [id]);

    function toggleField(compKey: string, field: string) {
        setSelectedFields((prev) => {
            const next = { ...prev };
            const set = new Set(next[compKey] ?? []);
            if (set.has(field)) {
                set.delete(field);
            } else {
                set.add(field);
            }
            next[compKey] = set;
            return next;
        });
    }

    async function handleMerge() {
        if (!diff) return;
        setMerging(true);
        try {
            const acceptedChanges: Record<string, Record<string, { fields: string[] }>> = {
                agents: {},
                workflows: {},
                networks: {}
            };

            for (const comp of diff.components) {
                const key = `${comp.type}:${comp.sourceSlug}`;
                const selected = selectedFields[key];
                if (!selected || selected.size === 0) continue;

                const category =
                    comp.type === "agent"
                        ? "agents"
                        : comp.type === "workflow"
                          ? "workflows"
                          : "networks";
                acceptedChanges[category][comp.sourceSlug] = {
                    fields: Array.from(selected)
                };
            }

            const res = await fetch(`${getApiBase()}/api/playbooks/installations/${id}/merge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ acceptedChanges })
            });
            const data = await res.json();

            if (res.ok) {
                setMergeResult({
                    success: true,
                    message: "Changes applied successfully!"
                });
            } else {
                setMergeResult({
                    success: false,
                    message: data.error ?? "Merge failed"
                });
            }
        } catch (err) {
            setMergeResult({
                success: false,
                message: err instanceof Error ? err.message : "Merge failed"
            });
        } finally {
            setMerging(false);
        }
    }

    const totalSelected = Object.values(selectedFields).reduce((sum, set) => sum + set.size, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading diff...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-8">
                <Card>
                    <CardContent className="py-8 text-center">
                        <AlertCircleIcon className="mx-auto mb-4 h-12 w-12 text-red-400" />
                        <h3 className="mb-2 text-lg font-medium">Error</h3>
                        <p className="text-muted-foreground mb-4 text-sm">{error}</p>
                        <Button
                            variant="outline"
                            onClick={() => router.push("/marketplace/installed")}
                        >
                            Back to Installed
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (mergeResult) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-8">
                <Card>
                    <CardContent className="py-8 text-center">
                        {mergeResult.success ? (
                            <>
                                <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-green-400" />
                                <h3 className="mb-2 text-lg font-medium">{mergeResult.message}</h3>
                                <p className="text-muted-foreground mb-4 text-sm">
                                    Your installation has been updated.
                                </p>
                                <div className="flex justify-center gap-3">
                                    <Button onClick={() => router.push("/marketplace/installed")}>
                                        View Installed
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push("/agents")}
                                    >
                                        Go to Agents
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircleIcon className="mx-auto mb-4 h-12 w-12 text-red-400" />
                                <h3 className="mb-2 text-lg font-medium">Merge Failed</h3>
                                <p className="text-muted-foreground mb-4 text-sm">
                                    {mergeResult.message}
                                </p>
                                <Button onClick={() => setMergeResult(null)}>Try Again</Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (diff?.upToDate) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-8">
                <Card>
                    <CardContent className="py-8 text-center">
                        <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-green-400" />
                        <h3 className="mb-2 text-lg font-medium">Up to Date</h3>
                        <p className="text-muted-foreground mb-4 text-sm">
                            This installation is running the latest version (v
                            {diff.installedVersion}).
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => router.push("/marketplace/installed")}
                        >
                            Back to Installed
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const changedComponents = diff?.components.filter((c) => c.status !== "unchanged") ?? [];

    return (
        <div className="mx-auto max-w-3xl px-6 py-8">
            <button
                onClick={() => router.push("/marketplace/installed")}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Installed Playbooks
            </button>

            <div className="mb-6">
                <h1 className="text-2xl font-bold">Update {playbookName}</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Review changes from v{diff?.installedVersion} to v{diff?.latestVersion}. Select
                    which changes to apply.
                </p>
            </div>

            {changedComponents.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">
                            No component changes detected between versions.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {changedComponents.map((comp) => {
                        const compKey = `${comp.type}:${comp.sourceSlug}`;
                        const selected = selectedFields[compKey] ?? new Set();
                        const changedFields = comp.fields.filter((f) => f.status !== "unchanged");
                        const StatusIcon = statusIcons[comp.status];

                        return (
                            <Card key={compKey}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        {StatusIcon && (
                                            <StatusIcon
                                                className={`h-4 w-4 ${statusColors[comp.status]}`}
                                            />
                                        )}
                                        <CardTitle className="text-base">
                                            {comp.type.charAt(0).toUpperCase() + comp.type.slice(1)}
                                            : {comp.sourceSlug}
                                        </CardTitle>
                                        <Badge
                                            className={
                                                comp.status === "added"
                                                    ? "bg-green-500/10 text-green-400"
                                                    : comp.status === "removed"
                                                      ? "bg-red-500/10 text-red-400"
                                                      : "bg-amber-500/10 text-amber-400"
                                            }
                                        >
                                            {comp.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                {changedFields.length > 0 && (
                                    <CardContent className="space-y-3 pt-0">
                                        {changedFields.map((f) => (
                                            <div
                                                key={f.field}
                                                className="border-border rounded-md border p-3"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={selected.has(f.field)}
                                                        onCheckedChange={() =>
                                                            toggleField(compKey, f.field)
                                                        }
                                                        className="mt-0.5"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <span className="font-mono text-sm font-medium">
                                                                {f.field}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs ${statusColors[f.status]}`}
                                                            >
                                                                {f.status}
                                                            </Badge>
                                                            {f.customized && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs text-purple-400"
                                                                >
                                                                    customized
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {f.status === "modified" && (
                                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <p className="text-muted-foreground mb-1 text-xs">
                                                                        Installed (v
                                                                        {diff?.installedVersion})
                                                                    </p>
                                                                    <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs">
                                                                        {formatFieldValue(
                                                                            f.installedValue
                                                                        )}
                                                                    </pre>
                                                                </div>
                                                                <div>
                                                                    <p className="text-muted-foreground mb-1 text-xs">
                                                                        Latest (v
                                                                        {diff?.latestVersion})
                                                                    </p>
                                                                    <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs">
                                                                        {formatFieldValue(
                                                                            f.latestValue
                                                                        )}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {changedComponents.length > 0 && (
                <div className="mt-6 flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                        {totalSelected} change{totalSelected !== 1 ? "s" : ""} selected
                    </p>
                    <Button
                        onClick={handleMerge}
                        disabled={totalSelected === 0 || merging}
                        size="lg"
                    >
                        {merging ? (
                            <>
                                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                Applying Changes...
                            </>
                        ) : (
                            `Apply ${totalSelected} Change${totalSelected !== 1 ? "s" : ""}`
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}

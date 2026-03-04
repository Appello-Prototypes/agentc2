"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2Icon, CheckCircle2Icon, GitBranchIcon } from "lucide-react";
import { Button } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import type { StepRendererProps } from "../PlaybookSetupWizard";

interface Repo {
    full_name: string;
    default_branch: string;
    private: boolean;
}

export function RepoSelectStep({ installationId, step, onComplete }: StepRendererProps) {
    const base = getApiBase();
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<string>("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchRepos() {
            try {
                const res = await fetch(
                    `${base}/api/playbooks/installations/${installationId}/setup/repos`
                );
                if (!res.ok) throw new Error("Failed to fetch repositories");
                const data = (await res.json()) as { repos: Repo[] };
                setRepos(data.repos ?? []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load repos");
            } finally {
                setLoading(false);
            }
        }
        fetchRepos();
    }, [base, installationId]);

    const handleSave = useCallback(async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(
                `${base}/api/playbooks/installations/${installationId}/setup/configure`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stepId: step.id,
                        data: { repository: selected }
                    })
                }
            );
            if (!res.ok) {
                const data = (await res.json()) as { error?: string };
                throw new Error(data.error ?? "Failed to save");
            }
            onComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }, [base, installationId, step.id, selected, onComplete]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-4">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">Loading repositories...</span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-muted-foreground text-xs">{step.description}</p>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {repos.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No repositories found. Make sure your GitHub integration has access to the
                    target repository.
                </p>
            ) : (
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                    {repos.map((repo) => (
                        <label
                            key={repo.full_name}
                            className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm transition-colors ${
                                selected === repo.full_name
                                    ? "border-primary bg-primary/5"
                                    : "hover:border-zinc-600"
                            }`}
                        >
                            <input
                                type="radio"
                                name="repo"
                                value={repo.full_name}
                                checked={selected === repo.full_name}
                                onChange={() => setSelected(repo.full_name)}
                                className="accent-primary"
                            />
                            <GitBranchIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <span className="font-medium">{repo.full_name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">
                                    {repo.default_branch}
                                    {repo.private ? " · private" : ""}
                                </span>
                            </div>
                        </label>
                    ))}
                </div>
            )}

            <Button size="sm" onClick={handleSave} disabled={!selected || saving}>
                {saving ? (
                    <>
                        <Loader2Icon className="mr-2 h-3 w-3 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <CheckCircle2Icon className="mr-2 h-3 w-3" />
                        Confirm Repository
                    </>
                )}
            </Button>
        </div>
    );
}

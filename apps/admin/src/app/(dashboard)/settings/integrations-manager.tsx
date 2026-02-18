"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

type GitHubProfile = {
    username: string;
    avatarUrl: string | null;
    connectedAt: string;
};

type ConfiguredRepository = {
    id: string;
    url: string;
    name: string;
    owner: string;
    isDefault: boolean;
    isPrivate?: boolean;
};

type GitHubRepository = {
    id: string;
    name: string;
    fullName: string;
    owner: string;
    url: string;
    isPrivate: boolean;
    configured: boolean;
};

export function IntegrationsManager() {
    const searchParams = useSearchParams();
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [connected, setConnected] = useState(false);
    const [profile, setProfile] = useState<GitHubProfile | null>(null);
    const [configuredRepos, setConfiguredRepos] = useState<ConfiguredRepository[]>([]);
    const [availableRepos, setAvailableRepos] = useState<GitHubRepository[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");
    const [busyRepoId, setBusyRepoId] = useState<string | null>(null);

    const statusMessage = useMemo(() => {
        if (searchParams.get("github") === "connected") return "GitHub connected successfully.";
        return "";
    }, [searchParams]);

    async function loadStatus() {
        setLoadingStatus(true);
        setError("");
        try {
            const response = await fetch("/admin/api/settings/github/status", {
                credentials: "include"
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to load GitHub status");
            setConnected(Boolean(data.connected));
            setProfile(data.profile ?? null);
        } catch (err) {
            setConnected(false);
            setProfile(null);
            setError(err instanceof Error ? err.message : "Failed to load GitHub status");
        } finally {
            setLoadingStatus(false);
        }
    }

    async function loadConfiguredRepos() {
        try {
            const response = await fetch("/admin/api/settings/repos", {
                credentials: "include"
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || "Failed to load configured repositories");
            setConfiguredRepos(data.repositories ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load configured repositories");
        }
    }

    const loadAvailableRepos = useCallback(async () => {
        if (!connected) return;
        setReposLoading(true);
        try {
            const response = await fetch("/admin/api/settings/github/repos", {
                credentials: "include"
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to load GitHub repositories");
            setAvailableRepos(data.repos ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load GitHub repositories");
        } finally {
            setReposLoading(false);
        }
    }, [connected]);

    useEffect(() => {
        void loadStatus();
        void loadConfiguredRepos();
    }, []);

    useEffect(() => {
        if (connected) {
            void loadAvailableRepos();
        } else {
            setAvailableRepos([]);
        }
    }, [connected, loadAvailableRepos]);

    const filteredRepos = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return availableRepos;
        return availableRepos.filter(
            (repo) =>
                repo.fullName.toLowerCase().includes(q) ||
                repo.name.toLowerCase().includes(q) ||
                repo.owner.toLowerCase().includes(q)
        );
    }, [availableRepos, query]);

    async function connectGitHub() {
        setConnecting(true);
        const callbackUrl = encodeURIComponent("/settings");
        window.location.href = `/admin/api/settings/github/connect?callbackUrl=${callbackUrl}`;
    }

    async function disconnectGitHub() {
        setDisconnecting(true);
        setError("");
        try {
            const response = await fetch("/admin/api/settings/github/disconnect", {
                method: "DELETE",
                credentials: "include"
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Failed to disconnect GitHub");
            await loadStatus();
            setAvailableRepos([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to disconnect GitHub");
        } finally {
            setDisconnecting(false);
        }
    }

    async function addRepository(repo: GitHubRepository) {
        setBusyRepoId(repo.id);
        setError("");
        try {
            const response = await fetch("/admin/api/settings/repos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    url: repo.url,
                    name: repo.name,
                    owner: repo.owner,
                    isPrivate: repo.isPrivate
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Failed to add repository");
            await Promise.all([loadConfiguredRepos(), loadAvailableRepos()]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add repository");
        } finally {
            setBusyRepoId(null);
        }
    }

    async function setDefaultRepo(repoId: string) {
        setBusyRepoId(repoId);
        setError("");
        try {
            const response = await fetch(`/admin/api/settings/repos/${repoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ isDefault: true })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Failed to set default repository");
            await loadConfiguredRepos();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to set default repository");
        } finally {
            setBusyRepoId(null);
        }
    }

    async function removeRepository(repoId: string) {
        setBusyRepoId(repoId);
        setError("");
        try {
            const response = await fetch(`/admin/api/settings/repos/${repoId}`, {
                method: "DELETE",
                credentials: "include"
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Failed to remove repository");
            await Promise.all([loadConfiguredRepos(), loadAvailableRepos()]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove repository");
        } finally {
            setBusyRepoId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Integrations</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Connect GitHub and manage coding pipeline repositories.
                </p>
            </div>

            {statusMessage && (
                <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600">
                    {statusMessage}
                </div>
            )}
            {error && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="bg-card border-border rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold">GitHub</p>
                        {loadingStatus ? (
                            <p className="text-muted-foreground text-sm">Checking connection...</p>
                        ) : connected && profile ? (
                            <div className="mt-1 flex items-center gap-2">
                                {profile.avatarUrl ? (
                                    <Image
                                        src={profile.avatarUrl}
                                        alt={`${profile.username} avatar`}
                                        className="h-6 w-6 rounded-full"
                                        width={24}
                                        height={24}
                                        unoptimized
                                    />
                                ) : null}
                                <p className="text-sm">
                                    Connected as{" "}
                                    <span className="font-medium">{profile.username}</span>
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">Not connected</p>
                        )}
                    </div>
                    {connected ? (
                        <button
                            onClick={disconnectGitHub}
                            disabled={disconnecting}
                            className="rounded-md bg-gray-500/10 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-500/20 disabled:opacity-50"
                        >
                            {disconnecting ? "Disconnecting..." : "Disconnect"}
                        </button>
                    ) : (
                        <button
                            onClick={connectGitHub}
                            disabled={connecting}
                            className="rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                        >
                            {connecting ? "Redirecting..." : "Connect GitHub"}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="bg-card border-border rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Available Repositories</h2>
                        <button
                            onClick={loadAvailableRepos}
                            disabled={!connected || reposLoading}
                            className="rounded-md bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                        >
                            {reposLoading ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                    {!connected ? (
                        <p className="text-muted-foreground text-sm">
                            Connect GitHub to browse repositories.
                        </p>
                    ) : (
                        <>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search repositories..."
                                className="border-input bg-background mb-3 w-full rounded-md border px-3 py-2 text-sm"
                            />
                            <div className="max-h-80 space-y-2 overflow-y-auto">
                                {filteredRepos.map((repo) => (
                                    <div
                                        key={repo.id}
                                        className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{repo.fullName}</p>
                                            <p className="text-muted-foreground text-xs">
                                                {repo.isPrivate ? "Private" : "Public"}
                                            </p>
                                        </div>
                                        {repo.configured ? (
                                            <span className="rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                                                Added
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => addRepository(repo)}
                                                disabled={busyRepoId === repo.id}
                                                className="rounded-md bg-purple-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                                            >
                                                {busyRepoId === repo.id ? "Adding..." : "Add"}
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {filteredRepos.length === 0 && (
                                    <p className="text-muted-foreground py-6 text-center text-sm">
                                        No repositories found.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-card border-border rounded-lg border p-4">
                    <h2 className="mb-3 text-sm font-semibold">Configured Pipeline Repositories</h2>
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                        {configuredRepos.map((repo) => (
                            <div
                                key={repo.id}
                                className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {repo.owner}/{repo.name}
                                    </p>
                                    <p className="text-muted-foreground truncate text-xs">
                                        {repo.url}
                                    </p>
                                </div>
                                <div className="ml-3 flex items-center gap-2">
                                    <label className="text-xs">
                                        <input
                                            type="radio"
                                            checked={repo.isDefault}
                                            onChange={() => setDefaultRepo(repo.id)}
                                            disabled={busyRepoId === repo.id}
                                            className="mr-1"
                                        />
                                        Default
                                    </label>
                                    <button
                                        onClick={() => removeRepository(repo.id)}
                                        disabled={busyRepoId === repo.id}
                                        className="rounded-md bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-500/20 disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                        {configuredRepos.length === 0 && (
                            <p className="text-muted-foreground py-6 text-center text-sm">
                                No configured repositories yet.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

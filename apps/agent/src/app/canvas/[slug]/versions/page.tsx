"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Button, Badge, Skeleton } from "@repo/ui";
import { ArrowLeftIcon, RotateCcwIcon, CheckIcon } from "lucide-react";
import Link from "next/link";

interface VersionEntry {
    id: string;
    version: number;
    changelog: string | null;
    createdAt: string;
    createdBy: string | null;
}

export default function CanvasVersionsPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [versions, setVersions] = useState<VersionEntry[]>([]);
    const [currentVersion, setCurrentVersion] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [rollingBack, setRollingBack] = useState<number | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [canvasRes, versionsRes] = await Promise.all([
                    fetch(`${getApiBase()}/api/canvases/${slug}`),
                    fetch(`${getApiBase()}/api/canvases/${slug}/versions`)
                ]);

                if (canvasRes.ok) {
                    const canvas = await canvasRes.json();
                    setCurrentVersion(canvas.version);
                }

                if (versionsRes.ok) {
                    const data = await versionsRes.json();
                    setVersions(data.versions || []);
                }
            } catch (err) {
                console.error("Failed to fetch versions:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [slug]);

    async function handleRollback(version: number) {
        if (!confirm(`Rollback to version ${version}? This will create a new version.`)) return;

        setRollingBack(version);
        try {
            const res = await fetch(`${getApiBase()}/api/canvases/${slug}/versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version })
            });
            if (res.ok) {
                const updated = await res.json();
                setCurrentVersion(updated.version);
                // Refetch versions
                const versionsRes = await fetch(`${getApiBase()}/api/canvases/${slug}/versions`);
                if (versionsRes.ok) {
                    const data = await versionsRes.json();
                    setVersions(data.versions || []);
                }
            }
        } catch (err) {
            console.error("Rollback failed:", err);
        } finally {
            setRollingBack(null);
        }
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-6">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <Link
                    href={`/canvas/${slug}`}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeftIcon className="size-4" />
                </Link>
                <div>
                    <h1 className="text-xl font-semibold">Version History</h1>
                    <p className="text-muted-foreground text-sm">
                        Canvas: <code className="bg-muted rounded px-1">{slug}</code> (current: v
                        {currentVersion})
                    </p>
                </div>
            </div>

            {/* Version list */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 rounded-lg" />
                    ))}
                </div>
            ) : versions.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">No versions found</p>
            ) : (
                <div className="space-y-3">
                    {versions.map((version) => {
                        const isCurrent = version.version === currentVersion;
                        return (
                            <div
                                key={version.id}
                                className={`rounded-lg border p-4 ${
                                    isCurrent ? "border-primary/40 bg-primary/5" : ""
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold">
                                            v{version.version}
                                        </span>
                                        {isCurrent && (
                                            <Badge className="bg-primary/10 text-primary text-xs">
                                                <CheckIcon className="mr-0.5 size-3" />
                                                Current
                                            </Badge>
                                        )}
                                    </div>
                                    {!isCurrent && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRollback(version.version)}
                                            disabled={rollingBack !== null}
                                        >
                                            <RotateCcwIcon className="mr-1 size-3" />
                                            {rollingBack === version.version
                                                ? "Rolling back..."
                                                : "Rollback"}
                                        </Button>
                                    )}
                                </div>
                                {version.changelog && (
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {version.changelog}
                                    </p>
                                )}
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {new Date(version.createdAt).toLocaleString()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

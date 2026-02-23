"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent } from "@repo/ui";
import { PackageIcon, TrashIcon, ExternalLinkIcon } from "lucide-react";

interface Installation {
    id: string;
    playbookId: string;
    versionInstalled: number;
    status: string;
    createdAgentIds: string[];
    createdSkillIds: string[];
    createdDocumentIds: string[];
    createdWorkflowIds: string[];
    createdNetworkIds: string[];
    createdAt: string;
    playbook: {
        slug: string;
        name: string;
        tagline: string | null;
        category: string;
        iconUrl: string | null;
        publisherOrg: { name: string; slug: string };
    };
}

export default function InstalledPlaybooksPage() {
    const router = useRouter();
    const [installations, setInstallations] = useState<Installation[]>([]);
    const [loading, setLoading] = useState(true);
    const [uninstalling, setUninstalling] = useState<string | null>(null);

    useEffect(() => {
        fetchInstallations();
    }, []);

    async function fetchInstallations() {
        try {
            const res = await fetch(`${getApiBase()}/api/playbooks/my/installed`);
            const data = await res.json();
            setInstallations(data.installations ?? []);
        } catch (error) {
            console.error("Failed to fetch installations:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleUninstall(installationId: string) {
        if (
            !confirm(
                "Are you sure you want to uninstall this playbook? All created entities will be deleted."
            )
        )
            return;

        setUninstalling(installationId);
        try {
            await fetch(`${getApiBase()}/api/playbooks/my/installed/${installationId}`, {
                method: "DELETE"
            });
            setInstallations((prev) => prev.filter((i) => i.id !== installationId));
        } catch (error) {
            console.error("Uninstall failed:", error);
        } finally {
            setUninstalling(null);
        }
    }

    const statusColor: Record<string, string> = {
        INSTALLING: "bg-blue-500/10 text-blue-400",
        CONFIGURING: "bg-yellow-500/10 text-yellow-400",
        TESTING: "bg-purple-500/10 text-purple-400",
        ACTIVE: "bg-green-500/10 text-green-400",
        PAUSED: "bg-zinc-500/10 text-zinc-400",
        FAILED: "bg-red-500/10 text-red-400"
    };

    return (
        <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Installed Playbooks</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage playbooks deployed to your workspace
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/marketplace")}>
                    Browse Marketplace
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-muted-foreground">Loading...</div>
                </div>
            ) : installations.length === 0 ? (
                <Card className="py-20 text-center">
                    <CardContent>
                        <PackageIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                        <h3 className="mb-2 text-lg font-medium">No installed playbooks</h3>
                        <p className="text-muted-foreground mb-4">
                            Browse the marketplace to find playbooks for your team.
                        </p>
                        <Button onClick={() => router.push("/marketplace")}>
                            Browse Marketplace
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {installations.map((inst) => (
                        <Card key={inst.id}>
                            <CardContent className="flex items-center justify-between py-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-medium">{inst.playbook.name}</h3>
                                        <Badge className={statusColor[inst.status] ?? ""}>
                                            {inst.status}
                                        </Badge>
                                    </div>
                                    {inst.playbook.tagline && (
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {inst.playbook.tagline}
                                        </p>
                                    )}
                                    <div className="text-muted-foreground mt-2 flex gap-3 text-xs">
                                        <span>by {inst.playbook.publisherOrg.name}</span>
                                        <span>v{inst.versionInstalled}</span>
                                        <span>
                                            {inst.createdAgentIds.length} agents ·{" "}
                                            {inst.createdSkillIds.length} skills ·{" "}
                                            {inst.createdDocumentIds.length} docs
                                        </span>
                                        <span>
                                            Installed{" "}
                                            {new Date(inst.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/marketplace/${inst.playbook.slug}`}>
                                        <Button variant="ghost" size="sm">
                                            <ExternalLinkIcon className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUninstall(inst.id)}
                                        disabled={uninstalling === inst.id}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

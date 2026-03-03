"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch
} from "@repo/ui";
import {
    ArrowLeftIcon,
    PackageIcon,
    StarIcon,
    DownloadIcon,
    SendIcon,
    AlertTriangleIcon
} from "lucide-react";

interface PlaybookDetail {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    longDescription: string | null;
    category: string;
    tags: string[];
    status: string;
    pricingModel: string;
    priceUsd: number | null;
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    requiredIntegrations: string[];
    version: number;
    components: Array<{
        id: string;
        componentType: string;
        sourceSlug: string;
        isEntryPoint: boolean;
    }>;
    versions: Array<{
        id: string;
        version: number;
        changelog: string | null;
        createdAt: string;
    }>;
}

type EntryPointType = "agent" | "workflow" | "network";

interface EntityOption {
    id: string;
    slug: string;
    name: string;
}

export default function PlaybookManagePage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = use(props.params);
    const router = useRouter();
    const [playbook, setPlaybook] = useState<PlaybookDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Package dialog state
    const [packageOpen, setPackageOpen] = useState(false);
    const [packageLoading, setPackageLoading] = useState(false);
    const [packageError, setPackageError] = useState<string | null>(null);
    const [packageWarnings, setPackageWarnings] = useState<string[]>([]);
    const [entryType, setEntryType] = useState<EntryPointType>("agent");
    const [entryId, setEntryId] = useState("");
    const [includeSkills, setIncludeSkills] = useState(true);
    const [includeDocuments, setIncludeDocuments] = useState(true);
    const [entities, setEntities] = useState<EntityOption[]>([]);
    const [entitiesLoading, setEntitiesLoading] = useState(false);

    useEffect(() => {
        async function fetchPlaybook() {
            try {
                const res = await fetch(`${getApiBase()}/api/playbooks/${slug}`);
                const data = await res.json();
                setPlaybook(data.playbook);
            } catch (error) {
                console.error("Failed to fetch playbook:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchPlaybook();
    }, [slug]);

    useEffect(() => {
        if (!packageOpen) return;
        setEntryId("");
        setEntitiesLoading(true);
        const endpoint =
            entryType === "agent"
                ? "/api/agents"
                : entryType === "workflow"
                  ? "/api/workflows"
                  : "/api/networks";

        fetch(`${getApiBase()}${endpoint}`)
            .then((res) => res.json())
            .then((data) => {
                const items =
                    entryType === "agent"
                        ? (data.agents ?? [])
                        : entryType === "workflow"
                          ? (data.workflows ?? [])
                          : (data.networks ?? []);
                setEntities(
                    items.map((item: { id: string; slug: string; name: string }) => ({
                        id: item.id,
                        slug: item.slug,
                        name: item.name
                    }))
                );
            })
            .catch(() => setEntities([]))
            .finally(() => setEntitiesLoading(false));
    }, [entryType, packageOpen]);

    async function handlePackage() {
        if (!entryId) return;
        setPackageLoading(true);
        setPackageError(null);
        setPackageWarnings([]);
        try {
            const body: Record<string, unknown> = {
                includeSkills,
                includeDocuments
            };
            if (entryType === "agent") body.entryAgentId = entryId;
            else if (entryType === "workflow") body.entryWorkflowId = entryId;
            else body.entryNetworkId = entryId;

            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}/package`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Packaging failed");
            }
            if (data.warnings?.length > 0) {
                setPackageWarnings(data.warnings);
            }
            // Refetch full playbook detail (API response lacks relations)
            const detailRes = await fetch(`${getApiBase()}/api/playbooks/${slug}`);
            if (detailRes.ok) {
                const detailData = await detailRes.json();
                setPlaybook(detailData.playbook);
            }
            if (!data.warnings?.length) {
                setPackageOpen(false);
            }
        } catch (err) {
            setPackageError(err instanceof Error ? err.message : "Packaging failed");
        } finally {
            setPackageLoading(false);
        }
    }

    async function handlePublish() {
        if (!playbook) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}/publish`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                setPlaybook(data.playbook);
            }
        } catch (error) {
            console.error("Publish failed:", error);
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!playbook) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Playbook not found</div>
            </div>
        );
    }

    const statusColor: Record<string, string> = {
        DRAFT: "bg-zinc-500/10 text-zinc-400",
        PENDING_REVIEW: "bg-yellow-500/10 text-yellow-400",
        PUBLISHED: "bg-green-500/10 text-green-400",
        SUSPENDED: "bg-red-500/10 text-red-400",
        ARCHIVED: "bg-zinc-500/10 text-zinc-500"
    };

    return (
        <div className="mx-auto max-w-4xl px-6 py-8">
            <button
                onClick={() => router.push("/playbooks")}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Playbooks
            </button>

            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{playbook.name}</h1>
                        <Badge className={statusColor[playbook.status] ?? ""}>
                            {playbook.status.replace("_", " ")}
                        </Badge>
                    </div>
                    {playbook.tagline && (
                        <p className="text-muted-foreground mt-1">{playbook.tagline}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    {playbook.status === "DRAFT" && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setPackageError(null);
                                setPackageWarnings([]);
                                setPackageOpen(true);
                            }}
                            disabled={actionLoading}
                        >
                            <PackageIcon className="mr-2 h-4 w-4" />
                            Package
                        </Button>
                    )}
                    {playbook.status === "DRAFT" &&
                        playbook.components.length > 0 &&
                        playbook.versions.length > 0 && (
                            <Button onClick={handlePublish} disabled={actionLoading}>
                                <SendIcon className="mr-2 h-4 w-4" />
                                Submit for Review
                            </Button>
                        )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{playbook.description}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Components ({playbook.components.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {playbook.components.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No components yet. Use the Package action to snapshot your agent
                                    system.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {playbook.components.map((comp) => (
                                        <div
                                            key={comp.id}
                                            className="flex items-center justify-between rounded-md border px-3 py-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <PackageIcon className="text-muted-foreground h-4 w-4" />
                                                <span className="text-sm font-medium">
                                                    {comp.sourceSlug}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {comp.componentType}
                                                </Badge>
                                            </div>
                                            {comp.isEntryPoint && (
                                                <Badge className="bg-blue-500/10 text-xs text-blue-400">
                                                    Entry Point
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {playbook.versions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Version History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {playbook.versions.map((v) => (
                                        <div key={v.id} className="border-b pb-3 last:border-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    v{v.version}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {new Date(v.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {v.changelog && (
                                                <p className="text-muted-foreground mt-1 text-sm">
                                                    {v.changelog}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <DownloadIcon className="h-3.5 w-3.5" /> Installs
                                </span>
                                <span className="font-medium">{playbook.installCount}</span>
                            </div>
                            {playbook.averageRating && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <StarIcon className="h-3.5 w-3.5" /> Rating
                                    </span>
                                    <span className="font-medium">
                                        {playbook.averageRating.toFixed(1)} ({playbook.reviewCount})
                                    </span>
                                </div>
                            )}
                            {playbook.trustScore && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Trust Score</span>
                                    <span className="font-medium">
                                        {Math.round(playbook.trustScore)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Version</span>
                                <span className="font-medium">v{playbook.version}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Pricing</span>
                                <span className="font-medium">
                                    {playbook.pricingModel === "FREE"
                                        ? "Free"
                                        : `$${playbook.priceUsd}`}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {playbook.requiredIntegrations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Required Integrations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1">
                                    {playbook.requiredIntegrations.map((int) => (
                                        <Badge key={int} variant="outline" className="text-xs">
                                            {int}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {playbook.tags.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Tags</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1">
                                    {playbook.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog open={packageOpen} onOpenChange={setPackageOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Package Playbook</DialogTitle>
                        <DialogDescription>
                            Select an entry point to snapshot your agent system into this playbook.
                            All dependencies (skills, documents, sub-agents) will be included
                            automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Entry Point Type</Label>
                            <div className="flex gap-2">
                                {(["agent", "workflow", "network"] as const).map((type) => (
                                    <Button
                                        key={type}
                                        variant={entryType === type ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setEntryType(type)}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                Select {entryType.charAt(0).toUpperCase() + entryType.slice(1)}
                            </Label>
                            {entitiesLoading ? (
                                <div className="text-muted-foreground text-sm">Loading...</div>
                            ) : entities.length === 0 ? (
                                <div className="text-muted-foreground text-sm">
                                    No {entryType}s found in your workspace.
                                </div>
                            ) : (
                                <Select value={entryId} onValueChange={(v) => setEntryId(v ?? "")}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Choose a ${entryType}...`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {entities.map((entity) => (
                                            <SelectItem key={entity.id} value={entity.id}>
                                                {entity.name}{" "}
                                                <span className="text-muted-foreground">
                                                    ({entity.slug})
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="include-skills">Include Skills</Label>
                                <Switch
                                    id="include-skills"
                                    checked={includeSkills}
                                    onCheckedChange={setIncludeSkills}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="include-documents">Include Documents</Label>
                                <Switch
                                    id="include-documents"
                                    checked={includeDocuments}
                                    onCheckedChange={setIncludeDocuments}
                                />
                            </div>
                        </div>

                        {packageError && (
                            <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                                {packageError}
                            </div>
                        )}

                        {packageWarnings.length > 0 && (
                            <div className="space-y-1 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-400">
                                <div className="flex items-center gap-1 font-medium">
                                    <AlertTriangleIcon className="h-4 w-4" />
                                    Packaging completed with warnings:
                                </div>
                                <ul className="list-inside list-disc space-y-0.5">
                                    {packageWarnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPackageOpen(false)}
                            disabled={packageLoading}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handlePackage} disabled={!entryId || packageLoading}>
                            {packageLoading ? "Packaging..." : "Package"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

"use client";

import { useState, useEffect, use, useCallback } from "react";
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
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea
} from "@repo/ui";
import {
    ArrowLeftIcon,
    PackageIcon,
    StarIcon,
    DownloadIcon,
    SendIcon,
    AlertTriangleIcon,
    PlusIcon,
    Trash2Icon,
    SaveIcon,
    FileTextIcon,
    ListIcon,
    SettingsIcon,
    BoxIcon,
    HistoryIcon
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
    monthlyPriceUsd: number | null;
    perUsePriceUsd: number | null;
    installCount: number;
    averageRating: number | null;
    reviewCount: number;
    trustScore: number | null;
    requiredIntegrations: string[];
    version: number;
    autoBootEnabled: boolean;
    bootDocument: string | null;
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
    bootTasks: BootTask[];
}

interface BootTask {
    id: string;
    title: string;
    description: string | null;
    priority: number;
    tags: string[];
    sortOrder: number;
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
    const [activeTab, setActiveTab] = useState("overview");

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
    const [changelog, setChangelog] = useState("");
    const [repackageMode, setRepackageMode] = useState<"full" | "components-only" | "boot-only">(
        "full"
    );

    const fetchPlaybook = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}`);
            const data = await res.json();
            setPlaybook(data.playbook);
        } catch (error) {
            console.error("Failed to fetch playbook:", error);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchPlaybook();
    }, [fetchPlaybook]);

    useEffect(() => {
        if (!packageOpen) return;
        if (repackageMode === "boot-only") {
            setEntities([]);
            return;
        }
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
    }, [entryType, packageOpen, repackageMode]);

    async function handlePackage() {
        if (repackageMode !== "boot-only" && !entryId) return;
        setPackageLoading(true);
        setPackageError(null);
        setPackageWarnings([]);
        try {
            const body: Record<string, unknown> = {
                includeSkills,
                includeDocuments,
                mode: repackageMode,
                changelog: changelog || undefined
            };
            if (repackageMode !== "boot-only") {
                if (entryType === "agent") body.entryAgentId = entryId;
                else if (entryType === "workflow") body.entryWorkflowId = entryId;
                else body.entryNetworkId = entryId;
            }

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
            await fetchPlaybook();
            if (!data.warnings?.length) {
                setPackageOpen(false);
                setChangelog("");
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
        <div className="mx-auto max-w-5xl px-6 py-8">
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

            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview" className="flex items-center gap-1.5">
                        <StarIcon className="h-3.5 w-3.5" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="details" className="flex items-center gap-1.5">
                        <SettingsIcon className="h-3.5 w-3.5" />
                        Details
                    </TabsTrigger>
                    <TabsTrigger value="boot" className="flex items-center gap-1.5">
                        <FileTextIcon className="h-3.5 w-3.5" />
                        Boot Config
                    </TabsTrigger>
                    <TabsTrigger value="components" className="flex items-center gap-1.5">
                        <BoxIcon className="h-3.5 w-3.5" />
                        Components
                    </TabsTrigger>
                    <TabsTrigger value="versions" className="flex items-center gap-1.5">
                        <HistoryIcon className="h-3.5 w-3.5" />
                        Versions
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <OverviewTab playbook={playbook} />
                </TabsContent>

                <TabsContent value="details">
                    <DetailsTab playbook={playbook} slug={slug} onUpdate={fetchPlaybook} />
                </TabsContent>

                <TabsContent value="boot">
                    <BootConfigTab playbook={playbook} slug={slug} onUpdate={fetchPlaybook} />
                </TabsContent>

                <TabsContent value="components">
                    <ComponentsTab playbook={playbook} />
                </TabsContent>

                <TabsContent value="versions">
                    <VersionsTab playbook={playbook} />
                </TabsContent>
            </Tabs>

            <Dialog open={packageOpen} onOpenChange={setPackageOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Package Playbook</DialogTitle>
                        <DialogDescription>
                            Snapshot your agent system into a new playbook version.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Repackage Mode</Label>
                            <div className="flex gap-2">
                                {(
                                    [
                                        { value: "full", label: "Full" },
                                        { value: "components-only", label: "Components Only" },
                                        { value: "boot-only", label: "Boot Only" }
                                    ] as const
                                ).map((mode) => (
                                    <Button
                                        key={mode.value}
                                        variant={
                                            repackageMode === mode.value ? "default" : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setRepackageMode(mode.value)}
                                    >
                                        {mode.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {repackageMode === "full" &&
                                    "Re-snapshot everything: components and boot configuration."}
                                {repackageMode === "components-only" &&
                                    "Re-snapshot agents/skills/docs but keep existing boot config."}
                                {repackageMode === "boot-only" &&
                                    "Keep components from previous version, only update boot config."}
                            </p>
                        </div>

                        {repackageMode !== "boot-only" && (
                            <>
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
                                        Select{" "}
                                        {entryType.charAt(0).toUpperCase() + entryType.slice(1)}
                                    </Label>
                                    {entitiesLoading ? (
                                        <div className="text-muted-foreground text-sm">
                                            Loading...
                                        </div>
                                    ) : entities.length === 0 ? (
                                        <div className="text-muted-foreground text-sm">
                                            No {entryType}s found in your workspace.
                                        </div>
                                    ) : (
                                        <Select
                                            value={entryId}
                                            onValueChange={(v) => setEntryId(v ?? "")}
                                        >
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={`Choose a ${entryType}...`}
                                                />
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
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Changelog</Label>
                            <Textarea
                                value={changelog}
                                onChange={(e) => setChangelog(e.target.value)}
                                placeholder="Describe what changed in this version..."
                                rows={3}
                            />
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
                        <Button
                            onClick={handlePackage}
                            disabled={(repackageMode !== "boot-only" && !entryId) || packageLoading}
                        >
                            {packageLoading ? "Packaging..." : "Package"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ playbook }: { playbook: PlaybookDetail }) {
    return (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{playbook.description}</p>
                    </CardContent>
                </Card>
                {playbook.longDescription && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Long Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">
                                {playbook.longDescription}
                            </p>
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
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Components</span>
                            <span className="font-medium">{playbook.components.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Boot Tasks</span>
                            <span className="font-medium">{playbook.bootTasks?.length ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Auto-Boot</span>
                            <Badge
                                variant="outline"
                                className={
                                    playbook.autoBootEnabled ? "text-green-400" : "text-zinc-500"
                                }
                            >
                                {playbook.autoBootEnabled ? "Enabled" : "Disabled"}
                            </Badge>
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
    );
}

// ─── Details Tab (Metadata Editor) ───────────────────────────────────────────

function DetailsTab({
    playbook,
    slug,
    onUpdate
}: {
    playbook: PlaybookDetail;
    slug: string;
    onUpdate: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: playbook.name,
        tagline: playbook.tagline ?? "",
        description: playbook.description,
        longDescription: playbook.longDescription ?? "",
        category: playbook.category,
        tags: playbook.tags.join(", "),
        pricingModel: playbook.pricingModel,
        priceUsd: playbook.priceUsd?.toString() ?? "",
        monthlyPriceUsd: playbook.monthlyPriceUsd?.toString() ?? "",
        perUsePriceUsd: playbook.perUsePriceUsd?.toString() ?? ""
    });

    async function handleSave() {
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                name: form.name,
                tagline: form.tagline || null,
                description: form.description,
                longDescription: form.longDescription || null,
                category: form.category,
                tags: form.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                pricingModel: form.pricingModel,
                priceUsd: form.priceUsd ? parseFloat(form.priceUsd) : null,
                monthlyPriceUsd: form.monthlyPriceUsd ? parseFloat(form.monthlyPriceUsd) : null,
                perUsePriceUsd: form.perUsePriceUsd ? parseFloat(form.perUsePriceUsd) : null
            };

            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                onUpdate();
            }
        } catch (error) {
            console.error("Save failed:", error);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mt-6 max-w-2xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Playbook Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Tagline</Label>
                        <Input
                            value={form.tagline}
                            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                            placeholder="Short tagline..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={4}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Long Description</Label>
                        <Textarea
                            value={form.longDescription}
                            onChange={(e) => setForm({ ...form, longDescription: e.target.value })}
                            rows={6}
                            placeholder="Detailed description for the marketplace listing..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Input
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tags (comma-separated)</Label>
                            <Input
                                value={form.tags}
                                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                                placeholder="sales, crm, onboarding"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Pricing Model</Label>
                        <Select
                            value={form.pricingModel}
                            onValueChange={(v) => setForm({ ...form, pricingModel: v ?? "FREE" })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FREE">Free</SelectItem>
                                <SelectItem value="ONE_TIME">One-Time</SelectItem>
                                <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                                <SelectItem value="PER_USE">Per Use</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {form.pricingModel !== "FREE" && (
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Price (USD)</Label>
                                <Input
                                    type="number"
                                    value={form.priceUsd}
                                    onChange={(e) => setForm({ ...form, priceUsd: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Monthly (USD)</Label>
                                <Input
                                    type="number"
                                    value={form.monthlyPriceUsd}
                                    onChange={(e) =>
                                        setForm({ ...form, monthlyPriceUsd: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Per Use (USD)</Label>
                                <Input
                                    type="number"
                                    value={form.perUsePriceUsd}
                                    onChange={(e) =>
                                        setForm({ ...form, perUsePriceUsd: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSave} disabled={saving}>
                            <SaveIcon className="mr-2 h-4 w-4" />
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Boot Config Tab ─────────────────────────────────────────────────────────

function BootConfigTab({
    playbook,
    slug,
    onUpdate
}: {
    playbook: PlaybookDetail;
    slug: string;
    onUpdate: () => void;
}) {
    const [bootDoc, setBootDoc] = useState(playbook.bootDocument ?? "");
    const [autoBoot, setAutoBoot] = useState(playbook.autoBootEnabled);
    const [saving, setSaving] = useState(false);

    // Boot tasks
    const [tasks, setTasks] = useState<BootTask[]>(playbook.bootTasks ?? []);
    const [addingTask, setAddingTask] = useState(false);
    const [newTask, setNewTask] = useState({ title: "", description: "", priority: 5, tags: "" });

    async function handleSaveBootDoc() {
        setSaving(true);
        try {
            await fetch(`${getApiBase()}/api/playbooks/${slug}/boot-document`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: bootDoc, autoBootEnabled: autoBoot })
            });
            onUpdate();
        } catch (error) {
            console.error("Save boot doc failed:", error);
        } finally {
            setSaving(false);
        }
    }

    async function handleAddTask() {
        try {
            const res = await fetch(`${getApiBase()}/api/playbooks/${slug}/boot-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTask.title,
                    description: newTask.description || null,
                    priority: newTask.priority,
                    tags: newTask.tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                })
            });
            if (res.ok) {
                const data = await res.json();
                setTasks([...tasks, data.task]);
                setNewTask({ title: "", description: "", priority: 5, tags: "" });
                setAddingTask(false);
                onUpdate();
            }
        } catch (error) {
            console.error("Add boot task failed:", error);
        }
    }

    async function handleDeleteTask(taskId: string) {
        try {
            await fetch(`${getApiBase()}/api/playbooks/${slug}/boot-tasks/${taskId}`, {
                method: "DELETE"
            });
            setTasks(tasks.filter((t) => t.id !== taskId));
            onUpdate();
        } catch (error) {
            console.error("Delete boot task failed:", error);
        }
    }

    return (
        <div className="mt-6 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Boot Document</CardTitle>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="auto-boot" className="text-sm">
                                    Auto-Boot
                                </Label>
                                <Switch
                                    id="auto-boot"
                                    checked={autoBoot}
                                    onCheckedChange={setAutoBoot}
                                />
                            </div>
                            <Button size="sm" onClick={handleSaveBootDoc} disabled={saving}>
                                <SaveIcon className="mr-2 h-3.5 w-3.5" />
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Markdown runbook that deployed agents read to self-configure. Embedded into
                        RAG on deploy.
                    </p>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={bootDoc}
                        onChange={(e) => setBootDoc(e.target.value)}
                        rows={16}
                        className="font-mono text-sm"
                        placeholder={`# Boot Runbook\n\n## Phase 1: Orientation\n- Read and understand your role\n- Review available tools and skills\n\n## Phase 2: Integration Assessment\n- Check connected integrations\n- Note missing capabilities\n\n## Phase 3: Initial Configuration\n- Set up default workflows\n- Configure preferences\n\n## Phase 4: Validation\n- Run self-diagnostic\n- Report boot status`}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <ListIcon className="h-4 w-4" />
                            Boot Tasks ({tasks.length})
                        </CardTitle>
                        <Button size="sm" variant="outline" onClick={() => setAddingTask(true)}>
                            <PlusIcon className="mr-2 h-3.5 w-3.5" />
                            Add Task
                        </Button>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Structural tasks created as BacklogTasks on the deployed agent.
                    </p>
                </CardHeader>
                <CardContent>
                    {addingTask && (
                        <div className="mb-4 space-y-3 rounded-md border p-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    value={newTask.title}
                                    onChange={(e) =>
                                        setNewTask({ ...newTask, title: e.target.value })
                                    }
                                    placeholder="e.g., Verify integration connections"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={newTask.description}
                                    onChange={(e) =>
                                        setNewTask({ ...newTask, description: e.target.value })
                                    }
                                    rows={2}
                                    placeholder="Detailed description..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Priority (0-10)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={10}
                                        value={newTask.priority}
                                        onChange={(e) =>
                                            setNewTask({
                                                ...newTask,
                                                priority: parseInt(e.target.value) || 5
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tags (comma-separated)</Label>
                                    <Input
                                        value={newTask.tags}
                                        onChange={(e) =>
                                            setNewTask({ ...newTask, tags: e.target.value })
                                        }
                                        placeholder="boot, setup"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAddingTask(false)}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleAddTask} disabled={!newTask.title}>
                                    Add Task
                                </Button>
                            </div>
                        </div>
                    )}

                    {tasks.length === 0 && !addingTask ? (
                        <p className="text-muted-foreground text-sm">
                            No boot tasks yet. Add structural tasks that should always run on
                            deploy.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-start justify-between rounded-md border px-4 py-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {task.title}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                                P{task.priority}
                                            </Badge>
                                        </div>
                                        {task.description && (
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {task.description}
                                            </p>
                                        )}
                                        {task.tags.length > 0 && (
                                            <div className="mt-1 flex gap-1">
                                                {task.tags.map((tag) => (
                                                    <Badge
                                                        key={tag}
                                                        variant="outline"
                                                        className="text-[10px]"
                                                    >
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-red-400"
                                        onClick={() => handleDeleteTask(task.id)}
                                    >
                                        <Trash2Icon className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Components Tab ──────────────────────────────────────────────────────────

function ComponentsTab({ playbook }: { playbook: PlaybookDetail }) {
    return (
        <div className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Components ({playbook.components.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {playbook.components.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No components yet. Use the Package action to snapshot your agent system.
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
        </div>
    );
}

// ─── Versions Tab ────────────────────────────────────────────────────────────

function VersionsTab({ playbook }: { playbook: PlaybookDetail }) {
    return (
        <div className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Version History</CardTitle>
                </CardHeader>
                <CardContent>
                    {playbook.versions.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No versions yet. Package the playbook to create the first version.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {playbook.versions.map((v) => (
                                <div key={v.id} className="border-b pb-3 last:border-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                v{v.version}
                                            </span>
                                            {v.version === playbook.version && (
                                                <Badge className="bg-green-500/10 text-xs text-green-400">
                                                    Current
                                                </Badge>
                                            )}
                                        </div>
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Textarea,
    Skeleton,
    Alert,
    AlertDescription,
    Badge,
    Switch,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

const FEATURE_PRESETS: Record<string, string[]> = {
    "chat-only": ["chat"],
    "chat-plus": ["chat", "settings"],
    workspace: ["chat", "agents", "knowledge", "observe", "settings"],
    builder: ["chat", "agents", "workflows", "networks", "knowledge", "observe", "settings"],
    full: [
        "chat",
        "agents",
        "workflows",
        "networks",
        "skills",
        "knowledge",
        "observe",
        "schedule",
        "integrations",
        "settings"
    ]
};

const ALL_FEATURES = [
    "chat",
    "agents",
    "workflows",
    "networks",
    "skills",
    "knowledge",
    "observe",
    "schedule",
    "integrations",
    "settings"
];

const MODE_LABELS: Record<string, string> = {
    "chat-widget": "Chat Widget (Mode 1)",
    agent: "Agent Workspace (Mode 2)",
    workspace: "Full Workspace (Mode 3)"
};

interface DeploymentData {
    id: string;
    label: string;
    mode: string;
    deploymentToken: string;
    features: string[];
    branding: {
        appName?: string;
        logoUrl?: string;
        primaryColor?: string;
        accentColor?: string;
        showPoweredBy?: boolean;
    } | null;
    embedConfig: {
        greeting?: string;
        suggestions?: string[];
        showToolActivity?: boolean;
    } | null;
    allowedDomains: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    partner: { id: string; name: string; slug: string };
    agent: { id: string; slug: string; name: string } | null;
}

interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

export default function DeploymentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const partnerId = params.id as string;
    const deploymentId = params.deploymentId as string;

    const [deployment, setDeployment] = useState<DeploymentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [saving, setSaving] = useState(false);
    const [agents, setAgents] = useState<AgentOption[]>([]);

    // Editable fields
    const [editLabel, setEditLabel] = useState("");
    const [editMode, setEditMode] = useState("chat-widget");
    const [editAgentId, setEditAgentId] = useState("");
    const [editActive, setEditActive] = useState(true);
    const [editFeatures, setEditFeatures] = useState<string[]>([]);
    const [editAppName, setEditAppName] = useState("");
    const [editLogoUrl, setEditLogoUrl] = useState("");
    const [editPrimaryColor, setEditPrimaryColor] = useState("");
    const [editAccentColor, setEditAccentColor] = useState("");
    const [editShowPoweredBy, setEditShowPoweredBy] = useState(true);
    const [editGreeting, setEditGreeting] = useState("");
    const [editSuggestions, setEditSuggestions] = useState("");
    const [editShowToolActivity, setEditShowToolActivity] = useState(true);
    const [editDomains, setEditDomains] = useState("");

    // Embed code
    const [embedCopied, setEmbedCopied] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);

    // Delete
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const loadDeployment = useCallback(async () => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/embed-partners/${partnerId}/deployments/${deploymentId}`
            );
            const data = await res.json();
            if (data.success) {
                const d = data.deployment as DeploymentData;
                setDeployment(d);
                setEditLabel(d.label);
                setEditMode(d.mode);
                setEditAgentId(d.agent?.id || "");
                setEditActive(d.isActive);
                setEditFeatures([...d.features]);
                setEditAppName(d.branding?.appName || "");
                setEditLogoUrl(d.branding?.logoUrl || "");
                setEditPrimaryColor(d.branding?.primaryColor || "");
                setEditAccentColor(d.branding?.accentColor || "");
                setEditShowPoweredBy(d.branding?.showPoweredBy ?? true);
                setEditGreeting(
                    ((d.embedConfig as Record<string, unknown>)?.greeting as string) || ""
                );
                const suggestions = (d.embedConfig as Record<string, unknown>)?.suggestions as
                    | string[]
                    | undefined;
                setEditSuggestions(suggestions ? suggestions.join("\n") : "");
                setEditShowToolActivity(
                    ((d.embedConfig as Record<string, unknown>)?.showToolActivity as boolean) ??
                        true
                );
                setEditDomains(d.allowedDomains.join("\n"));
            } else {
                setError(data.error || "Failed to load deployment");
            }
        } catch {
            setError("Failed to load deployment");
        }
    }, [partnerId, deploymentId]);

    useEffect(() => {
        fetch(`${getApiBase()}/api/agents`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success && data.agents) {
                    setAgents(
                        data.agents.map((a: { id: string; slug: string; name: string }) => ({
                            id: a.id,
                            slug: a.slug,
                            name: a.name
                        }))
                    );
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        loadDeployment().finally(() => setLoading(false));
    }, [loadDeployment]);

    function toggleFeature(feature: string) {
        setEditFeatures((prev) =>
            prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
        );
    }

    function applyPreset(preset: string) {
        const presetFeatures = FEATURE_PRESETS[preset];
        if (presetFeatures) setEditFeatures([...presetFeatures]);
    }

    async function handleSave() {
        setError("");
        setSuccess("");
        setSaving(true);
        try {
            const domains = editDomains
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean);

            const branding: Record<string, unknown> = {
                showPoweredBy: editShowPoweredBy
            };
            if (editAppName.trim()) branding.appName = editAppName.trim();
            if (editLogoUrl.trim()) branding.logoUrl = editLogoUrl.trim();
            if (editPrimaryColor.trim()) branding.primaryColor = editPrimaryColor.trim();
            if (editAccentColor.trim()) branding.accentColor = editAccentColor.trim();

            const embedConfig: Record<string, unknown> = {
                showToolActivity: editShowToolActivity
            };
            if (editGreeting.trim()) embedConfig.greeting = editGreeting.trim();
            const suggestionsArr = editSuggestions
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean);
            if (suggestionsArr.length > 0) embedConfig.suggestions = suggestionsArr;

            const res = await fetch(
                `${getApiBase()}/api/embed-partners/${partnerId}/deployments/${deploymentId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        label: editLabel.trim(),
                        mode: editMode,
                        agentId: editAgentId || null,
                        isActive: editActive,
                        features: editFeatures,
                        branding,
                        embedConfig,
                        allowedDomains: domains
                    })
                }
            );
            const data = await res.json();
            if (data.success) {
                setSuccess("Deployment updated successfully.");
                await loadDeployment();
            } else {
                setError(data.error || "Failed to update deployment");
            }
        } catch {
            setError("Failed to update deployment");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(
                `${getApiBase()}/api/embed-partners/${partnerId}/deployments/${deploymentId}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (data.success) {
                router.push(`/settings/embed-partners/${partnerId}`);
            } else {
                setError(data.error || "Failed to delete deployment");
            }
        } catch {
            setError("Failed to delete deployment");
        } finally {
            setDeleting(false);
        }
    }

    function getEmbedUrl(): string {
        if (!deployment) return "";
        const baseUrl =
            typeof window !== "undefined" ? window.location.origin : "https://agentc2.ai";
        return `${baseUrl}/embed/workspace?dt=${deployment.deploymentToken}&identity={SIGNED_IDENTITY_TOKEN}`;
    }

    function getIframeSnippet(): string {
        return `<iframe
  src="${getEmbedUrl()}"
  width="100%"
  height="700"
  style="border: none; border-radius: 12px;"
  allow="clipboard-write; microphone"
></iframe>`;
    }

    async function handleCopyEmbed() {
        await navigator.clipboard.writeText(getIframeSnippet());
        setEmbedCopied(true);
        setTimeout(() => setEmbedCopied(false), 2000);
    }

    async function handleCopyToken() {
        if (!deployment) return;
        await navigator.clipboard.writeText(deployment.deploymentToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!deployment) {
        return (
            <Alert variant="destructive">
                <AlertDescription>
                    Deployment not found.{" "}
                    <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => router.push(`/settings/embed-partners/${partnerId}`)}
                    >
                        Back to partner
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/settings/embed-partners/${partnerId}`)}
                >
                    ←
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{deployment.label}</h1>
                    <p className="text-muted-foreground text-sm">
                        {MODE_LABELS[deployment.mode] || deployment.mode} &middot;{" "}
                        {deployment.partner.name}
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert>
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Embed Code */}
            <Card className="border-primary/30">
                <CardHeader>
                    <CardTitle>Embed Code</CardTitle>
                    <CardDescription>
                        Use this code to embed AgentC2 in your partner&apos;s platform. Replace{" "}
                        <code className="text-xs">{"{SIGNED_IDENTITY_TOKEN}"}</code> with the
                        HMAC-signed identity token from the partner&apos;s backend.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Deployment Token</label>
                        <div className="flex items-center gap-2">
                            <code className="bg-muted flex-1 rounded px-3 py-2 text-xs break-all">
                                {deployment.deploymentToken}
                            </code>
                            <Button variant="outline" size="sm" onClick={handleCopyToken}>
                                {tokenCopied ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Embed URL</label>
                        <code className="bg-muted block rounded px-3 py-2 text-xs break-all">
                            {getEmbedUrl()}
                        </code>
                    </div>

                    <div>
                        <label className="text-sm font-medium">iframe Snippet</label>
                        <pre className="bg-muted overflow-x-auto rounded px-3 py-2 text-xs">
                            {getIframeSnippet()}
                        </pre>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={handleCopyEmbed}
                        >
                            {embedCopied ? "Copied!" : "Copy Embed Code"}
                        </Button>
                    </div>

                    <Alert>
                        <AlertDescription className="text-xs">
                            The partner must sign identity tokens using their signing secret
                            (HMAC-SHA256). The token format is:{" "}
                            <code>base64url(jsonPayload).hexSignature</code>. See the integration
                            docs for details.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            {/* Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Label</label>
                            <Input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Mode</label>
                            <Select value={editMode} onValueChange={(v) => v && setEditMode(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="chat-widget">Chat Widget</SelectItem>
                                    <SelectItem value="agent">Agent Workspace</SelectItem>
                                    <SelectItem value="workspace">Full Workspace</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Agent</label>
                        <Select value={editAgentId} onValueChange={(v) => v && setEditAgentId(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an agent..." />
                            </SelectTrigger>
                            <SelectContent>
                                {editMode === "workspace" && (
                                    <SelectItem value="none">No default (user selects)</SelectItem>
                                )}
                                {agents.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.name} ({a.slug})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-3">
                        <Switch checked={editActive} onCheckedChange={setEditActive} />
                        <label className="text-sm font-medium">
                            {editActive ? "Active" : "Inactive"}
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card>
                <CardHeader>
                    <CardTitle>Features</CardTitle>
                    <CardDescription>Toggle which sections are accessible.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(FEATURE_PRESETS).map((preset) => (
                            <Button
                                key={preset}
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreset(preset)}
                            >
                                {preset}
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {ALL_FEATURES.map((feature) => (
                            <Badge
                                key={feature}
                                variant={editFeatures.includes(feature) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => toggleFeature(feature)}
                            >
                                {feature}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Branding */}
            <Card>
                <CardHeader>
                    <CardTitle>Branding</CardTitle>
                    <CardDescription>Customize the white-labeled appearance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">App Name</label>
                            <Input
                                value={editAppName}
                                onChange={(e) => setEditAppName(e.target.value)}
                                placeholder="e.g. Appello AI"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Logo URL</label>
                            <Input
                                value={editLogoUrl}
                                onChange={(e) => setEditLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Primary Color</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editPrimaryColor}
                                    onChange={(e) => setEditPrimaryColor(e.target.value)}
                                    placeholder="#6366f1"
                                />
                                {editPrimaryColor && (
                                    <div
                                        className="h-8 w-8 shrink-0 rounded border"
                                        style={{
                                            backgroundColor: editPrimaryColor
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Accent Color</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editAccentColor}
                                    onChange={(e) => setEditAccentColor(e.target.value)}
                                    placeholder="#8b5cf6"
                                />
                                {editAccentColor && (
                                    <div
                                        className="h-8 w-8 shrink-0 rounded border"
                                        style={{
                                            backgroundColor: editAccentColor
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            checked={editShowPoweredBy}
                            onCheckedChange={setEditShowPoweredBy}
                        />
                        <label className="text-sm font-medium">
                            Show &quot;Powered by AgentC2&quot; badge
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Embed Config */}
            <Card>
                <CardHeader>
                    <CardTitle>Embed Config</CardTitle>
                    <CardDescription>Customize the embedded chat experience.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Greeting Message</label>
                        <Textarea
                            value={editGreeting}
                            onChange={(e) => setEditGreeting(e.target.value)}
                            placeholder="Welcome! How can I help you today?"
                            rows={2}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Suggestions</label>
                        <Textarea
                            value={editSuggestions}
                            onChange={(e) => setEditSuggestions(e.target.value)}
                            placeholder={"What can you do?\nHelp me get started"}
                            rows={3}
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            One suggestion per line. Shown as quick-action buttons.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            checked={editShowToolActivity}
                            onCheckedChange={setEditShowToolActivity}
                        />
                        <label className="text-sm font-medium">Show tool activity in chat</label>
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                </CardHeader>
                <CardContent>
                    <div>
                        <label className="text-sm font-medium">Allowed Domains</label>
                        <Textarea
                            value={editDomains}
                            onChange={(e) => setEditDomains(e.target.value)}
                            placeholder={"app.example.com\nlocalhost"}
                            rows={3}
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            One domain per line. Leave empty to allow all.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>
                        Deleting this deployment will break any embeds using its token.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {showDeleteConfirm ? (
                        <div className="space-y-3">
                            <p className="text-sm">Are you sure? This cannot be undone.</p>
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? "Deleting..." : "Yes, Delete Deployment"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                            Delete Deployment
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
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

interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

export default function NewDeploymentPage() {
    const params = useParams();
    const router = useRouter();
    const partnerId = params.id as string;

    const [label, setLabel] = useState("");
    const [mode, setMode] = useState("chat-widget");
    const [agentId, setAgentId] = useState<string>("");
    const [features, setFeatures] = useState<string[]>(["chat"]);
    const [appName, setAppName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [primaryColor, setPrimaryColor] = useState("");
    const [accentColor, setAccentColor] = useState("");
    const [showPoweredBy, setShowPoweredBy] = useState(true);
    const [allowedDomains, setAllowedDomains] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [agents, setAgents] = useState<AgentOption[]>([]);

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

    function toggleFeature(feature: string) {
        setFeatures((prev) =>
            prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
        );
    }

    function applyPreset(preset: string) {
        const presetFeatures = FEATURE_PRESETS[preset];
        if (presetFeatures) setFeatures([...presetFeatures]);
    }

    async function handleSave() {
        setError("");

        if (!label.trim()) {
            setError("Label is required.");
            return;
        }

        if ((mode === "chat-widget" || mode === "agent") && !agentId) {
            setError("An agent must be selected for Chat Widget and Agent Workspace modes.");
            return;
        }

        setSaving(true);
        try {
            const domains = allowedDomains
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean);

            const branding: Record<string, unknown> = { showPoweredBy };
            if (appName.trim()) branding.appName = appName.trim();
            if (logoUrl.trim()) branding.logoUrl = logoUrl.trim();
            if (primaryColor.trim()) branding.primaryColor = primaryColor.trim();
            if (accentColor.trim()) branding.accentColor = accentColor.trim();

            const res = await fetch(`${getApiBase()}/api/embed-partners/${partnerId}/deployments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: label.trim(),
                    mode,
                    agentId: agentId || null,
                    features,
                    branding,
                    allowedDomains: domains
                })
            });
            const data = await res.json();

            if (data.success) {
                router.push(
                    `/settings/embed-partners/${partnerId}/deployments/${data.deployment.id}`
                );
            } else {
                setError(data.error || "Failed to create deployment");
            }
        } catch {
            setError("Failed to create deployment");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/settings/embed-partners/${partnerId}`)}
                >
                    ←
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">New Deployment</h1>
                    <p className="text-muted-foreground text-sm">
                        Configure a new embed deployment for this partner.
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Basic Config */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Set the deployment mode and target agent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Label</label>
                        <Input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="e.g. Production Chat, Staging Workspace"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Mode</label>
                        <Select value={mode} onValueChange={(v) => v && setMode(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="chat-widget">Chat Widget (Mode 1)</SelectItem>
                                <SelectItem value="agent">Agent Workspace (Mode 2)</SelectItem>
                                <SelectItem value="workspace">Full Workspace (Mode 3)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground mt-1 text-xs">
                            {mode === "chat-widget" &&
                                "Minimal chat bubble. Single agent, no sidebar."}
                            {mode === "agent" &&
                                "Single-agent workspace with conversation history and rich UI."}
                            {mode === "workspace" &&
                                "Full workspace with multiple agents, navigation, and settings."}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Agent</label>
                        <Select value={agentId} onValueChange={(v) => v && setAgentId(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an agent..." />
                            </SelectTrigger>
                            <SelectContent>
                                {mode === "workspace" && (
                                    <SelectItem value="none">No default (user selects)</SelectItem>
                                )}
                                {agents.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.name} ({a.slug})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {(mode === "chat-widget" || mode === "agent") && (
                            <p className="text-muted-foreground mt-1 text-xs">
                                Required for this mode.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card>
                <CardHeader>
                    <CardTitle>Features</CardTitle>
                    <CardDescription>
                        Control which sections are accessible in the embedded workspace.
                    </CardDescription>
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
                                variant={features.includes(feature) ? "default" : "outline"}
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
                    <CardDescription>White-label the embedded experience.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">App Name</label>
                            <Input
                                value={appName}
                                onChange={(e) => setAppName(e.target.value)}
                                placeholder="e.g. Appello AI"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Logo URL</label>
                            <Input
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Primary Color</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    placeholder="#6366f1"
                                />
                                {primaryColor && (
                                    <div
                                        className="h-8 w-8 shrink-0 rounded border"
                                        style={{
                                            backgroundColor: primaryColor
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Accent Color</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={accentColor}
                                    onChange={(e) => setAccentColor(e.target.value)}
                                    placeholder="#8b5cf6"
                                />
                                {accentColor && (
                                    <div
                                        className="h-8 w-8 shrink-0 rounded border"
                                        style={{
                                            backgroundColor: accentColor
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch checked={showPoweredBy} onCheckedChange={setShowPoweredBy} />
                        <label className="text-sm font-medium">
                            Show &quot;Powered by AgentC2&quot; badge
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Restrict which domains can host this embed.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div>
                        <label className="text-sm font-medium">Allowed Domains</label>
                        <Textarea
                            value={allowedDomains}
                            onChange={(e) => setAllowedDomains(e.target.value)}
                            placeholder={"app.example.com\nlocalhost"}
                            rows={3}
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            One domain per line. Leave empty to allow all domains.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => router.push(`/settings/embed-partners/${partnerId}`)}
                >
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Creating..." : "Create Deployment"}
                </Button>
            </div>
        </div>
    );
}

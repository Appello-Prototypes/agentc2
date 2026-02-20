"use client";

import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Button,
    Skeleton,
    Alert,
    AlertDescription,
    Textarea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { COMMON_TIMEZONES } from "@/lib/timezone";

interface Organization {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    timezone: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

interface AgentOption {
    slug: string;
    name: string;
    type: string;
}

interface Membership {
    role: string;
}

export default function OrganizationSettingsPage() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [membership, setMembership] = useState<Membership | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [timezone, setTimezone] = useState("America/New_York");

    // Integrations state
    const [slackDefaultAgent, setSlackDefaultAgent] = useState("assistant");
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [savingSlack, setSavingSlack] = useState(false);

    // Slack connection state
    const [slackConnection, setSlackConnection] = useState<{
        connected: boolean;
        teamId?: string;
        teamName?: string;
        connectionId?: string;
    } | null>(null);
    const [slackChannels, setSlackChannels] = useState<
        Array<{ id: string; name: string; isPrivate: boolean; isMember?: boolean }>
    >([]);
    const [channelPrefs, setChannelPrefs] = useState<
        Array<{ id: string; purposeKey: string; channelId: string; channelName: string | null }>
    >([]);
    const [savingChannels, setSavingChannels] = useState(false);

    useEffect(() => {
        fetchOrganization();
        fetchAgents();
        fetchSlackStatus();
    }, []);

    async function fetchOrganization() {
        try {
            const res = await fetch(`${getApiBase()}/api/user/organization`);
            const data = await res.json();
            if (data.success) {
                setOrganization(data.organization);
                setMembership(data.membership);
                setName(data.organization.name || "");
                setSlug(data.organization.slug || "");
                setDescription(data.organization.description || "");
                setLogoUrl(data.organization.logoUrl || "");
                setTimezone(data.organization.timezone || "America/New_York");
                const meta = data.organization.metadata as Record<string, unknown> | null;
                if (meta?.slackDefaultAgentSlug && typeof meta.slackDefaultAgentSlug === "string") {
                    setSlackDefaultAgent(meta.slackDefaultAgentSlug);
                }
            }
        } catch (err) {
            console.error("Failed to fetch organization:", err);
            setError("Failed to load organization");
        } finally {
            setLoading(false);
        }
    }

    async function fetchAgents() {
        try {
            const res = await fetch(`${getApiBase()}/api/agents`);
            const data = await res.json();
            if (data.success && data.agents) {
                setAgents(
                    data.agents
                        .filter((a: AgentOption) => a.type !== "DEMO")
                        .map((a: AgentOption) => ({ slug: a.slug, name: a.name, type: a.type }))
                );
            }
        } catch (err) {
            console.error("Failed to fetch agents:", err);
        }
    }

    async function fetchSlackStatus() {
        try {
            // Fetch channel preferences (also tells us if connection exists)
            const prefRes = await fetch(`${getApiBase()}/api/slack/channels`);
            if (prefRes.ok) {
                const prefData = await prefRes.json();
                setSlackConnection({
                    connected: true,
                    connectionId: prefData.connectionId
                });
                setChannelPrefs(prefData.preferences || []);

                // Fetch available channels
                try {
                    const availRes = await fetch(`${getApiBase()}/api/slack/channels?available`);
                    if (availRes.ok) {
                        const availData = await availRes.json();
                        setSlackChannels(availData.channels || []);
                    } else {
                        console.error(
                            "[SlackChannels] Failed to load available channels:",
                            availRes.status
                        );
                    }
                } catch (availErr) {
                    console.error("[SlackChannels] Error fetching available channels:", availErr);
                }
            } else {
                setSlackConnection({ connected: false });
            }
        } catch {
            setSlackConnection({ connected: false });
        }
    }

    async function handleSlackInstall() {
        window.location.href = `${getApiBase()}/api/slack/install`;
    }

    async function handleSaveChannelPref(purposeKey: string, channelId: string) {
        setSavingChannels(true);
        try {
            const channel = slackChannels.find((c) => c.id === channelId);
            await fetch(`${getApiBase()}/api/slack/channels`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    purposeKey,
                    channelId,
                    channelName: channel?.name || null
                })
            });
            await fetchSlackStatus();
            setSuccess(`Channel preference "${purposeKey}" updated`);
        } catch {
            setError("Failed to save channel preference");
        } finally {
            setSavingChannels(false);
        }
    }

    const handleSaveSlack = async () => {
        setSavingSlack(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${organization?.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    metadata: { slackDefaultAgentSlug: slackDefaultAgent }
                })
            });

            const data = await res.json();
            if (data.success) {
                setOrganization(data.organization);
                setSuccess("Slack configuration updated successfully");
            } else {
                setError(data.error || "Failed to update Slack configuration");
            }
        } catch (err) {
            console.error("Failed to update Slack configuration:", err);
            setError("Failed to update Slack configuration");
        } finally {
            setSavingSlack(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${organization?.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    description: description.trim() || null,
                    logoUrl: logoUrl.trim() || null,
                    timezone
                })
            });

            const data = await res.json();
            if (data.success) {
                setOrganization(data.organization);
                setSuccess("Organization updated successfully");
            } else {
                setError(data.error || "Failed to update organization");
            }
        } catch (err) {
            console.error("Failed to update organization:", err);
            setError("Failed to update organization");
        } finally {
            setSaving(false);
        }
    };

    const canEdit = membership?.role === "owner" || membership?.role === "admin";
    const isOwner = membership?.role === "owner";

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="mb-2 h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Organization</h1>
                    <p className="text-muted-foreground">Manage your organization settings</p>
                </div>
                <Alert variant="destructive">
                    <AlertDescription>
                        No organization found. Please contact support.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Organization</h1>
                <p className="text-muted-foreground">
                    Manage your organization settings and branding
                </p>
            </div>

            {/* Alerts */}
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

            {/* Organization Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Organization Details</CardTitle>
                    <CardDescription>Basic information about your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Organization ID */}
                    <div>
                        <label className="text-sm font-medium">Organization ID</label>
                        <Input
                            value={organization.id}
                            disabled
                            className="bg-muted mt-1 font-mono text-sm"
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium">Organization Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your organization name"
                            disabled={!canEdit}
                            className="mt-1"
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <label className="text-sm font-medium">Slug</label>
                        <Input
                            value={slug}
                            onChange={(e) =>
                                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                            }
                            placeholder="organization-slug"
                            disabled={!canEdit}
                            className="mt-1"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            URL-friendly identifier for your organization
                        </p>
                    </div>

                    {/* Logo URL */}
                    <div>
                        <label className="text-sm font-medium">Logo URL</label>
                        <Input
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            disabled={!canEdit}
                            className="mt-1"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="A brief description of your organization"
                            disabled={!canEdit}
                            className="mt-1"
                            rows={3}
                        />
                    </div>

                    {/* Timezone */}
                    <div>
                        <label className="text-sm font-medium">Timezone</label>
                        <p className="text-muted-foreground mb-2 text-xs">
                            Default timezone for all members. Individual users can override this
                            in their profile settings.
                        </p>
                        <Select
                            value={timezone}
                            onValueChange={(v: string | null) => {
                                if (v) setTimezone(v);
                            }}
                            disabled={!canEdit}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select timezone">
                                    {COMMON_TIMEZONES.find((tz) => tz.value === timezone)
                                        ?.label || timezone}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {COMMON_TIMEZONES.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Created Date */}
                    <div>
                        <label className="text-sm font-medium">Created</label>
                        <Input
                            value={formatDate(organization.createdAt)}
                            disabled
                            className="bg-muted mt-1"
                        />
                    </div>

                    {/* Save Button */}
                    {canEdit && (
                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Slack Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Slack Integration</CardTitle>
                    <CardDescription>
                        Connect your Slack workspace and configure agent routing
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Connection Status */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Connection Status</label>
                        {slackConnection?.connected ? (
                            <div className="bg-muted/50 flex items-center gap-2 rounded-md border p-3">
                                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-sm">Connected</span>
                                {slackConnection.teamId && (
                                    <span className="text-muted-foreground text-xs">
                                        ({slackConnection.teamId})
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="bg-muted/50 flex items-center gap-2 rounded-md border p-3">
                                    <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                                    <span className="text-sm">Not Connected</span>
                                </div>
                                {canEdit && (
                                    <Button
                                        onClick={handleSlackInstall}
                                        variant="outline"
                                        size="sm"
                                    >
                                        Install to Slack
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Default Agent */}
                    <div>
                        <label className="text-sm font-medium">Default Slack Agent</label>
                        <p className="text-muted-foreground mb-2 text-xs">
                            Messages sent to the bot without an{" "}
                            <code className="bg-muted rounded px-1">agent:slug</code> prefix will be
                            routed to this agent.
                        </p>
                        <Select
                            value={slackDefaultAgent}
                            onValueChange={(v: string | null) => {
                                if (v) setSlackDefaultAgent(v);
                            }}
                            disabled={!canEdit}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select an agent">
                                    {agents.find((a) => a.slug === slackDefaultAgent)?.name ||
                                        slackDefaultAgent}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {agents.map((agent) => (
                                    <SelectItem key={agent.slug} value={agent.slug}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {canEdit && (
                        <div className="flex justify-end">
                            <Button onClick={handleSaveSlack} disabled={savingSlack}>
                                {savingSlack ? "Saving..." : "Save Slack Settings"}
                            </Button>
                        </div>
                    )}

                    {/* Channel Preferences */}
                    {slackConnection?.connected && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Channel Preferences</label>
                            <p className="text-muted-foreground text-xs">
                                Map purpose keys to Slack channels so agents post to the right
                                place.
                            </p>
                            {slackChannels.length === 0 && (
                                <p className="text-muted-foreground text-xs italic">
                                    No Slack channels found. Make sure the bot has access to
                                    channels in your workspace.
                                </p>
                            )}
                            {["support", "sales", "alerts", "general"].map((purposeKey) => {
                                const pref = channelPrefs.find((p) => p.purposeKey === purposeKey);
                                const currentChannelId = pref?.channelId ?? undefined;
                                return (
                                    <div key={purposeKey} className="flex items-center gap-3">
                                        <span className="w-20 text-sm capitalize">
                                            {purposeKey}
                                        </span>
                                        <Select
                                            value={currentChannelId}
                                            onValueChange={(v: string | null) => {
                                                if (v) handleSaveChannelPref(purposeKey, v);
                                            }}
                                            disabled={
                                                !canEdit ||
                                                savingChannels ||
                                                slackChannels.length === 0
                                            }
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Not configured">
                                                    {pref?.channelName
                                                        ? `#${pref.channelName.replace(/^#/, "")}`
                                                        : pref?.channelId
                                                          ? `#${pref.channelId}`
                                                          : "Not configured"}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {slackChannels
                                                    .slice()
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((ch) => (
                                                        <SelectItem key={ch.id} value={ch.id}>
                                                            #{ch.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone - Owner Only */}
            {isOwner && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Irreversible and destructive actions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Transfer Ownership</p>
                                <p className="text-muted-foreground text-sm">
                                    Transfer organization ownership to another member
                                </p>
                            </div>
                            <Button variant="outline" disabled>
                                Transfer
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Delete Organization</p>
                                <p className="text-muted-foreground text-sm">
                                    Permanently delete this organization and all its data
                                </p>
                            </div>
                            <Button variant="destructive" disabled>
                                Delete Organization
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

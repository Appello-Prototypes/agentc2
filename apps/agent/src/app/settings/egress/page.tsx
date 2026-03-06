"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Label,
    Skeleton,
    Switch,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Alert,
    AlertDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

type EgressMode = "allowlist" | "denylist";

interface EgressPolicy {
    id: string;
    mode: EgressMode;
    domains: string[];
    enabled: boolean;
}

export default function EgressPolicyPage() {
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [policy, setPolicy] = useState<EgressPolicy | null>(null);
    const [enabled, setEnabled] = useState(true);
    const [mode, setMode] = useState<EgressMode>("allowlist");
    const [domains, setDomains] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState("");
    const [hasChanges, setHasChanges] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const syncFromPolicy = useCallback((p: EgressPolicy | null) => {
        if (!p) {
            setEnabled(true);
            setMode("allowlist");
            setDomains([]);
        } else {
            setEnabled(p.enabled);
            setMode(p.mode);
            setDomains(p.domains ?? []);
        }
        setHasChanges(false);
    }, []);

    useEffect(() => {
        fetch(getApiBase() + "/api/user/organization")
            .then((r) => r.json())
            .then((data) => {
                if (data.success && data.organization?.id) {
                    setOrganizationId(data.organization.id);
                } else {
                    setLoading(false);
                }
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!organizationId) return;
        fetch(getApiBase() + `/api/organizations/${organizationId}/egress-policy`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    setPolicy(data.policy);
                    syncFromPolicy(data.policy);
                }
            })
            .catch(() => setError("Failed to load egress policy"))
            .finally(() => setLoading(false));
    }, [organizationId, syncFromPolicy]);

    useEffect(() => {
        if (!policy) return;
        const changed =
            enabled !== policy.enabled ||
            mode !== policy.mode ||
            JSON.stringify([...domains].sort()) !== JSON.stringify([...policy.domains].sort());
        setHasChanges(changed);
    }, [enabled, mode, domains, policy]);

    const handleAddDomain = () => {
        const trimmed = newDomain.trim();
        if (!trimmed || domains.includes(trimmed)) return;
        setDomains((prev) => [...prev, trimmed]);
        setNewDomain("");
    };

    const handleRemoveDomain = (domain: string) => {
        setDomains((prev) => prev.filter((d) => d !== domain));
    };

    const handleSave = async () => {
        if (!organizationId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(
                getApiBase() + `/api/organizations/${organizationId}/egress-policy`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode, domains, enabled })
                }
            );
            const data = await res.json();
            if (data.success) {
                setPolicy(data.policy);
                syncFromPolicy(data.policy);
                setSuccess("Policy saved");
            } else {
                setError(data.error || "Failed to save policy");
            }
        } catch {
            setError("Failed to save policy");
        } finally {
            setSaving(false);
        }
    };

    const handleCreatePolicy = async () => {
        if (!organizationId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(
                getApiBase() + `/api/organizations/${organizationId}/egress-policy`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "allowlist", domains: [], enabled: true })
                }
            );
            const data = await res.json();
            if (data.success) {
                setPolicy(data.policy);
                syncFromPolicy(data.policy);
                setSuccess("Policy created");
            } else {
                setError(data.error || "Failed to create policy");
            }
        } catch {
            setError("Failed to create policy");
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePolicy = async () => {
        if (!organizationId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(
                getApiBase() + `/api/organizations/${organizationId}/egress-policy`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (data.success) {
                setPolicy(null);
                syncFromPolicy(null);
                setSuccess("Policy deleted");
            } else {
                setError(data.error || "Failed to delete policy");
            }
        } catch {
            setError("Failed to delete policy");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="mb-2 h-8 w-48" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!organizationId) {
        return (
            <Alert variant="destructive">
                <AlertDescription>Could not load organization</AlertDescription>
            </Alert>
        );
    }

    if (policy === null && !hasChanges) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Network Egress Policy</h1>
                    <p className="text-muted-foreground">
                        Control which external domains agents can make outbound requests to
                    </p>
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
                <Card>
                    <CardHeader>
                        <CardTitle>Create Policy</CardTitle>
                        <CardDescription>
                            No egress policy exists. Create one to restrict which domains agents can
                            access.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleCreatePolicy} disabled={saving}>
                            {saving ? "Creating..." : "Create Policy"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Network Egress Policy</h1>
                <p className="text-muted-foreground">
                    Control which external domains agents can make outbound requests to
                </p>
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

            <Card>
                <CardHeader>
                    <CardTitle>Policy Settings</CardTitle>
                    <CardDescription>
                        Configure allowlist or denylist mode and manage allowed/blocked domains
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="enabled">Enabled</Label>
                            <p className="text-muted-foreground text-sm">
                                When disabled, no egress restrictions apply
                            </p>
                        </div>
                        <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="mode">Mode</Label>
                        <Select value={mode} onValueChange={(v) => setMode(v as EgressMode)}>
                            <SelectTrigger id="mode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="allowlist">
                                    Allowlist (block all except listed)
                                </SelectItem>
                                <SelectItem value="denylist">
                                    Denylist (allow all except listed)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Domains</Label>
                        <p className="text-muted-foreground text-sm">
                            Use wildcards like{" "}
                            <code className="bg-muted rounded px-1">*.example.com</code>
                        </p>
                        <div className="flex gap-2">
                            <Input
                                placeholder="example.com or *.example.com"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && (e.preventDefault(), handleAddDomain())
                                }
                            />
                            <Button variant="outline" onClick={handleAddDomain}>
                                Add
                            </Button>
                        </div>
                        {domains.length > 0 && (
                            <ul className="mt-2 space-y-2">
                                {domains.map((domain) => (
                                    <li
                                        key={domain}
                                        className="flex items-center justify-between rounded-md border px-3 py-2"
                                    >
                                        <span className="font-mono text-sm">{domain}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveDomain(domain)}
                                        >
                                            Remove
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={handleSave} disabled={saving || !hasChanges}>
                            {saving ? "Saving..." : "Save"}
                        </Button>
                        {hasChanges && <Badge variant="secondary">Unsaved changes</Badge>}
                        <Button
                            variant="destructive"
                            onClick={handleDeletePolicy}
                            disabled={saving}
                            className="ml-auto"
                        >
                            Delete Policy
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

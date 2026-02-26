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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Partner {
    id: string;
    name: string;
    slug: string;
    signingSecret: string;
    isActive: boolean;
    allowedDomains: string[];
    tokenMaxAgeSec: number;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    _count: { deployments: number; users: number };
}

interface Deployment {
    id: string;
    label: string;
    mode: string;
    deploymentToken: string;
    features: string[];
    isActive: boolean;
    createdAt: string;
    agent: { id: string; slug: string; name: string } | null;
}

interface PartnerUser {
    id: string;
    externalUserId: string;
    email: string | null;
    name: string | null;
    linkedUser: { id: string; email: string; name: string } | null;
    lastSeenAt: string | null;
    createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
    "chat-widget": "Chat Widget",
    agent: "Agent Workspace",
    workspace: "Full Workspace"
};

export default function EmbedPartnerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const partnerId = params.id as string;

    const [partner, setPartner] = useState<Partner | null>(null);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [users, setUsers] = useState<PartnerUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Editable fields
    const [editName, setEditName] = useState("");
    const [editDomains, setEditDomains] = useState("");
    const [editMaxAge, setEditMaxAge] = useState(3600);
    const [editActive, setEditActive] = useState(true);
    const [saving, setSaving] = useState(false);

    // Secret management
    const [secretCopied, setSecretCopied] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
    const [newSecret, setNewSecret] = useState("");

    // Delete
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // User search
    const [userSearch, setUserSearch] = useState("");

    const loadPartner = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/embed-partners/${partnerId}`);
            const data = await res.json();
            if (data.success) {
                setPartner(data.partner);
                setEditName(data.partner.name);
                setEditDomains(data.partner.allowedDomains.join("\n"));
                setEditMaxAge(data.partner.tokenMaxAgeSec);
                setEditActive(data.partner.isActive);
            } else {
                setError(data.error || "Failed to load partner");
            }
        } catch {
            setError("Failed to load partner");
        }
    }, [partnerId]);

    const loadDeployments = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/embed-partners/${partnerId}/deployments`);
            const data = await res.json();
            if (data.success) setDeployments(data.deployments);
        } catch {
            /* non-critical */
        }
    }, [partnerId]);

    const loadUsers = useCallback(async () => {
        const qs = userSearch ? `?search=${encodeURIComponent(userSearch)}` : "";
        try {
            const res = await fetch(`${getApiBase()}/api/embed-partners/${partnerId}/users${qs}`);
            const data = await res.json();
            if (data.success) setUsers(data.users);
        } catch {
            /* non-critical */
        }
    }, [partnerId, userSearch]);

    useEffect(() => {
        Promise.all([loadPartner(), loadDeployments(), loadUsers()]).finally(() =>
            setLoading(false)
        );
    }, [loadPartner, loadDeployments, loadUsers]);

    async function handleSave() {
        setError("");
        setSuccess("");
        setSaving(true);
        try {
            const domains = editDomains
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean);

            const res = await fetch(`${getApiBase()}/api/embed-partners/${partnerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    allowedDomains: domains,
                    tokenMaxAgeSec: editMaxAge,
                    isActive: editActive
                })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess("Partner updated successfully.");
                await loadPartner();
            } else {
                setError(data.error || "Failed to update partner");
            }
        } catch {
            setError("Failed to update partner");
        } finally {
            setSaving(false);
        }
    }

    async function handleCopySecret() {
        if (!partner) return;
        await navigator.clipboard.writeText(partner.signingSecret);
        setSecretCopied(true);
        setTimeout(() => setSecretCopied(false), 2000);
    }

    async function handleRegenerateSecret() {
        setRegenerating(true);
        setNewSecret("");
        try {
            const res = await fetch(
                `${getApiBase()}/api/embed-partners/${partnerId}/regenerate-secret`,
                { method: "POST" }
            );
            const data = await res.json();
            if (data.success) {
                setNewSecret(data.signingSecret);
                setShowRegenerateConfirm(false);
                await loadPartner();
            } else {
                setError(data.error || "Failed to regenerate secret");
            }
        } catch {
            setError("Failed to regenerate secret");
        } finally {
            setRegenerating(false);
        }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(
                `${getApiBase()}/api/embed-partners/${partnerId}?confirm=true`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (data.success) {
                router.push("/settings/embed-partners");
            } else {
                setError(data.error || "Failed to delete partner");
            }
        } catch {
            setError("Failed to delete partner");
        } finally {
            setDeleting(false);
        }
    }

    function maskSecret(secret: string): string {
        if (secret.length <= 12) return secret;
        return secret.slice(0, 8) + "..." + secret.slice(-4);
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

    if (!partner) {
        return (
            <Alert variant="destructive">
                <AlertDescription>
                    Partner not found.{" "}
                    <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => router.push("/settings/embed-partners")}
                    >
                        Back to list
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
                    onClick={() => router.push("/settings/embed-partners")}
                >
                    ←
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{partner.name}</h1>
                    <p className="text-muted-foreground text-sm">
                        <code>{partner.slug}</code> &middot; Created{" "}
                        {new Date(partner.createdAt).toLocaleDateString()}
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

            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                        Partner configuration. Slug is immutable after creation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Slug</label>
                            <Input value={partner.slug} disabled />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Switch checked={editActive} onCheckedChange={setEditActive} />
                        <label className="text-sm font-medium">
                            {editActive ? "Active" : "Inactive"}
                        </label>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Allowed Domains</label>
                        <Textarea
                            value={editDomains}
                            onChange={(e) => setEditDomains(e.target.value)}
                            placeholder={"app.example.com\nstaging.example.com"}
                            rows={3}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Token Max Age (seconds)</label>
                        <Input
                            type="number"
                            value={editMaxAge}
                            onChange={(e) => setEditMaxAge(parseInt(e.target.value) || 3600)}
                            min={60}
                            max={86400}
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Signing Secret */}
            <Card>
                <CardHeader>
                    <CardTitle>Signing Secret</CardTitle>
                    <CardDescription>
                        Used by the partner to sign identity tokens via HMAC-SHA256. Regenerating
                        will break existing integrations.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {newSecret && (
                        <Alert>
                            <AlertDescription className="space-y-2">
                                <p className="font-medium">New signing secret generated:</p>
                                <code className="bg-muted block rounded px-3 py-2 text-xs break-all">
                                    {newSecret}
                                </code>
                                <p className="text-muted-foreground text-xs">
                                    Copy this now. It will not be shown in full again.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex items-center gap-2">
                        <code className="bg-muted flex-1 rounded px-3 py-2 text-sm">
                            {maskSecret(partner.signingSecret)}
                        </code>
                        <Button variant="outline" size="sm" onClick={handleCopySecret}>
                            {secretCopied ? "Copied!" : "Copy"}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowRegenerateConfirm(true)}
                        >
                            Regenerate
                        </Button>
                    </div>

                    {showRegenerateConfirm && (
                        <Alert variant="destructive">
                            <AlertDescription className="space-y-3">
                                <p>
                                    This will invalidate the current secret. All existing
                                    integrations using this partner will stop working until updated.
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleRegenerateSecret}
                                        disabled={regenerating}
                                    >
                                        {regenerating ? "Regenerating..." : "Confirm Regenerate"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowRegenerateConfirm(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Deployments */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Deployments</CardTitle>
                            <CardDescription>
                                Embed configurations for this partner.
                            </CardDescription>
                        </div>
                        <Button
                            size="sm"
                            onClick={() =>
                                router.push(`/settings/embed-partners/${partnerId}/deployments/new`)
                            }
                        >
                            + Add Deployment
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {deployments.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-sm">
                            No deployments yet. Create one to generate an embed code.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deployments.map((d) => (
                                    <TableRow
                                        key={d.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            router.push(
                                                `/settings/embed-partners/${partnerId}/deployments/${d.id}`
                                            )
                                        }
                                    >
                                        <TableCell className="font-medium">{d.label}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {MODE_LABELS[d.mode] || d.mode}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {d.agent ? (
                                                <code className="text-xs">{d.agent.name}</code>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    All agents
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={d.isActive ? "default" : "secondary"}>
                                                {d.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-right text-sm">
                                            {new Date(d.createdAt).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Partner Users */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Provisioned Users</CardTitle>
                            <CardDescription>
                                Users from this partner who have accessed the embed.
                            </CardDescription>
                        </div>
                        <Input
                            placeholder="Search users..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="max-w-xs"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") loadUsers();
                            }}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-sm">
                            No users have connected through this partner yet.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>External ID</TableHead>
                                    <TableHead>Linked Account</TableHead>
                                    <TableHead className="text-right">Last Seen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell>
                                            {u.name || (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {u.email || (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs">{u.externalUserId}</code>
                                        </TableCell>
                                        <TableCell>
                                            {u.linkedUser ? (
                                                <Badge variant="outline">
                                                    {u.linkedUser.email}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    Not linked
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-right text-sm">
                                            {u.lastSeenAt
                                                ? new Date(u.lastSeenAt).toLocaleDateString()
                                                : "Never"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>
                        Deleting a partner removes all deployments, provisioned user mappings, and
                        breaks any active embeds.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {showDeleteConfirm ? (
                        <div className="space-y-3">
                            <p className="text-sm">Are you sure? This action cannot be undone.</p>
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? "Deleting..." : "Yes, Delete Partner"}
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
                            Delete Partner
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

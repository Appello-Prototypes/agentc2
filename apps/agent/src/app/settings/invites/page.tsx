"use client";

import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Skeleton,
    Alert,
    AlertDescription,
    Badge,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Input,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    icons,
    HugeiconsIcon
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Invite {
    id: string;
    code: string;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
    isActive: boolean;
    createdAt: string;
    createdBy: string | null;
}

interface Domain {
    id: string;
    domain: string;
    isPrimary: boolean;
    createdAt: string;
}

export default function InvitesSettingsPage() {
    const [invites, setInvites] = useState<Invite[]>([]);
    const [domains, setDomains] = useState<Domain[]>([]);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Create invite dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newInviteExpiry, setNewInviteExpiry] = useState("");
    const [newInviteMaxUses, setNewInviteMaxUses] = useState("");

    // Add domain state
    const [newDomain, setNewDomain] = useState("");
    const [addingDomain, setAddingDomain] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            // First get the current user's organization
            const orgRes = await fetch(`${getApiBase()}/api/user/organization`);
            const orgData = await orgRes.json();

            if (!orgData.success) {
                setError("Failed to load organization");
                return;
            }

            setOrganizationId(orgData.organization.id);

            // Fetch invites and domains in parallel
            const [invitesRes, domainsRes] = await Promise.all([
                fetch(`${getApiBase()}/api/organizations/${orgData.organization.id}/invites`),
                fetch(`${getApiBase()}/api/organizations/${orgData.organization.id}/domains`)
            ]);

            const invitesData = await invitesRes.json();
            const domainsData = await domainsRes.json();

            if (invitesData.success) {
                setInvites(invitesData.invites || []);
            }
            if (domainsData.success) {
                setDomains(domainsData.domains || []);
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
            setError("Failed to load invites");
        } finally {
            setLoading(false);
        }
    }

    const handleCreateInvite = async () => {
        setCreating(true);
        setError(null);

        try {
            const body: Record<string, unknown> = {};
            if (newInviteExpiry) {
                body.expiresAt = new Date(newInviteExpiry).toISOString();
            }
            if (newInviteMaxUses) {
                body.maxUses = parseInt(newInviteMaxUses, 10);
            }

            const res = await fetch(`${getApiBase()}/api/organizations/${organizationId}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.success) {
                setInvites((prev) => [data.invite, ...prev]);
                setSuccess("Invite code created successfully");
                setCreateDialogOpen(false);
                setNewInviteExpiry("");
                setNewInviteMaxUses("");
            } else {
                setError(data.error || "Failed to create invite");
            }
        } catch (err) {
            console.error("Failed to create invite:", err);
            setError("Failed to create invite");
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeInvite = async (inviteId: string) => {
        if (!confirm("Are you sure you want to revoke this invite code?")) {
            return;
        }

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/invites/${inviteId}`,
                { method: "DELETE" }
            );

            const data = await res.json();
            if (data.success) {
                setInvites((prev) => prev.filter((i) => i.id !== inviteId));
                setSuccess("Invite revoked successfully");
            } else {
                setError(data.error || "Failed to revoke invite");
            }
        } catch (err) {
            console.error("Failed to revoke invite:", err);
            setError("Failed to revoke invite");
        }
    };

    const handleCopyInviteLink = (code: string) => {
        const link = `${window.location.origin}/signup?invite=${code}`;
        navigator.clipboard.writeText(link);
        setSuccess("Invite link copied to clipboard");
    };

    const handleAddDomain = async () => {
        if (!newDomain.trim()) return;

        setAddingDomain(true);
        setError(null);

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${organizationId}/domains`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain: newDomain.trim().toLowerCase() })
            });

            const data = await res.json();
            if (data.success) {
                setDomains((prev) => [...prev, data.domain]);
                setNewDomain("");
                setSuccess("Domain added successfully");
            } else {
                setError(data.error || "Failed to add domain");
            }
        } catch (err) {
            console.error("Failed to add domain:", err);
            setError("Failed to add domain");
        } finally {
            setAddingDomain(false);
        }
    };

    const handleRemoveDomain = async (domainId: string) => {
        if (!confirm("Are you sure you want to remove this domain?")) {
            return;
        }

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/domains/${domainId}`,
                { method: "DELETE" }
            );

            const data = await res.json();
            if (data.success) {
                setDomains((prev) => prev.filter((d) => d.id !== domainId));
                setSuccess("Domain removed successfully");
            } else {
                setError(data.error || "Failed to remove domain");
            }
        } catch (err) {
            console.error("Failed to remove domain:", err);
            setError("Failed to remove domain");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="mb-2 h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Invites</h1>
                <p className="text-muted-foreground">
                    Manage invite codes and email domains for your organization
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

            {/* Invite Codes */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Invite Codes</CardTitle>
                            <CardDescription>
                                Generate codes that allow others to join your organization
                            </CardDescription>
                        </div>
                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger render={<Button />}>
                                <HugeiconsIcon icon={icons.add!} className="mr-2 size-4" />
                                Create Invite
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Invite Code</DialogTitle>
                                    <DialogDescription>
                                        Generate a new invite code for your organization
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <label className="text-sm font-medium">
                                            Expiration Date (optional)
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            value={newInviteExpiry}
                                            onChange={(e) => setNewInviteExpiry(e.target.value)}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">
                                            Max Uses (optional)
                                        </label>
                                        <Input
                                            type="number"
                                            value={newInviteMaxUses}
                                            onChange={(e) => setNewInviteMaxUses(e.target.value)}
                                            placeholder="Unlimited"
                                            min="1"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => setCreateDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateInvite} disabled={creating}>
                                        {creating ? "Creating..." : "Create"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {invites.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            No invite codes yet. Create one to invite team members.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Uses</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.map((invite) => {
                                    const expired = isExpired(invite.expiresAt);
                                    const maxedOut =
                                        invite.maxUses !== null &&
                                        invite.usedCount >= invite.maxUses;
                                    const isInactive = !invite.isActive || expired || maxedOut;

                                    return (
                                        <TableRow key={invite.id}>
                                            <TableCell className="font-mono text-sm">
                                                {invite.code}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={isInactive ? "secondary" : "default"}
                                                >
                                                    {!invite.isActive
                                                        ? "Revoked"
                                                        : expired
                                                          ? "Expired"
                                                          : maxedOut
                                                            ? "Maxed Out"
                                                            : "Active"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {invite.usedCount}
                                                {invite.maxUses !== null && ` / ${invite.maxUses}`}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {invite.expiresAt
                                                    ? formatDate(invite.expiresAt)
                                                    : "Never"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDate(invite.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {!isInactive && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleCopyInviteLink(invite.code)
                                                            }
                                                        >
                                                            Copy Link
                                                        </Button>
                                                    )}
                                                    {invite.isActive && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleRevokeInvite(invite.id)
                                                            }
                                                        >
                                                            Revoke
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Email Domains */}
            <Card>
                <CardHeader>
                    <CardTitle>Email Domains</CardTitle>
                    <CardDescription>
                        Users with these email domains will automatically join your organization
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add Domain */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="example.com"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button
                            onClick={handleAddDomain}
                            disabled={addingDomain || !newDomain.trim()}
                        >
                            {addingDomain ? "Adding..." : "Add Domain"}
                        </Button>
                    </div>

                    {/* Domain List */}
                    {domains.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-sm">
                            No email domains configured. Add a domain to enable auto-join.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Added</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {domains.map((domain) => (
                                    <TableRow key={domain.id}>
                                        <TableCell className="font-mono">{domain.domain}</TableCell>
                                        <TableCell>
                                            {domain.isPrimary && (
                                                <Badge variant="secondary">Primary</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(domain.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveDomain(domain.id)}
                                            >
                                                Remove
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

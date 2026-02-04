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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    icons,
    HugeiconsIcon
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Workspace {
    id: string;
    name: string;
    slug: string;
    environment: string;
    description: string | null;
    isDefault: boolean;
    agentsCount: number;
    createdAt: string;
}

const environmentColors: Record<string, string> = {
    development: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    staging: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    production: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
};

export default function WorkspacesSettingsPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Create workspace dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");
    const [newWorkspaceEnv, setNewWorkspaceEnv] = useState("development");
    const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");

    // Edit workspace dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    async function fetchWorkspaces() {
        try {
            // First get the current user's organization
            const orgRes = await fetch(`${getApiBase()}/api/user/organization`);
            const orgData = await orgRes.json();

            if (!orgData.success) {
                setError("Failed to load organization");
                return;
            }

            setOrganizationId(orgData.organization.id);

            // Fetch workspaces
            const workspacesRes = await fetch(
                `${getApiBase()}/api/organizations/${orgData.organization.id}/workspaces`
            );
            const workspacesData = await workspacesRes.json();

            if (workspacesData.success) {
                setWorkspaces(workspacesData.workspaces || []);
            }
        } catch (err) {
            console.error("Failed to fetch workspaces:", err);
            setError("Failed to load workspaces");
        } finally {
            setLoading(false);
        }
    }

    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName.trim()) return;

        setCreating(true);
        setError(null);

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/workspaces`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: newWorkspaceName.trim(),
                        slug: newWorkspaceSlug.trim() || undefined,
                        environment: newWorkspaceEnv,
                        description: newWorkspaceDescription.trim() || undefined
                    })
                }
            );

            const data = await res.json();
            if (data.success) {
                setWorkspaces((prev) => [...prev, { ...data.workspace, agentsCount: 0 }]);
                setSuccess("Workspace created successfully");
                setCreateDialogOpen(false);
                setNewWorkspaceName("");
                setNewWorkspaceSlug("");
                setNewWorkspaceEnv("development");
                setNewWorkspaceDescription("");
            } else {
                setError(data.error || "Failed to create workspace");
            }
        } catch (err) {
            console.error("Failed to create workspace:", err);
            setError("Failed to create workspace");
        } finally {
            setCreating(false);
        }
    };

    const handleEditWorkspace = (workspace: Workspace) => {
        setEditingWorkspace(workspace);
        setEditDialogOpen(true);
    };

    const handleSaveWorkspace = async () => {
        if (!editingWorkspace) return;

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/workspaces/${editingWorkspace.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: editingWorkspace.name,
                        description: editingWorkspace.description,
                        isDefault: editingWorkspace.isDefault
                    })
                }
            );

            const data = await res.json();
            if (data.success) {
                setWorkspaces((prev) =>
                    prev.map((w) =>
                        w.id === editingWorkspace.id
                            ? { ...w, ...data.workspace }
                            : editingWorkspace.isDefault
                              ? { ...w, isDefault: false }
                              : w
                    )
                );
                setSuccess("Workspace updated successfully");
                setEditDialogOpen(false);
                setEditingWorkspace(null);
            } else {
                setError(data.error || "Failed to update workspace");
            }
        } catch (err) {
            console.error("Failed to update workspace:", err);
            setError("Failed to update workspace");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteWorkspace = async (workspaceId: string) => {
        const workspace = workspaces.find((w) => w.id === workspaceId);
        if (!workspace) return;

        if (workspace.isDefault) {
            setError("Cannot delete the default workspace");
            return;
        }

        if (workspace.agentsCount > 0) {
            setError(
                `Cannot delete workspace with ${workspace.agentsCount} agent(s). Move or delete agents first.`
            );
            return;
        }

        if (!confirm(`Are you sure you want to delete "${workspace.name}"?`)) {
            return;
        }

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/workspaces/${workspaceId}`,
                { method: "DELETE" }
            );

            const data = await res.json();
            if (data.success) {
                setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
                setSuccess("Workspace deleted successfully");
            } else {
                setError(data.error || "Failed to delete workspace");
            }
        } catch (err) {
            console.error("Failed to delete workspace:", err);
            setError("Failed to delete workspace");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
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
                <h1 className="text-2xl font-bold">Workspaces</h1>
                <p className="text-muted-foreground">
                    Manage environments for your agents and workflows
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

            {/* Workspaces List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Workspaces</CardTitle>
                            <CardDescription>
                                Separate environments for development, staging, and production
                            </CardDescription>
                        </div>
                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger render={<Button />}>
                                <HugeiconsIcon icon={icons.add!} className="mr-2 size-4" />
                                Create Workspace
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Workspace</DialogTitle>
                                    <DialogDescription>
                                        Create a new workspace for your organization
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <label className="text-sm font-medium">Name</label>
                                        <Input
                                            value={newWorkspaceName}
                                            onChange={(e) => setNewWorkspaceName(e.target.value)}
                                            placeholder="My Workspace"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">
                                            Slug (optional)
                                        </label>
                                        <Input
                                            value={newWorkspaceSlug}
                                            onChange={(e) =>
                                                setNewWorkspaceSlug(
                                                    e.target.value
                                                        .toLowerCase()
                                                        .replace(/[^a-z0-9-]/g, "-")
                                                )
                                            }
                                            placeholder="my-workspace"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Environment</label>
                                        <Select
                                            value={newWorkspaceEnv}
                                            onValueChange={(value) =>
                                                value && setNewWorkspaceEnv(value)
                                            }
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="development">
                                                    Development
                                                </SelectItem>
                                                <SelectItem value="staging">Staging</SelectItem>
                                                <SelectItem value="production">
                                                    Production
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">
                                            Description (optional)
                                        </label>
                                        <Textarea
                                            value={newWorkspaceDescription}
                                            onChange={(e) =>
                                                setNewWorkspaceDescription(e.target.value)
                                            }
                                            placeholder="A brief description"
                                            className="mt-1"
                                            rows={2}
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
                                    <Button
                                        onClick={handleCreateWorkspace}
                                        disabled={creating || !newWorkspaceName.trim()}
                                    >
                                        {creating ? "Creating..." : "Create"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {workspaces.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            No workspaces found. Create one to get started.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Environment</TableHead>
                                    <TableHead>Agents</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {workspaces.map((workspace) => (
                                    <TableRow key={workspace.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {workspace.name}
                                                </span>
                                                {workspace.isDefault && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Default
                                                    </Badge>
                                                )}
                                            </div>
                                            {workspace.description && (
                                                <p className="text-muted-foreground text-sm">
                                                    {workspace.description}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="secondary"
                                                className={
                                                    environmentColors[workspace.environment] || ""
                                                }
                                            >
                                                {workspace.environment.charAt(0).toUpperCase() +
                                                    workspace.environment.slice(1)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{workspace.agentsCount}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(workspace.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditWorkspace(workspace)}
                                                >
                                                    Edit
                                                </Button>
                                                {!workspace.isDefault && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDeleteWorkspace(workspace.id)
                                                        }
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Workspace Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Workspace</DialogTitle>
                        <DialogDescription>Update workspace settings</DialogDescription>
                    </DialogHeader>
                    {editingWorkspace && (
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-medium">Name</label>
                                <Input
                                    value={editingWorkspace.name}
                                    onChange={(e) =>
                                        setEditingWorkspace({
                                            ...editingWorkspace,
                                            name: e.target.value
                                        })
                                    }
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Description</label>
                                <Textarea
                                    value={editingWorkspace.description || ""}
                                    onChange={(e) =>
                                        setEditingWorkspace({
                                            ...editingWorkspace,
                                            description: e.target.value
                                        })
                                    }
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={editingWorkspace.isDefault}
                                    onChange={(e) =>
                                        setEditingWorkspace({
                                            ...editingWorkspace,
                                            isDefault: e.target.checked
                                        })
                                    }
                                    className="size-4 rounded border"
                                />
                                <label htmlFor="isDefault" className="text-sm font-medium">
                                    Set as default workspace
                                </label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveWorkspace} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

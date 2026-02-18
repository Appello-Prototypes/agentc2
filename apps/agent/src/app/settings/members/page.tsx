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
    Avatar,
    AvatarImage,
    AvatarFallback,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Input
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Member {
    id: string;
    userId: string;
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
    role: string;
    permissions: string[];
    createdAt: string;
}

interface CurrentMembership {
    role: string;
    userId: string;
}

const roleColors: Record<string, string> = {
    owner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    member: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    viewer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
};

export default function MembersSettingsPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchMembers();
    }, []);

    async function fetchMembers() {
        try {
            // First get the current user's organization
            const orgRes = await fetch(`${getApiBase()}/api/user/organization`);
            const orgData = await orgRes.json();

            if (!orgData.success) {
                setError("Failed to load organization");
                return;
            }

            setOrganizationId(orgData.organization.id);
            setCurrentMembership({
                role: orgData.membership.role,
                userId: orgData.membership.userId
            });

            // Then fetch members
            const membersRes = await fetch(
                `${getApiBase()}/api/organizations/${orgData.organization.id}/members`
            );
            const membersData = await membersRes.json();

            if (membersData.success) {
                setMembers(membersData.members);
            }
        } catch (err) {
            console.error("Failed to fetch members:", err);
            setError("Failed to load members");
        } finally {
            setLoading(false);
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/members/${userId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: newRole })
                }
            );

            const data = await res.json();
            if (data.success) {
                setMembers((prev) =>
                    prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
                );
                setSuccess("Role updated successfully");
            } else {
                setError(data.error || "Failed to update role");
            }
        } catch (err) {
            console.error("Failed to update role:", err);
            setError("Failed to update role");
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) {
            return;
        }

        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/members/${userId}`,
                { method: "DELETE" }
            );

            const data = await res.json();
            if (data.success) {
                setMembers((prev) => prev.filter((m) => m.userId !== userId));
                setSuccess("Member removed successfully");
            } else {
                setError(data.error || "Failed to remove member");
            }
        } catch (err) {
            console.error("Failed to remove member:", err);
            setError("Failed to remove member");
        }
    };

    const handleTogglePermission = async (userId: string, permission: string, enabled: boolean) => {
        setError(null);
        setSuccess(null);

        const member = members.find((m) => m.userId === userId);
        if (!member) return;

        const currentPerms = member.permissions || [];
        const newPerms = enabled
            ? [...currentPerms, permission]
            : currentPerms.filter((p) => p !== permission);

        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organizationId}/members/${userId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ permissions: newPerms })
                }
            );

            const data = await res.json();
            if (data.success) {
                setMembers((prev) =>
                    prev.map((m) => (m.userId === userId ? { ...m, permissions: newPerms } : m))
                );
                setSuccess(
                    `${enabled ? "Granted" : "Revoked"} guardrail override for ${member.user.name}`
                );
            } else {
                setError(data.error || "Failed to update permissions");
            }
        } catch (err) {
            console.error("Failed to update permissions:", err);
            setError("Failed to update permissions");
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const canManageMembers =
        currentMembership?.role === "owner" || currentMembership?.role === "admin";
    const isOwner = currentMembership?.role === "owner";

    // Filter members by search query
    const filteredMembers = members.filter((member) => {
        const query = searchQuery.toLowerCase();
        return (
            member.user.name.toLowerCase().includes(query) ||
            member.user.email.toLowerCase().includes(query)
        );
    });

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
                        <Skeleton className="mb-4 h-10 w-full" />
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
                <h1 className="text-2xl font-bold">Members</h1>
                <p className="text-muted-foreground">Manage team members and their roles</p>
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

            {/* Members List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Team Members</CardTitle>
                            <CardDescription>
                                {members.length} member{members.length !== 1 ? "s" : ""} in your
                                organization
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search */}
                    <div className="mb-4">
                        <Input
                            placeholder="Search members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>

                    {filteredMembers.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            {searchQuery
                                ? "No members found matching your search"
                                : "No members found"}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Role</TableHead>
                                    {canManageMembers && (
                                        <TableHead className="text-center">
                                            Guardrail Override
                                        </TableHead>
                                    )}
                                    <TableHead>Joined</TableHead>
                                    {canManageMembers && (
                                        <TableHead className="text-right">Actions</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMembers.map((member) => {
                                    const isCurrentUser =
                                        member.userId === currentMembership?.userId;
                                    const isMemberOwner = member.role === "owner";
                                    const canEditRole =
                                        isOwner ||
                                        (canManageMembers && !isMemberOwner && !isCurrentUser);
                                    const canRemove =
                                        canManageMembers && !isMemberOwner && !isCurrentUser;

                                    return (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="size-8">
                                                        <AvatarImage
                                                            src={member.user.image || undefined}
                                                            alt={member.user.name}
                                                        />
                                                        <AvatarFallback className="text-xs">
                                                            {getInitials(
                                                                member.user.name ||
                                                                    member.user.email
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">
                                                            {member.user.name}
                                                            {isCurrentUser && (
                                                                <span className="text-muted-foreground ml-1 text-sm">
                                                                    (you)
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-muted-foreground text-sm">
                                                            {member.user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {canEditRole ? (
                                                    <Select
                                                        value={member.role}
                                                        onValueChange={(value) =>
                                                            value &&
                                                            handleRoleChange(member.userId, value)
                                                        }
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {isOwner && (
                                                                <SelectItem value="owner">
                                                                    Owner
                                                                </SelectItem>
                                                            )}
                                                            <SelectItem value="admin">
                                                                Admin
                                                            </SelectItem>
                                                            <SelectItem value="member">
                                                                Member
                                                            </SelectItem>
                                                            <SelectItem value="viewer">
                                                                Viewer
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className={roleColors[member.role] || ""}
                                                    >
                                                        {member.role.charAt(0).toUpperCase() +
                                                            member.role.slice(1)}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            {canManageMembers && (
                                                <TableCell className="text-center">
                                                    <Switch
                                                        checked={(
                                                            member.permissions || []
                                                        ).includes("guardrail_override")}
                                                        onCheckedChange={(checked) =>
                                                            handleTogglePermission(
                                                                member.userId,
                                                                "guardrail_override",
                                                                checked
                                                            )
                                                        }
                                                        disabled={!canManageMembers}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="text-muted-foreground">
                                                {formatDate(member.createdAt)}
                                            </TableCell>
                                            {canManageMembers && (
                                                <TableCell className="text-right">
                                                    {canRemove && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleRemoveMember(member.userId)
                                                            }
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Role Descriptions */}
            <Card>
                <CardHeader>
                    <CardTitle>Role Permissions</CardTitle>
                    <CardDescription>Understanding what each role can do</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Badge className={roleColors.owner}>Owner</Badge>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Full access to all settings, can delete organization and transfer
                                ownership
                            </p>
                        </div>
                        <div>
                            <Badge className={roleColors.admin}>Admin</Badge>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Can manage members, invites, and organization settings (except
                                ownership transfer)
                            </p>
                        </div>
                        <div>
                            <Badge className={roleColors.member}>Member</Badge>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Standard access to agents, workflows, and workspaces
                            </p>
                        </div>
                        <div>
                            <Badge className={roleColors.viewer}>Viewer</Badge>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Read-only access to agents, workflows, and workspaces
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

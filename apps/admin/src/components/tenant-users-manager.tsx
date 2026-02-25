"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, MoreVertical, Copy, Check, X } from "lucide-react";

interface TenantMember {
    id: string;
    userId: string;
    role: string;
    createdAt: string;
    userName: string;
    userEmail: string;
    userStatus: string;
}

const ROLES = [
    { value: "owner", label: "Owner" },
    { value: "admin", label: "Admin" },
    { value: "member", label: "Member" },
    { value: "viewer", label: "Viewer" }
];

function getRoleLabel(role: string) {
    return ROLES.find((r) => r.value === role)?.label || role;
}

export function TenantUsersManager({
    orgId,
    initialMembers
}: {
    orgId: string;
    initialMembers: TenantMember[];
}) {
    const router = useRouter();
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingMember, setEditingMember] = useState<TenantMember | null>(null);
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Members ({initialMembers.length})</h2>
                <button
                    onClick={() => setShowAddDialog(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
                >
                    <UserPlus className="h-4 w-4" />
                    Add User
                </button>
            </div>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Name</th>
                            <th className="px-4 py-2 text-left font-medium">Email</th>
                            <th className="px-4 py-2 text-left font-medium">Role</th>
                            <th className="px-4 py-2 text-left font-medium">Status</th>
                            <th className="px-4 py-2 text-left font-medium">Joined</th>
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initialMembers.map((member) => (
                            <tr key={member.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-2 font-medium">{member.userName}</td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {member.userEmail}
                                </td>
                                <td className="px-4 py-2">
                                    <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                        {getRoleLabel(member.role)}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <span
                                        className={`inline-flex h-2 w-2 rounded-full ${member.userStatus === "active" ? "bg-green-500" : "bg-gray-400"}`}
                                    />
                                </td>
                                <td className="text-muted-foreground px-4 py-2 text-xs">
                                    {new Date(member.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <div className="relative inline-block">
                                        <button
                                            onClick={() =>
                                                setActionMenuId(
                                                    actionMenuId === member.id ? null : member.id
                                                )
                                            }
                                            className="hover:bg-accent rounded-md p-1 transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                        {actionMenuId === member.id && (
                                            <MemberActionMenu
                                                member={member}
                                                onEditRole={() => {
                                                    setEditingMember(member);
                                                    setActionMenuId(null);
                                                }}
                                                onRemove={async () => {
                                                    setActionMenuId(null);
                                                    await removeMember(orgId, member);
                                                    router.refresh();
                                                }}
                                                onClose={() => setActionMenuId(null)}
                                            />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {initialMembers.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No members yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showAddDialog && (
                <AddMemberDialog
                    orgId={orgId}
                    onClose={() => setShowAddDialog(false)}
                    onAdded={(email, password) => {
                        setShowAddDialog(false);
                        if (password) {
                            setCreatedEmail(email);
                            setCreatedPassword(password);
                        }
                        router.refresh();
                    }}
                />
            )}

            {editingMember && (
                <EditRoleDialog
                    orgId={orgId}
                    member={editingMember}
                    onClose={() => setEditingMember(null)}
                    onSaved={() => {
                        setEditingMember(null);
                        router.refresh();
                    }}
                />
            )}

            {createdPassword && createdEmail && (
                <PasswordRevealDialog
                    email={createdEmail}
                    password={createdPassword}
                    onClose={() => {
                        setCreatedPassword(null);
                        setCreatedEmail(null);
                    }}
                />
            )}
        </div>
    );
}

function MemberActionMenu({
    member,
    onEditRole,
    onRemove,
    onClose
}: {
    member: TenantMember;
    onEditRole: () => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="bg-popover ring-foreground/10 absolute right-0 z-50 mt-1 w-40 rounded-lg p-1 shadow-md ring-1">
                <button
                    onClick={onEditRole}
                    className="hover:bg-accent flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm"
                >
                    Edit Role
                </button>
                <button
                    onClick={() => {
                        if (
                            confirm(
                                `Remove "${member.userName}" (${member.userEmail}) from this organization?`
                            )
                        ) {
                            onRemove();
                        } else {
                            onClose();
                        }
                    }}
                    className="hover:bg-destructive/10 text-destructive flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm"
                >
                    Remove
                </button>
            </div>
        </>
    );
}

function AddMemberDialog({
    orgId,
    onClose,
    onAdded
}: {
    orgId: string;
    onClose: () => void;
    onAdded: (email: string, password: string | null) => void;
}) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("member");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showNameField, setShowNameField] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const payload: Record<string, string> = { email, role };
            if (showNameField && name) {
                payload.name = name;
            }

            const res = await fetch(`/admin/api/tenants/${orgId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "include"
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 400 && data.error?.includes("Provide a name")) {
                    setShowNameField(true);
                    setError(
                        "This email is not in the system. Enter a name to create a new account."
                    );
                    return;
                }
                setError(data.error || "Failed to add member");
                return;
            }

            onAdded(email, data.generatedPassword || null);
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <DialogBackdrop onClose={onClose}>
            <div className="bg-background ring-foreground/10 w-full max-w-sm rounded-xl p-4 ring-1">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-medium">Add User to Organization</h2>
                    <button onClick={onClose} className="hover:bg-accent rounded-md p-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {error && (
                        <div className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            placeholder="user@company.com"
                        />
                    </div>

                    {showNameField && (
                        <div className="space-y-1">
                            <label className="text-sm font-medium">
                                Name{" "}
                                <span className="text-muted-foreground font-normal">
                                    (new user)
                                </span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                placeholder="Jane Smith"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <p className="text-muted-foreground text-xs">
                        If the user doesn&apos;t exist, a new account will be created with a
                        generated password.
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="border-input hover:bg-accent inline-flex h-8 items-center rounded-md border px-3 text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? "Adding..." : "Add User"}
                        </button>
                    </div>
                </form>
            </div>
        </DialogBackdrop>
    );
}

function EditRoleDialog({
    orgId,
    member,
    onClose,
    onSaved
}: {
    orgId: string;
    member: TenantMember;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [role, setRole] = useState(member.role);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/admin/api/tenants/${orgId}/members/${member.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
                credentials: "include"
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to update role");
                return;
            }

            onSaved();
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <DialogBackdrop onClose={onClose}>
            <div className="bg-background ring-foreground/10 w-full max-w-sm rounded-xl p-4 ring-1">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-medium">Edit Role</h2>
                    <button onClick={onClose} className="hover:bg-accent rounded-md p-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {error && (
                        <div className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-medium">User</label>
                        <input
                            type="text"
                            value={`${member.userName} (${member.userEmail})`}
                            disabled
                            className="border-input bg-muted text-muted-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="border-input hover:bg-accent inline-flex h-8 items-center rounded-md border px-3 text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || role === member.role}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </DialogBackdrop>
    );
}

function PasswordRevealDialog({
    email,
    password,
    onClose
}: {
    email: string;
    password: string;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    function handleCopy() {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <DialogBackdrop onClose={onClose}>
            <div className="bg-background ring-foreground/10 w-full max-w-sm rounded-xl p-4 ring-1">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-medium">User Created</h2>
                    <button onClick={onClose} className="hover:bg-accent rounded-md p-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <p className="text-sm">
                        A new account was created for <strong>{email}</strong> and they have been
                        added to the organization.
                    </p>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Generated Password</label>
                        <div className="flex items-center gap-2">
                            <code className="bg-muted flex-1 rounded-md px-3 py-2 font-mono text-sm">
                                {password}
                            </code>
                            <button
                                onClick={handleCopy}
                                className="hover:bg-accent rounded-md p-2 transition-colors"
                                title="Copy password"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                        Save this password now. It will not be shown again. Share it with the user
                        so they can sign in.
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={onClose}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </DialogBackdrop>
    );
}

function DialogBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-xs" onClick={onClose} />
            <div className="relative z-10">{children}</div>
        </div>
    );
}

async function removeMember(orgId: string, member: TenantMember) {
    try {
        const res = await fetch(`/admin/api/tenants/${orgId}/members/${member.id}`, {
            method: "DELETE",
            credentials: "include"
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Failed to remove member");
        }
    } catch {
        alert("Network error");
    }
}

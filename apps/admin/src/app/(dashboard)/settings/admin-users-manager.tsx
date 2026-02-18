"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, MoreVertical, Copy, Check, X } from "lucide-react";

interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    mfaEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}

const ROLES = [
    { value: "super_admin", label: "Super Admin" },
    { value: "platform_admin", label: "Platform Admin" },
    { value: "billing_admin", label: "Billing Admin" },
    { value: "support_agent", label: "Support Agent" },
    { value: "viewer", label: "Viewer" }
];

function getRoleLabel(role: string) {
    return ROLES.find((r) => r.value === role)?.label || role;
}

export function AdminUsersManager({
    initialAdmins,
    currentAdminId
}: {
    initialAdmins: AdminUser[];
    currentAdminId: string;
}) {
    const router = useRouter();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Admin Users</h1>
                <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">
                        {initialAdmins.length} admin users
                    </span>
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add Admin
                    </button>
                </div>
            </div>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Role</th>
                            <th className="px-4 py-3 text-left font-medium">Active</th>
                            <th className="px-4 py-3 text-left font-medium">MFA</th>
                            <th className="px-4 py-3 text-left font-medium">Last Login</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initialAdmins.map((admin) => (
                            <tr key={admin.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-3 font-medium">{admin.name}</td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {admin.email}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                        {getRoleLabel(admin.role)}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex h-2 w-2 rounded-full ${admin.isActive ? "bg-green-500" : "bg-gray-400"}`}
                                    />
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    {admin.mfaEnabled ? "Enabled" : "—"}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {admin.lastLoginAt
                                        ? new Date(admin.lastLoginAt).toLocaleDateString()
                                        : "Never"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {admin.id !== currentAdminId && (
                                        <div className="relative inline-block">
                                            <button
                                                onClick={() =>
                                                    setActionMenuId(
                                                        actionMenuId === admin.id ? null : admin.id
                                                    )
                                                }
                                                className="hover:bg-accent rounded-md p-1 transition-colors"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                            {actionMenuId === admin.id && (
                                                <ActionMenu
                                                    admin={admin}
                                                    onEdit={() => {
                                                        setEditingAdmin(admin);
                                                        setActionMenuId(null);
                                                    }}
                                                    onToggleActive={async () => {
                                                        setActionMenuId(null);
                                                        await toggleActive(admin);
                                                        router.refresh();
                                                    }}
                                                    onDelete={async () => {
                                                        setActionMenuId(null);
                                                        await deleteAdmin(admin);
                                                        router.refresh();
                                                    }}
                                                    onClose={() => setActionMenuId(null)}
                                                />
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {initialAdmins.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No admin users.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showCreateDialog && (
                <CreateAdminDialog
                    onClose={() => setShowCreateDialog(false)}
                    onCreated={(email, password) => {
                        setShowCreateDialog(false);
                        setCreatedEmail(email);
                        setCreatedPassword(password);
                        router.refresh();
                    }}
                />
            )}

            {editingAdmin && (
                <EditAdminDialog
                    admin={editingAdmin}
                    onClose={() => setEditingAdmin(null)}
                    onSaved={() => {
                        setEditingAdmin(null);
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

function ActionMenu({
    admin,
    onEdit,
    onToggleActive,
    onDelete,
    onClose
}: {
    admin: AdminUser;
    onEdit: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="bg-popover ring-foreground/10 absolute right-0 z-50 mt-1 w-40 rounded-lg p-1 shadow-md ring-1">
                <button
                    onClick={onEdit}
                    className="hover:bg-accent flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm"
                >
                    Edit
                </button>
                <button
                    onClick={onToggleActive}
                    className="hover:bg-accent flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm"
                >
                    {admin.isActive ? "Deactivate" : "Reactivate"}
                </button>
                <button
                    onClick={() => {
                        if (
                            confirm(
                                `Delete admin "${admin.name}" (${admin.email})? This cannot be undone.`
                            )
                        ) {
                            onDelete();
                        } else {
                            onClose();
                        }
                    }}
                    className="hover:bg-destructive/10 text-destructive flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm"
                >
                    Delete
                </button>
            </div>
        </>
    );
}

function CreateAdminDialog({
    onClose,
    onCreated
}: {
    onClose: () => void;
    onCreated: (email: string, password: string) => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("viewer");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/admin/api/admins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, role }),
                credentials: "include"
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to create admin");
                return;
            }

            onCreated(data.admin.email, data.generatedPassword);
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
                    <h2 className="text-base font-medium">Add Admin User</h2>
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
                        <label className="text-sm font-medium">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            placeholder="Jane Smith"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            placeholder="jane@company.com"
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

                    <p className="text-muted-foreground text-xs">
                        A password will be generated automatically. The admin can also sign in with
                        Google SSO if configured.
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
                            {loading ? "Creating..." : "Create Admin"}
                        </button>
                    </div>
                </form>
            </div>
        </DialogBackdrop>
    );
}

function EditAdminDialog({
    admin,
    onClose,
    onSaved
}: {
    admin: AdminUser;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(admin.name);
    const [role, setRole] = useState(admin.role);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/admin/api/admins/${admin.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, role }),
                credentials: "include"
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to update admin");
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
                    <h2 className="text-base font-medium">Edit Admin</h2>
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
                        <label className="text-sm font-medium">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <input
                            type="email"
                            value={admin.email}
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
                            disabled={loading}
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
                    <h2 className="text-base font-medium">Admin Created</h2>
                    <button onClick={onClose} className="hover:bg-accent rounded-md p-1">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <p className="text-sm">
                        Admin account created for <strong>{email}</strong>.
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
                        Save this password now. It will not be shown again. The admin can also sign
                        in with Google SSO.
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

async function toggleActive(admin: AdminUser) {
    try {
        const res = await fetch(`/admin/api/admins/${admin.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !admin.isActive }),
            credentials: "include"
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Failed to update admin");
        }
    } catch {
        alert("Network error");
    }
}

async function deleteAdmin(admin: AdminUser) {
    try {
        const res = await fetch(`/admin/api/admins/${admin.id}`, {
            method: "DELETE",
            credentials: "include"
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Failed to delete admin");
        }
    } catch {
        alert("Network error");
    }
}

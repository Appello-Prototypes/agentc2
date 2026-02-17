"use client";

import { useState } from "react";
import { KeyRound, Plus, Copy, Check, XCircle, Link as LinkIcon, Loader2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface PlatformInvite {
    id: string;
    code: string;
    label: string | null;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
    isActive: boolean;
    createdBy: string | null;
    createdAt: string;
}

interface PlatformInviteManagerProps {
    initialInvites: PlatformInvite[];
    signupBaseUrl: string;
}

// ── Component ────────────────────────────────────────────────────────────

export function PlatformInviteManager({
    initialInvites,
    signupBaseUrl
}: PlatformInviteManagerProps) {
    const [invites, setInvites] = useState<PlatformInvite[]>(initialInvites);
    const [showForm, setShowForm] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<string | null>(null);

    // Form state
    const [label, setLabel] = useState("");
    const [customCode, setCustomCode] = useState("");
    const [maxUses, setMaxUses] = useState("");
    const [expiresIn, setExpiresIn] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    const resetForm = () => {
        setLabel("");
        setCustomCode("");
        setMaxUses("");
        setExpiresIn("");
        setError("");
        setShowForm(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setCreating(true);

        try {
            let expiresAt: string | undefined;
            if (expiresIn) {
                const days = parseInt(expiresIn, 10);
                if (days > 0) {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    expiresAt = d.toISOString();
                }
            }

            const res = await fetch("/api/platform-invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: label.trim() || undefined,
                    code: customCode.trim() || undefined,
                    maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
                    expiresAt
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to create invite");
                return;
            }

            // Prepend new invite and close form
            setInvites((prev) => [data.invite, ...prev]);
            resetForm();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (invite: PlatformInvite) => {
        if (!confirm(`Revoke invite code "${invite.code}"? It will no longer be usable.`)) return;
        setRevoking(invite.id);

        try {
            const res = await fetch(`/api/platform-invites/${invite.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false })
            });

            if (res.ok) {
                setInvites((prev) =>
                    prev.map((i) => (i.id === invite.id ? { ...i, isActive: false } : i))
                );
            }
        } finally {
            setRevoking(null);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    <h2 className="text-lg font-semibold">Platform Invite Codes</h2>
                    <span className="text-muted-foreground text-xs">({invites.length} codes)</span>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Create Invite
                    </button>
                )}
            </div>

            <p className="text-muted-foreground text-sm">
                These codes let people past the waitlist to create their own organization. Share the
                signup link with the code included.
            </p>

            {/* ── Create form ───────────────────────────────────────── */}
            {showForm && (
                <div className="bg-card border-border rounded-lg border p-4">
                    <h3 className="mb-3 text-sm font-medium">New Platform Invite</h3>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="invite-label"
                                    className="mb-1 block text-xs font-medium"
                                >
                                    Label{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </label>
                                <input
                                    id="invite-label"
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder='e.g. "YC Demo Day batch"'
                                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="invite-code"
                                    className="mb-1 block text-xs font-medium"
                                >
                                    Custom code{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (auto-generated if blank)
                                    </span>
                                </label>
                                <input
                                    id="invite-code"
                                    type="text"
                                    value={customCode}
                                    onChange={(e) =>
                                        setCustomCode(
                                            e.target.value.toUpperCase().replace(/\s/g, "-")
                                        )
                                    }
                                    placeholder="e.g. WELCOME-2026"
                                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 font-mono text-sm uppercase focus-visible:ring-2 focus-visible:outline-none"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="invite-max-uses"
                                    className="mb-1 block text-xs font-medium"
                                >
                                    Max uses{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (unlimited if blank)
                                    </span>
                                </label>
                                <input
                                    id="invite-max-uses"
                                    type="number"
                                    min="1"
                                    value={maxUses}
                                    onChange={(e) => setMaxUses(e.target.value)}
                                    placeholder="e.g. 25"
                                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="invite-expires"
                                    className="mb-1 block text-xs font-medium"
                                >
                                    Expires in (days){" "}
                                    <span className="text-muted-foreground font-normal">
                                        (never if blank)
                                    </span>
                                </label>
                                <input
                                    id="invite-expires"
                                    type="number"
                                    min="1"
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(e.target.value)}
                                    placeholder="e.g. 30"
                                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                />
                            </div>
                        </div>

                        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {creating ? "Creating..." : "Create Invite Code"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Invite table ──────────────────────────────────────── */}
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Code</th>
                            <th className="px-4 py-3 text-left font-medium">Label</th>
                            <th className="px-4 py-3 text-left font-medium">Signup Link</th>
                            <th className="px-4 py-3 text-left font-medium">Usage</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Created</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invites.map((invite) => {
                            const isExpired =
                                invite.expiresAt && new Date(invite.expiresAt) < new Date();
                            const isMaxed =
                                invite.maxUses != null && invite.usedCount >= invite.maxUses;
                            const isUsable = invite.isActive && !isExpired && !isMaxed;
                            const signupUrl = `${signupBaseUrl}/signup?invite=${invite.code}`;
                            const isCopied = copiedId === invite.id;
                            const isCopiedLink = copiedId === `link-${invite.id}`;

                            return (
                                <tr
                                    key={invite.id}
                                    className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                                                {invite.code}
                                            </code>
                                            <button
                                                onClick={() =>
                                                    copyToClipboard(invite.code, invite.id)
                                                }
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                                title="Copy code"
                                            >
                                                {isCopied ? (
                                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {invite.label || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() =>
                                                copyToClipboard(signupUrl, `link-${invite.id}`)
                                            }
                                            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                                            title="Copy signup link"
                                        >
                                            {isCopiedLink ? (
                                                <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                                            ) : (
                                                <LinkIcon className="h-3 w-3 shrink-0" />
                                            )}
                                            <span className="max-w-[180px] truncate">
                                                {isCopiedLink ? "Copied!" : signupUrl}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {invite.usedCount}
                                        {invite.maxUses != null
                                            ? ` / ${invite.maxUses}`
                                            : " (unlimited)"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                isUsable
                                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                            }`}
                                        >
                                            {!invite.isActive
                                                ? "revoked"
                                                : isExpired
                                                  ? "expired"
                                                  : isMaxed
                                                    ? "maxed"
                                                    : "active"}
                                        </span>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {new Date(invite.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {invite.isActive && (
                                            <button
                                                onClick={() => handleRevoke(invite)}
                                                disabled={revoking === invite.id}
                                                className="text-muted-foreground inline-flex items-center gap-1 text-xs transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                                                title="Revoke this invite"
                                            >
                                                {revoking === invite.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <XCircle className="h-3.5 w-3.5" />
                                                )}
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {invites.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="text-muted-foreground px-4 py-6 text-center"
                                >
                                    <KeyRound className="mx-auto mb-2 h-6 w-6 opacity-50" />
                                    No platform invite codes yet. Click &quot;Create Invite&quot; to
                                    make one.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

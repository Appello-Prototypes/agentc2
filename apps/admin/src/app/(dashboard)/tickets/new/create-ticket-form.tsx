"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Organization {
    id: string;
    name: string;
    slug: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface AdminUser {
    id: string;
    name: string;
    email: string;
}

const TYPES = [
    { value: "BUG", label: "Bug" },
    { value: "FEATURE_REQUEST", label: "Feature Request" },
    { value: "IMPROVEMENT", label: "Improvement" },
    { value: "QUESTION", label: "Question" }
];

const PRIORITIES = [
    { value: "CRITICAL", label: "Critical" },
    { value: "HIGH", label: "High" },
    { value: "MEDIUM", label: "Medium" },
    { value: "LOW", label: "Low" }
];

export function CreateTicketForm({
    organizations,
    adminUsers
}: {
    organizations: Organization[];
    adminUsers: AdminUser[];
}) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState("BUG");
    const [priority, setPriority] = useState("MEDIUM");
    const [organizationId, setOrganizationId] = useState("");
    const [submittedById, setSubmittedById] = useState("");
    const [assignedToId, setAssignedToId] = useState("");
    const [tagsInput, setTagsInput] = useState("");

    const [orgUsers, setOrgUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    useEffect(() => {
        if (!organizationId) {
            setOrgUsers([]);
            setSubmittedById("");
            return;
        }
        setUsersLoading(true);
        setSubmittedById("");
        fetch(`/admin/api/users?orgId=${organizationId}&limit=100`, { credentials: "include" })
            .then((res) => res.json())
            .then((data) => setOrgUsers(data.users || []))
            .catch(() => setOrgUsers([]))
            .finally(() => setUsersLoading(false));
    }, [organizationId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!title.trim()) {
            setError("Title is required");
            return;
        }
        if (!description.trim()) {
            setError("Description is required");
            return;
        }
        if (!organizationId) {
            setError("Please select an organization");
            return;
        }
        if (!submittedById) {
            setError("Please select a submitter");
            return;
        }

        setSaving(true);
        try {
            const tags = tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);

            const res = await fetch("/admin/api/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    type,
                    priority,
                    organizationId,
                    submittedById,
                    assignedToId: assignedToId || undefined,
                    tags: tags.length > 0 ? tags : undefined
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to create ticket");
                return;
            }

            router.push(`/tickets/${data.ticket.id}`);
        } catch {
            setError("Failed to create ticket");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            {error && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="bg-card border-border space-y-5 rounded-lg border p-6"
            >
                {/* Title */}
                <div>
                    <label className="text-foreground mb-1.5 block text-sm font-medium">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Brief summary of the issue..."
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                {/* Type + Priority */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-foreground mb-1.5 block text-sm font-medium">
                            Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        >
                            {TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-foreground mb-1.5 block text-sm font-medium">
                            Priority
                        </label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        >
                            {PRIORITIES.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Organization */}
                <div>
                    <label className="text-foreground mb-1.5 block text-sm font-medium">
                        Organization <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        <option value="">Select organization...</option>
                        {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Submitter */}
                <div>
                    <label className="text-foreground mb-1.5 block text-sm font-medium">
                        Submitted By <span className="text-red-500">*</span>
                    </label>
                    {!organizationId ? (
                        <div className="text-muted-foreground rounded-md bg-gray-500/10 px-3 py-2 text-sm">
                            Select an organization first
                        </div>
                    ) : usersLoading ? (
                        <div className="text-muted-foreground rounded-md bg-gray-500/10 px-3 py-2 text-sm">
                            Loading users...
                        </div>
                    ) : (
                        <select
                            value={submittedById}
                            onChange={(e) => setSubmittedById(e.target.value)}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        >
                            <option value="">Select user...</option>
                            {orgUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.email})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Assignee */}
                <div>
                    <label className="text-foreground mb-1.5 block text-sm font-medium">
                        Assigned To
                    </label>
                    <select
                        value={assignedToId}
                        onChange={(e) => setAssignedToId(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        <option value="">Unassigned</option>
                        {adminUsers.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Description */}
                <div>
                    <label className="text-foreground mb-1.5 block text-sm font-medium">
                        Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detailed description of the issue..."
                        rows={6}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                {/* Tags */}
                <div>
                    <label className="text-foreground mb-1.5 block text-sm font-medium">Tags</label>
                    <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Comma-separated tags (e.g. ui, api, billing)"
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <Link
                        href="/tickets"
                        className="border-border rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? "Creating..." : "Create Ticket"}
                    </button>
                </div>
            </form>
        </>
    );
}

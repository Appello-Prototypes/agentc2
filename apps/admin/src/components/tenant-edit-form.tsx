"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";

interface TenantData {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    timezone: string | null;
    maxAgents: number | null;
    maxWorkspaces: number | null;
    maxRunsPerMonth: number | null;
    maxSeats: number | null;
}

export function TenantEditForm({ tenant }: { tenant: TenantData }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [name, setName] = useState(tenant.name);
    const [slug, setSlug] = useState(tenant.slug);
    const [description, setDescription] = useState(tenant.description || "");
    const [timezone, setTimezone] = useState(tenant.timezone || "");
    const [maxAgents, setMaxAgents] = useState(tenant.maxAgents?.toString() || "");
    const [maxWorkspaces, setMaxWorkspaces] = useState(tenant.maxWorkspaces?.toString() || "");
    const [maxRunsPerMonth, setMaxRunsPerMonth] = useState(
        tenant.maxRunsPerMonth?.toString() || ""
    );
    const [maxSeats, setMaxSeats] = useState(tenant.maxSeats?.toString() || "");

    const resetForm = () => {
        setName(tenant.name);
        setSlug(tenant.slug);
        setDescription(tenant.description || "");
        setTimezone(tenant.timezone || "");
        setMaxAgents(tenant.maxAgents?.toString() || "");
        setMaxWorkspaces(tenant.maxWorkspaces?.toString() || "");
        setMaxRunsPerMonth(tenant.maxRunsPerMonth?.toString() || "");
        setMaxSeats(tenant.maxSeats?.toString() || "");
        setError("");
        setEditing(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            const res = await fetch(`/admin/api/tenants/${tenant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    description: description.trim() || null,
                    timezone: timezone.trim() || null,
                    maxAgents: maxAgents ? parseInt(maxAgents) : null,
                    maxWorkspaces: maxWorkspaces ? parseInt(maxWorkspaces) : null,
                    maxRunsPerMonth: maxRunsPerMonth ? parseInt(maxRunsPerMonth) : null,
                    maxSeats: maxSeats ? parseInt(maxSeats) : null
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to update tenant");
                return;
            }

            setEditing(false);
            if (data.tenant.slug !== tenant.slug) {
                router.push(`/tenants/${data.tenant.slug}`);
            } else {
                router.refresh();
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
            >
                <Pencil className="h-3 w-3" />
                Edit
            </button>
        );
    }

    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-semibold">Edit Tenant</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="edit-name" className="mb-1 block text-xs font-medium">
                            Name
                        </label>
                        <input
                            id="edit-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-slug" className="mb-1 block text-xs font-medium">
                            Slug
                        </label>
                        <input
                            id="edit-slug"
                            type="text"
                            required
                            value={slug}
                            onChange={(e) =>
                                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                            }
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div className="col-span-2">
                        <label
                            htmlFor="edit-description"
                            className="mb-1 block text-xs font-medium"
                        >
                            Description
                        </label>
                        <input
                            id="edit-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description..."
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-timezone" className="mb-1 block text-xs font-medium">
                            Timezone
                        </label>
                        <input
                            id="edit-timezone"
                            type="text"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            placeholder="e.g. America/New_York"
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div />
                    <div>
                        <label htmlFor="edit-max-agents" className="mb-1 block text-xs font-medium">
                            Max Agents{" "}
                            <span className="text-muted-foreground font-normal">
                                (blank = unlimited)
                            </span>
                        </label>
                        <input
                            id="edit-max-agents"
                            type="number"
                            min="1"
                            value={maxAgents}
                            onChange={(e) => setMaxAgents(e.target.value)}
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="edit-max-workspaces"
                            className="mb-1 block text-xs font-medium"
                        >
                            Max Workspaces{" "}
                            <span className="text-muted-foreground font-normal">
                                (blank = unlimited)
                            </span>
                        </label>
                        <input
                            id="edit-max-workspaces"
                            type="number"
                            min="1"
                            value={maxWorkspaces}
                            onChange={(e) => setMaxWorkspaces(e.target.value)}
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-max-runs" className="mb-1 block text-xs font-medium">
                            Max Runs/Month{" "}
                            <span className="text-muted-foreground font-normal">
                                (blank = unlimited)
                            </span>
                        </label>
                        <input
                            id="edit-max-runs"
                            type="number"
                            min="1"
                            value={maxRunsPerMonth}
                            onChange={(e) => setMaxRunsPerMonth(e.target.value)}
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-max-seats" className="mb-1 block text-xs font-medium">
                            Max Seats{" "}
                            <span className="text-muted-foreground font-normal">
                                (blank = unlimited)
                            </span>
                        </label>
                        <input
                            id="edit-max-seats"
                            type="number"
                            min="1"
                            value={maxSeats}
                            onChange={(e) => setMaxSeats(e.target.value)}
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
                        disabled={saving}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}

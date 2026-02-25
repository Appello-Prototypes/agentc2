"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function TenantCreateForm() {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("active");
    const [maxAgents, setMaxAgents] = useState("");
    const [maxWorkspaces, setMaxWorkspaces] = useState("");
    const [maxRunsPerMonth, setMaxRunsPerMonth] = useState("");
    const [maxSeats, setMaxSeats] = useState("");

    const resetForm = () => {
        setName("");
        setSlug("");
        setDescription("");
        setStatus("active");
        setMaxAgents("");
        setMaxWorkspaces("");
        setMaxRunsPerMonth("");
        setMaxSeats("");
        setError("");
        setShowForm(false);
    };

    const deriveSlug = (value: string) => {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");
    };

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slug || slug === deriveSlug(name)) {
            setSlug(deriveSlug(value));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setCreating(true);

        try {
            const res = await fetch("/admin/api/tenants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    description: description.trim() || undefined,
                    status,
                    maxAgents: maxAgents ? parseInt(maxAgents) : undefined,
                    maxWorkspaces: maxWorkspaces ? parseInt(maxWorkspaces) : undefined,
                    maxRunsPerMonth: maxRunsPerMonth ? parseInt(maxRunsPerMonth) : undefined,
                    maxSeats: maxSeats ? parseInt(maxSeats) : undefined
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to create tenant");
                return;
            }

            resetForm();
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    if (!showForm) {
        return (
            <button
                onClick={() => setShowForm(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            >
                <Plus className="h-3.5 w-3.5" />
                Create Tenant
            </button>
        );
    }

    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <h3 className="mb-3 text-sm font-medium">New Tenant</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="tenant-name" className="mb-1 block text-xs font-medium">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tenant-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Acme Corp"
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="tenant-slug" className="mb-1 block text-xs font-medium">
                            Slug <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tenant-slug"
                            type="text"
                            required
                            value={slug}
                            onChange={(e) => setSlug(deriveSlug(e.target.value))}
                            placeholder="acme-corp"
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div className="col-span-2">
                        <label
                            htmlFor="tenant-description"
                            className="mb-1 block text-xs font-medium"
                        >
                            Description{" "}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <input
                            id="tenant-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this tenant..."
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="tenant-status" className="mb-1 block text-xs font-medium">
                            Initial Status
                        </label>
                        <select
                            id="tenant-status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        >
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="provisioning">Provisioning</option>
                        </select>
                    </div>
                    <div />
                    <div>
                        <label
                            htmlFor="tenant-max-agents"
                            className="mb-1 block text-xs font-medium"
                        >
                            Max Agents{" "}
                            <span className="text-muted-foreground font-normal">
                                (unlimited if blank)
                            </span>
                        </label>
                        <input
                            id="tenant-max-agents"
                            type="number"
                            min="1"
                            value={maxAgents}
                            onChange={(e) => setMaxAgents(e.target.value)}
                            placeholder="e.g. 10"
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="tenant-max-workspaces"
                            className="mb-1 block text-xs font-medium"
                        >
                            Max Workspaces{" "}
                            <span className="text-muted-foreground font-normal">
                                (unlimited if blank)
                            </span>
                        </label>
                        <input
                            id="tenant-max-workspaces"
                            type="number"
                            min="1"
                            value={maxWorkspaces}
                            onChange={(e) => setMaxWorkspaces(e.target.value)}
                            placeholder="e.g. 5"
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="tenant-max-runs" className="mb-1 block text-xs font-medium">
                            Max Runs/Month{" "}
                            <span className="text-muted-foreground font-normal">
                                (unlimited if blank)
                            </span>
                        </label>
                        <input
                            id="tenant-max-runs"
                            type="number"
                            min="1"
                            value={maxRunsPerMonth}
                            onChange={(e) => setMaxRunsPerMonth(e.target.value)}
                            placeholder="e.g. 10000"
                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="tenant-max-seats"
                            className="mb-1 block text-xs font-medium"
                        >
                            Max Seats{" "}
                            <span className="text-muted-foreground font-normal">
                                (unlimited if blank)
                            </span>
                        </label>
                        <input
                            id="tenant-max-seats"
                            type="number"
                            min="1"
                            value={maxSeats}
                            onChange={(e) => setMaxSeats(e.target.value)}
                            placeholder="e.g. 25"
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
                        {creating ? "Creating..." : "Create Tenant"}
                    </button>
                </div>
            </form>
        </div>
    );
}

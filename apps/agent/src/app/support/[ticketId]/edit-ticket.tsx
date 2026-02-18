"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

const TICKET_TYPES = [
    { value: "BUG", label: "Bug Report" },
    { value: "FEATURE_REQUEST", label: "Feature Request" },
    { value: "IMPROVEMENT", label: "Improvement" },
    { value: "QUESTION", label: "Question" }
];

interface EditTicketProps {
    ticketId: string;
    currentTitle: string;
    currentDescription: string;
    currentType: string;
    currentTags: string[];
}

export function EditTicketButton({
    ticketId,
    currentTitle,
    currentDescription,
    currentType,
    currentTags
}: EditTicketProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(currentTitle);
    const [description, setDescription] = useState(currentDescription);
    const [type, setType] = useState(currentType);
    const [tags, setTags] = useState(currentTags.join(", "));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const res = await fetch(`/api/support/${ticketId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    type,
                    tags: tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                })
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to update ticket");
                return;
            }

            setOpen(false);
            router.refresh();
        } catch {
            setError("Failed to update ticket. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors"
            >
                <Pencil className="h-3.5 w-3.5" />
                Edit
            </button>
        );
    }

    return (
        <div className="bg-card border-border rounded-lg border p-6">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide uppercase">Edit Ticket</h2>
                <button
                    onClick={() => {
                        setOpen(false);
                        setTitle(currentTitle);
                        setDescription(currentDescription);
                        setType(currentType);
                        setTags(currentTags.join(", "));
                        setError("");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="edit-type" className="text-sm font-medium">
                        Type
                    </label>
                    <select
                        id="edit-type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        {TICKET_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="edit-title" className="text-sm font-medium">
                        Title
                    </label>
                    <input
                        id="edit-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="edit-description" className="text-sm font-medium">
                        Description
                    </label>
                    <textarea
                        id="edit-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={5}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="edit-tags" className="text-sm font-medium">
                        Tags
                    </label>
                    <input
                        id="edit-tags"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="comma-separated tags"
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            setError("");
                        }}
                        className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !title.trim() || !description.trim()}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TICKET_TYPES = [
    { value: "BUG", label: "Bug Report", description: "Something isn't working correctly" },
    {
        value: "FEATURE_REQUEST",
        label: "Feature Request",
        description: "Suggest a new feature or capability"
    },
    {
        value: "IMPROVEMENT",
        label: "Improvement",
        description: "Enhance an existing feature"
    },
    { value: "QUESTION", label: "Question", description: "General question or help needed" }
];

export default function NewTicketPage() {
    const router = useRouter();
    const [type, setType] = useState("BUG");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;

        setSubmitting(true);
        setError("");

        try {
            const res = await fetch("/api/support", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    title: title.trim(),
                    description: description.trim(),
                    tags: tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                })
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create ticket");
                return;
            }

            const data = await res.json();
            router.push(`/support/${data.ticket.id}`);
        } catch {
            setError("Failed to create ticket. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
                <div className="flex items-center gap-2">
                    <Link
                        href="/support"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Tickets
                    </Link>
                </div>

                <div>
                    <h1 className="text-2xl font-bold">Submit a Ticket</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Report a bug, request a feature, or ask a question.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Ticket Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            {TICKET_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setType(t.value)}
                                    className={`rounded-lg border p-3 text-left transition-colors ${
                                        type === t.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-border/80 hover:bg-accent/50"
                                    }`}
                                >
                                    <span className="text-sm font-medium">{t.label}</span>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        {t.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <label htmlFor="title" className="text-sm font-medium">
                            Title
                        </label>
                        <input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Short, descriptive title..."
                            required
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label htmlFor="description" className="text-sm font-medium">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={
                                type === "BUG"
                                    ? "Steps to reproduce, expected vs actual behavior..."
                                    : "Describe what you need and why..."
                            }
                            required
                            rows={6}
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <label htmlFor="tags" className="text-sm font-medium">
                            Tags{" "}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <input
                            id="tags"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="e.g. ui, api, performance (comma-separated)"
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        />
                    </div>

                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3">
                        <Link
                            href="/support"
                            className="text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting || !title.trim() || !description.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {submitting ? "Submitting..." : "Submit Ticket"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

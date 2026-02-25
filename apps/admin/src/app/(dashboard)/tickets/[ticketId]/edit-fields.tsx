"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";

interface EditableTicket {
    id: string;
    title: string;
    description: string;
    type: string;
}

const TYPES = [
    { value: "BUG", label: "Bug" },
    { value: "FEATURE_REQUEST", label: "Feature Request" },
    { value: "IMPROVEMENT", label: "Improvement" },
    { value: "QUESTION", label: "Question" }
];

export function EditableTitle({ ticket }: { ticket: EditableTicket }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(ticket.title);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!value.trim() || value.trim() === ticket.title) {
            setEditing(false);
            setValue(ticket.title);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticket.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: value.trim() })
            });
            if (res.ok) {
                setEditing(false);
                router.refresh();
            }
        } finally {
            setSaving(false);
        }
    }

    if (editing) {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSave();
                        if (e.key === "Escape") {
                            setEditing(false);
                            setValue(ticket.title);
                        }
                    }}
                    autoFocus
                    disabled={saving}
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex-1 rounded-md border px-3 py-1.5 text-2xl font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
                <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="rounded-md p-1.5 text-green-500 transition-colors hover:bg-green-500/10"
                >
                    <Check className="h-5 w-5" />
                </button>
                <button
                    onClick={() => {
                        setEditing(false);
                        setValue(ticket.title);
                    }}
                    className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-500/10"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="group flex items-center gap-2">
            <h1 className="text-2xl font-bold">{ticket.title}</h1>
            <button
                onClick={() => setEditing(true)}
                className="rounded-md p-1 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-500/10 hover:text-gray-300"
            >
                <Pencil className="h-4 w-4" />
            </button>
        </div>
    );
}

export function EditableDescription({ ticket }: { ticket: EditableTicket }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(ticket.description);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!value.trim() || value.trim() === ticket.description) {
            setEditing(false);
            setValue(ticket.description);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticket.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: value.trim() })
            });
            if (res.ok) {
                setEditing(false);
                router.refresh();
            }
        } finally {
            setSaving(false);
        }
    }

    if (editing) {
        return (
            <div className="space-y-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoFocus
                    disabled={saving}
                    rows={8}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="rounded-md bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-500 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                        onClick={() => {
                            setEditing(false);
                            setValue(ticket.description);
                        }}
                        className="rounded-md bg-gray-500/10 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-500/20"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative">
            <button
                onClick={() => setEditing(true)}
                className="absolute top-0 right-0 rounded-md p-1 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-500/10 hover:text-gray-300"
            >
                <Pencil className="h-4 w-4" />
            </button>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {ticket.description}
            </div>
        </div>
    );
}

export function EditableType({ ticket }: { ticket: EditableTicket }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    async function handleChange(newType: string) {
        if (newType === ticket.type) return;
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticket.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: newType })
            });
            if (res.ok) router.refresh();
        } finally {
            setSaving(false);
        }
    }

    return (
        <select
            value={ticket.type}
            onChange={(e) => void handleChange(e.target.value)}
            disabled={saving}
            className="border-input bg-background rounded-md border px-2 py-0.5 text-xs font-medium"
        >
            {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                    {t.label}
                </option>
            ))}
        </select>
    );
}

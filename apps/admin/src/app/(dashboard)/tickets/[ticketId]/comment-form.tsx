"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TicketCommentForm({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const [content, setContent] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [sending, setSending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!content.trim()) return;

        setSending(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticketId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: content.trim(), isInternal })
            });
            if (res.ok) {
                setContent("");
                setIsInternal(false);
                router.refresh();
            }
        } finally {
            setSending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                    />
                    <span className="text-muted-foreground">
                        Internal note <span className="text-xs">(not visible to customer)</span>
                    </span>
                </label>
                <button
                    type="submit"
                    disabled={sending || !content.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {sending ? "Sending..." : "Send"}
                </button>
            </div>
        </form>
    );
}

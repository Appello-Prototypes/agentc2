"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TicketCommentForm({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!message.trim()) return;

        setSending(true);
        try {
            const res = await fetch(`/api/support/${ticketId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message.trim() })
            });
            if (res.ok) {
                setMessage("");
                router.refresh();
            }
        } finally {
            setSending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {sending ? "Sending..." : "Send Reply"}
                </button>
            </div>
        </form>
    );
}

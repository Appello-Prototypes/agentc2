"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteTicketButton({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/support/${ticketId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                router.push("/support");
            }
        } finally {
            setDeleting(false);
        }
    }

    if (!confirming) {
        return (
            <button
                onClick={() => setConfirming(true)}
                className="text-muted-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:text-red-500"
            >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-red-500">Delete this ticket?</span>
            <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
                {deleting ? "Deleting..." : "Confirm"}
            </button>
            <button
                onClick={() => setConfirming(false)}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
            >
                Cancel
            </button>
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteTicketButton({
    ticketId,
    ticketNumber
}: {
    ticketId: string;
    ticketNumber: number;
}) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticketId}`, {
                method: "DELETE",
                credentials: "include"
            });
            if (res.ok) {
                router.push("/tickets");
            }
        } finally {
            setDeleting(false);
        }
    }

    if (confirming) {
        return (
            <div className="bg-card border-border rounded-lg border">
                <div className="border-border border-b px-4 py-3">
                    <h3 className="text-sm font-semibold tracking-wide text-red-500 uppercase">
                        Delete Ticket
                    </h3>
                </div>
                <div className="space-y-3 p-4">
                    <p className="text-sm">
                        Are you sure you want to delete ticket <strong>#{ticketNumber}</strong>?
                        This will permanently remove the ticket and all its comments. This action
                        cannot be undone.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                            className="flex-1 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                        >
                            {deleting ? "Deleting..." : "Yes, Delete"}
                        </button>
                        <button
                            onClick={() => setConfirming(false)}
                            disabled={deleting}
                            className="flex-1 rounded-md bg-gray-500/10 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-500/20"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20"
        >
            <Trash2 className="h-4 w-4" />
            Delete Ticket
        </button>
    );
}

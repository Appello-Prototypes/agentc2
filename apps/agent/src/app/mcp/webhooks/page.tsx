"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import WebhookChat from "@/components/webhooks/WebhookChat";
import WebhookDetail from "@/components/webhooks/WebhookDetail";
import type { WebhookTrigger } from "@/components/webhooks/types";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    buttonVariants
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */

export default function WebhookWizardPage() {
    const [webhooks, setWebhooks] = useState<WebhookTrigger[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [chatKey, setChatKey] = useState(0);

    /* -------------------------------------------------------------- */
    /*  Load webhooks                                                 */
    /* -------------------------------------------------------------- */

    const loadWebhooks = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/triggers?type=webhook`);
            const data = await res.json();
            if (data.success) {
                setWebhooks(data.triggers || []);
            }
        } catch (err) {
            console.error("Failed to load webhooks:", err);
        }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            void loadWebhooks();
        }, 0);
        return () => clearTimeout(timeout);
    }, [loadWebhooks]);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const selectedWebhook = webhooks.find((wh) => wh.id === selectedId) || null;

    const handleToggleActive = async (target: WebhookTrigger) => {
        try {
            await fetch(`${getApiBase()}/api/triggers/${target.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !target.isActive })
            });
            await loadWebhooks();
        } catch (error) {
            console.error("Failed to update webhook:", error);
        }
    };

    const handleDelete = async (target: WebhookTrigger) => {
        const confirmed = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
        if (!confirmed) return;
        try {
            await fetch(`${getApiBase()}/api/triggers/${target.id}`, { method: "DELETE" });
            setSelectedId(null);
            await loadWebhooks();
        } catch (error) {
            console.error("Failed to delete webhook:", error);
        }
    };

    /* -------------------------------------------------------------- */
    /*  Render                                                        */
    /* -------------------------------------------------------------- */

    return (
        <div className="container mx-auto flex h-[calc(100vh-4rem)] flex-col space-y-6 py-6">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between">
                <div>
                    <Link
                        href="/mcp"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Back to Integrations
                    </Link>
                    <h1 className="mt-3 text-2xl font-semibold">Webhooks</h1>
                    <p className="text-muted-foreground text-sm">
                        Create and manage inbound webhooks.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setChatKey((prev) => prev + 1)}>
                    New setup
                </Button>
            </div>

            {/* Split view */}
            <div className="flex min-h-0 flex-1 gap-6">
                {/* Left: Chat */}
                <WebhookChat
                    key={chatKey}
                    webhooksCount={webhooks.length}
                    onRefresh={loadWebhooks}
                    className="w-1/2"
                />

                {/* Right: Webhook detail or list */}
                <div className="flex min-h-0 w-1/2 flex-col gap-4 overflow-auto">
                    {selectedWebhook ? (
                        /* Detail panel (when a webhook is selected) */
                        <WebhookDetail
                            webhook={selectedWebhook}
                            origin={origin}
                            onClose={() => setSelectedId(null)}
                            onToggleActive={handleToggleActive}
                            onDelete={handleDelete}
                        />
                    ) : (
                        /* Table (when no webhook is selected) */
                        <Card className="flex-1">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">All Webhooks</CardTitle>
                                    <button
                                        onClick={loadWebhooks}
                                        className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {webhooks.length === 0 ? (
                                    <div className="text-muted-foreground px-6 py-8 text-center text-sm">
                                        No webhooks yet. Create one using the chat.
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Agent</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Triggered</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {webhooks.map((wh) => (
                                                <TableRow
                                                    key={wh.id}
                                                    className={`cursor-pointer transition-colors ${selectedId === wh.id ? "bg-muted" : "hover:bg-muted/50"}`}
                                                    onClick={() =>
                                                        setSelectedId(
                                                            selectedId === wh.id ? null : wh.id
                                                        )
                                                    }
                                                >
                                                    <TableCell className="text-xs font-medium whitespace-nowrap">
                                                        {wh.name}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {wh.agent?.name || "Unknown"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                wh.isActive
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                        >
                                                            {wh.isActive ? "Active" : "Disabled"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {wh.triggerCount > 0
                                                            ? `${wh.triggerCount}x`
                                                            : "--"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                                        {new Date(
                                                            wh.createdAt
                                                        ).toLocaleDateString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useCallback } from "react";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Badge,
    HugeiconsIcon,
    icons
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

type EntityType = "agent" | "workflow" | "network";

interface EntityData {
    id: string;
    slug: string;
    name: string;
    visibility: string;
    publicToken: string | null;
}

interface ShareEmbedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entityType: EntityType;
    entity: EntityData;
    onVisibilityChange: (visibility: string, publicToken: string | null) => void;
}

function getEmbedPath(entityType: EntityType, slug: string): string {
    if (entityType === "agent") return `/embed/${slug}`;
    return `/embed/${entityType}/${slug}`;
}

function getApiPath(entityType: EntityType, slug: string): string {
    if (entityType === "agent") return `/api/agents/${slug}/chat/public`;
    if (entityType === "workflow") return `/api/workflows/${slug}/execute/public`;
    return `/api/networks/${slug}/execute/public`;
}

function getUpdateApiPath(entityType: EntityType, slug: string): string {
    if (entityType === "agent") return `/api/agents/${slug}`;
    if (entityType === "workflow") return `/api/workflows/${slug}`;
    return `/api/networks/${slug}`;
}

function CopyButton({ text, className }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <Button variant="outline" size="sm" className={className} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
        </Button>
    );
}

export function ShareEmbedDialog({
    open,
    onOpenChange,
    entityType,
    entity,
    onVisibilityChange
}: ShareEmbedDialogProps) {
    const [makingPublic, setMakingPublic] = useState(false);

    const isPublic = entity.visibility === "PUBLIC";
    const hasToken = Boolean(entity.publicToken);
    const isReady = isPublic && hasToken;

    const origin = typeof window !== "undefined" ? window.location.origin : "https://agentc2.ai";
    const embedPath = getEmbedPath(entityType, entity.slug);
    const embedUrl = `${origin}${embedPath}?token=${entity.publicToken ?? ""}`;
    const apiUrl = `${origin}${getApiPath(entityType, entity.slug)}`;

    const iframeSnippet = `<iframe\n  src="${embedUrl}"\n  width="100%" height="600"\n  style="border:none; border-radius:12px;"\n  allow="clipboard-write"\n></iframe>`;

    const handleMakePublic = useCallback(async () => {
        setMakingPublic(true);
        try {
            const res = await fetch(`${getApiBase()}${getUpdateApiPath(entityType, entity.slug)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visibility: "PUBLIC" })
            });
            const data = await res.json();
            if (data.success) {
                const updated = data.agent || data.workflow || data.network;
                onVisibilityChange(updated?.visibility ?? "PUBLIC", updated?.publicToken ?? null);
            }
        } catch (error) {
            console.error("Failed to make public:", error);
        } finally {
            setMakingPublic(false);
        }
    }, [entityType, entity.slug, onVisibilityChange]);

    const handleMakePrivate = useCallback(async () => {
        setMakingPublic(true);
        try {
            const res = await fetch(`${getApiBase()}${getUpdateApiPath(entityType, entity.slug)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visibility: "PRIVATE" })
            });
            const data = await res.json();
            if (data.success) {
                const updated = data.agent || data.workflow || data.network;
                onVisibilityChange(updated?.visibility ?? "PRIVATE", updated?.publicToken ?? null);
            }
        } catch (error) {
            console.error("Failed to make private:", error);
        } finally {
            setMakingPublic(false);
        }
    }, [entityType, entity.slug, onVisibilityChange]);

    const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HugeiconsIcon icon={icons.share!} className="size-5" strokeWidth={1.5} />
                        Share {entity.name}
                    </DialogTitle>
                    <DialogDescription>
                        Embed this {entityType} on any website with an iframe snippet.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    {/* Visibility Status */}
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium">Visibility</Label>
                                <Badge
                                    variant={isPublic ? "default" : "secondary"}
                                    className="h-5 text-[10px]"
                                >
                                    {entity.visibility}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {isPublic
                                    ? `This ${entityType} is publicly accessible via embed.`
                                    : `Set to Public to enable embedding.`}
                            </p>
                        </div>
                        {isPublic ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMakePrivate}
                                disabled={makingPublic}
                            >
                                {makingPublic ? "Updating..." : "Make Private"}
                            </Button>
                        ) : (
                            <Button size="sm" onClick={handleMakePublic} disabled={makingPublic}>
                                {makingPublic ? "Enabling..." : "Make Public"}
                            </Button>
                        )}
                    </div>

                    {isReady && (
                        <>
                            {/* Embed URL */}
                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs">
                                    {entityLabel} URL
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        readOnly
                                        value={embedUrl}
                                        className="font-mono text-xs"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(embedUrl, "_blank")}
                                    >
                                        Open
                                    </Button>
                                </div>
                            </div>

                            {/* Embed Code */}
                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs">Embed Code</Label>
                                <div className="relative">
                                    <pre className="bg-muted overflow-x-auto rounded-md p-3 pr-16 font-mono text-xs whitespace-pre-wrap">
                                        {iframeSnippet}
                                    </pre>
                                    <CopyButton
                                        text={iframeSnippet.replace(/\n/g, "")}
                                        className="absolute top-2 right-2"
                                    />
                                </div>
                            </div>

                            {/* API Endpoint */}
                            <div className="space-y-1.5">
                                <Label className="text-muted-foreground text-xs">
                                    API Endpoint
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input readOnly value={apiUrl} className="font-mono text-xs" />
                                    <CopyButton text={apiUrl} />
                                </div>
                                <p className="text-muted-foreground text-[11px]">
                                    Use with{" "}
                                    <code className="bg-muted rounded px-1">
                                        Authorization: Bearer {entity.publicToken?.slice(0, 8)}...
                                    </code>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

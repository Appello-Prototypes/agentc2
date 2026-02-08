import { useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label
} from "@repo/ui";
import { XIcon } from "lucide-react";
import type { WebhookTrigger } from "./types";

function CopyButton({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline transition-colors"
        >
            {copied ? "Copied!" : label || "Copy"}
        </button>
    );
}

export default function WebhookDetail({
    webhook,
    origin,
    onClose,
    onToggleActive,
    onDelete
}: {
    webhook: WebhookTrigger;
    origin: string;
    onClose: () => void;
    onToggleActive: (webhook: WebhookTrigger) => void;
    onDelete: (webhook: WebhookTrigger) => void;
}) {
    const fullUrl = webhook.webhookPath ? `${origin}/api/webhooks/${webhook.webhookPath}` : "";

    return (
        <Card className="border-primary/20">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-sm">{webhook.name}</CardTitle>
                        {webhook.description && (
                            <CardDescription className="text-xs">
                                {webhook.description}
                            </CardDescription>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
                        <XIcon className="size-3.5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Webhook URL</Label>
                    <div className="bg-muted flex items-center gap-2 rounded-md border px-3 py-2">
                        <code className="flex-1 text-xs break-all">{fullUrl}</code>
                        <CopyButton text={fullUrl} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Webhook Secret</Label>
                    <p className="text-muted-foreground text-xs">
                        The secret was shown once at creation. If you lost it, create a new webhook.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <span className="text-muted-foreground">Agent</span>
                        <div className="font-medium">{webhook.agent?.name || "Unknown"}</div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Status</span>
                        <div>
                            <Badge variant={webhook.isActive ? "default" : "secondary"}>
                                {webhook.isActive ? "Active" : "Disabled"}
                            </Badge>
                        </div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Times triggered</span>
                        <div className="font-medium">{webhook.triggerCount}</div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Last triggered</span>
                        <div className="font-medium">
                            {webhook.lastTriggeredAt
                                ? new Date(webhook.lastTriggeredAt).toLocaleString()
                                : "Never"}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onToggleActive(webhook)}>
                        {webhook.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => onDelete(webhook)}
                    >
                        Delete
                    </Button>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Test with cURL</Label>
                    <div className="bg-muted overflow-x-auto rounded-md border p-2.5">
                        <code className="block text-[11px] whitespace-pre">
                            {`curl -X POST ${fullUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"test": true}'`}
                        </code>
                    </div>
                    <CopyButton
                        text={`curl -X POST ${fullUrl} -H "Content-Type: application/json" -d '{"test": true}'`}
                        label="Copy cURL"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

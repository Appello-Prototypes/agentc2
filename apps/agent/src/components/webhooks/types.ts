export type WebhookTrigger = {
    id: string;
    name: string;
    description: string | null;
    entityType: "agent" | "workflow" | "network";
    webhookPath: string | null;
    webhookSecret: string | null;
    isActive: boolean;
    createdAt: string;
    triggerCount: number;
    lastTriggeredAt: string | null;
    agent: { slug: string; name: string } | null;
    workflow: { slug: string; name: string } | null;
    network: { slug: string; name: string } | null;
};

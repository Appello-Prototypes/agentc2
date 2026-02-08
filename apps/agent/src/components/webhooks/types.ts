export type WebhookTrigger = {
    id: string;
    name: string;
    description: string | null;
    webhookPath: string | null;
    webhookSecret: string | null;
    isActive: boolean;
    createdAt: string;
    triggerCount: number;
    lastTriggeredAt: string | null;
    agent: { slug: string; name: string } | null;
};

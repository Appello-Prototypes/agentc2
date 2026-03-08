"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { SetupWizard } from "@/components/integrations/SetupWizard";
import { IntegrationManagePage } from "@/components/integrations/IntegrationManagePage";
import { WhatsAppSetup } from "@/components/channels/WhatsAppSetup";
import { TelegramBotsManager } from "@/components/channels/TelegramBotsManager";
import { Loader2Icon } from "lucide-react";

const CUSTOM_PROVIDER_PAGES: Record<string, React.FC> = {
    "whatsapp-web": WhatsAppSetup,
    "telegram-bot": TelegramBotsManager
};

export default function ProviderDetailPage() {
    const params = useParams();
    const providerKey = typeof params.providerKey === "string" ? params.providerKey : "";
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const fetched = useRef(false);

    const CustomPage = CUSTOM_PROVIDER_PAGES[providerKey] ?? null;
    const hasCustomPage = CustomPage !== null;

    useEffect(() => {
        if (hasCustomPage) return;
        if (fetched.current) return;
        fetched.current = true;

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(
                    `${getApiBase()}/api/integrations/providers?key=${providerKey}`
                );
                const data = await res.json();
                if (cancelled) return;
                if (data.success && data.providers?.length > 0) {
                    const provider = data.providers[0];
                    setIsConnected(
                        provider.status === "connected" && provider.connections?.length > 0
                    );
                } else {
                    setIsConnected(false);
                }
            } catch {
                if (!cancelled) setIsConnected(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [providerKey, hasCustomPage]);

    if (CustomPage) {
        return <CustomPage />;
    }

    if (isConnected === null) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (isConnected) {
        return <IntegrationManagePage providerKey={providerKey} />;
    }

    return <SetupWizard providerKey={providerKey} />;
}

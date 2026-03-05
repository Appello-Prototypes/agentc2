"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { SetupWizard } from "@/components/integrations/SetupWizard";
import { IntegrationManagePage } from "@/components/integrations/IntegrationManagePage";
import { Loader2Icon } from "lucide-react";

export default function ProviderDetailPage() {
    const params = useParams();
    const providerKey = typeof params.providerKey === "string" ? params.providerKey : "";
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const fetched = useRef(false);

    useEffect(() => {
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
    }, [providerKey]);

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

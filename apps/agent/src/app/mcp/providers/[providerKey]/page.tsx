"use client";

import { useParams } from "next/navigation";
import { SetupWizard } from "@/components/integrations/SetupWizard";

export default function ProviderDetailPage() {
    const params = useParams();
    const providerKey = typeof params.providerKey === "string" ? params.providerKey : "";

    return <SetupWizard providerKey={providerKey} />;
}

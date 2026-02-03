"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirect to runs page by default for live agent view
 */
export default function LiveAgentPage() {
    const params = useParams();
    const router = useRouter();
    const agentSlug = params.agentSlug as string;

    useEffect(() => {
        router.replace(`/live/${agentSlug}/runs`);
    }, [agentSlug, router]);

    return null;
}

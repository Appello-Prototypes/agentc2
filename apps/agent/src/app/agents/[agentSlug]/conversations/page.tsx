"use client";

import { useParams } from "next/navigation";
import { ConversationsListContent } from "@/components/ConversationsListContent";

export default function AgentConversationsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    return (
        <div className="container mx-auto space-y-6 py-6">
            <ConversationsListContent agentSlug={agentSlug} />
        </div>
    );
}

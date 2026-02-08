import { redirect } from "next/navigation";

export default async function AgentSlugRedirect({
    params
}: {
    params: Promise<{ agentSlug: string }>;
}) {
    const { agentSlug } = await params;
    // Redirect to overview by default
    redirect(`/agents/${agentSlug}/overview`);
}

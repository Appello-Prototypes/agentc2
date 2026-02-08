import { redirect } from "next/navigation";

/**
 * Redirect to workspace - Live is just a reporting dashboard
 */
export default async function LiveAgentPage({
    params
}: {
    params: Promise<{ agentSlug: string }>;
}) {
    const { agentSlug } = await params;
    redirect(`/agents/${agentSlug}/overview`);
}

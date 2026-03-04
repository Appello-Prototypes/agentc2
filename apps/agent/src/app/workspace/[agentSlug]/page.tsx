import { redirect } from "next/navigation";

export default async function AgentWorkspacePage({
    params
}: {
    params: Promise<{ agentSlug: string }>;
}) {
    const { agentSlug } = await params;
    redirect(`/workspace?agent=${encodeURIComponent(agentSlug)}`);
}

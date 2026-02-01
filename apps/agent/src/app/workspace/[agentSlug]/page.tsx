import { redirect } from "next/navigation";

export default function AgentWorkspacePage({ params }: { params: { agentSlug: string } }) {
    // Redirect to overview by default
    redirect(`/workspace/${params.agentSlug}/overview`);
}

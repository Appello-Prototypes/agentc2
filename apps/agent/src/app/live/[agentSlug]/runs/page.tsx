import { redirect } from "next/navigation";

/**
 * Redirect to workspace runs - Live is just a reporting dashboard
 */
export default async function LiveAgentRunsPage({
    params,
    searchParams
}: {
    params: Promise<{ agentSlug: string }>;
    searchParams: Promise<{ runId?: string }>;
}) {
    const { agentSlug } = await params;
    const { runId } = await searchParams;

    // Redirect to workspace runs, preserving the runId query param if present
    const url = `/workspace/${agentSlug}/runs${runId ? `?runId=${runId}` : ""}`;
    redirect(url);
}

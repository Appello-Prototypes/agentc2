import { auth, getAppUrl } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AgentHomePage() {
    // Check if running standalone (not behind Caddy)
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const isStandalone = !host.includes("catalyst.localhost");

    // In standalone mode, show a landing page with links to demos
    if (isStandalone) {
        return (
            <main className="container mx-auto p-8">
                <h1 className="mb-4 text-4xl font-bold">Mastra AI Demos</h1>
                <p className="text-muted-foreground mb-8">
                    Explore AI primitives and capabilities powered by Mastra.
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link
                        href="/demos"
                        className="bg-card hover:bg-accent block rounded-lg border p-6 transition-colors"
                    >
                        <h2 className="mb-2 text-xl font-semibold">All Demos</h2>
                        <p className="text-muted-foreground text-sm">
                            Browse all available AI demos and experiments.
                        </p>
                    </Link>
                    <Link
                        href="/demos/agents"
                        className="bg-card hover:bg-accent block rounded-lg border p-6 transition-colors"
                    >
                        <h2 className="mb-2 text-xl font-semibold">Agents</h2>
                        <p className="text-muted-foreground text-sm">
                            Structured output, vision, and research agents.
                        </p>
                    </Link>
                    <Link
                        href="/demos/memory"
                        className="bg-card hover:bg-accent block rounded-lg border p-6 transition-colors"
                    >
                        <h2 className="mb-2 text-xl font-semibold">Memory</h2>
                        <p className="text-muted-foreground text-sm">
                            Working memory and semantic recall capabilities.
                        </p>
                    </Link>
                    <Link
                        href="/demos/workflows"
                        className="bg-card hover:bg-accent block rounded-lg border p-6 transition-colors"
                    >
                        <h2 className="mb-2 text-xl font-semibold">Workflows</h2>
                        <p className="text-muted-foreground text-sm">
                            Multi-step workflows with branching and loops.
                        </p>
                    </Link>
                    <Link
                        href="/demos/rag"
                        className="bg-card hover:bg-accent block rounded-lg border p-6 transition-colors"
                    >
                        <h2 className="mb-2 text-xl font-semibold">RAG</h2>
                        <p className="text-muted-foreground text-sm">
                            Retrieval-augmented generation pipeline.
                        </p>
                    </Link>
                    <Link
                        href="/demos/evals"
                        className="bg-card hover:bg-accent block rounded-lg border p-6 transition-colors"
                    >
                        <h2 className="mb-2 text-xl font-semibold">Evaluations</h2>
                        <p className="text-muted-foreground text-sm">
                            AI response scoring and quality metrics.
                        </p>
                    </Link>
                </div>
            </main>
        );
    }

    const session = await auth.api.getSession({
        headers: headersList
    });

    if (!session) {
        // Use absolute URL to redirect to frontend login page
        // Relative paths don't work correctly with basePath: "/agent"
        redirect(getAppUrl("https://catalyst.localhost"));
    }

    // Session is guaranteed to exist here due to redirect above
    return (
        <main className="container mx-auto p-8">
            <h1 className="mb-4 text-4xl font-bold">Catalyst Agent</h1>
            <div>
                <p className="mb-2 font-bold text-green-600">✓ Authenticated</p>
                <p>Welcome, {session.user.name}!</p>
                <p>Email: {session.user.email}</p>
            </div>
        </main>
    );
}

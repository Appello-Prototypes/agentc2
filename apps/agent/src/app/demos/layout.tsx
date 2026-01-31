import Link from "next/link";

export default function DemosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-background min-h-screen">
            <nav className="bg-card border-b">
                <div className="container mx-auto flex items-center justify-between px-4 py-3">
                    <Link href="/demos" className="text-xl font-bold">
                        Mastra Primitives
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/demos/agents" className="hover:text-primary transition-colors">
                            Agents
                        </Link>
                        <Link
                            href="/demos/workflows"
                            className="hover:text-primary transition-colors"
                        >
                            Workflows
                        </Link>
                        <Link href="/demos/memory" className="hover:text-primary transition-colors">
                            Memory
                        </Link>
                        <Link href="/demos/rag" className="hover:text-primary transition-colors">
                            RAG
                        </Link>
                        <Link href="/demos/evals" className="hover:text-primary transition-colors">
                            Evals
                        </Link>
                        <Link href="/demos/mcp" className="hover:text-primary transition-colors">
                            MCP
                        </Link>
                    </div>
                </div>
            </nav>
            <main className="container mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
    );
}

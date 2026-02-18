import Link from "next/link";
import Image from "next/image";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen">
            <header className="border-border/50 sticky top-0 z-40 border-b bg-black/80 backdrop-blur-xl">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <Image
                            src="/c2-icon.png"
                            alt="AgentC2"
                            width={22}
                            height={22}
                            className="rounded"
                        />
                        <span className="text-sm font-semibold">AgentC2 Documentation</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="text-muted-foreground hidden rounded-md border px-3 py-1.5 text-xs sm:block">
                            Search coming soon
                        </div>
                        <Link
                            href="/"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Back to site
                        </Link>
                    </div>
                </div>
            </header>
            {children}
        </div>
    );
}

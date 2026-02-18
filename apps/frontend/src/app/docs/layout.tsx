import Link from "next/link";
import Image from "next/image";
import { DocsSearch } from "@/components/docs/docs-search";
import { DOCS_PAGES } from "@/lib/content/docs";
import { getAllDocSlugs, getDocPage } from "@/lib/content/mdx";

function buildSearchEntries() {
    const entries: Array<{
        slug: string;
        title: string;
        section: string;
        description: string;
    }> = [];
    const seen = new Set<string>();

    const mdxSlugs = getAllDocSlugs();
    for (const slug of mdxSlugs) {
        const page = getDocPage(slug);
        if (page) {
            seen.add(slug);
            entries.push({
                slug,
                title: page.frontmatter.title,
                section: page.frontmatter.section,
                description: page.frontmatter.description
            });
        }
    }

    for (const page of DOCS_PAGES) {
        if (!seen.has(page.slug)) {
            entries.push({
                slug: page.slug,
                title: page.title.replace(" | AgentC2 Docs", ""),
                section: page.section,
                description: page.description
            });
        }
    }

    return entries;
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const searchEntries = buildSearchEntries();

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
                        <DocsSearch entries={searchEntries} />
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

import { DocsSearch } from "@/components/docs/docs-search";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/landing/footer";
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
            <SiteHeader>
                <DocsSearch entries={searchEntries} />
            </SiteHeader>
            {children}
            <Footer />
        </div>
    );
}

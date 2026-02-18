import Link from "next/link";
import { DOCS_PAGES, DOCS_SECTIONS } from "@/lib/content/docs";

interface TocItem {
    id: string;
    label: string;
}

interface DocsShellProps {
    currentSlug: string;
    currentSection: string;
    title: string;
    description: string;
    breadcrumb: Array<{ name: string; path: string }>;
    toc: TocItem[];
    children: React.ReactNode;
}

export function DocsShell({
    currentSlug,
    currentSection,
    title,
    description,
    breadcrumb,
    toc,
    children
}: DocsShellProps) {
    const pagesInCurrentSection = DOCS_PAGES.filter((page) => page.section === currentSection);

    return (
        <main className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[260px_1fr_220px]">
            <aside className="hidden lg:block">
                <p className="text-foreground mb-3 text-sm font-semibold">Documentation</p>
                <nav className="space-y-2">
                    {DOCS_SECTIONS.map((section) => {
                        const active = section.slug === currentSection;
                        return (
                            <Link
                                key={section.slug}
                                href={`/docs/${section.firstPageSlug}`}
                                className={`block rounded-md px-3 py-2 text-sm ${
                                    active
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {section.title}
                            </Link>
                        );
                    })}
                </nav>

                {pagesInCurrentSection.length > 0 ? (
                    <div className="mt-6 border-t pt-4">
                        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                            {
                                DOCS_SECTIONS.find((section) => section.slug === currentSection)
                                    ?.title
                            }
                        </p>
                        <nav className="space-y-1">
                            {pagesInCurrentSection.map((page) => {
                                const isCurrent = page.slug === currentSlug;
                                return (
                                    <Link
                                        key={page.slug}
                                        href={`/docs/${page.slug}`}
                                        className={`block rounded px-2 py-1 text-sm ${
                                            isCurrent
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {page.title.replace(" | AgentC2 Docs", "")}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                ) : null}
            </aside>

            <div>
                <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
                    {breadcrumb.map((item, index) => (
                        <span key={item.path} className="flex items-center gap-2">
                            <Link href={item.path} className="text-primary hover:text-primary/80">
                                {item.name}
                            </Link>
                            {index < breadcrumb.length - 1 ? (
                                <span className="text-muted-foreground">/</span>
                            ) : null}
                        </span>
                    ))}
                </nav>

                <header className="mb-8">
                    <h1 className="text-foreground text-4xl font-bold tracking-tight">{title}</h1>
                    <p className="text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed">
                        {description}
                    </p>
                </header>

                {children}
            </div>

            <aside className="hidden lg:block">
                <p className="text-foreground mb-3 text-sm font-semibold">On this page</p>
                <nav className="space-y-2">
                    {toc.map((item) => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            className="text-muted-foreground hover:text-foreground block text-sm"
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>
            </aside>
        </main>
    );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { DOCS_PAGES, DOCS_SECTIONS } from "@/lib/content/docs";

interface TocItem {
    id: string;
    label: string;
    level?: number;
}

interface MdxSection {
    slug: string;
    title: string;
    pages: Array<{ slug: string; title: string; order: number }>;
}

interface DocsShellProps {
    currentSlug: string;
    currentSection: string;
    title: string;
    description: string;
    breadcrumb: Array<{ name: string; path: string }>;
    toc: TocItem[];
    children: React.ReactNode;
    mdxSections?: MdxSection[];
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
            <path d="M4.5 2.5L7.5 6L4.5 9.5" />
        </svg>
    );
}

export function DocsShell({
    currentSlug,
    currentSection,
    title,
    description,
    breadcrumb,
    toc,
    children,
    mdxSections = []
}: DocsShellProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set([currentSection])
    );

    const toggleSection = (slug: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) {
                next.delete(slug);
            } else {
                next.add(slug);
            }
            return next;
        });
    };

    const sections =
        mdxSections.length > 0
            ? mdxSections.map((s) => ({
                  slug: s.slug,
                  title: s.title,
                  firstPageSlug: s.pages[0]?.slug ?? s.slug,
                  pages: s.pages.map((p) => ({
                      slug: p.slug,
                      title: p.title
                  }))
              }))
            : DOCS_SECTIONS.map((s) => ({
                  slug: s.slug,
                  title: s.title,
                  firstPageSlug: s.firstPageSlug,
                  pages: DOCS_PAGES.filter((p) => p.section === s.slug).map((p) => ({
                      slug: p.slug,
                      title: p.title.replace(" | AgentC2 Docs", "")
                  }))
              }));

    return (
        <main className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[260px_1fr_220px]">
            {/* Left sidebar */}
            <aside className="hidden lg:block">
                <p className="text-foreground mb-3 text-sm font-semibold">Documentation</p>
                <nav className="space-y-0.5">
                    {sections.map((section) => {
                        const isActive = section.slug === currentSection;
                        const isExpanded = expandedSections.has(section.slug);

                        return (
                            <div key={section.slug}>
                                <button
                                    onClick={() => toggleSection(section.slug)}
                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                                        isActive
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span>{section.title}</span>
                                    <ChevronIcon open={isExpanded} />
                                </button>

                                {isExpanded && section.pages.length > 0 && (
                                    <nav className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l border-white/10 pl-3">
                                        {section.pages.map((page) => {
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
                                                    {page.title}
                                                </Link>
                                            );
                                        })}
                                    </nav>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </aside>

            {/* Main content */}
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

            {/* Right TOC sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-20">
                    <p className="text-foreground mb-3 text-sm font-semibold">On this page</p>
                    <nav className="space-y-1.5">
                        {toc.map((item) => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                className={`text-muted-foreground hover:text-foreground block text-sm ${
                                    (item.level ?? 2) >= 3 ? "pl-3" : ""
                                }`}
                            >
                                {item.label}
                            </a>
                        ))}
                    </nav>
                </div>
            </aside>
        </main>
    );
}

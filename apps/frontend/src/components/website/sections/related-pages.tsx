import Link from "next/link";
import { cn } from "@repo/ui";

export interface RelatedPagesProps {
    pages: Array<{
        title: string;
        description: string;
        href: string;
    }>;
    title?: string;
    className?: string;
}

export function RelatedPages({ pages, title = "Related", className }: RelatedPagesProps) {
    return (
        <section className={cn("border-border/40 border-t py-16", className)}>
            <h2 className="text-foreground mb-8 text-xl font-semibold">{title}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((page, index) => (
                    <Link
                        key={index}
                        href={page.href}
                        className="border-border/60 bg-card hover:border-primary/20 hover:shadow-primary/5 rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg"
                    >
                        <h3 className="text-foreground mb-2 text-lg font-semibold">{page.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {page.description}
                        </p>
                        <span className="text-primary mt-3 block text-sm font-medium">
                            Learn more →
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

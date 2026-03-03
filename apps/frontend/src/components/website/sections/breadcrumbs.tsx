import Link from "next/link";
import { cn } from "@repo/ui";
import { breadcrumbJsonLd } from "@/lib/seo";

export interface BreadcrumbsProps {
    items: Array<{
        label: string;
        href?: string;
    }>;
    currentPath?: string;
    className?: string;
}

export function Breadcrumbs({ items, currentPath, className }: BreadcrumbsProps) {
    const schemaItems = items
        .map((item, index) => {
            const path = item.href ?? (index === items.length - 1 ? currentPath : undefined);
            return path ? { name: item.label, path } : null;
        })
        .filter((x): x is { name: string; path: string } => x !== null);

    const schema = schemaItems.length > 0 ? breadcrumbJsonLd(schemaItems) : null;

    return (
        <>
            {schema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            )}
            <nav
                className={cn("flex items-center gap-2 text-sm", className)}
                aria-label="Breadcrumb"
            >
                {items.map((item, index) => (
                    <span key={index} className="flex items-center gap-2">
                        {index > 0 && (
                            <span className="text-muted-foreground" aria-hidden>
                                /
                            </span>
                        )}
                        {item.href ? (
                            <Link
                                href={item.href}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-foreground font-medium">{item.label}</span>
                        )}
                    </span>
                ))}
            </nav>
        </>
    );
}

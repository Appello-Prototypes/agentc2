import Link from "next/link";
import { cn } from "@repo/ui";

export interface FeatureGridProps {
    features: Array<{
        icon?: React.ReactNode;
        title: string;
        description: string;
        href?: string;
    }>;
    columns?: 2 | 3 | 4;
    className?: string;
}

export function FeatureGrid({ features, columns = 3, className }: FeatureGridProps) {
    const gridCols =
        columns === 2
            ? "sm:grid-cols-2"
            : columns === 3
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : "sm:grid-cols-2 lg:grid-cols-4";

    return (
        <div className={cn("grid gap-6", gridCols, className)}>
            {features.map((feature, index) => {
                const card = (
                    <div className="border-border/60 bg-card hover:border-primary/20 hover:shadow-primary/5 rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg">
                        {feature.icon && (
                            <div className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                                {feature.icon}
                            </div>
                        )}
                        <h3 className="text-foreground mb-2 text-lg font-semibold">
                            {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {feature.description}
                        </p>
                    </div>
                );

                return feature.href ? (
                    <Link key={index} href={feature.href}>
                        {card}
                    </Link>
                ) : (
                    <div key={index}>{card}</div>
                );
            })}
        </div>
    );
}

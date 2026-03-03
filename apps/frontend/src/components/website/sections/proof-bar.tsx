import { cn } from "@repo/ui";

export interface ProofBarProps {
    stats: Array<{ value: string; label: string }>;
    className?: string;
}

export function ProofBar({ stats, className }: ProofBarProps) {
    return (
        <section className={cn("border-border/40 border-y py-16", className)}>
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
                    {stats.map((stat, index) => (
                        <div key={index} className="text-center">
                            <div className="text-foreground text-2xl font-bold md:text-3xl">
                                {stat.value}
                            </div>
                            <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

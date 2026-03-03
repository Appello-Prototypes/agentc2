import { cn } from "@repo/ui";

export interface ComparisonTableProps {
    rows: Array<{
        feature: string;
        us: string | boolean;
        them: string | boolean;
    }>;
    usLabel?: string;
    themLabel?: string;
    className?: string;
}

export function ComparisonTable({
    rows,
    usLabel = "AgentC2",
    themLabel = "Them",
    className
}: ComparisonTableProps) {
    return (
        <div className={cn("border-border/60 overflow-hidden rounded-2xl border", className)}>
            <div className="bg-muted/50 grid grid-cols-3 px-6 py-3">
                <div className="text-left text-xs font-semibold tracking-wider uppercase">
                    Feature
                </div>
                <div className="text-center text-xs font-semibold tracking-wider uppercase">
                    {usLabel}
                </div>
                <div className="text-center text-xs font-semibold tracking-wider uppercase">
                    {themLabel}
                </div>
            </div>
            {rows.map((row, index) => (
                <div
                    key={index}
                    className={cn(
                        "border-border/40 grid grid-cols-3 border-t px-6 py-3",
                        index % 2 === 0 ? "bg-card" : "bg-card/50"
                    )}
                >
                    <div className="text-foreground text-sm font-medium">{row.feature}</div>
                    <div className="text-center">
                        {typeof row.us === "boolean" ? (
                            <span
                                className={
                                    row.us ? "font-bold text-emerald-400" : "font-bold text-red-400"
                                }
                            >
                                {row.us ? "✓" : "✗"}
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-sm">{row.us}</span>
                        )}
                    </div>
                    <div className="text-center">
                        {typeof row.them === "boolean" ? (
                            <span
                                className={
                                    row.them
                                        ? "font-bold text-emerald-400"
                                        : "font-bold text-red-400"
                                }
                            >
                                {row.them ? "✓" : "✗"}
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-sm">{row.them}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

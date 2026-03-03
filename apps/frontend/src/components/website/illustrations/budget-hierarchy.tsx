import { cn } from "@repo/ui";

const budgetRows = [
    { level: 0, label: "Subscription", used: 10000, limit: 10000, pct: 100 },
    { level: 1, label: "Acme Corp", used: 4200, limit: 5000, pct: 84 },
    { level: 2, label: "john@acme.com", used: 800, limit: 1500, pct: 53 },
    { level: 3, label: "Research Agent", used: 120, limit: 500, pct: 24 },
    { level: 2, label: "sarah@acme.com", used: 1400, limit: 1500, pct: 93 }
];

function formatAmount(n: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(n);
}

export function BudgetHierarchyIllustration({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "border-border/60 bg-card overflow-hidden rounded-2xl border p-4 md:p-6",
                className
            )}
        >
            <div className="border-border/40 mb-3 flex items-center gap-2 border-b pb-3">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                    BUDGET
                </span>
                <span className="text-foreground text-xs font-semibold">Organization Budget</span>
            </div>

            <div className="space-y-3">
                <div className={cn("pl-0")}>
                    <div className="flex items-center justify-between py-1">
                        <span className="text-foreground text-xs font-medium">Subscription</span>
                        <span className="text-muted-foreground text-xs">
                            {formatAmount(10000)}/mo
                        </span>
                    </div>
                    <div className="bg-muted/50 h-1.5 overflow-hidden rounded-full">
                        <div className="bg-primary h-full w-full rounded-full" aria-hidden />
                    </div>
                </div>

                {budgetRows.slice(1).map((row, i) => {
                    const isHigh = row.pct >= 80;
                    return (
                        <div key={i} className={cn("pl-4", row.level === 3 && "pl-8")}>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-foreground text-xs font-medium">
                                    {row.label}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {formatAmount(row.used)} of {formatAmount(row.limit)}
                                </span>
                            </div>
                            <div className="bg-muted/50 h-1.5 overflow-hidden rounded-full">
                                <div
                                    className={cn(
                                        "h-full rounded-full",
                                        isHigh ? "bg-amber-500" : "bg-primary"
                                    )}
                                    style={{ width: `${row.pct}%` }}
                                    aria-hidden
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
